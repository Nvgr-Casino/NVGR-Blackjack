// Bridges a Hold'em room (src/app/pokerSession.js, src/poker/rules.js) to
// the 3D table (src/ui/pokerController.js), and owns the poker table's HUD:
// the readout of your cards and the board, the actions, the seats, the
// players. The blackjack table's counterpart is table3dBridge.js.

import { createPokerDriver } from '../ui/pokerController.js';
import * as R from '../poker/rules.js';
import * as T from '../poker/tournament.js';
import { bestHand } from '../poker/evaluator.js';
import { cardFaceUrl } from '../scene/card.js';
import { characterPortraitDataURL, defaultCharacterFor } from '../scene/character.js';
import { dealerKeyFor } from '../scene/dealer.js';
import { safeKey, roomName, stakesTier } from './roomLogic.js';
import { esc } from './uiHelpers.js';
import * as S from './session.js';
import * as Poker from './pokerSession.js';
import * as Offline from './offlinePoker.js';
import * as Social from './social.js';

let driver = null;
let scene = null;

export function mountPoker3D(handles) {
  scene = handles;
  driver = createPokerDriver(handles);
  driver.setVisible(false);
  return driver;
}

// ---------- the diff ----------
let shownHand = null;     // the hand id the table is showing
let dealtAt = 0;          // when its hole cards finished going out
let mineShown = false;
let boardShown = 0;
let folded = new Set();
let turned = new Set();
let street = null;
let paid = false;

function resetHandView() {
  shownHand = null; dealtAt = 0; mineShown = false; boardShown = 0;
  folded = new Set(); turned = new Set(); street = null; paid = false;
}

export function leavePokerView() {
  if (!driver) return;
  driver.clearHand();
  for (let i = 0; i < R.POKER_SEATS; i++) driver.clearSeatCharacter(i);
  driver.setStacks({});
  driver.setLabels({});
  driver.setButton(null);
  driver.setVisible(false);
  resetHandView();
  preAction = null;
}

const ladderFor = (r) => [r.sb, r.bb, r.bb * 5, r.bb * 25, r.bb * 100];
const seatOf = (r, k) => (r.players[k] ? r.players[k].seat : -1);

const ACTION_TEXT = { sb: 'Small blind', bb: 'Big blind', fold: 'Fold', check: 'Check', call: 'Call', bet: 'Bet', raise: 'Raise to', allin: 'All in' };
function actionText(last) {
  if (!last) return '';
  const word = ACTION_TEXT[last.action] || '';
  return last.amount && last.action !== 'check' && last.action !== 'fold' ? `${word} ${last.amount.toLocaleString()}` : word;
}

