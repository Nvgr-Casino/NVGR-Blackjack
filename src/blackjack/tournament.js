// Blackjack tournaments: five seats, everyone on the same stack of
// tournament chips, a fixed number of hands, and whoever has the most chips
// at the end wins — the format casinos run. A player who can no longer
// cover the minimum bet is out. The top three are paid.
//
// Pure functions on a blackjack room (src/app/roomLogic.js plays each
// hand); this module decides when it starts, how many hands, who is out,
// and who wins what. Tournament chips are not money: the buy-in buys a
// seat and a stack, the stack never reaches the account, and what you take
// away is your prize (room.prizes, collected by each player's own client).
//
// Nobody can hold the table up: a player who doesn't bet in time is bet
// the minimum (autoBets), and one who doesn't act in time stands, as at
// any table.

import { addPlayerToRoom, startRoundLogic, enterTurn, checkAutoDeal, safeKey, MAX_PUBLIC_SEATS } from '../app/roomLogic.js';

// First prize ten buy-ins, second two and a half, third one — for a full
// table. Online, a table that starts short pays in proportion.
export const BJ_TOURNAMENTS = [
  { id: 'bj-starter', name: 'Starter', tier: 1, buyIn: 10000, prizes: [100000, 25000, 10000] },
  { id: 'bj-classic', name: 'Classic', tier: 3, buyIn: 50000, prizes: [500000, 125000, 50000] },
  { id: 'bj-highroller', name: 'High Roller', tier: 4, buyIn: 100000, prizes: [1000000, 250000, 100000], featured: true },
  { id: 'bj-millionaire', name: 'Millionaire', tier: 5, buyIn: 250000, prizes: [2500000, 625000, 250000] },
  { id: 'bj-diamond', name: 'Diamond', tier: 5, buyIn: 1000000, prizes: [10000000, 2500000, 1000000] },
];
export const bjTournamentById = (id) => BJ_TOURNAMENTS.find((d) => d.id === id) || null;

export const SEATS = MAX_PUBLIC_SEATS;
export const START_STACK = 10000;
export const HANDS = 20;
export const MIN_BET = 100;
export const MAX_BET = 5000;
// Online: once two have registered, the rest have this long to join.
export const START_WAIT_MS = 90 * 1000;

const log = (r, line) => { r.log = (r.log || []).concat(line).slice(-8); };
export const isBjTournament = (r) => !!(r && r.tournament && r.game !== 'holdem');
export const registering = (r) => isBjTournament(r) && r.tournament.status === 'registering';
export const running = (r) => isBjTournament(r) && r.tournament.status === 'running';
export const finished = (r) => isBjTournament(r) && r.tournament.status === 'finished';

// The database drops empty maps; put them back.
function tt(r) {
  const x = r.tournament;
  if (x && !x.places) x.places = {};
  if (x && !x.prizes) x.prizes = [];
  return x;
}
const seated = (r) => (r.playerOrder || []).filter((k) => r.players && r.players[k]);

/** Makes `room` a tournament table for `def`, waiting for entrants. */
export function setupTournament(room, def) {
  room.tournament = {
    id: def.id, name: def.name, buyIn: def.buyIn, prizes: def.prizes.slice(),
    status: 'registering', entrants: 0, places: {}, startsAt: null,
  };
  room.tier = def.tier;
  room.minBet = MIN_BET;
  room.maxBet = MAX_BET;
  room.isPublic = true;
  room.phase = 'lobby';
  room.round = 0;
  if (!room.players) room.players = {};
  if (!room.playerOrder) room.playerOrder = [];
  return room;
}

/** Seats a registered player with the starting stack; the buy-in is the caller's to take. */
export function register(r, uid, { name, character, bot = false, now = Date.now() }) {
  const x = tt(r);
  const key = safeKey(uid);
  if (!x || x.status !== 'registering' || (r.players && r.players[key])) return false;
  if (seated(r).length >= SEATS) return false;
  addPlayerToRoom(r, uid, name, START_STACK, character);
  r.players[key].bot = bot;
  x.entrants = seated(r).length;
  if (x.entrants >= 2 && !x.startsAt) x.startsAt = now + START_WAIT_MS;
  return true;
}

