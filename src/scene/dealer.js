import * as THREE from 'three';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { loadGltf } from './gltf.js';
import { resolveRig, withoutRootMotion, prepareFigureMaterials, fitClipToRig } from './rig.js';
import { createReach } from './reach.js';
import { DEALER } from './seats.js';
import { DEAL_MS, DEAL_PULL, DEAL_PICK, DEAL_SET } from './deal.js';
import { DEALER_HEIGHT, FLOOR_Y, m } from './scale.js';

// The dealer: a Microsoft Rocketbox avatar, like the players, standing
// behind the table on the library's own motion-captured standing idle —
// one clip file, recorded on the same skeleton as every avatar, and a
// different wardrobe from anyone a player can sit down as.
//
// Every table has its own dealer, dressed for its stakes: plain shirts and
// blouses at the low-limit tables, the house waistcoat in the middle, and
// at the top two a black or burgundy waistcoat with a bow tie, or a black
// dress. Rocketbox has no formal wear; those are its waistcoat re-dyed
// (scripts/dealer-recolor.mjs), on a figure given another's head and hair
// (scripts/transplant-head.mjs), since the only waistcoat came on a bald
// one. A room records which of the two dealers of its tier it has.
const IDLE_M = 'rb_idle_m.glb';
const IDLE_F = 'rb_idle_f.glb';
export const DEALER_MODELS = {
  m1: { file: 'rb_dealer_m.glb', clip: IDLE_M },   // white shirt
  f1: { file: 'rb_dealer_f.glb', clip: IDLE_F },   // blue blouse
  m2: { file: 'rb_dealer_m2.glb', clip: IDLE_M },  // pale blue shirt
  f2: { file: 'rb_dealer_f2.glb', clip: IDLE_F },  // white blouse
  m3: { file: 'rb_dealer_m3.glb', clip: IDLE_M },  // grey waistcoat
  f3: { file: 'rb_dealer_f3.glb', clip: IDLE_F },  // grey waistcoat
  m4: { file: 'rb_dealer_m4.glb', clip: IDLE_M, bowTie: 0x111114 },  // black waistcoat
  f4: { file: 'rb_dealer_f4.glb', clip: IDLE_F },  // black waistcoat
  m5: { file: 'rb_dealer_m5.glb', clip: IDLE_M, bowTie: 0x111114 },  // burgundy waistcoat
  f5: { file: 'rb_dealer_f5.glb', clip: IDLE_F },  // black dress
};
export const DEALER_KEYS = ['male', 'female'];

/**
 * The dealer for a table: its stakes tier (1–5) picks the wardrobe, and
 * the room's `dealerType` which of the tier's two. Tables opened before
 * dealers had tiers say only 'male' or 'female', which this reads as is.
 */
export function dealerKeyFor(tier, dealerType) {
  const sex = dealerType === 'female' ? 'f' : 'm';
  const t = Math.max(1, Math.min(5, tier || 1));
  return sex + t;
}

// Served out of public/, so built from Vite's base (the site lives under
// /NVGR-Blackjack/ on GitHub Pages).
const modelUrl = (file) => import.meta.env.BASE_URL + 'models/characters/' + file;
const loadModel = (file) => loadGltf(modelUrl(file));

// Stands the dealer behind the table, scaled to an average adult. Scaled
// by the bind-pose bounding box — a standing T-pose, so its height is the
// figure's height — but placed by the hips, the one landmark every rig
// agrees on: Box3 reads a skinned mesh in bind space and knows nothing
// about where the bones put it.
//
// A standing adult's hips are about 0.95 m up, but stood on the floor the
// felt met the dealer at the crotch, which from the players' chairs looked
// wrong however true it was. The dealer is set 10 cm lower, so the table
// meets him at the waist, as it does on a live-dealer stream; his feet are
// hidden by the table and nobody sees the floor there.
const HIP_HEIGHT = m(0.95) - m(0.1);
function standAtTable(model, bones) {
  model.updateMatrixWorld(true);
  const size = new THREE.Box3().setFromObject(model).getSize(new THREE.Vector3());
  if (size.y > 0) model.scale.setScalar(DEALER_HEIGHT / size.y);
  model.updateMatrixWorld(true);
  const hip = new THREE.Vector3();
  bones.hips.getWorldPosition(hip);
  model.position.y += (FLOOR_Y + HIP_HEIGHT) - hip.y;
  model.updateMatrixWorld(true);
  bones.hips.getWorldPosition(hip);
  model.position.x -= hip.x;
  model.position.z -= hip.z;
}

