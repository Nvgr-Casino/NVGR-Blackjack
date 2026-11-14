import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { m } from './scale.js';
import { createSymbolAtlas, symbolCell, ATLAS_COLS, ATLAS_ROWS, CELL } from './slotSymbols.js';
import { STRIPS, LINES, REELS, PAYS } from '../slots/rules.js';
import { LOGO_URL } from '../app/uiHelpers.js';

// A Crown Jewels slot machine, built as the high-limit cabinets on a real
// casino floor are: a lacquered black cabinet with gold inlay, a gold-framed
// reel window with five real reels turning behind glass, an arched topper
// with the house crest and the jackpot, a lit button deck, LED light pipes
// down the front edges, and a gold and onyx pull handle at the side.
//
// The machine stands on the floor at its own origin, its back at z = 0 and
// its face toward +z. Measurements are real ones, in metres (m()).

const PHONE = window.matchMedia('(pointer: coarse)').matches || window.innerWidth < 820;

// ---------- dimensions ----------
export const CAB_W = 0.74;          // cabinet width
const HOUSING_Y0 = 0.8, HOUSING_Y1 = 1.62, HOUSING_FRONT = 0.58, HOUSING_BACK = -0.14;
const WIN_W = 0.66, WIN_H = 0.37, WIN_Y = 1.22;
// Sixteen faces round a drum of 0.33 m: each face about as tall as the
// reel is wide, so a symbol sits square, and three show at a time over a
// gentle curve, as on a real reel, rather than a tight barrel.
const REEL_R = 0.33, REEL_W = 0.124, REEL_GAP = 0.01, PANELS = 16, STEP = (Math.PI * 2) / PANELS;
const REEL_Z = HOUSING_FRONT - 0.045 - REEL_R;
const reelX = (i) => (i - (REELS - 1) / 2) * (REEL_W + REEL_GAP);
// Where the player's eyes go: the middle of the reel window.
export const REEL_CENTER = { x: 0, y: WIN_Y, z: HOUSING_FRONT };
// The seat in front: where a chair stands, and the front of the deck.
export const SEAT_Z = 1.22;
export const DECK_FRONT = 0.745;

// ---------- shared materials (one set for every machine) ----------
let shared = null;
function materials() {
  if (shared) return shared;
  const lacquer = PHONE
    ? new THREE.MeshStandardMaterial({ color: 0x0d0c0f, roughness: 0.28, metalness: 0.2 })
    : new THREE.MeshPhysicalMaterial({ color: 0x0b0a0d, roughness: 0.24, metalness: 0.15, clearcoat: 1, clearcoatRoughness: 0.07 });
  const gold = new THREE.MeshStandardMaterial({ color: 0xd9b26a, roughness: 0.22, metalness: 1, envMapIntensity: 1.6 });
  const darkGold = new THREE.MeshStandardMaterial({ color: 0x9c7a3c, roughness: 0.35, metalness: 1, envMapIntensity: 1.3 });
  const chrome = new THREE.MeshStandardMaterial({ color: 0xe6e8ec, roughness: 0.08, metalness: 1, envMapIntensity: 2 });
  const onyx = PHONE
    ? new THREE.MeshStandardMaterial({ color: 0x060606, roughness: 0.12, metalness: 0.2 })
    : new THREE.MeshPhysicalMaterial({ color: 0x050505, roughness: 0.08, metalness: 0.1, clearcoat: 1, clearcoatRoughness: 0.03 });
  const matte = new THREE.MeshStandardMaterial({ color: 0x050506, roughness: 0.9, metalness: 0 });
  const blackGlass = new THREE.MeshStandardMaterial({ color: 0x07070a, roughness: 0.08, metalness: 0.4, envMapIntensity: 1.4 });

  // The reels' faces, from the painted atlas.
  const atlas = createSymbolAtlas();
  const tex = (canvas) => {
    const t = new THREE.CanvasTexture(canvas);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
    t.generateMipmaps = true;
    return t;
  };
  const sharpTex = tex(atlas.sharp), blurTex = tex(atlas.blur);
  atlas.onRepaint(() => { sharpTex.needsUpdate = true; blurTex.needsUpdate = true; });
  const reel = new THREE.MeshStandardMaterial({ map: sharpTex, emissiveMap: sharpTex, emissive: 0xffffff, emissiveIntensity: 0.42, roughness: 0.5, metalness: 0 });
  const reelBlur = new THREE.MeshStandardMaterial({ map: blurTex, emissiveMap: blurTex, emissive: 0xffffff, emissiveIntensity: 0.42, roughness: 0.5, metalness: 0 });

  // The glass over the reels: faint, with a streak of reflected light.
  const streak = canvasTexture(512, 512, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    const band = (x0, width, a) => {
      const g = ctx.createLinearGradient(x0, 0, x0 + width, 0);
      g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.5, `rgba(255,255,255,${a})`); g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.save(); ctx.translate(w / 2, h / 2); ctx.rotate(-0.5); ctx.translate(-w / 2, -h / 2);
      ctx.fillStyle = g; ctx.fillRect(x0, -h, width, h * 3); ctx.restore();
    };
    band(w * 0.12, w * 0.16, 0.1); band(w * 0.32, w * 0.05, 0.08); band(w * 0.72, w * 0.1, 0.05);
  });
  const glass = new THREE.MeshPhysicalMaterial({ map: streak, transparent: true, opacity: 1, roughness: 0.04, metalness: 0, clearcoat: 1, envMapIntensity: 2.2, depthWrite: false, color: 0xffffff });

  // The inner shadow round the reel window: darker toward the top and
  // bottom, where the reels curve away from the light.
  const vignette = canvasTexture(64, 256, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, 'rgba(0,0,0,0.92)'); g.addColorStop(0.16, 'rgba(0,0,0,0.35)'); g.addColorStop(0.32, 'rgba(0,0,0,0)');
    g.addColorStop(0.68, 'rgba(0,0,0,0)'); g.addColorStop(0.84, 'rgba(0,0,0,0.4)'); g.addColorStop(1, 'rgba(0,0,0,0.95)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  });
  const shade = new THREE.MeshBasicMaterial({ map: vignette, transparent: true, depthWrite: false, toneMapped: false });

  shared = { lacquer, gold, darkGold, chrome, onyx, matte, blackGlass, reel, reelBlur, glass, shade, atlas, sharpTex };
  return shared;
}
function canvasTexture(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}
const goldStops = (g) => {
  g.addColorStop(0, '#fff0c4'); g.addColorStop(0.22, '#e6c27a'); g.addColorStop(0.5, '#a97e32'); g.addColorStop(0.75, '#e2bd6e'); g.addColorStop(1, '#8a6224');
  return g;
};
const FONT = (w, px) => `${w} ${px}px Cinzel, "Cinzel", Georgia, serif`;

