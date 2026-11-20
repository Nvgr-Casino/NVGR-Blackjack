// Rummy — thirteen-card Indian rummy (points), the rules and nothing of the
// table or the screen.
//
// Two decks and two printed jokers. One card is cut and turned face up
// under the closed deck: every card of its rank is a wild joker. Each
// player has thirteen cards; on a turn you draw one — from the closed deck
// or the top of the open pile — and discard one. To finish you discard
// your fourteenth card and declare: all thirteen in melds, with at least
// two sequences, at least one of them pure.
//
//  - Pure sequence: three or more consecutive cards of one suit, no joker
//    standing in (a wild-rank card in its own place is natural).
//  - Sequence: the same with jokers filling gaps.
//  - Set: three or four cards of one rank, every suit different (jokers
//    may stand in).
//  - Ace is low (A-2-3) or high (Q-K-A), never both (no K-A-2).
//
// Points, for those who did not declare: the cards outside their melds (A,
// K, Q, J ten each, numbers their face, jokers nothing) — but if they have
// no pure sequence, or not two sequences, every card counts. At most 80. A
// drop before your first draw costs 20; a drop later, 40; a wrong
// declaration, 80.

export const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
export const SUITS = ['S', 'H', 'D', 'C'];
export const JOKER = 'JK';
export const MAX_POINTS = 80;
export const FIRST_DROP = 20;
export const MIDDLE_DROP = 40;

export const RUMMY_STAKES = [
  { point: 10, name: 'Classic' },
  { point: 100, name: 'Royal' },
  { point: 1000, name: 'Maharaja' },
];

// A card is "R-S#d": rank, suit, which deck. A printed joker is "JK-X#1".
export const rankOf = (c) => c.split('-')[0];
export const suitOf = (c) => c.split('-')[1].split('#')[0];
export const faceOf = (c) => c.split('#')[0];
export const rankNum = (r) => RANKS.indexOf(r) + 1;     // A=1 … K=13
export const isPrinted = (c) => rankOf(c) === JOKER;
export const isJoker = (c, wild) => isPrinted(c) || rankOf(c) === wild;
export function value(c, wild) {
  if (isJoker(c, wild)) return 0;
  const r = rankOf(c);
  return r === 'A' || r === 'K' || r === 'Q' || r === 'J' ? 10 : Number(r);
}

export function makeDeck() {
  const d = [];
  for (let k = 1; k <= 2; k++) SUITS.forEach((s) => RANKS.forEach((r) => d.push(`${r}-${s}#${k}`)));
  d.push(`${JOKER}-X#1`, `${JOKER}-X#2`);
  return d;
}
export function shuffled(rand = Math.random) {
  const d = makeDeck();
  for (let i = d.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [d[i], d[j]] = [d[j], d[i]]; }
  return d;
}

// ---------- one meld ----------
/** 'pure' | 'seq' | 'set' | null for a group of cards. */
export function meldKind(cards, wild) {
  if (cards.length < 3) return null;
  // Pure: every card natural, consecutive in one suit.
  if (!cards.some(isPrinted) && runOK(cards.map((c) => rankNum(rankOf(c))), cards.map(suitOf), 0)) return 'pure';
  const jokers = cards.filter((c) => isJoker(c, wild)).length;
  const nat = cards.filter((c) => !isJoker(c, wild));
  if (!nat.length) return cards.length <= 4 ? 'set' : 'seq';
  if (runOK(nat.map((c) => rankNum(rankOf(c))), nat.map(suitOf), jokers)) return 'seq';
  // A set: one rank, every suit different, three or four cards.
  if (cards.length <= 4 && nat.every((c) => rankOf(c) === rankOf(nat[0])) && new Set(nat.map(suitOf)).size === nat.length) return 'set';
  return null;
}
// Whether ranks (one suit) make a run with `jokers` to fill the gaps; Ace
// low or high.
function runOK(ranks, suits, jokers) {
  if (new Set(suits).size !== 1) return false;
  const tryWith = (rs) => {
    const s = rs.slice().sort((a, b) => a - b);
    for (let i = 1; i < s.length; i++) if (s[i] === s[i - 1]) return false;
    const gaps = s[s.length - 1] - s[0] + 1 - s.length;
    return gaps <= jokers && s[s.length - 1] - s[0] + 1 + (jokers - gaps) <= 14;
  };
  if (tryWith(ranks)) return true;
  if (ranks.includes(1)) return tryWith(ranks.map((r) => (r === 1 ? 14 : r)));
  return false;
}

