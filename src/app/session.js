// Ported from index4.html (the live app) — session state, auth, and room
// lifecycle. Firebase calls are unchanged from the reference; the only
// structural difference is that instead of a single global render() this
// calls whatever render callback main.js registers via setOnChange(), so
// this module doesn't need to know about the DOM or the 3D scene.
import {
  GoogleAuthProvider, signInWithPopup,
  createUserWithEmailAndPassword, signInWithEmailAndPassword,
  updateProfile, onAuthStateChanged, signOut,
} from 'firebase/auth';
import { ref, get, set, update, onValue, runTransaction } from 'firebase/database';
import { auth, db } from '../firebase/config.js';
import { FELT_THEME_KEYS } from '../scene/table.js';
import { defaultCharacterFor } from '../scene/character.js';
// Circular by design: social.js reads session state and calls refresh().
// Both sides only touch each other inside functions, never at module load,
// so the cycle resolves fine.
import { initSocial, stopSocial, goOffline } from './social.js';
import {
  STARTING_CHIPS, BETTING_SECONDS, TURN_SECONDS, MAX_PUBLIC_SEATS, MIN_PUBLIC_TABLES,
  safeKey, genCode, shuffleShoe, drawCard, addPlayerToRoom, startRoundLogic, dealRoundCards,
  checkAutoDeal, processBettingTimeoutLogic, processTurnTimeoutLogic, resolveDealerAndPayouts,
  advanceTurnIn, rankOf, handValue, chipLadderForTable, stakesFor, TABLE_STAKES,
  everyoneDecidedInsurance, resolveInsurance, processInsuranceTimeout,
} from './roomLogic.js';

export let session = { screen: 'loading', uid: null, name: null, photo: null, chips: 0, character: null, code: null, isAdmin: false, room: null };
export let roomUnsub = null;
let tickTimer = null;
export let formError = '';
export let formNotice = '';
export let authBusy = false;
export let authMode = 'signin';
export let connLost = false;
export let lobbyTables = null;
export let lobbyLoading = false;
export let chatOpen = false;
export let hostOpen = false;
export let pendingBet = 0;
let pendingBetRound = null;

let onChange = () => {};
export function setOnChange(fn) { onChange = fn; }
function render() { onChange(); }
// Lets sibling modules (social.js) redraw after their own live data lands,
// without each of them owning a copy of the render wiring.
export function refresh() { onChange(); }

export function setAuthMode(mode) { authMode = mode; formError = ''; render(); }
export function setChatOpen(open) { chatOpen = open; render(); }
export function setHostOpen(open) { hostOpen = open; render(); }
export function clearFormNotice() { formNotice = ''; }
export function goToScreen(screen) { session.screen = screen; formError = ''; render(); }

// ---------- Account helpers ----------
async function loadAccount(uid) {
  const snap = await get(ref(db, 'accounts/' + safeKey(uid)));
  return snap.exists() ? snap.val() : null;
}
async function ensureAccount(uid, name) {
  const existing = await loadAccount(uid);
  if (existing) {
    return { chips: existing.chips, character: existing.character || defaultCharacterFor(safeKey(uid)) };
  }
  const character = defaultCharacterFor(safeKey(uid));
  await set(ref(db, 'accounts/' + safeKey(uid)), { name, chips: STARTING_CHIPS, character, updatedAt: Date.now() });
  return { chips: STARTING_CHIPS, character };
}

// The chosen figure lives on the account so it follows the player between
// tables, and is copied onto their seat so everyone else can render it.
export async function chooseCharacter(id) {
  session.character = id;
  render();
  await set(ref(db, 'accounts/' + safeKey(session.uid) + '/character'), id).catch(() => {});
  if (session.code) {
    await mutateRoom(session.code, (r) => {
      const p = r.players && r.players[safeKey(session.uid)];
      if (p) p.character = id;
    });
  }
}
// update(), not set(): a full write here would drop the sibling fields on
// the account — the chosen character and currentRoom — every time a hand
// settled.
async function saveAccountChips(uid, name, chips) {
  await update(ref(db, 'accounts/' + safeKey(uid)), { name, chips, updatedAt: Date.now() });
}
async function setCurrentRoom(uid, code) {
  await set(ref(db, 'accounts/' + safeKey(uid) + '/currentRoom'), code || null);
}

