// Bots playing each other through the real rules, hand after hand: no
// illegal move, no stuck hand, and not a chip created or lost.
import * as R from '../src/poker/rules.js';
import { decide, newPersonality, chenScore, equity } from '../src/poker/bot.js';
import { CARDS, shuffle } from '../src/poker/mentalPoker.js';

let fails = 0;
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };

ok(chenScore(['A-S', 'A-H']) === 20, 'Chen: aces 20');
ok(chenScore(['7-D', '2-C']) <= 0, 'Chen: seven-deuce offsuit is junk');
ok(chenScore(['K-H', 'Q-H']) >= 9, 'Chen: king-queen suited is strong');
const e = equity(['A-S', 'A-H'], [], 1, 2000);
ok(e > 0.8 && e < 0.88, 'aces win about 85% heads-up: ' + e.toFixed(3));

const room = { sb: 50, bb: 100, players: {}, log: [] };
const bots = {};
for (let i = 0; i < 6; i++) {
  room.players['b' + i] = { name: 'B' + i, seat: i, stack: 10000, status: 'active', waitBB: false, timeouts: 0, timeBank: 30 };
  bots['b' + i] = newPersonality();
}
const total = () => Object.values(room.players).reduce((s, p) => s + p.stack, 0) + (room.hand && room.hand.phase !== 'done' ? R.pot(room) : 0);
let hands = 0, showdowns = 0, illegal = 0, stuck = 0;
for (let n = 0; n < 300; n++) {
  Object.values(room.players).forEach((p) => { if (p.stack <= 0) { p.stack = 10000; p.status = 'active'; } });
  const before = Object.values(room.players).reduce((s, p) => s + p.stack, 0);
  if (!R.startHand(room, 'h' + n, 0)) { stuck++; break; }
  const deck = shuffle(CARDS);
  const hole = {};
  for (let pass = 0; pass < 2; pass++) room.hand.players.forEach((k) => { (hole[k] = hole[k] || []).push(deck.pop()); });
  R.onDealt(room, 0);
  let guard = 0;
  while (room.hand.phase !== 'done' && guard++ < 200) {
    const h = room.hand;
    if (h.phase === 'board') {
      const board = h.board.slice();
      deck.pop();
      while (board.length < h.boardTarget) board.push(deck.pop());
      R.onBoard(room, board, 0);
    } else if (h.phase === 'showdown') {
      h.showOrder.forEach((k) => R.onShown(room, k, hole[k], 0));
      showdowns++;
    } else if (h.phase === 'betting') {
      const k = h.toAct;
      const legal = R.legalActions(room, k);
      const live = h.players.filter((x) => !h.folded[x]);
      const [a, amt] = decide(legal, {
        cards: hole[k], board: h.board, pot: R.pot(room), toCall: legal.callAmount, currentBet: h.currentBet,
        bigBlind: room.bb, opponents: live.length - 1, street: h.street, position: h.players.indexOf(k) / (h.players.length - 1),
      }, bots[k]);
      if (!R.applyAction(room, k, a, amt, 0)) { illegal++; R.applyAction(room, k, legal.check ? 'check' : 'fold', 0, 0); }
    }
  }
  if (room.hand.phase !== 'done') { stuck++; break; }
  const after = Object.values(room.players).reduce((s, p) => s + p.stack, 0);
  if (after !== before) { ok(false, `hand ${n}: chips ${before} -> ${after}`); break; }
  R.clearHand(room, 1e15);
  hands++;
}
ok(hands === 300 && !stuck, `300 hands played to the end (${showdowns} showdowns)`);
ok(illegal === 0, 'no illegal bot moves: ' + illegal);
ok(total() === Object.values(room.players).reduce((s, p) => s + p.stack, 0), 'chips conserved every hand');
console.log(fails ? fails + ' FAILED' : 'ALL PASSED');
