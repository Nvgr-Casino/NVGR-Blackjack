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
// claret, Tournaments royal purple, the leaderboard gold.
import { MAX_PUBLIC_SEATS, stakesLabel, roomName, ROOM_NAMES, safeKey } from '../roomLogic.js';
import { POKER_SEATS, POKER_STAKES, buyInRange } from '../../poker/rules.js';
import * as T from '../../poker/tournament.js';
import * as Poker from '../pokerSession.js';
import * as Offline from '../offlinePoker.js';
import * as Leaderboard from '../leaderboard.js';
import { feltTheme } from '../../scene/table.js';
import { characterPortraitDataURL, defaultCharacterFor } from '../../scene/character.js';
import { brandMark, esc } from '../uiHelpers.js';
import * as S from '../session.js';
import * as Social from '../social.js';

const SKYLINE = import.meta.env.BASE_URL + 'assets/skyline/night_skyline.webp';

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
  </g>`;
const ART = {
  blackjack: `<svg viewBox="0 0 160 120" aria-hidden="true">${card(34, 22, -16, 'A', '♠', false, 46)}${card(70, 16, 10, 'K', '♥', true, 46)}${chipStack(132, 104, 3, ['#1f6b47', '#c8a46a', '#1f6b47'])}</svg>`,
  holdem: `<svg viewBox="0 0 160 120" aria-hidden="true">${card(22, 22, -12, 'A', '♦', true, 44)}${card(52, 18, 6, 'A', '♣', false, 44)}${chipStack(126, 104, 5, ['#7c1f24', '#1f3d6b', '#f1ece2', '#7c1f24', '#c8a46a'])}</svg>`,
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

// ---------- 1. home ----------

function homePage() {
  const uid = S.session.uid;
  const rank = Leaderboard.rankOf(uid, 'chips');
  const hour = new Date().getHours();
  const greet = hour < 5 ? 'Good evening' : hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const featured = T.TOURNAMENTS.find((d) => d.featured);
  const posters = [
    ['blackjack', 'Table game', 'Blackjack', 'Beat the dealer to 21'],
    ['holdem', 'Poker', "Texas Hold'em", 'No-limit cash games and practice'],
    ['tournaments', 'Sit & Go', 'Tournaments', `Win up to ${short(T.TOURNAMENTS[T.TOURNAMENTS.length - 1].prizes[0])}`],
  ];
  const top = Leaderboard.ranked('chips').slice(0, 3);
  return `
    <section class="welcome-card">
      <img class="welcome-avatar" src="${portrait(S.session.character, '', 128)}" alt="">
      <div class="welcome-text">
        <span class="welcome-greet">${greet}</span>
        <h1 class="welcome-name">${esc(S.session.name)}</h1>
      </div>
      <div class="welcome-stats">
        <div class="stat"><span class="stat-label">Balance</span><span class="stat-value gold">${(S.session.chips || 0).toLocaleString()}</span></div>
        <div class="stat"><span class="stat-label">Rank</span><span class="stat-value">${rank ? '#' + rank : '—'}</span></div>
      </div>
    </section>
    ${S.formNotice ? '<p class="notice-text lobby-error">' + esc(S.formNotice) + '</p>' : ''}

    <h2 class="home-title">Choose your game</h2>
    <nav class="posters" aria-label="Games">
      ${posters.map(([id, kicker, title, line]) => `
        <button class="poster theme-${id}" data-go="${id}">
          <span class="poster-art">${ART[id]}</span>
          <span class="poster-body">
            <span class="kicker">${kicker}</span>
            <span class="poster-title">${title}</span>
            <span class="poster-line">${line}</span>
            <span class="poster-cta">Enter ${arrow}</span>
          </span>
        </button>`).join('')}
    </nav>

    <div class="home-row">
      ${featured ? `
      <button class="promo theme-tournaments" data-go="tournaments" data-open-tour="${featured.id}">
        <span class="kicker">Featured tournament</span>
        <span class="promo-name">${esc(featured.name)}</span>
        <span class="promo-prize">${featured.prizes[0].toLocaleString()}</span>
        <span class="promo-line">to the winner · ${short(featured.buyIn)} buy-in · six players</span>
        <span class="poster-cta">See it ${arrow}</span>
      </button>` : ''}
      <button class="promo theme-gold mini-board" data-go="leaderboard">
        <span class="kicker">Leaderboard</span>
        ${top.length ? `<ol class="mini-list">${top.map((e, i) => `
          <li><span class="medal m${i + 1}">${i + 1}</span><img src="${portrait(e.character, e.key, 48)}" alt=""><span class="mini-name">${esc(e.name)}</span><span class="mini-val">${short(e.chips)}</span></li>`).join('')}</ol>`
          : '<span class="promo-line">Loading…</span>'}
        <span class="poster-cta">Full leaderboard ${arrow}</span>
      </button>
    </div>`;
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

function tourState(def) {
  const list = (S.pokerTables && S.pokerTables.tournaments) || [];
  return {
    open: list.find((t) => t.id === def.id && t.status === 'registering'),
    inPlay: list.filter((t) => t.id === def.id && t.status === 'running'),
    mine: list.find((t) => t.id === def.id && t.mine && t.status !== 'finished'),
    recent: list.filter((t) => t.id === def.id && t.status === 'finished' && t.winner).slice(-1)[0],
  };
}

function tourTile(def) {
  const { open, mine } = tourState(def);
  const sky = def.tier === 5 ? ` style="--sky:url('${SKYLINE}')"` : '';
  const status = mine ? 'You are in' : open && open.count ? `${open.count}/${T.SEATS} registered` : 'Open';
  return `
    <button class="tour-tile tier-${def.tier} ${def.featured ? 'featured' : ''}" data-sheet="tour" data-key="${def.id}"${sky}>
      <span class="tt-top">
        <span class="tt-room">${esc(ROOM_NAMES[def.tier - 1])}</span>
        ${def.featured ? '<span class="ribbon">Featured</span>' : ''}
      </span>
      ${def.featured ? `<span class="tt-art">${ART.tournaments}</span>` : ''}
      <span class="tt-name">${esc(def.name)}</span>
      <span class="tt-prize"><span class="tt-label">1st prize</span><span class="gold-num">${def.featured ? def.prizes[0].toLocaleString() : short(def.prizes[0])}</span></span>
      <span class="tt-foot">
        <span>Buy-in <b>${short(def.buyIn)}</b></span>
        <span class="pill ${mine ? 'live' : open && open.count ? 'warm' : ''}">${status}</span>
      </span>
    </button>`;
}

function tournamentsPage() {
  const loading = S.lobbyLoading && !(S.pokerTables && S.pokerTables.tournaments);
  const defs = T.TOURNAMENTS.filter((d) => d.featured).concat(T.TOURNAMENTS.filter((d) => !d.featured));
  return `
    ${banner('tournaments', {
      kicker: 'Sit & Go · six players',
      title: 'Tournaments',
      line: 'Last one standing takes first prize — second and third are paid too. Online, or against five bots.',
    })}
    <section class="list-section">
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
  const { open, inPlay, mine, recent } = tourState(def);
  const afford = S.session.chips >= def.buyIn;
  const sky = def.tier === 5 ? ` style="--sky:url('${SKYLINE}')"` : '';
  if (sheet.confirm) {
    return `
      <div class="sheet-band tier-${def.tier}"${sky}><span class="tt-room">Against five bots</span><h2 class="ls-title">${esc(def.name)}</h2></div>
      <div class="sheet-body">
        <p class="sheet-text">${def.buyIn.toLocaleString()} comes off your balance now. Finish in the top three for a prize — <b>${def.prizes[0].toLocaleString()}</b> to the winner. Leaving before the end forfeits your seat.</p>
        <div class="sheet-actions">
          <button class="btn btn-ghost" data-confirm="0">Cancel</button>
          <button class="btn btn-primary" id="startBotsBtn">Start · ${def.buyIn.toLocaleString()}</button>
        </div>
      </div>`;
  }
  let online;
  if (mine) online = `<button class="btn btn-primary" data-open-poker="${esc(mine.code)}">Return to your table</button>`;
  else if (open) online = `<button class="btn btn-primary" data-register="${esc(open.code)}" ${afford ? '' : 'disabled'}>Register online</button>`;
  else online = '<button class="btn btn-primary" disabled>Opening…</button>';
  return `
    <div class="sheet-band tier-${def.tier}"${sky}>
      <span class="tt-room">${esc(ROOM_NAMES[def.tier - 1])}</span>
      <h2 class="ls-title">${esc(def.name)}</h2>
      <span class="gold-num big">${def.prizes[0].toLocaleString()}</span>
      <span class="sheet-sub">to the winner</span>
    </div>
    <div class="sheet-body">
      <div class="payouts">
        ${def.prizes.map((p, i) => `<div class="payout p${i + 1}"><span class="medal m${i + 1}">${i + 1}</span><span>${p.toLocaleString()}</span></div>`).join('')}
      </div>
      <div class="facts">
        ${fact('Buy-in', def.buyIn.toLocaleString())}
        ${fact('Players', '6')}
        ${fact('Starting chips', T.START_STACK.toLocaleString())}
        ${fact('Blinds up', `every ${T.HANDS_PER_LEVEL} hands`)}
      </div>
      <div class="sheet-status">
        <span class="status-title">Online now</span>
        <div class="status-line"><span class="seat-faces">${seatsHtml(open ? open.seats : [], T.SEATS)}</span><span class="muted">${open ? `${open.count}/${T.SEATS} · ${startsIn(open)}` : ''}</span></div>
        ${inPlay.length || recent ? `<span class="muted small">${inPlay.length ? `${inPlay.length} in play` : ''}${inPlay.length && recent ? ' · ' : ''}${recent ? `Last won by ${esc(recent.winner)}` : ''}</span>` : ''}
      </div>
      <p class="sheet-fine">Online it starts when six have registered, or ${T.START_WAIT_MS / 1000} seconds after the second; a smaller field plays for prizes in proportion.</p>
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
  return `
    <div class="sheet-band theme-${game === 'holdem' ? 'holdem' : 'blackjack'}">
      <span class="tt-room">${game === 'holdem' ? "Texas Hold'em" : 'Blackjack'}</span>
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
        : '<button class="btn btn-block" id="hostBtn">Create a private table</button>'}
    </div>`;
}

function sheetHtml() {
  if (!sheet) return '';
  let inner = '';
  if (sheet.kind === 'tour') { const def = T.tournamentById(sheet.key); if (def) inner = tourSheet(def); }
  else if (sheet.kind === 'poker') { const t = ((S.pokerTables && S.pokerTables.tables) || []).find((x) => x.code === sheet.key); if (t) inner = pokerSheet(t); }
  else if (sheet.kind === 'bj') { const t = (S.lobbyTables || []).find((x) => x.code === sheet.key); if (t) inner = bjSheet(t); }
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

const PAGES = { home: homePage, blackjack: blackjackPage, holdem: holdemPage, tournaments: tournamentsPage, leaderboard: leaderboardPage };

export function renderHome() {
  const page = PAGES[S.lobbyGame] || homePage;
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
  const on = (id, fn) => { const el = document.getElementById(id); if (el) el.onclick = fn; };
  const all = (sel, fn) => document.querySelectorAll(sel).forEach(fn);

  all('[data-go]', (el) => {
    el.onclick = () => {
      go(el.dataset.go);
      if (el.dataset.openTour) openSheet({ kind: 'tour', key: el.dataset.openTour });
    };
  });
  on('signOutBtn', S.doSignOut);
  on('friendsBtn', () => S.goToScreen('friends'));
  on('characterBtn', () => S.goToScreen('character'));
  on('refreshLobbyBtn', () => { lastReload = Date.now(); S.loadLobby(); });

  on('playNowBtn', S.playNow);
  on('pokerNowBtn', Poker.playPokerNow);
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
  on('startBotsBtn', () => { const id = sheet && sheet.key; sheet = null; if (id) Offline.startTournament(id); });
  all('[data-register]', (el) => {
    el.onclick = async () => {
      el.disabled = true;
      const ok = await Poker.registerTournament(el.dataset.register);
      if (ok) sheet = null; else el.disabled = false;
    };
  });
  all('[data-open-poker]', (el) => { el.onclick = () => { sheet = null; Poker.openPokerTable(el.dataset.openPoker); }; });
  all('[data-join-table]', (el) => { el.onclick = () => { sheet = null; S.joinSpecificPublicTable(el.dataset.joinTable); }; });

  const code = document.getElementById('joinCode');
  const join = () => { if (code && code.value.trim()) { sheet = null; S.joinRoom(code.value); } };
  on('joinBtn', join);
  if (code) code.onkeydown = (e) => { if (e.key === 'Enter') join(); };
}