// ---------- Auth ----------
export function initAuth() {
  onAuthStateChanged(auth, async (user) => {
    if (user) {
      session.uid = user.uid;
      session.name = user.displayName || (user.email ? user.email.split('@')[0] : 'Player');
      session.photo = user.photoURL || null;
      const account = await ensureAccount(user.uid, session.name);
      session.chips = account.chips;
      session.character = account.character;
      initSocial();
      const acctSnap = await get(ref(db, 'accounts/' + safeKey(user.uid) + '/currentRoom'));
      const lastRoom = acctSnap.exists() ? acctSnap.val() : null;
      if (lastRoom) {
        const roomSnap = await get(ref(db, 'rooms/' + lastRoom));
        const room = roomSnap.val();
        if (room && room.players && room.players[safeKey(user.uid)]) {
          enterTable(lastRoom);
          return;
        } else {
          await setCurrentRoom(user.uid, null);
        }
      }
      session.screen = 'home';
      render();
      loadLobby();
    } else {
      stopSocial();
      session = { screen: 'auth', uid: null, name: null, photo: null, chips: 0, character: null, code: null, isAdmin: false, room: null };
      render();
    }
  });
}

export async function signInGoogle() {
  formError = ''; authBusy = true; render();
  try { await signInWithPopup(auth, new GoogleAuthProvider()); }
  catch (e) { formError = 'Google sign-in failed. Please try again.'; }
  authBusy = false; render();
}
export async function signUpEmail(email, password, displayName) {
  formError = '';
  if (!displayName || !displayName.trim()) { formError = 'Enter a display name.'; render(); return; }
  if (!email || !password) { formError = 'Enter an email and password.'; render(); return; }
  authBusy = true; render();
  try {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(cred.user, { displayName: displayName.trim() });
    session.name = displayName.trim();
  }
  catch (e) { formError = friendlyAuthError(e); }
  authBusy = false; render();
}
export async function signInEmail(email, password) {
  formError = '';
  if (!email || !password) { formError = 'Enter an email and password.'; render(); return; }
  authBusy = true; render();
  try { await signInWithEmailAndPassword(auth, email, password); }
  catch (e) { formError = friendlyAuthError(e); }
  authBusy = false; render();
}
function friendlyAuthError(e) {
  const code = (e && e.code) || '';
  if (code.includes('email-already-in-use')) return 'That email already has an account — try signing in instead.';
  if (code.includes('invalid-credential') || code.includes('wrong-password') || code.includes('user-not-found')) return 'Incorrect email or password.';
  if (code.includes('weak-password')) return 'Password should be at least 6 characters.';
  if (code.includes('invalid-email')) return 'Enter a valid email address.';
  return 'Something went wrong. Please try again.';
}
export async function doSignOut() {
  if (roomUnsub) { roomUnsub(); roomUnsub = null; }
  clearTick();
  await goOffline();
  await signOut(auth);
}

// ---------- Room lifecycle ----------
export function enterTable(code) {
  session.code = code;
  session.screen = 'table';
  formNotice = '';
  chatOpen = false;
  hostOpen = false;
  lastSavedChips = null;
  if (roomUnsub) { roomUnsub(); roomUnsub = null; }
  const myKey = safeKey(session.uid);
  const roomRef = ref(db, 'rooms/' + code);
  let sawSelfSeated = false;
  roomUnsub = onValue(roomRef, (snap) => {
    const newRoom = snap.val();
    const nowSeated = !!(newRoom && newRoom.players && newRoom.players[myKey]);
    if (nowSeated) sawSelfSeated = true;
    if (sawSelfSeated && !nowSeated) {
      handleRemovedFromTable();
      return;
    }
    session.room = newRoom;
    session.isAdmin = !!(newRoom && newRoom.adminId === myKey);
    persistMyChips(newRoom);
    render();
  });
  startTick();
  updateHash();
  render();
}

function handleRemovedFromTable() {
  if (roomUnsub) { roomUnsub(); roomUnsub = null; }
  clearTick();
  setCurrentRoom(session.uid, null).catch(() => {});
  session.code = null; session.room = null; session.screen = 'home';
  formNotice = 'You were removed from the table after missing too many bets in a row.';
  updateHash(); render();
  loadLobby();
}

