import * as THREE from 'three';
import { FLOOR_Y, m } from './scale.js';
import { canvasTex, grain, gold, chrome, wood } from './casinoKit.js';
import { addTableGlow } from './tableLux.js';
import { createWheel } from './rouletteWheel.js';
import { SEAT_CHIP_COLORS } from './seatChips.js';
import { ROULETTE_SEATS, colorOf } from '../roulette/rules.js';
import {
  BOARD_W, BOARD_H, MARGIN, ZERO_W, COLUMN_W, ROW_H, BAND_H, CELL_W, GRID_X, GRID_BOTTOM,
  EVEN_CHANCES, spotOf, cellX, cellY, numberFill, FELT_COLOR, LINE_COLOR,
} from '../roulette/layout.js';

// The roulette table the game is played at: a mahogany cabinet on turned
// legs, green baize, a padded rail; the wheel in its bowl at the left end
// as the players see it, the layout along the rest (src/roulette/layout.js).
// The croupier stands across the table from the players, by the wheel.
//
// The wheel turns slowly all the time. Spun, it turns faster and slows;
// the ball runs the other way round the track, loses its pace, drops,
// rattles and settles in the pocket of the number drawn — timed from the
// spin's start, so every client sees the same ball land in the same place.

export const ROULETTE_L = m(3.5);
export const ROULETTE_W = m(1.5);
const L = ROULETTE_L, W = ROULETTE_W;
const TOP = 0;
export const WHEEL_X = -L / 2 + m(0.72);
// The wheel is built a little larger than life, to be the table's jewel.
const WHEEL_SCALE = 1.12;
const LAYOUT_W = L - m(1.62);
const LAYOUT_D = (LAYOUT_W * BOARD_H) / BOARD_W;
const LAYOUT_X = L / 2 - m(0.1) - LAYOUT_W / 2;
const LAYOUT_Z = m(0.06);

// A bet's spot on the felt, in the table's frame.
export function spotWorld(id) {
  const s = spotOf(id);
  if (!s) return null;
  return new THREE.Vector3(LAYOUT_X - LAYOUT_W / 2 + (s.x / BOARD_W) * LAYOUT_W, TOP + 0.004, LAYOUT_Z - LAYOUT_D / 2 + (s.y / BOARD_H) * LAYOUT_D);
}

// Six chairs: five along the near side, one at the far end of the layout.
export const ROULETTE_SEATS_3D = Array.from({ length: ROULETTE_SEATS }, (_, index) => {
  const end = index === ROULETTE_SEATS - 1;
  const outward = end ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 0, 1);
  const x = end ? L / 2 + m(0.58) : LAYOUT_X - LAYOUT_W * 0.44 + (index / 4) * LAYOUT_W * 0.86;
  const position = end ? new THREE.Vector3(x, 0, LAYOUT_Z) : new THREE.Vector3(x, 0, W / 2 + m(0.55));
  return {
    index, position, outward,
    facingAngle: Math.atan2(-outward.x, -outward.z),
    // Where the player's own chips stand, on the felt before them.
    stackSpot: end ? new THREE.Vector3(L / 2 - m(0.13), TOP + 0.002, LAYOUT_Z - m(0.25)) : new THREE.Vector3(x + m(0.16), TOP + 0.002, W / 2 - m(0.13)),
  };
});
export const ROULETTE_DEALER = {
  position: new THREE.Vector3(WHEEL_X + m(0.95), 0, -W / 2 - m(0.34)),
};
export const WHEEL_CENTER = new THREE.Vector3(WHEEL_X, TOP + m(0.07) * WHEEL_SCALE, 0);
export const WHEEL_RADIUS = m(0.56) * WHEEL_SCALE;
// Where the camera looks: between the wheel and the layout.
export const ROULETTE_LOOK = new THREE.Vector3(m(0.1), 0, 0);

// Each seat's wheel chips, in a colour of its own, as roulette is played —
// colours that stand out on the felt and on the red and black numbers.
export { SEAT_CHIP_COLORS } from './seatChips.js';

