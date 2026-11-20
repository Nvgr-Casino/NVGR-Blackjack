// Liftoff: the crash game, on your real chips. The rounds are the shared
// schedule in src/crash/rounds.js — everyone sees the same launch and the
// same crash — and your two bets are yours, kept here and saved to your
// account the moment anything changes.
//
// A bet is placed for the round in its betting window (or queued for the
// next while one is in the air) and can be taken back until the launch.
// In flight it is cashed out by hand at the multiplier showing, or by its
// auto cash-out at exactly that multiplier if the flight reaches it. If the
// flight ends first, it is lost. Leaving mid-flight cashes out what is
// still in the air, at the multiplier then; a bet waiting for a launch
// goes back on the balance.

import { ref, onValue } from 'firebase/database';
import { db } from '../firebase/config.js';
import * as Rounds from '../crash/rounds.js';
import * as S from './session.js';
import { STARTING_CHIPS, RESTAKE_BELOW } from './roomLogic.js';

export const isCrash = (r) => !!r && r.game === 'crash';

// The ladder of stakes the − and + step through.
export const STAKES = [100, 200, 500, 1000, 2000, 5000, 10000, 20000, 50000, 100000, 200000, 500000, 1000000];
export const QUICK = [1000, 10000, 50000, 100000];
export const MAX_BET = 1000000;

// ---------- the server's clock ----------
let offset = 0;
let offsetUnsub = null;
function watchClock() {
  if (offsetUnsub) return;
  offsetUnsub = onValue(ref(db, '.info/serverTimeOffset'), (snap) => { offset = Number(snap.val()) || 0; }, () => {});
}
export const serverNow = () => Date.now() + offset;

// ---------- state ----------
let state = null;
const newSlot = (amount, auto) => ({ amount, auto, autoOn: false, status: 'idle', round: null, cashedAt: 0, win: 0 });

function load(key, fallback) { try { const v = JSON.parse(localStorage.getItem('nvgr-lift-' + key)); return v ?? fallback; } catch { return fallback; } }
function keep(key, v) { try { localStorage.setItem('nvgr-lift-' + key, JSON.stringify(v)); } catch { /* private mode */ } }

const publish = () => { S.session.room = { ...state }; S.refresh(); };
let listeners = new Set();
/** Called on every change of the bets (not each frame): the HUD redraws its panels. */
export function onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }
const changed = () => listeners.forEach((fn) => fn());

function save() {
  S.session.chips = state.chips;
  S.saveAccountChips(S.session.uid, S.session.name, state.chips, { game: 'crash' }).catch(() => {});
}

export async function startCrash() {
  S.setFormError('');
  watchClock();
  const chips = (await S.ensureAccount(S.session.uid, S.session.name)).chips;
  const saved = load('slots', null);
  const slots = [0, 1].map((i) => {
    const s = newSlot(i ? 5000 : 1000, i ? 2 : 1.5);
    if (saved && saved[i]) { s.amount = Math.min(MAX_BET, Math.max(STAKES[0], saved[i].amount | 0 || s.amount)); s.auto = Math.max(1.01, +saved[i].auto || s.auto); s.autoOn = !!saved[i].autoOn; }
    return s;
  });
  state = { code: 'LIFTOFF', game: 'crash', offline: true, isPublic: false, chips, slots, toast: null };
  S.session.chips = chips;
  S.session.code = state.code;
  S.session.screen = 'table';
  publish();
}
export const current = () => state;

/** Local checks only: the game without an account behind it. */
export function devStart(chips = 250000) {
  if (!import.meta.env.DEV) return;
  watchClock();
  state = { code: 'LIFTOFF', game: 'crash', offline: true, isPublic: false, chips, slots: [newSlot(1000, 1.5), newSlot(5000, 2)], toast: null, dev: true };
  S.session.code = state.code;
  S.session.screen = 'table';
  publish();
}

function remember() { keep('slots', state.slots.map((s) => ({ amount: s.amount, auto: s.auto, autoOn: s.autoOn }))); }
function credit(n) {
  state.chips += n;
  if (!state.dev) save();
}
function debit(n) {
  state.chips -= n;
  if (!state.dev) save();
}
function note(text, tone = 'win') { state.toast = { text, tone, at: performance.now() }; }

