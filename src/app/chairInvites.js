// A gold + on every empty chair at your table, in the 3D view itself:
// tapping it opens your friends — who is online, who was here when — to
// invite one to that very seat (invite.js). The marks follow the camera,
// and show only while you are seated at a live table of your own choosing
// (not a tournament, practice or the slot salon).
import * as THREE from 'three';
import { safeKey } from './roomLogic.js';
import * as S from './session.js';
import { openInvite } from './invite.js';

let handles = null;
let layer = null;
const tops = new WeakMap();   // chair -> its seat's point, in the chair's frame
const v = new THREE.Vector3();
const box = new THREE.Box3();

function chairsFor(room) {
  if (!handles || !room) return null;
  switch (room.game || 'blackjack') {
    case 'blackjack': return handles.chairsBySeat;
    case 'holdem': return handles.pokerChairs;
    case 'roulette': return handles.rouletteChairs;
    case 'baccarat': return handles.baccaratChairs;
    case 'craps': return handles.crapsChairs;
    default: return null;
  }
}

// The point to mark on a chair: above its seat, worked out once the chair's
// model is in (its box), kept in the chair's own frame.
function markPoint(chair, out) {
  let local = tops.get(chair);
  if (!local) {
    box.setFromObject(chair);
    if (box.isEmpty()) return null;
    const size = box.getSize(new THREE.Vector3());
    if (size.y <= 0) return null;
    const world = box.getCenter(new THREE.Vector3());
    world.y = box.min.y + size.y * 0.62;
    local = chair.worldToLocal(world.clone());
    tops.set(chair, local);
  }
  return chair.localToWorld(out.copy(local));
}

function update() {
  if (!layer) return;
  const room = S.session.room;
  const myKey = S.session.uid ? safeKey(S.session.uid) : null;
  const live = S.session.screen === 'table' && room && !room.offline && !room.tournament && room.game !== 'slots'
    && myKey && room.players && room.players[myKey];
  const chairs = live ? chairsFor(room) : null;
  if (!chairs || document.querySelector('.pf-overlay, .tp-overlay, .lb-overlay, .legal-overlay')) { layer.innerHTML = ''; return; }
  const taken = new Set(Object.values(room.players || {}).map((p) => p && p.seat).filter((x) => Number.isInteger(x)));
  const camera = handles.camera;
  const W = window.innerWidth, H = window.innerHeight;
  const want = [];
  chairs.forEach((chair, seat) => {
    if (taken.has(seat) || !chair || !chair.visible) return;
    if (!markPoint(chair, v)) return;
    v.project(camera);
    if (v.z > 1 || v.x < -1 || v.x > 1 || v.y < -1 || v.y > 1) return;
    want.push({ seat, x: ((v.x + 1) / 2) * W, y: ((1 - v.y) / 2) * H });
  });
  // Reuse the buttons there are, so a tap is never lost to a redraw.
  const have = new Map([...layer.children].map((b) => [Number(b.dataset.seat), b]));
  want.forEach(({ seat, x, y }) => {
    let b = have.get(seat);
    if (!b) {
      b = document.createElement('button');
      b.className = 'chair-plus';
      b.dataset.seat = String(seat);
      b.setAttribute('aria-label', `Invite a friend to seat ${seat + 1}`);
      b.title = `Invite a friend to seat ${seat + 1}`;
      b.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 6v12M6 12h12"/></svg>';
      b.onclick = (e) => { e.stopPropagation(); openInvite(seat); };
      layer.appendChild(b);
    }
    b.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, -50%)`;
    have.delete(seat);
  });
  have.forEach((b) => b.remove());
}

export function mountChairInvites(sceneHandles) {
  handles = sceneHandles;
  layer = document.createElement('div');
  layer.className = 'chair-plus-layer';
  document.body.appendChild(layer);
  setInterval(update, 120);
}
