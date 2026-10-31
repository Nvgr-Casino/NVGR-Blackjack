import * as THREE from 'three';
import { hasRoles, ARM_ROLES, LEFT_ARM_ROLES } from './rig.js';

// A hand that moves through the table: the dealer taking a card from the
// shoe and setting it down, sweeping in a losing bet, setting down a
// payout; a player putting chips on their circle and drawing winnings back.
//
// Every one of those is the right hand following a short path of points,
// blended in from the figure's own animation and back out to it by an
// eased weight. What makes it read as a person rather than a crane is the
// rest of the body: the figure bends forward from the waist and turns its
// shoulders toward what it is reaching for, so the arm works with its
// elbow bent, and the hand turns to the work with its fingers forward and
// down. A standing dealer's shoulder is further above the felt than the
// arm is long — reaching from an upright body, the arm could only lock out
// straight, swung up to the side like a plank.

const smooth = (x) => x * x * (3 - 2 * x);
const UP = new THREE.Vector3(0, 1, 0);

// A comfortable reach leaves the elbow bent: the body bends to bring the
// shoulder within EASY of a straight arm of the target, and the hand never
// goes further than FARTHEST from the shoulder — past that the arm locks
// out straight, the stiff plank it used to be. Whatever the hand carries
// goes on along the cloth by itself from there.
const EASY = 0.72;
const FARTHEST = 0.82;
// The most a figure bends from the waist, and turns its shoulders.
const MAX_LEAN = 0.7;
const MAX_TURN = 0.5;
// Fingers forward and down by this much toward the work.
const HAND_PITCH = THREE.MathUtils.degToRad(40);
const HAND_TURN = 0.6;

// Turns `bone` so its own `localAxis` faces `worldDir`, keeping its twist.
function aim(bone, localAxis, worldDir) {
  const currentWorld = bone.getWorldQuaternion(new THREE.Quaternion());
  const currentDir = localAxis.clone().applyQuaternion(currentWorld).normalize();
  const rot = new THREE.Quaternion().setFromUnitVectors(currentDir, worldDir.clone().normalize());
  const parentWorld = bone.parent.getWorldQuaternion(new THREE.Quaternion());
  bone.quaternion.copy(parentWorld.invert().multiply(rot.multiply(currentWorld)));
  bone.updateMatrixWorld(true);
}

// Rotates `bone` about a world axis by `angle`, on top of its current pose.
function rotateWorld(bone, axis, angle) {
  if (!angle) return;
  const currentWorld = bone.getWorldQuaternion(new THREE.Quaternion());
  const turned = new THREE.Quaternion().setFromAxisAngle(axis, angle).multiply(currentWorld);
  const parentWorld = bone.parent.getWorldQuaternion(new THREE.Quaternion());
  bone.quaternion.copy(parentWorld.invert().multiply(turned));
  bone.updateMatrixWorld(true);
}

const firstBoneChild = (bone) => bone.children.find((c) => c.isBone) || null;

/**
 * Builds a reach for one of a figure's arms — `side` 'right' (the default)
 * or 'left' — or null if its rig lacks that arm. `pole` is where the elbow
 * points, in the figure's own frame (it faces +Z): out to that side, back
 * and down, as a reaching arm's does. A figure with both arms reaching
 * shares its waist between them; see dealer.js for the order they run in.
 */
