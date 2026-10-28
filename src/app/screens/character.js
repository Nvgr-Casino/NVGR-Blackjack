// Character picker: the candidates a player can sit down as.
import {
  CHARACTERS, characterPortraitDataURL, defaultCharacterFor,
  buildCharacterPortraits, hasPortraits,
} from '../../scene/character.js';
import { backBar, esc } from '../uiHelpers.js';
import { safeKey } from '../roomLogic.js';
import * as S from '../session.js';

export function renderCharacter() {
  const current = S.session.character || defaultCharacterFor(S.session.uid ? safeKey(S.session.uid) : '');
  const group = (sex) => CHARACTERS.filter((c) => c.sex === sex).map((c) => `
    <button class="char-card ${c.id === current ? 'chosen' : ''}" data-character="${esc(c.id)}" aria-pressed="${c.id === current}">
      <img class="char-portrait" src="${characterPortraitDataURL(c.id, 128)}" alt="">
      <span class="char-name">${esc(c.name)}</span>
      ${c.id === current ? '<span class="char-tick">Selected</span>' : ''}
    </button>`).join('');

  return `
    ${backBar('charBackBtn', 'Character')}
    <main class="page">
      <div class="page-head">
        <h1>Choose your character</h1>
        <p>This is who sits in your seat at the table.${hasPortraits() ? '' : ' Portraits are loading…'}</p>
      </div>
      <div class="section-head"><h2>Men</h2></div>
      <div class="char-grid">${group('m')}</div>
      <div class="section">
        <div class="section-head"><h2>Women</h2></div>
        <div class="char-grid">${group('f')}</div>
      </div>
    </main>
  `;
}

export function attachCharacter() {
  // Portraits are rendered from the real models the first time this screen
  // opens, and the grid redraws as each one lands.
  if (!hasPortraits()) buildCharacterPortraits(192, () => S.refresh()).catch(() => {});
  const back = document.getElementById('charBackBtn');
  if (back) back.onclick = () => S.goToScreen('home');
  document.querySelectorAll('[data-character]').forEach((btn) => {
    btn.onclick = () => S.chooseCharacter(btn.getAttribute('data-character'));
  });
}
