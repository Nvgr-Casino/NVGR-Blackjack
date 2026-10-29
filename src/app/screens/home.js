// The lobby. Top to bottom: who you are and where you stand, the three
// ways to play — Blackjack, Texas Hold'em, Tournaments — as large tiles,
// then the chosen one's tables beside the leaderboard. Each view leads with
// its one obvious action (Play now, Register) and keeps the rest a click
// away.
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

function seatsHtml(seats, total = MAX_PUBLIC_SEATS) {
  return Array.from({ length: total }).map((_, i) => {
    const p = seats[i];
    if (!p) return '<span class="tr-seat empty"></span>';
    return `<img class="tr-seat" src="${portrait(p.character, p.name)}" alt="${esc(p.name)}" title="${esc(p.name)}">`;
  }).join('');
}

// ---------- art for the game tiles ----------

const card = (x, y, rot, rank, suit, red) => `
  <g transform="rotate(${rot} ${x + 20} ${y + 28})">
    <rect x="${x}" y="${y}" width="40" height="56" rx="5" fill="#f6f1e7" stroke="#c8a46a" stroke-width="1.2"/>
    <text x="${x + 6}" y="${y + 15}" font-size="12" font-weight="700" font-family="Georgia, serif" fill="${red ? '#b3332e' : '#1b140b'}">${rank}</text>
    <text x="${x + 20}" y="${y + 38}" font-size="20" text-anchor="middle" font-family="Georgia, serif" fill="${red ? '#b3332e' : '#1b140b'}">${suit}</text>
  </g>`;
const chip = (x, y, fill) => `
  <ellipse cx="${x}" cy="${y}" rx="17" ry="6" fill="${fill}" stroke="#00000055"/>
  <ellipse cx="${x}" cy="${y}" rx="10" ry="3.4" fill="none" stroke="#f6f1e7aa" stroke-dasharray="3 2.4"/>`;
const ART = {
  blackjack: `<svg viewBox="0 0 120 84" aria-hidden="true">${card(28, 16, -14, 'A', '♠')}${card(54, 12, 9, 'K', '♥', true)}</svg>`,
  holdem: `<svg viewBox="0 0 120 84" aria-hidden="true">${card(16, 14, -10, 'Q', '♦', true)}${card(38, 12, 6, 'Q', '♣')}
    ${[0, 1, 2, 3].map((i) => chip(94, 66 - i * 6, ['#7c1f24', '#1f3d6b', '#7c1f24', '#c8a46a'][i])).join('')}</svg>`,
  tournaments: `<svg viewBox="0 0 120 84" aria-hidden="true">
    <defs><linearGradient id="gold" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#f3d79a"/><stop offset="1" stop-color="#a77c3a"/></linearGradient></defs>
    <path d="M42 12h36v14c0 14-8 24-18 24S42 40 42 26z" fill="url(#gold)"/>
    <path d="M42 18h-10c0 10 5 16 12 17M78 18h10c0 10-5 16-12 17" fill="none" stroke="#c8a46a" stroke-width="4" stroke-linecap="round"/>
    <rect x="56" y="49" width="8" height="12" fill="#a77c3a"/>
    <rect x="44" y="61" width="32" height="9" rx="2" fill="url(#gold)"/>
    <text x="60" y="34" font-size="13" text-anchor="middle" font-family="Georgia, serif" font-weight="700" fill="#5a3e14">1</text></svg>`,
};

// ---------- the top of the lobby ----------

