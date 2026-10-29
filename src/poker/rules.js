// No-Limit Texas Hold'em, cash table, as the Poker TDA rules (2026) and the
// usual cash-game house rules have it (docs/texas-holdem-plan.md). Pure
// functions over the room object — nothing here touches Firebase, the DOM
// or the cards' encryption. The room is mutated in place, inside a
// transaction (src/app/pokerSession.js).
//
// What this module does not know is any card. Hole cards never pass
// through the room at all, and the board arrives from the players' own
// shuffle-and-reveal protocol (src/poker/mentalPoker.js) through
// onBoard() and onShown(). The hand waits in a phase for each of those:
//
//   deal      the shuffle and the hole cards — waiting on the protocol
//   betting   a player is to act (toAct, deadline)
//   board     a street's cards are being revealed
//   showdown  the hands still in are being turned over
//   done      the pot has been pushed; the next hand starts at endsAt

import { bestHand } from './evaluator.js';

export const POKER_SEATS = 6;
export const ACT_SECONDS = 20;
// A reserve of extra thinking time, used up once a player's clock runs
// out, topped up a little each hand to a ceiling.
export const TIME_BANK_SECONDS = 30;
export const TIME_BANK_PER_HAND = 5;
// Pauses after a hand: long enough to see the cards and the pot pushed.
export const SHOWDOWN_PAUSE_MS = 7000;
export const FOLD_PAUSE_MS = 3500;
// How long the protocol may take to deal, or to turn a street, before the
// hand is called off and everyone's chips go back.
export const DEAL_STALL_MS = 45000;
export const REVEAL_STALL_MS = 30000;
// Two clocks run out in a row and a player is sat out; out for this long
// and they are stood up and their stack goes back to their account.
export const MAX_TIMEOUTS = 2;
export const SITOUT_LIMIT_MS = 10 * 60 * 1000;

// Five tables, one per room (src/scene/rooms.js): small blind / big blind.
export const POKER_STAKES = [
  { sb: 50, bb: 100 },
  { sb: 100, bb: 200 },
  { sb: 250, bb: 500 },
  { sb: 500, bb: 1000 },
  { sb: 2500, bb: 5000 },
];
// Buy in for 40 to 100 big blinds, the usual online range.
export const BUY_IN_MIN_BB = 40;
export const BUY_IN_MAX_BB = 100;
export function buyInRange(room) {
  return { min: room.bb * BUY_IN_MIN_BB, max: room.bb * BUY_IN_MAX_BB };
}

const STREETS = ['preflop', 'flop', 'turn', 'river'];
const BOARD_AT = { flop: 3, turn: 4, river: 5 };

const log = (room, line) => { room.log = (room.log || []).concat(line).slice(-10); };

// The database keeps no empty object or array: a hand read back from it
// has no `folded` until someone folds, no `board` until the flop. Every
// entry point puts them back before reading the hand.
const HAND_MAPS = ['committed', 'bet', 'folded', 'allIn', 'needs', 'canRaise', 'last', 'shown'];
function handOf(room) {
  const h = room && room.hand;
  if (!h) return null;
  HAND_MAPS.forEach((m) => { if (!h[m]) h[m] = {}; });
  if (!h.board) h.board = [];
  if (!h.players) h.players = [];
  if (h.phase === 'showdown' && !h.showOrder) h.showOrder = [];
  return h;
}
const nameOf = (room, key) => (room.players[key] && room.players[key].name) || 'A player';

// ---------- seating ----------

// Seated players in seat order. A record without a seat or a stack (debris
// from an interrupted write) isn't a player.
export function seatKeys(room) {
  const players = room.players || {};
  return Object.keys(players)
    .filter((k) => typeof players[k].seat === 'number' && typeof players[k].stack === 'number')
    .sort((a, b) => players[a].seat - players[b].seat);
}

export function seatTaken(room, seat) {
  return Object.values(room.players || {}).some((p) => p.seat === seat);
}

