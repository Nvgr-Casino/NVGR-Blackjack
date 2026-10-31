// Practice Hold'em against computer players, entirely in this browser: the
// same rules (src/poker/rules.js), the same table and HUD, but no database
// and no other people. There is nothing to hide the cards from, so they are
// dealt from a deck shuffled here rather than by the players' encryption
// protocol; the bots' cards are simply never shown until a showdown.
//
// Practice chips: every seat buys in for the table maximum, the house tops
// you up if you go broke, and nothing touches the account balance.
//
// A tournament against the bots is different: five of them and you, played
// to the end under tournament.js, and for real — the buy-in comes off your
// balance and a prize goes on it. Leaving before the end forfeits your seat
// (in the place you had reached, which may still be paid).

import * as R from '../poker/rules.js';
import * as T from '../poker/tournament.js';
import { decide, newPersonality } from '../poker/bot.js';
import { CARDS, shuffle } from '../poker/mentalPoker.js';
import { CHARACTERS } from '../scene/character.js';
import { FELT_THEME_KEYS } from '../scene/table.js';
import { DEALER_KEYS } from '../scene/dealer.js';
import { safeKey } from './roomLogic.js';
import * as S from './session.js';
import * as Leaderboard from './leaderboard.js';

// The pace of the table: a pause to show each thing happening.
const DEAL_MS = 1400;
const BOARD_MS = 900;
const SHOW_MS = 800;
const NEXT_HAND_MS = 1500;
const THINK_MS = [700, 2100];
const TICK_MS = 200;

let room = null;
let deck = [];
let hole = {};
let bots = {};          // key -> personality
let timer = null;
let waitUntil = 0;      // nothing happens before this
let thinking = null;    // the bot deciding, and when it acts

const me = () => safeKey(S.session.uid);

/** Starts a practice table at stakes `tierIndex` with `botCount` computer players. */
export function startPractice(tierIndex = 0, botCount = 3) {
  stopPractice();
  const stakes = R.POKER_STAKES[tierIndex];
  room = {
    code: 'PRACTICE', game: 'holdem', offline: true, isPublic: false,
    tier: tierIndex + 1, sb: stakes.sb, bb: stakes.bb,
    felt: FELT_THEME_KEYS[(tierIndex + 1) % FELT_THEME_KEYS.length],
    dealerType: DEALER_KEYS[Math.floor(Math.random() * DEALER_KEYS.length)],
    players: {}, hand: null, buttonSeat: null, handCount: 0,
    chat: [], log: ['A practice table — practice chips, nothing off your balance.'],
  };
  const { max } = R.buyInRange(room);
  R.seatPlayer(room, me(), { name: S.session.name, character: S.session.character, seat: 2, buyIn: max });
  // Bots in the other seats, spread round the table.
  const seats = [4, 0, 3, 1, 5].slice(0, Math.max(1, Math.min(5, botCount)));
  const cast = shuffle(CHARACTERS.filter((c) => c.id !== S.session.character));
  seats.forEach((seat, i) => {
    const who = cast[i % cast.length];
    const key = 'bot' + i;
    R.seatPlayer(room, key, { name: who.name, character: who.id, seat, buyIn: max });
    room.players[key].bot = true;
    room.players[key].waitBB = false;
    bots[key] = newPersonality();
  });
  room.players[me()].waitBB = false;
  S.session.code = room.code;
  S.session.screen = 'table';
  publish();
  waitUntil = performance.now() + 800;
  timer = setInterval(step, TICK_MS);
}

