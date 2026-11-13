// Bridges a baccarat room (src/app/baccaratSession.js, src/baccarat/rules.js)
// to the 3D table (src/ui/baccaratController.js), and owns the table's HUD:
// the bets — player, banker, tie, the pairs — the chips to bet with, the
// cards as they are turned, the scoreboard, the players and the result.

import { createBaccaratDriver } from '../ui/baccaratController.js';
import * as B from '../baccarat/rules.js';
import { SEAT_CHIP_COLORS } from '../scene/seatChips.js';
import { chipButtonDataURL } from '../scene/chip.js';
import { cardFaceUrl } from '../scene/card.js';
import { winChime, croupierSay, isSoundOn, setSoundOn } from '../scene/sfx.js';
import { characterPortraitDataURL, defaultCharacterFor } from '../scene/character.js';
import { dealerKeyFor } from '../scene/dealer.js';
import { safeKey, roomName, stakesTier, stakesFor, stakesLabel, chipLadderForTable } from './roomLogic.js';
import { esc, HUD_ICONS } from './uiHelpers.js';
import { playerCardAttrs, playerCardSheet, attachPlayerCard } from './playerCard.js';
import { musicButton, attachMusicButton } from './voice.js';
import * as S from './session.js';
import * as Baccarat from './baccaratSession.js';

let driver = null;
let scene = null;

export function mountBaccarat3D(handles) {
  scene = handles;
  driver = createBaccaratDriver({ scene: handles.scene, camera: handles.camera, controls: handles.controls, set: handles.baccaratSet, table: handles.baccaratTable, dealer: handles.dealer });
  return driver;
}

const short = (n) => (n >= 1e6 ? +(n / 1e6).toFixed(2) + 'M' : n >= 1000 ? (n % 1000 ? (n / 1000).toFixed(1).replace(/\.0$/, '') : n / 1000) + 'K' : String(n));
const players = (r) => (r.playerOrder || []).filter((k) => r.players && r.players[k]);
const winnerWord = (h) => (h.winner === 'tie' ? 'Tie' : h.winner === 'player' ? 'Player wins' : 'Banker wins');
// Which of a set of bets won (or stood off) on a coup: those stay on the
// felt while the coup is paid.
function standing(bets, hand) {
  return Object.fromEntries(Object.entries(bets || {}).filter(([id]) => (
    id === 'player' ? hand.winner !== 'banker'
      : id === 'banker' ? hand.winner !== 'player'
        : id === 'tie' ? hand.winner === 'tie'
          : id === 'ppair' ? hand.ppair : hand.bpair
  )));
}

// ---------- the moments ----------
let heard = { table: null, dealAt: null, resultsAt: null, round: null };
function moments(room, me) {
  const now = Date.now();
  if (heard.table !== room.code) {
    heard = { table: room.code, dealAt: room.dealAt, resultsAt: room.resultsAt, round: room.round };
    return;
  }
  if (room.phase === 'dealing' && room.dealAt && heard.dealAt !== room.dealAt) {
    heard.dealAt = room.dealAt;
    if (now - room.dealAt < 1500) croupierSay('No more bets');
  }
  if (room.phase === 'results' && room.hand && heard.resultsAt !== room.resultsAt) {
    heard.resultsAt = room.resultsAt;
    if (now - room.resultsAt < 3000) {
      const h = room.hand;
      croupierSay(h.winner === 'tie' ? `Tie, ${h.ptotal} all` : `${h.winner === 'player' ? 'Player' : 'Banker'} wins, ${Math.max(h.ptotal, h.btotal)} over ${Math.min(h.ptotal, h.btotal)}`);
      if (me && me.result && me.result.net > 0) winChime();
    }
  }
  if (room.phase === 'betting' && room.round !== heard.round) {
    heard.round = room.round;
    if (me && room.bettingDeadline && room.bettingDeadline - now > B.BETTING_MS - 4000) croupierSay('Place your bets');
  }
}

