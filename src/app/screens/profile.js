// The player profile card, the daily bonus and the level-up notice. Each is
// an overlay of its own over whatever screen is showing, so a profile can
// open from the lobby, the friends list or a search without leaving it.

import { ref, get } from 'firebase/database';
import { db } from '../../firebase/config.js';
import { esc } from '../uiHelpers.js';
import { safeKey } from '../roomLogic.js';
import * as S from '../session.js';
import * as Social from '../social.js';
import * as P from '../progress.js';

const fmt = (n) => Math.round(n || 0).toLocaleString();
const short = (n) => n >= 1e6 ? `${+(n / 1e6).toFixed(n >= 1e7 ? 0 : 1)}M` : n >= 1e4 ? `${Math.round(n / 1e3)}K` : fmt(n);
const date = (t) => t ? new Date(t).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

const IC = {
  crown: '<svg viewBox="0 0 64 48" aria-hidden="true"><path d="M6 38 2 10l16 12L32 2l14 20 16-12-4 28z" fill="url(#pfg)" stroke="#5a3d12" stroke-width="1.5"/><rect x="6" y="38" width="52" height="8" rx="2" fill="url(#pfg)" stroke="#5a3d12" stroke-width="1.5"/><defs><linearGradient id="pfg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffe9a8"/><stop offset=".55" stop-color="#d9a849"/><stop offset="1" stop-color="#9c6b22"/></linearGradient></defs></svg>',
  gift: '<svg viewBox="0 0 48 48" aria-hidden="true"><rect x="5" y="18" width="38" height="26" rx="3" fill="#7d1622" stroke="#d9b46a" stroke-width="2"/><rect x="3" y="12" width="42" height="9" rx="2" fill="#9b1d2b" stroke="#d9b46a" stroke-width="2"/><rect x="21" y="12" width="6" height="32" fill="#d9b46a"/><path d="M24 12c-4-7-13-8-13-2 0 4 8 3 13 2zm0 0c4-7 13-8 13-2 0 4-8 3-13 2z" fill="none" stroke="#d9b46a" stroke-width="2.4"/></svg>',
  calendar: '<svg viewBox="0 0 48 48" aria-hidden="true"><rect x="5" y="9" width="38" height="34" rx="4" fill="#15130f" stroke="#d9b46a" stroke-width="2"/><rect x="5" y="9" width="38" height="9" rx="3" fill="#d9b46a"/><path d="M15 5v8M33 5v8" stroke="#d9b46a" stroke-width="3" stroke-linecap="round"/><text x="24" y="37" text-anchor="middle" font-family="Unbounded,sans-serif" font-size="14" font-weight="800" fill="#f0d590">7</text></svg>',
  friends: '<svg viewBox="0 0 48 48" aria-hidden="true" fill="#d9b46a"><circle cx="18" cy="16" r="7"/><path d="M4 40c0-8 6-13 14-13s14 5 14 13z"/><circle cx="34" cy="18" r="5.5" opacity=".7"/><path d="M30 28c8 0 14 4 14 11h-9c0-4-2-8-5-11z" opacity=".7"/></svg>',
  chips: '<svg viewBox="0 0 64 48" aria-hidden="true"><g stroke="#5a3d12" stroke-width="1.2"><ellipse cx="22" cy="38" rx="16" ry="6" fill="#111"/><rect x="6" y="20" width="32" height="18" fill="#111"/><ellipse cx="22" cy="20" rx="16" ry="6" fill="#1c1c1c"/><ellipse cx="44" cy="40" rx="14" ry="5" fill="#9b1d2b"/><rect x="30" y="28" width="28" height="12" fill="#9b1d2b"/><ellipse cx="44" cy="28" rx="14" ry="5" fill="#b8242f"/></g><g fill="#e6c372"><rect x="9" y="24" width="4" height="12"/><rect x="20" y="25" width="4" height="13"/><rect x="31" y="24" width="4" height="12"/><rect x="34" y="31" width="3" height="8" fill="#f4efe4"/><rect x="43" y="32" width="3" height="8" fill="#f4efe4"/><rect x="52" y="31" width="3" height="8" fill="#f4efe4"/></g><ellipse cx="22" cy="20" rx="9" ry="3.2" fill="none" stroke="#e6c372" stroke-width="1.4"/></svg>',
};

function photoHtml(photo, name, big = true) {
  if (photo) return `<img class="pf-img" src="${esc(photo)}" alt="">`;
  const initial = (name || '?').trim().charAt(0).toUpperCase() || '?';
  return `<span class="pf-initial${big ? '' : ' sm'}">${esc(initial)}</span>`;
}

// ---------- the profile card ----------
let open = null;   // { key, own, data, online, busy, note }

export function isProfileOpen() { return !!open; }