export function syncPokerToScene(room, myKey) {
  if (!driver || !room) return;
  const tier = stakesTier(room);
  scene.setGame('holdem');
  scene.setRoomTheme(tier);
  scene.setDealerModel(dealerKeyFor(tier, room.dealerType));
  scene.setPokerFelt(room.felt);
  driver.setVisible(true);
  driver.setLadder(ladderFor(room));

  const players = room.players || {};
  const seated = R.seatKeys(room);
  const bySeat = new Map(seated.map((k) => [players[k].seat, k]));
  for (let i = 0; i < R.POKER_SEATS; i++) {
    const k = bySeat.get(i);
    if (k) driver.applySeatCharacter(i, players[k].character || defaultCharacterFor(k));
    else driver.clearSeatCharacter(i);
  }
  const mySeat = myKey && players[myKey] ? players[myKey].seat : null;
  driver.followSeat(mySeat);

  const h = room.hand;
  // Each player's stack behind, and their plate.
  const stacks = {};
  const labels = {};
  seated.forEach((k) => {
    const p = players[k];
    stacks[p.seat] = p.stack;
    labels[p.seat] = {
      name: p.name, stack: p.stack,
      action: h && h.phase !== 'done' && h.last ? actionText(h.last[k]) : '',
      active: !!(h && h.toAct === k),
      folded: !!(h && h.folded && h.folded[k]),
      away: p.status === 'sitout' || !Poker.isPresent(k),
    };
  });
  driver.setStacks(stacks);
  driver.setLabels(labels);

  if (!h) {
    if (shownHand) { driver.clearHand(); resetHandView(); }
    driver.setButton(room.buttonSeat ?? null);
    return;
  }
  if (h.id !== shownHand) {
    driver.clearHand();
    resetHandView();
    shownHand = h.id;
  }
  driver.setButton(seatOf(room, h.button));

  // The hole cards go out once the protocol has dealt.
  if (!dealtAt && h.phase !== 'deal') {
    const ms = driver.dealHoleCards(h.players.map((k) => seatOf(room, k)).filter((s) => s >= 0));
    dealtAt = performance.now() + ms;
  }
  // Your own two, turned up for you once they're down.
  const mine = Poker.myHoleCards(room);
  if (mine && dealtAt && !mineShown && mySeat !== null && h.players.includes(myKey)) {
    mineShown = true;
    setTimeout(() => { if (shownHand === h.id) driver.revealMine(mySeat, mine); }, Math.max(0, dealtAt - performance.now()));
  }
  // Folds go in to the muck.
  Object.keys(h.folded || {}).forEach((k) => {
    if (folded.has(k)) return;
    folded.add(k);
    const seat = seatOf(room, k);
    if (seat >= 0) setTimeout(() => driver.muck(seat), Math.max(0, dealtAt - performance.now()));
  });

  // Bets in front of each player; swept into the pot when a street ends.
  const potTotal = R.pot(room);
  const onStreet = Object.values(h.bet || {}).reduce((a, b) => a + b, 0);
  if (street !== null && street !== h.street) driver.gatherBets(potTotal - onStreet);
  street = h.street;
  if (h.phase === 'betting' || h.phase === 'deal') {
    const bets = {};
    Object.entries(h.bet || {}).forEach(([k, v]) => { if (v) bets[seatOf(room, k)] = v; });
    driver.setBets(bets);
    driver.setPot(potTotal - onStreet);
  }
  // The board as it comes.
  if ((h.board || []).length > boardShown) {
    driver.gatherBets(potTotal);
    driver.dealBoard(h.board);
    boardShown = h.board.length;
  }
  // The showdown.
  Object.entries(h.shown || {}).forEach(([k, cards]) => {
    if (turned.has(k)) return;
    turned.add(k);
    driver.showHand(seatOf(room, k), cards);
  });
  // The pot pushed.
  if (h.phase === 'done' && !paid) {
    paid = true;
    driver.gatherBets(potTotal);
    const awards = [];
    (h.results || []).forEach((res) => {
      const share = Math.floor(res.amount / res.winners.length);
      res.winners.forEach((k) => awards.push({ seat: seatOf(room, k), amount: share }));
    });
    setTimeout(() => { if (shownHand === h.id) driver.pushPot(awards.filter((a) => a.seat >= 0)); }, 900);
  }
  maybePreAct(room, myKey);
}

// ---------- pre-actions ----------
// Chosen while waiting; played the moment the turn comes round.
let preAction = null;   // 'checkfold' | 'callany' | null
let preActionHand = null;
function maybePreAct(room, myKey) {
  const h = room.hand;
  if (!preAction || !h || preActionHand !== h.id) return;
  const legal = R.legalActions(room, myKey);
  if (!legal) return;
  const choice = preAction;
  preAction = null;
  if (choice === 'checkfold') Poker.act(legal.check ? 'check' : 'fold');
  else if (choice === 'callany') Poker.act(legal.call ? 'call' : 'check');
}

// ---------- the HUD ----------

const short = (n) => (n >= 1000 ? (n % 1000 ? (n / 1000).toFixed(1).replace(/\.0$/, '') : n / 1000) + 'K' : String(n));
const cardImg = (c) => `<img class="rc" src="${cardFaceUrl(...c.split('-'))}" alt="${esc(c)}">`;
const backImg = () => '<span class="rc rc-back" aria-hidden="true"></span>';

// The amount a raise slider settles on, by name.
function sizing(room, key, legal, frac) {
  const h = room.hand;
  const owe = h.currentBet - h.bet[key];
  const potAfterCall = R.pot(room) + owe;
  const to = Math.round(h.currentBet + frac * potAfterCall);
  return Math.max(legal.minTo, Math.min(legal.maxTo, to));
}

let raiseTo = null;
let raiseFor = null;
// The sizing controls stay folded away until you choose to bet or raise:
// the dock is one row of three buttons, and the table stays in view.
let raiseOpen = false;

