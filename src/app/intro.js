// The opening, before the casino: the house's card on black, then the
// loading picture — a stack of chips and a pair of cards either side of
// the crest, a gold line that fills as the casino gets ready, and, once
// you are known, a "Signed in as" note that drops in from the top. It
// fades away into whatever comes first: the sign-in page or the lobby.
//
// main.js creates it at boot, moves its line on (progress), tells it who
// is signed in (signedIn) and when the first real screen is ready (done).

import { LOGO_URL } from './uiHelpers.js';
import { esc } from './uiHelpers.js';

const CARD_MS = 2100;      // the house card: in, hold, out
const MIN_LOADING_MS = 1300;

// The art: chips in three stacks, drawn in perspective, and two cards.
function chips() {
  const stack = (x, y, n, a, b) => Array.from({ length: n }).map((_, i) => {
    const cy = y - i * 9;
    return `
      <ellipse cx="${x}" cy="${cy + 4}" rx="34" ry="11" fill="${b}"/>
      <rect x="${x - 34}" y="${cy - 1}" width="68" height="5" fill="${b}"/>
      <ellipse cx="${x}" cy="${cy}" rx="34" ry="11" fill="url(#${a})"/>
      <ellipse cx="${x}" cy="${cy}" rx="21" ry="6.6" fill="none" stroke="#f6ecd4" stroke-opacity="0.75" stroke-width="1.4" stroke-dasharray="5 4"/>`;
  }).join('');
  return `
  <svg class="intro-chips" viewBox="0 0 240 190" aria-hidden="true">
    <defs>
      <radialGradient id="cg" cx="40%" cy="35%"><stop offset="0" stop-color="#fbe6ad"/><stop offset="1" stop-color="#a87a35"/></radialGradient>
      <radialGradient id="cr" cx="40%" cy="35%"><stop offset="0" stop-color="#c8344a"/><stop offset="1" stop-color="#6a0d1c"/></radialGradient>
      <radialGradient id="ck" cx="40%" cy="35%"><stop offset="0" stop-color="#4a4646"/><stop offset="1" stop-color="#0d0c0c"/></radialGradient>
    </defs>
    ${stack(70, 168, 9, 'ck', '#060505')}
    ${stack(150, 176, 12, 'cg', '#7a5622')}
    ${stack(112, 182, 5, 'cr', '#4a0812')}
  </svg>`;
}
function cards() {
  const card = (x, y, rot, rank, suit, red) => `
    <g transform="rotate(${rot} ${x + 46} ${y + 64})">
      <rect x="${x}" y="${y}" width="92" height="128" rx="9" fill="#fbf7ee" stroke="#c8a46a" stroke-width="1.6"/>
      <text x="${x + 12}" y="${y + 30}" font-family="Georgia, serif" font-weight="700" font-size="26" fill="${red ? '#a8182c' : '#151010'}">${rank}</text>
      <text x="${x + 46}" y="${y + 86}" text-anchor="middle" font-family="Georgia, serif" font-size="46" fill="${red ? '#a8182c' : '#151010'}">${suit}</text>
    </g>`;
  return `
  <svg class="intro-cards" viewBox="0 0 220 190" aria-hidden="true">
    ${card(30, 34, -12, 'A', '♠', false)}
    ${card(92, 26, 9, 'K', '♥', true)}
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
      <div class="intro-pill" aria-live="polite"></div>
      <div class="intro-centre">
        ${chips()}
        <div class="intro-crest">
          <img src="${LOGO_URL}" alt="NVGR Blackjack 21">
          <span class="intro-games">Blackjack · Hold'em · Roulette · Baccarat</span>
          <span class="intro-line"><i></i></span>
        </div>
        ${cards()}
      </div>
      <span class="intro-credit">NVGR Casino</span>
      <span class="intro-status">Opening the doors…</span>
    </div>`;
  document.body.appendChild(el);
  // index.html holds the page black until now; the opening covers it from here.
  const root = document.getElementById('root');
  if (root) root.style.removeProperty('background');
  const started = performance.now();
  const loadAt = showCard ? CARD_MS : 0;
  requestAnimationFrame(() => el.classList.add(showCard ? 'card-on' : 'load-on'));
  if (showCard) {
    setTimeout(() => el.classList.add('card-off'), CARD_MS - 500);
    setTimeout(() => el.classList.add('load-on'), loadAt);
  }
  const line = el.querySelector('.intro-line i');
  const status = el.querySelector('.intro-status');
  const pill = el.querySelector('.intro-pill');
  let shownProgress = 0;
  let finished = false;
  let pillAt = 0;
  return {
    progress(p, text) {
      shownProgress = Math.max(shownProgress, p);
      line.style.transform = `scaleX(${shownProgress})`;
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
        setTimeout(() => el.remove(), 800);
      }, wait + 250);
    },
  };
}
