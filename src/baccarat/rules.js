// Baccarat — Punto Banco, as the casinos deal it. The rules, and nothing of
// the screen or the database: a room is a plain object these functions
// change, inside a transaction (src/app/baccaratSession.js), so every
// client agrees on the same table.
//
// A round goes betting → dealing → results. Bets are taken from a player's
// chips as they are placed. When the betting window closes with any bet on
// the table, the coup is dealt there and then from the shoe, by the fixed
// drawing rules — nobody decides anything — and every client turns the
// cards over on the same schedule; when the last is up the bets are
// settled and the next window opens.
//
// The bets: player (pays 1 to 1), banker (19 to 20: the house keeps five
// per cent), tie (8 to 1; player and banker bets stand off on a tie), and
// the pairs — player pair, banker pair — on the first two cards of a hand
// being a pair (11 to 1).

export const BACCARAT_SEATS = 7;
export const BETTING_MS = 22000;
export const RESULTS_MS = 6000;
export const MAX_IDLE = 5;
export const DECKS = 8;
export const CUT_AT = 16;           // cards left when the cut card comes out
export const HISTORY = 72;          // results kept for the scoreboard

export const BETS = ['player', 'banker', 'tie', 'ppair', 'bpair'];
export const BET_LABEL = { player: 'Player', banker: 'Banker', tie: 'Tie', ppair: 'Player pair', bpair: 'Banker pair' };

// ---------- cards ----------
const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
const SUITS = ['S', 'H', 'D', 'C'];
export const rankOf = (card) => card.split('-')[0];
// Tens and pictures count nothing; an ace one; the rest their pips.
export const cardPoints = (card) => { const r = rankOf(card); return r === 'A' ? 1 : ['10', 'J', 'Q', 'K'].includes(r) ? 0 : Number(r); };
// A hand counts its points' last digit.
export const handTotal = (cards) => cards.reduce((t, c) => t + cardPoints(c), 0) % 10;

// A fair shuffle of `decks` packs, with crypto's randomness where there is
// any.
function randomInt(n) {
  const c = globalThis.crypto;
  if (c && c.getRandomValues) {
    const buf = new Uint32Array(1);
    const limit = Math.floor(0x100000000 / n) * n;
    for (;;) { c.getRandomValues(buf); if (buf[0] < limit) return buf[0] % n; }
  }
  return Math.floor(Math.random() * n);
}
export function newShoe(decks = DECKS) {
  const shoe = [];
  for (let d = 0; d < decks; d++) for (const s of SUITS) for (const r of RANKS) shoe.push(r + '-' + s);
  for (let i = shoe.length - 1; i > 0; i--) { const j = randomInt(i + 1); [shoe[i], shoe[j]] = [shoe[j], shoe[i]]; }
  return shoe;
}

// ---------- the coup ----------
// The banker's third card, by the tableau: what the banker holds against
// the player's third card (null if the player stood).
export function bankerDraws(bankerTotal, playerThird) {
  if (playerThird === null) return bankerTotal <= 5;
  const p = cardPoints(playerThird);
  if (bankerTotal <= 2) return true;
  if (bankerTotal === 3) return p !== 8;
  if (bankerTotal === 4) return p >= 2 && p <= 7;
  if (bankerTotal === 5) return p >= 4 && p <= 7;
  if (bankerTotal === 6) return p === 6 || p === 7;
  return false;
}
// Deals a coup from `draw()` (the next card off the shoe), by the rules:
// two cards each, player first; a natural (8 or 9) on either side stands
// both; otherwise the player draws on 0–5, and the banker by the tableau.
// The cards are kept in the order they come out of the shoe.
export function dealCoup(draw) {
  const player = [draw()], banker = [draw()];
  player.push(draw());
  banker.push(draw());
  const order = ['P', 'B', 'P', 'B'];
  const p2 = handTotal(player), b2 = handTotal(banker);
  const natural = p2 >= 8 || b2 >= 8;
  if (!natural) {
    let third = null;
    if (p2 <= 5) { third = draw(); player.push(third); order.push('P'); }
    if (bankerDraws(b2, third)) { banker.push(draw()); order.push('B'); }
  }
  const pt = handTotal(player), bt = handTotal(banker);
  return {
    player, banker, order, natural,
    ptotal: pt, btotal: bt,
    winner: pt > bt ? 'player' : bt > pt ? 'banker' : 'tie',
    ppair: rankOf(player[0]) === rankOf(player[1]),
    bpair: rankOf(banker[0]) === rankOf(banker[1]),
  };
}

