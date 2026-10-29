import * as THREE from 'three';

// Finds the bones the table needs, whatever skeleton a model arrived with.
//
// Every figure here is posed by code rather than by a canned animation —
// the seated bend, and the dealer's arm reaching toward a seat — so the
// scene has to be able to name a thigh. Hardcoding one pack's bone names
// meant a model from anywhere else silently failed its pose and stood bolt
// upright through the table.
//
// Three conventions matter: Quaternius ("UpperLegL"), Mixamo
// ("mixamorig7:LeftUpLeg") and 3ds Max Biped, which Rocketbox uses
// ("Bip01 L Thigh", which GLTFLoader turns into "Bip01_L_Thigh"). Mixamo's
// prefix carries a number that changes per download — mixamorig,
// mixamorig1, mixamorig7 — so it can never be matched literally, and
// GLTFLoader rewrites punctuation and spaces in node names on import
// anyway. Matching on the end of the name sidesteps both.

const ROLE_NAMES = {
  hips: ['Hips', 'Pelvis'],
  upperLegL: ['UpperLegL', 'LeftUpLeg', 'L_Thigh'],
  upperLegR: ['UpperLegR', 'RightUpLeg', 'R_Thigh'],
  lowerLegL: ['LowerLegL', 'LeftLeg', 'L_Calf'],
  lowerLegR: ['LowerLegR', 'RightLeg', 'R_Calf'],
  shoulderR: ['ShoulderR', 'RightShoulder', 'R_Clavicle'],
  upperArmR: ['UpperArmR', 'RightArm', 'R_UpperArm'],
  lowerArmR: ['LowerArmR', 'RightForeArm', 'R_Forearm'],
  wristR: ['WristR', 'RightHand', 'R_Hand'],
  // The left arm, which the dealer draws cards from the shoe with.
  shoulderL: ['ShoulderL', 'LeftShoulder', 'L_Clavicle'],
  upperArmL: ['UpperArmL', 'LeftArm', 'L_UpperArm'],
  lowerArmL: ['LowerArmL', 'LeftForeArm', 'L_Forearm'],
  wristL: ['WristL', 'LeftHand', 'L_Hand'],
  // The lower and middle spine, which a figure bends and turns from when
  // reaching across the table.
  spineLow: ['Spine'],
  spine: ['Spine1'],
  chest: ['Spine2'],
  neck: ['Neck'],
  head: ['Head'],
};

// The leg roles are what a seated pose needs; without all of them the
// figure cannot be sat down at all.
export const SEAT_ROLES = ['hips', 'upperLegL', 'upperLegR', 'lowerLegL', 'lowerLegR'];
export const ARM_ROLES = ['shoulderR', 'upperArmR', 'lowerArmR', 'wristR'];
export const LEFT_ARM_ROLES = ['shoulderL', 'upperArmL', 'lowerArmL', 'wristL'];

function findBone(model, candidates) {
  let exact = null;
  let suffix = null;
  model.traverse((o) => {
    if (exact || !o.isBone) return;
    for (const name of candidates) {
      if (o.name === name) { exact = o; return; }
      // "mixamorig7:LeftUpLeg" / "mixamorig7LeftUpLeg" both end in the
      // role name. Checked only after every exact match has been ruled
      // out, so a literal name always wins.
      if (!suffix && o.name.endsWith(name)) suffix = o;
    }
  });
  return exact || suffix;
}

/**
 * Resolves every bone role present on `model`. Missing roles come back
 * undefined rather than throwing — callers decide whether a given pose is
 * possible without them.
 */
export function resolveRig(model) {
  const bones = {};
  for (const role of Object.keys(ROLE_NAMES)) {
    const bone = findBone(model, ROLE_NAMES[role]);
    if (bone) bones[role] = bone;
  }
  return bones;
}

export function hasRoles(bones, roles) {
  return roles.every((r) => !!bones[r]);
}

/**
 * Returns the clip with its root-motion track removed.
 *
 * A motion-capture clip animates the hips' *position* as well as every
 * bone's rotation — that is how a walk travels. For a figure we have
 * deliberately placed on a chair, that track is poison: the mixer rewrites
 * the hips every frame to wherever the capture studio's floor was, undoing
 * the placement. The dealer ended up sunk through the floor by two thirds
 * of a metre this way.
 *
 * Only the position goes. The rotations are the pose, and they stay. A
 * Biped skeleton keeps that translation on the root above the pelvis
 * rather than on the pelvis itself, so every bone from the hips up is
 * covered.
 */
