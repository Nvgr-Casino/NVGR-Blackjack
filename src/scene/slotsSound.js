// The slot machine's sounds, made on the fly like the rest of the casino's:
// the reels catching and running, each one landing with a weighty clunk, and
// bells for a win, grander as the win grows. Off with the Sound switch.

import { audio, masterOut, isSoundOn } from './sfx.js';

let bus = null;
let noise = null;
function ready() {
  const c = audio();
  if (!c || !isSoundOn() || c.state !== 'running' || document.hidden) return null;
  if (!bus) {
    bus = c.createGain();
    bus.gain.value = 0.7;
    bus.connect(masterOut());
    noise = c.createBuffer(1, c.sampleRate, c.sampleRate);
    const d = noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  return c;
}
function tone(c, at, freq, { gain = 0.1, decay = 0.4, type = 'sine', attack = 0.004, detune = 0 } = {}) {
  const o = c.createOscillator();
  o.type = type;
  o.frequency.value = freq;
  o.detune.value = detune;
  const g = c.createGain();
  g.gain.setValueAtTime(0, at);
  g.gain.linearRampToValueAtTime(gain, at + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, at + attack + decay);
  o.connect(g).connect(bus);
  o.start(at);
  o.stop(at + attack + decay + 0.05);
}
function hiss(c, at, { freq = 2000, q = 1, gain = 0.05, decay = 0.08, type = 'bandpass' } = {}) {
  const s = c.createBufferSource();
  s.buffer = noise;
  const f = c.createBiquadFilter();
  f.type = type; f.frequency.value = freq; f.Q.value = q;
  const g = c.createGain();
  g.gain.setValueAtTime(gain, at);
  g.gain.exponentialRampToValueAtTime(0.0001, at + decay);
  s.connect(f).connect(g).connect(bus);
  s.start(at, Math.random() * 0.5, decay + 0.05);
}
// A bell: a bright partial over its fundamental, ringing out.
function bell(c, at, freq, gain = 0.06, decay = 1.2) {
  tone(c, at, freq, { gain, decay, type: 'sine' });
  tone(c, at, freq * 2.76, { gain: gain * 0.35, decay: decay * 0.5, type: 'sine' });
  tone(c, at, freq * 5.4, { gain: gain * 0.12, decay: decay * 0.25, type: 'sine' });
}

let runner = null;
/** The reels catching and running, until stopRun(). */
export function spinStart() {
  const c = ready();
  if (!c) return;
  const at = c.currentTime;
  hiss(c, at, { freq: 900, q: 0.8, gain: 0.08, decay: 0.12 });
  tone(c, at, 120, { gain: 0.08, decay: 0.12, type: 'triangle' });
  // A soft, low run of the reels: filtered noise, and a slow tick over it.
  stopRun();
  const s = c.createBufferSource();
  s.buffer = noise; s.loop = true;
  const f = c.createBiquadFilter();
  f.type = 'bandpass'; f.frequency.value = 520; f.Q.value = 0.9;
  const g = c.createGain();
  g.gain.setValueAtTime(0, at);
  g.gain.linearRampToValueAtTime(0.045, at + 0.25);
  s.connect(f).connect(g).connect(bus);
  s.start(at);
  const lfo = c.createOscillator();
  lfo.frequency.value = 22;
  const depth = c.createGain();
  depth.gain.value = 0.018;
  lfo.connect(depth).connect(g.gain);
  lfo.start(at);
  runner = { s, g, lfo };
}
/** The reels all still: the run fades out. */
export function stopRun() {
  if (!runner) return;
  const c = audio();
  const { s, g, lfo } = runner;
  runner = null;
  if (!c) return;
  const at = c.currentTime;
  g.gain.cancelScheduledValues(at);
  g.gain.setValueAtTime(g.gain.value, at);
  g.gain.linearRampToValueAtTime(0, at + 0.12);
  s.stop(at + 0.2); lfo.stop(at + 0.2);
}
/** One reel landing: a clunk and a click, a little higher reel by reel. */
export function reelStop(i, last) {
  const c = ready();
  if (!c) return;
  const at = c.currentTime;
  tone(c, at, 78 + i * 6, { gain: 0.16, decay: 0.16, type: 'sine' });
  tone(c, at, 156 + i * 10, { gain: 0.05, decay: 0.08, type: 'triangle' });
  hiss(c, at, { freq: 3200, q: 1.4, gain: 0.05, decay: 0.03 });
  hiss(c, at + 0.004, { freq: 700, q: 0.7, gain: 0.05, decay: 0.06, type: 'lowpass' });
  if (last) stopRun();
}
/** A win: bells rising, more of them, and grander, as the win grows. */
export function winSound(tier) {
  const c = ready();
  if (!c) return;
  const at = c.currentTime + 0.05;
  const notes = tier === 'win' ? [784, 988, 1175] : tier === 'great' ? [659, 784, 988, 1319] : [523, 659, 784, 1047, 1319, 1568];
  notes.forEach((f, k) => bell(c, at + k * (tier === 'win' ? 0.09 : 0.12), f, tier === 'win' ? 0.045 : 0.06));
  if (tier === 'big' || tier === 'mega') {
    // A chord that swells and shimmers under the bells.
    [261.6, 329.6, 392, 523.2].forEach((f) => tone(c, at + 0.6, f, { gain: 0.035, decay: 2.6, attack: 0.4, type: 'triangle', detune: 4 }));
    for (let k = 0; k < 16; k++) bell(c, at + 0.9 + k * 0.08, 1568 + (k % 4) * 196, 0.022, 0.5);
  }
}
/** A tick as the win counts up on the meter. */
export function countTick() {
  const c = ready();
  if (!c) return;
  tone(c, c.currentTime, 2400, { gain: 0.012, decay: 0.03, type: 'square' });
}
/** A button pressed on the deck. */
export function buttonClick() {
  const c = ready();
  if (!c) return;
  const at = c.currentTime;
  hiss(c, at, { freq: 2600, q: 2, gain: 0.04, decay: 0.025 });
  tone(c, at, 1400, { gain: 0.02, decay: 0.03, type: 'triangle' });
}
