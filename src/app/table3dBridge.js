// Bridges the real Firebase room (src/app/session.js, src/app/roomLogic.js)
// to the 3D scene (src/ui/gameController.js's driver). Owns the table
// screen's HTML chrome too (header/log/controls/admin/chat) — ported from
// index4.html's renderTable()/attachTable(), minus the felt-oval/seats-row
// markup the 3D scene now draws instead.
import { createTableDriver } from '../ui/gameController.js';
import {
  MAX_PUBLIC_SEATS, MAX_TIMEOUTS, rankOf, suitOf, handValueLabel,
  chipLadderForTable, stakesFor, stakesLabel, safeKey, seatOf, countdownLabel, canSplitCards, stakesTier, roomName,
} from './roomLogic.js';
import { dealerKeyFor } from '../scene/dealer.js';
import { chipButtonDataURL } from '../scene/chip.js';
import { prefetchCardFaces, cardFaceUrl } from '../scene/card.js';
import { DEAL_MS } from '../scene/deal.js';
import { SHUFFLE_MS } from '../scene/shuffle.js';
import { characterPortraitDataURL, defaultCharacterFor } from '../scene/character.js';
import { esc } from './uiHelpers.js';
import * as S from './session.js';
import * as Social from './social.js';
import * as BT from '../blackjack/tournament.js';
import * as BJT from './bjTournamentSession.js';
import * as OfflineBJ from './offlineBlackjack.js';

// One card every DEAL_STEP_MS: long enough for the dealer's hand to take
// each card from the shoe and set it down before reaching for the next.
// The readout shows a card once it is down (deal.js's DEAL_MS).
const DEAL_STEP_MS = DEAL_MS;
const CARD_FLIGHT_MS = DEAL_MS;
const REVEAL_MS = 600;
// The dealer's other moves on the same timeline: lifting the hole card's
// corner to check it, taking a busted bet, setting a split pair apart, and
// a doubled stake going down.
const PEEK_MS = 900;
const COLLECT_MS = 1900;   // the bet, then the cards
const SPLIT_MS = 350;
const STAKE_MS = 500;

// The dealer does one thing at a time. Everything the table shows the
// dealer doing — dealing, turning the hole card, settling, shuffling — is
// queued on this one timeline, so a hit arriving while the deal is still
// being shown waits its turn instead of overlapping it, the settling begins
// only once the dealer's own hand is complete, and a shuffle waits for the
// last hand to be picked up. The driver queues its own settling moves
// (gameController.js's dealerTask), so the timeline waits for those too.
let dealerFreeAt = 0;
function dealerSlot(durationMs) {
  const now = performance.now();
  const start = Math.max(now, dealerFreeAt, driver ? driver.dealerBusyUntil() : 0);
  dealerFreeAt = start + durationMs;
  return start - now;
}

// What a hand won, not counting its own stake coming back — "Won 1,000" on
// a 500 bet read as twice the real win.
const OUTCOME_LABEL = {
  win: (bet) => 'Won ' + bet.toLocaleString(),
  blackjack: (bet) => 'Blackjack — won ' + Math.floor(bet * 1.5).toLocaleString(),
  push: () => 'Push',
  lose: (bet) => 'Lost ' + bet.toLocaleString(),
  surrender: (bet) => 'Surrendered — kept ' + Math.floor(bet / 2).toLocaleString(),
};

let driver = null;

// Diffing state — reset whenever a new round starts.
let lastRound = null;
let lastShuffledAt = null;   // the room stamp of the last reshuffle we animated
let lastCounts = {}; // `${seatIndex}:${handIndex}` -> cards.length last seen
let lastDealerCount = 0;
let dealerRevealed = false;
let betChipsShown = {}; // seatIndex -> bool, whether we've drawn a bet chip this round
// seatIndex -> the stake drawn on the felt so far, so a double or a split
// adds only the new stake.
let stakeShown = {};
// Seats whose busted bet the dealer has already taken.
let collectedSeats = {};
let peekShown = false;
// What the shoe is showing, and whether a shuffle is waiting its turn on the
// dealer's timeline (the room's shoe is already full by then, but the
// table's isn't until the dealer has shuffled it).
let shoeShown = 0;
let shufflePending = false;
// The results are in the room the moment the last hand is played, but the
// table only says who won once the dealer has played their hand out and
// begins to settle — not before the hole card is even turned.
let resultsShown = false;
// Seats whose bet-spot chips were already built locally, one at a time, by
// tapping the bet-ladder buttons (see attachTableScreen) — when Firebase
// then confirms that bet, the sync loop below must not draw a second,
// decorative stack on top of the real one the player just tapped out.
let localPendingSeats = {};
let lastPhase = null;
// Cards that have finished their flight, for the hand readout: keyed like
// lastCounts, plus the dealer's. roundToken stops a flight still in the air
// from the last round from counting toward this one.
let landed = {};
let landedDealer = 0;
let holeShown = false;
let roundToken = 0;

let setFeltTheme = () => {};
let setDealerModel = () => {};
let setRoomTheme = () => {};
let setGame = () => {};

export function mountTable3D(sceneHandles) {
  driver = createTableDriver(sceneHandles);
  setFeltTheme = sceneHandles.setFeltTheme || (() => {});
  setDealerModel = sceneHandles.setDealerModel || (() => {});
  setRoomTheme = sceneHandles.setRoomTheme || (() => {});
  setGame = sceneHandles.setGame || (() => {});
  return driver;
}

function toCard(str) { return { rank: rankOf(str), suit: suitOf(str) }; }

function cardsOnTable(room) {
  let n = ((room.dealer && room.dealer.hand) || []).length;
  Object.values(room.players || {}).forEach((p) => (p.hands || []).forEach((h) => { n += (h.cards || []).length; }));
  return n;
}

function resetLanded() {
  landed = {};
  landedDealer = 0;
  holeShown = false;
  roundToken++;
}

function resetRoundVisuals() {
  driver.clearAllMeshes();
  resetLanded();
  lastCounts = {};
  lastDealerCount = 0;
  dealerRevealed = false;
  betChipsShown = {};
  localPendingSeats = {};
  stakeShown = {};
  collectedSeats = {};
  peekShown = false;
  resultsShown = false;
}

// Greedily breaks a bet amount into ladder-denomination chips, largest
// first, so a lump sum (another seat's already-confirmed bet, or this
// player's own "Repeat last bet") still lands on the felt as a real stack
// instead of one oversized chip. Real bets are always built from taps
// along this same ladder, so the breakdown is exact in practice.
function decomposeAmount(amount, ladder) {
  const indices = [];
  let remaining = amount;
  for (let i = ladder.length - 1; i >= 0 && remaining > 0 && indices.length < 24; i--) {
    while (remaining >= ladder[i] && indices.length < 24) {
      indices.push(i);
      remaining -= ladder[i];
    }
  }
  return indices;
}