/** A tournament against five bots: `defId` from tournament.js. Returns false if you can't cover the buy-in. */
export function startTournament(defId) {
  const def = T.tournamentById(defId);
  if (!def) return false;
  if (S.session.chips < def.buyIn) {
    S.setFormError(`The ${def.name} buy-in is ${def.buyIn.toLocaleString()} — you have ${S.session.chips.toLocaleString()}.`);
    return false;
  }
  stopPractice();
  S.session.chips -= def.buyIn;
  S.saveAccountChips(S.session.uid, S.session.name, S.session.chips).catch(() => {});
  room = {
    code: 'PRACTICE', game: 'holdem', offline: true, isPublic: false,
    felt: FELT_THEME_KEYS[def.tier % FELT_THEME_KEYS.length],
    dealerType: DEALER_KEYS[Math.floor(Math.random() * DEALER_KEYS.length)],
    players: {}, hand: null, buttonSeat: null, handCount: 0, chat: [], log: [],
  };
  T.setupTournament(room, def);
  // You in the middle seat, the bots round you.
  const cast = shuffle(CHARACTERS.filter((c) => c.id !== S.session.character));
  const order = [{ key: me(), name: S.session.name, character: S.session.character }]
    .concat([0, 1, 2, 3, 4].map((i) => ({ key: 'bot' + i, name: cast[i % cast.length].name, character: cast[i % cast.length].id, bot: true })));
  // register() takes the first free seat; you are given seat 2 by seating
  // two bots first.
  [order[1], order[2], order[0], order[3], order[4], order[5]].forEach((p) => T.register(room, p.key, { name: p.name, character: p.character, bot: !!p.bot, now: Date.now() }));
  order.slice(1).forEach((p) => { bots[p.key] = newPersonality(); });
  T.start(room, Date.now());
  S.session.code = room.code;
  S.session.screen = 'table';
  setLeaveGuard(true);
  publish();
  waitUntil = performance.now() + 1200;
  timer = setInterval(step, TICK_MS);
  return true;
}

/** Plays it again: the same tournament, a new buy-in. */
export function playAgain() {
  const id = room && room.tournament && room.tournament.id;
  if (id) startTournament(id);
}

export function stopPractice() {
  if (timer) clearInterval(timer);
  timer = null;
  room = null; deck = []; hole = {}; bots = {}; thinking = null;
  setLeaveGuard(false);
}

/** Leaving the table: from a tournament still running, a forfeit. */
export function leavePractice() {
  if (room && T.running(room) && room.players[me()]) {
    T.withdraw(room, me(), Date.now());
    payOut();
  }
  stopPractice();
}

// Closing the tab mid-tournament forfeits it; the browser asks first.
const guard = (e) => { e.preventDefault(); e.returnValue = ''; };
function setLeaveGuard(on) {
  window.removeEventListener('beforeunload', guard);
  if (on) window.addEventListener('beforeunload', guard);
}

// Your result: any prize onto the balance, and the record onto the board.
function payOut() {
  const place = T.placeOf(room, me());
  if (!place) return;
  const prize = (room.prizes && room.prizes[me()]) || 0;
  if (room.prizes) delete room.prizes[me()];
  if (prize) {
    S.session.chips += prize;
    S.saveAccountChips(S.session.uid, S.session.name, S.session.chips).catch(() => {});
  }
  Leaderboard.recordTournament(S.session.uid, { name: S.session.name, character: S.session.character, place: place.place, prize });
}

export const isPractice = (r) => !!(r && r.offline);

// The HUD reads the room from the session, as at any table: a copy, so the
// bridge can tell one state from the next.
function publish() {
  S.session.room = JSON.parse(JSON.stringify(room));
  S.refresh();
}

/** This player's two cards in the hand in progress. */
export function myCards() {
  return room && room.hand && hole[me()] ? hole[me()] : null;
}

// ---------- what the player does ----------

/** A change to the table from outside the hand — a drink, a tip (service.js). */
export function mutate(fn) {
  if (!room) return;
  fn(room);
  publish();
}

export function act(action, amount) {
  if (!room || !R.applyAction(room, me(), action, amount, Date.now())) return;
  waitUntil = performance.now() + 300;
  publish();
}
export function setSitOut(out) {
  if (!room || T.isTournament(room)) return;
  R.setSitOut(room, me(), out, Date.now());
  room.players[me()].waitBB = false;
  publish();
}
export function topUp() {
  const p = room && room.players[me()];
  if (!p || R.inHand(room, me()) || T.isTournament(room)) return;
  p.stack = R.buyInRange(room).max;
  publish();
}

// ---------- the table running itself ----------

