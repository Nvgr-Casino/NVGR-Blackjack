import * as B from '../src/baccarat/rules.js';

let fails = 0;
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
// A shoe that deals exactly these cards, in order.
const from = (cards) => { const q = cards.slice(); return () => q.shift(); };
// Stages a shoe to deal `cards` in this order (it deals from the end), over
// enough tens beneath that the cut card is not reached.
const stage = (cards) => Array(20).fill('K-C').concat(cards.slice().reverse());

// ---------- counting ----------
ok(B.cardPoints('A-S') === 1 && B.cardPoints('9-H') === 9 && ['10-S', 'J-D', 'Q-C', 'K-H'].every((c) => B.cardPoints(c) === 0), 'aces one, tens and pictures nothing');
ok(B.handTotal(['7-S', '8-H']) === 5 && B.handTotal(['K-S', '9-H']) === 9 && B.handTotal(['5-S', '5-H']) === 0, 'a hand counts its last digit');
{
  const shoe = B.newShoe();
  ok(shoe.length === 416 && new Set(shoe).size === 52 && shoe.filter((c) => c === 'A-S').length === 8, 'eight decks in the shoe');
}

// ---------- the drawing rules ----------
{
  const h = B.dealCoup(from(['9-S', '2-H', 'K-D', '3-C', '5-S']));
  ok(h.natural && h.player.length === 2 && h.banker.length === 2 && h.winner === 'player', 'a natural nine stands both hands');
}
{
  const h = B.dealCoup(from(['6-S', '3-H', 'K-D', '3-C', '5-S']));
  ok(!h.natural && h.player.length === 2 && h.banker.length === 2 && h.winner === 'tie', 'player on six stands; so does the banker on six: a tie');
}
{
  // Player 0–5 draws; banker by the tableau against the third card.
  const h = B.dealCoup(from(['2-S', 'K-H', '3-D', '3-C', '8-S']));
  ok(h.player.length === 3 && h.banker.length === 2, 'banker on three stands against a player third card of 8');
  const h2 = B.dealCoup(from(['2-S', 'K-H', '3-D', '3-C', '7-S', '4-D']));
  ok(h2.player.length === 3 && h2.banker.length === 3 && h2.ptotal === 2 && h2.btotal === 7, 'banker on three draws against a 7');
}
{
  const tab = [
    [6, '6', true], [6, '7', true], [6, '5', false], [6, 'K', false],
    [5, '4', true], [5, '7', true], [5, '3', false], [5, '8', false],
    [4, '2', true], [4, '7', true], [4, 'A', false], [4, '8', false],
    [3, 'K', true], [3, '9', true], [3, '8', false],
    [2, '8', true], [0, '9', true], [7, '6', false],
  ];
  ok(tab.every(([bt, r, want]) => B.bankerDraws(bt, r + '-S') === want), 'the banker\'s tableau, total by total');
  ok(B.bankerDraws(5, null) && !B.bankerDraws(6, null), 'with the player standing, the banker draws on 0–5');
}

// ---------- payouts ----------
{
  const hand = { winner: 'banker', ppair: false, bpair: true };
  ok(B.winningsFor({ banker: 1000 }, hand) === 1950, 'banker pays 19 to 20');
  ok(B.winningsFor({ banker: 30 }, hand) === 58, 'the commission rounds against the player');
  ok(B.winningsFor({ player: 1000, bpair: 100 }, hand) === 1200, 'a banker pair pays 11 to 1; the player bet loses');
  const tie = { winner: 'tie', ppair: false, bpair: false };
  ok(B.winningsFor({ player: 500, banker: 500, tie: 100 }, tie) === 500 + 500 + 900, 'a tie: player and banker stand off, the tie pays 8 to 1');
  ok(B.winningsFor({ player: 200 }, { winner: 'player' }) === 400, 'player pays evens');
}

