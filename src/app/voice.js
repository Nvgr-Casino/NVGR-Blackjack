// Voice at the table: players talk to each other through their mics.
//
// Peer to peer — each pair of players at a table has its own WebRTC audio
// connection, so a voice goes straight from one player to the other and
// never through a server of ours. Firebase only introduces them, beside the
// room (a write inside the room would abort its transactions):
//
//   rooms/<code>_voice/peers/<key>   { sid, mic, at } while a player is there,
//                                    removed by the server if they drop
//   rooms/<code>_voice/sig/<key>     each player's inbox of offers, answers
//                                    and network candidates from the others
//
// `sid` is new each time a player sits down, so a player who reloads is
// met afresh rather than through the connection their old page left. Of a
// pair, the one whose key sorts first makes the offer.
//
// Who hears whom: everyone seated at a private table; at a public table,
// only friends — strangers aren't put in touch. Never at a table against
// bots. The mic starts off and asks the browser's permission the first time
// it is turned on; tap it to talk freely, or hold it to talk only while held.
// Any player can be muted from your side alone. Voices come in through the
// page's sound (src/scene/sfx.js), so the Sound switch silences them too,
// each panned a little toward where that player sits.

import { ref, set, update, remove, push, onValue, onChildAdded, onDisconnect } from 'firebase/database';
import { db } from '../firebase/config.js';
import { safeKey } from './roomLogic.js';
import { seatOfKey } from './service.js';
import { SEATS } from '../scene/seats.js';
import { POKER_SEATS_3D } from '../scene/pokerTable.js';
import { ROULETTE_SEATS_3D } from '../scene/rouletteTable.js';
import { BACCARAT_SEATS_3D } from '../scene/baccaratTable.js';
import { CRAPS_SEATS_3D } from '../scene/crapsTable.js';
import { audio, masterOut, isSoundOn, setSoundOn, isMusicOn, setMusicOn } from '../scene/sfx.js';
import { fullscreenButton, attachFullscreen } from './fullscreen.js';
import { rulesButton } from './rulesGuide.js';
import * as S from './session.js';

const ICE = [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }];
const STALE_MS = 60000;
// Holding the mic longer than this is push-to-talk: it goes off on release.
const HOLD_MS = 350;

const supported = typeof window !== 'undefined' && !!window.RTCPeerConnection && !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
const me = () => safeKey(S.session.uid);
const voiceRef = (code, path) => ref(db, 'rooms/' + code + '_voice/' + path);

let code = null;          // the table we're in voice at
let sid = null;
let room = null;          // its latest state
let others = {};          // peers node, less me
let offPeers = null;
let offInbox = null;
const peers = new Map();  // key -> connection to that player
const muted = new Set();  // keys muted from this side

let mic = null;           // the live mic track, while it's on
let micState = 'off';     // 'off' | 'asking' | 'on' | 'denied' | 'failed'
let micLevel = null;      // analyser on my own mic, for my own ring
let micQuick = false;     // whether it came on at once, without a prompt

// ---------- who ----------

const isPoker = (r) => r && r.game === 'holdem';

/**
 * Whether the other player `k` is someone this player can talk with here:
 * anyone seated at the same table, public or private — talking is how
 * strangers at a table become friends. Everyone's mic starts off, and any
 * player can be muted for yourself from the players list (voiceBadge).
 */
function inScope(r, k) {
  if (!r || r.offline || k === me()) return false;
  return seatOfKey(r, k) >= 0;
}

/** Whether there is voice at this table at all for this player. */
export function voiceAvailable(r = room) {
  if (!supported || !r || r.offline || seatOfKey(r, me()) < 0) return false;
  if (!r.isPublic) return true;
  return Object.keys(r.players || {}).some((k) => inScope(r, k));
}

// ---------- joining and leaving ----------

/** Keeps voice in step with the table shown: joins it, follows who's there, leaves it. */
export function syncVoice(r) {
  const want = supported && r && !r.offline && seatOfKey(r, me()) >= 0 ? r.code : null;
  if (want !== code) {
    leaveVoice();
    if (want) join(want);
  }
  room = want ? r : null;
  if (code) reconcile();
}

