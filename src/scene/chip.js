import * as THREE from 'three';

// A real casino chip is about 1.5in across — same 1-unit-=-1-foot scale as
// the table and cards (see card.js). Height is kept a bit chunkier than
// a real chip's ~0.13in for visibility, same stylization as the card's
// own overstated thickness.
export const CHIP_RADIUS = 0.065;
export const CHIP_HEIGHT = 0.02;

// Denomination ladder — explicit, high-contrast colors matching real chip
// conventions (not the low-res Kenney art this used to load).
// Bright, saturated casino colours — the earlier ones were dusty enough to
// read as brown and grey under the table's warm light.
export const DENOMINATIONS = [
  { value: 100, color: '#e3262f', dark: false },
  { value: 500, color: '#1e7fe0', dark: false },
  { value: 1000, color: '#17a34a', dark: false },
  { value: 5000, color: '#8b2fd6', dark: false },
];

function labelText(value) {
  return value >= 1000 ? `${value / 1000}K` : `${value}`;
}

// The bet-ladder buttons in the table screen's HTML HUD (src/app/table3dBridge.js)
// — and the physical chips tapped onto the felt when building a bet — use
// this same 6-step palette, one color per rung of roomLogic.js's
// chipLadderForTable (kept separate from the 4-value DENOMINATIONS above,
// which are for the fixed chips used in payout/collect animations).
export const LADDER_COLORS = ['#f4f1ea', '#e3262f', '#1e7fe0', '#17a34a', '#ff8a1c', '#8b2fd6'];
// The white chip carries dark lettering; every other one white.
export const LADDER_DARK = [true, false, false, false, false, false];

const faceCache = new Map();
const sideCache = new Map();

function finalize(canvas) {
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 16;
  return texture;
}

// Mixes a hex colour toward white by `t`.
function tint(hex, t) {
  const n = parseInt(hex.slice(1), 16);
  const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => Math.round(v + (255 - v) * t));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}

// The face of a casino chip: a bright clay body with six white inserts
// round the edge, a dashed inner ring, and the value large in the middle.
function buildFaceCanvas(denom) {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const cx = size / 2, cy = size / 2, r = size / 2 - 3;
  const ink = denom.dark ? '#2a2420' : '#ffffff';
  const insert = denom.dark ? '#c9302c' : '#ffffff';

  ctx.fillStyle = denom.color;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();

  // Edge inserts.
  const inserts = 6;
  ctx.fillStyle = insert;
  for (let i = 0; i < inserts; i++) {
    const a0 = (i / inserts) * Math.PI * 2 - 0.2;
    const a1 = a0 + 0.4;
    ctx.beginPath();
    ctx.arc(cx, cy, r, a0, a1);
    ctx.arc(cx, cy, r * 0.8, a1, a0, true);
    ctx.closePath();
    ctx.fill();
  }

  // Dashed inner ring, then the centre a shade lighter than the body.
  ctx.strokeStyle = ink;
  ctx.globalAlpha = 0.9;
  ctx.lineWidth = 4;
  ctx.setLineDash([10, 7]);
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.72, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.globalAlpha = 1;
  ctx.fillStyle = tint(denom.color, 0.14);
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.62, 0, Math.PI * 2);
  ctx.fill();

  if (denom.value) {
    const label = labelText(denom.value);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `800 ${size * (label.length > 3 ? 0.2 : 0.25)}px Inter, 'Helvetica Neue', Arial, sans-serif`;
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillText(label, cx + 2, cy + 4);
    ctx.fillStyle = ink;
    ctx.fillText(label, cx, cy + 2);
    // The house name, small, above and below the value.
    ctx.font = `700 ${size * 0.075}px Cinzel, Georgia, serif`;
    ctx.globalAlpha = 0.85;
    ctx.fillText('NVGR', cx, cy - size * 0.17);
    ctx.fillText('CASINO', cx, cy + size * 0.19);
    ctx.globalAlpha = 1;
  }
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
  const stripes = 6;
  ctx.fillStyle = denom.dark ? '#c9302c' : '#ffffff';
  for (let i = 0; i < stripes; i++) {
    ctx.fillRect((i / stripes) * w, 0, (w / stripes) * 0.38, h);
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

// Smooth clay with a soft sheen, and a little of its own colour added back
// as emission: in the salon's dim light the chips otherwise sank toward
// brown, and a chip's colour is how its value is read at a glance.
function chipMaterial(map) {
  return new THREE.MeshStandardMaterial({
    map, roughness: 0.32, metalness: 0, emissive: 0xffffff, emissiveMap: map, emissiveIntensity: 0.22,
  });
}

const matCache = new Map();
function getMaterials(denom) {
  const key = denomKey(denom);
  if (!matCache.has(key)) {
    const topMat = chipMaterial(makeFaceTexture(denom));
    const sideMat = chipMaterial(makeSideTexture(denom));
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

// A run of chips drawn as one solid cylinder, its edge pattern repeating
// once per chip, rather than as a mesh per chip — a rack holds hundreds,
// and every mesh is a draw call. The faces show on the ends.
const runCache = new Map();
function stackSideTexture(denom, count) {
  const key = denomKey(denom) + ':' + count;
  if (runCache.has(key)) return runCache.get(key);
  const w = 256, h = 32;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = denom.color;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = denom.dark ? '#c9302c' : '#ffffff';
  for (let i = 0; i < 6; i++) ctx.fillRect((i / 6) * w, 0, (w / 6) * 0.38, h);
  // The seam between one chip and the next.
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.fillRect(0, h - 2, w, 2);
  const texture = finalize(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(1, count);
  runCache.set(key, texture);
  return texture;
}

function chipRun(denom, count) {
  const geometry = new THREE.CylinderGeometry(CHIP_RADIUS, CHIP_RADIUS, CHIP_HEIGHT * count, 32, 1);
  const side = chipMaterial(stackSideTexture(denom, count));
  const face = getMaterials(denom)[1];
  const mesh = new THREE.Mesh(geometry, [side, face, face]);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

// A short stack of chips, stood on the table at the group's origin.
export function createChipStack(count = 4, colorIndex = 0) {
  const group = new THREE.Group();
  const run = chipRun(DENOMINATIONS[colorIndex % DENOMINATIONS.length], count);
  run.position.y = (CHIP_HEIGHT * count) / 2;
  group.add(run);
  return group;
}

// A column of chips lying on their edges along local Z, as they sit in the
// tubes of a dealer's rack. `colorIndex` runs through the bet ladder's
// colours, so the rack holds every denomination the table plays.
export function createChipColumn(count, colorIndex) {
  const i = colorIndex % LADDER_COLORS.length;
  const run = chipRun({ value: 0, color: LADDER_COLORS[i], dark: LADDER_DARK[i] }, count);
  run.rotation.x = Math.PI / 2;
  return run;
}
