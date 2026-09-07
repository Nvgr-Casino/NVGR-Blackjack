// Ported verbatim from index4.html (the live, already-deployed app) — pure
// functions only, nothing here touches Firebase or DOM. Cards stay in
// index4's own "RANK-SUIT" string form (e.g. "10-H"); only the 3D bridge
// converts to {rank, suit} objects, right at the point of handing a card
// to the Three.js scene, so this rules engine itself never changes shape.

export const MAX_PUBLIC_SEATS = 5;
// The lobby always offers a choice of tables, topping itself up to this
// many open public tables (see session.js's loadLobby).
export const MIN_PUBLIC_TABLES = 5;
export const STARTING_CHIPS = 100000;
export const BETTING_SECONDS = 20;
// A player's hit/stand/double/split turn also needs a deadline — without
// one, a player who goes silent mid-hand (closes the tab, loses
// connection) leaves currentTurnIndex parked on their turn forever, since
// nothing else ever calls advanceTurnIn for them. Every other seated
// player, and the round itself, would be stuck waiting on a turn that can
// never come. See processTurnTimeoutLogic below.
export const TURN_SECONDS = 20;
export const INSURANCE_SECONDS = 15;
export const MAX_TIMEOUTS = 3;
export const RESULTS_PAUSE_MS = 4000;
export const DEALER_REVEAL_DELAY = 650;

export const SUITS = ['S', 'H', 'D', 'C'];
export const SUIT_GLYPH = { S: '♠', H: '♥', D: '♦', C: '♣' };
export const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

// A real table deals from a multi-deck shoe, not a fresh deck per hand: six
// decks, with a cut card set 1–1.5 decks from the bottom (≈75–80%
// penetration). When the cut card comes out, the hand in progress finishes
// and only then is the shoe reshuffled — and one card is burned before the
// first deal off a new shoe.
export const DECKS_IN_SHOE = 6;
export const BURN_ON_SHUFFLE = 1;

export function newShoe(decks = DECKS_IN_SHOE) {
  const d = [];
  for (let n = 0; n < decks; n++) {
    for (const s of SUITS) for (const r of RANKS) d.push(r + '-' + s);
  }
  for (let i = d.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [d[i], d[j]] = [d[j], d[i]];
  }
  return d;
}

// Cards are drawn off the end, so "cards left" is deck.length and the cut
// card is reached once that count falls to cutCardAt.
function cutCardDepth() { return Math.round(52 + Math.random() * 26); }

export function shuffleShoe(r) {
  r.deck = newShoe();
  r.shoeSize = r.deck.length;
  r.cutCardAt = cutCardDepth();
  for (let i = 0; i < BURN_ON_SHUFFLE; i++) r.deck.pop();
  r.shuffledAt = Date.now();
}

export function shoeNeedsShuffle(r) {
  return !r.deck || !r.deck.length || !r.cutCardAt || r.deck.length <= r.cutCardAt;
}