function hero() {
  const uid = S.session.uid;
  const rich = Leaderboard.rankOf(uid, 'chips');
  const mine = (Leaderboard.entries || []).find((e) => e.key === safeKey(uid || ''));
  const hour = new Date().getHours();
  const greet = hour < 5 ? 'Good evening' : hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const featured = T.TOURNAMENTS.find((d) => d.featured);
  const chips = [
    rich ? `<span class="hero-tag">#${rich} on the leaderboard</span>` : '',
    mine && mine.wins ? `<span class="hero-tag">${mine.wins} tournament win${mine.wins > 1 ? 's' : ''}</span>` : '',
  ].join('');
  return `
    <section class="hero">
      <div class="hero-me">
        <img class="hero-avatar" src="${portrait(S.session.character, '', 128)}" alt="">
        <div class="hero-text">
          <span class="hero-greet">${greet},</span>
          <h1 class="hero-name">${esc(S.session.name)}</h1>
          <span class="hero-balance"><span class="chip-dot"></span><b>${(S.session.chips || 0).toLocaleString()}</b> chips</span>
          ${chips ? `<div class="hero-tags">${chips}</div>` : ''}
        </div>
      </div>
      ${featured ? `
      <button class="hero-feature" data-game="tournaments">
        <span class="hf-kicker">Featured tournament</span>
        <span class="hf-name">${esc(featured.name)}</span>
        <span class="hf-prize">${featured.prizes[0].toLocaleString()}</span>
        <span class="hf-line">to the winner · ${short(featured.buyIn)} buy-in</span>
        <span class="hf-go">See tournaments →</span>
      </button>` : ''}
    </section>`;
}

function gameTiles() {
  const pt = S.pokerTables;
  const registered = pt && pt.tournaments ? pt.tournaments.filter((t) => t.status === 'registering').reduce((n, t) => n + t.count, 0) : null;
  const tiles = [
    ['blackjack', 'Blackjack', 'Beat the dealer to 21', S.lobbyTables ? `${S.lobbyTables.length} tables open` : '5 seats a table'],
    ['holdem', "Texas Hold'em", 'No-limit cash games & practice', pt && pt.tables ? `${pt.tables.length} tables · blinds ${short(POKER_STAKES[0].sb)} to ${short(POKER_STAKES[POKER_STAKES.length - 1].bb)}` : '6 seats a table'],
    ['tournaments', 'Tournaments', 'Sit & Go — top three paid', registered ? `${registered} registered now` : `Up to ${short(T.TOURNAMENTS[T.TOURNAMENTS.length - 1].prizes[0])} to the winner`],
  ];
  return `
    <nav class="game-tiles" aria-label="Games">
      ${tiles.map(([id, title, line, meta]) => `
        <button class="game-tile ${S.lobbyGame === id ? 'active' : ''}" data-game="${id}" aria-pressed="${S.lobbyGame === id}">
          <span class="gt-art">${ART[id]}</span>
          <span class="gt-text">
            <span class="gt-title">${title}</span>
            <span class="gt-line">${line}</span>
            <span class="gt-meta">${meta}</span>
          </span>
        </button>`).join('')}
    </nav>`;
}

// ---------- blackjack ----------

function tableRow(t) {
  const full = t.count >= MAX_PUBLIC_SEATS;
  const felt = feltTheme(t.felt);
  const open = t.phase === 'betting';
  return `
    <li class="table-row ${full ? 'is-full' : ''}" ${full ? '' : `data-join-table="${esc(t.code)}" tabindex="0" role="button"`}>
      <span class="felt-swatch" style="background:radial-gradient(circle at 35% 30%, ${felt.hi}, ${felt.lo});"></span>
      <div class="tr-main">
        <span class="tr-name">${esc(roomName(t))} <span class="tr-code">${esc(t.code)}</span></span>
        <span class="tr-meta"><span class="${open ? 'live' : ''}">${PHASE_LABEL[t.phase] || 'Open'}</span> · ${stakesLabel(t.minBet || 100, t.maxBet || 2000)} · ${t.count}/${MAX_PUBLIC_SEATS} seated</span>
      </div>
      <div class="tr-seats">${seatsHtml(t.seats || [])}</div>
      <span class="btn btn-sm ${full ? '' : 'btn-primary'}">${full ? 'Full' : 'Join'}</span>
    </li>`;
}

