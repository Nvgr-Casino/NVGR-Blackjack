import * as THREE from 'three';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { loadGltf } from './gltf.js';
import { resolveRig, withoutRootMotion, prepareFigureMaterials, fitClipToRig } from './rig.js';
import { createReach } from './reach.js';
import { createDrink, createTray, disposeDrink } from './drinks.js';
import { DEALER_HEIGHT, FLOOR_Y, m } from './scale.js';

// The house staff: a bartender behind the room's bar, and two waiters with
// trays of drinks, who keep a routine rather than walking forever — to
// the bar to collect from the bartender and wait for the round, to a post
// at a corner of the room to stand and look over the table, a turn round
// the loop, a pause to watch a hand. Each goes about it on their own, and
// never both to the same place. Wherever they go, they go by the loop
// clear of the table and the furniture (the room's walkway, layout.js),
// stepping off it only at the end, so no one cuts across the table.
//
// When a drink is ordered the nearest free waiter drops what they were
// doing, takes the loop round to that seat, sets the glass in its cup
// holder (the caller does that, on the cue), and goes back to their
// routine.
//
// They are Rocketbox figures in the house waistcoat, on the library's
// walk and standing idle — the walk recorded moving forward, stripped of
// that motion here and the figure moved along the path instead. The
// bartender, in shirtsleeves, stands idle behind the bar.

