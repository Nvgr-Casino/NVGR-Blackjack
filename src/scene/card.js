import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { drawCasinoCrest } from './crest.js';
import { m } from './scale.js';

// Playing cards, made the way casino cards are.
//
// Proportions are a real poker-size card (63.5 x 88.9 mm), drawn 1.65x life
// size: true size is unreadable from a chair two metres away, but the old
// 1.9x — on a square-cornered box — read as a tile rather than a card. The
// corners are rounded in the geometry itself.
//
// The faces are Byron Knoll's Vector Playing Cards (public domain): the
// traditional English-pattern deck, court figures and all, rendered to
// WebP by scripts/build-cards.mjs. The back is the house's own.
const CARD_SCALE = 1.65;
export const CARD_WIDTH = m(0.0635) * CARD_SCALE;
export const CARD_HEIGHT = m(0.0889) * CARD_SCALE;
export const CARD_THICKNESS = 0.006;
const CORNER_R = CARD_WIDTH * 0.06;

const TEX_W = 640;
const TEX_H = Math.round(TEX_W * (88.9 / 63.5));
const STOCK = '#ffffff';

const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
const SUITS = ['S', 'H', 'D', 'C'];
export const cardFaceUrl = (rank, suit) => `${import.meta.env.BASE_URL}cards/${rank}-${suit}.webp`;

// Sharp at a glance is the whole point of a card, and a dealt card is
// read at a steep angle along the felt — the worst case for texture
// filtering. Full anisotropic filtering (three.js clamps 16 to what the GPU
// supports) keeps the indices crisp there instead of smearing them.
const ANISOTROPY = 16;

function finalizeTexture(canvas) {
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = ANISOTROPY;
  return texture;
}

const loader = new THREE.TextureLoader();
const faceTextures = new Map();
function getFaceTexture(rank, suit) {
  const key = rank + '-' + suit;
  if (!faceTextures.has(key)) {
    const texture = loader.load(cardFaceUrl(rank, suit));
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = ANISOTROPY;
    faceTextures.set(key, texture);
  }
  return faceTextures.get(key);
}

/**
 * Pulls the whole deck into the browser's cache, quietly, so a card's face
 * is already local by the time it is first dealt. Only the files are
 * fetched — nothing is decoded or sent to the GPU until a card is used.
 */
let prefetched = false;
export function prefetchCardFaces() {
  if (prefetched) return;
  prefetched = true;
  const urls = RANKS.flatMap((r) => SUITS.map((s) => cardFaceUrl(r, s)));
  let i = 0;
  const next = () => {
    if (i >= urls.length) return;
    fetch(urls[i++], { priority: 'low' }).catch(() => {}).finally(next);
  };
  // Two at a time: enough to finish in a few seconds, few enough never to
  // compete with the table's own models.
  next(); next();
}

// The back: a white border round a fine lattice in the house burgundy, with
// the house mark in a medallion at the centre.
let backTexture = null;
function makeBackTexture() {
  if (backTexture) return backTexture;
  const canvas = document.createElement('canvas');
  canvas.width = TEX_W;
  canvas.height = TEX_H;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = STOCK;
  ctx.fillRect(0, 0, TEX_W, TEX_H);
  const inset = TEX_W * 0.06;
  const x0 = inset, y0 = inset, w = TEX_W - inset * 2, h = TEX_H - inset * 2;
  ctx.fillStyle = '#74202c';
  ctx.beginPath();
  ctx.roundRect(x0, y0, w, h, TEX_W * 0.03);
  ctx.fill();

  ctx.save();
  ctx.beginPath();
  ctx.roundRect(x0, y0, w, h, TEX_W * 0.03);
  ctx.clip();
  ctx.strokeStyle = 'rgba(248,238,222,0.26)';
  ctx.lineWidth = 2;
  const step = TEX_W * 0.05;
  for (let d = -h; d < w + h; d += step) {
    ctx.beginPath(); ctx.moveTo(x0 + d, y0); ctx.lineTo(x0 + d + h, y0 + h); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x0 + d, y0 + h); ctx.lineTo(x0 + d + h, y0); ctx.stroke();
  }
  ctx.restore();

  ctx.strokeStyle = 'rgba(248,238,222,0.55)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(x0 + 12, y0 + 12, w - 24, h - 24, TEX_W * 0.02);
  ctx.stroke();

  ctx.fillStyle = '#74202c';
  ctx.beginPath();
  ctx.ellipse(TEX_W / 2, TEX_H / 2, TEX_W * 0.26, TEX_W * 0.2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(248,238,222,0.7)';
  ctx.lineWidth = 3;
  ctx.stroke();
  drawCasinoCrest(ctx, { x: TEX_W / 2, y: TEX_H / 2, width: TEX_W * 0.34, alpha: 0.92, rgb: '248,238,222' });

  backTexture = finalizeTexture(canvas);
  return backTexture;
}

