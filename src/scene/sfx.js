// The table's sounds, kept quiet — the kind you hear without noticing:
// a soft swish and tap as each card lands, a light clack as chips go down,
// a riffle when the dealer shuffles. Made here with Web Audio from noise
// and short tones rather than recordings, so there is nothing to load and
// no two sounds are quite the same.
//
// One AudioContext for the whole page, shared with voice chat
// (src/app/voice.js), started on the player's first tap or click — browsers,
// phones above all, won't play sound before one. The player's Sound switch
// (on by default, remembered) turns all of it, voices included, on or off.

let context = null;
let master = null;     // everything
let effects = null;    // the table's own sounds, under master
let noise = null;
let soundOn = (() => { try { return localStorage.getItem('nvgr-sound') !== 'off'; } catch { return true; } })();
const listeners = new Set();

const EFFECTS_LEVEL = 0.9;

/** The page's AudioContext, made on first use. */
export function audio() {
  if (!context) {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    context = new Ctx();
    master = context.createGain();
    master.gain.value = soundOn ? 1 : 0;
    master.connect(context.destination);
    effects = context.createGain();
    effects.gain.value = EFFECTS_LEVEL;
    effects.connect(master);
    // A second of white noise, the raw material of every swish and clack.
    noise = context.createBuffer(1, context.sampleRate, context.sampleRate);
    const d = noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  return context;
}
/** Where voices are connected, so the Sound switch covers them too. */
export function masterOut() { audio(); return master; }

// The first gesture anywhere starts the sound.
// An iPhone can also leave it 'interrupted' (taking the mic, a call).
const unlock = () => { const c = audio(); if (c && c.state !== 'running' && c.state !== 'closed') c.resume().catch(() => {}); };
['pointerdown', 'keydown', 'touchend'].forEach((e) => window.addEventListener(e, unlock, { passive: true }));

export const isSoundOn = () => soundOn;
export function setSoundOn(on) {
  soundOn = on;
  try { localStorage.setItem('nvgr-sound', on ? 'on' : 'off'); } catch { /* private mode */ }
  if (master) master.gain.setTargetAtTime(on ? 1 : 0, context.currentTime, 0.05);
  listeners.forEach((fn) => fn(on));
}
export function onSoundChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }

// Only when it can be heard: started, switched on, and the tab in view.
function ready() {
  const c = audio();
  return c && soundOn && c.state === 'running' && !document.hidden ? c : null;
}

// A burst of filtered noise: `freq` and `q` shape it, `decay` how long it rings.
function burst(c, at, { freq, q = 1, gain, attack = 0.002, decay = 0.05, type = 'bandpass' }) {
  const src = c.createBufferSource();
  src.buffer = noise;
  src.playbackRate.value = 0.8 + Math.random() * 0.4;
  const f = c.createBiquadFilter();
  f.type = type;
  f.frequency.value = freq;
  f.Q.value = q;
  const g = c.createGain();
  g.gain.setValueAtTime(0, at);
  g.gain.linearRampToValueAtTime(gain, at + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, at + attack + decay);
  src.connect(f).connect(g).connect(effects);
  src.start(at, Math.random() * 0.5, attack + decay + 0.02);
}
// A short tone, falling away.
function ping(c, at, { freq, gain, decay = 0.06, type = 'sine' }) {
  const o = c.createOscillator();
  o.type = type;
  o.frequency.value = freq;
  const g = c.createGain();
  g.gain.setValueAtTime(gain, at);
  g.gain.exponentialRampToValueAtTime(0.0001, at + decay);
  o.connect(g).connect(effects);
  o.start(at);
  o.stop(at + decay + 0.02);
}

// Many chips landing at once (a payout) shouldn't be a burst of noise:
// at most one clack in each short window.
let lastChip = 0;

/** A card landing on the felt: the slide of it, and a soft tap. */
export function cardSound(delayMs = 0) {
  const c = ready();
  if (!c) return;
  const at = c.currentTime + delayMs / 1000;
  burst(c, at, { freq: 2400 + Math.random() * 1400, q: 0.7, gain: 0.07, attack: 0.012, decay: 0.07 });
  burst(c, at + 0.05, { freq: 900, q: 1.2, gain: 0.035, decay: 0.03, type: 'lowpass' });
}

/** Chips set down: one clack, or a short run of them for `count` chips. */
export function chipSound(count = 1, delayMs = 0) {
  const c = ready();
  if (!c) return;
  const now = performance.now() + delayMs;
  if (now - lastChip < 70) return;
  lastChip = now;
  const at = c.currentTime + delayMs / 1000;
  const n = Math.min(4, Math.max(1, count));
  for (let i = 0; i < n; i++) {
    const t = at + i * (0.028 + Math.random() * 0.02);
    ping(c, t, { freq: 2600 + Math.random() * 1200, gain: 0.03, decay: 0.045, type: 'triangle' });
    burst(c, t, { freq: 4200 + Math.random() * 1500, q: 4, gain: 0.05, decay: 0.02 });
  }
}

/**
 * The shuffler in a poker table at work for `ms`: a muffled motor hum
 * under the patter of cards being riffled inside it, and a soft clunk as
 * the elevator brings the deck up. Quieter than anything dealt in the open.
 */
export function shufflerSound(ms = 1500, delayMs = 0) {
  const c = ready();
  if (!c) return;
  const at = c.currentTime + delayMs / 1000;
  const dur = ms / 1000;
  const src = c.createBufferSource();
  src.buffer = noise;
  src.loop = true;
  const f = c.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.value = 420;
  f.Q.value = 2;
  const g = c.createGain();
  g.gain.setValueAtTime(0, at);
  g.gain.linearRampToValueAtTime(0.05, at + 0.15);
  g.gain.setValueAtTime(0.05, at + dur - 0.2);
  g.gain.linearRampToValueAtTime(0, at + dur);
  src.connect(f).connect(g).connect(effects);
  src.start(at);
  src.stop(at + dur + 0.05);
  // The cards inside, heard through the lid.
  const count = Math.round(ms / 45);
  for (let i = 0; i < count; i++) {
    const t = at + 0.2 + (i / count) * (dur - 0.4);
    burst(c, t, { freq: 1500 + Math.random() * 900, q: 1.2, gain: 0.012, decay: 0.015, type: 'lowpass' });
  }
  ping(c, at + dur + 0.25, { freq: 150, gain: 0.05, decay: 0.12 });
}

/** A riffle: cards falling into each other for `ms`. */
export function riffleSound(ms = 900, delayMs = 0) {
  const c = ready();
  if (!c) return;
  const at = c.currentTime + delayMs / 1000;
  const count = Math.round(ms / 28);
  for (let i = 0; i < count; i++) {
    const t = at + (i / count) * (ms / 1000) * (0.85 + Math.random() * 0.3);
    burst(c, t, { freq: 3000 + Math.random() * 2500, q: 1.5, gain: 0.025, attack: 0.002, decay: 0.018 });
  }
  burst(c, at + ms / 1000, { freq: 700, q: 1, gain: 0.04, decay: 0.05, type: 'lowpass' });
}
