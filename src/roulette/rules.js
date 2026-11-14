// European roulette: one zero, thirty-seven pockets. The rules, and nothing
// of the screen or the database: a room is a plain object these functions
// change, run inside a transaction (src/app/rouletteSession.js), so every
// client agrees on the same table.
//
// A round goes betting → spinning → results. Bets are taken from a
// player's chips as they are placed, and given back if cleared. When the
// betting window closes with any bet on the table, the winning number is
// drawn and the wheel spins to it (every client animates the same number);
// once the ball has landed, the bets are settled and the next window opens.
//
// A bet is named by a short id:
//   n:17       straight up, one number (0–36)           35 to 1
//   s:17-20    split, two numbers side by side           17 to 1
//   t:16       street, the row of three from 16          11 to 1
//   c:16       corner, 16 17 19 20                        8 to 1
//   l:16       six line, the two rows from 16             5 to 1
//   d:2        dozen (1–12, 13–24, 25–36)                 2 to 1
//   col:1      column (1, 4 … 34; 2, 5 … 35; 3, 6 … 36)   2 to 1
//   red black even odd low high                           1 to 1
// The zero loses every outside bet.

import { topUpIfBroke } from '../app/roomLogic.js';
export const WHEEL_ORDER = [0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26];
export const REDS = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);
export const colorOf = (n) => (n === 0 ? 'green' : REDS.has(n) ? 'red' : 'black');

export const ROULETTE_SEATS = 6;
export const BETTING_MS = 25000;
// The ball's run, as at a real wheel: twenty-odd laps on the rim, the fall,
// the bounces and the settle take up to about sixteen seconds
// (src/roulette/spinPlan.js); the number is shown once it is still.
export const SPIN_MS = 18000;
export const RESULTS_MS = 6000;     // the number on the table before bets reopen
export const MAX_IDLE_SPINS = 5;    // windows in a row without a bet before a seat is given up
export const HISTORY = 16;

const range = (a, b, step = 1) => { const out = []; for (let i = a; i <= b; i += step) out.push(i); return out; };
const OUTSIDE = {
  red: range(1, 36).filter((n) => REDS.has(n)),
  black: range(1, 36).filter((n) => !REDS.has(n)),
  even: range(2, 36, 2),
  odd: range(1, 35, 2),
  low: range(1, 18),
  high: range(19, 36),
};

// The numbers a bet covers, or null if there is no such bet.
export function numbersFor(id) {
  if (typeof id !== 'string') return null;
  if (OUTSIDE[id]) return OUTSIDE[id];
  const [kind, arg] = id.split(':');
  if (arg === undefined) return null;
  if (kind === 's') {
    const [a, b] = arg.split('-').map(Number);
    if (!Number.isInteger(a) || !Number.isInteger(b) || a >= b || b > 36 || a < 0) return null;
    // The zero splits with the first street; otherwise neighbours across
    // a street (n, n+1, not over its top) or along a row (n, n+3).
    if (a === 0) return b <= 3 ? [a, b] : null;
    if (b - a === 3 || (b - a === 1 && a % 3 !== 0)) return [a, b];
    return null;
  }
  const n = Number(arg);
  if (!Number.isInteger(n) || String(n) !== arg) return null;
  if (kind === 'n') return n >= 0 && n <= 36 ? [n] : null;
  if (kind === 't') return n >= 1 && n <= 34 && n % 3 === 1 ? [n, n + 1, n + 2] : null;
  if (kind === 'c') return n >= 1 && n <= 32 && n % 3 !== 0 ? [n, n + 1, n + 3, n + 4] : null;
  if (kind === 'l') return n >= 1 && n <= 31 && n % 3 === 1 ? range(n, n + 5) : null;
  if (kind === 'd') return n >= 1 && n <= 3 ? range(12 * (n - 1) + 1, 12 * n) : null;
  if (kind === 'col') return n >= 1 && n <= 3 ? range(n, 33 + n, 3) : null;
  return null;
}
// What a winning bet pays, to one: 36 over the numbers it covers, less the
// stake — 35 for one number down to evens for eighteen.
export function payoutFor(id) {
  const nums = numbersFor(id);
  return nums ? 36 / nums.length - 1 : 0;
}
export const covers = (id, number) => { const nums = numbersFor(id); return !!nums && nums.includes(number); };

