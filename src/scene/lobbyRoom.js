import * as THREE from 'three';
import { FLOOR_Y, m } from './scale.js';
import { LOGO_URL } from '../app/uiHelpers.js';

// The lobby's own room: not a casino room but a stage for the games. A
// dark, polished floor with fine gold rings inlaid along the arc the
// carousel's tables stand on; behind them a soft, warm darkness that fades
// to black; one warm light over the table in the middle. No furniture, no
// walls to read, nothing to compete with the tables — and little to draw,
// which a phone feels.
//
// It keeps the rooms' contract (room.js): userData.theme for the light and
// the tables' glow, userData.dims for the light's height.

const HALF = 60;
const CEILING = 12;
// The carousel's arc (scene.js): tables on a circle of this radius whose
// centre is this far behind the middle table.
const ARC_R = m(9);

export const LOBBY_THEME = {
  name: 'Lobby',
  tableGlow: 0xffd896,
  light: {
    sky: 0xd8dcf4, ground: 0x3a2c1e, fill: 1.0,
    key: 0xffe4c0, keyPower: 120,
    wash: 0xffcf9a, washPower: 18,
    fog: 0x070506, fogNear: 30, fogFar: 85,
  },
};

function floorTexture() {
  const S = 2048;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const ctx = c.getContext('2d');
  // World x, z (the floor spans ±HALF) to canvas pixels.
  const px = S / (HALF * 2);
  const at = (x, z) => [(x + HALF) * px, (z + HALF) * px];
  // Dark stone, a little lighter where the tables stand.
  const [gx, gy] = at(0, -ARC_R * 0.25);
  const g = ctx.createRadialGradient(gx, gy, 0, gx, gy, S * 0.42);
  g.addColorStop(0, '#3a2f25');
  g.addColorStop(0.5, '#1f1914');
  g.addColorStop(1, '#080606');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, S, S);
  // The gold rings, round the arc's own centre.
  const [cx, cy] = at(0, -ARC_R);
  const ring = (r, w, a) => {
    ctx.strokeStyle = `rgba(214, 178, 108, ${a})`;
    ctx.lineWidth = w;
    ctx.beginPath();
    ctx.arc(cx, cy, r * px, 0, Math.PI * 2);
    ctx.stroke();
  };
  ring(ARC_R + m(2.7), 9, 0.95);
  ring(ARC_R + m(3.0), 4, 0.6);
  ring(ARC_R - m(2.7), 9, 0.95);
  ring(ARC_R - m(3.0), 4, 0.6);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

function backdropTexture() {
  const W = 1024, H = 512;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d');
  // Warm darkness, lightest just above the floor behind the tables.
  const v = ctx.createLinearGradient(0, 0, 0, H);
  v.addColorStop(0, '#050405');
  v.addColorStop(0.5, '#1a130e');
  v.addColorStop(0.8, '#3a2a1c');
  v.addColorStop(1, '#140f0b');
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, W, H);
  // Faint gold pinstripes, far apart.
  ctx.strokeStyle = 'rgba(214, 178, 108, 0.12)';
  ctx.lineWidth = 2;
  for (let x = 0; x <= W; x += W / 48) { ctx.beginPath(); ctx.moveTo(x, H * 0.2); ctx.lineTo(x, H); ctx.stroke(); }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = THREE.RepeatWrapping;
  t.repeat.set(2, 1);
  return t;
}

