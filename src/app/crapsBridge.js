// Bridges a craps room (src/app/crapsSession.js, src/craps/rules.js) to the
// 3D table (src/ui/crapsController.js), and owns the table's HUD: the
// layout you tap to bet on, the chips, the shooter's Roll, the players, the
// point and the result of each roll. Roulette's counterpart is
// rouletteBridge.js.

import { createCrapsDriver } from '../ui/crapsController.js';
import * as R from '../craps/rules.js';
import { BOARD_W, BOARD_H, AREAS, PROP_BOX, FELT, INK } from '../craps/layout.js';
import { SEAT_CHIP_COLORS } from '../scene/seatChips.js';
import { chipButtonDataURL } from '../scene/chip.js';
import { winChime, croupierSay, isSoundOn } from '../scene/sfx.js';
import { diceShake, diceWall, diceTumble } from '../scene/crapsSound.js';
import { characterPortraitDataURL, defaultCharacterFor } from '../scene/character.js';
import { dealerKeyFor } from '../scene/dealer.js';
import { safeKey, roomName, stakesTier, stakesFor, stakesLabel, chipLadderForTable } from './roomLogic.js';
import { esc, HUD_ICONS } from './uiHelpers.js';
import { playerCardAttrs, playerCardSheet, attachPlayerCard } from './playerCard.js';
import * as S from './session.js';
import * as Craps from './crapsSession.js';
import { syncVoice, voiceButtons, voiceBadge, attachVoice } from './voice.js';
import { seatPickerHtml, attachSeatPicker, closeSeatPicker } from './seatPicker.js';

let driver = null;
let scene = null;

export function mountCraps3D(handles) {
  scene = handles;
  driver = createCrapsDriver({ scene: handles.scene, camera: handles.camera, controls: handles.controls, set: handles.crapsSet, table: handles.crapsTable });
  driver.setOnLand((what) => { if (what === 'wall') { diceWall(); setTimeout(diceTumble, 120); } });
  return driver;
}

const short = (n) => (n >= 1e6 ? +(n / 1e6).toFixed(2) + 'M' : n >= 1000 ? (n % 1000 ? (n / 1000).toFixed(1).replace(/\.0$/, '') : n / 1000) + 'K' : String(n));
const players = (r) => (r.playerOrder || []).filter((k) => r.players && r.players[k]);
const seatOf = (r, key) => (r.players && r.players[key] ? r.players[key].seat : null);

// ---------- the moments ----------
let heard = { table: null, rollAt: null, resultsAt: null, round: null };
function moments(room, me) {
  const now = Date.now();
  if (heard.table !== room.code) {
    heard = { table: room.code, rollAt: room.rollAt, resultsAt: room.resultsAt, round: room.round };
    return;
  }
  if (room.phase === 'rolling' && room.rollAt && heard.rollAt !== room.rollAt) {
    heard.rollAt = room.rollAt;
    if (now - room.rollAt < 1200) diceShake();
  }
  if (room.phase === 'results' && room.roll && heard.resultsAt !== room.resultsAt) {
    heard.resultsAt = room.resultsAt;
    if (now - room.resultsAt < 3000) {
      croupierSay(room.roll.call || String(room.roll.total));
      if (me && me.result && me.result.won > 0) winChime();
    }
  }
  if (room.phase === 'betting' && room.round !== heard.round) heard.round = room.round;
}

// After the dice land the camera stays on them a moment, then goes back.
const DICE_AFTER_MS = 2600;
let backTimer = null;
function frameDice(room) {
  const now = Date.now();
  const resting = room.phase === 'results' && room.resultsAt && now - room.resultsAt < DICE_AFTER_MS;
  driver.focusDice(room.phase === 'rolling' || resting);
  const seated = !!(room.players && room.players[safeKey(S.session.uid)]);
  driver.setLift(seated && room.phase === 'betting' ? (window.innerWidth < window.innerHeight ? 0.05 : 0.2) : 0);
  clearTimeout(backTimer);
  if (resting) backTimer = setTimeout(() => { if (S.session.room && S.session.room.code === room.code) syncCrapsToScene(S.session.room, safeKey(S.session.uid)); }, room.resultsAt + DICE_AFTER_MS - now + 50);
}