function join(c) {
  code = c;
  sid = Math.random().toString(36).slice(2, 10);
  others = {};
  const mine = voiceRef(c, 'peers/' + me());
  const inbox = voiceRef(c, 'sig/' + me());
  onDisconnect(mine).remove().catch(() => {});
  onDisconnect(inbox).remove().catch(() => {});
  // Whatever was left in the inbox is for a page that's gone.
  remove(inbox).catch(() => {}).finally(() => {
    if (code !== c) return;
    set(mine, { sid, mic: micState === 'on', at: Date.now() }).catch(() => {});
    offInbox = onChildAdded(inbox, (snap) => {
      const msg = snap.val();
      remove(snap.ref).catch(() => {});
      if (msg && code === c) receive(msg);
    });
  });
  offPeers = onValue(voiceRef(c, 'peers'), (snap) => {
    if (code !== c) return;
    const all = snap.val() || {};
    delete all[me()];
    others = all;
    reconcile();
    S.refresh();
  });
}

/** Leaves voice at the table: every connection closed, the mic let go. */
export function leaveVoice() {
  if (!code) return;
  const c = code;
  code = null;
  room = null;
  if (offPeers) { offPeers(); offPeers = null; }
  if (offInbox) { offInbox(); offInbox = null; }
  peers.forEach((p) => closePeer(p));
  peers.clear();
  others = {};
  releaseMic();
  const mine = voiceRef(c, 'peers/' + me());
  const inbox = voiceRef(c, 'sig/' + me());
  onDisconnect(mine).cancel().catch(() => {});
  onDisconnect(inbox).cancel().catch(() => {});
  remove(mine).catch(() => {});
  remove(inbox).catch(() => {});
}

// Connections wanted and not yet made are made; any with a player gone, or
// out of reach (a friend unfriended at a public table), or come back with a
// new page, are closed.
function reconcile() {
  if (!code) return;
  const r = room;
  peers.forEach((p, k) => {
    const o = others[k];
    if (!o || o.sid !== p.sid || !inScope(r, k)) { closePeer(p); peers.delete(k); }
  });
  Object.entries(others).forEach(([k, o]) => {
    if (!o || !o.sid || !inScope(r, k) || peers.has(k)) return;
    if (Date.now() - (o.at || 0) > 12 * 3600 * 1000) return;
    if (me() < k) offer(k, o.sid);
  });
  peers.forEach((p) => pan(p));
}

// ---------- the connections ----------

function send(toKey, msg) {
  if (!code) return;
  push(voiceRef(code, 'sig/' + toKey), { ...msg, from: me(), sid, at: Date.now() }).catch(() => {});
}

function makePeer(k, theirSid) {
  const pc = new RTCPeerConnection({ iceServers: ICE });
  const p = { key: k, sid: theirSid, pc, sender: null, pending: [], el: null, nodes: null, level: 0, retry: null };
  pc.onicecandidate = (e) => { if (e.candidate) send(k, { kind: 'ice', to: theirSid, cand: e.candidate.toJSON() }); };
  pc.ontrack = (e) => hear(p, e.streams[0] || new MediaStream([e.track]));
  pc.onconnectionstatechange = () => {
    // A connection that fails is started again by the one who offers.
    if (pc.connectionState === 'failed' && peers.get(k) === p) {
      closePeer(p);
      peers.delete(k);
      if (me() < k) p.retry = setTimeout(() => { if (code && !peers.has(k)) reconcile(); }, 3000);
    }
    S.refresh();
  };
  peers.set(k, p);
  return p;
}

async function offer(k, theirSid) {
  const p = makePeer(k, theirSid);
  const t = p.pc.addTransceiver('audio', { direction: 'sendrecv' });
  p.sender = t.sender;
  if (mic) p.sender.replaceTrack(mic).catch(() => {});
  try {
    const o = await p.pc.createOffer();
    await p.pc.setLocalDescription(o);
    send(k, { kind: 'offer', to: theirSid, sdp: o.sdp });
  } catch { /* closed meanwhile */ }
}