export async function openProfile(key = null, nameHint = '') {
  const myKey = S.session.uid ? safeKey(S.session.uid) : null;
  const own = !key || key === myKey;
  open = { key: own ? myKey : key, own, data: null, online: null, busy: false, note: '', name: nameHint };
  draw();
  if (own) { open.data = 'self'; draw(); return; }
  const [data, user] = await Promise.all([
    P.loadProfile(key),
    get(ref(db, 'users/' + key)).then((s) => s.val()).catch(() => null),
  ]);
  if (!open || open.key !== key) return;
  open.data = data || { name: (user && user.name) || nameHint || 'Player' };
  open.online = user ? !!user.online : null;
  draw();
}
export function closeProfile() {
  open = null;
  const el = document.getElementById('pfOverlay');
  if (el) el.remove();
}
// The card follows the player's own progress while it is open.
P.setProgressListener(() => { if (open && open.own) draw(); });

function view() {
  if (open.own) {
    const lp = P.levelProgress(P.prog.xp);
    return {
      name: S.session.name || 'Player', photo: P.prog.photo || S.session.photo || null,
      level: lp.level, lp, chips: S.session.chips, joinedAt: P.prog.joinedAt,
      biggestWin: P.prog.biggestWin, gamesPlayed: P.prog.gamesPlayed, favGame: P.prog.favGame,
    };
  }
  const d = open.data || {};
  return { name: d.name || open.name || 'Player', photo: d.photo || null, level: d.level || 1, lp: null, joinedAt: d.joinedAt, biggestWin: d.biggestWin || 0, gamesPlayed: d.gamesPlayed || 0, favGame: d.favGame || null };
}

function friendAction(key, name) {
  if (Social.isFriend(key)) return `<button class="btn btn-primary" data-pf="dm">Message</button>`;
  if (Social.requestPending(key)) return `<button class="btn btn-primary" data-pf="accept">Accept friend request</button>`;
  if (Social.requestSent(key)) return `<button class="btn btn-ghost" disabled>Friend request sent</button>`;
  return `<button class="btn btn-primary" data-pf="add">Add friend</button>`;
}

