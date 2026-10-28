import * as THREE from 'three';
import { hasRoles, ARM_ROLES } from './rig.js';

// A hand that moves through the table: the dealer taking a card from the
// shoe and pitching it, sweeping in a losing bet, setting down a payout; a
// player putting chips on their circle and drawing their winnings back.
//
// Every one of those is the same thing: the right hand following a short
// path of points, blended in from the figure's own animation and back out
// to it by an eased weight, so it leaves and returns smoothly. Where a
// point is past a relaxed arm's length, the figure leans in from the waist
// toward it — as people do — and the hand goes as far as it comfortably
// can; whatever it is carrying makes the rest of the trip on its own.

const smooth = (x) => x * x * (3 - 2 * x);
const UP = new THREE.Vector3(0, 1, 0);

// How much of a straight arm a comfortable reach uses, and the furthest a
// figure leans toward something out of reach.
const REACH = 0.85;
const MAX_LEAN = 0.32;

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
  const currentWorld = bone.getWorldQuaternion(new THREE.Quaternion());
  const turned = new THREE.Quaternion().setFromAxisAngle(axis, angle).multiply(currentWorld);
  const parentWorld = bone.parent.getWorldQuaternion(new THREE.Quaternion());
  bone.quaternion.copy(parentWorld.invert().multiply(turned));
  bone.updateMatrixWorld(true);
}

/**
 * Builds a reach for a figure, or null if its rig has no right arm.
 * `pole` is where the elbow points, in the figure's own frame (it faces
 * +Z): out to its right (-X) and down, the way a reaching arm bends.
 */
export function createReach(root, bones, { pole = new THREE.Vector3(-0.6, -0.6, 0.3) } = {}) {
  if (!hasRoles(bones, ARM_ROLES)) return null;
  const { upperArmR: upper, lowerArmR: lower, wristR: wrist, spine } = bones;
  root.updateMatrixWorld(true);
  const p1 = upper.getWorldPosition(new THREE.Vector3());
  const p2 = lower.getWorldPosition(new THREE.Vector3());
  const p3 = wrist.getWorldPosition(new THREE.Vector3());
  const upperLen = p1.distanceTo(p2);
  const lowerLen = p2.distanceTo(p3);
  // The axis each segment runs along, read from where its child sits —
  // rigs disagree (Mixamo limbs run along +Y, Biped's along +X).
  const upperAxis = lower.position.clone().normalize();
  const lowerAxis = wrist.position.clone().normalize();
  const reachLen = (upperLen + lowerLen) * REACH;
  const poleLocal = pole.clone().normalize();

  const bonesKept = [upper, lower, ...(spine ? [spine] : [])];
  const saved = bonesKept.map(() => new THREE.Quaternion());
  let haveSaved = false;
  let motion = null;

  function shoulder() { return upper.getWorldPosition(new THREE.Vector3()); }

  // Brings a point the hand is asked to reach within comfortable range of
  // the shoulder: never below about waist height for a standing figure,
  // and pulled in across the table rather than up when it is too far.
  function comfortable(point, from) {
    const p = point.clone();
    p.y = Math.max(p.y, from.y - reachLen * 0.7);
    const drop = from.y - p.y;
    const across = Math.sqrt(Math.max(0, reachLen * reachLen - drop * drop));
    const flat = new THREE.Vector3(p.x - from.x, 0, p.z - from.z);
    if (flat.length() > across) {
      flat.setLength(across);
      p.set(from.x + flat.x, p.y, from.z + flat.z);
    }
    return p;
  }

  function solve(target) {
    const s = shoulder();
    const to = target.clone().sub(s);
    const dist = THREE.MathUtils.clamp(to.length(), Math.abs(upperLen - lowerLen) + 0.001, upperLen + lowerLen - 0.001);
    const dir = to.normalize();
    const cos = (upperLen * upperLen + dist * dist - lowerLen * lowerLen) / (2 * upperLen * dist);
    const bend = Math.acos(THREE.MathUtils.clamp(cos, -1, 1));
    const worldPole = poleLocal.clone().applyQuaternion(root.getWorldQuaternion(new THREE.Quaternion()));
    let axis = new THREE.Vector3().crossVectors(dir, worldPole);
    if (axis.lengthSq() < 1e-6) axis = new THREE.Vector3().crossVectors(dir, UP);
    axis.normalize();
    const upperDir = dir.clone().applyAxisAngle(axis, -bend);
    aim(upper, upperAxis, upperDir);
    const elbow = s.addScaledVector(upperDir, upperLen);
    aim(lower, lowerAxis, target.clone().sub(elbow));
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
     * without the keep-and-restore a reach left on the arm stays there
     * through every still stretch of the animation.
     */
    after(now = performance.now()) {
      bonesKept.forEach((b, i) => saved[i].copy(b.quaternion));
      haveSaved = true;
      if (!motion) return;
      const st = state(now);
      motion.weight = st.weight;
      motion.target = st.target.clone();
      if (st.done) { motion = null; return; }

      // Lean toward a point beyond the arm, before the arm is solved from
      // wherever the lean has carried the shoulder.
      if (spine) {
        const s = shoulder();
        const flat = new THREE.Vector3(st.target.x - s.x, 0, st.target.z - s.z);
        const beyond = flat.length() - reachLen * 0.75;
        if (beyond > 0) {
          const axis = new THREE.Vector3().crossVectors(UP, flat.normalize()).normalize();
          rotateWorld(spine, axis, Math.min(MAX_LEAN, beyond * 0.5) * st.weight);
        }
      }
      const animUpper = upper.quaternion.clone();
      const animLower = lower.quaternion.clone();
      solve(comfortable(st.target, shoulder()));
      upper.quaternion.copy(animUpper.slerp(upper.quaternion, st.weight));
      lower.quaternion.copy(animLower.slerp(lower.quaternion, st.weight));
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
    /** Where the hand is now, in world space. */
    handPosition() { return wrist.getWorldPosition(new THREE.Vector3()); },
  };
}
