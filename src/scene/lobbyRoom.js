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
    fog: 0x0a1a48, fogNear: 30, fogFar: 85,
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
    ctx.fillStyle = '#1d3f98'; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
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
  v.addColorStop(0, '#060b1c'); v.addColorStop(0.5, '#0f2152'); v.addColorStop(1, '#13296a');
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
    // Royal blue velvet, the app's own: deep at the frame, rich and bright
    // where the light catches the pile down the middle.
    vel.addColorStop(0, '#0f2462'); vel.addColorStop(0.5, '#2650b4'); vel.addColorStop(1, '#0f2462');
    ctx.fillStyle = vel;
    ctx.fillRect(vx, y0 + stile, vw, y1 - y0 - stile * 2);
    // And brighter toward the top, under the cornice lights.
    const lift = ctx.createLinearGradient(0, y0, 0, y1);
    lift.addColorStop(0, 'rgba(90, 140, 255, 0.16)'); lift.addColorStop(0.5, 'rgba(90, 140, 255, 0.05)'); lift.addColorStop(1, 'rgba(90, 140, 255, 0)');
    ctx.fillStyle = lift;
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
  // High on the wall, above the centrepiece in the middle of the room.
  crest.position.set(0, FLOOR_Y + m(5.0), -ARC_R - R + m(0.25));
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
  ceiling(room);

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
// In the middle of the circle the tables stand round, the room's centre:
// a crowned queen in bronze (Poly Haven's gothic_statue, CC0) on a grand
// round plinth of black lacquer and gold, its base ringed in light.
function centrepiece(room) {
  const g = new THREE.Group();
  g.position.set(0, FLOOR_Y, -ARC_R);
  room.add(g);
  // The steps: a wide low drum, then the plinth itself.
  const step = new THREE.Mesh(new THREE.CylinderGeometry(m(1.35), m(1.42), m(0.22), 64), PLINTH);
  step.position.y = m(0.11);
  g.add(step);
  const stepRim = new THREE.Mesh(new THREE.TorusGeometry(m(1.36), m(0.025), 10, 96), PLINTH_GOLD);
  stepRim.rotation.x = Math.PI / 2;
  stepRim.position.y = m(0.22);
  g.add(stepRim);
  const glow = new THREE.Mesh(new THREE.RingGeometry(m(1.44), m(1.6), 96), new THREE.MeshBasicMaterial({ color: 0xffd58a, transparent: true, opacity: 0.22, toneMapped: false, depthWrite: false }));
  glow.rotation.x = -Math.PI / 2;
  glow.position.y = 0.012;
  g.add(glow);
  const body = new THREE.Group();
  body.position.y = m(0.22);
  g.add(body);
  const top = plinth(body, m(0.62), m(0.62));
  place(body, 'gothic_statue', { y: top, yaw: 0, size: 1.05 });
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
  };
  [-1, 1].forEach((side) => {
    vignette(m(7.4), side * 0.6, 'bust');
    vignette(m(6.6), side * 1.05, 'horse');
  });
  centrepiece(room);
  portraits(room, at);
}