/** Whether a registering tournament should start: full, or two or more and the wait is over. */
export function canStart(r, now = Date.now()) {
  const x = tt(r);
  if (!x || x.status !== 'registering') return false;
  const n = seated(r).length;
  return n >= SEATS || (n >= 2 && !!x.startsAt && now >= x.startsAt);
}

/** Starts it, dealing the first hand's betting. With `scale`, a short field plays for prizes in proportion. */
export function start(r, now = Date.now(), { scale = false } = {}) {
  const x = tt(r);
  const n = seated(r).length;
  if (!x || x.status !== 'registering' || n < 2) return false;
  x.status = 'running';
  x.startedAt = now;
  x.entrants = n;
  const factor = scale ? Math.min(1, n / SEATS) : 1;
  x.prizes = x.prizes.slice(0, Math.max(1, Math.min(x.prizes.length, n - 1))).map((p) => Math.round((p * factor) / 1000) * 1000);
  r.round = 0;
  startRoundLogic(r);
  log(r, `${x.name} begins: ${n} players, ${START_STACK.toLocaleString()} chips each, ${HANDS} hands.`);
  return true;
}

/** Hands left after the one in play. */
export const handsLeft = (r) => Math.max(0, HANDS - (r.round || 0));

/**
 * Betting time is up: anyone who hasn't bet is bet the minimum, so the
 * table never waits and nobody is left out of a hand; the deal follows.
 */
export function autoBets(r) {
  if (!running(r) || r.phase !== 'betting') return [];
  const auto = [];
  seated(r).forEach((k) => {
    const p = r.players[k];
    if (p.status === 'betting' && p.chips >= MIN_BET) {
      p.bet = MIN_BET; p.status = 'bet-placed';
      auto.push(k);
      log(r, p.name + ' is bet the minimum.');
    }
  });
  // With every bet down, the cards go out.
  if (auto.length) checkAutoDeal(r);
  return auto;
}

function place(r, key, position, prize) {
  const x = tt(r);
  const p = r.players[key];
  x.places[key] = { place: position, name: p ? p.name : 'A player', character: (p && p.character) || null, chips: p ? p.chips : 0, prize, bot: !!(p && p.bot) };
  if (prize && !(p && p.bot)) {
    if (!r.prizes) r.prizes = {};
    r.prizes[key] = (r.prizes[key] || 0) + prize;
  }
}

// Takes a player off the table, mid-hand included: their boxes are passed
// over, and if it was their turn, play moves on.
function unseat(r, key) {
  const cur = (r.turnOrder || [])[r.currentTurnIndex];
  delete r.players[key];
  r.playerOrder = (r.playerOrder || []).filter((k) => k !== key);
  r.dealtIn = (r.dealtIn || []).filter((k) => k !== key);
  if (r.phase === 'playing' && cur && cur.pid === key) {
    // enterTurn passes over anything else of theirs, on to the next box or
    // the dealer.
    r.currentTurnIndex++;
    enterTurn(r);
  }
}

/**
 * The places from `from` down, for `keys` ranked by chips. Tied stacks
 * share a place and split the prizes of the places they span.
 */
function rankInto(r, keys, from) {
  const x = tt(r);
  const sorted = keys.slice().sort((a, b) => r.players[b].chips - r.players[a].chips);
  let i = 0;
  while (i < sorted.length) {
    let j = i;
    while (j + 1 < sorted.length && r.players[sorted[j + 1]].chips === r.players[sorted[i]].chips) j++;
    const group = sorted.slice(i, j + 1);
    let pot = 0;
    for (let at = from + i; at <= from + j; at++) pot += x.prizes[at - 1] || 0;
    const share = Math.floor(pot / group.length);
    group.forEach((k) => place(r, k, from + i, share));
    i = j + 1;
  }
}

