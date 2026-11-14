// The salon's machines: their pay tables read right, and each one's
// long-run return where it should be. Run: node tests/slots-rules.test.mjs
import { GAME_LIST, CROWN_JEWELS as CJ, IMPERIAL_SEVENS as IS, HIGH_ROLLER as HR, JADE_PANDA as JP, seedPots } from '../src/slots/games.js';

let failed = 0;
const check = (name, ok) => { console.log((ok ? 'PASS ' : 'FAIL ') + name); if (!ok) failed++; };

GAME_LIST.forEach((g) => check(`${g.name}: reels built`, g.strips.length === g.counts.length && g.strips.every((s) => s.length >= 20 && s.every(Boolean))));

// Crown Jewels.
const L = (a) => CJ.linePay(a);
check('three crowns pay 25', L(['crown', 'crown', 'crown', 'K', 'Q']).pay === 25);
check('wild completes a line', L(['crown', 'wild', 'crown', 'crown', 'Q']).count === 4);
check('leading wilds take the better pay', L(['wild', 'wild', 'wild', 'J', 'Q']).symbol === 'wild');
check('wilds then a symbol count as that symbol when better', L(['wild', 'wild', 'crown', 'crown', 'crown']).pay === 500);
check('wild does not stand for a diamond', L(['diamond', 'wild', 'diamond', 'K', 'K']) === null);
check('two of a kind pays nothing', L(['A', 'A', 'K', 'K', 'K']) === null);
check('a win must start on the first reel', L(['K', 'A', 'A', 'A', 'A']) === null);
const find = (g, reel, sym) => g.strips[reel].findIndex((s, i, a) => a[(i + 1) % a.length] === sym);
const e = CJ.evaluate([0, 1, 2, 3, 4].map((reel) => find(CJ, reel, 'crown')), 100);
check('a middle row of crowns pays 5,000 on 100', e.wins.some((w) => w.line === 0 && w.symbol === 'crown' && w.count === 5 && w.amount === 5000));

// Imperial Sevens.
const S = (a) => IS.linePay(a);
check('three ruby sevens pay 200', S(['seven_r', 'seven_r', 'seven_r']).pay === 200);
check('one wild doubles', S(['seven_r', 'dwild', 'seven_r']).pay === 400);
check('two wilds make it four times', S(['dwild', 'seven_b', 'dwild']).pay === 400);
check('three wilds pay the top prize', S(['dwild', 'dwild', 'dwild']).pay === 1000);
check('mixed sevens pay any-seven', S(['seven_r', 'seven_g', 'seven_b']).pay === 30);
check('mixed bars pay any-bar', S(['bar1', 'bar3', 'bar2']).pay === 6);
check('one cherry pays 2, two pay 5', S(['cherry', 'blank', 'bar1']).pay === 2 && S(['cherry', 'cherry', 'bar1']).pay === 5);
check('a wild does not make a blank pay', S(['blank', 'dwild', 'blank']) === null);

// High Roller.
check('three aces pay 25', HR.linePay(['ace', 'ace', 'ace', 'pK', 'pQ']).pay === 25);
check('wild does not stand for the golden chip', HR.linePay(['goldchip', 'wild', 'goldchip', 'pK', 'pK']) === null);

// Jade Panda's Hold & Spin.
const fixed = (() => { const v = [0.5]; let i = 0; return () => v[i++ % v.length]; })();
const pots = seedPots(JP);
const full = JP.holdSpin(Array.from({ length: 15 }, (_, c) => [Math.floor(c / 3), c % 3]), 100, pots, () => 0.99);
check('a full board wins the Grand', full.grand && full.jackpots.includes('grand') && full.amount >= pots.grand * 100);
const none = JP.holdSpin([[0, 0], [1, 0], [2, 0], [3, 0], [4, 0], [0, 1]], 100, pots, () => 0.999);
check('no new pearls: three respins and it ends', none.steps.length === 3 && none.steps.every((s) => !s.landed.length));
void fixed;
check('six pearls trigger the feature', (() => {
  // Stops that put pearls at the top two rows of every reel.
  const stops = JP.strips.map((s) => s.findIndex((x, i, a) => x === 'pearl' && a[(i + 1) % a.length] === 'pearl'));
  return !!JP.evaluate(stops, 100).feature;
})());

// The returns, by simulation with a seeded generator.
GAME_LIST.forEach((g) => {
  // mulberry32: a generator good enough not to bias the result.
  let a = 12345;
  const rnd = () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const rand = (n) => Math.floor(rnd() * n);
  const p = seedPots(g);
  const N = 300000;
  let back = 0, hits = 0, top = 0, features = 0;
  for (let i = 0; i < N; i++) {
    const r = g.evaluate(g.drawStops(rand), 10);
    let w = r.total;
    if (r.feature) { features++; w += g.holdSpin(r.feature.cells, 10, p, rnd).amount; }
    back += w;
    if (w) hits++;
    top = Math.max(top, w / 10);
  }
  // A growing jackpot is paid back in the end too: what it grows by a spin.
  const grow = g.jackpots ? g.jackpots.major.grow + g.jackpots.grand.grow : 0;
  const rtp = back / (N * 10) + grow;
  console.log(`${g.name}: return ${(rtp * 100).toFixed(2)}%  hit rate ${(hits / N * 100).toFixed(1)}%  best ${top}x${g.feature ? `  feature 1 in ${Math.round(N / Math.max(1, features))}` : ''}`);
  check(`${g.name}: return between 93% and 98%`, rtp > 0.93 && rtp < 0.98);
  check(`${g.name}: a win on at least one spin in six`, hits / N > 0.16);
});

console.log(failed ? `${failed} FAILED` : 'ALL PASSED');
process.exit(failed ? 1 : 0);
