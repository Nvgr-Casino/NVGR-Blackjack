// Sign in. Sleek and quiet: the crest on one side; on the other three
// choices — Continue with Google, Log in, Create account — and a small
// Play as guest beneath. Log in and Create account each open their own
// form just below them, as a drop-down, one at a time.
import { brandMark, esc } from '../uiHelpers.js';
import * as S from '../session.js';
import { goldDust } from '../goldDust.js';

const GOOGLE_ICON = '<svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true"><path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.9c1.7-1.57 2.7-3.87 2.7-6.62z"/><path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.9-2.26c-.8.54-1.84.86-3.06.86-2.35 0-4.34-1.59-5.05-3.72H.96v2.33A9 9 0 0 0 9 18z"/><path fill="#FBBC05" d="M3.95 10.7A5.4 5.4 0 0 1 3.67 9c0-.59.1-1.17.28-1.7V4.97H.96A9 9 0 0 0 0 9c0 1.45.35 2.83.96 4.03l2.99-2.33z"/><path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.9 11.43 0 9 0A9 9 0 0 0 .96 4.97l2.99 2.33C4.66 5.17 6.65 3.58 9 3.58z"/></svg>';

// Which form is open: null, 'signin' or 'signup'.
let open = null;
let stopDust = () => {};

function form(mode) {
  const signup = mode === 'signup';
  return `
    <div class="sx-drop ${open === mode ? 'open' : ''}" ${open === mode ? '' : 'inert'}>
      <div class="sx-drop-inner">
        ${signup ? '<input id="authName" type="text" placeholder="Display name" maxlength="20" autocomplete="nickname" aria-label="Display name">' : ''}
        <input id="${signup ? 'authEmailUp' : 'authEmail'}" type="email" placeholder="Email" autocomplete="email" aria-label="Email">
        <input id="${signup ? 'authPasswordUp' : 'authPassword'}" type="password" placeholder="${signup ? 'Password, at least 6 characters' : 'Password'}" autocomplete="${signup ? 'new-password' : 'current-password'}" aria-label="Password">
        ${open === mode && S.formError ? '<p class="error-text">' + esc(S.formError) + '</p>' : ''}
        <button class="btn btn-primary btn-block sx-submit" data-submit="${mode}" ${S.authBusy ? 'disabled' : ''}>${S.authBusy && open === mode ? 'Please wait…' : (signup ? 'Create account' : 'Log in')}</button>
      </div>
    </div>`;
}

export function renderAuth() {
  return `
    <main class="auth sx-auth sx-min">
      <section class="sx-brand">${brandMark('auth-logo')}</section>
      <section class="panel auth-panel sx-card">
        <button class="btn btn-google" id="googleBtn" ${S.authBusy ? 'disabled' : ''}>${GOOGLE_ICON} Continue with Google</button>
        <button class="sx-choice ${open === 'signin' ? 'on' : ''}" data-open="signin" aria-expanded="${open === 'signin'}">Log in<i aria-hidden="true"></i></button>
        ${form('signin')}
        <button class="sx-choice ${open === 'signup' ? 'on' : ''}" data-open="signup" aria-expanded="${open === 'signup'}">Create account<i aria-hidden="true"></i></button>
        ${form('signup')}
        ${!open && S.formError ? '<p class="error-text">' + esc(S.formError) + '</p>' : ''}
        <button class="sx-guestlink" id="guestBtn" ${S.authBusy ? 'disabled' : ''}>Play as guest</button>
      </section>
    </main>
  `;
}

export function attachAuth() {
  // The gold dust, started afresh with each drawing of the page.
  stopDust();
  stopDust = goldDust(document.querySelector('main.sx-auth'), { count: 18, className: 'gold-dust auth-dust' });
  const google = document.getElementById('googleBtn');
  if (google) google.onclick = S.signInGoogle;
  const guest = document.getElementById('guestBtn');
  if (guest) guest.onclick = S.signInGuest;
  document.querySelectorAll('[data-open]').forEach((b) => {
    b.onclick = () => {
      open = open === b.dataset.open ? null : b.dataset.open;
      S.setAuthMode(open || 'signin');
      // The form opens after the page redraws; put the cursor in it.
      setTimeout(() => { const f = document.querySelector('.sx-drop.open input'); if (f) f.focus(); }, 260);
    };
  });
  const submit = (mode) => {
    if (mode === 'signup') {
      S.signUpEmail(document.getElementById('authEmailUp').value, document.getElementById('authPasswordUp').value, document.getElementById('authName').value);
    } else {
      S.signInEmail(document.getElementById('authEmail').value, document.getElementById('authPassword').value);
    }
  };
  document.querySelectorAll('[data-submit]').forEach((b) => { b.onclick = () => submit(b.dataset.submit); });
  // Enter in a field submits its form.
  document.querySelectorAll('.sx-drop input').forEach((el) => {
    el.onkeydown = (e) => { if (e.key === 'Enter') submit(el.closest('.sx-drop').querySelector('[data-submit]').dataset.submit); };
  });
}