function actionBar({ playId, playLine, extra }) {
  return `
    <section class="action-bar">
      <div class="ab-play">
        <button class="btn btn-primary btn-lg" id="${playId}">Play now</button>
        <span class="muted">${playLine}</span>
      </div>
      <div class="ab-side">
        <div class="join-inline">
          <input id="joinCode" type="text" placeholder="Table code" maxlength="4" aria-label="Table code" autocomplete="off">
          <button class="btn" id="joinBtn">Join</button>
        </div>
        ${extra}
      </div>
    </section>
    ${S.formError ? '<p class="error-text lobby-error">' + esc(S.formError) + '</p>' : ''}`;
}

function blackjackLobby() {
  let listHtml;
  if (S.lobbyLoading && !S.lobbyTables) listHtml = '<div class="empty-state">Loading tables…</div>';
  else if (!S.lobbyTables || !S.lobbyTables.length) listHtml = '<div class="empty-state">No open tables right now. Play now and one will be set up for you.</div>';
  else listHtml = `<ul class="table-list">${S.lobbyTables.map(tableRow).join('')}</ul>`;
  return `
    ${actionBar({ playId: 'playNowBtn', playLine: 'Takes the first free seat at a public table.', extra: '<button class="btn btn-quiet" id="hostBtn">Create a private table</button>' })}
    <section class="section">
      <div class="section-head">
        <h2>Blackjack tables</h2>
        <button class="link" id="refreshLobbyBtn">${S.lobbyLoading ? 'Refreshing…' : 'Refresh'}</button>
      </div>
      ${listHtml}
    </section>`;
}

// ---------- Hold'em ----------

function pokerRow(t) {
  const full = t.count >= POKER_SEATS;
  const felt = feltTheme(t.felt);
  const { min, max } = buyInRange(t);
  const status = t.playing ? 'Hand in progress' : t.count >= 2 ? 'Dealing soon' : 'Waiting for players';
  return `
    <li class="table-row ${full ? 'is-full' : ''}" data-open-poker="${esc(t.code)}" tabindex="0" role="button">
      <span class="felt-swatch" style="background:radial-gradient(circle at 35% 30%, ${felt.hi}, ${felt.lo});"></span>
      <div class="tr-main">
        <span class="tr-name">${esc(ROOM_NAMES[t.tier - 1])} <span class="tr-code">${esc(t.code)}</span></span>
        <span class="tr-meta"><span class="${t.playing ? 'live' : ''}">${status}</span> · Blinds ${short(t.sb)} / ${short(t.bb)} · Buy-in ${short(min)}–${short(max)} · ${t.count}/${POKER_SEATS}</span>
      </div>
      <div class="tr-seats">${seatsHtml(t.seats || [], POKER_SEATS)}</div>
      <span class="btn btn-sm ${full ? '' : 'btn-primary'}">${full ? 'Watch' : 'Sit down'}</span>
    </li>`;
}

function holdemLobby() {
  const tables = S.pokerTables && S.pokerTables.tables;
  const list = S.lobbyLoading && !tables
    ? '<div class="empty-state">Loading tables…</div>'
    : `<ul class="table-list">${(tables || []).map(pokerRow).join('')}</ul>`;
  const stakes = POKER_STAKES.map((st, i) => `<option value="${i}">${esc(ROOM_NAMES[i])} · ${short(st.sb)} / ${short(st.bb)}</option>`).join('');
  return `
    ${actionBar({
      playId: 'pokerNowBtn',
      playLine: 'Sits you down at the first table with a seat at stakes you can cover.',
      extra: `<div class="join-inline"><select id="pokerStakes" aria-label="Stakes">${stakes}</select><button class="btn btn-quiet" id="pokerHostBtn">Private table</button></div>`,
    })}
    <section class="practice">
      <div class="practice-text">
        <span class="practice-title">Practice with bots</span>
        <span class="muted">Play now against computer players, no one else needed. Practice chips — your balance isn't touched.</span>
      </div>
      <div class="practice-controls">
        <select id="practiceStakes" aria-label="Practice stakes">${stakes}</select>
        <select id="practiceBots" aria-label="Number of bots">
          ${[1, 2, 3, 4, 5].map((n) => `<option value="${n}" ${n === 3 ? 'selected' : ''}>${n} bot${n > 1 ? 's' : ''}</option>`).join('')}
        </select>
        <button class="btn" id="practiceBtn">Play with bots</button>
      </div>
    </section>
    <section class="section">
      <div class="section-head">
        <h2>Cash tables</h2>
        <button class="link" id="refreshLobbyBtn">${S.lobbyLoading ? 'Refreshing…' : 'Refresh'}</button>
      </div>
      ${list}
    </section>`;
}