export function firstFreeSeat(room) {
  for (let s = 0; s < POKER_SEATS; s++) if (!seatTaken(room, s)) return s;
  return -1;
}

/**
 * Sits a player down with `buyIn` chips. A player joining a game already
 * under way waits for the big blind to come round to them rather than
 * being dealt in out of position (sitting between the blinds and the
 * button gets a free hand).
 */
export function seatPlayer(room, key, { name, character, seat, buyIn }) {
  if (room.players && room.players[key]) return false;
  if (seat === undefined || seat < 0) seat = firstFreeSeat(room);
  if (seat < 0 || seatTaken(room, seat)) return false;
  const { min, max } = buyInRange(room);
  if (buyIn < min || buyIn > max) return false;
  if (!room.players) room.players = {};
  const playing = Object.values(room.players).filter((p) => p.status === 'active' && p.stack > 0).length;
  room.players[key] = {
    name, character: character || null, seat, stack: buyIn,
    status: 'active', waitBB: playing >= 2, timeouts: 0, timeBank: TIME_BANK_SECONDS,
  };
  log(room, name + ' sits down with ' + buyIn.toLocaleString() + '.');
  return true;
}

/** Adds chips to a stack between hands, up to the maximum buy-in. */
export function topUp(room, key, amount) {
  const p = room.players && room.players[key];
  if (!p || inHand(room, key)) return 0;
  const add = Math.max(0, Math.min(amount, buyInRange(room).max - p.stack));
  p.stack += add;
  return add;
}

export const inHand = (room, key) => !!(room.hand && room.hand.phase !== 'done' && (room.hand.players || []).includes(key));

// ---------- the hand ----------

/**
 * Starts a hand if two or more can play. Moves the button, posts the
 * blinds, and leaves the hand waiting on the deal. Returns whether a hand
 * started.
 */
export function startHand(room, handId, now = Date.now()) {
  if (room.hand) return false;
  const ring = seatKeys(room).filter((k) => {
    const p = room.players[k];
    return p.status === 'active' && p.stack > 0 && !p.leaving;
  });
  if (ring.length < 2) return false;
  const seatOf = (k) => room.players[k].seat;
  // With too few others to wait behind, nobody waits for the big blind.
  let waiting = ring.filter((k) => room.players[k].waitBB);
  if (ring.length - waiting.length < 2) { waiting.forEach((k) => { room.players[k].waitBB = false; }); waiting = []; }
  const ready = ring.filter((k) => !room.players[k].waitBB);

  // The button moves one seat to the left of where it was, to the next
  // player who is playing.
  const prev = room.buttonSeat === undefined || room.buttonSeat === null ? -1 : room.buttonSeat;
  const after = (keys, seat) => keys.find((k) => seatOf(k) > seat) || keys[0];
  const button = after(ready, prev);
  // The small blind is the next player to the button's left; the big
  // blind the next after that — which can be someone waiting for it, who
  // is then dealt in.
  const sbCandidate = after(ready, seatOf(button));
  const bbCandidate = after(ring.filter((k) => k !== button && k !== sbCandidate), seatOf(sbCandidate));
  const dealt = ring.filter((k) => !room.players[k].waitBB || k === bbCandidate);
  let sb, bb;
  if (dealt.length === 2) {
    // Heads-up the button is the small blind (TDA 36-C).
    sb = button;
    bb = dealt.find((k) => k !== button);
  } else {
    sb = sbCandidate;
    bb = bbCandidate;
  }
  if (room.players[bb].waitBB) room.players[bb].waitBB = false;

  // Dealing order: from the small blind round to the button.
  const fromSb = dealt.slice(dealt.indexOf(sb)).concat(dealt.slice(0, dealt.indexOf(sb)));
  room.buttonSeat = seatOf(button);
  const hand = {
    id: handId,
    phase: 'deal',
    street: 'preflop',
    players: fromSb,
    button, sb, bb,
    committed: {}, bet: {}, folded: {}, allIn: {}, needs: {}, canRaise: {}, last: {},
    board: [], boardTarget: 0,
    currentBet: 0, lastRaise: room.bb, lastAggressor: null,
    toAct: null, deadline: null,
    stallAt: now + DEAL_STALL_MS,
    startedAt: now,
  };
  room.hand = hand;
  fromSb.forEach((k) => {
    const p = room.players[k];
    hand.committed[k] = 0; hand.bet[k] = 0;
    p.timeBank = Math.min(TIME_BANK_SECONDS, (p.timeBank ?? TIME_BANK_SECONDS) + TIME_BANK_PER_HAND);
  });
  post(room, sb, room.sb);
  post(room, bb, room.bb);
  hand.last[sb] = { action: 'sb', amount: hand.bet[sb] };
  hand.last[bb] = { action: 'bb', amount: hand.bet[bb] };
  // The big blind is a full bet even when the player posting it is all in
  // for less: everyone still has to call the full amount.
  hand.currentBet = room.bb;
  hand.lastRaise = room.bb;
  fromSb.forEach((k) => { hand.needs[k] = !hand.allIn[k]; hand.canRaise[k] = true; });
  room.handCount = (room.handCount || 0) + 1;
  log(room, 'Hand ' + room.handCount + ': ' + nameOf(room, button) + ' has the button.');
  return true;
}

