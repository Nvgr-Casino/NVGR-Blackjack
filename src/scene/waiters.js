import * as THREE from 'three';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { loadGltf } from './gltf.js';
import { resolveRig, withoutRootMotion, prepareFigureMaterials, fitClipToRig } from './rig.js';
import { createReach } from './reach.js';
import { createDrink, createTray, disposeDrink } from './drinks.js';
import { DEALER_HEIGHT, FLOOR_Y, m } from './scale.js';

// Waiters: two of the house staff walking the room with trays of drinks,
// round a loop clear of the table and the furniture (the room's walkway,
// layout.js). Now and then one stops and looks over the table. When a
// drink is ordered the nearest free one leaves the loop, walks up beside
// that seat, sets the glass in its cup holder (the caller does that, on
// the cue), and walks back to the loop.
//
// They are Rocketbox figures in the house waistcoat, on the library's
// walk and standing idle — the walk recorded moving forward, stripped of
// that motion here and the figure moved along the path instead.

const WALK_SPEED = m(1.05);      // scene units a second
const TURN_RATE = 5;             // how quickly they turn toward where they go
const SERVE_MS = 1700;           // standing at the seat, glass handed over at HAND_AT
const HAND_AT = 700;
const HIP_HEIGHT = m(0.95);
// Where the carrying hand is held, in the figure's own frame (it faces +z,
// its right is -x): elbow at the side, forearm level and forward. And where
// the tray sits from that hand: over the fingers, just above them.
const HAND_AT_REST = new THREE.Vector3(-m(0.2), FLOOR_Y + m(1.06), m(0.3));
const TRAY_ON_HAND = new THREE.Vector3(m(0.01), m(0.052), m(0.075));
// The turn about the fingers that lays the carrying hand flat under the
// tray (found by eye on the Rocketbox rig: at 0 the hand hangs palm-in).
const PALM_ROLL = -Math.PI / 2;

const modelUrl = (file) => import.meta.env.BASE_URL + 'models/characters/' + file;
// The waiters wear the house waistcoat, never the same one as the room's
// dealer, so you can tell who brings the drinks: grey, except in the
// Library, whose dealers wear grey — there, black.
const STAFF = {
  grey: [
    { file: 'rb_dealer_m3.glb', idle: 'rb_idle_m.glb', walk: 'rb_walk_m.glb' },
    { file: 'rb_dealer_f3.glb', idle: 'rb_idle_f.glb', walk: 'rb_walk_f.glb' },
  ],
  black: [
    { file: 'rb_dealer_m4.glb', idle: 'rb_idle_m.glb', walk: 'rb_walk_m.glb' },
    { file: 'rb_dealer_f4.glb', idle: 'rb_idle_f.glb', walk: 'rb_walk_f.glb' },
  ],
};
const staffFor = (tier) => (tier === 3 ? 'black' : 'grey');
const DECOR = ['champagne', 'whiskey', 'wine', 'martini', 'mojito', 'beer'];

function standOnFloor(model, bones) {
  model.updateMatrixWorld(true);
  const size = new THREE.Box3().setFromObject(model).getSize(new THREE.Vector3());
  if (size.y > 0) model.scale.setScalar(DEALER_HEIGHT / size.y);
  model.updateMatrixWorld(true);
  const hip = bones.hips.getWorldPosition(new THREE.Vector3());
  model.position.y += (FLOOR_Y + HIP_HEIGHT) - hip.y;
  model.updateMatrixWorld(true);
  bones.hips.getWorldPosition(hip);
  model.position.x -= hip.x;
  model.position.z -= hip.z;
}

// The loop through the walkway's corners, rounded off — at y = 0, since a
// figure stands itself on the floor from its group's origin.
function loopThrough(floorCorners) {
  const corners = floorCorners.map((c) => c.clone().setY(0));
  const pts = [];
  const n = corners.length;
  for (let i = 0; i < n; i++) {
    const c = corners[i], p = corners[(i + n - 1) % n], q = corners[(i + 1) % n];
    const r = Math.min(m(1.1), c.distanceTo(p) / 3, c.distanceTo(q) / 3);
    const a = c.clone().add(p.clone().sub(c).setLength(r));
    const b = c.clone().add(q.clone().sub(c).setLength(r));
    pts.push(a, a.clone().lerp(b, 0.5).lerp(c, 0.45), b);
  }
  return new THREE.CatmullRomCurve3(pts, true, 'centripetal');
}

