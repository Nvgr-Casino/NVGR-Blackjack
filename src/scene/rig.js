import * as THREE from 'three';

// Finds the bones the table needs, whatever skeleton a model arrived with.
//
// Every figure here is posed by code rather than by a canned animation —
// the seated bend, and the dealer's arm reaching toward a seat — so the
// scene has to be able to name a thigh. Hardcoding one pack's bone names
// meant a model from anywhere else silently failed its pose and stood bolt
// upright through the table.
//
// Two conventions matter so far: Quaternius ("UpperLegL") and Mixamo
// ("mixamorig7:LeftUpLeg"). Mixamo's prefix carries a number that changes
// per download — mixamorig, mixamorig1, mixamorig7 — so it can never be
// matched literally, and GLTFLoader strips punctuation out of node names
// on import anyway. Matching on the end of the name sidesteps both.

const ROLE_NAMES = {
  hips: ['Hips'],
  upperLegL: ['UpperLegL', 'LeftUpLeg'],
  upperLegR: ['UpperLegR', 'RightUpLeg'],
  lowerLegL: ['LowerLegL', 'LeftLeg'],
  lowerLegR: ['LowerLegR', 'RightLeg'],
  shoulderR: ['ShoulderR', 'RightShoulder'],
  upperArmR: ['UpperArmR', 'RightArm'],
  lowerArmR: ['LowerArmR', 'RightForeArm'],
  wristR: ['WristR', 'RightHand'],
};

// The leg roles are what a seated pose needs; without all of them the
// figure cannot be sat down at all.
export const SEAT_ROLES = ['hips', 'upperLegL', 'upperLegR', 'lowerLegL', 'lowerLegR'];
export const ARM_ROLES = ['shoulderR', 'upperArmR', 'lowerArmR', 'wristR'];

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
 * Only the position goes. The rotations are the pose, and they stay.
 */
export function withoutRootMotion(clip, hipsBone) {
  if (!clip || !hipsBone) return clip;
  const drop = hipsBone.name + '.position';
  const tracks = clip.tracks.filter((t) => t.name !== drop);
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