// Behind the tables, the room's own architecture: a great curved wall in
// the Art Deco manner, following their arc — a dark panel with gold rays
// fanning up from behind the middle table, tiers of gold arches, fluted
// gold pilasters, and the NVGR crest high at its centre, glowing softly.
// It fills the space behind the dealer as part of the room rather than as
// a thing stood in it.
const WALL_W = 2048, WALL_H = 960;
function paintDecoWall(ctx, crest) {
  const W = WALL_W, H = WALL_H;
  ctx.clearRect(0, 0, W, H);
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#060505');
  bg.addColorStop(0.6, '#130e0a');
  bg.addColorStop(1, '#1d150e');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  const gold = (a) => `rgba(222, 186, 112, ${a})`;
  const cx = W / 2, cy = H * 1.02;
  // The rays.
  ctx.lineWidth = 3;
  for (let k = -24; k <= 24; k++) {
    const a = -Math.PI / 2 + k * (Math.PI / 52);
    ctx.strokeStyle = gold(k % 4 === 0 ? 0.55 : 0.22);
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * H * 0.18, cy + Math.sin(a) * H * 0.18);
    ctx.lineTo(cx + Math.cos(a) * H * 1.3, cy + Math.sin(a) * H * 1.3);
    ctx.stroke();
  }
  // Tiers of arches round the same point.
  [0.42, 0.62, 0.84].forEach((r, n) => {
    ctx.strokeStyle = gold(0.75 - n * 0.15);
    ctx.lineWidth = 7 - n * 1.5;
    ctx.beginPath();
    ctx.arc(cx, cy, H * r, Math.PI * 1.08, Math.PI * 1.92);
    ctx.stroke();
  });
  // Fluted pilasters, in pairs, out toward the ends.
  [0.06, 0.16, 0.84, 0.94].forEach((u) => {
    const x = W * u;
    const g = ctx.createLinearGradient(x - 26, 0, x + 26, 0);
    g.addColorStop(0, gold(0.08)); g.addColorStop(0.5, gold(0.5)); g.addColorStop(1, gold(0.08));
    ctx.fillStyle = g;
    ctx.fillRect(x - 26, H * 0.08, 52, H * 0.92);
    ctx.fillStyle = gold(0.8);
    ctx.fillRect(x - 34, H * 0.06, 68, 10);
  });
  // A gold cornice along the top and a base line.
  ctx.fillStyle = gold(0.85);
  ctx.fillRect(0, H * 0.035, W, 8);
  ctx.fillRect(0, H - 10, W, 10);
  // The sides and the top fade into the room's own darkness, so the wall
  // has no edge to read — it seems to rise out of the backdrop.
  ctx.save();
  ctx.globalCompositeOperation = 'destination-in';
  const fx = ctx.createLinearGradient(0, 0, W, 0);
  fx.addColorStop(0, 'rgba(0,0,0,0)'); fx.addColorStop(0.2, 'rgba(0,0,0,1)');
  fx.addColorStop(0.8, 'rgba(0,0,0,1)'); fx.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = fx;
  ctx.fillRect(0, 0, W, H);
  const fy = ctx.createLinearGradient(0, 0, 0, H);
  fy.addColorStop(0, 'rgba(0,0,0,0)'); fy.addColorStop(0.16, 'rgba(0,0,0,1)'); fy.addColorStop(1, 'rgba(0,0,0,1)');
  ctx.fillStyle = fy;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
  // The crest, at the heart of the arches.
  if (crest) {
    // Within the arches, clear of the page's title above it.
    const s = H * 0.36;
    ctx.drawImage(crest, cx - s / 2, H * 0.34, s, s);
  }
}
function decoWall(room) {
  const c = document.createElement('canvas');
  c.width = WALL_W; c.height = WALL_H;
  paintDecoWall(c.getContext('2d'), null);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  // Seen from inside the curve, the picture would read mirrored: flipped
  // back here, so the crest reads the right way round.
  tex.wrapS = THREE.RepeatWrapping;
  tex.repeat.x = -1;
  tex.offset.x = 1;
  // Lit by the room, and glowing a little of its own where it is gold.
  const mat = new THREE.MeshStandardMaterial({ map: tex, emissiveMap: tex, emissive: 0xffffff, emissiveIntensity: 0.8, roughness: 0.55, metalness: 0.2, side: THREE.BackSide, transparent: true, depthWrite: false });
  const R = m(9.5), H = m(8), SPAN = 2.1;
  const wall = new THREE.Mesh(new THREE.CylinderGeometry(R, R, H, 64, 1, true, Math.PI - SPAN / 2, SPAN), mat);
  // Round the arc's centre, so it follows the tables' curve.
  wall.position.set(0, FLOOR_Y + H / 2, -ARC_R);
  room.add(wall);
  const img = new Image();
  img.onload = () => { paintDecoWall(c.getContext('2d'), img); tex.needsUpdate = true; };
  img.src = LOGO_URL;
  // A soft light washing down its face.
  const spot = new THREE.SpotLight(0xffe2b0, 160, m(22), 0.7, 0.8, 1.4);
  spot.position.set(0, FLOOR_Y + H + m(2), -ARC_R + m(4));
  spot.target.position.set(0, FLOOR_Y + H * 0.45, -ARC_R - R);
  room.add(spot, spot.target);
}

export function createLobbyRoom() {
  const room = new THREE.Group();
  room.userData.theme = LOBBY_THEME;
  room.userData.dims = { half: HALF, size: HALF * 2, wallH: CEILING - FLOOR_Y, ceiling: CEILING };

  // The floor: polished, so the tables' glow lies on it.
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(HALF * 2, HALF * 2),
    new THREE.MeshStandardMaterial({ map: floorTexture(), roughness: 0.32, metalness: 0.1 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = FLOOR_Y;
  floor.receiveShadow = true;
  room.add(floor);

  // The backdrop: a great curtain of warm dark round the floor, open above.
  const wall = new THREE.Mesh(
    new THREE.CylinderGeometry(HALF * 0.92, HALF * 0.92, CEILING - FLOOR_Y + 6, 96, 1, true),
    new THREE.MeshBasicMaterial({ map: backdropTexture(), side: THREE.BackSide, fog: true }),
  );
  wall.position.y = (CEILING + FLOOR_Y) / 2 + 2;
  room.add(wall);

  decoWall(room);

  return room;
}
