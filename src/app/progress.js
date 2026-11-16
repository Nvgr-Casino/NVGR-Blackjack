// A player's progress: experience and level, the stats on their profile
// (games played, biggest win, favourite game, the date they joined), the
// daily bonus and the gift each new level brings.
//
// Private progress lives on the account (accounts/{uid}: xp, giftsClaimed,
// bonusAt, bonusStreak, joinedAt); what other players may see lives in the
// public profile (profiles/{uid}: name, photo, joinedAt, level, biggestWin,
// gamesPlayed, favGame). Both are allowed by firebase-database.rules.json.
//
// Stats come from the balance itself: every save of the account's chips
// made by play (session.saveAccountChips with play set) is compared with
// the one before. Chips going down is a bet — experience for every chip
// wagered, and the first bet of a round counts a game played; chips coming
// back up is a payout, and what it brings beyond that round's stake is a
// win.

import { ref, get, update } from 'firebase/database';
import { db, auth } from '../firebase/config.js';
import { safeKey } from './roomLogic.js';

// ---------- levels ----------
// Experience: one point for every ten chips wagered. Each level asks a
// little more than the last: level 2 at 1,000, level 10 at about 33,600,
// level 30 at about 220,000.
export const XP_PER_CHIP = 0.1;
export function xpForLevel(level) { return level <= 1 ? 0 : Math.round(1000 * Math.pow(level - 1, 1.6)); }
export function levelFor(xp) { let l = 1; while (xpForLevel(l + 1) <= xp) l++; return l; }
export function levelProgress(xp) {
  const level = levelFor(xp), from = xpForLevel(level), to = xpForLevel(level + 1);
  return { level, into: xp - from, need: to - from, frac: Math.max(0, Math.min(1, (xp - from) / (to - from))) };
}
// The gift for reaching a level: 2,500 chips a level, five times that at
// every tenth.
export function giftFor(level) { return 2500 * level * (level % 10 === 0 ? 5 : 1); }

// ---------- daily bonus ----------
// Once a day; seven days in a row build the reward up, then it starts the
// week again. A day missed starts the streak over.
export const BONUS = [5000, 7500, 10000, 15000, 20000, 30000, 50000];
const DAY = 24 * 60 * 60 * 1000;

export const GAME_NAMES = { blackjack: 'Blackjack', holdem: "Texas Hold'em", roulette: 'Roulette', baccarat: 'Baccarat', craps: 'Craps', slots: 'Slots' };

// The signed-in player's progress, once loaded.
export const prog = {
  loaded: false, key: null, name: '',
  xp: 0, giftsClaimed: 0, bonusAt: 0, bonusStreak: 0, joinedAt: 0,
  gamesPlayed: 0, biggestWin: 0, favGame: null, photo: null,
};
const counts = {};   // games played by game, for the favourite

let onChange = () => {};
export function setProgressListener(fn) { onChange = fn; }

export async function loadProgress(uid, name) {
  const key = safeKey(uid);
  Object.assign(prog, { loaded: false, key, name });
  const [acct, prof] = await Promise.all([
    get(ref(db, 'accounts/' + key)).then((s) => s.val() || {}).catch(() => ({})),
    get(ref(db, 'profiles/' + key)).then((s) => s.val() || {}).catch(() => ({})),
  ]);
  prog.xp = acct.xp || 0;
  prog.giftsClaimed = acct.giftsClaimed || 0;
  prog.bonusAt = acct.bonusAt || 0;
  prog.bonusStreak = acct.bonusStreak || 0;
  prog.gamesPlayed = prof.gamesPlayed || 0;
  prog.biggestWin = prof.biggestWin || 0;
  prog.favGame = prof.favGame || null;
  prog.photo = prof.photo || null;
  try { Object.assign(counts, JSON.parse(localStorage.getItem('nvgr-game-counts-' + key) || '{}')); } catch { /* private mode */ }
  // The day they joined: kept on the account once known; for accounts made
  // before this, the day the sign-in itself was created.
  let joined = acct.joinedAt || prof.joinedAt || 0;
  if (!joined) {
    const made = auth.currentUser && auth.currentUser.metadata && Date.parse(auth.currentUser.metadata.creationTime);
    joined = made || Date.now();
  }
  prog.joinedAt = joined;
  prog.loaded = true;
  if (!acct.joinedAt) update(ref(db, 'accounts/' + key), { joinedAt: joined }).catch(() => {});
  saveProfile();
  onChange();
}

export function resetProgress() {
  Object.assign(prog, { loaded: false, key: null, xp: 0, giftsClaimed: 0, bonusAt: 0, bonusStreak: 0, joinedAt: 0, gamesPlayed: 0, biggestWin: 0, favGame: null, photo: null });
  last = null;
}

