import './style.css';
import './app/app.css';
import { onAuthStateChanged } from 'firebase/auth';
import { initScene } from './scene/scene.js';
import { auth } from './firebase/config.js';
import { safeKey } from './app/roomLogic.js';
import { session, initAuth, setOnChange, joinRoom } from './app/session.js';
import { mountTable3D, syncRoomToScene, renderTableScreen, attachTableScreen, resetTableDiffState } from './app/table3dBridge.js';
import { renderAuth, attachAuth } from './app/screens/auth.js';
import { renderHome, attachHome } from './app/screens/home.js';
import { renderJoin, attachJoin } from './app/screens/join.js';
import { renderFriends, attachFriends, renderDm, attachDm } from './app/screens/friends.js';
import { renderCharacter, attachCharacter } from './app/screens/character.js';
import { brandMark } from './app/uiHelpers.js';

const canvas = document.getElementById('scene');
const root = document.getElementById('root');

let lastScreen = null;

function render() {
  const showTable = session.screen === 'table';
  canvas.style.display = showTable ? 'block' : 'none';
  if (lastScreen === 'table' && session.screen !== 'table') resetTableDiffState();
  lastScreen = session.screen;

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
    root.innerHTML = renderTableScreen();
    attachTableScreen();
    const myKey = session.uid ? safeKey(session.uid) : null;
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
  ]);
  mountTable3D(initScene(canvas));
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
