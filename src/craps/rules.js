// Craps: two dice, a shooter, and everyone at the table betting on the
// throw. The rules, and nothing of the screen or the database: a room is a
// plain object these functions change, run inside a transaction (see
// src/app/crapsSession.js), so every client agrees on the same table.
//
// A round goes betting → rolling → results. The table's state carries on
// between rounds, as craps does: the point, the shooter, and every bet that
// stays up until it is decided.
//
// The come-out roll: 7 or 11 wins the Pass Line, 2, 3 or 12 loses it, and
// any other number becomes the point. After that the shooter rolls until
// the point comes again (Pass wins) or a 7 does (seven-out: Pass loses and
// the dice move to the next player).
//
// Bets, by id:
//   pass, dontpass     the line, put down on a come-out roll          1 to 1
//   passodds, dontodds odds behind the line once there is a point     true odds
//   place4 … place10   that number before a 7 (off on a come-out)     9:5, 7:5, 7:6
//   hard4 … hard10     the number as a pair before a 7 or the easy way 7:1, 9:1
//   field              2,3,4,9,10,11,12 on the next roll              1:1, 2 pays 2:1, 12 pays 3:1
//   any7 anycraps yo aces acedeuce twelve   one-roll propositions     4, 7, 15, 30, 15, 30 to 1

import { topUpIfBroke } from '../app/roomLogic.js';
export const CRAPS_SEATS = 6;
export const BETTING_MS = 15000;
// The dice's flight, bounce off the back wall and settle (crapsDice.js).
export const ROLL_MS = 4200;
export const RESULTS_MS = 3800;
export const MAX_IDLE_ROUNDS = 6;
export const HISTORY = 20;
export const ODDS_MULTIPLE = 3;      // odds up to three times the line bet
export const LAY_MULTIPLE = 6;       // laying odds against: up to six times

export const POINTS = [4, 5, 6, 8, 9, 10];
export const PLACE = { 4: [9, 5], 5: [7, 5], 6: [7, 6], 8: [7, 6], 9: [7, 5], 10: [9, 5] };
export const HARD = { 4: 7, 6: 9, 8: 9, 10: 7 };
const ODDS = { 4: [2, 1], 10: [2, 1], 5: [3, 2], 9: [3, 2], 6: [6, 5], 8: [6, 5] };
const LAY = { 4: [1, 2], 10: [1, 2], 5: [2, 3], 9: [2, 3], 6: [5, 6], 8: [5, 6] };
const ONE_ROLL = {
  any7: { wins: [7], pays: 4 },
  anycraps: { wins: [2, 3, 12], pays: 7 },
  yo: { wins: [11], pays: 15 },
  aces: { wins: [2], pays: 30 },
  acedeuce: { wins: [3], pays: 15 },
  twelve: { wins: [12], pays: 30 },
};

export const BETS = ['pass', 'dontpass', 'passodds', 'dontodds', 'field',
  ...POINTS.map((n) => 'place' + n), ...Object.keys(HARD).map((n) => 'hard' + n), ...Object.keys(ONE_ROLL)];
export const isBet = (id) => BETS.includes(id);
// Bets that are settled by every roll, win or lose.
export const isOneRoll = (id) => id === 'field' || !!ONE_ROLL[id];

export function betLabel(id) {
  if (id === 'pass') return 'Pass Line';
  if (id === 'dontpass') return "Don't Pass";
  if (id === 'passodds') return 'Pass odds';
  if (id === 'dontodds') return "Don't Pass odds";
  if (id === 'field') return 'Field';
  if (id.startsWith('place')) return 'Place ' + id.slice(5);
  if (id.startsWith('hard')) return 'Hard ' + id.slice(4);
  return { any7: 'Any Seven', anycraps: 'Any Craps', yo: 'Eleven', aces: 'Aces (2)', acedeuce: 'Ace-Deuce (3)', twelve: 'Twelve' }[id] || id;
}
export function betPays(id, point) {
  if (id === 'pass' || id === 'dontpass') return '1 to 1';
  if (id === 'passodds') return point ? `${ODDS[point][0]} to ${ODDS[point][1]}` : 'true odds';
  if (id === 'dontodds') return point ? `${LAY[point][0]} to ${LAY[point][1]}` : 'true odds';
  if (id === 'field') return '1 to 1 · 2 pays 2 · 12 pays 3';
  if (id.startsWith('place')) { const [a, b] = PLACE[id.slice(5)]; return `${a} to ${b}`; }
  if (id.startsWith('hard')) return `${HARD[id.slice(4)]} to 1`;
  return `${ONE_ROLL[id].pays} to 1`;
}

// A fair die: rejection sampling over a byte.
export function drawDie() {
  const buf = new Uint8Array(1);
  for (;;) {
    globalThis.crypto.getRandomValues(buf);
    if (buf[0] < 252) return (buf[0] % 6) + 1;
  }
}

