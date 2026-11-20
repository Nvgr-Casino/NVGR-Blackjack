// Liftoff's screen: the picture (src/crash/scene.js) on its own canvas
// under the page, and over it the HUD — the multiplier, the recent rounds,
// the players in this one, and your two bet panels. The multiplier and the
// cash-out amounts change every frame, so they are written straight into
// their elements; the panels are redrawn only when a bet changes.

import { createCrashScene } from '../crash/scene.js';
import * as Rounds from '../crash/rounds.js';
import * as Crash from './crashSession.js';
import * as S from './session.js';
import { esc } from './uiHelpers.js';

let canvas = null;
let pic = null;
let loop = 0;
let round = null;
let offChange = null;

const fmt = (n) => Math.round(n).toLocaleString('en-US');
const short = (n) => (n >= 1e6 ? +(n / 1e6).toFixed(2) + 'M' : n >= 1000 ? +(n / 1000).toFixed(n % 1000 ? 1 : 0) + 'K' : String(n));

// ---------- the picture ----------
function ensureCanvas() {
  if (canvas) return canvas;
  canvas = document.createElement('canvas');
  canvas.className = 'lift-canvas';
  const root = document.getElementById('root');
  root.parentNode.insertBefore(canvas, root);
  return canvas;
}
/** The scene's view of the round, each frame. */
function picState() {
  const r = round || Rounds.roundAt(Crash.serverNow());
  const now = Crash.serverNow();
  return {
    id: r.id,
    phase: r.phase,
    flyMs: r.phase === 'fly' ? now - r.flyAt : r.phase === 'crash' ? r.crashAt - r.flyAt : 0,
  };
}

export function showCrashView() {
  ensureCanvas().style.display = 'block';
  if (!pic) {
    try { pic = createCrashScene(canvas); } catch (e) { S.setFormError("This device couldn't start Liftoff's picture."); return; }
  }
  pic.start(picState);
  if (!offChange) offChange = Crash.onChange(() => { drawPanels(); drawPlayers(true); });
  if (!loop) tickLoop();
}
export function leaveCrashView() {
  if (pic) pic.stop();
  if (canvas) canvas.style.display = 'none';
  cancelAnimationFrame(loop);
  loop = 0;
  if (offChange) { offChange(); offChange = null; }
  round = null;
  shown = { id: null, phase: null, hist: '', crowd: '' };
}

// ---------- the crowd ----------
// The other players in a round, the same on every screen (drawn from the
// round's own numbers): their stakes, and where each will cash out.
const NAMES = ['Arjun', 'Priya', 'Rohan', 'Meera', 'Vikram', 'Ananya', 'Kabir', 'Sana', 'Dev', 'Isha', 'Neel', 'Tara', 'Aditya', 'Kavya', 'Rahul', 'Diya', 'Karan', 'Riya', 'Siddharth', 'Nisha', 'Varun', 'Pooja', 'Aarav', 'Sneha', 'Yash', 'Anika', 'Harsh', 'Zoya', 'Manav', 'Leela', 'Omar', 'Farah', 'Gurpreet', 'Simran', 'Rehan', 'Tanvi'];
const CROWD_STAKES = [500, 1000, 2000, 5000, 10000, 20000, 50000, 100000];
let crowdFor = null, crowd = [];
function crowdOf(r) {
  if (crowdFor === r.id) return crowd;
  crowdFor = r.id;
  const n = 14 + Math.floor(Rounds.rand01(r.day, r.i, 1) * 22);
  const used = new Set();
  crowd = [];
  for (let k = 0; k < n; k++) {
    let name = NAMES[Math.floor(Rounds.rand01(r.day, r.i, 10 + k) * NAMES.length)];
    if (used.has(name)) name = NAMES[(NAMES.indexOf(name) + k) % NAMES.length];
    if (used.has(name)) continue;
    used.add(name);
    const stake = CROWD_STAKES[Math.floor(Math.pow(Rounds.rand01(r.day, r.i, 100 + k), 1.6) * CROWD_STAKES.length)];
    // Most take a modest profit; a few hold on for a big one.
    const u = Rounds.rand01(r.day, r.i, 200 + k);
    const target = Math.round((1.15 + Math.pow(u, 2.2) * 12) * 100) / 100;
    crowd.push({ name, stake, target });
  }
  crowd.sort((a, b) => b.stake - a.stake);
  return crowd;
}

// ---------- the HUD ----------
const tone = (m) => (m >= 10 ? 'hi' : m >= 2 ? 'mid' : 'lo');

function slotHtml(s, i) {
  return `
    <div class="lift-bet" data-slot="${i}">
      <div class="lift-stake">
        <div class="lift-amount">
          <button class="lift-step" data-step="-1" aria-label="Lower the bet">−</button>
          <input class="lift-input" data-amount inputmode="numeric" value="${fmt(s.amount)}" aria-label="Bet amount">
          <button class="lift-step" data-step="1" aria-label="Raise the bet">+</button>
        </div>
        <div class="lift-quick">${Crash.QUICK.map((q) => `<button data-quick="${q}" class="${q === s.amount ? 'on' : ''}">${short(q)}</button>`).join('')}</div>
        <div class="lift-auto">
          <button class="lift-switch ${s.autoOn ? 'on' : ''}" data-auto-toggle role="switch" aria-checked="${s.autoOn}"><i></i></button>
          <span>Auto cash out</span>
          <label class="lift-autoval"><input data-auto inputmode="decimal" value="${s.auto.toFixed(2)}" aria-label="Auto cash out at"><b>x</b></label>
        </div>
      </div>
      <button class="lift-go" data-go></button>
    </div>`;
}

