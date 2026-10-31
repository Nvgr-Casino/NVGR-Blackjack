import './style.css';
import './app/app.css';
import { onAuthStateChanged } from 'firebase/auth';
import { initScene } from './scene/scene.js';
import { auth } from './firebase/config.js';
import { safeKey } from './app/roomLogic.js';
import { session, initAuth, setOnChange, joinRoom, lobbyGame } from './app/session.js';
import { dealerKeyFor } from './scene/dealer.js';
import { mountService, clearService } from './app/service.js';
import { mountTable3D, syncRoomToScene, renderTableScreen, attachTableScreen, resetTableDiffState, hideBlackjackTable } from './app/table3dBridge.js';
import { mountPoker3D, syncPokerToScene, renderPokerScreen, attachPokerScreen, leavePokerView } from './app/pokerBridge.js';
import { renderAuth, attachAuth } from './app/screens/auth.js';
import { renderHome, attachHome } from './app/screens/home.js';
import { renderJoin, attachJoin } from './app/screens/join.js';
import { renderFriends, attachFriends, renderDm, attachDm } from './app/screens/friends.js';
import { renderCharacter, attachCharacter } from './app/screens/character.js';
import { brandMark } from './app/uiHelpers.js';

const canvas = document.getElementById('scene');
const root = document.getElementById('root');

let lastScreen = null;
// Which table the scene is showing, so switching game clears the other.
let shownGame = null;
let sceneHandles = null;

// Behind the sign-in page and the lobby the scene is the backdrop: the
// Penthouse, its dealer, and the table of the game the lobby is showing.
const BACKDROP_SCREENS = new Set(['auth', 'home']);

function render() {
  const showTable = session.screen === 'table';
  const backdrop = BACKDROP_SCREENS.has(session.screen);
  canvas.style.display = showTable || backdrop ? 'block' : 'none';
  // At the table the page layer sits over the 3D view; it must let drags
  // through to the canvas, or the view can't be turned (see app.css).
  root.classList.toggle('on-table', showTable);
  root.classList.toggle('over-scene', backdrop);
  if (lastScreen === 'table' && session.screen !== 'table') {
    // Nothing of the table just left stays on it: the backdrop shows it.
    if (shownGame === 'holdem') leavePokerView();
    else hideBlackjackTable();
    resetTableDiffState();
    clearService();
    shownGame = null;
  }
  lastScreen = session.screen;
  if (sceneHandles) {
    const poker = session.screen === 'home' && (lobbyGame === 'holdem' || lobbyGame === 'tournaments');
    sceneHandles.setBackdrop(backdrop, { tier: 5, show: poker ? 'holdem' : 'blackjack', dealerKey: dealerKeyFor(5, 'male') });
  }

  if (session.screen === 'loading') {
    root.innerHTML = `<div class="loading">${brandMark()}<p>Loading…</p></div>`;
    return;
  }
  if (session.screen === 'auth') {
    root.innerHTML = renderAuth();
    attachAuth();
    return;
  }
  if (session.screen === 'home') {
    root.innerHTML = renderHome();
    attachHome();
    return;
  }
  if (session.screen === 'join') {
    root.innerHTML = renderJoin();
    attachJoin();
    return;
  }
  if (session.screen === 'character') {
    root.innerHTML = renderCharacter();
    attachCharacter();
    return;
  }
  if (session.screen === 'friends') {
    root.innerHTML = renderFriends();
    attachFriends();
    return;
  }
  if (session.screen === 'dm') {
    root.innerHTML = renderDm();
    attachDm();
    return;
  }
  if (session.screen === 'table') {
    const myKey = session.uid ? safeKey(session.uid) : null;
    if (session.room && session.room.game === 'holdem') {
      if (shownGame !== 'holdem') { hideBlackjackTable(); shownGame = 'holdem'; }
      root.innerHTML = renderPokerScreen();
      attachPokerScreen();
      syncPokerToScene(session.room, myKey);
      return;
    }
    if (shownGame === 'holdem') { leavePokerView(); resetTableDiffState(); }
    shownGame = session.room ? 'blackjack' : shownGame;
    root.innerHTML = renderTableScreen();
    attachTableScreen();
    syncRoomToScene(session.room, myKey);
  }
}

// Handle a ?room=CODE invite link by joining it as soon as the (already
// signing-in) user is authenticated.
function checkInviteParam() {
  const search = new URLSearchParams(location.search);
  const invite = search.get('room');
  if (invite) {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (user) { unsub(); joinRoom(invite); }
    });
  }
}

// Canvas text silently falls back to the default font if drawn before a
// webfont finishes loading — wait for the felt's fonts first so the very
// first frame already has the right typography, not a flash of Georgia.
// Kept inside an async boot rather than a top-level await: the latter
// needs an esnext build target, and this ordering (fonts → scene → first
// render) is the only reason the await exists.
async function boot() {
  await Promise.all([
    document.fonts.load("700 40px 'Cinzel'"),
    // Card indices are drawn in Inter; a card painted before it loads is
    // cached with the fallback face for the rest of the session.
    document.fonts.load("700 40px 'Inter'"),
  ]);
  sceneHandles = initScene(canvas);
  mountTable3D(sceneHandles);
  mountPoker3D(sceneHandles);
  mountService(sceneHandles);
  setOnChange(render);
  initAuth();
  checkInviteParam();
}

boot();

// Build order:
// 1-3. [done] static 3D table, deal animation, seats + dealer — src/scene/*
// 4. [done] this app now boots into the real NVGR Blackjack 21 login/lobby/
//    multiplayer app (ported from index4.html into src/app/*), with the
//    table screen's flat CSS felt replaced by this 3D scene, synced live
//    from Firebase (src/app/table3dBridge.js) instead of local-only state.
// 5. polish: richer character animation, sound, mobile layout for the
//    table screen's HTML chrome over the 3D view.
