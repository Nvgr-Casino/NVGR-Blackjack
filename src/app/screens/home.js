// The lobby: who you are, which game — blackjack or Texas Hold'em — then
// that game's ways to sit down (play now, a code, or your own table) and
// its open tables as a plain list.
import { MAX_PUBLIC_SEATS, stakesLabel, roomName, ROOM_NAMES } from '../roomLogic.js';
import { POKER_SEATS, POKER_STAKES, buyInRange } from '../../poker/rules.js';
import * as Poker from '../pokerSession.js';
import { startPractice } from '../offlinePoker.js';
import { feltTheme } from '../../scene/table.js';
import { characterPortraitDataURL, defaultCharacterFor } from '../../scene/character.js';
import { brandMark, esc } from '../uiHelpers.js';
import * as S from '../session.js';
import * as Social from '../social.js';

const PHASE_LABEL = {
  betting: 'Betting open',
  playing: 'Hand in progress',
  dealer: 'Dealer playing',
  results: 'Between rounds',
};

function seatsHtml(seats, total = MAX_PUBLIC_SEATS) {
  return Array.from({ length: total }).map((_, i) => {
    const p = seats[i];
    if (!p) return '<span class="tr-seat empty"></span>';
    return `<img class="tr-seat" src="${characterPortraitDataURL(p.character || defaultCharacterFor(p.name), 48)}" alt="${esc(p.name)}" title="${esc(p.name)}">`;
  }).join('');
}

function tableRow(t) {
  const full = t.count >= MAX_PUBLIC_SEATS;
  const felt = feltTheme(t.felt);
  const open = t.phase === 'betting';
  return `
    <li class="table-row ${full ? 'is-full' : ''}" ${full ? '' : `data-join-table="${esc(t.code)}" tabindex="0" role="button"`}>
      <span class="felt-swatch" style="background:linear-gradient(135deg, ${felt.hi}, ${felt.lo});"></span>
      <div class="tr-main">
        <span class="tr-name">${esc(roomName(t))} <span class="tr-code">${esc(t.code)}</span></span>
        <span class="tr-meta"><span class="${open ? 'live' : ''}">${PHASE_LABEL[t.phase] || 'Open'}</span> · ${stakesLabel(t.minBet || 100, t.maxBet || 2000)} · ${t.count}/${MAX_PUBLIC_SEATS} seated</span>
      </div>
      <div class="tr-seats">${seatsHtml(t.seats || [])}</div>
      <span class="btn btn-sm ${full ? '' : 'btn-primary'}">${full ? 'Full' : 'Join'}</span>
    </li>`;
}

const short = (n) => (n >= 1000 ? (n % 1000 ? (n / 1000).toFixed(1) : n / 1000) + 'K' : String(n));

function pokerRow(t) {
  const full = t.count >= POKER_SEATS;
  const felt = feltTheme(t.felt);
  const { min, max } = buyInRange(t);
  const status = t.playing ? 'Hand in progress' : t.count >= 2 ? 'Dealing soon' : 'Waiting for players';
  return `
    <li class="table-row ${full ? 'is-full' : ''}" data-open-poker="${esc(t.code)}" tabindex="0" role="button">
      <span class="felt-swatch" style="background:linear-gradient(135deg, ${felt.hi}, ${felt.lo});"></span>
      <div class="tr-main">
        <span class="tr-name">${esc(ROOM_NAMES[t.tier - 1])} <span class="tr-code">${esc(t.code)}</span></span>
        <span class="tr-meta"><span class="${t.playing ? 'live' : ''}">${status}</span> · Blinds ${short(t.sb)} / ${short(t.bb)} · Buy-in ${short(min)}–${short(max)} · ${t.count}/${POKER_SEATS}</span>
      </div>
      <div class="tr-seats">${seatsHtml(t.seats || [], POKER_SEATS)}</div>
      <span class="btn btn-sm ${full ? '' : 'btn-primary'}">${full ? 'Watch' : 'Sit down'}</span>
    </li>`;
}

// The game picker at the top of the lobby.
function gamePicker() {
  const game = (id, title, line) => `
    <button class="game-card ${S.lobbyGame === id ? 'active' : ''}" data-game="${id}" aria-pressed="${S.lobbyGame === id}">
      <span class="game-title">${title}</span>
      <span class="game-line">${line}</span>
    </button>`;
  return `
    <section class="game-picker" role="group" aria-label="Game">
      ${game('blackjack', 'Blackjack', 'Beat the dealer to 21 · 5 seats')}
      ${game('holdem', "Texas Hold'em", 'No-limit cash tables · 6 seats')}
    </section>`;
}

