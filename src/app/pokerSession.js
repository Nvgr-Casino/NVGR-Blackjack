// Texas Hold'em tables over Firebase: seating and the buy-in, the betting,
// the clock, starting and clearing hands — all through transactions on the
// room, the rules in src/poker/rules.js — and this player's part in the
// shuffle-and-deal (src/poker/protocol.js), run against the hand's crypto
// node, rooms/<code>_mp/<handId>, kept beside the room so that the large
// deck never rides along in every betting transaction.
//
// Chips: at a blackjack table the account balance and the seat are one
// number. At a poker table they are two: the buy-in leaves the account for
// the stack, and the stack goes back when the player leaves. A player stood
// up while away (out too long, or left mid-hand) has their stack put in
// the room's `cashout`, which their own client collects the next time it
// can (collectCashout).

import { ref, get, set, update, remove, onValue, onDisconnect, runTransaction } from 'firebase/database';
import { db } from '../firebase/config.js';
import * as R from '../poker/rules.js';
import { createProtocol } from '../poker/protocol.js';
import { FELT_THEME_KEYS } from '../scene/table.js';
import { DEALER_KEYS } from '../scene/dealer.js';
import { safeKey, genCode } from './roomLogic.js';
import * as S from './session.js';

const roomRef = (code) => ref(db, 'rooms/' + code);
const mpPath = (code, handId) => 'rooms/' + code + '_mp/' + handId;
const me = () => safeKey(S.session.uid);

// ---------- tables ----------

function newPokerRoom(tierIndex, { isPublic, adminId = null } = {}) {
  const stakes = R.POKER_STAKES[tierIndex];
  return {
    code: genCode(), game: 'holdem', isPublic, adminId,
    tier: tierIndex + 1, sb: stakes.sb, bb: stakes.bb,
    felt: FELT_THEME_KEYS[(tierIndex + 1) % FELT_THEME_KEYS.length],
    dealerType: DEALER_KEYS[Math.floor(Math.random() * DEALER_KEYS.length)],
    players: {}, hand: null, buttonSeat: null, handCount: 0,
    chat: [], log: ['Table open — take a seat.'],
  };
}

export async function createPokerTable(tierIndex = 0) {
  const room = newPokerRoom(tierIndex, { isPublic: false, adminId: me() });
  await set(roomRef(room.code), room);
  await S.setCurrentRoom(S.session.uid, room.code);
  S.enterTable(room.code);
}

/** Opens a table to watch; the player then chooses a seat and a buy-in. */
export async function openPokerTable(code) {
  await S.setCurrentRoom(S.session.uid, code);
  S.enterTable(code);
}

/** Sits down at the first public table with a free seat, or opens one. */
export async function playPokerNow() {
  const idx = await get(ref(db, 'publicIndex/tables'));
  const codes = idx.exists() ? Object.keys(idx.val()) : [];
  for (const code of codes) {
    const snap = await get(roomRef(code));
    const r = snap.val();
    if (!r || r.game !== 'holdem') continue;
    if (Object.keys(r.players || {}).length >= R.POKER_SEATS) continue;
    const { min, max } = R.buyInRange(r);
    if (S.session.chips < min) continue;
    if (await sitDown(code, -1, Math.min(max, S.session.chips))) { await openPokerTable(code); return; }
  }
  S.setFormError('No table with a free seat at your stakes — open one from the list.');
}

/**
 * Takes `seat` (or the first free one, at -1) with `buyIn` chips from the
 * account. The chips come off the account first; if the seat is gone by the
 * time the transaction runs, they go straight back.
 */
export async function sitDown(code, seat, buyIn) {
  buyIn = Math.floor(buyIn);
  if (!(buyIn > 0) || buyIn > S.session.chips) return false;
  await takeFromAccount(buyIn);
  const key = me();
  let committed = false;
  try {
    const result = await runTransaction(roomRef(code), (r) => {
      if (!r) return r;
      if (!R.seatPlayer(r, key, { name: S.session.name, character: S.session.character, seat, buyIn })) return;
      return r;
    });
    committed = result.committed && !!(result.snapshot.val().players || {})[key];
  } catch (e) {
    console.error('sitDown', e);
  }
  // However the seat was lost — refused, or the transaction failed — the
  // buy-in goes straight back.
  if (!committed) { await giveToAccount(buyIn); return false; }
  markOnline(code);
  return true;
}

