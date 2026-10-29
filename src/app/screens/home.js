// The lobby: who you are, the three ways to sit down (play now, a code, or
// your own table), and the open tables as a plain list.
import { MAX_PUBLIC_SEATS, stakesLabel, roomName } from '../roomLogic.js';
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

function seatsHtml(seats) {
  return Array.from({ length: MAX_PUBLIC_SEATS }).map((_, i) => {
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

export function renderHome() {
  let listHtml;
  if (S.lobbyLoading && !S.lobbyTables) {
    listHtml = '<div class="empty-state">Loading tables…</div>';
  } else if (!S.lobbyTables || !S.lobbyTables.length) {
    listHtml = '<div class="empty-state">No open tables right now. Play now and one will be set up for you.</div>';
  } else {
    listHtml = `<ul class="table-list">${S.lobbyTables.map(tableRow).join('')}</ul>`;
  }
  const friendCount = Social.badgeCount();
  const portrait = characterPortraitDataURL(S.session.character || defaultCharacterFor(''), 128);

  return `
    <header class="nav">
      <div class="nav-brand">${brandMark('nav-logo')}<span class="nav-name">Blackjack 21</span></div>
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
          <h2>Open tables</h2>
          <button class="link" id="refreshLobbyBtn">${S.lobbyLoading ? 'Refreshing…' : 'Refresh'}</button>
        </div>
        ${listHtml}
      </section>

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
