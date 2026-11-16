// The table picker: a room of tables seen from above for one game. The
// limits slide along the bottom; each limit holds several tables, which
// slide sideways. Taken seats show who is sitting there; an empty seat, or
// the table itself, sits you down. Each limit is padded with fresh tables
// so there is always a choice: tapping one opens a new public table at that
// limit with you in it.

import { TABLE_STAKES, MAX_PUBLIC_SEATS } from '../roomLogic.js';
import { POKER_SEATS } from '../../poker/rules.js';
import { ROULETTE_SEATS } from '../../roulette/rules.js';
import { BACCARAT_SEATS } from '../../baccarat/rules.js';
import { CRAPS_SEATS } from '../../craps/rules.js';
import { characterPortraitDataURL, defaultCharacterFor } from '../../scene/character.js';
import { esc } from '../uiHelpers.js';
import * as S from '../session.js';
import * as Poker from '../pokerSession.js';
import * as Roulette from '../rouletteSession.js';
import * as Baccarat from '../baccaratSession.js';
import * as Craps from '../crapsSession.js';

const short = (n) => n >= 1e6 ? `${+(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${+(n / 1e3).toFixed(n >= 1e4 ? 0 : 1)}K` : String(n);
const PER_LIMIT = 4;   // tables shown at each limit, real ones first

// Each game: its name, seats, table shape, and how to load and join.
const GAMES = {
  blackjack: { name: 'Blackjack', seats: MAX_PUBLIC_SEATS, shape: 'moon', hint: 'Beat the dealer to 21. Blackjack pays 3 to 2.',
    load: () => S.loadBlackjackTables(), join: (t) => S.joinSpecificPublicTable(t.code), fresh: (tier) => S.newPublicBlackjackTable(tier) },
  holdem: { name: "Texas Hold'em", seats: POKER_SEATS, shape: 'oval', hint: 'Your best five cards from two in hand and five on the board.',
    load: async () => (await Poker.loadPokerTables()).tables || [], join: (t) => Poker.openPokerTable(t.code), fresh: null },
  roulette: { name: 'Roulette', seats: ROULETTE_SEATS, shape: 'wheel', hint: 'European wheel, one zero. Straight up pays 35 to 1.',
    load: () => Roulette.loadRouletteTables(), join: (t) => Roulette.joinRouletteTable(t.code), fresh: (tier) => Roulette.newPublicTable(tier) },
  baccarat: { name: 'Baccarat', seats: BACCARAT_SEATS, shape: 'oval', hint: 'Banker pays 19 to 20. Tie pays 8 to 1.',
    load: () => Baccarat.loadBaccaratTables(), join: (t) => Baccarat.joinBaccaratTable(t.code), fresh: (tier) => Baccarat.newPublicTable(tier) },
  craps: { name: 'Craps', seats: CRAPS_SEATS, shape: 'track', hint: 'Pass Line, odds at true odds, the field and the hard ways.',
    load: () => Craps.loadCrapsTables(), join: (t) => Craps.joinCrapsTable(t.code), fresh: (tier) => Craps.newPublicTable(tier) },
};
export const PICKER_GAMES = Object.keys(GAMES);

let st = null;   // { game, tables, limit, hideFull, minFree, list, busy }

export async function openTablePicker(game) {
  const g = GAMES[game];
  if (!g) return;
  st = { game, tables: null, limits: [], limit: 0, hideFull: false, minFree: 0, list: false, busy: false, error: '' };
  draw();
  try {
    const raw = await g.load();
    if (!st || st.game !== game) return;
    st.tables = raw.map((t) => normalise(game, t));
    st.limits = limitsFor(game, st.tables);
    // Start at the busiest limit you can afford.
    const chips = S.session.chips || 0;
    const affordable = st.limits.filter((l) => l.min <= Math.max(TABLE_STAKES[0].min, chips / 20));
    const pool = affordable.length ? affordable : st.limits.slice(0, 1);
    const busiest = pool.slice().sort((a, b) => players(b) - players(a) || b.min - a.min)[0];
    st.limit = Math.max(0, st.limits.indexOf(busiest));
  } catch {
    if (st) { st.tables = []; st.error = 'The tables could not be loaded. Please try again.'; }
  }
  draw();
}
export function closeTablePicker() {
  st = null;
  const el = document.getElementById('tpOverlay');
  if (el) el.remove();
}

