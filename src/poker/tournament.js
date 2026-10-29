// Sit & Go tournaments: six seats, everyone starting on the same stack of
// tournament chips, blinds climbing every few hands, players knocked out as
// they lose their chips, and the top three paid from the prize pool.
// Pure functions on the room, alongside the cash-game rules (rules.js),
// which play each hand; this module decides who is still in, what the
// blinds are, and who wins what.
//
// Tournament chips are not money: the buy-in buys a seat and a stack, the
// stack is never cashed out (rules.standUp knows), and what you take away
// is your prize.

import * as R from './rules.js';

// The prize for first is ten buy-ins, second two and a half, third one —
// for a full table. Online, a table that starts short pays in proportion.
export const TOURNAMENTS = [
  { id: 'starter', name: 'Starter', tier: 1, buyIn: 10000, prizes: [100000, 25000, 10000] },
  { id: 'classic', name: 'Classic', tier: 3, buyIn: 50000, prizes: [500000, 125000, 50000] },
  { id: 'highroller', name: 'High Roller', tier: 4, buyIn: 100000, prizes: [1000000, 250000, 100000], featured: true },
  { id: 'millionaire', name: 'Millionaire', tier: 5, buyIn: 250000, prizes: [2500000, 625000, 250000] },
  { id: 'diamond', name: 'Diamond', tier: 5, buyIn: 1000000, prizes: [10000000, 2500000, 1000000] },
];
export const tournamentById = (id) => TOURNAMENTS.find((d) => d.id === id) || null;

export const SEATS = R.POKER_SEATS;
export const START_STACK = 5000;
export const HANDS_PER_LEVEL = 5;
// Small blind / big blind by level; the last level repeats.
export const LEVELS = [
  [25, 50], [50, 100], [75, 150], [100, 200], [150, 300], [200, 400], [300, 600],
  [400, 800], [500, 1000], [700, 1400], [1000, 2000], [1500, 3000], [2000, 4000], [3000, 6000], [5000, 10000],
];
// Online: once two have registered, the rest have this long to join.
export const START_WAIT_MS = 90 * 1000;
// Online: a player sitting out — gone, or out of time — this long forfeits.
export const AWAY_LIMIT_MS = 3 * 60 * 1000;

const log = (room, line) => { room.log = (room.log || []).concat(line).slice(-10); };
const t = (room) => room.tournament;
export const isTournament = (room) => !!(room && room.tournament);
export const registering = (room) => isTournament(room) && t(room).status === 'registering';
export const running = (room) => isTournament(room) && t(room).status === 'running';
export const finished = (room) => isTournament(room) && t(room).status === 'finished';

/** Makes `room` a tournament table for `def`, waiting for entrants. */
export function setupTournament(room, def) {
  room.tournament = {
    id: def.id, name: def.name, buyIn: def.buyIn, prizes: def.prizes.slice(),
    status: 'registering', level: 0, handsAtLevel: 0, entrants: 0,
    places: {}, startsAt: null,
  };
  room.tier = def.tier;
  [room.sb, room.bb] = LEVELS[0];
  return room;
}

// The database drops empty maps; put them back.
function tt(room) {
  const x = t(room);
  if (x && !x.places) x.places = {};
  if (x && !x.prizes) x.prizes = [];
  return x;
}

/** How many are still in: seated with chips, or all in on the hand being played. */
export function playersLeft(room) {
  return Object.values(room.players || {}).filter((p) => typeof p.stack === 'number' && p.stack > 0).length;
}

/**
 * Seats a registered player with the starting stack. The buy-in itself is
 * the caller's to take. Returns false if the tournament has started or is
 * full.
 */
export function register(room, key, { name, character, bot = false, now = Date.now() }) {
  const x = tt(room);
  if (!x || x.status !== 'registering' || (room.players && room.players[key])) return false;
  if (!room.players) room.players = {};
  const taken = new Set(Object.values(room.players).map((p) => p.seat));
  let seat = -1;
  for (let s = 0; s < SEATS; s++) if (!taken.has(s)) { seat = s; break; }
  if (seat < 0) return false;
  room.players[key] = { name, character: character || null, seat, stack: START_STACK, status: 'active', waitBB: false, timeouts: 0, timeBank: R.TIME_BANK_SECONDS, bot };
  x.entrants = Object.keys(room.players).length;
  if (x.entrants >= 2 && !x.startsAt) x.startsAt = now + START_WAIT_MS;
  log(room, name + ' registers.');
  return true;
}

/** Whether a registering tournament should start now: full, or two or more and the wait is over. */
export function canStart(room, now = Date.now()) {
  const x = tt(room);
  if (!x || x.status !== 'registering') return false;
  const n = Object.keys(room.players || {}).length;
  return n >= SEATS || (n >= 2 && !!x.startsAt && now >= x.startsAt);
}

/**
 * Starts it. Paid places are never more than the field less one; with
 * `scale`, a short field's prizes are in proportion to a full table's.
 */
export function start(room, now = Date.now(), { scale = false } = {}) {
  const x = tt(room);
  const n = Object.keys(room.players || {}).length;
  if (!x || x.status !== 'registering' || n < 2) return false;
  x.status = 'running';
  x.startedAt = now;
  x.entrants = n;
  const factor = scale ? Math.min(1, n / SEATS) : 1;
  x.prizes = x.prizes.slice(0, Math.max(1, Math.min(x.prizes.length, n - 1))).map((p) => Math.round((p * factor) / 1000) * 1000);
  x.level = 0;
  x.handsAtLevel = 0;
  [room.sb, room.bb] = LEVELS[0];
  Object.values(room.players).forEach((p) => { p.waitBB = false; p.status = 'active'; p.timeouts = 0; });
  log(room, `${x.name} begins: ${n} players, ${START_STACK.toLocaleString()} chips each.`);
  return true;
}