// On the curved wall, each in the middle of a velvet panel and flanking a
// bust: four old-master portraits in gilded frames, each lit by a brass
// picture light. Ingres's pendant portraits of Monsieur and Madame Leblanc
// (1823) hang nearest the crest; Van Dyck's Lucas van Uffel (c. 1622) and
// Vigée Le Brun's Madame Grand (1783) beyond. All four are public domain,
// photographed by the Metropolitan Museum of Art (Open Access, CC0).
const PORTRAITS = [
  // (A positive turn is to the left, seen from the tables: Monsieur on
  // the left and Madame on the right, as the pair hang at the Met.)
  { file: 'leblanc', t: 0.467, aspect: 0.797 },
  { file: 'mme_leblanc', t: -0.467, aspect: 0.784 },
  { file: 'van_uffel', t: 0.7, aspect: 0.829 },
  { file: 'madame_grand', t: -0.7, aspect: 0.793 },
];
const FRAME_GOLD = new THREE.MeshStandardMaterial({ color: 0xd4ab58, roughness: 0.28, metalness: 1, envMapIntensity: 1.8, emissive: 0x2a1c08 });
const FRAME_DEEP = new THREE.MeshStandardMaterial({ color: 0x8a6526, roughness: 0.45, metalness: 1, envMapIntensity: 1.2 });
const FRAME_LIP = new THREE.MeshStandardMaterial({ color: 0x1b130b, roughness: 0.7, metalness: 0 });
// A rectangular band of moulding, `band` wide, standing `depth` off the wall.
function moulding(w, h, band, depth, bevel, mat) {
  const s = new THREE.Shape();
  s.moveTo(-w / 2, -h / 2); s.lineTo(w / 2, -h / 2); s.lineTo(w / 2, h / 2); s.lineTo(-w / 2, h / 2); s.closePath();
  const iw = w - band * 2, ih = h - band * 2;
  const hole = new THREE.Path();
  hole.moveTo(-iw / 2, -ih / 2); hole.lineTo(-iw / 2, ih / 2); hole.lineTo(iw / 2, ih / 2); hole.lineTo(iw / 2, -ih / 2); hole.closePath();
  s.holes.push(hole);
  const geo = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 3, curveSegments: 1 });
  return new THREE.Mesh(geo, mat);
}
// The picture light's warm wash, strongest at the top of the canvas.
let washTex = null;
function pictureWash() {
  if (washTex) return washTex;
  const c = document.createElement('canvas');
  c.width = 128; c.height = 256;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(64, -40, 10, 64, -40, 300);
  g.addColorStop(0, 'rgba(255, 214, 150, 0.55)');
  g.addColorStop(0.55, 'rgba(255, 200, 130, 0.16)');
  g.addColorStop(1, 'rgba(255, 190, 120, 0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 256);
  washTex = new THREE.CanvasTexture(c);
  washTex.colorSpace = THREE.SRGBColorSpace;
  return washTex;
}
function portraits(room, at) {
  const loader = new THREE.TextureLoader();
  const brass = PLINTH_GOLD;
  PORTRAITS.forEach(({ file, t, aspect }) => {
    const H = m(2.2), W = H * aspect;
    // Just off the curved wall: a flat frame on a curve needs the room.
    const p = at(m(9.5) - m(0.1), t);
    const g = new THREE.Group();
    g.position.set(p.x, FLOOR_Y + m(3.55), p.z);
    // Square to the wall: its face toward the arc's centre.
    g.rotation.y = t;
    room.add(g);
    // The frame: a broad gilded band, a deeper ridge inside it, and a dark
    // lip round the canvas.
    g.add(moulding(W + m(0.34), H + m(0.34), m(0.12), m(0.035), m(0.012), FRAME_GOLD));
    const ridge = moulding(W + m(0.11), H + m(0.11), m(0.045), m(0.06), m(0.008), FRAME_DEEP);
    g.add(ridge);
    const lip = moulding(W + m(0.02), H + m(0.02), m(0.012), m(0.045), 0, FRAME_LIP);
    g.add(lip);
    // The canvas: lit a little of its own, as the picture light lights it.
    const mat = new THREE.MeshStandardMaterial({ color: 0x8a8a8a, roughness: 0.62, metalness: 0, emissive: 0xffffff, emissiveIntensity: 0.68 });
    const canvas = new THREE.Mesh(new THREE.PlaneGeometry(W, H), mat);
    canvas.position.z = m(0.03);
    g.add(canvas);
    loader.load(`${import.meta.env.BASE_URL}textures/portraits/${file}.jpg`, (tex) => {
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = 8;
      mat.map = tex; mat.emissiveMap = tex; mat.color.set(0xffffff);
      mat.needsUpdate = true;
    });
    const wash = new THREE.Mesh(new THREE.PlaneGeometry(W, H), new THREE.MeshBasicMaterial({ map: pictureWash(), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
    wash.position.z = m(0.034);
    g.add(wash);
    // The brass picture light above, on two short arms.
    const lampW = W * 0.62;
    const lamp = new THREE.Mesh(new THREE.CylinderGeometry(m(0.028), m(0.028), lampW, 20), brass);
    lamp.rotation.z = Math.PI / 2;
    lamp.position.set(0, H / 2 + m(0.26), m(0.24));
    g.add(lamp);
    const glow = new THREE.Mesh(new THREE.PlaneGeometry(lampW * 0.94, m(0.03)), new THREE.MeshBasicMaterial({ color: 0xffe2a8, toneMapped: false }));
    glow.rotation.x = Math.PI / 2;
    glow.position.set(0, H / 2 + m(0.255) - m(0.028), m(0.24));
    g.add(glow);
    [-1, 1].forEach((side) => {
      const arm = new THREE.Mesh(new THREE.CylinderGeometry(m(0.008), m(0.008), m(0.22), 8), brass);
      arm.rotation.x = Math.PI / 2 - 0.44;
      arm.position.set(side * lampW * 0.35, H / 2 + m(0.215), m(0.145));
      g.add(arm);
    });
  });
}

// Overhead: a coffered ceiling in dark lacquer, gold beams between
// the coffers and a gilded rosette in each; over the centre a shallow dome,
// ribbed in gold round a glowing oculus, with the grand chandelier hanging
// from it above the statue, and two more over the busts either side
// (Poly Haven's models, CC0). Lit by its own glow, as a painted ceiling
// under concealed lights is: the room's lamps do not reach so high.
const CEIL_Y = FLOOR_Y + m(7.6);
function cofferTexture() {
  const S = 512;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const ctx = c.getContext('2d');
  // Dark lacquer and gold, as the great casinos' ceilings are: it recedes
  // above the room, so the walls and tables keep the eye, and only the
  // gilding catches the light.
  ctx.fillStyle = '#0b0e18';
  ctx.fillRect(0, 0, S, S);
  const beam = S * 0.1, inner = S - beam * 2;
  // The coffer: stepped in, deepest at its sides, faintly lit at its centre.
  const steps = [[0, '#07090f'], [0.08, '#0d1120'], [0.16, '#121830']];
  steps.forEach(([k, col]) => {
    const o = beam + (inner * k) / 2;
    ctx.fillStyle = col;
    ctx.fillRect(o, o, S - o * 2, S - o * 2);
  });
  const glow = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, inner * 0.46);
  glow.addColorStop(0, 'rgba(255, 210, 150, 0.12)'); glow.addColorStop(1, 'rgba(255, 210, 150, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(beam, beam, inner, inner);
  // Gold fillets round each step.
  ctx.strokeStyle = 'rgba(220, 182, 104, 0.9)';
  steps.forEach(([k], i) => {
    const o = beam + (inner * k) / 2;
    ctx.lineWidth = i ? 2 : 4;
    ctx.strokeRect(o, o, S - o * 2, S - o * 2);
  });
  // The beams: gilded, rounded by their shading.
  const g = ctx.createLinearGradient(0, 0, 0, beam);
  g.addColorStop(0, '#8a6526'); g.addColorStop(0.5, '#d9b45f'); g.addColorStop(1, '#8a6526');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, S, beam * 0.5); ctx.fillRect(0, S - beam * 0.5, S, beam * 0.5);
  const gv = ctx.createLinearGradient(0, 0, beam, 0);
  gv.addColorStop(0, '#8a6526'); gv.addColorStop(0.5, '#d9b45f'); gv.addColorStop(1, '#8a6526');
  ctx.fillStyle = gv;
  ctx.fillRect(0, 0, beam * 0.5, S); ctx.fillRect(S - beam * 0.5, 0, beam * 0.5, S);
  // The rosette at the coffer's heart.
  ctx.save();
  ctx.translate(S / 2, S / 2);
  ctx.fillStyle = 'rgba(222, 186, 112, 0.92)';
  for (let k = 0; k < 12; k++) {
    ctx.rotate(Math.PI / 6);
    ctx.beginPath(); ctx.ellipse(0, -S * 0.06, S * 0.014, S * 0.05, 0, 0, Math.PI * 2); ctx.fill();
  }
  ctx.beginPath(); ctx.arc(0, 0, S * 0.025, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  return t;
}
function domeTexture() {
  const W = 1024, H = 512;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d');
  // The picture's top is the dome's crown, its foot the rim.
  const sky = ctx.createLinearGradient(0, H, 0, 0);
  sky.addColorStop(0, '#07090f'); sky.addColorStop(0.7, '#111727'); sky.addColorStop(1, '#2a2418');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);
  // Gold ribs rising to the crown, sixteen of them.
  for (let k = 0; k < 16; k++) {
    const x = (k / 16) * W;
    const rib = ctx.createLinearGradient(x - 7, 0, x + 7, 0);
    rib.addColorStop(0, 'rgba(138, 101, 38, 0)'); rib.addColorStop(0.5, 'rgba(222, 186, 112, 0.95)'); rib.addColorStop(1, 'rgba(138, 101, 38, 0)');
    ctx.fillStyle = rib;
    ctx.fillRect(x - 7, 0, 14, H);
  }
  // Rings of gold: at the rim, part way up, and round the oculus.
  [[H - 10, 10], [H * 0.55, 4], [H * 0.16, 6]].forEach(([y, w]) => {
    ctx.fillStyle = 'rgba(222, 186, 112, 0.95)';
    ctx.fillRect(0, y - w / 2, W, w);
  });
  // A gold star between each pair of ribs.
  ctx.fillStyle = 'rgba(232, 200, 128, 0.85)';
  for (let k = 0; k < 16; k++) {
    const x = ((k + 0.5) / 16) * W, y = H * 0.36;
    ctx.beginPath();
    for (let j = 0; j < 8; j++) { const r = j % 2 ? 4 : 11, a = (j / 8) * Math.PI * 2; ctx.lineTo(x + Math.sin(a) * r, y - Math.cos(a) * r); }
    ctx.closePath(); ctx.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}
function haloTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
  g.addColorStop(0, 'rgba(255, 220, 160, 0.6)'); g.addColorStop(0.35, 'rgba(255, 205, 140, 0.18)'); g.addColorStop(1, 'rgba(255, 200, 130, 0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 256);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
function ceiling(room) {
  const DOME_R = m(4.4);
  const cx = 0, cz = -ARC_R;
  // The coffered field, each coffer 2.4 m across, the dome's opening cut
  // from it. (Drawn in the plane, then laid flat: its y becomes -z.)
  const tex = cofferTexture();
  const shape = new THREE.Shape();
  shape.absarc(0, 0, HALF * 0.92, 0, Math.PI * 2, false);
  const hole = new THREE.Path();
  hole.absarc(cx, -cz, DOME_R, 0, Math.PI * 2, true);
  shape.holes.push(hole);
  const geo = new THREE.ShapeGeometry(shape, 96);
  // World-sized UVs, so the coffers keep their size wherever they are.
  const pos = geo.attributes.position, uv = geo.attributes.uv;
  for (let i = 0; i < pos.count; i++) uv.setXY(i, pos.getX(i) / m(2.4), pos.getY(i) / m(2.4));
  const field = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: tex, emissiveMap: tex, emissive: 0xffffff, emissiveIntensity: 0.55, roughness: 0.6, metalness: 0.15, side: THREE.DoubleSide }));
  field.rotation.x = -Math.PI / 2;
  field.position.y = CEIL_Y;
  room.add(field);
  // The dome: shallow, painted inside, its rim a gilded ring.
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(DOME_R, 64, 20, 0, Math.PI * 2, 0, Math.PI / 2),
    new THREE.MeshBasicMaterial({ map: domeTexture(), side: THREE.BackSide, toneMapped: false }),
  );
  dome.scale.y = 0.42;
  dome.position.set(cx, CEIL_Y, cz);
  room.add(dome);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(DOME_R, m(0.09), 12, 128), PLINTH_GOLD);
  rim.rotation.x = Math.PI / 2;
  rim.position.set(cx, CEIL_Y - m(0.04), cz);
  room.add(rim);
  // The oculus at its crown, glowing.
  const crownY = CEIL_Y + DOME_R * 0.42;
  const oculus = new THREE.Mesh(new THREE.CircleGeometry(m(0.75), 48), new THREE.MeshBasicMaterial({ color: 0xffe3b0, toneMapped: false, side: THREE.DoubleSide }));
  oculus.rotation.x = Math.PI / 2;
  oculus.position.set(cx, crownY - m(0.02), cz);
  room.add(oculus);
  const halo = haloTexture();
  const glowAt = (x, y, z, size) => {
    const h = new THREE.Mesh(new THREE.PlaneGeometry(size, size), new THREE.MeshBasicMaterial({ map: halo, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, side: THREE.DoubleSide }));
    h.rotation.x = Math.PI / 2;
    h.position.set(x, y, z);
    room.add(h);
  };
  // The grand chandelier hung high in the dome, over the statue, so seen
  // from the tables it is above the crest, never in front of it; two more
  // hung from the coffers over the busts.
  place(room, 'Chandelier_03', { x: cx, y: crownY - m(0.15), z: cz, size: 2.9 });
  glowAt(cx, CEIL_Y - m(0.05), cz, DOME_R * 1.5);
  [-1, 1].forEach((side) => {
    const t = side * 0.6, r = m(5.6);
    const x = Math.sin(Math.PI + t) * r, z = -ARC_R + Math.cos(Math.PI + t) * r;
    place(room, 'Chandelier_03', { x, y: CEIL_Y, z, size: 2.3 });
    glowAt(x, CEIL_Y - m(0.02), z, m(5));
  });
}
