// Teen Patti rules (src/teenpatti/rules.js).
import assert from 'node:assert/strict';
import * as T from '../src/teenpatti/rules.js';

const ev = (s) => T.evaluate(s.split(' '));
const beats = (a, b) => assert.equal(T.compare(a.split(' '), b.split(' ')), 1, `${a} should beat ${b}`);

// The order of hands.
beats('2-S 2-H 2-D', 'A-S K-S Q-S');          // trail over pure sequence
beats('A-S A-H A-D', 'K-S K-H K-D');
beats('A-S K-S Q-S', 'A-H 2-H 3-H');          // A-K-Q pure sequence highest
beats('A-H 2-H 3-H', 'K-S Q-S J-S');          // A-2-3 second
beats('4-S 3-S 2-S', 'A-H K-D Q-C');          // pure sequence over sequence
beats('A-H K-D Q-C', 'A-D 2-C 3-H');
beats('A-D 2-C 3-H', 'K-H Q-D J-C');
beats('4-H 3-D 2-C', 'A-S K-S 9-S');          // sequence over colour
beats('5-S 3-S 2-S', 'A-H A-D K-C');          // colour over pair
beats('A-H A-D 2-C', 'K-H K-D A-C');          // pairs by the pair first
beats('K-H K-D A-C', 'K-S K-C Q-H');          // then the kicker
beats('2-H 2-D 3-C', 'A-H K-D J-C');          // pair over high card
beats('A-H K-D J-C', 'A-S K-C 10-H');
assert.equal(T.compare('A-H K-D J-C'.split(' '), 'A-S K-C J-D'.split(' ')), 0);
assert.equal(ev('Q-H Q-D Q-C').name, 'Trail of Queens');
assert.equal(ev('A-H 2-H 3-H').name, 'Pure sequence A-2-3');
assert.ok(T.strength('A-S A-H A-D'.split(' ')) > 0.999);
assert.ok(T.strength('2-S 3-H 5-D'.split(' ')) < 0.01);

// A hand played through: chips are never made or lost.
function table(n = 4, stack = 20000) {
  const room = { boot: 100, players: {}, dealerSeat: null };
  for (let i = 0; i < n; i++) room.players['p' + i] = { name: 'P' + i, seat: i, stack };
  return room;
}
const total = (room) => Object.values(room.players).reduce((a, p) => a + p.stack, 0) + (room.hand && room.hand.phase !== 'done' ? room.hand.pot : 0);
let seed = 1;
const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
for (let g = 0; g < 400; g++) {
  const room = table(2 + (g % 5), g % 7 === 0 ? 900 : 20000);
  const before = total(room);
  const bots = Object.fromEntries(Object.keys(room.players).map((k) => [k, T.newPersonality(rand)]));
  for (let hand = 0; hand < 6; hand++) {
    if (!T.startHand(room, rand, hand)) break;
    let guard = 0;
    while (room.hand.phase === 'betting' && guard++ < 500) {
      const h = room.hand;
      if (h.sideShow) { T.answerSideShow(room, T.decideSideShow(room, h.sideShow.to, rand)); continue; }
      const k = h.toAct;
      const move = T.decide(room, k, bots[k], rand);
      assert.ok(move, 'a move for ' + k);
      assert.ok(T.act(room, k, move), `${move} allowed for ${k}`);
    }
    assert.equal(room.hand.phase, 'done', 'hand finished');
    assert.equal(total(room), before, 'chips conserved');
    Object.values(room.players).forEach((p) => assert.ok(p.stack >= 0));
  }
}
// Show: equal hands, the one who asked loses.
{
  const room = table(2);
  T.startHand(room, rand, 1);
  const [a, b] = room.hand.players;
  room.hand.cards[a] = 'A-H K-D J-C'.split(' ');
  room.hand.cards[b] = 'A-S K-C J-D'.split(' ');
  assert.ok(T.act(room, a, 'show'));
  assert.deepEqual(room.hand.results[0].winners, [b]);
}
console.log('teen patti rules: ok');
