import * as THREE from 'three';
import { FLOOR_Y, m } from './scale.js';
import { LOGO_URL } from '../app/uiHelpers.js';
import { place } from './furniture.js';

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
    sky: 0xd8e0f8, ground: 0x182848, fill: 1.0,
    key: 0xffe4c0, keyPower: 120,
    wash: 0xffcf9a, washPower: 18,
    fog: 0x040917, fogNear: 30, fogFar: 85,
  },
};

// The floor: a casino carpet, as the grand rooms have under their tables.
// Deep charcoal, a fine gold lattice, a gold rosette where its lines cross
// and a small navy medallion in each diamond; woven fibre in it. Charcoal
// and gold sit with the room's navy where a red fought it. One tile,
// repeated across the floor.
function carpetTexture() {
  const S = 512;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const ctx = c.getContext('2d');
  const base = ctx.createLinearGradient(0, 0, S, S);
  base.addColorStop(0, '#1c1d23'); base.addColorStop(0.5, '#141519'); base.addColorStop(1, '#1c1d23');
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, S, S);
  const h = S / 2;
  // The lattice: diamonds, a double gold line.
  ctx.lineWidth = 6; ctx.strokeStyle = 'rgba(176, 132, 58, 0.55)';
  const lattice = () => { ctx.beginPath(); ctx.moveTo(0, h); ctx.lineTo(h, 0); ctx.lineTo(S, h); ctx.lineTo(h, S); ctx.closePath(); ctx.stroke(); };
  lattice();
  ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(214, 176, 98, 0.5)';
  ctx.save(); ctx.translate(h, h); ctx.scale(0.88, 0.88); ctx.translate(-h, -h); lattice(); ctx.restore();
  // Rosettes where the lattice meets the tile's edges (they join up as tiles repeat).
  const rosette = (x, y, r) => {
    ctx.save(); ctx.translate(x, y);
    ctx.fillStyle = 'rgba(200, 156, 72, 0.85)';
    for (let k = 0; k < 8; k++) { ctx.rotate(Math.PI / 4); ctx.beginPath(); ctx.ellipse(0, -r * 0.55, r * 0.18, r * 0.5, 0, 0, Math.PI * 2); ctx.fill(); }
    ctx.fillStyle = '#16171c'; ctx.beginPath(); ctx.arc(0, 0, r * 0.26, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(232, 196, 118, 0.95)'; ctx.beginPath(); ctx.arc(0, 0, r * 0.12, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  };
  [[0, h], [S, h], [h, 0], [h, S]].forEach(([x, y]) => rosette(x, y, 30));
  // A navy medallion in the diamond, ringed in gold, and in the corners.
  const medallion = (x, y, r) => {
    ctx.fillStyle = '#16244a'; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(200, 156, 72, 0.8)'; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = 'rgba(214, 176, 98, 0.85)';
    ctx.beginPath(); ctx.moveTo(x, y - r * 0.55); ctx.lineTo(x + r * 0.35, y); ctx.lineTo(x, y + r * 0.55); ctx.lineTo(x - r * 0.35, y); ctx.closePath(); ctx.fill();
  };
  medallion(h, h, 38);
  [[0, 0], [S, 0], [0, S], [S, S]].forEach(([x, y]) => medallion(x, y, 26));
  // Fibre: fine light and dark flecks, so it reads as woven, not printed.
  const img = ctx.getImageData(0, 0, S, S), d = img.data;
  for (let i = 0; i < d.length; i += 4) { const n = (Math.random() - 0.5) * 16; d[i] += n; d[i + 1] += n; d[i + 2] += n; }
  ctx.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  return t;
}

// The gold rings round the arc the tables stand on: brass inlaid in the
// carpet, either side of the tables.
function floorRings(room) {
  const brass = new THREE.MeshStandardMaterial({ color: 0xd2a85a, roughness: 0.28, metalness: 1, envMapIntensity: 1.3 });
  [[ARC_R + m(2.7), m(0.09)], [ARC_R + m(3.0), m(0.04)], [ARC_R - m(2.7), m(0.09)], [ARC_R - m(3.0), m(0.04)]].forEach(([r, w]) => {
    const ring = new THREE.Mesh(new THREE.RingGeometry(r - w / 2, r + w / 2, 256), brass);
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(0, FLOOR_Y + 0.01, -ARC_R);
    room.add(ring);
  });
}

// The walls: deep navy velvet, buttoned in a diamond, in walnut frames
// with a thin brass inlay, a brass cornice above, and warm light washing up
// from the floor, as a grand hotel's private salon is dressed. Painted
// across `W` by `H` in panels of `panelW`.
function paintPanels(ctx, W, H, panelW, { top = 0.1 } = {}) {
  const v = ctx.createLinearGradient(0, 0, 0, H);
  v.addColorStop(0, '#05070d'); v.addColorStop(0.5, '#0d1530'); v.addColorStop(1, '#101a3a');
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, W, H);
  const y0 = H * top, y1 = H * 0.94;
  const stile = Math.max(6, panelW * 0.07);
  for (let x = 0; x < W; x += panelW) {
    // The walnut frame round each panel.
    const wood = ctx.createLinearGradient(x, 0, x + stile, 0);
    wood.addColorStop(0, '#1a0f08'); wood.addColorStop(0.5, '#3b2414'); wood.addColorStop(1, '#1a0f08');
    ctx.fillStyle = wood;
    ctx.fillRect(x, y0, stile, y1 - y0);
    // The velvet: a soft sheen down its middle.
    const vx = x + stile, vw = panelW - stile;
    const vel = ctx.createLinearGradient(vx, 0, vx + vw, 0);
    vel.addColorStop(0, '#0b1430'); vel.addColorStop(0.5, '#1a2c5e'); vel.addColorStop(1, '#0b1430');
    ctx.fillStyle = vel;
    ctx.fillRect(vx, y0 + stile, vw, y1 - y0 - stile * 2);
    // Buttoned in a diamond: fine creases between the buttons.
    const step = vw / 3;
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.35)'; ctx.lineWidth = 1.2;
    ctx.save(); ctx.beginPath(); ctx.rect(vx, y0 + stile, vw, y1 - y0 - stile * 2); ctx.clip();
    for (let k = -12; k < 40; k++) {
      ctx.beginPath(); ctx.moveTo(vx + k * step, y0); ctx.lineTo(vx + k * step + (y1 - y0), y1); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(vx + k * step, y0); ctx.lineTo(vx + k * step - (y1 - y0), y1); ctx.stroke();
    }
    for (let yy = y0 + stile + step / 2; yy < y1; yy += step / 2) {
      const row = Math.round((yy - y0) / (step / 2));
      for (let xx = vx + (row % 2 ? step / 2 : 0); xx < vx + vw; xx += step) {
        ctx.fillStyle = 'rgba(214, 178, 108, 0.55)';
        ctx.beginPath(); ctx.arc(xx, yy, Math.max(1.2, step * 0.045), 0, Math.PI * 2); ctx.fill();
      }
    }
    ctx.restore();
    // The brass inlay just inside the frame.
    ctx.strokeStyle = 'rgba(214, 176, 98, 0.75)'; ctx.lineWidth = 1.5;
    ctx.strokeRect(vx + 3, y0 + stile + 3, vw - 6, y1 - y0 - stile * 2 - 6);
  }
  // Walnut rails top and bottom, the brass cornice and skirting line.
  const rail = (y, h) => { const g = ctx.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, '#3b2414'); g.addColorStop(1, '#170d06'); ctx.fillStyle = g; ctx.fillRect(0, y, W, h); };
  rail(y0 - stile, stile * 1.4); rail(y1 - stile * 0.4, H - y1 + stile * 0.4);
  const brass = ctx.createLinearGradient(0, 0, 0, 6);
  brass.addColorStop(0, '#f2d58c'); brass.addColorStop(1, '#9c6f27');
  ctx.fillStyle = 'rgba(214, 176, 98, 0.95)';
  ctx.fillRect(0, y0 - stile - 4, W, 4); ctx.fillRect(0, y1 - 2, W, 3);
  // Warm light washing up from the floor.
  const wash = ctx.createLinearGradient(0, H, 0, H * 0.45);
  wash.addColorStop(0, 'rgba(255, 196, 120, 0.22)'); wash.addColorStop(1, 'rgba(255, 196, 120, 0)');
  ctx.fillStyle = wash;
  ctx.fillRect(0, H * 0.45, W, H * 0.55);
}

