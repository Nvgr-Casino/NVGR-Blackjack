// Teen Patti at the house's table: you and four house players, on your real
// chips. The rules are src/teenpatti/rules.js; this runs the table in this
// browser — deals, the house players' turns, the pause to show who won —
// and keeps your account up to date after every hand.
//
// Sitting down takes a buy-in from your balance to the table (200 boots, or
// all you have if less); your account is saved as balance-off-the-table
// plus the chips in front of you after every hand, so closing the page
// loses nothing but a hand in play. Leaving puts your chips back.

import * as T from '../teenpatti/rules.js';
import { CHARACTERS } from '../scene/character.js';
import { DEALER_KEYS } from '../scene/dealer.js';
import { safeKey, STARTING_CHIPS, RESTAKE_BELOW } from './roomLogic.js';
import * as S from './session.js';

export const isTeenPatti = (r) => !!r && r.game === 'teenpatti';

const DEAL_MS = 2600;           // the cards going out before anyone acts
const RESULT_MS = 4800;         // the result shown before the next deal
const THINK_MS = [900, 2200];
const SEE_MS = [500, 900];
const TICK_MS = 150;

export const HOUSE_NAMES = ['Arjun', 'Priya', 'Rohan', 'Meera', 'Vikram', 'Ananya', 'Kabir', 'Sana', 'Aditya', 'Kavya', 'Rahul', 'Diya', 'Karan', 'Riya', 'Varun', 'Nisha', 'Siddharth', 'Pooja', 'Harsh', 'Tanvi'];
const FELTS = ['red', 'green', 'purple', 'black', 'blue'];

let room = null;
let timer = null;
let waitUntil = 0;
let thinking = null;     // { key, at }
let bots = {};
const me = () => (S.session.uid ? safeKey(S.session.uid) : 'me');
const publish = () => { if (room) { S.session.room = { ...room }; S.refresh(); } };

function pick(list, not = []) {
  const free = list.filter((x) => !not.includes(x));
  return free[Math.floor(Math.random() * free.length)];
}
function seatBot(seat) {
  const used = Object.values(room.players).map((p) => p.name);
  const usedChars = Object.values(room.players).map((p) => p.character);
  const key = 'house' + Math.random().toString(36).slice(2, 7);
  const character = pick(CHARACTERS.map((c) => c.id), usedChars.concat(S.session.character || []));
  room.players[key] = { name: pick(HOUSE_NAMES, used), seat, stack: T.limitsFor(room.boot).buyIn, bot: true, character };
  bots[key] = T.newPersonality();
  return key;
}

function saveAccount() {
  if (!room || room.dev) return;
  const mine = room.players[me()];
  const total = room.bank + (mine ? mine.stack : 0);
  S.session.chips = total;
  S.saveAccountChips(S.session.uid, S.session.name, total, { game: 'teenpatti' }).catch(() => {});
}

/** Sits you down at a table of stakes `tierIndex` (TP_STAKES). */
export async function startTeenPatti(tierIndex = 0, { dev = false, chips = 0 } = {}) {
  stop();
  S.setFormError('');
  const stakes = T.TP_STAKES[tierIndex] || T.TP_STAKES[0];
  const L = T.limitsFor(stakes.boot);
  const balance = dev ? chips : (await S.ensureAccount(S.session.uid, S.session.name)).chips;
  if (balance < L.minBuyIn) {
    S.setFormError(`The ${stakes.name} table needs at least ${L.minBuyIn.toLocaleString()} chips — you have ${balance.toLocaleString()}.`);
    return false;
  }
  const buyIn = Math.min(balance, L.buyIn);
  room = {
    code: 'TEENPATTI', game: 'teenpatti', offline: true, isPublic: false, dev,
    tier: tierIndex + 1, stakesName: stakes.name, boot: stakes.boot,
    felt: FELTS[tierIndex % FELTS.length],
    dealerType: DEALER_KEYS[Math.floor(Math.random() * DEALER_KEYS.length)],
    players: {}, dealerSeat: null, hand: null, handCount: 0,
    bank: balance - buyIn, notice: null,
  };
  room.players[me()] = { name: S.session.name || 'You', seat: 2, stack: buyIn, character: S.session.character, me: true };
  [4, 0, 3, 1].forEach((seat) => seatBot(seat));
  S.session.chips = balance;
  S.session.code = room.code;
  S.session.screen = 'table';
  saveAccount();
  publish();
  waitUntil = performance.now() + 1400;
  timer = setInterval(step, TICK_MS);
  return true;
}
export function devStart(chips = 250000) {
  if (!import.meta.env.DEV) return;
  startTeenPatti(1, { dev: true, chips });
}

