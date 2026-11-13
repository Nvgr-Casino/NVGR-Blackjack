import * as R from '../src/roulette/rules.js';

let fails = 0;
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// ---------- the wheel ----------
ok(R.WHEEL_ORDER.length === 37 && new Set(R.WHEEL_ORDER).size === 37, 'the wheel has every pocket once');
ok(R.REDS.size === 18 && R.colorOf(0) === 'green' && R.colorOf(32) === 'red' && R.colorOf(15) === 'black', 'colours');
// Next to each other on the wheel, red and black alternate.
ok(R.WHEEL_ORDER.slice(1).every((n, i, a) => i === 0 || R.colorOf(n) !== R.colorOf(a[i - 1])), 'reds and blacks alternate round the wheel');

// ---------- bets ----------
ok(same(R.numbersFor('n:0'), [0]) && same(R.numbersFor('n:36'), [36]) && !R.numbersFor('n:37') && !R.numbersFor('n:-1'), 'straight up');
ok(same(R.numbersFor('s:17-20'), [17, 20]) && same(R.numbersFor('s:17-18'), [17, 18]), 'splits along a row and across a street');
ok(!R.numbersFor('s:18-19') && !R.numbersFor('s:17-19') && !R.numbersFor('s:20-17'), 'no split over the top of a street, or between strangers');
ok(same(R.numbersFor('s:0-2'), [0, 2]) && !R.numbersFor('s:0-4'), 'the zero splits with the first street only');
ok(same(R.numbersFor('t:34'), [34, 35, 36]) && !R.numbersFor('t:35') && !R.numbersFor('t:37'), 'streets');
ok(same(R.numbersFor('c:1'), [1, 2, 4, 5]) && same(R.numbersFor('c:32'), [32, 33, 35, 36]) && !R.numbersFor('c:3') && !R.numbersFor('c:33'), 'corners');
ok(same(R.numbersFor('l:31'), [31, 32, 33, 34, 35, 36]) && !R.numbersFor('l:34'), 'six lines');
ok(R.numbersFor('d:2')[0] === 13 && R.numbersFor('d:2').length === 12 && same(R.numbersFor('col:3').slice(0, 3), [3, 6, 9]), 'dozens and columns');
ok(['red', 'black', 'even', 'odd', 'low', 'high'].every((id) => R.numbersFor(id).length === 18 && !R.numbersFor(id).includes(0)), 'the even chances have eighteen numbers and never the zero');
ok(!R.numbersFor('n:1.5') && !R.numbersFor('n:01') && !R.numbersFor('x:1') && !R.numbersFor('n') && !R.numbersFor(null), 'nonsense is no bet');
ok(R.payoutFor('n:5') === 35 && R.payoutFor('s:1-2') === 17 && R.payoutFor('t:1') === 11 && R.payoutFor('c:1') === 8 && R.payoutFor('l:1') === 5 && R.payoutFor('d:1') === 2 && R.payoutFor('col:1') === 2 && R.payoutFor('red') === 1, 'payouts');
ok(R.betLabel('c:16') === 'Corner 16/17/19/20' && R.betLabel('d:3') === '3rd dozen' && R.betLabel('low') === '1–18', 'labels');

// ---------- the draw ----------
{
  const seen = new Array(37).fill(0);
  for (let i = 0; i < 37000; i++) seen[R.drawNumber()]++;
  ok(seen.every((c) => c > 700 && c < 1300), 'every pocket comes up, about as often as the rest');
}