// One shape for every game's table: its code, limit, stakes and seats.
function normalise(game, t) {
  if (game === 'holdem') return { code: t.code, tierKey: 'p' + t.tier, min: t.sb, max: t.bb, label: `${short(t.sb)} / ${short(t.bb)}`, seats: t.seats || [], playing: !!t.playing };
  const i = TABLE_STAKES.findIndex((s) => s.min === t.minBet);
  return { code: t.code, tierKey: 't' + (i < 0 ? 0 : i), tier: i < 0 ? 0 : i, min: t.minBet, max: t.maxBet, label: `${short(t.minBet)} – ${short(t.maxBet)}`, seats: t.seats || [], playing: t.phase && t.phase !== 'waiting' && t.phase !== 'betting' };
}
function limitsFor(game, tables) {
  if (game === 'holdem') {
    const by = new Map();
    for (const t of tables) if (!by.has(t.tierKey)) by.set(t.tierKey, { key: t.tierKey, min: t.min, max: t.max, label: t.label });
    return [...by.values()].sort((a, b) => a.min - b.min);
  }
  return TABLE_STAKES.map((s, i) => ({ key: 't' + i, tier: i, min: s.min, max: s.max, label: `${short(s.min)} – ${short(s.max)}` }));
}
const players = (limit) => (st.tables || []).filter((t) => t.tierKey === limit.key).reduce((n, t) => n + t.seats.length, 0);

// The tables at the current limit after the filters, padded with fresh ones.
function shown() {
  const g = GAMES[st.game], limit = st.limits[st.limit];
  if (!limit) return [];
  let list = st.tables.filter((t) => t.tierKey === limit.key).sort((a, b) => b.seats.length - a.seats.length);
  if (st.hideFull) list = list.filter((t) => t.seats.length < g.seats);
  if (st.minFree) list = list.filter((t) => g.seats - t.seats.length >= st.minFree);
  if (g.fresh) {
    for (let i = list.length; i < PER_LIMIT; i++) list.push({ fresh: true, code: 'new-' + i, tier: limit.tier, min: limit.min, max: limit.max, label: limit.label, seats: [] });
  }
  return list;
}

// ---------- drawing ----------
// Seat positions round each shape, as fractions of the table card.
function seatSpots(shape, n) {
  const spots = [];
  if (shape === 'moon') {
    for (let i = 0; i < n; i++) { const a = Math.PI * (0.12 + 0.76 * (i / (n - 1))); spots.push([0.5 - 0.43 * Math.cos(a), 0.2 + 0.68 * Math.sin(a)]); }
  } else if (shape === 'wheel' || shape === 'track') {
    const top = Math.ceil(n / 2), bottom = n - top;
    for (let i = 0; i < top; i++) spots.push([0.24 + (0.62 * (i + 0.5)) / top, 0.07]);
    for (let i = 0; i < bottom; i++) spots.push([0.24 + (0.62 * (i + 0.5)) / bottom, 0.93]);
  } else {
    for (let i = 0; i < n; i++) { const a = Math.PI / 2 + (2 * Math.PI * i) / n; spots.push([0.5 + 0.46 * Math.cos(a), 0.5 + 0.44 * Math.sin(a)]); }
  }
  return spots;
}
function feltSvg(shape, name) {
  const defs = `<defs>
    <radialGradient id="tpFelt" cx="50%" cy="45%" r="70%"><stop offset="0" stop-color="#2a4f9c"/><stop offset="0.7" stop-color="#173468"/><stop offset="1" stop-color="#0e2248"/></radialGradient>
    <linearGradient id="tpRail" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f2d58c"/><stop offset="0.5" stop-color="#b98a3a"/><stop offset="1" stop-color="#7c5a22"/></linearGradient></defs>`;
  let body;
  if (shape === 'moon') body = `<path d="M30 40 H270 A120 120 0 0 1 150 160 A120 120 0 0 1 30 40 Z" transform="translate(0 -4)" fill="url(#tpFelt)" stroke="url(#tpRail)" stroke-width="9"/>
    <path d="M70 46 A82 82 0 0 0 230 46" fill="none" stroke="rgba(242,213,140,0.45)" stroke-width="1.5"/>`;
  else if (shape === 'wheel') body = `<rect x="22" y="26" width="256" height="128" rx="24" fill="url(#tpFelt)" stroke="url(#tpRail)" stroke-width="9"/>
    <circle cx="62" cy="90" r="34" fill="#0b1630" stroke="url(#tpRail)" stroke-width="4"/><circle cx="62" cy="90" r="22" fill="none" stroke="rgba(242,213,140,0.6)" stroke-width="5" stroke-dasharray="3 3"/><circle cx="62" cy="90" r="6" fill="#f2d58c"/>
    <g stroke="rgba(242,213,140,0.35)" stroke-width="1" fill="none"><rect x="110" y="56" width="148" height="68" rx="4"/><path d="M147 56v68M184 56v68M221 56v68M110 90h148"/></g>`;
  else if (shape === 'track') body = `<rect x="18" y="30" width="264" height="120" rx="60" fill="url(#tpFelt)" stroke="url(#tpRail)" stroke-width="9"/>
    <rect x="58" y="62" width="184" height="56" rx="28" fill="none" stroke="rgba(242,213,140,0.4)" stroke-width="1.5"/>`;
  else body = `<rect x="22" y="28" width="256" height="124" rx="62" fill="url(#tpFelt)" stroke="url(#tpRail)" stroke-width="9"/>
    <rect x="62" y="60" width="176" height="60" rx="30" fill="none" stroke="rgba(242,213,140,0.4)" stroke-width="1.5"/>`;
  const ty = shape === 'moon' ? 72 : 96;
  return `<svg class="tp-felt" viewBox="0 0 300 180" aria-hidden="true">${defs}${body}
    <text x="${shape === 'wheel' ? 184 : 150}" y="${ty}" text-anchor="middle" class="tp-felt-name">${esc(name.toUpperCase())}</text></svg>`;
}

