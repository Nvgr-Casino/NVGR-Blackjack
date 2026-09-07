// Friends list, pending requests, and the direct-message thread.
import { avatarColor, initials, safeKey } from '../roomLogic.js';
import { brandMark, esc } from '../uiHelpers.js';
import * as S from '../session.js';
import * as Social from '../social.js';

function personRow(f) {
  const unread = Social.inbox[f.key];
  return `
    <div class="friend-row">
      <div class="avatar" style="width:36px;height:36px;font-size:13px;background:${avatarColor(f.name)};">${esc(initials(f.name))}</div>
      <div class="friend-info">
        <span class="friend-name">${esc(f.name)}</span>
        <span class="friend-status ${f.online ? 'on' : ''}">
          <i class="dot ${f.online ? 'on' : ''}"></i>${esc(Social.lastSeenLabel(f))}
        </span>
        ${unread ? `<span class="friend-preview">${esc(unread.preview)}</span>` : ''}
      </div>
      ${unread ? '<span class="unread-dot"></span>' : ''}
      <button class="btn btn-ghost btn-small" data-dm="${esc(f.key)}" data-dm-name="${esc(f.name)}">Message</button>
    </div>`;
}

export function renderFriends() {
  const reqHtml = Social.requests.length
    ? Social.requests.map((r) => `
        <div class="friend-row">
          <div class="avatar" style="width:36px;height:36px;font-size:13px;background:${avatarColor(r.name)};">${esc(initials(r.name))}</div>
          <div class="friend-info">
            <span class="friend-name">${esc(r.name)}</span>
            <span class="friend-status">wants to be friends</span>
          </div>
          <button class="btn btn-solid btn-small" data-accept="${esc(r.key)}" data-accept-name="${esc(r.name)}">Accept</button>
          <button class="btn btn-ghost btn-small" data-decline="${esc(r.key)}">Ignore</button>
        </div>`).join('')
    : '';

  const listHtml = Social.friends.length
    ? Social.friends.slice().sort((a, b) => (b.online ? 1 : 0) - (a.online ? 1 : 0)).map(personRow).join('')
    : '<p class="lobby-empty">No friends yet — tap a player at a table to send a request.</p>';

  return `
    <div class="brand-hero compact">${brandMark('lobby')}</div>
    <p class="subtitle">Friends</p>
    ${Social.socialNotice ? '<p class="notice-text">' + esc(Social.socialNotice) + '</p>' : ''}

    ${reqHtml ? `<div class="lobby-section-title">Requests</div><div class="friend-list">${reqHtml}</div>` : ''}

    <div class="lobby-section-title">Your friends</div>
    <div class="friend-list">${listHtml}</div>

    <div class="footer-link"><button id="friendsBackBtn">Back to tables</button></div>
  `;
}

export function attachFriends() {
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
  if (!who) return '<p class="hint">No conversation open.</p>';
  const friend = Social.friends.find((f) => f.key === who.key);
  const me = S.session.uid ? safeKey(S.session.uid) : null;
  const msgs = Social.dmMessages.length
    ? Social.dmMessages.map((m) => `
        <div class="dm-msg ${m.from === me ? 'mine' : ''}"><span class="dm-text">${esc(m.text)}</span></div>`).join('')
    : '<p class="chat-empty">No messages yet — say hello.</p>';

  return `
    <div class="dm-header">
      <button class="tbl-icon-btn" id="dmBackBtn">Back</button>
      <div class="dm-who">
        <span class="friend-name">${esc(who.name)}</span>
        <span class="friend-status ${friend && friend.online ? 'on' : ''}">
          <i class="dot ${friend && friend.online ? 'on' : ''}"></i>${esc(friend ? Social.lastSeenLabel(friend) : 'Offline')}
        </span>
      </div>
    </div>
    <div class="dm-log" id="dmLog">${msgs}</div>
    <div class="chat-input-row dm-input">
      <input type="text" id="dmInput" placeholder="Message ${esc(who.name)}…" maxlength="500">
      <button class="btn btn-solid btn-small" id="dmSendBtn">Send</button>
    </div>
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
