import * as THREE from 'three';

// A real casino chip is about 1.5in across — same 1-unit-=-1-foot scale as
// the table and cards (see card.js). Height is kept a bit chunkier than
// a real chip's ~0.13in for visibility, same stylization as the card's
// own overstated thickness.
export const CHIP_RADIUS = 0.065;
export const CHIP_HEIGHT = 0.02;

// Denomination ladder — explicit, high-contrast colors matching real chip
// conventions (not the low-res Kenney art this used to load).
export const DENOMINATIONS = [
  { value: 100, color: '#b5342a', dark: false },
  { value: 500, color: '#1f6fb2', dark: false },
  { value: 1000, color: '#1f7a4d', dark: false },
  { value: 5000, color: '#161616', dark: true },
];

function labelText(value) {
  return value >= 1000 ? `${value / 1000}K` : `${value}`;
}

// The bet-ladder buttons in the table screen's HTML HUD (src/app/table3dBridge.js)
// — and the physical chips tapped onto the felt when building a bet — use
// this same 6-step palette, one color per rung of roomLogic.js's
// chipLadderForTable (kept separate from the 4-value DENOMINATIONS above,
// which are for the fixed chips used in payout/collect animations).
export const LADDER_COLORS = ['#f6ecd9', '#c0392b', '#2b6ca8', '#1f7a4d', '#5b3a8a', '#161616'];
export const LADDER_DARK = [false, false, false, false, true, true];

const faceCache = new Map();
const sideCache = new Map();

function finalize(canvas) {
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 16;
  return texture;
}

function buildFaceCanvas(denom) {

  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const cx = size / 2, cy = size / 2, r = size / 2 - 4;

  ctx.fillStyle = denom.color;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();

  // Edge dashes, like real chip spots.
  const dashCount = 10;
  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  for (let i = 0; i < dashCount; i++) {
    const a0 = (i / dashCount) * Math.PI * 2;
    const a1 = a0 + (Math.PI * 2) / dashCount / 2;
    ctx.beginPath();
    ctx.arc(cx, cy, r, a0, a1);
    ctx.arc(cx, cy, r * 0.82, a1, a0, true);
    ctx.closePath();
    ctx.fill();
  }

  // Inner face, gold ring, center disc.
  ctx.fillStyle = denom.color;
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.74, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = '#eac35e';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.6, 0, Math.PI * 2);
  ctx.stroke();

  ctx.fillStyle = denom.dark ? '#1c0a05' : 'rgba(255,255,255,0.14)';
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.56, 0, Math.PI * 2);
  ctx.fill();

  ctx.save();
  ctx.translate(cx, cy - r * 0.32);
  ctx.rotate(0);
  ctx.font = `700 ${size * 0.05}px Georgia, serif`;
  ctx.fillStyle = '#eac35e';
  ctx.textAlign = 'center';
  ctx.globalAlpha = 0.85;
  ctx.fillText('NVGR', 0, 0);
  ctx.restore();

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `700 ${size * 0.19}px Georgia, serif`;
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = 'rgba(0,0,0,0.55)';
  ctx.lineWidth = 3;
  const label = labelText(denom.value);
  ctx.strokeText(label, cx, cy + r * 0.08);
  ctx.fillText(label, cx, cy + r * 0.08);

  return canvas;
}

// Two different denom objects can share a .value (a ladder chip and a
// fixed-denomination chip both worth 100, say) while using different
// colors — cache by value+color together, not value alone, or one would
// silently win and get reused for the other's texture.
function denomKey(denom) { return denom.value + ':' + denom.color; }

function getFaceEntry(denom) {
  const key = denomKey(denom);
  if (!faceCache.has(key)) {
    const canvas = buildFaceCanvas(denom);
    faceCache.set(key, { texture: finalize(canvas), dataURL: canvas.toDataURL() });
  }
  return faceCache.get(key);
}

function makeFaceTexture(denom) {
  return getFaceEntry(denom).texture;
}

// A data URL of the chip's face — used by the HTML bet bar (src/ui/betDemo.js)
// so its buttons show the exact same art as the in-scene chip meshes.
export function chipFaceDataURL(colorIndex) {
  const denom = DENOMINATIONS[colorIndex % DENOMINATIONS.length];
  return getFaceEntry(denom).dataURL;
}

// Same face art (color fill, dashed edge, gold ring, NVGR wordmark, baked-in
// value label), but for an arbitrary bet amount rather than one of the 4
// fixed on-table denominations — the real bet ladder (roomLogic.js's
// chipLadderForTable) is set by each table's own limits, so its buttons can
// show any value, not just 100/500/1000/5000. Used by table3dBridge.js so
// the betting buttons are the same designed chip, not a plain CSS circle.
export function chipButtonDataURL(value, colorIndex) {
  return getFaceEntry(ladderDenom(value, colorIndex)).dataURL;
}

function ladderDenom(value, colorIndex) {
  const i = colorIndex % LADDER_COLORS.length;
  return { value, color: LADDER_COLORS[i], dark: LADDER_DARK[i] };
}

function makeSideTexture(denom) {
  const key = denomKey(denom);
  if (sideCache.has(key)) return sideCache.get(key);

  const w = 256, h = 48;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = denom.color;
  ctx.fillRect(0, 0, w, h);
  const stripes = 8;
  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  for (let i = 0; i < stripes; i++) {
    ctx.fillRect((i / stripes) * w, 0, (w / stripes) * 0.45, h);
  }
  const texture = finalize(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  sideCache.set(key, texture);
  return texture;
}

// Chips get created constantly (every bet click, every payout stack) — one
// shared geometry and cached materials per denomination, same reasoning as
// card.js: every chip of a given denomination is visually identical, so
// there's no reason to allocate fresh geometry/materials each time.
let sharedGeometry = null;
function getGeometry() {
  if (!sharedGeometry) sharedGeometry = new THREE.CylinderGeometry(CHIP_RADIUS, CHIP_RADIUS, CHIP_HEIGHT, 32);
  return sharedGeometry;
}

const matCache = new Map();
function getMaterials(denom) {
  const key = denomKey(denom);
  if (!matCache.has(key)) {
    const topMat = new THREE.MeshStandardMaterial({ map: makeFaceTexture(denom), roughness: 0.4 });
    const sideMat = new THREE.MeshStandardMaterial({ map: makeSideTexture(denom), roughness: 0.5 });
    // CylinderGeometry material order: side, top, bottom
    matCache.set(key, [sideMat, topMat, topMat]);
  }
  return matCache.get(key);
}

function buildChipMesh(denom) {
  const mesh = new THREE.Mesh(getGeometry(), getMaterials(denom));
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.userData = { value: denom.value };
  return mesh;
}

export function createChip(colorIndex = 0) {
  return buildChipMesh(DENOMINATIONS[colorIndex % DENOMINATIONS.length]);
}

// A physical chip mesh for an arbitrary bet-ladder amount (see LADDER_COLORS
// above) — used when tapping a bet-ladder button spawns a real chip on the
// felt, so the amount shown baked into the chip's face always matches what
// was actually tapped, not just one of the 4 fixed on-table denominations.
export function createChipForValue(value, colorIndex = 0) {
  return buildChipMesh(ladderDenom(value, colorIndex));
}

// A short stack of chips, stood on the table at the group's origin.
export function createChipStack(count = 4, colorIndex = 0) {
  const group = new THREE.Group();
  for (let i = 0; i < count; i++) {
    const chip = createChip(colorIndex);
    chip.position.y = CHIP_HEIGHT * i + CHIP_HEIGHT / 2;
    group.add(chip);
  }
  return group;
}
