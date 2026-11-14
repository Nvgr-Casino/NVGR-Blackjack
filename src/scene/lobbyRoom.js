import * as THREE from 'three';
import { FLOOR_Y, m } from './scale.js';

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
    new THREE.CylinderGeometry(HALF * 0.85, HALF * 0.85, CEILING - FLOOR_Y + 6, 96, 1, true),
    new THREE.MeshBasicMaterial({ map: backdropTexture(), side: THREE.BackSide, fog: true }),
  );
  wall.position.y = (CEILING + FLOOR_Y) / 2 + 2;
  room.add(wall);

  return room;
}
