// Friends and messages: one framed panel with tabs — Friends, Messages,
// Find players, Requests. Friends lists everyone down the left (picture,
// level, when last here) with the chosen friend's profile on the right:
// picture, level, biggest win, the numbers, and round actions (Message,
// Remove). Messages lists conversations down the left with the chat on
// the right: bubbles and a Send bar. Find looks a player up by name;
// Requests answers the ones waiting.
import { avatarColor, initials, safeKey } from '../roomLogic.js';
import { esc } from '../uiHelpers.js';
import * as S from '../session.js';
import * as Social from '../social.js';
import * as P from '../progress.js';
import { openProfile } from './profile.js';

let tab = 'friends';
let selected = null;           // friend key shown on the Friends tab
let findQuery = '';
let findResults = [];
const profiles = new Map();    // key -> profile (or 'loading' / null)

const fmt = (n) => Math.round(n || 0).toLocaleString();
const short = (n) => n >= 1e6 ? `${+(n / 1e6).toFixed(1)}M` : n >= 1e4 ? `${Math.round(n / 1e3)}K` : fmt(n);
const date = (t) => t ? new Date(t).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
function ago(t) {
  if (!t) return '';
  const m = Math.floor((Date.now() - t) / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return d < 30 ? `${d}d ago` : `${Math.floor(d / 30)}mo ago`;
}

function profileOf(key) {
  if (!profiles.has(key)) {
    profiles.set(key, 'loading');
    P.loadProfile(key).then((p) => { profiles.set(key, p || null); S.refresh(); }).catch(() => profiles.set(key, null));
  }
  const p = profiles.get(key);
  return p && p !== 'loading' ? p : null;
}
function face(key, name, cls = '') {
  const p = key ? profileOf(key) : null;
  if (p && p.photo) return `<span class="fh-face ${cls}"><img src="${esc(p.photo)}" alt=""></span>`;
  return `<span class="fh-face ${cls}" style="background:${avatarColor(name || '?')}">${esc(initials(name || '?'))}</span>`;
}

const ICONS = {
  message: '<path d="M4 6h16v10H8l-4 3z"/>',
  remove: '<circle cx="10" cy="8" r="3.4"/><path d="M3.5 19c.6-3.4 3.2-5.3 6.5-5.3s5.9 1.9 6.5 5.3M16 11h5"/>',
  profile: '<circle cx="12" cy="8.5" r="3.6"/><path d="M5 20c.7-3.8 3.6-6 7-6s6.3 2.2 7 6"/>',
  add: '<circle cx="10" cy="8" r="3.4"/><path d="M3.5 19c.6-3.4 3.2-5.3 6.5-5.3s5.9 1.9 6.5 5.3M18.5 8v6M15.5 11h6"/>',
  back: '<path d="M15 5l-7 7 7 7"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
};
const icon = (k) => `<svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[k]}</svg>`;

// ---------- Friends ----------
function friendsSorted() {
  return Social.friends.slice().sort((a, b) => (b.online ? 1 : 0) - (a.online ? 1 : 0) || (b.lastSeen || 0) - (a.lastSeen || 0));
}
function friendsTab() {
  const list = friendsSorted();
  if (!list.length) return `<div class="fh-empty">No friends yet.<br><button class="fh-link" data-tab="find">Find players by name</button></div>`;
  if (!selected || !list.some((f) => f.key === selected)) selected = list[0].key;
  const rows = list.map((f) => {
    const p = profileOf(f.key);
    return `<button class="fh-row ${f.key === selected ? 'on' : ''}" data-sel="${esc(f.key)}">
      ${face(f.key, f.name)}
      <span class="fh-row-text"><b>${esc(f.name)}</b><small>${p && p.level ? `Level ${p.level} · ` : ''}<span class="${f.online ? 'fh-on' : ''}">${esc(Social.lastSeenLabel(f))}</span></small></span>
      ${Social.inbox[f.key] ? '<i class="fh-dot" aria-label="Unread message"></i>' : ''}
    </button>`;
  }).join('');
  const f = list.find((x) => x.key === selected);
  const p = profileOf(f.key) || {};
  const detail = `
    <div class="fh-detail">
      <div class="fh-who">
        ${face(f.key, f.name, 'lg')}
        <div class="fh-who-text">
          <b>${esc(f.name)}</b>
          <span class="fh-lvl">Level ${p.level || 1}</span>
          <span class="${f.online ? 'fh-on' : 'fh-off'}"><i></i>${f.online ? 'Online now' : 'Last seen ' + esc(Social.lastSeenLabel(f).replace(/^Offline$/, 'a while ago'))}</span>
        </div>
        <div class="fh-win"><small>Biggest win</small><img src="${import.meta.env.BASE_URL}assets/ui/chips-stack.webp" alt=""><span>${fmt(p.biggestWin)}</span></div>
        <dl class="fh-facts">
          <div><dt>Games played</dt><dd>${fmt(p.gamesPlayed)}</dd></div>
          <div><dt>Biggest win</dt><dd>${short(p.biggestWin || 0)}</dd></div>
          <div><dt>Playing since</dt><dd>${date(p.joinedAt)}</dd></div>
          <div><dt>Favourite</dt><dd>${esc(P.GAME_NAMES[p.favGame] || '—')}</dd></div>
        </dl>
      </div>
      <div class="fh-actions">
        <button class="fh-act" data-msg="${esc(f.key)}" data-msg-name="${esc(f.name)}">${icon('message')}<span>Message</span></button>
        <button class="fh-act" data-prof="${esc(f.key)}" data-prof-name="${esc(f.name)}">${icon('profile')}<span>Profile</span></button>
        <button class="fh-act" data-remove="${esc(f.key)}" data-remove-name="${esc(f.name)}">${icon('remove')}<span>Remove</span></button>
      </div>
    </div>`;
  return `<div class="fh-split"><div class="fh-list">${rows}</div>${detail}</div>`;
}

// ---------- Messages ----------
function conversations() {
  const keys = new Set([...Object.keys(Social.inbox || {}), ...Social.friends.map((f) => f.key)]);
  return [...keys].map((k) => {
    const f = Social.friends.find((x) => x.key === k);
    const m = (Social.inbox || {})[k];
    return { key: k, name: (m && m.name) || (f && f.name) || 'Player', at: (m && m.at) || 0, preview: m && m.preview, unread: !!m, online: f && f.online };
  }).sort((a, b) => b.at - a.at || (b.online ? 1 : 0) - (a.online ? 1 : 0));
}
function messagesTab() {
  const convs = conversations();
  const who = Social.dmWith;
  const rows = convs.length ? convs.map((c) => `
    <button class="fh-row ${who && who.key === c.key ? 'on' : ''}" data-chat="${esc(c.key)}" data-chat-name="${esc(c.name)}">
      ${face(c.key, c.name)}
      <span class="fh-row-text"><b>${esc(c.name)}</b><small>${c.preview ? esc(c.preview) : c.online ? '<span class="fh-on">Online</span>' : 'Say hello'}</small></span>
      <span class="fh-time">${esc(ago(c.at))}</span>
      ${c.unread ? '<i class="fh-dot"></i>' : ''}
    </button>`).join('') : '<div class="fh-empty">No conversations yet.</div>';
  let chat;
  if (!who) {
    chat = '<div class="fh-chat fh-chat-empty">Choose a conversation to read it here.</div>';
  } else {
    const me = S.session.uid ? safeKey(S.session.uid) : null;
    let lastDay = '';
    const bubbles = Social.dmMessages.length ? Social.dmMessages.map((m) => {
      const day = m.at ? new Date(m.at).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '';
      const sep = day && day !== lastDay ? `<div class="fh-day">${esc(day)}</div>` : '';
      lastDay = day;
      return `${sep}<div class="fh-bubble ${m.from === me ? 'mine' : ''}"><span>${esc(m.text)}</span><small>${m.at ? new Date(m.at).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }) : ''}</small></div>`;
    }).join('') : '<div class="fh-chat-empty">No messages yet. Say hello.</div>';
    chat = `
      <div class="fh-chat">
        <div class="fh-chat-head">${face(who.key, who.name)}<b>${esc(who.name)}</b></div>
        <div class="fh-log" id="dmLog">${bubbles}</div>
        <div class="fh-compose"><input type="text" id="dmInput" placeholder="Write a message" maxlength="500"><button id="dmSendBtn">Send</button></div>
      </div>`;
  }
  return `<div class="fh-split"><div class="fh-list">${rows}</div>${chat}</div>`;
}

// ---------- Find ----------
function findRow(p) {
  let action;
  if (Social.isFriend(p.key)) action = '<span class="fh-tag">Friends</span>';
  else if (Social.requestPending(p.key)) action = `<button class="fh-btn" data-accept="${esc(p.key)}" data-accept-name="${esc(p.name)}">Accept</button>`;
  else if (Social.requestSent(p.key)) action = '<span class="fh-tag dim">Request sent</span>';
  else action = `<button class="fh-btn" data-add="${esc(p.key)}" data-add-name="${esc(p.name)}">${icon('add')}Add friend</button>`;
  return `<div class="fh-line"><button class="fh-line-who" data-prof="${esc(p.key)}" data-prof-name="${esc(p.name)}">${face(p.key, p.name)}<b>${esc(p.name)}</b>${p.online !== undefined ? `<small class="${p.online ? 'fh-on' : ''}">${p.online ? 'Online' : 'Offline'}</small>` : ''}</button>${action}</div>`;
}
function findTab() {
  const results = findQuery.trim().length < 2 ? '' : findResults.length ? findResults.map(findRow).join('') : '<div class="fh-empty">No player by that name.</div>';
  const recent = Social.recentPlayers().slice(0, 8);
  return `
    <div class="fh-pad">
      <input class="fh-search" type="search" id="findPlayerInput" placeholder="Search players by name" maxlength="40" value="${esc(findQuery)}" autocomplete="off">
      <div id="findResults">${results}</div>
      ${recent.length ? `<h3 class="fh-h">Played with recently</h3>${recent.map(findRow).join('')}` : ''}
    </div>`;
}

// ---------- Requests ----------
function requestsTab() {
  if (!Social.requests.length) return '<div class="fh-empty">No requests waiting.</div>';
  return `<div class="fh-pad">${Social.requests.map((r) => `
    <div class="fh-line"><button class="fh-line-who" data-prof="${esc(r.key)}" data-prof-name="${esc(r.name)}">${face(r.key, r.name)}<b>${esc(r.name)}</b><small>Wants to be friends</small></button>
      <span class="fh-pair"><button class="fh-btn" data-accept="${esc(r.key)}" data-accept-name="${esc(r.name)}">Accept</button><button class="fh-btn ghost" data-decline="${esc(r.key)}">Ignore</button></span></div>`).join('')}</div>`;
}

// ---------- the panel ----------
function hub() {
  const unread = Social.unreadCount();
  const reqs = Social.requests.length;
  const tabs = [['friends', 'Friends', 0], ['messages', 'Messages', unread], ['find', 'Find players', 0], ['requests', 'Requests', reqs]];
  const body = tab === 'messages' ? messagesTab() : tab === 'find' ? findTab() : tab === 'requests' ? requestsTab() : friendsTab();
  return `
    <main class="fh">
      <header class="fh-top">
        <button class="fh-back" id="friendsBackBtn" aria-label="Back to the lobby">${icon('back')}</button>
        <h1>${tab === 'messages' ? 'Messages' : 'Friends'}</h1>
        <span></span>
      </header>
      <nav class="fh-tabs" role="tablist">${tabs.map(([k, label, n]) => `<button class="fh-tab ${tab === k ? 'on' : ''}" data-tab="${k}" role="tab" aria-selected="${tab === k}">${label}${n ? `<i>${n}</i>` : ''}</button>`).join('')}</nav>
      <section class="fh-panel">${Social.socialNotice ? `<p class="fh-notice">${esc(Social.socialNotice)}</p>` : ''}${body}</section>
    </main>`;
}

export function renderFriends() {
  if (tab === 'messages' && !Social.dmWith) tab = 'messages';
  return hub();
}
// An open conversation is the Messages tab of the same panel.
export function renderDm() { tab = 'messages'; return hub(); }

function attachCommon() {
  const back = document.getElementById('friendsBackBtn');
  if (back) back.onclick = () => { if (Social.dmWith) Social.closeDm(); tab = 'friends'; S.goToScreen('home'); };
  document.querySelectorAll('[data-tab]').forEach((b) => {
    b.onclick = () => {
      tab = b.dataset.tab;
      if (tab !== 'messages' && Social.dmWith) { Social.closeDm(); return; }
      S.refresh();
    };
  });
  document.querySelectorAll('[data-sel]').forEach((b) => { b.onclick = () => { selected = b.dataset.sel; S.refresh(); }; });
  document.querySelectorAll('[data-msg],[data-chat]').forEach((b) => {
    b.onclick = () => { tab = 'messages'; Social.openDm(b.dataset.msg || b.dataset.chat, b.dataset.msgName || b.dataset.chatName); };
  });
  document.querySelectorAll('[data-prof]').forEach((b) => { b.onclick = () => openProfile(b.dataset.prof, b.dataset.profName); });
  document.querySelectorAll('[data-remove]').forEach((b) => {
    b.onclick = async () => {
      if (!confirm(`Remove ${b.dataset.removeName} from your friends?`)) return;
      await Social.removeFriend(b.dataset.remove).catch(() => {});
      selected = null; S.refresh();
    };
  });
  document.querySelectorAll('[data-add]').forEach((b) => {
    b.onclick = async () => { b.disabled = true; try { await Social.sendFriendRequest(b.dataset.add, b.dataset.addName); } catch { b.disabled = false; return; } S.refresh(); };
  });
  document.querySelectorAll('[data-accept]').forEach((b) => { b.onclick = () => Social.acceptRequest(b.dataset.accept, b.dataset.acceptName); });
  document.querySelectorAll('[data-decline]').forEach((b) => { b.onclick = () => Social.declineRequest(b.dataset.decline); });
  const input = document.getElementById('findPlayerInput');
  if (input) {
    let timer = null;
    input.oninput = () => {
      findQuery = input.value;
      clearTimeout(timer);
      timer = setTimeout(async () => { findResults = await Social.findPlayers(findQuery).catch(() => []); S.refresh(); setTimeout(() => { const i = document.getElementById('findPlayerInput'); if (i) { i.focus(); i.setSelectionRange(i.value.length, i.value.length); } }, 0); }, 300);
    };
  }
  const dmInput = document.getElementById('dmInput');
  const send = document.getElementById('dmSendBtn');
  if (dmInput && send) {
    const submit = () => { const v = dmInput.value; if (!v.trim()) return; dmInput.value = ''; Social.sendDm(v); };
    send.onclick = submit;
    dmInput.onkeydown = (e) => { if (e.key === 'Enter') submit(); };
  }
  const log = document.getElementById('dmLog');
  if (log) log.scrollTop = log.scrollHeight;
}
export function attachFriends() { attachCommon(); }
export function attachDm() { attachCommon(); }
