// Sit & Go tournaments played to the end by bots through the real rules:
// every place given once, the prizes to the right places, the blinds going
// up, no chip made or lost, and registering, forfeits and short fields.
import * as R from '../src/poker/rules.js';
import * as T from '../src/poker/tournament.js';
import { decide, newPersonality } from '../src/poker/bot.js';
import { CARDS, shuffle } from '../src/poker/mentalPoker.js';

let fails = 0;
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };

function newRoom(def) {
  return T.setupTournament({ code: 'TEST', game: 'holdem', players: {}, hand: null, buttonSeat: null, handCount: 0, log: [] }, def);
}

// Plays one hand to 'done'. `onBetting(room)` may interfere before each move.
function playHand(room, bots, n, onBetting) {
  T.beforeHand(room);
  if (!R.startHand(room, 'h' + n, 0)) return false;
  const deck = shuffle(CARDS);
  const hole = {};
  for (let pass = 0; pass < 2; pass++) room.hand.players.forEach((k) => { (hole[k] = hole[k] || []).push(deck.pop()); });
  R.onDealt(room, 0);
  let guard = 0;
  while (room.hand && room.hand.phase !== 'done' && guard++ < 300) {
    const h = room.hand;
    if (h.phase === 'board') {
      const board = h.board.slice();
      deck.pop();
      while (board.length < h.boardTarget) board.push(deck.pop());
      R.onBoard(room, board, 0);
    } else if (h.phase === 'showdown') {
      h.showOrder.forEach((k) => R.onShown(room, k, hole[k], 0));
    } else if (h.phase === 'betting') {
      if (onBetting && onBetting(room)) continue;
      const k = h.toAct;
      const legal = R.legalActions(room, k);
      const live = h.players.filter((x) => !h.folded[x]);
      const [a, amt] = decide(legal, {
        cards: hole[k], board: h.board, pot: R.pot(room), toCall: legal.callAmount, currentBet: h.currentBet,
        bigBlind: room.bb, opponents: live.length - 1, street: h.street, position: h.players.indexOf(k) / (h.players.length - 1),
      }, bots[k]);
      if (!R.applyAction(room, k, a, amt, 0)) R.applyAction(room, k, legal.check ? 'check' : 'fold', 0, 0);
    }
  }
  return room.hand && room.hand.phase === 'done';
}

const stacks = (room) => Object.values(room.players).reduce((s, p) => s + p.stack, 0);

// ----- full tournaments
const def = T.tournamentById('highroller');
ok(def && def.buyIn === 100000 && def.prizes[0] === 1000000, 'High Roller: 100K buy-in, 1M to the winner');
let longest = 0;
let maxLevel = 0;
for (let game = 0; game < 25; game++) {
  const room = newRoom(def);
  const bots = {};
  for (let i = 0; i < 6; i++) {
    T.register(room, 'p' + i, { name: 'P' + i, now: 0 });
    bots['p' + i] = newPersonality();
  }
  if (game === 0) {
    ok(!T.register(room, 'p6', { name: 'P6', now: 0 }), 'a seventh cannot register');
    ok(T.canStart(room, 0), 'a full table can start at once');
  }
  T.start(room, 0);
  let hands = 0;
  let broken = '';
  while (T.running(room) && hands < 2000) {
    if (!playHand(room, bots, hands)) { broken = 'hand ' + hands + ' did not finish'; break; }
    // Every chip is in someone's stack once the hand is paid.
    T.afterHand(room, 0);
    const total = stacks(room);
    if (T.running(room) && total !== 6 * T.START_STACK) { broken = `hand ${hands}: chips ${total}`; break; }
    if (!T.running(room) && total !== 6 * T.START_STACK) { broken = `last hand: chips ${total}`; break; }
    R.clearHand(room, 1e15);
    hands++;
  }
  longest = Math.max(longest, hands);
  maxLevel = Math.max(maxLevel, room.tournament.level);
  if (broken) { ok(false, `game ${game}: ${broken}`); break; }
  const places = Object.values(room.tournament.places).map((p) => p.place).sort((a, b) => a - b);
  if (places.join() !== '1,2,3,4,5,6') { ok(false, `game ${game}: places ${places}`); break; }
  const paid = Object.entries(room.prizes || {});
  const want = { 1: 1000000, 2: 250000, 3: 100000 };
  const right = paid.length === 3 && paid.every(([k, amt]) => want[room.tournament.places[k].place] === amt);
  if (!right) { ok(false, `game ${game}: prizes ${JSON.stringify(room.prizes)}`); break; }
  if (Object.keys(room.players).length !== 1) { ok(false, `game ${game}: ${Object.keys(room.players).length} left seated`); break; }
  if (game === 24) ok(true, `25 tournaments to the end, places 1–6 and prizes right (longest ${longest} hands, blinds to level ${maxLevel + 1})`);
}

