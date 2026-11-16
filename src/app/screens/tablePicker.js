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
// Each table drawn as a real one is built, from the outside in: a padded
// black leather rail with a gold inlay and a soft shadow, a mahogany trim,
// then navy baize with a fine grain and a pool of light, and the game's
// layout printed on it in fine gold. 400 by 260 units; seats sit on the
// rail, as fractions of that.
const VB_W = 400, VB_H = 260;
const RED_NUMS = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);
const WHEEL = [0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26];
const f = (n) => +n.toFixed(1);

// The shared paints, once per screen.
function defsSvg() {
  return `<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>
    <radialGradient id="tpdFelt" cx="50%" cy="46%" r="68%"><stop offset="0" stop-color="#2d5aae"/><stop offset="0.55" stop-color="#1a3d80"/><stop offset="1" stop-color="#0c2252"/></radialGradient>
    <radialGradient id="tpdLight" cx="50%" cy="42%" r="55%"><stop offset="0" stop-color="#fff" stop-opacity="0.16"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
    <linearGradient id="tpdLeather" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3b352f"/><stop offset="0.45" stop-color="#1b1815"/><stop offset="1" stop-color="#0a0908"/></linearGradient>
    <linearGradient id="tpdWood" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#8a4c25"/><stop offset="0.5" stop-color="#5a2c12"/><stop offset="1" stop-color="#3a1b0a"/></linearGradient>
    <linearGradient id="tpdGold" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f7de98"/><stop offset="0.55" stop-color="#d4a94f"/><stop offset="1" stop-color="#9c6f27"/></linearGradient>
    <filter id="tpdShadow" x="-10%" y="-10%" width="120%" height="135%"><feDropShadow dx="0" dy="10" stdDeviation="9" flood-color="#000" flood-opacity="0.6"/></filter>
    <filter id="tpdGrain" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="1.1" numOctaves="2" stitchTiles="stitch" result="n"/><feColorMatrix in="n" type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 0.09 0" result="g"/><feComposite in="g" in2="SourceGraphic" operator="in"/></filter>
    <path id="tpdArcBJ" d="M 96 28 A 104 104 0 0 0 304 28"/>
    <path id="tpdArcIns" d="M 135 28 A 65 65 0 0 0 265 28"/>
    <path id="tpdArcP" d="M 70 150 Q 200 236 330 150"/>
    <path id="tpdArcB" d="M 92 128 Q 200 206 308 128"/>
    <path id="tpdArcT" d="M 118 106 Q 200 172 282 106"/>
  </defs></svg>`;
}

// The rail, trim and felt for a shape: three outlines inset in turn.
function outline(shape, inset) {
  if (shape === 'moon') { const r = 188 - inset; return `M ${f(200 - r)} 28 A ${r} ${r} 0 0 0 ${f(200 + r)} 28 Z`; }
  const box = { oval: [8, 14, 384, 232, 116], track: [8, 24, 384, 212, 106], wheel: [8, 34, 384, 192, 40] }[shape];
  const [x, y, w, h, rx] = box;
  const X = x + inset, Y = y + inset, Wd = w - 2 * inset, Hd = h - 2 * inset, R = Math.max(4, rx - inset);
  return `M ${X + R} ${Y} H ${X + Wd - R} A ${R} ${R} 0 0 1 ${X + Wd} ${Y + R} V ${Y + Hd - R} A ${R} ${R} 0 0 1 ${X + Wd - R} ${Y + Hd} H ${X + R} A ${R} ${R} 0 0 1 ${X} ${Y + Hd - R} V ${Y + R} A ${R} ${R} 0 0 1 ${X + R} ${Y} Z`;
}

const T = (x, y, size, text, extra = '') => `<text x="${x}" y="${y}" text-anchor="middle" class="tp-print" font-size="${size}" ${extra}>${text}</text>`;

