import * as THREE from 'three';
import { chipSound } from '../scene/sfx.js';
import { createCharacter } from '../scene/character.js';
import { cameraOverride } from '../scene/cameraFocus.js';
import { animate, easeInOutCubic, easeOutCubic } from '../scene/animator.js';
import { isTallScreen } from '../scene/seats.js';
import { m, FLOOR_Y, SEAT_TOP_Y } from '../scene/scale.js';
import { seatStack, CHIP_R, CHIP_H } from '../scene/seatChips.js';
import { ROULETTE_SEATS_3D as SEATS, ROULETTE_LOOK, WHEEL_CENTER, WHEEL_RADIUS, spotWorld } from '../scene/rouletteTable.js';

// The roulette table's 3D driver: who sits where, the chips on the layout
// and before each seat, the camera, and the wheel. src/app/rouletteBridge.js
// watches the room and calls these; nothing here knows the rules.


export function createRouletteDriver({ scene, camera, controls, set, table }) {
  const root = new THREE.Group();
  set.add(root);
  const wheel = table.userData.wheel;

  // ---------- seated figures ----------
  const figures = new Map();
  // Your own figure is not drawn: the camera is where your eyes are.
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

  // The wheel turns every frame; a figure whose head is between the camera
  // and the table is not drawn, as at the other tables.
  const head = new THREE.Vector3();
  const seg = new THREE.Line3();
  const near = new THREE.Vector3();
  // While bets are open the picture is lifted up the screen, so the felt
  // shows above the betting board and you see your chips land; it eases
  // back down for the spin. (scene.js offsets a portrait screen by 7% of
  // its height, and that is kept under the lift.)
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
  const prior = scene.onBeforeRender;
  scene.onBeforeRender = (...args) => {
    if (set.visible) {
      if (Math.abs(liftTarget - lift) > 0.001) { lift += (liftTarget - lift) * 0.12; applyOffset(); }
      wheel.update(Date.now());
      if (wheelFocus) filmWheel(Date.now());
      else lastFrame = 0;
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
  const VIEWS = { wide: { back: m(0.55), height: m(2.0), lean: 0.25 }, tall: { back: m(1.5), height: m(2.9), lean: 0.1 } };
  let viewSeat;            // the seat whose view it is (null: watching)
  let shown = false;       // whether any view has been set yet
  let wheelFocus = false;  // swooped down over the wheel
  function seatView(seatIndex) {
    const v = isTallScreen() ? VIEWS.tall : VIEWS.wide;
    const seat = seatIndex === null || seatIndex === undefined ? null : SEATS[seatIndex];
    // Watching: from the middle of the players' side.
    const base = seat ? seat.position.clone() : new THREE.Vector3(m(0.2), 0, SEATS[2].position.z);
    const out = seat ? seat.outward : new THREE.Vector3(0, 0, 1);
    const position = base.addScaledVector(out, v.back).setY(FLOOR_Y + v.height);
    const look = ROULETTE_LOOK.clone().lerp(new THREE.Vector3(seat ? seat.position.x : 0, 0, 0), v.lean);
    return { position, look };
  }
  // The spin, watched from one steady place: above the wheel on the
  // players' side, looking down into it, the camera drawing slowly nearer
  // as the ball slows and falls — never circling, never swinging after the
  // ball. Eased into from wherever the camera was, so it never jumps.
  const posePos = new THREE.Vector3();
  const poseLook = new THREE.Vector3();
  const lookNow = new THREE.Vector3();
  function wheelPose(now) {
    const p = wheel.progress(now);
    const k = p === null ? 1 : Math.min(1, p);
    const e = k * k * (3 - 2 * k);
    const tall = isTallScreen();
    const far = tall ? 2.6 : 1.75, close = tall ? 2.05 : 1.3;
    const r = WHEEL_RADIUS * (far + (close - far) * e);
    // From the players' side, a little toward the layout.
    const dir = new THREE.Vector3(0.28, 0, 1).normalize();
    posePos.set(WHEEL_CENTER.x + dir.x * r * 0.62, WHEEL_CENTER.y + r * 1.05, WHEEL_CENTER.z + dir.z * r * 0.62);
    poseLook.copy(WHEEL_CENTER);
  }
  let lastFrame = 0;
  function filmWheel(now) {
    const t = performance.now();
    const dt = Math.min(0.1, (t - (lastFrame || t)) / 1000);
    lastFrame = t;
    wheelPose(now);
    // The table's frame is the room's (the set stands at the origin).
    const ease = 1 - Math.exp(-dt * 3.2);
    camera.position.lerp(posePos, ease);
    lookNow.lerp(poseLook, ease);
    camera.lookAt(lookNow);
    controls.target.copy(lookNow);
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
    const from = camera.position.clone();
    const fromLook = controls.target.clone();
    cameraOverride.active = true;
    animate({
      duration: ms,
      easing: easeInOutCubic,
      onUpdate: (t) => {
        if (my !== flight) return;
        camera.position.lerpVectors(from, position, t);
        camera.lookAt(fromLook.clone().lerp(look, t));
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
    if (!wheelFocus) flyTo(seatView(seatIndex), !first);
  }
  function focusWheel(on) {
    if (on === wheelFocus) return;
    if (on && !shown) return;
    wheelFocus = on;
    if (on) {
      // Any flight under way gives way to the film; the eye starts where
      // the camera was looking.
      flight++;
      cameraOverride.active = true;
      lookNow.copy(controls.target);
      lastFrame = 0;
    } else {
      flyTo(seatView(viewSeat), true, 1000);
    }
  }
  window.addEventListener('resize', () => {
    if (!set.visible || !shown || wheelFocus) return;
    flyTo(seatView(viewSeat), false);
  });

  // ---------- chips ----------
  const stackMesh = seatStack;
  const chipGroup = new THREE.Group();
  root.add(chipGroup);
  const stacks = new Map();   // 'seat|bet' -> mesh
  // Where a seat's chips on a bet stand: on the spot, a little off it in
  // the seat's own direction, so two players' chips on one number both show.
  function spotFor(seatIndex, id, count) {
    const at = spotWorld(id);
    const a = (seatIndex / SEATS.length) * Math.PI * 2;
    return new THREE.Vector3(at.x + Math.cos(a) * 0.04, at.y + (CHIP_H * count) / 2, at.z + Math.sin(a) * 0.04);
  }
  // bySeat: { seatIndex: { betId: amount } }; `unit` is the table minimum,
  // a chip's worth for the height of a stack. A new bet slides out from
  // the player's place to its spot.
  function setBets(bySeat, unit) {
    const want = new Map();
    Object.entries(bySeat).forEach(([seat, bets]) => {
      Object.entries(bets || {}).forEach(([id, amount]) => {
        if (spotWorld(id)) want.set(seat + '|' + id, { seat: Number(seat), id, count: Math.max(1, Math.min(12, Math.round(amount / unit))) });
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
      const mesh = stackMesh(seat, count);
      const to = spotFor(seat, id, count);
      if (have) {
        chipGroup.remove(have);
        have.geometry.dispose();
        mesh.position.copy(to);
        chipSound(1);
      } else {
        const from = SEATS[seat].stackSpot.clone().setY(0.05);
        mesh.position.copy(from);
        setTimeout(() => animate({
          duration: 420,
          easing: easeOutCubic,
          onUpdate: (t) => {
            mesh.position.lerpVectors(from, to, t);
            mesh.position.y += Math.sin(t * Math.PI) * 0.22;
          },
          onComplete: () => { mesh.position.copy(to); chipSound(1); },
        }), flew++ * 60);
      }
      chipGroup.add(mesh);
      stacks.set(key, mesh);
    });
  }

  // Each player's own chips, stacked before them: three columns, taller
  // the richer they are.
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
      const total = Math.max(3, Math.min(42, Math.round(Math.log2(chips / unit + 1) * 4)));
      const at = SEATS[s].stackSpot;
      const along = s === SEATS.length - 1 ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(1, 0, 0);
      [0, 1, 2].forEach((col) => {
        const count = Math.round(total / 3) + (col < total % 3 ? 1 : 0);
        if (!count) return;
        const mesh = stackMesh(s, count);
        mesh.position.copy(at).addScaledVector(along, (col - 1) * CHIP_R * 2.1).setY(at.y + (CHIP_H * count) / 2);
        playerGroup.add(mesh);
      });
    });
  }

  function clear() {
    lift = liftTarget = 0;
    applyOffset();
    setBets({}, 1);
    setStacks({}, 1);
    wheel.showDolly(null);
    if (wheelFocus) { wheelFocus = false; cameraOverride.active = false; }
    shown = false;
  }
  function setVisible(v) { set.visible = v; }

  return {
    applySeatCharacter, clearSeatCharacter, setMySeat, followSeat, focusWheel, setLift, setBets, setStacks, clear, setVisible,
    spinTo: wheel.spinTo, rest: wheel.rest, showDolly: wheel.showDolly,
    setLimits: table.userData.setLimits, setHistory: table.userData.setHistory,
    get spinning() { return wheel.spinning; },
  };
}
