// Teen Patti: the rules, and nothing of the table or the screen.
//
// Three cards each from one deck. Everyone puts in the boot; play goes
// round the table from the dealer's left. A player may play blind (without
// looking) or look at their cards and play seen. The stake is counted in
// blind terms: a blind player's chaal is the stake and a raise doubles it;
// a seen player pays twice as much for each (chaal 2× the stake, raise 4×
// and the stake doubles). The stake can rise no higher than the chaal limit.
//
//  - Pack: fold.
//  - Show: with only two players left, either may ask to see. They pay
//    their chaal, both hands are shown, the better takes the pot; if the
//    hands are equal, the one who asked loses.
//  - Side show: a seen player may ask the seen player who acted just
//    before them to compare privately, for the price of a chaal. If that
//    player accepts, the worse hand packs (equal: the one who asked). If
//    not, play goes on.
//  - The pot limit: once the pot reaches it, every hand left is shown and
//    the best wins.
//  - Blind for at most four turns; after that a player must look.
//  - A player who can't cover a chaal may put in all they have; every hand
//    still in is then shown, and pots are shared out by what each put in.
//
// Hands, best first: Trail (three of a kind, A-A-A highest), Pure sequence
// (straight flush), Sequence, Colour (flush), Pair, High card. In sequences
// A-K-Q is the highest and A-2-3 next, then K-Q-J down to 4-3-2.

export const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
export const SUITS = ['S', 'H', 'D', 'C'];
export const DECK = SUITS.flatMap((s) => RANKS.map((r) => r + '-' + s));
export const MAX_BLIND_TURNS = 4;

export const TP_STAKES = [
  { boot: 100, name: 'Classic' },
  { boot: 1000, name: 'Royal' },
  { boot: 10000, name: 'Maharaja' },
];
/** The limits at a table with this boot. */
export const limitsFor = (boot) => ({ chaalLimit: boot * 128, potLimit: boot * 1024, buyIn: boot * 200, minBuyIn: boot * 40 });

export const rankOf = (c) => RANKS.indexOf(c.split('-')[0]) + 2;  // 2..14
export const suitOf = (c) => c.split('-')[1];

export const CATEGORY_NAMES = ['High card', 'Pair', 'Colour', 'Sequence', 'Pure sequence', 'Trail'];

/**
 * A hand's strength as a single comparable number, and its name.
 * score = category * 1e6 + tie-break ranks.
 */
export function evaluate(cards) {
  const r = cards.map(rankOf).sort((a, b) => b - a);
  const flush = cards.every((c) => suitOf(c) === suitOf(cards[0]));
  let seqHigh = 0;
  if (r[0] - 1 === r[1] && r[1] - 1 === r[2]) seqHigh = r[0] === 14 ? 15 : r[0];  // A-K-Q above A-2-3
  else if (r[0] === 14 && r[1] === 3 && r[2] === 2) seqHigh = 14;                  // A-2-3 second
  const pack = (a, b, c) => a * 225 + b * 15 + c;
  let cat, tie;
  if (r[0] === r[1] && r[1] === r[2]) { cat = 5; tie = pack(r[0], 0, 0); }
  else if (seqHigh && flush) { cat = 4; tie = pack(seqHigh, 0, 0); }
  else if (seqHigh) { cat = 3; tie = pack(seqHigh, 0, 0); }
  else if (flush) { cat = 2; tie = pack(r[0], r[1], r[2]); }
  else if (r[0] === r[1] || r[1] === r[2]) {
    const pair = r[1];
    const kicker = r[0] === r[1] ? r[2] : r[0];
    cat = 1; tie = pack(pair, kicker, 0);
  } else { cat = 0; tie = pack(r[0], r[1], r[2]); }
  return { score: cat * 1e6 + tie, category: cat, name: handName(cat, r, seqHigh) };
}
const FACE = { 11: 'Jacks', 12: 'Queens', 13: 'Kings', 14: 'Aces' };
const plural = (v) => FACE[v] || `${v}s`;
const one = { 11: 'Jack', 12: 'Queen', 13: 'King', 14: 'Ace' };
function handName(cat, r, seqHigh) {
  if (cat === 5) return `Trail of ${plural(r[0])}`;
  if (cat === 4) return seqHigh === 14 ? 'Pure sequence A-2-3' : seqHigh === 15 ? 'Pure sequence A-K-Q' : 'Pure sequence';
  if (cat === 3) return seqHigh === 14 ? 'Sequence A-2-3' : seqHigh === 15 ? 'Sequence A-K-Q' : 'Sequence';
  if (cat === 2) return `Colour, ${one[r[0]] || r[0]} high`;
  if (cat === 1) return `Pair of ${plural(r[1])}`;
  return `${one[r[0]] || r[0]} high`;
}
/** 1 if a beats b, -1 if b beats a, 0 if equal. */
export function compare(a, b) {
  const x = evaluate(a).score, y = evaluate(b).score;
  return x > y ? 1 : x < y ? -1 : 0;
}

