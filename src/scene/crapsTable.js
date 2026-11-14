import * as THREE from 'three';
import { FLOOR_Y, m } from './scale.js';
import { canvasTex, gold, wood } from './casinoKit.js';
import { addTableGlow, PEDESTAL_LACQUER } from './tableLux.js';
import { createDice } from './crapsDice.js';
import { CRAPS_SEATS } from '../craps/rules.js';
import { BOARD_W, BOARD_H, paintLayout, puckSpot } from '../craps/layout.js';

// The craps table: a deep tub of green baize walled in diamond-studded
// rubber for the dice to rebound from, under a padded leather armrest and a
// polished wooden chip rail; a mahogany cabinet with gilt bands on a black
// lacquer plinth, glowing at its foot like the house's other tables. The
// stickman stands across from the players by the propositions; the puck
// marks the point; a board beside him keeps the rolls.

const PHONE = window.matchMedia('(pointer: coarse)').matches || window.innerWidth < 820;
export const FELT_W = m(2.7);
export const FELT_D = m(1.35);
const TOP = 0;
const WALL_H = m(0.17);           // the tub: felt to armrest
const TUB_W = FELT_W + m(0.16), TUB_D = FELT_D + m(0.16), TUB_R = m(0.34);
const ARM = m(0.11), RAIL = m(0.13);
const OUT_W = TUB_W + 2 * (ARM + RAIL), OUT_D = TUB_D + 2 * (ARM + RAIL), OUT_R = TUB_R + ARM + RAIL;

// A spot on the board (layout units) on the felt, in the table's frame.
export function boardToTable(x, y, lift = 0.004) {
  return new THREE.Vector3(-FELT_W / 2 + (x / BOARD_W) * FELT_W, TOP + lift, -FELT_D / 2 + (y / BOARD_H) * FELT_D);
}