// ---------- the public profile ----------
function profileData() {
  return {
    name: (prog.name || 'Player').slice(0, 40),
    joinedAt: prog.joinedAt,
    level: levelFor(prog.xp),
    biggestWin: prog.biggestWin,
    gamesPlayed: prog.gamesPlayed,
    updatedAt: Date.now(),
    ...(prog.favGame ? { favGame: prog.favGame } : {}),
  };
}
function saveProfile() {
  if (!prog.key) return Promise.resolve();
  return update(ref(db, 'profiles/' + prog.key), profileData()).catch(() => {});
}
let saveTimer = null;
function saveSoon() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    if (!prog.key) return;
    update(ref(db, 'accounts/' + prog.key), { xp: Math.round(prog.xp) }).catch(() => {});
    saveProfile();
  }, 3000);
}

// Another player's profile, for their card. Null if they have none yet.
export async function loadProfile(key) {
  const snap = await get(ref(db, 'profiles/' + key)).catch(() => null);
  return snap && snap.exists() ? snap.val() : null;
}

// ---------- play ----------
let last = null, lastBetAt = 0, stake = 0, lastRound = null;
let levelUp = () => {};
export function setLevelUpListener(fn) { levelUp = fn; }

// Called with every balance the account is saved at. `play` is false for
// balance changes that are not play (a bonus, a gift, a re-stake, chips
// handed back on leaving a table); `game` and `round` say where the play
// was, so one round's several bets count as one game.
export function noteBalance(chips, { play = false, game = null, round = null } = {}) {
  if (!prog.loaded || typeof chips !== 'number') return;
  if (last === null || !play) { last = chips; return; }
  const d = chips - last;
  last = chips;
  if (!d) return;
  const now = Date.now();
  if (d < 0) {
    const newRound = game === 'slots' || (round !== null && round !== lastRound) || (round === null && now - lastBetAt > 20000);
    if (newRound) {
      prog.gamesPlayed += 1;
      stake = 0;
      if (game) {
        counts[game] = (counts[game] || 0) + 1;
        try { localStorage.setItem('nvgr-game-counts-' + prog.key, JSON.stringify(counts)); } catch { /* private mode */ }
        prog.favGame = Object.keys(counts).sort((a, b) => counts[b] - counts[a])[0];
      }
    }
    lastRound = round;
    lastBetAt = now;
    stake += -d;
    const before = levelFor(prog.xp);
    prog.xp += -d * XP_PER_CHIP;
    const after = levelFor(prog.xp);
    if (after > before) levelUp(after);
  } else {
    const won = d - stake;
    stake = 0;
    if (won > prog.biggestWin) prog.biggestWin = won;
  }
  saveSoon();
  onChange();
}

// ---------- the daily bonus ----------
export function bonusState(now = Date.now()) {
  const since = now - prog.bonusAt;
  const ready = prog.loaded && (!prog.bonusAt || since >= DAY);
  const broken = !prog.bonusAt || since >= 2 * DAY;
  const streak = broken ? 0 : prog.bonusStreak;
  const day = ready ? (streak % 7) + 1 : ((Math.max(1, prog.bonusStreak) - 1) % 7) + 1;
  return { ready, day, amount: BONUS[day - 1], nextAt: prog.bonusAt + DAY };
}
// Gives today's bonus; returns the chips given, or 0 if it is not ready.
export async function claimBonus(giveChips) {
  const st = bonusState();
  if (!st.ready) return 0;
  const now = Date.now();
  const broken = !prog.bonusAt || now - prog.bonusAt >= 2 * DAY;
  prog.bonusStreak = broken ? 1 : prog.bonusStreak + 1;
  prog.bonusAt = now;
  await update(ref(db, 'accounts/' + prog.key), { bonusAt: now, bonusStreak: prog.bonusStreak });
  await giveChips(st.amount);
  onChange();
  return st.amount;
}

// ---------- level gifts ----------
export function giftsWaiting() { return Math.max(0, levelFor(prog.xp) - 1 - prog.giftsClaimed); }
export function nextGift() { return giftFor(prog.giftsClaimed + 2); }
export async function claimGift(giveChips) {
  if (!giftsWaiting()) return 0;
  const level = prog.giftsClaimed + 2;
  const amount = giftFor(level);
  prog.giftsClaimed += 1;
  await update(ref(db, 'accounts/' + prog.key), { giftsClaimed: prog.giftsClaimed });
  await giveChips(amount);
  onChange();
  return amount;
}

// ---------- the picture ----------
// Any photo, cropped square and made small enough to keep in the profile
// itself (a few kilobytes as a JPEG).
export async function setPhoto(file) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
    const S = 192, c = document.createElement('canvas');
    c.width = c.height = S;
    const side = Math.min(img.naturalWidth, img.naturalHeight);
    c.getContext('2d').drawImage(img, (img.naturalWidth - side) / 2, (img.naturalHeight - side) / 2, side, side, 0, 0, S, S);
    let q = 0.85, data = c.toDataURL('image/jpeg', q);
    while (data.length > 29000 && q > 0.3) { q -= 0.1; data = c.toDataURL('image/jpeg', q); }
    if (data.length > 29000) throw new Error('too large');
    await update(ref(db, 'profiles/' + prog.key), { photo: data, updatedAt: Date.now() });
    prog.photo = data;
    onChange();
    return true;
  } finally {
    URL.revokeObjectURL(url);
  }
}
