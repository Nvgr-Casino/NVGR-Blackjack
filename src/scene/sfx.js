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

import { ballRun } from '../roulette/spinPlan.js';

let context = null;
let master = null;     // everything
let effects = null;    // the table's own sounds, under master
let noise = null;
let reverbIn = null;   // the room: a little of every sound sent here comes back as its space
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
    // The room's own echo: a short, soft tail made from decaying noise, so
    // a chip or the ball has the space of a casino round it, not a booth.
    try {
      const len = Math.round(context.sampleRate * 1.8);
      const ir = context.createBuffer(2, len, context.sampleRate);
      for (let ch = 0; ch < 2; ch++) {
        const d = ir.getChannelData(ch);
        for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2);
      }
      const conv = context.createConvolver();
      conv.buffer = ir;
      reverbIn = context.createGain();
      const wet = context.createGain();
      wet.gain.value = 0.5;
      reverbIn.connect(conv).connect(wet).connect(master);
      const send = context.createGain();
      send.gain.value = 0.22;
      effects.connect(send).connect(reverbIn);
    } catch { reverbIn = null; }
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

// ---------- roulette ----------
// The spin is real recordings of a roulette wheel (Mixkit, free licence),
// laid along the spin's own plan (src/roulette/spinPlan.js) so what is
// heard is what is seen:
//   roulette-spin.mp3 — a whole short spin: the ball rolling on the rim
//     (0.15–2.85 s), its fall (3–6 s), and riding round in its pocket
//     (6.2–9.3 s);
//   roulette-drop.mp3 — the ball dropping off a diamond, clattering across
//     the frets and settling (3.4 s).
// The rolling stretch is looped through the ball's twenty-odd laps and
// slowed with it, so its lap rhythm and its pitch fall as the ball loses
// pace; the clatter starts as the ball strikes the diamond; the pocket's
// ride fades out once it is still.
let rlBuffers = null;
let rlLoading = null;
const ROLL_FROM = 0.15, ROLL_TO = 2.85;   // the rolling stretch of roulette-spin.mp3
const RIDE_FROM = 6.2, RIDE_LEN = 3.1;    // the ball riding in its pocket
/** Fetches and decodes the wheel's recordings, once. */
export function preloadRouletteSounds() {
  if (rlLoading) return rlLoading;
  const c = audio();
  if (!c) return Promise.resolve(null);
  const base = import.meta.env.BASE_URL + 'assets/sfx/';
  // The callback form of decodeAudioData, for older Safari.
  const load = (f) => fetch(base + f).then((r) => r.arrayBuffer()).then((b) => new Promise((res, rej) => c.decodeAudioData(b, res, rej)));
  rlLoading = Promise.all([load('roulette-spin.mp3'), load('roulette-drop.mp3')])
    .then(([spin, drop]) => { rlBuffers = { spin, drop }; return rlBuffers; })
    .catch(() => { rlLoading = null; return null; });
  return rlLoading;
}

/**
 * A spin, heard: started `elapsedMs` after the spin began (a player who
 * arrives mid-spin hears only what is left of it).
 */
export function rouletteSpinSound(plan, elapsedMs = 0) {
  const c = ready();
  if (!c) return;
  if (!rlBuffers) {
    // Not loaded yet: load, then play what is still to come.
    const asked = performance.now();
    preloadRouletteSounds().then((b) => { if (b) rouletteSpinSound(plan, elapsedMs + (performance.now() - asked)); });
    return;
  }
  const { spin, drop } = rlBuffers;
  const now = c.currentTime;
  const el = elapsedMs / 1000;
  const t0 = now - el;
  const at = (s) => Math.max(now, t0 + s);
  // The roll, until the ball strikes the diamond.
  const rollEnd = plan.TD + 0.12;
  if (el < rollEnd) {
    const src = c.createBufferSource();
    src.buffer = spin;
    src.loop = true;
    src.loopStart = ROLL_FROM;
    src.loopEnd = ROLL_TO;
    const g = c.createGain();
    src.connect(g).connect(effects);
    const from = at(0);
    g.gain.setValueAtTime(0, from);
    let first = true;
    for (let s = Math.max(0, el); s <= rollEnd; s += 0.25) {
      const { speed } = ballRun(plan, Math.min(s, plan.T2));
      const k = Math.max(0, Math.min(1, speed / plan.w0));
      // Slower laps, a lower and softer roll; down the track it thins.
      const rate = 0.72 + 0.36 * k;
      const onTrack = s > plan.T1 ? Math.max(0.4, 1 - (s - plan.T1) / plan.spiral) : 1;
      const level = (0.55 + 0.6 * k) * onTrack;
      const when = first ? from + 0.12 : at(s);
      first = false;
      src.playbackRate.linearRampToValueAtTime(rate, when);
      g.gain.linearRampToValueAtTime(level, when);
    }
    g.gain.linearRampToValueAtTime(0.0001, t0 + rollEnd + 0.08);
    src.start(from, ROLL_FROM + (el % (ROLL_TO - ROLL_FROM)));
    src.stop(t0 + rollEnd + 0.15);
  }
  // The fall: the diamond, the frets, the settle.
  if (el < plan.TD + drop.duration) {
    const src = c.createBufferSource();
    src.buffer = drop;
    const g = c.createGain();
    g.gain.value = 1.0;
    src.connect(g).connect(effects);
    src.start(at(plan.TD), Math.max(0, el - plan.TD));
  }
  // Still: the ball riding round in its pocket, fading.
  const rideAt = plan.T3 + 0.3;
  if (el < rideAt + RIDE_LEN) {
    const src = c.createBufferSource();
    src.buffer = spin;
    const g = c.createGain();
    const from = at(rideAt);
    const into = Math.max(0, el - rideAt);
    g.gain.setValueAtTime(0, from);
    g.gain.linearRampToValueAtTime(0.7, from + 0.3);
    g.gain.linearRampToValueAtTime(0.0001, from + RIDE_LEN - into);
    src.connect(g).connect(effects);
    src.start(from, RIDE_FROM + into, RIDE_LEN - into);
  }
}

