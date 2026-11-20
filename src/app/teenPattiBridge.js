// Bridges Teen Patti (teenPattiSession.js, src/teenpatti/rules.js) to the
// oval table in 3D — the Hold'em table, its felt reprinted, the same dealer
// pitching three cards to each seat from the shuffler — and owns its HUD:
// your three cards, the pot and the stake, your moves, the players.

import { createPokerDriver } from '../ui/pokerController.js';
import * as T from '../teenpatti/rules.js';
import { cardFaceUrl } from '../scene/card.js';
import { characterPortraitDataURL, defaultCharacterFor } from '../scene/character.js';
import { dealerKeyFor } from '../scene/dealer.js';
import { esc } from './uiHelpers.js';
import * as S from './session.js';
import * as TP from './teenPattiSession.js';

let driver = null;
let scene = null;

export function mountTeenPatti3D(handles) {
  scene = handles;
  driver = createPokerDriver(handles);
  driver.setVisible(false);
}

// ---------- the diff ----------
let shownHand = null, dealtAt = 0, mineShown = false, paid = false;
let folded = new Set(), turned = new Set(), put = {};
function resetView() { shownHand = null; dealtAt = 0; mineShown = false; paid = false; folded = new Set(); turned = new Set(); put = {}; }

export function leaveTeenPattiView() {
  if (!driver) return;
  driver.clearHand();
  for (let i = 0; i < 6; i++) driver.clearSeatCharacter(i);
  driver.setStacks({});
  driver.setLabels({});
  driver.setButton(null);
  driver.setVisible(false);
  resetView();
}

const short = (n) => (n >= 1e6 ? +(n / 1e6).toFixed(2) + 'M' : n >= 1000 ? +(n / 1000).toFixed(n % 1000 ? 1 : 0) + 'K' : String(n));
const ROOM_FOR_TIER = [2, 4, 6];

function actionText(last, seen) {
  if (!last) return seen ? 'Seen' : 'Blind';
  const a = last.amount ? ' ' + short(last.amount) : '';
  switch (last.action) {
    case 'see': return 'Seen';
    case 'blind': return 'Blind' + a;
    case 'blindRaise': return 'Blind raise' + a;
    case 'chaal': return 'Chaal' + a;
    case 'raise': return 'Raise' + a;
    case 'pack': return 'Packed';
    case 'show': return 'Show';
    case 'side': return 'Side show';
    case 'allin': return 'All in' + a;
    default: return '';
  }
}
const after = (fn) => setTimeout(fn, Math.max(0, dealtAt - performance.now()));

export function syncTeenPattiToScene(room, myKey) {
  if (!driver || !room) return;
  scene.setGame('teenpatti');
  scene.setRoomTheme(ROOM_FOR_TIER[(room.tier || 1) - 1] || 2);
  scene.setDealerModel(dealerKeyFor(room.tier, room.dealerType));
  scene.setPokerFelt(room.felt, 'teenpatti');
  driver.setVisible(true);
  const b = room.boot;
  driver.setLadder([b, b * 5, b * 25, b * 100, b * 500]);
  const players = room.players;
  const bySeat = new Map(Object.entries(players).map(([k, p]) => [p.seat, k]));
  for (let i = 0; i < 6; i++) {
    const k = bySeat.get(i);
    if (k) driver.applySeatCharacter(i, players[k].character || defaultCharacterFor(k));
    else driver.clearSeatCharacter(i);
  }
  const me = TP.myKey();
  const mySeat = players[me] ? players[me].seat : null;
  driver.followSeat(mySeat);
  const h = room.hand;

  const stacks = {}, labels = {};
  Object.entries(players).forEach(([k, p]) => {
    stacks[p.seat] = p.stack;
    const inHand = h && h.players.includes(k);
    labels[p.seat] = {
      name: p.name, stack: p.stack,
      action: inHand && h.phase !== 'done' ? (h.folded[k] ? 'Packed' : actionText(h.last[k], h.seen[k])) : '',
      active: !!(h && h.toAct === k),
      folded: !!(inHand && h.folded[k]), away: false,
    };
  });
  driver.setStacks(stacks);
  driver.setLabels(labels);
  if (!h) return;
  if (h.id !== shownHand) { driver.clearHand(); resetView(); shownHand = h.id; }
  const seatOf = (k) => (players[k] ? players[k].seat : -1);
  driver.setButton(room.dealerSeat);

  if (!dealtAt) {
    const ms = driver.dealHoleCards(h.players.map(seatOf).filter((s) => s >= 0), 3);
    dealtAt = performance.now() + ms;
  }
  // Chips in: the boot, then every chaal, raise and show, slid in front
  // of the player and on into the pot.
  const fresh = {};
  h.players.forEach((k) => {
    const d = (h.put[k] || 0) - (put[k] || 0);
    if (d > 0) fresh[seatOf(k)] = d;
    put[k] = h.put[k] || 0;
  });
  if (Object.keys(fresh).length) {
    driver.setBets(fresh);
    const pot = h.pot;
    setTimeout(() => { if (shownHand === h.id) driver.gatherBets(pot); }, 650);
  }
  // Your own three, turned up for you once you have seen them.
  if (h.seen[me] && !mineShown && mySeat !== null && h.players.includes(me)) {
    mineShown = true;
    after(() => { if (shownHand === h.id) driver.revealMine(mySeat, h.cards[me]); });
  }
  Object.keys(h.folded).forEach((k) => {
    if (folded.has(k)) return;
    folded.add(k);
    const seat = seatOf(k);
    if (seat >= 0) after(() => driver.muck(seat));
  });
  Object.entries(h.shown || {}).forEach(([k, cards]) => {
    if (turned.has(k)) return;
    turned.add(k);
    after(() => driver.showHand(seatOf(k), cards));
  });
  if (h.phase === 'done' && !paid) {
    paid = true;
    const awards = [];
    (h.results || []).forEach((res) => {
      const share = Math.floor(res.amount / res.winners.length);
      res.winners.forEach((k) => awards.push({ seat: seatOf(k), amount: share }));
    });
    setTimeout(() => { if (shownHand === h.id) { driver.gatherBets(h.pot); setTimeout(() => driver.pushPot(awards.filter((a) => a.seat >= 0)), 500); } }, 900);
  }
}

