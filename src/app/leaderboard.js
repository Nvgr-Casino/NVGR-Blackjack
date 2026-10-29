// The leaderboard: every player's balance and tournament record, side by
// side for the lobby. Accounts are private to their owner, so each player's
// own client copies its numbers to a public entry, rooms/LEADERBOARD/<key>
// — under rooms/ because that is where the database lets any signed-in
// player write (it can't collide with a table: their codes are four
// letters).
//
// Entries: { name, character, chips, at, record: { wins, cashes, winnings,
// best } }. The record is a child of its own because it is added to by
// transaction, and the balance written over its siblings in between would
// otherwise abort that transaction — the same way a write inside a room
// once cost a seat (see pokerSession.js).

import { ref, get, update, runTransaction } from 'firebase/database';
import { db } from '../firebase/config.js';
import { safeKey } from './roomLogic.js';

const PATH = 'rooms/LEADERBOARD';
const entryRef = (uid) => ref(db, PATH + '/' + safeKey(uid));

export let entries = null;   // [{ key, ...entry }] once loaded

// A balance changes with every hand, so its copy is written at most every
// few seconds, the latest value winning.
const BALANCE_EVERY_MS = 8000;
let pending = null;
let timer = null;
let lastWritten = 0;

/** Notes this player's balance for the board. */
export function noteBalance(uid, name, chips, character) {
  if (!uid) return;
  pending = { uid, data: { name: name || 'Player', chips, character: character || null, at: Date.now() } };
  const wait = Math.max(0, lastWritten + BALANCE_EVERY_MS - Date.now());
  if (timer) return;
  timer = setTimeout(flush, wait);
}
function flush() {
  timer = null;
  if (!pending) return;
  const { uid, data } = pending;
  pending = null;
  lastWritten = Date.now();
  update(entryRef(uid), data).catch(() => {});
}

/** Adds a tournament finish to this player's record. */
export async function recordTournament(uid, { name, character, place, prize }) {
  if (!uid) return;
  update(entryRef(uid), { name: name || 'Player', character: character || null }).catch(() => {});
  await runTransaction(ref(db, PATH + '/' + safeKey(uid) + '/record'), (e) => {
    const x = e || {};
    x.wins = (x.wins || 0) + (place === 1 ? 1 : 0);
    x.cashes = (x.cashes || 0) + (prize > 0 ? 1 : 0);
    x.winnings = (x.winnings || 0) + (prize || 0);
    x.best = x.best ? Math.min(x.best, place) : place;
    x.at = Date.now();
    return x;
  }).catch(() => {});
}

export async function loadLeaderboard() {
  const snap = await get(ref(db, PATH));
  const all = snap.val() || {};
  entries = Object.entries(all)
    .filter(([, e]) => e && typeof e === 'object' && e.name)
    .map(([key, e]) => {
      const rec = e.record || {};
      return { key, name: e.name, character: e.character || null, chips: e.chips || 0, wins: rec.wins || 0, cashes: rec.cashes || 0, winnings: rec.winnings || 0, best: rec.best || null };
    });
  return entries;
}

/** The board ranked by `by` — 'chips' or 'winnings' — best first. */
export function ranked(by = 'chips') {
  const list = (entries || []).slice();
  if (by === 'winnings') {
    return list.filter((e) => e.winnings > 0 || e.wins > 0)
      .sort((a, b) => b.winnings - a.winnings || b.wins - a.wins || a.name.localeCompare(b.name));
  }
  return list.sort((a, b) => b.chips - a.chips || a.name.localeCompare(b.name));
}

/** This player's place on the board (1-based), or null. */
export function rankOf(uid, by = 'chips') {
  if (!uid) return null;
  const i = ranked(by).findIndex((e) => e.key === safeKey(uid));
  return i < 0 ? null : i + 1;
}