// When each card is turned, ms after the deal began: the four in turn,
// then any third cards, with a breath before them; and when it is over.
export const REVEAL_MS = [900, 1800, 2700, 3600];
export function revealTimes(hand) {
  const times = REVEAL_MS.slice(0, 4);
  let t = 3600;
  for (let i = 4; i < hand.order.length; i++) { t += 1500; times.push(t); }
  return times;
}
export const dealDuration = (hand) => revealTimes(hand).slice(-1)[0] + 1800;

// What a set of bets wins on a coup: the total returned, stake included.
export function winningsFor(bets, hand) {
  let back = 0;
  Object.entries(bets || {}).forEach(([id, amount]) => {
    if (id === 'player') back += hand.winner === 'player' ? amount * 2 : hand.winner === 'tie' ? amount : 0;
    else if (id === 'banker') back += hand.winner === 'banker' ? amount + Math.floor(amount * 0.95) : hand.winner === 'tie' ? amount : 0;
    else if (id === 'tie') back += hand.winner === 'tie' ? amount * 9 : 0;
    else if (id === 'ppair') back += hand.ppair ? amount * 12 : 0;
    else if (id === 'bpair') back += hand.bpair ? amount * 12 : 0;
  });
  return back;
}

// ---------- the room ----------
export function newBaccaratRoom({ code, minBet, maxBet, isPublic = true, adminId = null, dealerType = 'male' }) {
  const shoe = newShoe();
  return {
    code, game: 'baccarat', isPublic, adminId, minBet, maxBet, dealerType,
    players: {}, playerOrder: [],
    phase: 'betting', round: 1, bettingDeadline: null, dealAt: null, resultsAt: null,
    shoe, shoeSize: shoe.length, hand: null, history: [], chat: [], log: ['Table open. Place your bets.'],
  };
}

const live = (r) => (r.playerOrder || []).filter((k) => r.players && r.players[k]);
const note = (r, line) => { r.log = (r.log || []).concat(line).slice(-8); };

// Seats fill from the middle of the table outward, so the first players
// sit square to the dealer and the hands, not out at the ends.
const SEAT_ORDER = [3, 2, 4, 1, 5, 0, 6];
export function firstFreeSeat(r) {
  const taken = new Set(live(r).map((k) => r.players[k].seat));
  for (const i of SEAT_ORDER) if (!taken.has(i)) return i;
  return -1;
}
export function addPlayer(r, key, name, chips, character) {
  r.players = r.players || {};
  r.playerOrder = r.playerOrder || [];
  if (r.players[key]) { r.players[key].idle = 0; return true; }
  const seat = firstFreeSeat(r);
  if (seat < 0) return false;
  r.players[key] = { name, chips, character: character || null, seat, bets: null, placed: null, lastBets: null, idle: 0, result: null };
  r.playerOrder.push(key);
  return true;
}

export function moveSeat(r, key, seat) {
  const p = r.players && r.players[key];
  if (!p || seat < 0 || seat >= BACCARAT_SEATS) return false;
  if (live(r).some((k) => k !== key && r.players[k].seat === seat)) return false;
  p.seat = seat;
  return true;
}

export const totalBet = (p) => Object.values((p && p.bets) || {}).reduce((a, b) => a + b, 0);
export const anyBets = (r) => live(r).some((k) => totalBet(r.players[k]) > 0);
export const bettingOpen = (r, now) => r.phase === 'betting' && (!r.bettingDeadline || now < r.bettingDeadline);

export function placeBet(r, key, id, amount, now) {
  const p = r.players && r.players[key];
  amount = Math.floor(Number(amount));
  if (!p || !bettingOpen(r, now) || !BETS.includes(id) || !(amount > 0)) return false;
  if (amount > p.chips || totalBet(p) + amount > r.maxBet) return false;
  p.bets = p.bets || {};
  p.bets[id] = (p.bets[id] || 0) + amount;
  p.placed = (p.placed || []).concat([[id, amount]]).slice(-40);
  p.chips -= amount;
  p.idle = 0;
  if (!r.bettingDeadline) r.bettingDeadline = now + BETTING_MS;
  return true;
}
export function undoBet(r, key, now) {
  const p = r.players && r.players[key];
  if (!p || !bettingOpen(r, now) || !p.placed || !p.placed.length) return false;
  const [id, amount] = p.placed[p.placed.length - 1];
  p.placed = p.placed.slice(0, -1);
  const left = (p.bets[id] || 0) - amount;
  if (left > 0) p.bets[id] = left; else delete p.bets[id];
  p.chips += amount;
  return true;
}
export function clearBets(r, key, now) {
  const p = r.players && r.players[key];
  if (!p || !bettingOpen(r, now)) return false;
  p.chips += totalBet(p);
  p.bets = null;
  p.placed = null;
  return true;
}
function placeAll(r, key, bets, now) {
  const p = r.players && r.players[key];
  if (!p || !bets || !bettingOpen(r, now)) return false;
  const sum = Object.values(bets).reduce((a, b) => a + b, 0);
  if (!sum || sum > p.chips || totalBet(p) + sum > r.maxBet || !Object.keys(bets).every((id) => BETS.includes(id))) return false;
  Object.entries(bets).forEach(([id, amount]) => placeBet(r, key, id, amount, now));
  return true;
}
export const repeatBets = (r, key, now) => placeAll(r, key, r.players && r.players[key] && r.players[key].lastBets, now);
export const doubleBets = (r, key, now) => placeAll(r, key, r.players && r.players[key] && r.players[key].bets && { ...r.players[key].bets }, now);

