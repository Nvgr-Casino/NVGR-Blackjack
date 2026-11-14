// Craps: the come-out, the point, the bets that stay up and the ones that
// don't, true odds, and the dice passing round. Run: node tests/craps-rules.test.mjs
import * as R from '../src/craps/rules.js';

let failed = 0;
const check = (name, ok) => { console.log((ok ? 'PASS ' : 'FAIL ') + name); if (!ok) failed++; };
const S = (bets, d1, d2, point = null) => R.settleBets(bets, { d1, d2, total: d1 + d2, hard: d1 === d2, point });

// The come-out.
check('7 on the come-out wins the pass line, which stays up', (() => { const s = S({ pass: 100 }, 3, 4); return s.back === 100 && s.keep.pass === 100; })());
check('11 on the come-out wins the pass line', S({ pass: 100 }, 5, 6).won === 100);
check('craps loses the pass line', (() => { const s = S({ pass: 100 }, 1, 2); return s.lost === 100 && !s.keep; })());
check("2 wins don't pass", S({ dontpass: 100 }, 1, 1).won === 100);
check("12 pushes don't pass", (() => { const s = S({ dontpass: 100 }, 6, 6); return s.won === 0 && s.lost === 0 && s.keep.dontpass === 100; })());
check('a point number leaves the line standing', (() => { const s = S({ pass: 100 }, 2, 4); return s.won === 0 && s.lost === 0 && s.keep.pass === 100; })());
check('place and hard bets are off on the come-out', (() => { const s = S({ place6: 60, hard8: 50 }, 3, 4); return s.lost === 0 && s.keep.place6 === 60 && s.keep.hard8 === 50; })());

// With a point.
check('making the point pays pass and true odds, odds come down', (() => { const s = S({ pass: 100, passodds: 200 }, 2, 2, 4); return s.won === 100 + 400 && s.back === 100 + 400 + 200 && s.keep.pass === 100 && !s.keep.passodds; })());
check('6:5 on the six', S({ passodds: 100 }, 1, 5, 6).won === 120);
check('3:2 on the nine', S({ passodds: 100 }, 4, 5, 9).won === 150);
check('seven out loses pass, odds, places and hardways', (() => { const s = S({ pass: 100, passodds: 100, place8: 60, hard10: 20 }, 3, 4, 5); return s.lost === 280 && !s.keep; })());
check("seven out wins don't pass and lay odds", (() => { const s = S({ dontpass: 100, dontodds: 120 }, 2, 5, 6); return s.won === 100 + 100 && s.keep.dontpass === 100 && !s.keep.dontodds; })());
check('place 6 pays 7:6 and stays up', (() => { const s = S({ place6: 60 }, 2, 4, 9); return s.won === 70 && s.back === 70 && s.keep.place6 === 60; })());
check('place 4 pays 9:5', S({ place4: 50 }, 1, 3, 8).won === 90);
check('hard 8 pays 9:1 when rolled as a pair', S({ hard8: 10 }, 4, 4, 5).won === 90);
check('hard 8 loses the easy way', S({ hard8: 10 }, 2, 6, 5).lost === 10);

// One-roll bets.
check('field pays double on 2, triple on 12', S({ field: 10 }, 1, 1).won === 20 && S({ field: 10 }, 6, 6).won === 30);
check('field loses on 7', S({ field: 10 }, 3, 4).lost === 10);
check('any seven 4:1', S({ any7: 10 }, 1, 6).won === 40);
check('eleven 15:1', S({ yo: 10 }, 5, 6).won === 150);
check('one-roll bets never stay', !S({ field: 10, any7: 10 }, 2, 3).keep);

// The table.
const r = R.newCrapsRoom({ code: 'T', minBet: 10, maxBet: 1000 });
R.addPlayer(r, 'a', 'A', 1000, null);
R.addPlayer(r, 'b', 'B', 1000, null);
check('the first to sit is the shooter', r.shooter === 'a');
let now = 1000;
check('line bets go down on the come-out', R.placeBet(r, 'a', 'pass', 100, now));
check('odds need a point', !R.placeBet(r, 'a', 'passodds', 100, now));
R.placeBet(r, 'b', 'dontpass', 100, now);
R.roll(r, now, 2, 4);
R.settle(r, now + R.ROLL_MS);
check('a 6 sets the point', r.point === 6);
R.nextRound(r, now + 10000);
now += 10000;
check('pass can\'t go down once there is a point', !R.placeBet(r, 'a', 'pass', 100, now));
check('odds up to 3x', R.placeBet(r, 'a', 'passodds', 300, now) && !R.placeBet(r, 'a', 'passodds', 10, now));
check('pass line can\'t be cleared with a point on', (() => { R.clearBets(r, 'a', now); return r.players.a.bets.pass === 100 && !r.players.a.bets.passodds; })());
R.roll(r, now, 3, 4);
R.settle(r, now + R.ROLL_MS);
check('seven out passes the dice', r.point === null && r.shooter === 'b');
check("don't pass was paid on the seven", r.players.b.chips === 1000 - 100 + 100 + 0 && r.players.b.bets.dontpass === 100);
check('the shooter leaving passes the dice on', (() => { R.removePlayer(r, 'b'); return r.shooter === 'a'; })());

console.log(failed ? `${failed} FAILED` : 'ALL PASSED');
process.exit(failed ? 1 : 0);
