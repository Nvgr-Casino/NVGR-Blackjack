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

// The view from the penthouse: New York at night from the 63rd floor of
// 70 Pine Street — the East River, the Brooklyn Bridge and the towers of
// downtown below (Andre Carrotflower, Wikimedia Commons, CC BY-SA 4.0; see
// art/CREDITS.md) — on a great curved screen outside the glass, round the
// back and both sides. One photograph taken from that height, so the city
// lies below the windows as it would. Its horizon is set just under a
// seated player's eye. Unlit and unfogged: it is the light of the city.
const smallScreen = window.matchMedia('(pointer: coarse)').matches || window.innerWidth < 820;
const SKYLINE_URL = import.meta.env.BASE_URL + 'assets/skyline/' + (smallScreen ? 'night_skyline_ny_4k.webp' : 'night_skyline_ny.webp');
const SKYLINE_ASPECT = 8192 / 2237;
// Where the horizon is in the photograph, from its top.
const PHOTO_HORIZON = 0.452;
const HORIZON_Y = 1.6;
function createSkyline(half) {
  const radius = half * 2.6;
  const arc = THREE.MathUtils.degToRad(240);
  // As tall as the photograph's proportions make it over that arc.
  const height = (radius * arc) / SKYLINE_ASPECT;
  const texture = new THREE.TextureLoader().load(SKYLINE_URL);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  // Seen from inside, the cylinder would show its texture mirrored.
  texture.wrapS = THREE.RepeatWrapping;
  texture.repeat.x = -1;
  const geometry = new THREE.CylinderGeometry(radius, radius, height, 128, 1, true, Math.PI - arc / 2, arc);
  // Drawn as photographed: tone mapping would wash the city out.
  const material = new THREE.MeshBasicMaterial({ map: texture, side: THREE.BackSide, fog: false, toneMapped: false });
  const sky = new THREE.Mesh(geometry, material);
  // The photograph's horizon at HORIZON_Y.
  sky.position.y = HORIZON_Y - height / 2 + PHOTO_HORIZON * height;
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
