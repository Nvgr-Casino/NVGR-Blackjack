// The curtain between the lobby and a table. Going in, it fades the floor
// to black with a word ("Taking your seat…") while the seat is found and
// the table's room is built behind it, then lifts on the table already
// standing. Coming back out it covers the change the same way. Without it
// the screen cut straight from one scene to the other, with a stall in the
// middle while the new room was put together.

import { LOGO_URL, esc } from './uiHelpers.js';

const FADE_MS = 320;
const HOLD_MS = 450;   // after the new screen is up, for the room to finish building

let el = null;
let lifting = null;
function ensure() {
  if (el) return el;
  el = document.createElement('div');
  el.className = 'curtain';
  el.innerHTML = `<img src="${LOGO_URL}" alt=""><span class="curtain-text"></span><span class="curtain-line"><i></i></span>`;
  document.body.appendChild(el);
  return el;
}

/** Fades the curtain down, with `text` on it. */
export function drop(text = '') {
  const c = ensure();
  clearTimeout(lifting);
  c.querySelector('.curtain-text').innerHTML = esc(text);
  c.classList.add('on');
}
/** Puts the curtain down at once (the screen has already changed under it). */
export function cover(text = '') {
  const c = ensure();
  clearTimeout(lifting);
  c.classList.add('instant');
  drop(text);
  void c.offsetWidth;
  c.classList.remove('instant');
}
/** Lifts it, once the new screen has had a moment to settle. */
export function lift(after = HOLD_MS) {
  if (!el || !el.classList.contains('on')) return;
  clearTimeout(lifting);
  // Two frames first, so the new scene has drawn at least once.
  requestAnimationFrame(() => requestAnimationFrame(() => {
    lifting = setTimeout(() => el.classList.remove('on'), after);
  }));
}
export const isDown = () => !!(el && el.classList.contains('on'));
export const CURTAIN_FADE_MS = FADE_MS;
