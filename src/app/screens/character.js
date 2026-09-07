// Character picker: the candidates a player can sit down as.
import {
  CHARACTERS, characterPortraitDataURL, defaultCharacterFor,
  buildCharacterPortraits, hasPortraits,
} from '../../scene/character.js';
import { brandMark, esc } from '../uiHelpers.js';
import { safeKey } from '../roomLogic.js';
import * as S from '../session.js';

export function renderCharacter() {
  const current = S.session.character || defaultCharacterFor(S.session.uid ? safeKey(S.session.uid) : '');
  const group = (sex) => CHARACTERS.filter((c) => c.sex === sex).map((c) => `
    <button class="char-card ${c.id === current ? 'chosen' : ''}" data-character="${esc(c.id)}">
      <img class="char-portrait" src="${characterPortraitDataURL(c.id, 128)}" alt="${esc(c.name)}">
      <span class="char-name">${esc(c.name)}</span>
      ${c.id === current ? '<span class="char-tick">Selected</span>' : ''}
    </button>`).join('');

  return `
    <div class="brand-hero compact">${brandMark('lobby')}</div>
    <p class="subtitle">Choose your character</p>
    <p class="hint" style="margin-bottom:18px;">
      This is who takes your seat at the table.${hasPortraits() ? '' : ' Loading portraits…'}
    </p>
    <div class="lobby-section-title">Men</div>
    <div class="char-grid">${group('m')}</div>
    <div class="lobby-section-title">Women</div>
    <div class="char-grid">${group('f')}</div>
    <div class="footer-link"><button id="charBackBtn">Back to tables</button></div>
  `;
}

export function attachCharacter() {
  // Portraits are rendered from the real models the first time this screen
  // is opened; the redraw swaps the placeholder discs for the real ones.
  if (!hasPortraits()) buildCharacterPortraits().then(() => S.refresh()).catch(() => {});
  const back = document.getElementById('charBackBtn');
  if (back) back.onclick = () => S.goToScreen('home');
  document.querySelectorAll('[data-character]').forEach((btn) => {
    btn.onclick = () => S.chooseCharacter(btn.getAttribute('data-character'));
  });
}