// ---------- the felt ----------
function paintLayout(ctx) {
  ctx.fillStyle = FELT_COLOR;
  ctx.fillRect(0, 0, BOARD_W, BOARD_H);
  grain(ctx, BOARD_W, BOARD_H, 12);
  ctx.strokeStyle = LINE_COLOR;
  ctx.lineWidth = 5;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const label = (t, x, y, size, color = LINE_COLOR, rot = 0) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    ctx.fillStyle = color;
    ctx.font = `700 ${size}px Georgia, serif`;
    ctx.fillText(t, 0, 0);
    ctx.restore();
  };
  // The zero, its end rounded toward the wheel.
  ctx.fillStyle = numberFill(0);
  ctx.beginPath();
  ctx.moveTo(GRID_X, MARGIN);
  ctx.lineTo(MARGIN + ZERO_W * 0.45, MARGIN);
  ctx.lineTo(MARGIN, MARGIN + 1.5 * ROW_H);
  ctx.lineTo(MARGIN + ZERO_W * 0.45, MARGIN + 3 * ROW_H);
  ctx.lineTo(GRID_X, MARGIN + 3 * ROW_H);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  label('0', MARGIN + ZERO_W * 0.58, MARGIN + 1.5 * ROW_H, 92);
  // The numbers, on red and black.
  for (let n = 1; n <= 36; n++) {
    const x = cellX(n), y = cellY(n);
    ctx.fillStyle = numberFill(n);
    ctx.beginPath();
    ctx.ellipse(x + CELL_W / 2, y + ROW_H / 2, CELL_W * 0.36, ROW_H * 0.34, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeRect(x, y, CELL_W, ROW_H);
    label(String(n), x + CELL_W / 2, y + ROW_H / 2 + 4, 78, '#ffffff', -Math.PI / 2);
  }
  // The columns.
  for (let k = 1; k <= 3; k++) {
    const y = MARGIN + (3 - k) * ROW_H;
    ctx.strokeRect(BOARD_W - MARGIN - COLUMN_W, y, COLUMN_W, ROW_H);
    label('2 to 1', BOARD_W - MARGIN - COLUMN_W / 2, y + ROW_H / 2, 44, LINE_COLOR, -Math.PI / 2);
  }
  // The dozens and the even chances.
  ['1st 12', '2nd 12', '3rd 12'].forEach((t, i) => {
    ctx.strokeRect(GRID_X + 4 * i * CELL_W, GRID_BOTTOM, 4 * CELL_W, BAND_H);
    label(t, GRID_X + (4 * i + 2) * CELL_W, GRID_BOTTOM + BAND_H / 2, 64);
  });
  EVEN_CHANCES.forEach((id, i) => {
    const x = GRID_X + 2 * i * CELL_W, y = GRID_BOTTOM + BAND_H;
    ctx.strokeRect(x, y, 2 * CELL_W, BAND_H);
    const cx = x + CELL_W, cy = y + BAND_H / 2;
    if (id === 'red' || id === 'black') {
      ctx.fillStyle = id === 'red' ? '#b3122e' : '#141414';
      ctx.beginPath();
      ctx.moveTo(cx, cy - BAND_H * 0.34);
      ctx.lineTo(cx + CELL_W * 0.7, cy);
      ctx.lineTo(cx, cy + BAND_H * 0.34);
      ctx.lineTo(cx - CELL_W * 0.7, cy);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } else {
      label({ low: '1 to 18', high: '19 to 36', even: 'EVEN', odd: 'ODD' }[id], cx, cy, 58);
    }
  });
  // The house's name along the far edge.
  label('NVGR CASINO · ROULETTE', BOARD_W / 2, MARGIN / 2 + 2, 30, '#d8b46a');
}

function roundedRect(w, d, r) {
  const s = new THREE.Shape();
  s.moveTo(-w / 2 + r, -d / 2);
  s.lineTo(w / 2 - r, -d / 2);
  s.quadraticCurveTo(w / 2, -d / 2, w / 2, -d / 2 + r);
  s.lineTo(w / 2, d / 2 - r);
  s.quadraticCurveTo(w / 2, d / 2, w / 2 - r, d / 2);
  s.lineTo(-w / 2 + r, d / 2);
  s.quadraticCurveTo(-w / 2, d / 2, -w / 2, d / 2 - r);
  s.lineTo(-w / 2, -d / 2 + r);
  s.quadraticCurveTo(-w / 2, -d / 2, -w / 2 + r, -d / 2);
  return s;
}

