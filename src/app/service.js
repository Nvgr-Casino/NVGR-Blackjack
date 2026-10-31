// Drinks and tips at the tables, for both games.
//
// A player orders from the menu for themselves or for anyone at the table,
// or tips the dealer. Each is written into the room as an event in
// `room.service` — so every client sees the same waiter walk up with the
// same glass, or the same chip go to the dealer — and a drink also into
// `room.drinks`, which keeps what stands in each player's cup holder for
// anyone arriving later. scene/service.js draws it all.
//
// Paying: at a blackjack cash table your chips on the table are your
// balance, so it comes off them. At a poker table or a tournament it comes
// off your balance, not your stack — a stack is in play, and tournament
// chips aren't money. At a table against bots it's on the house.

import { safeKey, seatOf as bjSeatOf, stakesFor, MAX_PUBLIC_SEATS } from './roomLogic.js';
import { DRINKS } from '../scene/drinks.js';
import { characterPortraitDataURL, defaultCharacterFor } from '../scene/character.js';
import { esc } from './uiHelpers.js';
import * as S from './session.js';

export const MENU = [
  { id: 'water', price: 0 },
  { id: 'cola', price: 100 },
  { id: 'beer', price: 250 },
  { id: 'wine', price: 500 },
  { id: 'mojito', price: 750 },
  { id: 'whiskey', price: 1000 },
  { id: 'martini', price: 1500 },
  { id: 'champagne', price: 5000 },
];
const priceOf = (id) => (MENU.find((d) => d.id === id) || { price: 0 }).price;
const hex = (n) => '#' + n.toString(16).padStart(6, '0');

const isPoker = (r) => r && r.game === 'holdem';
const me = () => safeKey(S.session.uid);

/** Where this table's drinks and tips are paid from: 'table', 'account' or 'free'. */
export function payer(r) {
  if (!r || r.offline) return 'free';
  if (!isPoker(r) && !r.tournament) return 'table';
  return 'account';
}
function funds(r) {
  const pay = payer(r);
  if (pay === 'free') return Infinity;
  if (pay === 'table') { const p = r.players && r.players[me()]; return p ? p.chips : 0; }
  return S.session.chips || 0;
}

/** The seat a player is in at either table, or -1. */
export function seatOfKey(r, key) {
  if (!r || !r.players || !r.players[key]) return -1;
  return isPoker(r) ? r.players[key].seat : bjSeatOf(r, key);
}
const seatCount = (r) => (isPoker(r) ? 6 : MAX_PUBLIC_SEATS);

// Pays `price` for something done in `apply(room)` inside the room's own
// update, so the two can't come apart at a blackjack table, where the
// chips are in the room. From the account it is taken first, and put back
// if the room refuses.
async function pay(price, apply) {
  const r = S.session.room;
  if (!r) return false;
  const how = payer(r);
  if (price > funds(r)) { S.setFormError(`That costs ${price.toLocaleString()} — you have ${funds(r).toLocaleString()}.`); return false; }
  if (how === 'account' && price) {
    S.session.chips -= price;
    await S.saveAccountChips(S.session.uid, S.session.name, S.session.chips);
  }
  let done = false;
  await S.mutateRoom(S.session.code, (room) => {
    if (how === 'table' && price) {
      const p = room.players && room.players[me()];
      if (!p || p.chips < price) return;
      p.chips -= price;
    }
    apply(room);
    done = true;
  });
  if (!done && how === 'account' && price) {
    S.session.chips += price;
    await S.saveAccountChips(S.session.uid, S.session.name, S.session.chips);
  }
  return done;
}

function event(room, e) {
  room.service = (room.service || []).concat({ id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), at: Date.now(), ...e }).slice(-12);
}

/** Orders `drinkId` for `toKey` (this player, or anyone at the table). */
export async function orderDrink(drinkId, toKey = me()) {
  const r = S.session.room;
  if (!r || !DRINKS[drinkId] || !r.players || !r.players[toKey]) return false;
  const from = me();
  const fromName = S.session.name;
  const name = DRINKS[drinkId].name;
  return pay(priceOf(drinkId), (room) => {
    if (!room.players || !room.players[toKey]) return;
    room.drinks = room.drinks || {};
    room.drinks[toKey] = drinkId;
    event(room, { kind: 'drink', drink: drinkId, to: toKey, from });
    const line = toKey === from ? `${fromName} orders a ${name.toLowerCase()}.` : `${fromName} buys ${room.players[toKey].name} a ${name.toLowerCase()}.`;
    room.log = (room.log || []).concat(line).slice(-8);
  });
}

/** The tips this table offers: its minimum bet or big blind, and multiples. */
export function tipAmounts(r) {
  const base = payer(r) === 'table' ? stakesFor(r).min : isPoker(r) && !r.tournament ? r.bb : 1000;
  return [1, 5, 25].map((k) => k * base);
}

export async function tipDealer(amount) {
  const fromName = S.session.name;
  const from = me();
  return pay(amount, (room) => {
    room.tips = (room.tips || 0) + amount;
    event(room, { kind: 'tip', amount, from });
    room.log = (room.log || []).concat(`${fromName} tips the dealer ${amount.toLocaleString()}. Thank you!`).slice(-8);
  });
}

// ---------- the 3D table ----------

let service = null;
let seenFor = null;
const seen = new Set();