async function receive(msg) {
  const k = msg.from;
  if (!k || msg.to !== sid || Date.now() - (msg.at || 0) > STALE_MS) return;
  if (msg.kind === 'offer') {
    if (!inScope(room, k)) return;
    const old = peers.get(k);
    if (old) { closePeer(old); peers.delete(k); }
    const p = makePeer(k, msg.sid);
    try {
      await p.pc.setRemoteDescription({ type: 'offer', sdp: msg.sdp });
      const t = p.pc.getTransceivers()[0];
      if (t) { t.direction = 'sendrecv'; p.sender = t.sender; if (mic) await p.sender.replaceTrack(mic); }
      const a = await p.pc.createAnswer();
      await p.pc.setLocalDescription(a);
      send(k, { kind: 'answer', to: msg.sid, sdp: a.sdp });
      flush(p);
    } catch { /* closed meanwhile */ }
    return;
  }
  const p = peers.get(k);
  if (!p || p.sid !== msg.sid) return;
  try {
    if (msg.kind === 'answer') {
      await p.pc.setRemoteDescription({ type: 'answer', sdp: msg.sdp });
      flush(p);
    } else if (msg.kind === 'ice') {
      if (p.pc.remoteDescription) await p.pc.addIceCandidate(msg.cand);
      else p.pending.push(msg.cand);
    }
  } catch { /* a candidate the connection can't use */ }
}

function flush(p) {
  p.pending.splice(0).forEach((c) => p.pc.addIceCandidate(c).catch(() => {}));
}

function closePeer(p) {
  clearTimeout(p.retry);
  try { p.pc.close(); } catch { /* already */ }
  if (p.nodes) p.nodes.forEach((n) => { try { n.disconnect(); } catch { /* already */ } });
  if (p.el) { p.el.srcObject = null; p.el.remove(); }
  p.nodes = null;
  p.el = null;
}

// ---------- hearing them ----------

// A remote voice, into the page's sound: through a pan toward their seat,
// their own volume (muted or not), and an analyser for the ring that shows
// who is talking. Chrome plays a remote stream through Web Audio only while
// it is also playing in a media element, so one plays it, silently.
function hear(p, stream) {
  if (p.el) return;
  const el = document.createElement('audio');
  el.autoplay = true;
  el.playsInline = true;
  el.srcObject = stream;
  p.el = el;
  const c = audio();
  if (!c) {
    // No Web Audio: the element plays it, unpanned.
    el.muted = muted.has(p.key) || !isSoundOn();
    document.body.appendChild(el);
    el.play().catch(() => {});
    return;
  }
  el.muted = true;
  document.body.appendChild(el);
  el.play().catch(() => {});
  const source = c.createMediaStreamSource(stream);
  const analyser = c.createAnalyser();
  analyser.fftSize = 512;
  const panner = c.createStereoPanner ? c.createStereoPanner() : null;
  const gain = c.createGain();
  gain.gain.value = muted.has(p.key) ? 0 : 1;
  source.connect(analyser);
  if (panner) source.connect(panner).connect(gain);
  else source.connect(gain);
  gain.connect(masterOut());
  p.nodes = [source, analyser, panner, gain].filter(Boolean);
  p.analyser = analyser;
  p.panner = panner;
  p.gain = gain;
  pan(p);
  watchLevels();
}

// Where a seat is, in the room's floor plan.
function seatAt(r, k) {
  const s = seatOfKey(r, k);
  if (s < 0) return null;
  const seats = isPoker(r) ? POKER_SEATS_3D : r.game === 'roulette' ? ROULETTE_SEATS_3D : r.game === 'baccarat' ? BACCARAT_SEATS_3D : r.game === 'craps' ? CRAPS_SEATS_3D : SEATS;
  const seat = seats[s];
  return seat ? seat.position : null;
}

// Heard a little to the side they sit on, as you face the table from your seat.
function pan(p) {
  if (!p.panner || !room) return;
  const mine = seatAt(room, me());
  const theirs = seatAt(room, p.key);
  if (!mine || !theirs) return;
  const fl = Math.hypot(mine.x, mine.z) || 1;
  const fx = -mine.x / fl;
  const fz = -mine.z / fl;
  const dx = theirs.x - mine.x;
  const dz = theirs.z - mine.z;
  const d = Math.hypot(dx, dz) || 1;
  const side = (dx * -fz + dz * fx) / d;
  p.panner.pan.value = Math.max(-1, Math.min(1, side)) * 0.6;
}

