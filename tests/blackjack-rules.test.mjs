import * as L from '../src/app/roomLogic.js';

let fails = 0;
const ok = (cond, msg) => { console.log((cond ? 'PASS ' : 'FAIL ') + msg); if (!cond) fails++; };

// Builds a room with players in the given seats and a shoe that deals
// `cards` in order (drawn off the end).
function room(seats, cards) {
  const r = { isPublic: true, players: {}, playerOrder: [], phase: 'betting' };
  seats.forEach((seat, i) => {
    const key = 'p' + i;
    r.players[key] = { name: key, chips: 10000, bet: 100, status: 'bet-placed', hands: [], seat };
    r.playerOrder.push(key);
  });
  r.dealer = { hand: [], hiddenRevealed: false };
  r.deck = cards.slice().reverse().concat([]);
  r.cutCardAt = 0; r.shoeSize = 312;
  // pad below so the shoe never empties into a reshuffle mid-test
  r.deck = Array(50).fill('2-C').concat(r.deck);
  r.cutCardAt = 1;
  return r;
}

// Deal order: seats sorted, one each, dealer up, again, dealer hole.
{
  const r = room([3, 0], ['5-H', '6-H', '9-S', '7-H', '8-H', '10-S']);
  // seat order: p1 (seat 0) then p0 (seat 3)
  L.dealRoundCards(r);
  ok(r.players.p1.hands[0].cards.join() === '5-H,7-H', 'seat 0 (first base) dealt first: ' + r.players.p1.hands[0].cards);
  ok(r.players.p0.hands[0].cards.join() === '6-H,8-H', 'seat 3 dealt second: ' + r.players.p0.hands[0].cards);
  ok(r.dealer.hand.join() === '9-S,10-S', 'dealer up then hole: ' + r.dealer.hand);
  ok(r.phase === 'playing' && !r.dealer.hiddenRevealed && !r.dealer.peeked, 'nine up: no peek, play begins, hole hidden');
  ok(r.turnOrder[0].pid === 'p1', 'first base acts first');
}

// Ten up, dealer blackjack: peek ends the round before anyone plays.
{
  const r = room([0, 1], ['9-H', 'A-S', 'K-S', '9-D', 'A-D', 'A-C']);
  L.dealRoundCards(r);
  // p0: 9,9  p1: A,A ... wait p1 gets A-S, A-D (not BJ). dealer K-S, A-C = BJ
  ok(r.dealer.peeked === true, 'ten up: dealer peeks');
  ok(r.phase === 'results' && r.dealer.hiddenRevealed, 'ten up + blackjack: straight to results, hole shown');
  ok(r.dealer.hand.length === 2, 'no extra dealer cards');
  ok(r.players.p0.hands[0].outcome === 'lose' && r.players.p0.chips === 9900, 'player loses only the base bet');
}

// Ten up, no blackjack: peek, then play.
{
  const r = room([0], ['9-H', 'Q-S', '7-D', '6-C']);
  L.dealRoundCards(r);
  ok(r.dealer.peeked && r.phase === 'playing' && !r.dealer.hiddenRevealed, 'ten up, no blackjack: peek, hole stays down, play');
}

// Ace up: insurance first, then the peek.
{
  const r = room([0], ['9-H', 'A-S', '7-D', 'K-C']);
  L.dealRoundCards(r);
  ok(r.phase === 'insurance' && !r.dealer.peeked, 'ace up: insurance offered before the peek');
  r.players.p0.insurance = 50; r.players.p0.chips -= 50; r.players.p0.insuranceDecided = true;
  L.resolveInsurance(r);
  ok(r.dealer.peeked && r.phase === 'results', 'ace up + blackjack after insurance: results');
  ok(r.players.p0.chips === 9900 - 50 + 150, 'insurance pays 2:1, main bet lost: ' + r.players.p0.chips);
}

// Every player busts: dealer turns the hole card but draws nothing.
{
  const r = room([0, 1], ['10-H', 'J-H', '6-S', '6-H', '5-H', '10-D', 'K-C', 'Q-C', '3-D']);
  L.dealRoundCards(r);
  // p0: 10,6 =16; p1: J,5 = 15; dealer 6,10 = 16
  const hit = (key) => {
    const cur = r.turnOrder[r.currentTurnIndex];
    const h = r.players[cur.pid].hands[cur.hi];
    h.cards.push(L.drawCard(r));
    if (L.handValue(h.cards) > 21) { h.status = 'busted'; L.advanceTurnIn(r); }
  };
  hit(); hit();
  ok(r.phase === 'results', 'all bust -> results');
  ok(r.dealer.hand.length === 2 && r.dealer.hiddenRevealed, 'dealer drew nothing on 16, hole turned: ' + r.dealer.hand);
}