// A bell, struck: a sine carrier rung by a modulator whose depth dies
// away, the way a struck bell's overtones die before its note.
function bell(c, at, freq, gain, bus = effects) {
  const car = c.createOscillator();
  car.frequency.value = freq;
  const mod = c.createOscillator();
  mod.frequency.value = freq * 3.5;
  const depth = c.createGain();
  depth.gain.setValueAtTime(freq * 2.2, at);
  depth.gain.exponentialRampToValueAtTime(1, at + 1.2);
  mod.connect(depth).connect(car.frequency);
  const g = c.createGain();
  g.gain.setValueAtTime(0, at);
  g.gain.linearRampToValueAtTime(gain, at + 0.004);
  g.gain.exponentialRampToValueAtTime(0.0001, at + 1.8);
  car.connect(g).connect(bus);
  car.start(at); mod.start(at);
  car.stop(at + 1.9); mod.stop(at + 1.9);
}

/** A win: bells rising over the clatter of chips pushed across. */
export function winChime() {
  const c = ready();
  if (!c) return;
  const at = c.currentTime + 0.05;
  [784, 988, 1175, 1568].forEach((f, i) => bell(c, at + i * 0.11, f, 0.035));
  chipSound(4, 350);
  chipSound(3, 520);
}

// The croupier's calls, in a voice from the device. Off with the sound.
let voice = null;
function pickVoice() {
  const s = window.speechSynthesis;
  if (!s) return null;
  const all = s.getVoices();
  return all.find((v) => /en-GB/i.test(v.lang) && /female|libby|sonia|serena|kate|hazel/i.test(v.name))
    || all.find((v) => /en-GB/i.test(v.lang))
    || all.find((v) => /^en/i.test(v.lang)) || null;
}
if (typeof window !== 'undefined' && window.speechSynthesis) {
  window.speechSynthesis.onvoiceschanged = () => { voice = pickVoice(); };
}
/** The croupier says `text`: "Place your bets", "No more bets", the number. */
export function croupierSay(text) {
  const s = typeof window !== 'undefined' && window.speechSynthesis;
  if (!s || !soundOn || document.hidden) return;
  if (!voice) voice = pickVoice();
  const u = new SpeechSynthesisUtterance(text);
  if (voice) u.voice = voice;
  u.rate = 0.92;
  u.pitch = 1;
  u.volume = 0.8;
  s.cancel();
  s.speak(u);
}

// ---------- music ----------
// Lounge jazz under the room: "Airport Lounge" by Kevin MacLeod
// (incompetech.com), licensed under Creative Commons Attribution 4.0
// (credited in public/assets/music/CREDITS.txt, the game's rules and the
// website). A real recording, streamed from the game's own files: the
// electric piano, bass and brushes this used to synthesise in the browser
// came out muddy. It plays through the sound's own chain, so the Sound
// switch silences it with everything else; it has its own switch too (on
// by default, remembered), fades in and out, and loops.
const MUSIC_URL = import.meta.env.BASE_URL + 'assets/music/airport-lounge.mp3';
let musicOn = (() => { try { return localStorage.getItem('nvgr-music') !== 'off'; } catch { return true; } })();
let musicBus = null;
let musicEl = null;
let musicSource = null;
const MUSIC_LEVEL = 0.2;
function startMusic() {
  const c = audio();
  if (!c || musicSource || !musicOn || document.hidden || c.state !== 'running') return;
  if (!musicEl) {
    musicEl = new Audio(MUSIC_URL);
    musicEl.loop = true;
    musicEl.preload = 'auto';
    musicBus = c.createGain();
    musicBus.gain.value = 0;
    c.createMediaElementSource(musicEl).connect(musicBus).connect(master);
  }
  musicBus.gain.cancelScheduledValues(c.currentTime);
  musicBus.gain.setValueAtTime(musicBus.gain.value, c.currentTime);
  musicBus.gain.linearRampToValueAtTime(MUSIC_LEVEL, c.currentTime + 3);
  musicSource = musicEl;
  const playing = musicEl.play();
  if (playing) playing.catch(() => { if (musicSource === musicEl) musicSource = null; });
}
function stopMusic() {
  const el = musicSource;
  musicSource = null;
  if (!el || !context) return;
  musicBus.gain.cancelScheduledValues(context.currentTime);
  musicBus.gain.setTargetAtTime(0, context.currentTime, 0.25);
  setTimeout(() => { if (!musicSource) el.pause(); }, 1200);
}
export const isMusicOn = () => musicOn;
export function setMusicOn(on) {
  musicOn = on;
  try { localStorage.setItem('nvgr-music', on ? 'on' : 'off'); } catch { /* private mode */ }
  if (on) startMusic(); else stopMusic();
}
// It starts with the first tap, as the sound does, and rests while the
// tab is out of sight.
['pointerdown', 'keydown', 'touchend'].forEach((e) => window.addEventListener(e, () => { if (musicOn && !musicSource) setTimeout(startMusic, 80); }, { passive: true }));
document.addEventListener('visibilitychange', () => { if (document.hidden) stopMusic(); else if (musicOn) startMusic(); });