// ---------- the cabinet ----------
// The lower cabinet in side profile (z forward, y up), from the floor to
// the top of the button deck, extruded across the machine's width.
function lowerProfile() {
  const s = new THREE.Shape();
  s.moveTo(0.03, 0.07);
  s.lineTo(0.6, 0.07);
  s.lineTo(0.6, 0.64);
  s.lineTo(DECK_FRONT - 0.01, 0.715);
  s.quadraticCurveTo(DECK_FRONT + 0.004, 0.72, DECK_FRONT, 0.735);
  s.lineTo(DECK_FRONT - 0.005, 0.76);
  s.lineTo(0.585, 0.8);
  s.lineTo(0.03, 0.8);
  s.closePath();
  return s;
}
// A side panel's inlay: a fine gold line following the profile, inset.
function sidePanelTexture() {
  // Drawn over the profile's own coordinates: z 0 to 0.8, y 0 to 0.85 m.
  const PX = 1024, Z = 0.8, Y = 0.85;
  return canvasTexture(PX, Math.round((PX * Y) / Z), (ctx, w, h) => {
    const X = (z) => (z / Z) * w, Yp = (y) => h - (y / Y) * h;
    ctx.fillStyle = '#0b0a0d'; ctx.fillRect(0, 0, w, h);
    const g = ctx.createLinearGradient(0, 0, w, h);
    goldStops(g);
    ctx.strokeStyle = g; ctx.lineWidth = 5; ctx.lineJoin = 'round';
    const inset = [[0.07, 0.12], [0.55, 0.12], [0.55, 0.62], [0.69, 0.705], [0.555, 0.745], [0.07, 0.745]];
    ctx.beginPath(); inset.forEach(([z, y], i) => (i ? ctx.lineTo(X(z), Yp(y)) : ctx.moveTo(X(z), Yp(y)))); ctx.closePath(); ctx.stroke();
    ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(220,186,110,0.5)';
    const inner = [[0.095, 0.145], [0.525, 0.145], [0.525, 0.6], [0.645, 0.68], [0.54, 0.718], [0.095, 0.718]];
    ctx.beginPath(); inner.forEach(([z, y], i) => (i ? ctx.lineTo(X(z), Yp(y)) : ctx.moveTo(X(z), Yp(y)))); ctx.closePath(); ctx.stroke();
  });
}
// The upper housing's front, seen face on: a rounded slab with the reel
// window cut through it.
function housingShape() {
  const s = new THREE.Shape();
  const x0 = -CAB_W / 2 + 0.01, x1 = CAB_W / 2 - 0.01, y0 = HOUSING_Y0 + 0.01, y1 = HOUSING_Y1 - 0.01, r = 0.03;
  s.moveTo(x0 + r, y0); s.lineTo(x1 - r, y0); s.quadraticCurveTo(x1, y0, x1, y0 + r); s.lineTo(x1, y1 - r); s.quadraticCurveTo(x1, y1, x1 - r, y1);
  s.lineTo(x0 + r, y1); s.quadraticCurveTo(x0, y1, x0, y1 - r); s.lineTo(x0, y0 + r); s.quadraticCurveTo(x0, y0, x0 + r, y0);
  s.holes.push(roundedRectPath(-WIN_W / 2, WIN_Y - WIN_H / 2, WIN_W, WIN_H, 0.02));
  return s;
}
function roundedRectPath(x, y, w, h, r, ShapeClass = THREE.Path) {
  const p = new ShapeClass();
  p.moveTo(x + r, y); p.lineTo(x + w - r, y); p.quadraticCurveTo(x + w, y, x + w, y + r); p.lineTo(x + w, y + h - r); p.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  p.lineTo(x + r, y + h); p.quadraticCurveTo(x, y + h, x, y + h - r); p.lineTo(x, y + r); p.quadraticCurveTo(x, y, x + r, y);
  return p;
}
// The fascia's inlay: a gold pinstripe round its edge and round the window.
function fasciaTexture() {
  const W = CAB_W, H = HOUSING_Y1 - HOUSING_Y0;
  const PX = 1024;
  return canvasTexture(PX, Math.round((PX * H) / W), (ctx, w, h) => {
    const X = (x) => ((x + W / 2) / W) * w, Y = (y) => h - ((y - HOUSING_Y0) / H) * h, S = w / W;
    ctx.fillStyle = '#0b0a0d'; ctx.fillRect(0, 0, w, h);
    const g = goldStops(ctx.createLinearGradient(0, 0, w, h));
    ctx.strokeStyle = g; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.roundRect(X(-W / 2 + 0.03), Y(HOUSING_Y1 - 0.03), (W - 0.06) * S, (H - 0.06) * S, 0.02 * S); ctx.stroke();
    ctx.lineWidth = 1.2; ctx.strokeStyle = 'rgba(220,186,110,0.45)';
    ctx.beginPath(); ctx.roundRect(X(-W / 2 + 0.04), Y(HOUSING_Y1 - 0.04), (W - 0.08) * S, (H - 0.08) * S, 0.015 * S); ctx.stroke();
  });
}
// Maps an extruded shape's cap UVs (which are its own coordinates) onto a
// texture laid over the rectangle [x0, x1] × [y0, y1].
function fitCapUVs(geometry, x0, x1, y0, y1) {
  const uv = geometry.attributes.uv;
  const groups = geometry.groups;
  const cap = groups.find((g) => g.materialIndex === 0);
  if (!cap) return;
  const index = geometry.index;
  const seen = new Set();
  for (let i = cap.start; i < cap.start + cap.count; i++) {
    const v = index ? index.getX(i) : i;
    if (seen.has(v)) continue;
    seen.add(v);
    uv.setXY(v, (uv.getX(v) - x0) / (x1 - x0), (uv.getY(v) - y0) / (y1 - y0));
  }
  uv.needsUpdate = true;
}

