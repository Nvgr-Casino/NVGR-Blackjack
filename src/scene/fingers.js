import * as THREE from 'three';

// Fingers that hold things. A figure's own animation leaves its fingers
// hanging straight; a hand that deals cards has to curl round one and pinch
// it, flatten to press it to the felt, drape over the shoe it rests on.
// This poses each finger joint on top of whatever the animation did, toward
// the palm by so much, and blends between poses so a hand closes and opens
// rather than snapping.
//
// It works on a Biped rig (Bip01_R_Finger0 … Finger42: thumb, index,
// middle, ring, little, three joints each) and on a Mixamo one
// (RightHandThumb1 … RightHandPinky3), finding the palm from where the
// knuckles and the thumb sit, so it needs no per-model numbers.

// Curl for [index, middle, ring, little] × [three joints], and the thumb.
const POSES = {
  // A hand at rest: softly curled, a little more toward the little finger.
  relax: { fingers: [[0.22, 0.28, 0.18], [0.26, 0.32, 0.2], [0.32, 0.36, 0.24], [0.38, 0.4, 0.26]], thumb: [0.15, 0.2, 0.15] },
  // Pinching a card from above: index and middle over it, the rest tucked.
  grip: { fingers: [[0.34, 0.32, 0.18], [0.38, 0.35, 0.2], [0.62, 0.55, 0.36], [0.72, 0.6, 0.4]], thumb: [0.36, 0.28, 0.2] },
  // Pressing a card flat: fingers long and straight.
  flat: { fingers: [[0.06, 0.05, 0.03], [0.06, 0.05, 0.03], [0.1, 0.06, 0.04], [0.14, 0.08, 0.05]], thumb: [0.1, 0.08, 0.05] },
  // Resting on the shoe: draped over its top.
  rest: { fingers: [[0.42, 0.42, 0.26], [0.45, 0.45, 0.28], [0.5, 0.48, 0.3], [0.55, 0.5, 0.32]], thumb: [0.3, 0.25, 0.2] },
};

const NAMES = {
  biped: (side) => {
    const s = side === 'right' ? 'R' : 'L';
    return [0, 1, 2, 3, 4].map((f) => [`Bip01_${s}_Finger${f}`, `Bip01_${s}_Finger${f}1`, `Bip01_${s}_Finger${f}2`]);
  },
  mixamo: (side) => {
    const s = side === 'right' ? 'Right' : 'Left';
    return ['Thumb', 'Index', 'Middle', 'Ring', 'Pinky'].map((f) => [1, 2, 3].map((j) => `${s}Hand${f}${j}`));
  },
};

function findByName(root, name) {
  let hit = null;
  root.traverse((o) => { if (!hit && o.isBone && (o.name === name || o.name.endsWith(name) || o.name.replace(/[:_]/g, '').endsWith(name.replace(/[:_]/g, '')))) hit = o; });
  return hit;
}
function chainsFor(root, side) {
  for (const kind of Object.keys(NAMES)) {
    const chains = NAMES[kind](side).map((names) => names.map((n) => findByName(root, n)));
    if (chains.every((c) => c.every(Boolean))) return chains;
  }
  return null;
}
function rotateWorld(bone, axis, angle) {
  if (!angle) return;
  const currentWorld = bone.getWorldQuaternion(new THREE.Quaternion());
  const turned = new THREE.Quaternion().setFromAxisAngle(axis, angle).multiply(currentWorld);
  const parentWorld = bone.parent.getWorldQuaternion(new THREE.Quaternion());
  bone.quaternion.copy(parentWorld.invert().multiply(turned));
  bone.updateMatrixWorld(true);
}
const worldPos = (b) => b.getWorldPosition(new THREE.Vector3());
const firstBoneChild = (b) => b.children.find((c) => c.isBone) || null;