/** Whether these groups are a winning declaration. */
export function checkDeclare(groups, wild) {
  const n = groups.reduce((a, g) => a + g.length, 0);
  if (n !== 13) return { ok: false, why: 'A declaration is all thirteen cards.' };
  const kinds = groups.map((g) => meldKind(g, wild));
  if (kinds.some((k) => !k)) return { ok: false, why: 'Every group must be a sequence or a set.' };
  if (!kinds.includes('pure')) return { ok: false, why: 'You need a pure sequence.' };
  if (kinds.filter((k) => k === 'pure' || k === 'seq').length < 2) return { ok: false, why: 'You need two sequences.' };
  return { ok: true };
}

/** Points for a hand laid out in `groups` (the ones that are not melds count). */
export function pointsFor(groups, wild) {
  const kinds = groups.map((g) => meldKind(g, wild));
  const pure = kinds.includes('pure');
  const seqs = kinds.filter((k) => k === 'pure' || k === 'seq').length;
  let pts = 0;
  groups.forEach((g, i) => {
    if (pure && seqs >= 2 && kinds[i]) return;
    g.forEach((c) => { pts += value(c, wild); });
  });
  return Math.min(MAX_POINTS, pts);
}

// ---------- the best layout of a hand ----------
// An exact search: the melds that leave the fewest points, honouring the
// rule that melds only count with a pure sequence and two sequences.
//
// Every card but the printed jokers is an item; a candidate meld names, for
// each place in it, the cards that could fill it (duplicates from the two
// decks are interchangeable), and how many jokers it needs. The search
// takes the first unplaced natural card and either leaves it out or puts
// it in each meld it can start; joker places are filled from printed
// jokers first, then from wild-rank cards not otherwise used.
export function analyze(hand, wild) {
  const printed = hand.filter(isPrinted);
  const items = hand.filter((c) => !isPrinted(c));
  const n = items.length;
  const isWild = items.map((c) => rankOf(c) === wild);
  const val = items.map((c) => value(c, wild));
  // Where each card is: by suit and rank (1..14, Ace both ends).
  const at = {};
  items.forEach((c, i) => {
    const s = suitOf(c), r = rankNum(rankOf(c));
    const add = (rr) => { const k = s + rr; (at[k] = at[k] || []).push(i); };
    add(r);
    if (r === 1) add(14);
  });
  const cands = [];
  const jokerCount = printed.length + isWild.filter(Boolean).length;
  SUITS.forEach((s) => {
    for (let start = 1; start <= 12; start++) {
      for (let len = 3; start + len - 1 <= 14 && len <= 13; len++) {
        const places = [];
        let missingNat = 0, haveNonWild = 0;
        for (let r = start; r < start + len; r++) {
          const all = at[s + r] || [];
          places.push(all);
          if (!all.length) missingNat++;
          if (all.some((i) => !isWild[i])) haveNonWild++;
        }
        // Pure: every place filled by a natural card (wild cards too, in place).
        if (!missingNat) cands.push({ kind: 'pure', places, jokers: 0 });
        // Impure: the gaps filled by jokers (wild-rank cards here are jokers).
        const slots = [];
        let jk = 0;
        for (let r = start; r < start + len; r++) {
          const nat = (at[s + r] || []).filter((i) => !isWild[i]);
          if (nat.length) slots.push(nat); else jk++;
        }
        if (jk >= 1 && jk <= Math.min(3, jokerCount) && slots.length >= (len === 3 ? 1 : 2)) cands.push({ kind: 'seq', places: slots, jokers: jk });
        if (missingNat > 3) break;
      }
    }
  });
  RANKS.forEach((r) => {
    if (r === wild) return;
    const bySuit = SUITS.map((s) => items.map((c, i) => (rankOf(c) === r && suitOf(c) === s ? i : -1)).filter((i) => i >= 0)).filter((l) => l.length);
    const m = bySuit.length;
    // Every choice of distinct suits, with jokers making it up to 3 or 4.
    for (let mask = 1; mask < 1 << m; mask++) {
      const places = bySuit.filter((_, k) => mask & (1 << k));
      for (const size of [3, 4]) {
        const jk = size - places.length;
        if (jk < 0 || jk > 2 || jk > jokerCount) continue;
        if (places.length + jk !== size) continue;
        cands.push({ kind: 'set', places, jokers: jk });
      }
    }
  });
  // By the first card each could start with.
  const byItem = Array.from({ length: n }, () => []);
  cands.forEach((cand) => {
    const seen = new Set();
    cand.places.forEach((pl) => pl.forEach((i) => { if (!isWild[i] && !seen.has(i)) { seen.add(i); byItem[i].push(cand); } }));
  });
  const nonWild = items.map((_, i) => i).filter((i) => !isWild[i]);

  function solve(strict) {
    const memo = new Map();
    // Returns { cover, melds } for the best from here, or null if strict
    // and the rule can't be met.
    function go(used, pLeft, pure, seqs) {
      const key = used * 64 + pLeft * 8 + pure * 4 + seqs;
      if (memo.has(key)) return memo.get(key);
      let pivot = -1;
      for (const i of nonWild) if (!(used & (1 << i))) { pivot = i; break; }
      let best = null;
      if (pivot < 0) {
        best = !strict || (pure && seqs >= 2) ? { cover: 0, melds: [] } : null;
        memo.set(key, best);
        return best;
      }
      // Left out.
      const skip = go(used | (1 << pivot), pLeft, pure, seqs);
      if (skip) best = { cover: skip.cover, melds: skip.melds };
      for (const cand of byItem[pivot]) {
        // Fill the places: the pivot in its place, the rest from unused cards.
        let u = used | (1 << pivot);
        const picked = [pivot];
        let ok = false, placedPivot = false;
        ok = true;
        for (const pl of cand.places) {
          if (!placedPivot && pl.includes(pivot)) { placedPivot = true; continue; }
          const i = pl.find((x) => !(u & (1 << x)) && x !== pivot);
          if (i === undefined) { ok = false; break; }
          u |= 1 << i; picked.push(i);
        }
        if (!ok || !placedPivot) continue;
        // Jokers: printed first, then spare wild-rank cards.
        let need = cand.jokers, p = pLeft;
        const useP = Math.min(need, p); p -= useP; need -= useP;
        const wilds = [];
        for (let i = 0; i < n && need > 0; i++) if (isWild[i] && !(u & (1 << i))) { u |= 1 << i; wilds.push(i); need--; }
        if (need > 0) continue;
        const isSeq = cand.kind !== 'set';
        const rest = go(u, p, pure || cand.kind === 'pure' ? 1 : 0, Math.min(2, seqs + (isSeq ? 1 : 0)));
        if (!rest) continue;
        const cover = rest.cover + picked.reduce((a, i) => a + (isWild[i] ? 0 : val[i]), 0);
        if (!best || cover > best.cover) {
          best = { cover, melds: [{ kind: cand.kind, items: picked.concat(wilds), printed: useP }].concat(rest.melds) };
        }
      }
      memo.set(key, best);
      return best;
    }
    return go(0, printed.length, 0, 0);
  }
  const total = val.reduce((a, b) => a + b, 0);
  const strict = solve(true);
  const loose = strict ? null : solve(false);
  const chosen = strict || loose;
  // The melds as cards, the printed jokers handed out in turn; any spare
  // jokers join the first sequence.
  let pIdx = 0;
  const melds = chosen.melds.map((m) => {
    const cards = m.items.map((i) => items[i]);
    for (let k = 0; k < m.printed; k++) cards.push(printed[pIdx++]);
    return { kind: m.kind, cards };
  });
  const inMeld = new Set(melds.flatMap((m) => m.cards));
  let spare = hand.filter((c) => !inMeld.has(c));
  const spareJokers = spare.filter((c) => isJoker(c, wild));
  // Spare jokers go where they keep a meld valid without spoiling the one
  // pure sequence the declaration needs: an impure sequence, a set short
  // of four, or a second pure sequence.
  if (strict) {
    const pures = melds.filter((m) => m.kind === 'pure').length;
    spareJokers.forEach((j) => {
      const home = melds.find((m) => m.kind === 'seq' && meldKind(m.cards.concat(j), wild))
        || melds.find((m) => m.kind === 'set' && m.cards.length < 4 && meldKind(m.cards.concat(j), wild))
        || (pures > 1 && melds.find((m) => m.kind === 'pure' && meldKind(m.cards.concat(j), wild)));
      if (home) { home.cards.push(j); if (home.kind === 'pure') home.kind = 'seq'; spare = spare.filter((c) => c !== j); }
    });
  }
  const dead = strict ? total - chosen.cover : total;
  return {
    melds,
    spare,
    points: Math.min(MAX_POINTS, dead),
    // Points of the loose layout, for judging progress when the rule isn't met yet.
    loosePoints: strict ? dead : total - chosen.cover,
    complete: !!strict && spare.length === 0 && checkDeclare(melds.map((m) => m.cards), wild).ok,
    hasPure: melds.some((m) => m.kind === 'pure'),
  };
}