function post(room, key, amount) {
  const p = room.players[key];
  const h = handOf(room);
  const pay = Math.min(amount, p.stack);
  p.stack -= pay;
  h.bet[key] = (h.bet[key] || 0) + pay;
  h.committed[key] = (h.committed[key] || 0) + pay;
  if (p.stack === 0) h.allIn[key] = true;
  return pay;
}

const live = (h) => h.players.filter((k) => !h.folded[k]);
const canAct = (h) => live(h).filter((k) => !h.allIn[k]);

// The next player round from `key` (to their left) who still has to act.
function nextToAct(h, key) {
  const n = h.players.length;
  const start = h.players.indexOf(key);
  for (let i = 1; i <= n; i++) {
    const k = h.players[(start + i) % n];
    if (!h.folded[k] && !h.allIn[k] && h.needs[k]) return k;
  }
  return null;
}

// First to act on a street: left of the big blind before the flop —
// heads-up that is the button, who is the small blind — and from the flop
// on, the first player in to the button's left, which heads-up is the big
// blind (TDA 36-C).
function firstToAct(h) {
  if (h.street === 'preflop') return nextToAct(h, h.bb);
  return nextToAct(h, h.button);
}

function setClock(room, now) {
  room.hand.deadline = now + ACT_SECONDS * 1000;
  room.hand.usingBank = null;
}

/** The protocol has dealt: the first betting round opens. */
export function onDealt(room, now = Date.now()) {
  const h = handOf(room);
  if (!h || h.phase !== 'deal') return false;
  h.phase = 'betting';
  h.stallAt = null;
  openRound(room, now);
  return true;
}

function openRound(room, now) {
  const h = handOf(room);
  if (canAct(h).length <= 1 && roundComplete(h)) { endStreet(room, now); return; }
  h.toAct = firstToAct(h);
  if (!h.toAct) { endStreet(room, now); return; }
  setClock(room, now);
}

function roundComplete(h) {
  const acting = canAct(h);
  if (acting.length === 0) return true;
  if (acting.length === 1) {
    const k = acting[0];
    // A lone player with chips need not act once they have matched.
    return h.bet[k] >= h.currentBet || !h.needs[k];
  }
  return acting.every((k) => !h.needs[k] && h.bet[k] === h.currentBet);
}

/** What `key` may do now: { fold, check, call, callAmount, raise, minTo, maxTo }. */
export function legalActions(room, key) {
  const h = handOf(room);
  if (!h || h.phase !== 'betting' || h.toAct !== key) return null;
  const p = room.players[key];
  const owe = h.currentBet - h.bet[key];
  const maxTo = h.bet[key] + p.stack;
  const minTo = Math.min(maxTo, h.currentBet + h.lastRaise);
  return {
    fold: true,
    check: owe <= 0,
    call: owe > 0,
    callAmount: Math.min(owe, p.stack),
    raise: h.canRaise[key] && maxTo > h.currentBet,
    minTo, maxTo,
    pot: potTotal(h),
  };
}

