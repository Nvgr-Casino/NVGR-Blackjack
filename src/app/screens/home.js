// The lobby, in layers, so no page says everything at once:
//
//   1. Home — who you are, and three posters, one for each way to play,
//      with a glimpse of the leaderboard and the featured tournament.
//   2. A game's own page — its banner and one obvious action (Play now),
//      then its tables or tournaments, each a single line.
//   3. A sheet over the page — everything about one table or tournament,
//      and the buttons to take part.
//
// Each game has its colours: Blackjack the green of its felt, Hold'em
// claret, Roulette the black and red of its wheel, Baccarat the deep
// blue and gold of a salon prive, Tournaments royal
// purple, the leaderboard gold.
import { MAX_PUBLIC_SEATS, stakesLabel, roomName, ROOM_NAMES, safeKey, TABLE_STAKES } from '../roomLogic.js';
import { POKER_SEATS, POKER_STAKES, buyInRange } from '../../poker/rules.js';
import * as T from '../../poker/tournament.js';
import * as BT from '../../blackjack/tournament.js';
import * as BJT from '../bjTournamentSession.js';
import * as OfflineBJ from '../offlineBlackjack.js';
import * as Poker from '../pokerSession.js';
import * as Roulette from '../rouletteSession.js';
import { ROULETTE_SEATS, colorOf } from '../../roulette/rules.js';
import * as Baccarat from '../baccaratSession.js';
import { BACCARAT_SEATS } from '../../baccarat/rules.js';
import * as Slots from '../slotsSession.js';
import * as Craps from '../crapsSession.js';
import { CRAPS_SEATS } from '../../craps/rules.js';
import * as Offline from '../offlinePoker.js';
import * as Leaderboard from '../leaderboard.js';
import { feltTheme } from '../../scene/table.js';
import { characterPortraitDataURL, defaultCharacterFor } from '../../scene/character.js';
import { brandMark, esc } from '../uiHelpers.js';
import * as S from '../session.js';
import * as Curtain from '../curtain.js';
import { fullscreenButton, attachFullscreen } from '../fullscreen.js';
import * as Social from '../social.js';

const SKYLINE = import.meta.env.BASE_URL + 'assets/skyline/night_skyline_ny_4k.webp';

const PHASE_LABEL = {
  betting: 'Betting open',
  playing: 'Hand in progress',
  dealer: 'Dealer playing',
  results: 'Between rounds',
};

const short = (n) => {
  if (n >= 1e6) return (n % 1e6 ? (n / 1e6).toFixed(n % 1e5 ? 2 : 1) : n / 1e6) + 'M';
  if (n >= 1000) return (n % 1000 ? (n / 1000).toFixed(1) : n / 1000) + 'K';
  return String(n);
};
const portrait = (character, key, size = 48) => characterPortraitDataURL(character || defaultCharacterFor(key || ''), size);
const chevron = '<svg class="chev" viewBox="0 0 16 16" aria-hidden="true"><path d="M6 3l5 5-5 5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const arrow = '<svg class="arrow" viewBox="0 0 20 20" aria-hidden="true"><path d="M4 10h11M11 5l5 5-5 5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';

// What is open over the page, and the page's own small choices.
let sheet = null;        // { kind: 'tour' | 'poker' | 'bj' | 'join', key, confirm }
let holdemTab = 'cash';  // 'cash' | 'practice'
let tourGame = 'blackjack'; // which game's tournaments: 'blackjack' | 'holdem'
let bjFormat = 'quick';     // and which kind of blackjack one: 'quick' | 'elimination'
let boardBy = (() => { try { return localStorage.getItem('nvgr-board') || 'chips'; } catch { return 'chips'; } })();

function seatsHtml(seats, total) {
  return Array.from({ length: total }).map((_, i) => {
    const p = seats[i];
    if (!p) return '<span class="seat-face empty"></span>';
    return `<img class="seat-face" src="${portrait(p.character, p.name)}" alt="${esc(p.name)}" title="${esc(p.name)}">`;
  }).join('');
}

// ---------- art ----------

const card = (x, y, rot, rank, suit, red, w = 40) => {
  const h = w * 1.4;
  return `
  <g transform="rotate(${rot} ${x + w / 2} ${y + h / 2})">
    <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${w / 8}" fill="#f8f3e9" stroke="#c8a46a" stroke-width="1.2"/>
    <text x="${x + w * 0.15}" y="${y + h * 0.27}" font-size="${w * 0.3}" font-weight="700" font-family="Georgia, serif" fill="${red ? '#b3332e' : '#1b140b'}">${rank}</text>
    <text x="${x + w / 2}" y="${y + h * 0.68}" font-size="${w * 0.52}" text-anchor="middle" font-family="Georgia, serif" fill="${red ? '#b3332e' : '#1b140b'}">${suit}</text>
  </g>`;
};
const chipStack = (x, y, n, colors) => Array.from({ length: n }).map((_, i) => `
  <ellipse cx="${x}" cy="${y - i * 7}" rx="20" ry="7" fill="${colors[i % colors.length]}" stroke="#00000066"/>
  <ellipse cx="${x}" cy="${y - i * 7}" rx="12" ry="4" fill="none" stroke="#f8f3e9aa" stroke-dasharray="3.5 2.6"/>`).join('');
const trophy = (cx, top, s = 1) => `
  <g transform="translate(${cx} ${top}) scale(${s})">
    <defs><linearGradient id="gold${s}" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#fbe3a8"/><stop offset="1" stop-color="#a77c3a"/></linearGradient></defs>
    <path d="M-20 0h40v16c0 15-9 26-20 26S-20 31-20 16z" fill="url(#gold${s})"/>
    <path d="M-20 6h-11c0 11 6 18 13 19M20 6h11c0 11-6 18-13 19" fill="none" stroke="#d9b675" stroke-width="4" stroke-linecap="round"/>
    <rect x="-5" y="41" width="10" height="12" fill="#a77c3a"/>
    <rect x="-18" y="53" width="36" height="10" rx="2" fill="url(#gold${s})"/>
    <text y="24" font-size="15" text-anchor="middle" font-family="Georgia, serif" font-weight="700" fill="#5a3e14">1</text>
    <clipPath id="cup${s}"><path d="M-20 0h40v16c0 15-9 26-20 26S-20 31-20 16z"/></clipPath>
    <g clip-path="url(#cup${s})"><rect class="shine" x="-6" y="-4" width="9" height="50" fill="#fffdf4"/></g>
  </g>`;
const ART = {
  tournaments: `<svg viewBox="0 0 160 120" aria-hidden="true">${trophy(80, 22, 1.25)}</svg>`,
};

// ---------- the top bar and the parts shared by every page ----------

function nav() {
  const friendCount = Social.badgeCount();
  return `
    <header class="nav lobby-nav">
      <button class="nav-brand" data-go="home" aria-label="NVGR Casino lobby">${brandMark('nav-logo')}<span class="nav-name">NVGR Casino</span></button>
      <nav class="nav-links">
        <button class="nav-link ${S.lobbyGame === 'leaderboard' ? 'on' : ''}" data-go="leaderboard">Leaderboard</button>
        <button class="nav-link" id="characterBtn">Character</button>
        <button class="nav-link" id="friendsBtn">Friends${friendCount ? ` <span class="count">${friendCount}</span>` : ''}</button>
        <button class="nav-link" id="signOutBtn">Sign out</button>
      </nav>
    </header>`;
}

function wallet() {
  return `<span class="wallet"><span class="chip-dot"></span>${(S.session.chips || 0).toLocaleString()}</span>`;
}

// A game's banner: back to the lobby, its name, its one main action.
function banner(theme, { kicker, title, line, actions = '', tabs = '' }) {
  return `
    <section class="banner theme-${theme}">
      <div class="banner-top">
        <button class="back-link" data-go="home">← Lobby</button>
        ${wallet()}
      </div>
      <div class="banner-row">
        <div class="banner-text">
          <span class="kicker">${kicker}</span>
          <h1 class="banner-title">${title}</h1>
          <p class="banner-line">${line}</p>
        </div>
        ${actions ? `<div class="banner-actions">${actions}</div>` : ''}
      </div>
      ${tabs}
    </section>
    ${S.formError ? '<p class="error-text lobby-error">' + esc(S.formError) + '</p>' : ''}`;
}