function holdemLobby() {
  const tables = S.pokerTables;
  const list = S.lobbyLoading && !tables
    ? '<div class="empty-state">Loading tables…</div>'
    : `<ul class="table-list">${(tables || []).map(pokerRow).join('')}</ul>`;
  const stakes = POKER_STAKES.map((st, i) => `<option value="${i}">${esc(ROOM_NAMES[i])} · ${short(st.sb)} / ${short(st.bb)}</option>`).join('');
  return `
      <section class="quick">
        <div class="panel quick-play">
          <button class="btn btn-primary btn-lg" id="pokerNowBtn">Play now</button>
          <p>Sits you down at the first table with a seat at stakes you can cover.</p>
        </div>
        <div class="panel quick-side">
          <div class="join-inline">
            <input id="joinCode" type="text" placeholder="Table code" maxlength="4" aria-label="Table code" autocomplete="off">
            <button class="btn" id="joinBtn">Join</button>
          </div>
          ${S.formError ? '<p class="error-text" style="margin:0;">' + esc(S.formError) + '</p>' : ''}
          <div class="join-inline">
            <select id="pokerStakes" aria-label="Stakes">${stakes}</select>
            <button class="btn btn-quiet" id="pokerHostBtn">Private table</button>
          </div>
        </div>
      </section>

      <section class="panel practice">
        <div class="practice-text">
          <span class="practice-title">Practice with bots</span>
          <span class="muted">Play now against computer players, no one else needed. Practice chips — your balance isn't touched.</span>
        </div>
        <div class="practice-controls">
          <select id="practiceStakes" aria-label="Practice stakes">${stakes}</select>
          <select id="practiceBots" aria-label="Number of bots">
            ${[1, 2, 3, 4, 5].map((n) => `<option value="${n}" ${n === 3 ? 'selected' : ''}>${n} bot${n > 1 ? 's' : ''}</option>`).join('')}
          </select>
          <button class="btn btn-primary" id="practiceBtn">Play with bots</button>
        </div>
      </section>

      <section class="section">
        <div class="section-head">
          <h2>Hold'em tables</h2>
          <button class="link" id="refreshLobbyBtn">${S.lobbyLoading ? 'Refreshing…' : 'Refresh'}</button>
        </div>
        ${list}
      </section>`;
}

function blackjackLobby() {
  let listHtml;
  if (S.lobbyLoading && !S.lobbyTables) {
    listHtml = '<div class="empty-state">Loading tables…</div>';
  } else if (!S.lobbyTables || !S.lobbyTables.length) {
    listHtml = '<div class="empty-state">No open tables right now. Play now and one will be set up for you.</div>';
  } else {
    listHtml = `<ul class="table-list">${S.lobbyTables.map(tableRow).join('')}</ul>`;
  }
  return `
      <section class="quick">
        <div class="panel quick-play">
          <button class="btn btn-primary btn-lg" id="playNowBtn">Play now</button>
          <p>Takes the first free seat at a public table.</p>
        </div>
        <div class="panel quick-side">
          <div class="join-inline">
            <input id="joinCode" type="text" placeholder="Table code" maxlength="4" aria-label="Table code" autocomplete="off">
            <button class="btn" id="joinBtn">Join</button>
          </div>
          ${S.formError ? '<p class="error-text" style="margin:0;">' + esc(S.formError) + '</p>' : ''}
          <button class="btn btn-quiet" id="hostBtn">Create a private table</button>
        </div>
      </section>

      <section class="section">
        <div class="section-head">
          <h2>Blackjack tables</h2>
          <button class="link" id="refreshLobbyBtn">${S.lobbyLoading ? 'Refreshing…' : 'Refresh'}</button>
        </div>
        ${listHtml}
      </section>`;
}

export function renderHome() {
  const friendCount = Social.badgeCount();
  const portrait = characterPortraitDataURL(S.session.character || defaultCharacterFor(''), 128);

  return `
    <header class="nav">
      <div class="nav-brand">${brandMark('nav-logo')}<span class="nav-name">NVGR Casino</span></div>
      <nav class="nav-links">
        <button class="nav-link" id="characterBtn">Character</button>
        <button class="nav-link" id="friendsBtn">Friends${friendCount ? ` <span class="count">${friendCount}</span>` : ''}</button>
        <button class="nav-link" id="signOutBtn">Sign out</button>
      </nav>
    </header>

    <main class="page">
      <section class="welcome">
        <img class="avatar-lg" src="${portrait}" alt="">
        <div>
          <h1 class="welcome-name">${esc(S.session.name)}</h1>
          <p class="balance"><span class="chip-dot"></span><b>${(S.session.chips || 0).toLocaleString()}</b> chips</p>
        </div>
      </section>

      ${S.formNotice ? '<p class="notice-text" style="margin-top:20px;">' + esc(S.formNotice) + '</p>' : ''}

      ${gamePicker()}
      ${S.lobbyGame === 'holdem' ? holdemLobby() : blackjackLobby()}

      <p class="house-credit">NVGR Casino</p>
    </main>
  `;
}

export function attachHome() {
  const on = (id, fn) => { const el = document.getElementById(id); if (el) el.onclick = fn; };
  on('playNowBtn', S.playNow);
  on('hostBtn', S.createRoom);
  on('signOutBtn', S.doSignOut);
  on('friendsBtn', () => S.goToScreen('friends'));
  on('characterBtn', () => S.goToScreen('character'));
  on('refreshLobbyBtn', S.loadLobby);
  on('pokerNowBtn', Poker.playPokerNow);
  on('practiceBtn', () => {
    const stakes = document.getElementById('practiceStakes');
    const bots = document.getElementById('practiceBots');
    startPractice(stakes ? Number(stakes.value) : 0, bots ? Number(bots.value) : 3);
  });
  on('pokerHostBtn', () => {
    const sel = document.getElementById('pokerStakes');
    Poker.createPokerTable(sel ? Number(sel.value) : 0);
  });
  document.querySelectorAll('[data-game]').forEach((btn) => {
    btn.onclick = () => { if (S.lobbyGame !== btn.dataset.game) S.setLobbyGame(btn.dataset.game); };
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
