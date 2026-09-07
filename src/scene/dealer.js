import * as THREE from 'three';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { loadGltf } from './gltf.js';
import { DEALER } from './seats.js';

// A real rigged human model (CC0, Quaternius "Ultimate Modular Men Pack" —
// public domain, free for commercial use) instead of a hand-built capsule
// figure. It ships with a skeleton (down to individual finger bones) and a
// library of animation clips we reuse for idle/dealing instead of hand
// animating primitive meshes.
// Served straight out of public/, so the URL has to be built from Vite's
// base — hardcoding a leading "/" would look for the model at the domain
// root and 404 on GitHub Pages, where the site lives under /NVGR-Blackjack/.
// Two dealers, same rig and animation set, so a table can run either.
// Both .glb: `npm run models` emits a single self-contained file per model,
// because a .gltf may keep its buffers in sidecar files and the compressed
// output has to ship as one thing.
export const DEALER_MODELS = { male: 'dealer.glb', female: 'dealer_female.glb' };
export const DEALER_KEYS = Object.keys(DEALER_MODELS);
const modelUrl = (file) => import.meta.env.BASE_URL + 'models/' + file;
// Standing height used to scale the model. Bigger than a player (2.9) so
// the arms still carry a reach toward each seat rather than gesturing
// vaguely forward — but not the 4.2 this used to be: at that size the
// seated thigh is thick enough that its top surface breached the felt
// (hips land at -0.46, the felt is at +0.01), so a bare leg drew straight
// across the table, and the dealer towered over the newly right-sized
// players.
const TARGET_HEIGHT = 3.4;
const FLOOR_Y = -0.91; // matches table.js's floor mesh
const SEAT_TOP_Y = FLOOR_Y + 0.4; // matches avatar.js's createChair() seat-cushion height

const WORLD_X = new THREE.Vector3(1, 0, 0);
const HIP_ANGLE = -Math.PI / 2; // swings the thigh from hanging down to reaching forward, seated
const KNEE_ANGLE = Math.PI / 2; // cancels the thigh's world-space swing so the shin hangs straight down again

// Computes the constant LOCAL rotation delta a bone needs — on top of
// whatever its CURRENT local rotation happens to be each frame — so its
// WORLD orientation ends up rotated by `worldAngle` around the world X axis
// (a left-right hinge, i.e. hip/knee flexion) relative to where it was when
// this was computed. Bind-pose local rotations on a rig like this one are
// arbitrary (whatever Blender's bone roll happened to be), so guessing a
// plausible-looking local axis by hand produced a badly sheared leg the
// first time this was tried — going via each bone's actual WORLD
// orientation sidesteps that entirely.
function computeHingeDelta(bone, worldAngle) {
  const currentWorld = new THREE.Quaternion();
  bone.getWorldQuaternion(currentWorld);
  const hinge = new THREE.Quaternion().setFromAxisAngle(WORLD_X, worldAngle);
  const desiredWorld = hinge.multiply(currentWorld);

  const parentWorld = new THREE.Quaternion();
  bone.parent.getWorldQuaternion(parentWorld);
  const desiredLocal = parentWorld.invert().multiply(desiredWorld);

  // desiredLocal = delta * currentLocal  =>  delta = desiredLocal * currentLocal^-1
  return desiredLocal.multiply(bone.quaternion.clone().invert());
}

// Computed once, from the bones' bind pose, the first time a dealer model
// loads — then re-applied every frame after that (see applySeatBend /
// updateDealerAnimations).
//
// What comes back is the ABSOLUTE seated rotation of each leg bone, not the
// delta that produced it. That distinction is the whole fix for the legs
// twitching: a delta has to be premultiplied onto whatever the animation
// mixer last wrote, which is only correct while the mixer actually writes
// those bones every single frame. In the gap between a one-shot gesture
// ending and the idle crossfading back in, it doesn't — and the delta then
// compounds onto its own previous result, kicking the legs out. Copying an
// absolute rotation cannot compound, and it holds the legs still whatever
// the mixer does, which is what a seated dealer's legs should do anyway.
// The idle clip still drives the torso, arms and head.
function computeSeatBend(bones) {
  bones.upperLegL.quaternion.premultiply(computeHingeDelta(bones.upperLegL, HIP_ANGLE));
  bones.upperLegR.quaternion.premultiply(computeHingeDelta(bones.upperLegR, HIP_ANGLE));
  bones.upperLegL.updateMatrixWorld(true);
  bones.upperLegR.updateMatrixWorld(true);

  // Measured against the now-bent thighs, so this cancels exactly the
  // rotation the hip bend just added — not the original standing pose.
  bones.lowerLegL.quaternion.premultiply(computeHingeDelta(bones.lowerLegL, KNEE_ANGLE));
  bones.lowerLegR.quaternion.premultiply(computeHingeDelta(bones.lowerLegR, KNEE_ANGLE));

  return {
    upperLegL: bones.upperLegL.quaternion.clone(),
    upperLegR: bones.upperLegR.quaternion.clone(),
    lowerLegL: bones.lowerLegL.quaternion.clone(),
    lowerLegR: bones.lowerLegR.quaternion.clone(),
  };
}