function updateHash() {
  if (session.code) location.hash = 'room=' + session.code;
  else history.replaceState(null, '', location.pathname);
}

function startTick() {
  if (tickTimer) return;
  tickTimer = setInterval(() => {
    const r = session.room;
    if (r) {
      if (r.phase === 'betting' && r.bettingDeadline && Date.now() >= r.bettingDeadline) {
        mutateRoom(session.code, (rr) => processBettingTimeoutLogic(rr));
      } else if (r.phase === 'insurance' && (!r.insuranceDeadline || Date.now() >= r.insuranceDeadline)) {
        mutateRoom(session.code, (rr) => processInsuranceTimeout(rr));
      } else if (r.phase === 'playing' && (!r.turnDeadline || Date.now() >= r.turnDeadline)) {
        mutateRoom(session.code, (rr) => processTurnTimeoutLogic(rr));
      } else if (r.isPublic && r.phase === 'results' && r.resultsAt && (Date.now() - r.resultsAt) >= 4000) {
        mutateRoom(session.code, (rr) => { if (rr.phase === 'results') startRoundLogic(rr); });
      }
    }
    tickCountdownOnly();
  }, 1000);
}
function clearTick() { if (tickTimer) { clearInterval(tickTimer); tickTimer = null; } }
function tickCountdownOnly() {
  const el = document.getElementById('countdownText');
  if (!el || !session.room) return;
  const r = session.room;
  if (r.phase === 'betting' && r.bettingDeadline) {
    const remaining = Math.max(0, Math.ceil((r.bettingDeadline - Date.now()) / 1000));
    el.textContent = 'Betting closes in ' + remaining + 's';
  } else if (r.phase === 'insurance' && r.insuranceDeadline) {
    const remaining = Math.max(0, Math.ceil((r.insuranceDeadline - Date.now()) / 1000));
    el.textContent = 'Insurance closes in ' + remaining + 's';
  } else if (r.phase === 'playing' && r.turnDeadline) {
    const remaining = Math.max(0, Math.ceil((r.turnDeadline - Date.now()) / 1000));
    el.textContent = 'Act within ' + remaining + 's or you’ll be stood';
  }
}

// A player's chips can change because of someone else's action (a dealer
// payout settled by whoever acted last), so this is called from the room
// listener too — not just after this client's own mutations.
let lastSavedChips = null;
function persistMyChips(room) {
  if (!room || !session.uid) return;
  const me = room.players && room.players[safeKey(session.uid)];
  if (!me || typeof me.chips !== 'number') return;
  if (me.chips === lastSavedChips) return;
  lastSavedChips = me.chips;
  session.chips = me.chips;
  saveAccountChips(session.uid, me.name || session.name, me.chips).catch(() => {});
}

export async function mutateRoom(code, fn) {
  try {
    const result = await runTransaction(ref(db, 'rooms/' + code), (current) => {
      if (current === null || current === undefined) return current;
      fn(current);
      return current;
    });
    if (result.committed && result.snapshot.exists()) {
      // Only ever persist your own balance. This used to write an account
      // row for every seated player, which meant the database had to let
      // any signed-in client overwrite anyone's chips. Everyone's own
      // client mirrors their balance instead (see persistMyChips), so the
      // data still keeps up without that hole.
      persistMyChips(result.snapshot.val());
    }
    connLost = false;
  } catch (e) {
    console.error('mutateRoom failed', e);
    connLost = true; render();
  }
}

export async function sendChatMessage(text) {
  text = (text || '').trim().slice(0, 200);
  if (!text || !session.code) return;
  const name = session.name;
  await runTransaction(ref(db, 'rooms/' + session.code), (current) => {
    if (!current) return current;
    current.chat = (current.chat || []).concat({ name, text, ts: Date.now() }).slice(-50);
    return current;
  });
}

