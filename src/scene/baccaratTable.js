import * as THREE from 'three';
import { FLOOR_Y, m } from './scale.js';
import { canvasTex, grain, gold, chrome, wood } from './casinoKit.js';
import { addTableGlow } from './tableLux.js';
import { createCardShoe, createDiscardHolder, SHOE_MOUTH } from './props.js';
import { CARD_WIDTH, CARD_HEIGHT } from './card.js';
import { BACCARAT_SEATS } from '../baccarat/rules.js';
import { FELT_COLOR, LINE_COLOR } from '../roulette/layout.js';

// The baccarat table: a grand kidney of mahogany and emerald baize, seven
// seats round its curve, an oxblood armrest studded with brass along it;
// the dealer stands in the cut-out on its straight side between the shoe
// and the discard holder. At every seat its own boxes — PLAYER, BANKER,
// TIE, and a pair circle either side — and before the dealer the two
// hands' card boxes. At the end of the table, the scoreboard of beads.
//
// The shape is drawn flat with y = −z, so laid down it has the players on
// the +z side and the dealer's straight edge toward −z.

const RX = m(2.15), RZ = m(1.5), D = m(0.42);   // the curve's half-width and depth; the straight edge's distance back
const TOP = 0;

function outline(grow = 0) {
  const s = new THREE.Shape();
  const rx = RX + grow, rz = RZ + grow, d = D + grow;
  s.moveTo(-rx, 0);
  s.absellipse(0, 0, rx, rz, Math.PI, Math.PI * 2, false);
  s.lineTo(rx, d);
  s.lineTo(m(0.58), d);
  s.quadraticCurveTo(0, d - m(0.36), -m(0.58), d);
  s.lineTo(-rx, d);
  s.lineTo(-rx, 0);
  return s;
}
// The outline the other way up: what tableLux.js lays down with +x
// rotation (its glow), so it lands under the table, not mirrored.
const flipped = (shape) => new THREE.Shape(shape.getPoints(96).map((p) => new THREE.Vector2(p.x, -p.y)));
// A point on the curve at bearing t (0 toward the players, ±π/2 at the
// ends), grown outward by k of the curve.
const onCurve = (t, k = 1) => new THREE.Vector3(Math.sin(t) * RX * k, 0, Math.cos(t) * RZ * k);
// The armrest's line (the curve, a little outside it) and the height of
// the floor of the chip trays let into it.
const RAIL_OUT = m(0.035);
const railPoint = (t) => { const p = onCurve(t); return new THREE.Vector3(p.x * (1 + RAIL_OUT / RX), 0, p.z * (1 + RAIL_OUT / RZ)); };
const TRAY_FLOOR = TOP + m(0.074);
const SEAT_T = Array.from({ length: BACCARAT_SEATS }, (_, i) => -1.2 + (i / (BACCARAT_SEATS - 1)) * 2.4);

export const BACCARAT_SEATS_3D = SEAT_T.map((t, index) => {
  const rim = onCurve(t);
  const outward = new THREE.Vector3(Math.sin(t) / RX, 0, Math.cos(t) / RZ).normalize();
  const position = rim.clone().addScaledVector(outward, m(0.6));
  return {
    index, t, position, outward,
    facingAngle: Math.atan2(-outward.x, -outward.z),
    // Your chips stand in a tray let into the armrest before your seat.
    stackSpot: railPoint(t).setY(TRAY_FLOOR),
    trayAngle: Math.atan2(outward.x, outward.z),
  };
});
export const BACCARAT_DEALER = { position: new THREE.Vector3(0, 0, -D - m(0.06)) };
// The two hands' card spots, before the dealer: the player's on the
// dealer's right (the players' left), the banker's on the other side; the
// third card laid sideways beside the two.
const HAND_Z = -m(0.06);
export function cardSpot(side, i) {
  const sx = side === 'player' ? -1 : 1;
  const step = CARD_WIDTH + m(0.02);
  const x0 = sx * m(0.5);
  if (i < 2) return new THREE.Vector3(x0 + (i - 0.5) * step * sx, TOP + 0.006, HAND_Z);
  return new THREE.Vector3(x0 + sx * (step + CARD_HEIGHT * 0.5 + m(0.0)), TOP + 0.006, HAND_Z);
}
// Each seat's bets lie in arched bands round the curve, as on a real
// layout: PLAYER nearest the seat, BANKER inside it, and the innermost
// band split three ways — P PAIR, TIE, B PAIR. Each seat has its own
// segment of each band, SEG either side of its line.
export const BANDS = { player: [0.76, 0.875], banker: [0.635, 0.75], inner: [0.515, 0.625] };
export const SEG = 0.175;
const PAIR_DT = 0.117;
const mid = ([a, b]) => (a + b) / 2;
export function betSpot(seat, id) {
  const t = SEAT_T[seat];
  if (id === 'player' || id === 'banker') return onCurve(t, mid(BANDS[id])).setY(TOP + 0.004);
  const dt = id === 'ppair' ? -PAIR_DT : id === 'bpair' ? PAIR_DT : 0;
  return onCurve(t + dt, mid(BANDS.inner)).setY(TOP + 0.004);
}
export const BACCARAT_LOOK = new THREE.Vector3(0, 0, m(0.05));
export const CARDS_CENTER = new THREE.Vector3(0, TOP, HAND_Z);