// ---------- the room ----------
export function newCrapsRoom({ code, minBet, maxBet, isPublic = true, adminId = null, dealerType = 'male' }) {
  return {
    code, game: 'craps', isPublic, adminId, minBet, maxBet, dealerType,
    players: {}, playerOrder: [],
    phase: 'betting', round: 1, point: null, shooter: null,
    bettingDeadline: null, rollAt: null, resultsAt: null,
    roll: null, history: [], chat: [], log: ['Table open. New shooter coming out.'],
  };
}

const live = (r) => (r.playerOrder || []).filter((k) => r.players && r.players[k]);
const note = (r, line) => { r.log = (r.log || []).concat(line).slice(-8); };
const bySeat = (r) => live(r).sort((a, b) => r.players[a].seat - r.players[b].seat);

// Seats fill from the middle of the players' side outward, the ends last.
export const SEAT_ORDER = [2, 3, 1, 4, 0, 5];
export function firstFreeSeat(r) {
  const taken = new Set(live(r).map((k) => r.players[k].seat));
  for (const i of SEAT_ORDER) if (!taken.has(i)) return i;
  return -1;
}
export function addPlayer(r, key, name, chips, character) {
  r.players = r.players || {};
  r.playerOrder = r.playerOrder || [];
  if (r.players[key]) { r.players[key].idle = 0; return true; }
  const seat = firstFreeSeat(r);
  if (seat < 0) return false;
  r.players[key] = { name, chips, character: character || null, seat, bets: null, placed: null, lastBets: null, idle: 0, result: null };
  r.playerOrder.push(key);
  if (!r.shooter || !r.players[r.shooter]) r.shooter = key;
  return true;
}
export function moveSeat(r, key, seat) {
  const p = r.players && r.players[key];
  if (!p || seat < 0 || seat >= CRAPS_SEATS) return false;
  if (live(r).some((k) => k !== key && r.players[k].seat === seat)) return false;
  p.seat = seat;
  return true;
}
// The dice go to the next player round the table from the shooter.
export function passDice(r) {
  const order = bySeat(r);
  if (!order.length) { r.shooter = null; return; }
  const i = order.indexOf(r.shooter);
  r.shooter = order[(i + 1) % order.length] || order[0];
}
export function removePlayer(r, key) {
  if (!r.players || !r.players[key]) return;
  const wasShooter = r.shooter === key;
  if (wasShooter) passDice(r);
  delete r.players[key];
  r.playerOrder = (r.playerOrder || []).filter((k) => k !== key);
  if (wasShooter && r.shooter === key) r.shooter = live(r)[0] || null;
  if (!live(r).length) { r.shooter = null; r.bettingDeadline = null; }
}

export const totalBet = (p) => Object.values((p && p.bets) || {}).reduce((a, b) => a + b, 0);
export const anyBets = (r) => live(r).some((k) => totalBet(r.players[k]) > 0);
export const bettingOpen = (r, now) => r.phase === 'betting' && (!r.bettingDeadline || now < r.bettingDeadline);

// Why a bet can't go down now, or '' if it can.
export function betRefusal(r, p, id, amount) {
  if (!isBet(id)) return 'No such bet';
  if (!(amount > 0)) return 'Choose a chip';
  if (amount > p.chips) return 'Not enough chips';
  const on = (p.bets && p.bets[id]) || 0;
  if (id === 'pass' || id === 'dontpass') {
    if (r.point) return 'Line bets go down on a come-out roll';
  } else if (id === 'passodds' || id === 'dontodds') {
    const line = id === 'passodds' ? 'pass' : 'dontpass';
    const base = (p.bets && p.bets[line]) || 0;
    if (!r.point) return 'Odds go behind the line once there is a point';
    if (!base) return id === 'passodds' ? 'Odds need a Pass Line bet' : "Odds need a Don't Pass bet";
    if (on + amount > base * (id === 'passodds' ? ODDS_MULTIPLE : LAY_MULTIPLE)) return `Odds up to ${id === 'passodds' ? ODDS_MULTIPLE : LAY_MULTIPLE}× your line bet`;
    return '';
  }
  if (on + amount > r.maxBet) return 'Over the table maximum';
  return '';
}