export function mountService(handles) { service = handles.service || null; }

/**
 * Brings the table up to date with the room: what stands in each cup
 * holder, and any order or tip since last time played out (a waiter, a
 * chip). Events already there when the table is first shown are just
 * drawn as they are.
 */
export function syncService(r) {
  if (!service || !r) return;
  const game = isPoker(r) ? 'holdem' : 'blackjack';
  const fresh = seenFor !== r.code + game;
  if (fresh) { seen.clear(); seenFor = r.code + game; }
  (r.service || []).forEach((e) => {
    if (seen.has(e.id)) return;
    seen.add(e.id);
    if (fresh || Date.now() - e.at > 30000) return;
    if (e.kind === 'drink') {
      const seat = seatOfKey(r, e.to);
      if (seat >= 0) service.deliver(game, seat, e.drink);
    } else if (e.kind === 'tip') {
      const seat = seatOfKey(r, e.from);
      if (seat >= 0) service.tip(game, seat, e.amount);
    }
  });
  const bySeat = {};
  Object.entries(r.drinks || {}).forEach(([k, type]) => {
    const seat = seatOfKey(r, k);
    if (seat >= 0) bySeat[seat] = type;
  });
  service.setDrinks(game, bySeat);
}

/** Leaves the table's holders empty (when its room is no longer shown). */
export function clearService() {
  if (!service) return;
  service.setDrinks('blackjack', {});
  service.setDrinks('holdem', {});
  seenFor = null;
}

// ---------- the panel ----------

let open = false;
let forKey = null;

export function serviceButton() {
  return `<button class="hud-btn ${open ? 'active' : ''}" id="serviceToggleBtn">Drinks</button>`;
}

export function serviceSheet(r) {
  if (!open || !r) return '';
  const mine = me();
  if (!r.players || !r.players[mine]) return '';
  if (!forKey || !r.players[forKey]) forKey = mine;
  const how = payer(r);
  const myseat = seatOfKey(r, mine);
  const n = seatCount(r);
  const beside = (k) => {
    const s = seatOfKey(r, k);
    const d = Math.abs(s - myseat);
    return d === 1 || (isPoker(r) && d === n - 1);
  };
  const others = Object.keys(r.players).filter((k) => k !== mine && seatOfKey(r, k) >= 0)
    .sort((a, b) => Number(beside(b)) - Number(beside(a)));
  const who = [mine, ...others].map((k) => {
    const p = r.players[k];
    return `<button class="svc-who ${forKey === k ? 'on' : ''}" data-svc-for="${esc(k)}">
      <img src="${characterPortraitDataURL(p.character || defaultCharacterFor(k), 48)}" alt="">
      <span>${k === mine ? 'You' : esc(p.name.split(' ')[0])}${k !== mine && beside(k) ? '<small>beside you</small>' : ''}</span>
    </button>`;
  }).join('');
  const have = funds(r);
  const menu = MENU.map((d) => {
    const spec = DRINKS[d.id];
    const price = how === 'free' ? 0 : d.price;
    return `<button class="svc-drink" data-svc-drink="${d.id}" ${price > have ? 'disabled' : ''}>
      <span class="svc-dot" style="background:${hex(spec.color)}"></span>
      <span class="svc-name">${esc(spec.name)}</span>
      <span class="svc-price">${price ? price.toLocaleString() : 'Free'}</span>
    </button>`;
  }).join('');
  const tips = tipAmounts(r).map((a) => `<button class="btn btn-sm" data-svc-tip="${a}" ${how !== 'free' && a > have ? 'disabled' : ''}>${a.toLocaleString()}</button>`).join('');
  const note = how === 'table' ? 'Paid from your chips on the table.' : how === 'account' ? `Paid from your balance (${(S.session.chips || 0).toLocaleString()}), not your ${r.tournament ? 'tournament chips' : 'stack'}.` : 'On the house at a table against bots.';
  return `
    <div class="sheet svc">
      <div class="sheet-title">Drinks</div>
      <div class="svc-for">${who}</div>
      <div class="svc-menu">${menu}</div>
      <div class="sheet-title" style="margin-top:14px;">Tip the dealer</div>
      <div class="dock-actions svc-tips">${tips}</div>
      <p class="svc-note">${esc(note)}</p>
    </div>`;
}

export function attachService() {
  const toggle = document.getElementById('serviceToggleBtn');
  if (toggle) toggle.onclick = () => { open = !open; if (open && S.chatOpen) S.setChatOpen(false); else S.refresh(); };
  document.querySelectorAll('[data-svc-for]').forEach((b) => { b.onclick = () => { forKey = b.dataset.svcFor; S.refresh(); }; });
  document.querySelectorAll('[data-svc-drink]').forEach((b) => {
    b.onclick = async () => { b.disabled = true; if (await orderDrink(b.dataset.svcDrink, forKey || me())) { open = false; S.refresh(); } else b.disabled = false; };
  });
  document.querySelectorAll('[data-svc-tip]').forEach((b) => {
    b.onclick = async () => { b.disabled = true; if (await tipDealer(Number(b.dataset.svcTip))) { open = false; S.refresh(); } else b.disabled = false; };
  });
  // Opening the chat closes this.
  const chat = document.getElementById('chatToggleBtn');
  if (chat && open) chat.addEventListener('click', () => { open = false; }, { once: true });
}