/** The hand as groups: its melds, then what is left (sorted). */
export function arrange(hand, wild) {
  const a = analyze(hand, wild);
  const groups = a.melds.map((m) => sortGroup(m.cards, wild));
  if (a.spare.length) groups.push(sortHand(a.spare, wild));
  return groups;
}
const SUIT_ORDER = { S: 0, H: 1, C: 2, D: 3, X: 4 };
export function sortGroup(cards, wild) {
  return cards.slice().sort((a, b) => {
    const ja = isJoker(a, wild), jb = isJoker(b, wild);
    if (ja !== jb) return ja ? 1 : -1;
    return SUIT_ORDER[suitOf(a)] - SUIT_ORDER[suitOf(b)] || rankNum(rankOf(a)) - rankNum(rankOf(b));
  });
}
export const sortHand = (cards, wild) => sortGroup(cards, wild);
/** Groups by suit, jokers on their own. */
export function bySuit(hand, wild) {
  const groups = SUITS.map((s) => hand.filter((c) => !isJoker(c, wild) && suitOf(c) === s)).filter((g) => g.length).map((g) => sortGroup(g, wild));
  const j = hand.filter((c) => isJoker(c, wild));
  if (j.length) groups.push(j);
  return groups;
}

// ---------- the computer players ----------
// How far a hand is from finishing, lower is nearer: its points, with the
// rule's weight on top, and a little credit for cards that are nearly a
// meld (pairs, and cards a step or two apart in a suit).
export function distance(hand, wild) {
  const a = analyze(hand, wild);
  let d = a.complete ? 0 : a.loosePoints;
  if (!a.hasPure) d += 25;
  if (a.melds.filter((m) => m.kind !== 'set').length < 2) d += 10;
  const spare = a.spare.filter((c) => !isJoker(c, wild));
  let near = 0;
  for (let i = 0; i < spare.length; i++) for (let j = i + 1; j < spare.length; j++) {
    const x = spare[i], y = spare[j];
    if (rankOf(x) === rankOf(y) && suitOf(x) !== suitOf(y)) near += 3;
    else if (suitOf(x) === suitOf(y) && Math.abs(rankNum(rankOf(x)) - rankNum(rankOf(y))) <= 2 && rankOf(x) !== rankOf(y)) near += 3;
  }
  return d - Math.min(near, 20) + (a.complete ? -100 : 0);
}