// ---------- the HUD ----------
const cardImg = (c) => `<img class="rc" src="${cardFaceUrl(...c.split('-'))}" alt="${esc(c)}">`;
const backImg = () => '<span class="rc rc-back" aria-hidden="true"></span>';
const fmt = (n) => Math.round(n).toLocaleString('en-US');

function resultPop(room, h, me) {
  if (!h || h.phase !== 'done' || !h.results) return '';
  const won = new Map();
  h.results.forEach((res) => {
    const share = Math.floor(res.amount / res.winners.length);
    res.winners.forEach((k) => won.set(k, (won.get(k) || 0) + share));
  });
  const mine = won.has(me);
  const rows = [...won.entries()].map(([k, amount]) => {
    const p = room.players[k];
    const cards = h.shown[k] || (k === me && h.seen[me] ? h.cards[k] : null);
    const how = h.reason === 'fold' ? 'Everyone else packed' : T.evaluate(h.cards[k]).name;
    return `
      <div class="wp-row ${k === me ? 'me' : ''}">
        <img class="wp-avatar" src="${characterPortraitDataURL((p && p.character) || defaultCharacterFor(k), 64)}" alt="">
        <div class="wp-who"><span class="wp-name">${k === me ? 'You win' : esc(p ? p.name : 'A player') + ' wins'}</span><span class="wp-hand">${esc(how)}</span></div>
        <span class="wp-amount">+${fmt(amount)}</span>
      </div>
      ${cards ? `<div class="wp-line"><span class="wp-label">${k === me ? 'Your cards' : 'Their cards'}</span><div class="wp-cards wp-hole">${cards.map(cardImg).join('')}</div></div>` : ''}`;
  }).join('');
  // Anyone else shown, and what they had.
  const others = Object.keys(h.shown).filter((k) => !won.has(k)).map((k) => {
    const p = room.players[k];
    return `<div class="wp-line"><span class="wp-label">${k === me ? 'You' : esc(p ? p.name : '')} · ${esc(T.evaluate(h.cards[k]).name)}</span><div class="wp-cards wp-hole">${h.cards[k].map(cardImg).join('')}</div></div>`;
  }).join('');
  const why = h.reason === 'pot limit' ? 'Pot limit reached — every hand shown' : h.reason === 'all in' ? 'All in — every hand shown' : h.reason === 'show' ? 'Show' : '';
  return `
    <div class="win-pop enter ${mine ? 'mine' : ''}" role="status" aria-live="polite">
      <div class="wp-title">${mine ? 'You win the pot!' : 'Pot won'}${why ? ` <small class="tp-why">· ${esc(why)}</small>` : ''}</div>
      ${rows}${others}
    </div>`;
}

