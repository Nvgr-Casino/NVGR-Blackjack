import * as THREE from 'three';

// Seated player figures, built from primitives like everything else on this
// table (chairs, chips, the felt). Nothing here is downloaded — a preset is
// just a palette plus a silhouette, so adding a candidate is one entry in
// the list below rather than a new model to source and rig.

const SEAT_TOP_Y = -0.51; // matches createChair()'s cushion surface
const FLOOR_Y = -0.91;

// Hair shapes are what carry most of the silhouette at table distance, so
// the presets lean on them (and shoulder width) more than on facial detail,
// which is invisible from across the felt anyway.
export const CHARACTERS = [
  { id: 'ace', name: 'Ace', skin: 0xe8b98f, hair: 0x2b1b12, hairStyle: 'short', outfit: 0x1e3a5f, accent: 0xd9d3c7, build: 'broad' },
  { id: 'duchess', name: 'Duchess', skin: 0xf0c9a6, hair: 0x8a5a2b, hairStyle: 'long', outfit: 0x6d1f3f, accent: 0xeac35e, build: 'slim' },
  { id: 'bishop', name: 'Bishop', skin: 0x8d5a3c, hair: 0x14100e, hairStyle: 'bald', outfit: 0x23252b, accent: 0xc0392b, build: 'broad' },
  { id: 'scarlett', name: 'Scarlett', skin: 0xecc0a2, hair: 0x9c2116, hairStyle: 'bob', outfit: 0x7d1420, accent: 0xf6ecd9, build: 'slim' },
  { id: 'jade', name: 'Jade', skin: 0xd9a173, hair: 0x1a1a1f, hairStyle: 'bun', outfit: 0x14513f, accent: 0xeac35e, build: 'slim' },
  { id: 'baron', name: 'Baron', skin: 0xf2d3b3, hair: 0xb9b4ad, hairStyle: 'short', outfit: 0x3b2a4d, accent: 0xd4af52, build: 'broad' },
  { id: 'marlowe', name: 'Marlowe', skin: 0x6f4630, hair: 0x1b1512, hairStyle: 'fade', outfit: 0x2f4f4f, accent: 0xf6ecd9, build: 'broad' },
  { id: 'vega', name: 'Vega', skin: 0xe3b083, hair: 0x2d2136, hairStyle: 'long', outfit: 0x402a5e, accent: 0xa8c6ff, build: 'slim' },
];

export const DEFAULT_CHARACTER = CHARACTERS[0].id;

export function characterById(id) {
  return CHARACTERS.find((c) => c.id === id) || CHARACTERS[0];
}

// Everyone would otherwise open the game as the same person, so a player
// with no choice saved yet gets one picked from their id.
export function defaultCharacterFor(key) {
  if (!key) return DEFAULT_CHARACTER;
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return CHARACTERS[h % CHARACTERS.length].id;
}

function addHair(group, c, headY, headR) {
  const mat = new THREE.MeshLambertMaterial({ color: c.hair });
  if (c.hairStyle === 'bald') return;

  if (c.hairStyle === 'fade') {
    const cap = new THREE.Mesh(new THREE.SphereGeometry(headR * 1.02, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.42), mat);
    cap.position.set(0, headY + 0.005, 0);
    group.add(cap);
    return;
  }

  const cap = new THREE.Mesh(new THREE.SphereGeometry(headR * 1.06, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.58), mat);
  cap.position.set(0, headY + 0.01, 0);
  group.add(cap);

  if (c.hairStyle === 'long') {
    const fall = new THREE.Mesh(new THREE.BoxGeometry(headR * 1.9, headR * 2.4, headR * 0.7), mat);
    fall.position.set(0, headY - headR * 0.9, -headR * 0.72);
    group.add(fall);
  } else if (c.hairStyle === 'bob') {
    const fall = new THREE.Mesh(new THREE.BoxGeometry(headR * 2.0, headR * 1.2, headR * 1.4), mat);
    fall.position.set(0, headY - headR * 0.5, -headR * 0.25);
    group.add(fall);
  } else if (c.hairStyle === 'bun') {
    const bun = new THREE.Mesh(new THREE.SphereGeometry(headR * 0.5, 10, 8), mat);
    bun.position.set(0, headY + headR * 0.5, -headR * 0.95);
    group.add(bun);
  }
}

