import * as THREE from 'three';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { loadGltf } from './gltf.js';
import { resolveRig, withoutRootMotion, prepareFigureMaterials, fitClipToRig } from './rig.js';
import { createReach } from './reach.js';
import { DEALER } from './seats.js';
import { DEALER_HEIGHT, FLOOR_Y, m } from './scale.js';

// The dealer: a Microsoft Rocketbox avatar, like the players, standing
// behind the table on the library's own motion-captured standing idle —
// one clip file, recorded on the same skeleton as every avatar. The man
// wears a waistcoat, the woman a blouse and skirt: house uniform, and a
// different wardrobe from anyone a player can sit down as.
//
// Two dealers so a table can run either; a room records which.
export const DEALER_MODELS = {
  male: { file: 'rb_dealer_m.glb', clip: 'rb_idle_m.glb' },
  female: { file: 'rb_dealer_f.glb', clip: 'rb_idle_f.glb' },
};
export const DEALER_KEYS = Object.keys(DEALER_MODELS);

// Served out of public/, so built from Vite's base (the site lives under
// /NVGR-Blackjack/ on GitHub Pages).
const modelUrl = (file) => import.meta.env.BASE_URL + 'models/characters/' + file;
const loadModel = (file) => loadGltf(modelUrl(file));

// Stands the dealer on the carpet behind the table, scaled to an average
// adult. Scaled by the bind-pose bounding box — a standing T-pose, so its
// height is the figure's height — but placed by the hips, the one landmark
// every rig agrees on: Box3 reads a skinned mesh in bind space and knows
// nothing about where the bones put it. A standing adult's hips sit about
// 0.95 m up, which puts the soles on the floor.
function standAtTable(model, bones) {
  model.updateMatrixWorld(true);
  const size = new THREE.Box3().setFromObject(model).getSize(new THREE.Vector3());
  if (size.y > 0) model.scale.setScalar(DEALER_HEIGHT / size.y);
  model.updateMatrixWorld(true);
  const hip = new THREE.Vector3();
  bones.hips.getWorldPosition(hip);
  model.position.y += (FLOOR_Y + m(0.95)) - hip.y;
  model.updateMatrixWorld(true);
  bones.hips.getWorldPosition(hip);
  model.position.x -= hip.x;
  model.position.z -= hip.z;
}

// Every dealer figure, stepped from scene.js's render loop. The reach is
// layered over the idle each frame (see reach.js).
const activeDealers = new Set();
export function updateDealerAnimations(deltaSeconds) {
  activeDealers.forEach((record) => {
    if (record.reach) record.reach.before();
    record.mixer.update(deltaSeconds);
    if (record.reach) record.reach.after();
  });
}

export function createDealerFigure(key = 'male') {
  const group = new THREE.Group();
  group.userData.ready = false;
  populateDealer(group, key);
  return group;
}

// Swaps which dealer stands at the table without replacing the group —
// every other module holds a reference to it (the deal animations aim at it).
export function setDealerModel(group, key) {
  const spec = DEALER_MODELS[key] || DEALER_MODELS.male;
  if (group.userData.file === spec.file) return;
  populateDealer(group, key);
}

function populateDealer(group, key) {
  const spec = DEALER_MODELS[key] || DEALER_MODELS.male;
  group.userData.file = spec.file;
  if (group.userData.model) group.remove(group.userData.model);
  if (group.userData.record) activeDealers.delete(group.userData.record);
  group.userData.ready = false;

  Promise.all([loadModel(spec.file), loadModel(spec.clip)])
    .then(([gltf, clipGltf]) => {
      if (group.userData.file !== spec.file) return; // swapped again meanwhile
      const model = cloneSkinned(gltf.scene);
      const bones = resolveRig(model);
      if (!bones.hips) { console.warn('Dealer model has no hips bone.'); return; }
      standAtTable(model, bones);
      model.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
      prepareFigureMaterials(model);
      group.add(model);

      const mixer = new THREE.AnimationMixer(model);
      const idle = clipGltf.animations[0];
      if (idle) mixer.clipAction(withoutRootMotion(fitClipToRig(idle, clipGltf.scene, model), bones.hips)).play();
      const reach = createReach(model, bones);
      if (!reach) console.warn('Dealer model is missing right-arm bones — reach skipped.');

      const record = { mixer, reach };
      activeDealers.add(record);
      Object.assign(group.userData, { model, mixer, record, ready: true });
    })
    .catch((err) => console.error('Failed to load dealer model:', err));
}

// Kept for scene.js, which starts the idle as soon as the figure exists; the
// idle simply loops from the moment the model has loaded.
export function startDealerIdle(dealer) {
  dealer.userData.idleActive = true;
}

// Aims just above the felt rather than into it.
const LIFT = 0.16;
const lifted = (p) => p.clone().setY(Math.max(p.y, 0) + LIFT);

/** Moves the dealer's hand through `points` ([{ at, pos }]); see reach.js. */
export function dealerReach(dealer, points, options) {
  const record = dealer.userData.record;
  if (!record || !record.reach) return;
  record.reach.play(points.map((p) => ({ at: p.at, pos: lifted(p.pos) })), options);
}

// Takes a card from the shoe and pitches it toward `target`.
export function playDealGesture(dealer, target, duration = 550) {
  if (!target) return;
  dealerReach(dealer, [
    { at: duration * 0.38, pos: DEALER.deckPosition },
    { at: duration, pos: target },
  ]);
}
