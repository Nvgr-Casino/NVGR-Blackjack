// Bridges the slot salon (src/app/slotsSession.js, src/slots/rules.js) to
// the machine in 3D (src/ui/slotsController.js), and owns its screen: the
// dock with your balance, the bet, Spin, Auto and the pay table; the win
// shown on the machine and, for the big ones, across the screen.

import { createSlotsDriver } from '../ui/slotsController.js';
import { symbolAtlas } from '../scene/slotMachine.js';
import { ATLAS_COLS } from '../scene/slotSymbols.js';
import * as R from '../slots/rules.js';
import * as Slots from './slotsSession.js';
import * as S from './session.js';
import { spinStart, reelStop, winSound, countTick, buttonClick, stopRun } from '../scene/slotsSound.js';
import { esc } from './uiHelpers.js';
import { voiceButtons, attachVoice } from './voice.js';

let driver = null;
let scene = null;
// The salon's room: the grandest of the house's.
const SALON_TIER = 5;

export function mountSlots3D(handles) {
  scene = handles;
  driver = createSlotsDriver({ scene: handles.scene, camera: handles.camera, controls: handles.controls, renderer: handles.renderer, set: handles.slotsSet, salon: handles.slotsSalon });
  driver.setOnButton(onMachineButton);
  return driver;
}

const fmt = (n) => Math.round(n).toLocaleString('en-US');
const short = (n) => (n >= 1e6 ? +(n / 1e6).toFixed(2) + 'M' : n >= 1000 ? +(n / 1000).toFixed(n % 1000 ? 1 : 0) + 'K' : String(n));

// ---------- the play ----------
let animating = false;
let shownFor = null;       // the session the reels were set for
let autoTimer = null;
let winShown = 0;          // what the WIN meter shows right now
let countTimer = null;

function meters(room, win = winShown) {
  driver.setMeters({ credit: room.chips, bet: room.bet, win });
}

function doSpin() {
  const room = Slots.current();
  if (!room || animating || room.spinning) return;
  if (room.chips < room.bet) { toast(room.chips < R.BETS[0] ? 'Out of chips for this machine' : 'Lower your bet to play on'); Slots.setAuto(false); return; }
  hideBanner();
  clearInterval(countTimer);
  countTimer = null;
  const drawn = Slots.spin();
  if (!drawn) return;
  animating = true;
  winShown = 0;
  meters(Slots.current(), 0);
  spinStart();
  driver.spinTo(drawn.stops, {
    onReelStop: (i) => reelStop(i, i === R.REELS - 1),
    onDone: () => {
      animating = false;
      stopRun();
      Slots.settle();
      present(drawn.result, Slots.current());
    },
  });
}

// The win: the lines on the reels, the WIN meter counting up, the bells,
// and for a big one, the screen's own celebration.
function present(result, room) {
  if (!room) return;
  driver.showWins(result.wins, result.scatter);
  const tier = R.winTier(result.total, room.last ? room.last.bet : room.bet);
  if (!result.total) {
    meters(room, 0);
    queueAuto(room, 600);
    return;
  }
  winSound(tier);
  // Count the win up on the machine's meter; the credit with it.
  const total = result.total;
  const start = room.chips - total;
  const ms = tier === 'win' ? 700 : tier === 'great' ? 1400 : 2600;
  const t0 = performance.now();
  clearInterval(countTimer);
  countTimer = setInterval(() => {
    const u = Math.min(1, (performance.now() - t0) / ms);
    const k = 1 - Math.pow(1 - u, 2);
    winShown = Math.round(total * k);
    driver.setMeters({ credit: start + winShown, bet: room.bet, win: winShown });
    countTick();
    if (u >= 1) { clearInterval(countTimer); countTimer = null; winShown = total; meters(Slots.current() || room, total); }
  }, 60);
  if (tier !== 'win') showBanner(tier, total, ms);
  // A big win stops the automatic play, as it does on a real machine.
  if (tier === 'big' || tier === 'mega') { Slots.setAuto(false); return; }
  queueAuto(room, ms + (tier === 'win' ? 700 : 1400));
}
function queueAuto(room, delay) {
  clearTimeout(autoTimer);
  if (!room.auto) return;
  autoTimer = setTimeout(() => { const r = Slots.current(); if (r && r.auto) doSpin(); }, delay);
}

