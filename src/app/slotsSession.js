// The slot salon: you and your machine, on your real chips. Nothing goes to
// a shared room; the machine lives in this browser, and your balance is
// saved to your account as you play.
//
// A spin is drawn the moment you press Spin, and the balance it leaves you
// with (stake off, any win on) is saved then and there, before the reels
// have even started: closing the page mid-spin loses nothing, and wins
// nothing it shouldn't. The screen shows the stake taken at once and the
// win added when the reels have landed.

import * as R from '../slots/rules.js';
import { gameOf, GAMES, DEFAULT_GAME, seedPots } from '../slots/games.js';
import * as S from './session.js';
import { STARTING_CHIPS, RESTAKE_BELOW } from './roomLogic.js';

export const isSlots = (r) => !!r && r.game === 'slots';

let state = null;
// The machine you played last, for next time.
function lastGame() { try { const id = localStorage.getItem('nvgr-slot-game'); return GAMES[id] ? id : DEFAULT_GAME; } catch { return DEFAULT_GAME; } }
function rememberGame(id) { try { localStorage.setItem('nvgr-slot-game', id); } catch { /* private mode */ } }
export const gameNow = () => gameOf(state && state.gameId);

// A jackpot machine's Major and Grand grow with every spin, kept in this
// browser between visits; the Mini and Minor are fixed. All as multiples of
// the bet, so they hold their worth at any stake.
function loadPots(game) {
  const seed = seedPots(game);
  if (!seed) return null;
  try {
    const saved = JSON.parse(localStorage.getItem('nvgr-pots-' + game.id) || 'null');
    if (saved && saved.major >= seed.major && saved.grand >= seed.grand) return { ...seed, major: saved.major, grand: saved.grand };
  } catch { /* none kept */ }
  return seed;
}
function savePots(game, pots) {
  try { localStorage.setItem('nvgr-pots-' + game.id, JSON.stringify({ major: pots.major, grand: pots.grand })); } catch { /* private mode */ }
}
let pots = null;
/** The jackpots on the machine now (multiples of the bet), or null. */
export const potsNow = () => pots;
const publish = () => { S.session.room = { ...state }; S.refresh(); };

function save(chips) {
  S.session.chips = chips;
  S.saveAccountChips(S.session.uid, S.session.name, chips).catch(() => {});
}
// A comfortable first bet: about a hundredth of the balance.
function defaultBet(chips) {
  let bet = R.BETS[0];
  for (const b of R.BETS) if (b * 100 <= chips) bet = b;
  return bet;
}

export async function startSlots(gameId = lastGame()) {
  S.setFormError('');
  const chips = (await S.ensureAccount(S.session.uid, S.session.name)).chips;
  const g = gameOf(gameId);
  rememberGame(g.id);
  pots = loadPots(g);
  state = {
    code: 'SLOTS', game: 'slots', gameId: g.id, offline: true, isPublic: false,
    chips, bet: defaultBet(chips), spinning: false, pending: null, last: null,
    stops: g.drawStops((n) => Math.floor(Math.random() * n)), spins: 0, auto: false,
  };
  S.session.chips = chips;
  S.session.code = state.code;
  S.session.screen = 'table';
  publish();
}

export const current = () => state;

// Local checks only: a seat at the machine without an account behind it.
export function devStart(chips = 250000, gameId = DEFAULT_GAME) {
  if (!import.meta.env.DEV) return;
  const g = gameOf(gameId);
  pots = loadPots(g);
  state = { code: 'SLOTS', game: 'slots', gameId: g.id, offline: true, isPublic: false, chips, bet: defaultBet(chips), spinning: false, pending: null, last: null, stops: g.drawStops((n) => Math.floor(Math.random() * n)), spins: 0, auto: false };
  S.session.code = state.code;
  S.session.screen = 'table';
  publish();
}

export function setBet(bet) {
  if (!state || state.spinning || !R.BETS.includes(bet)) return;
  state.bet = bet;
  publish();
}
export function stepBet(dir) {
  if (!state) return;
  const i = R.BETS.indexOf(state.bet);
  const next = R.BETS[Math.max(0, Math.min(R.BETS.length - 1, i + dir))];
  // Up only as far as the balance covers.
  if (dir > 0 && next > state.chips) return;
  setBet(next);
}
export function maxBet() {
  if (!state) return;
  let best = R.BETS[0];
  for (const b of R.BETS) if (b <= state.chips) best = b;
  setBet(best);
}
/** Moves to another machine in the salon, between spins. */
export function setGame(id) {
  if (!state || state.spinning || !GAMES[id] || id === state.gameId) return;
  const g = gameOf(id);
  rememberGame(id);
  pots = loadPots(g);
  state.gameId = id;
  state.stops = g.drawStops((n) => Math.floor(Math.random() * n));
  state.last = null;
  state.auto = false;
  publish();
}
export function setAuto(on) {
  if (!state) return;
  state.auto = !!on;
  publish();
}

/** Draws a spin, if one can be played; returns { stops, result } or null. */
export function spin() {
  if (!state || state.spinning || state.chips < state.bet) return null;
  const g = gameOf(state.gameId);
  const stops = g.drawStops();
  const result = g.evaluate(stops, state.bet);
  // Hold & Spin, decided now with the rest of the spin, on the jackpots as
  // they stand; any jackpot won goes back to its seed, and then the Major
  // and Grand grow by their share of this spin.
  let feature = null;
  if (result.feature && g.feature) {
    const rand = () => { const b = new Uint32Array(1); globalThis.crypto.getRandomValues(b); return b[0] / 4294967296; };
    const before = { ...pots };
    feature = g.holdSpin(result.feature.cells, state.bet, before, rand);
    feature.pots = before;
    result.total += feature.amount;
    const seed = seedPots(g);
    feature.jackpots.forEach((k) => { if (k === 'major' || k === 'grand') pots[k] = seed[k]; });
  }
  if (pots) {
    pots.major = Math.round((pots.major + g.jackpots.major.grow) * 1000) / 1000;
    pots.grand = Math.round((pots.grand + g.jackpots.grand.grow) * 1000) / 1000;
    savePots(g, pots);
  }
  state.chips -= state.bet;
  state.spinning = true;
  state.pending = { stops, result, feature, bet: state.bet };
  state.last = null;
  state.spins += 1;
  // What the account holds now: the stake gone and the win in.
  save(state.chips + result.total);
  publish();
  return { stops, result, feature };
}
/** The reels have landed: the win goes on the meter. */
export function settle() {
  if (!state || !state.pending) return;
  const { stops, result, bet } = state.pending;
  state.chips += result.total;
  state.stops = stops;
  state.last = { win: result.total, bet, tier: R.winTier(result.total, bet), wins: result.wins, scatter: result.scatter };
  state.pending = null;
  state.spinning = false;
  // Down to almost nothing: the house tops you straight back up, here at
  // the machine.
  state.toppedUp = false;
  if (state.chips < RESTAKE_BELOW) {
    state.chips = STARTING_CHIPS;
    state.toppedUp = true;
  }
  // Out of chips for this bet: down to what can still be played.
  if (state.chips < state.bet) {
    let b = R.BETS[0];
    for (const x of R.BETS) if (x <= state.chips) b = x;
    state.bet = b;
  }
  if (state.chips < state.bet) state.auto = false;
  save(state.chips);
  publish();
}

export function leave() {
  if (!state) return;
  if (state.pending) settle();
  save(state.chips);
  state = null;
}