// A seated figure facing local +Z — the same direction seats.js's
// facingAngle turns a chair to face the table.
export function createCharacter(id) {
  const c = characterById(id);
  const group = new THREE.Group();

  const skinMat = new THREE.MeshLambertMaterial({ color: c.skin });
  const outfitMat = new THREE.MeshLambertMaterial({ color: c.outfit });
  const accentMat = new THREE.MeshLambertMaterial({ color: c.accent });

  const broad = c.build === 'broad';
  const shoulderW = broad ? 0.42 : 0.34;
  const torsoW = broad ? 0.34 : 0.29;
  const torsoH = 0.5;
  const hipY = SEAT_TOP_Y + 0.09;
  const torsoY = hipY + torsoH / 2;

  const torso = new THREE.Mesh(new THREE.BoxGeometry(torsoW, torsoH, 0.22), outfitMat);
  torso.position.set(0, torsoY, -0.02);
  torso.castShadow = true;
  group.add(torso);

  // Shoulder bar reads as a jacket line and widens the silhouette.
  const shoulders = new THREE.Mesh(new THREE.BoxGeometry(shoulderW, 0.12, 0.24), outfitMat);
  shoulders.position.set(0, torsoY + torsoH / 2 - 0.03, -0.02);
  shoulders.castShadow = true;
  group.add(shoulders);

  // Collar/lapel flash in the accent colour, the one bit of the outfit
  // that reads as individual from across the table.
  const collar = new THREE.Mesh(new THREE.BoxGeometry(torsoW * 0.34, 0.18, 0.06), accentMat);
  collar.position.set(0, torsoY + torsoH / 2 - 0.11, 0.1);
  group.add(collar);

  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.055, 0.08, 10), skinMat);
  neck.position.set(0, torsoY + torsoH / 2 + 0.03, -0.02);
  group.add(neck);

  const headR = 0.13;
  const headY = torsoY + torsoH / 2 + 0.14;
  const head = new THREE.Mesh(new THREE.SphereGeometry(headR, 16, 12), skinMat);
  head.position.set(0, headY, -0.02);
  head.castShadow = true;
  group.add(head);
  addHair(group, c, headY, headR);

  // Arms angle down and forward so the hands finish near the felt, where a
  // seated player's would be.
  [-1, 1].forEach((side) => {
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.34, 0.1), outfitMat);
    arm.position.set(side * (shoulderW / 2 - 0.03), torsoY + 0.06, 0.02);
    arm.rotation.x = -0.5;
    arm.castShadow = true;
    group.add(arm);

    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.052, 10, 8), skinMat);
    hand.position.set(side * (shoulderW / 2 - 0.03), torsoY - 0.11, 0.19);
    group.add(hand);
  });

  // Thighs forward, shins down — the shape that makes it read as sitting
  // rather than standing behind the chair.
  [-1, 1].forEach((side) => {
    const thigh = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.13, 0.34), outfitMat);
    thigh.position.set(side * 0.1, hipY - 0.03, 0.14);
    thigh.castShadow = true;
    group.add(thigh);

    const shinH = SEAT_TOP_Y + 0.04 - FLOOR_Y;
    const shin = new THREE.Mesh(new THREE.BoxGeometry(0.12, shinH, 0.13), outfitMat);
    shin.position.set(side * 0.1, FLOOR_Y + shinH / 2, 0.28);
    group.add(shin);

    const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.06, 0.2), accentMat);
    shoe.position.set(side * 0.1, FLOOR_Y + 0.03, 0.34);
    group.add(shoe);
  });

  return group;
}

// The same character drawn flat, for the HTML side (seat pills, friends
// list, the picker) so a player looks the same in the lists as at the felt.
const portraitCache = new Map();
export function characterPortraitDataURL(id, size = 96) {
  const key = id + ':' + size;
  if (portraitCache.has(key)) return portraitCache.get(key);
  const c = characterById(id);
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const hex = (n) => '#' + n.toString(16).padStart(6, '0');
  const cx = size / 2;

  ctx.fillStyle = hex(c.outfit);
  ctx.beginPath();
  ctx.arc(cx, cx, size / 2, 0, Math.PI * 2);
  ctx.fill();

  // Shoulders
  ctx.fillStyle = hex(c.accent);
  ctx.beginPath();
  ctx.ellipse(cx, size * 0.98, size * 0.34, size * 0.26, 0, 0, Math.PI * 2);
  ctx.fill();

  const headR = size * 0.22;
  const headY = size * 0.47;

  if (c.hairStyle === 'long' || c.hairStyle === 'bob') {
    ctx.fillStyle = hex(c.hair);
    ctx.beginPath();
    ctx.ellipse(cx, headY + headR * 0.35, headR * 1.32, headR * (c.hairStyle === 'long' ? 1.6 : 1.25), 0, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = hex(c.skin);
  ctx.beginPath();
  ctx.arc(cx, headY, headR, 0, Math.PI * 2);
  ctx.fill();

  if (c.hairStyle !== 'bald') {
    ctx.fillStyle = hex(c.hair);
    ctx.beginPath();
    ctx.arc(cx, headY, headR * (c.hairStyle === 'fade' ? 1.0 : 1.05), Math.PI, 0);
    ctx.fill();
    if (c.hairStyle === 'bun') {
      ctx.beginPath();
      ctx.arc(cx, headY - headR * 1.1, headR * 0.42, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  const texture = canvas.toDataURL();
  portraitCache.set(key, texture);
  return texture;
}