// Every three-card hand's place among all 22,100: how strong a hand is,
// as the share of hands it beats (for the computer players).
const PERCENTILE = (() => {
  const scores = [];
  for (let i = 0; i < 52; i++) for (let j = i + 1; j < 52; j++) for (let k = j + 1; k < 52; k++) scores.push(evaluate([DECK[i], DECK[j], DECK[k]]).score);
  scores.sort((a, b) => a - b);
  return scores;
})();
export function strength(cards) {
  const s = evaluate(cards).score;
  let lo = 0, hi = PERCENTILE.length;
  while (lo < hi) { const m = (lo + hi) >> 1; if (PERCENTILE[m] < s) lo = m + 1; else hi = m; }
  return lo / PERCENTILE.length;
}

export function shuffled(rand = Math.random) {
  const d = DECK.slice();
  for (let i = d.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [d[i], d[j]] = [d[j], d[i]]; }
  return d;
}

// ---------- a hand ----------
// The room: { boot, players: { key: { name, seat, stack, bot } }, dealerSeat }
// The hand lives at room.hand.

/** The players in a hand, in turn order from the dealer's left. */
function order(room) {
  const keys = Object.keys(room.players).filter((k) => room.players[k].stack >= room.boot && !room.players[k].out);
  keys.sort((a, b) => room.players[a].seat - room.players[b].seat);
  const d = room.dealerSeat ?? -1;
  const after = keys.filter((k) => room.players[k].seat > d);
  return after.concat(keys.filter((k) => room.players[k].seat <= d));
}

/** Starts a hand: the boot from everyone, three cards each. Returns false if fewer than two can play. */
export function startHand(room, rand = Math.random, id = Date.now()) {
  // The dealer moves one seat round.
  const seats = Object.values(room.players).filter((p) => p.stack >= room.boot && !p.out).map((p) => p.seat).sort((a, b) => a - b);
  if (seats.length < 2) return false;
  const nextD = seats.find((s) => s > (room.dealerSeat ?? -1));
  room.dealerSeat = nextD ?? seats[0];
  const players = order(room);
  const deck = shuffled(rand);
  const cards = {};
  players.forEach((k, i) => { cards[k] = [deck[i], deck[i + players.length], deck[i + 2 * players.length]]; });
  const put = {};
  players.forEach((k) => { room.players[k].stack -= room.boot; put[k] = room.boot; });
  const L = limitsFor(room.boot);
  room.hand = {
    id, phase: 'betting', players, cards, put,
    pot: room.boot * players.length, stake: room.boot,
    chaalLimit: L.chaalLimit, potLimit: L.potLimit,
    folded: {}, seen: {}, blindTurns: {}, last: {},
    toAct: players[0], lastActor: null, sideShow: null, results: null, shown: {}, log: [],
  };
  return true;
}

export const active = (h) => h.players.filter((k) => !h.folded[k]);
const nextActive = (h, from) => {
  const n = h.players.length;
  let i = h.players.indexOf(from);
  for (let s = 0; s < n; s++) { i = (i + 1) % n; if (!h.folded[h.players[i]]) return h.players[i]; }
  return from;
};
const prevActive = (h, from) => {
  const n = h.players.length;
  let i = h.players.indexOf(from);
  for (let s = 0; s < n; s++) { i = (i - 1 + n) % n; if (!h.folded[h.players[i]]) return h.players[i]; }
  return from;
};

/** What a chaal and a raise cost this player now. */
export function costs(room, key) {
  const h = room.hand;
  const mult = h.seen[key] ? 2 : 1;
  const canRaise = h.stake * 2 <= h.chaalLimit;
  return { chaal: h.stake * mult, raise: canRaise ? h.stake * 2 * mult : null, show: h.stake * mult, side: h.stake * 2 };
}