// ---------- the controls ----------
export function setAmount(i, amount) {
  const s = state && state.slots[i];
  if (!s || s.status === 'live' || s.status === 'queued') return;
  s.amount = Math.max(STAKES[0], Math.min(MAX_BET, Math.round(amount) || STAKES[0]));
  remember(); changed();
}
export function stepAmount(i, dir) {
  const s = state && state.slots[i];
  if (!s) return;
  const k = STAKES.findIndex((v) => v >= s.amount);
  const at = k < 0 ? STAKES.length - 1 : STAKES[k] === s.amount ? k : dir > 0 ? k - 1 : k;
  setAmount(i, STAKES[Math.max(0, Math.min(STAKES.length - 1, at + dir))]);
}
export function setAuto(i, value) {
  const s = state && state.slots[i];
  if (!s) return;
  const v = Math.round(Number(value) * 100) / 100;
  if (!(v >= 1.01)) return;
  s.auto = Math.min(Rounds.MAX_CRASH, v);
  remember(); changed();
}
export function toggleAuto(i, on) {
  const s = state && state.slots[i];
  if (!s) return;
  s.autoOn = on === undefined ? !s.autoOn : !!on;
  remember(); changed();
}

/** The main button of panel `i`: bet, cancel, or cash out, as the moment calls for. */
export function press(i) {
  const s = state && state.slots[i];
  if (!s) return;
  const r = Rounds.roundAt(serverNow());
  if (s.status === 'live' && s.round === r.id && r.phase === 'fly') return cashOut(i, r);
  if (s.status === 'queued' || (s.status === 'live' && r.phase === 'bet' && s.round === r.id)) {
    // Taken back before the launch.
    credit(s.amount);
    s.status = 'idle'; s.round = null;
    changed();
    return;
  }
  if (s.status === 'live') return;
  if (s.amount > state.chips) { note(state.chips < STAKES[0] ? 'Not enough chips' : 'Lower your bet — not enough chips', 'warn'); changed(); return; }
  debit(s.amount);
  s.cashedAt = 0; s.win = 0;
  if (r.phase === 'bet') { s.status = 'live'; s.round = r.id; }
  else { s.status = 'queued'; s.round = null; }
  changed();
}

function cashOut(i, r, at = r.m) {
  const s = state.slots[i];
  const m = Math.floor(at * 100) / 100;
  s.status = 'cashed';
  s.cashedAt = m;
  s.win = Math.floor(s.amount * m);
  credit(s.win);
  note(`Cashed out at ${m.toFixed(2)}x  +${s.win.toLocaleString()}`);
  changed();
}

// ---------- each frame ----------
let lastRound = null;
/**
 * Brings the bets up to the moment: queued bets go live with a new round,
 * auto cash-outs are taken, and bets still in the air when a flight ends
 * are lost. Returns the round.
 */
export function tick() {
  const r = Rounds.roundAt(serverNow());
  if (!state) return r;
  let any = false;
  state.slots.forEach((s, i) => {
    // A new round's betting window: what was queued is in it.
    if (s.status === 'queued' && r.phase === 'bet') { s.status = 'live'; s.round = r.id; any = true; }
    // A settled bet shows its result until the next round begins.
    if ((s.status === 'cashed' || s.status === 'lost') && s.round !== r.id) { s.status = 'idle'; any = true; }
    if (s.status !== 'live') return;
    if (s.round !== r.id) {
      // Its round is over and we never saw it end (the page was asleep):
      // it is settled from the schedule, which knows where it crashed.
      const past = s.round && settleFromSchedule(s);
      if (!past) { s.status = 'lost'; }
      any = true;
      return;
    }
    if (r.phase === 'fly' && s.autoOn && r.m >= s.auto && s.auto < r.crash) { cashOut(i, r, s.auto); return; }
    if (r.phase === 'crash') {
      if (s.autoOn && s.auto < r.crash) { cashOut(i, r, s.auto); return; }
      s.status = 'lost'; any = true;
    }
  });
  if (r.id !== lastRound) { lastRound = r.id; any = true; }
  if (any) changed();
  return r;
}
// A bet whose round ended unseen: its auto cash-out stands if the flight
// reached it.
function settleFromSchedule(s) {
  const [day, i] = s.round.split('-').map(Number);
  const crash = Rounds.crashPoint(day, i);
  if (s.autoOn && s.auto < crash) {
    s.status = 'cashed'; s.cashedAt = s.auto; s.win = Math.floor(s.amount * s.auto);
    credit(s.win);
    return true;
  }
  return false;
}

export function takeToast() {
  if (!state || !state.toast) return null;
  const t = state.toast;
  state.toast = null;
  return t;
}

export function leave() {
  if (!state) return;
  const r = Rounds.roundAt(serverNow());
  state.slots.forEach((s, i) => {
    if (s.status === 'queued' || (s.status === 'live' && r.phase === 'bet' && s.round === r.id)) { credit(s.amount); s.status = 'idle'; }
    else if (s.status === 'live' && r.phase === 'fly' && s.round === r.id) cashOut(i, r);
  });
  // Down to almost nothing: topped back up, as at every table.
  if (state.chips < RESTAKE_BELOW) { state.chips = STARTING_CHIPS; if (!state.dev) save(); }
  listeners.clear();
  state = null;
}
