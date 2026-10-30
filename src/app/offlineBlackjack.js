// A blackjack tournament against four computer players, entirely in this
// browser: the same rules (roomLogic.js, src/blackjack/tournament.js), the
// same table and HUD, no database. The room lives here; session.js sends
// this player's moves to mutate() instead of to a transaction.
//
// It is played for real: the buy-in comes off your balance and a prize goes
// on it. Leaving, or closing the tab, before the end forfeits your seat in
// the place you had reached — which may still be paid.

import * as L from './roomLogic.js';
import * as T from '../blackjack/tournament.js';
import { botBet, botPlay } from '../blackjack/bot.js';
import { CHARACTERS } from '../scene/character.js';
import { FELT_THEME_KEYS } from '../scene/table.js';
import { DEALER_KEYS } from '../scene/dealer.js';
import * as S from './session.js';
import * as Leaderboard from './leaderboard.js';

// The pace of the table: time to watch the cards go out and the bots think.
const TICK_MS = 200;
const BET_MS = [800, 2400];
const THINK_MS = [800, 1700];
const PER_CARD_MS = 480;     // the deal, card by card, before anyone acts
const AFTER_MOVE_MS = 700;   // a card drawn lands before the next decision

let room = null;
let timer = null;
let waitUntil = 0;
let plans = {};              // what each bot will do, and when
let shownPhase = null;
let shownRound = null;

const me = () => L.safeKey(S.session.uid);
const between = ([lo, hi]) => lo + Math.random() * (hi - lo);
const MOVES = { hit: L.applyHit, stand: L.applyStand, double: L.applyDouble, split: L.applySplit };

export const isOfflineBlackjack = (r) => !!(r && r.offline && r.game !== 'holdem');
export const active = () => !!room;

/** Starts `defId` against four bots. Returns false if the buy-in can't be covered. */
export function startBjTournament(defId) {
  const def = T.bjTournamentById(defId);
  if (!def) return false;
  if (S.session.chips < def.buyIn) {
    S.setFormError(`The ${def.name} buy-in is ${def.buyIn.toLocaleString()} — you have ${S.session.chips.toLocaleString()}.`);
    return false;
  }
  stop();
  S.session.chips -= def.buyIn;
  S.saveAccountChips(S.session.uid, S.session.name, S.session.chips).catch(() => {});
  room = {
    code: 'PRACTICE', offline: true,
    felt: FELT_THEME_KEYS[def.tier % FELT_THEME_KEYS.length],
    dealerType: DEALER_KEYS[Math.floor(Math.random() * DEALER_KEYS.length)],
    players: {}, playerOrder: [], dealer: { hand: [], hiddenRevealed: false }, deck: [],
    turnOrder: [], currentTurnIndex: 0, dealtIn: [], chat: [], log: [],
  };
  L.shuffleShoe(room);
  T.setupTournament(room, def);
  const cast = CHARACTERS.filter((c) => c.id !== S.session.character).sort(() => Math.random() - 0.5);
  T.register(room, S.session.uid, { name: S.session.name, character: S.session.character, now: Date.now() });
  for (let i = 0; i < 4; i++) {
    const who = cast[i % cast.length];
    T.register(room, 'bot' + i, { name: who.name, character: who.id, bot: true, now: Date.now() });
  }
  // You in the middle chair, the bots either side.
  [me(), 'bot0', 'bot1', 'bot2', 'bot3'].forEach((k, i) => { room.players[k].seat = [2, 0, 1, 3, 4][i]; });
  T.start(room, Date.now());
  S.session.code = room.code;
  S.session.screen = 'table';
  setLeaveGuard(true);
  publish();
  waitUntil = performance.now() + 1200;
  timer = setInterval(step, TICK_MS);
  return true;
}

/** The same tournament again, a new buy-in. */
export function playAgain() {
  const id = room && room.tournament && room.tournament.id;
  if (id) startBjTournament(id);
}

function stop() {
  if (timer) clearInterval(timer);
  timer = null;
  room = null; plans = {}; shownPhase = null; shownRound = null;
  setLeaveGuard(false);
}

/** Leaving the table: from a tournament still running, a forfeit. */
export function leave() {
  if (room && T.running(room) && room.players[me()]) {
    T.withdraw(room, me(), Date.now());
    payOut();
  }
  stop();
}

/** This player's move, from session.js: applied to the room here. */
export function mutate(fn) {
  if (!room) return;
  fn(room);
  waitUntil = Math.max(waitUntil, performance.now() + AFTER_MOVE_MS);
  publish();
}