export function renderPokerScreen() {
  const r = S.session.room;
  if (!r) return '<div class="loading"><p>Opening the table…</p></div>';
  const myKey = S.session.uid ? safeKey(S.session.uid) : null;
  const me = myKey && R.seatKeys(r).includes(myKey) ? r.players[myKey] : null;
  const h = r.hand;
  const { min: buyMin, max: buyMax } = R.buyInRange(r);

  // ----- the status line: whose turn, the clock, and the last result.
  const countdown = Poker.countdownText(r, myKey);
  const lastLine = h && h.phase === 'done' && h.results ? resultLine(r, h) : (r.log || []).slice(-1)[0] || '';
  const statusHtml = `
    <div class="hud-status">
      ${countdown ? `<div class="status-pill ${h && h.toAct === myKey ? 'urgent' : ''}" id="countdownText">${esc(countdown)}</div>` : ''}
      ${lastLine ? `<div class="status-log">${esc(lastLine)}</div>` : ''}
    </div>`;

  // ----- the readout: your cards, the board, what you have.
  let readout = '';
  const mine = Poker.myHoleCards(r);
  const boardCards = (h && h.board) || [];
  if (h && (me || boardCards.length)) {
    const inHand = me && h.players.includes(myKey) && !(h.folded && h.folded[myKey]);
    const myCardsHtml = me && h.players.includes(myKey)
      ? (mine ? mine.map(cardImg).join('') : backImg() + backImg())
      : '';
    const made = mine && inHand && boardCards.length ? bestHand(mine.concat(boardCards)).name : (mine && inHand ? holeName(mine) : '');
    readout = `
      <div class="readout poker-strip" id="handStrip">
        ${myCardsHtml ? `<div class="rs-hand"><div class="rs-cards">${myCardsHtml}</div><span class="rs-label">YOU</span></div>` : ''}
        <div class="rs-hand"><div class="rs-cards">${boardCards.map(cardImg).join('') || '<span class="rs-empty">Board</span>'}</div><span class="rs-label">POT ${R.pot(r).toLocaleString()}</span></div>
        ${made ? `<span class="rs-made">${esc(made)}</span>` : ''}
      </div>`;
  }

  // ----- the dock.
  let dock = '';
  const tour = r.tournament || null;
  if (tour && (T.finished(r) || T.placeOf(r, myKey)) && !(h && me && h.phase !== 'done' && h.players.includes(myKey))) {
    dock = tournamentResultPanel(r, myKey);
  } else if (tour && T.registering(r)) {
    dock = registrationPanel(r, me);
  } else if (!me) {
    dock = tour ? '<p class="dock-msg">The tournament is in play — you are watching.</p>' : sitDownPanel(r, buyMin, buyMax);
  } else {
    const legal = R.legalActions(r, myKey);
    if (legal) {
      if (raiseFor !== h.id + h.street + h.currentBet) { raiseFor = h.id + h.street + h.currentBet; raiseTo = legal.minTo; raiseOpen = false; }
      raiseTo = Math.max(legal.minTo, Math.min(legal.maxTo, raiseTo || legal.minTo));
      const raiseWord = h.currentBet === 0 ? 'Bet' : 'Raise to';
      const presets = [['Min', null], ['½ Pot', 0.5], ['¾ Pot', 0.75], ['Pot', 1], ['All in', 'all']].map(([label, f]) => {
        const v = f === null ? legal.minTo : f === 'all' ? legal.maxTo : sizing(r, myKey, legal, f);
        return `<button class="btn btn-sm btn-quiet" data-raise="${v}">${label}</button>`;
      }).join('');
      const callBtn = legal.check ? '<button class="btn" id="checkBtn">Check</button>' : `<button class="btn" id="callBtn">Call ${legal.callAmount.toLocaleString()}</button>`;
      // Only all in is left to raise to: no sizing to choose.
      const onlyAllIn = legal.raise && legal.minTo >= legal.maxTo;
      dock = legal.raise && raiseOpen && !onlyAllIn ? `
        <div class="dock-panel dock-poker raising">
          <div class="preset-row">${presets}</div>
          <div class="raise-row">
            <input type="range" id="raiseSlider" min="${legal.minTo}" max="${legal.maxTo}" step="${r.sb}" value="${raiseTo}" aria-label="Raise amount">
            <input type="number" id="raiseInput" min="${legal.minTo}" max="${legal.maxTo}" step="${r.sb}" value="${raiseTo}" aria-label="Raise to" inputmode="numeric">
          </div>
          <div class="action-row poker-actions two">
            <button class="btn btn-quiet" id="raiseBackBtn">Back</button>
            <button class="btn btn-primary" id="raiseBtn">${raiseTo >= legal.maxTo ? 'All in ' + legal.maxTo.toLocaleString() : raiseWord + ' ' + raiseTo.toLocaleString()}</button>
          </div>
        </div>` : `
        <div class="dock-panel dock-poker">
          <div class="action-row poker-actions">
            <button class="btn" id="foldBtn">Fold</button>
            ${callBtn}
            ${!legal.raise ? '' : onlyAllIn
              ? `<button class="btn btn-primary" id="raiseBtn">All in ${legal.maxTo.toLocaleString()}</button>`
              : `<button class="btn btn-primary" id="raiseOpenBtn">${h.currentBet === 0 ? 'Bet' : 'Raise'} …</button>`}
          </div>
        </div>`;
    } else if (h && h.players.includes(myKey) && !(h.folded && h.folded[myKey]) && !(h.allIn && h.allIn[myKey]) && h.phase === 'betting') {
      dock = `
        <div class="dock-panel dock-poker pre-actions">
          <label><input type="checkbox" id="preCheckFold" ${preAction === 'checkfold' ? 'checked' : ''}> Check / Fold</label>
          <label><input type="checkbox" id="preCallAny" ${preAction === 'callany' ? 'checked' : ''}> Call any</label>
        </div>`;
    } else {
      dock = tour ? tournamentWaitPanel(r, me) : betweenHandsPanel(r, me, buyMax);
    }
  }

  // ----- players.
  const playersHtml = R.seatKeys(r).map((k) => {
    const p = r.players[k];
    const isMe = k === myKey;
    const onTurn = h && h.toAct === k;
    let status = p.status === 'sitout' ? 'Sitting out' : !Poker.isPresent(k) ? 'Away' : p.waitBB ? 'Waiting for the big blind' : '';
    if (h && h.players.includes(k)) {
      if (h.folded && h.folded[k]) status = 'Folded';
      else if (h.allIn && h.allIn[k]) status = 'All in';
      else if (onTurn) status = 'To act';
      else if (h.last && h.last[k]) status = actionText(h.last[k]);
      if (h.hands && h.hands[k]) status = h.hands[k].name;
    }
    const roles = [p.bot ? 'BOT' : '', h && h.button === k ? 'D' : '', h && h.sb === k && h.players.length > 2 ? 'SB' : '', h && h.bb === k ? 'BB' : ''].filter(Boolean).join(' ');
    const addable = !isMe && !Social.isFriend(k);
    return `
      <div class="player ${onTurn ? 'on-turn' : ''} ${addable ? 'addable' : ''}" ${addable ? `data-add-friend="${esc(k)}" data-add-name="${esc(p.name)}"` : ''}>
        <img class="player-avatar" src="${characterPortraitDataURL(p.character || defaultCharacterFor(k), 64)}" alt="">
        <div class="player-info">
          <span class="player-name">${esc(p.name)}${isMe ? ' <span class="you">(you)</span>' : ''}${roles ? ` <span class="role">${roles}</span>` : ''}</span>
          <span class="player-status">${esc(status)}</span>
        </div>
        <span class="player-chips">${p.stack.toLocaleString()}</span>
      </div>`;
  }).join('');

  const chatMsgs = r.chat || [];
  const chatBtn = `<button class="hud-btn ${S.chatOpen ? 'active' : ''}" id="chatToggleBtn">Chat${chatMsgs.length ? ` <span class="count">${chatMsgs.length}</span>` : ''}</button>`;
  const chatSheet = S.chatOpen ? `
    <div class="sheet chat">
      <div class="sheet-title">Table chat</div>
      <div class="chat-log" id="chatLog">
        ${chatMsgs.length ? chatMsgs.map((msg) => '<div class="chat-msg"><b>' + esc(msg.name) + '</b> ' + esc(msg.text) + '</div>').join('') : '<div class="chat-empty">No messages yet. Say hi.</div>'}
      </div>
      <div class="compose" style="margin-top:0;">
        <input type="text" id="chatInput" placeholder="Message the table" maxlength="200">
        <button class="btn btn-primary" id="chatSendBtn">Send</button>
      </div>
    </div>` : '';

  const sub = tour ? tournamentSub(r) : `${r.offline ? 'Practice' : "Hold'em"} · Blinds ${short(r.sb)} / ${short(r.bb)} · ${R.seatKeys(r).length}/${R.POKER_SEATS}`;
  return `
    <div class="hud-top">
      <div class="hud-left">
        <button class="hud-btn" id="leaveBtn">← Leave</button>
        <div class="hud-table">
          <span class="hud-code">${tour ? esc(tour.name) + ' · ' + esc(roomName(r)) : esc(roomName(r)) + ' · ' + esc(r.code)}</span>
          <span class="hud-sub">${sub}</span>
        </div>
      </div>
      <div class="hud-right">${chatBtn}</div>
    </div>
    ${S.connLost ? '<div class="conn-banner">Connection lost — reconnecting…</div>' : ''}
    ${statusHtml}
    ${playersHtml ? `<aside class="hud-players">${playersHtml}</aside>` : ''}
    ${chatSheet}
    <div class="hud-dock">${readout}${dock}</div>
  `;
}

