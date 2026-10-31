import * as THREE from 'three';
import { drawCasinoCrest } from './crest.js';
import { FLOOR_Y } from './scale.js';
import { ROOM_THEMES } from './rooms.js';

// The room the table stands in — one for each stakes tier, from a bright
// lounge to a penthouse (rooms.js holds the themes; this paints them).
//
// Every room keeps one pool of light over the table and the rest in
// shadow, so the table is the brightest thing in it, the way a real casino
// salon is lit; an earlier room lit everywhere shouted, and the table had
// to shout back to be seen. The house crest is on every wall, large on the
// back wall behind the dealer.
//
// Every surface is Lambert: matte, no specular, nothing to glint. The
// walls and floor cover most of the screen, so they are also the cheapest
// material three.js has.

export const CEILING_Y = 6.4;
// A 9.4 m salon: room for a lounge on each side, and for waiters to walk
// round the table between them. (At 10 m with nothing in it the walls were
// specks in the dark, and at 7 m it was cramped; it is the furniture and
// the sconces along the walls that make the larger room read.)
export const ROOM_HALF = 12;  // walls at ±12 in x and z

/**
 * Frees a room built by createRoom once it is out of the scene: its own
 * geometry and painted textures. Not the furniture, whose meshes are
 * shared with every other room that places the same piece.
 */
export function disposeRoom(room) {
  room.children.forEach((child) => {
    if (child.userData.furniture) {
      // Only what this placement made for itself: a stain's materials, and
      // anything it was dressed with (layout.js's books).
      (child.userData.materials || []).forEach((mat) => mat.dispose());
      (child.userData.owned || []).forEach((o) => { o.geometry.dispose(); o.material.dispose(); });
      return;
    }
    child.traverse((o) => {
      if (!o.isMesh) return;
      o.geometry.dispose();
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      mats.forEach((mat) => { if (mat.map && mat.map.isCanvasTexture) mat.map.dispose(); mat.dispose(); });
    });
  });
}
// A room's size: most are the 7 m salon, but a theme can be larger and
// taller (the penthouse). Wall textures are sized from it so a wall's
// pixels-per-world-unit come out the same horizontally and vertically, or
// the crest would be stretched.
const WALL_TEX_W = 2048;
export function roomDims(theme) {
  const half = theme.half || ROOM_HALF;
  const ceiling = theme.ceilingY || CEILING_Y;
  const size = half * 2;
  const wallH = ceiling - FLOOR_Y;
  const px = WALL_TEX_W / size;
  return {
    half, ceiling, size, wallH, px,
    texW: WALL_TEX_W,
    texH: Math.round((WALL_TEX_W * wallH) / size),
    texY: (worldY) => (ceiling - worldY) * px,
  };
}

// The back wall's mark hangs where the seated camera actually sees it:
// clear above the dealer's head, below the top of the frame.
const MARK_Y = 2.9;

const rgb = (hex) => [(hex >> 16) & 255, (hex >> 8) & 255, hex & 255];
const css = ([r, g, b], a = 1) => `rgba(${r | 0},${g | 0},${b | 0},${a})`;