const potTotal = (h) => Object.values(h.committed).reduce((a, b) => a + b, 0);
export const pot = (room) => (room.hand ? potTotal(handOf(room)) : 0);

/**
 * Applies `key`'s action — 'fold', 'check', 'call', 'raise' (to `amount`,
 * the player's total bet on this street; a bet when nothing is bet yet) or
 * 'allin'. Returns false, changing nothing, if it isn't legal.
 */
export function applyAction(room, key, action, amount = 0, now = Date.now()) {
  const h = handOf(room);
  const legal = legalActions(room, key);
  if (!legal) return false;
  const p = room.players[key];
  if (action === 'allin') {
    if (legal.maxTo > h.currentBet && legal.raise) { action = 'raise'; amount = legal.maxTo; }
    else if (legal.call) action = 'call';
    else if (legal.check) action = 'check';
    else return false;
  }
  if (action === 'fold') {
    h.folded[key] = true;
    h.last[key] = { action: 'fold' };
    log(room, p.name + ' folds.');
  } else if (action === 'check') {
    if (!legal.check) return false;
    h.last[key] = { action: 'check' };
  } else if (action === 'call') {
    if (!legal.call) return false;
    const paid = post(room, key, legal.callAmount);
    h.last[key] = { action: h.allIn[key] ? 'allin' : 'call', amount: h.bet[key] };
    log(room, p.name + (h.allIn[key] ? ' calls all in, ' : ' calls ') + paid.toLocaleString() + '.');
  } else if (action === 'raise') {
    if (!legal.raise) return false;
    amount = Math.floor(amount);
    const to = Math.min(amount, legal.maxTo);
    // Under the minimum only when it is everything the player has.
    if (to < legal.minTo && to !== legal.maxTo) return false;
    if (to <= h.currentBet) return false;
    const opening = h.currentBet === 0;
    const raiseBy = to - h.currentBet;
    post(room, key, to - h.bet[key]);
    const full = raiseBy >= h.lastRaise;
    live(h).forEach((k) => {
      if (k === key || h.allIn[k]) return;
      const stillToAct = h.needs[k];
      h.needs[k] = true;
      // A full raise reopens the betting for everyone (TDA 45-A); an all-in
      // short of one does not, for anyone who has already acted (49-A).
      h.canRaise[k] = full ? true : (stillToAct ? h.canRaise[k] : false);
    });
    if (full) h.lastRaise = raiseBy;
    h.currentBet = to;
    h.lastAggressor = key;
    h.last[key] = { action: h.allIn[key] ? 'allin' : (opening ? 'bet' : 'raise'), amount: to };
    log(room, p.name + (h.allIn[key] ? ' is all in for ' : opening ? ' bets ' : ' raises to ') + to.toLocaleString() + '.');
  } else {
    return false;
  }
  h.needs[key] = false;
  // Acting for yourself clears a run of timeouts; the clock acting for you
  // does not.
  if (!h.timedOut) p.timeouts = 0;
  h.timedOut = false;
  advance(room, key, now);
  return true;
}

function advance(room, key, now) {
  const h = handOf(room);
  if (live(h).length === 1) { winUncontested(room, now); return; }
  if (roundComplete(h)) { endStreet(room, now); return; }
  h.toAct = nextToAct(h, key);
  if (!h.toAct) { endStreet(room, now); return; }
  setClock(room, now);
}

