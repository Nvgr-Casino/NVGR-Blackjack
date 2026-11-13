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
// A panned, filtered noise source running from `at` for `dur` seconds,
// returned so its filter, gain and pan can be shaped.
function loopNoise(c, at, dur, { type = 'bandpass', freq = 1000, q = 1 } = {}) {
  const src = c.createBufferSource();
  src.buffer = noise;
  src.loop = true;
  src.playbackRate.value = 0.9 + Math.random() * 0.2;
  const f = c.createBiquadFilter();
  f.type = type;
  f.frequency.value = freq;
  f.Q.value = q;
  const g = c.createGain();
  g.gain.value = 0;
  const pan = c.createStereoPanner ? c.createStereoPanner() : null;
  src.connect(f).connect(g);
  if (pan) g.connect(pan).connect(effects); else g.connect(effects);
  src.start(at);
  src.stop(at + dur + 0.05);
  return { f, g, pan };
}
// A hard little knock: a click of noise and a short resonant ring, as a
// ball strikes metal or lacquer.
function knock(c, at, { ring = 3600, gain = 0.05, decay = 0.04, pan = 0 }) {
  const src = c.createBufferSource();
  src.buffer = noise;
  const f = c.createBiquadFilter();
  f.type = 'bandpass';
  f.frequency.value = ring;
  f.Q.value = 9;
  const g = c.createGain();
  g.gain.setValueAtTime(0, at);
  g.gain.linearRampToValueAtTime(gain, at + 0.001);
  g.gain.exponentialRampToValueAtTime(0.0001, at + decay);
  const p = c.createStereoPanner ? c.createStereoPanner() : null;
  src.connect(f).connect(g);
  if (p) { p.pan.value = pan; g.connect(p).connect(effects); } else g.connect(effects);
  src.start(at, Math.random() * 0.5, decay + 0.02);
  ping(c, at, { freq: ring * (0.5 + Math.random() * 0.1), gain: gain * 0.35, decay: decay * 0.8, type: 'triangle' });
}

// The wooden bowl's voice: the resonances a ball rolling in it sets
// ringing — what makes a real wheel sound like a wheel and not like hiss.
const BOWL_MODES = [[240, 14, 1], [470, 14, 0.7], [790, 13, 0.45], [1180, 12, 0.25]];
function bowl(c, at, dur, panned = true) {
  const src = c.createBufferSource();
  src.buffer = noise;
  src.loop = true;
  const drive = c.createGain();
  drive.gain.value = 0;
  const sum = c.createGain();
  sum.gain.value = 1;
  BOWL_MODES.forEach(([f, q, level]) => {
    const bp = c.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = f;
    bp.Q.value = q;
    const g = c.createGain();
    g.gain.value = level;
    drive.connect(bp).connect(g).connect(sum);
  });
  const pan = panned && c.createStereoPanner ? c.createStereoPanner() : null;
  src.connect(drive);
  if (pan) sum.connect(pan).connect(effects); else sum.connect(effects);
  src.start(at);
  src.stop(at + dur + 0.1);
  return { drive, pan };
}

/**
 * A spin, heard as at a real table, following the spin's own plan
 * (src/roulette/spinPlan.js) so every sound lands on what is seen: the
 * croupier's flick; the ball rolling round the wooden bowl — its
 * resonances rumbling under it, swelling and fading once
 * a lap as it passes, slowing lap by lap for its twenty-odd laps; the
 * rotor's low turning under it; the chatter as it runs down the track, the
 * clink off a brass diamond; then a clack for every bounce, sized to the
 * hop, quicker and softer each time; and its little roll in the pocket.
 * Timed from the spin's start, so a player arriving mid-spin hears only
 * what is left of it.
 */
