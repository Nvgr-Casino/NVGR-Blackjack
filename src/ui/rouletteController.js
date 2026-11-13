import * as THREE from 'three';
import { chipSound } from '../scene/sfx.js';
import { createCharacter } from '../scene/character.js';
import { cameraOverride } from '../scene/cameraFocus.js';
import { animate, easeInOutCubic } from '../scene/animator.js';
import { isTallScreen } from '../scene/seats.js';
import { m, FLOOR_Y, SEAT_TOP_Y } from '../scene/scale.js';
import { canvasTex } from '../scene/casinoKit.js';
import { ROULETTE_SEATS_3D as SEATS, ROULETTE_LOOK, SEAT_CHIP_COLORS, spotWorld } from '../scene/rouletteTable.js';

// The roulette table's 3D driver: who sits where, the chips on the layout,
// the camera, and the wheel. src/app/rouletteBridge.js watches the room and
// calls these; nothing here knows the rules.

const CHIP_R = 0.058;
const CHIP_H = 0.016;

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
  const prior = scene.onBeforeRender;
  scene.onBeforeRender = (...args) => {
    if (set.visible) {
      wheel.update(Date.now());
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
  let viewSeat = undefined;
  function viewFor(seatIndex) {
    const v = isTallScreen() ? VIEWS.tall : VIEWS.wide;
    const seat = seatIndex === null || seatIndex === undefined ? null : SEATS[seatIndex];
    // Watching: from the middle of the players' side.
    const base = seat ? seat.position.clone() : new THREE.Vector3(m(0.2), 0, SEATS[2].position.z);
    const out = seat ? seat.outward : new THREE.Vector3(0, 0, 1);
    const position = base.addScaledVector(out, v.back).setY(FLOOR_Y + v.height);
    // Aimed between the wheel and the layout, drawn toward the seat's own
    // end of it.
    const look = ROULETTE_LOOK.clone().lerp(new THREE.Vector3(seat ? seat.position.x : 0, 0, 0), v.lean);
    return { position, look };
  }
  function followSeat(seatIndex, animated = true) {
    if (seatIndex === viewSeat) return;
    if (viewSeat === undefined) animated = false;
    viewSeat = seatIndex;
    const { position, look } = viewFor(seatIndex);
    if (!animated) {
      camera.position.copy(position);
      controls.target.copy(look);
      camera.lookAt(look);
      return;
    }
    const from = camera.position.clone();
    const fromLook = controls.target.clone();
    cameraOverride.active = true;
    animate({
      duration: 650,
      easing: easeInOutCubic,
      onUpdate: (t) => {
        camera.position.lerpVectors(from, position, t);
        camera.lookAt(fromLook.clone().lerp(look, t));
      },
      onComplete: () => {
        camera.position.copy(position);
        controls.target.copy(look);
        camera.lookAt(look);
        cameraOverride.active = false;
      },
    });
  }
  window.addEventListener('resize', () => { if (set.visible && viewSeat !== undefined) { const s = viewSeat; viewSeat = null; followSeat(s, false); } });

  // ---------- chips ----------
  // Wheel chips, a colour to each seat: a stack drawn as one cylinder, its
  // edge striped once per chip.
  const chipMats = new Map();
  function chipMaterials(seatIndex, count) {
    const key = seatIndex + ':' + count;
    if (chipMats.has(key)) return chipMats.get(key);
    const color = SEAT_CHIP_COLORS[seatIndex % SEAT_CHIP_COLORS.length];
    const side = canvasTex(128, 16, (ctx, w, h) => {
      ctx.fillStyle = color;
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#f6f2ea';
      for (let i = 0; i < 6; i++) ctx.fillRect((i / 6) * w, 0, (w / 6) * 0.32, h);
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.fillRect(0, h - 2, w, 2);
    });
    side.wrapS = side.wrapT = THREE.RepeatWrapping;
    side.repeat.set(1, count);
    const top = canvasTex(64, 64, (ctx, w) => {
      ctx.fillStyle = color;
      ctx.fillRect(0, 0, w, w);
      ctx.strokeStyle = '#f6f2ea';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(w / 2, w / 2, w * 0.3, 0, Math.PI * 2);
      ctx.stroke();
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        ctx.fillStyle = '#f6f2ea';
        ctx.fillRect(w / 2 + Math.cos(a) * w * 0.42 - 3, w / 2 + Math.sin(a) * w * 0.42 - 3, 6, 6);
      }
    });
    const mats = [new THREE.MeshStandardMaterial({ map: side, roughness: 0.5 }), new THREE.MeshStandardMaterial({ map: top, roughness: 0.45 }), new THREE.MeshStandardMaterial({ map: top, roughness: 0.45 })];
    chipMats.set(key, mats);
    return mats;
  }
  const chipGroup = new THREE.Group();
  root.add(chipGroup);
  let chipsKey = '';
  // bySeat: { seatIndex: { betId: amount } }; `unit` is the table minimum,
  // a chip's worth for the height of a stack.
  function setBets(bySeat, unit) {
    const key = JSON.stringify(bySeat);
    if (key === chipsKey) return;
    const added = key.length > chipsKey.length;
    chipsKey = key;
    chipGroup.children.slice().forEach((c) => { chipGroup.remove(c); c.geometry.dispose(); });
    Object.entries(bySeat).forEach(([seat, bets]) => {
      const s = Number(seat);
      Object.entries(bets || {}).forEach(([id, amount]) => {
        const at = spotWorld(id);
        if (!at) return;
        const count = Math.max(1, Math.min(10, Math.round(amount / unit)));
        const stack = new THREE.Mesh(new THREE.CylinderGeometry(CHIP_R, CHIP_R, CHIP_H * count, 24), chipMaterials(s, count));
        // Each seat's stack a little off the spot, so two players' chips on
        // one number both show.
        const a = (s / SEATS.length) * Math.PI * 2;
        stack.position.set(at.x + Math.cos(a) * 0.035, at.y + (CHIP_H * count) / 2, at.z + Math.sin(a) * 0.035);
        stack.castShadow = true;
        chipGroup.add(stack);
      });
    });
    if (added) chipSound();
  }

  function clear() {
    setBets({}, 1);
    wheel.showDolly(null);
  }
  function setVisible(v) { set.visible = v; }

  return {
    applySeatCharacter, clearSeatCharacter, setMySeat, followSeat, setBets, clear, setVisible,
    spinTo: wheel.spinTo, rest: wheel.rest, showDolly: wheel.showDolly,
    get spinning() { return wheel.spinning; },
  };
}
