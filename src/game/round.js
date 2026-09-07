import { newDeck, handValue, isBlackjack } from './logic.js';

// A local, single-player-vs-dealer round — the same rules as index4.html's
// dealRoundCards/hit/stand/doubleDown/splitHand/resolveDealerAndPayouts, but
// operating on a plain local object instead of a Firebase room transaction.
// Real multiplayer sync (step 4) can later drive this same rule set from
// room data instead; the rules themselves shouldn't need to change.
const DEALER_STAND_ON = 17;

// Every draw goes through here — not just the deal-start check that used to
// exist. A single round (several hits, a split, the dealer's own draw loop)
// can easily consume more than the ~15-card buffer that check guarded
// against; once the deck ran dry, deck.pop() returned undefined, and pushing
// that into a hand made handValue() throw on the next card's .rank read.
// That silently killed whatever draw loop was mid-flight — which is exactly
// what made the dealer look like it "stopped" early at an arbitrary total
// instead of actually honoring stand-on-17.
function drawCard(round) {
  if (round.deck.length === 0) round.deck = newDeck();
  return round.deck.pop();
}

export function createRound(startingChips) {
  return {
    deck: [],
    chips: startingChips,
    bet: 0,
    hands: [], // [{ cards, bet, status: 'playing'|'stood'|'busted'|'blackjack', outcome? }]
    activeHand: 0,
    dealer: { cards: [] },
    phase: 'betting', // betting -> playing -> dealer -> results
  };
}

export function placeBet(round, amount) {
  if (round.phase !== 'betting') return false;
  if (!amount || amount <= 0 || amount > round.chips) return false;
  round.bet = amount;
  return true;
}

export function dealInitial(round) {
  if (round.phase !== 'betting' || round.bet <= 0) return;
  if (round.deck.length < 15) round.deck = newDeck();

  round.chips -= round.bet;
  const cards = [drawCard(round), drawCard(round)];
  round.dealer.cards = [drawCard(round), drawCard(round)];
  round.hands = [{ cards, bet: round.bet, status: isBlackjack(cards) ? 'blackjack' : 'playing' }];
  round.activeHand = 0;

  if (round.hands[0].status === 'blackjack') {
    round.phase = 'dealer';
    resolveDealer(round);
  } else {
    round.phase = 'playing';
  }
}

function currentHand(round) {
  return round.hands[round.activeHand];
}

export function hit(round) {
  const hand = currentHand(round);
  if (round.phase !== 'playing' || !hand || hand.status !== 'playing') return;
  hand.cards.push(drawCard(round));
  if (handValue(hand.cards) > 21) {
    hand.status = 'busted';
    advanceHand(round);
  }
}

export function stand(round) {
  const hand = currentHand(round);
  if (round.phase !== 'playing' || !hand || hand.status !== 'playing') return;
  hand.status = 'stood';
  advanceHand(round);
}

export function canDouble(round) {
  const hand = currentHand(round);
  return !!hand && hand.status === 'playing' && hand.cards.length === 2 && round.chips >= hand.bet;
}

export function doubleDown(round) {
  const hand = currentHand(round);
  if (round.phase !== 'playing' || !canDouble(round)) return false;
  round.chips -= hand.bet;
  hand.bet *= 2;
  hand.cards.push(drawCard(round));
  hand.status = handValue(hand.cards) > 21 ? 'busted' : 'stood';
  advanceHand(round);
  return true;
}

export function canSplit(round) {
  const hand = currentHand(round);
  return (
    !!hand &&
    hand.status === 'playing' &&
    hand.cards.length === 2 &&
    round.hands.length === 1 &&
    hand.cards[0].rank === hand.cards[1].rank &&
    round.chips >= hand.bet
  );
}

export function split(round) {
  if (round.phase !== 'playing' || !canSplit(round)) return false;
  const hand = currentHand(round);
  round.chips -= hand.bet;
  const movedCard = hand.cards.pop();
  const newHand = { cards: [movedCard, drawCard(round)], bet: hand.bet, status: 'playing' };
  hand.cards.push(drawCard(round));
  round.hands.splice(round.activeHand + 1, 0, newHand);
  return true;
}

function advanceHand(round) {
  round.activeHand++;
  if (round.activeHand >= round.hands.length) {
    round.phase = 'dealer';
    resolveDealer(round);
  }
}

function resolveDealer(round) {
  const anyLive = round.hands.some((h) => h.status !== 'busted');
  if (anyLive) {
    while (handValue(round.dealer.cards) < DEALER_STAND_ON) {
      round.dealer.cards.push(drawCard(round));
    }
  }
  const dealerValue = handValue(round.dealer.cards);
  const dealerBlackjack = isBlackjack(round.dealer.cards);
  const dealerBust = dealerValue > 21;

  round.hands.forEach((hand) => {
    const playerValue = handValue(hand.cards);
    if (hand.status === 'busted') {
      hand.outcome = 'lose';
    } else if (hand.status === 'blackjack') {
      if (dealerBlackjack) {
        round.chips += hand.bet;
        hand.outcome = 'push';
      } else {
        const win = Math.floor(hand.bet * 1.5);
        round.chips += hand.bet + win;
        hand.outcome = 'blackjack';
      }
    } else if (dealerBust || playerValue > dealerValue) {
      round.chips += hand.bet * 2;
      hand.outcome = 'win';
    } else if (playerValue === dealerValue) {
      round.chips += hand.bet;
      hand.outcome = 'push';
    } else {
      hand.outcome = 'lose';
    }
  });

  round.phase = 'results';
}

export function startNewRound(round) {
  round.bet = 0;
  round.hands = [];
  round.activeHand = 0;
  round.dealer = { cards: [] };
  round.phase = 'betting';
}
