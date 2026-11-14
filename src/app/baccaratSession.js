// Baccarat tables over Firebase: the lobby's tables, taking and giving up a
// seat, the bets, and the table's clock. The rules are src/baccarat/rules.js;
// every change goes through a transaction on the room, as at blackjack, so
// whichever client steps the clock or places a bet, all of them agree.
//
// A table is in rooms/{code} like any other, with game 'baccarat', and
// listed in publicIndex/tables beside the blackjack and poker tables.

import { ref, get, set, runTransaction } from 'firebase/database';
import { db } from '../firebase/config.js';
import { DEALER_KEYS } from '../scene/dealer.js';
import * as R from '../baccarat/rules.js';
import { TABLE_STAKES, genCode, safeKey, stakesTier } from './roomLogic.js';
import * as S from './session.js';

export const isBaccarat = (r) => !!r && r.game === 'baccarat';

function newTable(tier, { isPublic = true, adminId = null } = {}) {
  const stakes = TABLE_STAKES[tier];
  return R.newBaccaratRoom({
    code: genCode(), minBet: stakes.min, maxBet: stakes.max, isPublic, adminId,
    dealerType: DEALER_KEYS[Math.floor(Math.random() * DEALER_KEYS.length)],
  });
}

// ---------- the lobby ----------
// Every public baccarat table, and at least one open at every stakes.
export async function loadBaccaratTables() {
  const idx = await get(ref(db, 'publicIndex/tables'));
  const codes = idx.exists() ? Object.keys(idx.val()) : [];
  const tables = [];
  for (const code of codes) {
    const snap = await get(ref(db, 'rooms/' + code));
    const r = snap.val();
    if (!isBaccarat(r) || !r.isPublic) continue;
    const players = Object.values(r.players || {});
    tables.push({
      code, tier: stakesTier(r), minBet: r.minBet, maxBet: r.maxBet, phase: r.phase,
      count: players.length, seats: players.map((p) => ({ name: p.name, character: p.character || null })),
      history: (r.history || []).slice(-12),
    });
  }
  const have = new Set(tables.map((t) => t.tier));
  for (let tier = 1; tier <= TABLE_STAKES.length; tier++) {
    if (have.has(tier)) continue;
    const room = newTable(tier - 1);
    await set(ref(db, 'rooms/' + room.code), room);
    await set(ref(db, 'publicIndex/tables/' + room.code), true);
    tables.push({ code: room.code, tier, minBet: room.minBet, maxBet: room.maxBet, phase: room.phase, count: 0, seats: [], history: [] });
  }
  return tables.sort((a, b) => a.tier - b.tier || b.count - a.count);
}

// ---------- seats ----------
async function sitAt(code) {
  const chips = (await S.ensureAccount(S.session.uid, S.session.name)).chips;
  const key = safeKey(S.session.uid);
  const result = await runTransaction(ref(db, 'rooms/' + code), (current) => {
    if (!current) return current;
    if (!isBaccarat(current)) return;
    if (!R.addPlayer(current, key, S.session.name, chips, S.session.character)) return;
    return current;
  });
  if (!result.committed || !result.snapshot.exists()) return false;
  await S.setCurrentRoom(S.session.uid, code);
  S.enterTable(code);
  return true;
}

export async function joinBaccaratTable(code) {
  S.setFormError('');
  if (!(await sitAt(code))) S.setFormError('That table is full — pick another.');
}

// The table nearest your bankroll with a chair free: the highest stakes
// whose minimum is no more than a fiftieth of your chips, busier first.
export async function playBaccaratNow() {
  S.setFormError('');
  const chips = (await S.ensureAccount(S.session.uid, S.session.name)).chips;
  const tables = await loadBaccaratTables();
  const fits = tables.filter((t) => t.count < R.BACCARAT_SEATS && t.minBet <= Math.max(TABLE_STAKES[0].min, chips / 50));
  fits.sort((a, b) => b.tier - a.tier || b.count - a.count);
  for (const t of fits) if (await sitAt(t.code)) return;
  const room = newTable(0);
  await set(ref(db, 'rooms/' + room.code), room);
  await set(ref(db, 'publicIndex/tables/' + room.code), true);
  await sitAt(room.code);
}

// A private table, for friends with the code.
export async function hostBaccaratTable(tierIndex) {
  const room = newTable(Math.max(0, Math.min(TABLE_STAKES.length - 1, tierIndex)), { isPublic: false, adminId: safeKey(S.session.uid) });
  await set(ref(db, 'rooms/' + room.code), room);
  await sitAt(room.code);
}

