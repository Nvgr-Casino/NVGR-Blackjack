// Liftoff's sound, made with Web Audio on the page's shared context
// (src/scene/sfx.js), so the Sound switch and its volume govern it like
// every other sound in the casino. Nothing is loaded.
//
//  - The countdown's last three seconds tick.
//  - Ignition: a deep boom and a rush of noise.
//  - The engines: a roar of filtered noise over a sub-bass rumble, louder
//    and brighter as they spool up and as the climb goes on.
//  - The tension: a low drone that rises in pitch with the multiplier, and
//    a heartbeat that quickens as it climbs higher.
//  - Cashing out: a bright two-note chime. The crash: an explosion.

import { audio, masterOut } from '../scene/sfx.js';

let ctx = null, out = null, noiseBuf = null;
let engine = null;     // { gain, filter, sub, subGain, drone, droneGain, droneFilter }
let beatAt = 0, lastTick = -1;

function ready() {
  if (!ctx) {
    ctx = audio();
    if (!ctx) return false;
    out = ctx.createGain();
    out.gain.value = 0.9;
    out.connect(masterOut());
    // Two seconds of brown noise: deep, like a rocket's roar.
    const len = ctx.sampleRate * 2;
    noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) { last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02; d[i] = last * 3.5; }
  }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return true;
}

function startEngine() {
  if (engine || !ready()) return;
  const t = ctx.currentTime;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuf; src.loop = true;
  const filter = ctx.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = 300; filter.Q.value = 0.7;
  const gain = ctx.createGain(); gain.gain.value = 0;
  src.connect(filter).connect(gain).connect(out);
  src.start(t);
  const sub = ctx.createOscillator(); sub.type = 'sine'; sub.frequency.value = 42;
  const subGain = ctx.createGain(); subGain.gain.value = 0;
  sub.connect(subGain).connect(out); sub.start(t);
  // The drone: two detuned saws, softened, rising with the multiplier.
  const droneGain = ctx.createGain(); droneGain.gain.value = 0;
  const droneFilter = ctx.createBiquadFilter(); droneFilter.type = 'lowpass'; droneFilter.frequency.value = 600;
  const drones = [0, 7].map((cents) => { const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = 70; o.detune.value = cents; o.connect(droneFilter); o.start(t); return o; });
  droneFilter.connect(droneGain).connect(out);
  engine = { src, gain, filter, sub, subGain, drones, droneGain, droneFilter };
}
function stopEngine(fade = 0.25) {
  if (!engine || !ctx) return;
  const e = engine; engine = null;
  const t = ctx.currentTime;
  [e.gain, e.subGain, e.droneGain].forEach((g) => { g.gain.cancelScheduledValues(t); g.gain.setValueAtTime(g.gain.value, t); g.gain.linearRampToValueAtTime(0, t + fade); });
  setTimeout(() => { try { e.src.stop(); e.sub.stop(); e.drones.forEach((o) => o.stop()); } catch { /* already */ } }, fade * 1000 + 100);
}
const ramp = (param, v, t, tc = 0.12) => param.setTargetAtTime(v, t, tc);

/** Each frame: where the round is. `spool` 0..1 over the countdown's end, `m` the multiplier in flight. */
export function update(phase, m, spool, betLeft) {
  if (!ready()) return;
  const t = ctx.currentTime;
  if (phase === 'bet') {
    // The last three seconds tick.
    const sec = Math.ceil(betLeft / 1000);
    if (sec <= 3 && sec >= 1 && sec !== lastTick) { lastTick = sec; tick(sec === 1); }
    if (spool > 0) {
      startEngine();
      ramp(engine.gain.gain, 0.05 + 0.4 * spool * spool, t);
      ramp(engine.filter.frequency, 250 + 700 * spool, t);
      ramp(engine.subGain.gain, 0.15 * spool, t);
      ramp(engine.droneGain.gain, 0, t);
    } else if (engine) stopEngine(0.4);
    return;
  }
  lastTick = -1;
  if (phase !== 'fly') { if (engine) stopEngine(0.08); return; }
  startEngine();
  const lm = Math.log(Math.max(1, m));
  // Full power off the line, the roar thinning a little as the air does,
  // the drone climbing and swelling with the multiplier.
  ramp(engine.gain.gain, 0.55 - Math.min(0.2, lm * 0.08), t);
  ramp(engine.filter.frequency, 900 + Math.min(1600, lm * 600), t);
  ramp(engine.subGain.gain, 0.22, t);
  const f = 70 * Math.pow(m, 0.42);
  engine.drones.forEach((o) => ramp(o.frequency, Math.min(900, f), t, 0.08));
  ramp(engine.droneFilter.frequency, 500 + Math.min(2500, lm * 900), t);
  ramp(engine.droneGain.gain, Math.min(0.11, 0.025 + lm * 0.035), t);
  // The heartbeat, from 2x: faster and harder the higher it goes.
  if (m >= 2) {
    const every = Math.max(0.36, 0.95 - lm * 0.22);
    if (t >= beatAt) { heartbeat(Math.min(1, 0.4 + lm * 0.22)); beatAt = t + every; }
  } else beatAt = t + 0.3;
}

function tone(freq, start, dur, gain, type = 'sine', to = null) {
  const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(freq, start);
  if (to) o.frequency.exponentialRampToValueAtTime(to, start + dur);
  const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, start);
  g.gain.exponentialRampToValueAtTime(gain, start + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  o.connect(g).connect(out); o.start(start); o.stop(start + dur + 0.05);
}
function noiseBurst(start, dur, gain, fromHz, toHz) {
  const src = ctx.createBufferSource(); src.buffer = noiseBuf;
  const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(fromHz, start); f.frequency.exponentialRampToValueAtTime(toHz, start + dur);
  const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, start);
  g.gain.exponentialRampToValueAtTime(gain, start + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  src.connect(f).connect(g).connect(out); src.start(start, Math.random()); src.stop(start + dur + 0.05);
}

function tick(last) { tone(last ? 1320 : 990, ctx.currentTime, 0.07, 0.12, 'sine'); }
function heartbeat(k) {
  const t = ctx.currentTime;
  tone(58, t, 0.16, 0.5 * k, 'sine', 40);
  tone(52, t + 0.17, 0.2, 0.36 * k, 'sine', 36);
}
export function ignition() {
  if (!ready()) return;
  const t = ctx.currentTime;
  tone(70, t, 1.2, 0.9, 'sine', 30);
  noiseBurst(t, 1.6, 0.9, 1800, 120);
}
export function cashOut() {
  if (!ready()) return;
  const t = ctx.currentTime;
  tone(1046.5, t, 0.22, 0.22); tone(1568, t + 0.09, 0.4, 0.2);
  tone(2093, t + 0.18, 0.5, 0.08);
}
export function explosion() {
  if (!ready()) return;
  stopEngine(0.05);
  const t = ctx.currentTime;
  noiseBurst(t, 2.2, 1.0, 3000, 80);
  noiseBurst(t + 0.05, 1.2, 0.6, 6000, 400);
  tone(48, t, 1.4, 1.0, 'sine', 24);
}
export function silence() { stopEngine(0.15); lastTick = -1; }
