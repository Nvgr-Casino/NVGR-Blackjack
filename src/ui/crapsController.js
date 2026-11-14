import * as THREE from 'three';
import { chipSound } from '../scene/sfx.js';
import { createCharacter } from '../scene/character.js';
import { cameraOverride } from '../scene/cameraFocus.js';
import { animate, easeInOutCubic, easeOutCubic } from '../scene/animator.js';
import { isTallScreen } from '../scene/seats.js';
import { m, FLOOR_Y, SEAT_TOP_Y } from '../scene/scale.js';
import { seatStack, CHIP_R, CHIP_H } from '../scene/seatChips.js';
import { CRAPS_SEATS_3D as SEATS, CRAPS_LOOK, boardToTable, FELT_D } from '../scene/crapsTable.js';
import { spotOf } from '../craps/layout.js';

// The craps table's 3D driver: who sits where, the chips on the layout and
// in the rail, the dice, the puck, the board, and the camera — which follows
// the dice down the table on a throw and comes back to your seat after.
// src/app/crapsBridge.js watches the room and calls these.

export function createCrapsDriver({ scene, camera, controls, set, table }) {
  const root = new THREE.Group();
  set.add(root);
  const dice = table.userData.dice;

  // ---------- seated figures ----------
  const figures = new Map();
  let mySeat = null;
  function setMySeat(i) { mySeat = i; }
  function applySeatCharacter(i, id) {
    const have = figures.get(i);
    if (have && have.id === id) return;
    if (have) release(have.group);
    const seat = SEATS[i];
    const group = createCharacter(id);
    group.position.copy(seat.position);
    group.rotation.y = seat.facingAngle;
    root.add(group);
    figures.set(i, { id, group });
  }
  function clearSeatCharacter(i) {
    const have = figures.get(i);
    if (!have) return;
    release(have.group);
    figures.delete(i);
  }
  function release(group) { root.remove(group); if (group.userData.release) group.userData.release(); }

  const head = new THREE.Vector3();
  const seg = new THREE.Line3();
  const near = new THREE.Vector3();
  let lift = 0, liftTarget = 0;
  function applyOffset() {
    const w = window.innerWidth, h = window.innerHeight;
    const y = ((camera.aspect < 1 ? 0.07 : 0) + lift) * h;
    if (y) camera.setViewOffset(w, h, 0, y, w, h); else camera.clearViewOffset();
    camera.updateProjectionMatrix();
  }
  function setLift(v) { liftTarget = v; }
  const prior = scene.onBeforeRender;
  scene.onBeforeRender = (...args) => {
    if (set.visible) {
      if (Math.abs(liftTarget - lift) > 0.001) { lift += (liftTarget - lift) * 0.12; applyOffset(); }
      dice.update(Date.now());
      if (diceFocus) filmDice();
      figures.forEach(({ group }, i) => {
        const model = group.children[0];
        if (!model) return;
        const seat = SEATS[i];
        head.copy(seat.position).addScaledVector(seat.outward, -m(0.2)).setY(SEAT_TOP_Y + m(0.72));
        let hidden = camera.position.distanceTo(head) < m(0.35);
        if (!hidden && i !== mySeat) {
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
  const VIEWS = { wide: { back: m(1.2), height: m(2.25), lean: 0.22 }, tall: { back: m(2.1), height: m(3.1), lean: 0.08 } };
  let viewSeat, shown = false, diceFocus = false;
  function seatView(i) {
    const v = isTallScreen() ? VIEWS.tall : VIEWS.wide;
    const seat = i === null || i === undefined ? null : SEATS[i];
    const base = seat ? seat.position.clone() : new THREE.Vector3(0, 0, SEATS[2].position.z);
    const out = seat ? seat.outward : new THREE.Vector3(0, 0, 1);
    const position = base.addScaledVector(out, v.back).setY(FLOOR_Y + v.height);
    const look = CRAPS_LOOK.clone().lerp(new THREE.Vector3(seat ? seat.position.x * 0.5 : 0, 0, 0), v.lean);
    return { position, look };
  }
  let flight = 0;
  function flyTo({ position, look }, animated, ms = 700) {
    const my = ++flight;
    if (!animated) { camera.position.copy(position); controls.target.copy(look); camera.lookAt(look); cameraOverride.active = false; return; }
    const from = camera.position.clone(), fromLook = controls.target.clone();
    cameraOverride.active = true;
    animate({
      duration: ms, easing: easeInOutCubic,
      onUpdate: (t) => { if (my !== flight) return; camera.position.lerpVectors(from, position, t); camera.lookAt(fromLook.clone().lerp(look, t)); },
      onComplete: () => { if (my !== flight) return; camera.position.copy(position); controls.target.copy(look); camera.lookAt(look); cameraOverride.active = false; },
    });
  }
  function followSeat(i) {
    if (shown && i === viewSeat) return;
    const first = !shown;
    shown = true;
    viewSeat = i;
    if (!diceFocus) flyTo(seatView(i), !first);
  }
  // The throw, watched from above the near side of the tub, looking down
  // the table to where the dice will land; eased into and out of.
  const posePos = new THREE.Vector3(), poseLook = new THREE.Vector3(), lookNow = new THREE.Vector3();
  let lastFrame = 0;
  function filmDice() {
    const t = performance.now();
    const dt = Math.min(0.1, (t - (lastFrame || t)) / 1000);
    lastFrame = t;
    const rest = dice.restPoint || new THREE.Vector3(0, 0, -FELT_D * 0.2);
    const tall = isTallScreen();
    poseLook.set(rest.x, 0, rest.z);
    posePos.set(rest.x * 0.8, FLOOR_Y + m(tall ? 1.85 : 1.42), rest.z + m(tall ? 1.15 : 0.82));
    const ease = 1 - Math.exp(-dt * 2.6);
    camera.position.lerp(posePos, ease);
    lookNow.lerp(poseLook, ease);
    camera.lookAt(lookNow);
    controls.target.copy(lookNow);
  }
  function focusDice(on) {
    if (on === diceFocus) return;
    if (on && !shown) return;
    diceFocus = on;
    if (on) { flight++; cameraOverride.active = true; lookNow.copy(controls.target); lastFrame = 0; }
    else flyTo(seatView(viewSeat), true, 1000);
  }
  window.addEventListener('resize', () => { if (!set.visible || !shown || diceFocus) return; flyTo(seatView(viewSeat), false); });

  // ---------- chips ----------
  const chipGroup = new THREE.Group();
  root.add(chipGroup);
  const stacks = new Map();
  // Where a seat's chips on a bet stand: band bets before the player, box
  // bets in the box, a little off its middle in the seat's own direction.
  function spotFor(seat, id, count) {
    const s = spotOf(id, SEATS[seat].seatX);
    if (!s) return null;
    const at = boardToTable(s.x, s.y);
    const band = id === 'pass' || id === 'dontpass' || id === 'field';
    if (!band) {
      const a = (seat / SEATS.length) * Math.PI * 2;
      at.x += Math.cos(a) * m(0.045);
      at.z += Math.sin(a) * m(0.03);
    }
    // Odds stand just behind the line bet, toward the player.
    if (id === 'passodds' || id === 'dontodds') {
      const line = spotOf(id === 'passodds' ? 'pass' : 'dontpass', SEATS[seat].seatX);
      const l = boardToTable(line.x, line.y);
      at.set(l.x + m(0.07), at.y, l.z + m(0.035));
    }
    at.y += (CHIP_H * count) / 2;
    return at;
  }
  function setBets(bySeat, unit) {
    const want = new Map();
    Object.entries(bySeat).forEach(([seat, bets]) => {
      Object.entries(bets || {}).forEach(([id, amount]) => {
        want.set(seat + '|' + id, { seat: Number(seat), id, count: Math.max(1, Math.min(12, Math.round(amount / unit))) });
      });
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
      const to = spotFor(seat, id, count);
      if (!to) return;
      const mesh = seatStack(seat, count);
      if (have) {
        chipGroup.remove(have);
        have.geometry.dispose();
        mesh.position.copy(to);
        chipSound(1);
      } else {
        const from = SEATS[seat].stackSpot.clone();
        mesh.position.copy(from);
        setTimeout(() => animate({
          duration: 460, easing: easeOutCubic,
          onUpdate: (t) => { mesh.position.lerpVectors(from, to, t); mesh.position.y += Math.sin(t * Math.PI) * m(0.12); },
          onComplete: () => { mesh.position.copy(to); chipSound(1); },
        }), flew++ * 60);
      }
      chipGroup.add(mesh);
      stacks.set(key, mesh);
    });
  }
  // Each player's own chips, in the rail's groove before them.
  const railGroup = new THREE.Group();
  root.add(railGroup);
  let stacksKey = '';
  function setStacks(bySeat, unit) {
    const key = JSON.stringify(bySeat);
    if (key === stacksKey) return;
    stacksKey = key;
    railGroup.children.slice().forEach((c) => { railGroup.remove(c); c.geometry.dispose(); });
    Object.entries(bySeat).forEach(([seat, chips]) => {
      const s = Number(seat);
      const total = Math.max(3, Math.min(36, Math.round(Math.log2(chips / unit + 1) * 4)));
      const at = SEATS[s].stackSpot;
      const along = SEATS[s].outward.z ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 0, 1);
      [0, 1, 2, 3].forEach((col) => {
        const count = Math.round(total / 4) + (col < total % 4 ? 1 : 0);
        if (!count) return;
        const mesh = seatStack(s, count);
        mesh.position.copy(at).addScaledVector(along, (col - 1.5) * CHIP_R * 2.2).setY(at.y + (CHIP_H * count) / 2);
        railGroup.add(mesh);
      });
    });
  }

  // ---------- the dice ----------
  let thrownAt = null;
  /** The roll in the room: thrown from the shooter's seat at `rollAt`. */
  function showRoll(roll, rollAt, shooterSeat) {
    if (thrownAt === rollAt) return;
    thrownAt = rollAt;
    const from = SEATS[shooterSeat == null ? 2 : shooterSeat].throwFrom.clone();
    dice.throwDice(roll.d1, roll.d2, rollAt, from);
  }
  function restDice(roll, rollAt) {
    if (thrownAt === rollAt) return;
    thrownAt = rollAt;
    if (roll) dice.showAt(roll.d1, roll.d2, rollAt + roll.d1 * 7 + roll.d2 * 13);
    else dice.collect();
  }
  function collectDice() { thrownAt = null; dice.collect(); }

  function clear() {
    lift = liftTarget = 0;
    applyOffset();
    setBets({}, 1);
    setStacks({}, 1);
    collectDice();
    // A fresh table for the lobby: puck off, board clear.
    table.userData.setPuck(null, false);
    table.userData.setBoard({ history: [], point: null });
    if (diceFocus) { diceFocus = false; cameraOverride.active = false; }
    shown = false;
  }

  return {
    applySeatCharacter, clearSeatCharacter, setMySeat, followSeat, focusDice, setLift, setBets, setStacks, clear,
    showRoll, restDice, collectDice,
    setPuck: table.userData.setPuck, setBoard: table.userData.setBoard,
    setOnLand: dice.setOnLand,
  };
}