// ---------- the reels ----------
// One reel: ten curved panels round a drum, in one geometry. A panel shows
// whichever symbol of the strip is due at its place as it comes round, so a
// drum of ten faces can carry a strip of thirty-four.
function createReel(index, mats) {
  const SEGS = 6;
  const per = (SEGS + 1) * 2;
  const pos = new Float32Array(PANELS * per * 3);
  const nor = new Float32Array(PANELS * per * 3);
  const uvs = new Float32Array(PANELS * per * 2);
  const idx = [];
  for (let j = 0; j < PANELS; j++) {
    for (let s = 0; s <= SEGS; s++) {
      const t = s / SEGS;
      const th = j * STEP + (t - 0.5) * STEP;
      for (let side = 0; side < 2; side++) {
        const v = j * per + s * 2 + side;
        const x = (side - 0.5) * REEL_W;
        pos.set([x, REEL_R * Math.sin(th), REEL_R * Math.cos(th)], v * 3);
        nor.set([0, Math.sin(th), Math.cos(th)], v * 3);
      }
      if (s < SEGS) {
        const a = j * per + s * 2;
        idx.push(a, a + 1, a + 3, a, a + 3, a + 2);
      }
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geo.setIndex(idx);
  const mesh = new THREE.Mesh(geo, mats.reel);
  const drum = new THREE.Group();
  drum.position.set(reelX(index), WIN_Y, REEL_Z);
  drum.add(mesh);
  // The drum's rims, dark, just inside each face's edge.
  const strip = STRIPS[index];
  const showing = new Array(PANELS).fill(-1);
  const half = 0.5 / (CELL * ATLAS_COLS); // half a texel, against bleeding
  function setPanel(j, k) {
    const n = strip.length;
    const sym = strip[((k % n) + n) % n];
    const cell = symbolCell(sym);
    if (showing[j] === cell) return;
    showing[j] = cell;
    const col = cell % ATLAS_COLS, row = Math.floor(cell / ATLAS_COLS);
    const u0 = col / ATLAS_COLS + half, u1 = (col + 1) / ATLAS_COLS - half;
    const vTop = 1 - row / ATLAS_ROWS - half, vBot = 1 - (row + 1) / ATLAS_ROWS + half;
    for (let s = 0; s <= SEGS; s++) {
      const t = s / SEGS;
      const v = vBot + (vTop - vBot) * t;
      const base = j * per + s * 2;
      uvs[base * 2] = u0; uvs[base * 2 + 1] = v;
      uvs[(base + 1) * 2] = u1; uvs[(base + 1) * 2 + 1] = v;
    }
    geo.attributes.uv.needsUpdate = true;
  }
  // p: the strip index showing in the top row (any real number). The
  // symbol k stands at angle (p - k + 1) steps above the middle row.
  let p = 0;
  function setPosition(next) {
    p = next;
    drum.rotation.x = -p * STEP;
    for (let j = 0; j < PANELS; j++) {
      // The strip index this panel carries now: of those ≡ 1 − j (mod 10),
      // the one nearest the middle row.
      const r = (((1 - j) % PANELS) + PANELS) % PANELS;
      const mid = p + 1;
      const k = r + PANELS * Math.round((mid - r) / PANELS);
      setPanel(j, k);
    }
  }
  setPosition(0);
  return {
    drum,
    get p() { return p; },
    setPosition,
    setBlur(on) { mesh.material = on ? mats.reelBlur : mats.reel; },
  };
}

// ---------- displays ----------
// A canvas the machine paints on and shows lit: the topper, the meters.
function display(w, h, px) {
  const c = document.createElement('canvas');
  c.width = px; c.height = Math.round((px * h) / w);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  const mat = new THREE.MeshBasicMaterial({ map: tex, toneMapped: false });
  return { canvas: c, ctx: c.getContext('2d'), tex, mat };
}
let logoImage = null;
const logoLoaded = new Promise((res) => {
  const img = new Image();
  img.onload = () => { logoImage = img; res(img); };
  img.onerror = () => res(null);
  img.src = LOGO_URL;
});
const fmt = (n) => Math.round(n).toLocaleString('en-US');

function paintTopper(d, bet) {
  const { ctx, canvas } = d;
  const w = canvas.width, h = canvas.height;
  ctx.clearRect(0, 0, w, h);
  const bg = ctx.createRadialGradient(w / 2, h * 0.32, 10, w / 2, h * 0.4, w * 0.7);
  bg.addColorStop(0, '#2a1a10'); bg.addColorStop(0.55, '#100b08'); bg.addColorStop(1, '#040303');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);
  // Rays fanning up behind the crest, faint.
  ctx.save(); ctx.translate(w / 2, h * 0.62);
  for (let k = -14; k <= 14; k++) {
    ctx.rotate(0);
    const a = -Math.PI / 2 + k * 0.1;
    const g = ctx.createLinearGradient(0, 0, Math.cos(a) * h, Math.sin(a) * h);
    g.addColorStop(0, 'rgba(232,190,110,0.16)'); g.addColorStop(1, 'rgba(232,190,110,0)');
    ctx.strokeStyle = g; ctx.lineWidth = k % 2 ? 2 : 5;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a) * h * 1.1, Math.sin(a) * h * 1.1); ctx.stroke();
  }
  ctx.restore();
  if (logoImage) {
    const s = h * 0.64;
    ctx.drawImage(logoImage, w / 2 - s / 2, h * 0.075, s, s);
  }
  // The jackpot, on a black panel in a gold frame.
  const py = h * 0.69, ph = h * 0.25, px = w * 0.12, pw = w * 0.76;
  ctx.fillStyle = goldStops(ctx.createLinearGradient(0, py, 0, py + ph));
  ctx.beginPath(); ctx.roundRect(px - 6, py - 6, pw + 12, ph + 12, 18); ctx.fill();
  ctx.fillStyle = '#070505'; ctx.beginPath(); ctx.roundRect(px, py, pw, ph, 14); ctx.fill();
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = FONT(700, ph * 0.24);
  if ('letterSpacing' in ctx) ctx.letterSpacing = '10px';
  ctx.fillStyle = '#c9a35a';
  ctx.fillText('GRAND JACKPOT', w / 2, py + ph * 0.25);
  if ('letterSpacing' in ctx) ctx.letterSpacing = '4px';
  ctx.font = FONT(900, ph * 0.48);
  const g = goldStops(ctx.createLinearGradient(0, py + ph * 0.42, 0, py + ph * 0.92));
  ctx.shadowColor = 'rgba(255,170,60,0.6)'; ctx.shadowBlur = 18;
  ctx.fillStyle = g;
  ctx.fillText(fmt(PAYS.wild[2] * (bet / LINES.length)), w / 2, py + ph * 0.66);
  ctx.shadowBlur = 0;
  d.tex.needsUpdate = true;
}
function paintTitle(d) {
  const { ctx, canvas } = d;
  const w = canvas.width, h = canvas.height;
  const bg = ctx.createLinearGradient(0, 0, 0, h);
  bg.addColorStop(0, '#0a0808'); bg.addColorStop(1, '#151010');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = FONT(900, h * 0.42);
  if ('letterSpacing' in ctx) ctx.letterSpacing = `${Math.round(h * 0.08)}px`;
  ctx.shadowColor = 'rgba(255,170,60,0.55)'; ctx.shadowBlur = h * 0.18;
  ctx.fillStyle = goldStops(ctx.createLinearGradient(0, h * 0.2, 0, h * 0.8));
  ctx.fillText('CROWN JEWELS', w / 2 + h * 0.05, h * 0.56);
  ctx.shadowBlur = 0;
  // Filigree either side.
  const line = (x0, x1) => {
    const g = goldStops(ctx.createLinearGradient(x0, 0, x1, 0));
    ctx.strokeStyle = g; ctx.lineWidth = h * 0.04;
    ctx.beginPath(); ctx.moveTo(x0, h * 0.55); ctx.lineTo(x1, h * 0.55); ctx.stroke();
    ctx.fillStyle = '#c4203a';
    const cx = x1 > x0 ? x1 : x1;
    ctx.beginPath(); ctx.moveTo(cx, h * 0.38); ctx.lineTo(cx + h * 0.12, h * 0.55); ctx.lineTo(cx, h * 0.72); ctx.lineTo(cx - h * 0.12, h * 0.55); ctx.closePath(); ctx.fill();
  };
  line(w * 0.02, w * 0.09); line(w * 0.98, w * 0.91);
  d.tex.needsUpdate = true;
}
function paintMeters(d, { credit, bet, win, note }) {
  const { ctx, canvas } = d;
  const w = canvas.width, h = canvas.height;
  ctx.fillStyle = '#040405'; ctx.fillRect(0, 0, w, h);
  const cell = (i, label, value, hot) => {
    const x = (i + 0.5) * (w / 3);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = `600 ${h * 0.2}px Inter, system-ui, sans-serif`;
    if ('letterSpacing' in ctx) ctx.letterSpacing = `${Math.round(h * 0.05)}px`;
    ctx.fillStyle = '#8f7a55';
    ctx.fillText(label, x, h * 0.27);
    if ('letterSpacing' in ctx) ctx.letterSpacing = '1px';
    ctx.font = `700 ${h * 0.4}px Inter, system-ui, sans-serif`;
    ctx.shadowColor = hot ? 'rgba(255,180,70,0.85)' : 'rgba(255,180,70,0.35)'; ctx.shadowBlur = hot ? h * 0.25 : h * 0.1;
    ctx.fillStyle = hot ? '#ffe2a0' : '#e8c27a';
    ctx.fillText(value, x, h * 0.66);
    ctx.shadowBlur = 0;
  };
  cell(0, 'CREDIT', fmt(credit));
  cell(1, 'BET', fmt(bet));
  cell(2, note || 'WIN', win ? fmt(win) : '—', !!win);
  ctx.strokeStyle = 'rgba(200,164,106,0.25)'; ctx.lineWidth = 2;
  [1, 2].forEach((k) => { ctx.beginPath(); ctx.moveTo((k * w) / 3, h * 0.18); ctx.lineTo((k * w) / 3, h * 0.82); ctx.stroke(); });
  d.tex.needsUpdate = true;
}
function paintBelly(d) {
  const { ctx, canvas } = d;
  const w = canvas.width, h = canvas.height;
  const bg = ctx.createRadialGradient(w / 2, h * 0.45, 10, w / 2, h / 2, w * 0.75);
  bg.addColorStop(0, '#1e1530'); bg.addColorStop(0.6, '#0b0914'); bg.addColorStop(1, '#030305');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);
  // An Art Deco frame.
  const g = goldStops(ctx.createLinearGradient(0, 0, w, h));
  ctx.strokeStyle = g; ctx.lineWidth = w * 0.012;
  ctx.strokeRect(w * 0.05, h * 0.04, w * 0.9, h * 0.92);
  ctx.lineWidth = w * 0.004;
  ctx.strokeRect(w * 0.08, h * 0.065, w * 0.84, h * 0.87);
  // Stepped corners.
  [[0.08, 0.065, 1, 1], [0.92, 0.065, -1, 1], [0.08, 0.935, 1, -1], [0.92, 0.935, -1, -1]].forEach(([x, y, sx, sy]) => {
    ctx.beginPath();
    ctx.moveTo(w * x, h * (y + sy * 0.12)); ctx.lineTo(w * (x + sx * 0.05), h * (y + sy * 0.12)); ctx.lineTo(w * (x + sx * 0.05), h * (y + sy * 0.06));
    ctx.lineTo(w * (x + sx * 0.1), h * (y + sy * 0.06)); ctx.lineTo(w * (x + sx * 0.1), h * y);
    ctx.stroke();
  });
  // The jewels, from the reels' own paintings.
  const src = shared.atlas.sharp;
  const cellPx = src.width / ATLAS_COLS;
  const draw = (sym, cx, cy, size) => {
    const i = symbolCell(sym);
    const sx = (i % ATLAS_COLS) * cellPx, sy = Math.floor(i / ATLAS_COLS) * cellPx;
    // Cut the symbol from its ground with a soft round mask.
    const tmp = document.createElement('canvas'); tmp.width = tmp.height = Math.round(size);
    const t = tmp.getContext('2d');
    t.drawImage(src, sx, sy, cellPx, cellPx, 0, 0, size, size);
    t.globalCompositeOperation = 'destination-in';
    const m = t.createRadialGradient(size / 2, size / 2, size * 0.3, size / 2, size / 2, size * 0.5);
    m.addColorStop(0, 'rgba(0,0,0,1)'); m.addColorStop(1, 'rgba(0,0,0,0)');
    t.fillStyle = m; t.fillRect(0, 0, size, size);
    ctx.drawImage(tmp, cx - size / 2, cy - size / 2);
  };
  draw('crown', w / 2, h * 0.4, h * 0.62);
  draw('ruby', w * 0.2, h * 0.52, h * 0.34);
  draw('sapphire', w * 0.8, h * 0.52, h * 0.34);
  draw('emerald', w * 0.32, h * 0.7, h * 0.26);
  draw('emerald', w * 0.68, h * 0.7, h * 0.26);
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = FONT(900, h * 0.1);
  if ('letterSpacing' in ctx) ctx.letterSpacing = `${Math.round(h * 0.03)}px`;
  ctx.shadowColor = 'rgba(0,0,0,0.8)'; ctx.shadowBlur = 10;
  ctx.fillStyle = goldStops(ctx.createLinearGradient(0, h * 0.76, 0, h * 0.88));
  ctx.fillText('CROWN JEWELS', w / 2 + h * 0.015, h * 0.83);
  ctx.shadowBlur = 0;
  d.tex.needsUpdate = true;
}
// A button's lit top: its words in gold on black glass.
function buttonLabel(text, wide) {
  return canvasTexture(wide ? 256 : 192, 128, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#1a1410'); g.addColorStop(1, '#070505');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(232,196,120,0.7)'; ctx.lineWidth = 4; ctx.strokeRect(6, 6, w - 12, h - 12);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = `700 ${h * 0.3}px Inter, system-ui, sans-serif`;
    if ('letterSpacing' in ctx) ctx.letterSpacing = '3px';
    ctx.shadowColor = 'rgba(255,190,80,0.9)'; ctx.shadowBlur = 12;
    ctx.fillStyle = '#ffd88e';
    ctx.fillText(text, w / 2, h * 0.54);
  });
}
const buttonTops = new Map();
function buttonTop(text) {
  if (!buttonTops.has(text)) {
    const label = buttonLabel(text, text.length > 5);
    buttonTops.set(text, new THREE.MeshStandardMaterial({ map: label, emissiveMap: label, emissive: 0xffffff, emissiveIntensity: 0.9, roughness: 0.25, metalness: 0.1 }));
  }
  return buttonTops.get(text);
}
function spinLabel() {
  return canvasTexture(256, 256, (ctx, w, h) => {
    const g = ctx.createRadialGradient(w * 0.42, h * 0.38, 10, w / 2, h / 2, w / 2);
    g.addColorStop(0, '#fff3cf'); g.addColorStop(0.45, '#f1c46a'); g.addColorStop(1, '#a8701e');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = FONT(900, h * 0.24);
    if ('letterSpacing' in ctx) ctx.letterSpacing = '6px';
    ctx.fillStyle = '#3a2208';
    ctx.fillText('SPIN', w / 2 + 3, h * 0.53);
  });
}
// The overlay just behind the glass where wins are drawn.
function paintWins(d, wins, scatter, phase) {
  const { ctx, canvas } = d;
  const w = canvas.width, h = canvas.height;
  ctx.clearRect(0, 0, w, h);
  if (!wins.length && !scatter) { d.tex.needsUpdate = true; return; }
  const colW = w / REELS, rowH = h / 3;
  const COLORS = ['#ffd36e', '#ff6b7f', '#6fd3ff', '#8dffa8', '#d39bff', '#ffa45c', '#ff8ad8', '#9ae6ff', '#ffe98a', '#b4ff6e'];
  const cellCenter = ([reel, row]) => [(reel + 0.5) * colW, (row + 0.5) * rowH];
  const show = phase === null ? wins : wins.filter((_, i) => i === phase % Math.max(1, wins.length));
  show.forEach((win) => {
    const color = COLORS[win.line % COLORS.length];
    // The whole line, faint, then the winning cells framed.
    const pts = LINES[win.line].map((row, reel) => [(reel + 0.5) * colW, (row + 0.5) * rowH]);
    ctx.save();
    ctx.strokeStyle = color; ctx.lineWidth = h * 0.014; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    ctx.shadowColor = color; ctx.shadowBlur = h * 0.04; ctx.globalAlpha = 0.9;
    ctx.beginPath(); ctx.moveTo(0, pts[0][1]); pts.forEach(([x, y]) => ctx.lineTo(x, y)); ctx.lineTo(w, pts[pts.length - 1][1]); ctx.stroke();
    ctx.restore();
    win.cells.forEach((c) => {
      const [x, y] = cellCenter(c);
      ctx.save();
      ctx.strokeStyle = color; ctx.lineWidth = h * 0.012; ctx.shadowColor = color; ctx.shadowBlur = h * 0.05;
      ctx.beginPath(); ctx.roundRect(x - colW * 0.44, y - rowH * 0.44, colW * 0.88, rowH * 0.88, h * 0.02); ctx.stroke();
      ctx.restore();
    });
  });
  if (scatter && (phase === null || phase % (wins.length + 1) === wins.length)) {
    scatter.cells.forEach((c) => {
      const [x, y] = cellCenter(c);
      ctx.save();
      ctx.strokeStyle = '#e6f2ff'; ctx.lineWidth = h * 0.012; ctx.shadowColor = '#9cc8ff'; ctx.shadowBlur = h * 0.06;
      ctx.beginPath(); ctx.roundRect(x - colW * 0.44, y - rowH * 0.44, colW * 0.88, rowH * 0.88, h * 0.02); ctx.stroke();
      ctx.restore();
    });
  }
  d.tex.needsUpdate = true;
}