// The street's betting is over: an uncalled bet goes back, and the hand
// moves to the next street's cards, or to the showdown.
function endStreet(room, now) {
  const h = handOf(room);
  returnUncalled(room);
  h.toAct = null;
  h.deadline = null;
  Object.keys(h.bet).forEach((k) => { h.bet[k] = 0; });
  h.currentBet = 0;
  h.lastRaise = room.bb;
  live(h).forEach((k) => { h.needs[k] = !h.allIn[k]; h.canRaise[k] = true; });
  // A new street, a clean slate: what each player did last street is done
  // with (but a fold or an all-in still stands).
  Object.keys(h.last).forEach((k) => { if (!h.folded[k] && !h.allIn[k]) delete h.last[k]; });
  if (h.street === 'river') { beginShowdown(room, now); return; }
  h.street = STREETS[STREETS.indexOf(h.street) + 1];
  h.boardTarget = BOARD_AT[h.street];
  h.phase = 'board';
  h.stallAt = now + REVEAL_STALL_MS;
}

function returnUncalled(room) {
  const h = handOf(room);
  const bets = h.players.map((k) => [k, h.bet[k] || 0]).sort((a, b) => b[1] - a[1]);
  if (bets.length < 2) return;
  const [[top, high], [, second]] = bets;
  if (high > second && room.players[top]) {
    const back = high - second;
    h.bet[top] -= back;
    h.committed[top] -= back;
    room.players[top].stack += back;
    if (room.players[top].stack > 0) h.allIn[top] = false;
  }
}

/** The protocol has revealed the board up to the current street. */
export function onBoard(room, cards, now = Date.now()) {
  const h = handOf(room);
  if (!h || h.phase !== 'board' || cards.length !== h.boardTarget) return false;
  h.board = cards.slice();
  h.stallAt = null;
  if (canAct(h).length <= 1) {
    // Everyone (or all but one) is all in: no more betting, the rest of
    // the board is dealt out (TDA 17).
    h.runout = true;
    if (h.street === 'river') beginShowdown(room, now);
    else {
      h.street = STREETS[STREETS.indexOf(h.street) + 1];
      h.boardTarget = BOARD_AT[h.street];
      h.stallAt = now + REVEAL_STALL_MS;
    }
    return true;
  }
  h.phase = 'betting';
  openRound(room, now);
  return true;
}

// The hands still in are turned over. Online they are all shown at once;
// the order is kept for the table to turn them in: the last player to bet
// or raise on the river first, otherwise the first player in to the left
// of the button (TDA 18-A).
function beginShowdown(room, now) {
  const h = handOf(room);
  h.phase = 'showdown';
  h.toAct = null;
  h.deadline = null;
  h.stallAt = now + REVEAL_STALL_MS;
  const inOrder = live(h);
  const first = h.lastAggressor && !h.folded[h.lastAggressor] && !h.runout ? h.lastAggressor : inOrder[0];
  const i = inOrder.indexOf(first);
  h.showOrder = inOrder.slice(i).concat(inOrder.slice(0, i));
  h.shown = {};
}

/** The protocol has turned over `key`'s two cards. */
export function onShown(room, key, cards, now = Date.now()) {
  const h = handOf(room);
  if (!h || h.phase !== 'showdown' || !(h.showOrder || []).includes(key) || cards.length !== 2) return false;
  h.shown[key] = cards.slice();
  if (h.showOrder.every((k) => h.shown[k])) settle(room, now);
  return true;
}

/**
 * Splits the money into the main pot and side pots: layer by layer up
 * each all-in amount, each layer won only by those who put that much in
 * and are still in the hand. Folded players' chips count toward the pots
 * they reached. Returns [{ amount, eligible: [keys] }].
 */
export function buildPots(h) {
  const levels = [...new Set(h.players.map((k) => h.committed[k] || 0))].filter((v) => v > 0).sort((a, b) => a - b);
  const pots = [];
  let prev = 0;
  for (const level of levels) {
    let amount = 0;
    h.players.forEach((k) => { amount += Math.max(0, Math.min(h.committed[k] || 0, level) - prev); });
    const eligible = h.players.filter((k) => !h.folded[k] && (h.committed[k] || 0) >= level);
    if (amount > 0) {
      const last = pots[pots.length - 1];
      if (last && last.eligible.join() === eligible.join()) last.amount += amount;
      else if (eligible.length) pots.push({ amount, eligible });
      // Money only folded players reached goes to the pot below it.
      else if (last) last.amount += amount;
    }
    prev = level;
  }
  return pots;
}

