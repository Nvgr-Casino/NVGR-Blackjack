import * as THREE from 'three';
import { chipSound, cardSound } from '../scene/sfx.js';
import { createCharacter } from '../scene/character.js';
import { dealerReach } from '../scene/dealer.js';
import { createCard } from '../scene/card.js';
import { cameraOverride } from '../scene/cameraFocus.js';
import { animate, easeInOutCubic, easeOutCubic } from '../scene/animator.js';
import { isTallScreen } from '../scene/seats.js';
import { m, FLOOR_Y, SEAT_TOP_Y } from '../scene/scale.js';
import { seatStack, CHIP_H, CHIP_R } from '../scene/seatChips.js';
import { BACCARAT_SEATS_3D as SEATS, BACCARAT_LOOK, CARDS_CENTER, betSpot, cardSpot } from '../scene/baccaratTable.js';
import { revealTimes } from '../baccarat/rules.js';

// The baccarat table's 3D driver: who sits where, the chips on the boxes
// and before each seat, the cards, and the camera. src/app/baccaratBridge.js
// watches the room and calls these; nothing here knows the rules beyond
// when each card is turned.

const SLIDE_MS = 520;     // a card's slide from the shoe, ending this long before it is turned
const FLIP_MS = 320;

export function createBaccaratDriver({ scene, camera, controls, set, table, dealer }) {
  const root = new THREE.Group();
  set.add(root);
  const shoeMouth = table.userData.shoeMouth;

  // ---------- seated figures ----------
  const figures = new Map();
  let mySeat = null;
  function setMySeat(seatIndex) { mySeat = seatIndex; }
  function applySeatCharacter(seatIndex, id) {
    const have = figures.get(seatIndex);
    if (have && have.id === id) return;
    if (have) release(have.group);
    const seat = SEATS[seatIndex];
    const group = createCharacter(id);
    group.position.copy(seat.position);
    group.rotation.y = seat.facingAngle;
    root.add(group);
    figures.set(seatIndex, { id, group });
  }
  function clearSeatCharacter(seatIndex) {
    const have = figures.get(seatIndex);
    if (!have) return;
    release(have.group);
    figures.delete(seatIndex);
  }
  function release(group) {
    root.remove(group);
    if (group.userData.release) group.userData.release();
  }

  // ---------- the cards ----------
  // The coup's cards, placed every frame by how long since the deal began:
  // each slides face down from the shoe to its box, then turns over at its
  // time, so a player arriving mid-coup sees it as it stands.
  let hand = null;
  let dealAt = 0;
  let cards = [];
  const sounded = new Set();
  const turned = new Set();
  function setHand(next, at) {
    const key = next ? JSON.stringify(next.player) + JSON.stringify(next.banker) + at : null;
    if (key === (hand ? JSON.stringify(hand.player) + JSON.stringify(hand.banker) + dealAt : null)) return;
    cards.forEach((c) => root.remove(c.mesh));
    cards = [];
    sounded.clear();
    turned.clear();
    hand = next;
    dealAt = at;
    if (!hand) return;
    const times = revealTimes(hand);
    const count = { player: 0, banker: 0 };
    hand.order.forEach((side, i) => {
      const s = side === 'P' ? 'player' : 'banker';
      const card = hand[s][count[s]];
      const [rank, suit] = card.split('-');
      const mesh = createCard(rank, suit, { sharp: true });
      mesh.visible = false;
      root.add(mesh);
      cards.push({ mesh, to: cardSpot(s, count[s]), third: count[s] === 2, reveal: times[i], i });
      count[s]++;
    });
  }
  const from = new THREE.Vector3();
  function placeCards(now) {
    const t = now - dealAt;
    cards.forEach((c) => {
      const start = c.reveal - SLIDE_MS - 260 - (c.i < 4 ? (3 - c.i) * 60 : 0);
      if (t < start) { c.mesh.visible = false; return; }
      c.mesh.visible = true;
      if (!sounded.has(c.i)) {
        sounded.add(c.i);
        // The dealer draws it from the shoe with the left hand and slides
        // it out to its box.
        if (t - start < 300) {
          cardSound();
          if (dealer && set.visible) dealerReach(dealer, [{ at: 0, pos: shoeMouth }, { at: SLIDE_MS * 0.9, pos: c.to }], { hand: 'left', returnMs: 380 });
        }
      }
      // And turns it over with the right, at its time.
      if (!turned.has(c.i) && t >= c.reveal - FLIP_MS - 120) {
        turned.add(c.i);
        if (t < c.reveal && dealer && set.visible) dealerReach(dealer, [{ at: 60, pos: c.to }, { at: FLIP_MS + 220, pos: c.to }], { returnMs: 420 });
      }
      const yaw = c.third ? Math.PI / 2 : 0;
      const k = Math.min(1, (t - start) / SLIDE_MS);
      const e = easeOutCubic(k);
      from.copy(shoeMouth);
      c.mesh.position.lerpVectors(from, c.to, e);
      c.mesh.position.y = c.to.y + Math.sin(k * Math.PI) * 0.06;
      // Face down until its turn, then over along its long side.
      const f = Math.max(0, Math.min(1, (t - c.reveal + FLIP_MS / 2) / FLIP_MS));
      const flip = Math.PI * (1 - easeInOutCubic(f));
      c.mesh.rotation.set(0, 0, 0);
      c.mesh.rotation.order = 'YXZ';
      c.mesh.rotation.y = yaw;
      c.mesh.rotation.z = flip;
      c.mesh.position.y += Math.sin(f * Math.PI) * 0.08;
    });
  }

  // ---------- the picture lifted while bets are open ----------
  // The betting panel covers the lower part of the screen; while it is up
  // the picture is lifted, so the felt and your chips show above it. (A
  // portrait screen's own 7% offset from scene.js is kept under it.)
  let lift = 0;
  let liftTarget = 0;
  function applyOffset() {
    const w = window.innerWidth, h = window.innerHeight;
    const y = ((camera.aspect < 1 ? 0.07 : 0) + lift) * h;
    if (y) camera.setViewOffset(w, h, 0, y, w, h);
    else camera.clearViewOffset();
    camera.updateProjectionMatrix();
  }
  function setLift(v) { liftTarget = v; }

  // ---------- frame ----------
  const head = new THREE.Vector3();
  const seg = new THREE.Line3();
  const near = new THREE.Vector3();
  const prior = scene.onBeforeRender;
  scene.onBeforeRender = (...args) => {
    if (set.visible) {
      const now = Date.now();
      if (Math.abs(liftTarget - lift) > 0.001) { lift += (liftTarget - lift) * 0.12; applyOffset(); }
      if (hand) placeCards(now);
      if (cardFocus) filmCards();
      figures.forEach(({ group }, seatIndex) => {
        const model = group.children[0];
        if (!model) return;
        const seat = SEATS[seatIndex];
        head.copy(seat.position).addScaledVector(seat.outward, -m(0.2)).setY(SEAT_TOP_Y + m(0.72));
        let hidden = seatIndex === mySeat || camera.position.distanceTo(head) < m(0.35);
        if (!hidden) {
          seg.set(camera.position, controls.target);
          seg.closestPointToPoint(head, true, near);
          hidden = near.distanceTo(head) < m(0.2);
        }
        model.visible = !hidden;
      });
    }
    prior.apply(scene, args);
  };

  // ---------- camera ----------
  const VIEWS = { wide: { back: m(0.5), height: m(2.0) }, tall: { back: m(1.6), height: m(2.9) } };
  let viewSeat;
  let shown = false;
  let cardFocus = false;
  function seatView(seatIndex) {
    const v = isTallScreen() ? VIEWS.tall : VIEWS.wide;
    const seat = seatIndex === null || seatIndex === undefined ? SEATS[3] : SEATS[seatIndex];
    const position = seat.position.clone().addScaledVector(seat.outward, v.back).setY(FLOOR_Y + v.height);
    return { position, look: BACCARAT_LOOK.clone() };
  }
  let flight = 0;
  function flyTo({ position, look }, animated, ms = 650) {
    const my = ++flight;
    if (!animated) {
      camera.position.copy(position);
      controls.target.copy(look);
      camera.lookAt(look);
      cameraOverride.active = false;
      return;
    }
    const start = camera.position.clone();
    const startLook = controls.target.clone();
    cameraOverride.active = true;
    animate({
      duration: ms,
      easing: easeInOutCubic,
      onUpdate: (t) => {
        if (my !== flight) return;
        camera.position.lerpVectors(start, position, t);
        camera.lookAt(startLook.clone().lerp(look, t));
      },
      onComplete: () => {
        if (my !== flight) return;
        camera.position.copy(position);
        controls.target.copy(look);
        camera.lookAt(look);
        cameraOverride.active = false;
      },
    });
  }
  function followSeat(seatIndex) {
    if (shown && seatIndex === viewSeat) return;
    const first = !shown;
    shown = true;
    viewSeat = seatIndex;
    if (!cardFocus) flyTo(seatView(seatIndex), !first);
  }
  // While the coup is dealt: one steady view down onto the two hands, from
  // the players' side; no circling.
  const posePos = new THREE.Vector3();
  const lookNow = new THREE.Vector3();
  const cardsAim = new THREE.Vector3();
  let lastFrame = 0;
  function filmCards() {
    const t = performance.now();
    const dt = Math.min(0.1, (t - (lastFrame || t)) / 1000);
    lastFrame = t;
    // Close over the two hands, and aimed a little short of them, so they
    // sit in the upper part of the picture, clear of the cards and result
    // shown on the screen below.
    const d = isTallScreen() ? m(2.3) : m(1.5);
    posePos.set(CARDS_CENTER.x, CARDS_CENTER.y + d * 0.95, CARDS_CENTER.z + d * 0.62);
    cardsAim.copy(CARDS_CENTER).setZ(CARDS_CENTER.z + d * 0.1);
    const ease = 1 - Math.exp(-dt * 3);
    camera.position.lerp(posePos, ease);
    lookNow.lerp(cardsAim, ease);
    camera.lookAt(lookNow);
    controls.target.copy(lookNow);
  }
  function focusCards(on) {
    if (on === cardFocus) return;
    if (on && !shown) return;
    cardFocus = on;
    if (on) {
      flight++;
      cameraOverride.active = true;
      lookNow.copy(controls.target);
      lastFrame = 0;
    } else {
      flyTo(seatView(viewSeat), true, 900);
    }
  }
  window.addEventListener('resize', () => { if (set.visible && shown && !cardFocus) flyTo(seatView(viewSeat), false); });

  // ---------- chips ----------
  const chipGroup = new THREE.Group();
  root.add(chipGroup);
  const stacks = new Map();
  function setBets(bySeat, unit) {
    const want = new Map();
    Object.entries(bySeat).forEach(([seat, bets]) => {
      Object.entries(bets || {}).forEach(([id, amount]) => want.set(seat + '|' + id, { seat: Number(seat), id, count: Math.max(1, Math.min(12, Math.round(amount / unit))) }));
    });
    stacks.forEach((mesh, key) => {
      if (want.has(key)) return;
      chipGroup.remove(mesh);
      mesh.geometry.dispose();
      stacks.delete(key);
    });
    let flew = 0;
    want.forEach(({ seat, id, count }, key) => {
      const have = stacks.get(key);
      if (have && have.userData.count === count) return;
      const mesh = seatStack(seat, count);
      const at = betSpot(seat, id);
      const to = new THREE.Vector3(at.x, at.y + (CHIP_H * count) / 2, at.z);
      if (have) {
        chipGroup.remove(have);
        have.geometry.dispose();
        mesh.position.copy(to);
        chipSound(1);
      } else {
        const start = SEATS[seat].stackSpot.clone().setY(0.05);
        mesh.position.copy(start);
        setTimeout(() => animate({
          duration: 420,
          easing: easeOutCubic,
          onUpdate: (t) => { mesh.position.lerpVectors(start, to, t); mesh.position.y += Math.sin(t * Math.PI) * 0.2; },
          onComplete: () => { mesh.position.copy(to); chipSound(1); },
        }), flew++ * 60);
      }
      chipGroup.add(mesh);
      stacks.set(key, mesh);
    });
  }
  const playerGroup = new THREE.Group();
  root.add(playerGroup);
  let stacksKey = '';
  function setStacks(bySeat, unit) {
    const key = JSON.stringify(bySeat);
    if (key === stacksKey) return;
    stacksKey = key;
    playerGroup.children.slice().forEach((c) => { playerGroup.remove(c); c.geometry.dispose(); });
    Object.entries(bySeat).forEach(([seat, chips]) => {
      const s = Number(seat);
      const total = Math.max(3, Math.min(24, Math.round(Math.log2(chips / unit + 1) * 3)));
      const at = SEATS[s].stackSpot;
      const along = new THREE.Vector3(-SEATS[s].outward.z, 0, SEATS[s].outward.x);
      // In the tray on the armrest: up to four short stacks along it.
      const cols = Math.min(4, Math.max(1, Math.ceil(total / 6)));
      for (let col = 0; col < cols; col++) {
        const count = Math.floor(total / cols) + (col < total % cols ? 1 : 0);
        if (!count) continue;
        const mesh = seatStack(s, count);
        mesh.position.copy(at).addScaledVector(along, (col - (cols - 1) / 2) * CHIP_R * 2.15).setY(at.y + (CHIP_H * count) / 2);
        playerGroup.add(mesh);
      }
    });
  }

  function clear() {
    setHand(null, 0);
    setBets({}, 1);
    setStacks({}, 1);
    if (cardFocus) { cardFocus = false; cameraOverride.active = false; }
    if (lift) { lift = liftTarget = 0; applyOffset(); }
    shown = false;
  }

  return {
    applySeatCharacter, clearSeatCharacter, setMySeat, followSeat, focusCards, setLift, setHand, setBets, setStacks, clear,
    setHistory: table.userData.setHistory,
  };
}
