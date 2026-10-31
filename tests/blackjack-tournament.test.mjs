// Blackjack tournaments played to the end by bots through the real rules,
// in both formats — quick (5 hands) and elimination (9, the lowest stack
// out after hands 3, 5 and 7): every place given once, the prizes to the right
// places, ties shared, nobody topped up; registering, the minimum bet for
// the absent, and leaving in the middle of your own turn.
import * as L from '../src/app/roomLogic.js';
import * as T from '../src/blackjack/tournament.js';
import { botBet, botPlay } from '../src/blackjack/bot.js';

let fails = 0;
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };

function newRoom(def) {
  const r = { code: 'TEST', players: {}, playerOrder: [], dealer: { hand: [], hiddenRevealed: false }, deck: [], turnOrder: [], currentTurnIndex: 0, dealtIn: [], log: [] };
  L.shuffleShoe(r);
  return T.setupTournament(r, def);
}

const MOVES = { hit: L.applyHit, stand: L.applyStand, double: L.applyDouble, split: L.applySplit };

// Plays one hand from its betting to its results. `skip` bets nothing for
// those keys (as if they were away) and lets the clock bet for them.
function playHand(r, { skip = [], onTurn } = {}) {
  if (r.phase !== 'betting') return 'not betting';
  r.playerOrder.forEach((k) => { if (!skip.includes(k)) L.applyBet(r, k, botBet(r, k)); });
  if (r.phase === 'betting') {
    T.autoBets(r);
    if (r.phase === 'betting') { r.bettingDeadline = 1; L.processBettingTimeoutLogic(r); }
  }
  if (r.phase === 'insurance') r.playerOrder.slice().forEach((k) => L.applyInsurance(r, k, false));
  let guard = 0;
  while (r.phase === 'playing' && guard++ < 200) {
    const cur = r.turnOrder[r.currentTurnIndex];
    if (onTurn && onTurn(r, cur)) continue;
    const move = botPlay(r, cur.pid);
    if (!MOVES[move](r, cur.pid)) { if (!L.applyStand(r, cur.pid)) return 'stuck on ' + move; }
  }
  return r.phase === 'results' ? null : 'ended in ' + r.phase;
}

// ----- full tournaments, in both formats
function playOut(def, games) {
  let maxHands = 0, minHands = 99, early = 0, broken = '';
  for (let game = 0; game < games && !broken; game++) {
    const r = newRoom(def);
    for (let i = 0; i < 5; i++) T.register(r, 'p' + i, { name: 'P' + i, now: 0 });
    if (game === 0) {
      ok(!T.register(r, 'p5', { name: 'P5', now: 0 }), def.id + ': a sixth cannot register');
      ok(T.canStart(r, 0), def.id + ': a full table starts at once');
    }
    T.start(r, 0);
    let hands = 0;
    const leftAfter = {};
    while (T.running(r) && hands < 40) {
      const err = playHand(r);
      if (err) { broken = `${def.id} game ${game} hand ${hands}: ${err}`; break; }
      hands++;
      T.afterRound(r, 0);
      leftAfter[hands] = r.playerOrder.length;
    }
    if (broken) break;
    if (!T.finished(r)) { broken = `${def.id} game ${game}: not finished after ${hands}`; break; }
    if (hands > def.hands) { broken = `${def.id} game ${game}: ${hands} hands`; break; }
    if (hands < def.hands) early++;
    maxHands = Math.max(maxHands, hands);
    minHands = Math.min(minHands, hands);
    // Each elimination hand leaves at most one fewer than the hand before
    // it (more, if someone went broke too), never fewer than two.
    for (const cut of def.cuts) {
      if (leftAfter[cut] === undefined || cut >= hands) continue;
      const before = cut > 1 ? leftAfter[cut - 1] : 5;
      if (!(leftAfter[cut] < before || before <= 2)) { broken = `${def.id} game ${game}: nobody went out after hand ${cut} (${before} → ${leftAfter[cut]})`; break; }
    }
    if (broken) break;
    const places = Object.values(r.tournament.places);
    if (places.length !== 5) { broken = `${def.id} game ${game}: ${places.length} places`; break; }
    const paid = Object.values(r.prizes || {}).reduce((a, b) => a + b, 0);
    const total = def.prizes.reduce((a, b) => a + b, 0);
    const shared = places.some((x, i) => places.some((y, j) => i !== j && x.place === y.place));
    if (!shared && paid !== total) { broken = `${def.id} game ${game}: paid ${paid}`; break; }
    if (shared && Math.abs(paid - total) > 5) { broken = `${def.id} game ${game}: shared, paid ${paid}`; break; }
    // First had the most chips of those still in at the end.
    const first = places.filter((x) => x.place === 1);
    const second = places.filter((x) => x.place === 2);
    if (hands === def.hands && second.length && !first.every((f) => second.every((x) => f.chips >= x.chips))) { broken = `${def.id} game ${game}: first had fewer chips than second`; break; }
  }
  ok(!broken, broken || `${def.id}: ${games} tournaments to the end (${minHands}–${maxHands} hands; ${early} ended early), places and prizes right`);
}
const def = T.bjTournamentById('bj5-highroller');
ok(def && def.buyIn === 100000 && def.prizes[0] === 1000000 && def.hands === 5 && def.format === 'quick', 'Quick High Roller: 5 hands, 100K buy-in, 1M to the winner');
const elim = T.bjTournamentById('bj9-highroller');
ok(elim && elim.hands === 9 && elim.cuts.join() === '3,5,7' && elim.prizes[0] === 1000000, 'Elimination High Roller: 9 hands, cuts after 3, 5 and 7');
ok(T.BJ_TOURNAMENTS.length === 10, 'five buy-ins in each format');
playOut(def, 200);
playOut(elim, 200);