// ---------- the 3D table ----------
export function syncCrapsToScene(room, myKey) {
  if (!driver || !room) return;
  const tier = stakesTier(room);
  scene.setGame('craps');
  scene.setRoomTheme(tier);
  scene.setDealerModel(dealerKeyFor(tier, room.dealerType));
  const keys = players(room);
  const bySeat = new Map(keys.map((k) => [room.players[k].seat, k]));
  for (let i = 0; i < R.CRAPS_SEATS; i++) {
    const k = bySeat.get(i);
    if (k) driver.applySeatCharacter(i, room.players[k].character || defaultCharacterFor(k));
    else driver.clearSeatCharacter(i);
  }
  const me = myKey && room.players && room.players[myKey];
  driver.setMySeat(me ? me.seat : null);
  driver.followSeat(me ? me.seat : null);
  const chips = {};
  keys.forEach((k) => { const p = room.players[k]; if (p.bets) chips[p.seat] = p.bets; });
  driver.setBets(chips, room.minBet || 100);
  driver.setStacks(Object.fromEntries(keys.map((k) => [room.players[k].seat, room.players[k].chips])), room.minBet || 100);
  driver.setPuck(room.point || null);
  driver.setBoard({ history: (room.history || []).slice(0, 15), point: room.point || null });
  frameDice(room);
  moments(room, me);
  syncVoice(room);
  const shooterSeat = room.roll ? seatOf(room, room.roll.shooter) : seatOf(room, room.shooter);
  if (room.phase === 'rolling' && room.roll) driver.showRoll(room.roll, room.rollAt, shooterSeat);
  else if (room.phase === 'results' && room.roll) driver.restDice(room.roll, room.rollAt);
  else driver.collectDice();
}

export function leaveCrapsView() {
  closeSeatPicker();
  if (!driver) return;
  clearTimeout(backTimer);
  heard = { table: null, rollAt: null, resultsAt: null, round: null };
  if (window.speechSynthesis) window.speechSynthesis.cancel();
  for (let i = 0; i < R.CRAPS_SEATS; i++) driver.clearSeatCharacter(i);
  driver.clear();
}

// ---------- the board ----------
let chipValue = null, chipTable = null;