// Getting up: bets still open are handed back, and if the ball is already
// running they are settled on the number drawn. The balance you walk away
// with goes to your account.
export async function leaveBaccarat(code) {
  const key = safeKey(S.session.uid);
  let chips = null;
  await runTransaction(ref(db, 'rooms/' + code), (current) => {
    if (!current || !current.players || !current.players[key]) return current;
    if (current.phase === 'dealing') R.settlePlayer(current, key);
    const p = current.players[key];
    chips = p.chips + R.totalBet(p);
    delete current.players[key];
    current.playerOrder = (current.playerOrder || []).filter((k) => k !== key);
    if (!current.playerOrder.length) current.bettingDeadline = null;
    // The last one out: the table's chat goes with them.
    if (!Object.keys(current.players || {}).length) current.chat = null;
    return current;
  }).catch(() => {});
  if (typeof chips === 'number') {
    S.session.chips = chips;
    await S.saveAccountChips(S.session.uid, S.session.name, chips).catch(() => {});
  }
}

// ---------- bets ----------
const mine = () => safeKey(S.session.uid);
const now = () => Date.now();
export const bet = (id, amount) => S.mutateRoom(S.session.code, (r) => { R.placeBet(r, mine(), id, amount, now()); });
export const undo = () => S.mutateRoom(S.session.code, (r) => { R.undoBet(r, mine(), now()); });
export const clear = () => S.mutateRoom(S.session.code, (r) => { R.clearBets(r, mine(), now()); });
export const repeat = () => S.mutateRoom(S.session.code, (r) => { R.repeatBets(r, mine(), now()); });
export const double = () => S.mutateRoom(S.session.code, (r) => { R.doubleBets(r, mine(), now()); });
export const moveSeat = (seat) => S.mutateRoom(S.session.code, (r) => { R.moveSeat(r, mine(), seat); });

// ---------- the clock ----------
// Called every second by the session's tick. Only a step that is due goes
// to the database: the window to open or close, the ball to land, the next
// window to open.
let stepping = false;
export function tick(r) {
  if (stepping || !r) return;
  const t = now();
  const seated = (r.playerOrder || []).some((k) => r.players && r.players[k]);
  const due = r.phase === 'betting' ? (r.bettingDeadline ? t >= r.bettingDeadline : seated)
    : r.phase === 'dealing' ? t >= r.dealAt + R.dealDuration(r.hand)
    : r.phase === 'results' ? t >= r.resultsAt + R.RESULTS_MS
    : false;
  if (!due) return;
  stepping = true;
  S.mutateRoom(S.session.code, (rr) => { R.tick(rr, now()); }).finally(() => { stepping = false; });
}

// The status line's text, refreshed every second.
export function countdownText(r) {
  if (!r) return '';
  const t = now();
  if (r.phase === 'betting') {
    if (!r.bettingDeadline) return 'Place your bets';
    const s = Math.max(0, Math.ceil((r.bettingDeadline - t) / 1000));
    return s > 0 ? `Place your bets · ${s}s` : 'No more bets';
  }
  if (r.phase === 'dealing') return 'No more bets';
  if (r.phase === 'results' && r.hand) {
    const h = r.hand;
    return h.winner === 'tie' ? `Tie · ${h.ptotal} all` : `${h.winner === 'player' ? 'Player' : 'Banker'} wins · ${Math.max(h.ptotal, h.btotal)} to ${Math.min(h.ptotal, h.btotal)}`;
  }
  return '';
}

// ---------- practice ----------
// A table in this browser alone, on practice chips: nothing comes off your
// balance and nothing goes to the database. The same rules run it, on a
// timer here instead of the session's.
let practice = null;
let practiceTimer = null;
export const isPracticeBaccarat = (r) => !!(r && r.offline && r.game === 'baccarat');
function publishPractice() {
  S.session.room = JSON.parse(JSON.stringify(practice));
  S.refresh();
}
export function startPractice(tierIndex = 0) {
  stopPractice();
  const tier = Math.max(0, Math.min(TABLE_STAKES.length - 1, tierIndex));
  practice = newTable(tier, { isPublic: false });
  practice.code = 'PRACTICE';
  practice.offline = true;
  practice.log = ['A practice table — practice chips, nothing off your balance.'];
  R.addPlayer(practice, mine(), S.session.name, TABLE_STAKES[tier].max * 10, S.session.character);
  S.session.code = practice.code;
  S.session.screen = 'table';
  publishPractice();
  practiceTimer = setInterval(() => {
    if (!practice) return;
    // Signed out, or gone from the table some other way: the practice ends.
    if (!S.session.uid || S.session.code !== practice.code) { stopPractice(); return; }
    // Nobody is given up at practice for watching a few coups.
    const me = practice.players[mine()];
    if (me) me.idle = 0;
    if (R.tick(practice, now())) publishPractice();
    const el = document.getElementById('countdownText');
    if (el) el.textContent = countdownText(practice);
  }, 500);
}
export function practiceMutate(fn) {
  if (!practice) return;
  fn(practice);
  publishPractice();
}
export function stopPractice() {
  if (practiceTimer) clearInterval(practiceTimer);
  practiceTimer = null;
  practice = null;
}