// The results board's screen: the house's name, the last number large in
// its colour, the fifteen before it in rows, how the colours have fallen,
// and the table's limits.
function paintBoard(ctx, w, h, history, min, max) {
  const bg = ctx.createLinearGradient(0, 0, 0, h);
  bg.addColorStop(0, '#0c0a10');
  bg.addColorStop(1, '#16121c');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#d8b46a';
  ctx.font = "700 46px 'Cinzel', Georgia, serif";
  ctx.fillText('NVGR ROULETTE', w / 2, 44);
  ctx.fillStyle = 'rgba(216,180,106,0.5)';
  ctx.fillRect(30, 80, w - 60, 2);
  const disc = (n) => (colorOf(n) === 'red' ? '#b3122e' : colorOf(n) === 'black' ? '#202024' : '#0f7a3c');
  const ball = (n, x, y, r, size) => {
    ctx.fillStyle = disc(n);
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(216,180,106,0.85)';
    ctx.lineWidth = Math.max(2, r * 0.07);
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.font = `800 ${size}px Georgia, serif`;
    ctx.fillText(String(n), x, y + size * 0.05);
  };
  // The last number, large, at the left.
  const last = history[0];
  ctx.fillStyle = '#8a8070';
  ctx.font = "600 24px 'Cinzel', Georgia, serif";
  ctx.fillText('LAST', 165, 116);
  if (last !== undefined) ball(last, 165, 258, 112, 110);
  else { ctx.fillStyle = '#8a8070'; ctx.font = '600 26px Georgia, serif'; ctx.fillText('Place your bets', 165, 258); }
  ctx.fillStyle = 'rgba(216,180,106,0.35)';
  ctx.fillRect(320, 104, 2, 300);
  // The fifteen before it, newest first, in three rows of five.
  history.slice(1, 16).forEach((n, k) => {
    const col = k % 5, row = Math.floor(k / 5);
    ball(n, 400 + col * 132, 152 + row * 104, 42, 40);
  });
  // How the colours have fallen over the numbers shown.
  ctx.fillStyle = 'rgba(216,180,106,0.5)';
  ctx.fillRect(30, 430, w - 60, 2);
  const n = history.length || 1;
  const pct = (c) => Math.round((history.filter((x) => colorOf(x) === c).length / n) * 100);
  // Set left to right, each after the one before, so none run together.
  ctx.font = '700 34px Georgia, serif';
  ctx.textAlign = 'left';
  let x = 40;
  [['RED', 'red', '#ff5a6e'], ['GREEN', 'green', '#3ad07c'], ['BLACK', 'black', '#e8e8ea']].forEach(([label, c, col]) => {
    const t = `${label} ${history.length ? pct(c) + '%' : '–'}`;
    ctx.fillStyle = col;
    ctx.fillText(t, x, 484);
    x += ctx.measureText(t).width + 36;
  });
  ctx.textAlign = 'center';
  const short = (v) => (v >= 1e6 ? v / 1e6 + 'M' : v >= 1000 ? v / 1000 + 'K' : String(v));
  ctx.fillStyle = '#e8dcc0';
  ctx.font = '600 32px Georgia, serif';
  ctx.fillText(`${short(min)} – ${short(max)}`, w * 0.84, 484);
}

