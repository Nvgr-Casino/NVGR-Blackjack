// Ported from index4.html's renderJoin/attachJoin — markup and behavior
// unchanged.
import { brandMark, esc } from '../uiHelpers.js';
import * as S from '../session.js';

export function renderJoin() {
  return `
    <div class="brand-hero compact">${brandMark('lobby')}</div>
    <p class="subtitle">Join a private table.</p>
    <div class="card-panel">
      <label for="joinCode">Table code</label>
      <input id="joinCode" type="text" placeholder="e.g. K7QP" maxlength="4" style="text-transform:uppercase;letter-spacing:2px;">
      ${S.formError ? '<p class="error-text">' + esc(S.formError) + '</p>' : ''}
      <button class="btn btn-solid" id="joinBtn">Join table</button>
      <div class="footer-link"><button id="backBtn">Back</button></div>
    </div>
  `;
}

export function attachJoin() {
  document.getElementById('joinBtn').onclick = () => S.joinRoom(document.getElementById('joinCode').value);
  document.getElementById('backBtn').onclick = () => S.goToScreen('home');
}