// ---------- the felt ----------
const LAYOUT_W = 2048;
const LAYOUT_H = Math.round((LAYOUT_W * (RZ + D)) / (2 * RX));
const toCanvas = (x, z) => [((x + RX) / (2 * RX)) * LAYOUT_W, ((D + z) / (D + RZ)) * LAYOUT_H];
const PX = LAYOUT_W / (2 * RX);   // canvas pixels a world unit
function paintLayout(ctx) {
  ctx.fillStyle = FELT_COLOR;
  ctx.fillRect(0, 0, LAYOUT_W, LAYOUT_H);
  grain(ctx, LAYOUT_W, LAYOUT_H, 12);
  const GOLD = LINE_COLOR;
  const SOFT = 'rgba(227, 196, 126, 0.78)';
  const text = (t, x, y, size, color, rot = 0, { weight = 700, font = "'Cinzel', Georgia, serif", spacing = 0 } = {}) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    ctx.fillStyle = color;
    ctx.font = `${weight} ${size}px ${font}`;
    if ('letterSpacing' in ctx) ctx.letterSpacing = spacing + 'px';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(t, 0, 0);
    ctx.restore();
  };
  // A band segment: the stretch of the curve between bearings t0 and t1,
  // from k0 to k1 of the way out.
  const sector = (t0, t1, k0, k1) => {
    ctx.beginPath();
    const N = 24;
    for (let n = 0; n <= N; n++) {
      const q = onCurve(t0 + ((t1 - t0) * n) / N, k1);
      const [x, y] = toCanvas(q.x, q.z);
      if (n) ctx.lineTo(x, y); else ctx.moveTo(x, y);
    }
    for (let n = N; n >= 0; n--) {
      const q = onCurve(t0 + ((t1 - t0) * n) / N, k0);
      const [x, y] = toCanvas(q.x, q.z);
      ctx.lineTo(x, y);
    }
    ctx.closePath();
  };
  // Two gold lines round the edge, inside the armrest.
  [[0.965, 6], [0.945, 2]].forEach(([k, lw]) => {
    ctx.strokeStyle = GOLD;
    ctx.lineWidth = lw;
    ctx.beginPath();
    for (let n = 0; n <= 96; n++) {
      const t = -Math.PI / 2 + (n / 96) * Math.PI;
      const [x, y] = toCanvas(Math.sin(t) * RX * k, Math.cos(t) * RZ * k);
      if (n) ctx.lineTo(x, y); else ctx.moveTo(x, y);
    }
    ctx.stroke();
  });
  // Each seat's segments, its labels read from the seat.
  SEAT_T.forEach((t, i) => {
    const rot = -t;
    const t0 = t - SEG, t1 = t + SEG;
    const band = (k, label, size) => {
      sector(t0, t1, k[0], k[1]);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.12)';
      ctx.fill();
      ctx.strokeStyle = GOLD;
      ctx.lineWidth = 4;
      ctx.stroke();
      const c = onCurve(t, mid(k));
      const [x, y] = toCanvas(c.x, c.z);
      text(label, x, y + 2, size, GOLD, rot, { spacing: 3 });
    };
    band(BANDS.player, 'PLAYER', 34);
    band(BANDS.banker, 'BANKER', 34);
    // The inner band, in three: the pairs either side of the tie.
    const cells = [[t0, t - SEG / 3, 'P PAIR', '11:1'], [t - SEG / 3, t + SEG / 3, 'TIE', '8:1'], [t + SEG / 3, t1, 'B PAIR', '11:1']];
    cells.forEach(([a, b, label, pays]) => {
      sector(a, b, BANDS.inner[0], BANDS.inner[1]);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.12)';
      ctx.fill();
      ctx.strokeStyle = GOLD;
      ctx.lineWidth = 3;
      ctx.stroke();
      const c = onCurve((a + b) / 2, mid(BANDS.inner));
      const [x, y] = toCanvas(c.x, c.z);
      const r = -(a + b) / 2;
      const big = label === 'TIE';
      // The two lines stacked along the reading direction.
      const ux = Math.sin(-r), uy = Math.cos(-r);
      const off = big ? 13 : 11;
      text(label, x - ux * off, y - uy * off, big ? 26 : 17, GOLD, r, { spacing: big ? 2 : 0.5 });
      text(pays, x + ux * (off + 2), y + uy * (off + 2), big ? 18 : 15, SOFT, r, { weight: 600, font: 'Georgia, serif' });
    });
    // The seat's number, at the rail.
    const n = onCurve(t, 0.91);
    const [nx, ny] = toCanvas(n.x, n.z);
    ctx.beginPath();
    ctx.arc(nx, ny, 20, 0, Math.PI * 2);
    ctx.strokeStyle = GOLD;
    ctx.lineWidth = 2.5;
    ctx.stroke();
    text(String(i + 1), nx, ny + 1, 24, GOLD, rot, { font: 'Georgia, serif' });
  });
  // The hands' boxes before the dealer.
  ['player', 'banker'].forEach((side) => {
    [0, 1, 2].forEach((i) => {
      const c = cardSpot(side, i);
      const [x, y] = toCanvas(c.x, c.z);
      const w = (i < 2 ? CARD_WIDTH : CARD_HEIGHT) * PX + 10, h = (i < 2 ? CARD_HEIGHT : CARD_WIDTH) * PX + 10;
      ctx.strokeStyle = i < 2 ? GOLD : 'rgba(227,196,126,0.5)';
      ctx.lineWidth = 3;
      ctx.setLineDash(i < 2 ? [] : [10, 8]);
      ctx.beginPath();
      ctx.roundRect(x - w / 2, y - h / 2, w, h, 10);
      ctx.stroke();
      ctx.setLineDash([]);
    });
    const c = cardSpot(side, 0).add(cardSpot(side, 1)).multiplyScalar(0.5);
    const [x, y] = toCanvas(c.x, c.z + CARD_HEIGHT * 0.5 + m(0.07));
    text(side === 'player' ? 'PLAYER' : 'BANKER', x, y, 42, GOLD, 0, { spacing: 4 });
  });
  const [cx, cy] = toCanvas(0, m(0.3));
  text('BACCARAT', cx, cy, 62, GOLD, 0, { spacing: 8 });
  text('BANKER PAYS 19 TO 20', cx, cy + 46, 20, SOFT, 0, { weight: 600, font: 'Georgia, serif', spacing: 2 });
  const [ncx, ncy] = toCanvas(0, m(0.48));
  text('NVGR CASINO', ncx, ncy, 26, SOFT, 0, { spacing: 6 });
}
// Fit a flat shape's UVs to 0..1 over its bounds, so the layout drawn on a
// canvas lies over the whole of it.
function fitUV(geo) {
  geo.computeBoundingBox();
  const { min, max } = geo.boundingBox;
  const pos = geo.attributes.position, uv = geo.attributes.uv;
  for (let i = 0; i < pos.count; i++) uv.setXY(i, (pos.getX(i) - min.x) / (max.x - min.x), (pos.getY(i) - min.y) / (max.y - min.y));
  uv.needsUpdate = true;
  return geo;
}