// Which bets the roll in front of everyone just won.
function winners(roll) {
  if (!roll) return new Set();
  return new Set(R.BETS.filter((id) => R.settleBets({ [id]: 1 }, roll).won > 0));
}
function boardSvg(r, myKey, open) {
  const me = r.players[myKey];
  const won = r.phase === 'results' ? winners(r.roll) : new Set();
  const t = (s, x, y, size, color = INK, weight = 700) => `<text x="${x}" y="${y}" font-size="${size}" fill="${color}" text-anchor="middle" dominant-baseline="central" font-family="Cinzel, Georgia, serif" font-weight="${weight}">${s}</text>`;
  const parts = [`<rect width="${BOARD_W}" height="${BOARD_H}" rx="40" fill="${FELT}"/>`,
    `<rect x="${PROP_BOX.x - 14}" y="${PROP_BOX.y - 14}" width="${PROP_BOX.w + 28}" height="${PROP_BOX.h + 28}" rx="26" fill="rgba(0,0,0,0.18)"/>`];
  AREAS.forEach((a) => {
    const refusal = me && open ? R.betRefusal(r, me, a.id, Math.max(1, Math.min(chipValue || 1, me.chips || 1))) : '';
    const off = !!refusal && refusal !== 'Not enough chips' && refusal !== 'Choose a chip';
    const cx = a.x + a.w / 2, cy = a.y + a.h / 2;
    let label = '';
    if (a.id === 'pass') label = t('PASS LINE', cx, cy, 70);
    else if (a.id === 'passodds') label = t('PASS ODDS', cx, cy, 44);
    else if (a.id === 'dontpass') label = t("DON'T PASS BAR", cx, cy, 52);
    else if (a.id === 'dontodds') label = t('LAY ODDS', cx, cy, 42);
    else if (a.id === 'field') label = t('FIELD · 2 · 3 · 4 · 9 · 10 · 11 · 12', cx, cy, 58);
    else if (a.number) label = t(a.number === 6 ? 'SIX' : a.number === 9 ? 'NINE' : String(a.number), cx, cy - 10, a.number === 6 || a.number === 9 ? 84 : 120) + t(`${R.PLACE[a.number][0]}:${R.PLACE[a.number][1]}`, cx, a.y + a.h - 32, 32, 'rgba(232,207,142,0.65)');
    else if (a.id === 'any7') label = t('SEVEN · 4 TO 1', cx, cy, 44, '#ff8a9a');
    else if (a.id === 'anycraps') label = t('ANY CRAPS · 7 TO 1', cx, cy, 38, '#ff8a9a');
    else if (a.id.startsWith('hard')) label = t(`HARD ${a.id.slice(4)}`, cx, cy - 18, 40) + t(`${R.HARD[a.id.slice(4)]} TO 1`, cx, cy + 26, 30, 'rgba(232,207,142,0.7)');
    else label = t({ aces: '2', acedeuce: '3', yo: '11', twelve: '12' }[a.id], cx, cy - 16, 52) + t(`${a.id === 'aces' || a.id === 'twelve' ? 30 : 15}:1`, cx, cy + 28, 28, 'rgba(232,207,142,0.7)');
    parts.push(`<g class="cr-area ${won.has(a.id) ? 'win' : ''} ${off ? 'off' : ''}" data-bet="${a.id}" ${refusal ? `data-why="${esc(refusal)}"` : ''}>
      <rect x="${a.x}" y="${a.y}" width="${a.w}" height="${a.h}" rx="${a.band ? 30 : 10}" fill="transparent" stroke="${INK}" stroke-width="5"/>${label}</g>`);
  });
  // The puck, on the point or off.
  const puckAt = r.point ? AREAS.find((a) => a.id === 'place' + r.point) : null;
  if (puckAt) parts.push(`<g class="cr-puck"><circle cx="${puckAt.x + puckAt.w - 50}" cy="${puckAt.y + 48}" r="38" fill="#f4f1ea" stroke="#141414" stroke-width="5"/>${t('ON', puckAt.x + puckAt.w - 50, puckAt.y + 50, 28, '#141414', 800)}</g>`);
  else parts.push(`<g class="cr-puck"><circle cx="420" cy="290" r="44" fill="#141414" stroke="#f4f1ea" stroke-width="5"/>${t('OFF', 420, 292, 28, '#f4f1ea', 800)}</g>`);
  // Everyone else's chips, small, in their colours; yours on top.
  players(r).forEach((k) => {
    if (k === myKey) return;
    const p = r.players[k];
    Object.keys(p.bets || {}).forEach((id) => {
      const a = AREAS.find((x) => x.id === id);
      if (!a) return;
      const ang = (p.seat / R.CRAPS_SEATS) * Math.PI * 2;
      parts.push(`<circle class="cr-other" cx="${a.x + a.w / 2 + Math.cos(ang) * 60}" cy="${a.y + a.h / 2 + Math.sin(ang) * 26}" r="22" fill="${SEAT_CHIP_COLORS[p.seat]}"/>`);
    });
  });
  if (me && me.bets) {
    Object.entries(me.bets).forEach(([id, amount]) => {
      const a = AREAS.find((x) => x.id === id);
      if (!a) return;
      const x = a.band ? a.x + a.w * 0.82 : a.x + a.w / 2, y = a.number ? a.y + a.h * 0.6 : a.y + a.h / 2;
      parts.push(`<g class="cr-chip"><circle cx="${x}" cy="${y}" r="48" fill="${SEAT_CHIP_COLORS[me.seat]}" stroke="#f6f2ea" stroke-width="8" stroke-dasharray="14 10"/>${t(short(amount), x, y + 2, 36, '#fff', 800)}</g>`);
    });
  }
  return `<svg class="cr-board ${open ? '' : 'locked'}" viewBox="0 0 ${BOARD_W} ${BOARD_H}" role="group" aria-label="Craps layout: tap a box to bet">${parts.join('')}</svg>`;
}

function statusFor(r, k, p) {
  const bet = R.totalBet(p);
  if (r.phase === 'results' && p.result) return p.result.net > 0 ? `Won ${p.result.net.toLocaleString()}` : p.result.lost > 0 ? `Lost ${p.result.lost.toLocaleString()}` : `${bet.toLocaleString()} on the table`;
  if (bet) return `${bet.toLocaleString()} on the table`;
  return r.phase === 'betting' ? 'Choosing bets' : 'Watching';
}
const die = (n) => `<span class="cr-die">${[1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => `<i class="${({ 1: [5], 2: [1, 9], 3: [1, 5, 9], 4: [1, 3, 7, 9], 5: [1, 3, 5, 7, 9], 6: [1, 3, 4, 6, 7, 9] }[n] || []).includes(i) ? 'on' : ''}"></i>`).join('')}</span>`;

