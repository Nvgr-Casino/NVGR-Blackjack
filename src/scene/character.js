import * as THREE from 'three';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { loadGltf } from './gltf.js';
import { resolveRig, withoutRootMotion, prepareFigureMaterials, fitClipToRig } from './rig.js';
import { createReach } from './reach.js';
import { SEAT_TOP_Y, PLAYER_HEIGHT } from './scale.js';

// Player characters.
//
// Skinned meshes can't be cloned with .clone() — the copy would keep
// pointing at the original's skeleton and every instance would move
// together — hence SkeletonUtils.clone for each seat.
const TARGET_HEIGHT = PLAYER_HEIGHT;

// The cast: Microsoft Rocketbox avatars (MIT licence), dressed for a
// high-limit table. Rocketbox records its motion captures on the same
// skeleton as every avatar, so one "seated at a table" clip per sex drives
// the whole cast — shipped once and shared — and puts each figure's hands
// where a seated player's are. Imported by scripts/import-rocketbox.mjs.
const SIT_M = 'rb_sit_m.glb';
const SIT_F = 'rb_sit_f.glb';
export const CHARACTERS = [
  { id: 'rb_bm01', name: 'Daniel', sex: 'm', file: 'rb_bm01.glb', clip: SIT_M, tone: '#2b2f3a' },
  { id: 'rb_bm02', name: 'Marcus', sex: 'm', file: 'rb_bm02.glb', clip: SIT_M, tone: '#2a3550' },
  { id: 'rb_bm03', name: 'Oliver', sex: 'm', file: 'rb_bm03.glb', clip: SIT_M, tone: '#2f4a46' },
  { id: 'rb_bm05', name: 'Victor', sex: 'm', file: 'rb_bm05.glb', clip: SIT_M, tone: '#43304f' },
  { id: 'rb_bf01', name: 'Grace', sex: 'f', file: 'rb_bf01.glb', clip: SIT_F, tone: '#24344f' },
  { id: 'rb_bf02', name: 'Helen', sex: 'f', file: 'rb_bf02.glb', clip: SIT_F, tone: '#5a2a2a' },
  { id: 'rb_bf03', name: 'Clara', sex: 'f', file: 'rb_bf03.glb', clip: SIT_F, tone: '#4a4038' },
  { id: 'rb_bf04', name: 'Elena', sex: 'f', file: 'rb_bf04.glb', clip: SIT_F, tone: '#2e2e36' },
];

// Earlier casts. Accounts and seats still carry these ids, so each maps to
// a current figure of the same sex rather than everyone who chose one
// turning into the same default.
const RETIRED = {
  // The Mixamo figures.
  joe: 'rb_bm01', josh: 'rb_bm02', lewis: 'rb_bm03',
  louise: 'rb_bf04', martha: 'rb_bf02', suzie: 'rb_bf03',
  // The stylised low-poly figures, which slid out of their chairs.
  sterling: 'rb_bm01', baron: 'rb_bm05', rook: 'rb_bm02', marlowe: 'rb_bm03',
  jade: 'rb_bf01', scarlett: 'rb_bf02', vega: 'rb_bf03', duchess: 'rb_bf04',
};

export const DEFAULT_CHARACTER = CHARACTERS[0].id;

export function characterById(id) {
  const live = RETIRED[id] || id;
  return CHARACTERS.find((c) => c.id === live) || CHARACTERS[0];
}

// Everyone would otherwise sit down as the same person, so a player with no
// choice saved yet gets one derived from their id.
export function defaultCharacterFor(key) {
  if (!key) return DEFAULT_CHARACTER;
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return CHARACTERS[h % CHARACTERS.length].id;
}

function modelUrl(file) {
  return import.meta.env.BASE_URL + 'models/characters/' + file;
}

const loadModel = (file) => loadGltf(modelUrl(file));

// Every seated figure, stepped from the render loop: its seated clip, and
// over that whatever its hand is doing (see reach.js).
const seated = new Set();
export function updateSeatedCharacters(deltaSeconds) {
  seated.forEach(({ mixer, reach }) => {
    if (reach) reach.before();
    mixer.update(deltaSeconds);
    if (reach) reach.after();
  });
}

/** Moves a seated figure's right hand through `points`; see reach.js. */
export function playerReach(group, points, options) {
  const reach = group && group.userData.reach;
  if (reach) reach.play(points, options);
}

/** Where a seated figure's right hand is, or null before it has loaded. */
export function playerHandPosition(group) {
  const reach = group && group.userData.reach;
  return reach ? reach.handPosition() : null;
}

function pickSeatedClip(clips) {
  if (!clips || !clips.length) return null;
  // Mixamo exports a single clip named "mixamo.com"; a pack with several
  // would want the seated one.
  return clips.find((c) => /sit|seat/i.test(c.name)) || clips[0];
}

// Scales and drops a model onto the chair without touching its pose — for
// figures whose pose is coming from an animation rather than from the
// hinge bend below.
function placeSeated(model) {
  const bones = resolveRig(model);
  model.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(model);
  const size = new THREE.Vector3();
  box.getSize(size);
  if (size.y > 0) model.scale.setScalar(TARGET_HEIGHT / size.y);
  model.updateMatrixWorld(true);
  if (!bones.hips) return;
  const hip = new THREE.Vector3();
  bones.hips.getWorldPosition(hip);
  model.position.y += SEAT_TOP_Y + 0.05 - hip.y;
  model.updateMatrixWorld(true);
  bones.hips.getWorldPosition(hip);
  model.position.x -= hip.x;
  model.position.z -= hip.z;
}