export function rouletteSpinSound(plan, elapsedMs = 0) {
  const c = ready();
  if (!c || elapsedMs / 1000 >= plan.T3 + 0.5) return;
  const now = c.currentTime;
  const t0 = now - elapsedMs / 1000;
  const at = (s) => t0 + s;
  const from = Math.max(now, t0);
  const end = at(plan.T3 + 1.5);
  // The ball let go: a soft tick from the croupier's fingers.
  if (t0 >= now - 0.05) knock(c, t0 + 0.03, { ring: 2200, gain: 0.025, decay: 0.05 });
  // The rotor, turning low under it all.
  const rotor = loopNoise(c, from, end - from, { type: 'lowpass', freq: 170, q: 0.8 });
  rotor.g.gain.setValueAtTime(0, from);
  rotor.g.gain.linearRampToValueAtTime(0.05, from + 0.6);
  rotor.g.gain.linearRampToValueAtTime(0.03, end - 1);
  rotor.g.gain.linearRampToValueAtTime(0.0001, end);
  // The roll: the wooden bowl rumbling under the ball, swelling and
  // fading once a lap as it passes, panned round with it, slowing.
  const rollEnd = at(plan.T2);
  if (from < rollEnd) {
    const wood = bowl(c, from, rollEnd - from + 0.3);
    const lfo = c.createOscillator();
    const lapDepth = c.createGain();
    lapDepth.gain.value = 0.3;
    const panDepth = c.createGain();
    panDepth.gain.value = 0.55;
    lfo.connect(lapDepth);
    lfo.connect(panDepth);
    lapDepth.connect(wood.drive.gain);
    if (wood.pan) panDepth.connect(wood.pan.pan);
    for (let s = Math.max(0, elapsedMs / 1000); s <= plan.T2 + 0.001; s += 0.25) {
      const { speed } = ballRun(plan, s);
      const k = Math.max(0, speed / plan.w0);
      const when = Math.max(from, at(s));
      const onTrack = s > plan.T1 ? Math.max(0.35, 1 - (s - plan.T1) / plan.spiral) : 1;
      wood.drive.gain.linearRampToValueAtTime(0.2 * Math.pow(k, 0.7) * onTrack + 0.04, when);
      lfo.frequency.linearRampToValueAtTime(speed / (Math.PI * 2), when);
    }
    wood.drive.gain.linearRampToValueAtTime(0.0001, rollEnd + 0.2);
    lfo.start(from);
    lfo.stop(rollEnd + 0.3);
  }
  // Down the track: a chatter of small knocks thickening, then the diamond.
  for (let s = plan.T1 + 0.1; s < plan.TD; s += 0.07 + Math.random() * 0.09) {
    if (at(s) >= now) knock(c, at(s), { ring: 3800 + Math.random() * 2000, gain: 0.006 + 0.01 * ((s - plan.T1) / plan.spiral), decay: 0.018, pan: Math.random() * 0.8 - 0.4 });
  }
  if (at(plan.TD) >= now) {
    knock(c, at(plan.TD), { ring: 3150, gain: 0.07, decay: 0.2, pan: -0.15 });
    knock(c, at(plan.TD) + 0.002, { ring: 5900, gain: 0.03, decay: 0.12, pan: -0.15 });
    burst(c, at(plan.TD), { freq: 380, q: 1, gain: 0.05, decay: 0.07, type: 'lowpass' });
  }
  // The bounces: a clack where the ball comes down, the size of the hop it
  // came down from, a skitter after it.
  plan.hops.forEach((hop, i) => {
    const t = at(hop.t0);
    if (t < now) return;
    const fall = i === 0 ? 0.035 : plan.hops[i - 1].h;
    const loud = Math.min(1, fall / 0.03);
    const pan = Math.random() * 0.7 - 0.35;
    knock(c, t, { ring: 4100 + Math.random() * 1300, gain: 0.075 * loud + 0.012, decay: 0.05, pan });
    knock(c, t + 0.001, { ring: 1350 + Math.random() * 300, gain: 0.03 * loud + 0.006, decay: 0.07, pan });
    const skitter = i < 2 ? 2 : 1;
    for (let k = 1; k <= skitter; k++) knock(c, t + k * (0.028 + Math.random() * 0.02), { ring: 5200 + Math.random() * 1500, gain: 0.014 * loud, decay: 0.02, pan });
  });
  // Settled: a short roll in the pocket, two last small clicks.
  const settle = Math.max(now, at(plan.T3));
  const roll = bowl(c, settle, 0.8, false);
  roll.drive.gain.setValueAtTime(0.0001, settle);
  roll.drive.gain.linearRampToValueAtTime(0.05, settle + 0.04);
  roll.drive.gain.exponentialRampToValueAtTime(0.0001, settle + 0.7);
  [0.08, 0.2].forEach((d, i) => { if (at(plan.T3 + d) >= now) knock(c, at(plan.T3 + d), { ring: 4600, gain: 0.012 / (i + 1), decay: 0.025 }); });
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
// Quiet lounge jazz under the room: an electric piano comping two eight-bar
// sets of changes, a walking bass, brushes on the snare and a whisper of
// ride, a soft pad beneath. Played live, note by note, it broke up
// whenever the page was busy drawing the room, so it is rendered once, in
// the background (an OfflineAudioContext), into a loop of a little under a
// minute whose tail is folded back into its head, and played from that:
// seamless, and costing next to nothing. Its own switch (on by default,
// remembered), and the Sound switch silences it with everything else.
let musicOn = (() => { try { return localStorage.getItem('nvgr-music') !== 'off'; } catch { return true; } })();
let musicBus = null;
let musicBuffer = null;
let musicBuilding = null;
let musicSource = null;
const MUSIC_LEVEL = 0.3;
const BPM = 72;
const BEAT = 60 / BPM;
const BARS = 16;
const midi = (n) => 440 * Math.pow(2, (n - 69) / 12);
// Two progressions in F, eight bars each: ii–V–I–vi, then IV–iii–ii–V.
const CHANGES = [
  [{ bass: 43, notes: [58, 62, 65, 69] }, { bass: 48, notes: [58, 64, 69, 74] }, { bass: 41, notes: [57, 60, 64, 67] }, { bass: 50, notes: [53, 57, 60, 64] }],
  [{ bass: 46, notes: [57, 62, 65, 69] }, { bass: 45, notes: [55, 60, 64, 67] }, { bass: 43, notes: [58, 62, 65, 69] }, { bass: 48, notes: [58, 64, 67, 72] }],
];
const chordAt = (bar) => CHANGES[Math.floor(bar / 8) % CHANGES.length][Math.floor((bar % 8) / 2)];

function epiano(c, bus, at, n, gain) {
  const f = midi(n);
  const car = c.createOscillator();
  car.frequency.value = f;
  const mod = c.createOscillator();
  mod.frequency.value = f;
  const depth = c.createGain();
  depth.gain.setValueAtTime(f * 1.3, at);
  depth.gain.exponentialRampToValueAtTime(f * 0.04, at + 0.5);
  mod.connect(depth).connect(car.frequency);
  const lp = c.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 2300;
  const g = c.createGain();
  g.gain.setValueAtTime(0, at);
  g.gain.linearRampToValueAtTime(gain, at + 0.008);
  g.gain.exponentialRampToValueAtTime(gain * 0.35, at + 0.6);
  g.gain.exponentialRampToValueAtTime(0.0001, at + 2.4);
  car.connect(lp).connect(g).connect(bus);
  car.start(at); mod.start(at);
  car.stop(at + 2.5); mod.stop(at + 2.5);
}
function bassNote(c, bus, at, n, gain) {
  const o = c.createOscillator();
  o.type = 'triangle';
  o.frequency.value = midi(n);
  const lp = c.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 520;
  const g = c.createGain();
  g.gain.setValueAtTime(0, at);
  g.gain.linearRampToValueAtTime(gain, at + 0.02);
  g.gain.exponentialRampToValueAtTime(gain * 0.4, at + 0.25);
  g.gain.exponentialRampToValueAtTime(0.0001, at + BEAT * 0.95);
  o.connect(lp).connect(g).connect(bus);
  o.start(at);
  o.stop(at + BEAT);
}
function brush(c, bus, buf, at, gain, long, rand) {
  const src = c.createBufferSource();
  src.buffer = buf;
  const f = c.createBiquadFilter();
  f.type = long ? 'bandpass' : 'highpass';
  f.frequency.value = long ? 3800 : 7500;
  f.Q.value = 0.6;
  const g = c.createGain();
  g.gain.setValueAtTime(0, at);
  g.gain.linearRampToValueAtTime(gain, at + (long ? 0.05 : 0.004));
  g.gain.exponentialRampToValueAtTime(0.0001, at + (long ? 0.28 : 0.07));
  src.connect(f).connect(g).connect(bus);
  src.start(at, rand() * 0.5, 0.35);
}
function pad(c, bus, at, notes, dur) {
  notes.forEach((n) => {
    [-6, 6].forEach((cents) => {
      const o = c.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = midi(n - 12);
      o.detune.value = cents;
      const lp = c.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 700;
      const g = c.createGain();
      g.gain.setValueAtTime(0, at);
      g.gain.linearRampToValueAtTime(0.006, at + dur * 0.4);
      g.gain.linearRampToValueAtTime(0.0001, at + dur);
      o.connect(lp).connect(g).connect(bus);
      o.start(at);
      o.stop(at + dur + 0.05);
    });
  });
}
function playBeat(c, bus, buf, at, i, rand) {
  const bar = Math.floor(i / 4), beat = i % 4;
  const chord = chordAt(bar);
  const next = chordAt(bar + 1);
  const swing = BEAT * 0.66;
  const walk = [chord.bass, chord.bass + (rand() < 0.5 ? 7 : 4), chord.bass + (rand() < 0.5 ? 12 : 10), next.bass + (rand() < 0.5 ? -1 : 1)];
  bassNote(c, bus, at, walk[beat], beat === 0 ? 0.17 : 0.13);
  if (beat === 1 || beat === 3) brush(c, bus, buf, at, 0.016, true, rand);
  brush(c, bus, buf, at, 0.006, false, rand);
  if (rand() < 0.6) brush(c, bus, buf, at + swing, 0.004, false, rand);
  const onChord = bar % 2 === 0 && beat === 0;
  const push = beat === 1 && rand() < 0.45;
  if (onChord || push) {
    const notes = chord.notes.map((n) => n + (rand() < 0.2 ? 12 : 0));
    const when = push ? at + swing : at;
    notes.forEach((n, k) => epiano(c, bus, when + k * 0.012, n, push ? 0.022 : 0.03));
  }
  if (bar % 2 === 0 && beat === 0) pad(c, bus, at, chord.notes, BEAT * 8);
}
// Renders the loop once; the same promise for anyone who asks again.
function buildMusic() {
  if (musicBuilding) return musicBuilding;
  const Offline = window.OfflineAudioContext || window.webkitOfflineAudioContext;
  if (!Offline) return Promise.resolve(null);
  const sr = 44100;
  const dur = BARS * 4 * BEAT;
  const tail = 3;
  const oc = new Offline(2, Math.ceil((dur + tail) * sr), sr);
  const buf = oc.createBuffer(1, sr, sr);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  // A little room, baked in.
  const len = Math.round(sr * 1.6);
  const ir = oc.createBuffer(2, len, sr);
  for (let ch = 0; ch < 2; ch++) { const x = ir.getChannelData(ch); for (let i = 0; i < len; i++) x[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3); }
  const conv = oc.createConvolver();
  conv.buffer = ir;
  const wet = oc.createGain();
  wet.gain.value = 0.3;
  const bus = oc.createGain();
  bus.connect(oc.destination);
  bus.connect(conv).connect(wet).connect(oc.destination);
  let seed = 7;
  const rand = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  for (let i = 0; i < BARS * 4; i++) playBeat(oc, bus, buf, i * BEAT, i, rand);
  musicBuilding = oc.startRendering().then((rendered) => {
    // The tail, rung on past the loop's end, laid back over its start, so
    // the join cannot be heard.
    const n = Math.ceil(dur * sr);
    const out = new AudioBuffer({ numberOfChannels: 2, length: n, sampleRate: sr });
    for (let ch = 0; ch < 2; ch++) {
      const src = rendered.getChannelData(ch), dst = out.getChannelData(ch);
      for (let i = 0; i < n; i++) dst[i] = src[i] + (i + n < src.length ? src[i + n] : 0);
    }
    musicBuffer = out;
    return out;
  }).catch(() => null);
  return musicBuilding;
}
async function startMusic() {
  const c = audio();
  if (!c || musicSource || !musicOn || document.hidden || c.state !== 'running') return;
  const buffer = musicBuffer || await buildMusic();
  if (!buffer || musicSource || !musicOn || document.hidden) return;
  if (!musicBus) {
    musicBus = c.createGain();
    musicBus.connect(master);
  }
  const src = c.createBufferSource();
  src.buffer = buffer;
  src.loop = true;
  src.connect(musicBus);
  musicBus.gain.cancelScheduledValues(c.currentTime);
  musicBus.gain.setValueAtTime(0, c.currentTime);
  musicBus.gain.linearRampToValueAtTime(MUSIC_LEVEL, c.currentTime + 3);
  src.start();
  musicSource = src;
}
function stopMusic() {
  const src = musicSource;
  musicSource = null;
  if (!src || !context) return;
  musicBus.gain.cancelScheduledValues(context.currentTime);
  musicBus.gain.setTargetAtTime(0, context.currentTime, 0.25);
  src.stop(context.currentTime + 1.2);
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