// ---------- a table ----------
const table = () => {
  const r = R.newRouletteRoom({ code: 'RLT1', minBet: 100, maxBet: 2000 });
  R.addPlayer(r, 'a', 'Ann', 1000, null);
  R.addPlayer(r, 'b', 'Bob', 5000, null);
  return r;
};
{
  const r = table();
  ok(r.players.a.seat === 0 && r.players.b.seat === 1, 'seated in turn');
  ok(R.tick(r, 0) && r.bettingDeadline === R.BETTING_MS, 'a seated table opens a window');
  ok(R.placeBet(r, 'a', 'n:17', 100, 10) && r.players.a.chips === 900, 'a bet comes off the chips');
  ok(!R.placeBet(r, 'a', 'n:17', 1000, 10), 'not more than you have');
  ok(!R.placeBet(r, 'b', 'red', 2001, 10) && R.placeBet(r, 'b', 'red', 1900, 10) && !R.placeBet(r, 'b', 'black', 200, 10), 'the table maximum is per spin');
  ok(!R.placeBet(r, 'a', 's:18-19', 100, 10), 'no bet on a split that is none');
  ok(R.placeBet(r, 'a', 'n:17', 100, 10) && r.players.a.bets['n:17'] === 200, 'chips on the same spot stack');
  ok(R.undoBet(r, 'a', 11) && r.players.a.bets['n:17'] === 100 && r.players.a.chips === 900, 'undo takes back the last chip');
  ok(!R.placeBet(r, 'a', 'n:5', 100, R.BETTING_MS), 'none once the window has closed');
  ok(!R.tick(r, R.BETTING_MS - 1), 'nothing before the window closes');
  ok(R.tick(r, R.BETTING_MS, () => 17) && r.phase === 'spinning' && r.result.number === 17, 'no more bets: the wheel spins to the number drawn');
  ok(!R.clearBets(r, 'a', R.BETTING_MS + 1), 'no clearing once spinning');
  ok(!R.tick(r, R.BETTING_MS + R.SPIN_MS - 1), 'the ball runs its course first');
  ok(R.tick(r, R.BETTING_MS + R.SPIN_MS) && r.phase === 'results', 'then the bets are settled');
  ok(r.players.a.chips === 900 + 3600 && same(r.players.a.result, { bet: 100, won: 3600, net: 3500 }), 'straight up pays 35 to 1, stake back');
  ok(r.players.b.chips === 3100 && r.players.b.result.net === -1900, '17 is black: the red bet loses');
  ok(same(r.history, [17]) && same(r.players.a.lastBets, { 'n:17': 100 }), 'remembered: the number, and the bets to repeat');
  const t = R.BETTING_MS + R.SPIN_MS + R.RESULTS_MS;
  ok(R.tick(r, t) && r.phase === 'betting' && r.round === 2 && r.bettingDeadline === t + R.BETTING_MS && !r.players.a.result, 'the next window opens');
  ok(R.repeatBets(r, 'a', t + 1) && r.players.a.bets['n:17'] === 100 && r.players.a.chips === 4400, 'repeat places last spin\'s bets again');
  ok(R.doubleBets(r, 'a', t + 2) && r.players.a.bets['n:17'] === 200 && r.players.a.chips === 4300, 'double doubles them');
  ok(R.clearBets(r, 'a', t + 3) && !r.players.a.bets && r.players.a.chips === 4500, 'clear gives them all back');
}
{
  // The zero.
  const r = table();
  R.placeBet(r, 'a', 'red', 100, 0);
  R.placeBet(r, 'a', 'n:0', 100, 0);
  R.placeBet(r, 'b', 'even', 500, 0);
  R.placeBet(r, 'b', 's:0-3', 100, 0);
  R.tick(r, R.BETTING_MS, () => 0);
  R.tick(r, R.BETTING_MS + R.SPIN_MS);
  ok(r.players.a.result.won === 3600 && r.players.b.result.won === 1800, 'zero: straight and split pay, the even chances lose');
  ok(R.winningsFor({ 'c:1': 100, 'd:1': 100, 'col:2': 100, low: 100 }, 5) === 900 + 300 + 300 + 200, 'every bet that covers the number pays at once');
}
{
  // Leaving with the ball still running: settled there and then.
  const r = table();
  R.placeBet(r, 'a', 'black', 200, 0);
  R.tick(r, R.BETTING_MS, () => 2);
  R.settlePlayer(r, 'a');
  ok(r.players.a.chips === 1200 && !r.players.a.bets, 'a leaver\'s bets are settled on the number already drawn');
  R.tick(r, R.BETTING_MS + R.SPIN_MS);
  ok(r.players.a.chips === 1200, 'and not paid twice');
}
{
  // Sitting without betting.
  const r = table();
  let now = 0;
  R.tick(r, now);
  for (let i = 0; i < R.MAX_IDLE_SPINS - 1; i++) { now += R.BETTING_MS; R.tick(r, now); }
  ok(r.players.a && r.players.a.idle === R.MAX_IDLE_SPINS - 1 && r.phase === 'betting', 'empty windows reopen, each counted against the seated');
  R.placeBet(r, 'b', 'odd', 100, now + 1);
  now += R.BETTING_MS;
  R.tick(r, now, () => 3);
  now += R.SPIN_MS; R.tick(r, now);
  now += R.RESULTS_MS; R.tick(r, now);
  ok(!r.players.a && r.players.b && r.players.b.idle === 0 && same(r.playerOrder, ['b']), 'a seat that never bets is given up; one that bets is kept');
  ok(R.addPlayer(r, 'c', 'Cy', 100, null) && r.players.c.seat === 0, 'the free chair goes to the next to sit');
  for (let i = 2; i < R.ROULETTE_SEATS; i++) R.addPlayer(r, 'p' + i, 'P', 100, null);
  ok(!R.addPlayer(r, 'late', 'Late', 100, null), 'six chairs, no more');
  ok(R.moveSeat(r, 'c', 0) && !R.moveSeat(r, 'c', 1), 'a move to a taken chair is refused');
}
{
  // A table nobody is at stays quiet.
  const r = R.newRouletteRoom({ code: 'X', minBet: 100, maxBet: 2000 });
  ok(!R.tick(r, 0) && r.bettingDeadline === null, 'an empty table runs no clock');
  ok(!R.spin(r, 0, 5), 'and never spins with nothing on it');
}

console.log(fails ? fails + ' FAILED' : 'ALL PASSED');