async function takeFromAccount(n) {
  S.session.chips -= n;
  await S.saveAccountChips(S.session.uid, S.session.name, S.session.chips);
}
async function giveToAccount(n) {
  if (!n) return;
  S.session.chips += n;
  await S.saveAccountChips(S.session.uid, S.session.name, S.session.chips);
}

// Who is at the table right now: rooms/<code>_presence/<key>, set while a
// seated player's connection is up and removed by the server the moment it
// drops, so the next hand isn't dealt to an empty chair. Beside the room,
// never inside it: a write inside the room's node aborts any transaction on
// the room still in flight — a seat being taken, a bet — and that is how a
// seat once went missing with its buy-in.
let presenceCode = null;
let presence = null;        // { key: true } for the table being watched, once loaded
let presenceFor = null;
let presenceOff = null;
const presenceRef = (code, key) => ref(db, 'rooms/' + code + '_presence' + (key ? '/' + key : ''));
function markOnline(code) {
  if (presenceCode === code) return;
  const mine = presenceRef(code, me());
  onDisconnect(mine).remove().catch(() => {});
  set(mine, true).catch(() => {});
  presenceCode = code;
}
function clearPresence() {
  if (!presenceCode) return;
  const mine = presenceRef(presenceCode, me());
  onDisconnect(mine).cancel().catch(() => {});
  remove(mine).catch(() => {});
  presenceCode = null;
}
function watchPresence(code) {
  if (presenceFor === code) return;
  if (presenceOff) presenceOff();
  presenceFor = code;
  presence = null;
  presenceOff = onValue(presenceRef(code), (snap) => { presence = snap.val() || {}; drive(); });
}
/** Whether a seated player is at the table — true until presence has loaded. */
export function isPresent(key) { return !presence || !!presence[key]; }
// The players with whether each is here, for the protocol's custodians.
const withPresence = (players) => Object.fromEntries(Object.entries(players || {}).map(([k, p]) => [k, { ...p, online: isPresent(k) }]));

/** Leaves the table: out of any hand at once, the stack back to the account. */
export async function leavePoker(code) {
  const key = me();
  clearPresence();
  await runTransaction(roomRef(code), (r) => {
    if (!r) return r;
    if (r.players && r.players[key]) R.leave(r, key, Date.now());
    return r;
  });
  await collectCashout(code);
}

/** Takes anything the room is holding for this player back to their account. */
export async function collectCashout(code) {
  const key = me();
  let amount = 0;
  const result = await runTransaction(roomRef(code), (r) => {
    if (!r) return r;
    amount = (r.cashout && r.cashout[key]) || 0;
    if (!amount) return;
    delete r.cashout[key];
    return r;
  });
  if (result.committed && amount) await giveToAccount(amount);
  // Still seated mid-hand: the stack comes when the hand is over, and is
  // collected then (see onRoom), or on the next visit.
  return amount;
}

export async function act(action, amount) {
  const code = S.session.code;
  await S.mutateRoom(code, (r) => { R.applyAction(r, me(), action, amount, Date.now()); });
}
export async function setSitOut(out) {
  await S.mutateRoom(S.session.code, (r) => { R.setSitOut(r, me(), out, Date.now()); });
}
export async function topUp(amount) {
  amount = Math.min(Math.floor(amount), S.session.chips);
  if (!(amount > 0)) return;
  let added = 0;
  await takeFromAccount(amount);
  await runTransaction(roomRef(S.session.code), (r) => {
    if (!r) return r;
    added = R.topUp(r, me(), amount);
    return r;
  });
  await giveToAccount(amount - added);
}

// ---------- the lobby ----------
// Poker tables are listed in the same public index as the blackjack ones
// (the database's rules allow writes there and nowhere else); each lobby
// tells its own tables by the room's `game`.

// A seat record with no seat — an `online` flag written back by a dropped
// connection after the player had already been stood up — is debris.
function tidyPlayers(r) {
  Object.keys(r.players || {}).forEach((k) => { if (typeof r.players[k].seat !== 'number') delete r.players[k]; });
}