// ---------- the scoreboard ----------
// The bead plate, as the casinos show it: a grid filled down and across,
// a bead for each coup — blue for the player, red for the banker, green
// for a tie, a dot for a pair — and the counts under it.
function paintBoard(ctx, w, h, history, min, max) {
  ctx.fillStyle = '#0c0a10';
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#d8b46a';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = "700 34px 'Cinzel', Georgia, serif";
  ctx.fillText('NVGR BACCARAT', w / 2, 40);
  const rows = 6, cols = 12, cell = (w - 60) / cols, top = 76;
  ctx.strokeStyle = 'rgba(216,180,106,0.25)';
  ctx.lineWidth = 1;
  for (let r = 0; r <= rows; r++) { ctx.beginPath(); ctx.moveTo(30, top + r * cell); ctx.lineTo(w - 30, top + r * cell); ctx.stroke(); }
  for (let c = 0; c <= cols; c++) { ctx.beginPath(); ctx.moveTo(30 + c * cell, top); ctx.lineTo(30 + c * cell, top + rows * cell); ctx.stroke(); }
  const shown = history.slice(-rows * cols);
  shown.forEach((mark, i) => {
    const c = Math.floor(i / rows), r = i % rows;
    const x = 30 + (c + 0.5) * cell, y = top + (r + 0.5) * cell;
    const color = mark[0] === 'P' ? '#2e74e8' : mark[0] === 'B' ? '#d8202e' : '#1aa04e';
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, cell * 0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = `700 ${cell * 0.42}px Georgia, serif`;
    ctx.fillText(mark[0], x, y + 1);
    if (mark.includes('p')) { ctx.fillStyle = '#7fb6ff'; ctx.beginPath(); ctx.arc(x - cell * 0.28, y - cell * 0.28, cell * 0.09, 0, Math.PI * 2); ctx.fill(); }
    if (mark.includes('b')) { ctx.fillStyle = '#ff8a8a'; ctx.beginPath(); ctx.arc(x + cell * 0.28, y + cell * 0.28, cell * 0.09, 0, Math.PI * 2); ctx.fill(); }
  });
  const count = (k) => history.filter((x) => x[0] === k).length;
  const y = top + rows * cell + 46;
  ctx.font = '700 28px Georgia, serif';
  [['PLAYER', 'P', '#7fb6ff'], ['BANKER', 'B', '#ff7a7a'], ['TIE', 'T', '#6fe0a0']].forEach(([label, k, col], i) => {
    ctx.fillStyle = col;
    ctx.fillText(`${label} ${count(k)}`, w * (0.2 + i * 0.3), y);
  });
  const short = (n) => (n >= 1e6 ? n / 1e6 + 'M' : n >= 1000 ? n / 1000 + 'K' : String(n));
  ctx.fillStyle = '#e8dcc0';
  ctx.font = '600 24px Georgia, serif';
  ctx.fillText(`MIN ${short(min)}  ·  MAX ${short(max)}`, w / 2, h - 30);
}