// A chip on the layout, taken from the player's chips at once.
export function placeBet(r, key, id, amount, now) {
  const p = r.players && r.players[key];
  amount = Math.floor(Number(amount));
  if (!p || !bettingOpen(r, now) || betRefusal(r, p, id, amount)) return false;
  p.bets = p.bets || {};
  p.bets[id] = (p.bets[id] || 0) + amount;
  p.placed = (p.placed || []).concat([[id, amount]]).slice(-60);
  p.chips -= amount;
  p.idle = 0;
  if (!r.bettingDeadline) r.bettingDeadline = now + BETTING_MS;
  return true;
}
// A Pass Line bet is a contract once there is a point: it can't come down.
const removable = (r, id) => !(r.point && id === 'pass');
export function undoBet(r, key, now) {
  const p = r.players && r.players[key];
  if (!p || !bettingOpen(r, now) || !p.placed || !p.placed.length) return false;
  const [id, amount] = p.placed[p.placed.length - 1];
  p.placed = p.placed.slice(0, -1);
  if (!removable(r, id) || !p.bets || !p.bets[id]) return false;
  const back = Math.min(amount, p.bets[id]);
  const left = p.bets[id] - back;
  if (left > 0) p.bets[id] = left; else delete p.bets[id];
  // Odds can't stand without their line bet.
  if (id === 'dontpass' && !p.bets.dontpass && p.bets.dontodds) { p.chips += p.bets.dontodds; delete p.bets.dontodds; }
  if (!Object.keys(p.bets).length) p.bets = null;
  p.chips += back;
  return true;
}
// Takes down everything that may come down.
export function clearBets(r, key, now) {
  const p = r.players && r.players[key];
  if (!p || !bettingOpen(r, now) || !p.bets) return false;
  Object.keys(p.bets).forEach((id) => {
    if (!removable(r, id)) return;
    p.chips += p.bets[id];
    delete p.bets[id];
  });
  if (!Object.keys(p.bets).length) p.bets = null;
  p.placed = null;
  return true;
}
// The same bets as last round, those that can go down now.
export function repeatBets(r, key, now) {
  const p = r.players && r.players[key];
  if (!p || !p.lastBets || !bettingOpen(r, now)) return false;
  let any = false;
  Object.entries(p.lastBets).forEach(([id, amount]) => {
    if (p.bets && p.bets[id]) return;
    if (placeBet(r, key, id, amount, now)) any = true;
  });
  return any;
}

// ---------- the throw ----------
/** The shooter throws (at the window's end, or when they choose). */
export function roll(r, now, d1, d2) {
  if (r.phase !== 'betting' || !anyBets(r)) return false;
  r.phase = 'rolling';
  r.roll = { d1, d2, total: d1 + d2, hard: d1 === d2, point: r.point, shooter: r.shooter };
  r.rollAt = now;
  r.bettingDeadline = null;
  note(r, 'Dice are out.');
  return true;
}
// The shooter may throw before the window runs out, once there's a bet down.
export function rollNow(r, key, now, d1, d2) {
  if (r.shooter !== key || r.phase !== 'betting' || !anyBets(r)) return false;
  return roll(r, now, d1, d2);
}

/**
 * What one player's bets come to on a roll: the chips handed back (stakes
 * and winnings), what was lost, and the bets still standing after it.
 */
export function settleBets(bets, rollInfo) {
  const { total: t, hard, point } = rollInfo;
  const keep = {};
  let back = 0, lost = 0, won = 0;
  const win = (stake, profit, stays) => { won += profit; back += profit + (stays ? 0 : stake); };
  Object.entries(bets || {}).forEach(([id, amount]) => {
    const stay = () => { keep[id] = (keep[id] || 0) + amount; };
    const lose = () => { lost += amount; };
    if (id === 'pass') {
      if (!point) {
        if (t === 7 || t === 11) { win(amount, amount, true); stay(); }
        else if (t === 2 || t === 3 || t === 12) lose();
        else stay();
      } else if (t === point) { win(amount, amount, true); stay(); }
      else if (t === 7) lose();
      else stay();
    } else if (id === 'dontpass') {
      if (!point) {
        if (t === 2 || t === 3) { win(amount, amount, true); stay(); }
        else if (t === 7 || t === 11) lose();
        else stay(); // 12 is a push: the bet stands
      } else if (t === 7) { win(amount, amount, true); stay(); }
      else if (t === point) lose();
      else stay();
    } else if (id === 'passodds') {
      if (!point) stay();
      else if (t === point) { const [a, b] = ODDS[point]; win(amount, Math.floor((amount * a) / b), false); }
      else if (t === 7) lose();
      else stay();
    } else if (id === 'dontodds') {
      if (!point) stay();
      else if (t === 7) { const [a, b] = LAY[point]; win(amount, Math.floor((amount * a) / b), false); }
      else if (t === point) lose();
      else stay();
    } else if (id.startsWith('place')) {
      const n = Number(id.slice(5));
      if (!point) stay(); // off on the come-out
      else if (t === n) { const [a, b] = PLACE[n]; win(amount, Math.floor((amount * a) / b), true); stay(); }
      else if (t === 7) lose();
      else stay();
    } else if (id.startsWith('hard')) {
      const n = Number(id.slice(4));
      if (!point) stay(); // off on the come-out
      else if (t === n && hard) { win(amount, amount * HARD[n], true); stay(); }
      else if (t === n || t === 7) lose();
      else stay();
    } else if (id === 'field') {
      if (t === 2) win(amount, amount * 2, false);
      else if (t === 12) win(amount, amount * 3, false);
      else if ([3, 4, 9, 10, 11].includes(t)) win(amount, amount, false);
      else lose();
    } else if (ONE_ROLL[id]) {
      if (ONE_ROLL[id].wins.includes(t)) win(amount, amount * ONE_ROLL[id].pays, false);
      else lose();
    }
  });
  return { back, lost, won, keep: Object.keys(keep).length ? keep : null };
}