function tabs(items, current, attr) {
  return `<div class="tabs" role="tablist">${items.map(([id, label]) => `<button class="tab ${current === id ? 'on' : ''}" role="tab" aria-selected="${current === id}" ${attr}="${id}">${label}</button>`).join('')}</div>`;
}

function listHead(title) {
  return `
    <div class="list-head">
      <h2>${title}</h2>
      <button class="link" id="refreshLobbyBtn">${S.lobbyLoading ? 'Refreshing…' : 'Refresh'}</button>
    </div>`;
}

// ---------- 1. home: the carousel ----------
// The home page is the casino floor itself: every game's table on an arc
// in the room (scene.js's carousel), the one you are looking at in the
// middle under its name, its neighbours named at either side. A swipe, an
// arrow key or a neighbour's name glides the arc round; Play now seats you
// at the game in the middle, Tables opens its page.
const FLOOR = [
  { id: 'blackjack', kicker: 'Table game · five seats', name: 'Blackjack', line: 'Beat the dealer to 21 · blackjack pays 3 to 2' },
  { id: 'holdem', kicker: 'Poker · six seats', name: "Texas Hold'em", line: 'No-limit cash games, practice and tournaments' },
  { id: 'roulette', kicker: 'Table game · six seats', name: 'Roulette', line: 'European wheel, one zero · straight up pays 35 to 1' },
  { id: 'craps', kicker: 'Dice · six seats', name: 'Craps', line: 'Pass Line, odds at true odds, the field and the hard ways' },
  { id: 'baccarat', kicker: 'Table game · seven seats', name: 'Baccarat', line: 'Punto Banco · Banker pays 19 to 20, Tie 8 to 1' },
  { id: 'slots', kicker: 'High Limit Salon · slots', name: 'Crown Jewels', line: 'Five reels, ten lines · five NVGR wilds pay 1,000 a line', more: 'How it pays' },
];
const wrapIndex = (i) => ((i % FLOOR.length) + FLOOR.length) % FLOOR.length;
// Where the carousel is headed: a whole number that runs past the ends, so
// it always takes the short way round.
let carouselTarget = 0;
let lobbyScene = null;
export function setLobbyScene(handles) { lobbyScene = handles; }
export const carouselIndex = () => wrapIndex(carouselTarget);

const ICON = {
  trophy: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4h10v4a5 5 0 0 1-10 0zM7 6H4a3 3 0 0 0 3 4M17 6h3a3 3 0 0 1-3 4M12 13v4M8.5 20h7M9.5 17h5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  crown: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8l4 4 4-6 4 6 4-4-1.5 10h-13zM6 20h12" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  friends: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="8.5" r="3.2" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M3.5 19c.6-3.2 2.8-5 5.5-5s4.9 1.8 5.5 5M15.5 5.6a3 3 0 0 1 0 5.8M17.5 14.4c1.6.6 2.7 2.2 3 4.6" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>',
  person: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="3.6" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M5 20c.8-3.8 3.6-6 7-6s6.2 2.2 7 6" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>',
  exit: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 5h4a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1h-4M10 8l-4 4 4 4M6 12h9" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  left: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  right: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
};