// A repeating ornament for wallpaper and carpet: a pointed quatrefoil, the
// damask motif reduced to the shape that reads from across a room.
function ornament(ctx, x, y, size, fill) {
  ctx.fillStyle = fill;
  for (let k = 0; k < 4; k++) {
    const a = (k * Math.PI) / 2;
    ctx.beginPath();
    ctx.ellipse(x + Math.cos(a) * size * 0.32, y + Math.sin(a) * size * 0.32, size * 0.3, size * 0.12, a, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.beginPath();
  ctx.arc(x, y, size * 0.1, 0, Math.PI * 2);
  ctx.fill();
}

/**
 * Paints a wall for a room's theme (see rooms.js): timber slats, damask
 * wallpaper over a panelled dado, or lacquer framed in brass pinstripes;
 * then a skirting board, and a soft wash of light down from a cove at the
 * ceiling line. The wash is painted rather than lit — a real light per
 * wall would cost every pixel on screen, and a gradient reads the same from
 * the table. Every wall carries the house crest: large on the back wall
 * the players face, smaller on the others.
 */
function createWallTexture(theme, d, { back = false, glazed = false } = {}) {
  const { texW: WALL_TEX_W, texH: WALL_TEX_H, px: PX_PER_UNIT, texY: markTexY, ceiling: CEILING_Y } = d;
  const w = theme.wall;
  const canvas = document.createElement('canvas');
  canvas.width = WALL_TEX_W;
  canvas.height = WALL_TEX_H;
  const ctx = canvas.getContext('2d');
  const base = rgb(w.base);

  ctx.fillStyle = css(base);
  ctx.fillRect(0, 0, WALL_TEX_W, WALL_TEX_H);

  if (w.style === 'slats') {
    // Narrow boards with a dark groove between each, every board a touch
    // different in tone so it reads as timber rather than a stripe.
    const slat = PX_PER_UNIT * 0.32;
    for (let x = 0, i = 0; x < WALL_TEX_W; x += slat, i++) {
      const d = ((i * 37) % 10) - 5;
      ctx.fillStyle = css(base.map((c) => c + d));
      ctx.fillRect(x, 0, slat - 3, WALL_TEX_H);
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(x + slat - 3, 0, 3, WALL_TEX_H);
    }
  } else if (w.style === 'damask') {
    const step = PX_PER_UNIT * 0.6;
    const motif = css(rgb(w.motif), 0.55);
    for (let y = step * 0.4, row = 0; y < WALL_TEX_H; y += step * 0.75, row++) {
      for (let x = (row % 2) * step / 2; x < WALL_TEX_W + step; x += step) ornament(ctx, x, y, step * 0.7, motif);
    }
    // A panelled wood dado to waist height, and its rail.
    const dadoTop = WALL_TEX_H - PX_PER_UNIT * 2.3;
    ctx.fillStyle = css(rgb(w.dado));
    ctx.fillRect(0, dadoTop, WALL_TEX_W, WALL_TEX_H - dadoTop);
    ctx.strokeStyle = 'rgba(0,0,0,0.45)';
    ctx.lineWidth = 4;
    const panel = PX_PER_UNIT * 1.4;
    for (let x = PX_PER_UNIT * 0.2; x < WALL_TEX_W; x += panel) {
      ctx.strokeRect(x, dadoTop + PX_PER_UNIT * 0.3, panel - PX_PER_UNIT * 0.3, PX_PER_UNIT * 1.45);
    }
    ctx.fillStyle = css(rgb(w.rail));
    ctx.fillRect(0, dadoTop - 10, WALL_TEX_W, 14);
  } else if (w.style === 'lacquer') {
    const panel = PX_PER_UNIT * 1.8;
    ctx.strokeStyle = css(rgb(w.trim), 0.75);
    ctx.lineWidth = 3;
    const top = PX_PER_UNIT * 0.6, h = WALL_TEX_H - PX_PER_UNIT * 1.3;
    for (let x = PX_PER_UNIT * 0.3; x < WALL_TEX_W; x += panel) {
      ctx.strokeRect(x, top, panel - PX_PER_UNIT * 0.6, h);
      ctx.strokeRect(x + 14, top + 14, panel - PX_PER_UNIT * 0.6 - 28, h - 28);
    }
  }

  // Fine grain and weave.
  const img = ctx.getImageData(0, 0, WALL_TEX_W, WALL_TEX_H);
  const px = img.data;
  for (let i = 0; i < px.length; i += 4) {
    const n = (Math.random() - 0.5) * 6;
    px[i] += n; px[i + 1] += n; px[i + 2] += n;
  }
  ctx.putImageData(img, 0, 0);

  // Cove light washing down from the ceiling, fading out by mid-wall.
  const glow = rgb(theme.cove);
  const wash = ctx.createLinearGradient(0, 0, 0, WALL_TEX_H * 0.6);
  wash.addColorStop(0, css(glow, theme.washAlpha ?? 0.26));
  wash.addColorStop(1, css(glow, 0));
  ctx.fillStyle = wash;
  ctx.fillRect(0, 0, WALL_TEX_W, WALL_TEX_H * 0.6);

  // Skirting.
  const skirtH = PX_PER_UNIT * 0.28;
  ctx.fillStyle = css(rgb(w.skirting));
  ctx.fillRect(0, WALL_TEX_H - skirtH, WALL_TEX_W, skirtH);

  // Floor-to-ceiling glass, for the penthouse: panes cut clean out of the
  // wall between slim mullions, the city outside showing through (see
  // createSkyline). The back wall keeps a solid panel in the middle, behind
  // the dealer, for the crest; on the glass walls the crest is etched on
  // the glass.
  if (glazed) {
    const top = markTexY(CEILING_Y - 0.35);
    const bottom = WALL_TEX_H - skirtH;
    const bay = PX_PER_UNIT * 1.8;
    const mullion = PX_PER_UNIT * 0.09;
    const solid = back ? PX_PER_UNIT * 2.8 : 0;
    ctx.strokeStyle = css(rgb(theme.wall.trim || theme.accent), 0.9);
    ctx.lineWidth = 3;
    for (let x = mullion; x + bay <= WALL_TEX_W; x += bay) {
      const mid = x + bay / 2 - WALL_TEX_W / 2;
      if (Math.abs(mid) < solid) continue;
      ctx.clearRect(x + mullion / 2, top, bay - mullion, bottom - top);
      ctx.strokeRect(x + mullion / 2, top, bay - mullion, bottom - top);
      // A low sill rail across each pane.
      ctx.fillStyle = css(rgb(theme.wall.base));
      ctx.fillRect(x, bottom - (bottom - top) * 0.06, bay, 6);
    }
  }

  drawCasinoCrest(ctx, {
    x: WALL_TEX_W / 2,
    y: markTexY(back ? MARK_Y : MARK_Y + 0.4),
    width: (back ? 2.2 : 1.3) * PX_PER_UNIT,
    alpha: back ? 0.78 : 0.55,
    rgb: rgb(theme.accent).join(','),
  });

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

// The floor: carpet in the theme's colour, with a tonal pattern you only
// notice up close, or polished boards.
function createCarpetTexture(theme) {
  const S = 512;
  const canvas = document.createElement('canvas');
  canvas.width = S;
  canvas.height = S;
  const ctx = canvas.getContext('2d');
  const f = theme.floor;

  ctx.fillStyle = css(rgb(f.base));
  ctx.fillRect(0, 0, S, S);
  if (f.style === 'boards') {
    for (let y = 0, i = 0; y < S; y += S / 8, i++) {
      ctx.fillStyle = css(rgb(f.base).map((c) => c + ((i * 29) % 9) - 4));
      ctx.fillRect(0, y, S, S / 8 - 2);
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.fillRect((i * 173) % S, y, 2, S / 8);
    }
  }
  if (f.style === 'ornate') ornament(ctx, S / 2, S / 2, S * 0.5, css(rgb(f.pattern), 0.3));
  if (f.style === 'marble') {
    // Polished stone: large tiles, each with a few soft veins across it.
    ctx.strokeStyle = 'rgba(0,0,0,0.5)';
    ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, S - 2, S - 2);
    ctx.strokeStyle = css(rgb(f.pattern), 0.28);
    for (let v = 0; v < 7; v++) {
      ctx.lineWidth = 1 + (v % 3);
      ctx.beginPath();
      let x = Math.random() * S, y = 0;
      ctx.moveTo(x, y);
      while (y < S) { x += (Math.random() - 0.5) * 60; y += 30 + Math.random() * 40; ctx.lineTo(x, y); }
      ctx.stroke();
    }
  }

  const img = ctx.getImageData(0, 0, S, S);
  const px = img.data;
  for (let i = 0; i < px.length; i += 4) {
    const n = (Math.random() - 0.5) * 14;
    px[i] += n; px[i + 1] += n; px[i + 2] += n;
  }
  ctx.putImageData(img, 0, 0);

  if (f.style !== 'boards' && f.style !== 'marble') {
    ctx.strokeStyle = 'rgba(0,0,0,0.22)';
    ctx.lineWidth = 6;
    ctx.strokeRect(S * 0.08, S * 0.08, S * 0.84, S * 0.84);
    ctx.strokeStyle = css(rgb(f.pattern || theme.accent), 0.14);
    ctx.lineWidth = 2;
    ctx.strokeRect(S * 0.16, S * 0.16, S * 0.68, S * 0.68);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

// The city seen from the top of a tower: streets on a grid running away to
// the horizon, every one lined with lamps, blocks of lit windows between
// them, traffic on the avenues, all under a haze that thickens toward the
// horizon. Drawn in true perspective for the cylinder it is painted on: a
// point on the ground `d` away and at bearing `a` lands where the line from
// the eye through it meets the cylinder wall — straight below the horizon
// by radius x (height / d), which is linear in 1/d, so the streets converge
// as they should.
function paintCityBelow(ctx, { W, H, horizon, arc, radius, below }) {
  const EYE = 240;           // metres above the street
  const span = H - horizon;  // texture rows from horizon to the bottom
  const nearest = (EYE * radius) / below;
  const project = (x, z) => {
    const d = Math.hypot(x, z);
    if (d < nearest) return null;
    const a = Math.atan2(x, z);
    if (Math.abs(a) > arc / 2) return null;
    return { u: (a / arc + 0.5) * W, v: horizon + ((radius * EYE) / d / below) * span, d };
  };

  const ground = ctx.createLinearGradient(0, horizon, 0, H);
  ground.addColorStop(0, '#2a2546');
  ground.addColorStop(0.03, '#15132a');
  ground.addColorStop(0.25, '#0a0a14');
  ground.addColorStop(1, '#06070d');
  ctx.fillStyle = ground;
  ctx.fillRect(0, horizon, W, span);

  const rand = (() => { let seed = 7; return () => ((seed = (seed * 16807) % 2147483647) / 2147483647); })();
  const turn = 0.35;                 // the grid's angle to the view
  const cos = Math.cos(turn), sin = Math.sin(turn);
  const BLOCK = 110;
  const FAR = 9000;
  const dot = (x, z, size, color, alpha) => {
    const wx = x * cos - z * sin, wz = x * sin + z * cos;
    const p = project(wx, wz);
    if (!p) return;
    const k = 1 / Math.max(p.d / 600, 0.35);
    const sz = Math.max(0.7, size * k);
    ctx.fillStyle = `rgba(${color},${alpha * Math.min(1, 0.45 + k)})`;
    ctx.fillRect(p.u - sz / 2, p.v - sz * 0.35, sz, sz * 0.7);
  };

  // Lit windows in the blocks, warm and cool, thinning with distance.
  const warm = ['255,200,130', '255,180,100', '255,226,175'];
  const cool = ['205,225,255', '180,205,255', '240,244,255'];
  for (let i = 0; i < 80000; i++) {
    const x = (rand() - 0.5) * FAR * 2.4;
    // The arc runs past the sides, so the city does too.
    const z = (rand() * 1.5 - 0.5) * FAR;
    // Not in the streets.
    const bx = ((x % BLOCK) + BLOCK) % BLOCK, bz = ((z % BLOCK) + BLOCK) % BLOCK;
    if (bx < 22 || bz < 22) continue;
    const c = (rand() < 0.62 ? warm : cool)[(rand() * 3) | 0];
    dot(x, z, 2.2 + rand() * 2, c, 0.35 + rand() * 0.55);
  }
  // Streets: a lamp every 30 m on both kerbs, brighter on the avenues
  // (every fourth street), with traffic — headlights one way, tail lights
  // the other.
  for (let k = -80; k <= 80; k++) {
    const avenue = k % 4 === 0;
    const c = avenue ? '255,190,110' : '255,205,140';
    for (let t = -FAR * 0.5; t < FAR; t += avenue ? 18 : 30) {
      [-8, 8].forEach((side) => {
        dot(k * BLOCK + side, t, avenue ? 3.4 : 2.4, c, 0.9);
        dot(t - FAR * 1.2, k * BLOCK + side, avenue ? 3.4 : 2.4, c, 0.9);
      });
      if (avenue && rand() < 0.5) {
        dot(k * BLOCK - 3, t + rand() * 10, 2.6, '255,250,235', 0.95);
        dot(k * BLOCK + 3, t + rand() * 10, 2.4, '255,60,50', 0.9);
      }
    }
  }

  // The glow the lights throw up into the haze, and the haze itself
  // thickening toward the horizon.
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.filter = 'blur(3px)';
  ctx.globalAlpha = 0.28;
  ctx.drawImage(ctx.canvas, 0, horizon, W, span, 0, horizon, W, span);
  ctx.restore();
  const haze = ctx.createLinearGradient(0, horizon, 0, horizon + span * 0.1);
  haze.addColorStop(0, 'rgba(60,52,96,0.55)');
  haze.addColorStop(1, 'rgba(40,35,70,0)');
  ctx.fillStyle = haze;
  ctx.fillRect(0, horizon, W, span * 0.1);
}

// The view from the penthouse: a night skyline (Poly Haven's "Shanghai
// Bund", CC0) on a great curved screen outside the glass, with the horizon
// at the seated players' eye level and the lights of the city painted
// spreading away beneath it, so the room reads as high above the street —
// the photograph was taken at street level, and only its sky and skyline
// band is kept. Unlit and unfogged: it is the light of the city at night.
const SKYLINE_URL = import.meta.env.BASE_URL + 'assets/skyline/night_skyline.webp';
// The horizon sits a little under a seated player's eye, so the towers
// rise into the windows above the table rather than only the lights below.
const HORIZON_Y = 0.6;
function createSkyline(half) {
  const SKY_RADIUS = half * 2.6;
  const W = 4096, H = 2048;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  const bandH = Math.round(W * (1340 / 4096));
  const horizon = bandH;

  // The cylinder's shape, needed to draw the city in true perspective.
  const arc = THREE.MathUtils.degToRad(240);
  const height = (SKY_RADIUS * arc) * (H / W);
  const below = height * (1 - horizon / H);
  paintCityBelow(ctx, { W, H, horizon, arc, radius: SKY_RADIUS, below });

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  // Seen from inside, the cylinder would show its texture mirrored.
  texture.wrapS = THREE.RepeatWrapping;
  texture.repeat.x = -1;
  new THREE.ImageLoader().load(SKYLINE_URL, (img) => {
    ctx.drawImage(img, 0, 0, W, bandH);
    // The photograph's bottom edge — the far river bank — softened into
    // the haze over the city, so there is no seam at the horizon.
    const seam = ctx.createLinearGradient(0, bandH - 50, 0, bandH + 30);
    seam.addColorStop(0, 'rgba(42,37,70,0)');
    seam.addColorStop(0.6, 'rgba(42,37,70,0.7)');
    seam.addColorStop(1, 'rgba(42,37,70,0)');
    ctx.fillStyle = seam;
    ctx.fillRect(0, bandH - 50, W, 80);
    texture.needsUpdate = true;
  });

  // Sized so the photograph keeps its proportions: its band spans the arc
  // across the back and both sides, and its height in the texture follows.
  const geometry = new THREE.CylinderGeometry(SKY_RADIUS, SKY_RADIUS, height, 96, 1, true, Math.PI - arc / 2, arc);
  // Drawn as photographed: tone mapping washed the city out to a haze.
  const material = new THREE.MeshBasicMaterial({ map: texture, side: THREE.BackSide, fog: false, toneMapped: false });
  const sky = new THREE.Mesh(geometry, material);
  sky.position.y = HORIZON_Y - below + height / 2;
  return sky;
}

/**
 * Builds the room for a table's tier (1–5; see rooms.js). Returns a Group
 * holding floor, walls, ceiling, the light fittings and the furniture —
 * everything static. scene.js swaps it when the table changes.
 */
export function createRoom(tier = 3) {
  const theme = ROOM_THEMES[tier] || ROOM_THEMES[3];
  const d = roomDims(theme);
  const { half: ROOM_HALF, size: ROOM_SIZE, wallH: WALL_H, ceiling: CEILING_Y } = d;
  const room = new THREE.Group();
  room.userData.theme = theme;
  room.userData.dims = d;

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(ROOM_SIZE, ROOM_SIZE),
    new THREE.MeshLambertMaterial({ map: createCarpetTexture(theme) })
  );
  floor.material.map.repeat.set(ROOM_SIZE / 3, ROOM_SIZE / 3);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = FLOOR_Y;
  floor.receiveShadow = true;
  room.add(floor);

  const ceiling = new THREE.Mesh(
    new THREE.PlaneGeometry(ROOM_SIZE, ROOM_SIZE),
    new THREE.MeshLambertMaterial({ color: theme.ceiling })
  );
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.y = CEILING_Y;
  room.add(ceiling);

  // One texture for the side walls and the one behind the players, one
  // with the large crest for the back wall they face. In the penthouse the
  // back and side walls are glass.
  const glazed = !!theme.windows;
  const plainWall = createWallTexture(theme, d);
  const sideWall = glazed ? createWallTexture(theme, d, { glazed }) : plainWall;
  const backWall = createWallTexture(theme, d, { back: true, glazed });
  const walls = [
    { rotY: 0, pos: [0, -ROOM_HALF], map: backWall },
    { rotY: Math.PI, pos: [0, ROOM_HALF], map: plainWall },
    { rotY: Math.PI / 2, pos: [-ROOM_HALF, 0], map: sideWall },
    { rotY: -Math.PI / 2, pos: [ROOM_HALF, 0], map: sideWall },
  ];
  if (glazed) room.add(createSkyline(ROOM_HALF));
  walls.forEach(({ rotY, pos, map }) => {
    const wall = new THREE.Mesh(
      new THREE.PlaneGeometry(ROOM_SIZE, WALL_H),
      new THREE.MeshLambertMaterial({ map, alphaTest: glazed ? 0.5 : 0 })
    );
    wall.position.set(pos[0], FLOOR_Y + WALL_H / 2, pos[1]);
    wall.rotation.y = rotY;
    room.add(wall);
  });

  // The cove the wall wash comes from: a thin warm line where each wall
  // meets the ceiling. MeshBasic, so it glows without lighting anything.
  const coveMat = new THREE.MeshBasicMaterial({ color: theme.cove });
  walls.forEach(({ rotY, pos }) => {
    const cove = new THREE.Mesh(new THREE.PlaneGeometry(ROOM_SIZE, 0.06), coveMat);
    const inward = new THREE.Vector3(0, 0, 0.02).applyAxisAngle(new THREE.Vector3(0, 1, 0), rotY);
    cove.position.set(pos[0] + inward.x, CEILING_Y - 0.12, pos[1] + inward.z);
    cove.rotation.y = rotY;
    room.add(cove);
  });

  // The fitting the table's light comes from: a shallow recessed panel in
  // the ceiling directly over the felt.
  const panelFrame = new THREE.Mesh(
    new THREE.BoxGeometry(5.2, 0.12, 3.6),
    new THREE.MeshLambertMaterial({ color: 0x060505 })
  );
  panelFrame.position.set(0, CEILING_Y - 0.06, -0.4);
  room.add(panelFrame);
  const diffuser = new THREE.Mesh(
    new THREE.PlaneGeometry(4.8, 3.2),
    new THREE.MeshBasicMaterial({ color: theme.diffuser })
  );
  diffuser.rotation.x = Math.PI / 2;
  diffuser.position.set(0, CEILING_Y - 0.125, -0.4);
  room.add(diffuser);

  theme.furnish(room, ROOM_HALF, CEILING_Y);
  return room;
}
