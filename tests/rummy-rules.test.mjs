// Rummy rules (src/rummy/rules.js).
import assert from 'node:assert/strict';
import * as R from '../src/rummy/rules.js';

const c = (s) => s.split(' ').map((x, i) => (x.includes('#') ? x : `${x}#${(i % 2) + 1}`));
const W = '9';   // the wild rank in these tests

assert.equal(R.meldKind(c('4-H 5-H 6-H'), W), 'pure');
assert.equal(R.meldKind(c('Q-S K-S A-S'), W), 'pure');
assert.equal(R.meldKind(c('A-S 2-S 3-S'), W), 'pure');
assert.equal(R.meldKind(c('K-S A-S 2-S'), W), null);              // no wrap
assert.equal(R.meldKind(c('8-H 9-H 10-H'), W), 'pure');           // wild in its own place is natural
assert.equal(R.meldKind(c('4-H 9-C 6-H'), W), 'seq');             // wild fills the gap
assert.equal(R.meldKind(c('4-H JK-X 6-H'), W), 'seq');
assert.equal(R.meldKind(c('7-H 7-S 7-D'), W), 'set');
assert.equal(R.meldKind(c('7-H 7-S JK-X 7-D'), W), 'set');
assert.equal(R.meldKind(['7-H#1', '7-H#2', '7-S#1'], W), null);   // same suit twice
assert.equal(R.meldKind(c('7-H 8-S 9-D'), W), 'set' === 'x' ? 0 : null);

// A winning hand is found and declared.
{
  const hand = c('4-H 5-H 6-H 10-S J-S Q-S 7-C 7-D 7-S 2-D 3-D 9-H A-C');
  // 2-D 3-D + wild 9-H make a sequence; A-C left over
  const a = R.analyze(hand, W);
  assert.equal(a.hasPure, true);
  assert.equal(a.points, 10);                                       // only the A-C
  const win = c('4-H 5-H 6-H 10-S J-S Q-S 7-C 7-D 7-S 2-D 3-D 9-H JK-X');
  const b = R.analyze(win, W);
  assert.ok(b.complete, 'complete');
  assert.ok(R.checkDeclare(R.arrange(win, W), W).ok);
}
// No pure sequence: every card counts (to 80).
{
  const hand = c('4-H JK-X 6-H 7-C 7-D 7-S 2-D 9-S K-C K-D Q-H 5-S 3-C');
  const a = R.analyze(hand, W);
  assert.equal(a.hasPure, false);
  assert.equal(a.points, Math.min(80, hand.reduce((s, x) => s + R.value(x, W), 0)));
}
// Points of a laid-out hand.
assert.equal(R.pointsFor([c('4-H 5-H 6-H'), c('10-S J-S Q-S'), c('K-C K-D')], W), 20);
assert.equal(R.pointsFor([c('4-H 5-H 6-H'), c('K-C K-D 2-S')], W), 37);  // one sequence only: every card counts
// Random hands: the search is fast and its layouts are real melds.
let seed = 3;
const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const t0 = Date.now();
let found = 0;
for (let g = 0; g < 300; g++) {
  const deck = R.shuffled(rand);
  const wild = R.RANKS[g % 13];
  const hand = deck.slice(0, 14);
  const a = R.analyze(hand, wild);
  a.melds.forEach((m) => assert.ok(R.meldKind(m.cards, wild), `meld ${m.cards} (${m.kind}) wild ${wild}`));
  const cards = a.melds.flatMap((m) => m.cards).concat(a.spare);
  assert.equal(cards.length, 14);
  assert.equal(new Set(cards).size, 14);
  if (a.complete) found++;
  R.bestDiscard(hand, wild);
}
const ms = (Date.now() - t0) / 300;
assert.ok(ms < 60, `analyze + discard per hand ${ms.toFixed(1)} ms`);
// A game between computer players ends with a valid declaration.
let games = 0, turns = 0;
for (let g = 0; g < 40; g++) {
  const deck = R.shuffled(rand);
  const wild = R.rankOf(deck.pop()) === R.JOKER ? 'A' : R.rankOf(deck[deck.length - 1]);
  const hands = [0, 1, 2].map(() => deck.splice(0, 13));
  const pile = [deck.pop()];
  let winner = -1;
  for (let t = 0; t < 600 && winner < 0; t++) {
    const p = t % 3;
    const top = pile[pile.length - 1];
    if (R.takesOpen(hands[p], top, wild)) hands[p].push(pile.pop());
    else { if (!deck.length) { deck.push(...pile.splice(0, pile.length - 1)); } hands[p].push(deck.pop()); }
    const d = R.bestDiscard(hands[p], wild);
    hands[p] = d.rest; pile.push(d.card);
    turns++;
    if (R.analyze(hands[p], wild).complete) { winner = p; assert.ok(R.checkDeclare(R.arrange(hands[p], wild), wild).ok); }
  }
  if (winner >= 0) games++;
}
assert.ok(games >= 30, `games finished ${games}/40`);
console.log('rummy rules: ok', { msPerHand: +ms.toFixed(1), finished: games, avgTurns: Math.round(turns / 40) });