export const current = () => room;

function stop() {
  clearInterval(timer);
  timer = null;
  thinking = null;
}

// Between hands: house players who can no longer cover the boot leave and
// another sits down; you are topped up from your balance.
function between() {
  const boot = room.boot;
  Object.entries(room.players).forEach(([k, p]) => {
    if (!p.bot || p.stack >= boot * 4) return;
    const seat = p.seat;
    delete room.players[k];
    delete bots[k];
    seatBot(seat);
  });
  const mine = room.players[me()];
  if (mine && mine.stack < boot) {
    const want = T.limitsFor(boot).buyIn - mine.stack;
    if (room.bank + mine.stack < RESTAKE_BELOW) {
      room.bank = STARTING_CHIPS;
      room.notice = `Out of chips — the house has topped you back up to ${STARTING_CHIPS.toLocaleString()}.`;
    }
    const move = Math.min(want, room.bank);
    mine.stack += move;
    room.bank -= move;
    if (move > 0 && !room.notice) room.notice = `${move.toLocaleString()} more chips brought to the table from your balance.`;
  }
}

function step() {
  if (!room) return;
  const now = performance.now();
  if (now < waitUntil) return;
  const h = room.hand;
  if (!h || h.phase === 'done') {
    if (h) between();
    room.notice = h ? room.notice : null;
    const mine = room.players[me()];
    if (!mine || mine.stack < room.boot) { publish(); waitUntil = now + 1000; return; }
    room.handCount += 1;
    if (!T.startHand(room, Math.random, room.handCount)) { waitUntil = now + 1000; return; }
    thinking = null;
    publish();
    waitUntil = now + DEAL_MS;
    return;
  }
  // A side show waits on the player asked.
  if (h.sideShow) {
    const to = h.sideShow.to;
    if (!room.players[to] || !room.players[to].bot) return;
    if (!thinking || thinking.key !== 'side:' + to) { thinking = { key: 'side:' + to, at: now + rand(THINK_MS) }; return; }
    if (now < thinking.at) return;
    thinking = null;
    const res = T.answerSideShow(room, T.decideSideShow(room, to));
    room.lastSide = { ...res, at: Date.now() };
    afterMove(now, 1600);
    return;
  }
  const k = h.toAct;
  const p = room.players[k];
  if (!p || !p.bot) return;   // your turn: the screen waits on you
  if (!thinking || thinking.key !== k) { thinking = { key: k, at: now + rand(THINK_MS) }; return; }
  if (now < thinking.at) return;
  const move = T.decide(room, k, bots[k]);
  if (move === 'see') {
    T.act(room, k, 'see');
    thinking = { key: k, at: now + rand(SEE_MS) };
    publish();
    return;
  }
  thinking = null;
  T.act(room, k, move || 'pack');
  afterMove(now, move === 'side' ? 400 : 250);
}
const rand = ([a, b]) => a + Math.random() * (b - a);

function afterMove(now, pause) {
  const h = room.hand;
  if (h.phase === 'done') {
    saveAccount();
    waitUntil = now + RESULT_MS + (h.reason === 'fold' ? -1200 : 0);
  } else {
    waitUntil = now + pause;
  }
  publish();
}

// ---------- your moves ----------
export function act(move) {
  if (!room || !room.hand) return false;
  const ok = T.act(room, me(), move);
  if (!ok) return false;
  if (move === 'see') { publish(); return true; }
  afterMove(performance.now(), 300);
  return true;
}
/** Your answer when a house player asks you for a side show. */
export function answerSide(accept) {
  if (!room || !room.hand || !room.hand.sideShow || room.hand.sideShow.to !== me()) return;
  const res = T.answerSideShow(room, accept);
  room.lastSide = { ...res, at: Date.now() };
  afterMove(performance.now(), 1600);
}
export const myKey = me;

export function leave() {
  if (!room) return;
  stop();
  const h = room.hand;
  const mine = room.players[me()];
  // Mid-hand, what you have put in is lost, as if you had packed.
  if (mine && !room.dev) {
    const total = room.bank + mine.stack;
    S.session.chips = total;
    S.saveAccountChips(S.session.uid, S.session.name, total, h && h.phase !== 'done' && !h.folded[me()] ? { game: 'teenpatti' } : null).catch(() => {});
  }
  room = null;
  bots = {};
}