// ---------- geometry ----------
// One rounded card shared by every mesh: the face on top, the back below
// and the edge between them, as three material groups.
function roundedCardShape() {
  const w = CARD_WIDTH / 2, h = CARD_HEIGHT / 2, r = CORNER_R;
  const s = new THREE.Shape();
  s.moveTo(-w + r, -h);
  s.lineTo(w - r, -h);
  s.quadraticCurveTo(w, -h, w, -h + r);
  s.lineTo(w, h - r);
  s.quadraticCurveTo(w, h, w - r, h);
  s.lineTo(-w + r, h);
  s.quadraticCurveTo(-w, h, -w, h - r);
  s.lineTo(-w, -h + r);
  s.quadraticCurveTo(-w, -h, -w + r, -h);
  return s;
}

function capGeometry(shape, faceUp) {
  const g = new THREE.ShapeGeometry(shape, 6);
  const pos = g.attributes.position;
  const uv = g.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    uv.setXY(i, pos.getX(i) / CARD_WIDTH + 0.5, pos.getY(i) / CARD_HEIGHT + 0.5);
  }
  // Face up: shape +y runs to world -z, so the top of the artwork sits at
  // the card's -z end — the orientation every deal and reveal angle in the
  // game was tuned against. Face down is the mirror of that.
  g.rotateX(faceUp ? -Math.PI / 2 : Math.PI / 2);
  g.translate(0, (faceUp ? 1 : -1) * (CARD_THICKNESS / 2 + 0.0002), 0);
  return g.toNonIndexed();
}

let sharedGeometry = null;
function getGeometry() {
  if (sharedGeometry) return sharedGeometry;
  const shape = roundedCardShape();
  const edge = new THREE.ExtrudeGeometry(shape, { depth: CARD_THICKNESS, bevelEnabled: false, curveSegments: 6 });
  edge.rotateX(-Math.PI / 2);
  edge.translate(0, -CARD_THICKNESS / 2, 0);
  sharedGeometry = mergeGeometries([capGeometry(shape, true), capGeometry(shape, false), edge], true);
  return sharedGeometry;
}

// ---------- materials ----------
// Lit, so a card sits in the same light as the felt under it instead of
// glowing flat on top of it. A little of the artwork is added back as
// emission: under the warm overhead light white stock otherwise reads as
// tan, and a card has to be read at a glance.
function cardMaterial(map) {
  return new THREE.MeshLambertMaterial({ map, emissive: 0xffffff, emissiveMap: map, emissiveIntensity: 0.32 });
}

const faceMaterials = new Map();
function getFaceMaterial(rank, suit) {
  const key = rank + '-' + suit;
  if (!faceMaterials.has(key)) faceMaterials.set(key, cardMaterial(getFaceTexture(rank, suit)));
  return faceMaterials.get(key);
}

let backMaterial = null;
let edgeMaterial = null;

// The card back and the white stock edge, for things built out of many
// cards at once — the stacks in the shoe and the discard holder.
export function cardBackMaterial() {
  if (!backMaterial) backMaterial = cardMaterial(makeBackTexture());
  return backMaterial;
}
export function cardEdgeMaterial() {
  if (!edgeMaterial) edgeMaterial = new THREE.MeshLambertMaterial({ color: 0xefede6 });
  return edgeMaterial;
}

// A card lies flat with its face up (+Y) and back down (-Y), so a dealt
// card sits on the table with no extra rotation.
export function createCard(rank, suit) {
  if (!backMaterial) backMaterial = cardMaterial(makeBackTexture());
  if (!edgeMaterial) edgeMaterial = new THREE.MeshLambertMaterial({ color: 0xefede6 });
  const mesh = new THREE.Mesh(getGeometry(), [getFaceMaterial(rank, suit), backMaterial, edgeMaterial]);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.userData = { rank, suit };
  return mesh;
}