const WALK_SPEED = m(1.05);      // scene units a second
const TURN_RATE = 5;             // how quickly they turn toward where they go
const SERVE_MS = 1700;           // standing at the seat, glass handed over at HAND_AT
const HAND_AT = 700;
const HIP_HEIGHT = m(0.95);
// Where the carrying hand is held, in the figure's own frame (it faces +z,
// its right is -x): elbow at the side, forearm level and forward. And where
// the tray sits from that hand: over the fingers, just above them.
const HAND_AT_REST = new THREE.Vector3(-m(0.2), FLOOR_Y + m(1.06), m(0.3));
const TRAY_ON_HAND = new THREE.Vector3(m(0.01), 0, m(0.06));
// How far the underside of the tray sits above the hand or elbow, whichever
// is higher: half the thickness of a forearm and its sleeve (the bones run
// down the middle).
const TRAY_CLEAR = m(0.035);
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
// The bartender, in shirtsleeves: never the shirt of the room's own dealer.
const bartenderFor = (tier) => (tier === 1 ? 'rb_dealer_m2.glb' : 'rb_dealer_m.glb');
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
    const w = { group, ready: false, u: i / count, state: 'choose', onLoop: true, spot: null, until: 0, yaw: 0, job: null, route: null };
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
      g.position.set(Math.cos(a) * m(0.085), m(0.005), Math.sin(a) * m(0.085));
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
      // How a tray is carried: the upper arm hanging at the side, the
      // forearm straight out in front and level, the hand flat — worked out
      // from this figure's own arm, so the elbow and wrist are at one height
      // and the tray can rest along the whole forearm.
      if (reach) {
        const { upper, lower } = reach.lengths();
        const q = new THREE.Quaternion();
        reach.hold(() => {
          group.getWorldQuaternion(q);
          const ahead = new THREE.Vector3(0, 0, 1).applyQuaternion(q);
          const out = new THREE.Vector3(-1, 0, 0).applyQuaternion(q);
          return reach.shoulderPosition()
            .add(new THREE.Vector3(0, -upper * 0.97, 0))
            .addScaledVector(ahead, lower * 0.98)
            .addScaledVector(out, m(0.03));
        }, { blendMs: 1, flat: true, roll: PALM_ROLL });
      }
      Object.assign(w, { model, mixer, idle, walk, reach, ready: true, moving: true });
      if (path) group.position.copy(path.getPointAt(w.u));
      // Shown after its first animated frame (update), not in its bind pose.
    }).catch(() => {});
    return w;
  }

  // A fresh round on the tray, collected at the bar.
  function restock(w) {
    w.glasses.forEach((g) => { w.tray.remove(g); disposeDrink(g); });
    w.glasses = [];
    const n = 2 + Math.floor(Math.random() * 2);
    for (let k = 0; k < n; k++) {
      const g = createDrink(DECOR[Math.floor(Math.random() * DECOR.length)]);
      const a = (k / n) * Math.PI * 2 + Math.random();
      g.position.set(Math.cos(a) * m(0.085), m(0.005), Math.sin(a) * m(0.085));
      w.tray.add(g);
      w.glasses.push(g);
    }
  }

  // ---------- the bartender ----------
  const bartender = { group: new THREE.Group(), file: null, mixer: null };
  bartender.group.visible = false;
  root.add(bartender.group);
  function placeBartender(spot, tier) {
    if (!spot) { bartender.group.visible = false; return; }
    bartender.group.position.copy(spot.pos);
    bartender.group.rotation.y = spot.yaw;
    const file = bartenderFor(tier);
    if (file === bartender.file) { bartender.group.visible = !!bartender.mixer; return; }
    bartender.file = file;
    bartender.group.clear();
    bartender.mixer = null;
    bartender.group.visible = false;
    const idleFile = 'rb_idle_m.glb';
    Promise.all([loadGltf(modelUrl(file)), loadGltf(modelUrl(idleFile))]).then(([gltf, idleG]) => {
      if (bartender.file !== file) return;
      const model = cloneSkinned(gltf.scene);
      const bones = resolveRig(model);
      if (!bones.hips) return;
      standOnFloor(model, bones);
      model.traverse((o) => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = true; } });
      prepareFigureMaterials(model);
      bartender.group.add(model);
      bartender.mixer = new THREE.AnimationMixer(model);
      const idle = bartender.mixer.clipAction(withoutRootMotion(fitClipToRig(idleG.animations[0], idleG.scene, model), bones.hips));
      idle.time = Math.random() * idle.getClip().duration;
      idle.play();
      bartender.group.visible = true;
    }).catch(() => {});
  }

  let dressed = null;
  let bar = null;
  let posts = [];
  function setRoom(room, tier) {
    const corners = room && room.userData.walkway;
    path = corners ? loopThrough(corners) : null;
    pathLength = path ? path.getLength() : 1;
    bar = (room && room.userData.bar) || null;
    posts = (room && room.userData.posts) || [];
    placeBartender(bar && bar.bartender, tier);
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
      w.spot = null;
      w.route = null;
      w.onLoop = true;
      w.state = 'choose';
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
    for (let k = 0; k < 96; k++) {
      const d = path.getPointAt(k / 96).distanceToSquared(pos);
      if (d < bestD) { bestD = d; best = k / 96; }
    }
    return best;
  }
  // The shorter way round from u to v, as a signed fraction of the loop.
  const toward = (u, v) => { let d = v - u; d -= Math.round(d); return d; };

  // ---------- getting about ----------
  // To anywhere: on to the loop (straight to its nearest point), round it
  // to the point nearest the destination, and off it to there; then
  // `arrive`. `dir` forces the way round (+1 onward), for a lap.
  function goTo(w, dest, arrive, dir = 0) {
    w.route = { dest: dest.clone().setY(0), targetU: nearestU(dest), arrive, dir };
    if (w.onLoop) w.state = 'travel';
    else { w.route.joinU = nearestU(w.group.position); w.state = 'join'; }
  }
  function stay(w, look, ms, done = null) {
    w.state = 'stay';
    w.look = look;
    w.until = performance.now() + ms;
    w.whenDone = done;
    moving(w, false);
  }

  // ---------- the routine ----------
  // What to do next: the bar, a free post, or a turn round the loop —
  // weighted, never where the other waiter is, and not the same thing
  // twice running.
  function choose(w) {
    const taken = new Set(staff.filter((o) => o !== w && o.spot).map((o) => o.spot));
    const options = [];
    if (bar && !taken.has('bar') && w.last !== 'bar') options.push(['bar', 3]);
    posts.forEach((_, i) => { if (!taken.has('post' + i) && w.last !== 'post' + i) options.push(['post' + i, 1.3]); });
    if (w.last !== 'lap') options.push(['lap', 2]);
    let r = Math.random() * options.reduce((a, o) => a + o[1], 0);
    const pick = (options.find((o) => (r -= o[1]) < 0) || ['lap'])[0];
    w.last = pick;
    if (pick === 'bar') {
      w.spot = 'bar';
      goTo(w, bar.pickup.pos, () => stay(w, bar.pickup.look, 6000 + Math.random() * 6000, () => restock(w)));
    } else if (pick.startsWith('post')) {
      const post = posts[Number(pick.slice(4))];
      w.spot = pick;
      goTo(w, post.pos, () => stay(w, post.look, 9000 + Math.random() * 10000));
    } else {
      w.spot = null;
      // Some way round, then a moment watching the table from there.
      const u = (nearestU(w.group.position) + 0.3 + Math.random() * 0.4) % 1;
      goTo(w, path.getPointAt(u), () => stay(w, new THREE.Vector3(0, 0, 0), 2500 + Math.random() * 2500), 1);
    }
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
    w.spot = null;
    goTo(w, stop, () => { w.state = 'serve'; w.job.arrivedAt = performance.now(); moving(w, false); });
    return true;
  }
  const queue = [];

  function update(dt) {
    if (bartender.mixer && bartender.group.visible) bartender.mixer.update(dt);
    if (!path || !root.visible) return;
    const now = performance.now();
    staff.forEach((w) => {
      if (!w.ready) return;
      if (w.reach) w.reach.before();
      w.mixer.update(dt);
      if (w.reach) {
        w.reach.after(now);
        // The tray rests on the hand and forearm: its middle over the palm,
        // and above whichever is higher, the hand or the elbow, so no part
        // of the arm comes through it.
        const hand = w.reach.handPosition();
        const top = Math.max(hand.y, w.reach.elbowPosition().y) + TRAY_CLEAR;
        w.group.updateMatrixWorld(true);
        w.tray.position.copy(w.group.worldToLocal(hand.setY(top))).add(TRAY_ON_HAND);
      }
      w.group.visible = true;
      const p = w.group.position;
      if (w.state === 'choose') {
        choose(w);
      } else if (w.state === 'join') {
        moving(w, true);
        if (walkTo(w, path.getPointAt(w.route.joinU), dt)) { w.u = w.route.joinU; w.onLoop = true; w.state = 'travel'; }
      } else if (w.state === 'travel') {
        moving(w, true);
        const r = w.route;
        const d = toward(w.u, r.targetU);
        const dir = r.dir || Math.sign(d) || 1;
        const left = r.dir ? (((r.targetU - w.u) * dir) % 1 + 1) % 1 : Math.abs(d);
        const step = (WALK_SPEED * dt) / pathLength;
        if (left <= step) {
          w.u = r.targetU;
          p.copy(path.getPointAt(w.u));
          w.onLoop = false;
          w.state = 'approach';
        } else {
          w.u = ((w.u + dir * step) % 1 + 1) % 1;
          p.copy(path.getPointAt(w.u));
          const ahead = path.getPointAt(((w.u + dir * 0.01) % 1 + 1) % 1);
          face(w, ahead.x, ahead.z, dt);
        }
      } else if (w.state === 'approach') {
        moving(w, true);
        if (walkTo(w, w.route.dest, dt)) {
          // Back on the loop if that is where it ended.
          w.onLoop = p.distanceTo(path.getPointAt(w.route.targetU)) < m(0.1);
          const arrive = w.route.arrive;
          w.route = null;
          arrive();
        }
      } else if (w.state === 'stay') {
        face(w, w.look.x, w.look.z, dt);
        if (now > w.until) {
          if (w.whenDone) w.whenDone();
          w.whenDone = null;
          w.spot = null;
          w.state = 'choose';
        }
      } else if (w.state === 'serve') {
        face(w, w.job.toward.x, w.job.toward.z, dt);
        if (!w.job.handed && now - w.job.arrivedAt > HAND_AT) {
          w.job.handed = true;
          const at = w.job.glass.getWorldPosition(new THREE.Vector3());
          w.tray.remove(w.job.glass);
          disposeDrink(w.job.glass);
          w.job.handOver(at);
        }
        if (now - w.job.arrivedAt > SERVE_MS) {
          w.job = null;
          w.state = 'choose';
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
