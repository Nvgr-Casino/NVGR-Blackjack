// Bridges a roulette room (src/app/rouletteSession.js, src/roulette/rules.js)
// to the 3D table (src/ui/rouletteController.js), and owns the table's HUD:
// the board you tap to bet on, the chips to bet with, the last numbers, the
// players and the result. The blackjack table's counterpart is
// table3dBridge.js; poker's is pokerBridge.js.

import { createRouletteDriver } from '../ui/rouletteController.js';
import * as R from '../roulette/rules.js';
import { BOARD_W, BOARD_H, AREA_BETS, LINE_BETS, areaRect, spotOf, numberFill } from '../roulette/layout.js';
import { SEAT_CHIP_COLORS } from '../scene/rouletteTable.js';
import { chipButtonDataURL } from '../scene/chip.js';
import { rouletteSpinSound, winChime, croupierSay, isSoundOn, setSoundOn } from '../scene/sfx.js';
import { characterPortraitDataURL, defaultCharacterFor } from '../scene/character.js';
import { dealerKeyFor } from '../scene/dealer.js';
import { safeKey, roomName, stakesTier, stakesFor, stakesLabel, chipLadderForTable } from './roomLogic.js';
import { esc, HUD_ICONS } from './uiHelpers.js';
import { playerCardAttrs, playerCardSheet, attachPlayerCard } from './playerCard.js';
import * as S from './session.js';
import * as Roulette from './rouletteSession.js';

let driver = null;
let scene = null;

export function mountRoulette3D(handles) {
  scene = handles;
  driver = createRouletteDriver({ scene: handles.scene, camera: handles.camera, controls: handles.controls, set: handles.rouletteSet, table: handles.rouletteTable });
  return driver;
}

const short = (n) => (n >= 1e6 ? +(n / 1e6).toFixed(2) + 'M' : n >= 1000 ? (n % 1000 ? (n / 1000).toFixed(1).replace(/\.0$/, '') : n / 1000) + 'K' : String(n));
const players = (r) => (r.playerOrder || []).filter((k) => r.players && r.players[k]);
const colorName = (c) => (c === 'green' ? 'Zero' : c === 'red' ? 'Red' : 'Black');