export function withoutRootMotion(clip, hipsBone) {
  if (!clip || !hipsBone) return clip;
  const drop = new Set();
  for (let b = hipsBone; b && b.isBone; b = b.parent) drop.add(b.name + '.position');
  const tracks = clip.tracks.filter((t) => !drop.has(t.name));
  if (tracks.length === clip.tracks.length) return clip;
  return new THREE.AnimationClip(clip.name, clip.duration, tracks, clip.blendMode);
}

/**
 * Readies an imported figure's materials for the table.
 *
 * Two things arrive wrong from Mixamo's FBX by way of fbx2gltf.
 *
 * Hair and eyelashes come marked transparent at opacity 0. Nobody's hair
 * was ever visible, yet every strand card was still shaded and blended —
 * measured at a quarter of the frame on integrated graphics with five
 * players seated, for nothing on screen. They become alpha cut-outs: opaque
 * to the renderer, so they write depth and whatever lies behind them is
 * never shaded, with alpha-to-coverage feathering the edge through the
 * MSAA the renderer already pays for.
 *
 * And every material comes through at metalness 0.4 with no metalness map.
 * Skin, wool and cotton are not metal; at 0.4 they mirror the room, which
 * is the plastic sheen the figures had. Anything without its own map is set
 * to fully non-metallic and given at least a cloth-like roughness.
 */
export function prepareFigureMaterials(model) {
  model.traverse((o) => {
    if (!o.isMesh) return;
    for (const mat of [].concat(o.material)) {
      if (!mat.metalnessMap) mat.metalness = 0;
      if (!mat.roughnessMap) mat.roughness = Math.max(mat.roughness, 0.6);
      // Rocketbox hair is layered cards facing outward. Drawn double-sided,
      // the backs of the inner layers show through every gap in the outer
      // ones as dark wedges across the hair.
      if (/_opacity$/i.test(mat.name)) mat.side = THREE.FrontSide;
      if (mat.transparent) {
        mat.transparent = false;
        mat.opacity = 1;
        mat.depthWrite = true;
        mat.alphaTest = 0.25;
        mat.alphaToCoverage = true;
      }
      mat.needsUpdate = true;
    }
  });
}

/**
 * Fits a Rocketbox clip to a Rocketbox avatar.
 *
 * fbx2gltf drops the Biped root ("Bip01") from an avatar — it carries no
 * skin — and bakes its rotation into the pelvis, which becomes the top of
 * the skeleton. The clips keep Bip01, so the pelvis rotation they animate
 * is relative to a parent the avatar doesn't have: played as-is, the
 * standing idle laid the dealer flat across the table. Folding the root's
 * rotation into the pelvis track, keyframe by keyframe, gives the pelvis
 * the orientation the capture meant. Rigs that kept their root are
 * returned untouched.
 */
export function fitClipToRig(clip, clipScene, model) {
  if (!clip || model.getObjectByName('Bip01')) return clip;
  const rootName = 'Bip01';
  const pelvisName = 'Bip01_Pelvis';
  const rootTrack = clip.tracks.find((t) => t.name === rootName + '.quaternion');
  if (!rootTrack) return clip;
  const pelvisTrack = clip.tracks.find((t) => t.name === pelvisName + '.quaternion');
  const pelvisRest = clipScene && clipScene.getObjectByName(pelvisName);

  const times = pelvisTrack ? pelvisTrack.times : rootTrack.times;
  const rootAt = rootTrack.createInterpolant();
  const pelvisAt = pelvisTrack ? pelvisTrack.createInterpolant() : null;
  const values = new Float32Array(times.length * 4);
  const qr = new THREE.Quaternion();
  const qp = new THREE.Quaternion();
  for (let i = 0; i < times.length; i++) {
    qr.fromArray(rootAt.evaluate(times[i]));
    if (pelvisAt) qp.fromArray(pelvisAt.evaluate(times[i]));
    else if (pelvisRest) qp.copy(pelvisRest.quaternion);
    else qp.identity();
    qr.multiply(qp).toArray(values, i * 4);
  }
  const folded = new THREE.QuaternionKeyframeTrack(pelvisName + '.quaternion', Array.from(times), Array.from(values));
  const tracks = clip.tracks.filter((t) => !t.name.startsWith(rootName + '.') && t.name !== pelvisName + '.quaternion');
  tracks.push(folded);
  return new THREE.AnimationClip(clip.name, clip.duration, tracks, clip.blendMode);
}
