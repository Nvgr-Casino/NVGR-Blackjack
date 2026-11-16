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
import { goldShower } from '../celebrate.js';

const fmt = (n) => Math.round(n || 0).toLocaleString();
const short = (n) => n >= 1e6 ? `${+(n / 1e6).toFixed(n >= 1e7 ? 0 : 1)}M` : n >= 1e4 ? `${Math.round(n / 1e3)}K` : fmt(n);
const date = (t) => t ? new Date(t).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

const IC = {
  crown: '<svg viewBox="0 0 64 48" aria-hidden="true"><path d="M6 38 2 10l16 12L32 2l14 20 16-12-4 28z" fill="url(#pfg)" stroke="#5a3d12" stroke-width="1.5"/><rect x="6" y="38" width="52" height="8" rx="2" fill="url(#pfg)" stroke="#5a3d12" stroke-width="1.5"/><defs><linearGradient id="pfg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffe9a8"/><stop offset=".55" stop-color="#d9a849"/><stop offset="1" stop-color="#9c6b22"/></linearGradient></defs></svg>',
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
  open.lastSeen = user && user.lastSeen ? user.lastSeen : null;
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
  const msg = `<button class="pf-btn" data-pf="dm">Message</button>`;
  if (Social.isFriend(key)) return `<span class="pf-friends-tag">Friends</span>${msg}`;
  if (Social.requestPending(key)) return `<button class="pf-btn" data-pf="accept">Accept friend request</button>${msg}`;
  if (Social.requestSent(key)) return `<button class="pf-btn ghost" disabled>Friend request sent</button>${msg}`;
  return `<button class="pf-btn" data-pf="add">Add friend</button>${msg}`;
}

// Fine gold line icons for the stats.
const LI = {
  cards: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="5" width="10" height="14" rx="1.6" transform="rotate(-8 8.5 12)"/><rect x="10.5" y="4" width="10" height="14" rx="1.6" transform="rotate(8 15.5 11)"/></svg>',
  calendar: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="5" width="17" height="15" rx="2"/><path d="M3.5 9.5h17M8 3v4M16 3v4"/></svg>',
  gift: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="9" width="17" height="11.5" rx="1.5"/><path d="M2.5 9h19V6.5h-19zM12 6.5v14M12 6.5C10 3 6.5 3.2 6.8 5.4 7 6.6 10 6.5 12 6.5zm0 0c2-3.5 5.5-3.3 5.2-1.1-.2 1.2-3.2 1.1-5.2 1.1z"/></svg>',
  star: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3.5 2.6 5.3 5.8.8-4.2 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.2-4.1 5.8-.8z"/></svg>',
  users: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="8.5" r="3.5"/><path d="M2.5 20c.6-3.6 3.2-5.5 6.5-5.5s5.9 1.9 6.5 5.5"/><circle cx="17" cy="9.5" r="2.6"/><path d="M17.5 14.6c2.3.3 3.7 1.9 4 4.4"/></svg>',
  crown: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 18 2 7l5.5 4L12 4l4.5 7L22 7l-1 11z"/><path d="M3 20.5h18"/></svg>',
};

function ring(frac, level) {
  const r = 30, c = 2 * Math.PI * r;
  return `<svg class="pf-ring" viewBox="0 0 72 72" aria-hidden="true">
    <circle cx="36" cy="36" r="${r}" class="pf-ring-track"/>
    <circle cx="36" cy="36" r="${r}" class="pf-ring-fill" stroke-dasharray="${(c * frac).toFixed(1)} ${c.toFixed(1)}" transform="rotate(-90 36 36)"/>
    <text x="36" y="42" text-anchor="middle" class="pf-ring-num">${level}</text></svg>`;
}