// ---------- talking ----------

// The mic is asked for once at a table and kept until leaving it: off and
// on again only stop and start sending it. Asking again each time made an
// iPhone ask again each time — and while the page's sound was playing it
// often refused, which left the mic stuck off until a reload.
let capture = null;       // the mic's track from the browser, kept while at the table

async function getCapture() {
  if (capture && capture.readyState === 'live' && !capture.muted) return capture;
  if (capture) { capture.stop(); capture = null; }
  const ask = () => navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
  let stream;
  try { stream = await ask(); } catch (e) {
    // A refusal is final; anything else (the phone's audio busy a moment)
    // is worth one more try.
    if (e && (e.name === 'NotAllowedError' || e.name === 'SecurityError')) throw e;
    await new Promise((r) => setTimeout(r, 600));
    stream = await ask();
  }
  const track = stream.getAudioTracks()[0];
  // The phone can take the mic back (a call): then it's off, and shows so.
  track.onended = () => {
    if (capture !== track) return;
    capture = null;
    if (mic) { stopMic(); S.refresh(); }
  };
  capture = track;
  const c = audio();
  if (c) {
    if (micLevel) { try { micLevel.src.disconnect(); } catch { /* already */ } }
    const src = c.createMediaStreamSource(new MediaStream([track]));
    const an = c.createAnalyser();
    an.fftSize = 512;
    src.connect(an);
    micLevel = { src, an };
    // Taking the mic can pause the page's sound on an iPhone.
    if (c.state !== 'running') c.resume().catch(() => {});
  }
  return track;
}

async function startMic() {
  if (mic || micState === 'asking') return;
  const had = !!(capture && capture.readyState === 'live' && !capture.muted);
  micState = 'asking';
  S.refresh();
  const asked = performance.now();
  try {
    const track = await getCapture();
    if (!code || micState !== 'asking') { if (micState === 'asking') micState = 'off'; S.refresh(); return; }
    track.enabled = true;
    mic = track;
    micState = 'on';
    // Quick means no permission prompt came between: only then can a
    // press be push-to-talk.
    micQuick = had || performance.now() - asked < 1000;
    peers.forEach((p) => { if (p.sender) p.sender.replaceTrack(mic).catch(() => {}); });
    watchLevels();
  } catch (e) {
    micState = e && (e.name === 'NotAllowedError' || e.name === 'SecurityError') ? 'denied' : 'failed';
  }
  if (code) update(voiceRef(code, 'peers/' + me()), { mic: micState === 'on' }).catch(() => {});
  S.refresh();
}

function stopMic() {
  const wasOn = !!mic;
  if (mic) { mic.enabled = false; mic = null; }
  peers.forEach((p) => { if (p.sender) p.sender.replaceTrack(null).catch(() => {}); });
  if (micState !== 'denied' && micState !== 'failed') micState = 'off';
  if (code && wasOn) update(voiceRef(code, 'peers/' + me()), { mic: false }).catch(() => {});
}

// Let the mic go altogether (leaving the table).
function releaseMic() {
  stopMic();
  if (capture) { capture.onended = null; capture.stop(); capture = null; }
  if (micLevel) { try { micLevel.src.disconnect(); } catch { /* already */ } micLevel = null; }
  micState = 'off';
}

/** If in voice with player `k`: whether they're muted from this side. */
export function voiceWith(k) {
  return code && peers.has(k) && others[k] ? { muted: muted.has(k), mic: !!others[k].mic } : null;
}

export function setMuted(k, on) {
  if (on) muted.add(k); else muted.delete(k);
  const p = peers.get(k);
  if (p && p.gain) p.gain.gain.value = on ? 0 : 1;
  else if (p && p.el) p.el.muted = on;
  S.refresh();
}

// ---------- who's talking ----------