export function createBaccaratTable() {
  const g = new THREE.Group();
  const GOLD = gold();
  const CHROME = chrome();
  const MAHOGANY = new THREE.MeshPhysicalMaterial({ map: wood('#4a1a0e', '#1a0604').map, roughness: 0.38, clearcoat: 1, clearcoatRoughness: 0.12 });
  const LEATHER = new THREE.MeshStandardMaterial({ color: 0x3a0c10, roughness: 0.42 });
  const LACQUER = new THREE.MeshPhysicalMaterial({ color: 0x0c0a0a, roughness: 0.25, clearcoat: 1 });

  // The baize, its layout drawn on it.
  const felt = new THREE.Mesh(fitUV(new THREE.ShapeGeometry(outline(), 64)), new THREE.MeshStandardMaterial({ map: canvasTex(LAYOUT_W, LAYOUT_H, paintLayout), roughness: 0.92 }));
  felt.rotation.x = -Math.PI / 2;
  felt.position.y = TOP + 0.002;
  felt.receiveShadow = true;
  g.add(felt);
  // The cabinet: mahogany under lacquer, a gilt band below its edge.
  const body = new THREE.Mesh(new THREE.ExtrudeGeometry(outline(m(0.04)), { depth: m(0.2), bevelEnabled: false, curveSegments: 64 }), MAHOGANY);
  body.rotation.x = -Math.PI / 2;
  body.position.y = TOP - m(0.2);
  body.castShadow = true;
  g.add(body);
  const band = new THREE.Mesh(new THREE.ExtrudeGeometry(outline(m(0.045)), { depth: m(0.02), bevelEnabled: false, curveSegments: 64 }), GOLD);
  band.rotation.x = -Math.PI / 2;
  band.position.y = TOP - m(0.22);
  g.add(band);
  // The armrest round the players' curve, and the brass nails under it.
  const pts = [];
  for (let k = 0; k <= 80; k++) pts.push(onCurve(-Math.PI / 2 + (k / 80) * Math.PI, 1.0).add(new THREE.Vector3(0, 0, 0)));
  const scale = (p, by) => new THREE.Vector3(p.x * (1 + by / RX), p.y, p.z * (1 + by / RZ));
  const rail = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map((p) => scale(p, m(0.035)))), 160, m(0.06), 14, false), LEATHER);
  rail.position.y = TOP + m(0.02);
  rail.castShadow = true;
  g.add(rail);
  // At each seat a chip tray let into the armrest: a mahogany well lined
  // in black baize, its edge trimmed in brass, the leather round it.
  const BAIZE = new THREE.MeshStandardMaterial({ color: 0x0b0d0c, roughness: 0.95 });
  const TL = m(0.27), TW = m(0.095), WALL = m(0.01), TOPY = TOP + m(0.088);
  BACCARAT_SEATS_3D.forEach((seat) => {
    const tray = new THREE.Group();
    tray.position.copy(railPoint(seat.t));
    tray.rotation.y = seat.trayAngle;
    const floor = new THREE.Mesh(new THREE.BoxGeometry(TL, m(0.01), TW), BAIZE);
    floor.position.y = TRAY_FLOOR - m(0.005);
    floor.receiveShadow = true;
    tray.add(floor);
    // The walls go down into the leather, so no gap shows under them.
    const BASE = TOP + m(0.04);
    const wallH = TOPY - BASE;
    [[TL + WALL * 2, WALL, 0, TW / 2 + WALL / 2], [TL + WALL * 2, WALL, 0, -TW / 2 - WALL / 2], [WALL, TW, TL / 2 + WALL / 2, 0], [WALL, TW, -TL / 2 - WALL / 2, 0]].forEach(([w, d, x, z]) => {
      const wall = new THREE.Mesh(new THREE.BoxGeometry(w, wallH, d), MAHOGANY);
      wall.position.set(x, BASE + wallH / 2, z);
      wall.castShadow = true;
      tray.add(wall);
      const trim = new THREE.Mesh(new THREE.BoxGeometry(w + 0.002, m(0.004), d + 0.002), GOLD);
      trim.position.set(x, TOPY, z);
      tray.add(trim);
    });
    g.add(tray);
  });
  const nailPts = pts.map((p) => scale(p, m(0.075)));
  const nails = new THREE.InstancedMesh(new THREE.SphereGeometry(m(0.008), 8, 6), new THREE.MeshStandardMaterial({ color: 0xc8a050, roughness: 0.25, metalness: 0.95 }), nailPts.length);
  const nm = new THREE.Matrix4();
  nailPts.forEach((p, i) => { nm.makeTranslation(p.x, TOP - m(0.04), p.z); nails.setMatrixAt(i, nm); });
  g.add(nails);
  // Two pedestals of black lacquer banded in gold.
  [-1, 1].forEach((s) => {
    const ped = new THREE.Mesh(new THREE.CylinderGeometry(m(0.14), m(0.22), -FLOOR_Y - m(0.22), 32), LACQUER);
    ped.position.set(s * m(0.95), (FLOOR_Y + TOP - m(0.22)) / 2, m(0.25));
    ped.castShadow = true;
    g.add(ped);
    [FLOOR_Y + m(0.03), FLOOR_Y + m(0.5)].forEach((y, k) => {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(k ? m(0.16) : m(0.22), m(0.012), 8, 48), GOLD);
      ring.rotation.x = Math.PI / 2;
      ring.position.set(s * m(0.95), y, m(0.25));
      g.add(ring);
    });
    const foot = new THREE.Mesh(new THREE.CylinderGeometry(m(0.3), m(0.34), m(0.05), 40), LACQUER);
    foot.position.set(s * m(0.95), FLOOR_Y + m(0.025), m(0.25));
    g.add(foot);
  });

  // ---------- the dealer's side ----------
  const shoe = createCardShoe();
  shoe.position.set(m(0.92), TOP, -D + m(0.18));
  shoe.rotation.y = 0.3;
  g.add(shoe);
  shoe.updateMatrixWorld(true);
  const shoeMouth = shoe.localToWorld(SHOE_MOUTH.clone());
  const discard = createDiscardHolder();
  discard.position.set(-m(0.92), TOP, -D + m(0.2));
  discard.rotation.y = -0.3;
  g.add(discard);
  // The dealer's float, let into the felt before them.
  const tray = new THREE.Mesh(new THREE.BoxGeometry(m(0.56), m(0.02), m(0.12)), new THREE.MeshStandardMaterial({ color: 0x120c08, roughness: 0.7 }));
  tray.position.set(0, TOP + m(0.004), -D + m(0.42));
  g.add(tray);
  const trayRim = new THREE.Mesh(new THREE.BoxGeometry(m(0.58), m(0.016), m(0.14)), CHROME);
  trayRim.position.set(0, TOP + m(0.002), -D + m(0.42));
  g.add(trayRim);

  // ---------- the scoreboard ----------
  const boardCanvas = document.createElement('canvas');
  boardCanvas.width = 768;
  boardCanvas.height = 560;
  const boardTex = new THREE.CanvasTexture(boardCanvas);
  boardTex.colorSpace = THREE.SRGBColorSpace;
  boardTex.anisotropy = 8;
  const board = new THREE.Group();
  board.position.set(RX + m(0.45), 0, -D + m(0.05));
  board.rotation.y = -0.75;
  g.add(board);
  const pillar = new THREE.Mesh(new THREE.CylinderGeometry(m(0.035), m(0.045), m(1.2), 16), CHROME);
  pillar.position.y = FLOOR_Y + m(0.6);
  board.add(pillar);
  const bfoot = new THREE.Mesh(new THREE.CylinderGeometry(m(0.18), m(0.22), m(0.04), 32), CHROME);
  bfoot.position.y = FLOOR_Y + m(0.02);
  board.add(bfoot);
  const housing = new THREE.Mesh(new THREE.BoxGeometry(m(0.74), m(0.56), m(0.06)), new THREE.MeshStandardMaterial({ color: 0x0a0a0c, roughness: 0.2, metalness: 0.5 }));
  housing.position.y = FLOOR_Y + m(1.45);
  board.add(housing);
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(m(0.7), m(0.51)), new THREE.MeshBasicMaterial({ map: boardTex, toneMapped: false }));
  screen.position.set(0, FLOOR_Y + m(1.45), m(0.031));
  board.add(screen);
  const cap = new THREE.Mesh(new THREE.BoxGeometry(m(0.76), m(0.03), m(0.07)), GOLD);
  cap.position.y = FLOOR_Y + m(1.74);
  board.add(cap);
  let boardKey = '';
  function setHistory(history, min, max) {
    const key = JSON.stringify([history, min, max]);
    if (key === boardKey) return;
    boardKey = key;
    paintBoard(boardCanvas.getContext('2d'), boardCanvas.width, boardCanvas.height, history || [], min, max);
    boardTex.needsUpdate = true;
  }
  setHistory([], 100, 2000);

  addTableGlow(g, {
    footOuter: flipped(outline(-m(0.5))),
    footInner: flipped(outline(-m(0.54))),
    w: 2 * RX + m(2.2), d: RZ + D + m(2.2), cz: (RZ - D) / 2,
    edge: { outer: flipped(outline(m(0.05))), inner: flipped(outline(m(0.0))), y: TOP - m(0.24) },
  });

  g.userData.shoeMouth = shoeMouth;
  g.userData.setHistory = setHistory;
  return g;
}