// ---------- the moments ----------
// What has been heard and seen already, so each call and each sound comes
// once: the spin by its start, the result by its time, the window by its
// round. A table first opened mid-spin hears only what is left of it.
let heard = { table: null, spinAt: null, resultsAt: null, round: null };
const NUMBER_WORDS = ['Zero', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen', 'Twenty', 'Twenty-one', 'Twenty-two', 'Twenty-three', 'Twenty-four', 'Twenty-five', 'Twenty-six', 'Twenty-seven', 'Twenty-eight', 'Twenty-nine', 'Thirty', 'Thirty-one', 'Thirty-two', 'Thirty-three', 'Thirty-four', 'Thirty-five', 'Thirty-six'];
function moments(room, me) {
  const now = Date.now();
  if (heard.table !== room.code) {
    // Just sat down: nothing already over is announced.
    heard = { table: room.code, spinAt: room.spinAt, resultsAt: room.resultsAt, round: room.round };
    if (room.phase === 'spinning' && now - room.spinAt < R.SPIN_MS * 0.6) heard.spinAt = null;
    else return;
  }
  if (room.phase === 'spinning' && room.spinAt && heard.spinAt !== room.spinAt) {
    heard.spinAt = room.spinAt;
    const T = R.SPIN_MS * 0.94;
    rouletteSpinSound(T, T * 0.82, now - room.spinAt);
    if (now - room.spinAt < 1500) croupierSay('No more bets');
  }
  if (room.phase === 'results' && room.result && heard.resultsAt !== room.resultsAt) {
    heard.resultsAt = room.resultsAt;
    if (now - room.resultsAt < 3000) {
      const { number, color } = room.result;
      croupierSay(number === 0 ? 'Zero' : `${NUMBER_WORDS[number]}, ${color}`);
      if (me && me.result && me.result.won > 0) winChime();
    }
  }
  if (room.phase === 'betting' && room.round !== heard.round) {
    heard.round = room.round;
    if (me && room.bettingDeadline && room.bettingDeadline - now > R.BETTING_MS - 4000) croupierSay('Place your bets');
  }
}

// The camera swoops down over the wheel for the spin, and stays to show
// where the ball has come to rest before going back to your seat.
const WHEEL_AFTER_MS = 3200;
let backTimer = null;
function frameWheel(room) {
  const now = Date.now();
  const resting = room.phase === 'results' && room.resultsAt && now - room.resultsAt < WHEEL_AFTER_MS;
  driver.focusWheel(room.phase === 'spinning' || resting);
  // The board covers the lower part of the screen while bets are open.
  const seated = !!(room.players && room.players[safeKey(S.session.uid)]);
  const betting = seated && room.phase === 'betting';
  driver.setLift(betting ? (window.innerWidth < window.innerHeight ? 0.04 : 0.24) : 0);
  clearTimeout(backTimer);
  if (resting) backTimer = setTimeout(() => { if (S.session.room && S.session.room.code === room.code) syncRouletteToScene(S.session.room, safeKey(S.session.uid)); }, room.resultsAt + WHEEL_AFTER_MS - now + 50);
}

// ---------- the 3D table ----------
export function syncRouletteToScene(room, myKey) {
  if (!driver || !room) return;
  const tier = stakesTier(room);
  scene.setGame('roulette');
  scene.setRoomTheme(tier);
  scene.setDealerModel(dealerKeyFor(tier, room.dealerType));
  const keys = players(room);
  const bySeat = new Map(keys.map((k) => [room.players[k].seat, room.players[k]]));
  for (let i = 0; i < R.ROULETTE_SEATS; i++) {
    const p = bySeat.get(i);
    if (p) driver.applySeatCharacter(i, p.character || defaultCharacterFor(keys.find((k) => room.players[k] === p)));
    else driver.clearSeatCharacter(i);
  }
  const me = myKey && room.players && room.players[myKey];
  driver.setMySeat(me ? me.seat : null);
  driver.followSeat(me ? me.seat : null);
  // The chips on the layout: everyone's while bets are open and the ball
  // runs; once it has landed, only the bets that won stay on the felt.
  const chips = {};
  keys.forEach((k) => {
    const p = room.players[k];
    if (room.phase === 'results' && room.result) {
      const won = Object.entries(p.lastBets || {}).filter(([id]) => p.result && R.covers(id, room.result.number));
      if (won.length) chips[p.seat] = Object.fromEntries(won);
    } else if (p.bets) {
      chips[p.seat] = p.bets;
    }
  });
  driver.setBets(chips, room.minBet || 100);
  // Each player's own chips before them; the limits and the last numbers
  // on the table's plaque and tower.
  driver.setStacks(Object.fromEntries(keys.map((k) => [room.players[k].seat, room.players[k].chips])), room.minBet || 100);
  driver.setLimits(room.minBet || 100, room.maxBet || 2000);
  driver.setHistory((room.history || []).slice(0, 13), room.minBet || 100, room.maxBet || 2000);
  frameWheel(room);
  moments(room, me);
  if (room.phase === 'spinning' && room.result) {
    driver.spinTo(room.result.number, room.spinAt, R.SPIN_MS * 0.94);
    driver.showDolly(null);
  } else if (room.phase === 'results' && room.result) {
    driver.rest(room.result.number);
    driver.showDolly(room.result.number);
  } else {
    driver.rest((room.history || [])[0]);
    driver.showDolly(null);
  }
}

export function leaveRouletteView() {
  if (!driver) return;
  clearTimeout(backTimer);
  heard = { table: null, spinAt: null, resultsAt: null, round: null };
  if (window.speechSynthesis) window.speechSynthesis.cancel();
  for (let i = 0; i < R.ROULETTE_SEATS; i++) driver.clearSeatCharacter(i);
  driver.clear();
}

// ---------- the board ----------
let chipValue = null;      // the chip you are betting with
let chipTable = null;      // …at this table

function boardSvg(r, myKey, open) {
  const me = r.players[myKey];
  const result = r.phase === 'results' && r.result ? r.result.number : null;
  const label = (t, x, y, size, color = '#f2efe6') => `<text x="${x}" y="${y}" font-size="${size}" fill="${color}" text-anchor="middle" dominant-baseline="central" font-family="Georgia, serif" font-weight="700">${t}</text>`;
  const parts = [`<rect x="0" y="0" width="${BOARD_W}" height="${BOARD_H}" rx="26" fill="#0d5a31"/>`];
  // The numbers and the outside bets, each a place to tap.
  AREA_BETS.forEach((id) => {
    const a = areaRect(id);
    const [kind, arg] = id.split(':');
    const win = result !== null && R.covers(id, result);
    let fill = 'transparent', text = '';
    if (kind === 'n') {
      const n = Number(arg);
      fill = numberFill(n);
      text = label(String(n), a.x + a.w / 2, a.y + a.h / 2, n === 0 ? 96 : 76, '#fff');
    } else if (kind === 'd') text = label(['1st', '2nd', '3rd'][Number(arg) - 1] + ' 12', a.x + a.w / 2, a.y + a.h / 2, 60);
    else if (kind === 'col') text = label('2 to 1', a.x + a.w / 2, a.y + a.h / 2, 44);
    else if (id === 'red' || id === 'black') {
      const cx = a.x + a.w / 2, cy = a.y + a.h / 2;
      text = `<path d="M${cx} ${cy - 54}L${cx + 96} ${cy}L${cx} ${cy + 54}L${cx - 96} ${cy}Z" fill="${id === 'red' ? '#b3122e' : '#141414'}" stroke="#f2efe6" stroke-width="5"/>`;
    } else text = label({ low: '1 to 18', high: '19 to 36', even: 'EVEN', odd: 'ODD' }[id], a.x + a.w / 2, a.y + a.h / 2, 54);
    const inset = kind === 'n' && arg !== '0' ? 10 : 0;
    parts.push(`<g class="rl-area ${win ? 'win' : ''}" data-bet="${id}">
      <rect x="${a.x}" y="${a.y}" width="${a.w}" height="${a.h}" fill="transparent" stroke="#f2efe6" stroke-width="5"/>
      ${kind === 'n' ? `<rect x="${a.x + inset}" y="${a.y + inset}" width="${a.w - 2 * inset}" height="${a.h - 2 * inset}" rx="${arg === '0' ? 60 : 10}" fill="${fill}"/>` : ''}
      ${text}
    </g>`);
  });
  // The lines between them: splits, streets, corners, six lines.
  LINE_BETS.forEach((id) => {
    const s = spotOf(id);
    parts.push(`<circle class="rl-line" data-bet="${id}" cx="${s.x}" cy="${s.y}" r="30"/>`);
  });
  // Everyone else's chips, small, in their seat's colour; yours on top.
  players(r).forEach((k) => {
    if (k === myKey) return;
    const p = r.players[k];
    Object.keys(p.bets || {}).forEach((id) => {
      const s = spotOf(id);
      const a = (p.seat / R.ROULETTE_SEATS) * Math.PI * 2;
      parts.push(`<circle class="rl-other" cx="${s.x + Math.cos(a) * 34}" cy="${s.y + Math.sin(a) * 34}" r="20" fill="${SEAT_CHIP_COLORS[p.seat]}"/>`);
    });
  });
  if (me && me.bets) {
    Object.entries(me.bets).forEach(([id, amount]) => {
      const s = spotOf(id);
      parts.push(`<g class="rl-chip"><circle cx="${s.x}" cy="${s.y}" r="50" fill="${SEAT_CHIP_COLORS[me.seat]}" stroke="#f6f2ea" stroke-width="8" stroke-dasharray="14 10"/>${label(short(amount), s.x, s.y + 2, 38, '#fff')}</g>`);
    });
  }
  return `<svg class="rl-board ${open ? '' : 'locked'}" viewBox="0 0 ${BOARD_W} ${BOARD_H}" role="group" aria-label="Roulette layout: tap a number or a line to bet">${parts.join('')}</svg>`;
}

function historyHtml(r) {
  const h = (r.history || []).slice(0, 12);
  if (!h.length) return '';
  return `<div class="rl-history" aria-label="Last numbers">${h.map((n, i) => `<span class="rl-num ${R.colorOf(n)} ${i === 0 ? 'last' : ''}">${n}</span>`).join('')}</div>`;
}

function statusFor(r, p) {
  const bet = R.totalBet(p);
  if (r.phase === 'results') {
    if (!p.result) return 'Watching';
    return p.result.net > 0 ? `Won ${p.result.net.toLocaleString()}` : p.result.won > 0 ? `Back ${p.result.won.toLocaleString()}` : `Lost ${p.result.bet.toLocaleString()}`;
  }
  if (bet) return `Bet ${bet.toLocaleString()}`;
  return r.phase === 'betting' ? 'Choosing bets' : 'Watching';
}

// ---------- the screen ----------
export function renderRouletteScreen() {
  const r = S.session.room;
  if (!r) return '<div class="loading"><p>Loading table…</p></div>';
  const myKey = safeKey(S.session.uid);
  const me = r.players ? r.players[myKey] : null;
  const { min, max } = stakesFor(r);
  const open = R.bettingOpen(r, Date.now());
  const countdown = Roulette.countdownText(r);
  const lastLog = (r.log || []).slice(-1).map(esc).join('');

  const statusHtml = `
    <div class="hud-status">
      ${countdown ? `<div class="status-pill ${r.phase === 'results' && r.result ? 'rl-pill ' + r.result.color : ''}" id="countdownText">${countdown}</div>` : ''}
      ${historyHtml(r)}
      ${lastLog && r.phase !== 'results' ? `<div class="status-log">${lastLog}</div>` : ''}
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
          <span class="player-status">${esc(statusFor(r, p))}${r.phase === 'betting' && p.idle ? ` (${p.idle}/${R.MAX_IDLE_SPINS} missed)` : ''}</span>
        </div>
        <span class="player-chips">${p.chips.toLocaleString()}</span>
      </div>`;
  }).join('');

  // ----- the dock: the board while bets are open, the result after.
  let dock = '';
  if (me) {
    const onTable = R.totalBet(me);
    if (r.phase === 'results' && r.result) {
      const res = me.result;
      const line = !res ? 'You had no bet on this spin.'
        : res.net > 0 ? `You won <b>${res.net.toLocaleString()}</b>`
        : res.won > 0 ? `${res.won.toLocaleString()} back on ${res.bet.toLocaleString()}`
        : `No win this time · ${res.bet.toLocaleString()} lost`;
      dock = `
        <div class="dock-panel rl-result">
          <span class="rl-big ${r.result.color}">${r.result.number}</span>
          <div class="rl-result-text"><span class="rl-result-color">${colorName(r.result.color)}${r.result.number ? ` · ${r.result.number % 2 ? 'Odd' : 'Even'} · ${r.result.number <= 18 ? '1–18' : '19–36'}` : ''}</span><span class="rl-result-line ${res && res.net > 0 ? 'good' : ''}">${line}</span></div>
          <span class="dock-balance">Balance<b>${me.chips.toLocaleString()}</b></span>
        </div>`;
    } else if (r.phase === 'spinning') {
      dock = `<p class="dock-msg">No more bets${onTable ? ` · ${onTable.toLocaleString()} on the table` : ' · you are watching this spin'}</p>`;
    } else {
      if (chipTable !== r.code) { chipTable = r.code; chipValue = null; }
      const ladder = chipLadderForTable(min, max);
      if (!ladder.includes(chipValue)) chipValue = ladder[0];
      const room = Math.min(me.chips, max - onTable);
      const chipsHtml = ladder.map((v, i) => {
        const fits = v <= room;
        return `<button class="chip-btn ${v === chipValue ? 'on' : ''} ${fits ? '' : 'disabled'}" style="background-image:url(${chipButtonDataURL(v, i)});" data-rl-chip="${v}" ${fits ? '' : 'disabled'} aria-pressed="${v === chipValue}" aria-label="Bet with ${v.toLocaleString()}" title="${v.toLocaleString()}"></button>`;
      }).join('');
      const last = me.lastBets ? Object.values(me.lastBets).reduce((a, b) => a + b, 0) : 0;
      const canRepeat = open && last > 0 && last <= me.chips && onTable + last <= max;
      const canDouble = open && onTable > 0 && onTable <= me.chips && onTable * 2 <= max;
      dock = `
        <div class="dock-panel rl-dock">
          <div class="dock-head">
            <span class="dock-balance">Balance<b>${me.chips.toLocaleString()}</b></span>
            <span class="dock-balance">On the table<b>${onTable.toLocaleString()}</b></span>
          </div>
          <div class="rl-board-wrap" id="rlBoard">${boardSvg(r, myKey, open)}</div>
          <div class="chip-row rl-chips">${chipsHtml}</div>
          <div class="dock-actions">
            <button class="btn btn-sm btn-quiet grow" id="rlUndoBtn" ${open && me.placed && me.placed.length ? '' : 'disabled'}>Undo</button>
            <button class="btn btn-sm btn-quiet grow" id="rlClearBtn" ${open && onTable ? '' : 'disabled'}>Clear</button>
            <button class="btn btn-sm grow" id="rlRepeatBtn" ${canRepeat ? '' : 'disabled'}>${last ? 'Repeat ' + short(last) : 'Repeat'}</button>
            <button class="btn btn-sm grow" id="rlDoubleBtn" ${canDouble ? '' : 'disabled'}>Double</button>
          </div>
        </div>`;
    }
  } else {
    dock = '<p class="dock-msg">You are watching this table.</p>';
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
  const sub = [
    'Roulette · ' + stakesLabel(min, max),
    r.isPublic ? 'Public · ' + players(r).length + '/' + R.ROULETTE_SEATS : 'Private',
  ].join(' · ');

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
        ${!r.isPublic ? `<button class="hud-btn" id="rlInviteBtn" data-invite="${esc(inviteUrl)}">Invite</button>` : ''}
        ${chatBtn}
        <button class="hud-btn hud-icon ${isSoundOn() ? '' : 'off'}" id="rlSoundBtn" title="${isSoundOn() ? 'Sound on — tap to turn off' : 'Sound off — tap to turn on'}" aria-label="Sound ${isSoundOn() ? 'on' : 'off'}">${isSoundOn() ? SOUND_ON : SOUND_OFF}</button>
      </div>
    </div>
    ${S.connLost ? '<div class="conn-banner">Connection lost — reconnecting…</div>' : ''}
    ${statusHtml}
    ${playersHtml ? `<aside class="hud-players">${playersHtml}</aside>` : ''}
    ${chatSheet}
    ${playerCardSheet(r)}
    <div class="hud-dock">${dock}</div>`;
}

const SOUND_ON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9h4l5-4v14l-5-4H4z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';
const SOUND_OFF = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9h4l5-4v14l-5-4H4z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M17 9l5 6M22 9l-5 6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';

export function attachRouletteScreen() {
  const on = (id, fn) => { const el = document.getElementById(id); if (el) el.onclick = fn; };
  on('rlSoundBtn', () => { setSoundOn(!isSoundOn()); if (!isSoundOn() && window.speechSynthesis) window.speechSynthesis.cancel(); S.refresh(); });
  on('leaveBtn', S.leaveTable);
  on('rlUndoBtn', Roulette.undo);
  on('rlClearBtn', Roulette.clear);
  on('rlRepeatBtn', Roulette.repeat);
  on('rlDoubleBtn', Roulette.double);
  document.querySelectorAll('[data-rl-chip]').forEach((b) => { b.onclick = () => { chipValue = Number(b.dataset.rlChip); S.refresh(); }; });
  const board = document.getElementById('rlBoard');
  if (board) {
    board.onclick = (e) => {
      const hit = e.target.closest('[data-bet]');
      if (hit && chipValue) Roulette.bet(hit.getAttribute('data-bet'), chipValue);
    };
  }
  const invite = document.getElementById('rlInviteBtn');
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
