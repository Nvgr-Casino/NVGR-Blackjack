// Rummy at the house's table: points rummy, you and two house players, on
// your real chips. The rules are src/rummy/rules.js; this runs the deal in
// this browser — the house players' turns, the declaration, the scores —
// and saves your balance after every deal.
//
// Each deal is played for a value a point: whoever declares first collects
// from each of the others their points (at most 80) times that value. You
// need 80 points' worth to sit down, which is the most a deal can cost.
// Your thirteen cards are kept in the groups you arrange them in.

import * as R from '../rummy/rules.js';
import { CHARACTERS } from '../scene/character.js';
import { DEALER_KEYS } from '../scene/dealer.js';
import { safeKey, STARTING_CHIPS, RESTAKE_BELOW } from './roomLogic.js';
import { HOUSE_NAMES } from './teenPattiSession.js';
import * as S from './session.js';

export const isRummy = (r) => !!r && r.game === 'rummy';

const DEAL_MS = 3400;
const DRAW_MS = [900, 1500];
const THROW_MS = [800, 1300];
const RESULT_MS = 11000;
const TICK_MS = 150;
const FELTS = ['blue', 'green', 'purple'];

let room = null;
let timer = null;
let waitUntil = 0;
let thinking = null;
let bots = {};
const me = () => (S.session.uid ? safeKey(S.session.uid) : 'me');
export const myKey = me;
const publish = () => { if (room) { S.session.room = { ...room }; S.refresh(); } };
const rand = ([a, b]) => a + Math.random() * (b - a);

function saveAccount(play) {
  if (!room || room.dev) return;
  S.session.chips = room.balance;
  S.saveAccountChips(S.session.uid, S.session.name, room.balance, play ? { game: 'rummy' } : null).catch(() => {});
}

export async function startRummy(tierIndex = 0, { dev = false, chips = 0 } = {}) {
  stop();
  S.setFormError('');
  const stakes = R.RUMMY_STAKES[tierIndex] || R.RUMMY_STAKES[0];
  const balance = dev ? chips : (await S.ensureAccount(S.session.uid, S.session.name)).chips;
  const need = stakes.point * R.MAX_POINTS;
  if (balance < need) {
    S.setFormError(`The ${stakes.name} table plays for ${stakes.point} a point — you need ${need.toLocaleString()} chips to sit down.`);
    return false;
  }
  room = {
    code: 'RUMMY', game: 'rummy', offline: true, isPublic: false, dev,
    tier: tierIndex + 1, stakesName: stakes.name, point: stakes.point,
    felt: FELTS[tierIndex % FELTS.length],
    dealerType: DEALER_KEYS[Math.floor(Math.random() * DEALER_KEYS.length)],
    players: {}, dealerSeat: null, deal: null, dealCount: 0, balance, groups: [], notice: null, message: null,
  };
  room.players[me()] = { name: S.session.name || 'You', seat: 2, character: S.session.character, me: true, net: 0 };
  const usedChars = [S.session.character];
  const usedNames = [];
  [4, 0].forEach((seat) => {
    const character = pick(CHARACTERS.map((c) => c.id), usedChars);
    const name = pick(HOUSE_NAMES, usedNames);
    usedChars.push(character); usedNames.push(name);
    const key = 'house' + seat;
    room.players[key] = { name, seat, character, bot: true, net: 0 };
    // Human, not perfect: now and then a wrong throw, a card left on the pile.
    bots[key] = { skill: 0.4 + Math.random() * 0.15 };
  });
  S.session.chips = balance;
  S.session.code = room.code;
  S.session.screen = 'table';
  publish();
  waitUntil = performance.now() + 1200;
  timer = setInterval(step, TICK_MS);
  return true;
}
function pick(list, not = []) {
  const free = list.filter((x) => !not.includes(x));
  return free[Math.floor(Math.random() * free.length)];
}
export function devStart(chips = 250000) { if (import.meta.env.DEV) startRummy(1, { dev: true, chips }); }
export const current = () => room;
function stop() { clearInterval(timer); timer = null; thinking = null; }

