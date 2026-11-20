// Bridges Rummy (rummySession.js, src/rummy/rules.js) to its table in 3D
// (src/ui/rummyController.js), and owns its HUD: your hand in the groups
// you lay it out in — tap to pick cards, drag to move one — the closed
// deck, the open pile and the wild joker to draw from, your moves, and the
// scores when the deal is won.

import { createRummyDriver } from '../ui/rummyController.js';
import * as R from '../rummy/rules.js';
import { cardFaceUrl } from '../scene/card.js';
import { characterPortraitDataURL, defaultCharacterFor } from '../scene/character.js';
import { dealerKeyFor } from '../scene/dealer.js';
import { esc } from './uiHelpers.js';
import * as S from './session.js';
import * as RM from './rummySession.js';

let driver = null;
let scene = null;
export function mountRummy3D(handles) {
  scene = handles;
  driver = createRummyDriver(handles);
  driver.setVisible(false);
}

// ---------- the diff ----------
let shownDeal = null, seen = {}, revealed = false, dealtAt = 0;
function resetView() { shownDeal = null; seen = {}; revealed = false; dealtAt = 0; }
export function leaveRummyView() {
  if (!driver) return;
  for (let i = 0; i < 6; i++) driver.clearSeatCharacter(i);
  driver.setLabels({});
  driver.setButton(null);
  driver.setVisible(false);
  resetView();
  selected = new Set();
}
const ROOM_FOR_TIER = [3, 5, 6];
const fmt = (n) => Math.round(n).toLocaleString('en-US');
const signed = (n) => (n > 0 ? '+' : n < 0 ? '−' : '') + fmt(Math.abs(n));

export function syncRummyToScene(room) {
  if (!driver || !room) return;
  scene.setGame('rummy');
  scene.setRoomTheme(ROOM_FOR_TIER[(room.tier || 1) - 1] || 3);
  scene.setDealerModel(dealerKeyFor(room.tier, room.dealerType));
  scene.setPokerFelt(room.felt, 'rummy');
  driver.setVisible(true);
  const players = room.players;
  const bySeat = new Map(Object.entries(players).map(([k, p]) => [p.seat, k]));
  for (let i = 0; i < 6; i++) {
    const k = bySeat.get(i);
    if (k) driver.applySeatCharacter(i, players[k].character || defaultCharacterFor(k));
    else driver.clearSeatCharacter(i);
  }
  const me = RM.myKey();
  const mySeat = players[me].seat;
  driver.followSeat(mySeat);
  const d = room.deal;
  const labels = {};
  Object.entries(players).forEach(([k, p]) => {
    labels[p.seat] = { name: p.name, stack: p.net, action: d ? statusOf(d, k) : '', active: !!(d && d.toAct === k), folded: !!(d && d.dropped[k]), away: false };
  });
  driver.setLabels(labels);
  driver.setButton(room.dealerSeat);
  if (!d) return;
  const seatOf = (k) => players[k].seat;
  if (d.id !== shownDeal) {
    resetView();
    shownDeal = d.id;
    const ms = driver.deal(d.order.map(seatOf), mySeat, d.wildCard, d.open[0], d.closed.length);
    dealtAt = performance.now() + ms;
    // Moves already made (none at the start of a deal) are not replayed.
    Object.entries(d.last).forEach(([k, l]) => { seen[k] = l.seq; });
  }
  // Each new move, in the order made.
  const fresh = Object.entries(d.last).filter(([k, l]) => l.seq > (seen[k] || 0)).sort((a, b) => a[1].seq - b[1].seq);
  fresh.forEach(([k, l]) => {
    seen[k] = l.seq;
    const run = () => {
      if (shownDeal !== d.id) return;
      if (l.action === 'closed') driver.draw(seatOf(k), false, d.closed.length);
      else if (l.action === 'open') driver.draw(seatOf(k), true, d.closed.length);
      else if (l.action === 'discard') driver.discard(seatOf(k), l.card);
      else if (l.action === 'drop') driver.drop(seatOf(k));
    };
    const wait = dealtAt - performance.now();
    if (wait > 0) setTimeout(run, wait); else run();
  });
  if (d.phase === 'done' && d.result && !revealed) {
    revealed = true;
    const bySeat2 = {};
    Object.entries(d.result.groups).forEach(([k, g]) => { bySeat2[seatOf(k)] = g; });
    setTimeout(() => { if (shownDeal === d.id) driver.reveal(bySeat2); }, 600);
  }
}
function statusOf(d, k) {
  if (d.phase === 'done') return d.result.winner === k ? 'Declared' : d.dropped[k] ? 'Dropped' : `${d.result.points[k]} pts`;
  if (d.dropped[k]) return 'Dropped';
  if (d.toAct === k) return d.stage === 'draw' ? 'Drawing' : 'Discarding';
  return '';
}

