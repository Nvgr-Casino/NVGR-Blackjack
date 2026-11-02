// A player's card at the table: tap someone's face in the players list and
// it opens beside them — who they are, their chips, and what you can do:
// ask them to be friends (nothing is sent until you press it), accept a
// request they've sent you, or mute their voice. Shared by both tables.

import { characterPortraitDataURL, defaultCharacterFor } from '../scene/character.js';
import { safeKey } from './roomLogic.js';
import { esc } from './uiHelpers.js';
import * as Social from './social.js';
import { voiceWith, setMuted } from './voice.js';
import * as S from './session.js';

let cardKey = null;
// Requests sent from this page, so the card can say so. (The other side's
// inbox isn't readable from here.)
const sent = new Set();

const me = () => safeKey(S.session.uid);

/** What makes a row in the players list open its card. */
export function playerCardAttrs(k) {
  if (k === me()) return '';
  return `data-player-card="${esc(k)}" role="button" tabindex="0" aria-haspopup="dialog"`;
}

export function closePlayerCard() { cardKey = null; }

export function playerCardSheet(r) {
  if (!cardKey || !r || !r.players || !r.players[cardKey]) { cardKey = null; return ''; }
  const k = cardKey;
  const p = r.players[k];
  const chips = r.game === 'holdem' ? p.stack : p.chips;
  const first = esc((p.name || 'Player').split(' ')[0]);
  let relation = '';
  let action = '';
  if (p.bot) {
    relation = 'A bot, playing for the house.';
  } else if (Social.isFriend(k)) {
    relation = '<span class="pc-friends">✓ Friends</span>';
  } else if (Social.requestPending(k)) {
    relation = `${first} wants to be your friend.`;
    action = `<button class="btn btn-primary" data-pc-accept>Accept friend request</button>`;
  } else if (sent.has(k) || Social.requestSent(k)) {
    relation = `Friend request sent. ${first} will see it in Friends.`;
  } else {
    relation = 'Friends can message each other, and talk by voice at any table.';
    action = `<button class="btn btn-primary" data-pc-add>Add friend</button>`;
  }
  const v = voiceWith(k);
  const voice = v ? `<button class="btn btn-quiet pc-voice" data-pc-mute>${v.muted ? 'Unmute voice' : 'Mute voice'}</button>` : '';
  return `
    <div class="pcard" role="dialog" aria-label="${esc(p.name)}" data-pc-for="${esc(k)}">
      <button class="pc-close" data-pc-close aria-label="Close">×</button>
      <div class="pc-head">
        <img class="pc-avatar" src="${characterPortraitDataURL(p.character || defaultCharacterFor(k), 96)}" alt="">
        <div class="pc-who">
          <span class="pc-name">${esc(p.name)}${p.bot ? ' <span class="role">BOT</span>' : ''}</span>
          <span class="pc-chips">${(chips || 0).toLocaleString()} chips</span>
        </div>
      </div>
      <p class="pc-relation">${relation}</p>
      ${action || voice ? `<div class="pc-actions">${action}${voice}</div>` : ''}
    </div>`;
}

export function attachPlayerCard() {
  document.querySelectorAll('[data-player-card]').forEach((el) => {
    const open = (e) => {
      // The mute badge in a row is its own button.
      if (e.target.closest('[data-voice-mute]')) return;
      const k = el.dataset.playerCard;
      cardKey = cardKey === k ? null : k;
      S.refresh();
    };
    el.onclick = open;
    el.onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(e); } };
  });
  const card = document.querySelector('.pcard');
  if (!card) return;
  // Beside the face it belongs to.
  const row = document.querySelector(`[data-player-card="${CSS.escape(card.dataset.pcFor)}"]`);
  if (row) {
    const top = Math.max(8, Math.min(row.getBoundingClientRect().top, window.innerHeight - card.offsetHeight - 8));
    card.style.top = top + 'px';
  }
  const k = card.dataset.pcFor;
  const r = S.session.room;
  const name = r && r.players && r.players[k] ? r.players[k].name : 'them';
  const on = (sel, fn) => { const b = card.querySelector(sel); if (b) b.onclick = fn; };
  on('[data-pc-close]', () => { cardKey = null; S.refresh(); });
  on('[data-pc-add]', async (e) => {
    e.currentTarget.disabled = true;
    try { await Social.sendFriendRequest(k, name); sent.add(k); } catch { e.currentTarget.disabled = false; }
    S.refresh();
  });
  on('[data-pc-accept]', async (e) => {
    e.currentTarget.disabled = true;
    try { await Social.acceptRequest(k, name); } catch { e.currentTarget.disabled = false; }
    S.refresh();
  });
  on('[data-pc-mute]', () => { const v = voiceWith(k); if (v) setMuted(k, !v.muted); });
}

// A tap anywhere else closes the card.
window.addEventListener('pointerdown', (e) => {
  if (!cardKey || !(e.target instanceof Element)) return;
  if (e.target.closest('.pcard') || e.target.closest('[data-player-card]')) return;
  cardKey = null;
  S.refresh();
}, true);