// ---------- a deal ----------
function startDeal() {
  const keys = Object.keys(room.players).sort((a, b) => room.players[a].seat - room.players[b].seat);
  const seats = keys.map((k) => room.players[k].seat);
  room.dealerSeat = seats.find((s) => s > (room.dealerSeat ?? -1)) ?? seats[0];
  const after = keys.filter((k) => room.players[k].seat > room.dealerSeat);
  const order = after.concat(keys.filter((k) => room.players[k].seat <= room.dealerSeat));
  const closed = R.shuffled();
  // The cut: the card turned under the deck names the wild rank (a printed
  // joker cut makes aces wild).
  const wildCard = closed.pop();
  const wild = R.isPrinted(wildCard) ? 'A' : R.rankOf(wildCard);
  const hands = {};
  order.forEach((k) => { hands[k] = []; });
  for (let i = 0; i < 13; i++) order.forEach((k) => hands[k].push(closed.pop()));
  room.dealCount += 1;
  room.deal = {
    id: room.dealCount, phase: 'deal', order, wild, wildCard, closed, open: [closed.pop()], hands,
    toAct: order[0], stage: 'draw', turns: {}, drawn: null, last: {}, dropped: {}, result: null, seq: 0,
  };
  room.groups = R.bySuit(hands[me()], wild);
  room.message = null;
}

function nextTurn(d, from) {
  const i = d.order.indexOf(from);
  for (let s = 1; s <= d.order.length; s++) {
    const k = d.order[(i + s) % d.order.length];
    if (!d.dropped[k]) { d.toAct = k; d.stage = 'draw'; d.drawn = null; return; }
  }
}
function draw(d, k, fromOpen) {
  if (!fromOpen && !d.closed.length) {
    // The closed deck is out: the open pile, all but its top, shuffled into it.
    const top = d.open.pop();
    const rest = d.open.splice(0);
    for (let i = rest.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [rest[i], rest[j]] = [rest[j], rest[i]]; }
    d.closed = rest;
    d.open = [top];
  }
  const card = fromOpen ? d.open.pop() : d.closed.pop();
  d.hands[k].push(card);
  d.drawn = card;
  d.stage = 'discard';
  d.last[k] = { action: fromOpen ? 'open' : 'closed', card: fromOpen ? card : null, seq: ++d.seq };
  return card;
}
function throwCard(d, k, card) {
  d.hands[k] = d.hands[k].filter((c) => c !== card);
  d.open.push(card);
  d.turns[k] = (d.turns[k] || 0) + 1;
  d.last[k] = { action: 'discard', card, seq: ++d.seq };
}

// The deal is won: everyone else's points, and the chips for them.
function finish(d, winner, how) {
  const points = {}, groups = {};
  d.order.forEach((k) => {
    groups[k] = k === me() ? (winner === me() ? R.arrange(d.hands[k], d.wild) : room.groups.map((g) => g.filter((c) => d.hands[k].includes(c))).filter((g) => g.length)) : R.arrange(d.hands[k], d.wild);
    if (k === winner) { points[k] = 0; return; }
    if (d.dropped[k]) { points[k] = d.dropped[k]; return; }
    // Your points: your hand as you laid it out, or its best layout,
    // whichever is fewer.
    const best = R.analyze(d.hands[k], d.wild).points;
    points[k] = k === me() ? Math.min(best, R.pointsFor(groups[k], d.wild)) : best;
  });
  const chips = {};
  let pot = 0;
  d.order.forEach((k) => { if (k !== winner) { chips[k] = -points[k] * room.point; pot += points[k] * room.point; } });
  chips[winner] = pot;
  d.order.forEach((k) => { room.players[k].net += chips[k]; });
  room.balance += chips[me()] || 0;
  d.result = { winner, how, points, chips, groups };
  d.phase = 'done';
  d.toAct = null;
  saveAccount(true);
  waitUntil = performance.now() + RESULT_MS;
}

function step() {
  if (!room) return;
  const now = performance.now();
  if (now < waitUntil) return;
  const d = room.deal;
  if (!d || d.phase === 'done') {
    if (d) between();
    if (room.balance < room.point * R.MAX_POINTS) { room.message = `You need ${(room.point * R.MAX_POINTS).toLocaleString()} chips for another deal at this table.`; publish(); waitUntil = now + 1e9; return; }
    startDeal();
    publish();
    waitUntil = now + DEAL_MS;
    return;
  }
  if (d.phase === 'deal') { d.phase = 'play'; publish(); }
  const k = d.toAct;
  const p = room.players[k];
  if (!p || !p.bot) return;
  if (!thinking || thinking.key !== k + d.stage) { thinking = { key: k + d.stage, at: now + rand(d.stage === 'draw' ? DRAW_MS : THROW_MS) * (d.dropped[me()] ? 0.6 : 1) }; return; }
  if (now < thinking.at) return;
  thinking = null;
  const skill = bots[k].skill;
  if (d.stage === 'draw') {
    const top = d.open[d.open.length - 1];
    draw(d, k, R.takesOpen(d.hands[k], top, d.wild, skill));
    publish();
    return;
  }
  const t = R.bestDiscard(d.hands[k], d.wild, skill);
  throwCard(d, k, t.card);
  if (R.analyze(d.hands[k], d.wild).complete) { finish(d, k, 'declare'); publish(); return; }
  nextTurn(d, k);
  publish();
}
// Between deals: nobody is left without the chips to play on.
function between() {
  if (room.balance < RESTAKE_BELOW) {
    room.balance = STARTING_CHIPS;
    room.notice = `Out of chips — the house has topped you back up to ${STARTING_CHIPS.toLocaleString()}.`;
    saveAccount(false);
  }
}

