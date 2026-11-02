// Friends list, pending requests, and the direct-message thread.
import { avatarColor, initials, safeKey } from '../roomLogic.js';
import { backBar, esc } from '../uiHelpers.js';
import * as S from '../session.js';
import * as Social from '../social.js';

function initialsDisc(name) {
  return `<div class="initials" style="background:${avatarColor(name)};">${esc(initials(name))}</div>`;
}

function personRow(f) {
  const unread = Social.inbox[f.key];
  return `
    <div class="person">
      ${initialsDisc(f.name)}
      <div class="person-info">
        <span class="person-name">${esc(f.name)}</span>
        <span class="person-status ${f.online ? 'on' : ''}"><i class="dot ${f.online ? 'on' : ''}"></i>${esc(Social.lastSeenLabel(f))}</span>
        ${unread ? `<span class="person-preview">${esc(unread.preview)}</span>` : ''}
      </div>
      ${unread ? '<span class="unread-dot"></span>' : ''}
      <button class="btn btn-sm" data-dm="${esc(f.key)}" data-dm-name="${esc(f.name)}">Message</button>
    </div>`;
}

// ---------- finding a player ----------
let findQuery = '';
let findResults = [];

// A player to add: their state with you as the button — Add, Sent, Accept
// (they asked first), or Friends.
function findRow(p) {
  let action;
  if (Social.isFriend(p.key)) action = '<span class="person-status on">Friends</span>';
  else if (Social.requestPending(p.key)) action = `<button class="btn btn-sm btn-primary" data-add="${esc(p.key)}" data-add-name="${esc(p.name)}">Accept</button>`;
  else if (Social.requestSent(p.key)) action = '<span class="person-status">Request sent</span>';
  else action = `<button class="btn btn-sm btn-primary" data-add="${esc(p.key)}" data-add-name="${esc(p.name)}">Add friend</button>`;
  return `
    <div class="person">
      ${initialsDisc(p.name)}
      <div class="person-info">
        <span class="person-name">${esc(p.name)}</span>
        ${p.online !== undefined ? `<span class="person-status ${p.online ? 'on' : ''}"><i class="dot ${p.online ? 'on' : ''}"></i>${p.online ? 'Online' : 'Offline'}</span>` : ''}
      </div>
      ${action}
    </div>`;
}
function findHtml() {
  if (findQuery.trim().length < 2) return '';
  if (!findResults.length) return '<div class="empty-state">No player by that name.</div>';
  return findResults.map(findRow).join('');
}
function attachAdd() {
  document.querySelectorAll('[data-add]').forEach((b) => {
    b.onclick = async () => {
      b.disabled = true;
      try { await Social.sendFriendRequest(b.dataset.add, b.dataset.addName); } catch { b.disabled = false; return; }
      S.refresh();
    };
  });
}

export function renderFriends() {
  const reqHtml = Social.requests.map((r) => `
    <div class="person">
      ${initialsDisc(r.name)}
      <div class="person-info">
        <span class="person-name">${esc(r.name)}</span>
        <span class="person-status">Wants to be friends</span>
      </div>
      <button class="btn btn-sm btn-primary" data-accept="${esc(r.key)}" data-accept-name="${esc(r.name)}">Accept</button>
      <button class="btn btn-sm btn-quiet" data-decline="${esc(r.key)}">Ignore</button>
    </div>`).join('');

  const listHtml = Social.friends.length
    ? Social.friends.slice().sort((a, b) => (b.online ? 1 : 0) - (a.online ? 1 : 0)).map(personRow).join('')
    : '<div class="empty-state">No friends yet. Find a player above by name, or tap a player\'s face at a table.</div>';

  const recent = Social.recentPlayers().slice(0, 8);
  const recentHtml = recent.length ? `
      <div class="section-head"><h2>Played with recently</h2></div>
      <div class="person-list">${recent.map((p) => findRow(p)).join('')}</div>
      <div class="section"></div>` : '';

  return `
    ${backBar('friendsBackBtn', 'Friends')}
    <main class="page page-narrow">
      <div class="page-head"><h1>Friends</h1></div>
      ${Social.socialNotice ? '<p class="notice-text">' + esc(Social.socialNotice) + '</p>' : ''}
      ${reqHtml ? `<div class="section-head"><h2>Requests</h2></div><div class="person-list">${reqHtml}</div><div class="section"></div>` : ''}
      <div class="section-head"><h2>Find a player</h2></div>
      <div class="compose find-player">
        <input type="search" id="findPlayerInput" placeholder="Their name" maxlength="40" value="${esc(findQuery)}" autocomplete="off">
      </div>
      <div class="person-list" id="findResults">${findHtml()}</div>
      <div class="section"></div>
      ${recentHtml}
      <div class="section-head"><h2>Your friends</h2></div>
      <div class="person-list">${listHtml}</div>
    </main>
  `;
}

