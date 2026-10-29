import * as THREE from 'three';
import { FLOOR_Y, m } from './scale.js';
import { BRASS, LEATHER, FELT_THEMES, feltTheme, createBurlTexture, createWoodTexture } from './table.js';
import { drawCasinoCrest } from './crest.js';

// The Hold'em table: a six-seat racetrack oval, about 2.0 m by 1.05 m of
// table, as six-max tables are. Felt inside a burl rim, a band of wood —
// the racetrack — between rim and rail, then the padded armrest, on a
// walnut apron and pedestal. The dealer stands at the middle of the far
// long side (-z); the six seats run clockwise from the dealer's left, as
// the deal and the action do.
//
// Everything a table driver needs to place — seats, each player's cards
// and bets, the board, the pot, the dealer — is described here in world
// space, so the driver (src/ui/pokerController.js) never computes a
// position of its own.

const LENGTH = m(2.0);
const WIDTH = m(1.05);
const END_R = WIDTH / 2;                 // the oval's round ends
const STRAIGHT = LENGTH / 2 - END_R;     // half the straight run
const RIM = m(0.05);
const TRACK = m(0.07);                   // the wooden racetrack
const RAIL = m(0.12);
export const POKER_RAIL_OUTER = RIM + TRACK + RAIL;

// A racetrack outline grown by `grow` past the felt's own edge.
function stadium(grow) {
  const r = END_R + grow;
  const s = new THREE.Shape();
  s.moveTo(-STRAIGHT, -r);
  s.lineTo(STRAIGHT, -r);
  s.absarc(STRAIGHT, 0, r, -Math.PI / 2, Math.PI / 2, false);
  s.lineTo(-STRAIGHT, r);
  s.absarc(-STRAIGHT, 0, r, Math.PI / 2, Math.PI * 1.5, false);
  s.closePath();
  return s;
}
function ring(inner, outer) {
  const s = stadium(outer);
  s.holes.push(stadium(inner));
  return s;
}

// A point on the felt's outline grown by `grow`, at bearing `theta` from
// the centre (0 = toward the players' front, +z; positive toward +x).
export function ovalPoint(theta, grow = 0) {
  const r = END_R + grow;
  const dx = Math.sin(theta), dz = Math.cos(theta);
  // Where the ray from the centre leaves the racetrack.
  const tStraight = Math.abs(dz) > 1e-6 ? r / Math.abs(dz) : Infinity;
  if (Math.abs(dx * tStraight) <= STRAIGHT) return new THREE.Vector3(dx * tStraight, 0, dz * tStraight);
  const cx = Math.sign(dx) * STRAIGHT;
  // |c + t d| = r on the end's circle.
  const b = cx * dx;
  const t = b + Math.sqrt(b * b - (cx * cx - r * r));
  return new THREE.Vector3(dx * t, 0, dz * t);
}

// ---------- the layout ----------

// Six seats, clockwise from the dealer's left: the two corners beside the
// dealer, the two ends, the two in front.
const SEAT_BEARINGS = [118, 72, 26, -26, -72, -118].map((d) => THREE.MathUtils.degToRad(d));
const SEAT_OUT = m(0.62);
export const POKER_SEATS_3D = SEAT_BEARINGS.map((theta, index) => {
  const rim = ovalPoint(theta, POKER_RAIL_OUTER);
  const outward = rim.clone().setY(0).normalize();
  const position = ovalPoint(theta, POKER_RAIL_OUTER + SEAT_OUT - m(0.1));
  return {
    index,
    theta,
    position,
    facingAngle: Math.atan2(-outward.x, -outward.z),
    // Cards just inside the rim, chips a little nearer the middle; the
    // player's own stack on the felt by the rim, to one side of the cards.
    cardSpot: ovalPoint(theta, -m(0.17)).setY(0.04),
    betSpot: ovalPoint(theta, -m(0.36)).setY(0.02),
    stackSpot: ovalPoint(theta + 0.2, -m(0.08)).setY(0.012),
    buttonSpot: ovalPoint(theta - 0.22, -m(0.3)).setY(0.016),
    // Cards turn to read the right way for whoever sits here.
    cardAngle: Math.atan2(outward.x, outward.z),
    outward,
  };
});

