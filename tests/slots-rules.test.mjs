// Crown Jewels: the pay table read right, and the long-run return where it
// should be. Run: node tests/slots-rules.test.mjs
import * as R from '../src/slots/rules.js';

let failed = 0;
const check = (name, ok) => { console.log((ok ? 'PASS ' : 'FAIL ') + name); if (!ok) failed++; };

check('five reels of the right length', R.STRIPS.length === 5 && R.STRIPS.every((s) => s.length >= 30 && s.every(Boolean)));
check('no symbol next to itself more than rarely', R.STRIPS.every((s) => s.filter((x, i) => x === s[(i + 1) % s.length]).length <= 2));

const L = (a) => R.linePay(a);
check('three crowns pay 25', L(['crown', 'crown', 'crown', 'K', 'Q']).pay === 25);
check('wild completes a line', L(['crown', 'wild', 'crown', 'crown', 'Q']).count === 4);
check('leading wilds take the better pay', L(['wild', 'wild', 'wild', 'J', 'Q']).symbol === 'wild');
check('wilds then a symbol count as that symbol when better', L(['wild', 'wild', 'crown', 'crown', 'crown']).pay === 500);
check('wild does not stand for a diamond', L(['diamond', 'wild', 'diamond', 'K', 'K']) === null);
check('two of a kind pays nothing', L(['A', 'A', 'K', 'K', 'K']) === null);
check('a win must start on the first reel', L(['K', 'A', 'A', 'A', 'A']) === null);

// A spin evaluated in full.
const find = (reel, sym) => R.STRIPS[reel].findIndex((s, i, a) => a[(i + 1) % a.length] === sym);
const stops = [0, 1, 2, 3, 4].map((reel) => find(reel, 'crown'));
const e = R.evaluate(stops, 100);
check('a middle row of crowns pays 5,000 on 100', e.wins.some((w) => w.line === 0 && w.symbol === 'crown' && w.count === 5 && w.amount === 5000));

// The return, by simulation with a seeded generator.
let seed = 12345;
const rand = (n) => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed % n; };
const N = 400000;
let back = 0, hits = 0, top = 0;
for (let i = 0; i < N; i++) {
  const r = R.evaluate(R.drawStops(rand), 10);
  back += r.total;
  if (r.total) hits++;
  top = Math.max(top, r.total / 10);
}
const rtp = back / (N * 10);
console.log(`return ${(rtp * 100).toFixed(2)}%  hit rate ${(hits / N * 100).toFixed(1)}%  best ${top}x`);
check('return between 93% and 98%', rtp > 0.93 && rtp < 0.98);
check('a win on at least one spin in four', hits / N > 0.25);

console.log(failed ? `${failed} FAILED` : 'ALL PASSED');
process.exit(failed ? 1 : 0);
