// The dice's sounds: the rattle in the shooter's hand, the crack off the
// back wall, the patter of the dice across the felt. Off with Sound.
import { audio, masterOut, isSoundOn } from './sfx.js';

let bus = null, noise = null;
function ready() {
  const c = audio();
  if (!c || !isSoundOn() || c.state !== 'running' || document.hidden) return null;
  if (!bus) {
    bus = c.createGain(); bus.gain.value = 0.8; bus.connect(masterOut());
    noise = c.createBuffer(1, c.sampleRate, c.sampleRate);
    const d = noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  return c;
}
function click(c, at, { freq = 3000, q = 3, gain = 0.08, decay = 0.03 } = {}) {
  const s = c.createBufferSource(); s.buffer = noise;
  const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q;
  const g = c.createGain();
  g.gain.setValueAtTime(gain, at); g.gain.exponentialRampToValueAtTime(0.0001, at + decay);
  s.connect(f).connect(g).connect(bus);
  s.start(at, Math.random() * 0.5, decay + 0.02);
}
/** The dice shaken and let go. */
export function diceShake() {
  const c = ready(); if (!c) return;
  const at = c.currentTime;
  for (let i = 0; i < 7; i++) click(c, at + i * 0.035 + Math.random() * 0.01, { freq: 2600 + Math.random() * 1200, gain: 0.05, decay: 0.02 });
}
/** The crack off the back wall. */
export function diceWall() {
  const c = ready(); if (!c) return;
  const at = c.currentTime;
  click(c, at, { freq: 1800, q: 1.4, gain: 0.14, decay: 0.05 });
  click(c, at + 0.018, { freq: 2400, q: 2, gain: 0.1, decay: 0.04 });
  click(c, at + 0.05, { freq: 900, q: 0.8, gain: 0.06, decay: 0.08 });
}
/** The dice tumbling across the felt to rest. */
export function diceTumble() {
  const c = ready(); if (!c) return;
  const at = c.currentTime;
  [0, 0.09, 0.2, 0.33, 0.42, 0.52].forEach((t, i) => click(c, at + t, { freq: 1200 + Math.random() * 600, q: 1, gain: 0.07 * (1 - i * 0.12), decay: 0.04 }));
}