function spawnBetStack(seatIndex, amount, ladder) {
  decomposeAmount(amount, ladder).forEach((idx, i) => {
    setTimeout(() => driver.addBetChipVisual(seatIndex, idx, ladder[idx]), i * 90);
  });
}

// ---------- the real sync ----------
export function syncRoomToScene(room, myKey) {
  if (!driver || !room) return;
  prefetchCardFaces();

  // Each table has a room and a dealer of its own, by its stakes.
  const tier = stakesTier(room);
  setGame('blackjack');
  setFeltTheme(room.felt);
  setRoomTheme(tier);
  setDealerModel(dealerKeyFor(tier, room.dealerType));

  if (room.round !== lastRound) {
    lastRound = room.round;
    resetRoundVisuals();
  }

  // The shoe was replaced — riffle the deck so the reshuffle is something
  // you see, not just a line in the log. shuffledAt is the room's own stamp,
  // so every player at the table watches it at the same moment, and
  // comparing against the last one seen means re-renders don't replay it.
  const total = room.shoeSize || 312;
  const shoeLeft = (room.deck || []).length;
  if (room.shuffledAt && room.shuffledAt !== lastShuffledAt) {
    const firstSight = lastShuffledAt === null;
    lastShuffledAt = room.shuffledAt;
    // Don't shuffle at someone who just walked up to a table mid-shoe; only
    // a shuffle that happens while they are watching is worth showing.
    if (firstSight) {
      // The used cards are in the discard holder: all that have left the
      // shoe but those still on the felt.
      driver.setDiscard(Math.max(0, total - shoeLeft - cardsOnTable(room)));
    } else {
      // Once the dealer has finished with the last hand, from what the
      // shoe was showing.
      const from = shoeShown;
      const cutAt = room.cutCardAt;
      shufflePending = true;
      const wait = dealerSlot(SHUFFLE_MS);
      setTimeout(() => driver.shuffleShoe({ shoeLeft: from, total, cutAt }), wait);
      setTimeout(() => { shufflePending = false; }, wait + SHUFFLE_MS);
    }
  }
  if (!shufflePending) {
    shoeShown = shoeLeft;
    driver.setShoe(shoeLeft, total, room.cutCardAt);
  }

  const order = room.playerOrder || [];
  // Keyed off each player's real chair, not their position in the join
  // queue — those are different things now that players can move.
  const seatIndexOf = new Map(order.map((key) => [key, seatOf(room, key)]));

  // Sit the camera down in your own chair. Which seat is yours is your join
  // order, so it isn't known until the room arrives — the scene has to open
  // on some seat before then, and that placeholder was being left in place
  // for the whole session. Once you have picked a viewpoint by hand this
  // stops moving the camera (see followSeat).
  const mySeatIndex = myKey === null || myKey === undefined ? undefined : seatIndexOf.get(myKey);
  if (mySeatIndex !== undefined) driver.followSeat(mySeatIndex);

  // Seat the chosen figure for every occupied seat, and empty the rest.
  const occupant = new Map();
  order.forEach((key) => occupant.set(seatIndexOf.get(key), key));
  for (let i = 0; i < MAX_PUBLIC_SEATS; i++) {
    const key = occupant.get(i);
    const p = key && room.players ? room.players[key] : null;
    if (p) driver.applySeatCharacter(i, p.character || defaultCharacterFor(key));
    else driver.clearSeatCharacter(i);
  }

  // Bet chips: draw the stack the moment a seat's bet is placed, clear on a
  // fresh round. If the local player already tapped this seat's chips out
  // by hand (localPendingSeats), the real stack is already sitting there —
  // skip the decorative rebuild and just mark it shown.
  order.forEach((key) => {
    const seatIndex = seatIndexOf.get(key);
    const p = room.players[key];
    if (!p) return;
    if (p.status === 'bet-placed' && !betChipsShown[seatIndex]) {
      betChipsShown[seatIndex] = true;
      stakeShown[seatIndex] = p.bet;
      if (!localPendingSeats[seatIndex]) {
        const { min, max } = stakesFor(room);
        spawnBetStack(seatIndex, p.bet, chipLadderForTable(min, max));
      }
    }
    if (p.status === 'betting' && betChipsShown[seatIndex]) {
      betChipsShown[seatIndex] = false;
      delete stakeShown[seatIndex];
      localPendingSeats[seatIndex] = false;
      driver.clearBetChipsForSeat(seatIndex);
    }
    // A seat that never confirmed (e.g. missed the betting window and got
    // pushed to 'sitout') can still have chips sitting on the felt from
    // taps that were never followed by "Place bet" — sweep those too. Only
    // a seat sitting out: this once matched 'playing' as well, and wiped
    // every bet off the felt the moment the cards came out, leaving the
    // dealer nothing to take or pay.
    if (p.status === 'sitout' && (betChipsShown[seatIndex] || localPendingSeats[seatIndex])) {
      betChipsShown[seatIndex] = false;
      localPendingSeats[seatIndex] = false;
      driver.clearBetChipsForSeat(seatIndex);
    }
  });

  // Collect every newly-appeared card across dealer + every seat's hands
  // into one list, so an initial deal (or the dealer's whole draw-to-17
  // sequence, which lands in a single Firebase transaction) still animates
  // one card at a time instead of popping in all at once.
  //
  // Dealer and seat cards are gathered separately because the order they
  // are *played* in is not the order they are stored in. See the interleave
  // below.
  const dealerEvents = [];
  const seatEvents = [];

  if (room.phase === 'insurance' || room.phase === 'playing' || room.phase === 'dealer' || room.phase === 'results') {
    const dHand = room.dealer.hand || [];
    // The hole card always goes down face down, even when it is already
    // known to be turned (a blackjack found on the peek): it is turned over
    // in front of everyone, below.
    for (let i = lastDealerCount; i < dHand.length; i++) {
      dealerEvents.push({ kind: 'dealer', index: i, card: dHand[i], faceDown: i === 1 });
    }
    lastDealerCount = dHand.length;
  }

  // A pair just split: the second card slides across to start the new
  // hand, before either hand is dealt anything more.
  const splits = [];
  order.forEach((key) => {
    const seatIndex = seatIndexOf.get(key);
    const p = room.players[key];
    if (!p || !p.hands || p.hands.length !== 2) return;
    if (lastCounts[seatIndex + ':1'] === undefined && (lastCounts[seatIndex + ':0'] || 0) >= 2) {
      splits.push(seatIndex);
      lastCounts[seatIndex + ':0'] = 1;
      lastCounts[seatIndex + ':1'] = 1;
      landed[seatIndex + ':0'] = Math.min(landed[seatIndex + ':0'] || 0, 1);
      landed[seatIndex + ':1'] = 1;
    }
  });

  // A doubled or split bet puts its second stake down beside the first.
  const extraStakes = [];
  order.forEach((key) => {
    const seatIndex = seatIndexOf.get(key);
    const p = room.players[key];
    if (!p || !p.hands || !p.hands.length || stakeShown[seatIndex] === undefined) return;
    const staked = p.hands.reduce((sum, h) => sum + (h.bet || 0), 0);
    if (staked > stakeShown[seatIndex]) {
      extraStakes.push({ seatIndex, amount: staked - stakeShown[seatIndex] });
      stakeShown[seatIndex] = staked;
    }
  });

  order.forEach((key) => {
    const seatIndex = seatIndexOf.get(key);
    const p = room.players[key];
    if (!p || !p.hands) return;
    p.hands.forEach((hand, handIndex) => {
      const countKey = seatIndex + ':' + handIndex;
      const seen = lastCounts[countKey] || 0;
      for (let i = seen; i < hand.cards.length; i++) {
        seatEvents.push({
          kind: 'seat', seatIndex, handIndex, handCount: p.hands.length, index: i, card: hand.cards[i],
          // A busted box's bet is taken the moment it busts, as at a real
          // table — not left out until the dealer has played. (A split
          // seat's chips are shared between its hands, so those wait.)
          collect: hand.status === 'busted' && i === hand.cards.length - 1 && p.hands.length === 1,
        });
      }
      lastCounts[countKey] = hand.cards.length;
    });
  });

  // Play the cards out in the order a dealer's hands actually move: one to
  // every box along the table, then one to the dealer, then round again.
  // The cards were already *dealt* that way (see dealRoundCards), but they
  // arrive here as a finished hand per player, and animating them in that
  // stored order would show one box receiving both its cards before the
  // next box gets any — the very thing that looked wrong at a full table.
  // Beyond the opening two passes each event is a lone hit or split card,
  // where the pass loop simply finds one thing to do.
  const events = [];
  const passes = Math.max(
    ...dealerEvents.map((e) => e.index + 1),
    ...seatEvents.map((e) => e.index + 1),
    0
  );
  for (let pass = 0; pass < passes; pass++) {
    seatEvents
      .filter((e) => e.index === pass)
      .sort((a, b) => a.seatIndex - b.seatIndex || a.handIndex - b.handIndex)
      .forEach((e) => events.push(e));
    dealerEvents.filter((e) => e.index === pass).forEach((e) => events.push(e));
  }

  // What the dealer does, in the order a real one does it — several of
  // these can arrive in one update (the last player's hit, the dealer's
  // whole hand and the results all land in one transaction):
  //   1. the opening deal, round the table twice;
  //   2. with an ace or a ten showing, the peek at the hole card;
  //   3. each box's hits, doubles and splits, first base to third, a busted
  //      bet taken as it busts;
  //   4. the hole card turned over;
  //   5. the dealer's own draws.
  const dealsHole = dealerEvents.some((e) => e.index === 1);
  const opening = [];
  const played = [];
  const dealerDraws = [];
  events.forEach((ev) => {
    if (ev.kind === 'dealer') (ev.index < 2 ? opening : dealerDraws).push(ev);
    else (dealsHole && ev.index < 2 ? opening : played).push(ev);
  });
  played.sort((a, b) => a.seatIndex - b.seatIndex || a.handIndex - b.handIndex || a.index - b.index);

  const token = roundToken;
  const later = (ms, run) => setTimeout(() => { if (token === roundToken) run(); }, dealerSlot(ms));
  const deal = (ev) => {
    const wait = dealerSlot(DEAL_STEP_MS);
    setTimeout(() => {
      if (token !== roundToken) return;
      if (ev.kind === 'dealer') {
        driver.dealDealerCard(ev.index, toCard(ev.card), { faceDown: ev.faceDown });
      } else {
        driver.dealCardToSeat(ev.seatIndex, ev.handIndex, ev.index, toCard(ev.card), ev.handCount);
      }
    }, wait);
    setTimeout(() => {
      if (token !== roundToken) return;
      if (ev.kind === 'dealer') landedDealer = Math.max(landedDealer, ev.index + 1);
      else {
        const k = ev.seatIndex + ':' + ev.handIndex;
        landed[k] = Math.max(landed[k] || 0, ev.index + 1);
      }
      refreshHandStrip();
    }, wait + CARD_FLIGHT_MS);
    if (ev.collect) {
      collectedSeats[ev.seatIndex] = true;
      later(COLLECT_MS, () => {
        driver.collectBetChipsForSeat(ev.seatIndex);
        driver.collectSeatCards(ev.seatIndex);
      });
    }
  };

  opening.forEach(deal);

  if (room.dealer.peeked && !peekShown && lastDealerCount >= 2) {
    peekShown = true;
    later(PEEK_MS, () => driver.peekDealerCard(1));
  }

  extraStakes.forEach(({ seatIndex, amount }) => {
    const { min, max } = stakesFor(room);
    later(STAKE_MS, () => spawnBetStack(seatIndex, amount, chipLadderForTable(min, max)));
  });
  splits.forEach((seatIndex) => later(SPLIT_MS, () => driver.splitSeatHand(seatIndex, 0, 2)));
  played.forEach(deal);

  // The hole card is turned before the dealer draws to it — and turned even
  // when every box has bust and there is nothing to draw to.
  if (room.dealer.hiddenRevealed && !dealerRevealed && lastDealerCount >= 2) {
    dealerRevealed = true;
    later(REVEAL_MS, () => {
      driver.revealDealerCard(1);
      holeShown = true;
      refreshHandStrip();
    });
  }

  dealerDraws.forEach(deal);

  refreshBadges(room);

  // Payout/collect chips once results land for this round.
  if (room.phase === 'results' && lastPhase !== 'results') {
    // Settled once the dealer's hand is down, a seat at a time on the same
    // timeline — the driver paces each one itself.
    const settleToken = roundToken;
    const settle = () => {
      if (settleToken !== roundToken) return;
      resultsShown = true;
      S.refresh();
      settleSeats(room, seatIndexOf);
    };
    setTimeout(settle, dealerSlot(300));
  }

  lastPhase = room.phase;
}