// ---------- your moves ----------
const mine = () => room && room.deal && room.deal.phase === 'play' && room.deal.toAct === me() ? room.deal : null;

/** Draws from the closed deck (`open` false) or the open pile. */
export function drawCard(open) {
  const d = mine();
  if (!d || d.stage !== 'draw') return;
  const card = draw(d, me(), !!open);
  // The new card at the end of your last group.
  if (room.groups.length) room.groups[room.groups.length - 1].push(card); else room.groups.push([card]);
  room.message = null;
  publish();
}
export function discard(card) {
  const d = mine();
  if (!d || d.stage !== 'discard' || !d.hands[me()].includes(card)) return;
  throwCard(d, me(), card);
  removeFromGroups(card);
  nextTurn(d, me());
  publish();
}
/** Discards `card` and declares with the rest, if they make a winning hand. */
export function declare(card) {
  const d = mine();
  if (!d || d.stage !== 'discard' || !d.hands[me()].includes(card)) return false;
  const rest = d.hands[me()].filter((c) => c !== card);
  const laid = room.groups.map((g) => g.filter((c) => c !== card)).filter((g) => g.length);
  const ok = R.checkDeclare(laid, d.wild).ok || R.analyze(rest, d.wild).complete;
  if (!ok) {
    room.message = R.checkDeclare(R.arrange(rest, d.wild), d.wild).why || 'Not a winning hand yet.';
    publish();
    return false;
  }
  throwCard(d, me(), card);
  removeFromGroups(card);
  finish(d, me(), 'declare');
  publish();
  return true;
}
/** Drops out of the deal: 20 points before your first draw, 40 after. */
export function drop() {
  const d = mine();
  if (!d || d.stage !== 'draw') return;
  d.dropped[me()] = d.turns[me()] ? R.MIDDLE_DROP : R.FIRST_DROP;
  d.last[me()] = { action: 'drop', seq: ++d.seq };
  const left = d.order.filter((k) => !d.dropped[k]);
  if (left.length === 1) finish(d, left[0], 'drop');
  else nextTurn(d, me());
  publish();
}
function removeFromGroups(card) {
  room.groups = room.groups.map((g) => g.filter((c) => c !== card)).filter((g) => g.length);
}

// ---------- your groups ----------
/** Replaces your layout (the same cards, in new groups). */
export function setGroups(groups) {
  if (!room || !room.deal) return;
  const hand = room.deal.hands[me()];
  const flat = groups.flat();
  if (flat.length !== hand.length || !flat.every((c) => hand.includes(c))) return;
  room.groups = groups.filter((g) => g.length);
  publish();
}
export function arrangeMine() { if (room && room.deal) setGroups(R.arrange(room.deal.hands[me()], room.deal.wild)); }
export function sortMine() { if (room && room.deal) setGroups(R.bySuit(room.deal.hands[me()], room.deal.wild)); }
/** Puts `cards` together in a group of their own. */
export function groupCards(cards) {
  if (!room || !room.deal || cards.length < 1) return;
  const rest = room.groups.map((g) => g.filter((c) => !cards.includes(c))).filter((g) => g.length);
  setGroups(rest.concat([cards]));
}
export function nextDeal() { if (room && room.deal && room.deal.phase === 'done') waitUntil = 0; }
export function takeNotice() { if (!room || !room.notice) return null; const n = room.notice; room.notice = null; return n; }

export function leave() {
  if (!room) return;
  stop();
  const d = room.deal;
  // Leaving mid-deal is a drop: 20 points before you have drawn, else 40.
  if (d && d.phase !== 'done' && !d.dropped[me()]) {
    const pts = d.turns[me()] ? R.MIDDLE_DROP : R.FIRST_DROP;
    room.balance -= pts * room.point;
    saveAccount(true);
  }
  room = null;
  bots = {};
}
