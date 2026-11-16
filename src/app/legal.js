// The Terms of Service and Privacy Policy in the app: a reading panel over
// whatever is showing, with a tab for each.
import { TERMS, PRIVACY } from './legalText.js';

let which = null;

export function openLegal(kind = 'terms') {
  which = kind;
  let el = document.getElementById('legalOverlay');
  if (!el) {
    el = document.createElement('div');
    el.id = 'legalOverlay';
    el.className = 'legal-overlay';
    el.addEventListener('click', (e) => {
      if (e.target === el || e.target.closest('[data-legal-close]')) { el.remove(); which = null; return; }
      const t = e.target.closest('[data-legal]');
      if (t) openLegal(t.dataset.legal);
    });
    document.body.appendChild(el);
  }
  el.innerHTML = `
    <div class="legal-card" role="dialog" aria-modal="true" aria-label="${which === 'privacy' ? 'Privacy Policy' : 'Terms of Service'}">
      <header class="legal-head">
        <nav class="legal-tabs">
          <button class="${which === 'terms' ? 'on' : ''}" data-legal="terms">Terms of Service</button>
          <button class="${which === 'privacy' ? 'on' : ''}" data-legal="privacy">Privacy Policy</button>
        </nav>
        <button class="legal-close" data-legal-close aria-label="Close"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg></button>
      </header>
      <article class="legal-body">${which === 'privacy' ? PRIVACY : TERMS}</article>
    </div>`;
  el.querySelector('.legal-body').scrollTop = 0;
}