function tableCard(t, i) {
  const g = GAMES[st.game];
  const spots = seatSpots(g.shape, g.seats);
  const seats = spots.map(([x, y], k) => {
    const p = t.seats[k];
    const pos = `style="left:${(x * 100).toFixed(1)}%;top:${(y * 100).toFixed(1)}%"`;
    if (p) return `<span class="tp-seat taken" ${pos} title="${esc(p.name)}"><img src="${characterPortraitDataURL(p.character || defaultCharacterFor(p.name || ''), 64)}" alt=""><b>${esc((p.name || '').split(' ')[0])}</b></span>`;
    return `<button class="tp-seat open" ${pos} data-tp-join="${i}" aria-label="Take this seat"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 6v12M6 12h12"/></svg></button>`;
  }).join('');
  const free = g.seats - t.seats.length;
  const status = t.fresh ? 'New table' : free <= 0 ? 'Full' : t.playing ? 'Playing' : t.seats.length ? 'Open' : 'Empty';
  return `
    <article class="tp-table ${t.fresh ? 'fresh' : ''}" style="--i:${i}">
      <div class="tp-board">
        ${feltSvg(g.shape, g.name)}
        <button class="tp-board-hit" data-tp-join="${i}" aria-label="${free > 0 ? 'Join' : 'Watch'} this table"></button>
        <span class="tp-stakes">${esc(t.label)}</span>
        ${seats}
      </div>
      <footer class="tp-meta"><span class="tp-dot ${status === 'Full' ? 'full' : t.seats.length ? 'on' : ''}"></span>${status}<span class="tp-sep">·</span>${t.seats.length} of ${g.seats} seats</footer>
    </article>`;
}

function listRow(t, i) {
  const g = GAMES[st.game], free = g.seats - t.seats.length;
  return `<button class="tp-row" data-tp-join="${i}">
    <span class="tp-row-name">${t.fresh ? 'New table' : esc(g.name)}</span>
    <span class="tp-row-faces">${t.seats.slice(0, 7).map((p) => `<img src="${characterPortraitDataURL(p.character || defaultCharacterFor(p.name || ''), 48)}" alt="" title="${esc(p.name)}">`).join('')}</span>
    <span class="tp-row-seats">${t.seats.length}/${g.seats}</span>
    <span class="tp-row-go">${free > 0 ? 'Sit' : 'Watch'}</span></button>`;
}

