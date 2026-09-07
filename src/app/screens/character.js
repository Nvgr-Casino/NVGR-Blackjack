// Character picker: the candidates a player can sit down as.
import { CHARACTERS, characterPortraitDataURL, defaultCharacterFor } from '../../scene/character.js';
import { brandMark, esc } from '../uiHelpers.js';
import { safeKey } from '../roomLogic.js';
import * as S from '../session.js';

export function renderCharacter() {
  const current = S.session.character || defaultCharacterFor(S.session.uid ? safeKey(S.session.uid) : '');
  const cards = CHARACTERS.map((c) => `
    <button class="char-card ${c.id === current ? 'chosen' : ''}" data-character="${esc(c.id)}">
      <img class="char-portrait" src="${characterPortraitDataURL(c.id, 128)}" alt="${esc(c.name)}">
      <span class="char-name">${esc(c.name)}</span>
      ${c.id === current ? '<span class="char-tick">Selected</span>' : ''}
    </button>`).join('');

  return `
    <div class="brand-hero compact">${brandMark('lobby')}</div>
    <p class="subtitle">Choose your character</p>
    <p class="hint" style="margin-bottom:18px;">This is who takes your seat at the table.</p>
    <div class="char-grid">${cards}</div>
    <div class="footer-link"><button id="charBackBtn">Back to tables</button></div>
  `;
}

export function attachCharacter() {
  const back = document.getElementById('charBackBtn');
  if (back) back.onclick = () => S.goToScreen('home');
  document.querySelectorAll('[data-character]').forEach((btn) => {
    btn.onclick = () => S.chooseCharacter(btn.getAttribute('data-character'));
  });
}
