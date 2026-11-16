// Sign in. Clean and centred on deep navy: the crest and a title at the
// top, the main way in (Google) in the middle, marked if it is how you
// signed in last, and along the bottom three plain outlined choices:
// Continue as guest, Sign up with email, I have an email account. The
// email choices open their form in the middle, with a way back.
import { brandMark, esc } from '../uiHelpers.js';
import * as S from '../session.js';

const GOOGLE_ICON = '<svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true"><path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.9c1.7-1.57 2.7-3.87 2.7-6.62z"/><path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.9-2.26c-.8.54-1.84.86-3.06.86-2.35 0-4.34-1.59-5.05-3.72H.96v2.33A9 9 0 0 0 9 18z"/><path fill="#FBBC05" d="M3.95 10.7A5.4 5.4 0 0 1 3.67 9c0-.59.1-1.17.28-1.7V4.97H.96A9 9 0 0 0 0 9c0 1.45.35 2.83.96 4.03l2.99-2.33z"/><path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.9 11.43 0 9 0A9 9 0 0 0 .96 4.97l2.99 2.33C4.66 5.17 6.65 3.58 9 3.58z"/></svg>';

let view = 'choose';   // 'choose' | 'signin' | 'signup'
const lastMethod = () => { try { return localStorage.getItem('nvgr-last-method'); } catch { return null; } };
const remember = (m) => { try { localStorage.setItem('nvgr-last-method', m); } catch { /* private mode */ } };

function middle() {
  if (view === 'choose') {
    const last = lastMethod();
    return `
      <div class="reg-provider">
        <button class="reg-google" id="googleBtn" ${S.authBusy ? 'disabled' : ''}>${GOOGLE_ICON}<span>Continue with Google</span></button>
        ${last === 'google' ? '<span class="reg-last">Last sign-in method</span>' : ''}
      </div>
      ${S.formError ? '<p class="error-text reg-error">' + esc(S.formError) + '</p>' : ''}
      <p class="reg-fine">Chips are for play only and have no cash value.</p>`;
  }
  const signup = view === 'signup';
  return `
    <div class="reg-form">
      <h2>${signup ? 'Sign up with email' : 'Log in with email'}</h2>
      ${signup ? '<input id="authName" type="text" placeholder="Display name" maxlength="20" autocomplete="nickname" aria-label="Display name">' : ''}
      <input id="authEmail" type="email" placeholder="Email" autocomplete="email" aria-label="Email">
      <input id="authPassword" type="password" placeholder="${signup ? 'Password, at least 6 characters' : 'Password'}" autocomplete="${signup ? 'new-password' : 'current-password'}" aria-label="Password">
      ${S.formError ? '<p class="error-text reg-error">' + esc(S.formError) + '</p>' : ''}
      <button class="reg-submit" id="emailSubmitBtn" ${S.authBusy ? 'disabled' : ''}>${S.authBusy ? 'Please wait…' : (signup ? 'Create account' : 'Log in')}</button>
      <button class="reg-back" data-view="choose">Back</button>
    </div>`;
}

export function renderAuth() {
  return `
    <main class="auth sx-reg ${view === 'choose' ? '' : 'reg-email'}">
      <header class="reg-head">${brandMark('reg-logo')}<h1>${view === 'signup' ? 'Create account' : 'Sign in'}</h1></header>
      <section class="reg-main">${middle()}</section>
      ${view === 'choose' ? `
      <footer class="reg-row">
        <button class="reg-out reg-guest" id="guestBtn" ${S.authBusy ? 'disabled' : ''}>Continue as guest</button>
        <button class="reg-out" data-view="signup">Sign up with email</button>
        <button class="reg-out" data-view="signin">I have an email account</button>
      </footer>` : ''}
    </main>
  `;
}

export function attachAuth() {
  const google = document.getElementById('googleBtn');
  if (google) google.onclick = () => { remember('google'); S.signInGoogle(); };
  const guest = document.getElementById('guestBtn');
  if (guest) guest.onclick = () => { remember('guest'); S.signInGuest(); };
  document.querySelectorAll('[data-view]').forEach((b) => {
    b.onclick = () => {
      view = b.dataset.view;
      S.setAuthMode(view === 'signup' ? 'signup' : 'signin');
      setTimeout(() => { const f = document.querySelector('.reg-form input'); if (f) f.focus(); }, 50);
    };
  });
  const submit = () => {
    remember('email');
    const email = document.getElementById('authEmail').value;
    const password = document.getElementById('authPassword').value;
    if (view === 'signup') S.signUpEmail(email, password, document.getElementById('authName').value);
    else S.signInEmail(email, password);
  };
  const btn = document.getElementById('emailSubmitBtn');
  if (btn) btn.onclick = submit;
  document.querySelectorAll('.reg-form input').forEach((el) => { el.onkeydown = (e) => { if (e.key === 'Enter') submit(); }; });
}
