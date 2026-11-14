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
import * as S from './session.js';

export const isSlots = (r) => !!r && r.game === 'slots';

let state = null;
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

export async function startSlots() {
  S.setFormError('');
  const chips = (await S.ensureAccount(S.session.uid, S.session.name)).chips;
  state = {
    code: 'SLOTS', game: 'slots', offline: true, isPublic: false,
    chips, bet: defaultBet(chips), spinning: false, pending: null, last: null,
    stops: R.drawStops((n) => Math.floor(Math.random() * n)), spins: 0, auto: false,
  };
  S.session.chips = chips;
  S.session.code = state.code;
  S.session.screen = 'table';
  publish();
}

export const current = () => state;

// Local checks only: a seat at the machine without an account behind it.
export function devStart(chips = 250000) {
  if (!import.meta.env.DEV) return;
  state = { code: 'SLOTS', game: 'slots', offline: true, isPublic: false, chips, bet: defaultBet(chips), spinning: false, pending: null, last: null, stops: R.drawStops((n) => Math.floor(Math.random() * n)), spins: 0, auto: false };
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
export function setAuto(on) {
  if (!state) return;
  state.auto = !!on;
  publish();
}

/** Draws a spin, if one can be played; returns { stops, result } or null. */
export function spin() {
  if (!state || state.spinning || state.chips < state.bet) return null;
  const stops = R.drawStops();
  const result = R.evaluate(stops, state.bet);
  state.chips -= state.bet;
  state.spinning = true;
  state.pending = { stops, result, bet: state.bet };
  state.last = null;
  state.spins += 1;
  // What the account holds now: the stake gone and the win in.
  save(state.chips + result.total);
  publish();
  return { stops, result };
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