// ---------- tournaments ----------

function startsIn(t) {
  if (t.count < 2 || !t.startsAt) return t.count ? 'Waiting for a second player' : 'Be the first to register';
  return `<span data-starts-at="${t.startsAt}">${clock(t.startsAt)}</span>`;
}
function clock(at) {
  const secs = Math.max(0, Math.ceil((at - Date.now()) / 1000));
  return secs ? `Starts in ${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}` : 'Starting…';
}

function tournamentCard(def) {
  const list = (S.pokerTables && S.pokerTables.tournaments) || [];
  const open = list.find((t) => t.id === def.id && t.status === 'registering');
  const inPlay = list.filter((t) => t.id === def.id && t.status === 'running');
  const mineAt = list.find((t) => t.id === def.id && t.mine && t.status !== 'finished');
  const recent = list.filter((t) => t.id === def.id && t.status === 'finished' && t.winner).slice(-1)[0];
  const afford = S.session.chips >= def.buyIn;
  const sky = def.tier === 5 ? ` style="--sky:url('${SKYLINE}')"` : '';
  let online;
  if (mineAt) online = `<button class="btn btn-primary" data-open-poker="${esc(mineAt.code)}">Return to your table</button>`;
  else if (open) online = `<button class="btn btn-primary" data-register="${esc(open.code)}" ${afford ? '' : 'disabled'}>Register online</button>`;
  else online = '<button class="btn btn-primary" disabled>Opening…</button>';
  return `
    <article class="tour-card tier-${def.tier} ${def.featured ? 'featured' : ''}"${sky}>
      <div class="tc-band">
        <span class="tc-room">${esc(ROOM_NAMES[def.tier - 1])}</span>
        ${def.featured ? '<span class="tc-ribbon">Featured</span>' : ''}
        <h3 class="tc-name">${esc(def.name)}</h3>
      </div>
      <div class="tc-body">
        <div class="tc-prize"><span class="tc-label">1st prize</span><span class="tc-amount">${def.prizes[0].toLocaleString()}</span></div>
        <div class="tc-payouts">
          <span><b>2nd</b> ${short(def.prizes[1])}</span>
          <span><b>3rd</b> ${short(def.prizes[2])}</span>
          <span class="tc-buyin"><b>Buy-in</b> ${def.buyIn.toLocaleString()}</span>
        </div>
        <div class="tc-status">
          <div class="tr-seats">${seatsHtml(open ? open.seats : [], T.SEATS)}</div>
          <span class="muted">${open ? `${open.count}/${T.SEATS} · ${startsIn(open)}` : ''}${inPlay.length ? ` · ${inPlay.length} in play` : ''}</span>
        </div>
        ${recent ? `<p class="tc-recent">Last won by <b>${esc(recent.winner)}</b></p>` : ''}
        <div class="tc-actions">
          ${online}
          <button class="btn" data-bots="${def.id}" ${afford ? '' : 'disabled'}>Play vs bots</button>
        </div>
        ${afford ? '' : `<p class="tc-short">You need ${def.buyIn.toLocaleString()} to enter.</p>`}
      </div>
    </article>`;
}

