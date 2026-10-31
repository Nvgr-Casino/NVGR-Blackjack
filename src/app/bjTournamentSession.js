// Blackjack tournaments over Firebase (the rules are src/blackjack/
// tournament.js). A tournament is a public blackjack room with a
// `tournament` on it, listed in the same public index as every table; the
// shared clock in session.js runs its hands like any public table's, and
// hands the end of each one to the tournament (afterRound).
//
// Money: registering takes the buy-in from the account, and if the seat is
// lost by the time the transaction runs it goes straight back. The stack is
// tournament chips and never touches the account (session.js leaves a
// tournament room's chips alone). A prize waits in the room's `prizes` for
// the winner's own client to collect.

import { ref, get, set, remove, runTransaction } from 'firebase/database';
import { db } from '../firebase/config.js';
import * as L from './roomLogic.js';
import * as T from '../blackjack/tournament.js';
import { FELT_THEME_KEYS } from '../scene/table.js';
import { DEALER_KEYS } from '../scene/dealer.js';
import * as S from './session.js';
import * as Leaderboard from './leaderboard.js';

const roomRef = (code) => ref(db, 'rooms/' + code);
const me = () => L.safeKey(S.session.uid);

function newTournamentRoom(def) {
  const room = {
    code: L.genCode(),
    felt: FELT_THEME_KEYS[def.tier % FELT_THEME_KEYS.length],
    dealerType: DEALER_KEYS[Math.floor(Math.random() * DEALER_KEYS.length)],
    players: {}, playerOrder: [], dealer: { hand: [], hiddenRevealed: false }, deck: [],
    turnOrder: [], currentTurnIndex: 0, dealtIn: [], bettingDeadline: null, turnDeadline: null,
    chat: [], log: [`${def.name} — registration open. It starts when five have registered, or ${T.START_WAIT_MS / 1000} seconds after the second.`],
  };
  L.shuffleShoe(room);
  return T.setupTournament(room, def);
}

async function addToAccount(n) {
  S.session.chips += n;
  await S.saveAccountChips(S.session.uid, S.session.name, S.session.chips);
}

/** Registers for the tournament at `code`, then opens its table. */
export async function registerBj(code) {
  const snap = (await get(roomRef(code))).val();
  const x = snap && snap.tournament;
  if (!x || x.status !== 'registering') { S.setFormError('Registration for that tournament has closed.'); return false; }
  if (S.session.chips < x.buyIn) { S.setFormError(`The buy-in is ${x.buyIn.toLocaleString()} — you have ${S.session.chips.toLocaleString()}.`); return false; }
  await addToAccount(-x.buyIn);
  let committed = false;
  try {
    const result = await runTransaction(roomRef(code), (r) => {
      if (!r) return r;
      if (!r.tournament || r.tournament.buyIn !== x.buyIn || !T.register(r, S.session.uid, { name: S.session.name, character: S.session.character, now: Date.now() })) return;
      return r;
    });
    committed = result.committed && !!((result.snapshot.val() || {}).players || {})[me()];
  } catch (e) {
    console.error('registerBj', e);
  }
  if (!committed) { await addToAccount(x.buyIn); S.setFormError('That tournament just filled or started.'); return false; }
  await S.setCurrentRoom(S.session.uid, code);
  S.enterTable(code);
  return true;
}

/** Opens a tournament's table to watch. */
export async function watchBj(code) {
  await S.setCurrentRoom(S.session.uid, code);
  S.enterTable(code);
}

/**
 * Leaving a tournament's table: unregistered with the buy-in back before
 * it starts; a forfeit once it is running; just gone once it is over. Any
 * prize is collected on the way out.
 */
export async function leaveBj(code) {
  let outcome = null;
  let buyIn = 0;
  const result = await runTransaction(roomRef(code), (r) => {
    if (!r || !r.tournament || !(r.players && r.players[me()])) return r;
    buyIn = r.tournament.buyIn;
    outcome = T.withdraw(r, me(), Date.now());
    return r;
  });
  if (result.committed && outcome === 'refund') await addToAccount(buyIn);
  await collectBjPrize(code);
}

