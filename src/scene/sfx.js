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
      const len = Math.round(context.sampleRate * 2.2);
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

/**
 * The wheel spun and the ball sent round, as heard at the table: the
 * croupier's flick; the ball's run round the black lacquer track — a
 * bright whirr over a soft rumble, circling from one ear to the other once
 * a lap, slowing lap by lap; its fall — a clack off a diamond, then bounces
 * across the gold frets, each sooner and softer than the last — and the
 * rattle of it settling, while the wheel turns on under it. Timed from the
 * spin's start, so a player arriving mid-spin hears only what is left.
 */
export function rouletteSpinSound(totalMs, landMs, elapsedMs = 0) {
  const c = ready();
  if (!c || elapsedMs >= landMs + 600) return;
  const now = c.currentTime;
  const t0 = now - elapsedMs / 1000;
  const drop = t0 + (landMs * 0.72) / 1000;
  const land = t0 + landMs / 1000;
  const end = t0 + totalMs / 1000;
  const from = Math.max(now, t0);
  // The flick that sends the ball.
  if (t0 >= now - 0.05) {
    const flick = loopNoise(c, t0, 0.35, { type: 'bandpass', freq: 900, q: 1.5 });
    flick.f.frequency.setValueAtTime(900, t0);
    flick.f.frequency.exponentialRampToValueAtTime(4200, t0 + 0.25);
    flick.g.gain.setValueAtTime(0, t0);
    flick.g.gain.linearRampToValueAtTime(0.05, t0 + 0.05);
    flick.g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.32);
    knock(c, t0 + 0.02, { ring: 2400, gain: 0.04, decay: 0.05 });
  }
  // The rotor turning, low and steady, fading as it slows.
  const rotor = loopNoise(c, from, end - from + 0.5, { type: 'lowpass', freq: 220, q: 0.7 });
  rotor.g.gain.setValueAtTime(0, from);
  rotor.g.gain.linearRampToValueAtTime(0.045, from + 0.5);
  rotor.g.gain.linearRampToValueAtTime(0.012, end);
  rotor.g.gain.linearRampToValueAtTime(0.0001, end + 0.5);
  // The ball's run: a whirr and a rumble, panned round once a lap — the
  // laps slowing from about three a second to one.
  if (from < drop) {
    const whirr = loopNoise(c, from, drop - from + 0.3, { type: 'bandpass', freq: 5200, q: 3.5 });
    whirr.f.frequency.setValueAtTime(5200, t0);
    whirr.f.frequency.exponentialRampToValueAtTime(2200, drop);
    whirr.g.gain.setValueAtTime(0, from);
    whirr.g.gain.linearRampToValueAtTime(0.05, from + 0.2);
    whirr.g.gain.exponentialRampToValueAtTime(0.012, drop);
    whirr.g.gain.linearRampToValueAtTime(0.0001, drop + 0.2);
    const rumble = loopNoise(c, from, drop - from + 0.3, { type: 'lowpass', freq: 700, q: 1.2 });
    rumble.f.frequency.setValueAtTime(700, t0);
    rumble.f.frequency.exponentialRampToValueAtTime(320, drop);
    rumble.g.gain.setValueAtTime(0, from);
    rumble.g.gain.linearRampToValueAtTime(0.07, from + 0.3);
    rumble.g.gain.exponentialRampToValueAtTime(0.02, drop);
    rumble.g.gain.linearRampToValueAtTime(0.0001, drop + 0.25);
    if (whirr.pan) {
      const lfo = c.createOscillator();
      lfo.frequency.setValueAtTime(3, t0);
      lfo.frequency.exponentialRampToValueAtTime(0.9, drop);
      const depth = c.createGain();
      depth.gain.value = 0.7;
      lfo.connect(depth);
      depth.connect(whirr.pan.pan);
      depth.connect(rumble.pan.pan);
      lfo.start(from);
      lfo.stop(drop + 0.3);
    }
    // Now and then the ball skips on the track.
    for (let t = Math.max(from, t0 + 0.8); t < drop - 0.3; t += 0.5 + Math.random() * 0.9) {
      knock(c, t, { ring: 5200 + Math.random() * 1500, gain: 0.01, decay: 0.02, pan: Math.random() * 1.2 - 0.6 });
    }
  }
  // The fall: off a diamond, then across the frets.
  let t = drop;
  let gap = 0.2;
  let loud = 1;
  if (t >= now) knock(c, t, { ring: 1900, gain: 0.08, decay: 0.09, pan: -0.2 });
  t += 0.12;
  while (t < land) {
    if (t >= now) {
      const pan = Math.random() * 0.8 - 0.4;
      knock(c, t, { ring: 3400 + Math.random() * 1600, gain: 0.06 * loud, decay: 0.045, pan });
      // A little rattle after each bounce.
      for (let r = 1; r <= 2; r++) knock(c, t + r * 0.022, { ring: 4800 + Math.random() * 1500, gain: 0.015 * loud, decay: 0.02, pan });
    }
    t += gap;
    gap *= 0.78;
    loud *= 0.86;
    if (gap < 0.035) break;
  }
  // Settling, the ball rolling a little in its pocket.
  [0.04, 0.1, 0.17, 0.26].forEach((d, i) => {
    const at = land + d;
    if (at >= now) knock(c, at, { ring: 4200 + i * 250, gain: 0.018 / (i + 1), decay: 0.025 });
  });
  const roll = loopNoise(c, Math.max(now, land), 0.6, { type: 'bandpass', freq: 2600, q: 2 });
  roll.g.gain.setValueAtTime(0, Math.max(now, land));
  roll.g.gain.linearRampToValueAtTime(0.012, Math.max(now, land) + 0.05);
  roll.g.gain.exponentialRampToValueAtTime(0.0001, Math.max(now, land) + 0.55);
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
// Quiet lounge jazz under the room, made as it plays: an electric piano
// comping four-bar changes, a walking bass, brushes on the snare and a
// whisper of ride, a soft pad beneath. Never the same twice — the voicings
// lean, the bass walks its own way, the comping shifts — and kept low,
// under the table's own sounds. Its own switch (on by default,
// remembered), and the Sound switch silences it with everything else.
let musicOn = (() => { try { return localStorage.getItem('nvgr-music') !== 'off'; } catch { return true; } })();
let musicBus = null;
let musicTimer = null;
let nextBeat = 0;
let beatIndex = 0;
const MUSIC_LEVEL = 0.32;
const BPM = 72;
const BEAT = 60 / BPM;
const midi = (n) => 440 * Math.pow(2, (n - 69) / 12);
// Two progressions in F, eight bars each: ii–V–I–vi, then IV–iii–ii–V.
const CHANGES = [
  [{ bass: 43, notes: [58, 62, 65, 69] }, { bass: 48, notes: [58, 64, 69, 74] }, { bass: 41, notes: [57, 60, 64, 67] }, { bass: 50, notes: [53, 57, 60, 64] }],
  [{ bass: 46, notes: [57, 62, 65, 69] }, { bass: 45, notes: [55, 60, 64, 67] }, { bass: 43, notes: [58, 62, 65, 69] }, { bass: 48, notes: [58, 64, 67, 72] }],
];
function chordAt(bar) {
  const prog = CHANGES[Math.floor(bar / 8) % CHANGES.length];
  return prog[Math.floor((bar % 8) / 2)];
}
// An electric piano's note: a bell-like tine over a warm body.
function epiano(c, at, n, gain) {
  const f = midi(n);
  const car = c.createOscillator();
  car.frequency.value = f;
  const mod = c.createOscillator();
  mod.frequency.value = f;
  const depth = c.createGain();
  depth.gain.setValueAtTime(f * 1.4, at);
  depth.gain.exponentialRampToValueAtTime(f * 0.05, at + 0.5);
  mod.connect(depth).connect(car.frequency);
  const lp = c.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 2400;
  const g = c.createGain();
  g.gain.setValueAtTime(0, at);
  g.gain.linearRampToValueAtTime(gain, at + 0.008);
  g.gain.exponentialRampToValueAtTime(gain * 0.35, at + 0.6);
  g.gain.exponentialRampToValueAtTime(0.0001, at + 2.4);
  car.connect(lp).connect(g).connect(musicBus);
  car.start(at); mod.start(at);
  car.stop(at + 2.5); mod.stop(at + 2.5);
}
function bassNote(c, at, n, gain = 0.16) {
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
  o.connect(lp).connect(g).connect(musicBus);
  o.start(at);
  o.stop(at + BEAT);
}
function brush(c, at, gain, long) {
  const src = c.createBufferSource();
  src.buffer = noise;
  const f = c.createBiquadFilter();
  f.type = long ? 'bandpass' : 'highpass';
  f.frequency.value = long ? 3800 : 7500;
  f.Q.value = 0.6;
  const g = c.createGain();
  g.gain.setValueAtTime(0, at);
  g.gain.linearRampToValueAtTime(gain, at + (long ? 0.05 : 0.004));
  g.gain.exponentialRampToValueAtTime(0.0001, at + (long ? 0.28 : 0.07));
  src.connect(f).connect(g).connect(musicBus);
  src.start(at, Math.random() * 0.5, 0.35);
}
function pad(c, at, notes, dur) {
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
      o.connect(lp).connect(g).connect(musicBus);
      o.start(at);
      o.stop(at + dur + 0.05);
    });
  });
}
// One beat of the band, at `at`.
function playBeat(c, at, i) {
  const bar = Math.floor(i / 4), beat = i % 4;
  const chord = chordAt(bar);
  const next = chordAt(bar + 1);
  const swing = BEAT * 0.66;
  // The bass walks: root, a chord tone, another, and a step into the next.
  const walk = [chord.bass, chord.bass + (Math.random() < 0.5 ? 7 : 4), chord.bass + (Math.random() < 0.5 ? 12 : 10), next.bass + (Math.random() < 0.5 ? -1 : 1)];
  bassNote(c, at, walk[beat], beat === 0 ? 0.17 : 0.13);
  // Brushes on two and four; the ride ticking the swung eighths.
  if (beat === 1 || beat === 3) brush(c, at, 0.016, true);
  brush(c, at, 0.006, false);
  if (Math.random() < 0.6) brush(c, at + swing, 0.004, false);
  // The piano comps: on the first beat of each chord, and pushes the
  // and-of-two now and then; the voicing rolled a little.
  const onChord = bar % 2 === 0 && beat === 0;
  const push = beat === 1 && Math.random() < 0.45;
  if (onChord || push) {
    const notes = chord.notes.map((n) => n + (Math.random() < 0.2 ? 12 : 0));
    const when = push ? at + swing : at;
    notes.forEach((n, k) => epiano(c, when + k * 0.012, n, push ? 0.022 : 0.03));
  }
  if (bar % 2 === 0 && beat === 0) pad(c, at, chord.notes, BEAT * 8);
}
function scheduleMusic() {
  const c = audio();
  if (!c || c.state !== 'running') return;
  if (nextBeat < c.currentTime) nextBeat = c.currentTime + 0.1;
  while (nextBeat < c.currentTime + 0.4) {
    playBeat(c, nextBeat, beatIndex++);
    nextBeat += BEAT;
  }
}
function startMusic() {
  const c = audio();
  if (!c || musicTimer || !musicOn || document.hidden) return;
  if (!musicBus) {
    musicBus = c.createGain();
    musicBus.connect(master);
    if (reverbIn) {
      const send = c.createGain();
      send.gain.value = 0.5;
      musicBus.connect(send).connect(reverbIn);
    }
  }
  musicBus.gain.cancelScheduledValues(c.currentTime);
  musicBus.gain.setValueAtTime(0, c.currentTime);
  musicBus.gain.linearRampToValueAtTime(MUSIC_LEVEL, c.currentTime + 3);
  nextBeat = c.currentTime + 0.2;
  musicTimer = setInterval(scheduleMusic, 100);
}
function stopMusic() {
  if (musicTimer) clearInterval(musicTimer);
  musicTimer = null;
  if (musicBus && context) {
    musicBus.gain.cancelScheduledValues(context.currentTime);
    musicBus.gain.setTargetAtTime(0, context.currentTime, 0.3);
  }
}
export const isMusicOn = () => musicOn;
export function setMusicOn(on) {
  musicOn = on;
  try { localStorage.setItem('nvgr-music', on ? 'on' : 'off'); } catch { /* private mode */ }
  if (on) startMusic(); else stopMusic();
}
// It starts with the first tap, as the sound does, and rests while the
// tab is out of sight.
['pointerdown', 'keydown', 'touchend'].forEach((e) => window.addEventListener(e, () => { if (musicOn && !musicTimer) setTimeout(startMusic, 50); }, { passive: true }));
document.addEventListener('visibilitychange', () => { if (document.hidden) stopMusic(); else if (musicOn) startMusic(); });