// No more bets: the coup is dealt from the shoe, a fresh shoe first if the
// cut card has come out.
export function deal(r, now) {
  if (r.phase !== 'betting' || !anyBets(r)) return false;
  if (!r.shoe || r.shoe.length < CUT_AT) {
    r.shoe = newShoe();
    r.shoeSize = r.shoe.length;
    // A new shoe, a fresh table talk.
    r.chat = null;
    note(r, 'A new shoe.');
  }
  r.hand = dealCoup(() => r.shoe.pop());
  r.phase = 'dealing';
  r.dealAt = now;
  r.bettingDeadline = null;
  note(r, 'No more bets.');
  return true;
}

function settleOne(r, key) {
  const p = r.players[key];
  const bet = totalBet(p);
  if (!bet) { p.result = null; return; }
  const won = winningsFor(p.bets, r.hand);
  p.chips += won;
  p.result = { bet, won, net: won - bet };
  p.lastBets = p.bets;
  p.bets = null;
  p.placed = null;
}
// Someone leaving mid-coup has their bets settled there and then: the
// cards were all dealt when the coup began.
export function settlePlayer(r, key) {
  if (r.phase === 'dealing' && r.hand && r.players && r.players[key]) settleOne(r, key);
}
export function settle(r, now) {
  if (r.phase !== 'dealing' || !r.hand) return false;
  live(r).forEach((k) => settleOne(r, k));
  const mark = { player: 'P', banker: 'B', tie: 'T' }[r.hand.winner];
  r.history = (r.history || []).concat(mark + (r.hand.ppair ? 'p' : '') + (r.hand.bpair ? 'b' : '')).slice(-HISTORY);
  r.phase = 'results';
  r.resultsAt = now;
  note(r, r.hand.winner === 'tie' ? `Tie, ${r.hand.ptotal} all.` : `${r.hand.winner === 'player' ? 'Player' : 'Banker'} wins, ${Math.max(r.hand.ptotal, r.hand.btotal)} over ${Math.min(r.hand.ptotal, r.hand.btotal)}.`);
  return true;
}

function countIdle(r, betters) {
  const removed = [];
  live(r).forEach((k) => {
    const p = r.players[k];
    p.idle = betters.has(k) ? 0 : (p.idle || 0) + 1;
    if (p.idle >= MAX_IDLE) { removed.push(k); delete r.players[k]; }
  });
  if (removed.length) r.playerOrder = live(r);
  return removed;
}
export function nextRound(r, now) {
  if (r.phase !== 'results') return [];
  const betters = new Set(live(r).filter((k) => r.players[k].result));
  const removed = countIdle(r, betters);
  live(r).forEach((k) => { r.players[k].result = null; });
  r.phase = 'betting';
  r.round = (r.round || 0) + 1;
  r.hand = null;
  r.dealAt = null;
  r.resultsAt = null;
  r.bettingDeadline = live(r).length ? now + BETTING_MS : null;
  note(r, 'Place your bets.');
  return removed;
}

// One step of the table's clock, whoever's client takes it.
export function tick(r, now) {
  if (r.phase === 'betting') {
    if (!r.bettingDeadline) {
      if (!live(r).length) return false;
      r.bettingDeadline = now + BETTING_MS;
      return true;
    }
    if (now < r.bettingDeadline) return false;
    if (anyBets(r)) return deal(r, now);
    countIdle(r, new Set());
    r.bettingDeadline = live(r).length ? now + BETTING_MS : null;
    return true;
  }
  if (r.phase === 'dealing') return now >= r.dealAt + dealDuration(r.hand) ? settle(r, now) : false;
  if (r.phase === 'results') return now >= r.resultsAt + RESULTS_MS ? (nextRound(r, now), true) : false;
  return false;
}