// ---------- the HUD ----------
let selected = new Set();
const cardImg = (id, cls = '') => `<img class="rm-face ${cls}" src="${cardFaceUrl(...id.split('#')[0].split('-'))}" alt="${esc(id.split('#')[0])}" draggable="false">`;
const KIND = { pure: 'Pure sequence', seq: 'Sequence', set: 'Set' };

function handHtml(room, d) {
  const me = RM.myKey();
  const groups = room.groups;
  const myTurn = d.toAct === me && d.phase === 'play';
  return groups.map((g, gi) => {
    const kind = R.meldKind(g, d.wild);
    const pts = g.reduce((a, c) => a + R.value(c, d.wild), 0);
    return `
      <div class="rm-group ${kind ? 'ok' : ''}" data-group="${gi}">
        <div class="rm-cards">${g.map((c) => `
          <button class="rm-card ${selected.has(c) ? 'sel' : ''} ${c === d.drawn && myTurn ? 'new' : ''} ${R.isJoker(c, d.wild) ? 'joker' : ''}" data-card="${esc(c)}">${cardImg(c)}${R.isJoker(c, d.wild) && !R.isPrinted(c) ? '<i class="rm-wild">J</i>' : ''}</button>`).join('')}</div>
        <span class="rm-label">${kind ? KIND[kind] : g.length >= 3 ? `Invalid · ${pts}` : `${pts} pts`}</span>
      </div>`;
  }).join('');
}

function resultHtml(room, d) {
  const me = RM.myKey();
  const r = d.result;
  const rows = d.order.map((k) => {
    const p = room.players[k];
    const win = r.winner === k;
    return `
      <div class="rm-res-row ${win ? 'win' : ''} ${k === me ? 'me' : ''}">
        <img class="wp-avatar" src="${characterPortraitDataURL(p.character || defaultCharacterFor(k), 64)}" alt="">
        <div class="rm-res-who"><b>${k === me ? 'You' : esc(p.name)}</b><span>${win ? 'Declared' : d.dropped[k] ? 'Dropped' : `${r.points[k]} points`}</span></div>
        <div class="rm-res-cards">${(r.groups[k] || []).map((g) => `<span class="rm-res-group">${g.map((c) => cardImg(c, 'mini')).join('')}</span>`).join('')}</div>
        <b class="rm-res-chips ${r.chips[k] > 0 ? 'up' : r.chips[k] < 0 ? 'down' : ''}">${signed(r.chips[k] || 0)}</b>
      </div>`;
  }).join('');
  const mine = r.winner === me;
  return `
    <div class="rm-result">
      <div class="rm-res-title">${mine ? 'You declared — the deal is yours' : `${esc(room.players[r.winner].name)} declared`}</div>
      ${rows}
      <div class="rm-res-actions"><button class="btn btn-quiet" id="leaveBtn2">Leave</button><button class="btn btn-primary" id="rmNext">Next deal</button></div>
    </div>`;
}

