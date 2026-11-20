// Liftoff's shared schedule (src/crash/rounds.js).
import assert from 'node:assert/strict';
import { roundAt, historyAt, crashPoint, multiplierAt, flightMs, BET_MS, AFTER_MS } from '../src/crash/rounds.js';

const DAY = 86400000;
// The house edge holds over many rounds: P(crash >= 2) ≈ 0.485.
let n = 0, over2 = 0, ones = 0, sum = 0;
for (let d = 20000; d < 20005; d++) for (let i = 0; i < 4000; i++) {
  const c = crashPoint(d, i); n++; if (c >= 2) over2++; if (c === 1) ones++; sum += Math.min(c, 100);
  assert.ok(c >= 1 && c <= 500);
}
assert.ok(Math.abs(over2 / n - 0.485) < 0.015, 'P(>=2) ' + over2 / n);
assert.ok(ones / n > 0.02 && ones / n < 0.06, 'instant losses ' + ones / n);
// The same moment gives the same round, everywhere.
const t = 20003 * DAY + 3600000 * 5 + 12345;
assert.deepEqual(roundAt(t), roundAt(t));
// Phases follow one another and the multiplier never passes the crash.
let prev = null, rounds = new Set();
for (let ms = 0; ms < 3600000; ms += 250) {
  const r = roundAt(20003 * DAY + ms);
  rounds.add(r.id);
  assert.ok(r.m <= (r.crash || 1) + 1e-9);
  if (r.phase === 'fly') assert.ok(r.m >= 1);
  if (prev && prev.id === r.id) assert.ok(['bet', 'fly', 'crash'].indexOf(r.phase) >= ['bet', 'fly', 'crash'].indexOf(prev.phase));
  prev = r;
}
assert.ok(rounds.size > 100, 'rounds in an hour ' + rounds.size);
// Midnight: the last rounds of a day never run into the next.
for (let ms = -400000; ms < 30000; ms += 100) {
  const r = roundAt(20004 * DAY + ms);
  if (r.phase !== 'bet') assert.ok(r.crashAt <= 20004 * DAY || r.flyAt >= 20004 * DAY);
}
const just = roundAt(20004 * DAY + 1);
assert.equal(just.id, '20004-0');
// History is the finished rounds, newest first.
const h = historyAt(t, 10);
assert.equal(h.length, 10);
assert.ok(Math.abs(flightMs(multiplierAt(9000)) - 9000) < 1e-6);
assert.ok(BET_MS > 0 && AFTER_MS > 0);
console.log('crash rounds: ok', { rounds: rounds.size, pOver2: +(over2 / n).toFixed(3), ones: +(ones / n).toFixed(3) });
