import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { drawCasinoCrest } from './crest.js';
import { m } from './scale.js';

// Playing cards, made the way casino cards are.
//
// Proportions are a real poker-size card (63.5 x 88.9 mm), drawn 1.65x life
// size: true size is unreadable from a chair two metres away, but the old
// 1.9x — on a square-cornered box — read as a tile rather than a card. The
// corners are rounded in the geometry itself, and the faces carry what a
// dealt casino card carries: large corner indices, the traditional pip
// layout for 2–10, framed court cards, and a white-bordered back.
//
// Every suit is drawn as a vector shape, never a font glyph. The ♥ ♦ ♠ ♣
// characters render differently from one system to the next — as emoji on
// some — so a card's own symbols could change from one player to another.
const CARD_SCALE = 1.65;
export const CARD_WIDTH = m(0.0635) * CARD_SCALE;
export const CARD_HEIGHT = m(0.0889) * CARD_SCALE;
export const CARD_THICKNESS = 0.006;
const CORNER_R = CARD_WIDTH * 0.06;

const TEX_W = 560;
const TEX_H = Math.round(TEX_W * (88.9 / 63.5));

const RED = '#c4122f';
const BLACK = '#17171b';
const STOCK = '#fcfbf7';
const GOLD = '#b8913f';
const isRed = (suit) => suit === 'H' || suit === 'D';

