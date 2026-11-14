// The Seat button at the roulette and baccarat tables, as at blackjack: a
// chair and your seat's number; pressed, it opens out into every seat at
// the table, the taken ones named and closed, and a tap on a free one
// moves you there. Laid out as the chairs are seen from the players' side.

import { esc, HUD_ICONS } from './uiHelpers.js';
import * as S from './session.js';

let open = false;
let justOpened = false;

/**
 * `count` seats; `canMove` false while a move isn't allowed (bets on the
 * table, the ball rolling), with `why` saying so.
 */
export function seatPickerHtml(r, myKey, count, canMove, why = '') {
  const me = myKey && r.players && r.players[myKey];
  if (!me) return '';
  const owner = new Map(Object.entries(r.players || {}).map(([k, p]) => [p.seat, k]));
  const label = String(me.seat + 1);
  if (!open) {
    return `<button class="hud-btn seat-toggle" id="seatToggleBtn" title="Change seat" aria-label="Seat ${label} — change seat" aria-expanded="false">${HUD_ICONS.seat}<span class="seat-word">Seat</span><b>${label}</b></button>`;
  }
  const dots = Array.from({ length: count }, (_, i) => {
    const k = owner.get(i);
    const mine = k === myKey;
    const taken = k && !mine;
    const blocked = mine || taken || !canMove;
    const title = mine ? 'Your seat' : taken ? `${esc(r.players[k].name)} is in seat ${i + 1}` : !canMove ? why : `Move to seat ${i + 1}`;
    return `<button class="seat-dot${mine ? ' current' : ''}${taken ? ' taken' : ''}" data-move-seat="${i}" ${blocked ? 'disabled' : ''} title="${title}" aria-label="${title}">${i + 1}</button>`;
  }).join('');
  const html = `
    <div class="seat-dots open ${justOpened ? 'opening' : ''}" role="group" aria-label="Seat">
      <button class="seat-dot seat-close" id="seatToggleBtn" title="Close" aria-label="Close seats" aria-expanded="true">${HUD_ICONS.seat}</button>
      ${dots}
    </div>`;
  justOpened = false;
  return html;
}

export function attachSeatPicker(move) {
  const toggle = document.getElementById('seatToggleBtn');
  if (toggle) toggle.onclick = () => { open = !open; justOpened = open; S.refresh(); };
  document.querySelectorAll('[data-move-seat]').forEach((b) => {
    b.onclick = () => { open = false; move(Number(b.dataset.moveSeat)); S.refresh(); };
  });
}

/** Closed again on leaving the table. */
export function closeSeatPicker() { open = false; }