// Pays or collects each seat's bet, a seat at a time, from the dealer's
// right round to their left (highest seat index first — the reverse of the
// deal).
function settleSeats(room, seatIndexOf) {
  (room.dealtIn || [])
    .map((key) => ({ key, seatIndex: seatIndexOf.get(key) }))
    .filter((x) => x.seatIndex !== undefined)
    .sort((a, b) => b.seatIndex - a.seatIndex)
    .forEach(({ key, seatIndex }) => {
      const p = room.players[key];
      if (!p || !p.hands) return;
      betChipsShown[seatIndex] = false;
      localPendingSeats[seatIndex] = false;
      if (collectedSeats[seatIndex]) return;
      const outcomes = p.hands.map((h) => h.outcome);
      const anyWin = outcomes.some((o) => o === 'win' || o === 'blackjack');
      const anyLose = outcomes.some((o) => o === 'lose' || o === 'surrender');
      if (anyWin) driver.payoutChipsForSeat(seatIndex, outcomes.includes('blackjack') ? 3 : 2);
      else if (anyLose) driver.collectBetChipsForSeat(seatIndex);
      else driver.drawChipsHome(seatIndex);
      // Then the box's cards go into the discard holder.
      driver.collectSeatCards(seatIndex);
    });
  // The dealer's own hand last.
  driver.collectDealerCards();
}

