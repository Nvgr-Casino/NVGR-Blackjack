// The salon's machines: their pay tables read right, and each one's
// long-run return where it should be. Run: node tests/slots-rules.test.mjs
import { GAME_LIST, CROWN_JEWELS as CJ, IMPERIAL_SEVENS as IS, HIGH_ROLLER as HR } from '../src/slots/games.js';

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

// The returns, by simulation with a seeded generator.
GAME_LIST.forEach((g) => {
  let seed = 12345;
  const rand = (n) => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return Math.floor((seed / 2147483648) * n); };
  const N = 300000;
  let back = 0, hits = 0, top = 0;
  for (let i = 0; i < N; i++) {
    const r = g.evaluate(g.drawStops(rand), 10);
    back += r.total;
    if (r.total) hits++;
    top = Math.max(top, r.total / 10);
  }
  const rtp = back / (N * 10);
  console.log(`${g.name}: return ${(rtp * 100).toFixed(2)}%  hit rate ${(hits / N * 100).toFixed(1)}%  best ${top}x`);
  check(`${g.name}: return between 93% and 98%`, rtp > 0.93 && rtp < 0.98);
  check(`${g.name}: a win on at least one spin in six`, hits / N > 0.16);
});

console.log(failed ? `${failed} FAILED` : 'ALL PASSED');
process.exit(failed ? 1 : 0);
