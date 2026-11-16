// Inviting a friend to your table. At a table, each free seat in the seat
// panel carries a gold +; it opens your friends, online first, and Invite
// sends them a message and an invitation to that table and seat. A friend
// who has the app open anywhere gets a notice at once — Join or Not now —
// and Join takes them to the table, standing them up from any other first,
// and into the seat chosen if it is still free.
//
// The invitation travels in the message inbox (dmInbox), which the rules
// already let a player write to another's; it carries the table's code,
// the game and the seat beside the usual name, preview and time.

import { ref, push, set } from 'firebase/database';
import { db } from '../firebase/config.js';
import { esc } from './uiHelpers.js';
import { safeKey, avatarColor, initials } from './roomLogic.js';
import * as S from './session.js';
import * as Social from './social.js';
import * as Roulette from './rouletteSession.js';
import * as Baccarat from './baccaratSession.js';
import * as Craps from './crapsSession.js';

const GAME_NAMES = { blackjack: 'Blackjack', holdem: "Texas Hold'em", roulette: 'Roulette', baccarat: 'Baccarat', craps: 'Craps' };
const FRESH_MS = 10 * 60 * 1000;   // an invitation older than this is not offered

let picker = null;   // { seat, sent: Set }

// ---------- sending ----------
export function openInvite(seat = null) {
  if (!S.session.code) return;
  picker = { seat, sent: new Set(), note: '' };
  drawPicker();
}
function closePicker() {
  picker = null;
  const el = document.getElementById('invOverlay');
  if (el) el.remove();
}

function gameOf(room) { return (room && room.game) || 'blackjack'; }

function pickerHtml() {
  const game = GAME_NAMES[gameOf(S.session.room)] || 'table';
  const friends = Social.friends.slice().sort((a, b) => (b.online ? 1 : 0) - (a.online ? 1 : 0) || (b.lastSeen || 0) - (a.lastSeen || 0));
  const rows = friends.length ? friends.map((f) => `
    <li class="inv-row">
      <span class="inv-face" style="background:${avatarColor(f.name)}">${esc(initials(f.name))}</span>
      <span class="inv-who"><b>${esc(f.name)}</b><small class="${f.online ? 'on' : ''}"><i></i>${esc(Social.lastSeenLabel(f))}</small></span>
      ${picker.sent.has(f.key) ? '<span class="inv-sent">Invited</span>' : `<button class="pf-btn" data-inv="${esc(f.key)}" data-inv-name="${esc(f.name)}">Invite</button>`}
    </li>`).join('') : '<li class="inv-empty">No friends yet. Tap any player to open their profile and add them.</li>';
  return `
    <div class="pf-card inv-card" role="dialog" aria-modal="true" aria-label="Invite a friend">
      <header class="pf-titlebar">
        <span class="pf-rule"></span><h2>Invite a Friend</h2><span class="pf-rule"></span>
        <button class="pf-close" data-inv-close aria-label="Close"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg></button>
      </header>
      <p class="inv-sub">To your ${esc(game)} table${picker.seat !== null ? `, seat ${picker.seat + 1}` : ''}. Friends online see it at once.</p>
      <ul class="inv-list">${rows}</ul>
      ${picker.note ? `<p class="pf-note">${esc(picker.note)}</p>` : ''}
    </div>`;
}
function drawPicker() {
  if (!picker) return;
  let el = document.getElementById('invOverlay');
  if (!el) {
    el = document.createElement('div');
    el.id = 'invOverlay';
    el.className = 'pf-overlay';
    el.addEventListener('click', onPickerClick);
    document.body.appendChild(el);
  }
  el.innerHTML = pickerHtml();
}
async function onPickerClick(e) {
  if (e.target === e.currentTarget || e.target.closest('[data-inv-close]')) return closePicker();
  const b = e.target.closest('[data-inv]');
  if (!b || !picker) return;
  b.disabled = true;
  try {
    await sendInvite(b.dataset.inv, b.dataset.invName, picker.seat);
    picker.sent.add(b.dataset.inv);
    picker.note = `Invitation sent to ${b.dataset.invName}.`;
  } catch {
    picker.note = 'That invitation did not go through. Please try again.';
  }
  drawPicker();
}

export async function sendInvite(friendKey, friendName, seat = null) {
  const me = safeKey(S.session.uid);
  const room = S.session.room;
  const game = gameOf(room);
  const at = Date.now();
  const text = `Join me at my ${GAME_NAMES[game] || 'table'} table${seat !== null ? `, seat ${seat + 1}` : ''}.`;
  // In your conversation with them, and as an invitation in their inbox.
  await push(ref(db, 'dms/' + Social.threadId(me, friendKey)), { from: me, name: S.session.name, text, at });
  await set(ref(db, `dmInbox/${friendKey}/${me}`), {
    name: S.session.name, preview: text, at,
    invite: { code: S.session.code, game, seat: seat === null ? -1 : seat },
  });
}

// ---------- receiving ----------
const handledKey = (from, at) => `nvgr-invite-${from}-${at}`;
const isHandled = (from, at) => { try { return localStorage.getItem(handledKey(from, at)) === '1'; } catch { return false; } };
const markHandled = (from, at) => { try { localStorage.setItem(handledKey(from, at), '1'); } catch { /* private mode */ } };

let showing = null;
Social.setInboxListener((inbox) => {
  if (showing) return;
  const now = Date.now();
  const entry = Object.entries(inbox || {}).find(([from, m]) => m && m.invite && m.invite.code && now - (m.at || 0) < FRESH_MS
    && !isHandled(from, m.at) && m.invite.code !== S.session.code);
  if (entry) showInvite(entry[0], entry[1]);
});

function showInvite(from, m) {
  showing = { from, m };
  const game = GAME_NAMES[m.invite.game] || 'table';
  const el = document.createElement('div');
  el.className = 'inv-toast';
  el.setAttribute('role', 'alertdialog');
  el.innerHTML = `
    <span class="inv-face" style="background:${avatarColor(m.name || '?')}">${esc(initials(m.name || '?'))}</span>
    <span class="inv-toast-text"><small>Invitation</small><b>${esc(m.name || 'A friend')}</b> invites you to their ${esc(game)} table</span>
    <span class="inv-toast-actions"><button class="pf-btn ghost" data-it="no">Not now</button><button class="pf-btn" data-it="yes">Join</button></span>`;
  el.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-it]');
    if (!b) return;
    markHandled(from, m.at);
    el.remove();
    showing = null;
    if (b.dataset.it === 'yes') await acceptInvite(m.invite);
  });
  document.body.appendChild(el);
}

async function acceptInvite({ code, game, seat }) {
  const want = Number.isInteger(seat) && seat >= 0 ? seat : null;
  // Standing up from any other table first, chips returned.
  if (S.session.code && S.session.code !== code) await S.leaveTable().catch(() => {});
  if (game === 'roulette') return Roulette.joinRouletteTable(code, want);
  if (game === 'baccarat') return Baccarat.joinBaccaratTable(code, want);
  if (game === 'craps') return Craps.joinCrapsTable(code, want);
  await S.joinRoom(code);
  if (game === 'blackjack' && want !== null) await S.changeSeat(want).catch(() => {});
}
