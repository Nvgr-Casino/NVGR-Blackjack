// The opening, before the casino: the house's card, then the loading
// picture. The crest sits in a gold medallion inside a slowly turning ring
// marked like a roulette wheel, with a gold ring round it that fills as the
// casino gets ready and the percentage under it; two soft beams of light
// sweep the room, gold dust drifts up through it, and a line along the
// bottom offers a tip about the house. Once you are known, a "Signed in
// as" note drops in from the top. It fades away into whatever comes
// first: the sign-in page or the lobby.
//
// main.js creates it at boot, moves its ring on (progress), tells it who
// is signed in (signedIn) and when the first real screen is ready (done).

import { LOGO_URL } from './uiHelpers.js';
import { esc } from './uiHelpers.js';
import { goldDust } from './goldDust.js';

const CARD_MS = 2100;      // the house card: in, hold, out
const MIN_LOADING_MS = 1300;
const RING_R = 92;
const RING_C = 2 * Math.PI * RING_R;

const TIPS = [
  'The daily bonus grows every day of the week you come back.',
  'Every level brings a gift of chips, and every tenth a large one.',
  'Choose a table to pick your seat, your stakes and who you sit with.',
  'Host a private table and share its code with your friends.',
  'Tap any player to see their profile, add them or send a message.',
  'Talk at the table: voice chat is one tap away in every game.',
];

// The turning ring: 37 marks as a roulette wheel has pockets, every one a
// fine gold line, the zero's a little longer, round a thin double rule.
function wheel() {
  const ticks = Array.from({ length: 37 }, (_, i) => {
    const a = (i / 37) * Math.PI * 2;
    const r0 = i === 0 ? 76 : 79, r1 = 85;
    const x0 = 100 + Math.sin(a) * r0, y0 = 100 - Math.cos(a) * r0, x1 = 100 + Math.sin(a) * r1, y1 = 100 - Math.cos(a) * r1;
    return `<line x1="${x0.toFixed(2)}" y1="${y0.toFixed(2)}" x2="${x1.toFixed(2)}" y2="${y1.toFixed(2)}"/>`;
  }).join('');
  return `<svg class="il-wheel" viewBox="0 0 200 200" aria-hidden="true">
    <g fill="none" stroke="url(#ilGold)" stroke-linecap="round">
      <circle cx="100" cy="100" r="86.5" stroke-width="0.8" opacity="0.8"/>
      <circle cx="100" cy="100" r="74.5" stroke-width="0.6" opacity="0.55"/>
      <g stroke-width="1.1" opacity="0.9">${ticks}</g>
    </g>
    <defs><linearGradient id="ilGold" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f7de98"/><stop offset="0.5" stop-color="#c99a45"/><stop offset="1" stop-color="#f2d58c"/></linearGradient></defs>
  </svg>`;
}