/**
 * The card a computer player throws from fourteen: the one whose loss
 * hurts least. `skill` below 1 makes it human — now and then it keeps the
 * wrong card, choosing among its few best throws instead (never breaking a
 * finished hand).
 */
export function bestDiscard(hand, wild, skill = 1, rand = Math.random) {
  const options = [];
  const seen = new Set();
  for (const c of hand) {
    if (isJoker(c, wild) || seen.has(faceOf(c))) continue;
    seen.add(faceOf(c));
    const rest = hand.filter((x) => x !== c);
    options.push({ card: c, d: distance(rest, wild) - value(c, wild) * 0.05, rest });
  }
  if (!options.length) return { card: hand[0], d: 0, rest: hand.slice(1) };
  options.sort((a, b) => a.d - b.d);
  if (options[0].d < -50 || rand() < skill) return options[0];
  return options[Math.min(options.length - 1, 1 + Math.floor(rand() * 3))];
}

/** Whether a computer player takes the open card: if it brings the hand nearer. */
export function takesOpen(hand, top, wild, skill = 1, rand = Math.random) {
  if (!top) return false;
  if (isJoker(top, wild)) return true;
  if (rand() > skill) return false;
  const now = distance(hand, wild);
  const withIt = bestDiscard(hand.concat(top), wild);
  return withIt.card !== top && withIt.d < now - 4;
}