function step() {
  if (!room) return;
  const now = performance.now();
  if (now < waitUntil) return;
  const h = room.hand;
  if (!h) { nextHand(); return; }

  if (h.phase === 'deal') {
    R.onDealt(room, Date.now());
    publish();
    return;
  }
  if (h.phase === 'board') {
    const board = (h.board || []).slice();
    deck.pop(); // the burn
    while (board.length < h.boardTarget) board.push(deck.pop());
    R.onBoard(room, board, Date.now());
    waitUntil = now + BOARD_MS;
    publish();
    return;
  }
  if (h.phase === 'showdown') {
    (h.showOrder || []).forEach((k) => R.onShown(room, k, hole[k], Date.now()));
    waitUntil = now + SHOW_MS;
    publish();
    return;
  }
  if (h.phase === 'done') {
    if (Date.now() >= h.endsAt) {
      if (T.isTournament(room)) { endTournamentHand(); return; }
      // You are never stood up from your own practice table for sitting out.
      const mine = room.players[me()];
      if (mine && mine.status === 'sitout') mine.sitOutAt = Date.now();
      R.clearHand(room, Date.now());
      restock();
      waitUntil = now + NEXT_HAND_MS;
      publish();
    }
    return;
  }
  // Betting.
  if (R.processTimeout(room, Date.now())) { publish(); return; }
  const who = h.toAct;
  const p = room.players[who];
  if (!p || !p.bot) { thinking = null; return; }
  if (!thinking || thinking.key !== who || thinking.hand !== h.id + h.street + h.currentBet) {
    const [lo, hi] = THINK_MS;
    thinking = { key: who, hand: h.id + h.street + h.currentBet, at: now + lo + Math.random() * (hi - lo) };
    return;
  }
  if (now < thinking.at) return;
  thinking = null;
  botAct(who);
}

function botAct(key) {
  const h = room.hand;
  const legal = R.legalActions(room, key);
  if (!legal) return;
  const live = h.players.filter((k) => !h.folded[k]);
  const order = h.players;
  const view = {
    cards: hole[key],
    board: h.board || [],
    pot: R.pot(room),
    toCall: legal.callAmount,
    currentBet: h.currentBet,
    bigBlind: room.bb,
    opponents: live.length - 1,
    street: h.street,
    position: order.indexOf(key) / Math.max(1, order.length - 1),
  };
  const [action, amount] = decide(legal, view, bots[key]);
  if (!R.applyAction(room, key, action, amount, Date.now())) R.applyAction(room, key, legal.check ? 'check' : 'fold', 0, Date.now());
  publish();
}

// A tournament hand over: the knocked out leave, and once you are one of
// them — or the last one standing — it is over for you.
function endTournamentHand() {
  T.afterHand(room, Date.now());
  R.clearHand(room, Date.now());
  // Nobody sits out of a tournament: out of time is folded, not left out.
  Object.values(room.players).forEach((p) => { if (p.status === 'sitout') { p.status = 'active'; p.timeouts = 0; } });
  if (T.placeOf(room, me())) {
    payOut();
    if (timer) clearInterval(timer);
    timer = null;
    setLeaveGuard(false);
  }
  waitUntil = performance.now() + NEXT_HAND_MS;
  publish();
}

function nextHand() {
  const id = 'P' + Date.now().toString(36);
  if (T.isTournament(room)) {
    if (!T.running(room)) return;
    T.beforeHand(room);
  }
  if (!R.startHand(room, id, Date.now())) {
    if (T.isTournament(room)) return;
    // Everyone else sat out or broke: there's always another bot.
    restock();
    waitUntil = performance.now() + NEXT_HAND_MS;
    publish();
    return;
  }
  // Shuffled here, and dealt round from the small blind, two passes.
  deck = shuffle(CARDS);
  hole = {};
  const order = room.hand.players;
  for (let pass = 0; pass < 2; pass++) order.forEach((k) => { (hole[k] = hole[k] || []).push(deck.pop()); });
  waitUntil = performance.now() + DEAL_MS;
  publish();
}

// Bots that went broke buy in again; you are topped up too, if you're out.
function restock() {
  const { max } = R.buyInRange(room);
  Object.entries(room.players).forEach(([k, p]) => {
    if (p.stack <= 0) {
      p.stack = max;
      p.status = 'active';
      p.waitBB = false;
      if (!p.bot) room.log = (room.log || []).concat('The house tops your practice stack up to ' + max.toLocaleString() + '.').slice(-10);
    }
    if (p.bot && p.status === 'sitout') { p.status = 'active'; p.timeouts = 0; }
  });
}