export async function createRoom() {
  const chips = (await ensureAccount(session.uid, session.name)).chips;
  const code = genCode();
  const room = {
    code, adminId: safeKey(session.uid), isPublic: false,
    minBet: TABLE_STAKES[1].min, maxBet: TABLE_STAKES[1].max,
    players: {}, playerOrder: [],
    dealer: { hand: [], hiddenRevealed: false },
    deck: [], phase: 'lobby', turnOrder: [], currentTurnIndex: 0, dealtIn: [], round: 0, bettingDeadline: null,
    turnDeadline: null, chat: [], log: ['Table opened.'],
  };
  shuffleShoe(room);
  addPlayerToRoom(room, session.uid, session.name, chips, session.character);
  await set(ref(db, 'rooms/' + code), room);
  await setCurrentRoom(session.uid, code);
  enterTable(code);
}

export async function joinRoom(code) {
  formError = '';
  code = (code || '').trim().toUpperCase();
  if (!code) { formError = 'Enter a table code.'; render(); return; }
  const snap = await get(ref(db, 'rooms/' + code));
  if (!snap.exists()) { formError = 'No table found with that code.'; render(); return; }
  const chips = (await ensureAccount(session.uid, session.name)).chips;
  const key = safeKey(session.uid);
  if (!snap.val().players || !snap.val().players[key]) {
    await runTransaction(ref(db, 'rooms/' + code), (current) => {
      if (!current) return current;
      addPlayerToRoom(current, session.uid, session.name, chips, session.character);
      return current;
    });
  }
  await setCurrentRoom(session.uid, code);
  enterTable(code);
}

// Seats the player and, if the table is idling in the betting phase with no
// live clock (an untouched table, or one whose window lapsed while it sat
// empty), opens a fresh betting window so the round can actually come round.
function seatPlayerIn(current, chips) {
  addPlayerToRoom(current, session.uid, session.name, chips, session.character);
  // Someone who sat out a window and has now chosen this table again is
  // asking to play: addPlayerToRoom leaves an already-seated player alone,
  // so without this they would stay stuck as a spectator with no way back
  // in — and on a table with no other bettors, no new round ever starts.
  const p = current.players[safeKey(session.uid)];
  if (current.phase === 'betting' && p && p.status === 'sitout' && p.chips > 0) {
    p.status = 'betting';
  }
  if (current.phase === 'betting' && (!current.bettingDeadline || current.bettingDeadline < Date.now())) {
    current.bettingDeadline = Date.now() + BETTING_SECONDS * 1000;
  }
}

export async function playNow() {
  formError = '';
  const chips = (await ensureAccount(session.uid, session.name)).chips;
  const key = safeKey(session.uid);
  const idxSnap = await get(ref(db, 'publicIndex/tables'));
  const codes = idxSnap.exists() ? Object.keys(idxSnap.val()) : [];
  for (const code of codes) {
    const result = await runTransaction(ref(db, 'rooms/' + code), (current) => {
      if (!current) return current;
      const count = Object.keys(current.players || {}).length;
      // Already seated is not a no-op: seatPlayerIn is what brings someone
      // back in who sat a window out, so it still has to run. Only a full
      // table blocks a genuinely new seat.
      if (!(current.players && current.players[key]) && count >= MAX_PUBLIC_SEATS) return;
      seatPlayerIn(current, chips);
      return current;
    });
    if (result.committed && result.snapshot.exists()) {
      await setCurrentRoom(session.uid, code);
      enterTable(code);
      return;
    }
  }
  await createPublicTable(chips, key);
}

async function createPublicTable(chips, key) {
  const code = genCode();
  const room = {
    code, adminId: key, isPublic: true,
    minBet: TABLE_STAKES[1].min, maxBet: TABLE_STAKES[1].max,
    players: {}, playerOrder: [],
    dealer: { hand: [], hiddenRevealed: false }, deck: [],
    phase: 'betting', turnOrder: [], currentTurnIndex: 0, dealtIn: [], round: 1,
    bettingDeadline: Date.now() + BETTING_SECONDS * 1000, turnDeadline: null,
    chat: [], log: ['Table opened. Place your bet to jump in.'],
  };
  shuffleShoe(room);
  addPlayerToRoom(room, session.uid, session.name, chips, session.character);
  await set(ref(db, 'rooms/' + code), room);
  await set(ref(db, 'publicIndex/tables/' + code), true);
  await setCurrentRoom(session.uid, code);
  enterTable(code);
}