let levelTimer = null;
const buf = new Uint8Array(512);
function loudness(an) {
  an.getByteTimeDomainData(buf);
  let sum = 0;
  for (let i = 0; i < an.fftSize; i++) { const v = (buf[i] - 128) / 128; sum += v * v; }
  return Math.sqrt(sum / an.fftSize);
}
// Several times a second, the ring round the avatar of anyone talking.
function watchLevels() {
  if (levelTimer) return;
  levelTimer = setInterval(() => {
    if (!code) { clearInterval(levelTimer); levelTimer = null; return; }
    const talking = {};
    peers.forEach((p, k) => { if (p.analyser) talking[k] = !muted.has(k) && loudness(p.analyser) > 0.02; });
    if (micLevel && mic) talking[me()] = loudness(micLevel.an) > 0.02;
    document.querySelectorAll('[data-voice]').forEach((el) => el.classList.toggle('speaking', !!talking[el.dataset.voice]));
  }, 120);
}

// ---------- in the HUD ----------

const ICON_SOUND = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9H4z" fill="currentColor"/><path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';
const ICON_SOUND_OFF = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9H4z" fill="currentColor"/><path d="M16.5 9.5l5 5M21.5 9.5l-5 5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';
const ICON_MIC = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3" fill="currentColor"/><path d="M6 11a6 6 0 0 0 12 0M12 17v4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';
const ICON_MIC_OFF = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3" fill="currentColor" opacity=".55"/><path d="M6 11a6 6 0 0 0 12 0M12 17v4M4 4l16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';

const ICON_MUSIC = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 17V5l11-2v12" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><circle cx="6.5" cy="17.5" r="2.5" fill="currentColor"/><circle cx="17.5" cy="15.5" r="2.5" fill="currentColor"/></svg>';
const ICON_MUSIC_OFF = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 17V5l11-2v12" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" opacity=".5"/><circle cx="6.5" cy="17.5" r="2.5" fill="currentColor" opacity=".5"/><circle cx="17.5" cy="15.5" r="2.5" fill="currentColor" opacity=".5"/><path d="M3 3l18 18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';
/** The Music switch: the lounge band under the room, on or off. */
export function musicButton() {
  const on = isMusicOn();
  return `<button class="hud-btn hud-icon ${on ? '' : 'off'}" id="musicToggleBtn" title="${on ? 'Music on — tap to turn off' : 'Music off — tap to turn on'}" aria-label="Music ${on ? 'on' : 'off'}" aria-pressed="${on}">${on ? ICON_MUSIC : ICON_MUSIC_OFF}</button>`;
}
export function attachMusicButton() {
  const btn = document.getElementById('musicToggleBtn');
  if (btn) btn.onclick = () => { setMusicOn(!isMusicOn()); S.refresh(); };
}

/** The Sound and Music switches, and the Mic button where there's anyone to talk to. */
export function voiceButtons(r) {
  // Every table's How to play guide sits first among these.
  const sound = rulesButton((r && r.game) || 'blackjack') + fullscreenButton() + musicButton() + `<button class="hud-btn hud-icon ${isSoundOn() ? '' : 'off'}" id="soundToggleBtn" title="${isSoundOn() ? 'Sound on — tap to turn off' : 'Sound off — tap to turn on'}" aria-label="Sound ${isSoundOn() ? 'on' : 'off'}">${isSoundOn() ? ICON_SOUND : ICON_SOUND_OFF}</button>`;
  // The slot salon is you and your machine: no one to talk to.
  if (r && r.game === 'slots') return `<span class="hud-voice">${sound}</span>`;
  if (!voiceAvailable(r)) {
    // Seated at a real table but nobody to talk to yet: the mic is still
    // shown, and a tap says why it's quiet and how to change that.
    const why = voiceHint(r);
    if (!why) return `<span class="hud-voice">${sound}</span>`;
    return `<span class="hud-voice">${sound}<button class="hud-btn hud-icon mic idle" id="micHintBtn" data-hint="${why.replace(/"/g, '&quot;')}" title="${why.replace(/"/g, '&quot;')}" aria-label="Voice chat">${ICON_MIC_OFF}</button></span>`;
  }
  const on = micState === 'on';
  const title = micState === 'denied' ? 'The mic is blocked for this site — allow it in the browser settings, then tap to try again'
    : micState === 'failed' ? "Couldn't start the mic — tap to try again"
    : on ? 'Mic on — tap to turn off' : 'Mic off — tap to talk, or hold to talk while held';
  return `<span class="hud-voice">${sound}<button class="hud-btn hud-icon mic ${on ? 'live' : ''} ${micState === 'denied' || micState === 'failed' ? 'denied' : ''} ${micState === 'asking' ? 'asking' : ''}" id="micToggleBtn" title="${title}" aria-label="${on ? 'Mic on' : 'Mic off'}" aria-pressed="${on}" data-voice="${me()}">${on ? ICON_MIC : ICON_MIC_OFF}</button></span>`;
}

