import { bestHand } from '../src/poker/evaluator.js';
import * as R from '../src/poker/rules.js';

let fails = 0;
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const H = (s) => s.split(' ');
const name = (s) => bestHand(H(s)).name;
const beats = (a, b) => bestHand(H(a)).score > bestHand(H(b)).score;
const ties = (a, b) => bestHand(H(a)).score === bestHand(H(b)).score;

// ---------- evaluator ----------
ok(name('A-S K-S Q-S J-S 10-S 2-D 3-C') === 'Royal Flush', 'royal flush');
ok(name('9-H 8-H 7-H 6-H 5-H A-D A-C') === 'Straight Flush, Nine high', 'straight flush');
ok(name('5-D 4-D 3-D 2-D A-D K-C K-H') === 'Straight Flush, Five high', 'steel wheel');
ok(name('A-S A-H A-D A-C K-S 2-D 3-C') === 'Four of a Kind, Aces', 'quads');
ok(name('K-S K-H K-D 7-C 7-S 2-D 3-C') === 'Full House, Kings full of Sevens', 'full house');
ok(name('K-S K-H K-D 7-C 7-S 7-D 3-C') === 'Full House, Kings full of Sevens', 'two trips make a boat, higher trips');
ok(name('A-H 9-H 7-H 4-H 2-H K-S Q-D') === 'Flush, Ace high', 'flush');
ok(name('A-S 2-D 3-C 4-H 5-S K-D Q-C') === 'Straight, Five high', 'wheel straight');
ok(name('10-S J-D Q-C K-H A-S 2-D 3-C') === 'Straight, Ace high', 'broadway');
ok(name('7-S 7-D 7-C K-H 2-S 9-D 4-C') === 'Three of a Kind, Sevens', 'trips');
ok(name('K-S K-D 7-C 7-H 2-S 2-D 4-C') === 'Two Pair, Kings and Sevens', 'two pair from three pairs');
ok(name('Q-S Q-D 9-C 7-H 2-S 3-D 4-C') === 'Pair of Queens', 'pair');
ok(name('A-S J-D 9-C 7-H 2-S 3-D 4-C') === 'High Card, Ace', 'high card');
ok(beats('A-S A-D K-C 7-H 2-S 3-D 4-C', 'A-H A-C Q-C 7-D 2-H 3-H 4-S'), 'kicker decides pair of aces');
ok(ties('A-S K-D 10-C 10-H 9-S 9-D 2-C', 'A-H Q-D 10-S 10-D 9-H 9-C 2-S'), 'tens and nines, ace kicker each: split');
ok(beats('K-S 3-D 10-C 10-H 9-S 9-D 2-C', 'Q-H 3-H 10-S 10-D 9-H 9-C 2-S'), 'two pair, king kicker beats queen kicker');
ok(ties('2-S 3-D 10-C J-H Q-S K-D A-C', '4-S 5-D 10-C J-H Q-S K-D A-C'), 'board plays: both broadway, split');
ok(beats('6-S 7-D 2-C 3-H 4-S 5-D K-C', 'A-S 9-D 2-C 3-H 4-S 5-D K-C'), '7-high straight beats wheel');
ok(name('A-S K-S Q-S J-S 10-S 9-S') === 'Royal Flush', 'six cards');

// ---------- helpers ----------
function table(stacks, { sb = 50, bb = 100, button = undefined } = {}) {
  const room = { sb, bb, players: {}, log: [] };
  stacks.forEach((st, i) => {
    room.players['p' + i] = { name: 'P' + i, seat: i, stack: st, status: 'active', waitBB: false, timeouts: 0, timeBank: 30 };
  });
  if (button !== undefined) room.buttonSeat = button;
  return room;
}
const act = (room, a, amt) => {
  const who = room.hand.toAct;
  const res = R.applyAction(room, who, a, amt, 1000);
  if (!res) throw new Error(`illegal ${a} ${amt ?? ''} by ${who}`);
  return who;
};
const stackOf = (room, k) => room.players[k].stack;
const total = (room) => Object.values(room.players).reduce((s, p) => s + p.stack, 0) + (room.hand && room.hand.phase !== 'done' ? R.pot(room) : 0);

// ---------- 3-handed: blinds, order, folds ----------
{
  const r = table([10000, 10000, 10000], { button: 2 }); // button moves to seat 0
  R.startHand(r, 'h1', 0);
  ok(r.hand.button === 'p0' && r.hand.sb === 'p1' && r.hand.bb === 'p2', 'button 0, sb 1, bb 2');
  ok(r.hand.players.join() === 'p1,p2,p0', 'dealing order from the small blind');
  ok(stackOf(r, 'p1') === 9950 && stackOf(r, 'p2') === 9900, 'blinds posted');
  R.onDealt(r, 0);
  ok(r.hand.toAct === 'p0', 'preflop: under the gun (left of bb) acts first');
  act(r, 'call');
  act(r, 'call');            // sb completes
  ok(r.hand.toAct === 'p2', 'big blind has the option');
  act(r, 'check');
  ok(r.hand.phase === 'board' && r.hand.boardTarget === 3, 'to the flop');
  R.onBoard(r, H('2-S 7-D 9-C'), 0);
  ok(r.hand.toAct === 'p1', 'flop: first left of the button acts first');
  act(r, 'raise', 200);       // bet 200
  act(r, 'fold');
  act(r, 'fold');
  ok(r.hand.phase === 'done' && stackOf(r, 'p1') === 10200, 'uncontested: bettor wins 300 pot, bet returned');
  ok(total(r) === 30000, 'chips conserved');
  R.clearHand(r, 1e9);
  R.startHand(r, 'h2', 0);
  ok(r.hand.button === 'p1', 'button moves one seat left');
}