export const POKER_DEALER = {
  position: new THREE.Vector3(0, 0, -END_R - POKER_RAIL_OUTER - m(0.18)),
  handSpot: new THREE.Vector3(0, 0.04, -END_R + m(0.3)),
  // The dealer's tray of chips, let into the felt in front of them.
  traySpot: new THREE.Vector3(0, 0.012, -END_R + m(0.1)),
  facingAngle: 0,
};
// The board: five cards across the middle, the pot just behind them on
// the dealer's side.
const CARD_PITCH = m(0.118);
export const BOARD_SPOTS = [-2, -1, 0, 1, 2].map((i) => new THREE.Vector3(i * CARD_PITCH, 0.04, m(0.04)));
export const POT_SPOT = new THREE.Vector3(0, 0.02, -m(0.13));
export const MUCK_SPOT = new THREE.Vector3(-m(0.32), 0.03, -END_R + m(0.22));
export const DECK_SPOT = new THREE.Vector3(m(0.3), 0.03, -END_R + m(0.22));

// ---------- the felt ----------

const FELT_W = 2048;
const FELT_H = Math.round((FELT_W * WIDTH) / LENGTH);
const PX = FELT_W / LENGTH;
const toPx = (x, z) => [(x + LENGTH / 2) * PX, (z + WIDTH / 2) * PX];

function createPokerFelt(themeKey) {
  const theme = feltTheme(themeKey);
  const canvas = document.createElement('canvas');
  canvas.width = FELT_W;
  canvas.height = FELT_H;
  const ctx = canvas.getContext('2d');
  const [cx, cy] = toPx(0, 0);
  const g = ctx.createRadialGradient(cx, cy, PX * 0.2, cx, cy, PX * 1.4);
  g.addColorStop(0, theme.hi);
  g.addColorStop(1, theme.lo);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, FELT_W, FELT_H);
  const grain = ctx.getImageData(0, 0, FELT_W, FELT_H);
  for (let i = 0; i < grain.data.length; i += 4) {
    const n = (Math.random() - 0.5) * 9;
    grain.data[i] += n; grain.data[i + 1] += n; grain.data[i + 2] += n;
  }
  ctx.putImageData(grain, 0, 0);

  const INK = 'rgba(232,220,192,0.55)';
  // The betting line: a thin racetrack printed round the felt, inside which
  // chips are in the pot.
  ctx.strokeStyle = INK;
  ctx.lineWidth = PX * 0.006;
  const inset = m(0.27);
  const r = (END_R - inset) * PX;
  const sx = STRAIGHT * PX;
  ctx.beginPath();
  ctx.moveTo(cx - sx, cy - r);
  ctx.lineTo(cx + sx, cy - r);
  ctx.arc(cx + sx, cy, r, -Math.PI / 2, Math.PI / 2);
  ctx.lineTo(cx - sx, cy + r);
  ctx.arc(cx - sx, cy, r, Math.PI / 2, Math.PI * 1.5);
  ctx.stroke();
  // The house crest each side of the board, and the game's name.
  [-1, 1].forEach((side) => {
    const [x, y] = toPx(side * (STRAIGHT + END_R * 0.15), 0);
    drawCasinoCrest(ctx, { x, y, width: PX * 0.3, alpha: 0.42, rgb: '232,220,192', foreshorten: 1.3 });
  });
  ctx.fillStyle = 'rgba(232,220,192,0.38)';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `600 ${PX * 0.032}px 'Cinzel', Georgia, serif`;
  const [tx, ty] = toPx(0, m(0.17));
  ctx.save();
  ctx.translate(tx, ty);
  ctx.scale(1, 1.4);
  ctx.fillText("NVGR CASINO  ·  TEXAS HOLD'EM", 0, 0);
  ctx.restore();

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 16;
  return texture;
}