export function renderCrashScreen() {
  const st = Crash.current();
  if (!st) return '<div class="loading"><p>Opening Liftoff…</p></div>';
  return `
    <div class="lift">
      <header class="lift-top">
        <button class="hud-btn" id="leaveBtn">← Lobby</button>
        <div class="lift-brand">LIFTOFF</div>
        <div class="lift-history" id="liftHistory"></div>
        <div class="lift-wallet"><span class="chip-dot"></span><b id="liftChips">${fmt(st.chips)}</b></div>
      </header>
      <div class="lift-mult wait" id="liftMult">
        <div class="lift-x" id="liftX">—</div>
        <div class="lift-sub" id="liftSub"></div>
        <div class="lift-bar" id="liftBar"><i id="liftBarFill"></i></div>
      </div>
      <aside class="lift-players" id="liftPlayers"></aside>
      <div class="lift-toast" id="liftToast"></div>
      ${S.formError ? `<p class="lift-error">${esc(S.formError)}</p>` : ''}
      <div class="lift-bets">${st.slots.map(slotHtml).join('')}</div>
    </div>`;
}

let shown = { id: null, phase: null, hist: '', crowd: '' };

// The parts of a panel that follow its bet: the button above all.
function drawPanels() {
  const st = Crash.current();
  if (!st) return;
  const r = round || Rounds.roundAt(Crash.serverNow());
  document.querySelectorAll('.lift-bet').forEach((el) => {
    const i = Number(el.dataset.slot);
    const s = st.slots[i];
    const locked = s.status === 'live' || s.status === 'queued';
    el.classList.toggle('locked', locked);
    const input = el.querySelector('[data-amount]');
    if (input && document.activeElement !== input) input.value = fmt(s.amount);
    input.disabled = locked;
    el.querySelectorAll('[data-quick]').forEach((b) => { b.classList.toggle('on', Number(b.dataset.quick) === s.amount); b.disabled = locked; });
    el.querySelectorAll('[data-step]').forEach((b) => { b.disabled = locked; });
    const sw = el.querySelector('[data-auto-toggle]');
    sw.classList.toggle('on', s.autoOn); sw.setAttribute('aria-checked', s.autoOn);
    const auto = el.querySelector('[data-auto]');
    if (document.activeElement !== auto) auto.value = s.auto.toFixed(2);
    const go = el.querySelector('[data-go]');
    let cls = 'bet', html = '';
    if (s.status === 'live' && r.id === s.round && r.phase === 'fly') { cls = 'cash'; html = `<span class="lg-word">Cash out</span><span class="lg-amt" data-cash="${i}">${fmt(s.amount * r.m)}</span>`; }
    else if (s.status === 'live' && r.phase === 'bet') { cls = 'cancel'; html = `<span class="lg-word">Cancel</span><span class="lg-amt">${fmt(s.amount)} placed</span>`; }
    else if (s.status === 'queued') { cls = 'queued'; html = `<span class="lg-word">Waiting</span><span class="lg-amt">next launch · cancel</span>`; }
    else if (s.status === 'cashed') { cls = 'won'; html = `<span class="lg-word">Won ${s.cashedAt.toFixed(2)}x</span><span class="lg-amt">+${fmt(s.win)}</span>`; }
    else if (s.status === 'lost') { cls = 'lost'; html = `<span class="lg-word">Lost</span><span class="lg-amt">${fmt(s.amount)}</span>`; }
    else { cls = 'bet'; html = `<span class="lg-word">Bet</span><span class="lg-amt">${fmt(s.amount)}</span>`; }
    if (go.dataset.state !== cls + html) { go.className = 'lift-go ' + cls; go.innerHTML = html; go.dataset.state = cls + html; }
    // A settled panel cannot be pressed until its round is over.
    go.disabled = s.status === 'cashed' || s.status === 'lost' || (s.status === 'live' && r.phase === 'crash');
  });
  const chips = document.getElementById('liftChips');
  if (chips) chips.textContent = fmt(st.chips);
}