// Every dealer figure, stepped from scene.js's render loop. The reaches are
// layered over the idle each frame (see reach.js). Both arms share the
// waist, so their keep-and-restore has to nest: the right arm runs first
// after the mixer and is put back last before it, which leaves the waist
// holding the mixer's own pose when the mixer next runs.
const activeDealers = new Set();
export function updateDealerAnimations(deltaSeconds) {
  activeDealers.forEach((record) => {
    if (record.left) record.left.before();
    if (record.reach) record.reach.before();
    record.mixer.update(deltaSeconds);
    if (record.reach) record.reach.after();
    if (record.left) record.left.after();
  });
}

export function createDealerFigure(key = 'm1') {
  const group = new THREE.Group();
  group.userData.ready = false;
  populateDealer(group, key);
  return group;
}

// Swaps which dealer stands at the table without replacing the group —
// every other module holds a reference to it (the deal animations aim at it).
export function setDealerModel(group, key) {
  const spec = DEALER_MODELS[key] || DEALER_MODELS.m1;
  if (group.userData.file === spec.file) return;
  populateDealer(group, key);
}

function populateDealer(group, key) {
  const spec = DEALER_MODELS[key] || DEALER_MODELS.m1;
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
      if (spec.bowTie) addBowTie(model, bones, spec.bowTie);
      addNameBadge(model, bones);
      group.add(model);

      const mixer = new THREE.AnimationMixer(model);
      const idle = clipGltf.animations[0];
      if (idle) mixer.clipAction(withoutRootMotion(fitClipToRig(idle, clipGltf.scene, model), bones.hips)).play();
      const reach = createReach(model, bones);
      if (!reach) console.warn('Dealer model is missing right-arm bones — reach skipped.');
      // The left hand draws from the shoe; it leans the body less, since
      // the right is usually reaching at the same time.
      const left = createReach(model, bones, { side: 'left', body: 0.5 });

      const record = { mixer, reach, left };
      activeDealers.add(record);
      Object.assign(group.userData, { model, mixer, record, ready: true });
    })
    .catch((err) => console.error('Failed to load dealer model:', err));
}

// A bow tie at the collar, for the dealers at the top tables. Made here
// rather than found: two pleated wings and a knot, tied to the neck bone so
// it moves with the figure. Placed while the figure is in its bind pose,
// just in front of the throat and a little under the chin.
function addBowTie(model, bones, color) {
  const neck = bones.neck;
  const head = bones.head;
  if (!neck || !head) return;
  const silk = new THREE.MeshStandardMaterial({ color, roughness: 0.38, metalness: 0 });
  const tie = new THREE.Group();
  const W = m(0.045), H = m(0.03), D = m(0.012);
  [-1, 1].forEach((side) => {
    // A wing: wide at its outer end, pinched at the knot.
    const shape = new THREE.Shape();
    shape.moveTo(0, -H * 0.18);
    shape.lineTo(side * W, -H / 2);
    shape.quadraticCurveTo(side * W * 1.08, 0, side * W, H / 2);
    shape.lineTo(0, H * 0.18);
    shape.closePath();
    const wing = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: D, bevelEnabled: true, bevelSize: D * 0.3, bevelThickness: D * 0.3, bevelSegments: 2, curveSegments: 6 }), silk);
    wing.position.z = -D / 2;
    tie.add(wing);
  });
  const knot = new THREE.Mesh(new THREE.BoxGeometry(W * 0.32, H * 0.5, D * 1.6), silk);
  tie.add(knot);
  tie.traverse((o) => { if (o.isMesh) o.castShadow = true; });

  model.updateMatrixWorld(true);
  const n = neck.getWorldPosition(new THREE.Vector3());
  const h = head.getWorldPosition(new THREE.Vector3());
  // The figure faces its own +z.
  const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(model.getWorldQuaternion(new THREE.Quaternion()));
  const at = n.clone().lerp(h, 0.05).addScaledVector(forward, BOW_FORWARD).add(new THREE.Vector3(0, -BOW_DROP, 0));
  neck.add(tie);
  tie.position.copy(neck.worldToLocal(at.clone()));
  tie.quaternion.copy(neck.getWorldQuaternion(new THREE.Quaternion()).invert()
    .multiply(model.getWorldQuaternion(new THREE.Quaternion())));
  // The bones are scaled with the figure; the tie is sized in the world.
  const s = neck.getWorldScale(new THREE.Vector3());
  tie.scale.set(1 / s.x, 1 / s.y, 1 / s.z);
}
const BOW_FORWARD = m(0.092);
const BOW_DROP = m(0.026);

