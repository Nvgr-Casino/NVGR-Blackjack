import * as THREE from 'three';
import { FLOOR_Y, m } from './scale.js';
import { canvasTex, grain, gold, chrome, wood } from './casinoKit.js';
import { addTableGlow } from './tableLux.js';
import { WHEEL_ORDER, ROULETTE_SEATS, colorOf } from '../roulette/rules.js';
import {
  BOARD_W, BOARD_H, MARGIN, ZERO_W, COLUMN_W, ROW_H, BAND_H, CELL_W, GRID_X, GRID_BOTTOM,
  EVEN_CHANCES, spotOf, cellX, cellY, numberFill,
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

export const ROULETTE_L = m(3.3);
export const ROULETTE_W = m(1.5);
const L = ROULETTE_L, W = ROULETTE_W;
const TOP = 0;
export const WHEEL_X = -L / 2 + m(0.62);
const LAYOUT_W = L - m(1.42);
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
  position: new THREE.Vector3(WHEEL_X + m(0.78), 0, -W / 2 - m(0.34)),
};
// Where the camera looks: between the wheel and the layout.
export const ROULETTE_LOOK = new THREE.Vector3(m(0.1), 0, 0);

// Each seat's wheel chips, in a colour of its own, as roulette is played.
export const SEAT_CHIP_COLORS = ['#c0392b', '#1f6fd1', '#1a9a4a', '#e0b02a', '#8a3ad0', '#e06a1a'];