// ---------- the screen ----------
export function renderCrapsScreen() {
  const r = S.session.room;
  if (!r) return '<div class="loading"><p>Loading table…</p></div>';
  const myKey = safeKey(S.session.uid);
  const me = r.players ? r.players[myKey] : null;
  const { min, max } = stakesFor(r);
  const open = R.bettingOpen(r, Date.now());
  const countdown = Craps.countdownText(r);
  const iShoot = r.shooter === myKey;

  const statusHtml = `
    <div class="hud-status">
      ${countdown ? `<div class="status-pill ${r.point ? 'cr-pill-on' : ''}" id="countdownText">${esc(countdown)}</div>` : ''}
      ${r.phase === 'betting' && r.shooter && r.players[r.shooter] ? `<div class="status-log">${iShoot ? 'You have the dice' : esc(r.players[r.shooter].name) + ' has the dice'}</div>` : ''}
    </div>`;

  const playersHtml = players(r).map((key) => {
    const p = r.players[key];
    const isMe = key === myKey;
    return `
      <div class="player ${isMe ? '' : 'tappable'}" ${playerCardAttrs(key)}>
        <span class="rl-seat-dot" style="background:${SEAT_CHIP_COLORS[p.seat]}"></span>
        <img class="player-avatar" src="${characterPortraitDataURL(p.character || defaultCharacterFor(key), 64)}" alt="">
        <div class="player-info">
          <span class="player-name">${esc(p.name)}${isMe ? ' <span class="you">(you)</span>' : ''}${r.shooter === key ? ' <span class="cr-shooter">Shooter</span>' : ''}</span>
          <span class="player-status">${esc(statusFor(r, key, p))}</span>
        </div>
        ${voiceBadge(key)}
        <span class="player-chips">${p.chips.toLocaleString()}</span>
      </div>`;
  }).join('');

  let dock = '';
  if (me) {
    const onTable = R.totalBet(me);
    if (r.phase === 'results' && r.roll) {
      const res = me.result;
      const line = !res ? 'You had nothing riding on this roll.'
        : res.net > 0 ? `You won <b>${res.net.toLocaleString()}</b>`
        : res.lost > 0 ? `${res.lost.toLocaleString()} lost${res.won ? ` · ${res.won.toLocaleString()} won` : ''}`
        : 'Your bets ride';
      dock = `
        <div class="dock-panel cr-result">
          <span class="cr-dice">${die(r.roll.d1)}${die(r.roll.d2)}</span>
          <div class="rl-result-text"><span class="rl-result-color">${esc(r.roll.call || String(r.roll.total))}</span><span class="rl-result-line ${res && res.net > 0 ? 'good' : ''}">${line}</span></div>
          <span class="dock-balance">Balance<b>${me.chips.toLocaleString()}</b></span>
        </div>`;
    } else if (r.phase === 'rolling') {
      dock = `<p class="dock-msg">Dice are out${onTable ? ` · ${onTable.toLocaleString()} on the table` : ' · you are watching this roll'}</p>`;
    } else {
      if (chipTable !== r.code) { chipTable = r.code; chipValue = null; }
      const ladder = chipLadderForTable(min, max);
      if (!ladder.includes(chipValue)) chipValue = ladder[0];
      const chipsHtml = ladder.map((v, i) => {
        const fits = v <= me.chips;
        return `<button class="chip-btn ${v === chipValue ? 'on' : ''} ${fits ? '' : 'disabled'}" style="background-image:url(${chipButtonDataURL(v, i)});" data-cr-chip="${v}" ${fits ? '' : 'disabled'} aria-pressed="${v === chipValue}" aria-label="Bet with ${v.toLocaleString()}" title="${v.toLocaleString()}"></button>`;
      }).join('');
      const canRoll = iShoot && open && R.anyBets(r);
      dock = `
        <div class="dock-panel rl-dock cr-dock">
          <div class="dock-head">
            <span class="dock-balance">Balance<b>${me.chips.toLocaleString()}</b></span>
            <span class="dock-balance">On the table<b>${onTable.toLocaleString()}</b></span>
          </div>
          <div class="rl-board-wrap cr-board-wrap" id="crBoard">${boardSvg(r, myKey, open)}</div>
          <div class="chip-row rl-chips">${chipsHtml}</div>
          <div class="dock-actions">
            <button class="btn btn-sm btn-quiet grow" id="crUndoBtn" ${open && me.placed && me.placed.length ? '' : 'disabled'}>Undo</button>
            <button class="btn btn-sm btn-quiet grow" id="crClearBtn" ${open && onTable ? '' : 'disabled'}>Clear</button>
            <button class="btn btn-sm grow" id="crRepeatBtn" ${open && me.lastBets ? '' : 'disabled'}>Repeat</button>
            ${iShoot ? `<button class="btn btn-sm btn-primary grow cr-roll" id="crRollBtn" ${canRoll ? '' : 'disabled'} title="${canRoll ? 'Throw the dice now' : 'Bets first, then throw'}">Roll the dice</button>` : ''}
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
  const sub = ['Craps · ' + stakesLabel(min, max), r.isPublic ? 'Public · ' + players(r).length + '/' + R.CRAPS_SEATS : 'Private'].join(' · ');
  const busy = r.phase === 'rolling';
  const seatHtml = seatPickerHtml(r, myKey, R.CRAPS_SEATS, !busy && !(me && R.totalBet(me)), busy ? 'Wait for this roll to finish' : 'Take your chips off the table first');
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
        ${!r.isPublic && !r.offline ? `<button class="hud-btn" id="crInviteBtn" data-invite="${esc(inviteUrl)}">Invite</button>` : ''}
        ${seatHtml}
        ${chatBtn}
        ${voiceButtons(r)}
      </div>
    </div>
    ${S.connLost ? '<div class="conn-banner">Connection lost — reconnecting…</div>' : ''}
    ${statusHtml}
    ${playersHtml ? `<aside class="hud-players">${playersHtml}</aside>` : ''}
    ${chatSheet}
    ${playerCardSheet(r)}
    <div class="hud-dock">${dock}</div>`;
}

let toastTimer = null;
function betToast(text) {
  let el = document.getElementById('rlBetToast');
  if (!el) { el = document.createElement('div'); el.id = 'rlBetToast'; el.className = 'rl-bet-toast'; document.body.appendChild(el); }
  el.textContent = text;
  el.classList.add('on');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('on'), 1700);
}

export function attachCrapsScreen() {
  const on = (id, fn) => { const el = document.getElementById(id); if (el) el.onclick = fn; };
  attachVoice();
  const snd = document.getElementById('soundToggleBtn');
  if (snd) { const was = snd.onclick; snd.onclick = (e) => { if (isSoundOn() && window.speechSynthesis) window.speechSynthesis.cancel(); was(e); }; }
  attachSeatPicker((seat) => Craps.moveSeat(seat));
  on('leaveBtn', S.leaveTable);
  on('crUndoBtn', Craps.undo);
  on('crClearBtn', Craps.clear);
  on('crRepeatBtn', Craps.repeat);
  on('crRollBtn', () => { diceShake(); Craps.rollNow(); });
  document.querySelectorAll('[data-cr-chip]').forEach((b) => { b.onclick = () => { chipValue = Number(b.dataset.crChip); S.refresh(); }; });
  const board = document.getElementById('crBoard');
  if (board) {
    board.onclick = (e) => {
      const hit = e.target.closest('[data-bet]');
      if (!hit || !chipValue) return;
      const id = hit.getAttribute('data-bet');
      const why = hit.getAttribute('data-why');
      if (why && why !== 'Not enough chips') { betToast(why); return; }
      Craps.bet(id, chipValue);
      betToast(`${R.betLabel(id)} · ${chipValue.toLocaleString()} · pays ${R.betPays(id, S.session.room && S.session.room.point)}`);
    };
  }
  const invite = document.getElementById('crInviteBtn');
  if (invite) invite.onclick = () => { navigator.clipboard.writeText(invite.dataset.invite).then(() => { invite.textContent = 'Link copied'; setTimeout(() => { invite.textContent = 'Invite'; }, 1500); }).catch(() => {}); };
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