let noticeShown = null;
export function renderTeenPattiScreen() {
  const r = S.session.room;
  if (!r) return '<div class="loading"><p>Opening the table…</p></div>';
  const me = TP.myKey();
  const mine = r.players[me];
  const h = r.hand;
  const inHand = h && h.players.includes(me) && !h.folded[me];
  const L = h && h.phase === 'betting' ? T.legal(r, me) : null;

  // Status: whose turn, or what just happened.
  let status = '';
  if (h && h.phase === 'betting') {
    if (h.sideShow) {
      const from = r.players[h.sideShow.from], to = r.players[h.sideShow.to];
      status = h.sideShow.to === me ? `${from.name} asks you for a side show` : `${from ? from.name : ''} asks ${h.sideShow.to === me ? 'you' : to ? to.name : ''} for a side show`;
    } else if (h.toAct === me) status = 'Your turn';
    else if (r.players[h.toAct]) status = `${r.players[h.toAct].name} to play`;
  } else if (!h) status = 'Shuffling…';
  const side = r.lastSide && Date.now() - r.lastSide.at < 3500 ? r.lastSide : null;
  let sideLine = '';
  if (side) {
    const n = (k) => (k === me ? 'You' : r.players[k] ? r.players[k].name : 'A player');
    sideLine = side.accepted ? `Side show: ${n(side.loser)} ${side.loser === me ? 'pack' : 'packs'}` : `${n(side.to)} ${side.to === me ? 'decline' : 'declines'} the side show`;
  }
  const notice = r.notice && noticeShown !== r.notice ? r.notice : '';
  if (notice) noticeShown = r.notice;

  // The readout: your cards, the pot, the stake.
  let readout = '';
  if (h && h.players.includes(me)) {
    const seen = h.seen[me];
    const cards = seen ? h.cards[me].map(cardImg).join('') : backImg() + backImg() + backImg();
    const made = seen ? T.evaluate(h.cards[me]).name : 'Playing blind';
    // In a side show you were part of, the other hand, for a moment.
    const peek = side && side.accepted && (side.from === me || side.to === me) ? (side.from === me ? side.to : side.from) : null;
    readout = `
      <div class="readout poker-strip tp-strip">
        <div class="rs-hand"><div class="rs-cards">${cards}</div><span class="rs-label">YOU · <b class="rs-stack">${fmt(mine.stack)}</b></span></div>
        <div class="tp-pot"><span class="rs-label">POT</span><b>${fmt(h.pot)}</b><span class="tp-stake">Stake ${short(h.stake)}</span></div>
        ${peek && h.cards[peek] ? `<div class="rs-hand"><div class="rs-cards">${h.cards[peek].map(cardImg).join('')}</div><span class="rs-label">${esc(r.players[peek] ? r.players[peek].name : '')}</span></div>` : ''}
        <span class="rs-made ${seen ? '' : 'blind'}">${esc(made)}</span>
      </div>`;
  } else if (mine) {
    readout = `<div class="readout poker-strip tp-strip"><div class="rs-hand"><span class="rs-label">Your chips</span><b class="rs-stack">${fmt(mine.stack)}</b></div>${h ? `<div class="tp-pot"><span class="rs-label">POT</span><b>${fmt(h.pot)}</b></div>` : ''}</div>`;
  }

  // The dock: your moves.
  let dock = '';
  if (h && h.sideShow && h.sideShow.to === me) {
    const from = r.players[h.sideShow.from];
    dock = `
      <div class="dock-panel dock-poker tp-dock">
        <p class="dock-text">${esc(from ? from.name : 'A player')} asks to compare cards with you. The lower hand packs.</p>
        <div class="tp-actions two"><button class="btn" id="tpDecline">Decline</button><button class="btn btn-primary" id="tpAccept">Accept</button></div>
      </div>`;
  } else if (L) {
    const btn = (id, label, sub, cls = '') => `<button class="btn tp-btn ${cls}" id="${id}"><span>${label}</span>${sub ? `<small>${sub}</small>` : ''}</button>`;
    const blind = !h.seen[me];
    const items = [];
    if (L.see) items.push(btn('tpSee', 'See cards', L.mustSee ? 'four blind turns played' : '', 'tp-see'));
    items.push(btn('tpPack', 'Pack', '', 'tp-pack'));
    if (L.chaal) items.push(btn('tpChaal', blind ? 'Blind' : 'Chaal', fmt(L.chaal), 'btn-primary'));
    if (L.raise) items.push(btn('tpRaise', blind ? 'Blind ×2' : 'Raise', fmt(L.raise)));
    if (L.show) items.push(btn('tpShow', 'Show', fmt(L.show), 'tp-show'));
    if (L.side) items.push(btn('tpSide', 'Side show', `with ${esc(r.players[L.side.with].name)} · ${fmt(L.side.cost)}`));
    if (L.allIn) items.push(btn('tpAllIn', 'All in', fmt(L.allIn), 'btn-primary'));
    dock = `<div class="dock-panel dock-poker tp-dock"><div class="tp-actions">${items.join('')}</div></div>`;
  } else if (inHand && h.phase === 'betting' && !h.seen[me]) {
    dock = `<div class="dock-panel dock-poker tp-dock"><div class="tp-actions one"><button class="btn tp-btn tp-see" id="tpSee"><span>See cards</span><small>you are playing blind</small></button></div></div>`;
  } else {
    const line = !h ? 'Dealing in a moment…' : h.phase === 'done' ? 'Next hand in a moment…' : h.folded[me] ? 'Packed — waiting for the next hand.' : 'Waiting for your turn…';
    dock = `<div class="dock-panel dock-poker tp-dock"><p class="dock-text">${esc(line)}</p></div>`;
  }

  const playersHtml = Object.entries(r.players).sort((a, b) => a[1].seat - b[1].seat).map(([k, p]) => {
    const inH = h && h.players.includes(k);
    const st = !inH ? 'Waiting' : h.folded[k] ? 'Packed' : h.phase === 'done' ? (h.results && h.results.some((x) => x.winners.includes(k)) ? 'Won' : '') : actionText(h.last[k], h.seen[k]);
    return `
      <div class="player ${h && h.toAct === k ? 'on-turn' : ''}">
        <img class="player-avatar" src="${characterPortraitDataURL(p.character || defaultCharacterFor(k), 64)}" alt="">
        <div class="player-info">
          <span class="player-name">${esc(p.name)}${k === me ? ' <span class="you">(you)</span>' : ''}${r.dealerSeat === p.seat ? ' <span class="role">D</span>' : ''}${inH && h.seen[k] && !h.folded[k] ? ' <span class="role tp-seen">SEEN</span>' : ''}</span>
          <span class="player-status">${esc(st)}</span>
        </div>
        <span class="player-chips">${fmt(p.stack)}</span>
      </div>`;
  }).join('');

  const L2 = T.limitsFor(r.boot);
  return `
    <div class="hud-top">
      <div class="hud-left">
        <button class="hud-btn" id="leaveBtn">← Leave</button>
        <div class="hud-table">
          <span class="hud-code">Teen Patti · ${esc(r.stakesName)}</span>
          <span class="hud-sub">Boot ${short(r.boot)} · Chaal limit ${short(L2.chaalLimit)} · Pot limit ${short(L2.potLimit)}</span>
        </div>
      </div>
      <div class="hud-right"><span class="wallet tp-bank" title="Your balance off the table"><span class="chip-dot"></span>${fmt(r.bank)}</span></div>
    </div>
    <div class="hud-status">
      ${status ? `<div class="status-pill ${h && h.toAct === me ? 'urgent' : ''}">${esc(status)}</div>` : ''}
      ${sideLine ? `<div class="status-log">${esc(sideLine)}</div>` : ''}
      ${notice ? `<div class="status-log">${esc(notice)}</div>` : ''}
    </div>
    ${resultPop(r, h, me)}
    <aside class="hud-players">${playersHtml}</aside>
    <div class="hud-dock">${readout}${dock}</div>`;
}

export function attachTeenPattiScreen() {
  const on = (id, fn) => { const el = document.getElementById(id); if (el) el.onclick = fn; };
  on('leaveBtn', () => S.leaveTable());
  on('tpSee', () => TP.act('see'));
  on('tpPack', () => TP.act('pack'));
  on('tpChaal', () => TP.act('chaal'));
  on('tpRaise', () => TP.act('raise'));
  on('tpShow', () => TP.act('show'));
  on('tpSide', () => TP.act('side'));
  on('tpAllIn', () => TP.act('allin'));
  on('tpAccept', () => TP.answerSide(true));
  on('tpDecline', () => TP.answerSide(false));
}
