// Pure blackjack rules, ported from the reference app (index4.html) per the
// project brief — same rules, just {rank, suit} objects instead of "A-S"
// strings, since that's what src/scene/card.js already expects.
const SUITS = ['S', 'H', 'D', 'C'];
const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

export function newDeck() {
  const deck = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) deck.push({ rank, suit });
  }
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

export function cardValue(rank) {
  if (rank === 'A') return 11;
  if (rank === 'J' || rank === 'Q' || rank === 'K') return 10;
  return Number(rank);
}

export function handValue(cards) {
  let sum = 0;
  let aces = 0;
  for (const c of cards) {
    const v = cardValue(c.rank);
    sum += v;
    if (v === 11) aces++;
  }
  while (sum > 21 && aces > 0) {
    sum -= 10;
    aces--;
  }
  return sum;
}

export function isBlackjack(cards) {
  return cards.length === 2 && handValue(cards) === 21;
}

// handValue() alone can't distinguish "17, and that's the only reading"
// from "17, but an Ace is still soft" (e.g. A+6) — both return 17, which is
// the correct scoring rule, but hides that the hand still has flexibility.
// This is for display only; every actual rule (bust, blackjack, dealer
// stand-on-17) already uses the single best value from handValue() above.
export function isSoftHand(cards) {
  let sum = 0;
  let aces = 0;
  for (const c of cards) {
    const v = cardValue(c.rank);
    sum += v;
    if (v === 11) aces++;
  }
  while (sum > 21 && aces > 0) {
    sum -= 10;
    aces--;
  }
  return aces > 0;
}

// "17" for a hard hand, "7/17" for a soft one (A+6) — matches how real
// tables display a hand that still has an Ace counted as 11. At 21 the
// split stops meaning anything, though: nobody calls a blackjack (or any
// soft 21) "11/21" — the Ace's flexibility only matters when there's still
// a decision to make, and no one hits past 21 either way. Always just "21".
export function formatHandValue(cards) {
  const value = handValue(cards);
  if (value === 21) return '21';
  return isSoftHand(cards) ? `${value - 10}/${value}` : `${value}`;
}
