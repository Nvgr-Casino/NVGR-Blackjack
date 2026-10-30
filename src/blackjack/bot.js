// A computer player for blackjack tournaments.
//
// It plays its hand by basic strategy — the mathematically best play for
// each total against each dealer upcard, for a six-deck shoe where the
// dealer stands on soft 17 and doubling after a split is allowed — which
// is how a good human plays, and is not hard to beat by luck alone.
//
// It bets as a tournament player does, and that is where the game is: a
// modest share of its stack early on, more when it is falling behind, and
// in the last hands everything on the line if it trails the leader — or
// the minimum, if it is the leader and can sit on it.

import { handTotals, rankOf, cardValue, canSplitCards, stakesFor } from '../app/roomLogic.js';
import { HANDS } from './tournament.js';

const up = (r) => {
  const card = r.dealer && r.dealer.hand && r.dealer.hand[0];
  return card ? cardValue(rankOf(card)) : 10; // an ace counts 11
};

/** The bot's bet for this hand. */
export function botBet(r, key, rand = Math.random) {
  const p = r.players[key];
  const { min, max } = stakesFor(r);
  const cap = Math.min(max, p.chips);
  if (cap < min) return 0;
  const others = (r.playerOrder || []).filter((k) => k !== key && r.players[k]).map((k) => r.players[k].chips);
  const leader = others.length ? Math.max(...others) : 0;
  const left = HANDS - (r.round || 0); // hands after this one
  const round = (n) => Math.max(min, Math.min(cap, Math.round(n / min) * min));
  if (left <= 1) {
    // The last two hands: chase if behind, protect if ahead.
    if (p.chips <= leader) return cap;
    if (p.chips - leader > 2 * max) return min;
    return round((p.chips - leader) + min);
  }
  let share = 0.04 + rand() * 0.08;
  if (p.chips < leader * 0.7) share += 0.06 + rand() * 0.08;
  return round(p.chips * share);
}

/**
 * The play for the hand whose turn it is: 'hit', 'stand', 'double' or
 * 'split'. Doubling and splitting are only chosen when allowed and
 * affordable; otherwise the next best play.
 */
export function botPlay(r, key) {
  const cur = r.turnOrder[r.currentTurnIndex];
  const p = r.players[key];
  const hand = p.hands[cur.hi];
  const d = up(r);
  const two = hand.cards.length === 2;
  const canDouble = two && p.chips >= hand.bet;
  const canSplit = two && p.hands.length === 1 && p.chips >= hand.bet && canSplitCards(hand.cards);

  if (canSplit) {
    const v = cardValue(rankOf(hand.cards[0]));
    const split =
      v === 11 || v === 8 ? true
        : v === 10 ? false
          : v === 9 ? (d >= 2 && d <= 9 && d !== 7)
            : v === 7 ? d <= 7
              : v === 6 ? d <= 6
                : v === 4 ? (d === 5 || d === 6)
                  : v === 2 || v === 3 ? d <= 7
                    : false; // fives play as a hard ten
    if (split) return 'split';
  }

  const { total, soft } = handTotals(hand.cards);
  if (soft) {
    if (total >= 19) return 'stand';
    if (total === 18) {
      if (d >= 3 && d <= 6) return canDouble ? 'double' : 'stand';
      return d <= 8 ? 'stand' : 'hit';
    }
    if (total === 17) return d >= 3 && d <= 6 && canDouble ? 'double' : 'hit';
    if (total >= 15) return d >= 4 && d <= 6 && canDouble ? 'double' : 'hit';
    return d >= 5 && d <= 6 && canDouble ? 'double' : 'hit';
  }
  if (total >= 17) return 'stand';
  if (total >= 13) return d <= 6 ? 'stand' : 'hit';
  if (total === 12) return d >= 4 && d <= 6 ? 'stand' : 'hit';
  if (total === 11) return d <= 10 && canDouble ? 'double' : 'hit';
  if (total === 10) return d <= 9 && canDouble ? 'double' : 'hit';
  if (total === 9) return d >= 3 && d <= 6 && canDouble ? 'double' : 'hit';
  return 'hit';
}