// The camera goes down to the cards for the coup and stays a moment on
// them before going back to the seat.
const CARDS_AFTER_MS = 3200;
let backTimer = null;
function frameCards(room) {
  const now = Date.now();
  const resting = room.phase === 'results' && room.resultsAt && now - room.resultsAt < CARDS_AFTER_MS;
  driver.focusCards(room.phase === 'dealing' || resting);
  // The betting panel covers the lower part of the screen while bets are open.
  const seated = !!(room.players && room.players[safeKey(S.session.uid)]);
  driver.setLift(seated && room.phase === 'betting' ? (window.innerWidth < window.innerHeight ? 0.05 : 0.2) : 0);
  clearTimeout(backTimer);
  if (resting) backTimer = setTimeout(() => { if (S.session.room && S.session.room.code === room.code) syncBaccaratToScene(S.session.room, safeKey(S.session.uid)); }, room.resultsAt + CARDS_AFTER_MS - now + 50);
}

// ---------- the 3D table ----------
export function syncBaccaratToScene(room, myKey) {
  if (!driver || !room) return;
  const tier = stakesTier(room);
  scene.setGame('baccarat');
  scene.setRoomTheme(tier);
  scene.setDealerModel(dealerKeyFor(tier, room.dealerType));
  const keys = players(room);
  const bySeat = new Map(keys.map((k) => [room.players[k].seat, k]));
  for (let i = 0; i < B.BACCARAT_SEATS; i++) {
    const k = bySeat.get(i);
    if (k) driver.applySeatCharacter(i, room.players[k].character || defaultCharacterFor(k));
    else driver.clearSeatCharacter(i);
  }
  const me = myKey && room.players && room.players[myKey];
  driver.setMySeat(me ? me.seat : null);
  driver.followSeat(me ? me.seat : null);
  const chips = {};
  keys.forEach((k) => {
    const p = room.players[k];
    if (room.phase === 'results' && room.hand) {
      const won = standing(p.lastBets, room.hand);
      if (p.result && Object.keys(won).length) chips[p.seat] = won;
    } else if (p.bets) {
      chips[p.seat] = p.bets;
    }
  });
  driver.setBets(chips, room.minBet || 100);
  driver.setStacks(Object.fromEntries(keys.map((k) => [room.players[k].seat, room.players[k].chips])), room.minBet || 100);
  driver.setHistory(room.history || [], room.minBet || 100, room.maxBet || 2000);
  driver.setHand(room.phase === 'dealing' || room.phase === 'results' ? room.hand : null, room.dealAt);
  frameCards(room);
  moments(room, me);
}

export function leaveBaccaratView() {
  if (!driver) return;
  clearTimeout(backTimer);
  heard = { table: null, dealAt: null, resultsAt: null, round: null };
  if (window.speechSynthesis) window.speechSynthesis.cancel();
  for (let i = 0; i < B.BACCARAT_SEATS; i++) driver.clearSeatCharacter(i);
  driver.clear();
}

// ---------- the cards on the screen ----------
// The cards turned so far, and the hands' totals as they stand, in step
// with the table.
function readoutHtml(room) {
  const h = room.hand;
  if (!h) return '';
  const times = B.revealTimes(h);
  const t = Date.now() - room.dealAt;
  const shown = { player: [], banker: [] };
  const count = { player: 0, banker: 0 };
  h.order.forEach((side, i) => {
    const s = side === 'P' ? 'player' : 'banker';
    const card = h[s][count[s]++];
    if (t >= times[i] - 900 || room.phase === 'results') shown[s].push(t >= times[i] || room.phase === 'results' ? card : null);
  });
  const side = (s, label) => {
    const up = shown[s].filter(Boolean);
    const total = up.length ? B.handTotal(up) : '–';
    const win = room.phase === 'results' && (h.winner === s || h.winner === 'tie');
    return `
      <div class="bc-hand ${s} ${win ? 'won' : ''}">
        <span class="bc-hand-label">${label}</span>
        <span class="bc-cards">${shown[s].map((c, i) => c ? `<img class="rc ${i === 2 ? 'third' : ''}" src="${cardFaceUrl(...c.split('-'))}" alt="${esc(c)}">` : '<span class="rc rc-back"></span>').join('')}</span>
        <span class="bc-total">${total}</span>
      </div>`;
  };
  return `<div class="readout bc-readout" id="bcReadout">${side('player', 'Player')}${side('banker', 'Banker')}</div>`;
}
let readoutTimer = null;
function keepReadout() {
  clearInterval(readoutTimer);
  readoutTimer = setInterval(() => {
    const r = S.session.room;
    const el = document.getElementById('bcReadout');
    if (!r || r.game !== 'baccarat' || r.phase !== 'dealing' || !el) { clearInterval(readoutTimer); readoutTimer = null; return; }
    el.outerHTML = readoutHtml(r);
  }, 250);
}