export function createWaiters(scene, { count = 2 } = {}) {
  const root = new THREE.Group();
  scene.add(root);
  let path = null;
  let pathLength = 1;
  const staff = [];
  const scratch = new THREE.Vector3();

  function makeWaiter(spec, i) {
    const group = new THREE.Group();
    // Out of sight until the figure has loaded and is on its walk: before
    // that it would stand at the room's middle, in the table.
    group.visible = false;
    root.add(group);
    const w = { group, ready: false, u: i / count, state: 'loop', nextPause: performance.now() + 8000 + Math.random() * 15000, yaw: 0, job: null };
    // The tray on the right hand, a few glasses on it. It is set on the hand
    // every frame (update), wherever the hand is. The figure faces its own
    // +z; its right is -x.
    const tray = createTray();
    tray.position.copy(HAND_AT_REST).add(TRAY_ON_HAND);
    group.add(tray);
    w.tray = tray;
    w.glasses = [];
    for (let k = 0; k < 3; k++) {
      const g = createDrink(DECOR[(i * 3 + k) % DECOR.length]);
      const a = (k / 3) * Math.PI * 2 + i;
      g.position.set(Math.cos(a) * m(0.1), m(0.005), Math.sin(a) * m(0.1));
      tray.add(g);
      w.glasses.push(g);
    }
    Promise.all([loadGltf(modelUrl(spec.file)), loadGltf(modelUrl(spec.idle)), loadGltf(modelUrl(spec.walk))]).then(([gltf, idleG, walkG]) => {
      const model = cloneSkinned(gltf.scene);
      const bones = resolveRig(model);
      if (!bones.hips) return;
      standOnFloor(model, bones);
      model.traverse((o) => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = true; } });
      prepareFigureMaterials(model);
      group.add(model);
      const mixer = new THREE.AnimationMixer(model);
      const idle = mixer.clipAction(withoutRootMotion(fitClipToRig(idleG.animations[0], idleG.scene, model), bones.hips));
      const walk = mixer.clipAction(withoutRootMotion(fitClipToRig(walkG.animations[0], walkG.scene, model), bones.hips));
      walk.play();
      idle.play();
      idle.setEffectiveWeight(0);
      const reach = createReach(model, bones, { body: 0 });
      // The forearm level and forward, the hand flat: how a tray is carried.
      if (reach) reach.hold(() => group.localToWorld(HAND_AT_REST.clone()), { blendMs: 1, flat: true, roll: () => (import.meta.env.DEV && window.__palmRoll !== undefined ? window.__palmRoll : PALM_ROLL) });
      Object.assign(w, { model, mixer, idle, walk, reach, ready: true, moving: true });
      if (path) group.position.copy(path.getPointAt(w.u));
      // Shown after its first animated frame (update), not in its bind pose.
    }).catch(() => {});
    return w;
  }

  let dressed = null;
  function setRoom(room, tier) {
    const corners = room && room.userData.walkway;
    path = corners ? loopThrough(corners) : null;
    pathLength = path ? path.getLength() : 1;
    const wardrobe = staffFor(tier);
    if (wardrobe !== dressed) {
      // A new uniform: new figures. (Their glasses and trays go with them.)
      staff.splice(0).forEach((w) => { root.remove(w.group); w.glasses.forEach(disposeDrink); });
      queue.length = 0;
      STAFF[wardrobe].slice(0, count).forEach((spec, i) => staff.push(makeWaiter(spec, i)));
      dressed = wardrobe;
    }
    staff.forEach((w) => {
      w.job = null;
      w.state = 'loop';
      // On to the new room's loop at once, not walked across from the last.
      if (path) w.group.position.copy(path.getPointAt(w.u));
    });
    root.visible = !!path;
  }

  // Walking or standing: the clips cross-fade between them.
  function moving(w, on) {
    if (!w.ready || w.moving === on) return;
    w.moving = on;
    const from = on ? w.idle : w.walk;
    const to = on ? w.walk : w.idle;
    to.enabled = true;
    to.setEffectiveWeight(1);
    to.time = on ? Math.random() * to.getClip().duration : to.time;
    from.crossFadeTo(to, 0.35, false);
  }

  function face(w, x, z, dt) {
    const want = Math.atan2(x - w.group.position.x, z - w.group.position.z);
    let d = want - w.yaw;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    w.yaw += d * Math.min(1, dt * TURN_RATE);
    w.group.rotation.y = w.yaw;
  }

  // Walks `w` toward (x, z); true once there.
  function walkTo(w, target, dt) {
    const p = w.group.position;
    scratch.set(target.x - p.x, 0, target.z - p.z);
    const d = scratch.length();
    if (d < m(0.06)) return true;
    const step = Math.min(d, WALK_SPEED * dt);
    face(w, target.x, target.z, dt);
    p.addScaledVector(scratch.normalize(), step);
    return false;
  }

  function nearestU(pos) {
    let best = 0, bestD = Infinity;
    for (let k = 0; k < 64; k++) {
      const d = path.getPointAt(k / 64).distanceToSquared(pos);
      if (d < bestD) { bestD = d; best = k / 64; }
    }
    return best;
  }

  /**
   * Sends the nearest free waiter with a `type` drink to stand at `stop`
   * (a floor point beside a seat) facing `toward`; `handOver(glassWorldPos)`
   * is called as they set it down. Returns false if nobody is free.
   */
  function deliver(stop, toward, type, handOver) {
    if (!path) { handOver(null); return false; }
    const free = staff.filter((w) => w.ready && !w.job);
    if (!free.length) {
      // Everyone busy: the next one to come free takes it.
      queue.push([stop, toward, type, handOver]);
      return true;
    }
    free.sort((a, b) => a.group.position.distanceToSquared(stop) - b.group.position.distanceToSquared(stop));
    const w = free[0];
    const glass = createDrink(type);
    glass.position.set(0, m(0.005), 0);
    w.tray.add(glass);
    w.job = { stop: stop.clone(), toward: toward.clone(), glass, handOver, arrivedAt: 0, handed: false };
    w.state = 'toJob';
    return true;
  }
  const queue = [];

  function update(dt) {
    if (!path || !root.visible) return;
    const now = performance.now();
    staff.forEach((w) => {
      if (!w.ready) return;
      if (w.reach) w.reach.before();
      w.mixer.update(dt);
      if (w.reach) {
        w.reach.after(now);
        // The tray rests on the hand: its middle over the palm and fingers.
        const hand = w.reach.handPosition();
        w.group.updateMatrixWorld(true);
        w.tray.position.copy(w.group.worldToLocal(hand)).add(TRAY_ON_HAND);
      }
      w.group.visible = true;
      const p = w.group.position;
      if (w.state === 'loop') {
        if (now > w.nextPause) { w.state = 'pause'; w.pauseUntil = now + 2500 + Math.random() * 3000; moving(w, false); return; }
        moving(w, true);
        w.u = (w.u + (WALK_SPEED * dt) / pathLength) % 1;
        const at = path.getPointAt(w.u);
        const ahead = path.getPointAt((w.u + 0.01) % 1);
        p.copy(at);
        face(w, ahead.x, ahead.z, dt);
      } else if (w.state === 'pause') {
        face(w, 0, 0, dt);
        if (now > w.pauseUntil) { w.state = 'loop'; w.nextPause = now + 15000 + Math.random() * 20000; }
      } else if (w.state === 'toJob') {
        moving(w, true);
        if (walkTo(w, w.job.stop, dt)) { w.state = 'serve'; w.job.arrivedAt = now; moving(w, false); }
      } else if (w.state === 'serve') {
        face(w, w.job.toward.x, w.job.toward.z, dt);
        if (!w.job.handed && now - w.job.arrivedAt > HAND_AT) {
          w.job.handed = true;
          const at = w.job.glass.getWorldPosition(new THREE.Vector3());
          w.tray.remove(w.job.glass);
          disposeDrink(w.job.glass);
          w.job.handOver(at);
        }
        if (now - w.job.arrivedAt > SERVE_MS) { w.state = 'back'; w.backU = nearestU(p); }
      } else if (w.state === 'back') {
        moving(w, true);
        if (walkTo(w, path.getPointAt(w.backU), dt)) {
          w.u = w.backU;
          w.state = 'loop';
          w.job = null;
          const next = queue.shift();
          if (next) deliver(...next);
        }
      }
    });
  }

  // Development only: lets the preview harness stop a waiter to look at.
  if (import.meta.env.DEV) window.__waiters = staff;
  return { setRoom, deliver, update, setVisible: (v) => { root.visible = v && !!path; } };
}
