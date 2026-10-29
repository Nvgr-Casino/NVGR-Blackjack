// A computer opponent for practice tables: plays its own two cards and
// what it can see — the board, the pot, the bet to it — and nothing else.
//
// Before the flop it rates its hand by Bill Chen's formula, a quick and
// well-known measure of starting-hand strength. After the flop it estimates
// its equity — its share of the pot if the hand were run out — by dealing
// the rest of the board and the opponents' cards at random a few hundred
// times. It then weighs that against the price it is being offered: a call
// that wins more often than the pot odds demand is a call, a strong hand
// bets or raises, a weak one folds. A little noise, a personality of its own
// (how many hands it plays, how often it bets), and the occasional bluff
// keep it from being a calculator anyone can read.

import { bestHand } from './evaluator.js';
import { CARDS } from './mentalPoker.js';

const VALUE = { 2: 2, 3: 3, 4: 4, 5: 5, 6: 6, 7: 7, 8: 8, 9: 9, 10: 10, J: 11, Q: 12, K: 13, A: 14 };
const parse = (c) => { const [r, s] = c.split('-'); return { v: VALUE[r], s }; };

/** Chen's score for a starting hand: about 20 for aces, below 0 for the worst. */
export function chenScore(cards) {
  const [a, b] = cards.map(parse).sort((x, y) => y.v - x.v);
  const base = (v) => (v === 14 ? 10 : v === 13 ? 8 : v === 12 ? 7 : v === 11 ? 6 : v / 2);
  let score = base(a.v);
  if (a.v === b.v) return Math.max(5, score * 2);
  if (a.s === b.s) score += 2;
  const gap = a.v - b.v - 1;
  score -= gap === 0 ? 0 : gap === 1 ? 1 : gap === 2 ? 2 : gap === 3 ? 4 : 5;
  if (gap <= 1 && a.v < 12) score += 1;
  return Math.ceil(score);
}

/**
 * The share of the pot `cards` would win against `opponents` random hands
 * with `board` so far, by `trials` random run-outs (ties shared).
 */
export function equity(cards, board, opponents, trials = 300, rand = Math.random) {
  const used = new Set(cards.concat(board));
  const deck = CARDS.filter((c) => !used.has(c));
  let won = 0;
  for (let t = 0; t < trials; t++) {
    // A partial shuffle: only as many cards as this trial needs.
    const need = 5 - board.length + opponents * 2;
    for (let i = 0; i < need; i++) {
      const j = i + Math.floor(rand() * (deck.length - i));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    const full = board.concat(deck.slice(0, 5 - board.length));
    const mine = bestHand(cards.concat(full)).score;
    let best = 0;
    let ties = 0;
    for (let o = 0; o < opponents; o++) {
      const k = 5 - board.length + o * 2;
      const theirs = bestHand([deck[k], deck[k + 1]].concat(full)).score;
      if (theirs > best) { best = theirs; ties = 0; }
      if (theirs === best) ties++;
    }
    if (mine > best) won += 1;
    else if (mine === best) won += 1 / (ties + 1);
  }
  return won / trials;
}

/** A personality: how loose (plays more hands) and how aggressive (bets more). */
export function newPersonality(rand = Math.random) {
  return { loose: 0.3 + rand() * 0.5, aggression: 0.25 + rand() * 0.6, bluff: 0.04 + rand() * 0.08 };
}

/**
 * The bot's move: [action, amount]. `legal` is rules.legalActions for it;
 * `view` = { cards, board, pot, toCall, currentBet, bigBlind, opponents,
 * street, position (0 early … 1 on the button) }.
 */
export function decide(legal, view, personality, rand = Math.random) {
  const { cards, board, pot, toCall, bigBlind, opponents } = view;
  const p = personality;
  const raiseTo = (amount) => ['raise', Math.max(legal.minTo, Math.min(legal.maxTo, Math.round(amount / bigBlind) * bigBlind || legal.minTo))];
  const canRaise = legal.raise;
  const check = legal.check ? ['check'] : null;
  const call = legal.call ? ['call'] : null;
  const fold = ['fold'];

  if (view.street === 'preflop') {
    // Chen 10+ is premium; looser bots play down to about 5–6, tighter to 8.
    const chen = chenScore(cards) + (view.position || 0) * 1.5 + (rand() - 0.5) * 1.5;
    const openLine = 9.5 - p.loose * 4.5;
    const raiseLine = 10.5 - p.aggression * 2;
    const bbsToCall = toCall / bigBlind;
    if (chen >= raiseLine && canRaise) {
      // Open to about three big blinds, or re-raise to about three times the bet.
      const facing = view.currentBet > bigBlind;
      const target = facing ? view.currentBet * (2.6 + rand() * 0.6) : bigBlind * (2.5 + rand());
      if (chen >= 16 && rand() < 0.4) return raiseTo(legal.maxTo);
      return raiseTo(target);
    }
    if (!toCall) return check || call || fold;
    if (chen >= openLine && bbsToCall <= 3 + p.loose * 4) return call || check || fold;
    if (chen >= openLine + 2 && bbsToCall <= 10) return call || fold;
    if (chen >= 14) return call || fold;
    return check || fold;
  }

  const eq = equity(cards, board, Math.max(1, opponents), 220, rand);
  const price = toCall ? toCall / (pot + toCall) : 0;
  const noise = (rand() - 0.5) * 0.08;
  const strength = eq + noise;
  if (!toCall) {
    if (canRaise && (strength > 0.62 - p.aggression * 0.12 || rand() < p.bluff)) {
      const size = pot * (0.45 + rand() * 0.45 + (strength > 0.85 ? 0.3 : 0));
      return raiseTo(Math.max(bigBlind, size));
    }
    return check || fold;
  }
  if (strength > 0.78 && canRaise && rand() < 0.35 + p.aggression * 0.5) {
    return raiseTo(legal.minTo + pot * (0.5 + rand() * 0.5));
  }
  if (strength > price + 0.04) return call || fold;
  if (rand() < p.bluff * 0.5 && canRaise && view.street !== 'river') return raiseTo(legal.minTo);
  return check || fold;
}