// Returns a group straight away and fills it in once the model arrives, so
// the scene code can stay synchronous.
export function createCharacter(id) {
  const c = characterById(id);
  const group = new THREE.Group();
  // A figure either carries its own seated clip (Mixamo), or shares one
  // recorded on the same skeleton and shipped once (Rocketbox).
  Promise.all([loadModel(c.file), c.clip ? loadModel(c.clip) : null]).then(([gltf, clipGltf]) => {
    const model = cloneSkinned(gltf.scene);
    model.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    prepareFigureMaterials(model);

    // The seated clip puts the arms, hands and weight where a person at a
    // table actually holds them, and keeps them alive between hands.
    placeSeated(model);
    const clip = pickSeatedClip((clipGltf || gltf).animations);
    if (clip) {
      const bones = resolveRig(model);
      const mixer = new THREE.AnimationMixer(model);
      // Without this the clip's hips-position track drags the figure off
      // its chair to wherever the motion was captured — see rig.js.
      mixer.clipAction(withoutRootMotion(fitClipToRig(clip, (clipGltf || gltf).scene, model), bones.hips)).play();
      // Each figure is offset so a row of them doesn't breathe in unison.
      mixer.setTime(Math.random() * clip.duration);
      const reach = createReach(model, bones);
      const record = { mixer, reach };
      seated.add(record);
      group.userData.mixer = mixer;
      group.userData.reach = reach;
      // Called when the figure leaves its seat, so it stops being animated.
      group.userData.release = () => seated.delete(record);
    }
    // The head, hair and glasses, which Rocketbox keeps as meshes of their
    // own, so the table can stop drawing a head the camera is sitting right
    // behind — glasses included, or they hang in the air in front of you.
    const head = [];
    model.traverse((o) => {
      if (o.isMesh && [].concat(o.material).some((mt) => /_(head|opacity|glasses)$/i.test(mt.name))) head.push(o);
    });
    group.userData.headMeshes = head;
    group.add(model);
  }).catch(() => { /* a missing model just leaves an empty chair */ });
  return group;
}

// ---------- portraits for the HTML side ----------
// One small offscreen renderer draws every character once; the results are
// cached as data URLs and reused by the picker, seat pills and lobby.
const portraits = new Map();
let thumbJob = null;

function fallbackPortrait(id, size) {
  const c = characterById(id);
  const canvas = document.createElement('canvas');
  canvas.width = size; canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = c.tone;
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(246,236,217,0.9)';
  ctx.font = `700 ${size * 0.4}px Georgia, serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(c.name[0], size / 2, size / 2 + size * 0.02);
  return canvas.toDataURL();
}

export function characterPortraitDataURL(id, size = 96) {
  const key = characterById(id).id;
  return portraits.get(key) || fallbackPortrait(key, size);
}

export function hasPortraits() { return portraits.size >= CHARACTERS.length; }

// Renders a head-and-shoulders shot of each character. Called once when the
// picker opens; every later render just reads the cache.
//
// `onPortrait` fires after each one so the picker can redraw as they
// arrive. That matters now the cast is photoreal: a portrait costs a whole
// model download, and waiting for all fourteen before showing any would
// leave the screen on placeholder discs for megabytes at a time. They fill
// in one by one instead, and every model fetched here is the same cached
// one the table will use later.
export function buildCharacterPortraits(size = 192, onPortrait = null) {
  if (thumbJob) return thumbJob;
  thumbJob = (async () => {
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(size, size);
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;

    const scene = new THREE.Scene();
    scene.add(new THREE.AmbientLight(0xffffff, 2.4));
    const key = new THREE.DirectionalLight(0xfff0d0, 2.6);
    key.position.set(1.2, 2.2, 2.4);
    scene.add(key);
    const camera = new THREE.PerspectiveCamera(28, 1, 0.01, 200);

    for (const c of CHARACTERS) {
      try {
        const gltf = await loadModel(c.file);
        const model = cloneSkinned(gltf.scene);
        prepareFigureMaterials(model);
        scene.add(model);
        model.updateMatrixWorld(true);

        const box = new THREE.Box3().setFromObject(model);
        const s = new THREE.Vector3();
        box.getSize(s);
        const cx = (box.min.x + box.max.x) / 2;
        const cz = (box.min.z + box.max.z) / 2;
        const headY = box.max.y - s.y * 0.11;
        // Framed on the head, pulled back enough to catch the shoulders —
        // and far enough that tall hair (the punk's mohawk, the hood) isn't
        // clipped at the crown.
        camera.position.set(cx, headY, cz + s.y * 0.55);
        camera.lookAt(cx, headY - s.y * 0.03, cz);
        renderer.render(scene, camera);
        portraits.set(c.id, renderer.domElement.toDataURL());
        scene.remove(model);
      } catch (e) { /* keep the fallback disc for this one */ }
      if (onPortrait) { try { onPortrait(c.id); } catch (e) { /* a redraw failing must not stop the run */ } }
    }
    renderer.dispose();
    return true;
  })();
  return thumbJob;
}