// A bet's name for people.
export function betLabel(id) {
  const nums = numbersFor(id);
  if (!nums) return id;
  const [kind] = id.split(':');
  if (OUTSIDE[id]) return { red: 'Red', black: 'Black', even: 'Even', odd: 'Odd', low: '1–18', high: '19–36' }[id];
  if (kind === 'n') return String(nums[0]);
  if (kind === 's') return `Split ${nums.join('/')}`;
  if (kind === 't') return `Street ${nums[0]}–${nums[2]}`;
  if (kind === 'c') return `Corner ${nums.join('/')}`;
  if (kind === 'l') return `Six line ${nums[0]}–${nums[5]}`;
  if (kind === 'd') return ['1st', '2nd', '3rd'][nums[0] === 1 ? 0 : nums[0] === 13 ? 1 : 2] + ' dozen';
  if (kind === 'col') return `Column ${id.slice(4)}`;
  return id;
}

// A fair draw, 0 to 36: rejection sampling over a byte, so no pocket comes
// up more often than another.
export function drawNumber() {
  const buf = new Uint8Array(1);
  for (;;) {
    globalThis.crypto.getRandomValues(buf);
    if (buf[0] < 37 * 6) return buf[0] % 37;
  }
}

// ---------- the room ----------
export function newRouletteRoom({ code, minBet, maxBet, isPublic = true, adminId = null, dealerType = 'male', felt = 'green' }) {
  return {
    code, game: 'roulette', isPublic, adminId, minBet, maxBet, dealerType, felt,
    players: {}, playerOrder: [],
    phase: 'betting', round: 1, bettingDeadline: null, spinAt: null, resultsAt: null,
    result: null, history: [], chat: [], log: ['Table open. Place your bets.'],
  };
}

const live = (r) => (r.playerOrder || []).filter((k) => r.players && r.players[k]);
const note = (r, line) => { r.log = (r.log || []).concat(line).slice(-8); };

export function firstFreeSeat(r) {
  const taken = new Set(live(r).map((k) => r.players[k].seat));
  for (let i = 0; i < ROULETTE_SEATS; i++) if (!taken.has(i)) return i;
  return -1;
}
// Seats a player, if there is a chair; true if they are seated now.
export function addPlayer(r, key, name, chips, character) {
  r.players = r.players || {};
  r.playerOrder = r.playerOrder || [];
  if (r.players[key]) { r.players[key].idle = 0; return true; }
  const seat = firstFreeSeat(r);
  if (seat < 0) return false;
  r.players[key] = { name, chips, character: character || null, seat, bets: null, placed: null, lastBets: null, idle: 0, result: null };
  r.playerOrder.push(key);
  return true;
}
export function moveSeat(r, key, seat) {
  const p = r.players && r.players[key];
  if (!p || seat < 0 || seat >= ROULETTE_SEATS) return false;
  if (live(r).some((k) => k !== key && r.players[k].seat === seat)) return false;
  p.seat = seat;
  return true;
}

export const totalBet = (p) => Object.values((p && p.bets) || {}).reduce((a, b) => a + b, 0);
export const anyBets = (r) => live(r).some((k) => totalBet(r.players[k]) > 0);
export const bettingOpen = (r, now) => r.phase === 'betting' && (!r.bettingDeadline || now < r.bettingDeadline);

// A chip on the layout. Taken from the player's chips at once; refused if
// the window has closed, the bet is no bet, the player cannot cover it or
// it would take their stake on this spin over the table's maximum.
export function placeBet(r, key, id, amount, now) {
  const p = r.players && r.players[key];
  amount = Math.floor(Number(amount));
  if (!p || !bettingOpen(r, now) || !numbersFor(id) || !(amount > 0)) return false;
  if (amount > p.chips || totalBet(p) + amount > r.maxBet) return false;
  p.bets = p.bets || {};
  p.bets[id] = (p.bets[id] || 0) + amount;
  p.placed = (p.placed || []).concat([[id, amount]]).slice(-60);
  p.chips -= amount;
  p.idle = 0;
  // The first chip on a quiet table starts its clock.
  if (!r.bettingDeadline) r.bettingDeadline = now + BETTING_MS;
  return true;
}
// Takes back the last chip placed.
export function undoBet(r, key, now) {
  const p = r.players && r.players[key];
  if (!p || !bettingOpen(r, now) || !p.placed || !p.placed.length) return false;
  const [id, amount] = p.placed[p.placed.length - 1];
  p.placed = p.placed.slice(0, -1);
  const left = (p.bets[id] || 0) - amount;
  if (left > 0) p.bets[id] = left; else delete p.bets[id];
  p.chips += amount;
  return true;
}
export function clearBets(r, key, now) {
  const p = r.players && r.players[key];
  if (!p || !bettingOpen(r, now)) return false;
  p.chips += totalBet(p);
  p.bets = null;
  p.placed = null;
  return true;
}
// Places a whole set of bets, or none of it.
function placeAll(r, key, bets, now) {
  const p = r.players && r.players[key];
  if (!p || !bets || !bettingOpen(r, now)) return false;
  const sum = Object.values(bets).reduce((a, b) => a + b, 0);
  if (!sum || sum > p.chips || totalBet(p) + sum > r.maxBet) return false;
  if (!Object.keys(bets).every((id) => numbersFor(id))) return false;
  Object.entries(bets).forEach(([id, amount]) => placeBet(r, key, id, amount, now));
  return true;
}
export const repeatBets = (r, key, now) => placeAll(r, key, r.players && r.players[key] && r.players[key].lastBets, now);
export const doubleBets = (r, key, now) => placeAll(r, key, r.players && r.players[key] && r.players[key].bets && { ...r.players[key].bets }, now);