function onMachineButton(id) {
  const room = Slots.current();
  if (!room) return;
  buttonClick();
  if (id === 'handle') {
    if (animating) return;
    driver.pullHandle();
    setTimeout(doSpin, 260);
    return;
  }
  driver.pressButton(id);
  if (id === 'spin') doSpin();
  else if (id === 'up') Slots.stepBet(1);
  else if (id === 'down') Slots.stepBet(-1);
  else if (id === 'max') Slots.maxBet();
  else if (id === 'auto') toggleAuto();
  else if (id === 'pays') openPays();
}
function toggleAuto() {
  const room = Slots.current();
  if (!room) return;
  Slots.setAuto(!room.auto);
  if (!room.auto && !animating) doSpin();
}

// ---------- the 3D machine ----------
export function syncSlotsToScene(room) {
  if (!driver || !room) return;
  scene.setGame('slots');
  scene.setRoomTheme(SALON_TIER);
  driver.sit();
  // A fresh visit: the reels where they were left, the meters to match.
  if (shownFor !== room) {
    const first = !shownFor;
    shownFor = room;
    if (first) { driver.rest(room.stops); winShown = room.last ? room.last.win : 0; }
  }
  driver.setBet(room.bet);
  // While the reels run or a win counts up, the meters are theirs.
  if (!animating && !countTimer) meters(room);
}

export function leaveSlotsView() {
  clearTimeout(autoTimer);
  clearInterval(countTimer);
  countTimer = null;
  stopRun();
  hideBanner();
  closePays();
  animating = false;
  shownFor = null;
  winShown = 0;
  if (driver) driver.stand();
}

// ---------- the screen ----------
export function renderSlotsScreen() {
  const r = S.session.room;
  if (!r) return '<div class="loading"><p>Loading…</p></div>';
  const busy = r.spinning || animating;
  const lineBet = r.bet / R.LINES.length;
  const canUp = R.BETS.indexOf(r.bet) < R.BETS.length - 1 && R.BETS[R.BETS.indexOf(r.bet) + 1] <= r.chips;
  const canDown = R.BETS.indexOf(r.bet) > 0;
  const last = r.last;
  return `
    <div class="hud-top">
      <div class="hud-left">
        <button class="hud-btn" id="leaveBtn">← Leave</button>
        <div class="hud-table">
          <span class="hud-code">Crown Jewels</span>
          <span class="hud-sub">High Limit Salon · 10 lines</span>
        </div>
      </div>
      <div class="hud-right">${voiceButtons(r)}</div>
    </div>
    ${S.connLost ? '<div class="conn-banner">Connection lost — reconnecting…</div>' : ''}
    <div class="hud-dock">
      <div class="dock-panel sl-dock ${busy ? 'busy' : ''}">
        <div class="sl-meter"><span>Balance</span><b id="slBalance">${fmt(r.chips)}</b></div>
        <div class="sl-bet">
          <button class="sl-step" id="slBetDown" ${!busy && canDown ? '' : 'disabled'} aria-label="Lower bet">−</button>
          <div class="sl-bet-val"><span>Bet</span><b>${fmt(r.bet)}</b><small>10 lines × ${short(lineBet)}</small></div>
          <button class="sl-step" id="slBetUp" ${!busy && canUp ? '' : 'disabled'} aria-label="Raise bet">+</button>
        </div>
        <button class="sl-spin ${busy ? 'spinning' : ''}" id="slSpinBtn" ${r.chips < r.bet && !busy ? 'disabled' : ''} aria-label="Spin"><span>${busy ? '' : 'SPIN'}</span></button>
        <div class="sl-side">
          <button class="sl-chip ${r.auto ? 'on' : ''}" id="slAutoBtn" aria-pressed="${!!r.auto}">${r.auto ? 'Stop auto' : 'Auto'}</button>
          <button class="sl-chip" id="slMaxBtn" ${busy ? 'disabled' : ''}>Max bet</button>
          <button class="sl-chip" id="slPaysBtn">Pays</button>
        </div>
        <div class="sl-meter win ${last && last.win ? 'hot' : ''}"><span>Win</span><b>${last && last.win ? fmt(last.win) : '—'}</b></div>
      </div>
    </div>`;
}