// What is printed on each game's felt.
function layout(game) {
  const gold = 'stroke="url(#tpdGold)" fill="none"';
  if (game === 'blackjack') {
    const spots = [-62, -31, 0, 31, 62].map((d) => {
      const a = d * Math.PI / 180, x = f(200 + 140 * Math.sin(a)), y = f(28 + 140 * Math.cos(a));
      return `<circle cx="${x}" cy="${y}" r="11.5" ${gold} stroke-width="1.4"/><circle cx="${x}" cy="${y}" r="8" stroke="rgba(247,222,152,0.35)" fill="none" stroke-width="0.8"/>`;
    }).join('');
    const colours = ['#e9e3d6', '#b3122e', '#1f4fa8', '#0f7a3c', '#111', '#e9e3d6', '#b3122e', '#1f4fa8'];
    const tray = colours.map((c, i) => `<rect x="${f(163 + i * 9.4)}" y="33" width="7.4" height="12" rx="1.5" fill="${c}" opacity="0.92"/>`).join('');
    return `<rect x="158" y="30" width="84" height="18" rx="3" fill="#060a16" stroke="url(#tpdGold)" stroke-width="1"/>${tray}
      <text class="tp-print" font-size="13" letter-spacing="2.5"><textPath href="#tpdArcBJ" startOffset="50%" text-anchor="middle">BLACKJACK PAYS 3 TO 2</textPath></text>
      <path d="M 127 28 A 73 73 0 0 0 273 28" ${gold} stroke-width="0.9" opacity="0.7"/><path d="M 143 28 A 57 57 0 0 0 257 28" ${gold} stroke-width="0.9" opacity="0.7"/>
      <text class="tp-print dim" font-size="6.6" letter-spacing="1.6"><textPath href="#tpdArcIns" startOffset="50%" text-anchor="middle">INSURANCE PAYS 2 TO 1</textPath></text>
      ${T(200, 66, 9, 'NVGR', 'letter-spacing="3"')}${spots}`;
  }
  if (game === 'holdem') {
    const cards = Array.from({ length: 5 }, (_, i) => `<rect x="${f(200 - 64 + i * 26)}" y="114" width="22" height="31" rx="3" fill="rgba(255,255,255,0.05)" stroke="rgba(247,222,152,0.55)" stroke-width="0.9"/>`).join('');
    return `<rect x="66" y="66" width="268" height="128" rx="64" ${gold} stroke-width="1" opacity="0.6"/>${T(200, 102, 9, 'NVGR', 'letter-spacing="3"')}${cards}${T(200, 168, 8, 'TEXAS HOLD&#8217;EM', 'letter-spacing="2.4"')}`;
  }
  if (game === 'baccarat') {
    return `<rect x="150" y="44" width="44" height="30" rx="4" ${gold} stroke-width="0.9" opacity="0.8"/><rect x="206" y="44" width="44" height="30" rx="4" ${gold} stroke-width="0.9" opacity="0.8"/>
      ${T(172, 63, 7, 'PLAYER')}${T(228, 63, 7, 'BANKER')}
      <use href="#tpdArcP" ${gold} stroke-width="1"/><use href="#tpdArcB" ${gold} stroke-width="1"/><use href="#tpdArcT" ${gold} stroke-width="1"/>
      <text class="tp-print" font-size="9" letter-spacing="2" dy="-4"><textPath href="#tpdArcP" startOffset="50%" text-anchor="middle">PLAYER</textPath></text>
      <text class="tp-print" font-size="9" letter-spacing="2" dy="-4"><textPath href="#tpdArcB" startOffset="50%" text-anchor="middle">BANKER 19 TO 20</textPath></text>
      <text class="tp-print dim" font-size="7.5" letter-spacing="2" dy="-4"><textPath href="#tpdArcT" startOffset="50%" text-anchor="middle">TIE 8 TO 1</textPath></text>`;
  }
  if (game === 'craps') {
    const nums = ['4', '5', 'SIX', '8', 'NINE', '10'].map((n, i) => `<rect x="${126 + i * 25}" y="74" width="23" height="20" rx="2" ${gold} stroke-width="0.8" opacity="0.75"/>${T(137.5 + i * 25, 87, n.length > 2 ? 5.4 : 8, n)}`).join('');
    return `<rect x="46" y="62" width="308" height="136" rx="68" ${gold} stroke-width="1.1" opacity="0.75"/><rect x="62" y="78" width="276" height="104" rx="52" ${gold} stroke-width="0.8" opacity="0.5"/>
      ${nums}<rect x="126" y="102" width="148" height="34" rx="4" ${gold} stroke-width="0.9" opacity="0.8"/>${T(200, 117, 8.5, 'FIELD', 'letter-spacing="2"')}${T(200, 129, 5.6, '2 &#183; 3 &#183; 4 &#183; 9 &#183; 10 &#183; 11 &#183; 12')}
      ${T(200, 193, 8, 'PASS LINE', 'letter-spacing="3"')}${T(200, 160, 7, 'DON&#8217;T PASS BAR', 'letter-spacing="1.6"')}`;
  }
  // Roulette: the wheel beside the number grid.
  const cx = 92, cy = 130, step = (2 * Math.PI) / 37;
  const p = (r, a) => `${f(cx + r * Math.cos(a))} ${f(cy + r * Math.sin(a))}`;
  const pockets = WHEEL.map((n, i) => {
    const a0 = i * step - Math.PI / 2, a1 = a0 + step, r0 = 33, r1 = 46;
    const col = n === 0 ? '#0f7a3c' : RED_NUMS.has(n) ? '#b3122e' : '#141418';
    return `<path d="M ${p(r0, a0)} L ${p(r1, a0)} A ${r1} ${r1} 0 0 1 ${p(r1, a1)} L ${p(r0, a1)} A ${r0} ${r0} 0 0 0 ${p(r0, a0)} Z" fill="${col}"/>`;
  }).join('');
  const gx = 172, gy = 82, cw = 16.5, ch = 25;
  let grid = `<rect x="${gx - 16}" y="${gy}" width="16" height="${ch * 3}" fill="#0f7a3c" opacity="0.85"/>`;
  for (let c = 0; c < 12; c++) for (let r = 0; r < 3; r++) {
    const n = c * 3 + (3 - r);
    grid += `<rect x="${f(gx + c * cw)}" y="${gy + r * ch}" width="${cw}" height="${ch}" fill="${RED_NUMS.has(n) ? '#b3122e' : '#141418'}" opacity="0.85"/>`;
  }
  grid += `<rect x="${gx - 16}" y="${gy}" width="${f(16 + cw * 12)}" height="${ch * 3}" ${gold} stroke-width="1"/>`;
  for (let c = 0; c <= 12; c++) grid += `<path d="M ${f(gx + c * cw)} ${gy} V ${gy + ch * 3}" stroke="rgba(247,222,152,0.55)" stroke-width="0.6"/>`;
  for (let r = 1; r < 3; r++) grid += `<path d="M ${gx} ${gy + r * ch} H ${f(gx + cw * 12)}" stroke="rgba(247,222,152,0.55)" stroke-width="0.6"/>`;
  grid += ['1ST 12', '2ND 12', '3RD 12'].map((t, i) => `<rect x="${f(gx + i * cw * 4)}" y="${gy + ch * 3 + 4}" width="${f(cw * 4)}" height="16" ${gold} stroke-width="0.8" opacity="0.8"/>${T(f(gx + i * cw * 4 + cw * 2), gy + ch * 3 + 15, 6.5, t)}`).join('');
  return `<circle cx="${cx}" cy="${cy}" r="62" fill="url(#tpdWood)" stroke="url(#tpdGold)" stroke-width="1.6"/><circle cx="${cx}" cy="${cy}" r="52" fill="#07090f"/>
    ${pockets}<circle cx="${cx}" cy="${cy}" r="46" fill="none" stroke="url(#tpdGold)" stroke-width="1"/><circle cx="${cx}" cy="${cy}" r="32" fill="url(#tpdWood)" stroke="url(#tpdGold)" stroke-width="1"/>
    <circle cx="${cx}" cy="${cy}" r="7" fill="url(#tpdGold)"/><path d="M ${cx - 16} ${cy} H ${cx + 16} M ${cx} ${cy - 16} V ${cy + 16}" stroke="url(#tpdGold)" stroke-width="2.4" stroke-linecap="round"/>
    <circle cx="${f(cx + 40 * Math.cos(-1))}" cy="${f(cy + 40 * Math.sin(-1))}" r="3" fill="#fbf6ea"/>${grid}`;
}