export async function loadPokerTables() {
  const idx = await get(ref(db, 'publicIndex/tables'));
  const codes = idx.exists() ? Object.keys(idx.val()) : [];
  const tables = [];
  for (const code of codes) {
    const r = (await get(roomRef(code))).val();
    if (!r || r.game !== 'holdem') continue;
    const seats = Object.values(r.players || {}).map((p) => ({ name: p.name, character: p.character || null }));
    tables.push({ code, game: 'holdem', tier: r.tier, sb: r.sb, bb: r.bb, count: seats.length, seats, felt: r.felt, playing: !!r.hand });
  }
  // One open table at each stakes, always.
  for (let i = 0; i < R.POKER_STAKES.length; i++) {
    if (tables.some((t) => t.tier === i + 1)) continue;
    const room = newPokerRoom(i, { isPublic: true });
    await set(roomRef(room.code), room);
    await set(ref(db, 'publicIndex/tables/' + room.code), true);
    tables.push({ code: room.code, game: 'holdem', tier: room.tier, sb: room.sb, bb: room.bb, count: 0, seats: [], felt: room.felt, playing: false });
  }
  return tables.sort((a, b) => a.tier - b.tier);
}

// ---------- the hand, from this client ----------

let protocol = null;
let protoFor = null;
let mpUnsub = null;
let mpHandId = null;
let mpData = null;
let lastRoom = null;
let running = false;
let again = false;
let myCards = null;
let myCardsHand = null;

/** This player's hole cards for the hand in progress, once decrypted. */
export function myHoleCards(room) {
  return room && room.hand && myCardsHand === room.hand.id ? myCards : null;
}