// Every dealer wears the house badge: a small brass plate engraved NVGR,
// pinned on the left of the chest and carried by the chest bone.
let badgeTexture = null;
function badgeMaterial() {
  if (!badgeTexture) {
    const c = document.createElement('canvas');
    c.width = 256; c.height = 80;
    const ctx = c.getContext('2d');
    const g = ctx.createLinearGradient(0, 0, 0, 80);
    g.addColorStop(0, '#e2c58a'); g.addColorStop(0.5, '#b8955a'); g.addColorStop(1, '#8a6c3c');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 256, 80);
    ctx.strokeStyle = 'rgba(60,40,15,0.6)';
    ctx.lineWidth = 4;
    ctx.strokeRect(5, 5, 246, 70);
    ctx.fillStyle = '#2b1d0c';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = "700 46px Cinzel, Georgia, serif";
    ctx.fillText('NVGR', 128, 43);
    badgeTexture = new THREE.CanvasTexture(c);
    badgeTexture.colorSpace = THREE.SRGBColorSpace;
  }
  return new THREE.MeshStandardMaterial({ map: badgeTexture, roughness: 0.35, metalness: 0.6 });
}
function addNameBadge(model, bones) {
  const chest = bones.chest || bones.spine;
  const neck = bones.neck;
  if (!chest || !neck) return;
  const badge = new THREE.Mesh(new THREE.BoxGeometry(m(0.085), m(0.027), m(0.004)), [
    badgeMaterial(), badgeMaterial(), badgeMaterial(), badgeMaterial(), badgeMaterial(), badgeMaterial(),
  ]);
  model.updateMatrixWorld(true);
  const n = neck.getWorldPosition(new THREE.Vector3());
  const q = model.getWorldQuaternion(new THREE.Quaternion());
  const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(q);
  const left = new THREE.Vector3(1, 0, 0).applyQuaternion(q);   // the dealer's left, facing +z
  const at = n.clone().add(new THREE.Vector3(0, -BADGE_DROP, 0)).addScaledVector(forward, BADGE_FORWARD).addScaledVector(left, BADGE_SIDE);
  chest.add(badge);
  badge.position.copy(chest.worldToLocal(at.clone()));
  badge.quaternion.copy(chest.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(q));
  const s = chest.getWorldScale(new THREE.Vector3());
  badge.scale.set(1 / s.x, 1 / s.y, 1 / s.z);
}
const BADGE_DROP = m(0.17);
const BADGE_FORWARD = m(0.115);
const BADGE_SIDE = m(0.085);

// Kept for scene.js, which starts the idle as soon as the figure exists; the
// idle simply loops from the moment the model has loaded.
export function startDealerIdle(dealer) {
  dealer.userData.idleActive = true;
}

// Aims just above the felt rather than into it.
const LIFT = 0.16;
const lifted = (p) => p.clone().setY(Math.max(p.y, 0) + LIFT);

/**
 * Moves one of the dealer's hands through `points` ([{ at, pos }]); see
 * reach.js. `hand` is 'right' (the default) or 'left'.
 */
export function dealerReach(dealer, points, { hand = 'right', ...options } = {}) {
  const record = dealer.userData.record;
  const reach = record && (hand === 'left' ? record.left : record.reach);
  if (!reach) return;
  reach.play(points.map((p) => ({ at: p.at, pos: lifted(p.pos) })), options);
}

// In step with the card itself (deal.js): the left hand at the shoe's mouth
// as the card starts out, sliding it to the handoff point; the right hand
// there to take it, then at the player's spot as it is set down.
export function playDealGesture(dealer, target, duration = DEAL_MS) {
  if (!target) return;
  dealerReach(dealer, [
    { at: duration * DEAL_PULL, pos: DEALER.deckPosition },
    { at: duration * DEAL_PICK, pos: DEALER.handoffPosition },
  ], { hand: 'left', returnMs: 320 });
  dealerReach(dealer, [
    { at: duration * DEAL_PICK, pos: DEALER.handoffPosition },
    { at: duration * DEAL_SET, pos: target },
  ], { returnMs: 300 });
}