function settle(room, now) {
  const h = handOf(room);
  const hands = {};
  Object.entries(h.shown).forEach(([k, cards]) => { hands[k] = bestHand(cards.concat(h.board)); });
  const results = [];
  buildPots(h).forEach((pt, i) => {
    const best = Math.max(...pt.eligible.map((k) => hands[k].score));
    // Winners in seat order from the button's left, so an odd chip goes to
    // the first of them (TDA 21).
    const winners = h.players.filter((k) => pt.eligible.includes(k) && hands[k].score === best);
    const share = Math.floor(pt.amount / winners.length);
    let odd = pt.amount - share * winners.length;
    winners.forEach((k) => {
      const won = share + (odd > 0 ? 1 : 0);
      if (odd > 0) odd--;
      room.players[k].stack += won;
    });
    results.push({ pot: i, amount: pt.amount, winners, hand: hands[winners[0]].name });
  });
  h.hands = Object.fromEntries(Object.entries(hands).map(([k, r]) => [k, { name: r.name, best: r.best }]));
  h.results = results;
  results.forEach((r) => log(room, r.winners.map((k) => nameOf(room, k)).join(' and ') + ' win' + (r.winners.length === 1 ? 's ' : ' ') + r.amount.toLocaleString() + ' with ' + r.hand + (results.length > 1 ? (r.pot === 0 ? ' (main pot)' : ' (side pot)') : '') + '.'));
  finish(room, now, SHOWDOWN_PAUSE_MS);
}

function winUncontested(room, now) {
  const h = handOf(room);
  returnUncalled(room);
  const winner = live(h)[0];
  const amount = potTotal(h);
  room.players[winner].stack += amount;
  h.results = [{ pot: 0, amount, winners: [winner], hand: null }];
  log(room, nameOf(room, winner) + ' wins ' + amount.toLocaleString() + '.');
  finish(room, now, FOLD_PAUSE_MS);
}

function finish(room, now, pause) {
  const h = handOf(room);
  h.phase = 'done';
  h.toAct = null;
  h.deadline = null;
  h.stallAt = null;
  h.endsAt = now + pause;
}

/**
 * Clears a finished hand once its pause is over, and tidies the table for
 * the next: players out of time are sat out, those sat out too long or who
 * asked to leave are stood up — their stacks put in `room.cashout` for
 * their own client to collect. Returns the keys stood up.
 */
export function clearHand(room, now = Date.now()) {
  const h = handOf(room);
  if (!h || h.phase !== 'done' || now < h.endsAt) return null;
  room.lastHand = { id: h.id, board: h.board, results: h.results || [], shown: h.shown || {}, hands: h.hands || {} };
  room.hand = null;
  const stood = [];
  Object.entries(room.players || {}).forEach(([k, p]) => {
    if (p.timeouts >= MAX_TIMEOUTS && p.status === 'active') { p.status = 'sitout'; p.sitOutAt = now; log(room, p.name + ' is sitting out.'); }
    if (p.stack <= 0 && p.status === 'active') { p.status = 'sitout'; p.sitOutAt = now; }
    if (p.leaving || (p.status === 'sitout' && p.sitOutAt && now - p.sitOutAt > SITOUT_LIMIT_MS)) stood.push(k);
  });
  stood.forEach((k) => standUp(room, k));
  return stood;
}

/** Takes a player off the table, their stack into room.cashout. */
export function standUp(room, key) {
  const p = room.players && room.players[key];
  if (!p) return;
  if (!room.cashout) room.cashout = {};
  room.cashout[key] = (room.cashout[key] || 0) + p.stack;
  log(room, p.name + ' leaves the table.');
  delete room.players[key];
}