// Six chairs: four along the players' side, one at each end.
export const CRAPS_SEATS_3D = Array.from({ length: CRAPS_SEATS }, (_, index) => {
  const end = index === 0 ? -1 : index === CRAPS_SEATS - 1 ? 1 : 0;
  const outward = end ? new THREE.Vector3(end, 0, 0) : new THREE.Vector3(0, 0, 1);
  const fx = [-0.42, -0.14, 0.14, 0.42][index - 1];
  const position = end
    ? new THREE.Vector3(end * (OUT_W / 2 + m(0.42)), 0, m(0.12))
    : new THREE.Vector3(fx * FELT_W * 1.62, 0, OUT_D / 2 + m(0.42));
  // Along the bands, where this player's line bets go (0 to 1).
  const seatX = end ? (end < 0 ? 0.02 : 0.98) : 0.5 + fx * 1.62 * 0.98;
  return {
    index, position, outward, seatX,
    facingAngle: Math.atan2(-outward.x, -outward.z),
    // The player's chips, in the rail's groove before them.
    stackSpot: end
      ? new THREE.Vector3(end * (TUB_W / 2 + ARM + RAIL * 0.5), WALL_H + m(0.035), m(0.12))
      : new THREE.Vector3(position.x, WALL_H + m(0.035), TUB_D / 2 + ARM + RAIL * 0.5),
    // Where the dice leave the shooter's hand, over the near side of the tub.
    throwFrom: end
      ? new THREE.Vector3(end * (FELT_W / 2 - m(0.1)), TOP + m(0.22), m(0.1))
      : new THREE.Vector3(position.x, TOP + m(0.22), FELT_D / 2 - m(0.05)),
  };
});
export const CRAPS_DEALER = { position: new THREE.Vector3(0, 0, -OUT_D / 2 - m(0.3)) };
export const CRAPS_LOOK = new THREE.Vector3(0, 0, -m(0.08));
export const DICE_BOUNDS = { x0: -FELT_W / 2, x1: FELT_W / 2, z0: -TUB_D / 2, z1: TUB_D / 2 };

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
// A ring between two outlines, flat.
function ring(outer, inner) {
  const s = new THREE.Shape(outer.getPoints(48));
  s.holes.push(new THREE.Path(inner.getPoints(48).reverse()));
  return s;
}
// A wall standing along an outline (shape y is the table's z), facing in.
function wall(outline, height, material, inward = true) {
  const pts = outline.getSpacedPoints(160);
  const pos = [], uv = [], idx = [];
  let run = 0;
  pts.forEach((p, i) => {
    if (i) run += p.distanceTo(pts[i - 1]);
    pos.push(p.x, 0, p.y, p.x, height, p.y);
    uv.push(run / m(0.16), 0, run / m(0.16), 1);
    if (i) {
      const a = (i - 1) * 2;
      if (inward) idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      else idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
    }
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return new THREE.Mesh(g, material);
}

// The rubber on the tub's walls: rows of little pyramids.
function pyramidTexture() {
  const t = canvasTex(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#171515'; ctx.fillRect(0, 0, w, h);
    const s = 32;
    for (let y = 0; y < h; y += s) for (let x = 0; x < w; x += s) {
      const cx = x + s / 2, cy = y + s / 2;
      const tri = (pts, c) => { ctx.fillStyle = c; ctx.beginPath(); ctx.moveTo(...pts[0]); ctx.lineTo(...pts[1]); ctx.lineTo(...pts[2]); ctx.closePath(); ctx.fill(); };
      tri([[x, y], [x + s, y], [cx, cy]], '#3a3434');
      tri([[x + s, y], [x + s, y + s], [cx, cy]], '#262222');
      tri([[x + s, y + s], [x, y + s], [cx, cy]], '#0c0a0a');
      tri([[x, y + s], [x, y], [cx, cy]], '#1e1a1a');
    }
  }, { repeat: true });
  t.repeat.set(1, 1);
  return t;
}

// The board by the stickman: the point, and the rolls before.
function paintBoard(ctx, w, h, { history = [], point = null } = {}) {
  const bg = ctx.createLinearGradient(0, 0, 0, h);
  bg.addColorStop(0, '#0c0a10'); bg.addColorStop(1, '#16121c');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = '#d8b46a'; ctx.font = "700 46px 'Cinzel', Georgia, serif";
  ctx.fillText('NVGR CRAPS', w / 2, 44);
  ctx.fillStyle = 'rgba(216,180,106,0.5)'; ctx.fillRect(30, 80, w - 60, 2);
  // The puck, large.
  ctx.fillStyle = '#8a8070'; ctx.font = "600 24px 'Cinzel', Georgia, serif";
  ctx.fillText('POINT', 165, 116);
  ctx.beginPath(); ctx.arc(165, 258, 112, 0, Math.PI * 2);
  ctx.fillStyle = point ? '#f4f1ea' : '#141414'; ctx.fill();
  ctx.lineWidth = 8; ctx.strokeStyle = 'rgba(216,180,106,0.85)'; ctx.stroke();
  ctx.fillStyle = point ? '#141414' : '#f4f1ea';
  if (point) { ctx.font = '800 120px Georgia, serif'; ctx.fillText(String(point), 165, 266); ctx.font = '700 26px Georgia, serif'; ctx.fillText('ON', 165, 336); }
  else { ctx.font = '800 56px Georgia, serif'; ctx.fillText('OFF', 165, 262); }
  ctx.fillStyle = 'rgba(216,180,106,0.35)'; ctx.fillRect(320, 104, 2, 300);
  // The rolls, newest first, sevens in red.
  ctx.fillStyle = '#8a8070'; ctx.font = "600 24px 'Cinzel', Georgia, serif";
  ctx.fillText('LAST ROLLS', 660, 116);
  history.slice(0, 15).forEach((n, k) => {
    const col = k % 5, row = Math.floor(k / 5);
    const x = 400 + col * 132, y = 180 + row * 96;
    ctx.beginPath(); ctx.arc(x, y, 40, 0, Math.PI * 2);
    ctx.fillStyle = n === 7 ? '#b3122e' : n === 2 || n === 3 || n === 12 ? '#2b2b30' : '#0f5a3c'; ctx.fill();
    ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(216,180,106,0.8)'; ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.font = '800 40px Georgia, serif'; ctx.fillText(String(n), x, y + 2);
  });
  ctx.fillStyle = 'rgba(216,180,106,0.5)'; ctx.fillRect(30, 430, w - 60, 2);
  const sevens = history.slice(0, 20).filter((n) => n === 7).length;
  ctx.textAlign = 'left'; ctx.font = '700 32px Georgia, serif';
  ctx.fillStyle = '#ff5a6e'; ctx.fillText(`SEVENS ${history.length ? sevens : '–'}`, 40, 484);
  ctx.fillStyle = '#e8dcc0'; ctx.textAlign = 'right';
  ctx.fillText(history.length ? `${Math.min(20, history.length)} ROLLS` : 'COMING OUT', w - 40, 484);
}

export function createCrapsTable() {
  const g = new THREE.Group();
  const GOLD = gold();
  const MAHOGANY = PHONE
    ? new THREE.MeshStandardMaterial({ map: wood('#4a1a0e', '#1a0604').map, roughness: 0.4 })
    : new THREE.MeshPhysicalMaterial({ map: wood('#4a1a0e', '#1a0604').map, roughness: 0.38, clearcoat: 1, clearcoatRoughness: 0.12 });
  const RAILWOOD = PHONE
    ? new THREE.MeshStandardMaterial({ map: wood('#5a2412', '#200804', { across: true }).map, roughness: 0.3 })
    : new THREE.MeshPhysicalMaterial({ map: wood('#5a2412', '#200804', { across: true }).map, roughness: 0.28, clearcoat: 1, clearcoatRoughness: 0.06 });
  const LEATHER = new THREE.MeshStandardMaterial({ color: 0x1c0d0b, roughness: 0.45 });
  const RUBBER = new THREE.MeshStandardMaterial({ map: pyramidTexture(), roughness: 0.7, side: THREE.DoubleSide });
  MAHOGANY.side = THREE.DoubleSide;
  const LACQUER = PEDESTAL_LACQUER.clone();
  LACQUER.side = THREE.DoubleSide;

  // ---------- the tub ----------
  const tub = roundedRect(TUB_W, TUB_D, TUB_R);
  const baize = new THREE.Mesh(new THREE.ShapeGeometry(tub, 24), new THREE.MeshStandardMaterial({ color: 0x0b3f2b, roughness: 0.95 }));
  baize.rotation.x = -Math.PI / 2;
  baize.position.y = TOP - 0.001;
  baize.receiveShadow = true;
  g.add(baize);
  // The printed layout.
  const layoutTex = canvasTex(BOARD_W, BOARD_H, (ctx) => paintLayout(ctx));
  const layout = new THREE.Mesh(new THREE.PlaneGeometry(FELT_W, FELT_D), new THREE.MeshStandardMaterial({ map: layoutTex, roughness: 0.93 }));
  layout.rotation.x = -Math.PI / 2;
  layout.position.y = TOP + 0.001;
  layout.receiveShadow = true;
  g.add(layout);
  // The walls, studded rubber all round, for the dice to strike.
  const walls = wall(tub, WALL_H, RUBBER);
  RUBBER.map.repeat.set(1, 1);
  g.add(walls);

  // ---------- the rails ----------
  // The armrest: padded leather, rolled over the tub's edge.
  const armOuter = roundedRect(TUB_W + 2 * ARM, TUB_D + 2 * ARM, TUB_R + ARM);
  const arm = new THREE.Mesh(new THREE.ExtrudeGeometry(ring(armOuter, roundedRect(TUB_W + m(0.02), TUB_D + m(0.02), TUB_R)), { depth: m(0.03), bevelEnabled: true, bevelThickness: m(0.03), bevelSize: m(0.022), bevelSegments: 6, curveSegments: 24 }), LEATHER);
  arm.rotation.x = -Math.PI / 2;
  arm.position.y = WALL_H - m(0.005);
  arm.castShadow = true;
  g.add(arm);
  // The chip rail: polished wood, a groove along it for the players' chips.
  const railOuter = roundedRect(OUT_W, OUT_D, OUT_R);
  const railTop = new THREE.Mesh(new THREE.ExtrudeGeometry(ring(railOuter, armOuter), { depth: m(0.02), bevelEnabled: true, bevelThickness: m(0.008), bevelSize: m(0.008), bevelSegments: 3, curveSegments: 24 }), RAILWOOD);
  railTop.rotation.x = -Math.PI / 2;
  railTop.position.y = WALL_H + m(0.005);
  g.add(railTop);
  const groove = new THREE.Mesh(new THREE.ExtrudeGeometry(ring(roundedRect(OUT_W - RAIL * 0.6, OUT_D - RAIL * 0.6, OUT_R - RAIL * 0.3), roundedRect(OUT_W - RAIL * 1.4, OUT_D - RAIL * 1.4, OUT_R - RAIL * 0.7)), { depth: m(0.004), bevelEnabled: false, curveSegments: 24 }), new THREE.MeshStandardMaterial({ color: 0x0c0605, roughness: 0.6 }));
  groove.rotation.x = -Math.PI / 2;
  groove.position.y = WALL_H + m(0.034);
  g.add(groove);
  // A line of gold round the rail's outer edge.
  const goldEdge = new THREE.Mesh(new THREE.ExtrudeGeometry(ring(roundedRect(OUT_W + m(0.012), OUT_D + m(0.012), OUT_R + m(0.006)), railOuter), { depth: m(0.016), bevelEnabled: false, curveSegments: 24 }), GOLD);
  goldEdge.rotation.x = -Math.PI / 2;
  goldEdge.position.y = WALL_H + m(0.012);
  g.add(goldEdge);

  // ---------- the cabinet ----------
  const apronH = m(0.34);
  const apron = wall(railOuter, apronH, MAHOGANY, false);
  apron.position.y = WALL_H - apronH + m(0.01);
  apron.castShadow = true;
  g.add(apron);
  // Gilt bands round the apron.
  [WALL_H - m(0.05), WALL_H - apronH + m(0.04)].forEach((y) => {
    const b = new THREE.Mesh(new THREE.ExtrudeGeometry(ring(roundedRect(OUT_W + m(0.01), OUT_D + m(0.01), OUT_R + m(0.005)), roundedRect(OUT_W - m(0.01), OUT_D - m(0.01), OUT_R - m(0.005))), { depth: m(0.014), bevelEnabled: false, curveSegments: 24 }), GOLD);
    b.rotation.x = -Math.PI / 2;
    b.position.y = y;
    g.add(b);
  });
  // The underside of the cabinet, closed.
  const under = new THREE.Mesh(new THREE.ShapeGeometry(railOuter, 24), MAHOGANY);
  under.rotation.x = Math.PI / 2;
  under.position.y = WALL_H - apronH + m(0.01);
  g.add(under);
  // The plinth down to the floor: black lacquer, a gilt band, the glow.
  const plinthOutline = roundedRect(OUT_W - m(0.7), OUT_D - m(0.5), OUT_R * 0.6);
  const plinthTop = WALL_H - apronH + m(0.01);
  const plinth = wall(plinthOutline, plinthTop - FLOOR_Y, LACQUER, false);
  plinth.position.y = FLOOR_Y;
  plinth.castShadow = true;
  g.add(plinth);
  const pband = new THREE.Mesh(new THREE.ExtrudeGeometry(ring(roundedRect(OUT_W - m(0.69), OUT_D - m(0.49), OUT_R * 0.6 + m(0.005)), plinthOutline), { depth: m(0.02), bevelEnabled: false, curveSegments: 24 }), GOLD);
  pband.rotation.x = -Math.PI / 2;
  pband.position.y = FLOOR_Y + m(0.12);
  g.add(pband);
  addTableGlow(g, {
    footOuter: roundedRect(OUT_W - m(0.62), OUT_D - m(0.42), OUT_R * 0.6 + m(0.04)),
    footInner: roundedRect(OUT_W - m(0.68), OUT_D - m(0.48), OUT_R * 0.6),
    w: OUT_W + m(1.4), d: OUT_D + m(1.4),
  });

  // ---------- the stickman's things ----------
  // The stick, lying on the rail before him.
  const stick = new THREE.Group();
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(m(0.006), m(0.006), m(1.05), 10), new THREE.MeshStandardMaterial({ color: 0xc89a5a, roughness: 0.5 }));
  shaft.rotation.z = Math.PI / 2;
  stick.add(shaft);
  const hook = new THREE.Mesh(new THREE.TorusGeometry(m(0.035), m(0.007), 8, 16, Math.PI), shaft.material);
  hook.position.x = m(0.525);
  hook.rotation.x = Math.PI / 2;
  stick.add(hook);
  stick.position.set(-m(0.2), WALL_H + m(0.06), -OUT_D / 2 + m(0.08));
  g.add(stick);
  // The puck: white ON, black OFF.
  const puckFace = (on) => canvasTex(128, 128, (ctx, w) => {
    ctx.fillStyle = on ? '#f4f1ea' : '#121212';
    ctx.beginPath(); ctx.arc(w / 2, w / 2, w / 2, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = on ? '#141414' : '#f4f1ea'; ctx.lineWidth = 6;
    ctx.beginPath(); ctx.arc(w / 2, w / 2, w * 0.42, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = on ? '#141414' : '#f4f1ea';
    ctx.font = "800 44px 'Cinzel', Georgia, serif"; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(on ? 'ON' : 'OFF', w / 2, w / 2 + 2);
  });
  const puck = new THREE.Mesh(new THREE.CylinderGeometry(m(0.05), m(0.05), m(0.018), 32), [
    new THREE.MeshStandardMaterial({ color: 0x8a8a8a, roughness: 0.4 }),
    new THREE.MeshStandardMaterial({ map: puckFace(true), roughness: 0.4 }),
    new THREE.MeshStandardMaterial({ map: puckFace(false), roughness: 0.4 }),
  ]);
  puck.castShadow = true;
  g.add(puck);
  let puckPoint;
  function setPuck(point, animated = true) {
    if (point === puckPoint) return;
    puckPoint = point;
    const s = puckSpot(point);
    const to = boardToTable(s.x, s.y, m(0.009));
    const flip = point ? 0 : Math.PI;
    if (!animated) { puck.position.copy(to); puck.rotation.x = flip; return; }
    const from = puck.position.clone(), r0 = puck.rotation.x;
    const t0 = performance.now();
    const step = () => {
      const k = Math.min(1, (performance.now() - t0) / 700);
      const e = k * k * (3 - 2 * k);
      puck.position.lerpVectors(from, to, e);
      puck.position.y += Math.sin(k * Math.PI) * m(0.08);
      puck.rotation.x = r0 + (flip - r0) * e;
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }
  setPuck(null, false);

  // ---------- the board ----------
  const BW = m(1.45), BH = (BW * 540) / 1000;
  const board = new THREE.Group();
  const canvas = document.createElement('canvas');
  canvas.width = PHONE ? 1000 : 1400; canvas.height = Math.round((canvas.width * 540) / 1000);
  const ctx = canvas.getContext('2d');
  const k = canvas.width / 1000;
  const boardTex = new THREE.CanvasTexture(canvas);
  boardTex.colorSpace = THREE.SRGBColorSpace;
  boardTex.anisotropy = 16;
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(BW, BH), new THREE.MeshBasicMaterial({ map: boardTex, toneMapped: false }));
  screen.position.y = FLOOR_Y + m(1.55);
  board.add(screen);
  const frame = new THREE.Mesh(new THREE.BoxGeometry(BW + m(0.06), BH + m(0.06), m(0.05)), PEDESTAL_LACQUER);
  frame.position.set(0, screen.position.y, -m(0.03));
  board.add(frame);
  const goldFrame = new THREE.Mesh(new THREE.BoxGeometry(BW + m(0.075), BH + m(0.075), m(0.02)), GOLD);
  goldFrame.position.set(0, screen.position.y, -m(0.045));
  board.add(goldFrame);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(m(0.035), m(0.045), m(1.2), 16), GOLD);
  pole.position.set(0, FLOOR_Y + m(0.6), -m(0.06));
  board.add(pole);
  const foot = new THREE.Mesh(new THREE.CylinderGeometry(m(0.22), m(0.25), m(0.04), 32), PEDESTAL_LACQUER);
  foot.position.set(0, FLOOR_Y + m(0.02), -m(0.06));
  board.add(foot);
  board.position.set(-OUT_W / 2 - m(0.2), 0, -OUT_D / 2 - m(0.55));
  board.rotation.y = 0.32;
  g.add(board);
  let boardKey = '';
  function setBoard(state) {
    const key = JSON.stringify(state);
    if (key === boardKey) return;
    boardKey = key;
    ctx.save(); ctx.scale(k, k);
    paintBoard(ctx, 1000, 540, state);
    ctx.restore();
    boardTex.needsUpdate = true;
  }
  setBoard({ history: [], point: null });
  if (document.fonts) document.fonts.ready.then(() => { const s = JSON.parse(boardKey); boardKey = ''; setBoard(s); });

  // ---------- the dice ----------
  const dice = createDice({ y: TOP, bounds: DICE_BOUNDS });
  g.add(dice);

  g.userData.dice = dice.userData;
  g.userData.setPuck = setPuck;
  g.userData.setBoard = setBoard;
  return g;
}