/**
 * A hand is over and its pause too: whoever can't cover the minimum is
 * out; after the last hand — or with one player left — the stacks decide
 * the places. Otherwise the next hand. Call instead of startRoundLogic.
 */
export function afterRound(r, now = Date.now()) {
  const x = tt(r);
  if (!x || x.status !== 'running' || r.phase !== 'results') return;
  const keys = seated(r);
  const broke = keys.filter((k) => r.players[k].chips < MIN_BET);
  const alive = keys.filter((k) => r.players[k].chips >= MIN_BET);
  if (broke.length) {
    rankInto(r, broke, alive.length + 1);
    broke.forEach((k) => {
      log(r, `${r.players[k].name} is out, in ${ordinal(x.places[k].place)}.`);
      unseat(r, k);
    });
  }
  if ((r.round || 0) >= HANDS || alive.length <= 1) {
    finish(r, now);
    return;
  }
  startRoundLogic(r);
  if (r.round === HANDS) log(r, 'Final hand!');
  else log(r, `Hand ${r.round} of ${HANDS}.`);
}

function finish(r, now) {
  const x = tt(r);
  const left = seated(r);
  rankInto(r, left, 1);
  const winner = left.find((k) => x.places[k].place === 1);
  if (winner) log(r, `${r.players[winner].name} wins the ${x.name}${x.places[winner].prize ? ' and ' + x.places[winner].prize.toLocaleString() : ''}!`);
  x.status = 'finished';
  x.finishedAt = now;
  r.phase = 'lobby';
  r.bettingDeadline = null;
  r.turnDeadline = null;
}

/**
 * A player leaving. Before the start they are simply unregistered (the
 * caller refunds the buy-in). Once running it is a forfeit: off the table,
 * placed below everyone still in. Returns 'refund' (before the start, for
 * a person), 'forfeit', or null.
 */
export function withdraw(r, key, now = Date.now()) {
  const x = tt(r);
  const p = r.players && r.players[key];
  if (!x || !p) return null;
  if (x.status === 'registering') {
    delete r.players[key];
    r.playerOrder = (r.playerOrder || []).filter((k) => k !== key);
    x.entrants = seated(r).length;
    if (x.entrants < 2) x.startsAt = null;
    return p.bot ? null : 'refund';
  }
  if (x.status !== 'running') {
    delete r.players[key];
    r.playerOrder = (r.playerOrder || []).filter((k) => k !== key);
    return null;
  }
  const at = seated(r).length;
  place(r, key, at, x.prizes[at - 1] && at > 1 ? x.prizes[at - 1] : 0);
  log(r, `${p.name} leaves, finishing ${ordinal(at)}.`);
  unseat(r, key);
  if (seated(r).length <= 1 && r.phase !== 'playing' && r.phase !== 'insurance') finish(r, now);
  return 'forfeit';
}

/** Where `key` finished, once they have. */
export function placeOf(r, key) {
  return (isBjTournament(r) && tt(r).places[key]) || null;
}

/** Standings, best first: those still in by chips, then the places given. */
export function standings(r) {
  const x = isBjTournament(r) && tt(r);
  if (!x) return [];
  const inPlay = seated(r).filter((k) => !x.places[k])
    .map((key) => ({ key, name: r.players[key].name, character: r.players[key].character || null, chips: r.players[key].chips, bot: !!r.players[key].bot }))
    .sort((a, b) => b.chips - a.chips);
  const placed = Object.entries(x.places).map(([key, v]) => ({ key, ...v })).sort((a, b) => a.place - b.place);
  return inPlay.concat(placed.filter((e) => !inPlay.some((q) => q.key === e.key)));
}

export function ordinal(n) {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

/** The clock pill while registering: how many are in, and when it starts. */
export function registrationLabel(r, now = Date.now()) {
  const x = r.tournament;
  const n = seated(r).length;
  if (n < 2 || !x.startsAt) return `Registering · ${n}/${SEATS} · waiting for a second player`;
  const secs = Math.max(0, Math.ceil((x.startsAt - now) / 1000));
  return `Registering · ${n}/${SEATS} · starts in ${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;
}