function drawPlayers(force = false) {
  const el = document.getElementById('liftPlayers');
  const st = Crash.current();
  if (!el || !st || !round) return;
  const r = round;
  const list = crowdOf(r);
  const m = r.m;
  const out = (p) => r.phase !== 'bet' && p.target < (r.crash || 0) && m >= p.target;
  const mine = st.slots.filter((s) => (s.status === 'live' && s.round === r.id) || ((s.status === 'cashed' || s.status === 'lost') && s.round === r.id));
  const key = r.id + '|' + r.phase + '|' + list.filter(out).length + '|' + mine.map((s) => s.status + s.amount).join(',');
  if (!force && key === shown.crowd) return;
  shown.crowd = key;
  const total = list.reduce((a, p) => a + p.stake, 0) + mine.reduce((a, s) => a + s.amount, 0);
  const rows = mine.map((s) => `
    <div class="lp-row you ${s.status === 'cashed' ? 'out' : s.status === 'lost' ? 'gone' : ''}">
      <span class="lp-av">You</span><span class="lp-name">You</span><span class="lp-bet">${short(s.amount)}</span>
      <span class="lp-res">${s.status === 'cashed' ? `${s.cashedAt.toFixed(2)}x` : ''}</span>
    </div>`).join('') + list.slice(0, 12).map((p) => {
    const o = out(p);
    const gone = r.phase === 'crash' && !o;
    return `
      <div class="lp-row ${o ? 'out' : ''} ${gone ? 'gone' : ''}">
        <span class="lp-av">${esc(p.name[0])}</span><span class="lp-name">${esc(p.name)}</span><span class="lp-bet">${short(p.stake)}</span>
        <span class="lp-res">${o ? `${p.target.toFixed(2)}x` : ''}</span>
      </div>`;
  }).join('');
  el.innerHTML = `
    <div class="lp-head"><span>${list.length + mine.length} playing</span><span>${short(total)}</span></div>
    <div class="lp-cols"><span>Player</span><span>Bet</span><span>Out</span></div>
    ${rows}`;
}

function drawHistory(now) {
  const el = document.getElementById('liftHistory');
  if (!el) return;
  const h = Rounds.historyAt(now, 18);
  const key = h.join(',');
  if (key === shown.hist) return;
  shown.hist = key;
  el.innerHTML = h.map((m) => `<span class="lh-chip ${tone(m)}">${m.toFixed(2)}x</span>`).join('');
}

let toastTimer = 0;
function showToast(t) {
  const el = document.getElementById('liftToast');
  if (!el) return;
  el.textContent = t.text;
  el.className = 'lift-toast on ' + t.tone;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('on'), 2200);
}

function tickLoop() {
  loop = requestAnimationFrame(tickLoop);
  const st = Crash.current();
  if (!st) return;
  round = Crash.tick();
  const now = Crash.serverNow();
  const r = round;
  const mult = document.getElementById('liftMult');
  if (!mult) return;
  if (shown.id !== r.id || shown.phase !== r.phase) {
    shown.id = r.id; shown.phase = r.phase;
    mult.className = 'lift-mult ' + (r.phase === 'bet' ? 'wait' : r.phase === 'crash' ? 'crashed' : 'flying');
    document.getElementById('liftBar').style.display = r.phase === 'bet' ? 'block' : 'none';
    drawPanels();
  }
  const x = document.getElementById('liftX'), sub = document.getElementById('liftSub');
  if (r.phase === 'bet') {
    const left = Math.max(0, r.flyAt - now);
    x.textContent = (left / 1000).toFixed(1) + 's';
    sub.textContent = 'Next launch';
    document.getElementById('liftBarFill').style.transform = `scaleX(${Math.min(1, left / Rounds.BET_MS)})`;
  } else if (r.phase === 'fly') {
    x.textContent = r.m.toFixed(2) + 'x';
    sub.textContent = r.m >= 2 ? 'Climbing' : 'Lift-off';
    document.querySelectorAll('[data-cash]').forEach((el) => {
      const s = st.slots[Number(el.dataset.cash)];
      el.textContent = fmt(s.amount * r.m);
    });
  } else {
    x.textContent = r.crash.toFixed(2) + 'x';
    sub.textContent = 'Mission lost';
  }
  drawHistory(now);
  drawPlayers();
  const t = Crash.takeToast();
  if (t) showToast(t);
}

// ---------- the controls ----------
export function attachCrashScreen() {
  const leave = document.getElementById('leaveBtn');
  if (leave) leave.onclick = () => S.leaveTable();
  document.querySelectorAll('.lift-bet').forEach((el) => {
    const i = Number(el.dataset.slot);
    el.querySelectorAll('[data-step]').forEach((b) => (b.onclick = () => Crash.stepAmount(i, Number(b.dataset.step))));
    el.querySelectorAll('[data-quick]').forEach((b) => (b.onclick = () => Crash.setAmount(i, Number(b.dataset.quick))));
    const input = el.querySelector('[data-amount]');
    input.onchange = () => Crash.setAmount(i, Number(String(input.value).replace(/[^\d]/g, '')));
    input.onkeydown = (e) => { if (e.key === 'Enter') input.blur(); };
    el.querySelector('[data-auto-toggle]').onclick = () => Crash.toggleAuto(i);
    const auto = el.querySelector('[data-auto]');
    auto.onchange = () => { Crash.setAuto(i, auto.value); drawPanels(); };
    auto.onkeydown = (e) => { if (e.key === 'Enter') auto.blur(); };
    el.querySelector('[data-go]').onclick = () => Crash.press(i);
  });
  shown = { id: null, phase: null, hist: '', crowd: '' };
  drawPanels();
  drawPlayers(true);
}