// Every card drawn anywhere in the game comes through here, so an
// unexpectedly empty shoe can never hand out an undefined card mid-hand.
export function drawCard(r) {
  if (!r.deck || !r.deck.length) shuffleShoe(r);
  return r.deck.pop();
}
export function rankOf(card) { return card.split('-')[0]; }
export function suitOf(card) { return card.split('-')[1]; }
export function cardValue(rank) {
  if (rank === 'A') return 11;
  if (['J', 'Q', 'K'].includes(rank)) return 10;
  return Number(rank);
}
export function handValue(cards) {
  let sum = 0, aces = 0;
  for (const c of cards) {
    const v = cardValue(rankOf(c));
    sum += v;
    if (v === 11) aces++;
  }
  while (sum > 21 && aces > 0) { sum -= 10; aces--; }
  return sum;
}
export function isBlackjack(cards) { return cards.length === 2 && handValue(cards) === 21; }
export function genCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 4; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}
export function safeKey(uid) { return uid.replace(/[.#$[\]/]/g, '_'); }

const AVATAR_COLORS = ['#e0bd52', '#c0392b', '#4fae7c', '#8a1017', '#d8c4a3', '#c9a13a'];
export function avatarColor(name) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}
export function initials(name) {
  return (name || '?').trim().split(/\s+/).slice(0, 2).map((w) => w[0].toUpperCase()).join('');
}

export function addPlayerToRoom(room, uid, name, chips) {
  const key = safeKey(uid);
  if (!room.players) room.players = {};
  if (!room.playerOrder) room.playerOrder = [];
  if (room.players[key]) return;
  room.players[key] = {
    name, chips, hands: [], bet: 0, timeouts: 0,
    status: room.phase === 'betting' ? 'betting' : 'sitout',
  };
  room.playerOrder.push(key);
  room.log = (room.log || []).concat(name + ' joined the table.').slice(-8);
}

export function startRoundLogic(r) {
  r.round = (r.round || 0) + 1;
  // The shoe deliberately carries over between rounds — it is only
  // reshuffled once the cut card shows up (see dealRoundCards).
  r.dealer = { hand: [], hiddenRevealed: false };
  for (const key of r.playerOrder) {
    const p = r.players[key];
    p.hands = []; p.bet = 0; delete p.outcome;
    p.insurance = 0; p.insuranceDecided = false;
    if (r.isPublic && p.chips <= 0) p.chips = STARTING_CHIPS;
    p.status = p.chips > 0 ? 'betting' : 'sitout';
  }
  r.turnOrder = []; r.currentTurnIndex = 0; r.dealtIn = [];
  r.phase = 'betting';
  r.bettingDeadline = Date.now() + BETTING_SECONDS * 1000;
  r.resultsAt = null;
  r.log = ['Round ' + r.round + ' — place your bets.'];
}

export function dealRoundCards(r) {
  const bettors = r.playerOrder.filter((key) => r.players[key].status === 'bet-placed');
  if (bettors.length === 0) return;
  if (shoeNeedsShuffle(r)) {
    shuffleShoe(r);
    r.log = (r.log || []).concat('Cut card — shuffling ' + DECKS_IN_SHOE + ' fresh decks.').slice(-8);
  }
  r.dealtIn = bettors.slice();
  r.turnOrder = [];
  for (const key of r.playerOrder) {
    if (!bettors.includes(key)) { r.players[key].status = 'sitout'; continue; }
    const p = r.players[key];
    const bet = p.bet;
    p.chips -= bet;
    const cards = [drawCard(r), drawCard(r)];
    const handStatus = isBlackjack(cards) ? 'blackjack' : 'playing';
    p.hands = [{ cards, bet, status: handStatus }];
    p.status = 'playing';
    if (handStatus === 'playing') r.turnOrder.push({ pid: key, hi: 0 });
  }
  r.dealer.hand = [drawCard(r), drawCard(r)];
  r.dealer.hiddenRevealed = false;
  r.currentTurnIndex = 0;
  r.bettingDeadline = null;
  r.log = (r.log || []).concat('Cards dealt.').slice(-8);
  // Dealer showing an Ace: insurance is offered before anyone plays.
  if (rankOf(r.dealer.hand[0]) === 'A' && (r.dealtIn || []).length > 0) {
    openInsurance(r);
    return;
  }
  beginPlay(r);
}

// Where a round goes once any insurance question is settled.
function beginPlay(r) {
  if (r.turnOrder.length === 0) { r.turnDeadline = null; r.phase = 'dealer'; resolveDealerAndPayouts(r); }
  else { r.turnDeadline = Date.now() + TURN_SECONDS * 1000; r.phase = 'playing'; }
}

export function openInsurance(r) {
  r.phase = 'insurance';
  r.insuranceDeadline = Date.now() + INSURANCE_SECONDS * 1000;
  for (const key of (r.dealtIn || [])) {
    const p = r.players[key];
    if (!p) continue;
    p.insurance = 0;
    p.insuranceDecided = false;
  }
  r.log = (r.log || []).concat('Dealer shows an Ace — insurance?').slice(-8);
}

export function everyoneDecidedInsurance(r) {
  return (r.dealtIn || []).every((key) => {
    const p = r.players[key];
    return !p || p.insuranceDecided;
  });
}

// Insurance pays 2:1 when the dealer has blackjack — the side bet wins
// exactly when the main bet loses. If the dealer does have it, the round is
// over before anyone plays a card.
export function resolveInsurance(r) {
  if (r.phase !== 'insurance') return;
  const dealerBJ = isBlackjack(r.dealer.hand);
  const notes = [];
  for (const key of (r.dealtIn || [])) {
    const p = r.players[key];
    if (!p || !p.insurance) continue;
    if (dealerBJ) {
      p.chips += p.insurance * 3; // stake back plus 2:1
      notes.push(p.name + ' wins insurance.');
    }
  }
  r.insuranceDeadline = null;
  if (dealerBJ) {
    r.dealer.hiddenRevealed = true;
    r.log = (r.log || []).concat(notes.concat('Dealer has blackjack.')).slice(-8);
    r.turnDeadline = null;
    r.phase = 'dealer';
    resolveDealerAndPayouts(r);
    return;
  }
  r.log = (r.log || []).concat(notes.length ? notes : ['No dealer blackjack — insurance lost.']).slice(-8);
  beginPlay(r);
}

// Mirrors the betting/turn timeouts: an undecided player simply declines.
export function processInsuranceTimeout(r) {
  if (r.phase !== 'insurance') return;
  if (!r.insuranceDeadline) { r.insuranceDeadline = Date.now() + INSURANCE_SECONDS * 1000; return; }
  if (Date.now() < r.insuranceDeadline) return;
  for (const key of (r.dealtIn || [])) {
    const p = r.players[key];
    if (p) p.insuranceDecided = true;
  }
  resolveInsurance(r);
}

export function checkAutoDeal(r) {
  if (!r.isPublic) return;
  const pending = r.playerOrder.some((key) => r.players[key].status === 'betting');
  const anyBettor = r.playerOrder.some((key) => r.players[key].status === 'bet-placed');
  if (!pending && anyBettor) dealRoundCards(r);
}

export function processBettingTimeoutLogic(r) {
  if (r.phase !== 'betting' || !r.bettingDeadline || Date.now() < r.bettingDeadline) return;
  const notes = [];
  for (const key of r.playerOrder.slice()) {
    const p = r.players[key];
    if (p.status === 'betting') {
      p.timeouts = (p.timeouts || 0) + 1;
      if (p.timeouts >= MAX_TIMEOUTS) {
        notes.push(p.name + ' was removed after missing ' + MAX_TIMEOUTS + ' bets.');
        delete r.players[key];
        r.playerOrder = r.playerOrder.filter((x) => x !== key);
      } else {
        p.status = 'sitout';
        notes.push(p.name + ' missed the betting window (' + p.timeouts + '/' + MAX_TIMEOUTS + ').');
      }
    }
  }
  r.bettingDeadline = null;
  r.log = (r.log || []).concat(notes.length ? notes : ['Betting time is up.']).slice(-8);
  checkAutoDeal(r);

  // If the window shut with nobody having bet, the table is left in a
  // betting phase with nothing to deal and every player marked 'sitout' —
  // and since only a new round clears that flag, it would sit there
  // forever. Anyone still at the table gets a fresh round instead.
  if (r.phase === 'betting' && (r.playerOrder || []).length > 0) {
    const stillLive = r.playerOrder.some((key) => {
      const p = r.players[key];
      return p && (p.status === 'betting' || p.status === 'bet-placed');
    });
    if (!stillLive) startRoundLogic(r);
  }
}

export function resolveDealerAndPayouts(r) {
  if (!r.dealer.hand) r.dealer.hand = [];
  while (handValue(r.dealer.hand) < 17) r.dealer.hand.push(drawCard(r));
  r.dealer.hiddenRevealed = true;
  const dv = handValue(r.dealer.hand);
  const dealerBJ = isBlackjack(r.dealer.hand);
  const dealerBust = dv > 21;
  const results = [];
  for (const key of (r.dealtIn || [])) {
    const p = r.players[key];
    if (!p || !p.hands || !p.hands.length) continue;
    const parts = [];
    for (const hand of p.hands) {
      const pv = handValue(hand.cards);
      let outcome;
      // Half the stake was already handed back at the moment of
      // surrendering, so there is nothing left to settle here.
      if (hand.status === 'surrendered') { outcome = 'surrender'; }
      else if (hand.status === 'busted') { outcome = 'lose'; }
      else if (hand.status === 'blackjack') {
        if (dealerBJ) { p.chips += hand.bet; outcome = 'push'; }
        else { const win = Math.floor(hand.bet * 1.5); p.chips += hand.bet + win; outcome = 'blackjack'; }
      } else if (dealerBust || pv > dv) { p.chips += hand.bet * 2; outcome = 'win'; }
      else if (pv === dv) { p.chips += hand.bet; outcome = 'push'; }
      else { outcome = 'lose'; }
      hand.outcome = outcome;
      parts.push(outcome.toUpperCase());
    }
    results.push(p.name + ': ' + parts.join(' / '));
  }
  r.phase = 'results';
  r.resultsAt = Date.now();
  r.log = results;
}

export function advanceTurnIn(r) {
  // r.turnOrder can come back missing (not just empty) from Firebase —
  // Realtime Database prunes empty-array fields off the stored JSON
  // entirely, so a room that emptied its turn order reads back with no
  // turnOrder key at all, not [].
  const turnOrder = r.turnOrder || [];
  r.currentTurnIndex++;
  if (r.currentTurnIndex >= turnOrder.length) {
    r.turnDeadline = null;
    r.phase = 'dealer';
    resolveDealerAndPayouts(r);
  } else {
    r.turnDeadline = Date.now() + TURN_SECONDS * 1000;
  }
}

// Mirrors processBettingTimeoutLogic for the "playing" phase: if the
// current turn's deadline has passed, the player is stood on that hand
// (never auto-hit — standing can only end a hand, never make it worse for
// them) and play moves on. advanceTurnIn always runs here regardless of
// whether a hand/player could be resolved, so a stale or malformed
// turnOrder entry can never wedge currentTurnIndex in place forever.
export function processTurnTimeoutLogic(r) {
  if (r.phase !== 'playing') return;
  // A room dealt before this deadline existed (or otherwise missing one)
  // has no way to ever recover on its own — self-heal by granting a fresh
  // window right now instead of waiting on a deadline that will never
  // arrive.
  if (!r.turnDeadline) { r.turnDeadline = Date.now() + TURN_SECONDS * 1000; return; }
  if (Date.now() < r.turnDeadline) return;
  const cur = (r.turnOrder || [])[r.currentTurnIndex];
  if (cur) {
    const p = r.players[cur.pid];
    const hand = p && p.hands && p.hands[cur.hi];
    if (hand && hand.status === 'playing') {
      hand.status = 'stood';
      r.log = (r.log || []).concat((p.name || 'A player') + ' ran out of time and was stood.').slice(-8);
    }
  }
  advanceTurnIn(r);
}

// Every table advertises its own stakes, the way a real pit does — the
// lobby is a choice between rooms, not five identical ones. A table's
// limits are fixed when it opens and never change under the players.
export const TABLE_STAKES = [
  { min: 100, max: 2000 },
  { min: 500, max: 10000 },
  { min: 1000, max: 25000 },
  { min: 5000, max: 100000 },
  { min: 25000, max: 500000 },
];

// Tables created before stakes existed have no limits stored, so they read
// as the lowest tier rather than breaking.
export function stakesFor(room) {
  const min = (room && room.minBet) || TABLE_STAKES[0].min;
  const max = (room && room.maxBet) || TABLE_STAKES[0].max;
  return { min, max };
}

export function stakesLabel(min, max) {
  const short = (n) => (n >= 1000 ? (n % 1000 ? (n / 1000).toFixed(1) : n / 1000) + 'K' : String(n));
  return short(min) + ' / ' + short(max);
}

// Chip denominations for a table: start at the minimum bet and climb in
// familiar casino steps, always finishing on the table maximum so a player
// can reach either limit without fiddling.
export function chipLadderForTable(min, max) {
  const out = [min];
  for (const m of [2, 5, 10, 25, 50, 100]) {
    const v = min * m;
    if (v < max && out.length < 5) out.push(v);
  }
  out.push(max);
  return [...new Set(out)].slice(0, 6);
}