// ----- the cuts
{
  const r = newRoom(elim);
  ['a', 'b', 'c', 'd', 'e'].forEach((k) => T.register(r, k, { name: k, now: 0 }));
  T.start(r, 0);
  const stacks = { a: 12000, b: 9000, c: 7000, d: 10500, e: 8000 };
  r.round = 3;
  r.phase = 'results';
  Object.entries(stacks).forEach(([k, v]) => { r.players[k].chips = v; r.players[k].hands = []; });
  T.afterRound(r, 0);
  ok(!r.players.c && r.tournament.places.c.place === 5, 'after hand 3 the lowest stack goes, in 5th');
  ok(r.playerOrder.length === 4 && r.round === 4, 'four play hand 4');
  r.phase = 'results';
  T.afterRound(r, 0);
  ok(r.playerOrder.length === 4, 'no cut after hand 4');
  r.phase = 'results';
  r.players.d.chips = 50;
  T.afterRound(r, 0);
  ok(!r.players.d && r.tournament.places.d.place === 4 && !r.players.e && r.tournament.places.e.place === 3,
    'after hand 5: one broke (4th) and then the lowest (3rd)');
  ok(r.playerOrder.length === 2, 'two left');
  r.round = 7;
  r.phase = 'results';
  T.afterRound(r, 0);
  ok(r.playerOrder.length === 2 && T.running(r), 'the last two are never cut: they play hands 8 and 9');
  r.round = 9;
  r.phase = 'results';
  r.players.a.chips = 15000; r.players.b.chips = 18000;
  T.afterRound(r, 0);
  ok(T.finished(r) && r.tournament.places.b.place === 1 && r.tournament.places.a.place === 2, 'after hand 9 the bigger stack of the two wins');
}
{
  // Level at the bottom: the one who started the hand lower goes.
  const r = newRoom(elim);
  ['a', 'b', 'c'].forEach((k) => T.register(r, k, { name: k, now: 0 }));
  T.start(r, 0);
  r.round = 3;
  r.phase = 'results';
  r.players.a.chips = 9000; r.players.a.hands = [{ bet: 1000, outcome: 'win' }];   // started at 8000
  r.players.b.chips = 9000; r.players.b.hands = [{ bet: 1000, outcome: 'lose' }];  // started at 10000
  r.players.c.chips = 12000; r.players.c.hands = [];
  T.afterRound(r, 0);
  ok(!r.players.a && r.players.b, 'a tie for the lowest: the one who started the hand lower goes');
}

// ----- ties share
{
  const r = newRoom(def);
  ['a', 'b', 'c'].forEach((k) => T.register(r, k, { name: k, now: 0 }));
  T.start(r, 0);
  r.round = r.tournament.hands;
  r.phase = 'results';
  r.players.a.chips = 9000; r.players.b.chips = 9000; r.players.c.chips = 500;
  T.afterRound(r, 0);
  ok(r.tournament.places.a.place === 1 && r.tournament.places.b.place === 1, 'two stacks level after the last hand share first');
  ok(r.prizes.a === 625000 && r.prizes.b === 625000, 'and split the two paid places between them: ' + r.prizes.a);
  ok(r.tournament.places.c.place === 3 && !r.prizes.c, 'third of three is out of the money (two paid when three start)');
}

