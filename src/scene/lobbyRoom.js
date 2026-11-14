import * as THREE from 'three';
import { FLOOR_Y, m } from './scale.js';
import { marble } from './casinoKit.js';
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

const GOLD = new THREE.MeshStandardMaterial({ color: 0xd8b25e, roughness: 0.22, metalness: 0.95, emissive: 0x2a1c06, emissiveIntensity: 0.45 });
// The house's crest, as a luxury hotel shows its emblem: a tall slab of
// black marble framed in gold, the NVGR crest set into its face and lit,
// on a low two-step base of the same marble banded in gold.
function monument(room, x, z) {
  const BLACK = marble('#0c0b0e', '#5a5866', { veins: 16 });
  let y = FLOOR_Y;
  [[m(3.0), m(0.16)], [m(2.5), m(0.16)]].forEach(([w, h]) => {
    const step = new THREE.Mesh(new THREE.BoxGeometry(w, h, w * 0.5), BLACK);
    step.position.set(x, y + h / 2, z);
    step.receiveShadow = true;
    room.add(step);
    const band = new THREE.Mesh(new THREE.BoxGeometry(w + m(0.03), m(0.035), w * 0.5 + m(0.03)), GOLD);
    band.position.set(x, y + h - m(0.018), z);
    room.add(band);
    y += h;
  });
  // The slab.
  const W = m(2.0), H = m(2.9), D = m(0.32);
  const slab = new THREE.Mesh(new THREE.BoxGeometry(W, H, D), BLACK);
  slab.position.set(x, y + H / 2, z);
  slab.castShadow = slab.receiveShadow = true;
  room.add(slab);
  // A gold frame round its face, and a fine inner line.
  const frame = (w, h, t, dz) => {
    [[w, t, 0, h / 2 - t / 2], [w, t, 0, -h / 2 + t / 2], [t, h, w / 2 - t / 2, 0], [t, h, -w / 2 + t / 2, 0]].forEach(([fw, fh, fx, fy]) => {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(fw, fh, m(0.03)), GOLD);
      bar.position.set(x + fx, y + H / 2 + fy, z + D / 2 + dz);
      room.add(bar);
    });
  };
  frame(W + m(0.06), H + m(0.06), m(0.07), m(0.01));
  frame(W - m(0.26), H - m(0.26), m(0.02), m(0.012));
  // The crest, glowing softly on the marble.
  const crest = new THREE.Mesh(
    new THREE.PlaneGeometry(W * 0.8, W * 0.8),
    new THREE.MeshBasicMaterial({ transparent: true, toneMapped: false, depthWrite: false, opacity: 0 }),
  );
  crest.position.set(x, y + H * 0.56, z + D / 2 + m(0.02));
  room.add(crest);
  new THREE.TextureLoader().load(LOGO_URL, (t) => {
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
    crest.material.map = t;
    crest.material.opacity = 1;
    crest.material.needsUpdate = true;
  });
  // A gold cap along the top.
  const cap = new THREE.Mesh(new THREE.BoxGeometry(W + m(0.16), m(0.08), D + m(0.12)), GOLD);
  cap.position.set(x, y + H + m(0.04), z);
  room.add(cap);
  // Lit from above and in front, and a soft gleam across its face.
  const spot = new THREE.SpotLight(0xffe2b0, 220, m(14), 0.4, 0.7, 1.6);
  spot.position.set(x, y + H + m(3), z + m(4));
  spot.target.position.set(x, y + H * 0.5, z);
  room.add(spot, spot.target);
  return () => {};
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

  // The centrepiece, at the centre of the tables' arc — so whichever table
  // is in the middle, it stands behind the dealer.
  monument(room, 0, -ARC_R);

  return room;
}