/** The table, with `setFeltTheme(key)` on its userData like the blackjack one. */
export function createPokerTable() {
  const group = new THREE.Group();

  const feltGeo = new THREE.ShapeGeometry(stadium(0), 24);
  // UVs over the felt's bounds, so the texture spans it exactly.
  const pos = feltGeo.attributes.position;
  const uv = feltGeo.attributes.uv;
  for (let i = 0; i < pos.count; i++) uv.setXY(i, pos.getX(i) / LENGTH + 0.5, 1 - (pos.getY(i) / WIDTH + 0.5));
  const feltMat = new THREE.MeshLambertMaterial({ map: createPokerFelt('green'), side: THREE.DoubleSide });
  let feltKey = 'green';
  group.userData.setFeltTheme = (key) => {
    const next = FELT_THEMES[key] ? key : 'green';
    if (next === feltKey) return;
    feltKey = next;
    feltMat.map.dispose();
    feltMat.map = createPokerFelt(next);
    feltMat.needsUpdate = true;
  };
  const felt = new THREE.Mesh(feltGeo, feltMat);
  felt.rotation.x = Math.PI / 2;
  felt.position.y = 0.01;
  felt.receiveShadow = true;
  group.add(felt);

  const band = (inner, outer, top, depth, mat, bevel = null) => {
    const opts = bevel
      ? { depth, bevelEnabled: true, bevelThickness: bevel.thickness, bevelSize: bevel.size, bevelSegments: 6, curveSegments: 40 }
      : { depth, bevelEnabled: false, curveSegments: 40 };
    const mesh = new THREE.Mesh(new THREE.ExtrudeGeometry(ring(inner, outer), opts), mat);
    mesh.rotation.x = Math.PI / 2;
    mesh.position.y = top - (bevel ? bevel.thickness : 0);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
    return mesh;
  };
  const burl = new THREE.MeshStandardMaterial({ map: createBurlTexture(), roughness: 0.38, metalness: 0 });
  const wood = new THREE.MeshStandardMaterial({ map: createWoodTexture(), roughness: 0.45, metalness: 0 });
  band(-0.01, RIM, 0.03, 0.03, burl);
  band(RIM, RIM + TRACK, 0.024, 0.024, wood);
  const cushion = { thickness: m(0.03), size: m(0.045) };
  band(RIM + TRACK + cushion.size, POKER_RAIL_OUTER - cushion.size, 0.03 + m(0.06), m(0.006) + 0.025, LEATHER, cushion);

  // A brass bead where the felt meets the rim.
  const bead = new THREE.Mesh(new THREE.ShapeGeometry(ring(-0.025, -0.006), 24),
    new THREE.MeshStandardMaterial({ color: 0x9c7d4a, roughness: 0.42, metalness: 0.75, side: THREE.DoubleSide }));
  bead.rotation.x = Math.PI / 2;
  bead.position.y = 0.013;
  group.add(bead);

  // Apron, pedestal and brass kick, as on the blackjack table.
  const APRON = m(0.13);
  const apron = new THREE.Mesh(new THREE.ExtrudeGeometry(stadium(POKER_RAIL_OUTER), {
    depth: APRON, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 3, curveSegments: 40,
  }), wood);
  apron.rotation.x = Math.PI / 2;
  apron.position.y = -0.025;
  apron.castShadow = true;
  apron.receiveShadow = true;
  group.add(apron);
  const pedestalTop = -0.025 - APRON;
  const pedestal = new THREE.Mesh(new THREE.ExtrudeGeometry(stadium(POKER_RAIL_OUTER - m(0.55)), {
    depth: pedestalTop - FLOOR_Y, bevelEnabled: false, curveSegments: 32,
  }), new THREE.MeshStandardMaterial({ color: 0x120d0a, roughness: 0.7, metalness: 0 }));
  pedestal.rotation.x = Math.PI / 2;
  pedestal.position.y = pedestalTop;
  pedestal.castShadow = true;
  group.add(pedestal);
  const kick = new THREE.Mesh(new THREE.ExtrudeGeometry(stadium(POKER_RAIL_OUTER - m(0.535)), {
    depth: m(0.05), bevelEnabled: false, curveSegments: 32,
  }), BRASS);
  kick.rotation.x = Math.PI / 2;
  kick.position.y = FLOOR_Y + m(0.05);
  group.add(kick);

  // The dealer's tray, set into the felt in front of them.
  const tray = new THREE.Mesh(new THREE.BoxGeometry(m(0.42), 0.012, m(0.1)),
    new THREE.MeshStandardMaterial({ color: 0x15100c, roughness: 0.6, metalness: 0 }));
  tray.position.copy(POKER_DEALER.traySpot);
  group.add(tray);
  const trayRim = new THREE.Mesh(new THREE.BoxGeometry(m(0.44), 0.016, m(0.115)), BRASS);
  trayRim.position.copy(POKER_DEALER.traySpot).setY(0.006);
  group.add(trayRim);

  return group;
}
