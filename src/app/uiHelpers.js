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

// Icons for the table's top bar, where on a phone the buttons are only these.
export const HUD_ICONS = {
  chat: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h16v11H9l-5 4V5z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>',
  seat: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7.5 3.5h9v8h-9zM5.5 11.5h13v3h-13zM7 14.5V21M17 14.5V21" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  drinks: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 4h12l-6 8-6-8zM12 12v7M8 20h8" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
};