export function createRouletteTable() {
  const g = new THREE.Group();
  const GOLD = gold();
  const CHROME = chrome();
  // Mahogany under a deep clear lacquer, as a table built to last is.
  const MAHOGANY = new THREE.MeshPhysicalMaterial({ map: wood('#4a1a0e', '#1a0604').map, roughness: 0.38, clearcoat: 1, clearcoatRoughness: 0.12 });
  const ROSEWOOD = new THREE.MeshPhysicalMaterial({ map: wood('#6a2c14', '#2a0c04', { across: true }).map, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.08 });
  const LEATHER = new THREE.MeshStandardMaterial({ color: 0x3a0c10, roughness: 0.42 });
  const FELT = new THREE.MeshStandardMaterial({ map: canvasTex(512, 512, (ctx) => { ctx.fillStyle = FELT_COLOR; ctx.fillRect(0, 0, 512, 512); grain(ctx, 512, 512, 14); }, { repeat: true }), roughness: 0.92, sheen: 0 });
  FELT.map.repeat.set(6, 3);

  // ---------- the cabinet ----------
  const body = new THREE.Mesh(new THREE.BoxGeometry(L - m(0.14), m(0.26), W - m(0.14)), MAHOGANY);
  body.position.y = TOP - m(0.15);
  body.castShadow = true;
  body.receiveShadow = true;
  g.add(body);
  // Carved panels round the apron, each framed in gilt moulding.
  const panelRow = (count, length, place) => {
    const pw = length / count;
    for (let i = 0; i < count; i++) {
      const c = -length / 2 + (i + 0.5) * pw;
      const panel = new THREE.Mesh(new THREE.BoxGeometry(pw - m(0.08), m(0.14), m(0.016)), ROSEWOOD);
      place(panel, c, 0);
      g.add(panel);
      [[pw - m(0.05), m(0.012), 0, m(0.08)], [pw - m(0.05), m(0.012), 0, -m(0.08)], [m(0.012), m(0.172), (pw - m(0.05)) / 2, 0], [m(0.012), m(0.172), -(pw - m(0.05)) / 2, 0]].forEach(([fw, fh, dx, dy]) => {
        const f = new THREE.Mesh(new THREE.BoxGeometry(fw, fh, m(0.02)), GOLD);
        place(f, c + dx, dy);
        g.add(f);
      });
      // A carved gilt lozenge at the panel's heart.
      const boss = new THREE.Mesh(new THREE.OctahedronGeometry(m(0.024)), GOLD);
      boss.scale.set(1.6, 1, 0.25);
      place(boss, c, 0, m(0.004));
      g.add(boss);
    }
  };
  const apronY = TOP - m(0.15);
  [1, -1].forEach((s) => panelRow(6, L - m(0.5), (mesh, along, dy, out = 0) => {
    mesh.position.set(along, apronY + dy, s * ((W - m(0.14)) / 2 + m(0.008) + out));
    if (s < 0) mesh.rotation.y = Math.PI;
  }));
  [1, -1].forEach((s) => panelRow(2, W - m(0.5), (mesh, along, dy, out = 0) => {
    mesh.position.set(s * ((L - m(0.14)) / 2 + m(0.008) + out), apronY + dy, along);
    mesh.rotation.y = s * Math.PI / 2;
  }));
  // A gilt band under the panels, and the light along it.
  const band = new THREE.Mesh(new THREE.BoxGeometry(L - m(0.1), m(0.025), W - m(0.1)), GOLD);
  band.position.y = TOP - m(0.29);
  g.add(band);
  // Eight turned legs, gilt at the collar and the foot.
  const legGeo = new THREE.LatheGeometry([[0, 0], [0.04, 0], [0.05, 0.04], [0.03, 0.14], [0.05, 0.3], [0.034, 0.42], [0.042, 0.47], [0.06, 0.5], [0, 0.5]].map(([r, h]) => new THREE.Vector2(m(r), m(h))), 20);
  const collarGeo = new THREE.TorusGeometry(m(0.046), m(0.012), 8, 24);
  const footGeo = new THREE.CylinderGeometry(m(0.05), m(0.058), m(0.035), 20);
  [[-0.5, -1], [-0.17, -1], [0.17, -1], [0.5, -1], [-0.5, 1], [-0.17, 1], [0.17, 1], [0.5, 1]].forEach(([fx, sz]) => {
    const x = fx * (L - m(0.5)), z = sz * (W / 2 - m(0.22));
    const leg = new THREE.Mesh(legGeo, MAHOGANY);
    leg.position.set(x, FLOOR_Y + m(0.035), z);
    leg.castShadow = true;
    g.add(leg);
    const collar = new THREE.Mesh(collarGeo, GOLD);
    collar.rotation.x = Math.PI / 2;
    collar.position.set(x, FLOOR_Y + m(0.44), z);
    g.add(collar);
    const foot = new THREE.Mesh(footGeo, GOLD);
    foot.position.set(x, FLOOR_Y + m(0.0175), z);
    g.add(foot);
  });

  // ---------- the top ----------
  const felt = new THREE.Mesh(new THREE.ShapeGeometry(roundedRect(L - m(0.3), W - m(0.3), m(0.08))), FELT);
  felt.rotation.x = -Math.PI / 2;
  felt.position.y = TOP;
  felt.receiveShadow = true;
  g.add(felt);
  // A border of polished rosewood between the felt and the armrest, a line
  // of gold let into it.
  const track = roundedRect(L - m(0.14), W - m(0.14), m(0.12));
  track.holes.push(roundedRect(L - m(0.3), W - m(0.3), m(0.08)));
  const border = new THREE.Mesh(new THREE.ExtrudeGeometry(track, { depth: m(0.012), bevelEnabled: false, curveSegments: 16 }), ROSEWOOD);
  border.rotation.x = -Math.PI / 2;
  border.position.y = TOP - m(0.008);
  g.add(border);
  const inlay = roundedRect(L - m(0.2), W - m(0.2), m(0.1));
  inlay.holes.push(roundedRect(L - m(0.215), W - m(0.215), m(0.095)));
  const inlayMesh = new THREE.Mesh(new THREE.ExtrudeGeometry(inlay, { depth: m(0.013), bevelEnabled: false, curveSegments: 16 }), GOLD);
  inlayMesh.rotation.x = -Math.PI / 2;
  inlayMesh.position.y = TOP - m(0.008);
  g.add(inlayMesh);
  // The armrest: oxblood leather, padded, brass nails along its foot.
  const railShape = roundedRect(L + m(0.06), W + m(0.06), m(0.18));
  railShape.holes.push(roundedRect(L - m(0.14), W - m(0.14), m(0.12)));
  const rail = new THREE.Mesh(new THREE.ExtrudeGeometry(railShape, { depth: m(0.05), bevelEnabled: true, bevelThickness: m(0.032), bevelSize: m(0.026), bevelSegments: 6, curveSegments: 16 }), LEATHER);
  rail.rotation.x = -Math.PI / 2;
  rail.position.y = TOP - m(0.012);
  rail.castShadow = true;
  g.add(rail);
  const nailPath = roundedRect(L + m(0.1), W + m(0.1), m(0.2)).getSpacedPoints(220);
  const nails = new THREE.InstancedMesh(new THREE.SphereGeometry(m(0.008), 8, 6), new THREE.MeshStandardMaterial({ color: 0xc8a050, roughness: 0.25, metalness: 0.95 }), nailPath.length);
  const nm = new THREE.Matrix4();
  nailPath.forEach((p, i) => { nm.makeTranslation(p.x, TOP - m(0.035), -p.y); nails.setMatrixAt(i, nm); });
  g.add(nails);
  // The layout.
  const layoutTex = canvasTex(BOARD_W, BOARD_H, paintLayout);
  const layout = new THREE.Mesh(new THREE.PlaneGeometry(LAYOUT_W, LAYOUT_D), new THREE.MeshStandardMaterial({ map: layoutTex, roughness: 0.95 }));
  layout.rotation.x = -Math.PI / 2;
  layout.position.set(LAYOUT_X, TOP + 0.002, LAYOUT_Z);
  layout.receiveShadow = true;
  g.add(layout);

  // ---------- the croupier's side ----------
  // The float: a tray let into the felt, columns of chips in every colour.
  const floatX = WHEEL_X + m(1.12), floatZ = -W / 2 + m(0.24);
  const tray = new THREE.Mesh(new THREE.BoxGeometry(m(0.62), m(0.02), m(0.13)), new THREE.MeshStandardMaterial({ color: 0x120c08, roughness: 0.7 }));
  tray.position.set(floatX, TOP + m(0.004), floatZ);
  g.add(tray);
  const trayRim = new THREE.Mesh(new THREE.BoxGeometry(m(0.64), m(0.016), m(0.15)), CHROME);
  trayRim.position.set(floatX, TOP + m(0.002), floatZ);
  g.add(trayRim);
  const floatChips = new THREE.InstancedMesh(new THREE.CylinderGeometry(m(0.019), m(0.019), m(0.0038), 16), new THREE.MeshStandardMaterial({ roughness: 0.5 }), 6 * 3 * 14);
  const fc = new THREE.Color(), fmx = new THREE.Matrix4();
  let fi = 0;
  SEAT_CHIP_COLORS.slice(0, 6).forEach((col, c) => {
    for (let row = 0; row < 3; row++) {
      for (let k = 0; k < 14; k++) {
        // Each column lies along the tray, chips on their edges.
        fmx.makeRotationX(Math.PI / 2).setPosition(floatX - m(0.25) + c * m(0.1), TOP + m(0.024), floatZ - m(0.04) + (row * 14 + k) * m(0.0021));
        floatChips.setMatrixAt(fi, fmx);
        floatChips.setColorAt(fi, fc.set(col));
        fi++;
      }
    }
  });
  g.add(floatChips);
  // The limits, on a brass plaque standing on the table.
  const plaqueCanvas = document.createElement('canvas');
  plaqueCanvas.width = 512;
  plaqueCanvas.height = 192;
  const plaqueTex = new THREE.CanvasTexture(plaqueCanvas);
  plaqueTex.colorSpace = THREE.SRGBColorSpace;
  const plaque = new THREE.Mesh(new THREE.PlaneGeometry(m(0.3), m(0.11)), new THREE.MeshStandardMaterial({ map: plaqueTex, roughness: 0.3, metalness: 0.6, emissive: 0xffffff, emissiveMap: plaqueTex, emissiveIntensity: 0.25 }));
  plaque.position.set(L / 2 - m(0.32), TOP + m(0.09), -W / 2 + m(0.2));
  plaque.rotation.set(-0.25, -0.2, 0);
  g.add(plaque);
  const plaqueStand = new THREE.Mesh(new THREE.BoxGeometry(m(0.32), m(0.13), m(0.012)), GOLD);
  plaqueStand.position.copy(plaque.position).add(new THREE.Vector3(0, 0, -m(0.008)));
  plaqueStand.rotation.copy(plaque.rotation);
  g.add(plaqueStand);
  function setLimits(min, max) {
    const ctx = plaqueCanvas.getContext('2d');
    const gr = ctx.createLinearGradient(0, 0, 0, 192);
    gr.addColorStop(0, '#2a1a0a');
    gr.addColorStop(1, '#120a04');
    ctx.fillStyle = gr;
    ctx.fillRect(0, 0, 512, 192);
    ctx.strokeStyle = '#d8b46a';
    ctx.lineWidth = 6;
    ctx.strokeRect(10, 10, 492, 172);
    const short = (n) => (n >= 1e6 ? n / 1e6 + 'M' : n >= 1000 ? n / 1000 + 'K' : String(n));
    ctx.fillStyle = '#e8cd8a';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = "600 34px 'Cinzel', Georgia, serif";
    ctx.fillText('TABLE LIMITS', 256, 62);
    ctx.font = '700 46px Georgia, serif';
    ctx.fillText(`${short(min)} – ${short(max)}`, 256, 128);
    plaqueTex.needsUpdate = true;
  }
  setLimits(100, 2000);
  // The results board beside the croupier, behind the wheel end of the
  // table: one wide screen on two chrome legs, painted at a high
  // resolution and shown unlit so its numbers read sharp from every seat.
  const BOARD_PW = 1000, BOARD_PH = 540;
  // Sharp on a big screen; a phone shows it far smaller, and has less memory.
  const BOARD_SCALE = window.matchMedia('(pointer: coarse)').matches || window.innerWidth < 820 ? 1.0 : 2.2;
  const towerCanvas = document.createElement('canvas');
  towerCanvas.width = Math.round(BOARD_PW * BOARD_SCALE);
  towerCanvas.height = Math.round(BOARD_PH * BOARD_SCALE);
  const towerTex = new THREE.CanvasTexture(towerCanvas);
  towerTex.colorSpace = THREE.SRGBColorSpace;
  towerTex.anisotropy = 16;
  const SW = m(1.45), SH = SW * (BOARD_PH / BOARD_PW);
  const SCREEN_Y = TOP + m(0.02) + SH / 2;
  const tower = new THREE.Group();
  tower.position.set(WHEEL_X + m(0.05), 0, -W / 2 - m(0.5));
  tower.rotation.y = 0.18;
  g.add(tower);
  [-1, 1].forEach((leg) => {
    const pillar = new THREE.Mesh(new THREE.CylinderGeometry(m(0.03), m(0.04), SCREEN_Y - FLOOR_Y, 16), CHROME);
    pillar.position.set(leg * SW * 0.32, (SCREEN_Y + FLOOR_Y) / 2, -m(0.05));
    tower.add(pillar);
    const foot = new THREE.Mesh(new THREE.CylinderGeometry(m(0.12), m(0.15), m(0.035), 32), CHROME);
    foot.position.set(leg * SW * 0.32, FLOOR_Y + m(0.018), -m(0.05));
    tower.add(foot);
  });
  const housing = new THREE.Mesh(new THREE.BoxGeometry(SW + m(0.06), SH + m(0.06), m(0.07)), new THREE.MeshStandardMaterial({ color: 0x0a0a0c, roughness: 0.2, metalness: 0.5 }));
  housing.position.set(0, SCREEN_Y, -m(0.035));
  housing.castShadow = true;
  tower.add(housing);
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(SW, SH), new THREE.MeshBasicMaterial({ map: towerTex, toneMapped: false }));
  screen.position.set(0, SCREEN_Y, m(0.002));
  tower.add(screen);
  [1, -1].forEach((end) => {
    const trim = new THREE.Mesh(new THREE.BoxGeometry(SW + m(0.09), m(0.025), m(0.08)), GOLD);
    trim.position.set(0, SCREEN_Y + end * (SH / 2 + m(0.04)), -m(0.035));
    tower.add(trim);
  });
  let towerKey = '';
  function setHistory(history, min, max) {
    const key = JSON.stringify([history, min, max]);
    if (key === towerKey) return;
    towerKey = key;
    const ctx = towerCanvas.getContext('2d');
    ctx.setTransform(BOARD_SCALE, 0, 0, BOARD_SCALE, 0, 0);
    paintBoard(ctx, BOARD_PW, BOARD_PH, history || [], min, max);
    towerTex.needsUpdate = true;
  }
  setHistory([], 100, 2000);

  // ---------- the wheel ----------
  const wheelGroup = createWheel();
  wheelGroup.position.set(WHEEL_X, TOP, 0);
  wheelGroup.scale.setScalar(WHEEL_SCALE);
  g.add(wheelGroup);
  const api = wheelGroup.userData.api;
  // A light of its own over the wheel, so the gold and the ball shine.
  const wheelLight = new THREE.SpotLight(0xfff0d8, 11, m(3.2), 0.5, 0.6, 1.6);
  wheelLight.position.set(WHEEL_X, TOP + m(2.0), m(0.3));
  wheelLight.target.position.set(WHEEL_X, TOP, 0);
  g.add(wheelLight);
  g.add(wheelLight.target);

  // The dolly: set on the winning number while the bets are paid.
  const dolly = new THREE.Group();
  const dBase = new THREE.Mesh(new THREE.CylinderGeometry(m(0.028), m(0.034), m(0.018), 24), CHROME);
  dBase.position.y = m(0.009);
  dolly.add(dBase);
  const dTop = new THREE.Mesh(new THREE.CylinderGeometry(m(0.012), m(0.022), m(0.05), 16), GOLD);
  dTop.position.y = m(0.043);
  dolly.add(dTop);
  const dCap = new THREE.Mesh(new THREE.SphereGeometry(m(0.016), 16, 12), GOLD);
  dCap.position.y = m(0.072);
  dolly.add(dCap);
  dolly.visible = false;
  g.add(dolly);

  addTableGlow(g, {
    footOuter: roundedRect(L - m(0.3), W - m(0.3), m(0.12)),
    footInner: roundedRect(L - m(0.36), W - m(0.36), m(0.1)),
    w: L + m(2.4), d: W + m(2.2),
    edge: { outer: roundedRect(L - m(0.1), W - m(0.1), m(0.14)), inner: roundedRect(L - m(0.16), W - m(0.16), m(0.12)), y: TOP - m(0.3) },
  });

  function showDolly(number) {
    if (number === null || number === undefined) { dolly.visible = false; return; }
    const at = spotWorld('n:' + number);
    dolly.position.set(at.x, TOP + 0.003, at.z);
    dolly.visible = true;
  }

  g.userData.wheel = {
    update: api.update, spinTo: api.spinTo, rest: api.rest, progress: api.progress, ballWorld: api.ballWorld, showDolly,
    get spinning() { return api.spinning; },
  };
  g.userData.setLimits = setLimits;
  g.userData.setHistory = setHistory;
  return g;
}

export { colorOf };