function settleOne(r, key) {
  const p = r.players[key];
  if (!totalBet(p)) { p.result = null; return; }
  const before = { ...p.bets };
  const { back, lost, won, keep } = settleBets(p.bets, r.roll);
  p.chips += back;
  p.result = { won, lost, net: won - lost };
  p.lastBets = before;
  p.bets = keep;
  p.placed = null;
}
export function settlePlayer(r, key) {
  if (r.phase === 'rolling' && r.roll && r.players && r.players[key] && !r.players[key].settled) {
    settleOne(r, key);
    r.players[key].settled = true;
  }
}

// What the roll did to the game: the call, and the point and shooter after.
export function callFor(rollInfo) {
  const { total: t, point, hard } = rollInfo;
  if (!point) {
    if (t === 7 || t === 11) return { text: `${t}, winner on the come-out`, kind: 'natural' };
    if (t === 2 || t === 3 || t === 12) return { text: `${t}, craps`, kind: 'craps' };
    return { text: `The point is ${t}`, kind: 'point' };
  }
  if (t === point) return { text: `${t}, the point — winner!`, kind: 'made' };
  if (t === 7) return { text: 'Seven out', kind: 'sevenout' };
  return { text: `${t}${hard && HARD[t] ? ' the hard way' : ''}`, kind: 'roll' };
}

export function settle(r, now) {
  if (r.phase !== 'rolling' || !r.roll) return false;
  live(r).forEach((k) => {
    if (r.players[k].settled) { delete r.players[k].settled; return; }
    settleOne(r, k);
  });
  // Down to nothing, with nothing riding: the house tops them up now.
  live(r).forEach((k) => topUpIfBroke(r, r.players[k], totalBet(r.players[k])));
  const call = callFor(r.roll);
  r.roll.call = call.text;
  r.roll.kind = call.kind;
  if (call.kind === 'point') r.point = r.roll.total;
  else if (call.kind === 'made') r.point = null;
  else if (call.kind === 'sevenout') { r.point = null; passDice(r); }
  r.history = [r.roll.total].concat(r.history || []).slice(0, HISTORY);
  r.phase = 'results';
  r.resultsAt = now;
  note(r, call.text + '.');
  return true;
}

function countIdle(r) {
  const removed = [];
  live(r).forEach((k) => {
    const p = r.players[k];
    // Chips still on the layout count as playing.
    p.idle = totalBet(p) || p.result ? 0 : (p.idle || 0) + 1;
    if (p.idle >= MAX_IDLE_ROUNDS) { removed.push(k); removePlayer(r, k); }
  });
  return removed;
}

export function nextRound(r, now) {
  if (r.phase !== 'results') return [];
  const removed = countIdle(r);
  live(r).forEach((k) => { r.players[k].result = null; });
  r.phase = 'betting';
  r.round = (r.round || 0) + 1;
  r.rollAt = null;
  r.resultsAt = null;
  if (!r.shooter || !r.players[r.shooter]) r.shooter = bySeat(r)[0] || null;
  r.bettingDeadline = live(r).length ? now + BETTING_MS : null;
  note(r, r.point ? `Point is ${r.point}. Place your bets.` : 'Coming out. Place your bets.');
  return removed;
}

// One step of the table's clock, whoever's client takes it.
export function tick(r, now, die = drawDie) {
  if (r.phase === 'betting') {
    if (!r.bettingDeadline) {
      if (!live(r).length) return false;
      r.bettingDeadline = now + BETTING_MS;
      return true;
    }
    if (now < r.bettingDeadline) return false;
    if (anyBets(r)) return roll(r, now, die(), die());
    countIdle(r);
    r.bettingDeadline = live(r).length ? now + BETTING_MS : null;
    return true;
  }
  if (r.phase === 'rolling') return now >= r.rollAt + ROLL_MS ? settle(r, now) : false;
  if (r.phase === 'results') return now >= r.resultsAt + RESULTS_MS ? (nextRound(r, now), true) : false;
  return false;
}