// ---------- the felt ----------
function paintLayout(ctx) {
  ctx.fillStyle = '#0d5a31';
  ctx.fillRect(0, 0, BOARD_W, BOARD_H);
  grain(ctx, BOARD_W, BOARD_H, 12);
  ctx.strokeStyle = '#f2efe6';
  ctx.lineWidth = 5;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const label = (t, x, y, size, color = '#f2efe6', rot = 0) => {
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
    label('2 to 1', BOARD_W - MARGIN - COLUMN_W / 2, y + ROW_H / 2, 44, '#f2efe6', -Math.PI / 2);
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

// The wheel's face: the pockets numbered round the rim, frets between,
// the cone inside. Pocket i is centred at angle i·step − 90° on the canvas.
function paintWheel(ctx, S) {
  const c = S / 2;
  const cone = ctx.createRadialGradient(c, c, 0, c, c, c * 0.72);
  cone.addColorStop(0, '#9a6a34');
  cone.addColorStop(1, '#3a1a0a');
  ctx.fillStyle = cone;
  ctx.fillRect(0, 0, S, S);
  const step = (Math.PI * 2) / 37;
  WHEEL_ORDER.forEach((n, i) => {
    const a0 = i * step - Math.PI / 2 - step / 2, a1 = a0 + step;
    ctx.fillStyle = numberFill(n);
    ctx.beginPath();
    ctx.arc(c, c, c * 0.98, a0, a1);
    ctx.arc(c, c, c * 0.72, a1, a0, true);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.32)';
    ctx.beginPath();
    ctx.arc(c, c, c * 0.84, a0, a1);
    ctx.arc(c, c, c * 0.72, a1, a0, true);
    ctx.closePath();
    ctx.fill();
    ctx.save();
    ctx.translate(c, c);
    ctx.rotate(a0 + step / 2 + Math.PI / 2);
    ctx.fillStyle = '#ffffff';
    ctx.font = `700 ${S * 0.034}px Georgia, serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(n), 0, -c * 0.91);
    ctx.restore();
    ctx.strokeStyle = '#e2e6ea';
    ctx.lineWidth = S * 0.004;
    ctx.beginPath();
    ctx.moveTo(c + Math.cos(a0) * c * 0.72, c + Math.sin(a0) * c * 0.72);
    ctx.lineTo(c + Math.cos(a0) * c * 0.98, c + Math.sin(a0) * c * 0.98);
    ctx.stroke();
  });
  [[0.98, 0.006], [0.84, 0.003], [0.72, 0.006]].forEach(([r, lw]) => {
    ctx.strokeStyle = '#e2e6ea';
    ctx.lineWidth = S * lw;
    ctx.beginPath();
    ctx.arc(c, c, c * r, 0, Math.PI * 2);
    ctx.stroke();
  });
  ctx.strokeStyle = '#d4af62';
  ctx.lineWidth = S * 0.01;
  for (let k = 0; k < 4; k++) {
    const a = (k / 4) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(c + Math.cos(a) * c * 0.12, c + Math.sin(a) * c * 0.12);
    ctx.lineTo(c + Math.cos(a) * c * 0.66, c + Math.sin(a) * c * 0.66);
    ctx.stroke();
  }
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

const POCKET_STEP = (Math.PI * 2) / 37;
// The angle, round the wheel's axis in the table's x–z plane, of a pocket
// on the rotor when the rotor itself is turned by `rotor`.
const pocketAngle = (number, rotor) => WHEEL_ORDER.indexOf(number) * POCKET_STEP - Math.PI / 2 - rotor;

export function createRouletteTable() {
  const g = new THREE.Group();
  const GOLD = gold();
  const CHROME = chrome();
  const MAHOGANY = wood('#4a1a0e', '#1a0604');
  const LEATHER = new THREE.MeshStandardMaterial({ color: 0x22100a, roughness: 0.45 });
  const FELT = new THREE.MeshStandardMaterial({ color: 0x0d5a31, roughness: 0.95 });

  // ---------- the cabinet ----------
  const body = new THREE.Mesh(new THREE.BoxGeometry(L - m(0.14), m(0.24), W - m(0.14)), MAHOGANY);
  body.position.y = TOP - m(0.14);
  body.castShadow = true;
  body.receiveShadow = true;
  g.add(body);
  const apron = new THREE.Mesh(new THREE.BoxGeometry(L - m(0.18), m(0.025), W - m(0.18)), GOLD);
  apron.position.y = TOP - m(0.27);
  g.add(apron);
  const legGeo = new THREE.LatheGeometry([[0, 0], [0.05, 0], [0.055, 0.06], [0.032, 0.2], [0.048, 0.4], [0.036, 0.5], [0.065, 0.56], [0, 0.56]].map(([r, h]) => new THREE.Vector2(m(r), m(h))), 16);
  [[-1, -1], [1, -1], [-1, 1], [1, 1], [0, -1], [0, 1]].forEach(([sx, sz]) => {
    const leg = new THREE.Mesh(legGeo, MAHOGANY);
    leg.position.set(sx * (L / 2 - m(0.22)), FLOOR_Y, sz * (W / 2 - m(0.22)));
    leg.castShadow = true;
    g.add(leg);
  });
  const felt = new THREE.Mesh(new THREE.ShapeGeometry(roundedRect(L - m(0.16), W - m(0.16), m(0.1))), FELT);
  felt.rotation.x = -Math.PI / 2;
  felt.position.y = TOP;
  felt.receiveShadow = true;
  g.add(felt);
  const railShape = roundedRect(L, W, m(0.16));
  railShape.holes.push(roundedRect(L - m(0.16), W - m(0.16), m(0.1)));
  const rail = new THREE.Mesh(new THREE.ExtrudeGeometry(railShape, { depth: m(0.05), bevelEnabled: true, bevelThickness: m(0.028), bevelSize: m(0.022), bevelSegments: 5, curveSegments: 14 }), LEATHER);
  rail.rotation.x = -Math.PI / 2;
  rail.position.y = TOP - m(0.01);
  rail.castShadow = true;
  g.add(rail);
  // The layout.
  const layoutTex = canvasTex(BOARD_W, BOARD_H, paintLayout);
  const layout = new THREE.Mesh(new THREE.PlaneGeometry(LAYOUT_W, LAYOUT_D), new THREE.MeshStandardMaterial({ map: layoutTex, roughness: 0.95 }));
  layout.rotation.x = -Math.PI / 2;
  layout.position.set(LAYOUT_X, TOP + 0.002, LAYOUT_Z);
  layout.receiveShadow = true;
  g.add(layout);

  // ---------- the wheel ----------
  const bowl = new THREE.Mesh(new THREE.LatheGeometry([[0.5, 0], [0.5, 0.1], [0.48, 0.118], [0.44, 0.108], [0.375, 0.07], [0.35, 0.06], [0, 0.06]].map(([r, h]) => new THREE.Vector2(m(r), m(h))), 72), MAHOGANY);
  bowl.position.set(WHEEL_X, TOP - m(0.02), 0);
  bowl.castShadow = true;
  g.add(bowl);
  const trim = new THREE.Mesh(new THREE.TorusGeometry(m(0.495), m(0.012), 6, 72), GOLD);
  trim.rotation.x = Math.PI / 2;
  trim.position.set(WHEEL_X, TOP + m(0.098), 0);
  g.add(trim);
  // Diamonds on the track, that knock the ball about.
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2;
    const d = new THREE.Mesh(new THREE.OctahedronGeometry(m(0.014)), CHROME);
    d.scale.set(1, 0.5, 2);
    d.position.set(WHEEL_X + Math.cos(a) * m(0.415), TOP + m(0.07), Math.sin(a) * m(0.415));
    d.rotation.y = -a;
    g.add(d);
  }
  const rotor = new THREE.Group();
  rotor.position.set(WHEEL_X, TOP + m(0.045), 0);
  g.add(rotor);
  const face = new THREE.Mesh(new THREE.CircleGeometry(m(0.35), 74), new THREE.MeshStandardMaterial({ map: canvasTex(1024, 1024, paintWheel), roughness: 0.3, metalness: 0.1 }));
  face.rotation.x = -Math.PI / 2;
  rotor.add(face);
  const turret = new THREE.Mesh(new THREE.LatheGeometry([[0, 0.13], [0.012, 0.12], [0.02, 0.075], [0.012, 0.055], [0.042, 0.022], [0.052, 0], [0, 0]].map(([r, h]) => new THREE.Vector2(m(r), m(h))), 24), CHROME);
  rotor.add(turret);
  for (let k = 0; k < 4; k++) {
    const a = (k / 4) * Math.PI * 2;
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(m(0.007), m(0.007), m(0.12), 8), CHROME);
    arm.rotation.set(0, -a, Math.PI / 2);
    arm.position.set(Math.cos(a) * m(0.06), m(0.08), Math.sin(a) * m(0.06));
    rotor.add(arm);
    const knob = new THREE.Mesh(new THREE.SphereGeometry(m(0.013), 10, 8), CHROME);
    knob.position.set(Math.cos(a) * m(0.12), m(0.08), Math.sin(a) * m(0.12));
    rotor.add(knob);
  }
  const ball = new THREE.Mesh(new THREE.SphereGeometry(m(0.011), 14, 10), new THREE.MeshStandardMaterial({ color: 0xf6f2ea, roughness: 0.18 }));
  ball.castShadow = true;
  g.add(ball);

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
    edge: { outer: roundedRect(L + 0.01, W + 0.01, m(0.16)), inner: roundedRect(L - m(0.06), W - m(0.06), m(0.14)), y: TOP - m(0.06) },
  });

  // ---------- the spin ----------
  const SLOW = 0.45;                 // the wheel's own idle turn, radians a second
  const RT = m(0.43), RP = m(0.3);   // the ball's track, and its pocket's radius
  const YT = TOP + m(0.083), YP = TOP + m(0.05);
  let base = 0;                      // the rotor's angle at `baseAt`
  let baseAt = 0;
  let spin = null;                   // { start, T, land, number, boost, laps }
  let resting = null;                // the number the ball sits in
  const rotorAt = (now) => {
    let a = base + SLOW * (now - baseAt) / 1000;
    if (spin) {
      const t = Math.min(1, (now - spin.start) / spin.T);
      a += spin.boost * (1 - (1 - t) * (1 - t));
    }
    return a;
  };
  function placeBall(angle, r, y) {
    ball.position.set(WHEEL_X + Math.cos(angle) * r, y, Math.sin(angle) * r);
  }
  function update(now) {
    const a = rotorAt(now);
    rotor.rotation.y = a;
    if (spin) {
      const t = now - spin.start;
      if (t < spin.land) {
        // The ball's run: fast, slowing to meet the pocket it will fall in.
        const k = Math.max(0, t) / spin.land;
        const landAngle = pocketAngle(spin.number, rotorAt(spin.start + spin.land));
        const angle = landAngle - spin.laps * (1 - k) * (1 - k);
        // On the track until it loses its pace, then down the cone.
        const drop = Math.max(0, (k - 0.72) / 0.28);
        const ease = drop * drop * (3 - 2 * drop);
        const bounce = drop > 0 ? Math.abs(Math.sin(drop * Math.PI * 4)) * (1 - drop) * m(0.025) : 0;
        placeBall(angle, RT + (RP - RT) * ease, YT + (YP - YT) * ease + bounce);
      } else {
        // In its pocket, riding round with the wheel.
        placeBall(pocketAngle(spin.number, a), RP, YP);
      }
    } else if (resting !== null) {
      placeBall(pocketAngle(resting, a), RP, YP);
    } else {
      placeBall(Math.PI * 0.25, RT, YT);
    }
  }
  // Spins to `number`, the spin having begun at `start` (a Date.now() time,
  // the same for every client) and running `ms`.
  function spinTo(number, start, ms) {
    if (spin && spin.start === start && spin.number === number) return;
    const now = Date.now();
    base = rotorAt(now);
    baseAt = now;
    if (spin) { base -= spin.boost; }
    // Re-anchored so the boost starts from nothing at `start`.
    base -= SLOW * (now - start) / 1000;
    baseAt = start;
    base = ((base % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
    spin = { start, T: ms, land: ms * 0.82, number, boost: Math.PI * 5, laps: Math.PI * 14 };
    resting = null;
  }
  // The ball left where it is, in a pocket, or on the track.
  function rest(number) {
    if (spin) {
      const now = Date.now();
      if (now - spin.start < spin.T) return;
      base = rotorAt(now);
      baseAt = now;
      spin = null;
    }
    resting = number === undefined ? null : number;
  }
  function showDolly(number) {
    if (number === null || number === undefined) { dolly.visible = false; return; }
    const at = spotWorld('n:' + number);
    dolly.position.set(at.x, TOP + 0.003, at.z);
    dolly.visible = true;
  }

  g.userData.wheel = { update, spinTo, rest, showDolly, get spinning() { return !!spin && Date.now() - spin.start < spin.T; } };
  return g;
}

export { colorOf };