export async function joinSpecificPublicTable(code) {
  formError = '';
  const chips = (await ensureAccount(session.uid, session.name)).chips;
  const key = safeKey(session.uid);
  const result = await runTransaction(ref(db, 'rooms/' + code), (current) => {
    if (!current) return current;
    const count = Object.keys(current.players || {}).length;
    if (!(current.players && current.players[key]) && count >= MAX_PUBLIC_SEATS) return;
    seatPlayerIn(current, chips);
    return current;
  });
  if (result.committed && result.snapshot.exists()) {
    await setCurrentRoom(session.uid, code);
    enterTable(code);
  } else {
    formError = 'That table just filled up — pick another.';
    render();
    loadLobby();
  }
}

export async function leaveTable() {
  const code = session.code;
  const key = safeKey(session.uid);
  const wasPublic = session.room && session.room.isPublic;
  if (code && wasPublic) {
    runTransaction(ref(db, 'rooms/' + code), (current) => {
      if (!current) return current;
      if (current.players) delete current.players[key];
      current.playerOrder = (current.playerOrder || []).filter((k) => k !== key);
      current.turnOrder = (current.turnOrder || []).filter((e) => e.pid !== key);
      return current;
    }).catch(() => {});
  }
  await setCurrentRoom(session.uid, null);
  if (roomUnsub) { roomUnsub(); roomUnsub = null; }
  clearTick();
  session.code = null; session.room = null; session.screen = 'home';
  updateHash(); render();
  loadLobby();
}

export async function giveChips(pidKey, amount) {
  amount = Math.floor(Number(amount));
  if (!amount || amount <= 0) return;
  await mutateRoom(session.code, (r) => {
    r.players[pidKey].chips += amount;
    r.log = (r.log || []).concat(r.players[pidKey].name + ' received ' + amount + ' chips.').slice(-8);
  });
}

// ---------- Lobby ----------
// An empty table waiting for its first player: dealt from its own shoe,
// open at the betting phase, with no betting clock running until someone
// actually sits down (see seatPlayerIn).
function emptyPublicRoom(stakes, felt) {
  const tier = stakes || TABLE_STAKES[Math.floor(Math.random() * TABLE_STAKES.length)];
  const room = {
    code: genCode(), isPublic: true,
    minBet: tier.min, maxBet: tier.max,
    felt: felt || FELT_THEME_KEYS[Math.floor(Math.random() * FELT_THEME_KEYS.length)],
    players: {}, playerOrder: [],
    dealer: { hand: [], hiddenRevealed: false }, deck: [],
    phase: 'betting', turnOrder: [], currentTurnIndex: 0, dealtIn: [], round: 1,
    bettingDeadline: null, turnDeadline: null,
    chat: [], log: ['Table open — take a seat.'],
  };
  shuffleShoe(room);
  return room;
}

// Seeded tables walk the stakes ladder rather than picking at random, so a
// fresh lobby always offers a spread of limits instead of, say, five
// high-roller tables.
async function ensureOpenTables(tables) {
  const missing = MIN_PUBLIC_TABLES - tables.length;
  if (missing <= 0) return tables;
  const taken = new Set(tables.map((t) => t.minBet));
  const spread = TABLE_STAKES.filter((s) => !taken.has(s.min));
  const created = [];
  for (let i = 0; i < missing; i++) {
    const room = emptyPublicRoom(
      spread[i % spread.length] || TABLE_STAKES[i % TABLE_STAKES.length],
      FELT_THEME_KEYS[(tables.length + i) % FELT_THEME_KEYS.length]
    );
    await set(ref(db, 'rooms/' + room.code), room);
    await set(ref(db, 'publicIndex/tables/' + room.code), true);
    created.push({ code: room.code, count: 0, seats: [], phase: room.phase, minBet: room.minBet, maxBet: room.maxBet, felt: room.felt });
  }
  return tables.concat(created);
}