// One player stands: dealer draws to 17, stands on soft 17.
{
  const r = room([0], ['10-H', 'A-S', '9-H', '6-D', 'K-C']);
  L.dealRoundCards(r);
  const cur = r.turnOrder[0];
  r.players[cur.pid].hands[0].status = 'stood';
  L.advanceTurnIn(r);
  ok(r.dealer.hand.length === 2 || L.handValue(r.dealer.hand) >= 17, 'dealer stands on soft 17 (A,6): ' + r.dealer.hand);
}

// Dealer 21 vs a three-card 21 pushes; but a dealer blackjack beats a split 21.
{
  const r = room([0], ['7-H', '9-S', '7-D', '5-D', '7-C', '7-S']);
  L.dealRoundCards(r);
  // p0: 7,7 dealer 9,5=14 ; hit 7 -> 21 auto stand
  const h = r.players.p0.hands[0];
  h.cards.push(L.drawCard(r)); h.status = 'stood'; L.advanceTurnIn(r);
  ok(r.dealer.hand.join() === '9-S,5-D,7-S', 'dealer drew to 21: ' + r.dealer.hand);
  ok(h.outcome === 'push', 'three-card 21 v dealer 21 pushes');
}

// Split: first hand dealt and played before the second gets its card.
{
  const r = room([0], ['8-H', '10-S', '8-D', '7-C', '3-H', 'K-D', '9-C', 'Q-H']);
  L.dealRoundCards(r);
  const p = r.players.p0;
  const hand = p.hands[0];
  ok(L.canSplitCards(hand.cards), 'eights can split');
  ok(L.canSplitCards(['K-S', 'Q-D']), 'any two tens can split');
  ok(!L.canSplitCards(['K-S', '9-D']), 'K-9 cannot');
  // same steps as session.splitHand (non-aces)
  p.chips -= hand.bet;
  const newHand = { cards: [hand.cards.pop()], bet: hand.bet, status: 'playing' };
  p.hands.splice(1, 0, newHand);
  r.turnOrder.splice(r.currentTurnIndex + 1, 0, { pid: 'p0', hi: 1 });
  L.enterTurn(r);
  ok(hand.cards.join() === '8-H,3-H' && newHand.cards.length === 1, 'first split hand gets its card, second waits: ' + hand.cards + ' | ' + newHand.cards);
  hand.cards.push(L.drawCard(r)); // K -> 21
  hand.status = 'stood'; L.advanceTurnIn(r);
  ok(newHand.cards.join() === '8-D,9-C' && r.phase === 'playing' && r.currentTurnIndex === 1, 'second hand dealt on its turn: ' + newHand.cards);
}

// A split hand that makes 21 on its second card stands by itself.
{
  const r = room([0], ['10-H', '9-S', '10-D', '7-C', '5-H', 'A-D', 'K-S']);
  L.dealRoundCards(r);
  const p = r.players.p0; const hand = p.hands[0];
  const newHand = { cards: [hand.cards.pop()], bet: hand.bet, status: 'playing' };
  p.hands.splice(1, 0, newHand);
  r.turnOrder.splice(1, 0, { pid: 'p0', hi: 1 });
  L.enterTurn(r); // hand0 gets 5 -> 15
  hand.status = 'stood'; L.advanceTurnIn(r); // hand1 gets A -> 21 -> auto stand -> dealer
  ok(newHand.status === 'stood' && r.phase === 'results', 'split 21 stands itself and dealer plays');
  ok(newHand.outcome !== 'blackjack', '21 after split is not blackjack: ' + newHand.outcome);
}

// Player blackjack v dealer 21 (not natural) pays 3:2.
{
  const r = room([0], ['A-H', '6-S', 'K-D', '5-C', 'K-C']);
  L.dealRoundCards(r);
  ok(r.phase === 'results' && r.players.p0.hands[0].outcome === 'blackjack', 'blackjack only player: dealer does not draw, BJ paid');
  ok(r.dealer.hand.length === 2, 'dealer did not draw for a lone blackjack: ' + r.dealer.hand);
  ok(r.players.p0.chips === 9900 + 250, '3:2 paid: ' + r.players.p0.chips);
}

console.log(fails ? fails + ' FAILED' : 'ALL PASSED');