// Closing the tab mid-tournament forfeits it; the browser asks first.
const guard = (e) => { e.preventDefault(); e.returnValue = ''; };
function setLeaveGuard(on) {
  window.removeEventListener('beforeunload', guard);
  if (on) window.addEventListener('beforeunload', guard);
}

// The HUD reads the room from the session, as at any table: a copy, so the
// bridge can tell one state from the next.
function publish() {
  S.session.room = JSON.parse(JSON.stringify(room));
  S.refresh();
}

// Your result: any prize onto the balance, the record onto the board.
let paid = null;
function payOut() {
  const place = T.placeOf(room, me());
  if (!place || paid === room) return;
  paid = room;
  const prize = (room.prizes && room.prizes[me()]) || 0;
  if (room.prizes) delete room.prizes[me()];
  if (prize) {
    S.session.chips += prize;
    S.saveAccountChips(S.session.uid, S.session.name, S.session.chips).catch(() => {});
  }
  Leaderboard.recordTournament(S.session.uid, { name: S.session.name, character: S.session.character, place: place.place, prize });
}

// ---------- the table running itself ----------

function step() {
  if (!room) return;
  const now = performance.now();
  // The countdown pill ticks without redrawing the screen.
  const pill = document.getElementById('countdownText');
  if (pill) {
    const cur = (room.turnOrder || [])[room.currentTurnIndex];
    const label = L.countdownLabel(room, room.phase === 'playing' && cur && cur.pid === me());
    if (label) pill.textContent = label;
  }
  // A new deal: give the cards time to go out before anyone acts.
  if (room.phase !== shownPhase || room.round !== shownRound) {
    if (room.phase === 'playing' || room.phase === 'insurance') {
      const cards = 2 * (room.dealtIn || []).length + 2;
      waitUntil = Math.max(waitUntil, now + cards * PER_CARD_MS);
    }
    shownPhase = room.phase;
    shownRound = room.round;
    plans = {};
  }
  if (now < waitUntil) return;
  const r = room;
  const t = Date.now();

  if (T.finished(r)) { finishUp(); return; }

  if (r.phase === 'betting') {
    let changed = false;
    r.playerOrder.forEach((k) => {
      const p = r.players[k];
      if (!p || !p.bot || p.status !== 'betting') return;
      if (!plans[k]) { plans[k] = { at: now + between(BET_MS) }; return; }
      if (now < plans[k].at) return;
      L.applyBet(r, k, botBet(r, k));
      changed = true;
    });
    if (r.phase === 'betting' && r.bettingDeadline && t >= r.bettingDeadline) {
      T.autoBets(r);
      if (r.phase === 'betting') L.processBettingTimeoutLogic(r);
      changed = true;
    }
    if (changed) publish();
    return;
  }

  if (r.phase === 'insurance') {
    let changed = false;
    (r.dealtIn || []).forEach((k) => {
      const p = r.players[k];
      if (p && p.bot && !p.insuranceDecided && r.phase === 'insurance') { L.applyInsurance(r, k, false); changed = true; }
    });
    if (r.phase === 'insurance' && r.insuranceDeadline && t >= r.insuranceDeadline) { L.processInsuranceTimeout(r); changed = true; }
    if (changed) publish();
    return;
  }

  if (r.phase === 'playing') {
    const cur = r.turnOrder[r.currentTurnIndex];
    const p = cur && r.players[cur.pid];
    if (p && p.bot) {
      const id = cur.pid + ':' + cur.hi + ':' + p.hands[cur.hi].cards.length;
      if (!plans.turn || plans.turn.id !== id) { plans.turn = { id, at: now + between(THINK_MS) }; return; }
      if (now < plans.turn.at) return;
      const move = botPlay(r, cur.pid);
      if (!MOVES[move](r, cur.pid)) L.applyStand(r, cur.pid);
      waitUntil = now + AFTER_MOVE_MS;
      publish();
      return;
    }
    if (r.turnDeadline && t >= r.turnDeadline) { L.processTurnTimeoutLogic(r); publish(); }
    return;
  }

  if (r.phase === 'results') {
    if (r.resultsAt && t - r.resultsAt >= L.resultsPauseFor(r)) {
      T.afterRound(r, t);
      publish();
      // Out of it, or over: the result stays on the table.
      if (T.placeOf(r, me()) || T.finished(r)) finishUp();
    }
  }
}

function finishUp() {
  payOut();
  if (timer) clearInterval(timer);
  timer = null;
  setLeaveGuard(false);
  publish();
}