// What every machine wears alike, painted once for the whole bank.
let dressed = null;
function decor() {
  if (dressed) return dressed;
  const mats = materials();
  const title = display(0.56, 0.1, 1024);
  paintTitle(title);
  const club = display(0.14, 0.04, 256);
  {
    const { ctx, canvas } = club;
    ctx.fillStyle = '#05070a'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = `700 ${canvas.height * 0.32}px Inter, system-ui, sans-serif`;
    ctx.fillStyle = '#e2c27a'; ctx.fillText('NVGR CLUB', canvas.width / 2, canvas.height * 0.36);
    ctx.font = `500 ${canvas.height * 0.22}px Inter, system-ui, sans-serif`;
    ctx.fillStyle = '#8fa6c2'; ctx.fillText('WELCOME', canvas.width / 2, canvas.height * 0.72);
    club.tex.needsUpdate = true;
  }
  const belly = display(0.36, 0.4, PHONE ? 512 : 768);
  const paintBellyNow = () => paintBelly(belly);
  paintBellyNow();
  mats.atlas.ready.then(paintBellyNow);
  const grilleTex = canvasTexture(128, 128, (ctx, w, h) => {
    ctx.fillStyle = '#0a0a0c'; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#000';
    for (let y = 6; y < h; y += 9) for (let x = 6 + ((y / 9) % 2) * 4.5; x < w; x += 9) { ctx.beginPath(); ctx.arc(x, y, 2.6, 0, Math.PI * 2); ctx.fill(); }
  });
  dressed = {
    side: new THREE.MeshStandardMaterial({ map: sidePanelTexture(), roughness: 0.25, metalness: 0.15 }),
    fascia: new THREE.MeshStandardMaterial({ map: fasciaTexture(), roughness: 0.22, metalness: 0.15 }),
    title, club, belly,
    grille: new THREE.MeshStandardMaterial({ map: grilleTex, roughness: 0.6, metalness: 0.5 }),
  };
  return dressed;
}

