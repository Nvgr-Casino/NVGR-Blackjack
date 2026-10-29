// Texas Hold'em hand evaluation: the best five-card hand from seven, its
// rank as one comparable number, and its name the way a dealer calls it —
// "Two Pair, Kings and Sevens". Cards are the game's own "RANK-SUIT"
// strings ("10-H", "A-S").
//
// Seven cards hold only 21 five-card hands, so each is ranked directly
// rather than through lookup tables: a few microseconds a player, at a
// table of six, once a hand.

const RANK_VALUE = { 2: 2, 3: 3, 4: 4, 5: 5, 6: 6, 7: 7, 8: 8, 9: 9, 10: 10, J: 11, Q: 12, K: 13, A: 14 };
const NAME = { 2: 'Two', 3: 'Three', 4: 'Four', 5: 'Five', 6: 'Six', 7: 'Seven', 8: 'Eight', 9: 'Nine', 10: 'Ten', 11: 'Jack', 12: 'Queen', 13: 'King', 14: 'Ace' };
const PLURAL = { 2: 'Twos', 3: 'Threes', 4: 'Fours', 5: 'Fives', 6: 'Sixes', 7: 'Sevens', 8: 'Eights', 9: 'Nines', 10: 'Tens', 11: 'Jacks', 12: 'Queens', 13: 'Kings', 14: 'Aces' };

export const CATEGORY = {
  HIGH_CARD: 0, PAIR: 1, TWO_PAIR: 2, TRIPS: 3, STRAIGHT: 4, FLUSH: 5, FULL_HOUSE: 6, QUADS: 7, STRAIGHT_FLUSH: 8,
};
const CATEGORY_NAME = ['High Card', 'Pair', 'Two Pair', 'Three of a Kind', 'Straight', 'Flush', 'Full House', 'Four of a Kind', 'Straight Flush'];

const parse = (card) => {
  const [r, s] = card.split('-');
  return { v: RANK_VALUE[r], s };
};

// One number per hand, larger is better: the category, then up to five
// tie-break ranks, each in base 15.
const score = (category, ranks) => ranks.concat([0, 0, 0, 0, 0]).slice(0, 5)
  .reduce((acc, r) => acc * 15 + r, category);

/** Ranks exactly five cards. Returns { score, category, ranks }. */
export function rankFive(cards) {
  const c = cards.map(parse);
  const values = c.map((x) => x.v).sort((a, b) => b - a);
  const flush = c.every((x) => x.s === c[0].s);
  const counts = new Map();
  values.forEach((v) => counts.set(v, (counts.get(v) || 0) + 1));
  // Groups by size, then rank: [[4, A], [1, 9]] for four aces and a nine.
  const groups = [...counts.entries()].map(([v, n]) => [n, v]).sort((a, b) => b[0] - a[0] || b[1] - a[1]);
  const distinct = groups.length === 5;
  let straightHigh = 0;
  if (distinct) {
    if (values[0] - values[4] === 4) straightHigh = values[0];
    // The wheel: A-5-4-3-2, where the ace plays low.
    else if (values[0] === 14 && values[1] === 5) straightHigh = 5;
  }
  let category, ranks;
  if (straightHigh && flush) { category = CATEGORY.STRAIGHT_FLUSH; ranks = [straightHigh]; }
  else if (groups[0][0] === 4) { category = CATEGORY.QUADS; ranks = [groups[0][1], groups[1][1]]; }
  else if (groups[0][0] === 3 && groups[1][0] === 2) { category = CATEGORY.FULL_HOUSE; ranks = [groups[0][1], groups[1][1]]; }
  else if (flush) { category = CATEGORY.FLUSH; ranks = values; }
  else if (straightHigh) { category = CATEGORY.STRAIGHT; ranks = [straightHigh]; }
  else if (groups[0][0] === 3) { category = CATEGORY.TRIPS; ranks = groups.map((g) => g[1]); }
  else if (groups[0][0] === 2 && groups[1][0] === 2) { category = CATEGORY.TWO_PAIR; ranks = groups.map((g) => g[1]); }
  else if (groups[0][0] === 2) { category = CATEGORY.PAIR; ranks = groups.map((g) => g[1]); }
  else { category = CATEGORY.HIGH_CARD; ranks = values; }
  return { score: score(category, ranks), category, ranks };
}

/** The name of a ranked hand, as a dealer would call it. */
export function handName({ category, ranks }) {
  switch (category) {
    case CATEGORY.STRAIGHT_FLUSH: return ranks[0] === 14 ? 'Royal Flush' : `Straight Flush, ${NAME[ranks[0]]} high`;
    case CATEGORY.QUADS: return `Four of a Kind, ${PLURAL[ranks[0]]}`;
    case CATEGORY.FULL_HOUSE: return `Full House, ${PLURAL[ranks[0]]} full of ${PLURAL[ranks[1]]}`;
    case CATEGORY.FLUSH: return `Flush, ${NAME[ranks[0]]} high`;
    case CATEGORY.STRAIGHT: return `Straight, ${NAME[ranks[0]]} high`;
    case CATEGORY.TRIPS: return `Three of a Kind, ${PLURAL[ranks[0]]}`;
    case CATEGORY.TWO_PAIR: return `Two Pair, ${PLURAL[ranks[0]]} and ${PLURAL[ranks[1]]}`;
    case CATEGORY.PAIR: return `Pair of ${PLURAL[ranks[0]]}`;
    default: return `High Card, ${NAME[ranks[0]]}`;
  }
}

/**
 * The best hand from any five of `cards` (five to seven of them). Returns
 * { score, category, ranks, name, best } — `best` the five cards used.
 */
export function bestHand(cards) {
  if (cards.length < 5) {
    // Before the river is out: rank what there is, for the readout only.
    const c = cards.map(parse);
    const counts = new Map();
    c.forEach((x) => counts.set(x.v, (counts.get(x.v) || 0) + 1));
    const groups = [...counts.entries()].map(([v, n]) => [n, v]).sort((a, b) => b[0] - a[0] || b[1] - a[1]);
    let category = CATEGORY.HIGH_CARD;
    if (groups[0][0] === 4) category = CATEGORY.QUADS;
    else if (groups[0][0] === 3 && groups[1] && groups[1][0] >= 2) category = CATEGORY.FULL_HOUSE;
    else if (groups[0][0] === 3) category = CATEGORY.TRIPS;
    else if (groups[0][0] === 2 && groups[1] && groups[1][0] === 2) category = CATEGORY.TWO_PAIR;
    else if (groups[0][0] === 2) category = CATEGORY.PAIR;
    const ranks = groups.map((g) => g[1]);
    const r = { score: score(category, ranks), category, ranks, best: cards.slice() };
    r.name = handName(r);
    return r;
  }
  let best = null;
  const pick = [];
  (function choose(from) {
    if (pick.length === 5) {
      const r = rankFive(pick);
      if (!best || r.score > best.score) best = { ...r, best: pick.slice() };
      return;
    }
    for (let i = from; i <= cards.length - (5 - pick.length); i++) {
      pick.push(cards[i]);
      choose(i + 1);
      pick.pop();
    }
  })(0);
  best.name = handName(best);
  return best;
}

export const categoryName = (c) => CATEGORY_NAME[c];