function cardHtml() {
  if (!open.data) return `<div class="pf-card pf-loading"><div class="pf-spinner"></div></div>`;
  const v = view();
  const bonus = P.bonusState();
  const gifts = P.giftsWaiting();
  const lvlTile = `
    <div class="pf-tile">
      <span class="pf-tile-label">Level</span>
      <span class="pf-tile-icon">${IC.crown}</span>
      ${v.lp ? `<span class="pf-bar"><i style="width:${(v.lp.frac * 100).toFixed(1)}%"></i></span>` : ''}
      <span class="pf-tile-value">Level ${v.level}</span>
      ${v.lp ? `<span class="pf-tile-sub">${fmt(v.lp.into)} / ${fmt(v.lp.need)} XP</span>` : ''}
    </div>`;
  const ownTiles = open.own ? `
    <div class="pf-tile">
      <span class="pf-tile-label">Daily bonus</span>
      <span class="pf-tile-icon">${IC.calendar}</span>
      <span class="pf-tile-value">Day ${bonus.day} of 7</span>
      ${bonus.ready ? `<button class="btn btn-primary btn-sm" data-pf="bonus">Collect ${short(bonus.amount)}</button>` : `<span class="pf-tile-sub">Next in ${until(bonus.nextAt)}</span>`}
    </div>
    <div class="pf-tile">
      <span class="pf-tile-label">Level gift</span>
      <span class="pf-tile-icon">${IC.gift}</span>
      ${gifts ? `<span class="pf-tile-value">${gifts} waiting</span><button class="btn btn-primary btn-sm" data-pf="gift">Open ${short(P.nextGift())}</button>`
        : `<span class="pf-tile-value">${short(P.nextGift())}</span><span class="pf-tile-sub">at level ${P.prog.giftsClaimed + 2}</span>`}
    </div>
    <div class="pf-tile">
      <span class="pf-tile-label">Friends</span>
      <span class="pf-tile-icon">${IC.friends}</span>
      <span class="pf-tile-value">${Social.friends.length}</span>
      <span class="pf-tile-sub">${Social.friends.filter((f) => f.online).length} online</span>
    </div>` : '';
  return `
    <div class="pf-card" role="dialog" aria-modal="true" aria-label="Player profile">
      <button class="pf-close" data-pf="close" aria-label="Close">&times;</button>
      <div class="pf-head">
        <div class="pf-photo">
          ${photoHtml(v.photo, v.name)}
          ${open.own ? `<label class="pf-edit" aria-label="Change picture"><input type="file" accept="image/*" id="pfFile" hidden><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16zM14 6l4 4" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg></label>` : ''}
        </div>
        <div class="pf-id">
          <span class="pf-name">${esc(v.name)}</span>
          <span class="pf-badge">Level ${v.level}</span>
          ${open.own ? `<span class="pf-balance"><span class="chip-dot"></span>${fmt(v.chips)}</span>`
            : open.online !== null ? `<span class="pf-status ${open.online ? 'on' : ''}"><i class="dot ${open.online ? 'on' : ''}"></i>${open.online ? 'Online' : 'Offline'}</span>` : ''}
        </div>
        <div class="pf-bigwin">
          <span class="pf-kicker">Biggest win</span>
          <span class="pf-chips">${IC.chips}</span>
          <span class="pf-plaque">${fmt(v.biggestWin)}</span>
        </div>
        <dl class="pf-facts">
          <div><dt>Games played</dt><dd>${fmt(v.gamesPlayed)}</dd></div>
          <div><dt>Biggest win</dt><dd>${short(v.biggestWin)}</dd></div>
          <div><dt>Playing since</dt><dd>${date(v.joinedAt)}</dd></div>
          <div><dt>Favourite game</dt><dd>${esc(P.GAME_NAMES[v.favGame] || '—')}</dd></div>
        </dl>
      </div>
      <div class="pf-tiles ${open.own ? '' : 'one'}">${lvlTile}${ownTiles}</div>
      ${open.own ? '' : `<div class="pf-actions">${friendAction(open.key, v.name)}</div>`}
      ${open.note ? `<p class="pf-note">${esc(open.note)}</p>` : ''}
    </div>`;
}

function until(t) {
  const ms = Math.max(0, t - Date.now()), h = Math.floor(ms / 3600000), m = Math.floor((ms % 3600000) / 60000);
  return h ? `${h}h ${m}m` : `${m}m`;
}

async function giveChips(n) {
  S.session.chips += n;
  await S.saveAccountChips(S.session.uid, S.session.name, S.session.chips).catch(() => {});
  S.refresh();
}

function draw() {
  if (!open) return;
  let el = document.getElementById('pfOverlay');
  if (!el) {
    el = document.createElement('div');
    el.id = 'pfOverlay';
    el.className = 'pf-overlay';
    el.addEventListener('click', onClick);
    el.addEventListener('change', onFile);
    document.body.appendChild(el);
  }
  el.innerHTML = cardHtml();
}

async function onClick(e) {
  if (e.target === e.currentTarget) { closeProfile(); return; }
  const b = e.target.closest('[data-pf]');
  if (!b || !open || open.busy) return;
  const act = b.dataset.pf;
  const v = view();
  if (act === 'close') return closeProfile();
  open.busy = true;
  try {
    if (act === 'bonus') { const n = await P.claimBonus(giveChips); if (n) open.note = `${fmt(n)} chips added to your balance.`; }
    else if (act === 'gift') { const n = await P.claimGift(giveChips); if (n) open.note = `Level gift opened: ${fmt(n)} chips added.`; }
    else if (act === 'add') { await Social.sendFriendRequest(open.key, v.name); open.note = 'Friend request sent.'; }
    else if (act === 'accept') { await Social.acceptRequest(open.key, v.name); open.note = `You and ${v.name} are now friends.`; }
    else if (act === 'dm') { const k = open.key; closeProfile(); Social.openDm(k, v.name); return; }
  } catch {
    open.note = 'That did not go through. Please try again.';
  } finally {
    if (open) { open.busy = false; draw(); }
  }
}

async function onFile(e) {
  if (e.target.id !== 'pfFile' || !e.target.files || !e.target.files[0] || !open) return;
  open.note = 'Saving your picture…'; draw();
  try { await P.setPhoto(e.target.files[0]); open.note = 'Picture updated.'; }
  catch { open.note = 'That picture could not be used. Please try another.'; }
  draw();
}

// ---------- the daily bonus ----------
let bonusShown = false;
export function maybeShowBonus() {
  if (bonusShown || !P.prog.loaded || !S.session.uid) return;
  const st = P.bonusState();
  if (!st.ready) return;
  bonusShown = true;
  const el = document.createElement('div');
  el.className = 'pf-overlay';
  el.id = 'bonusOverlay';
  const days = P.BONUS.map((amt, i) => {
    const d = i + 1, cls = d < st.day ? 'done' : d === st.day ? 'today' : '';
    return `<div class="bn-day ${cls}"><span class="bn-label">Day ${d}</span><span class="bn-amt">${short(amt)}</span>${d < st.day ? '<span class="bn-tick">&#10003;</span>' : ''}</div>`;
  }).join('');
  el.innerHTML = `
    <div class="pf-card bn-card" role="dialog" aria-modal="true" aria-label="Daily bonus">
      <span class="pf-kicker">Daily bonus</span>
      <h2 class="bn-title">Day ${st.day} of 7</h2>
      <p class="bn-sub">Come back every day: the bonus grows each day of the week, up to ${short(P.BONUS[6])} on day 7.</p>
      <div class="bn-days">${days}</div>
      <button class="btn btn-primary btn-lg" data-bn="collect">Collect ${fmt(st.amount)} chips</button>
    </div>`;
  el.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-bn]');
    if (!b) return;
    b.disabled = true;
    const n = await P.claimBonus(giveChips).catch(() => 0);
    b.textContent = n ? `${fmt(n)} chips added` : 'Please try again';
    setTimeout(() => el.remove(), n ? 900 : 1500);
  });
  document.body.appendChild(el);
}

// ---------- level up ----------
P.setLevelUpListener((level) => {
  const el = document.createElement('div');
  el.className = 'lvl-toast';
  el.innerHTML = `<span class="lvl-crown">${IC.crown}</span><span><strong>Level ${level}</strong><small>A ${short(P.giftFor(level))} gift is waiting in your profile.</small></span>`;
  el.addEventListener('click', () => { el.remove(); openProfile(); });
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 6000);
});