// ----- tournaments

function tournamentSub(r) {
  const x = r.tournament;
  const where = r.offline ? 'vs bots' : 'Sit & Go';
  if (T.registering(r)) return `${where} · Buy-in ${short(x.buyIn)} · 1st ${short(x.prizes[0])}`;
  const left = R.seatKeys(r).length;
  const up = T.running(r) && T.nextLevel(r) ? ` · up in ${T.handsToNextLevel(r)}` : '';
  return `${where} · Level ${(x.level || 0) + 1} · Blinds ${short(r.sb)} / ${short(r.bb)}${up} · ${left}/${x.entrants || left} left`;
}

function prizeList(x) {
  return (x.prizes || []).map((p, i) => `<span class="tp-prize"><b>${T.ordinal(i + 1)}</b>${p.toLocaleString()}</span>`).join('');
}

function registrationPanel(r, me) {
  const x = r.tournament;
  const n = R.seatKeys(r).length;
  const short_ = S.session.chips < x.buyIn;
  const when = Poker.countdownText(r, null).replace(/^Registering · \d+\/\d+ · /, '');
  return `
    <div class="dock-panel dock-poker tour-panel">
      <div class="tp-head">
        <span class="tp-title">${esc(x.name)}</span>
        <span class="muted">${n}/${T.SEATS} registered · ${esc(when)}</span>
      </div>
      <div class="tp-prizes">${prizeList(x)}</div>
      <p class="tp-fine">${T.START_STACK.toLocaleString()} chips each · blinds up every ${T.HANDS_PER_LEVEL} hands · prizes for a full table, in proportion if it starts short.</p>
      <div class="dock-actions">
        ${me
          ? '<span class="tp-in">You are registered</span><button class="btn btn-sm btn-quiet" id="unregisterBtn">Unregister</button>'
          : `<button class="btn btn-primary" id="registerBtn" ${short_ ? 'disabled' : ''}>Register · ${x.buyIn.toLocaleString()}</button>${short_ ? `<span class="muted">You have ${S.session.chips.toLocaleString()}</span>` : ''}`}
      </div>
    </div>`;
}