/** The moves open to `key` now, or null if it is not their turn. */
export function legal(room, key) {
  const h = room.hand;
  if (!h || h.phase !== 'betting' || h.toAct !== key || h.sideShow) return null;
  const p = room.players[key];
  const c = costs(room, key);
  const left = active(h);
  const prev = prevActive(h, key);
  const mustSee = !h.seen[key] && (h.blindTurns[key] || 0) >= MAX_BLIND_TURNS;
  const afford = p.stack >= c.chaal;
  return {
    see: !h.seen[key],
    mustSee,
    pack: true,
    chaal: !mustSee && afford ? c.chaal : null,
    raise: !mustSee && c.raise && p.stack >= c.raise ? c.raise : null,
    show: left.length === 2 && !mustSee && afford ? c.show : null,
    // Side show: you and the player before you both seen, more than two left.
    side: left.length > 2 && h.seen[key] && h.seen[prev] && p.stack >= c.side ? { cost: c.side, with: prev } : null,
    // Short of a chaal: all you have, and every hand shown.
    allIn: !afford && !mustSee && p.stack > 0 ? p.stack : null,
  };
}

function pay(room, key, amount) {
  const h = room.hand;
  const take = Math.min(amount, room.players[key].stack);
  room.players[key].stack -= take;
  h.put[key] = (h.put[key] || 0) + take;
  h.pot += take;
  return take;
}
function endTurn(room, key) {
  const h = room.hand;
  h.lastActor = key;
  if (active(h).length === 1) return finish(room, [active(h)[0]], 'fold');
  if (h.pot >= h.potLimit) return showdown(room, 'pot limit');
  h.toAct = nextActive(h, key);
}

/**
 * Applies `key`'s move: 'see' | 'pack' | 'chaal' | 'raise' | 'show' |
 * 'side' | 'allin'. Returns false if it isn't allowed.
 */
export function act(room, key, move) {
  const h = room.hand;
  if (move === 'see') {
    // Looking is allowed at any time while in the hand, not only on your turn.
    if (!h || h.phase !== 'betting' || h.folded[key] || h.seen[key] || !h.players.includes(key)) return false;
    h.seen[key] = true;
    h.last[key] = { action: 'see' };
    return true;
  }
  const L = legal(room, key);
  if (!L) return false;
  const blind = !h.seen[key];
  if (move === 'pack') {
    h.folded[key] = true;
    h.last[key] = { action: 'pack' };
    return endTurn(room, key), true;
  }
  if (move === 'chaal' && L.chaal) {
    pay(room, key, L.chaal);
    if (blind) h.blindTurns[key] = (h.blindTurns[key] || 0) + 1;
    h.last[key] = { action: blind ? 'blind' : 'chaal', amount: L.chaal };
    return endTurn(room, key), true;
  }
  if (move === 'raise' && L.raise) {
    pay(room, key, L.raise);
    h.stake *= 2;
    if (blind) h.blindTurns[key] = (h.blindTurns[key] || 0) + 1;
    h.last[key] = { action: blind ? 'blindRaise' : 'raise', amount: L.raise };
    return endTurn(room, key), true;
  }
  if (move === 'show' && L.show) {
    pay(room, key, L.show);
    h.last[key] = { action: 'show', amount: L.show };
    const other = active(h).find((k) => k !== key);
    const c = compare(h.cards[key], h.cards[other]);
    // Equal hands: the one who asked loses.
    const winner = c > 0 ? key : other;
    h.shown[key] = h.cards[key]; h.shown[other] = h.cards[other];
    return finish(room, [winner], 'show'), true;
  }
  if (move === 'side' && L.side) {
    pay(room, key, L.side.cost);
    h.last[key] = { action: 'side', amount: L.side.cost };
    h.sideShow = { from: key, to: L.side.with };
    return true;
  }
  if (move === 'allin' && L.allIn) {
    pay(room, key, L.allIn);
    h.last[key] = { action: 'allin', amount: L.allIn };
    return showdown(room, 'all in'), true;
  }
  return false;
}

/** The answer to a side show: the player asked accepts or declines. */
export function answerSideShow(room, accept) {
  const h = room.hand;
  if (!h || !h.sideShow) return null;
  const { from, to } = h.sideShow;
  h.sideShow = null;
  let loser = null;
  if (accept) {
    const c = compare(h.cards[from], h.cards[to]);
    loser = c > 0 ? to : from;      // equal: the one who asked
    h.folded[loser] = true;
    h.last[loser] = { action: 'pack' };
    h.log.push({ side: { from, to, accepted: true, loser } });
  } else {
    h.log.push({ side: { from, to, accepted: false } });
  }
  endTurn(room, from);
  return { from, to, accepted: accept, loser };
}