export function attachSlotsScreen() {
  const on = (id, fn) => { const el = document.getElementById(id); if (el) el.onclick = fn; };
  attachVoice();
  on('leaveBtn', S.leaveTable);
  on('slSpinBtn', () => { buttonClick(); driver.pressButton('spin'); doSpin(); });
  on('slBetUp', () => { buttonClick(); driver.pressButton('up'); Slots.stepBet(1); });
  on('slBetDown', () => { buttonClick(); driver.pressButton('down'); Slots.stepBet(-1); });
  on('slMaxBtn', () => { buttonClick(); driver.pressButton('max'); Slots.maxBet(); });
  on('slAutoBtn', () => { buttonClick(); driver.pressButton('auto'); toggleAuto(); });
  on('slPaysBtn', () => { buttonClick(); driver.pressButton('pays'); openPays(); });
}
// The space bar spins, as a machine's big button would.
window.addEventListener('keydown', (e) => {
  if (e.code !== 'Space' || !Slots.current() || !driver || !driver.seated) return;
  if (e.target && /input|textarea|select/i.test(e.target.tagName)) return;
  e.preventDefault();
  driver.pressButton('spin');
  doSpin();
});

// ---------- the celebration ----------
const BANNER = { great: 'Great win', big: 'Big win', mega: 'Mega win' };
let banner = null;
let bannerTimer = null;
function showBanner(tier, amount, ms) {
  hideBanner();
  banner = document.createElement('div');
  banner.className = `sl-banner tier-${tier}`;
  banner.innerHTML = `<div class="sl-banner-inner"><span class="sl-banner-title">${BANNER[tier]}</span><span class="sl-banner-amount" id="slBannerAmount">0</span></div>${'<i></i>'.repeat(tier === 'great' ? 14 : 32)}`;
  banner.querySelectorAll('i').forEach((i) => {
    i.style.left = Math.random() * 100 + '%';
    i.style.animationDelay = Math.random() * 1.6 + 's';
    i.style.animationDuration = 1.8 + Math.random() * 1.6 + 's';
    const s = 4 + Math.random() * 8;
    i.style.width = i.style.height = s + 'px';
  });
  banner.onclick = hideBanner;
  document.body.appendChild(banner);
  requestAnimationFrame(() => banner && banner.classList.add('on'));
  const el = banner.querySelector('#slBannerAmount');
  const t0 = performance.now();
  const step = () => {
    if (!banner || !el.isConnected) return;
    const u = Math.min(1, (performance.now() - t0) / ms);
    el.textContent = fmt(amount * (1 - Math.pow(1 - u, 2)));
    if (u < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
  bannerTimer = setTimeout(hideBanner, ms + (tier === 'great' ? 1600 : 2800));
}
function hideBanner() {
  clearTimeout(bannerTimer);
  if (!banner) return;
  const b = banner;
  banner = null;
  b.classList.remove('on');
  setTimeout(() => b.remove(), 400);
}

let toastTimer = null;
function toast(text) {
  let el = document.getElementById('slToast');
  if (!el) { el = document.createElement('div'); el.id = 'slToast'; el.className = 'rl-bet-toast'; document.body.appendChild(el); }
  el.textContent = text;
  el.classList.add('on');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('on'), 1800);
}

// ---------- the pay table ----------
let pays = null;
let symbolUrls = null;
function symbolUrl(sym) {
  if (!symbolUrls) symbolUrls = {};
  if (symbolUrls[sym]) return symbolUrls[sym];
  const atlas = symbolAtlas().sharp;
  const cell = atlas.width / ATLAS_COLS;
  const i = R.SYMBOLS.indexOf(sym);
  const c = document.createElement('canvas');
  c.width = c.height = 160;
  c.getContext('2d').drawImage(atlas, (i % ATLAS_COLS) * cell, Math.floor(i / ATLAS_COLS) * cell, cell, cell, 0, 0, 160, 160);
  symbolUrls[sym] = c.toDataURL('image/png');
  return symbolUrls[sym];
}
function lineSvg(rows, i) {
  const cw = 14, ch = 10;
  const cells = [];
  for (let reel = 0; reel < 5; reel++) for (let row = 0; row < 3; row++) {
    const on = rows[reel] === row;
    cells.push(`<rect x="${reel * cw + 1}" y="${row * ch + 1}" width="${cw - 2}" height="${ch - 2}" rx="2" class="${on ? 'on' : ''}"/>`);
  }
  const pts = rows.map((row, reel) => `${reel * cw + cw / 2},${row * ch + ch / 2}`).join(' ');
  return `<figure class="sl-line"><svg viewBox="0 0 ${cw * 5} ${ch * 3}" aria-hidden="true">${cells.join('')}<polyline points="${pts}"/></svg><figcaption>${i + 1}</figcaption></figure>`;
}
function openPays() {
  closePays();
  const r = Slots.current();
  if (!r) return;
  const lineBet = r.bet / R.LINES.length;
  const row = (sym) => {
    const p = R.PAYS[sym];
    return `<div class="sl-pay"><img src="${symbolUrl(sym)}" alt="${esc(R.SYMBOL_NAME[sym])}"><div class="sl-pay-text"><b>${esc(R.SYMBOL_NAME[sym])}</b>${p.map((x, k) => `<span><em>${k + 3}×</em> ${fmt(x * lineBet)}</span>`).join('')}</div></div>`;
  };
  pays = document.createElement('div');
  pays.className = 'rg-overlay';
  pays.innerHTML = `
    <div class="rg-panel sl-pays">
      <header class="rg-head">
        <span class="rg-kicker">Crown Jewels · bet ${fmt(r.bet)}</span>
        <h2>Pay table</h2>
        <p class="rg-lede">Wins on a line pay left to right, from the first reel, at your bet of ${fmt(lineBet)} a line.</p>
        <button class="rg-close" aria-label="Close">×</button>
      </header>
      <div class="rg-body">
        <section class="sl-feature">
          <div class="sl-pay big"><img src="${symbolUrl('wild')}" alt="Wild"><div class="sl-pay-text"><b>NVGR Wild</b><span class="note">Stands in for every symbol but the Diamond.</span>${R.PAYS.wild.map((x, k) => `<span><em>${k + 3}×</em> ${fmt(x * lineBet)}</span>`).join('')}</div></div>
          <div class="sl-pay big"><img src="${symbolUrl('diamond')}" alt="Diamond"><div class="sl-pay-text"><b>Diamond scatter</b><span class="note">Anywhere on the reels, paid on your whole bet.</span>${R.SCATTER_PAYS.map((x, k) => `<span><em>${k + 3}×</em> ${fmt(x * r.bet)}</span>`).join('')}</div></div>
        </section>
        <section><h3>Symbols</h3><div class="sl-pay-grid">${['crown', 'ruby', 'emerald', 'sapphire', 'A', 'K', 'Q', 'J'].map(row).join('')}</div></section>
        <section><h3>The ten lines</h3><div class="sl-lines">${R.LINES.map(lineSvg).join('')}</div></section>
      </div>
      <footer class="rg-foot"><button class="btn btn-primary" data-rg-close>Back to the reels</button></footer>
    </div>`;
  pays.addEventListener('click', (e) => { if (e.target === pays || e.target.closest('.rg-close') || e.target.closest('[data-rg-close]')) closePays(); });
  document.body.appendChild(pays);
  requestAnimationFrame(() => pays && pays.classList.add('on'));
}
function closePays() {
  if (pays) pays.remove();
  pays = null;
}