// ---------- suit shapes ----------
// Each draws and fills one suit centred on (0, 0), `s` tall. Clubs and
// spades fill part by part: their lobes and stems overlap, and filling the
// overlap as one path would cut holes where the windings disagree.
function heart(ctx, s) {
  ctx.beginPath();
  ctx.moveTo(0, 0.42 * s);
  ctx.bezierCurveTo(-0.62 * s, 0.02 * s, -0.56 * s, -0.48 * s, -0.27 * s, -0.48 * s);
  ctx.bezierCurveTo(-0.11 * s, -0.48 * s, 0, -0.36 * s, 0, -0.25 * s);
  ctx.bezierCurveTo(0, -0.36 * s, 0.11 * s, -0.48 * s, 0.27 * s, -0.48 * s);
  ctx.bezierCurveTo(0.56 * s, -0.48 * s, 0.62 * s, 0.02 * s, 0, 0.42 * s);
  ctx.fill();
}
function diamond(ctx, s) {
  ctx.beginPath();
  ctx.moveTo(0, -0.5 * s);
  ctx.quadraticCurveTo(0.16 * s, -0.2 * s, 0.4 * s, 0);
  ctx.quadraticCurveTo(0.16 * s, 0.2 * s, 0, 0.5 * s);
  ctx.quadraticCurveTo(-0.16 * s, 0.2 * s, -0.4 * s, 0);
  ctx.quadraticCurveTo(-0.16 * s, -0.2 * s, 0, -0.5 * s);
  ctx.fill();
}
function stem(ctx, s) {
  ctx.beginPath();
  ctx.moveTo(-0.035 * s, 0.08 * s);
  ctx.quadraticCurveTo(-0.04 * s, 0.36 * s, -0.19 * s, 0.5 * s);
  ctx.lineTo(0.19 * s, 0.5 * s);
  ctx.quadraticCurveTo(0.04 * s, 0.36 * s, 0.035 * s, 0.08 * s);
  ctx.closePath();
  ctx.fill();
}
function spade(ctx, s) {
  ctx.beginPath();
  ctx.moveTo(0, -0.5 * s);
  ctx.bezierCurveTo(0.62 * s, -0.08 * s, 0.56 * s, 0.34 * s, 0.27 * s, 0.34 * s);
  ctx.bezierCurveTo(0.11 * s, 0.34 * s, 0, 0.24 * s, 0, 0.14 * s);
  ctx.bezierCurveTo(0, 0.24 * s, -0.11 * s, 0.34 * s, -0.27 * s, 0.34 * s);
  ctx.bezierCurveTo(-0.56 * s, 0.34 * s, -0.62 * s, -0.08 * s, 0, -0.5 * s);
  ctx.fill();
  stem(ctx, s);
}
function club(ctx, s) {
  const r = 0.205 * s;
  [[0, -0.27], [-0.235, 0.05], [0.235, 0.05]].forEach(([x, y]) => {
    ctx.beginPath();
    ctx.arc(x * s, y * s, r, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.beginPath();
  ctx.arc(0, -0.02 * s, 0.12 * s, 0, Math.PI * 2);
  ctx.fill();
  stem(ctx, s);
}
const SUIT_DRAW = { H: heart, D: diamond, S: spade, C: club };

function pip(ctx, suit, x, y, size, flipped = false) {
  ctx.save();
  ctx.translate(x, y);
  if (flipped) ctx.rotate(Math.PI);
  SUIT_DRAW[suit](ctx, size);
  ctx.restore();
}

// ---------- faces ----------
// Pip positions for 2–10 as [column, row]: columns are left/centre/right,
// rows run 0 (top) to 1 (bottom) across the pip field. Pips below the
// middle are printed upside down, as on every real card.
const L = 0.345, C = 0.5, R = 0.655;
const PIPS = {
  2: [[C, 0], [C, 1]],
  3: [[C, 0], [C, 0.5], [C, 1]],
  4: [[L, 0], [R, 0], [L, 1], [R, 1]],
  5: [[L, 0], [R, 0], [C, 0.5], [L, 1], [R, 1]],
  6: [[L, 0], [R, 0], [L, 0.5], [R, 0.5], [L, 1], [R, 1]],
  7: [[L, 0], [R, 0], [C, 0.25], [L, 0.5], [R, 0.5], [L, 1], [R, 1]],
  8: [[L, 0], [R, 0], [C, 0.25], [L, 0.5], [R, 0.5], [C, 0.75], [L, 1], [R, 1]],
  9: [[L, 0], [R, 0], [L, 1 / 3], [R, 1 / 3], [C, 0.5], [L, 2 / 3], [R, 2 / 3], [L, 1], [R, 1]],
  10: [[L, 0], [R, 0], [C, 1 / 6], [L, 1 / 3], [R, 1 / 3], [L, 2 / 3], [R, 2 / 3], [C, 5 / 6], [L, 1], [R, 1]],
};
const PIP_TOP = 0.2;
const PIP_BOTTOM = 0.8;

// The corner index: rank over suit, top-left, and again rotated at
// bottom-right. Jumbo, the way casino decks are cut — a dealt card is read
// by its corner, from across the table.
function cornerIndex(ctx, rank, suit, color) {
  const draw = () => {
    ctx.fillStyle = color;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.save();
    ctx.translate(TEX_W * 0.125, TEX_H * 0.19);
    // Narrowed the way card indices are cut; "10" more so, to fit.
    ctx.scale(rank === '10' ? 0.62 : 0.86, 1);
    ctx.font = `700 ${TEX_H * 0.19}px Inter, 'Helvetica Neue', Arial, sans-serif`;
    ctx.fillText(rank, 0, 0);
    ctx.restore();
    pip(ctx, suit, TEX_W * 0.125, TEX_H * 0.285, TEX_H * 0.1);
  };
  ctx.save(); draw(); ctx.restore();
  ctx.save();
  ctx.translate(TEX_W, TEX_H);
  ctx.rotate(Math.PI);
  draw();
  ctx.restore();
}

function numberFace(ctx, rank, suit) {
  if (rank === 'A') {
    pip(ctx, suit, TEX_W / 2, TEX_H / 2, TEX_W * (suit === 'S' ? 0.5 : 0.4));
    return;
  }
  const size = TEX_W * 0.17;
  PIPS[rank].forEach(([cx, row]) => {
    const y = TEX_H * (PIP_TOP + (PIP_BOTTOM - PIP_TOP) * row);
    pip(ctx, suit, TEX_W * cx, y, size, row > 0.5);
  });
}

// Court-card emblems, drawn in gold over the rank: a crown for the King, a
// coronet for the Queen, a plume for the Jack.
function courtEmblem(ctx, rank, x, y, w) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = GOLD;
  ctx.strokeStyle = 'rgba(60,40,10,0.55)';
  ctx.lineWidth = w * 0.025;
  ctx.beginPath();
  if (rank === 'K') {
    ctx.moveTo(-w / 2, w * 0.3);
    ctx.lineTo(-w / 2, -w * 0.18);
    ctx.lineTo(-w * 0.25, w * 0.06);
    ctx.lineTo(0, -w * 0.3);
    ctx.lineTo(w * 0.25, w * 0.06);
    ctx.lineTo(w / 2, -w * 0.18);
    ctx.lineTo(w / 2, w * 0.3);
    ctx.closePath();
  } else if (rank === 'Q') {
    ctx.moveTo(-w * 0.42, w * 0.28);
    ctx.quadraticCurveTo(-w * 0.46, -w * 0.02, -w * 0.3, -w * 0.12);
    ctx.quadraticCurveTo(-w * 0.15, w * 0.04, 0, -w * 0.22);
    ctx.quadraticCurveTo(w * 0.15, w * 0.04, w * 0.3, -w * 0.12);
    ctx.quadraticCurveTo(w * 0.46, -w * 0.02, w * 0.42, w * 0.28);
    ctx.closePath();
  } else {
    ctx.moveTo(-w * 0.08, w * 0.32);
    ctx.bezierCurveTo(-w * 0.42, w * 0.02, -w * 0.18, -w * 0.3, w * 0.3, -w * 0.34);
    ctx.bezierCurveTo(w * 0.06, -w * 0.16, w * 0.2, w * 0.1, -w * 0.08, w * 0.32);
    ctx.closePath();
  }
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function courtFace(ctx, rank, suit, color) {
  const x0 = TEX_W * 0.255, x1 = TEX_W * 0.745;
  const y0 = TEX_H * 0.1, y1 = TEX_H * 0.9;
  const w = x1 - x0, h = y1 - y0;

  // The court panel: a warm ground with a faint hatching in the suit's
  // colour, inside a double frame.
  ctx.fillStyle = '#f6f0e4';
  ctx.fillRect(x0, y0, w, h);
  ctx.save();
  ctx.beginPath();
  ctx.rect(x0, y0, w, h);
  ctx.clip();
  ctx.strokeStyle = isRed(suit) ? 'rgba(196,18,47,0.07)' : 'rgba(23,23,27,0.07)';
  ctx.lineWidth = 2;
  for (let d = -h; d < w + h; d += 14) {
    ctx.beginPath();
    ctx.moveTo(x0 + d, y0);
    ctx.lineTo(x0 + d - h, y1);
    ctx.stroke();
  }
  ctx.restore();
  ctx.strokeStyle = color;
  ctx.lineWidth = 4;
  ctx.strokeRect(x0, y0, w, h);
  ctx.strokeStyle = GOLD;
  ctx.lineWidth = 2;
  ctx.strokeRect(x0 + 9, y0 + 9, w - 18, h - 18);

  // Double-ended, like every court card: the top half, then the same again
  // turned about the centre.
  const half = () => {
    const cx = TEX_W / 2;
    courtEmblem(ctx, rank, cx, TEX_H * 0.2, w * 0.36);
    ctx.fillStyle = color;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.font = `700 ${TEX_H * 0.17}px Cinzel, Georgia, serif`;
    ctx.fillText(rank, cx, TEX_H * 0.39);
    pip(ctx, suit, cx, TEX_H * 0.445, TEX_W * 0.1);
  };
  ctx.save(); half(); ctx.restore();
  ctx.save();
  ctx.translate(TEX_W, TEX_H);
  ctx.rotate(Math.PI);
  half();
  ctx.restore();

  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x0 + 20, TEX_H / 2);
  ctx.lineTo(x1 - 20, TEX_H / 2);
  ctx.stroke();
}

function finalizeTexture(canvas) {
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

const faceTextures = new Map();
function makeFaceTexture(rank, suit) {
  const key = rank + '-' + suit;
  if (faceTextures.has(key)) return faceTextures.get(key);

  const canvas = document.createElement('canvas');
  canvas.width = TEX_W;
  canvas.height = TEX_H;
  const ctx = canvas.getContext('2d');
  const color = isRed(suit) ? RED : BLACK;

  ctx.fillStyle = STOCK;
  ctx.fillRect(0, 0, TEX_W, TEX_H);

  if (rank === 'J' || rank === 'Q' || rank === 'K') courtFace(ctx, rank, suit, color);
  else {
    ctx.fillStyle = color;
    numberFace(ctx, rank, suit);
  }
  cornerIndex(ctx, rank, suit, color);

  const texture = finalizeTexture(canvas);
  faceTextures.set(key, texture);
  return texture;
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
  if (!faceMaterials.has(key)) faceMaterials.set(key, cardMaterial(makeFaceTexture(rank, suit)));
  return faceMaterials.get(key);
}

let backMaterial = null;
let edgeMaterial = null;

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