// Every hand still in shown; the pot shared out by what each put in, so a
// player all in for less can win only as much as they matched.
function showdown(room, reason) {
  const h = room.hand;
  const live = active(h);
  live.forEach((k) => { h.shown[k] = h.cards[k]; });
  const levels = [...new Set(live.map((k) => h.put[k] || 0))].sort((a, b) => a - b);
  const results = [];
  let prev = 0;
  levels.forEach((lvl) => {
    let amount = 0;
    h.players.forEach((k) => { amount += Math.max(0, Math.min(h.put[k] || 0, lvl) - prev); });
    const eligible = live.filter((k) => (h.put[k] || 0) >= lvl);
    let best = [], bestScore = -1;
    eligible.forEach((k) => {
      const s = evaluate(h.cards[k]).score;
      if (s > bestScore) { bestScore = s; best = [k]; } else if (s === bestScore) best.push(k);
    });
    if (amount > 0) results.push({ winners: best, amount });
    prev = lvl;
  });
  return settle(room, results, reason);
}

function finish(room, winners, reason) {
  return settle(room, [{ winners, amount: room.hand.pot }], reason);
}
function settle(room, results, reason) {
  const h = room.hand;
  // Any part of the pot nobody still in had matched (a big raise followed
  // by packs) goes to the first result's winners.
  const paid = results.reduce((a, r) => a + r.amount, 0);
  if (paid < h.pot && results.length) results[0].amount += h.pot - paid;
  results.forEach((r) => {
    const share = Math.floor(r.amount / r.winners.length);
    let odd = r.amount - share * r.winners.length;
    r.winners.forEach((k) => { room.players[k].stack += share + (odd-- > 0 ? 1 : 0); });
    r.hand = reason === 'fold' ? null : evaluate(h.cards[r.winners[0]]).name;
  });
  h.results = results;
  h.reason = reason;
  h.phase = 'done';
  h.toAct = null;
  return true;
}

// ---------- the computer players ----------
export function newPersonality(rand = Math.random) {
  return {
    blindFor: Math.floor(rand() * 4),          // turns played blind before looking
    nerve: 0.25 + rand() * 0.6,                // how far a weak hand is pushed
    bluff: rand() * 0.18,
  };
}

/** A computer player's move. */
export function decide(room, key, me, rand = Math.random) {
  const h = room.hand;
  const L = legal(room, key);
  if (!L) return null;
  const p = room.players[key];
  const left = active(h).length;
  // Blind: chaal along for a few turns, raise now and then.
  if (!h.seen[key]) {
    const turns = h.blindTurns[key] || 0;
    const pricey = h.stake >= room.boot * 16;
    if (L.mustSee || turns >= me.blindFor || (pricey && rand() < 0.5)) return 'see';
    if (L.show && rand() < 0.25) return 'show';
    if (L.raise && rand() < 0.12 + me.nerve * 0.1 && h.stake < room.boot * 8) return 'raise';
    if (L.chaal) return 'chaal';
    return L.allIn ? 'allin' : 'see';
  }
  const s = strength(h.cards[key]);
  // How much the hand is worth pushing: stronger with fewer opponents,
  // weaker as the price climbs.
  const price = (L.chaal || L.allIn || 0) / Math.max(1, p.stack + (L.chaal || 0));
  const need = 0.42 + (left - 2) * 0.07 + price * 0.6 - me.nerve * 0.25;
  const bluffing = rand() < me.bluff;
  if (s < need && !bluffing) return L.allIn && s > 0.7 ? 'allin' : 'pack';
  if (L.allIn) return s > 0.6 || bluffing ? 'allin' : 'pack';
  if (L.show) {
    // Two left: see it through with a good hand, keep pushing with a great one.
    if (s > 0.93 && L.raise && rand() < 0.6) return 'raise';
    if (s > 0.55 || h.stake >= room.boot * 32) return 'show';
    return rand() < 0.5 ? 'chaal' : 'show';
  }
  if (L.side && s > 0.45 && s < 0.8 && rand() < 0.35) return 'side';
  if (L.raise && (s > 0.88 || (bluffing && rand() < 0.4)) && rand() < 0.55) return 'raise';
  return L.chaal ? 'chaal' : 'pack';
}
/** Whether a computer player accepts a side show. */
export function decideSideShow(room, key, rand = Math.random) {
  const s = strength(room.hand.cards[key]);
  return s > 0.5 || rand() < 0.25;
}