const loadModel = (file) => loadGltf(modelUrl(file));

// Scales the model to a known standing height (the source file's own unit
// scale isn't something to assume, so this measures the actual bounding box
// rather than guessing a factor), then drops it so — once the seated bend
// is layered on every frame — the hips land on the sofa's own seat height
// instead of the floor.
function fitSeatedModel(model, bones) {
  // Matrices first: the box is meaningless until the model's own transforms
  // are applied. The .glb dealers carry a scaled root node, so measuring
  // before this reads the raw authored geometry (tens of units tall) and
  // shrinks the figure to a speck.
  model.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(model);
  const size = new THREE.Vector3();
  box.getSize(size);
  if (size.y > 0) model.scale.setScalar(TARGET_HEIGHT / size.y);
  model.updateMatrixWorld(true);

  const seatPose = computeSeatBend(bones);
  model.updateMatrixWorld(true);

  // Placed by the hips bone rather than the bounding box. Box3 measures
  // skinned meshes from their bind pose and every model carries its own
  // root transform, so box-centring lands each character somewhere
  // different — the female dealer ended up several units off the table.
  // The hips are the same landmark in every rig.
  const hipWorld = new THREE.Vector3();
  bones.hips.getWorldPosition(hipWorld);
  model.position.y += SEAT_TOP_Y + 0.05 - hipWorld.y;
  model.updateMatrixWorld(true);

  bones.hips.getWorldPosition(hipWorld);
  model.position.x -= hipWorld.x;
  model.position.z -= hipWorld.z;

  return seatPose;
}

// Copy, not premultiply — see computeSeatBend. The mixer has just written
// the idle clip's standing legs over these bones; this puts the seated pose
// back, absolutely, so it can neither drift nor compound.
function applySeatBend(bones, seated) {
  bones.upperLegL.quaternion.copy(seated.upperLegL);
  bones.upperLegR.quaternion.copy(seated.upperLegR);
  bones.lowerLegL.quaternion.copy(seated.lowerLegL);
  bones.lowerLegR.quaternion.copy(seated.lowerLegR);
}

const LOCAL_Y = new THREE.Vector3(0, 1, 0);

// Finds the right-arm bone chain and measures each segment's actual length
// in world units (via the bones' own bind-pose world positions) — the
// source file's raw translation numbers are in whatever unit scale the
// model shipped in, and get whatever uniform scale fitSeatedModel applied
// on top, so measuring post-scale sidesteps needing to know either.
function captureArmChain(model) {
  const shoulder = model.getObjectByName('ShoulderR');
  const upperArm = model.getObjectByName('UpperArmR');
  const lowerArm = model.getObjectByName('LowerArmR');
  const wrist = model.getObjectByName('WristR');
  if (!shoulder || !upperArm || !lowerArm || !wrist) return null;

  model.updateMatrixWorld(true);
  const p1 = new THREE.Vector3();
  const p2 = new THREE.Vector3();
  const p3 = new THREE.Vector3();
  upperArm.getWorldPosition(p1);
  lowerArm.getWorldPosition(p2);
  wrist.getWorldPosition(p3);

  return {
    upperArm,
    lowerArm,
    wrist,
    upperLen: p1.distanceTo(p2),
    lowerLen: p2.distanceTo(p3),
  };
}

// Rotates `bone` so its local +Y axis (how this rig's limb bones all point
// toward their child joint — see the translation values in the source
// file) faces `worldDir`, preserving whatever roll/twist its current
// orientation already has. Same world-space technique as computeHingeDelta,
// but solved fresh against a moving target every call instead of once
// against a fixed angle.
function alignBoneToDirection(bone, worldDir) {
  const currentWorld = new THREE.Quaternion();
  bone.getWorldQuaternion(currentWorld);
  const currentDir = LOCAL_Y.clone().applyQuaternion(currentWorld);
  const rot = new THREE.Quaternion().setFromUnitVectors(currentDir.normalize(), worldDir.clone().normalize());
  const desiredWorld = rot.multiply(currentWorld);

  const parentWorld = new THREE.Quaternion();
  bone.parent.getWorldQuaternion(parentWorld);
  bone.quaternion.copy(parentWorld.invert().multiply(desiredWorld));
  bone.updateMatrixWorld(true);
}