function tournamentWaitPanel(r, me) {
  const key = safeKey(S.session.uid);
  let line;
  if (r.hand && r.hand.players.includes(key) && r.hand.folded && r.hand.folded[key]) line = 'Folded — waiting for the next hand.';
  else if (r.hand && r.hand.phase === 'deal') line = 'Shuffling and dealing…';
  else if (me.stack <= 0) line = 'All in.';
  else line = 'Next hand in a moment.';
  const next = T.nextLevel(r);
  return `
    <div class="dock-panel dock-poker">
      <p class="dock-text">${esc(line)}</p>
      ${next ? `<p class="tp-fine" style="text-align:center;">Blinds go up to ${short(next[0])} / ${short(next[1])} in ${T.handsToNextLevel(r)} hand${T.handsToNextLevel(r) === 1 ? '' : 's'}.</p>` : ''}
    </div>`;
}

function tournamentResultPanel(r, key) {
  const x = r.tournament;
  const mine = T.placeOf(r, key);
  const table = T.standings(r).slice(0, 6).map((e) => `
    <li class="${e.key === key ? 'me' : ''}">
      <span class="ts-place">${e.place ? T.ordinal(e.place) : '—'}</span>
      <img src="${characterPortraitDataURL(e.character || defaultCharacterFor(e.key), 48)}" alt="">
      <span class="ts-name">${esc(e.name)}${e.bot ? ' <span class="role">BOT</span>' : ''}</span>
      <span class="ts-prize">${e.prize ? e.prize.toLocaleString() : e.stack !== undefined ? e.stack.toLocaleString() + ' chips' : ''}</span>
    </li>`).join('');
  let head;
  if (mine && mine.place === 1) head = `<span class="tr-big">Champion</span><span class="tr-line">You won the ${esc(x.name)} — ${mine.prize.toLocaleString()} chips</span>`;
  else if (mine) head = `<span class="tr-big">${T.ordinal(mine.place)}</span><span class="tr-line">You finished ${T.ordinal(mine.place)} of ${x.entrants}${mine.prize ? ' — ' + mine.prize.toLocaleString() + ' chips' : ''}</span>`;
  else {
    const w = Object.values(x.places || {}).find((v) => v.place === 1);
    head = `<span class="tr-big">Over</span><span class="tr-line">${w ? esc(w.name) + ' won the ' + esc(x.name) : 'The tournament is over'}</span>`;
  }
  const again = r.offline && x.id ? `<button class="btn btn-primary" id="playAgainBtn" ${S.session.chips < x.buyIn ? 'disabled' : ''}>Play again · ${x.buyIn.toLocaleString()}</button>` : '';
  return `
    <div class="dock-panel dock-poker tour-result ${mine && mine.place === 1 ? 'won' : ''}">
      <div class="tr-head">${head}</div>
      ${T.running(r) ? '<p class="tp-fine" style="text-align:center;">Still playing:</p>' : ''}
      <ol class="tour-standings">${table}</ol>
      <div class="dock-actions" style="justify-content:center;">
        ${again}
        <button class="btn ${again ? 'btn-quiet' : 'btn-primary'}" id="lobbyBtn">Back to the lobby</button>
      </div>
    </div>`;
}