export function attachFriends() {
  const input = document.getElementById('findPlayerInput');
  if (input) {
    let timer = null;
    input.oninput = () => {
      findQuery = input.value;
      clearTimeout(timer);
      timer = setTimeout(async () => {
        findResults = await Social.findPlayers(findQuery).catch(() => []);
        const box = document.getElementById('findResults');
        if (box) { box.innerHTML = findHtml(); attachAdd(); }
      }, 250);
    };
  }
  attachAdd();
  const back = document.getElementById('friendsBackBtn');
  if (back) back.onclick = () => S.goToScreen('home');
  document.querySelectorAll('[data-accept]').forEach((b) => {
    b.onclick = () => Social.acceptRequest(b.getAttribute('data-accept'), b.getAttribute('data-accept-name'));
  });
  document.querySelectorAll('[data-decline]').forEach((b) => {
    b.onclick = () => Social.declineRequest(b.getAttribute('data-decline'));
  });
  document.querySelectorAll('[data-dm]').forEach((b) => {
    b.onclick = () => Social.openDm(b.getAttribute('data-dm'), b.getAttribute('data-dm-name'));
  });
}

export function renderDm() {
  const who = Social.dmWith;
  if (!who) return '<p class="chat-empty">No conversation open.</p>';
  const friend = Social.friends.find((f) => f.key === who.key);
  const me = S.session.uid ? safeKey(S.session.uid) : null;
  const msgs = Social.dmMessages.length
    ? Social.dmMessages.map((m) => `
        <div class="dm-msg ${m.from === me ? 'mine' : ''}"><span class="dm-text">${esc(m.text)}</span></div>`).join('')
    : '<p class="chat-empty">No messages yet. Say hello.</p>';
  const online = friend && friend.online;

  return `
    <header class="nav">
      <div class="nav-brand">
        <button class="nav-link nav-back" id="dmBackBtn">← Friends</button>
        <div style="display:flex;flex-direction:column;line-height:1.25;">
          <span class="nav-title">${esc(who.name)}</span>
          <span class="person-status ${online ? 'on' : ''}"><i class="dot ${online ? 'on' : ''}"></i>${esc(friend ? Social.lastSeenLabel(friend) : 'Offline')}</span>
        </div>
      </div>
    </header>
    <main class="page page-narrow">
      <div class="dm-log" id="dmLog">${msgs}</div>
      <div class="compose">
        <input type="text" id="dmInput" placeholder="Message ${esc(who.name)}" maxlength="500">
        <button class="btn btn-primary" id="dmSendBtn">Send</button>
      </div>
    </main>
  `;
}

export function attachDm() {
  const back = document.getElementById('dmBackBtn');
  if (back) back.onclick = () => Social.closeDm();
  const input = document.getElementById('dmInput');
  const send = document.getElementById('dmSendBtn');
  if (input && send) {
    const submit = () => { const v = input.value; input.value = ''; Social.sendDm(v); };
    send.onclick = submit;
    input.onkeydown = (e) => { if (e.key === 'Enter') submit(); };
  }
  const log = document.getElementById('dmLog');
  if (log) log.scrollTop = log.scrollHeight;
}