function tournamentsLobby() {
  const loading = S.lobbyLoading && !(S.pokerTables && S.pokerTables.tournaments);
  return `
    ${S.formError ? '<p class="error-text lobby-error">' + esc(S.formError) + '</p>' : ''}
    <section class="section first">
      <div class="section-head">
        <h2>Sit &amp; Go tournaments</h2>
        <button class="link" id="refreshLobbyBtn">${S.lobbyLoading ? 'Refreshing…' : 'Refresh'}</button>
      </div>
      <p class="section-intro">Six players, ${T.START_STACK.toLocaleString()} chips each, blinds up every ${T.HANDS_PER_LEVEL} hands. Last one standing takes first prize; second and third are paid too. Online it starts when six have registered, or ${T.START_WAIT_MS / 1000} seconds after the second — or take on five bots right now.</p>
      ${loading ? '<div class="empty-state">Loading tournaments…</div>' : `<div class="tour-grid">${T.TOURNAMENTS.filter((d) => d.featured).concat(T.TOURNAMENTS.filter((d) => !d.featured)).map(tournamentCard).join('')}</div>`}
    </section>`;
}

// ---------- the leaderboard ----------

let boardBy = (() => { try { return localStorage.getItem('nvgr-board') || 'chips'; } catch { return 'chips'; } })();

function leaderboard() {
  const list = Leaderboard.ranked(boardBy);
  const myKey = safeKey(S.session.uid || '');
  const top = list.slice(0, 10);
  const myIndex = list.findIndex((e) => e.key === myKey);
  const row = (e, i) => `
    <li class="lb-row ${e.key === myKey ? 'me' : ''}">
      <span class="lb-rank ${i < 3 ? 'medal m' + (i + 1) : ''}">${i + 1}</span>
      <img class="lb-avatar" src="${portrait(e.character, e.key, 48)}" alt="">
      <span class="lb-name">${esc(e.name)}${boardBy === 'winnings' && e.wins ? ` <span class="lb-wins">${e.wins} win${e.wins > 1 ? 's' : ''}</span>` : ''}</span>
      <span class="lb-value">${short(boardBy === 'winnings' ? e.winnings : e.chips)}</span>
    </li>`;
  let body;
  if (!Leaderboard.entries) body = '<p class="lb-empty">Loading…</p>';
  else if (!list.length) body = `<p class="lb-empty">${boardBy === 'winnings' ? 'No tournament winners yet — be the first.' : 'Nobody on the board yet.'}</p>`;
  else body = `<ol class="lb-list">${top.map(row).join('')}${myIndex >= 10 ? '<li class="lb-gap">⋯</li>' + row(list[myIndex], myIndex) : ''}</ol>`;
  return `
    <aside class="board">
      <div class="board-head">
        <h2>Leaderboard</h2>
        <div class="segmented board-tabs" role="tablist">
          <button class="seg ${boardBy === 'chips' ? 'active' : ''}" data-board="chips" role="tab" aria-selected="${boardBy === 'chips'}">Richest</button>
          <button class="seg ${boardBy === 'winnings' ? 'active' : ''}" data-board="winnings" role="tab" aria-selected="${boardBy === 'winnings'}">Tournaments</button>
        </div>
      </div>
      ${body}
    </aside>`;
}

// ---------- the page ----------

export function renderHome() {
  const friendCount = Social.badgeCount();
  const view = S.lobbyGame === 'tournaments' ? tournamentsLobby() : S.lobbyGame === 'holdem' ? holdemLobby() : blackjackLobby();
  return `
    <header class="nav">
      <div class="nav-brand">${brandMark('nav-logo')}<span class="nav-name">NVGR Casino</span></div>
      <nav class="nav-links">
        <button class="nav-link" id="characterBtn">Character</button>
        <button class="nav-link" id="friendsBtn">Friends${friendCount ? ` <span class="count">${friendCount}</span>` : ''}</button>
        <button class="nav-link" id="signOutBtn">Sign out</button>
      </nav>
    </header>

    <main class="page lobby">
      ${hero()}
      ${S.formNotice ? '<p class="notice-text" style="margin-top:20px;">' + esc(S.formNotice) + '</p>' : ''}
      ${gameTiles()}
      <div class="lobby-grid">
        <div class="lobby-main">${view}</div>
        ${leaderboard()}
      </div>
      <footer class="house-credit">${brandMark('credit-logo')}<span>NVGR Casino</span></footer>
    </main>
  `;
}

