// Join a private table by its code. The lobby has the same field inline;
// this screen remains for anything that still routes here.
import { backBar, esc } from '../uiHelpers.js';
import * as S from '../session.js';

export function renderJoin() {
  return `
    ${backBar('backBtn', 'Join a table')}
    <main class="page page-narrow">
      <div class="page-head">
        <h1>Join a private table</h1>
        <p>Enter the four-letter code the host shared with you.</p>
      </div>
      <section class="panel">
        <div class="field">
          <label for="joinCode">Table code</label>
          <input id="joinCode" type="text" placeholder="e.g. K7QP" maxlength="4" autocomplete="off" style="text-transform:uppercase;letter-spacing:0.2em;">
        </div>
        ${S.formError ? '<p class="error-text">' + esc(S.formError) + '</p>' : ''}
        <button class="btn btn-primary btn-block" id="joinBtn">Join table</button>
      </section>
    </main>
  `;
}

export function attachJoin() {
  const input = document.getElementById('joinCode');
  const join = () => S.joinRoom(input.value);
  document.getElementById('joinBtn').onclick = join;
  input.onkeydown = (e) => { if (e.key === 'Enter') join(); };
  document.getElementById('backBtn').onclick = () => S.goToScreen('home');
}