// How much of the shoe is left, as a few words for the table line.
function shoeLabel(r) {
  if (!r.shoeSize) return '';
  const left = (r.deck || []).length;
  const pct = Math.max(0, Math.min(100, Math.round((left / r.shoeSize) * 100)));
  const justShuffled = r.shuffledAt && Date.now() - r.shuffledAt < 8000;
  return justShuffled ? 'Fresh shoe' : 'Shoe ' + pct + '%';
}

// ---------- hand readout ----------
// Your hand and the dealer's as flat card images with their totals, just
// above the action bar. The 3D cards are as sharp as the screen allows, but
// a laptop that can't render at its display's full resolution softens the
// whole picture, and card corners — the finest detail in it — go first.
// These are drawn by the browser at native resolution, so they never blur;
// each appears only once its 3D card has landed, so they never run ahead of
// the deal.
function cardImg(card) {
  return `<img class="rc" src="${cardFaceUrl(rankOf(card), suitOf(card))}" alt="${esc(rankOf(card) + suitOf(card))}">`;
}

function handStripHtml(r, myKey) {
  if (!r || !['insurance', 'playing', 'dealer', 'results'].includes(r.phase)) return '';
  const me = r.players && r.players[myKey];
  const mySeat = myKey ? seatOf(r, myKey) : -1;

  const dHand = (r.dealer && r.dealer.hand) || [];
  const dShown = dHand.slice(0, landedDealer);
  if (!dShown.length) return '';
  const holeHidden = dShown.length >= 2 && !(r.dealer.hiddenRevealed && holeShown);
  const dealerCards = dShown.map((c, i) => (i === 1 && holeHidden ? '<span class="rc rc-back"></span>' : cardImg(c))).join('');
  const dealerTotal = handValueLabel(holeHidden ? dShown.slice(0, 1) : dShown);

  let mine = '';
  if (me && me.hands && me.hands.length && mySeat !== -1) {
    const cur = r.turnOrder && r.turnOrder[r.currentTurnIndex];
    mine = me.hands.map((h, hi) => {
      const shown = h.cards.slice(0, landed[mySeat + ':' + hi] || 0);
      if (!shown.length) return '';
      const active = r.phase === 'playing' && cur && cur.pid === myKey && cur.hi === hi && me.hands.length > 1;
      const allDown = shown.length === h.cards.length;
      const tag = r.phase === 'results' && resultsShown && h.outcome ? `<span class="rs-tag ${h.outcome}">${esc(OUTCOME_LABEL[h.outcome](h.bet))}</span>`
        : h.status === 'busted' && allDown ? '<span class="rs-tag lose">Bust</span>'
        : h.status === 'blackjack' && allDown ? '<span class="rs-tag win">Blackjack</span>' : '';
      return `
        <div class="rs-hand ${active ? 'active' : ''}">
          <div class="rs-cards">${shown.map(cardImg).join('')}</div>
          <span class="rs-total">${handValueLabel(shown)}</span>${tag}
        </div>`;
    }).join('');
  }

  return `
    <div class="readout" id="handStrip">
      <div class="rs-side">
        <span class="rs-label">Dealer</span>
        <div class="rs-hand"><div class="rs-cards">${dealerCards}</div><span class="rs-total">${dealerTotal}</span></div>
      </div>
      ${mine ? `<div class="rs-side"><span class="rs-label">You</span>${mine}</div>` : ''}
    </div>`;
}

// Redraws just the readout, between room updates, as each card lands.
// Hand totals on the felt count only the cards that are down — the whole
// hand arrives at once, and a total for the dealer's next three cards
// showed while the first of them was still in the shoe.
function refreshBadges(room) {
  if (!driver || !room) return;
  const dealt = room.phase !== 'betting' && room.phase !== 'lobby';
  (room.playerOrder || []).forEach((key) => {
    const seatIndex = seatOf(room, key);
    const p = room.players[key];
    if (!p) return;
    if (!dealt || !p.hands || !p.hands.length) { driver.hideSeatBadges(seatIndex); return; }
    p.hands.forEach((hand, handIndex) => {
      const down = hand.cards.slice(0, landed[seatIndex + ':' + handIndex] || 0);
      if (down.length) driver.setSeatBadge(seatIndex, handIndex, p.hands.length, handValueLabel(down));
    });
  });
  const dHand = (room.dealer && room.dealer.hand) || [];
  const shown = dHand.slice(0, landedDealer).filter((_, i) => i !== 1 || holeShown);
  if (dealt && shown.length) driver.setDealerBadge(handValueLabel(shown));
  else driver.hideDealerBadge();
}

function refreshHandStrip() {
  const r = S.session.room;
  if (!r) return;
  refreshBadges(r);
  if (S.session.screen !== 'table') return;
  const html = handStripHtml(r, safeKey(S.session.uid));
  const el = document.getElementById('handStrip');
  if (el) {
    if (html) el.outerHTML = html; else el.remove();
  } else if (html) {
    const dock = document.querySelector('.hud-dock');
    if (dock) dock.insertAdjacentHTML('afterbegin', html);
    else document.getElementById('root').insertAdjacentHTML('beforeend', `<div class="hud-dock">${html}</div>`);
  }
}

