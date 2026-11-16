// Sign in / create account. One column: the logo, Google, or email.
import { STARTING_CHIPS } from '../roomLogic.js';
import { brandMark, esc } from '../uiHelpers.js';
import * as S from '../session.js';
import { goldDust } from '../goldDust.js';

// What the house offers, beside the sign-in: fine gold line icons.
const FEATURES = [
  ['<rect x="3" y="7" width="18" height="11" rx="5.5"/><path d="M8 12.5h8"/>', 'Live 3D tables', 'Six classic games, played live.'],
  ['<path d="M4 19c.6-3.2 3-5 6-5s5.4 1.8 6 5"/><circle cx="10" cy="8" r="3.2"/><path d="M17 11.5v5M14.5 14h5"/>', 'Private tables', 'Host a table and invite friends.'],
  ['<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21"/>', 'Voice chat', 'Talk at the table as you play.'],
  ['<rect x="4" y="9" width="16" height="11" rx="1.5"/><path d="M3 9h18V6.5H3zM12 6.5V20M12 6.5C10.2 3.4 7 3.6 7.3 5.6c.2 1 2.9.9 4.7.9zm0 0c1.8-3.1 5-2.9 4.7-.9-.2 1-2.9.9-4.7.9z"/>', 'Daily rewards', 'A bonus every day, a gift every level.'],
];
let stopDust = () => {};

const GOOGLE_ICON = '<svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true"><path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.9c1.7-1.57 2.7-3.87 2.7-6.62z"/><path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.9-2.26c-.8.54-1.84.86-3.06.86-2.35 0-4.34-1.59-5.05-3.72H.96v2.33A9 9 0 0 0 9 18z"/><path fill="#FBBC05" d="M3.95 10.7A5.4 5.4 0 0 1 3.67 9c0-.59.1-1.17.28-1.7V4.97H.96A9 9 0 0 0 0 9c0 1.45.35 2.83.96 4.03l2.99-2.33z"/><path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.9 11.43 0 9 0A9 9 0 0 0 .96 4.97l2.99 2.33C4.66 5.17 6.65 3.58 9 3.58z"/></svg>';


export function renderAuth() {
  const isSignup = S.authMode === 'signup';
  return `
    <main class="auth sx-auth">
      <div class="il-beams sx-beams" aria-hidden="true"><i></i><i></i></div>
      <section class="sx-brand">
        ${brandMark('auth-logo')}
        <span class="sx-rule" aria-hidden="true"></span>
        <p class="sx-games">Blackjack · Hold'em · Roulette · Baccarat · Craps · Slots</p>
        <ul class="sx-features">${FEATURES.map(([icon, title, line]) => `
          <li><span class="sx-ficon"><svg viewBox="0 0 24 24" aria-hidden="true">${icon}</svg></span><span><b>${title}</b><small>${line}</small></span></li>`).join('')}
        </ul>
      </section>
      <section class="panel auth-panel sx-card">
        <h1 class="sx-title">${isSignup ? 'Create your account' : 'Welcome to NVGR Casino'}</h1>
        <p class="sx-sub">Everyone starts with ${STARTING_CHIPS.toLocaleString()} chips.</p>
        <button class="btn btn-google" id="googleBtn" ${S.authBusy ? 'disabled' : ''}>${GOOGLE_ICON} Continue with Google</button>
        <button class="btn sx-guest" id="guestBtn" ${S.authBusy ? 'disabled' : ''}>Play as guest</button>
        <div class="or">or with email</div>
        <div class="segmented" role="tablist">
          <button class="seg ${!isSignup ? 'active' : ''}" id="tabSignin" role="tab" aria-selected="${!isSignup}">Sign in</button>
          <button class="seg ${isSignup ? 'active' : ''}" id="tabSignup" role="tab" aria-selected="${isSignup}">Create account</button>
        </div>
        ${isSignup ? `
          <div class="field">
            <label for="authName">Display name</label>
            <input id="authName" type="text" placeholder="How others see you" maxlength="20" autocomplete="nickname">
          </div>` : ''}
        <div class="field">
          <label for="authEmail">Email</label>
          <input id="authEmail" type="email" placeholder="you@example.com" autocomplete="email">
        </div>
        <div class="field">
          <label for="authPassword">Password</label>
          <input id="authPassword" type="password" placeholder="${isSignup ? 'At least 6 characters' : 'Your password'}" autocomplete="${isSignup ? 'new-password' : 'current-password'}">
        </div>
        ${S.formError ? '<p class="error-text">' + esc(S.formError) + '</p>' : ''}
        <button class="btn btn-primary btn-block" id="emailSubmitBtn" ${S.authBusy ? 'disabled' : ''}>${S.authBusy ? 'Please wait…' : (isSignup ? 'Create account' : 'Sign in')}</button>
        <p class="sx-fine">A guest's chips stay on this device. Sign in to keep them on every device.</p>
      </section>
      <footer class="sx-powered"><span></span>Powered by NVGR Casino<span></span></footer>
    </main>
  `;
}

export function attachAuth() {
  // The gold dust, started afresh with each drawing of the page.
  stopDust();
  stopDust = goldDust(document.querySelector('main.sx-auth'), { count: 46, className: 'gold-dust auth-dust' });
  const google = document.getElementById('googleBtn');
  if (google) google.onclick = S.signInGoogle;
  const guest = document.getElementById('guestBtn');
  if (guest) guest.onclick = S.signInGuest;
  document.getElementById('tabSignin').onclick = () => S.setAuthMode('signin');
  document.getElementById('tabSignup').onclick = () => S.setAuthMode('signup');
  const submit = () => {
    const email = document.getElementById('authEmail').value;
    const password = document.getElementById('authPassword').value;
    if (S.authMode === 'signup') {
      const name = document.getElementById('authName').value;
      S.signUpEmail(email, password, name);
    } else {
      S.signInEmail(email, password);
    }
  };
  document.getElementById('emailSubmitBtn').onclick = submit;
  // Enter in any field submits, as it would in any other sign-in form.
  document.querySelectorAll('.auth-panel input').forEach((el) => {
    el.onkeydown = (e) => { if (e.key === 'Enter') submit(); };
  });
}