export function createIntro() {
  const el = document.createElement('div');
  el.className = 'intro';
  // The house card once a visit; the loading picture every time.
  let seen = false;
  try { seen = sessionStorage.getItem('nvgr-intro') === '1'; sessionStorage.setItem('nvgr-intro', '1'); } catch { /* private mode */ }
  const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const showCard = !seen && !still;
  el.innerHTML = `
    ${showCard ? `
    <div class="intro-house">
      <img src="${LOGO_URL}" alt="">
      <span class="intro-house-name">NVGR Casino</span>
      <span class="intro-house-sub">presents</span>
    </div>` : ''}
    <div class="intro-load">
      <div class="il-beams" aria-hidden="true"><i></i><i></i></div>
      <div class="intro-pill" aria-live="polite"></div>
      <div class="il-stage">
        <div class="il-medallion">
          ${wheel()}
          <svg class="il-progress" viewBox="0 0 200 200" aria-hidden="true">
            <circle cx="100" cy="100" r="${RING_R}" class="il-track"/>
            <circle cx="100" cy="100" r="${RING_R}" class="il-arc" stroke-dasharray="${RING_C.toFixed(1)}" stroke-dashoffset="${RING_C.toFixed(1)}" transform="rotate(-90 100 100)"/>
          </svg>
          <div class="il-disc"><img class="il-crest" src="${LOGO_URL}" alt="NVGR Casino"></div>
        </div>
        <span class="il-pct">0%</span>
        <span class="il-games">Blackjack · Hold'em · Roulette · Baccarat · Craps · Slots</span>
      </div>
      <p class="il-tip"><span>${esc(TIPS[0])}</span></p>
      <span class="intro-credit">NVGR Casino</span>
      <span class="intro-status">Opening the doors…</span>
    </div>`;
  document.body.appendChild(el);
  // index.html holds the page black until now; the opening covers it from here.
  const root = document.getElementById('root');
  if (root) root.style.removeProperty('background');
  const stopDust = goldDust(el.querySelector('.intro-load'), { count: 60, className: 'gold-dust intro-dust' });
  const started = performance.now();
  const loadAt = showCard ? CARD_MS : 0;
  requestAnimationFrame(() => el.classList.add(showCard ? 'card-on' : 'load-on'));
  if (showCard) {
    setTimeout(() => el.classList.add('card-off'), CARD_MS - 500);
    setTimeout(() => el.classList.add('load-on'), loadAt);
  }
  const arc = el.querySelector('.il-arc');
  const pct = el.querySelector('.il-pct');
  const status = el.querySelector('.intro-status');
  const pill = el.querySelector('.intro-pill');
  const tip = el.querySelector('.il-tip span');
  // A new tip every few seconds, fading through.
  let tipAt = Math.floor(Math.random() * TIPS.length);
  tip.textContent = TIPS[tipAt];
  const tipTimer = setInterval(() => {
    tip.classList.add('out');
    setTimeout(() => { tipAt = (tipAt + 1) % TIPS.length; tip.textContent = TIPS[tipAt]; tip.classList.remove('out'); }, 380);
  }, 3600);
  let shownProgress = 0;
  let finished = false;
  let pillAt = 0;
  return {
    progress(p, text) {
      shownProgress = Math.max(shownProgress, p);
      arc.setAttribute('stroke-dashoffset', (RING_C * (1 - shownProgress)).toFixed(1));
      pct.textContent = `${Math.round(shownProgress * 100)}%`;
      if (text) status.textContent = text;
    },
    signedIn(name) {
      if (!name || pill.dataset.name === name) return;
      pill.dataset.name = name;
      pill.innerHTML = `<span class="intro-pill-dot">${esc(name.trim()[0] || '·')}</span><span><small>Signed in as</small>${esc(name)}</span>`;
      pill.classList.add('on');
      pillAt = performance.now();
    },
    /** Loading has stalled or failed: say so, show why, offer a reload. */
    fail(title, detail = '') {
      if (finished) return;
      status.textContent = '';
      let box = el.querySelector('.intro-fail');
      if (!box) {
        box = document.createElement('div');
        box.className = 'intro-fail';
        el.querySelector('.intro-load').appendChild(box);
      }
      box.innerHTML = `<b>${esc(title)}</b>${detail ? `<small>${esc(detail).slice(0, 240)}</small>` : ''}<button class="btn btn-primary">Reload</button>`;
      box.querySelector('button').onclick = () => location.reload();
      el.classList.add('load-on');
    },
    done() {
      if (finished) return;
      finished = true;
      this.progress(1, 'Welcome');
      // Long enough to be seen, and the signed-in note long enough to read.
      const now = performance.now();
      const wait = Math.max(0, loadAt + MIN_LOADING_MS - (now - started), pillAt ? pillAt + 1100 - now : 0);
      setTimeout(() => {
        el.classList.add('leaving');
        setTimeout(() => { clearInterval(tipTimer); stopDust(); el.remove(); }, 800);
      }, wait + 250);
    },
  };
}