function homePage() {
  const uid = S.session.uid;
  const rank = Leaderboard.rankOf(uid, 'chips');
  const featured = T.TOURNAMENTS.find((d) => d.featured);
  const g = FLOOR[carouselIndex()];
  const prev = FLOOR[wrapIndex(carouselTarget - 1)], next = FLOOR[wrapIndex(carouselTarget + 1)];
  const friendCount = Social.badgeCount();
  return `
    <div class="stage" id="stage">
      <header class="stage-top">
        <button class="stage-brand" data-go="home" aria-label="NVGR Casino">${brandMark('stage-logo')}<span>NVGR Casino</span></button>
        <div class="stage-heading" id="stageHeading">
          <span class="stage-kicker" id="stageKicker">${esc(g.kicker)}</span>
          <h1 class="stage-title" id="stageTitle">${esc(g.name)}</h1>
          <span class="stage-line" id="stageLine">${esc(g.line)}</span>
        </div>
        <div class="stage-corner">
          ${fullscreenButton('stage-chip')}
          <button class="stage-chip" id="signOutBtn" title="Sign out" aria-label="Sign out">${ICON.exit}</button>
        </div>
      </header>
      ${stageNotice()}

      <button class="stage-side left" id="stagePrev" aria-label="${esc(prev.name)}">${ICON.left}<span id="stagePrevName">${esc(prev.name)}</span></button>
      <button class="stage-side right" id="stageNext" aria-label="${esc(next.name)}"><span id="stageNextName">${esc(next.name)}</span>${ICON.right}</button>

      <div class="stage-actions" id="stageActions">
        <button class="btn btn-primary btn-lg stage-play" id="stagePlay">Play now</button>
        <button class="btn btn-ghost stage-tables" id="stageTables">${esc(g.more || 'Tables')}</button>
      </div>
      <div class="stage-dots" id="stageDots">${FLOOR.map((x, i) => `<button class="stage-dot ${i === carouselIndex() ? 'on' : ''}" data-dot="${i}" aria-label="${esc(x.name)}"></button>`).join('')}</div>

      <footer class="stage-bar">
        <div class="stage-me">
          <img class="stage-avatar" src="${portrait(S.session.character, '', 96)}" alt="">
          <div class="stage-me-text">
            <span class="stage-name">${esc((S.session.name || '').split(' ')[0])}</span>
            <span class="stage-balance"><span class="chip-dot"></span>${(S.session.chips || 0).toLocaleString()}</span>
          </div>
          ${rank ? `<span class="stage-rank">#${rank}</span>` : ''}
        </div>
        <nav class="stage-icons">
          <button class="stage-icon" data-go="tournaments">${ICON.trophy}<span>Tournaments</span></button>
          <button class="stage-icon" data-go="leaderboard">${ICON.crown}<span>Leaderboard</span></button>
          <button class="stage-icon" id="friendsBtn">${ICON.friends}<span>Friends</span>${friendCount ? `<i class="stage-badge">${friendCount}</i>` : ''}</button>
          <button class="stage-icon" id="characterBtn">${ICON.person}<span>Character</span></button>
        </nav>
        ${featured ? `
        <button class="stage-promo" data-go="tournaments" data-show-tour="${featured.id}">
          <span class="stage-promo-kicker">Featured tournament</span>
          <span class="stage-promo-name">${esc(featured.name)}</span>
          <span class="stage-promo-prize">${short(featured.prizes[0])}<small> to the winner</small></span>
        </button>` : ''}
      </footer>
    </div>`;
}

// A note for the player (a top-up, being removed from a table, an error)
// shows for a few seconds above the buttons and fades; it used to stay put
// over the game's name until something else cleared it.
const NOTICE_MS = 6000;
let notice = null;   // { text, error, until }
function stageNotice() {
  // A notice is cleared once taken, so any that's there is new; an error
  // stays set in the session, so it's new only when it says something else.
  if (S.formNotice) {
    notice = { text: S.formNotice, error: false, until: Date.now() + NOTICE_MS };
    S.clearFormNotice();
  } else if (S.formError && (!notice || notice.text !== S.formError)) {
    notice = { text: S.formError, error: true, until: Date.now() + NOTICE_MS };
  }
  if (!notice || Date.now() > notice.until) return '';
  const left = Math.max(0, notice.until - Date.now());
  return `<p class="stage-notice ${notice.error ? 'error' : ''}" style="animation-delay:${Math.max(0, left - 600)}ms">${esc(notice.text)}</p>`;
}

// The carousel's motion, and the page following it: the name crossfades,
// the buttons step back while the tables move.
let watching = 0;
function settleWatch() {
  const stage = document.getElementById('stage');
  if (!stage || !lobbyScene) return;
  const my = ++watching;
  stage.classList.add('moving');
  const tick = () => {
    if (my !== watching) return;
    const st = document.getElementById('stage');
    if (!st) return;
    if (Math.abs(lobbyScene.carouselPos - carouselTarget) < 0.02 && !dragging) { st.classList.remove('moving'); return; }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}
function showGame() {
  const g = FLOOR[carouselIndex()];
  const prev = FLOOR[wrapIndex(carouselTarget - 1)], next = FLOOR[wrapIndex(carouselTarget + 1)];
  const heading = document.getElementById('stageHeading');
  if (heading) {
    heading.classList.add('swap');
    setTimeout(() => {
      const set = (id, t) => { const el = document.getElementById(id); if (el) el.textContent = t; };
      set('stageKicker', g.kicker); set('stageTitle', g.name); set('stageLine', g.line);
      set('stagePrevName', prev.name); set('stageNextName', next.name);
      set('stageTables', g.more || 'Tables');
      const h = document.getElementById('stageHeading');
      if (h) h.classList.remove('swap');
    }, 220);
  }
  document.querySelectorAll('[data-dot]').forEach((d) => d.classList.toggle('on', Number(d.dataset.dot) === carouselIndex()));
}
function glideTo(target) {
  if (target === carouselTarget && lobbyScene && Math.abs(lobbyScene.carouselPos - target) < 0.01) return;
  const changed = wrapIndex(target) !== carouselIndex();
  carouselTarget = target;
  if (lobbyScene) lobbyScene.carouselTo(target);
  if (changed) showGame();
  settleWatch();
}
let dragging = false;
function attachStage() {
  const stage = document.getElementById('stage');
  if (!stage) return;
  attachFullscreen();
  const on = (id, fn) => { const el = document.getElementById(id); if (el) el.onclick = fn; };
  on('stagePrev', () => glideTo(carouselTarget - 1));
  on('stageNext', () => glideTo(carouselTarget + 1));
  document.querySelectorAll('[data-dot]').forEach((d) => {
    d.onclick = () => {
      const want = Number(d.dataset.dot);
      let step = want - carouselIndex();
      if (step > FLOOR.length / 2) step -= FLOOR.length;
      if (step < -FLOOR.length / 2) step += FLOOR.length;
      glideTo(carouselTarget + step);
    };
  });
  on('stagePlay', async () => {
    const id = FLOOR[carouselIndex()].id;
    // The floor fades out while a seat is found; main.js lifts the
    // curtain on the table, or here if no seat came of it.
    Curtain.drop('Taking your seat…');
    try {
      if (id === 'blackjack') await S.playNow();
      else if (id === 'holdem') await Poker.playPokerNow();
      else if (id === 'roulette') await Roulette.playRouletteNow();
      else if (id === 'slots') await Slots.startSlots();
      else if (id === 'craps') await Craps.playCrapsNow();
      else await Baccarat.playBaccaratNow();
    } catch (e) { /* the page says what went wrong */ }
    if (S.session.screen !== 'table') Curtain.lift(0);
  });
  on('stageTables', () => go(FLOOR[carouselIndex()].id));
  // A drag anywhere on the floor turns the arc with the finger; let go and
  // it comes to rest on the nearest table, carried on a little by a flick.
  let startX = 0, startPos = 0, lastX = 0, lastT = 0, vel = 0, pid = null, moved = false;
  stage.onpointerdown = (e) => {
    if (e.button !== 0 || e.target.closest('button, a, input, select')) return;
    if (!lobbyScene) return;
    pid = e.pointerId; dragging = true; moved = false;
    startX = lastX = e.clientX; lastT = performance.now(); vel = 0;
    startPos = lobbyScene.carouselPos;
  };
  stage.onpointermove = (e) => {
    if (e.pointerId !== pid || !dragging) return;
    const dx = e.clientX - startX;
    if (!moved && Math.abs(dx) < 6) return;
    if (!moved) { moved = true; stage.setPointerCapture(pid); stage.classList.add('moving'); }
    const now = performance.now();
    const w = Math.max(320, window.innerWidth) * 0.6;
    vel = 0.8 * vel + 0.2 * ((e.clientX - lastX) / w) / Math.max(1, now - lastT) * 1000;
    lastX = e.clientX; lastT = now;
    lobbyScene.carouselHold(startPos - dx / w);
  };
  const end = (e) => {
    if (e.pointerId !== pid) return;
    pid = null;
    if (!dragging) return;
    dragging = false;
    if (!moved) return;
    const pos = lobbyScene.carouselPos;
    const target = Math.round(pos - Math.max(-1, Math.min(1, vel * 0.25)));
    const changed = wrapIndex(target) !== carouselIndex();
    carouselTarget = target;
    lobbyScene.carouselTo(target, Math.max(-3, Math.min(3, -vel)));
    if (changed) showGame();
    settleWatch();
  };
  stage.onpointerup = end;
  stage.onpointercancel = end;
}
let stageKeys = false;
function bindStageKeys() {
  if (stageKeys) return;
  stageKeys = true;
  document.addEventListener('keydown', (e) => {
    if (S.session.screen !== 'home' || S.lobbyGame !== 'home' || sheet) return;
    if (e.target && e.target.closest && e.target.closest('input, textarea, select')) return;
    if (e.key === 'ArrowLeft') glideTo(carouselTarget - 1);
    else if (e.key === 'ArrowRight') glideTo(carouselTarget + 1);
    else if (e.key === 'Enter' && document.activeElement === document.body) { const b = document.getElementById('stagePlay'); if (b) b.click(); }
  });
}

// ---------- 2a. blackjack ----------

function bjRow(t) {
  const felt = feltTheme(t.felt);
  const full = t.count >= MAX_PUBLIC_SEATS;
  return `
    <li><button class="row" data-sheet="bj" data-key="${esc(t.code)}">
      <span class="felt-dot" style="--hi:${felt.hi};--lo:${felt.lo}"></span>
      <span class="row-main">
        <span class="row-title">${esc(roomName(t))}</span>
        <span class="row-sub">${stakesLabel(t.minBet || 100, t.maxBet || 2000)}</span>
      </span>
      <span class="pill ${full ? 'muted' : t.count ? 'live' : ''}">${full ? 'Full' : `${t.count}/${MAX_PUBLIC_SEATS}`}</span>
      ${chevron}
    </button></li>`;
}

function blackjackPage() {
  const tables = S.lobbyTables;
  let list;
  if (S.lobbyLoading && !tables) list = '<div class="empty-state">Loading tables…</div>';
  else if (!tables || !tables.length) list = '<div class="empty-state">No open tables right now. Play now and one will be set up for you.</div>';
  else list = `<ul class="rows">${tables.map(bjRow).join('')}</ul>`;
  return `
    ${banner('blackjack', {
      kicker: 'Table game · five seats',
      title: 'Blackjack',
      line: 'Blackjack pays 3 to 2 · dealer stands on all 17s',
      actions: '<button class="btn btn-primary btn-lg" id="playNowBtn">Play now</button><button class="btn btn-ghost" data-sheet="join" data-key="bj">Join or host</button>',
    })}
    <section class="list-section">${listHead('Tables')}${list}</section>`;
}

// ---------- 2c. roulette ----------

const rouletteNums = (history, n) => `<span class="rl-mini">${history.slice(0, n).map((x) => `<i class="${colorOf(x)}">${x}</i>`).join('')}</span>`;

function rouletteRow(t) {
  const full = t.count >= ROULETTE_SEATS;
  return `
    <li><button class="row" data-sheet="roulette" data-key="${esc(t.code)}">
      <span class="felt-dot rl-dot"></span>
      <span class="row-main">
        <span class="row-title">${esc(ROOM_NAMES[t.tier - 1])}</span>
        <span class="row-sub">${stakesLabel(t.minBet, t.maxBet)}${t.history.length ? ' · ' + rouletteNums(t.history, 5) : ''}</span>
      </span>
      <span class="pill ${full ? 'muted' : t.count ? 'live' : ''}">${full ? 'Full' : `${t.count}/${ROULETTE_SEATS}`}</span>
      ${chevron}
    </button></li>`;
}

function roulettePage() {
  const tables = S.rouletteTables;
  let list;
  if (S.lobbyLoading && !tables) list = '<div class="empty-state">Loading tables…</div>';
  else if (!tables || !tables.length) list = '<div class="empty-state">No open tables right now. Play now and one will be set up for you.</div>';
  else list = `<ul class="rows">${tables.map(rouletteRow).join('')}</ul>`;
  return `
    ${banner('roulette', {
      kicker: 'Table game · six seats',
      title: 'Roulette',
      line: 'European wheel, one zero · straight up pays 35 to 1',
      actions: '<button class="btn btn-primary btn-lg" id="rouletteNowBtn">Play now</button><button class="btn btn-ghost" data-sheet="join" data-key="roulette">Join or host</button>',
    })}
    <section class="list-section">${listHead('Tables')}${list}</section>
    <section class="feature-card theme-roulette">
      <div class="feature-text">
        <span class="kicker">Practice</span>
        <h2 class="feature-title">A wheel to yourself</h2>
        <p class="feature-line">Learn the bets at your own pace. Practice chips — your balance isn't touched.</p>
      </div>
      <div class="feature-form">
        <label class="field-inline"><span>Stakes</span><select id="rlPracticeStakes">${TABLE_STAKES.map((st, i) => `<option value="${i}">${esc(ROOM_NAMES[i])} · ${short(st.min)} / ${short(st.max)}</option>`).join('')}</select></label>
        <button class="btn btn-primary btn-lg" id="rlPracticeBtn">Spin for practice</button>
      </div>
    </section>`;
}

function rouletteSheet(t) {
  const full = t.count >= ROULETTE_SEATS;
  return `
    <div class="sheet-band theme-roulette">
      <span class="tt-room">Roulette · table ${esc(t.code)}</span>
      <h2 class="ls-title">${esc(ROOM_NAMES[t.tier - 1])}</h2>
    </div>
    <div class="sheet-body">
      <div class="facts">
        ${fact('Bets', stakesLabel(t.minBet, t.maxBet) + ' a spin')}
        ${fact('Seated', `${t.count} of ${ROULETTE_SEATS}`)}
        ${fact('Last numbers', t.history.length ? rouletteNums(t.history, 6) : 'None yet')}
      </div>
      <div class="sheet-status"><span class="status-title">At the table</span><div class="status-line"><span class="seat-faces">${seatsHtml(t.seats || [], ROULETTE_SEATS)}</span></div></div>
      <div class="sheet-actions">
        <button class="btn btn-primary" data-join-roulette="${esc(t.code)}" ${full ? 'disabled' : ''}>${full ? 'Table full' : 'Take a seat'}</button>
      </div>
    </div>`;
}

// ---------- 2c+. craps ----------

const crapsRolls = (history, n) => `<span class="cr-mini">${history.slice(0, n).map((x) => `<i class="${x === 7 ? 'seven' : ''}">${x}</i>`).join('')}</span>`;

function crapsRow(t) {
  const full = t.count >= CRAPS_SEATS;
  return `
    <li><button class="row" data-sheet="craps" data-key="${esc(t.code)}">
      <span class="felt-dot cr-dot"></span>
      <span class="row-main">
        <span class="row-title">${esc(ROOM_NAMES[t.tier - 1])}</span>
        <span class="row-sub">${stakesLabel(t.minBet, t.maxBet)} · ${t.point ? 'point ' + t.point : 'coming out'}${t.history.length ? ' · ' + crapsRolls(t.history, 5) : ''}</span>
      </span>
      <span class="pill ${full ? 'muted' : t.count ? 'live' : ''}">${full ? 'Full' : `${t.count}/${CRAPS_SEATS}`}</span>
      ${chevron}
    </button></li>`;
}

function crapsPage() {
  const tables = S.crapsTables;
  let list;
  if (S.lobbyLoading && !tables) list = '<div class="empty-state">Loading tables…</div>';
  else if (!tables || !tables.length) list = '<div class="empty-state">No open tables right now. Play now and one will be set up for you.</div>';
  else list = `<ul class="rows">${tables.map(crapsRow).join('')}</ul>`;
  return `
    ${banner('craps', {
      kicker: 'Dice · six seats',
      title: 'Craps',
      line: 'Pass Line pays even money · odds at true odds · the field, the hard ways and the propositions',
      actions: '<button class="btn btn-primary btn-lg" id="crapsNowBtn">Play now</button><button class="btn btn-ghost" data-sheet="join" data-key="craps">Join or host</button>',
    })}
    <section class="list-section">${listHead('Tables')}${list}</section>
    <section class="feature-card theme-craps">
      <div class="feature-text">
        <span class="kicker">Practice</span>
        <h2 class="feature-title">The dice to yourself</h2>
        <p class="feature-line">Learn the come-out, the point and the odds at your own pace. Practice chips: your balance stays as it is.</p>
      </div>
      <div class="feature-form">
        <label class="field-inline"><span>Stakes</span><select id="crPracticeStakes">${TABLE_STAKES.map((st, i) => `<option value="${i}">${esc(ROOM_NAMES[i])} · ${short(st.min)} / ${short(st.max)}</option>`).join('')}</select></label>
        <button class="btn btn-primary btn-lg" id="crPracticeBtn">Roll for practice</button>
      </div>
    </section>`;
}

function crapsSheet(t) {
  const full = t.count >= CRAPS_SEATS;
  return `
    <div class="sheet-band theme-craps">
      <span class="tt-room">Craps · table ${esc(t.code)}</span>
      <h2 class="ls-title">${esc(ROOM_NAMES[t.tier - 1])}</h2>
    </div>
    <div class="sheet-body">
      <div class="facts">
        ${fact('Bets', stakesLabel(t.minBet, t.maxBet))}
        ${fact('Seated', `${t.count} of ${CRAPS_SEATS}`)}
        ${fact('Point', t.point ? String(t.point) : 'Coming out')}
        ${fact('Last rolls', t.history.length ? crapsRolls(t.history, 6) : 'None yet')}
      </div>
      <div class="sheet-status"><span class="status-title">At the table</span><div class="status-line"><span class="seat-faces">${seatsHtml(t.seats || [], CRAPS_SEATS)}</span></div></div>
      <div class="sheet-actions">
        <button class="btn btn-primary" data-join-craps="${esc(t.code)}" ${full ? 'disabled' : ''}>${full ? 'Table full' : 'Take a seat'}</button>
      </div>
    </div>`;
}

// ---------- 2d. baccarat ----------

const bacBeads = (history, n) => `<span class="bc-mini">${history.slice(-n).map((m) => `<i class="${m[0]}">${m[0]}</i>`).join('')}</span>`;

function baccaratRow(t) {
  const full = t.count >= BACCARAT_SEATS;
  return `
    <li><button class="row" data-sheet="baccarat" data-key="${esc(t.code)}">
      <span class="felt-dot bc-dot"></span>
      <span class="row-main">
        <span class="row-title">${esc(ROOM_NAMES[t.tier - 1])}</span>
        <span class="row-sub">${stakesLabel(t.minBet, t.maxBet)}${t.history.length ? ' · ' + bacBeads(t.history, 6) : ''}</span>
      </span>
      <span class="pill ${full ? 'muted' : t.count ? 'live' : ''}">${full ? 'Full' : `${t.count}/${BACCARAT_SEATS}`}</span>
      ${chevron}
    </button></li>`;
}

function baccaratPage() {
  const tables = S.baccaratTables;
  let list;
  if (S.lobbyLoading && !tables) list = '<div class="empty-state">Loading tables…</div>';
  else if (!tables || !tables.length) list = '<div class="empty-state">No open tables right now. Play now and one will be set up for you.</div>';
  else list = `<ul class="rows">${tables.map(baccaratRow).join('')}</ul>`;
  return `
    ${banner('baccarat', {
      kicker: 'Table game · seven seats',
      title: 'Baccarat',
      line: 'Punto Banco, eight decks · Banker pays 19 to 20, Tie 8 to 1',
      actions: '<button class="btn btn-primary btn-lg" id="baccaratNowBtn">Play now</button><button class="btn btn-ghost" data-sheet="join" data-key="baccarat">Join or host</button>',
    })}
    <section class="list-section">${listHead('Tables')}${list}</section>
    <section class="feature-card theme-baccarat">
      <div class="feature-text">
        <span class="kicker">Practice</span>
        <h2 class="feature-title">A shoe to yourself</h2>
        <p class="feature-line">Watch the third-card rules play out at your own pace. Practice chips — your balance isn't touched.</p>
      </div>
      <div class="feature-form">
        <label class="field-inline"><span>Stakes</span><select id="bcPracticeStakes">${TABLE_STAKES.map((st, i) => `<option value="${i}">${esc(ROOM_NAMES[i])} · ${short(st.min)} / ${short(st.max)}</option>`).join('')}</select></label>
        <button class="btn btn-primary btn-lg" id="bcPracticeBtn">Deal for practice</button>
      </div>
    </section>`;
}

// ---------- 2e. the slot salon ----------
function slotsPage() {
  return `
    ${banner('slots', {
      kicker: 'High Limit Salon · slots',
      title: 'Crown Jewels',
      line: 'Five reels, three rows, ten lines · the NVGR crest is wild · Diamonds scatter',
      actions: '<button class="btn btn-primary btn-lg" id="slotsNowBtn">Take a seat</button>',
    })}
    <section class="feature-card theme-slots">
      <div class="feature-text">
        <span class="kicker">How it pays</span>
        <h2 class="feature-title">Jewels, crowns and the crest</h2>
        <p class="feature-line">Three or more of a kind on a line, from the first reel, win. Five NVGR wilds on a line pay a thousand times the line bet; three Diamonds anywhere pay on the whole bet. Plays on your real balance, from 10 a spin.</p>
      </div>
    </section>`;
}

function baccaratSheet(t) {
  const full = t.count >= BACCARAT_SEATS;
  return `
    <div class="sheet-band theme-baccarat">
      <span class="tt-room">Baccarat · table ${esc(t.code)}</span>
      <h2 class="ls-title">${esc(ROOM_NAMES[t.tier - 1])}</h2>
    </div>
    <div class="sheet-body">
      <div class="facts">
        ${fact('Bets', stakesLabel(t.minBet, t.maxBet) + ' a coup')}
        ${fact('Seated', `${t.count} of ${BACCARAT_SEATS}`)}
        ${fact('Last coups', t.history.length ? bacBeads(t.history, 8) : 'None yet')}
      </div>
      <div class="sheet-status"><span class="status-title">At the table</span><div class="status-line"><span class="seat-faces">${seatsHtml(t.seats || [], BACCARAT_SEATS)}</span></div></div>
      <div class="sheet-actions">
        <button class="btn btn-primary" data-join-baccarat="${esc(t.code)}" ${full ? 'disabled' : ''}>${full ? 'Table full' : 'Take a seat'}</button>
      </div>
    </div>`;
}

// ---------- 2b. Hold'em ----------

function pokerRow(t) {
  const felt = feltTheme(t.felt);
  return `
    <li><button class="row" data-sheet="poker" data-key="${esc(t.code)}">
      <span class="felt-dot" style="--hi:${felt.hi};--lo:${felt.lo}"></span>
      <span class="row-main">
        <span class="row-title">${esc(ROOM_NAMES[t.tier - 1])}</span>
        <span class="row-sub">Blinds ${short(t.sb)} / ${short(t.bb)}</span>
      </span>
      <span class="pill ${t.playing ? 'live' : ''}">${t.playing ? 'Playing · ' : ''}${t.count}/${POKER_SEATS}</span>
      ${chevron}
    </button></li>`;
}

function holdemPage() {
  const tables = S.pokerTables && S.pokerTables.tables;
  const stakes = POKER_STAKES.map((st, i) => `<option value="${i}">${esc(ROOM_NAMES[i])} · ${short(st.sb)} / ${short(st.bb)}</option>`).join('');
  let body;
  if (holdemTab === 'practice') {
    body = `
      <section class="feature-card theme-holdem">
        <div class="feature-text">
          <span class="kicker">Practice</span>
          <h2 class="feature-title">Play against bots</h2>
          <p class="feature-line">Computer players, any time, no one else needed. Practice chips — your balance isn't touched.</p>
        </div>
        <div class="feature-form">
          <label class="field-inline"><span>Stakes</span><select id="practiceStakes">${stakes}</select></label>
          <label class="field-inline"><span>Opponents</span><select id="practiceBots">${[1, 2, 3, 4, 5].map((n) => `<option value="${n}" ${n === 3 ? 'selected' : ''}>${n} bot${n > 1 ? 's' : ''}</option>`).join('')}</select></label>
          <button class="btn btn-primary btn-lg" id="practiceBtn">Deal me in</button>
        </div>
      </section>`;
  } else {
    const list = S.lobbyLoading && !tables ? '<div class="empty-state">Loading tables…</div>' : `<ul class="rows">${(tables || []).map(pokerRow).join('')}</ul>`;
    body = `<section class="list-section">${listHead('Cash tables')}${list}</section>`;
  }
  return `
    ${banner('holdem', {
      kicker: 'Poker · no limit · six seats',
      title: "Texas Hold'em",
      line: `Blinds from ${short(POKER_STAKES[0].sb)} / ${short(POKER_STAKES[0].bb)} to ${short(POKER_STAKES[POKER_STAKES.length - 1].sb)} / ${short(POKER_STAKES[POKER_STAKES.length - 1].bb)}`,
      actions: '<button class="btn btn-primary btn-lg" id="pokerNowBtn">Play now</button><button class="btn btn-ghost" data-sheet="join" data-key="holdem">Join or host</button>',
      tabs: tabs([['cash', 'Cash tables'], ['practice', 'Practice']], holdemTab, 'data-holdem-tab'),
    })}
    ${body}`;
}

// ---------- 2c. tournaments ----------
// Two games' tournaments, one page: a tab for each. Each game keeps its own
// rules module and tables; what differs here is gathered in GAMES.

const GAMES = {
  blackjack: {
    defs: BT.BJ_TOURNAMENTS,
    byId: BT.bjTournamentById,
    list: () => S.bjTournaments || [],
    seats: BT.SEATS,
    get blurb() {
      return bjFormat === 'elimination'
      ? `Five players, ${BT.START_STACK.toLocaleString()} chips each, ${BT.FORMATS.elimination.hands} hands. After hands ${BT.FORMATS.elimination.cuts.join(', ')} the lowest stack goes out — two are left for the last hands.`
      : `Five players, ${BT.START_STACK.toLocaleString()} chips each, ${BT.FORMATS.quick.hands} hands, straight. Most chips after the last hand wins.`;
    },
    facts: (def) => [['Format', def.format === 'elimination' ? `Elimination · ${def.hands} hands` : `Quick · ${def.hands} hands`], ['Starting chips', BT.START_STACK.toLocaleString()], ['Players', String(BT.SEATS)], ['Bets', `${BT.MIN_BET.toLocaleString()} – ${BT.MAX_BET.toLocaleString()}`]],
    bots: 'four bots',
    full: 'five',
    wait: BT.START_WAIT_MS,
    win: 'Most chips after the last hand',
  },
  holdem: {
    defs: T.TOURNAMENTS,
    byId: T.tournamentById,
    list: () => (S.pokerTables && S.pokerTables.tournaments) || [],
    seats: T.SEATS,
    blurb: `Six players, ${T.START_STACK.toLocaleString()} chips each, blinds up every ${T.HANDS_PER_LEVEL} hands. Last one standing takes first prize; second and third are paid too.`,
    facts: () => [['Players', String(T.SEATS)], ['Starting chips', T.START_STACK.toLocaleString()], ['Blinds up', `every ${T.HANDS_PER_LEVEL} hands`], ['Blinds start', `${T.LEVELS[0][0]} / ${T.LEVELS[0][1]}`]],
    bots: 'five bots',
    full: 'six',
    wait: T.START_WAIT_MS,
    win: 'Last one standing',
  },
};
const gameOf = (id) => (/^bj\d/.test(String(id)) ? 'blackjack' : 'holdem');
const tourDef = (id) => GAMES[gameOf(id)].byId(id);

function tourState(def) {
  const list = GAMES[gameOf(def.id)].list();
  return {
    open: list.find((t) => t.id === def.id && t.status === 'registering'),
    inPlay: list.filter((t) => t.id === def.id && t.status === 'running'),
    mine: list.find((t) => t.id === def.id && t.mine && t.status !== 'finished'),
    recent: list.filter((t) => t.id === def.id && t.status === 'finished' && t.winner).slice(-1)[0],
  };
}

function tourTile(def) {
  const { open, mine } = tourState(def);
  const g = GAMES[gameOf(def.id)];
  const sky = def.tier === 5 ? ` style="--sky:url('${SKYLINE}')"` : '';
  const status = mine ? 'You are in' : open && open.count ? `${open.count}/${g.seats} registered` : 'Open';
  return `
    <button class="tour-tile tier-${def.tier} ${def.featured ? 'featured' : ''}" data-sheet="tour" data-key="${def.id}"${sky}>
      <span class="tt-top">
        <span class="tt-room">${esc(ROOM_NAMES[def.tier - 1])}</span>
        ${def.featured ? '<span class="ribbon">Featured</span>' : ''}
      </span>
      ${def.featured ? `<span class="tt-art">${ART.tournaments}</span>` : ''}
      <span class="tt-name">${esc(def.name)}${def.format ? `<span class="tt-format">${def.format === 'elimination' ? 'Elimination' : 'Quick'} · ${def.hands} hands</span>` : ''}</span>
      <span class="tt-prize"><span class="tt-label">1st prize</span><span class="gold-num">${def.featured ? def.prizes[0].toLocaleString() : short(def.prizes[0])}</span></span>
      <span class="tt-foot">
        <span>Buy-in <b>${short(def.buyIn)}</b></span>
        <span class="pill ${mine ? 'live' : open && open.count ? 'warm' : ''}">${status}</span>
      </span>
    </button>`;
}

function tournamentsPage() {
  const g = GAMES[tourGame];
  const loading = S.lobbyLoading && !(tourGame === 'blackjack' ? S.bjTournaments : S.pokerTables && S.pokerTables.tournaments);
  const shown = tourGame === 'blackjack' ? g.defs.filter((d) => d.format === bjFormat) : g.defs;
  const defs = shown.filter((d) => d.featured).concat(shown.filter((d) => !d.featured));
  const formats = tourGame === 'blackjack' ? `
    <div class="format-pick" role="tablist">
      ${[['quick', 'Quick', `${BT.FORMATS.quick.hands} hands · most chips wins`], ['elimination', 'Elimination', `${BT.FORMATS.elimination.hands} hands · lowest stack out after ${BT.FORMATS.elimination.cuts.join(', ')}`]].map(([id, name, line]) => `
        <button class="format-card ${bjFormat === id ? 'on' : ''}" data-bj-format="${id}" role="tab" aria-selected="${bjFormat === id}">
          <span class="format-name">${name}</span><span class="format-line">${line}</span>
        </button>`).join('')}
    </div>` : '';
  return `
    ${banner('tournaments', {
      kicker: tourGame === 'blackjack' ? 'Blackjack · five players' : "Hold'em · Sit & Go · six players",
      title: 'Tournaments',
      line: g.blurb + ` Online, or against ${g.bots}.`,
      tabs: tabs([['blackjack', 'Blackjack'], ['holdem', "Texas Hold'em"]], tourGame, 'data-tour-game'),
    })}
    <section class="list-section">
      ${formats}
      ${listHead('Choose a tournament')}
      ${loading ? '<div class="empty-state">Loading tournaments…</div>' : `<div class="tour-grid">${defs.map(tourTile).join('')}</div>`}
    </section>`;
}

// ---------- 2d. leaderboard ----------

function leaderboardPage() {
  const list = Leaderboard.ranked(boardBy);
  const myKey = safeKey(S.session.uid || '');
  const value = (e) => (boardBy === 'winnings' ? e.winnings : e.chips).toLocaleString();
  const podium = list.slice(0, 3);
  const rest = list.slice(3, 25);
  const myIndex = list.findIndex((e) => e.key === myKey);
  let body;
  if (!Leaderboard.entries) body = '<div class="empty-state">Loading…</div>';
  else if (!list.length) body = `<div class="empty-state">${boardBy === 'winnings' ? 'No tournament winnings yet — be the first.' : 'Nobody on the board yet.'}</div>`;
  else {
    // Second, first, third: the winner in the middle, raised.
    const order = [1, 0, 2].filter((i) => podium[i]);
    body = `
      <div class="podium">
        ${order.map((i) => `
          <div class="podium-spot p${i + 1} ${podium[i].key === myKey ? 'me' : ''}">
            <img src="${portrait(podium[i].character, podium[i].key, 128)}" alt="">
            <span class="medal m${i + 1}">${i + 1}</span>
            <span class="podium-name">${esc(podium[i].name)}</span>
            <span class="podium-val">${value(podium[i])}</span>
            <span class="podium-block"></span>
          </div>`).join('')}
      </div>
      ${rest.length ? `<ol class="rows board-rows" start="4">${rest.map((e, i) => `
        <li class="row static ${e.key === myKey ? 'me' : ''}">
          <span class="rank">${i + 4}</span>
          <img class="row-face" src="${portrait(e.character, e.key, 48)}" alt="">
          <span class="row-main"><span class="row-title">${esc(e.name)}</span>${boardBy === 'winnings' ? `<span class="row-sub">${e.wins} win${e.wins === 1 ? '' : 's'} · ${e.cashes} cash${e.cashes === 1 ? '' : 'es'}</span>` : ''}</span>
          <span class="row-val">${value(e)}</span>
        </li>`).join('')}</ol>` : ''}
      ${myIndex >= 25 ? `<p class="your-rank">You are <b>#${myIndex + 1}</b> with ${value(list[myIndex])}.</p>` : ''}`;
  }
  return `
    ${banner('gold', {
      kicker: 'Hall of fame',
      title: 'Leaderboard',
      line: boardBy === 'winnings' ? 'Ranked by tournament prizes won.' : 'Ranked by chip balance.',
      tabs: tabs([['chips', 'Richest'], ['winnings', 'Tournament winnings']], boardBy, 'data-board'),
    })}
    <section class="list-section">${body}</section>`;
}

// ---------- 3. the sheet ----------

function fact(label, value) {
  return `<div class="fact"><span class="fact-label">${label}</span><span class="fact-value">${value}</span></div>`;
}

function startsIn(t) {
  if (!t || t.count < 2 || !t.startsAt) return t && t.count ? 'Waiting for a second player' : 'Be the first to register';
  return `<span data-starts-at="${t.startsAt}">${clock(t.startsAt)}</span>`;
}
function clock(at) {
  const secs = Math.max(0, Math.ceil((at - Date.now()) / 1000));
  return secs ? `Starts in ${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}` : 'Starting…';
}

function tourSheet(def) {
  const game = gameOf(def.id);
  const g = GAMES[game];
  const { open, inPlay, mine, recent } = tourState(def);
  const afford = S.session.chips >= def.buyIn;
  const sky = def.tier === 5 ? ` style="--sky:url('${SKYLINE}')"` : '';
  const kind = game === 'blackjack' ? 'Blackjack' : "Texas Hold'em";
  if (sheet.confirm) {
    return `
      <div class="sheet-band tier-${def.tier}"${sky}><span class="tt-room">${kind} · against ${g.bots}</span><h2 class="ls-title">${esc(def.name)}</h2></div>
      <div class="sheet-body">
        <p class="sheet-text">${def.buyIn.toLocaleString()} comes off your balance now. Finish in the top three for a prize — <b>${def.prizes[0].toLocaleString()}</b> to the winner. Leaving before the end forfeits your seat.</p>
        <div class="sheet-actions">
          <button class="btn btn-ghost" data-confirm="0">Cancel</button>
          <button class="btn btn-primary" id="startBotsBtn">Start · ${def.buyIn.toLocaleString()}</button>
        </div>
      </div>`;
  }
  let online;
  if (mine) online = `<button class="btn btn-primary" data-open-tour="${esc(mine.code)}" data-game="${game}">Return to your table</button>`;
  else if (open) online = `<button class="btn btn-primary" data-register="${esc(open.code)}" data-game="${game}" ${afford ? '' : 'disabled'}>Register online</button>`;
  else online = '<button class="btn btn-primary" disabled>Opening…</button>';
  return `
    <div class="sheet-band tier-${def.tier}"${sky}>
      <span class="tt-room">${kind} · ${esc(ROOM_NAMES[def.tier - 1])}</span>
      <h2 class="ls-title">${esc(def.name)}</h2>
      <span class="gold-num big">${def.prizes[0].toLocaleString()}</span>
      <span class="sheet-sub">to the winner · ${g.win.toLowerCase()} takes it</span>
    </div>
    <div class="sheet-body">
      <div class="payouts">
        ${def.prizes.map((p, i) => `<div class="payout p${i + 1}"><span class="medal m${i + 1}">${i + 1}</span><span>${p.toLocaleString()}</span></div>`).join('')}
      </div>
      <div class="facts">
        ${fact('Buy-in', def.buyIn.toLocaleString())}
        ${g.facts(def).slice(0, 3).map(([l, v]) => fact(l, v)).join('')}
      </div>
      <div class="sheet-status">
        <span class="status-title">Online now</span>
        <div class="status-line"><span class="seat-faces">${seatsHtml(open ? open.seats : [], g.seats)}</span><span class="muted">${open ? `${open.count}/${g.seats} · ${startsIn(open)}` : ''}</span></div>
        ${inPlay.length || recent ? `<span class="muted small">${inPlay.length ? `${inPlay.length} in play` : ''}${inPlay.length && recent ? ' · ' : ''}${recent ? `Last won by ${esc(recent.winner)}` : ''}</span>` : ''}
      </div>
      <p class="sheet-fine">Online it starts when ${g.full} have registered, or ${g.wait / 1000} seconds after the second; a smaller field plays for prizes in proportion.</p>
      ${S.formError ? '<p class="sheet-warn">' + esc(S.formError) + '</p>' : ''}
      <div class="sheet-actions">
        ${online}
        <button class="btn btn-ghost" data-confirm="1" ${afford ? '' : 'disabled'}>Play vs bots</button>
      </div>
      ${afford ? '' : `<p class="sheet-warn">You need ${def.buyIn.toLocaleString()} to enter — you have ${(S.session.chips || 0).toLocaleString()}.</p>`}
    </div>`;
}

function pokerSheet(t) {
  const felt = feltTheme(t.felt);
  const { min, max } = buyInRange(t);
  const full = t.count >= POKER_SEATS;
  return `
    <div class="sheet-band felt" style="--hi:${felt.hi};--lo:${felt.lo}">
      <span class="tt-room">Texas Hold'em · table ${esc(t.code)}</span>
      <h2 class="ls-title">${esc(ROOM_NAMES[t.tier - 1])}</h2>
    </div>
    <div class="sheet-body">
      <div class="facts">
        ${fact('Blinds', `${short(t.sb)} / ${short(t.bb)}`)}
        ${fact('Buy-in', `${short(min)} – ${short(max)}`)}
        ${fact('Seated', `${t.count} of ${POKER_SEATS}`)}
        ${fact('Status', t.playing ? 'Hand in progress' : t.count >= 2 ? 'Dealing soon' : 'Waiting')}
      </div>
      <div class="sheet-status"><span class="status-title">At the table</span><div class="status-line"><span class="seat-faces">${seatsHtml(t.seats || [], POKER_SEATS)}</span></div></div>
      <div class="sheet-actions">
        <button class="btn btn-primary" data-open-poker="${esc(t.code)}">${full ? 'Watch' : 'Take a seat'}</button>
      </div>
      ${S.session.chips < min && !full ? `<p class="sheet-warn">You need ${min.toLocaleString()} to sit here; you can still watch.</p>` : ''}
    </div>`;
}

function bjSheet(t) {
  const felt = feltTheme(t.felt);
  const full = t.count >= MAX_PUBLIC_SEATS;
  return `
    <div class="sheet-band felt" style="--hi:${felt.hi};--lo:${felt.lo}">
      <span class="tt-room">Blackjack · table ${esc(t.code)}</span>
      <h2 class="ls-title">${esc(roomName(t))}</h2>
    </div>
    <div class="sheet-body">
      <div class="facts">
        ${fact('Bets', stakesLabel(t.minBet || 100, t.maxBet || 2000))}
        ${fact('Seated', `${t.count} of ${MAX_PUBLIC_SEATS}`)}
        ${fact('Now', PHASE_LABEL[t.phase] || 'Open')}
      </div>
      <div class="sheet-status"><span class="status-title">At the table</span><div class="status-line"><span class="seat-faces">${seatsHtml(t.seats || [], MAX_PUBLIC_SEATS)}</span></div></div>
      <div class="sheet-actions">
        <button class="btn btn-primary" data-join-table="${esc(t.code)}" ${full ? 'disabled' : ''}>${full ? 'Table full' : 'Join table'}</button>
      </div>
    </div>`;
}

function joinSheet(game) {
  const stakes = POKER_STAKES.map((st, i) => `<option value="${i}">${esc(ROOM_NAMES[i])} · ${short(st.sb)} / ${short(st.bb)}</option>`).join('');
  const rlStakes = TABLE_STAKES.map((st, i) => `<option value="${i}">${esc(ROOM_NAMES[i])} · ${short(st.min)} / ${short(st.max)}</option>`).join('');
  const theme = game === 'holdem' || game === 'roulette' || game === 'baccarat' || game === 'craps' ? game : 'blackjack';
  return `
    <div class="sheet-band theme-${theme}">
      <span class="tt-room">${game === 'holdem' ? "Texas Hold'em" : game === 'roulette' ? 'Roulette' : game === 'baccarat' ? 'Baccarat' : game === 'craps' ? 'Craps' : 'Blackjack'}</span>
      <h2 class="ls-title">Join or host</h2>
    </div>
    <div class="sheet-body">
      <span class="status-title">Have a table code?</span>
      <div class="join-inline">
        <input id="joinCode" type="text" placeholder="Code" maxlength="4" aria-label="Table code" autocomplete="off">
        <button class="btn btn-primary" id="joinBtn">Join</button>
      </div>
      ${S.formError ? '<p class="error-text" style="margin:8px 0 0;">' + esc(S.formError) + '</p>' : ''}
      <div class="or">or</div>
      <span class="status-title">Host a private table for friends</span>
      ${game === 'holdem'
        ? `<div class="join-inline"><select id="pokerStakes" aria-label="Stakes">${stakes}</select><button class="btn" id="pokerHostBtn">Create</button></div>`
        : game === 'roulette'
          ? `<div class="join-inline"><select id="rouletteStakes" aria-label="Stakes">${rlStakes}</select><button class="btn" id="rouletteHostBtn">Create</button></div>`
          : game === 'baccarat'
            ? `<div class="join-inline"><select id="baccaratStakes" aria-label="Stakes">${rlStakes}</select><button class="btn" id="baccaratHostBtn">Create</button></div>`
          : game === 'craps'
            ? `<div class="join-inline"><select id="crapsStakes" aria-label="Stakes">${rlStakes}</select><button class="btn" id="crapsHostBtn">Create</button></div>`
            : '<button class="btn btn-block" id="hostBtn">Create a private table</button>'}
    </div>`;
}

function sheetHtml() {
  if (!sheet) return '';
  let inner = '';
  if (sheet.kind === 'tour') { const def = tourDef(sheet.key); if (def) inner = tourSheet(def); }
  else if (sheet.kind === 'poker') { const t = ((S.pokerTables && S.pokerTables.tables) || []).find((x) => x.code === sheet.key); if (t) inner = pokerSheet(t); }
  else if (sheet.kind === 'bj') { const t = (S.lobbyTables || []).find((x) => x.code === sheet.key); if (t) inner = bjSheet(t); }
  else if (sheet.kind === 'roulette') { const t = (S.rouletteTables || []).find((x) => x.code === sheet.key); if (t) inner = rouletteSheet(t); }
  else if (sheet.kind === 'craps') { const t = (S.crapsTables || []).find((x) => x.code === sheet.key); if (t) inner = crapsSheet(t); }
  else if (sheet.kind === 'baccarat') { const t = (S.baccaratTables || []).find((x) => x.code === sheet.key); if (t) inner = baccaratSheet(t); }
  else if (sheet.kind === 'join') inner = joinSheet(sheet.key);
  if (!inner) return '';
  return `
    <div class="overlay" id="sheetOverlay">
      <div class="lobby-sheet" role="dialog" aria-modal="true">
        <button class="sheet-close" id="sheetClose" aria-label="Close">×</button>
        ${inner}
      </div>
    </div>`;
}

// ---------- the page ----------

const PAGES = { home: homePage, blackjack: blackjackPage, holdem: holdemPage, roulette: roulettePage, baccarat: baccaratPage, slots: slotsPage, craps: crapsPage, tournaments: tournamentsPage, leaderboard: leaderboardPage };

export function renderHome() {
  if (S.lobbyGame === 'home' || !PAGES[S.lobbyGame]) return `${homePage()}${sheetHtml()}`;
  const page = PAGES[S.lobbyGame];
  return `
    ${nav()}
    <main class="page lobby page-${esc(S.lobbyGame)}">
      ${page()}
      <footer class="house-credit">${brandMark('credit-logo')}<span>NVGR Casino</span></footer>
    </main>
    ${sheetHtml()}
  `;
}

// The tournament page keeps itself current while open: the countdowns
// every second, the tables every fifteen.
let clockTimer = null;
let lastReload = 0;
let keysBound = false;
function keepCurrent() {
  if (!clockTimer) {
    clockTimer = setInterval(() => {
      if (S.session.screen !== 'home' || S.lobbyGame !== 'tournaments') return;
      document.querySelectorAll('[data-starts-at]').forEach((el) => { el.textContent = clock(Number(el.dataset.startsAt)); });
      if (Date.now() - lastReload > 15000 && !S.lobbyLoading) { lastReload = Date.now(); S.loadLobby(); }
    }, 1000);
  }
  if (!keysBound) {
    keysBound = true;
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && sheet && S.session.screen === 'home') closeSheet(); });
  }
}

function openSheet(next) { sheet = next; S.refresh(); }
function closeSheet() { sheet = null; S.refresh(); }
function go(page) {
  sheet = null;
  if (S.lobbyGame !== page) S.setLobbyGame(page);
  else S.refresh();
  window.scrollTo({ top: 0 });
}

export function attachHome() {
  keepCurrent();
  if (S.lobbyGame === 'home') { attachStage(); bindStageKeys(); }
  const on = (id, fn) => { const el = document.getElementById(id); if (el) el.onclick = fn; };
  const all = (sel, fn) => document.querySelectorAll(sel).forEach(fn);

  all('[data-go]', (el) => {
    el.onclick = () => {
      go(el.dataset.go);
      if (el.dataset.showTour) { tourGame = gameOf(el.dataset.showTour); openSheet({ kind: 'tour', key: el.dataset.showTour }); }
    };
  });
  on('signOutBtn', S.doSignOut);
  on('friendsBtn', () => S.goToScreen('friends'));
  on('characterBtn', () => S.goToScreen('character'));
  on('refreshLobbyBtn', () => { lastReload = Date.now(); S.loadLobby(); });

  on('playNowBtn', S.playNow);
  on('pokerNowBtn', Poker.playPokerNow);
  on('rouletteNowBtn', Roulette.playRouletteNow);
  on('crapsNowBtn', Craps.playCrapsNow);
  on('crPracticeBtn', () => {
    const sel = document.getElementById('crPracticeStakes');
    Craps.startPractice(sel ? Number(sel.value) : 0);
  });
  on('crapsHostBtn', () => {
    const sel = document.getElementById('crapsStakes');
    sheet = null;
    Craps.hostCrapsTable(sel ? Number(sel.value) : 0);
  });
  on('rlPracticeBtn', () => {
    const sel = document.getElementById('rlPracticeStakes');
    Roulette.startPractice(sel ? Number(sel.value) : 0);
  });
  on('rouletteHostBtn', () => {
    const sel = document.getElementById('rouletteStakes');
    sheet = null;
    Roulette.hostRouletteTable(sel ? Number(sel.value) : 0);
  });
  on('baccaratNowBtn', Baccarat.playBaccaratNow);
  on('slotsNowBtn', async () => { Curtain.drop('Taking your seat…'); try { await Slots.startSlots(); } catch (e) { /* said on the page */ } if (S.session.screen !== 'table') Curtain.lift(0); });
  on('bcPracticeBtn', () => {
    const sel = document.getElementById('bcPracticeStakes');
    Baccarat.startPractice(sel ? Number(sel.value) : 0);
  });
  on('baccaratHostBtn', () => {
    const sel = document.getElementById('baccaratStakes');
    sheet = null;
    Baccarat.hostBaccaratTable(sel ? Number(sel.value) : 0);
  });
  on('hostBtn', () => { sheet = null; S.createRoom(); });
  on('pokerHostBtn', () => {
    const sel = document.getElementById('pokerStakes');
    sheet = null;
    Poker.createPokerTable(sel ? Number(sel.value) : 0);
  });
  on('practiceBtn', () => {
    const stakes = document.getElementById('practiceStakes');
    const bots = document.getElementById('practiceBots');
    Offline.startPractice(stakes ? Number(stakes.value) : 0, bots ? Number(bots.value) : 3);
  });
  all('[data-holdem-tab]', (el) => { el.onclick = () => { holdemTab = el.dataset.holdemTab; S.refresh(); }; });
  all('[data-board]', (el) => {
    el.onclick = () => {
      boardBy = el.dataset.board;
      try { localStorage.setItem('nvgr-board', boardBy); } catch { /* private mode */ }
      S.refresh();
    };
  });

  // The sheet.
  all('[data-sheet]', (el) => { el.onclick = () => openSheet({ kind: el.dataset.sheet, key: el.dataset.key }); });
  on('sheetClose', closeSheet);
  const overlay = document.getElementById('sheetOverlay');
  if (overlay) overlay.onclick = (e) => { if (e.target === overlay) closeSheet(); };
  all('[data-confirm]', (el) => { el.onclick = () => { sheet = { ...sheet, confirm: el.dataset.confirm === '1' }; S.refresh(); }; });
  on('startBotsBtn', () => {
    const id = sheet && sheet.key;
    sheet = null;
    if (!id) return;
    if (gameOf(id) === 'blackjack') OfflineBJ.startBjTournament(id);
    else Offline.startTournament(id);
  });
  all('[data-tour-game]', (el) => { el.onclick = () => { tourGame = el.dataset.tourGame; S.refresh(); }; });
  all('[data-bj-format]', (el) => { el.onclick = () => { bjFormat = el.dataset.bjFormat; S.refresh(); }; });
  all('[data-open-tour]', (el) => {
    el.onclick = () => {
      sheet = null;
      if (el.dataset.game === 'blackjack') BJT.watchBj(el.dataset.openTour);
      else Poker.openPokerTable(el.dataset.openTour);
    };
  });
  all('[data-register]', (el) => {
    el.onclick = async () => {
      el.disabled = true;
      const ok = el.dataset.game === 'blackjack' ? await BJT.registerBj(el.dataset.register) : await Poker.registerTournament(el.dataset.register);
      if (ok) sheet = null; else el.disabled = false;
    };
  });
  all('[data-open-poker]', (el) => { el.onclick = () => { sheet = null; Poker.openPokerTable(el.dataset.openPoker); }; });
  all('[data-join-table]', (el) => { el.onclick = () => { sheet = null; S.joinSpecificPublicTable(el.dataset.joinTable); }; });
  all('[data-join-roulette]', (el) => { el.onclick = () => { sheet = null; Roulette.joinRouletteTable(el.dataset.joinRoulette); }; });
  all('[data-join-craps]', (el) => { el.onclick = () => { sheet = null; Craps.joinCrapsTable(el.dataset.joinCraps); }; });
  all('[data-join-baccarat]', (el) => { el.onclick = () => { sheet = null; Baccarat.joinBaccaratTable(el.dataset.joinBaccarat); }; });

  const code = document.getElementById('joinCode');
  const join = () => { if (code && code.value.trim()) { sheet = null; S.joinRoom(code.value); } };
  on('joinBtn', join);
  if (code) code.onkeydown = (e) => { if (e.key === 'Enter') join(); };
}