function cardHtml() {
  if (!open.data) return `<div class="pf-card pf-loading"><div class="pf-spinner"></div></div>`;
  const v = view();
  const bonus = P.bonusState();
  const gifts = P.giftsWaiting();
  const chipsImg = `${import.meta.env.BASE_URL}assets/ui/chips-stack.webp`;
  const stat = (icon, label, value) => `<li><span class="pf-li">${LI[icon]}</span><span class="pf-stat-label">${label}</span><b>${value}</b></li>`;
  const lvlTile = `
    <div class="pf-tile">
      ${ring(v.lp ? v.lp.frac : 1, v.level)}
      <div class="pf-tile-text">
        <span class="pf-tile-label">Level</span>
        <span class="pf-tile-value">Level ${v.level}</span>
        ${v.lp ? `<span class="pf-tile-sub">${fmt(v.lp.into)} of ${fmt(v.lp.need)} XP to level ${v.level + 1}</span>` : ''}
      </div>
    </div>`;
  const dots = Array.from({ length: 7 }, (_, i) => `<i class="${i + 1 < bonus.day || (!bonus.ready && i + 1 === bonus.day) ? 'done' : i + 1 === bonus.day ? 'now' : ''}"></i>`).join('');
  const ownTiles = open.own ? `
    <div class="pf-tile">
      <div class="pf-tile-text">
        <span class="pf-tile-label">Daily bonus</span>
        <span class="pf-dots">${dots}</span>
        <span class="pf-tile-value">Day ${bonus.day} of 7</span>
      </div>
      ${bonus.ready ? `<button class="pf-btn" data-pf="bonus">Collect ${short(bonus.amount)}</button>` : `<span class="pf-tile-sub pf-right">Next in ${until(bonus.nextAt)}</span>`}
    </div>
    <div class="pf-tile">
      <span class="pf-li pf-li-lg">${LI.gift}</span>
      <div class="pf-tile-text">
        <span class="pf-tile-label">Level gift</span>
        <span class="pf-tile-value">${short(P.nextGift())} chips</span>
        <span class="pf-tile-sub">${gifts ? `${gifts} ready to open` : `Unlocks at level ${P.prog.giftsClaimed + 2}`}</span>
      </div>
      ${gifts ? `<button class="pf-btn" data-pf="gift">Open</button>` : ''}
    </div>` : '';
  return `
    <div class="pf-card" role="dialog" aria-modal="true" aria-label="Player profile">
      <header class="pf-titlebar">
        <span class="pf-rule"></span><h2>${open.own ? 'Your Profile' : 'Player Profile'}</h2><span class="pf-rule"></span>
        <button class="pf-close" data-pf="close" aria-label="Close"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg></button>
      </header>
      <section class="pf-main">
        <div class="pf-ident">
          <div class="pf-photo">
            ${photoHtml(v.photo, v.name)}
            ${open.own ? `<label class="pf-edit" aria-label="Change picture"><input type="file" accept="image/*" id="pfFile" hidden><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16zM14 6l4 4"/></svg></label>` : ''}
          </div>
          <div class="pf-ident-text">
            <span class="pf-name">${esc(v.name)}</span>
            <span class="pf-badge">${LI.crown}Level ${v.level}</span>
            ${open.own ? `<span class="pf-balance"><span class="chip-dot"></span>${fmt(v.chips)}</span>`
              : open.online !== null ? `<span class="pf-status ${open.online ? 'on' : ''}"><i></i>${esc(seenText(open.online, open.lastSeen))}</span>` : ''}
          </div>
        </div>
        <div class="pf-hero">
          <span class="pf-kicker">Biggest win</span>
          <img class="pf-hero-img" src="${chipsImg}" alt="">
          <span class="pf-hero-amt">${fmt(v.biggestWin)}</span>
        </div>
        <ul class="pf-stats">
          ${stat('cards', 'Games played', fmt(v.gamesPlayed))}
          ${stat('calendar', 'Playing since', date(v.joinedAt))}
          ${stat('star', 'Favourite game', esc(P.GAME_NAMES[v.favGame] || '—'))}
          ${open.own ? stat('users', 'Friends', `${Social.friends.length}<small> · ${Social.friends.filter((f) => f.online).length} online</small>`) : ''}
        </ul>
      </section>
      <section class="pf-tiles ${open.own ? '' : 'one'}">${lvlTile}${ownTiles}</section>
      ${open.own ? '' : `<div class="pf-actions">${friendAction(open.key, v.name)}</div>`}
      ${open.note ? `<p class="pf-note">${esc(open.note)}</p>` : ''}
    </div>`;
}

// "Online now", or when they were last here: "Last seen 3h ago".
function seenText(online, lastSeen) {
  const label = Social.lastSeenLabel({ online, lastSeen });
  if (online) return 'Online now';
  return /ago$/.test(label) ? 'Last seen ' + label : label === 'Just now' ? 'Last seen just now' : label;
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
    if (act === 'bonus') { const n = await P.claimBonus(giveChips); if (n) { open.note = `${fmt(n)} chips added to your balance.`; goldShower(b); } }
    else if (act === 'gift') { const n = await P.claimGift(giveChips); if (n) { open.note = `Level gift opened: ${fmt(n)} chips added.`; goldShower(b); } }
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
      <header class="pf-titlebar"><span class="pf-rule"></span><h2>Daily Bonus</h2><span class="pf-rule"></span></header>
      <h3 class="bn-title">Day ${st.day} of 7</h3>
      <p class="bn-sub">Come back every day: the bonus grows each day of the week, up to ${short(P.BONUS[6])} on day 7.</p>
      <div class="bn-days">${days}</div>
      <button class="pf-btn lg" data-bn="collect">Collect ${fmt(st.amount)} chips</button>
    </div>`;
  el.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-bn]');
    if (!b) return;
    b.disabled = true;
    const n = await P.claimBonus(giveChips).catch(() => 0);
    b.textContent = n ? `${fmt(n)} chips added` : 'Please try again';
    if (n) goldShower(b);
    setTimeout(() => el.remove(), n ? 1600 : 1500);
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