/** Beside a player in the players list: their mic, and a mute for them, once in voice with them. */
export function voiceBadge(k) {
  if (!code || k === me()) return '';
  const p = peers.get(k);
  if (!p || !others[k]) return '';
  const isMuted = muted.has(k);
  const live = others[k].mic && !isMuted;
  return `<button class="voice-mute ${isMuted ? 'muted' : ''} ${live ? 'live' : ''}" data-voice-mute="${k}" title="${isMuted ? 'Unmute' : 'Mute'} this player" aria-label="${isMuted ? 'Unmute' : 'Mute'}">${isMuted || !others[k].mic ? ICON_MIC_OFF : ICON_MIC}</button>`;
}

/** Why there's no one to talk to at this table, or '' where voice can't be had at all. */
function voiceHint(r) {
  if (!r || seatOfKey(r, me()) < 0) return '';
  if (r.offline) return 'Voice chat is for tables with other players — practice tables are just you.';
  if (!supported) return "This browser can't use the microphone for voice chat.";
  return 'Voice opens when someone else sits down at this table.';
}
let hintTimer = null;
function showHint(text) {
  let el = document.getElementById('voiceHint');
  if (!el) {
    el = document.createElement('div');
    el.id = 'voiceHint';
    el.className = 'voice-hint';
    document.body.appendChild(el);
  }
  el.textContent = text;
  el.classList.add('on');
  clearTimeout(hintTimer);
  hintTimer = setTimeout(() => el.classList.remove('on'), 4500);
}

export function attachVoice() {
  attachMusicButton();
  const hint = document.getElementById('micHintBtn');
  if (hint) hint.onclick = () => showHint(hint.dataset.hint);
  attachFullscreen();
  const sound = document.getElementById('soundToggleBtn');
  if (sound) sound.onclick = () => { setSoundOn(!isSoundOn()); peers.forEach((p) => { if (!p.gain && p.el) p.el.muted = !isSoundOn() || muted.has(p.key); }); S.refresh(); };
  const micBtn = document.getElementById('micToggleBtn');
  if (micBtn) {
    micBtn.onpointerdown = (e) => {
      if (e.button) return;
      e.preventDefault();
      const wasOn = micState === 'on' || micState === 'asking';
      const t0 = performance.now();
      const id = e.pointerId;
      if (!wasOn) startMic();
      // The HUD may be redrawn while the button is held: the release is
      // listened for on the page — that finger's release only. A press cut
      // short (the browser asking for the mic, a gesture) is a tap: the
      // mic stays on. It once stayed listening instead, and the next tap
      // anywhere, a minute later, turned the mic off.
      const end = (ev) => {
        if (ev.pointerId !== id) return;
        window.removeEventListener('pointerup', end);
        window.removeEventListener('pointercancel', end);
        if (wasOn) stopMic();
        else if (ev.type === 'pointerup' && micState === 'on' && micQuick && performance.now() - t0 > HOLD_MS) stopMic();
        S.refresh();
      };
      window.addEventListener('pointerup', end);
      window.addEventListener('pointercancel', end);
    };
    micBtn.oncontextmenu = (e) => e.preventDefault();
  }
  document.querySelectorAll('[data-voice-mute]').forEach((b) => {
    b.onclick = (e) => { e.stopPropagation(); setMuted(b.dataset.voiceMute, !muted.has(b.dataset.voiceMute)); };
  });
}