/** Takes a prize the room is holding for this player to their account. */
export async function collectBjPrize(code) {
  let amount = 0;
  let place = null;
  const result = await runTransaction(roomRef(code), (r) => {
    if (!r) return r;
    amount = (r.prizes && r.prizes[me()]) || 0;
    if (!amount) return;
    place = T.placeOf(r, me());
    delete r.prizes[me()];
    return r;
  });
  if (!result.committed || !amount) return 0;
  await addToAccount(amount);
  Leaderboard.recordTournament(S.session.uid, { name: S.session.name, character: S.session.character, place: place ? place.place : 3, prize: amount });
  return amount;
}

// ---------- the lobby ----------

// A finished tournament stays listed this long, for its result.
const FINISHED_LISTED_MS = 2 * 60 * 1000;

/** Each blackjack tournament's table taking registrations, and any in play. */
export async function loadBjTournaments() {
  const idx = await get(ref(db, 'publicIndex/tables'));
  const codes = idx.exists() ? Object.keys(idx.val()) : [];
  const rooms = await Promise.all(codes.map(async (code) => [code, (await get(roomRef(code))).val()]));
  const list = [];
  for (const [code, r] of rooms) {
    if (!T.isBjTournament(r)) continue;
    const x = r.tournament;
    // A tournament of a kind no longer run (the old 20-hand one): taken off
    // the list once nobody is waiting at it.
    if (!T.bjTournamentById(x.id)) {
      if (x.status !== 'running' && !Object.keys(r.players || {}).length) remove(ref(db, 'publicIndex/tables/' + code)).catch(() => {});
      continue;
    }
    if (x.status === 'finished' && Date.now() - (x.finishedAt || 0) > FINISHED_LISTED_MS) {
      remove(ref(db, 'publicIndex/tables/' + code)).catch(() => {});
      continue;
    }
    const seats = (r.playerOrder || []).filter((k) => r.players && r.players[k]).map((k) => ({ name: r.players[k].name, character: r.players[k].character || null }));
    const winner = x.places && Object.values(x.places).find((v) => v.place === 1);
    list.push({ code, id: x.id, status: x.status, count: seats.length, seats, startsAt: x.startsAt || null, round: r.round || 0, entrants: x.entrants || seats.length, winner: winner ? winner.name : null, mine: !!(r.players && r.players[me()]) });
  }
  for (const def of T.BJ_TOURNAMENTS) {
    if (list.some((t) => t.id === def.id && t.status === 'registering')) continue;
    const room = newTournamentRoom(def);
    await set(roomRef(room.code), room);
    await set(ref(db, 'publicIndex/tables/' + room.code), true);
    list.push({ code: room.code, id: def.id, status: 'registering', count: 0, seats: [], startsAt: null, round: 0, entrants: 0, winner: null, mine: false });
  }
  return list;
}

// ---------- the clock ----------

/**
 * Once a second from session.js, for a blackjack tournament being watched.
 * Returns true when it has dealt with the tick (registering, or over).
 */
export function tick(r) {
  if (T.registering(r)) {
    if (T.canStart(r, Date.now())) {
      S.mutateRoom(r.code, (rr) => { if (T.canStart(rr, Date.now())) T.start(rr, Date.now(), { scale: true }); });
    }
    return true;
  }
  if (T.finished(r)) return true;
  if (r.phase === 'betting' && r.bettingDeadline && Date.now() >= r.bettingDeadline) {
    S.mutateRoom(r.code, (rr) => {
      if (rr.phase !== 'betting' || !rr.bettingDeadline || Date.now() < rr.bettingDeadline) return;
      T.autoBets(rr);
      if (rr.phase === 'betting') L.processBettingTimeoutLogic(rr);
    });
    return true;
  }
  if (r.phase === 'results' && r.resultsAt && Date.now() - r.resultsAt >= L.resultsPauseFor(r)) {
    S.mutateRoom(r.code, (rr) => { if (rr.phase === 'results' && rr.resultsAt && Date.now() - rr.resultsAt >= L.resultsPauseFor(rr)) T.afterRound(rr, Date.now()); });
    return true;
  }
  return false;
}
