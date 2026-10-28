// Bridges the real Firebase room (src/app/session.js, src/app/roomLogic.js)
// to the 3D scene (src/ui/gameController.js's driver). Owns the table
// screen's HTML chrome too (header/log/controls/admin/chat) — ported from
// index4.html's renderTable()/attachTable(), minus the felt-oval/seats-row
// markup the 3D scene now draws instead.
import { createTableDriver } from '../ui/gameController.js';
import {
  MAX_PUBLIC_SEATS, MAX_TIMEOUTS, rankOf, suitOf, handValueLabel,
  chipLadderForTable, stakesFor, stakesLabel, safeKey, seatOf, countdownLabel,
} from './roomLogic.js';
import { chipButtonDataURL } from '../scene/chip.js';
import { characterPortraitDataURL, defaultCharacterFor } from '../scene/character.js';
import { esc } from './uiHelpers.js';
import * as S from './session.js';
import * as Social from './social.js';

const DEAL_STEP_MS = 320;

const OUTCOME_LABEL = {
  win: (bet) => 'Won ' + (bet * 2).toLocaleString(),
  blackjack: (bet) => 'Blackjack — won ' + (bet + Math.floor(bet * 1.5)).toLocaleString(),
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
// Seats whose bet-spot chips were already built locally, one at a time, by
// tapping the bet-ladder buttons (see attachTableScreen) — when Firebase
// then confirms that bet, the sync loop below must not draw a second,
// decorative stack on top of the real one the player just tapped out.
let localPendingSeats = {};
let lastPhase = null;

let setFeltTheme = () => {};
let setDealerModel = () => {};

export function mountTable3D(sceneHandles) {
  driver = createTableDriver(sceneHandles);
  setFeltTheme = sceneHandles.setFeltTheme || (() => {});
  setDealerModel = sceneHandles.setDealerModel || (() => {});
  return driver;
}

function toCard(str) { return { rank: rankOf(str), suit: suitOf(str) }; }

function resetRoundVisuals() {
  driver.clearAllMeshes();
  lastCounts = {};
  lastDealerCount = 0;
  dealerRevealed = false;
  betChipsShown = {};
  localPendingSeats = {};
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

  setFeltTheme(room.felt);
  setDealerModel(room.dealerType);

  if (room.round !== lastRound) {
    lastRound = room.round;
    resetRoundVisuals();
  }

  // The shoe was replaced — riffle the deck so the reshuffle is something
  // you see, not just a line in the log. shuffledAt is the room's own stamp,
  // so every player at the table watches it at the same moment, and
  // comparing against the last one seen means re-renders don't replay it.
  if (room.shuffledAt && room.shuffledAt !== lastShuffledAt) {
    const firstSight = lastShuffledAt === null;
    lastShuffledAt = room.shuffledAt;
    // Don't riffle at someone who just walked up to a table mid-shoe; only
    // a shuffle that happens while they are watching is worth animating.
    if (!firstSight) driver.shuffleDeck();
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
      if (!localPendingSeats[seatIndex]) {
        const { min, max } = stakesFor(room);
        spawnBetStack(seatIndex, p.bet, chipLadderForTable(min, max));
      }
    }
    if (p.status === 'betting' && betChipsShown[seatIndex]) {
      betChipsShown[seatIndex] = false;
      localPendingSeats[seatIndex] = false;
      driver.clearBetChipsForSeat(seatIndex);
    }
    // A seat that never confirmed (e.g. missed the betting window and got
    // pushed to 'sitout') can still have chips sitting on the felt from
    // taps that were never followed by "Place bet" — sweep those too.
    if (p.status !== 'betting' && p.status !== 'bet-placed' && (betChipsShown[seatIndex] || localPendingSeats[seatIndex])) {
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
    for (let i = lastDealerCount; i < dHand.length; i++) {
      dealerEvents.push({ kind: 'dealer', index: i, card: dHand[i], faceDown: i === 1 && !room.dealer.hiddenRevealed });
    }
    lastDealerCount = dHand.length;
  }

  order.forEach((key) => {
    const seatIndex = seatIndexOf.get(key);
    const p = room.players[key];
    if (!p || !p.hands) return;
    p.hands.forEach((hand, handIndex) => {
      const countKey = seatIndex + ':' + handIndex;
      const seen = lastCounts[countKey] || 0;
      for (let i = seen; i < hand.cards.length; i++) {
        seatEvents.push({ kind: 'seat', seatIndex, handIndex, handCount: p.hands.length, index: i, card: hand.cards[i] });
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

  events.forEach((ev, i) => {
    setTimeout(() => {
      if (ev.kind === 'dealer') {
        driver.dealDealerCard(ev.index, toCard(ev.card), { faceDown: ev.faceDown });
      } else {
        driver.dealCardToSeat(ev.seatIndex, ev.handIndex, ev.index, toCard(ev.card), ev.handCount);
      }
    }, i * DEAL_STEP_MS);
  });

  // Dealer hole-card reveal, once.
  if (room.dealer.hiddenRevealed && !dealerRevealed && lastDealerCount >= 2) {
    dealerRevealed = true;
    setTimeout(() => driver.revealDealerCard(1), events.length * DEAL_STEP_MS + 100);
  }

  // Hand-value badges for every seat currently showing cards.
  order.forEach((key) => {
    const seatIndex = seatIndexOf.get(key);
    const p = room.players[key];
    if (!p) return;
    if (p.hands && p.hands.length && room.phase !== 'betting' && room.phase !== 'lobby') {
      p.hands.forEach((hand, handIndex) => {
        driver.setSeatBadge(seatIndex, handIndex, p.hands.length, handValueLabel(hand.cards));
      });
    } else {
      driver.hideSeatBadges(seatIndex);
    }
  });

  if (room.phase === 'insurance' || room.phase === 'playing' || room.phase === 'dealer' || room.phase === 'results') {
    driver.setDealerBadge(handValueLabel(room.dealer.hand.slice(0, room.dealer.hiddenRevealed ? room.dealer.hand.length : 1)));
  } else {
    driver.hideDealerBadge();
  }

  // Round-long camera zoom onto MY seat while a hand is in progress.
  if (myKey && seatIndexOf.has(myKey)) {
    const goingToPlay = room.phase === 'insurance' || room.phase === 'playing' || room.phase === 'dealer' || room.phase === 'results';
    if (goingToPlay && lastPhase === 'betting') driver.focusOnSeatHand(seatIndexOf.get(myKey));
    if (room.phase === 'betting' && lastPhase !== 'betting') driver.releaseSeatFocus();
  }

  // Payout/collect chips once results land for this round.
  if (room.phase === 'results' && lastPhase !== 'results') {
    (room.dealtIn || []).forEach((key) => {
      const seatIndex = seatIndexOf.get(key);
      const p = room.players[key];
      if (seatIndex === undefined || !p || !p.hands) return;
      const outcomes = p.hands.map((h) => h.outcome);
      const anyWin = outcomes.some((o) => o === 'win' || o === 'blackjack');
      const anyLose = outcomes.some((o) => o === 'lose');
      if (anyWin) driver.payoutChipsForSeat(seatIndex, outcomes.includes('blackjack') ? 3 : 2);
      else if (anyLose) driver.collectBetChipsForSeat(seatIndex);
      betChipsShown[seatIndex] = false;
      localPendingSeats[seatIndex] = false;
    });
  }

  lastPhase = room.phase;
}

// How much of the shoe is left, as a few words for the table line.
function shoeLabel(r) {
  if (!r.shoeSize) return '';
  const left = (r.deck || []).length;
  const pct = Math.max(0, Math.min(100, Math.round((left / r.shoeSize) * 100)));
  const justShuffled = r.shuffledAt && Date.now() - r.shuffledAt < 8000;
  return justShuffled ? 'Fresh shoe' : 'Shoe ' + pct + '%';
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
  const countdown = countdownLabel(r, myTurn);
  const lastLog = (r.log || []).slice(-1).map(esc).join('');
  const statusHtml = (countdown || lastLog) ? `
    <div class="hud-status">
      ${countdown ? `<div class="status-pill ${myTurn ? 'urgent' : ''}" id="countdownText">${countdown}</div>` : ''}
      ${lastLog ? `<div class="status-log">${lastLog}</div>` : ''}
    </div>` : '';

  // ----- the dock: only what this player can do right now.
  let dock = '';
  if (me) {
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
        <div class="dock-panel">
          <div class="dock-head">
            <span class="dock-balance">Balance<b>${me.chips.toLocaleString()}</b></span>
            <button class="link" id="sitOutBtn">Sit out this round</button>
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
      const canSplit = myHand.cards.length === 2 && me.hands.length === 1 && me.chips >= myHand.bet && rankOf(myHand.cards[0]) === rankOf(myHand.cards[1]);
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
  const seatPicker = `
    <div class="seat-dots" id="seatSwitchRow" role="group" aria-label="Seat">
      ${Array.from({ length: MAX_PUBLIC_SEATS }).map((_, i) => {
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
  const playersHtml = (r.playerOrder || []).map((key) => {
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
      else statusText = p.hands.map((h) => (h.outcome ? OUTCOME_LABEL[h.outcome](h.bet) : '')).join(' / ');
    }
    if (phase === 'betting' && p.timeouts > 0) statusText += ` (${p.timeouts}/${MAX_TIMEOUTS} missed)`;
    // Tapping another player offers a friend request.
    const addable = !isMe && !Social.isFriend(key);
    return `
      <div class="player ${onTurn ? 'on-turn' : ''} ${addable ? 'addable' : ''}" ${addable ? `data-add-friend="${esc(key)}" data-add-name="${esc(p.name)}" title="Add ${esc(p.name)} as a friend"` : ''}>
        <img class="player-avatar" src="${characterPortraitDataURL(p.character || defaultCharacterFor(key), 64)}" alt="">
        <div class="player-info">
          <span class="player-name">${esc(p.name)}${isMe ? ' <span class="you">(you)</span>' : ''}</span>
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

  const tableSub = [
    stakesLabel(min, max),
    r.isPublic ? 'Public · ' + (r.playerOrder || []).length + '/' + MAX_PUBLIC_SEATS : 'Private',
    shoeLabel(r),
  ].filter(Boolean).join(' · ');

  return `
    <div class="hud-top">
      <div class="hud-left">
        <button class="hud-btn" id="leaveBtn">← Leave</button>
        <div class="hud-table">
          <span class="hud-code">Table ${esc(r.code)}</span>
          <span class="hud-sub">${tableSub}</span>
        </div>
      </div>
      <div class="hud-right">
        ${seatPicker}
        ${hostBtn}
        ${chatBtn}
      </div>
    </div>
    ${S.connLost ? '<div class="conn-banner">Connection lost — reconnecting…</div>' : ''}
    ${statusHtml}
    ${playersHtml ? `<aside class="hud-players">${playersHtml}</aside>` : ''}
    ${hostSheet}
    ${chatSheet}
    ${dock ? `<div class="hud-dock">${dock}</div>` : ''}
  `;
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
  const leaveBtn = document.getElementById('leaveBtn'); if (leaveBtn) leaveBtn.onclick = S.leaveTable;
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

export function resetTableDiffState() {
  lastRound = null;
  lastShuffledAt = null;
  lastCounts = {};
  lastDealerCount = 0;
  dealerRevealed = false;
  betChipsShown = {};
  localPendingSeats = {};
  lastPhase = null;
  // A viewpoint you picked by hand belonged to the table you just left.
  if (driver) driver.releaseViewSeat();
}