function html() {
  const g = GAMES[st.game];
  const loading = !st.tables;
  const limit = st.limits[st.limit];
  const list = loading ? [] : shown();
  st.shownList = list;
  const pill = (on, attr, label) => `<button class="tp-pill ${on ? 'on' : ''}" ${attr}>${label}</button>`;
  return `
    <div class="tp-screen" role="dialog" aria-label="Choose a ${esc(g.name)} table">
      <header class="tp-top">
        <button class="tp-back" data-tp="back" aria-label="Back"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg></button>
        <div class="tp-title"><span class="tp-kicker">Choose a table</span><h2>${esc(g.name)}</h2></div>
        <p class="tp-hint">${esc(g.hint)}</p>
        <div class="tp-filters">
          <div class="tp-filter"><span>Full tables</span>${pill(!st.hideFull, 'data-tp-full="0"', 'Show')}${pill(st.hideFull, 'data-tp-full="1"', 'Hide')}</div>
          <div class="tp-filter"><span>Free seats</span>${pill(st.minFree === 0, 'data-tp-free="0"', 'Any')}${pill(st.minFree === 2, 'data-tp-free="2"', '2+')}</div>
        </div>
      </header>
      <main class="tp-room ${st.list ? 'as-list' : ''}">
        ${loading ? '<div class="tp-searching"><span class="pf-spinner"></span><span>Finding tables…</span></div>'
          : st.error ? `<div class="tp-searching">${esc(st.error)}</div>`
          : !list.length ? '<div class="tp-searching">No tables match. Show full tables or any free seats.</div>'
          : st.list ? `<div class="tp-list">${list.map(listRow).join('')}</div>`
          : `<div class="tp-strip" id="tpStrip">${list.map(tableCard).join('')}</div>`}
      </main>
      <footer class="tp-bottom">
        <div class="tp-limits-wrap">
          <button class="tp-arrow" data-tp-step="-1" aria-label="Lower limit" ${st.limit <= 0 ? 'disabled' : ''}><svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg></button>
          <div class="tp-limits" id="tpLimits">${st.limits.map((l, i) => `<button class="tp-limit ${i === st.limit ? 'on' : ''}" data-tp-limit="${i}"><span class="tp-limit-label">${esc(l.label)}</span><span class="tp-limit-sub">${players(l)} playing</span></button>`).join('')}</div>
          <button class="tp-arrow" data-tp-step="1" aria-label="Higher limit" ${st.limit >= st.limits.length - 1 ? 'disabled' : ''}><svg viewBox="0 0 24 24"><path d="M9 5l7 7-7 7"/></svg></button>
        </div>
        <div class="tp-limit-info">${limit ? `<span>Bets <b>${short(limit.min)}</b> to <b>${short(limit.max)}</b></span>` : ''}<span class="tp-balance"><span class="chip-dot"></span>${(S.session.chips || 0).toLocaleString()}</span></div>
        <button class="tp-view" data-tp="view" aria-label="${st.list ? 'Show tables' : 'Show as a list'}">${st.list
          ? '<svg viewBox="0 0 24 24"><rect x="4" y="6" width="16" height="12" rx="6"/></svg><span>Tables</span>'
          : '<svg viewBox="0 0 24 24"><path d="M5 7h14M5 12h14M5 17h14"/></svg><span>List</span>'}</button>
      </footer>
      ${st.busy ? '<div class="tp-busy"><span class="pf-spinner"></span><span>Taking your seat…</span></div>' : ''}
    </div>`;
}

function draw() {
  if (!st) return;
  let el = document.getElementById('tpOverlay');
  if (!el) {
    el = document.createElement('div');
    el.id = 'tpOverlay';
    el.className = 'tp-overlay';
    el.addEventListener('click', onClick);
    document.body.appendChild(el);
  }
  el.innerHTML = html();
  const lim = el.querySelector('.tp-limit.on');
  if (lim) lim.scrollIntoView({ block: 'nearest', inline: 'center' });
}

async function onClick(e) {
  if (!st || st.busy) return;
  const t = e.target.closest('[data-tp],[data-tp-join],[data-tp-limit],[data-tp-step],[data-tp-full],[data-tp-free]');
  if (!t) return;
  const d = t.dataset;
  if (d.tp === 'back') return closeTablePicker();
  if (d.tp === 'view') { st.list = !st.list; return draw(); }
  if (d.tpLimit !== undefined) { st.limit = Number(d.tpLimit); return draw(); }
  if (d.tpStep !== undefined) { st.limit = Math.max(0, Math.min(st.limits.length - 1, st.limit + Number(d.tpStep))); return draw(); }
  if (d.tpFull !== undefined) { st.hideFull = d.tpFull === '1'; return draw(); }
  if (d.tpFree !== undefined) { st.minFree = Number(d.tpFree); return draw(); }
  if (d.tpJoin !== undefined) {
    const table = st.shownList && st.shownList[Number(d.tpJoin)];
    if (!table) return;
    const g = GAMES[st.game];
    st.busy = true; draw();
    try {
      if (table.fresh) await g.fresh(table.tier);
      else await g.join(table);
    } catch { /* the session shows its own message */ }
    closeTablePicker();
  }
}
