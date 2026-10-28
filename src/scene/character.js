import * as THREE from 'three';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { loadGltf } from './gltf.js';
import { resolveRig, withoutRootMotion, prepareFigureMaterials } from './rig.js';
import { SEAT_TOP_Y, PLAYER_HEIGHT } from './scale.js';

// Player characters.
//
// Skinned meshes can't be cloned with .clone() — the copy would keep
// pointing at the original's skeleton and every instance would move
// together — hence SkeletonUtils.clone for each seat.
const TARGET_HEIGHT = PLAYER_HEIGHT;

// The cast: realistic Mixamo figures, each shipping with a motion-captured
// "seated idle, hands on a table" clip, which is what puts their arms and
// hands where a player's actually are and keeps them alive between hands.
export const CHARACTERS = [
  { id: 'joe', name: 'Joe', sex: 'm', file: 'mx_joe.glb', tone: '#2b2f3a' },
  { id: 'josh', name: 'Josh', sex: 'm', file: 'mx_josh.glb', tone: '#3b4454' },
  { id: 'lewis', name: 'Lewis', sex: 'm', file: 'mx_lewis.glb', tone: '#2f5248' },
  { id: 'louise', name: 'Louise', sex: 'f', file: 'mx_louise.glb', tone: '#24344f' },
  { id: 'martha', name: 'Martha', sex: 'f', file: 'mx_martha.glb', tone: '#4a3350' },
  { id: 'suzie', name: 'Suzie', sex: 'f', file: 'mx_suzie.glb', tone: '#6b5a4a' },
];

// The stylised low-poly cast that came before. They sat badly — no seated
// clip, so they were bent into their chairs by hand and slid out of them —
// and they looked like a different game. Accounts and seats still carry
// their ids, so each maps to a realistic figure of the same sex rather
// than everyone who chose one turning into the same default.
const RETIRED = {
  sterling: 'joe', baron: 'lewis', rook: 'josh', marlowe: 'joe',
  jade: 'louise', scarlett: 'martha', vega: 'suzie', duchess: 'louise',
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

// Every seated figure's animation mixer, stepped from the render loop.
const seatedMixers = new Set();
export function updateSeatedCharacters(deltaSeconds) {
  seatedMixers.forEach((m) => m.update(deltaSeconds));
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
  loadModel(c.file).then((gltf) => {
    const model = cloneSkinned(gltf.scene);
    model.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    prepareFigureMaterials(model);

    // The seated clip puts the arms, hands and weight where a person at a
    // table actually holds them, and keeps them alive between hands.
    placeSeated(model);
    const clip = pickSeatedClip(gltf.animations);
    if (clip) {
      const bones = resolveRig(model);
      const mixer = new THREE.AnimationMixer(model);
      // Without this the clip's hips-position track drags the figure off
      // its chair to wherever the motion was captured — see rig.js.
      mixer.clipAction(withoutRootMotion(clip, bones.hips)).play();
      // Each figure is offset so a row of them doesn't breathe in unison.
      mixer.setTime(Math.random() * clip.duration);
      seatedMixers.add(mixer);
      group.userData.mixer = mixer;
    }
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