// ---------- HTML chrome (top bar, status, players, dock, sheets) ----------
export function renderTableScreen() {
  const r = S.session.room;
  if (!r) return '<div class="loading"><p>Loading table…</p></div>';
  const myKey = safeKey(S.session.uid);
  const me = r.players ? r.players[myKey] : null;
  const phase = r.phase;
  const inviteUrl = location.origin + location.pathname + '?room=' + r.code;
  const { min, max } = stakesFor(r);

  const cur = r.turnOrder && r.turnOrder[r.currentTurnIndex];
  const myTurn = phase === 'playing' && cur && cur.pid === myKey;
  const myHand = myTurn && me ? me.hands[cur.hi] : null;

  // ----- status line: the clock when there is one, and the last thing that
  // happened underneath it.
  const tour = BT.isBjTournament(r) ? r.tournament : null;
  const countdown = BT.registering(r) ? BT.registrationLabel(r) : BT.finished(r) ? 'Tournament over' : countdownLabel(r, myTurn);
  const lastLog = (r.log || []).slice(-1).map(esc).join('');
  const statusHtml = (countdown || lastLog) ? `
    <div class="hud-status">
      ${countdown ? `<div class="status-pill ${myTurn ? 'urgent' : ''}" id="countdownText">${countdown}</div>` : ''}
      ${lastLog ? `<div class="status-log">${lastLog}</div>` : ''}
    </div>` : '';

  // ----- the dock: only what this player can do right now.
  let dock = '';
  const myPlace = tour ? BT.placeOf(r, myKey) : null;
  if (tour && (BT.finished(r) || myPlace)) {
    dock = bjResultPanel(r, myKey);
  } else if (tour && BT.registering(r)) {
    dock = bjRegistrationPanel(r, me);
  } else if (tour && !me) {
    dock = '<p class="dock-msg">The tournament is in play — you are watching.</p>';
  } else if (me) {
    if (phase === 'betting' && me.status === 'betting') {
      S.syncPendingBetRound(r.round);
      if (S.pendingBet > me.chips) S.setPendingBetClamped(me.chips);
      const ladder = chipLadderForTable(min, max);
      const chipsHtml = ladder.map((v, i) => {
        // A chip is offered only if it fits both the balance and the ceiling.
        const allowed = (S.pendingBet + v) <= me.chips && (S.pendingBet + v) <= max;
        return `<button class="chip-btn ${allowed ? '' : 'disabled'}" style="background-image:url(${chipButtonDataURL(v, i)});" data-chip="${v}" data-chip-index="${i}" ${allowed ? '' : 'disabled'} aria-label="Add ${v.toLocaleString()}" title="${v.toLocaleString()}"></button>`;
      }).join('');
      const canRepeat = !!me.lastBet && me.lastBet <= me.chips && me.lastBet >= min && me.lastBet <= max;
      const belowMin = S.pendingBet > 0 && S.pendingBet < min;
      const betReady = S.pendingBet >= min && S.pendingBet <= max && S.pendingBet <= me.chips;
      const betLabel = belowMin ? 'Minimum bet is ' + min.toLocaleString()
        : S.pendingBet > 0 ? 'Place bet · ' + S.pendingBet.toLocaleString()
        : 'Tap chips to bet';
      dock = `
        <div class="dock-panel dock-bet">
          <div class="dock-head">
            <span class="dock-balance">${tour ? 'Chips' : 'Balance'}<b>${me.chips.toLocaleString()}</b></span>
            ${tour ? `<span class="muted">${BT.handsLeft(r) ? `Hand ${r.round} of ${BT.HANDS}` : 'Final hand'}</span>` : '<button class="link" id="sitOutBtn">Sit out this round</button>'}
          </div>
          <div class="chip-row">${chipsHtml}</div>
          <div class="dock-actions">
            <button class="btn btn-sm btn-quiet" id="clearBetBtn" ${S.pendingBet <= 0 ? 'disabled' : ''}>Clear</button>
            <button class="btn btn-sm btn-quiet" id="repeatBetBtn" ${canRepeat ? '' : 'disabled'}>${me.lastBet ? 'Repeat ' + me.lastBet.toLocaleString() : 'Repeat'}</button>
            <button class="btn btn-primary grow" id="confirmBetBtn" ${betReady ? '' : 'disabled'}>${betLabel}</button>
          </div>
        </div>`;
    } else if (phase === 'betting' && me.status === 'bet-placed') {
      dock = `<p class="dock-msg">Bet placed · ${me.bet.toLocaleString()}. Waiting for the table…</p>`;
    } else if (phase === 'insurance') {
      if (me.insuranceDecided) {
        dock = `<p class="dock-msg">${me.insurance ? 'Insurance taken.' : 'No insurance.'} Waiting for the table…</p>`;
      } else {
        const cost = Math.floor(((me.hands && me.hands[0] && me.hands[0].bet) || me.bet || 0) / 2);
        const canAfford = cost > 0 && me.chips >= cost;
        dock = `
          <div class="dock-panel">
            <p class="dock-text">The dealer shows an ace. Insurance costs ${cost.toLocaleString()} and pays 2 to 1 if they have blackjack.</p>
            <div class="dock-actions">
              <button class="btn grow" id="insureNoBtn">No thanks</button>
              <button class="btn btn-primary grow" id="insureYesBtn" ${canAfford ? '' : 'disabled'}>Take insurance</button>
            </div>
          </div>`;
      }
    } else if (myTurn && myHand) {
      const canDouble = myHand.cards.length === 2 && me.chips >= myHand.bet;
      const canSplit = me.hands.length === 1 && me.chips >= myHand.bet && canSplitCards(myHand.cards);
      // Late surrender: only on an untouched two-card hand that was never split.
      const canSurrender = myHand.cards.length === 2 && me.hands.length === 1;
      dock = `
        <div class="dock-panel">
          <div class="action-row">
            <button class="btn btn-primary" id="hitBtn">Hit</button>
            <button class="btn" id="standBtn">Stand</button>
            <button class="btn" id="doubleBtn" ${canDouble ? '' : 'disabled'}>Double</button>
            <button class="btn" id="splitBtn" ${canSplit ? '' : 'disabled'}>Split</button>
            <button class="btn" id="surrenderBtn" ${canSurrender ? '' : 'disabled'}>Surrender</button>
          </div>
        </div>`;
    } else if (phase === 'playing') {
      const curPlayer = cur ? r.players[cur.pid] : null;
      dock = `<p class="dock-msg">Waiting on ${esc(curPlayer ? curPlayer.name : '…')}</p>`;
    } else if (phase === 'results' && r.isPublic) {
      dock = '<p class="dock-msg">Next round starts in a moment</p>';
    }
  }

  // ----- seat picker: tapping a free chair moves you into it, and the view
  // follows. Chairs someone else is in, and any move while you hold cards,
  // are refused here as well as in the rules.
  const mySeatNow = myKey ? seatOf(r, myKey) : -1;
  const holdingCards = !!(me && me.hands && me.hands.length);
  const seatOwner = new Map();
  (r.playerOrder || []).forEach((k) => seatOwner.set(seatOf(r, k), k));
  // Laid out as the chairs are seen from the players' side: seat 1, first
  // base, is on the right.
  const seatPicker = `
    <div class="seat-dots" id="seatSwitchRow" role="group" aria-label="Seat">
      ${Array.from({ length: MAX_PUBLIC_SEATS }, (_, n) => MAX_PUBLIC_SEATS - 1 - n).map((i) => {
        const owner = seatOwner.get(i);
        const mine = owner === myKey && myKey;
        const taken = owner && !mine;
        const blocked = taken || holdingCards || mySeatNow === -1;
        const title = mine ? 'Your seat'
          : taken ? esc(r.players[owner].name) + ' is in seat ' + (i + 1)
          : holdingCards ? 'Finish the hand before moving'
          : 'Move to seat ' + (i + 1);
        return `<button class="seat-dot${mine ? ' current' : ''}${taken ? ' taken' : ''}" data-take-seat="${i}" ${blocked ? 'disabled' : ''} title="${title}" aria-label="${title}">${i + 1}</button>`;
      }).join('')}
    </div>`;

  // ----- players: who's who, their chips, and what they're doing.
  const order = (r.playerOrder || []).filter((k) => r.players && r.players[k]);
  // At a tournament, by stack: the race is the point.
  if (tour) order.sort((a, b) => r.players[b].chips - r.players[a].chips);
  const playersHtml = order.map((key, rank) => {
    const p = r.players[key];
    if (!p) return '';
    const isMe = key === myKey;
    const onTurn = phase === 'playing' && cur && cur.pid === key;
    let statusText = '';
    if (phase === 'lobby' || (phase === 'betting' && p.status === 'sitout')) statusText = p.chips > 0 ? 'Waiting' : 'Needs chips';
    else if (phase === 'betting') statusText = p.status === 'bet-placed' ? 'Bet ' + p.bet.toLocaleString() : 'Choosing a bet';
    else if (phase === 'insurance') {
      if (!p.hands || !p.hands.length) statusText = 'Sitting out';
      else if (!p.insuranceDecided) statusText = 'Deciding on insurance';
      else statusText = p.insurance ? 'Insured' : 'No insurance';
    } else if (phase === 'playing' || phase === 'dealer') {
      if (p.status === 'sitout') statusText = 'Sitting out';
      else if (!p.hands || !p.hands.length) statusText = 'Waiting';
      else statusText = p.hands.map((h, hi) => {
        if (h.status === 'blackjack') return 'Blackjack';
        if (h.status === 'busted') return 'Bust';
        if (h.status === 'stood') return 'Stands';
        if (h.status === 'surrendered') return 'Surrendered';
        if (onTurn && cur.hi === hi) return 'Playing';
        return 'Waiting';
      }).join(' / ');
    } else if (phase === 'results') {
      if (p.status === 'sitout' || !p.hands || !p.hands.length) statusText = 'Sitting out';
      else if (!resultsShown) statusText = 'Waiting on the dealer';
      else statusText = p.hands.map((h) => (h.outcome ? OUTCOME_LABEL[h.outcome](h.bet) : '')).join(' / ');
    }
    if (phase === 'betting' && p.timeouts > 0 && !tour) statusText += ` (${p.timeouts}/${MAX_TIMEOUTS} missed)`;
    if (tour && phase === 'lobby') statusText = BT.registering(r) ? 'Registered' : 'Finished';
    // Tapping another player offers a friend request.
    const addable = !isMe && !Social.isFriend(key);
    return `
      <div class="player ${onTurn ? 'on-turn' : ''} ${addable ? 'addable' : ''}" ${addable ? `data-add-friend="${esc(key)}" data-add-name="${esc(p.name)}" title="Add ${esc(p.name)} as a friend"` : ''}>
        <img class="player-avatar" src="${characterPortraitDataURL(p.character || defaultCharacterFor(key), 64)}" alt="">
        <div class="player-info">
          <span class="player-name">${tour && !BT.registering(r) ? `<span class="rank-tag">#${rank + 1}</span> ` : ''}${esc(p.name)}${isMe ? ' <span class="you">(you)</span>' : ''}${p.bot ? ' <span class="role">BOT</span>' : ''}</span>
          <span class="player-status">${esc(statusText)}</span>
        </div>
        <span class="player-chips">${p.chips.toLocaleString()}</span>
        ${addable ? '<span class="player-add" aria-hidden="true">+</span>' : ''}
      </div>`;
  }).join('');

  // ----- host sheet (private tables only).
  let hostBtn = '';
  let hostSheet = '';
  if (S.session.isAdmin && !r.isPublic) {
    hostBtn = `<button class="hud-btn ${S.hostOpen ? 'active' : ''}" id="hostToggleBtn">Host</button>`;
    if (S.hostOpen) {
      const giveRows = (r.playerOrder || []).map((key) => {
        const p = r.players[key];
        return `<div class="give-row">
          <span>${esc(p.name)} · ${p.chips.toLocaleString()}</span>
          <input type="number" min="1" value="1000" id="giveAmt-${key}" aria-label="Chips to give ${esc(p.name)}">
          <button class="btn btn-sm" data-give="${key}">Give</button>
        </div>`;
      }).join('');
      let roundControl = '';
      if (phase === 'lobby' || phase === 'results') {
        roundControl = `<button class="btn btn-primary btn-block" id="startRoundBtn">${phase === 'results' ? 'Next round' : 'Start round'}</button>`;
      } else if (phase === 'betting') {
        const anyBet = (r.playerOrder || []).some((key) => r.players[key].status === 'bet-placed');
        roundControl = `<button class="btn btn-primary btn-block" id="dealBtn" ${anyBet ? '' : 'disabled'}>Deal cards</button>`;
      }
      hostSheet = `
        <div class="sheet host">
          <div class="sheet-title">Host</div>
          ${roundControl ? `<div style="margin-bottom:16px;">${roundControl}</div>` : ''}
          ${giveRows}
          <div class="invite">
            <input type="text" readonly value="${esc(inviteUrl)}" id="inviteUrlInput" aria-label="Invite link">
            <button class="btn btn-sm" id="copyInviteBtn">Copy link</button>
          </div>
        </div>`;
    }
  }

  // ----- chat sheet.
  const chatMsgs = r.chat || [];
  const chatBtn = `<button class="hud-btn ${S.chatOpen ? 'active' : ''}" id="chatToggleBtn">Chat${chatMsgs.length ? ` <span class="count">${chatMsgs.length}</span>` : ''}</button>`;
  const chatSheet = S.chatOpen ? `
    <div class="sheet chat">
      <div class="sheet-title">Table chat</div>
      <div class="chat-log" id="chatLog">
        ${chatMsgs.length ? chatMsgs.map((m) => '<div class="chat-msg"><b>' + esc(m.name) + '</b> ' + esc(m.text) + '</div>').join('') : '<div class="chat-empty">No messages yet. Say hi.</div>'}
      </div>
      <div class="compose" style="margin-top:0;">
        <input type="text" id="chatInput" placeholder="Message the table" maxlength="200">
        <button class="btn btn-primary" id="chatSendBtn">Send</button>
      </div>
    </div>` : '';

  const readout = handStripHtml(r, myKey);

  const tableSub = tour ? bjTournamentSub(r) : [
    stakesLabel(min, max),
    r.isPublic ? 'Public · ' + (r.playerOrder || []).length + '/' + MAX_PUBLIC_SEATS : 'Private',
    shoeLabel(r),
  ].filter(Boolean).join(' · ');

  return `
    <div class="hud-top">
      <div class="hud-left">
        <button class="hud-btn" id="leaveBtn">← Leave</button>
        <div class="hud-table">
          <span class="hud-code">${tour ? esc(tour.name) + ' · ' + esc(roomName(r)) : esc(roomName(r)) + ' · ' + esc(r.code)}</span>
          <span class="hud-sub">${tableSub}</span>
        </div>
      </div>
      <div class="hud-right">
        ${tour ? '' : seatPicker}
        ${hostBtn}
        ${chatBtn}
      </div>
    </div>
    ${S.connLost ? '<div class="conn-banner">Connection lost — reconnecting…</div>' : ''}
    ${statusHtml}
    ${playersHtml ? `<aside class="hud-players">${playersHtml}</aside>` : ''}
    ${hostSheet}
    ${chatSheet}
    ${(dock || readout) ? `<div class="hud-dock">${readout}${dock}</div>` : ''}
  `;
}


// ----- tournaments

const shortNum = (n) => (n >= 1e6 ? (n % 1e6 ? (n / 1e6).toFixed(n % 1e5 ? 2 : 1) : n / 1e6) + 'M' : n >= 1000 ? (n % 1000 ? (n / 1000).toFixed(1) : n / 1000) + 'K' : String(n));

function bjTournamentSub(r) {
  const x = r.tournament;
  const where = r.offline ? 'vs bots' : 'Tournament';
  if (BT.registering(r)) return `${where} · Buy-in ${shortNum(x.buyIn)} · 1st ${shortNum(x.prizes[0])}`;
  const left = (r.playerOrder || []).filter((k) => r.players && r.players[k]).length;
  if (BT.finished(r)) return `${where} · ${x.entrants} played`;
  return `${where} · Hand ${r.round} of ${BT.HANDS} · Bets ${shortNum(BT.MIN_BET)}–${shortNum(BT.MAX_BET)} · ${left}/${x.entrants || left} left`;
}

function bjRegistrationPanel(r, me) {
  const x = r.tournament;
  const n = (r.playerOrder || []).filter((k) => r.players && r.players[k]).length;
  const short = S.session.chips < x.buyIn;
  const when = BT.registrationLabel(r).replace(/^Registering · \d+\/\d+ · /, '');
  return `
    <div class="dock-panel tour-panel">
      <div class="tp-head">
        <span class="tp-title">${esc(x.name)}</span>
        <span class="muted">${n}/${BT.SEATS} registered · ${esc(when)}</span>
      </div>
      <div class="tp-prizes">${(x.prizes || []).map((p, i) => `<span class="tp-prize"><b>${BT.ordinal(i + 1)}</b>${p.toLocaleString()}</span>`).join('')}</div>
      <p class="tp-fine">${BT.START_STACK.toLocaleString()} chips each · ${BT.HANDS} hands · bets ${BT.MIN_BET.toLocaleString()} to ${BT.MAX_BET.toLocaleString()} · most chips at the end wins. Prizes for a full table, in proportion if it starts short.</p>
      <div class="dock-actions">
        ${me
          ? '<span class="tp-in">You are registered</span><button class="btn btn-sm btn-quiet" id="bjUnregisterBtn">Unregister</button>'
          : `<button class="btn btn-primary" id="bjRegisterBtn" ${short ? 'disabled' : ''}>Register · ${x.buyIn.toLocaleString()}</button>${short ? `<span class="muted">You have ${S.session.chips.toLocaleString()}</span>` : ''}`}
      </div>
    </div>`;
}

function bjResultPanel(r, key) {
  const x = r.tournament;
  const mine = BT.placeOf(r, key);
  const rows = BT.standings(r).slice(0, BT.SEATS).map((e) => `
    <li class="${e.key === key ? 'me' : ''}">
      <span class="ts-place">${e.place ? BT.ordinal(e.place) : '—'}</span>
      <img src="${characterPortraitDataURL(e.character || defaultCharacterFor(e.key), 48)}" alt="">
      <span class="ts-name">${esc(e.name)}${e.bot ? ' <span class="role">BOT</span>' : ''}</span>
      <span class="ts-prize">${e.prize ? e.prize.toLocaleString() : (e.chips || 0).toLocaleString() + ' chips'}</span>
    </li>`).join('');
  let head;
  if (mine && mine.place === 1) head = `<span class="tr-big">Champion</span><span class="tr-line">You won the ${esc(x.name)}${mine.prize ? ' — ' + mine.prize.toLocaleString() + ' chips' : ''}</span>`;
  else if (mine) head = `<span class="tr-big">${BT.ordinal(mine.place)}</span><span class="tr-line">You finished ${BT.ordinal(mine.place)} of ${x.entrants}${mine.prize ? ' — ' + mine.prize.toLocaleString() + ' chips' : ''}</span>`;
  else {
    const w = Object.values(x.places || {}).find((v) => v.place === 1);
    head = `<span class="tr-big">Over</span><span class="tr-line">${w ? esc(w.name) + ' won the ' + esc(x.name) : 'The tournament is over'}</span>`;
  }
  const again = r.offline && x.id ? `<button class="btn btn-primary" id="bjPlayAgainBtn" ${S.session.chips < x.buyIn ? 'disabled' : ''}>Play again · ${x.buyIn.toLocaleString()}</button>` : '';
  return `
    <div class="dock-panel tour-result ${mine && mine.place === 1 ? 'won' : ''}">
      <div class="tr-head">${head}</div>
      ${BT.running(r) ? '<p class="tp-fine" style="text-align:center;">Still playing:</p>' : ''}
      <ol class="tour-standings">${rows}</ol>
      <div class="dock-actions" style="justify-content:center;">
        ${again}
        <button class="btn ${again ? 'btn-quiet' : 'btn-primary'}" id="bjLobbyBtn">Back to the lobby</button>
      </div>
    </div>`;
}

export function attachTableScreen() {
  const r = S.session.room;
  const myKey = r && S.session.uid ? safeKey(S.session.uid) : null;
  const me = r && myKey && r.players ? r.players[myKey] : null;
  // Your chair, not your place in the join queue. Bet chips are drawn from
  // this, so while it still read the join order they piled up on whichever
  // seat you first sat in and stayed there after you moved.
  const mySeatIndex = r && myKey && r.players && r.players[myKey] ? seatOf(r, myKey) : -1;

  const hitBtn = document.getElementById('hitBtn'); if (hitBtn) hitBtn.onclick = S.hit;
  const standBtn = document.getElementById('standBtn'); if (standBtn) standBtn.onclick = S.stand;
  const doubleBtn = document.getElementById('doubleBtn'); if (doubleBtn) doubleBtn.onclick = S.doubleDown;
  const splitBtn = document.getElementById('splitBtn'); if (splitBtn) splitBtn.onclick = S.splitHand;
  const surrenderBtn = document.getElementById('surrenderBtn'); if (surrenderBtn) surrenderBtn.onclick = S.surrender;
  const insureYes = document.getElementById('insureYesBtn'); if (insureYes) insureYes.onclick = () => S.takeInsurance(true);
  const insureNo = document.getElementById('insureNoBtn'); if (insureNo) insureNo.onclick = () => S.takeInsurance(false);
  const clearBetBtn = document.getElementById('clearBetBtn');
  if (clearBetBtn) clearBetBtn.onclick = () => {
    S.clearPendingBet();
    if (mySeatIndex !== -1) { driver.clearBetChipsForSeat(mySeatIndex); localPendingSeats[mySeatIndex] = false; }
  };
  const repeatBetBtn = document.getElementById('repeatBetBtn');
  if (repeatBetBtn) repeatBetBtn.onclick = () => {
    S.repeatPendingBet();
    if (mySeatIndex !== -1 && me) {
      driver.clearBetChipsForSeat(mySeatIndex);
      const { min, max } = stakesFor(r);
      spawnBetStack(mySeatIndex, S.pendingBet, chipLadderForTable(min, max));
      localPendingSeats[mySeatIndex] = true;
    }
  };
  const confirmBetBtn = document.getElementById('confirmBetBtn'); if (confirmBetBtn) confirmBetBtn.onclick = S.confirmPendingBet;
  document.querySelectorAll('[data-chip]').forEach((btn) => {
    btn.onclick = () => {
      const v = Number(btn.getAttribute('data-chip'));
      const idx = Number(btn.getAttribute('data-chip-index'));
      const before = S.pendingBet;
      S.addChipToBet(v);
      if (S.pendingBet !== before && mySeatIndex !== -1) {
        driver.addBetChipVisual(mySeatIndex, idx, v);
        localPendingSeats[mySeatIndex] = true;
      }
    };
  });
  const sitOutBtn = document.getElementById('sitOutBtn');
  if (sitOutBtn) sitOutBtn.onclick = () => {
    S.sitOutRound();
    if (mySeatIndex !== -1) { driver.clearBetChipsForSeat(mySeatIndex); localPendingSeats[mySeatIndex] = false; }
  };
  const startRoundBtn = document.getElementById('startRoundBtn'); if (startRoundBtn) startRoundBtn.onclick = S.startRound;
  const dealBtn = document.getElementById('dealBtn'); if (dealBtn) dealBtn.onclick = S.dealCards;
  const leaveBtn = document.getElementById('leaveBtn');
  // Leaving a tournament still being played forfeits the seat: ask first.
  const forfeit = r && BT.running(r) && me;
  if (leaveBtn) leaveBtn.onclick = () => {
    if (forfeit && !window.confirm('Leave the tournament? Your seat is forfeit: you finish in the place you have reached, and the buy-in is not returned.')) return;
    S.leaveTable();
  };
  const on = (id, fn) => { const el = document.getElementById(id); if (el) el.onclick = fn; };
  on('bjLobbyBtn', S.leaveTable);
  on('bjUnregisterBtn', S.leaveTable);
  on('bjRegisterBtn', () => BJT.registerBj(r.code));
  on('bjPlayAgainBtn', () => OfflineBJ.playAgain());
  const copyBtn = document.getElementById('copyInviteBtn');
  if (copyBtn) copyBtn.onclick = () => {
    const input = document.getElementById('inviteUrlInput');
    input.select();
    navigator.clipboard.writeText(input.value).then(() => { copyBtn.textContent = 'Copied'; setTimeout(() => copyBtn.textContent = 'Copy link', 1500); }).catch(() => {});
  };
  document.querySelectorAll('[data-give]').forEach((btn) => {
    btn.onclick = () => {
      const key = btn.getAttribute('data-give');
      const amt = document.getElementById('giveAmt-' + key).value;
      S.giveChips(key, amt);
    };
  });
  const chatToggleBtn = document.getElementById('chatToggleBtn');
  if (chatToggleBtn) chatToggleBtn.onclick = () => S.setChatOpen(!S.chatOpen);
  const hostToggleBtn = document.getElementById('hostToggleBtn');
  if (hostToggleBtn) hostToggleBtn.onclick = () => S.setHostOpen(!S.hostOpen);
  const chatSendBtn = document.getElementById('chatSendBtn');
  const chatInput = document.getElementById('chatInput');
  if (chatSendBtn && chatInput) {
    const send = () => { const v = chatInput.value; chatInput.value = ''; S.sendChatMessage(v); };
    chatSendBtn.onclick = send;
    chatInput.onkeydown = (e) => { if (e.key === 'Enter') send(); };
  }
  const chatLog = document.getElementById('chatLog');
  if (chatLog) chatLog.scrollTop = chatLog.scrollHeight;

  document.querySelectorAll('[data-add-friend]').forEach((el) => {
    el.onclick = () => Social.sendFriendRequest(el.getAttribute('data-add-friend'), el.getAttribute('data-add-name'));
  });

  document.querySelectorAll('[data-take-seat]').forEach((btn) => {
    btn.onclick = () => S.changeSeat(Number(btn.getAttribute('data-take-seat')));
  });
}

/** Clears the blackjack table of everything a room put on it — for a poker table to take over the scene. */
export function hideBlackjackTable() {
  if (!driver) return;
  driver.clearAllMeshes();
  for (let i = 0; i < MAX_PUBLIC_SEATS; i++) { driver.clearSeatCharacter(i); driver.clearBetChipsForSeat(i); driver.hideSeatBadges(i); }
  driver.hideDealerBadge();
  resetTableDiffState();
}

export function resetTableDiffState() {
  resetLanded();
  lastRound = null;
  lastShuffledAt = null;
  lastCounts = {};
  lastDealerCount = 0;
  dealerRevealed = false;
  betChipsShown = {};
  localPendingSeats = {};
  lastPhase = null;
  stakeShown = {};
  collectedSeats = {};
  peekShown = false;
  resultsShown = false;
  shufflePending = false;
  // A viewpoint you picked by hand belonged to the table you just left.
  if (driver) driver.releaseViewSeat();
}