/** Before each hand: the blinds for this level, rising every few hands. */
export function beforeHand(room) {
  const x = tt(room);
  if (!x || x.status !== 'running') return;
  if (x.handsAtLevel >= HANDS_PER_LEVEL && x.level < LEVELS.length - 1) {
    x.level += 1;
    x.handsAtLevel = 0;
    const [sb, bb] = LEVELS[x.level];
    log(room, `Blinds up: ${sb.toLocaleString()} / ${bb.toLocaleString()}.`);
  }
  [room.sb, room.bb] = LEVELS[x.level];
  x.handsAtLevel += 1;
}

/** Hands left at this level, counting the one in play, before the blinds go up. */
export function handsToNextLevel(room) {
  const x = tt(room);
  return x ? Math.max(0, HANDS_PER_LEVEL - x.handsAtLevel) : 0;
}
/** The blinds after these, or null at the top. */
export function nextLevel(room) {
  const x = tt(room);
  return x && x.level < LEVELS.length - 1 ? LEVELS[x.level + 1] : null;
}

function place(room, key, position) {
  const x = tt(room);
  const p = room.players[key];
  const prize = x.prizes[position - 1] || 0;
  x.places[key] = { place: position, name: p ? p.name : 'A player', character: (p && p.character) || null, prize, bot: !!(p && p.bot) };
  if (prize && !(p && p.bot)) {
    if (!room.prizes) room.prizes = {};
    room.prizes[key] = (room.prizes[key] || 0) + prize;
  }
}

function finish(room, now) {
  const x = tt(room);
  const winner = Object.keys(room.players || {}).find((k) => !x.places[k]);
  if (winner) {
    place(room, winner, 1);
    log(room, `${room.players[winner].name} wins the ${x.name}${x.places[winner].prize ? ' and ' + x.places[winner].prize.toLocaleString() : ''}!`);
  }
  x.status = 'finished';
  x.finishedAt = now;
}

/**
 * After a hand is over (phase 'done', before rules.clearHand): anyone out of
 * chips is knocked out. Two out in the same hand: the one who started it
 * with more chips finishes higher. The last one standing wins. Returns the
 * keys knocked out.
 */
export function afterHand(room, now = Date.now()) {
  const x = tt(room);
  if (!x || x.status !== 'running') return [];
  const h = room.hand;
  const startedWith = (k) => room.players[k].stack + ((h && h.committed && h.committed[k]) || 0);
  const out = Object.keys(room.players || {}).filter((k) => room.players[k].stack <= 0 && !x.places[k]);
  out.sort((a, b) => startedWith(b) - startedWith(a));
  const left = playersLeft(room);
  out.forEach((k, i) => {
    const at = left + i + 1;
    place(room, k, at);
    log(room, `${room.players[k].name} finishes ${ordinal(at)}${x.places[k].prize ? ', winning ' + x.places[k].prize.toLocaleString() : ''}.`);
    delete room.players[k];
  });
  if (Object.keys(room.players || {}).length <= 1) finish(room, now);
  return out;
}

/**
 * A player leaving. Before the start their buy-in goes back, into the
 * room's cashout for their own client to collect. Once it is running it is
 * a forfeit: folded out of any hand, and placed where they stood.
 */
export function withdraw(room, key, now = Date.now()) {
  const x = tt(room);
  const p = room.players && room.players[key];
  if (!x || !p) return;
  if (x.status === 'registering') {
    if (!p.bot) {
      if (!room.cashout) room.cashout = {};
      room.cashout[key] = (room.cashout[key] || 0) + x.buyIn;
    }
    delete room.players[key];
    x.entrants = Object.keys(room.players).length;
    if (x.entrants < 2) x.startsAt = null;
    log(room, p.name + ' unregisters.');
    return;
  }
  if (x.status !== 'running') { delete room.players[key]; return; }
  // Everyone still seated is still in, the leaver among them.
  const at = Object.keys(room.players).length;
  place(room, key, at);
  log(room, `${p.name} leaves, finishing ${ordinal(at)}.`);
  R.leave(room, key, now);
  const playing = room.hand && room.hand.phase !== 'done';
  if (!playing && Object.keys(room.players).length <= 1) finish(room, now);
}

/** Online, between hands: anyone sitting out too long forfeits. Returns who. */
export function forfeitAway(room, now = Date.now()) {
  if (!running(room) || room.hand) return [];
  const gone = Object.keys(room.players || {}).filter((k) => {
    const p = room.players[k];
    return p.status === 'sitout' && p.sitOutAt && now - p.sitOutAt > AWAY_LIMIT_MS;
  });
  gone.forEach((k) => { if (running(room)) withdraw(room, k, now); });
  return gone;
}

/** Where `key` finished, once they have: { place, prize, name }. */
export function placeOf(room, key) {
  const x = isTournament(room) && tt(room);
  return (x && x.places[key]) || null;
}

/** Final standings so far, best first: the places given, then those still in by stack. */
export function standings(room) {
  const x = tt(room);
  if (!x) return [];
  const placed = Object.entries(x.places).map(([key, v]) => ({ key, ...v }));
  const inPlay = Object.entries(room.players || {}).filter(([k]) => !x.places[k])
    .map(([key, p]) => ({ key, name: p.name, character: p.character || null, stack: p.stack, bot: !!p.bot }))
    .sort((a, b) => b.stack - a.stack);
  return inPlay.concat(placed.sort((a, b) => a.place - b.place));
}

export function ordinal(n) {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}