export function renderRummyScreen() {
  const room = S.session.room;
  if (!room) return '<div class="loading"><p>Opening the table…</p></div>';
  const me = RM.myKey();
  const d = room.deal;
  const notice = RM.takeNotice();

  let status = '';
  if (!d) status = room.message || 'Shuffling…';
  else if (d.phase === 'deal') status = 'Dealing…';
  else if (d.phase === 'play') {
    if (d.dropped[me]) status = 'You dropped — the others play on';
    else if (d.toAct === me) status = d.stage === 'draw' ? 'Your turn — draw a card' : 'Discard a card, or declare';
    else status = `${room.players[d.toAct].name} is ${d.stage === 'draw' ? 'drawing' : 'discarding'}`;
  }

  let body = '';
  if (d && d.phase === 'done' && d.result) body = resultHtml(room, d);
  else if (d && d.hands[me] && !d.dropped[me]) {
    const myTurn = d.toAct === me && d.phase === 'play';
    const canDraw = myTurn && d.stage === 'draw';
    const canThrow = myTurn && d.stage === 'discard';
    const top = d.open[d.open.length - 1];
    const sel = [...selected].filter((c) => d.hands[me].includes(c));
    selected = new Set(sel);
    const laid = room.groups;
    const pts = R.pointsFor(laid, d.wild);
    body = `
      <div class="rm-middle">
        <button class="rm-pile closed ${canDraw ? 'live' : ''}" id="rmDrawClosed" ${canDraw ? '' : 'disabled'}><span class="rm-back"></span><small>Closed · ${d.closed.length}</small></button>
        <button class="rm-pile open ${canDraw && top ? 'live' : ''}" id="rmDrawOpen" ${canDraw && top ? '' : 'disabled'}>${top ? cardImg(top) : '<span class="rm-empty"></span>'}<small>Open pile</small></button>
        <div class="rm-pile wild">${cardImg(d.wildCard)}<small>Wild · ${R.isPrinted(d.wildCard) ? 'Aces' : esc(d.wild) + 's'}</small></div>
      </div>
      <div class="rm-hand" id="rmHand">${handHtml(room, d)}</div>
      <div class="rm-bar">
        <span class="rm-pts">Points <b>${pts}</b></span>
        <button class="btn btn-sm btn-quiet" id="rmSort">Sort</button>
        <button class="btn btn-sm btn-quiet" id="rmArrange">Arrange</button>
        <button class="btn btn-sm" id="rmGroup" ${sel.length >= 2 ? '' : 'disabled'}>Group${sel.length >= 2 ? ` ${sel.length}` : ''}</button>
        ${canDraw ? `<button class="btn btn-sm btn-quiet rm-drop" id="rmDrop">Drop · ${d.turns[me] ? R.MIDDLE_DROP : R.FIRST_DROP} pts</button>` : ''}
        ${canThrow ? `<button class="btn btn-sm" id="rmDiscard" ${sel.length === 1 ? '' : 'disabled'}>Discard</button>
        <button class="btn btn-sm btn-primary" id="rmDeclare" ${sel.length === 1 ? '' : 'disabled'}>Declare</button>` : ''}
      </div>`;
  } else if (d) body = `<div class="rm-bar"><span class="rm-pts">${d.dropped[me] ? `Dropped · ${d.dropped[me]} points` : ''}</span></div>`;

  const playersHtml = Object.entries(room.players).sort((a, b) => a[1].seat - b[1].seat).map(([k, p]) => `
    <div class="player ${d && d.toAct === k ? 'on-turn' : ''}">
      <img class="player-avatar" src="${characterPortraitDataURL(p.character || defaultCharacterFor(k), 64)}" alt="">
      <div class="player-info">
        <span class="player-name">${esc(p.name)}${k === me ? ' <span class="you">(you)</span>' : ''}${room.dealerSeat === p.seat ? ' <span class="role">D</span>' : ''}</span>
        <span class="player-status">${esc(d ? statusOf(d, k) || 'Waiting' : '')}</span>
      </div>
      <span class="player-chips ${p.net > 0 ? 'up' : p.net < 0 ? 'down' : ''}">${signed(p.net)}</span>
    </div>`).join('');

  return `
    <div class="hud-top">
      <div class="hud-left">
        <button class="hud-btn" id="leaveBtn">← Leave</button>
        <div class="hud-table">
          <span class="hud-code">Rummy · ${esc(room.stakesName)}</span>
          <span class="hud-sub">${fmt(room.point)} a point · at most ${R.MAX_POINTS} points a deal</span>
        </div>
      </div>
      <div class="hud-right"><span class="wallet"><span class="chip-dot"></span>${fmt(room.balance)}</span></div>
    </div>
    <div class="hud-status">
      ${status ? `<div class="status-pill ${d && d.toAct === me ? 'urgent' : ''}">${esc(status)}</div>` : ''}
      ${room.message && d ? `<div class="status-log rm-msg">${esc(room.message)}</div>` : ''}
      ${notice ? `<div class="status-log">${esc(notice)}</div>` : ''}
    </div>
    <aside class="hud-players rm-players">${playersHtml}</aside>
    <div class="rm-dock">${body}</div>`;
}

