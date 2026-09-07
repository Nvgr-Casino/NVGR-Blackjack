// Lobby: public tables shown as mini blackjack tables in a grid (seats
// drawn around each felt), plus a "create private table" tile, over a
// fixed player bar. Actions are unchanged from index4.html's renderHome.
import { MAX_PUBLIC_SEATS, avatarColor, initials, stakesLabel } from '../roomLogic.js';
import { feltTheme } from '../../scene/table.js';
import { brandMark, casinoMark, esc } from '../uiHelpers.js';
import * as S from '../session.js';
import * as Social from '../social.js';

const PHASE_LABEL = {
  betting: 'Betting open',
  playing: 'Hand in progress',
  dealer: 'Dealer playing',
  results: 'Between rounds',
};

function shortChips(n) {
  if (n >= 1000000) return (n / 1000000).toFixed(n % 1000000 ? 1 : 0) + 'M';
  if (n >= 1000) return (n / 1000).toFixed(n % 1000 ? 1 : 0) + 'K';
  return String(n);
}

function seatsHtml(seats) {
  const inner = Array.from({ length: MAX_PUBLIC_SEATS }).map((_, i) => {
    const p = seats[i];
    if (!p) return `<div class="mini-seat s${i}"><div class="mini-avatar empty"></div></div>`;
    return `
      <div class="mini-seat s${i} filled">
        <div class="mini-avatar" style="background:${avatarColor(p.name)};">${esc(initials(p.name))}</div>
        <div class="mini-chips">${shortChips(p.chips)}</div>
      </div>`;
  }).join('');
  return `<div class="mini-seats">${inner}</div>`;
}

function miniTable(inner, felt) {
  // The tile's cloth matches the real table's, so the lobby previews the
  // room you are about to sit at.
  const t = felt ? feltTheme(felt) : null;
  const style = t ? ` style="--felt-hi:${t.hi};--felt-lo:${t.lo};"` : '';
  return `
    <div class="mini-table">
      <div class="mini-felt"${style}>
        <span class="mini-legend">BLACKJACK PAYS 3 TO 2</span>
        <span class="mini-arc"></span>
      </div>
      ${inner}
    </div>`;
}

export function renderHome() {
  let gridHtml = '';
  if (S.lobbyLoading && !S.lobbyTables) {
    gridHtml = '<p class="hint">Loading tables…</p>';
  } else {
    const createTile = `
      <button class="table-tile tile-create" id="hostBtn">
        <div class="tile-badge ghost">Private</div>
        ${miniTable('<span class="create-label">Create a<br>private table</span>')}
        <div class="tile-foot">
          <div class="tile-info"><span class="tile-name">Your own table</span><span class="tile-meta">Invite friends by code</span></div>
          <span class="btn btn-ghost btn-small">Create</span>
        </div>
      </button>`;

    // The whole tile is the join target — clicking anywhere on a table
    // takes that seat, with the button left as the visual affordance.
    const tileHtml = (S.lobbyTables || []).map((t) => {
      const full = t.count >= MAX_PUBLIC_SEATS;
      return `
        <div class="table-tile ${full ? 'is-full' : 'is-joinable'}" ${full ? '' : `data-join-table="${esc(t.code)}"`}>
          <div class="tile-badge ${t.phase === 'betting' ? 'open' : ''}">${PHASE_LABEL[t.phase] || 'Open'}</div>
          <div class="tile-stakes">${stakesLabel(t.minBet || 100, t.maxBet || 2000)}</div>
          ${miniTable(seatsHtml(t.seats || []), t.felt)}
          <div class="tile-foot">
            <div class="tile-info"><span class="tile-name">Table ${esc(t.code)}</span><span class="tile-meta">${t.count}/${MAX_PUBLIC_SEATS} seated</span></div>
            <span class="btn ${full ? 'btn-ghost' : 'btn-solid'} btn-small">${full ? 'Full' : 'Join'}</span>
          </div>
        </div>`;
    }).join('');

    gridHtml = `<div class="lobby-grid">${createTile}${tileHtml}</div>`;
  }

  return `
    <div class="lobby-head">
      ${casinoMark('eyebrow')}
      <div class="brand-hero compact">${brandMark('lobby')}</div>
      <p class="subtitle">Pick a table, or start your own.</p>
    </div>
    ${S.formNotice ? '<p class="notice-text">' + esc(S.formNotice) + '</p>' : ''}
    ${S.formError ? '<p class="error-text" style="text-align:center;">' + esc(S.formError) + '</p>' : ''}

    <div class="lobby-actions">
      <button class="btn btn-solid" id="playNowBtn">Play now</button>
      <button class="btn btn-ghost" id="goJoinBtn">Join with a code</button>
      <button class="btn btn-ghost" id="refreshLobbyBtn">${S.lobbyLoading ? 'Refreshing…' : 'Refresh'}</button>
    </div>

    ${gridHtml}

    <p class="house-credit">Blackjack 21 — a <b>NVGR Casino</b> game · more tables coming soon</p>

    <div class="player-bar">
      <div class="pb-avatar" style="background:${avatarColor(S.session.name || '?')};">${esc(initials(S.session.name))}</div>
      <div class="pb-info">
        <span class="pb-name">${esc(S.session.name)}</span>
        <span class="pb-chips">${(S.session.chips || 0).toLocaleString()}</span>
      </div>
      <button class="btn btn-ghost btn-small pb-friends" id="friendsBtn">Friends${Social.badgeCount() ? ` <span class="pb-badge">${Social.badgeCount()}</span>` : ''}</button>
      <button id="signOutBtn">Sign out</button>
    </div>
  `;
}

export function attachHome() {
  // The create-table tile lives inside the grid, so it is absent while the
  // lobby is still loading — every handler here is bound defensively.
  const on = (id, fn) => { const el = document.getElementById(id); if (el) el.onclick = fn; };
  on('playNowBtn', S.playNow);
  on('hostBtn', S.createRoom);
  on('goJoinBtn', () => S.goToScreen('join'));
  on('signOutBtn', S.doSignOut);
  on('friendsBtn', () => S.goToScreen('friends'));
  on('refreshLobbyBtn', S.loadLobby);
  document.querySelectorAll('[data-join-table]').forEach((btn) => {
    btn.onclick = () => S.joinSpecificPublicTable(btn.getAttribute('data-join-table'));
  });
}