// ----- registering and unregistering
{
  const room = newRoom(T.tournamentById('starter'));
  T.register(room, 'a', { name: 'A', now: 1000 });
  ok(!room.tournament.startsAt, 'one entrant: no start clock');
  T.register(room, 'b', { name: 'B', now: 2000 });
  ok(room.tournament.startsAt === 2000 + T.START_WAIT_MS, 'the second entrant starts the clock');
  ok(!T.canStart(room, 3000), 'not before the wait is over');
  ok(T.canStart(room, 2000 + T.START_WAIT_MS), 'two can start once it is');
  T.withdraw(room, 'b');
  ok(room.cashout.b === 10000 && !room.players.b, 'unregistering refunds the buy-in to the cashout');
  ok(!room.tournament.startsAt && !T.canStart(room, 1e12), 'back to one: no clock, no start');
  T.register(room, 'bot', { name: 'Bot', bot: true, now: 0 });
  T.withdraw(room, 'bot');
  ok(!room.cashout.bot, 'a bot has nothing refunded');
}

// ----- a short field: places and prizes in proportion
{
  const room = newRoom(T.tournamentById('highroller'));
  ['a', 'b', 'c'].forEach((k) => T.register(room, k, { name: k, now: 0 }));
  T.start(room, 0, { scale: true });
  ok(room.tournament.prizes.join() === '500000,125000', 'three entrants online: two paid, at half a full table\'s prizes: ' + room.tournament.prizes);
  const room2 = newRoom(T.tournamentById('highroller'));
  ['a', 'b'].forEach((k) => T.register(room2, k, { name: k, now: 0 }));
  T.start(room2, 0);
  ok(room2.tournament.prizes.join() === '1000000', 'two entrants offline-style: winner only, full prize');
}

// ----- a forfeit in the middle of a hand, and stacks never cashed out
{
  const room = newRoom(T.tournamentById('classic'));
  const bots = {};
  for (let i = 0; i < 4; i++) { T.register(room, 'p' + i, { name: 'P' + i, now: 0 }); bots['p' + i] = newPersonality(); }
  T.start(room, 0);
  let left = false;
  playHand(room, bots, 0, (r) => {
    if (left) return false;
    left = true;
    T.withdraw(r, r.hand.toAct, 0);
    return true;
  });
  const quitter = Object.entries(room.tournament.places).find(([, v]) => v.place === 4);
  ok(!!quitter, 'the player who left mid-hand finishes 4th of 4');
  ok(!room.cashout || !room.cashout[quitter[0]], 'and their tournament chips are not cashed out');
  T.afterHand(room, 0);
  R.clearHand(room, 1e15);
  ok(T.running(room) && Object.keys(room.players).length === 3, 'the other three play on');
  // Everyone else walks away between hands: the last one wins.
  T.withdraw(room, Object.keys(room.players)[0], 0);
  T.withdraw(room, Object.keys(room.players)[0], 0);
  ok(T.finished(room), 'two more leave: it is over');
  const winner = Object.entries(room.tournament.places).find(([, v]) => v.place === 1);
  ok(winner && room.prizes[winner[0]] === 500000, 'and the one left wins the 500K');
  ok(room.prizes[quitter[0]] === undefined, 'fourth of four is out of the money');
}

// ----- the away rule
{
  const room = newRoom(T.tournamentById('starter'));
  ['a', 'b', 'c'].forEach((k) => T.register(room, k, { name: k, now: 0 }));
  T.start(room, 0);
  room.players.c.status = 'sitout';
  room.players.c.sitOutAt = 1000;
  ok(T.forfeitAway(room, 1000 + T.AWAY_LIMIT_MS - 1).length === 0, 'away a little: still in');
  ok(T.forfeitAway(room, 1000 + T.AWAY_LIMIT_MS + 1).join() === 'c', 'away too long: forfeits');
  ok(room.tournament.places.c.place === 3, 'in third place');
}

// ----- blinds
{
  const room = newRoom(T.tournamentById('starter'));
  ['a', 'b'].forEach((k) => T.register(room, k, { name: k, now: 0 }));
  T.start(room, 0);
  for (let i = 0; i < T.HANDS_PER_LEVEL; i++) T.beforeHand(room);
  ok(room.bb === T.LEVELS[0][1] && T.handsToNextLevel(room) === 0, `${T.HANDS_PER_LEVEL} hands at the first level`);
  T.beforeHand(room);
  ok(room.sb === T.LEVELS[1][0] && room.bb === T.LEVELS[1][1], 'then the blinds go up');
}
ok(T.ordinal(1) === '1st' && T.ordinal(2) === '2nd' && T.ordinal(3) === '3rd' && T.ordinal(11) === '11th' && T.ordinal(22) === '22nd', 'ordinals');

console.log(fails ? fails + ' FAILED' : 'ALL PASSED');