// ---------- the controls ----------
let drag = null;
export function attachRummyScreen() {
  const on = (id, fn) => { const el = document.getElementById(id); if (el) el.onclick = fn; };
  on('leaveBtn', () => S.leaveTable());
  on('leaveBtn2', () => S.leaveTable());
  on('rmNext', () => RM.nextDeal());
  on('rmDrawClosed', () => RM.drawCard(false));
  on('rmDrawOpen', () => RM.drawCard(true));
  on('rmSort', () => { selected.clear(); RM.sortMine(); });
  on('rmArrange', () => { selected.clear(); RM.arrangeMine(); });
  on('rmGroup', () => { const s = [...selected]; selected.clear(); RM.groupCards(s); });
  on('rmDrop', () => RM.drop());
  on('rmDiscard', () => { const [c] = [...selected]; selected.clear(); RM.discard(c); });
  on('rmDeclare', () => { const [c] = [...selected]; if (RM.declare(c)) selected.clear(); });
  const hand = document.getElementById('rmHand');
  if (!hand) return;
  hand.querySelectorAll('.rm-card').forEach((el) => {
    el.addEventListener('pointerdown', (e) => startDrag(e, el));
  });
}

// A tap picks a card (or puts it back); a drag moves it — before the card
// it is dropped on, or to the end of a group dropped beside, or out on its
// own past the last group.
function startDrag(e, el) {
  const id = el.dataset.card;
  const x0 = e.clientX, y0 = e.clientY;
  let ghost = null;
  const move = (ev) => {
    if (!ghost && Math.hypot(ev.clientX - x0, ev.clientY - y0) > 8) {
      ghost = el.cloneNode(true);
      ghost.classList.add('rm-ghost');
      const r = el.getBoundingClientRect();
      ghost.style.width = r.width + 'px';
      ghost.style.height = r.height + 'px';
      document.body.appendChild(ghost);
      el.classList.add('dragging');
    }
    if (ghost) { ghost.style.left = ev.clientX + 'px'; ghost.style.top = ev.clientY + 'px'; }
  };
  const up = (ev) => {
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', up);
    window.removeEventListener('pointercancel', up);
    if (!ghost) {
      if (selected.has(id)) selected.delete(id); else selected.add(id);
      S.refresh();
      return;
    }
    ghost.remove();
    el.classList.remove('dragging');
    dropAt(id, ev.clientX, ev.clientY);
  };
  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', up);
  window.addEventListener('pointercancel', up);
}
function dropAt(id, x, y) {
  const room = RM.current();
  if (!room) return;
  const groups = room.groups.map((g) => g.filter((c) => c !== id));
  const target = document.elementFromPoint(x, y);
  const cardEl = target && target.closest('.rm-card');
  const groupEl = target && target.closest('.rm-group');
  if (cardEl && cardEl.dataset.card !== id) {
    const tid = cardEl.dataset.card;
    const r = cardEl.getBoundingClientRect();
    const g = groups.find((gg) => gg.includes(tid));
    const at = g.indexOf(tid) + (x > r.left + r.width / 2 ? 1 : 0);
    g.splice(at, 0, id);
  } else if (groupEl) {
    groups[Number(groupEl.dataset.group)].push(id);
  } else {
    groups.push([id]);
  }
  RM.setGroups(groups.filter((g) => g.length));
}