// Analytic 2-bone IK (law of cosines) — bends the upper/lower arm so the
// wrist reaches toward `targetWorld`. `poleDir` is a fixed "elbow points
// this way" hint that resolves the otherwise-ambiguous bend direction, so
// the elbow swings out and down like a real arm instead of through the body.
const POLE_DIR = new THREE.Vector3(0.6, -0.5, 0.5).normalize();
function solveArmIK(arm, targetWorld) {
  const { upperArm, lowerArm, upperLen, lowerLen } = arm;
  const shoulderWorld = new THREE.Vector3();
  upperArm.getWorldPosition(shoulderWorld);

  const toTarget = targetWorld.clone().sub(shoulderWorld);
  const maxReach = upperLen + lowerLen - 0.001;
  const minReach = Math.abs(upperLen - lowerLen) + 0.001;
  const dist = THREE.MathUtils.clamp(toTarget.length(), minReach, maxReach);
  const dir = toTarget.normalize();

  const cosShoulder = (upperLen * upperLen + dist * dist - lowerLen * lowerLen) / (2 * upperLen * dist);
  const shoulderOffset = Math.acos(THREE.MathUtils.clamp(cosShoulder, -1, 1));

  let rotAxis = new THREE.Vector3().crossVectors(dir, POLE_DIR);
  if (rotAxis.lengthSq() < 1e-6) rotAxis = new THREE.Vector3().crossVectors(dir, LOCAL_Y);
  rotAxis.normalize();

  const upperDir = dir.clone().applyAxisAngle(rotAxis, shoulderOffset);
  alignBoneToDirection(upperArm, upperDir);

  const elbowWorld = shoulderWorld.clone().addScaledVector(upperDir, upperLen);
  const lowerDir = targetWorld.clone().sub(elbowWorld).normalize();
  alignBoneToDirection(lowerArm, lowerDir);
}

// All active dealer figures, driven from scene.js's render loop
// (THREE.AnimationMixer needs a real per-frame delta, unlike the project's
// own lightweight tween scheduler in animator.js — and both the seated pose
// and an in-progress reach need re-layering every frame for the same
// reason: the idle/gesture clips drive the whole skeleton, so anything
// applied once at the start would just get overwritten the next frame).
const activeDealers = new Set();
export function updateDealerAnimations(deltaSeconds) {
  activeDealers.forEach((record) => {
    record.mixer.update(deltaSeconds);
    if (record.bones && record.seatPose) applySeatBend(record.bones, record.seatPose);
    if (record.arm && record.reach) updateReach(record);
  });
}

function updateReach(record) {
  const { reach, arm } = record;
  const t = THREE.MathUtils.clamp((performance.now() - reach.startTime) / reach.duration, 0, 1);
  const targetPos = new THREE.Vector3();
  if (t < reach.pickFraction) {
    targetPos.lerpVectors(reach.fromPos, reach.deckPos, t / reach.pickFraction);
  } else {
    const t2 = (t - reach.pickFraction) / (1 - reach.pickFraction);
    targetPos.lerpVectors(reach.deckPos, reach.toPos, t2);
  }
  solveArmIK(arm, targetPos);
  if (t >= 1) record.reach = null;
}

export function createDealerFigure(key = 'male') {
  const group = new THREE.Group();
  group.userData.ready = false;
  group.userData.idleActive = false;
  populateDealer(group, key);
  return group;
}

// Swaps which dealer is standing at the table without replacing the group
// itself — every other module holds a reference to that group (the card
// dealing animations aim at it), so it has to survive the change.
export function setDealerModel(group, key) {
  const file = DEALER_MODELS[key] || DEALER_MODELS.male;
  if (group.userData.file === file) return;
  populateDealer(group, key);
}

