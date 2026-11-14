// Playing it like an app. Where the browser allows it (laptops, Android),
// the Fullscreen button takes the whole screen at once. An iPhone's Safari
// doesn't let a website go fullscreen, so there the button opens a short
// guide to adding NVGR Casino to the home screen — opened from there it
// runs full screen with its own icon, no browser bars (the manifest and
// the apple-mobile-web-app tags in index.html). On Android the browser's
// own install prompt is offered as well, when it has one.

import { esc } from './uiHelpers.js';

const root = document.documentElement;
const canFullscreen = !!(document.fullscreenEnabled || document.webkitFullscreenEnabled);
const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
/** Already running as an installed app (from the home screen). */
export const isApp = () => window.matchMedia('(display-mode: standalone)').matches
  || window.matchMedia('(display-mode: fullscreen)').matches || navigator.standalone === true;
const isFull = () => !!(document.fullscreenElement || document.webkitFullscreenElement);

let installPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); installPrompt = e; });
window.addEventListener('appinstalled', () => { installPrompt = null; closeGuide(); });

const ICON_FULL = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const ICON_EXIT = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const ICON_SHARE = '<svg viewBox="0 0 24 24" aria-hidden="true" width="18" height="18"><path d="M12 3v12M8 7l4-4 4 4M5 11v9h14v-9" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';

/** The button, with `cls` for the screen it sits on; nothing once it runs as an app. */
export function fullscreenButton(cls = 'hud-btn hud-icon') {
  if (isApp()) return '';
  const full = isFull();
  const label = full ? 'Exit full screen' : canFullscreen ? 'Full screen' : 'Play full screen';
  return `<button class="${cls} fs-btn" data-fullscreen title="${label}" aria-label="${label}">${full ? ICON_EXIT : ICON_FULL}</button>`;
}

export function attachFullscreen() {
  document.querySelectorAll('[data-fullscreen]').forEach((b) => { b.onclick = toggle; });
}

function toggle() {
  if (isFull()) {
    (document.exitFullscreen || document.webkitExitFullscreen).call(document);
    return;
  }
  if (canFullscreen && !isIOS) {
    const go = root.requestFullscreen || root.webkitRequestFullscreen;
    Promise.resolve(go.call(root, { navigationUI: 'hide' })).catch(() => {});
    // Some browsers refuse without saying so: if the screen hasn't gone
    // full in a moment, the guide offers the other ways.
    setTimeout(() => { if (!isFull()) openGuide(); }, 900);
    return;
  }
  openGuide();
}
// The button's look follows the screen in and out of full screen.
['fullscreenchange', 'webkitfullscreenchange'].forEach((ev) => document.addEventListener(ev, () => {
  document.querySelectorAll('[data-fullscreen]').forEach((b) => {
    const full = isFull();
    b.innerHTML = full ? ICON_EXIT : ICON_FULL;
    b.title = b.ariaLabel = full ? 'Exit full screen' : 'Full screen';
  });
}));

// ---------- the guide ----------
let guide = null;
function closeGuide() { if (guide) { guide.remove(); guide = null; } }
function openGuide() {
  closeGuide();
  guide = document.createElement('div');
  guide.className = 'fs-guide';
  const steps = isIOS
    ? `<ol class="fs-steps">
        <li>Tap <b>Share</b> <span class="fs-ico">${ICON_SHARE}</span> in Safari's bar</li>
        <li>Choose <b>Add to Home Screen</b></li>
        <li>Open <b>NVGR Casino</b> from your home screen — it plays full screen, like an app</li>
      </ol>`
    : `<ol class="fs-steps">
        <li>On a computer, press <b>F11</b> for full screen</li>
        <li>On a phone, open the browser's menu <b>⋮</b> and choose <b>Install app</b> or <b>Add to Home screen</b></li>
        <li>Open <b>NVGR Casino</b> from your home screen — it plays full screen, like an app</li>
      </ol>`;
  guide.innerHTML = `
    <div class="fs-card" role="dialog" aria-modal="true" aria-label="Play it like an app">
      <button class="fs-close" aria-label="Close">×</button>
      <span class="fs-kicker">NVGR Casino</span>
      <h2 class="fs-title">Play it like an app</h2>
      <p class="fs-line">${esc(isIOS ? 'Safari keeps its bars on websites. Add NVGR Casino to your home screen and it opens full screen, with its own icon.' : 'Install NVGR Casino and it opens full screen from your home screen, with its own icon.')}</p>
      ${installPrompt ? '<button class="btn btn-primary btn-lg fs-install">Install NVGR Casino</button>' : steps}
    </div>`;
  document.body.appendChild(guide);
  guide.querySelector('.fs-close').onclick = closeGuide;
  guide.onclick = (e) => { if (e.target === guide) closeGuide(); };
  const install = guide.querySelector('.fs-install');
  if (install) install.onclick = async () => {
    const p = installPrompt;
    installPrompt = null;
    p.prompt();
    await p.userChoice.catch(() => {});
    closeGuide();
  };
}
