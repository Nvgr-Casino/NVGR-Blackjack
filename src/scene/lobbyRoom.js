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
  // Gold pillars round the room: each shaded as a rounded column — dark at
  // its edges, bright down its middle — with a capital and a base.
  const COLS = 16;
  for (let k = 0; k < COLS; k++) {
    const x = (k + 0.5) * (W / COLS);
    const w = 11;
    const g = ctx.createLinearGradient(x - w / 2, 0, x + w / 2, 0);
    g.addColorStop(0, '#3a2508');
    g.addColorStop(0.32, '#b8841f');
    g.addColorStop(0.5, '#f2cf72');
    g.addColorStop(0.68, '#a87418');
    g.addColorStop(1, '#2e1d06');
    ctx.fillStyle = g;
    ctx.fillRect(x - w / 2, H * 0.16, w, H * 0.84);
    ctx.fillStyle = '#c8952e';
    ctx.fillRect(x - w * 1.1, H * 0.15, w * 2.2, 8);
    ctx.fillRect(x - w * 0.9, H * 0.135, w * 1.8, 5);
    ctx.fillRect(x - w * 1.1, H - 10, w * 2.2, 10);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = THREE.RepeatWrapping;
  t.repeat.set(2, 1);
  return t;
}

// Behind the tables, the room's own architecture: a great curved wall
// following their arc — a dark panel framed by fluted gold pilasters, the
// NVGR crest grand at its centre in a soft gold halo.
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
  // Fluted pilasters, in pairs, out toward the ends.
  [0.06, 0.16, 0.84, 0.94].forEach((u) => {
    const x = W * u;
    const g = ctx.createLinearGradient(x - 26, 0, x + 26, 0);
    g.addColorStop(0, '#2e1d06'); g.addColorStop(0.32, '#b8841f'); g.addColorStop(0.5, '#f2cf72');
    g.addColorStop(0.68, '#a87418'); g.addColorStop(1, '#2e1d06');
    ctx.fillStyle = g;
    ctx.fillRect(x - 26, H * 0.08, 52, H * 0.92);
    ctx.fillStyle = '#c8952e';
    ctx.fillRect(x - 36, H * 0.06, 72, 12);
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
  // The NVGR crest, grand at the centre.
  if (crest) {
    // Grand, between the pillars, with a soft gold halo behind it.
    const s = H * 0.66;
    const top = H * 0.285;
    const halo = ctx.createRadialGradient(cx, top + s / 2, s * 0.1, cx, top + s / 2, s * 0.75);
    halo.addColorStop(0, gold(0.22));
    halo.addColorStop(1, gold(0));
    ctx.fillStyle = halo;
    ctx.fillRect(cx - s, top - s * 0.25, s * 2, s * 1.5);
    // (The crest itself stands in front, on its own: see decoWall.)
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
  paintDecoWall(c.getContext('2d'), true);
  tex.needsUpdate = true;
  // The crest on a surface of its own just in front of the wall, so it
  // keeps the logo's full resolution — painted into the wall it was shrunk
  // with it — and shown unlit and clear of the haze, sharp at any distance.
  const crestSize = m(4.4);
  const crest = new THREE.Mesh(
    new THREE.PlaneGeometry(crestSize, crestSize),
    new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, toneMapped: false, fog: false }),
  );
  crest.position.set(0, FLOOR_Y + m(3.0), -ARC_R - R + m(0.25));
  // Drawn after the wall: both are see-through, and the wall's centre (the
  // arc's) is nearer the camera, so by distance alone it would paint over.
  crest.renderOrder = 2;
  room.add(crest);
  new THREE.TextureLoader().load(LOGO_URL, (t) => {
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 16;
    t.generateMipmaps = true;
    t.minFilter = THREE.LinearMipmapLinearFilter;
    crest.material.map = t;
    crest.material.opacity = 1;
    crest.material.needsUpdate = true;
  });
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
    // Shown as painted: tone mapping softened its gold toward grey.
    new THREE.MeshBasicMaterial({ map: backdropTexture(), side: THREE.BackSide, fog: true, toneMapped: false }),
  );
  wall.position.y = (CEILING + FLOOR_Y) / 2 + 2;
  room.add(wall);

  decoWall(room);

  return room;
}