export async function loadLobby() {
  lobbyLoading = true; render();
  try {
    const idxSnap = await get(ref(db, 'publicIndex/tables'));
    const codes = idxSnap.exists() ? Object.keys(idxSnap.val()) : [];
    const tables = [];
    for (const code of codes) {
      const snap = await get(ref(db, 'rooms/' + code));
      const r = snap.val();
      if (!r || !r.isPublic) continue;
      const seats = Object.values(r.players || {}).map((p) => ({ name: p.name, chips: p.chips || 0, character: p.character || null }));
      // Tables opened before stakes existed would all read as the lowest
      // tier, leaving a lobby of identical rooms — give each one a tier the
      // first time it is seen so the spread is real.
      if (!r.minBet) {
        const tier = TABLE_STAKES[tables.length % TABLE_STAKES.length];
        await set(ref(db, 'rooms/' + code + '/minBet'), tier.min);
        await set(ref(db, 'rooms/' + code + '/maxBet'), tier.max);
        r.minBet = tier.min; r.maxBet = tier.max;
      }
      if (!r.felt) {
        r.felt = FELT_THEME_KEYS[tables.length % FELT_THEME_KEYS.length];
        await set(ref(db, 'rooms/' + code + '/felt'), r.felt);
      }
      const { min, max } = stakesFor(r);
      tables.push({ code, count: seats.length, seats, phase: r.phase, minBet: min, maxBet: max, felt: r.felt });
    }
    tables.sort((a, b) => b.count - a.count);
    lobbyTables = await ensureOpenTables(tables);
  } catch (e) { lobbyTables = []; }
  lobbyLoading = false;
  render();
}

// ---------- Round flow ----------
export async function startRound() { await mutateRoom(session.code, (r) => startRoundLogic(r)); }
export async function dealCards() { await mutateRoom(session.code, (r) => dealRoundCards(r)); }

export async function placeBet(amount) {
  amount = Math.floor(Number(amount));
  await mutateRoom(session.code, (r) => {
    const key = safeKey(session.uid);
    const p = r.players[key];
    if (!p || p.status !== 'betting') return;
    if (!amount || amount <= 0 || amount > p.chips) return;
    // The table's limits are enforced here, inside the transaction, not
    // just greyed out in the UI.
    const { min, max } = stakesFor(r);
    if (amount < min || amount > max) return;
    p.bet = amount; p.lastBet = amount; p.status = 'bet-placed';
    r.log = (r.log || []).concat(p.name + ' bet ' + amount + '.').slice(-8);
    checkAutoDeal(r);
  });
  pendingBet = 0;
}

// Insurance costs half the original bet and is offered only while the
// dealer's Ace is showing, before any cards are played.
export async function takeInsurance(yes) {
  await mutateRoom(session.code, (r) => {
    if (r.phase !== 'insurance') return;
    const key = safeKey(session.uid);
    const p = r.players[key];
    if (!p || p.insuranceDecided) return;
    if (yes) {
      const bet = (p.hands && p.hands[0] && p.hands[0].bet) || p.bet || 0;
      const cost = Math.floor(bet / 2);
      if (cost > 0 && p.chips >= cost) {
        p.chips -= cost;
        p.insurance = cost;
        r.log = (r.log || []).concat(p.name + ' takes insurance.').slice(-8);
      }
    }
    p.insuranceDecided = true;
    if (everyoneDecidedInsurance(r)) resolveInsurance(r);
  });
}

// Late surrender: fold a two-card hand for half the stake back. Not offered
// once a hand has been hit or split.
export async function surrender() {
  await mutateRoom(session.code, (r) => {
    const key = safeKey(session.uid);
    const cur = (r.turnOrder || [])[r.currentTurnIndex];
    if (!cur || cur.pid !== key) return;
    const p = r.players[key];
    const hand = p && p.hands && p.hands[cur.hi];
    if (!hand || hand.status !== 'playing') return;
    if (hand.cards.length !== 2 || p.hands.length > 1) return;
    p.chips += Math.floor(hand.bet / 2);
    hand.status = 'surrendered';
    r.log = (r.log || []).concat(p.name + ' surrenders.').slice(-8);
    advanceTurnIn(r);
  });
}

export async function sitOutRound() {
  await mutateRoom(session.code, (r) => {
    const key = safeKey(session.uid);
    const p = r.players[key];
    if (!p || p.status !== 'betting') return;
    p.status = 'sitout';
    r.log = (r.log || []).concat(p.name + ' sits this round out.').slice(-8);
    checkAutoDeal(r);
  });
}

