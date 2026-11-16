// Sign in. Clean, on a royal blue that is easy on the eyes: the crest on
// one side; on the other a welcome and three ways in, alike in style —
// Continue with Google, Continue with email, Play as guest — the one used
// last marked as such; and the Terms and Privacy Policy beneath. Email
// opens its form in place: Log in or Create account, soft fields, one
// gold button, and a way back.
import { brandMark, esc } from '../uiHelpers.js';
import * as S from '../session.js';
import { openLegal } from '../legal.js';

const GOOGLE_ICON = '<svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true"><path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.9c1.7-1.57 2.7-3.87 2.7-6.62z"/><path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.9-2.26c-.8.54-1.84.86-3.06.86-2.35 0-4.34-1.59-5.05-3.72H.96v2.33A9 9 0 0 0 9 18z"/><path fill="#FBBC05" d="M3.95 10.7A5.4 5.4 0 0 1 3.67 9c0-.59.1-1.17.28-1.7V4.97H.96A9 9 0 0 0 0 9c0 1.45.35 2.83.96 4.03l2.99-2.33z"/><path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.9 11.43 0 9 0A9 9 0 0 0 .96 4.97l2.99 2.33C4.66 5.17 6.65 3.58 9 3.58z"/></svg>';
const MAIL_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5.5" width="18" height="13" rx="2.5"/><path d="M4 7.5l8 6 8-6"/></svg>';
const GUEST_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8.5" r="3.8"/><path d="M4.5 20c.8-4 3.8-6.2 7.5-6.2s6.7 2.2 7.5 6.2"/></svg>';
const BACK_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>';

let step = 'choose';   // 'choose' | 'email'
const lastMethod = () => { try { return localStorage.getItem('nvgr-last-method'); } catch { return null; } };
const remember = (m) => { try { localStorage.setItem('nvgr-last-method', m); } catch { /* private mode */ } };

function way(id, icon, label, method) {
  const last = lastMethod() === method;
  return `<button class="si-way" id="${id}" ${S.authBusy ? 'disabled' : ''}><span class="si-ic">${icon}</span><span class="si-label">${label}</span>${last ? '<span class="si-last">Last used</span>' : ''}</button>`;
}

function choose() {
  return `
    <h1 class="si-title">Welcome</h1>
    <p class="si-sub">Choose how you would like to play</p>
    <div class="si-ways">
      ${way('googleBtn', GOOGLE_ICON, 'Continue with Google', 'google')}
      ${way('emailWayBtn', MAIL_ICON, 'Continue with email', 'email')}
      ${way('guestBtn', GUEST_ICON, 'Play as guest', 'guest')}
    </div>
    ${S.formError ? '<p class="si-error">' + esc(S.formError) + '</p>' : ''}`;
}

function email() {
  const signup = S.authMode === 'signup';
  return `
    <div class="si-emailhead">
      <button class="si-back" id="siBack" aria-label="Back">${BACK_ICON}</button>
      <nav class="si-tabs" role="tablist">
        <button class="${!signup ? 'on' : ''}" id="tabSignin" role="tab" aria-selected="${!signup}">Log in</button>
        <button class="${signup ? 'on' : ''}" id="tabSignup" role="tab" aria-selected="${signup}">Create account</button>
      </nav>
    </div>
    <div class="si-fields">
      ${signup ? '<input id="authName" type="text" placeholder="Display name" maxlength="20" autocomplete="nickname" aria-label="Display name">' : ''}
      <input id="authEmail" type="email" placeholder="Email address" autocomplete="email" aria-label="Email address">
      <input id="authPassword" type="password" placeholder="${signup ? 'Password (6 characters or more)' : 'Password'}" autocomplete="${signup ? 'new-password' : 'current-password'}" aria-label="Password">
    </div>
    ${S.formError ? '<p class="si-error">' + esc(S.formError) + '</p>' : ''}
    <button class="si-go" id="emailSubmitBtn" ${S.authBusy ? 'disabled' : ''}>${S.authBusy ? 'Please wait…' : (signup ? 'Create account' : 'Log in')}</button>`;
}

export function renderAuth() {
  return `
    <main class="auth si">
      <section class="si-brand">${brandMark('si-logo')}</section>
      <section class="si-panel">
        ${step === 'email' ? email() : choose()}
        <p class="si-legal">By continuing, you agree to our <button data-legal="terms">Terms of Service</button> and <button data-legal="privacy">Privacy Policy</button>.</p>
      </section>
    </main>
  `;
}

export function attachAuth() {
  const on = (id, fn) => { const el = document.getElementById(id); if (el) el.onclick = fn; };
  on('googleBtn', () => { remember('google'); S.signInGoogle(); });
  on('guestBtn', () => { remember('guest'); S.signInGuest(); });
  on('emailWayBtn', () => { step = 'email'; S.setAuthMode('signin'); setTimeout(() => { const f = document.getElementById('authEmail'); if (f) f.focus(); }, 60); });
  on('siBack', () => { step = 'choose'; S.setAuthMode('signin'); });
  on('tabSignin', () => S.setAuthMode('signin'));
  on('tabSignup', () => S.setAuthMode('signup'));
  document.querySelectorAll('[data-legal]').forEach((b) => { b.onclick = () => openLegal(b.dataset.legal); });
  const submit = () => {
    remember('email');
    const em = document.getElementById('authEmail').value, pw = document.getElementById('authPassword').value;
    if (S.authMode === 'signup') S.signUpEmail(em, pw, document.getElementById('authName').value);
    else S.signInEmail(em, pw);
  };
  on('emailSubmitBtn', submit);
  document.querySelectorAll('.si-fields input').forEach((el) => { el.onkeydown = (e) => { if (e.key === 'Enter') submit(); }; });
}