function beadsHtml(history) {
  const last = (history || []).slice(-14);
  if (!last.length) return '';
  return `<div class="bc-beads" aria-label="Last results">${last.map((m, i) => `<span class="bc-bead ${m[0]} ${i === last.length - 1 ? 'last' : ''}">${m[0]}</span>`).join('')}</div>`;
}

function statusFor(r, p) {
  const bet = B.totalBet(p);
  if (r.phase === 'results') {
    if (!p.result) return 'Watching';
    return p.result.net > 0 ? `Won ${p.result.net.toLocaleString()}` : p.result.won > 0 ? `Back ${p.result.won.toLocaleString()}` : `Lost ${p.result.bet.toLocaleString()}`;
  }
  if (bet) return `Bet ${bet.toLocaleString()}`;
  return r.phase === 'betting' ? 'Choosing bets' : 'Watching';
}

// ---------- the screen ----------
let chipValue = null;
let chipTable = null;
const SOUND_ON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9h4l5-4v14l-5-4H4z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';
const SOUND_OFF = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9h4l5-4v14l-5-4H4z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M17 9l5 6M22 9l-5 6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';

export function renderBaccaratScreen() {
  const r = S.session.room;
  if (!r) return '<div class="loading"><p>Loading table…</p></div>';
  const myKey = safeKey(S.session.uid);
  const me = r.players ? r.players[myKey] : null;
  const { min, max } = stakesFor(r);
  const open = B.bettingOpen(r, Date.now());
  const countdown = Baccarat.countdownText(r);
  const lastLog = (r.log || []).slice(-1).map(esc).join('');
  const resultClass = r.phase === 'results' && r.hand ? ' bc-pill ' + r.hand.winner : '';

  const statusHtml = `
    <div class="hud-status">
      ${countdown ? `<div class="status-pill${resultClass}" id="countdownText">${countdown}</div>` : ''}
      ${beadsHtml(r.history)}
      ${lastLog && r.phase === 'betting' ? `<div class="status-log">${lastLog}</div>` : ''}
    </div>`;

  const playersHtml = players(r).map((key) => {
    const p = r.players[key];
    const isMe = key === myKey;
    return `
      <div class="player ${isMe ? '' : 'tappable'}" ${playerCardAttrs(key)}>
        <span class="rl-seat-dot" style="background:${SEAT_CHIP_COLORS[p.seat]}"></span>
        <img class="player-avatar" src="${characterPortraitDataURL(p.character || defaultCharacterFor(key), 64)}" alt="">
        <div class="player-info">
          <span class="player-name">${esc(p.name)}${isMe ? ' <span class="you">(you)</span>' : ''}</span>
          <span class="player-status">${esc(statusFor(r, p))}${r.phase === 'betting' && p.idle ? ` (${p.idle}/${B.MAX_IDLE} missed)` : ''}</span>
        </div>
        <span class="player-chips">${p.chips.toLocaleString()}</span>
      </div>`;
  }).join('');

  let dock = '';
  if (me) {
    const onTable = B.totalBet(me);
    if (r.phase === 'dealing') {
      dock = `${readoutHtml(r)}<p class="dock-msg">No more bets${onTable ? ` · ${onTable.toLocaleString()} on the table` : ' · you are watching this coup'}</p>`;
    } else if (r.phase === 'results' && r.hand) {
      const res = me.result;
      const line = !res ? 'You had no bet on this coup.'
        : res.net > 0 ? `You won <b>${res.net.toLocaleString()}</b>`
        : res.won > 0 ? `${res.won.toLocaleString()} back on ${res.bet.toLocaleString()}`
        : `No win this time · ${res.bet.toLocaleString()} lost`;
      const pairs = [r.hand.ppair && 'Player pair', r.hand.bpair && 'Banker pair'].filter(Boolean).join(' · ');
      dock = `
        ${readoutHtml(r)}
        <div class="dock-panel rl-result bc-result">
          <span class="bc-big ${r.hand.winner}">${r.hand.winner === 'tie' ? 'T' : r.hand.winner === 'player' ? 'P' : 'B'}</span>
          <div class="rl-result-text"><span class="rl-result-color">${winnerWord(r.hand)} · ${r.hand.winner === 'tie' ? r.hand.ptotal + ' all' : Math.max(r.hand.ptotal, r.hand.btotal) + ' to ' + Math.min(r.hand.ptotal, r.hand.btotal)}${r.hand.natural ? ' · natural' : ''}${pairs ? ' · ' + pairs : ''}</span><span class="rl-result-line ${res && res.net > 0 ? 'good' : ''}">${line}</span></div>
          <span class="dock-balance">Balance<b>${me.chips.toLocaleString()}</b></span>
        </div>`;
    } else {
      if (chipTable !== r.code) { chipTable = r.code; chipValue = null; }
      const ladder = chipLadderForTable(min, max);
      if (!ladder.includes(chipValue)) chipValue = ladder[0];
      const room = Math.min(me.chips, max - onTable);
      const chipsHtml = ladder.map((v, i) => {
        const fits = v <= room;
        return `<button class="chip-btn ${v === chipValue ? 'on' : ''} ${fits ? '' : 'disabled'}" style="background-image:url(${chipButtonDataURL(v, i)});" data-bc-chip="${v}" ${fits ? '' : 'disabled'} aria-pressed="${v === chipValue}" aria-label="Bet with ${v.toLocaleString()}" title="${v.toLocaleString()}"></button>`;
      }).join('');
      const bets = me.bets || {};
      const box = (id, label, pays) => `
        <button class="bc-bet ${id}" data-bc-bet="${id}" ${open && chipValue <= room ? '' : 'disabled'} aria-label="Bet on ${B.BET_LABEL[id]}, pays ${pays}">
          <span class="bc-bet-name">${label}</span><span class="bc-bet-pays">${pays}</span>
          ${bets[id] ? `<span class="bc-stake" style="background:${SEAT_CHIP_COLORS[me.seat]}">${short(bets[id])}</span>` : ''}
        </button>`;
      const last = me.lastBets ? Object.values(me.lastBets).reduce((a, b) => a + b, 0) : 0;
      const canRepeat = open && last > 0 && last <= me.chips && onTable + last <= max;
      const canDouble = open && onTable > 0 && onTable <= me.chips && onTable * 2 <= max;
      dock = `
        <div class="dock-panel rl-dock bc-dock">
          <div class="dock-head">
            <span class="dock-balance">Balance<b>${me.chips.toLocaleString()}</b></span>
            <span class="dock-balance">On the table<b>${onTable.toLocaleString()}</b></span>
          </div>
          <div class="bc-bets">
            ${box('ppair', 'P Pair', '11:1')}
            ${box('player', 'Player', '1:1')}
            ${box('tie', 'Tie', '8:1')}
            ${box('banker', 'Banker', '0.95:1')}
            ${box('bpair', 'B Pair', '11:1')}
          </div>
          <div class="chip-row rl-chips">${chipsHtml}</div>
          <div class="dock-actions">
            <button class="btn btn-sm btn-quiet grow" id="bcUndoBtn" ${open && me.placed && me.placed.length ? '' : 'disabled'}>Undo</button>
            <button class="btn btn-sm btn-quiet grow" id="bcClearBtn" ${open && onTable ? '' : 'disabled'}>Clear</button>
            <button class="btn btn-sm grow" id="bcRepeatBtn" ${canRepeat ? '' : 'disabled'}>${last ? 'Repeat ' + short(last) : 'Repeat'}</button>
            <button class="btn btn-sm grow" id="bcDoubleBtn" ${canDouble ? '' : 'disabled'}>Double</button>
          </div>
        </div>`;
    }
  } else {
    dock = r.phase === 'dealing' || r.phase === 'results' ? readoutHtml(r) : '<p class="dock-msg">You are watching this table.</p>';
  }

  const chatMsgs = r.chat || [];
  const chatBtn = `<button class="hud-btn hud-labelled ${S.chatOpen ? 'active' : ''}" id="chatToggleBtn" aria-label="Chat">${HUD_ICONS.chat}<span class="hud-label">Chat</span>${chatMsgs.length ? ` <span class="count">${chatMsgs.length}</span>` : ''}</button>`;
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
  const inviteUrl = location.origin + location.pathname + '?room=' + r.code;
  const sub = ['Baccarat · ' + stakesLabel(min, max), r.isPublic ? 'Public · ' + players(r).length + '/' + B.BACCARAT_SEATS : 'Private'].join(' · ');
  if (r.phase === 'dealing') keepReadout();

  return `
    <div class="hud-top">
      <div class="hud-left">
        <button class="hud-btn" id="leaveBtn">← Leave</button>
        <div class="hud-table">
          <span class="hud-code">${esc(roomName(r))} · ${esc(r.code)}</span>
          <span class="hud-sub">${sub}</span>
        </div>
      </div>
      <div class="hud-right">
        ${!r.isPublic && !r.offline ? `<button class="hud-btn" id="bcInviteBtn" data-invite="${esc(inviteUrl)}">Invite</button>` : ''}
        ${chatBtn}
        ${musicButton()}
        <button class="hud-btn hud-icon ${isSoundOn() ? '' : 'off'}" id="bcSoundBtn" title="${isSoundOn() ? 'Sound on — tap to turn off' : 'Sound off — tap to turn on'}" aria-label="Sound ${isSoundOn() ? 'on' : 'off'}">${isSoundOn() ? SOUND_ON : SOUND_OFF}</button>
      </div>
    </div>
    ${S.connLost ? '<div class="conn-banner">Connection lost — reconnecting…</div>' : ''}
    ${statusHtml}
    ${playersHtml ? `<aside class="hud-players">${playersHtml}</aside>` : ''}
    ${chatSheet}
    ${playerCardSheet(r)}
    <div class="hud-dock">${dock}</div>`;
}