function tableSvg(game, shape) {
  const rail = outline(shape, 0), wood = outline(shape, 13), felt = outline(shape, 19);
  return `<svg class="tp-felt" viewBox="0 0 ${VB_W} ${VB_H}" aria-hidden="true">
    <path d="${rail}" fill="url(#tpdLeather)" filter="url(#tpdShadow)"/>
    <path d="${rail}" fill="none" stroke="rgba(255,255,255,0.07)" stroke-width="1"/>
    <path d="${wood}" fill="url(#tpdWood)" stroke="url(#tpdGold)" stroke-width="1.3"/>
    <path d="${felt}" fill="url(#tpdFelt)"/>
    <path d="${felt}" fill="#000" filter="url(#tpdGrain)"/>
    <path d="${felt}" fill="url(#tpdLight)"/>
    <path d="${felt}" fill="none" stroke="rgba(0,0,0,0.45)" stroke-width="2"/>
    ${layout(game)}
  </svg>`;
}

// Seats on the rail, as fractions of the picture.
function seatSpots(shape, n) {
  const P = (x, y) => [x / VB_W, y / VB_H];
  if (shape === 'moon') {
    return Array.from({ length: n }, (_, i) => { const a = (-76 + (152 * i) / (n - 1)) * Math.PI / 180; return P(200 + 181 * Math.sin(a), 28 + 181 * Math.cos(a)); });
  }
  if (shape === 'wheel') {
    const out = Array.from({ length: n - 1 }, (_, i) => P(176 + (190 * i) / (n - 2), 228));
    out.push(P(390, 130));
    return out;
  }
  if (shape === 'track') {
    const top = Math.ceil(n / 2), bottom = n - top;
    return [...Array.from({ length: top }, (_, i) => P(120 + (160 * i) / Math.max(1, top - 1), 26)),
      ...Array.from({ length: bottom }, (_, i) => P(120 + (160 * i) / Math.max(1, bottom - 1), 234))];
  }
  // Oval: round the bottom and the sides, the dealer's place at the top clear.
  const from = n >= 7 ? 12 : -20, to = n >= 7 ? 168 : 200;
  return Array.from({ length: n }, (_, i) => { const a = (from + ((to - from) * i) / (n - 1)) * Math.PI / 180; return P(200 + 190 * Math.cos(a), 130 + 114 * Math.sin(a)); });
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
        ${tableSvg(st.game, g.shape)}
        <button class="tp-board-hit" data-tp-join="${i}" aria-label="${free > 0 ? 'Join' : 'Watch'} this table"></button>
        ${seats}
      </div>
      <footer class="tp-meta"><span class="tp-meta-stakes">${esc(t.label)}</span><span class="tp-sep">·</span><span class="tp-dot ${status === 'Full' ? 'full' : t.seats.length ? 'on' : ''}"></span>${status}<span class="tp-sep">·</span>${t.seats.length} of ${g.seats} seats</footer>
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
    ${defsSvg()}
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