// No more bets: the number is drawn and the wheel spins to it.
export function spin(r, now, number) {
  if (r.phase !== 'betting' || !anyBets(r)) return false;
  r.phase = 'spinning';
  r.result = { number, color: colorOf(number) };
  r.spinAt = now;
  r.bettingDeadline = null;
  note(r, 'No more bets.');
  return true;
}

// What one player's bets come to on the number.
export function winningsFor(bets, number) {
  return Object.entries(bets || {}).reduce((won, [id, amount]) => won + (covers(id, number) ? amount * (payoutFor(id) + 1) : 0), 0);
}
function settleOne(r, key) {
  const p = r.players[key];
  const bet = totalBet(p);
  if (!bet) { p.result = null; return; }
  const won = winningsFor(p.bets, r.result.number);
  p.chips += won;
  p.result = { bet, won, net: won - bet };
  p.lastBets = p.bets;
  p.bets = null;
  p.placed = null;
}
// A player leaving while the ball is still running has their bets settled
// there and then; the number was drawn when the wheel began to spin.
export function settlePlayer(r, key) {
  if (r.phase === 'spinning' && r.result && r.players && r.players[key]) settleOne(r, key);
}

export function settle(r, now) {
  if (r.phase !== 'spinning' || !r.result) return false;
  const { number, color } = r.result;
  live(r).forEach((k) => settleOne(r, k));
  // Down to nothing: the house tops them up there and then.
  live(r).forEach((k) => topUpIfBroke(r, r.players[k], totalBet(r.players[k])));
  r.history = [number].concat(r.history || []).slice(0, HISTORY);
  r.phase = 'results';
  r.resultsAt = now;
  note(r, `${number} ${color === 'green' ? 'zero' : color}.`);
  return true;
}

// Seats sat in for MAX_IDLE_SPINS windows without a bet are given up.
function countIdle(r, betters) {
  const removed = [];
  live(r).forEach((k) => {
    const p = r.players[k];
    p.idle = betters.has(k) ? 0 : (p.idle || 0) + 1;
    if (p.idle >= MAX_IDLE_SPINS) {
      removed.push(k);
      delete r.players[k];
    }
  });
  if (removed.length) r.playerOrder = live(r);
  return removed;
}

export function nextRound(r, now) {
  if (r.phase !== 'results') return [];
  const betters = new Set(live(r).filter((k) => r.players[k].result));
  const removed = countIdle(r, betters);
  live(r).forEach((k) => { r.players[k].result = null; });
  r.phase = 'betting';
  r.round = (r.round || 0) + 1;
  r.result = null;
  r.spinAt = null;
  r.resultsAt = null;
  r.bettingDeadline = live(r).length ? now + BETTING_MS : null;
  note(r, 'Place your bets.');
  return removed;
}

// One step of the table's clock, whoever's client takes it: opens a window
// when someone is seated, spins when it closes, settles when the ball has
// landed, opens the next. Returns true if anything changed.
export function tick(r, now, draw = drawNumber) {
  if (r.phase === 'betting') {
    if (!r.bettingDeadline) {
      if (!live(r).length) return false;
      r.bettingDeadline = now + BETTING_MS;
      return true;
    }
    if (now < r.bettingDeadline) return false;
    if (anyBets(r)) return spin(r, now, draw());
    countIdle(r, new Set());
    r.bettingDeadline = live(r).length ? now + BETTING_MS : null;
    return true;
  }
  if (r.phase === 'spinning') return now >= r.spinAt + SPIN_MS ? settle(r, now) : false;
  if (r.phase === 'results') return now >= r.resultsAt + RESULTS_MS ? (nextRound(r, now), true) : false;
  return false;
}