export function createReach(root, bones, { side = 'right', pole, body = 1 } = {}) {
  const left = side === 'left';
  if (!hasRoles(bones, left ? LEFT_ARM_ROLES : ARM_ROLES)) return null;
  pole = pole || new THREE.Vector3(left ? 0.55 : -0.55, -0.45, -0.7);
  const upper = left ? bones.upperArmL : bones.upperArmR;
  const lower = left ? bones.lowerArmL : bones.lowerArmR;
  const wrist = left ? bones.wristL : bones.wristR;
  const { spine, spineLow } = bones;
  root.updateMatrixWorld(true);
  const p1 = upper.getWorldPosition(new THREE.Vector3());
  const p2 = lower.getWorldPosition(new THREE.Vector3());
  const p3 = wrist.getWorldPosition(new THREE.Vector3());
  const upperLen = p1.distanceTo(p2);
  const lowerLen = p2.distanceTo(p3);
  const armLen = upperLen + lowerLen;
  // The axis each segment runs along, read from where its child sits —
  // rigs disagree (Mixamo limbs run along +Y, Biped's along +X).
  const upperAxis = lower.position.clone().normalize();
  const lowerAxis = wrist.position.clone().normalize();
  const finger = firstBoneChild(wrist);
  const handAxis = finger ? finger.position.clone().normalize() : null;
  const poleLocal = pole.clone().normalize();
  // The waist bends across the spine bones there are, shared out.
  const waist = [spineLow, spine].filter(Boolean);

  const bonesKept = [upper, lower, wrist, ...waist];
  const saved = bonesKept.map(() => new THREE.Quaternion());
  let haveSaved = false;
  let motion = null;
  let holding = null;   // a hand kept on a moving point (hold), not a path

  const shoulder = () => upper.getWorldPosition(new THREE.Vector3());
  const rootQuat = () => root.getWorldQuaternion(new THREE.Quaternion());

  // Bends and turns the body toward `target` by `weight` of what it needs,
  // so the shoulder comes to an easy reach of it.
  function bodyTo(target, weight) {
    if (!waist.length || weight <= 0) return;
    const s0 = shoulder();
    const flat = new THREE.Vector3(target.x - s0.x, 0, target.z - s0.z);
    if (flat.lengthSq() < 1e-6) return;
    flat.normalize();

    // Turn the shoulders a little toward it, from the lowest spine bone.
    const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(rootQuat()).setY(0).normalize();
    const side = Math.sign(new THREE.Vector3().crossVectors(forward, flat).y) || 1;
    const turn = THREE.MathUtils.clamp(forward.angleTo(flat) * side * 0.35, -MAX_TURN, MAX_TURN);
    rotateWorld(waist[0], UP, turn * weight);

    // Then bend forward toward it until the shoulder is within easy reach,
    // found by trying the bend in steps.
    const want = armLen * EASY;
    // Rotating "up" about up x flat tips it toward `flat`: a bow toward it.
    const axis = new THREE.Vector3().crossVectors(UP, flat).normalize();
    const start = waist.map((b) => b.quaternion.clone());
    let best = 0;
    let bestErr = Math.abs(shoulder().distanceTo(target) - want);
    for (let step = 1; step <= 8; step++) {
      const angle = (MAX_LEAN * step) / 8;
      waist.forEach((b, i) => { b.quaternion.copy(start[i]); b.updateMatrixWorld(true); });
      waist.forEach((b) => rotateWorld(b, axis, angle / waist.length));
      const err = Math.abs(shoulder().distanceTo(target) - want);
      if (err < bestErr) { best = angle; bestErr = err; }
    }
    waist.forEach((b, i) => { b.quaternion.copy(start[i]); b.updateMatrixWorld(true); });
    waist.forEach((b) => rotateWorld(b, axis, (best * weight) / waist.length));
  }

  // Two-bone IK by the law of cosines, the elbow bent toward the pole.
  function solve(target) {
    const s = shoulder();
    const to = target.clone().sub(s);
    const dist = THREE.MathUtils.clamp(to.length(), Math.abs(upperLen - lowerLen) + 0.001, armLen * 0.97);
    const dir = to.normalize();
    const cos = (upperLen * upperLen + dist * dist - lowerLen * lowerLen) / (2 * upperLen * dist);
    const bend = Math.acos(THREE.MathUtils.clamp(cos, -1, 1));
    const worldPole = poleLocal.clone().applyQuaternion(rootQuat());
    let axis = new THREE.Vector3().crossVectors(dir, worldPole);
    if (axis.lengthSq() < 1e-6) axis = new THREE.Vector3().crossVectors(dir, UP);
    axis.normalize();
    // Toward the pole: rotating `dir` about dir x pole carries it toward the
    // pole. (It used to turn the other way, folding the elbow inward and up.)
    const upperDir = dir.clone().applyAxisAngle(axis, bend);
    aim(upper, upperAxis, upperDir);
    const elbow = s.addScaledVector(upperDir, upperLen);
    aim(lower, lowerAxis, target.clone().sub(elbow));

    // The hand turns to the work: fingers along the reach, tipped down.
    // Only part of the way: turned fully, the wrist twisted past what a
    // real one does and opened a gap at the shirt cuff.
    if (handAxis) {
      const flat = new THREE.Vector3(to.x, 0, to.z).normalize();
      const fingers = flat.multiplyScalar(Math.cos(HAND_PITCH)).addScaledVector(UP, -Math.sin(HAND_PITCH));
      const natural = wrist.quaternion.clone();
      aim(wrist, handAxis, fingers);
      wrist.quaternion.copy(natural.slerp(wrist.quaternion, HAND_TURN));
      wrist.updateMatrixWorld(true);
    }
  }

  function state(now) {
    const ms = now - motion.start;
    const pts = motion.points;
    const end = pts[pts.length - 1].at;
    if (ms >= end) {
      const t = Math.min(1, (ms - end) / motion.returnMs);
      return { weight: 1 - smooth(t), target: pts[pts.length - 1].pos, done: t >= 1 };
    }
    let i = 0;
    while (i < pts.length - 2 && ms >= pts[i + 1].at) i++;
    const a = pts[i], b = pts[i + 1];
    const t = smooth((ms - a.at) / (b.at - a.at));
    const weight = i === 0 ? THREE.MathUtils.lerp(motion.fromWeight, 1, t) : 1;
    return { weight, target: new THREE.Vector3().lerpVectors(a.pos, b.pos, t), done: false };
  }

  return {
    /** Puts back the figure's own pose; call before its mixer runs. */
    before() {
      if (haveSaved) bonesKept.forEach((b, i) => b.quaternion.copy(saved[i]));
    },
    /**
     * Keeps the pose the mixer just wrote, then layers the reach over it.
     * The mixer only writes a bone whose animated value has changed, so
     * without the keep-and-restore a reach left on the body stays there
     * through every still stretch of the animation.
     */
    after(now = performance.now()) {
      bonesKept.forEach((b, i) => saved[i].copy(b.quaternion));
      haveSaved = true;
      if (holding) {
        const t = Math.min(1, (now - holding.start) / holding.blendMs);
        if (holding.out && t >= 1) { holding = null; return; }
        const weight = holding.out ? 1 - smooth(t) : smooth(t);
        const anim = [upper, lower, wrist].map((b) => b.quaternion.clone());
        const s = shoulder();
        const toward = holding.fn().sub(s);
        if (toward.length() > armLen * FARTHEST) toward.setLength(armLen * FARTHEST);
        solve(s.add(toward));
        // A hand flat under something it carries: fingers straight ahead,
        // level, rather than turned down to the work.
        if (holding.flat && handAxis) {
          const ahead = new THREE.Vector3(0, 0, 1).applyQuaternion(rootQuat()).setY(0).normalize();
          aim(wrist, handAxis, ahead);
          // Turned about the fingers, palm up.
          const roll = typeof holding.roll === 'function' ? holding.roll() : holding.roll;
          if (roll) rotateWorld(wrist, ahead, roll);
        }
        [upper, lower, wrist].forEach((b, i) => b.quaternion.copy(anim[i].slerp(b.quaternion, weight)));
        upper.updateMatrixWorld(true);
        return;
      }
      if (!motion) return;
      const st = state(now);
      motion.weight = st.weight;
      motion.target = st.target.clone();
      if (st.done) { motion = null; return; }

      bodyTo(st.target, st.weight * body);
      const anim = [upper, lower, wrist].map((b) => b.quaternion.clone());
      // Along the line toward the target, no further than a bent arm goes.
      const s = shoulder();
      const toward = st.target.clone().sub(s);
      if (toward.length() > armLen * FARTHEST) toward.setLength(armLen * FARTHEST);
      solve(s.add(toward));
      [upper, lower, wrist].forEach((b, i) => b.quaternion.copy(anim[i].slerp(b.quaternion, st.weight)));
      upper.updateMatrixWorld(true);
    },
    /**
     * Moves the hand through `points` — [{ at: ms, pos: Vector3 }], times
     * from now — then eases back over `returnMs`. A move begun while the
     * hand is still out from the last one carries on from where it is.
     */
    play(points, { returnMs = 420 } = {}) {
      const fromPos = motion && motion.target ? motion.target.clone() : wrist.getWorldPosition(new THREE.Vector3());
      const fromWeight = motion ? motion.weight || 0 : 0;
      motion = {
        start: performance.now(),
        points: [{ at: 0, pos: fromPos }, ...points.map((p) => ({ at: p.at, pos: p.pos.clone() }))],
        returnMs,
        fromWeight,
        weight: fromWeight,
        target: null,
      };
    },
    /**
     * Keeps the hand on a point that may move — `target()` is asked for it
     * every frame (a waiter's tray, carried as they walk) — blended in over
     * `blendMs`, and out again by release().
     */
    hold(target, { blendMs = 450, flat = false, roll = 0 } = {}) {
      holding = { fn: target, start: performance.now(), blendMs, out: false, flat, roll };
    },
    release({ blendMs = 450 } = {}) {
      if (holding && !holding.out) Object.assign(holding, { out: true, start: performance.now(), blendMs });
    },
    /** Where the hand is now, in world space. */
    handPosition() { return wrist.getWorldPosition(new THREE.Vector3()); },
  };
}