/** A poser for both hands of `root`, or null where a hand has no finger bones. */
export function createFingerPoser(root, wrists) {
  const hands = ['right', 'left'].map((side) => {
    const chains = chainsFor(root, side);
    const wrist = side === 'right' ? wrists.right : wrists.left;
    if (!chains || !wrist) return null;
    const bones = chains.flat();
    return {
      side, chains, wrist, bones,
      saved: bones.map(() => new THREE.Quaternion()),
      haveSaved: false,
      // The pose now (blended) and where it is headed.
      now: JSON.parse(JSON.stringify(POSES.relax)),
      from: JSON.parse(JSON.stringify(POSES.relax)),
      to: POSES.relax,
      t0: 0, ms: 1,
    };
  }).filter(Boolean);
  if (!hands.length) return null;

  function blendPose(h, now) {
    const k = Math.min(1, (now - h.t0) / h.ms);
    const e = k * k * (3 - 2 * k);
    h.to.fingers.forEach((f, i) => f.forEach((v, j) => { h.now.fingers[i][j] = h.from.fingers[i][j] + (v - h.from.fingers[i][j]) * e; }));
    h.to.thumb.forEach((v, j) => { h.now.thumb[j] = h.from.thumb[j] + (v - h.from.thumb[j]) * e; });
  }
  function apply(h) {
    const [thumb, index, middle, ring, little] = h.chains;
    // The hand's frame: along the fingers, across the knuckles, and the
    // palm's side — the side the thumb's root sits toward.
    const w = worldPos(h.wrist);
    const along = worldPos(middle[0]).sub(w).normalize();
    const across = worldPos(index[0]).sub(worldPos(little[0])).normalize();
    let palm = new THREE.Vector3().crossVectors(across, along).normalize();
    const knuckles = worldPos(index[0]).add(worldPos(little[0])).multiplyScalar(0.5);
    const toThumb = worldPos(thumb[0]).sub(knuckles);
    if (toThumb.dot(palm) < 0) palm.negate();
    // Each joint curled toward the palm, root first, so the ones after
    // follow it round.
    [index, middle, ring, little].forEach((chain, f) => {
      chain.forEach((bone, j) => {
        const child = firstBoneChild(bone);
        const dir = child ? worldPos(child).sub(worldPos(bone)).normalize() : along.clone();
        const axis = new THREE.Vector3().crossVectors(dir, palm);
        if (axis.lengthSq() < 1e-6) return;
        rotateWorld(bone, axis.normalize(), h.now.fingers[f][j]);
      });
    });
    // The thumb comes in across the palm toward the index finger.
    thumb.forEach((bone, j) => {
      const child = firstBoneChild(bone);
      const dir = child ? worldPos(child).sub(worldPos(bone)).normalize() : along.clone();
      const axis = new THREE.Vector3().crossVectors(dir, palm.clone().add(across.clone().multiplyScalar(0.6)).normalize());
      if (axis.lengthSq() < 1e-6) return;
      rotateWorld(bone, axis.normalize(), h.now.thumb[j]);
    });
  }

  return {
    /** Puts back the animation's own finger pose; call before the mixer. */
    before() {
      hands.forEach((h) => { if (h.haveSaved) h.bones.forEach((b, i) => b.quaternion.copy(h.saved[i])); });
    },
    /** Keeps the animation's pose, then curls the fingers over it. */
    after(now = performance.now()) {
      hands.forEach((h) => {
        h.bones.forEach((b, i) => h.saved[i].copy(b.quaternion));
        h.haveSaved = true;
        blendPose(h, now);
        apply(h);
      });
    },
    /** Moves `side`'s hand to the pose `name` over `ms`. */
    set(side, name, ms = 180) {
      const h = hands.find((x) => x.side === side);
      if (!h || !POSES[name]) return;
      h.from = JSON.parse(JSON.stringify(h.now));
      h.to = POSES[name];
      h.t0 = performance.now();
      h.ms = Math.max(1, ms);
    },
    /** The tip of `side`'s middle finger, in world space (or null). */
    tip(side = 'right') {
      const h = hands.find((x) => x.side === side);
      if (!h) return null;
      const last = h.chains[2][2];
      const child = firstBoneChild(last);
      return worldPos(child || last);
    },
  };
}