// ---------- heads-up order ----------
{
  const r = table([5000, 5000], { button: 1 }); // button -> p0
  R.startHand(r, 'h', 0);
  ok(r.hand.button === 'p0' && r.hand.sb === 'p0' && r.hand.bb === 'p1', 'heads-up: button is the small blind');
  R.onDealt(r, 0);
  ok(r.hand.toAct === 'p0', 'heads-up preflop: button acts first');
  act(r, 'call'); act(r, 'check');
  R.onBoard(r, H('2-S 7-D 9-C'), 0);
  ok(r.hand.toAct === 'p1', 'heads-up postflop: big blind acts first');
}

// ---------- min raise, reopening ----------
{
  const r = table([10000, 10000, 10000], { button: 2 });
  R.startHand(r, 'h', 0); R.onDealt(r, 0);
  ok(R.applyAction(r, 'p0', 'raise', 150, 0) === false, 'raise to 150 (less than min 200) refused');
  act(r, 'raise', 300);       // p0 raises to 300 (raise of 200)
  const l = R.legalActions(r, 'p1');
  ok(l.minTo === 500, 'next min raise is to 500');
  act(r, 'raise', 500);       // p1 to 500
  ok(R.legalActions(r, 'p2').minTo === 700, 'min raise to 700 after a 200 raise');
}

// ---------- short all-in does not reopen ----------
{
  const r = table([10000, 650, 10000], { button: 2 }); // p0 btn? button->p0, sb p1(650), bb p2
  R.startHand(r, 'h', 0); R.onDealt(r, 0);
  act(r, 'raise', 400);       // p0 to 400 (raise 300)
  act(r, 'allin');            // p1 all in 650 total: raise of 250 < 300 → short
  ok(r.hand.currentBet === 650, 'short all-in sets the bet to 650');
  act(r, 'call');             // p2 (bb) has not acted since full raise → may call or raise; calls
  ok(r.hand.toAct === 'p0', 'back to the original raiser');
  const l = R.legalActions(r, 'p0');
  ok(l.call && !l.raise, 'original raiser may only call or fold after a short all-in (TDA 49-A)');
}

// ---------- side pots ----------
{
  const r = table([1000, 3000, 5000], { button: 2 }); // btn p0 (1000), sb p1, bb p2
  R.startHand(r, 'h', 0); R.onDealt(r, 0);
  act(r, 'allin');            // p0 all in 1000
  act(r, 'allin');            // p1 all in 3000
  act(r, 'call');             // p2 calls 3000
  ok(r.hand.phase === 'board', 'all in: to the board');
  const pots = R.buildPots(r.hand);
  ok(pots.length === 2 && pots[0].amount === 3000 && pots[1].amount === 4000, 'main 3000, side 4000: ' + JSON.stringify(pots));
  ok(pots[0].eligible.length === 3 && pots[1].eligible.join() === 'p1,p2', 'eligibility');
  R.onBoard(r, H('2-S 7-D 9-C'), 0);
  ok(r.hand.phase === 'board' && r.hand.boardTarget === 4, 'runout: straight to the turn');
  R.onBoard(r, H('2-S 7-D 9-C J-H'), 0);
  R.onBoard(r, H('2-S 7-D 9-C J-H 3-D'), 0);
  ok(r.hand.phase === 'showdown' && r.hand.showOrder.length === 3, 'showdown, all three');
  // p0 best (aces), p1 second (kings), p2 worst
  R.onShown(r, 'p0', H('A-S A-D'), 0);
  R.onShown(r, 'p1', H('K-S K-D'), 0);
  R.onShown(r, 'p2', H('Q-S 4-H'), 0);
  ok(r.hand.phase === 'done', 'settled');
  ok(stackOf(r, 'p0') === 3000 && stackOf(r, 'p1') === 4000 && stackOf(r, 'p2') === 2000, 'main to aces, side to kings: ' + [stackOf(r, 'p0'), stackOf(r, 'p1'), stackOf(r, 'p2')]);
  ok(total(r) === 9000, 'chips conserved');
}