// The tournament lobby keeps itself current while it is open: the
// countdowns every second, the tables every fifteen.
let clockTimer = null;
let lastReload = 0;
function keepCurrent() {
  if (clockTimer) return;
  clockTimer = setInterval(() => {
    if (S.session.screen !== 'home' || S.lobbyGame !== 'tournaments') return;
    document.querySelectorAll('[data-starts-at]').forEach((el) => { el.textContent = clock(Number(el.dataset.startsAt)); });
    if (Date.now() - lastReload > 15000 && !S.lobbyLoading) { lastReload = Date.now(); S.loadLobby(); }
  }, 1000);
}

export function attachHome() {
  keepCurrent();
  const on = (id, fn) => { const el = document.getElementById(id); if (el) el.onclick = fn; };
  on('playNowBtn', S.playNow);
  on('hostBtn', S.createRoom);
  on('signOutBtn', S.doSignOut);
  on('friendsBtn', () => S.goToScreen('friends'));
  on('characterBtn', () => S.goToScreen('character'));
  on('refreshLobbyBtn', () => { lastReload = Date.now(); S.loadLobby(); });
  on('pokerNowBtn', Poker.playPokerNow);
  on('practiceBtn', () => {
    const stakes = document.getElementById('practiceStakes');
    const bots = document.getElementById('practiceBots');
    Offline.startPractice(stakes ? Number(stakes.value) : 0, bots ? Number(bots.value) : 3);
  });
  on('pokerHostBtn', () => {
    const sel = document.getElementById('pokerStakes');
    Poker.createPokerTable(sel ? Number(sel.value) : 0);
  });
  document.querySelectorAll('[data-game]').forEach((btn) => {
    btn.onclick = () => {
      if (S.lobbyGame !== btn.dataset.game) S.setLobbyGame(btn.dataset.game);
      if (btn.classList.contains('hero-feature')) document.querySelector('.game-tiles')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };
  });
  document.querySelectorAll('[data-board]').forEach((btn) => {
    btn.onclick = () => {
      boardBy = btn.dataset.board;
      try { localStorage.setItem('nvgr-board', boardBy); } catch { /* private mode */ }
      S.refresh();
    };
  });
  document.querySelectorAll('[data-register]').forEach((btn) => {
    btn.onclick = async () => { btn.disabled = true; if (!(await Poker.registerTournament(btn.dataset.register))) btn.disabled = false; };
  });
  document.querySelectorAll('[data-bots]').forEach((btn) => {
    btn.onclick = () => {
      const def = T.tournamentById(btn.dataset.bots);
      if (def && window.confirm(`${def.name} against five bots: ${def.buyIn.toLocaleString()} from your balance, ${def.prizes[0].toLocaleString()} to the winner. Leaving before the end forfeits your seat. Start?`)) Offline.startTournament(def.id);
    };
  });
  document.querySelectorAll('[data-open-poker]').forEach((row) => {
    const go = () => Poker.openPokerTable(row.getAttribute('data-open-poker'));
    row.onclick = go;
    row.onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } };
  });

  const code = document.getElementById('joinCode');
  const join = () => { if (code && code.value.trim()) S.joinRoom(code.value); };
  on('joinBtn', join);
  if (code) code.onkeydown = (e) => { if (e.key === 'Enter') join(); };

  document.querySelectorAll('[data-join-table]').forEach((row) => {
    const go = () => S.joinSpecificPublicTable(row.getAttribute('data-join-table'));
    row.onclick = go;
    row.onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } };
  });
}