// ----- broke is out, and never topped up
{
  const r = newRoom(def);
  ['a', 'b', 'c'].forEach((k) => T.register(r, k, { name: k, now: 0 }));
  T.start(r, 0);
  r.phase = 'results';
  r.players.c.chips = 50;
  T.afterRound(r, 0);
  ok(!r.players.c && r.tournament.places.c.place === 3, 'under the minimum bet: out, in third');
  ok(r.phase === 'betting' && r.round === 2, 'the others play on to hand 2');
  r.players.b.chips = 0;
  L.startRoundLogic(r);
  ok(r.players.b.chips === 0, 'a tournament stack at zero is not re-staked');
}

// ----- registering
{
  const r = newRoom(T.bjTournamentById('bj5-starter'));
  T.register(r, 'a', { name: 'A', now: 1000 });
  ok(!r.tournament.startsAt, 'one entrant: no start clock');
  T.register(r, 'b', { name: 'B', now: 2000 });
  ok(r.tournament.startsAt === 2000 + T.START_WAIT_MS && !T.canStart(r, 3000) && T.canStart(r, 2000 + T.START_WAIT_MS), 'the second starts the clock; it starts when it runs out');
  ok(T.withdraw(r, 'b') === 'refund' && !r.players.b && !r.tournament.startsAt, 'unregistering: a refund, and back to no clock');
  ok(r.players.a.chips === T.START_STACK, 'registrants hold the starting stack: ' + r.players.a.chips);
}

// ----- a short field
{
  const r = newRoom(def);
  ['a', 'b', 'c'].forEach((k) => T.register(r, k, { name: k, now: 0 }));
  T.start(r, 0, { scale: true });
  ok(r.tournament.prizes.join() === '600000,150000', 'three online: two paid, at three-fifths of a full table\'s: ' + r.tournament.prizes);
}

// ----- the absent are bet the minimum
{
  const r = newRoom(def);
  ['a', 'b', 'c'].forEach((k) => T.register(r, k, { name: k, now: 0 }));
  T.start(r, 0);
  const err = playHand(r, { skip: ['c'] });
  ok(!err && r.players.c.hands.length === 1 && r.players.c.hands[0].bet <= T.MIN_BET * 2, 'a player who doesn\'t bet is dealt in for the minimum');
}

// ----- leaving on your own turn
{
  let left = false;
  let ended = false;
  for (let attempt = 0; attempt < 30 && !left; attempt++) {
    const r = newRoom(def);
    ['a', 'b', 'c'].forEach((k) => T.register(r, k, { name: k, now: 0 }));
    T.start(r, 0);
    const err = playHand(r, {
      onTurn: (rr, cur) => {
        if (left || cur.pid !== 'a') return false;
        left = true;
        return T.withdraw(rr, 'a', 0) === 'forfeit';
      },
    });
    if (left) {
      ended = !err;
      ok(r.tournament.places.a.place === 3 && !r.players.a, 'leaving mid-turn: off the table, in third of three');
      ok(ended, 'and the hand plays on without them to its end: ' + (err || 'results'));
      T.afterRound(r, 0);
      ok(T.running(r) && r.playerOrder.length === 2, 'the other two carry on');
    }
  }
  ok(left, 'found a hand where the leaver was to act');
}

// ----- the bot
{
  const r = newRoom(def);
  ['a', 'b'].forEach((k) => T.register(r, k, { name: k, now: 0 }));
  T.start(r, 0);
  r.round = r.tournament.hands;
  r.players.a.chips = 4000; r.players.b.chips = 9000;
  ok(botBet(r, 'a') === 4000, 'behind on the last hand: everything');
  r.players.a.chips = 30000;
  ok(botBet(r, 'a') === T.MIN_BET, 'far ahead on the last hand: the minimum');
  const play = (cards, dealer) => {
    r.phase = 'playing';
    r.dealer.hand = [dealer + '-S', '2-C'];
    r.players.a.hands = [{ cards, bet: 100, status: 'playing' }];
    r.turnOrder = [{ pid: 'a', hi: 0 }];
    r.currentTurnIndex = 0;
    return botPlay(r, 'a');
  };
  ok(play(['8-H', '8-D'], '10') === 'split', 'basic strategy: always split eights');
  ok(play(['10-H', 'K-D'], '6') === 'stand', 'never split tens');
  ok(play(['6-H', '5-D'], '6') === 'double', 'double eleven');
  ok(play(['10-H', '6-D'], '10') === 'hit', 'hit sixteen against a ten');
  ok(play(['10-H', '3-D'], '4') === 'stand', 'stand on thirteen against a four');
  ok(play(['A-H', '7-D'], '9') === 'hit', 'hit soft eighteen against a nine');
}

console.log(fails ? fails + ' FAILED' : 'ALL PASSED');