/**
 * A player leaving: folded out of any hand they are in, and off the table
 * at once with what is left of their stack — once folded none of it is in
 * play. The chips they had already put in stay in the pot. (Their keys to
 * the cards still to be turned are with their custodian; see protocol.js.)
 */
export function leave(room, key, now = Date.now()) {
  const p = room.players && room.players[key];
  if (!p) return;
  const h = handOf(room);
  if (h && inHand(room, key) && !h.folded[key]) {
    if (h.phase === 'showdown') {
      // Leaving with a hand to show gives it up.
      h.folded[key] = true;
      h.showOrder = (h.showOrder || []).filter((k) => k !== key);
      if (live(h).length === 1) winUncontested(room, now);
      else if (h.showOrder.every((k) => h.shown[k])) settle(room, now);
    } else if (h.phase === 'betting' && h.toAct === key) applyAction(room, key, 'fold', 0, now);
    else {
      h.folded[key] = true;
      h.needs[key] = false;
      h.last[key] = { action: 'fold' };
      if (live(h).length === 1 && h.phase !== 'done') winUncontested(room, now);
      else if (h.phase === 'betting' && roundComplete(h)) endStreet(room, now);
    }
  }
  standUp(room, key);
}

/** Sits a player out from the next hand, or back in. */
export function setSitOut(room, key, out, now = Date.now()) {
  const p = room.players && room.players[key];
  if (!p) return;
  p.status = out ? 'sitout' : 'active';
  p.sitOutAt = out ? now : null;
  p.timeouts = 0;
  if (!out && p.stack > 0) p.waitBB = Object.values(room.players).filter((q) => q.status === 'active').length > 2;
}

/**
 * The clock: a player out of time draws on their time bank once, then
 * checks if they can and folds if they can't. Returns what happened.
 */
export function processTimeout(room, now = Date.now()) {
  const h = handOf(room);
  if (!h || h.phase !== 'betting' || !h.deadline || now < h.deadline) return null;
  const key = h.toAct;
  const p = room.players[key];
  if (!p) return null;
  if (!h.usingBank && p.timeBank > 0) {
    h.deadline = now + p.timeBank * 1000;
    h.usingBank = key;
    p.timeBank = 0;
    return 'timebank';
  }
  const legal = legalActions(room, key);
  p.timeouts = (p.timeouts || 0) + 1;
  h.timedOut = true;
  applyAction(room, key, legal && legal.check ? 'check' : 'fold', 0, now);
  log(room, p.name + ' ran out of time.');
  return 'auto';
}

/**
 * The protocol stalled — a player gone mid-shuffle, or no one left who can
 * turn a card. The hand is called off: every chip anyone put in goes back.
 */
export function voidHand(room, reason = 'The hand was called off.') {
  const h = handOf(room);
  if (!h) return;
  Object.entries(h.committed || {}).forEach(([k, amt]) => {
    if (room.players[k]) room.players[k].stack += amt;
    // Gone from the table already: their part goes where their stack went.
    else if (amt) { if (!room.cashout) room.cashout = {}; room.cashout[k] = (room.cashout[k] || 0) + amt; }
  });
  room.hand = null;
  log(room, reason + ' Every bet has been returned.');
}

/** Whether the protocol has been stuck too long on the current phase. */
export function stalled(room, now = Date.now()) {
  const h = handOf(room);
  return !!(h && h.stallAt && now > h.stallAt && ['deal', 'board', 'showdown'].includes(h.phase));
}

// Where each card of the hand lies in the shuffled deck: player i (in
// dealing order) gets cards i and i + n, as a dealer pitches them round
// twice; then a burn and the flop, a burn and the turn, a burn and the
// river. The protocol only ever unlocks these positions.
export function deckPositions(n) {
  const hole = Array.from({ length: n }, (_, i) => [i, i + n]);
  const b = 2 * n;
  return { hole, flop: [b + 1, b + 2, b + 3], turn: [b + 5], river: [b + 7], board: [b + 1, b + 2, b + 3, b + 5, b + 7], used: b + 8 };
}
