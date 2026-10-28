// Small shared bits used by more than one screen.
// nvgr-mark.png is the supplied artwork keyed to real transparency, so it
// sits cleanly on the dark page.
import logoUrl from '../assets/nvgr-mark.png';

export const LOGO_URL = logoUrl;

export function brandMark(className = '') {
  return `<img class="brand-mark ${className}" src="${logoUrl}" alt="NVGR Blackjack 21">`;
}

// The bar across the top of every screen below the lobby: one way back,
// and the name of where you are. Same place, same words, every time.
export function backBar(backId, title, right = '') {
  return `
    <header class="nav">
      <div class="nav-brand">
        <button class="nav-link nav-back" id="${backId}" aria-label="Back to tables">← Tables</button>
        <span class="nav-title">${title}</span>
      </div>
      <div class="nav-links">${right}</div>
    </header>`;
}

export function esc(s) {
  return (s || '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] || c));
}
