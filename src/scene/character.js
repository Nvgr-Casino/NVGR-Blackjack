import * as THREE from 'three';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { loadGltf } from './gltf.js';
import { resolveRig, hasRoles, withoutRootMotion, SEAT_ROLES } from './rig.js';
import { SEAT_TOP_Y, PLAYER_HEIGHT } from './scale.js';

// Player characters: real rigged models from Quaternius' Ultimate Modular
// Men and Women packs (CC0, same source and skeleton as the dealer), so one
// seated pose works for every one of them. Four men, four women.
//
// Skinned meshes can't be cloned with .clone() — the copy would keep
// pointing at the original's skeleton and every instance would move
// together — hence SkeletonUtils.clone for each seat.

// Scale lives in scale.js now — see the note there about the table's
// proportions, which is what these used to get wrong.
// The dealer is deliberately oversized so its arms can reach across the
// felt; a player only has to fit their own chair, so they are scaled to
// something closer to life against the table.
const TARGET_HEIGHT = PLAYER_HEIGHT;
const HIP_ANGLE = -Math.PI / 2;
const KNEE_ANGLE = Math.PI / 2;

// The cast. Each one ships with a motion-captured "seated idle, hands on a
// table" clip baked in, which is what puts their arms and hands where a
// player's actually are and keeps them alive between hands.
//
// The old stylised figures are kept below them rather than deleted: they
// are a tenth of the size, and anyone who already chose one still has a
// character. Their ids must never be reused for anything else — a saved
// account refers to its character by id.
export const CHARACTERS = [
  { id: 'joe', name: 'Joe', sex: 'm', file: 'mx_joe.glb', tone: '#2b2f3a' },
  { id: 'josh', name: 'Josh', sex: 'm', file: 'mx_josh.glb', tone: '#3b4454' },
  { id: 'lewis', name: 'Lewis', sex: 'm', file: 'mx_lewis.glb', tone: '#2f5248' },
  { id: 'louise', name: 'Louise', sex: 'f', file: 'mx_louise.glb', tone: '#24344f' },
  { id: 'martha', name: 'Martha', sex: 'f', file: 'mx_martha.glb', tone: '#4a3350' },
  { id: 'suzie', name: 'Suzie', sex: 'f', file: 'mx_suzie.glb', tone: '#6b5a4a' },

  { id: 'sterling', name: 'Sterling', sex: 'm', file: 'm_businessman.glb', tone: '#1e3a5f' },
  { id: 'baron', name: 'The Baron', sex: 'm', file: 'm_king.glb', tone: '#d4af52' },
  { id: 'rook', name: 'Rook', sex: 'm', file: 'm_hoodie.glb', tone: '#5b3a8a' },
  { id: 'marlowe', name: 'Marlowe', sex: 'm', file: 'm_adventurer.glb', tone: '#2f4f4f' },
  { id: 'jade', name: 'Jade', sex: 'f', file: 'f_casual.glb', tone: '#14513f' },
  { id: 'scarlett', name: 'Scarlett', sex: 'f', file: 'f_punk.glb', tone: '#7d1420' },
  { id: 'vega', name: 'Vega', sex: 'f', file: 'f_adventurer.glb', tone: '#3b6ea5' },
  { id: 'duchess', name: 'Duchess', sex: 'f', file: 'f_hooded.glb', tone: '#6d1f3f' },
];

export const DEFAULT_CHARACTER = CHARACTERS[0].id;

export function characterById(id) {
  return CHARACTERS.find((c) => c.id === id) || CHARACTERS[0];
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

// Same technique the dealer uses: a bone's local rotation offset is derived
// from its actual world orientation, because the local axes depend on
// whatever bone roll the rig was authored with and can't be guessed.
function hingeDelta(bone, worldAngle) {
  const currentWorld = new THREE.Quaternion();
  bone.getWorldQuaternion(currentWorld);
  const desiredWorld = new THREE.Quaternion()
    .setFromAxisAngle(new THREE.Vector3(1, 0, 0), worldAngle)
    .multiply(currentWorld);
  const parentWorld = new THREE.Quaternion();
  bone.parent.getWorldQuaternion(parentWorld);
  const desiredLocal = parentWorld.invert().multiply(desiredWorld);
  return desiredLocal.multiply(bone.quaternion.clone().invert());
}

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

function sitDown(model) {
  // By role, not by name — see src/scene/rig.js. A character from a pack
  // with different bone names would otherwise stand bolt upright through
  // the table instead of sitting in its chair.
  const bones = resolveRig(model);
  if (!hasRoles(bones, SEAT_ROLES)) return false;

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

  // Thighs forward first, then knees bent back so the shins hang straight
  // down again — the knee angle is measured after the hip has moved.
  const hipL = hingeDelta(bones.upperLegL, HIP_ANGLE);
  const hipR = hingeDelta(bones.upperLegR, HIP_ANGLE);
  bones.upperLegL.quaternion.premultiply(hipL);
  bones.upperLegR.quaternion.premultiply(hipR);
  model.updateMatrixWorld(true);
  bones.lowerLegL.quaternion.premultiply(hingeDelta(bones.lowerLegL, KNEE_ANGLE));
  bones.lowerLegR.quaternion.premultiply(hingeDelta(bones.lowerLegR, KNEE_ANGLE));
  model.updateMatrixWorld(true);

  // Drop the figure so its hips land on the cushion, then centre it over
  // the chair rather than over wherever the rig's origin happens to be.
  // By the hips, not the bounding box: Box3 reads skinned meshes in their
  // bind pose and each model carries a different root transform, so
  // box-centring puts every character in a different spot on its chair.
  const hipWorld = new THREE.Vector3();
  bones.hips.getWorldPosition(hipWorld);
  model.position.y += SEAT_TOP_Y + 0.05 - hipWorld.y;
  model.updateMatrixWorld(true);

  bones.hips.getWorldPosition(hipWorld);
  model.position.x -= hipWorld.x;
  model.position.z -= hipWorld.z;
  return true;
}

// Returns a group straight away and fills it in once the model arrives, so
// the scene code can stay synchronous.
export function createCharacter(id) {
  const c = characterById(id);
  const group = new THREE.Group();
  loadModel(c.file).then((gltf) => {
    const model = cloneSkinned(gltf.scene);
    model.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });

    // A model that ships with its own seated animation gets to use it: real
    // mocap puts the arms, hands and weight where a person actually holds
    // them at a table, and keeps them alive between hands. The hand-built
    // bend below only bends legs — it has nothing to say about arms, which
    // is why a T-posed model sat down with its arms straight out.
    const clip = pickSeatedClip(gltf.animations);
    if (clip) {
      const bones = resolveRig(model);
      placeSeated(model);
      const mixer = new THREE.AnimationMixer(model);
      // Without this the clip's hips-position track drags the figure off
      // its chair to wherever the motion was captured — see rig.js.
      mixer.clipAction(withoutRootMotion(clip, bones.hips)).play();
      // Each figure is offset so a row of them doesn't breathe in unison.
      mixer.setTime(Math.random() * clip.duration);
      seatedMixers.add(mixer);
      group.userData.mixer = mixer;
    } else {
      sitDown(model);
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