export function attachBaccaratScreen() {
  const on = (id, fn) => { const el = document.getElementById(id); if (el) el.onclick = fn; };
  on('leaveBtn', S.leaveTable);
  on('bcUndoBtn', Baccarat.undo);
  on('bcClearBtn', Baccarat.clear);
  on('bcRepeatBtn', Baccarat.repeat);
  on('bcDoubleBtn', Baccarat.double);
  attachMusicButton();
  on('bcSoundBtn', () => { setSoundOn(!isSoundOn()); if (!isSoundOn() && window.speechSynthesis) window.speechSynthesis.cancel(); S.refresh(); });
  document.querySelectorAll('[data-bc-chip]').forEach((b) => { b.onclick = () => { chipValue = Number(b.dataset.bcChip); S.refresh(); }; });
  document.querySelectorAll('[data-bc-bet]').forEach((b) => { b.onclick = () => { if (chipValue) Baccarat.bet(b.dataset.bcBet, chipValue); }; });
  const invite = document.getElementById('bcInviteBtn');
  if (invite) invite.onclick = () => {
    navigator.clipboard.writeText(invite.dataset.invite).then(() => { invite.textContent = 'Link copied'; setTimeout(() => { invite.textContent = 'Invite'; }, 1500); }).catch(() => {});
  };
  on('chatToggleBtn', () => S.setChatOpen(!S.chatOpen));
  const chatSendBtn = document.getElementById('chatSendBtn');
  const chatInput = document.getElementById('chatInput');
  if (chatSendBtn && chatInput) {
    const send = () => { const v = chatInput.value; chatInput.value = ''; S.sendChatMessage(v); };
    chatSendBtn.onclick = send;
    chatInput.onkeydown = (e) => { if (e.key === 'Enter') send(); };
  }
  const chatLog = document.getElementById('chatLog');
  if (chatLog) chatLog.scrollTop = chatLog.scrollHeight;
  attachPlayerCard();
}