// ---------- a table ----------
{
  const r = B.newBaccaratRoom({ code: 'BAC1', minBet: 100, maxBet: 2000 });
  B.addPlayer(r, 'a', 'Ann', 1000, null);
  B.addPlayer(r, 'b', 'Bob', 5000, null);
  ok(r.players.a.seat === 3 && r.players.b.seat === 2 && r.shoe.length === 416, 'seated from the middle out, a full shoe');
  ok(B.tick(r, 0) && r.bettingDeadline === B.BETTING_MS, 'a seated table opens a window');
  ok(B.placeBet(r, 'a', 'player', 500, 1) && r.players.a.chips === 500, 'a bet comes off the chips');
  ok(!B.placeBet(r, 'a', 'player', 600, 2), 'not more than you have');
  ok(!B.placeBet(r, 'b', 'banker', 2100, 2) && B.placeBet(r, 'b', 'banker', 2000, 2) && !B.placeBet(r, 'b', 'tie', 100, 2), 'the table maximum is per coup');
  ok(!B.placeBet(r, 'a', 'dragon', 100, 3), 'no such bet');
  ok(B.undoBet(r, 'a', 4) && !r.players.a.bets.player && r.players.a.chips === 1000, 'undo');
  B.placeBet(r, 'a', 'player', 500, 5);
  r.shoe = stage(['3-S', 'K-H', '9-D', '4-S', '5-C']);   // P 3, B K, P 9, B 4, then the player's third
  ok(B.tick(r, B.BETTING_MS) && r.phase === 'dealing', 'the window closes: dealt');
  ok(r.hand.player.slice(0, 2).join() === '3-S,9-D' && r.hand.banker.slice(0, 2).join() === 'K-H,4-S', 'player and banker in turn from the shoe');
  ok(r.hand.player.length === 3 && r.hand.ptotal === 7 && r.hand.banker.length === 3 && r.hand.btotal === 4 && r.hand.winner === 'player', 'player on 2 draws a 5, to 7; banker on 4 against a 5 draws (a ten) and stays on 4');
  ok(r.hand.order.join('') === 'PBPBPB', 'the cards in the order they came out');
}
{
  // A clean coup to settle: player natural 9 against banker 7.
  const r = B.newBaccaratRoom({ code: 'BAC2', minBet: 100, maxBet: 5000 });
  B.addPlayer(r, 'a', 'Ann', 3000, null);
  B.placeBet(r, 'a', 'player', 1000, 0);
  B.placeBet(r, 'a', 'banker', 500, 0);
  B.placeBet(r, 'a', 'ppair', 100, 0);
  r.shoe = stage(['4-S', '3-H', '5-S', '4-H']);
  B.deal(r, 10);
  ok(r.hand.natural && r.hand.winner === 'player' && r.hand.ptotal === 9 && r.hand.btotal === 7, 'player natural 9 over banker 7');
  const end = 10 + B.dealDuration(r.hand);
  ok(!B.tick(r, end - 1) && B.tick(r, end) && r.phase === 'results', 'settled once every card is turned');
  ok(r.players.a.chips === 1400 + 2000 && r.players.a.result.net === 400, 'player won, banker and pair lost');
  ok(r.history.slice(-1)[0] === 'P', 'the scoreboard marks it');
  ok(B.tick(r, end + B.RESULTS_MS) && r.phase === 'betting' && !r.hand, 'the next window opens');
  ok(B.repeatBets(r, 'a', end + B.RESULTS_MS + 1) && B.totalBet(r.players.a) === 1600, 'repeat');
}
{
  // The cut card: a short shoe is replaced before the deal.
  const r = B.newBaccaratRoom({ code: 'BAC3', minBet: 100, maxBet: 5000 });
  B.addPlayer(r, 'a', 'Ann', 3000, null);
  B.placeBet(r, 'a', 'tie', 100, 0);
  r.shoe = r.shoe.slice(0, 10);
  B.deal(r, 1);
  ok(r.shoe.length >= 416 - 6 && r.shoeSize === 416, 'a fresh shoe when the cut card is out');
}
{
  // Leaving mid-coup settles there and then; idle seats are freed.
  const r = B.newBaccaratRoom({ code: 'BAC4', minBet: 100, maxBet: 5000 });
  B.addPlayer(r, 'a', 'Ann', 3000, null);
  B.addPlayer(r, 'b', 'Bob', 3000, null);
  B.placeBet(r, 'a', 'banker', 1000, 0);
  r.shoe = stage(['K-S', '8-S', 'Q-H', 'A-H']);
  B.deal(r, 1);
  B.settlePlayer(r, 'a');
  ok(r.players.a.chips === 2000 + 1950 && !r.players.a.bets, 'a leaver is settled on the dealt coup');
  let now = 1 + B.dealDuration(r.hand);
  B.tick(r, now);
  ok(r.players.a.chips === 3950, 'and not paid twice');
  for (let i = 0; i < B.MAX_IDLE; i++) { now += B.RESULTS_MS + B.BETTING_MS + 1; B.tick(r, now); B.tick(r, now + 1); }
  ok(!r.players.b, 'a seat that never bets is given up');
}

{
  const r = B.newBaccaratRoom({ code: 'BAC5', minBet: 100, maxBet: 5000 });
  B.addPlayer(r, 'a', 'Ann', 3000, null);
  B.addPlayer(r, 'b', 'Bob', 3000, null);
  ok(!B.moveSeat(r, 'a', r.players.b.seat) && B.moveSeat(r, 'a', 6) && r.players.a.seat === 6 && !B.moveSeat(r, 'a', 7), 'move to a free seat, not a taken or missing one');
}

console.log(fails ? fails + ' FAILED' : 'ALL PASSED');