function backdropTexture() {
  const W = 2048, H = 512;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  paintPanels(c.getContext('2d'), W, H, W / 14, { top: 0.16 });
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = THREE.RepeatWrapping;
  t.repeat.set(2, 1);
  t.anisotropy = 8;
  return t;
}

// Behind the tables, the room's own architecture: a great curved wall
// following their arc, in the same velvet and walnut panels as the room,
// the NVGR crest grand at its centre in a soft gold halo.
const WALL_W = 2048, WALL_H = 960;
function paintDecoWall(ctx, crest) {
  const W = WALL_W, H = WALL_H;
  ctx.clearRect(0, 0, W, H);
  paintPanels(ctx, W, H, W / 9, { top: 0.07 });
  const gold = (al) => `rgba(222, 186, 112, ${al})`;
  const cx = W / 2;
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

  // The floor: the casino carpet, its pattern about 1.6 m across.
  const carpet = carpetTexture();
  carpet.repeat.set((HALF * 2) / m(1.6), (HALF * 2) / m(1.6));
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(HALF * 2, HALF * 2),
    new THREE.MeshStandardMaterial({ map: carpet, roughness: 0.92, metalness: 0 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = FLOOR_Y;
  floor.receiveShadow = true;
  room.add(floor);
  floorRings(room);

  // The backdrop: a great curtain of warm dark round the floor, open above.
  const wall = new THREE.Mesh(
    new THREE.CylinderGeometry(HALF * 0.92, HALF * 0.92, CEILING - FLOOR_Y + 6, 96, 1, true),
    // Shown as painted: tone mapping softened its gold toward grey.
    new THREE.MeshBasicMaterial({ map: backdropTexture(), side: THREE.BackSide, fog: true, toneMapped: false }),
  );
  wall.position.y = (CEILING + FLOOR_Y) / 2 + 2;
  room.add(wall);

  decoWall(room);
  gallery(room);

  return room;
}

// Between the tables and the wall, either side of the crest, a gallery as
// the grand rooms have: a marble bust on a lacquered plinth between two
// palms with a Chesterfield before it facing the tables, and further out a
// bronze horse on a taller plinth between palms. The pieces are Poly
// Haven's photographed models (CC0). They stand on the far side of the
// arc's centre, clear of the crest.
const PLINTH = new THREE.MeshStandardMaterial({ color: 0x07090f, roughness: 0.18, metalness: 0.35 });
const PLINTH_GOLD = new THREE.MeshStandardMaterial({ color: 0xd8b46a, roughness: 0.25, metalness: 1, envMapIntensity: 1.4 });
function plinth(group, height, radius) {
  const body = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius * 1.06, height, 40), PLINTH);
  body.position.y = height / 2;
  group.add(body);
  [[0, radius * 1.1, m(0.06)], [height - m(0.05), radius * 1.08, m(0.05)], [height * 0.18, radius * 1.075, m(0.015)]].forEach(([y, r, h]) => {
    const band = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 40), PLINTH_GOLD);
    band.position.y = y + h / 2;
    group.add(band);
  });
  return height;
}
function gallery(room) {
  // A point on the circle round the arc's centre: radius r, turned t from
  // straight behind it.
  const at = (r, t) => ({ x: Math.sin(Math.PI + t) * r, z: -ARC_R + Math.cos(Math.PI + t) * r, face: t });
  const vignette = (r, t, kind) => {
    const p = at(r, t);
    const g = new THREE.Group();
    g.position.set(p.x, FLOOR_Y, p.z);
    // Facing the arc's centre, and so the tables beyond it.
    g.rotation.y = -t;
    room.add(g);
    if (kind === 'bust') {
      const top = plinth(g, m(1.05), m(0.42));
      place(g, 'marble_bust_01', { y: top, yaw: 0, size: 2.7 });
      place(g, 'sofa_03', { z: m(1.9), yaw: 0, size: 0.9 });
    } else {
      const top = plinth(g, m(1.3), m(0.5));
      place(g, 'horse_statue_01', { y: top, yaw: Math.PI / 2, size: 7.5 });
    }
    [-1, 1].forEach((side) => place(g, 'potted_plant_02', { x: side * m(kind === 'bust' ? 1.15 : 1.1), z: m(-0.1), size: 2.6 }));
  };
  [-1, 1].forEach((side) => {
    vignette(m(7.4), side * 0.6, 'bust');
    vignette(m(6.6), side * 1.05, 'horse');
  });
}