// ---------- split pot and odd chip ----------
{
  const r = table([1025, 1025, 1025], { button: 2, sb: 25, bb: 50 });
  R.startHand(r, 'h', 0); R.onDealt(r, 0);
  act(r, 'raise', 1025);     // p0 all in
  act(r, 'call');            // p1 all in
  act(r, 'fold');            // p2 folds bb 50
  R.onBoard(r, H('A-S K-D Q-C'), 0);
  R.onBoard(r, H('A-S K-D Q-C J-H'), 0);
  R.onBoard(r, H('A-S K-D Q-C J-H 10-S'), 0);
  R.onShown(r, 'p0', H('2-C 3-D'), 0);
  R.onShown(r, 'p1', H('4-C 5-D'), 0);
  // Pot 2100: split 1050 each — even. Make odd: check correct total.
  ok(stackOf(r, 'p0') + stackOf(r, 'p1') === 2100 && stackOf(r, 'p0') === 1050, 'board plays: split pot');
}
{
  const r = table([1000, 1000, 1001], { button: 2, sb: 1, bb: 1 });
  r.players.p2.stack = 1001;
  R.startHand(r, 'h', 0); R.onDealt(r, 0);
  // p0 button, p1 sb, p2 bb. Pot made odd: p0 all-in 1000, p1 call 1000, p2 folds (1 in) -> 2001.
  act(r, 'allin'); act(r, 'call'); act(r, 'fold');
  R.onBoard(r, H('A-S K-D Q-C'), 0); R.onBoard(r, H('A-S K-D Q-C J-H'), 0); R.onBoard(r, H('A-S K-D Q-C J-H 10-S'), 0);
  R.onShown(r, 'p0', H('2-C 3-D'), 0); R.onShown(r, 'p1', H('4-C 5-D'), 0);
  ok(stackOf(r, 'p1') === 1001 && stackOf(r, 'p0') === 1000, 'odd chip to the first winner left of the button (p1, the small blind): ' + [stackOf(r, 'p0'), stackOf(r, 'p1')]);
}

// ---------- uncalled bet returned on the river ----------
{
  const r = table([5000, 5000, 5000], { button: 2 });
  R.startHand(r, 'h', 0); R.onDealt(r, 0);
  act(r, 'call'); act(r, 'call'); act(r, 'check');
  R.onBoard(r, H('2-S 7-D 9-C'), 0); act(r, 'check'); act(r, 'check'); act(r, 'check');
  R.onBoard(r, H('2-S 7-D 9-C J-H'), 0); act(r, 'check'); act(r, 'check'); act(r, 'check');
  R.onBoard(r, H('2-S 7-D 9-C J-H 3-D'), 0);
  act(r, 'raise', 1000); act(r, 'call'); act(r, 'fold');
  ok(r.hand.phase === 'showdown' && r.hand.showOrder[0] === 'p1', 'river bettor shows first: ' + r.hand.showOrder);
}

// ---------- big blind all in for less ----------
{
  const r = table([5000, 5000, 60], { button: 2 }); // bb p2 has 60 < 100
  R.startHand(r, 'h', 0);
  ok(r.hand.allIn.p2 && r.hand.currentBet === 100, 'short big blind all in; full blind still to call');
  R.onDealt(r, 0);
  act(r, 'call'); act(r, 'call');
  ok(r.hand.phase === 'board', 'round closes with the short bb all in');
}

// ---------- timeouts and time bank ----------
{
  const r = table([5000, 5000, 5000], { button: 2 });
  R.startHand(r, 'h', 0); R.onDealt(r, 0);
  const k = r.hand.toAct;
  const d = r.hand.deadline;
  ok(R.processTimeout(r, d + 1) === 'timebank', 'time bank first');
  ok(R.processTimeout(r, r.hand.deadline + 1) === 'auto' && r.hand.folded[k], 'then folds facing a bet');
  ok(r.players[k].timeouts === 1, 'timeout counted');
}

// ---------- waiting for the big blind ----------
{
  const r = table([5000, 5000, 5000], { button: 0 });
  R.seatPlayer(r, 'p9', { name: 'New', seat: 4, buyIn: 4000 });
  ok(r.players.p9.waitBB === true, 'new player waits for the big blind');
  R.startHand(r, 'h', 0);
  ok(!r.hand.players.includes('p9') || r.hand.bb === 'p9', 'not dealt in unless in the big blind: bb=' + r.hand.bb + ' players=' + r.hand.players);
}

// ---------- leaving and voiding ----------
{
  const r = table([5000, 5000, 5000], { button: 2 });
  R.startHand(r, 'h', 0); R.onDealt(r, 0);
  R.leave(r, 'p1', 0);       // sb leaves while p0 to act
  ok(r.hand.folded.p1 && !r.players.p1 && r.cashout.p1 === 4950, 'leaver folded and cashed out at once, the blind left in the pot');
  act(r, 'fold');            // p0 folds -> p2 wins
  ok(r.hand.phase === 'done' && r.players.p2.stack === 5050, 'the hand plays on without them: p2 takes the blinds');
  R.clearHand(r, 1e9);
  const before = total(r);
  R.startHand(r, 'h3', 0);
  R.voidHand(r, 'Stalled.');
  ok(!r.hand && total(r) === before, 'void returns blinds');
}

ok(JSON.stringify(R.deckPositions(3)) === JSON.stringify({ hole: [[0, 3], [1, 4], [2, 5]], flop: [7, 8, 9], turn: [11], river: [13], board: [7, 8, 9, 11, 13], used: 14 }), 'deck positions');

console.log(fails ? fails + ' FAILED' : 'ALL PASSED');