function holeName(cards) {
  const [a, b] = cards.map((c) => c.split('-'));
  return a[0] === b[0] ? 'Pocket ' + bestHand(cards).name.replace('Pair of ', '') : '';
}

function resultLine(r, h) {
  return (h.results || []).map((res) => {
    const names = res.winners.map((k) => (r.players[k] ? r.players[k].name : 'A player')).join(' and ');
    return `${names} win${res.winners.length > 1 ? '' : 's'} ${res.amount.toLocaleString()}${res.hand ? ' with ' + res.hand : ''}`;
  }).join(' · ');
}

function sitDownPanel(r, min, max) {
  const balance = S.session.chips;
  const free = Array.from({ length: R.POKER_SEATS }, (_, i) => i).filter((i) => !R.seatTaken(r, i));
  if (!free.length) return '<p class="dock-msg">The table is full — you are watching.</p>';
  if (balance < min) return `<p class="dock-msg">You need ${min.toLocaleString()} to sit at this table; you have ${balance.toLocaleString()}.</p>`;
  const top = Math.min(max, balance);
  const seatBtns = free.map((i) => `<button class="seat-dot" data-sit="${i}" title="Seat ${i + 1}">${i + 1}</button>`).join('');
  return `
    <div class="dock-panel dock-poker sit-panel">
      <div class="dock-head">
        <span class="dock-balance">Buy in<b id="buyInValue">${top.toLocaleString()}</b></span>
        <span class="muted">${min.toLocaleString()} – ${max.toLocaleString()}</span>
      </div>
      <input type="range" id="buyInSlider" min="${min}" max="${top}" step="${r.bb}" value="${top}" aria-label="Buy-in">
      <div class="dock-actions">
        <span class="muted">Seat</span>
        <div class="seat-dots">${seatBtns}</div>
      </div>
    </div>`;
}