function populateDealer(group, key) {
  const file = DEALER_MODELS[key] || DEALER_MODELS.male;
  group.userData.file = file;

  if (group.userData.model) group.remove(group.userData.model);
  if (group.userData.record) activeDealers.delete(group.userData.record);
  group.userData.ready = false;

  loadModel(file)
    .then((gltf) => {
      // Cloned, not used directly: the seated bend mutates bone rotations,
      // and the cached gltf is shared with any later swap back.
      const model = cloneSkinned(gltf.scene);

      // GLTFLoader strips "." from node names (the source file names joints
      // "UpperLeg.L" etc., following Blender's left/right suffix convention).
      const bones = {
        hips: model.getObjectByName('Hips'),
        upperLegL: model.getObjectByName('UpperLegL'),
        upperLegR: model.getObjectByName('UpperLegR'),
        lowerLegL: model.getObjectByName('LowerLegL'),
        lowerLegR: model.getObjectByName('LowerLegR'),
      };
      const seated = Object.values(bones).every(Boolean);
      let seatPose = null;
      if (seated) {
        seatPose = fitSeatedModel(model, bones);
      } else {
        console.warn('Dealer model is missing expected leg bones — seated pose skipped.');
      }

      model.traverse((obj) => {
        if (obj.isMesh) {
          obj.castShadow = true;
          obj.receiveShadow = true;
        }
      });
      group.add(model);

      const mixer = new THREE.AnimationMixer(model);
      const clips = {};
      gltf.animations.forEach((clip) => {
        clips[clip.name] = clip;
      });

      const idleClip = clips.Idle_Neutral || clips.Idle;
      const idleAction = idleClip ? mixer.clipAction(idleClip) : null;
      if (idleAction) idleAction.play();

      const arm = captureArmChain(model);
      if (!arm) console.warn('Dealer model is missing expected right-arm bones — reach gesture skipped.');

      const record = { mixer, bones: seated ? bones : null, seatPose, arm, reach: null };
      activeDealers.add(record);
      group.userData.model = model;
      group.userData.mixer = mixer;
      group.userData.clips = clips;
      group.userData.idleAction = idleAction;
      group.userData.activeAction = idleAction;
      group.userData.record = record;
      group.userData.ready = true;
    })
    .catch((err) => {
      console.error('Failed to load dealer model:', err);
    });
}

// Idle is just whatever's already looping once the model loads — kept as a
// pair of functions so scene.js/gameController.js don't need to know
// whether the model has finished loading yet.
export function startDealerIdle(dealer) {
  dealer.userData.idleActive = true;
}

export function stopDealerIdle(dealer) {
  dealer.userData.idleActive = false;
}

// A small lift above the felt so the reach aims at a point just over the
// table surface, not literally into it — the card itself still lands flat
// (see deal.js), this only affects where the hand appears to reach.
const REACH_LIFT = new THREE.Vector3(0, 0.18, 0);

// Crossfades from idle into a one-shot "handing something over" clip for
// body language (torso/head), while the right arm itself is driven by a
// real two-phase reach: from wherever it currently is, to the deck (as if
// picking the card up), then on to wherever the card is actually headed —
// a specific seat's hand spot swings the arm to that spot, not just a
// generic forward push. Falls back to silently doing nothing if the model
// hasn't finished loading yet (the very first card or two of a fast
// session) or if the pack turns out not to have a suitable clip/bones.
export function playDealGesture(dealer, target, duration = 550) {
  const { mixer, clips, idleAction, record } = dealer.userData;
  if (mixer && clips) {
    const gestureClip = clips.Interact || clips.Wave || clips.HitRecieve;
    if (gestureClip) {
      const action = mixer.clipAction(gestureClip);
      action.reset();
      action.setLoop(THREE.LoopOnce, 1);
      action.clampWhenFinished = true;
      action.enabled = true;
      action.setEffectiveWeight(1);
      action.play();
      if (idleAction) action.crossFadeFrom(idleAction, 0.1, false);
      dealer.userData.activeAction = action;

      const clipMs = gestureClip.duration * 1000;
      const holdMs = Math.max(150, Math.min(duration, clipMs) - 120);
      setTimeout(() => {
        if (!idleAction) return;
        idleAction.reset().play();
        idleAction.crossFadeFrom(action, 0.15, false);
        dealer.userData.activeAction = idleAction;
      }, holdMs);
    }
  }

  if (record && record.arm && target) {
    const wristWorld = new THREE.Vector3();
    record.arm.wrist.getWorldPosition(wristWorld);
    record.reach = {
      startTime: performance.now(),
      duration,
      pickFraction: 0.4,
      fromPos: wristWorld,
      deckPos: DEALER.deckPosition.clone().add(REACH_LIFT),
      toPos: target.clone().add(REACH_LIFT),
    };
  }
}