// ---------- Chip selector ----------
export function addChipToBet(value) {
  const key = safeKey(session.uid);
  const me = session.room && session.room.players[key];
  if (!me) return;
  if (pendingBet + value > me.chips) return;
  pendingBet += value;
  render();
}
export function clearPendingBet() { pendingBet = 0; render(); }
export function repeatPendingBet() {
  const key = safeKey(session.uid);
  const me = session.room && session.room.players[key];
  if (!me || !me.lastBet) return;
  pendingBet = Math.min(me.lastBet, me.chips);
  render();
}
export async function confirmPendingBet() {
  if (pendingBet <= 0) return;
  await placeBet(pendingBet);
}
export function syncPendingBetRound(round) {
  if (pendingBetRound !== round) { pendingBet = 0; pendingBetRound = round; }
}
export function setPendingBetClamped(max) {
  if (pendingBet > max) pendingBet = max;
}

export { chipLadderForTable, stakesFor };

export async function hit() {
  await mutateRoom(session.code, (r) => {
    const key = safeKey(session.uid);
    const cur = r.turnOrder[r.currentTurnIndex];
    if (!cur || cur.pid !== key) return;
    const p = r.players[key];
    const hand = p.hands[cur.hi];
    if (!hand || hand.status !== 'playing') return;
    hand.cards.push(drawCard(r));
    if (handValue(hand.cards) > 21) {
      hand.status = 'busted';
      r.log = (r.log || []).concat(p.name + ' busted.').slice(-8);
      advanceTurnIn(r);
    }
  });
}
export async function stand() {
  await mutateRoom(session.code, (r) => {
    const key = safeKey(session.uid);
    const cur = r.turnOrder[r.currentTurnIndex];
    if (!cur || cur.pid !== key) return;
    const p = r.players[key];
    const hand = p.hands[cur.hi];
    if (!hand || hand.status !== 'playing') return;
    hand.status = 'stood';
    r.log = (r.log || []).concat(p.name + ' stands.').slice(-8);
    advanceTurnIn(r);
  });
}
export async function doubleDown() {
  await mutateRoom(session.code, (r) => {
    const key = safeKey(session.uid);
    const cur = r.turnOrder[r.currentTurnIndex];
    if (!cur || cur.pid !== key) return;
    const p = r.players[key];
    const hand = p.hands[cur.hi];
    if (!hand || hand.status !== 'playing' || hand.cards.length !== 2) return;
    if (p.chips < hand.bet) return;
    p.chips -= hand.bet;
    hand.bet *= 2;
    hand.cards.push(drawCard(r));
    hand.status = handValue(hand.cards) > 21 ? 'busted' : 'stood';
    r.log = (r.log || []).concat(p.name + ' doubles down.').slice(-8);
    advanceTurnIn(r);
  });
}
export async function splitHand() {
  await mutateRoom(session.code, (r) => {
    const key = safeKey(session.uid);
    const cur = r.turnOrder[r.currentTurnIndex];
    if (!cur || cur.pid !== key) return;
    const p = r.players[key];
    const hand = p.hands[cur.hi];
    if (!hand || hand.status !== 'playing' || hand.cards.length !== 2) return;
    if (p.hands.length > 1) return;
    if (rankOf(hand.cards[0]) !== rankOf(hand.cards[1])) return;
    if (p.chips < hand.bet) return;
    p.chips -= hand.bet;
    const originalRank = rankOf(hand.cards[0]);
    const movedCard = hand.cards.pop();
    const newHand = { cards: [movedCard, drawCard(r)], bet: hand.bet, status: 'playing' };
    hand.cards.push(drawCard(r));
    if (originalRank === 'A') {
      hand.status = handValue(hand.cards) > 21 ? 'busted' : 'stood';
      newHand.status = handValue(newHand.cards) > 21 ? 'busted' : 'stood';
    }
    p.hands.splice(cur.hi + 1, 0, newHand);
    if (newHand.status === 'playing') {
      r.turnOrder.splice(r.currentTurnIndex + 1, 0, { pid: cur.pid, hi: cur.hi + 1 });
    }
    r.log = (r.log || []).concat(p.name + ' splits.').slice(-8);
    if (hand.status !== 'playing') { advanceTurnIn(r); }
    else { r.turnDeadline = Date.now() + TURN_SECONDS * 1000; }
  });
}