function betweenHandsPanel(r, me, max) {
  const out = me.status === 'sitout';
  const canTop = !out && me.stack < max && (r.offline || S.session.chips > 0) && !(r.hand && R.inHand(r, safeKey(S.session.uid)));
  let line;
  if (r.hand && r.hand.players.includes(safeKey(S.session.uid)) && r.hand.folded && r.hand.folded[safeKey(S.session.uid)]) line = 'Folded — waiting for the next hand.';
  else if (r.hand && r.hand.phase === 'deal') line = 'Shuffling and dealing…';
  else if (out) line = 'You are sitting out.';
  else if (r.hand && r.hand.phase !== 'done' && r.hand.allIn && r.hand.allIn[safeKey(S.session.uid)]) line = 'All in.';
  else if (me.waitBB) line = 'You will be dealt in at the big blind.';
  else if (Object.values(r.players).filter((p) => p.status === 'active' && p.stack > 0).length < 2) line = 'Waiting for another player to sit down.';
  else line = 'Next hand in a moment.';
  return `
    <div class="dock-panel dock-poker">
      <p class="dock-text">${esc(line)}</p>
      <div class="dock-actions">
        <button class="btn btn-sm btn-quiet" id="sitOutToggle">${out ? "I'm back" : 'Sit out next hand'}</button>
        ${canTop ? `<button class="btn btn-sm" id="topUpBtn">Add chips to ${max.toLocaleString()}</button>` : ''}
      </div>
    </div>`;
}

export function attachPokerScreen() {
  const r = S.session.room;
  if (!r) return;
  const myKey = S.session.uid ? safeKey(S.session.uid) : null;
  const on = (id, fn) => { const el = document.getElementById(id); if (el) el.onclick = fn; };
  const forfeit = r.tournament && T.running(r) && r.players && r.players[myKey];
  on('leaveBtn', () => {
    if (forfeit && !window.confirm('Leave the tournament? Your seat is forfeit: you finish in the place you have reached, and the buy-in is not returned.')) return;
    S.leaveTable();
  });
  on('lobbyBtn', S.leaveTable);
  on('unregisterBtn', S.leaveTable);
  on('registerBtn', () => Poker.registerTournament(r.code));
  on('playAgainBtn', () => Offline.playAgain());
  on('chatToggleBtn', () => S.setChatOpen(!S.chatOpen));
  on('foldBtn', () => Poker.act('fold'));
  on('checkBtn', () => Poker.act('check'));
  on('callBtn', () => Poker.act('call'));
  on('raiseBtn', () => { raiseOpen = false; Poker.act('raise', raiseTo); });
  on('raiseOpenBtn', () => { raiseOpen = true; S.refresh(); });
  on('raiseBackBtn', () => { raiseOpen = false; S.refresh(); });
  const slider = document.getElementById('raiseSlider');
  const input = document.getElementById('raiseInput');
  const raiseBtn = document.getElementById('raiseBtn');
  const legal = R.legalActions(r, myKey);
  const setRaise = (v) => {
    if (!legal) return;
    raiseTo = Math.max(legal.minTo, Math.min(legal.maxTo, Math.round(Number(v) || legal.minTo)));
    if (slider) slider.value = raiseTo;
    if (input) input.value = raiseTo;
    if (raiseBtn) raiseBtn.textContent = raiseTo >= legal.maxTo ? 'All in ' + legal.maxTo.toLocaleString() : (r.hand.currentBet === 0 ? 'Bet ' : 'Raise to ') + raiseTo.toLocaleString();
  };
  if (slider) slider.oninput = () => setRaise(slider.value);
  if (input) input.onchange = () => setRaise(input.value);
  document.querySelectorAll('[data-raise]').forEach((b) => { b.onclick = () => setRaise(b.dataset.raise); });

  const pre = (id, value) => {
    const el = document.getElementById(id);
    if (el) el.onchange = () => {
      preAction = el.checked ? value : null;
      preActionHand = r.hand ? r.hand.id : null;
      S.refresh();
    };
  };
  pre('preCheckFold', 'checkfold');
  pre('preCallAny', 'callany');

  const buy = document.getElementById('buyInSlider');
  const buyValue = document.getElementById('buyInValue');
  if (buy) buy.oninput = () => { if (buyValue) buyValue.textContent = Number(buy.value).toLocaleString(); };
  document.querySelectorAll('[data-sit]').forEach((b) => {
    b.onclick = async () => {
      const ok = await Poker.sitDown(r.code, Number(b.dataset.sit), Number(buy ? buy.value : R.buyInRange(r).max));
      if (!ok) S.setFormError('That seat was just taken.');
    };
  });
  on('sitOutToggle', () => Poker.setSitOut(!(r.players[myKey] && r.players[myKey].status === 'sitout')));
  on('topUpBtn', () => {
    const p = r.players[myKey];
    if (p) Poker.topUp(R.buyInRange(r).max - p.stack);
  });

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
}