/** The painted symbols, for the pay table. */
export function symbolAtlas() { return materials().atlas; }

// ---------- the machine ----------
/**
 * One machine. `full` builds the player's own: its meters, win overlay and
 * handle respond; a neighbour's are dressed alike but simpler.
 */
export function createSlotMachine({ full = false } = {}) {
  const mats = materials();
  const root = new THREE.Group();
  const M = new THREE.Group();          // built in metres
  M.scale.setScalar(m(1));
  root.add(M);

  // The plinth, with a gold kick strip.
  const plinth = new THREE.Mesh(new THREE.BoxGeometry(CAB_W - 0.02, 0.07, 0.56), mats.lacquer);
  plinth.position.set(0, 0.035, 0.31);
  M.add(plinth);
  const kick = new THREE.Mesh(new THREE.BoxGeometry(CAB_W - 0.04, 0.012, 0.004), mats.gold);
  kick.position.set(0, 0.05, 0.592);
  M.add(kick);

  // The lower cabinet and button deck, in profile.
  const lowerGeo = new THREE.ExtrudeGeometry(lowerProfile(), { depth: CAB_W - 0.02, bevelEnabled: true, bevelThickness: 0.008, bevelSize: 0.008, bevelSegments: 3, curveSegments: 8 });
  fitCapUVs(lowerGeo, 0, 0.8, 0, 0.85);
  const lower = new THREE.Mesh(lowerGeo, [decor().side, mats.lacquer]);
  // The profile is drawn in (z, y): turn it so its x is the machine's z.
  lower.rotation.y = -Math.PI / 2;
  lower.position.set((CAB_W - 0.02) / 2, 0, 0);
  M.add(lower);

  // The upper housing, its fascia pierced by the reel window.
  const housingGeo = new THREE.ExtrudeGeometry(housingShape(), { depth: HOUSING_FRONT - 0.01 - HOUSING_BACK, bevelEnabled: true, bevelThickness: 0.01, bevelSize: 0.009, bevelSegments: 4, curveSegments: 10 });
  fitCapUVs(housingGeo, -CAB_W / 2, CAB_W / 2, HOUSING_Y0, HOUSING_Y1);
  const housing = new THREE.Mesh(housingGeo, [decor().fascia, mats.lacquer]);
  // Deep enough at the back to hold the drums.
  housing.position.z = HOUSING_BACK;
  M.add(housing);
  // Inside the window: a matte black well, and its back.
  const well = new THREE.Mesh(new THREE.PlaneGeometry(WIN_W + 0.04, WIN_H + 0.1), mats.matte);
  well.position.set(0, WIN_Y, HOUSING_BACK + 0.01);
  M.add(well);

  // The gold bezel round the window.
  const bezelShape = roundedRectPath(-WIN_W / 2 - 0.022, WIN_Y - WIN_H / 2 - 0.022, WIN_W + 0.044, WIN_H + 0.044, 0.03, THREE.Shape);
  bezelShape.holes.push(roundedRectPath(-WIN_W / 2 + 0.002, WIN_Y - WIN_H / 2 + 0.002, WIN_W - 0.004, WIN_H - 0.004, 0.02));
  const bezel = new THREE.Mesh(new THREE.ExtrudeGeometry(bezelShape, { depth: 0.012, bevelEnabled: true, bevelThickness: 0.006, bevelSize: 0.006, bevelSegments: 4, curveSegments: 10 }), mats.gold);
  bezel.position.z = HOUSING_FRONT - 0.002;
  M.add(bezel);

  // The reels.
  const reels = [];
  for (let i = 0; i < REELS; i++) {
    const r = createReel(i, mats);
    M.add(r.drum);
    reels.push(r);
  }
  // Fine gold rules between the reels, inside the glass.
  for (let i = 1; i < REELS; i++) {
    const rule = new THREE.Mesh(new THREE.BoxGeometry(0.003, WIN_H, 0.003), mats.darkGold);
    rule.position.set((reelX(i - 1) + reelX(i)) / 2, WIN_Y, HOUSING_FRONT - 0.03);
    M.add(rule);
  }
  // The shade over the window's top and bottom, the win overlay, the glass.
  const shadePlane = new THREE.Mesh(new THREE.PlaneGeometry(WIN_W, WIN_H), mats.shade);
  shadePlane.position.set(0, WIN_Y, HOUSING_FRONT - 0.026);
  shadePlane.renderOrder = 2;
  M.add(shadePlane);
  let winLayer = null;
  if (full) {
    winLayer = display(WIN_W, WIN_H, 1024);
    winLayer.mat.transparent = true;
    winLayer.mat.depthWrite = false;
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(WIN_W, WIN_H), winLayer.mat);
    plane.position.set(0, WIN_Y, HOUSING_FRONT - 0.022);
    plane.renderOrder = 3;
    M.add(plane);
  }
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(WIN_W + 0.01, WIN_H + 0.01), mats.glass);
  glass.position.set(0, WIN_Y, HOUSING_FRONT - 0.012);
  glass.renderOrder = 4;
  M.add(glass);

  // The title above the window, the meters below it.
  const titlePlane = new THREE.Mesh(new THREE.PlaneGeometry(0.56, 0.1), decor().title.mat);
  titlePlane.position.set(0, 1.525, HOUSING_FRONT + 0.011);
  M.add(titlePlane);
  const meters = display(0.6, 0.075, full ? 1024 : 512);
  paintMeters(meters, { credit: 0, bet: 100, win: 0 });
  const meterPlane = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.075), meters.mat);
  meterPlane.position.set(0, 0.935, HOUSING_FRONT + 0.011);
  M.add(meterPlane);
  // Thin gold rules framing the meters.
  [0.975, 0.895].forEach((y) => {
    const r = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.003, 0.003), mats.gold);
    r.position.set(0, y, HOUSING_FRONT + 0.012);
    M.add(r);
  });
  // The players' club card reader: a small screen and a lit slot.
  const clubPlane = new THREE.Mesh(new THREE.PlaneGeometry(0.14, 0.04), decor().club.mat);
  clubPlane.position.set(-0.2, 0.848, HOUSING_FRONT + 0.011);
  M.add(clubPlane);
  const slotBezel = new THREE.Mesh(new RoundedBoxGeometry(0.1, 0.024, 0.012, 2, 0.004), mats.chrome);
  slotBezel.position.set(0.2, 0.848, HOUSING_FRONT + 0.012);
  M.add(slotBezel);
  const slotLight = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.006, 0.002), new THREE.MeshBasicMaterial({ color: 0x4aa8ff, toneMapped: false }));
  slotLight.position.set(0.2, 0.848, HOUSING_FRONT + 0.0185);
  M.add(slotLight);

  // The topper: an arched sign on the housing, with a gold rim.
  const ARCH_W = 0.68, ARCH_Y0 = HOUSING_Y1, ARCH_SPRING = 0.3, ARCH_TOP = 0.52;
  const arch = (inset) => {
    const s = new THREE.Shape();
    const x0 = -ARCH_W / 2 + inset, x1 = ARCH_W / 2 - inset, y0 = ARCH_Y0 + inset * 0.5, ys = ARCH_Y0 + ARCH_SPRING, yt = ARCH_Y0 + ARCH_TOP - inset;
    s.moveTo(x0, y0); s.lineTo(x1, y0); s.lineTo(x1, ys);
    s.bezierCurveTo(x1, ys + (yt - ys) * 0.7, x1 * 0.55, yt, 0, yt);
    s.bezierCurveTo(x0 * 0.55, yt, x0, ys + (yt - ys) * 0.7, x0, ys);
    s.closePath();
    return s;
  };
  const topperBody = new THREE.Mesh(new THREE.ExtrudeGeometry(arch(0), { depth: 0.14, bevelEnabled: true, bevelThickness: 0.008, bevelSize: 0.008, bevelSegments: 3, curveSegments: 24 }), mats.lacquer);
  topperBody.position.z = HOUSING_FRONT - 0.16;
  M.add(topperBody);
  const rimShape = arch(0.012);
  rimShape.holes.push(new THREE.Path(arch(0.034).getPoints(48)));
  const rim = new THREE.Mesh(new THREE.ExtrudeGeometry(rimShape, { depth: 0.01, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.004, bevelSegments: 3, curveSegments: 24 }), mats.gold);
  rim.position.z = HOUSING_FRONT - 0.01;
  M.add(rim);
  const topper = display(ARCH_W, ARCH_TOP, full ? 1024 : 512);
  const faceShape = arch(0.034);
  const faceGeo = new THREE.ShapeGeometry(faceShape, 24);
  {
    const uv = faceGeo.attributes.uv, pos = faceGeo.attributes.position;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, (pos.getX(i) + ARCH_W / 2) / ARCH_W, (pos.getY(i) - ARCH_Y0) / ARCH_TOP);
  }
  const face = new THREE.Mesh(faceGeo, topper.mat);
  face.position.z = HOUSING_FRONT - 0.004;
  M.add(face);
  let topperBet = 100;
  paintTopper(topper, topperBet);
  logoLoaded.then(() => paintTopper(topper, topperBet));

  // The belly glass, lit, in a gold frame; speakers and the note and ticket
  // slots either side.
  const bellyPlane = new THREE.Mesh(new THREE.PlaneGeometry(0.36, 0.4), decor().belly.mat);
  bellyPlane.position.set(0, 0.39, 0.6 + 0.009);
  M.add(bellyPlane);
  const bellyFrameShape = roundedRectPath(-0.195, 0.175, 0.39, 0.43, 0.012, THREE.Shape);
  bellyFrameShape.holes.push(roundedRectPath(-0.18, 0.19, 0.36, 0.4, 0.006));
  const bellyFrame = new THREE.Mesh(new THREE.ExtrudeGeometry(bellyFrameShape, { depth: 0.008, bevelEnabled: true, bevelThickness: 0.003, bevelSize: 0.003, bevelSegments: 2 }), mats.gold);
  bellyFrame.position.z = 0.604;
  M.add(bellyFrame);
  const grilleMat = decor().grille;
  [-1, 1].forEach((side) => {
    const g = new THREE.Mesh(new THREE.CircleGeometry(0.042, 32), grilleMat);
    g.position.set(side * 0.27, 0.49, 0.6 + 0.0105);
    M.add(g);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.044, 0.004, 8, 40), mats.chrome);
    ring.position.copy(g.position);
    M.add(ring);
    // The ticket printer on the left, the note acceptor on the right.
    const bez = new THREE.Mesh(new RoundedBoxGeometry(0.11, 0.05, 0.02, 2, 0.006), side < 0 ? mats.chrome : mats.blackGlass);
    bez.position.set(side * 0.27, 0.3, 0.6 + 0.01);
    M.add(bez);
    const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.006, 0.004), side < 0 ? mats.matte : new THREE.MeshBasicMaterial({ color: 0x3f9cff, toneMapped: false }));
    mouth.position.set(side * 0.27, 0.3, 0.6 + 0.021);
    M.add(mouth);
  });

  // The button deck: black glass, lit buttons, and the SPIN button.
  const deck = new THREE.Group();
  const tilt = Math.atan2(0.04, DECK_FRONT - 0.585);
  deck.position.set(0, 0.789, (DECK_FRONT + 0.585) / 2 + 0.002);
  deck.rotation.x = tilt;
  M.add(deck);
  const deckGlass = new THREE.Mesh(new THREE.PlaneGeometry(CAB_W - 0.06, 0.13), mats.blackGlass);
  deckGlass.rotation.x = -Math.PI / 2;
  deckGlass.position.y = 0.002;
  deck.add(deckGlass);
  const buttonGeo = new RoundedBoxGeometry(0.072, 0.016, 0.042, 3, 0.006);
  const buttons = {};
  [['PAYS', -0.27, 'pays'], ['BET −', -0.185, 'down'], ['BET +', -0.1, 'up'], ['MAX BET', -0.015, 'max'], ['AUTO', 0.07, 'auto']].forEach(([text, x, id]) => {
    const top = buttonTop(text);
    const b = new THREE.Mesh(buttonGeo, [mats.onyx, mats.onyx, top, mats.onyx, mats.onyx, mats.onyx]);
    b.position.set(x, 0.01, 0.005);
    b.userData.button = id;
    deck.add(b);
    const ring = new THREE.Mesh(new RoundedBoxGeometry(0.08, 0.008, 0.05, 2, 0.004), mats.gold);
    ring.position.set(x, 0.004, 0.005);
    deck.add(ring);
    buttons[id] = b;
  });
  // Your machine's SPIN button breathes on its own; a neighbour's shares one.
  const spinTex = decor().spinTex || (decor().spinTex = spinLabel());
  const spinTop = new THREE.MeshStandardMaterial({ map: spinTex, emissiveMap: spinTex, emissive: 0xffffff, emissiveIntensity: 0.8, roughness: 0.25, metalness: 0.2 });
  const spin = new THREE.Mesh(new THREE.CylinderGeometry(0.044, 0.046, 0.02, 48), [mats.gold, spinTop, mats.gold]);
  spin.position.set(0.215, 0.012, 0.004);
  spin.userData.button = 'spin';
  deck.add(spin);
  buttons.spin = spin;
  const spinRing = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.006, 12, 48), mats.gold);
  spinRing.rotation.x = Math.PI / 2;
  spinRing.position.set(0.215, 0.008, 0.004);
  deck.add(spinRing);
  // A gold lip along the deck's front edge.
  const lip = new THREE.Mesh(new THREE.BoxGeometry(CAB_W - 0.02, 0.008, 0.006), mats.gold);
  lip.position.set(0, 0.735, DECK_FRONT + 0.011);
  M.add(lip);

  // LED light pipes down the front edges, and under the deck.
  const ledMat = new THREE.MeshBasicMaterial({ color: 0xffcf7a, toneMapped: false });
  const leds = [];
  [-1, 1].forEach((side) => {
    const a = new THREE.Mesh(new THREE.BoxGeometry(0.008, HOUSING_Y1 - HOUSING_Y0 - 0.06, 0.008), ledMat);
    a.position.set(side * (CAB_W / 2 - 0.004), (HOUSING_Y0 + HOUSING_Y1) / 2, HOUSING_FRONT + 0.006);
    M.add(a); leds.push(a);
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.52, 0.008), ledMat);
    b.position.set(side * (CAB_W / 2 - 0.004), 0.4, 0.6 + 0.012);
    M.add(b); leds.push(b);
  });
  const underDeck = new THREE.Mesh(new THREE.BoxGeometry(CAB_W - 0.06, 0.005, 0.005), ledMat);
  underDeck.position.set(0, 0.697, DECK_FRONT - 0.035);
  M.add(underDeck);

  // The handle: a gold housing on the right side, a polished arm, an onyx
  // ball in a gold collar.
  const handle = new THREE.Group();
  handle.position.set(CAB_W / 2 + 0.03, 1.02, 0.36);
  M.add(handle);
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.042, 0.05, 32), mats.gold);
  hub.rotation.z = Math.PI / 2;
  handle.add(hub);
  const hubCap = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.054, 32), mats.darkGold);
  hubCap.rotation.z = Math.PI / 2;
  handle.add(hubCap);
  const arm = new THREE.Group();
  arm.position.x = 0.03;
  handle.add(arm);
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.011, 0.34, 20), mats.chrome);
  shaft.position.y = 0.17;
  arm.add(shaft);
  const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.014, 0.03, 24), mats.gold);
  collar.position.y = 0.335;
  arm.add(collar);
  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.034, 32, 24), mats.onyx);
  ball.position.y = 0.372;
  ball.userData.button = 'handle';
  arm.add(ball);
  arm.rotation.x = -0.18; // leaning back a little at rest
  buttons.handle = ball;

  // Shadows from the cabinet onto the floor and the chair.
  M.traverse((o) => { if (o.isMesh && o !== glass && o !== shadePlane) { o.castShadow = o === lower || o === housing || o === topperBody || o === plinth; o.receiveShadow = false; } });

  // ---------- behaviour ----------
  let spinning = null;   // { start, targets[], stopAt[], from[] }
  let lights = { mode: 'idle', since: performance.now() };
  let winState = null;   // { wins, scatter, since }
  const pull = { t: -1 };
  const FAST = 24;       // symbols a second at full speed
  const KICK = 110, ACCEL = 260, SETTLE = 300, BOUNCE = 170;

  /**
   * Spin to `stops` (the top row on each reel). The reels start together,
   * run, and stop left to right; `onReelStop(i)` and `onDone()` are called
   * as they land.
   */
  function spinTo(stops, { onReelStop, onDone, quick = false } = {}) {
    const now = performance.now();
    const base = quick ? 700 : 1300, stagger = quick ? 170 : 320;
    const plans = stops.map((stop, i) => {
      const n = STRIPS[i].length;
      const T = base + i * stagger;
      // Seconds of travel at full speed the run is worth: half of the
      // speeding up and the slowing down, all of the steady part.
      const runSec = (ACCEL / 2 + (T - SETTLE - KICK - ACCEL) + SETTLE / 2) / 1000;
      const from = reels[i].p;
      const offset = (((from - stop) % n) + n) % n;
      const laps = Math.max(1, Math.round((FAST * runSec - offset) / n));
      const dist = offset + n * laps;
      return { from, to: from - dist, dist, T, V: dist / runSec };
    });
    spinning = { start: now, plans, landed: stops.map(() => false), onReelStop, onDone };
    winState = null;
    if (winLayer) paintWins(winLayer, [], null, null);
    lights = { mode: 'spin', since: now };
  }
  // One reel, t ms into its spin: a small kick upward, speeding up, a
  // steady run, slowing to its stop, and a little settle past it and back.
  // Its strip index falls as the symbols travel down the window.
  function reelAt(plan, t) {
    const { from, to, dist, T, V } = plan;
    const v = V / 1000; // symbols a millisecond
    if (t < KICK) return { p: from + 0.16 * Math.sin((t / KICK) * Math.PI), speed: 0 };
    const tc = T - SETTLE;
    let d;
    if (t < KICK + ACCEL) { const u = t - KICK; d = (v * u * u) / (2 * ACCEL); return { p: from - d, speed: u / ACCEL }; }
    const dA = (v * ACCEL) / 2;
    if (t < tc) { d = dA + v * (t - KICK - ACCEL); return { p: from - d, speed: 1 }; }
    const dC = dA + v * (tc - KICK - ACCEL);
    if (t < T) { const u = t - tc; d = dC + v * u - (v * u * u) / (2 * SETTLE); return { p: from - Math.min(dist, d), speed: 1 - u / SETTLE }; }
    const u = Math.min(1, (t - T) / BOUNCE);
    return { p: to - 0.09 * Math.sin(u * Math.PI) * (1 - u * 0.4), speed: 0 };
  }
  function update(now) {
    if (spinning) {
      const t = now - spinning.start;
      let all = true;
      reels.forEach((r, i) => {
        if (spinning.landed[i]) return;
        const plan = spinning.plans[i];
        if (t >= plan.T + BOUNCE) {
          spinning.landed[i] = true;
          r.setPosition(plan.to);
          r.setBlur(false);
          return;
        }
        all = false;
        const { p, speed } = reelAt(plan, t);
        r.setPosition(p);
        r.setBlur(speed > 0.5);
        // The thud of a reel landing comes as it reaches its stop.
        if (!plan.thud && t >= plan.T) { plan.thud = true; if (spinning.onReelStop) spinning.onReelStop(i); }
      });
      if (all) {
        const done = spinning.onDone;
        // Keep the reels' positions small, so the numbers never grow.
        reels.forEach((r, i) => { const n = STRIPS[i].length; r.setPosition(((r.p % n) + n) % n); });
        spinning = null;
        lights = { mode: 'idle', since: now };
        if (done) done();
      }
    }
    // The handle, pulled: down and back with a spring.
    if (pull.t >= 0) {
      const u = (now - pull.t) / 700;
      if (u >= 1) { pull.t = -1; arm.rotation.x = -0.18; }
      else arm.rotation.x = -0.18 + (u < 0.3 ? (u / 0.3) * 1.15 : 1.15 * Math.max(0, Math.cos(((u - 0.3) / 0.7) * Math.PI * 0.5)) + Math.sin(((u - 0.3) / 0.7) * Math.PI * 3) * 0.06 * (1 - u));
    }
    // The lights: a slow breath at rest, a chase while spinning, a bright
    // pulse on a win.
    const since = (now - lights.since) / 1000;
    let k;
    if (lights.mode === 'win') k = 0.75 + 0.25 * Math.sin(since * 12);
    else if (lights.mode === 'spin') k = 0.7 + 0.3 * Math.sin(since * 20);
    else k = 0.62 + 0.18 * Math.sin(now / 900);
    ledMat.color.setRGB(1.0 * k, 0.81 * k, 0.48 * k);
    if (lights.mode === 'win' && since > 6) lights = { mode: 'idle', since: now };
    spin.material[1].emissiveIntensity = spinning ? 0.35 : 0.65 + 0.25 * Math.sin(now / 420);
    // Cycle through the winning lines one at a time after the first showing.
    if (winState && winLayer) {
      const el = (now - winState.since) / 1000;
      const phase = el < 2 ? null : Math.floor((el - 2) / 1.3);
      if (phase !== winState.phase) { winState.phase = phase; paintWins(winLayer, winState.wins, winState.scatter, phase); }
    }
  }
  function showWins(wins, scatter) {
    if (!winLayer) return;
    winState = { wins, scatter, since: performance.now(), phase: undefined };
    if (wins.length || scatter) lights = { mode: 'win', since: performance.now() };
  }
  function setMeters(values) { paintMeters(meters, values); }
  function setBet(bet) { if (bet !== topperBet) { topperBet = bet; paintTopper(topper, bet); } }
  function pullHandle() { pull.t = performance.now(); }
  function pressButton(id) {
    const b = buttons[id];
    if (!b || id === 'handle') return;
    const y0 = b.position.y;
    b.position.y = y0 - 0.005;
    setTimeout(() => { b.position.y = y0; }, 140);
  }
  // Rest on given stops at once (no spin).
  function rest(stops) { reels.forEach((r, i) => r.setPosition(stops[i])); }

  root.userData = { update, spinTo, showWins, setMeters, setBet, pullHandle, pressButton, rest, buttons: Object.values(buttons), get spinning() { return !!spinning; } };
  return root;
}
