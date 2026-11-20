// Liftoff's rounds: one schedule that every player computes for themselves
// and so sees the same — the same launch at the same moment, climbing to
// the same multiplier and lost at the same one.
//
// The day (UTC) is the unit. From each midnight the rounds follow one
// another without a gap: a betting window, the flight, a pause after it.
// Each round's crash point is drawn from a hash of the day and its number,
// so it is known to the schedule but to nobody watching the screen, and
// the history row is simply the day's rounds so far. Times are the
// server's (Firebase's offset), so every screen is on the same clock.
//
// The multiplier climbs as e^(K t): 2x after about 7.7 s, 10x after 25.6 s.
// Crash points have a 3% house edge: P(crash >= x) = 0.97 / x, with about
// one round in twenty-five lost at the start (1.00x). The highest is 500x.

export const K = 0.09;
export const BET_MS = 7000;      // the betting window before a launch
export const AFTER_MS = 3500;    // the pause after a crash, the result shown
export const MAX_CRASH = 500;
const DAY_MS = 86400000;

/** The multiplier `ms` into a flight. */
export const multiplierAt = (ms) => Math.exp((K * Math.max(0, ms)) / 1000);
/** How long a flight takes to reach `m`. */
export const flightMs = (m) => (Math.log(Math.max(1, m)) / K) * 1000;

// A well-mixed 32-bit hash (splitmix-style) of the day and round.
function hash32(a, b) {
  let h = (Math.imul(a ^ 0x9e3779b9, 0x85ebca6b) + Math.imul(b + 0x632be5ab, 0xc2b2ae35)) >>> 0;
  h ^= h >>> 16; h = Math.imul(h, 0x7feb352d) >>> 0;
  h ^= h >>> 15; h = Math.imul(h, 0x846ca68b) >>> 0;
  h ^= h >>> 16;
  return h >>> 0;
}
/** A number in [0, 1) for the day and round, and a stream of more after it. */
export function rand01(day, i, k = 0) { return hash32(day * 7919 + k, i) / 4294967296; }

/** Where round `i` of `day` crashes. */
export function crashPoint(day, i) {
  const r = rand01(day, i);
  const x = Math.floor((97 / (1 - r))) / 100;
  return Math.max(1, Math.min(MAX_CRASH, x));
}

// The day's rounds, laid out as far as they have been asked for.
const days = new Map();   // day -> { rounds: [{ i, betAt, flyAt, crash, crashAt, endAt }] }
function dayOf(day) {
  let d = days.get(day);
  if (!d) {
    d = { rounds: [] };
    days.set(day, d);
    if (days.size > 3) days.delete(days.keys().next().value);
  }
  return d;
}
function extend(day, until) {
  const d = dayOf(day);
  const start = day * DAY_MS;
  const end = start + DAY_MS;
  while (true) {
    const last = d.rounds[d.rounds.length - 1];
    if (last && (last.last || last.endAt > until)) return d;
    const betAt = last ? last.endAt : start;
    const i = d.rounds.length;
    const crash = crashPoint(day, i);
    const flyAt = betAt + BET_MS;
    const crashAt = flyAt + flightMs(crash);
    const endAt = crashAt + AFTER_MS;
    // A round that would run past midnight is not flown: the next is the
    // new day's first, and its betting window waits from here to then.
    if (endAt > end) { d.rounds.push({ i, betAt, flyAt: end + BET_MS, crash: null, crashAt: end, endAt: end, last: true }); return d; }
    d.rounds.push({ i, betAt, flyAt, crash, crashAt, endAt });
  }
}

/**
 * The round under way at server time `now`:
 * { id, day, i, phase: 'bet' | 'fly' | 'crash', betAt, flyAt, crash, crashAt, endAt, m, msLeft }
 */
export function roundAt(now) {
  const day = Math.floor(now / DAY_MS);
  const d = extend(day, now);
  // The rounds are in order: the one whose end is the first after now.
  let lo = 0, hi = d.rounds.length - 1;
  while (lo < hi) { const mid = (lo + hi) >> 1; if (d.rounds[mid].endAt > now) hi = mid; else lo = mid + 1; }
  let r = d.rounds[lo];
  let rday = day;
  if (r.last) {
    // The gap before midnight: the betting window for the new day's first.
    const next = extend(day + 1, (day + 1) * DAY_MS).rounds[0];
    r = { ...next, betAt: r.betAt };
    rday = day + 1;
  }
  const out = { id: `${rday}-${r.i}`, day: rday, i: r.i, betAt: r.betAt, flyAt: r.flyAt, crash: r.crash, crashAt: r.crashAt, endAt: r.endAt };
  if (now < r.flyAt) return { ...out, phase: 'bet', m: 1, msLeft: r.flyAt - now };
  if (now < r.crashAt) return { ...out, phase: 'fly', m: Math.min(r.crash, multiplierAt(now - r.flyAt)), msLeft: r.crashAt - now };
  return { ...out, phase: 'crash', m: r.crash, msLeft: r.endAt - now };
}

/** The crash points of the last `n` finished rounds before `now`, newest first. */
export function historyAt(now, n = 20) {
  const out = [];
  let day = Math.floor(now / DAY_MS);
  for (let guard = 0; guard < 2 && out.length < n; guard++, day--) {
    const d = extend(day, Math.min(now, (day + 1) * DAY_MS - 1));
    for (let k = d.rounds.length - 1; k >= 0 && out.length < n; k--) {
      const r = d.rounds[k];
      if (r.crash !== null && r.crashAt <= now) out.push(r.crash);
    }
  }
  return out;
}