const storage = {
  get: (k) => { try { return sessionStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { sessionStorage.setItem(k, v); } catch { /* private mode */ } },
};

/** Called with every new snapshot of a poker room (session.js). */
export function onRoom(room) {
  lastRoom = room;
  const key = me();
  if (!protocol || protoFor !== key) { protocol = createProtocol({ me: key, storage }); protoFor = key; }
  const handId = room && room.hand ? room.hand.id : null;
  if (handId !== mpHandId) {
    if (mpUnsub) { mpUnsub(); mpUnsub = null; }
    mpHandId = handId;
    mpData = null;
    if (handId) {
      mpUnsub = onValue(ref(db, mpPath(room.code, handId)), (snap) => { mpData = snap.val(); drive(); });
    }
  }
  // A hand just ended with this player gone from the table — or holding
  // a stack for them: collect it.
  if (room && room.cashout && room.cashout[key]) collectCashout(room.code);
  if (room) watchPresence(room.code);
  // Seated (again, after a reload): keep the seat marked present.
  if (room && room.players && room.players[key] && typeof room.players[key].stack === 'number') markOnline(room.code);
  drive();
}

/** This player's seat is gone — stood up, sat out too long, or left. */
export function onStoodUp(room) {
  clearPresence();
  myCards = null;
  if (room && room.cashout && room.cashout[me()]) collectCashout(room.code);
}

export function stopPoker() {
  if (mpUnsub) { mpUnsub(); mpUnsub = null; }
  mpHandId = null; mpData = null; lastRoom = null;
  clearPresence();
  if (presenceOff) { presenceOff(); presenceOff = null; }
  presenceFor = null; presence = null;
}

// Runs the protocol on the latest room and crypto node, one run at a time;
// a change during a run gets another run straight after.
async function drive() {
  if (running) { again = true; return; }
  running = true;
  try {
    do {
      again = false;
      await driveOnce();
    } while (again);
  } catch (e) {
    console.error('poker protocol', e);
  } finally {
    running = false;
  }
}

async function driveOnce() {
  const room = lastRoom;
  const hand = room && room.hand;
  if (!hand || !protocol) return;
  const code = room.code;
  const id = hand.id;
  const res = await protocol.update({ hand, mp: mpData, players: withPresence(room.players), now: Date.now() });
  if (res.myCards) { myCards = res.myCards; myCardsHand = id; S.refresh(); }
  const base = mpPath(code, id) + '/';
  await Promise.all(res.writes.map((w) => {
    if (w.ifStep === undefined) return set(ref(db, base + w.path.join('/')), w.value);
    return runTransaction(ref(db, base + w.path.join('/')), (cur) => (((cur && cur.step) ?? -1) === w.ifStep ? w.value : undefined));
  }));
  const same = (r) => r && r.hand && r.hand.id === id;
  if (res.error) {
    await S.mutateRoom(code, (r) => { if (same(r)) R.voidHand(r, 'A card failed to check out.'); });
    return;
  }
  if (res.ready && hand.phase === 'deal') await S.mutateRoom(code, (r) => { if (same(r)) R.onDealt(r, Date.now()); });
  if (res.board && hand.phase === 'board') await S.mutateRoom(code, (r) => { if (same(r)) R.onBoard(r, res.board, Date.now()); });
  const shown = Object.entries(res.shown);
  if (shown.length && hand.phase === 'showdown') {
    await S.mutateRoom(code, (r) => { if (same(r)) shown.forEach(([k, cards]) => R.onShown(r, k, cards, Date.now())); });
  }
}

// ---------- the clock ----------

// Between hands, a short breath before the next is dealt.
const NEXT_HAND_MS = 1500;

/** Once a second from session.js, for the poker room being watched. */
export function tick(room) {
  if (!room) return;
  const code = room.code;
  const now = Date.now();
  const h = room.hand;
  if (Object.values(room.players || {}).some((p) => typeof p.seat !== 'number')) {
    S.mutateRoom(code, tidyPlayers);
    return;
  }
  if (h && h.phase === 'betting' && h.deadline && now >= h.deadline) {
    S.mutateRoom(code, (r) => { if (r.hand && r.hand.id === h.id) R.processTimeout(r, Date.now()); });
  } else if (h && R.stalled(room, now)) {
    // The shuffle stalled: whoever was holding it up sits out.
    const blamed = h.phase === 'deal' && protocol ? protocol.blame(h, mpData) : [];
    S.mutateRoom(code, (r) => {
      if (!r.hand || r.hand.id !== h.id || !R.stalled(r, Date.now())) return;
      R.voidHand(r, h.phase === 'deal' ? 'The deal stalled.' : 'The cards could not be turned.');
      blamed.forEach((k) => { if (r.players[k]) R.setSitOut(r, k, true, Date.now()); });
    }).then(() => remove(ref(db, mpPath(code, h.id))).catch(() => {}));
  } else if (h && h.phase === 'done' && now >= h.endsAt) {
    const oldId = h.id;
    S.mutateRoom(code, (r) => { if (r.hand && r.hand.id === oldId && R.clearHand(r, Date.now())) r.lastHandAt = Date.now(); })
      .then(() => remove(ref(db, mpPath(code, oldId))).catch(() => {}));
  } else if (!h) {
    const lastEnd = room.lastHandAt || 0;
    if (now - lastEnd < NEXT_HAND_MS) return;
    if (!presence) return;   // until we know who is here
    const here = { ...presence };
    const ready = Object.entries(room.players || {}).filter(([k, p]) => p.status === 'active' && p.stack > 0 && here[k] && !p.leaving);
    if (ready.length >= 2) {
      // Nothing of an earlier hand is still needed once none is running.
      remove(ref(db, 'rooms/' + code + '_mp')).catch(() => {});
      const id = genCode() + now.toString(36);
      S.mutateRoom(code, (r) => {
        if (r.hand) return;
        // Anyone gone from the table is sat out rather than dealt in.
        Object.entries(r.players || {}).forEach(([k, p]) => {
          if (!here[k] && p.status === 'active') { p.status = 'sitout'; p.sitOutAt = Date.now(); }
        });
        R.startHand(r, id, Date.now());
      });
    }
  }
}

/** The words on the table's clock pill: whose turn and how long, or what is being dealt. */
export function countdownText(room, key) {
  const h = room && room.hand;
  if (!h) return '';
  if (h.phase === 'betting' && h.deadline) {
    const secs = Math.max(0, Math.ceil((h.deadline - Date.now()) / 1000));
    const bank = h.usingBank ? ' · time bank' : '';
    if (h.toAct === key) return 'Your turn · ' + secs + 's' + bank;
    const p = room.players[h.toAct];
    return (p ? p.name : 'A player') + ' to act · ' + secs + 's' + bank;
  }
  if (h.phase === 'deal') return 'Shuffling and dealing…';
  if (h.phase === 'board') return 'Dealing the ' + h.street + '…';
  if (h.phase === 'showdown') return 'Showdown';
  return '';
}

// Development only: lets the local preview harness show a hand without a
// second player.
if (import.meta.env.DEV) {
  window.__pokerDev = { setMyCards: (handId, cards) => { myCards = cards; myCardsHand = handId; } };
}
