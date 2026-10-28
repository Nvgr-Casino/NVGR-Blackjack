import * as THREE from 'three';
import { drawCasinoCrest } from './crest.js';
import { FLOOR_Y } from './scale.js';

// The salon the table stands in.
//
// A quiet, dark room: warm charcoal walls panelled in walnut, a deep
// carpet, and one pool of light over the table. The earlier room was
// burgundy and gold with the house mark painted a dozen times over, lit
// everywhere — it shouted, and the table had to shout back to be seen.
// Here the room stays in shadow so the table is the brightest thing in
// it, the way a real high-limit salon is lit. The house mark appears once,
// on the back wall, in brushed brass.
//
// Every surface is Lambert: matte, no specular, nothing to glint. The
// walls and floor cover most of the screen, so they are also the cheapest
// material three.js has.

export const CEILING_Y = 6.4;
export const ROOM_HALF = 13;  // walls at ±13 in x and z
const WALL_H = CEILING_Y - FLOOR_Y;
const ROOM_SIZE = ROOM_HALF * 2;

// Texture resolution is chosen so a wall's pixels-per-world-unit come out
// the same horizontally and vertically, or the crest would be stretched.
const WALL_TEX_W = 2048;
const WALL_TEX_H = Math.round((WALL_TEX_W * WALL_H) / ROOM_SIZE);
const PX_PER_UNIT = WALL_TEX_W / ROOM_SIZE;

// The back wall's mark hangs where the seated camera actually sees it:
// clear above the dealer's head, below the top of the frame.
const MARK_Y = 2.9;
const markTexY = (worldY) => (CEILING_Y - worldY) * PX_PER_UNIT;

// Brushed brass, the room's single accent.
const BRASS_RGB = '176,146,92';

/**
 * Paints a wall: vertical walnut slats, a plain skirting board, and a
 * soft wash of light down from a cove at the ceiling line. The wash is
 * painted rather than lit — a real light per wall would cost every pixel on
 * screen, and a gradient reads the same from the table.
 */
function createWallTexture({ crest = false } = {}) {
  const canvas = document.createElement('canvas');
  canvas.width = WALL_TEX_W;
  canvas.height = WALL_TEX_H;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#2c2119';
  ctx.fillRect(0, 0, WALL_TEX_W, WALL_TEX_H);

  // Slats: narrow boards with a dark groove between each, every board a
  // touch different in tone so it reads as timber rather than a stripe.
  const slat = PX_PER_UNIT * 0.32;
  for (let x = 0, i = 0; x < WALL_TEX_W; x += slat, i++) {
    const tone = 50 + ((i * 37) % 10);
    ctx.fillStyle = `rgb(${tone + 4},${tone - 6},${tone - 13})`;
    ctx.fillRect(x, 0, slat - 3, WALL_TEX_H);
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(x + slat - 3, 0, 3, WALL_TEX_H);
  }

  // Fine grain along each board.
  const img = ctx.getImageData(0, 0, WALL_TEX_W, WALL_TEX_H);
  const px = img.data;
  for (let i = 0; i < px.length; i += 4) {
    const n = (Math.random() - 0.5) * 6;
    px[i] += n; px[i + 1] += n; px[i + 2] += n;
  }
  ctx.putImageData(img, 0, 0);

  // Cove light washing down from the ceiling, fading out by mid-wall.
  const wash = ctx.createLinearGradient(0, 0, 0, WALL_TEX_H * 0.6);
  wash.addColorStop(0, 'rgba(255,214,160,0.26)');
  wash.addColorStop(1, 'rgba(255,214,160,0)');
  ctx.fillStyle = wash;
  ctx.fillRect(0, 0, WALL_TEX_W, WALL_TEX_H * 0.6);

  // Skirting.
  const skirtH = PX_PER_UNIT * 0.28;
  ctx.fillStyle = '#100c0a';
  ctx.fillRect(0, WALL_TEX_H - skirtH, WALL_TEX_W, skirtH);

  if (crest) {
    drawCasinoCrest(ctx, {
      x: WALL_TEX_W / 2,
      y: markTexY(MARK_Y),
      width: 2.2 * PX_PER_UNIT,
      alpha: 0.75,
      rgb: BRASS_RGB,
    });
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

// Deep, near-black carpet with a tonal pattern you only notice up close.
function createCarpetTexture() {
  const S = 512;
  const canvas = document.createElement('canvas');
  canvas.width = S;
  canvas.height = S;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#34271f';
  ctx.fillRect(0, 0, S, S);

  const img = ctx.getImageData(0, 0, S, S);
  const px = img.data;
  for (let i = 0; i < px.length; i += 4) {
    const n = (Math.random() - 0.5) * 14;
    px[i] += n; px[i + 1] += n; px[i + 2] += n;
  }
  ctx.putImageData(img, 0, 0);

  ctx.strokeStyle = 'rgba(0,0,0,0.22)';
  ctx.lineWidth = 6;
  ctx.strokeRect(S * 0.08, S * 0.08, S * 0.84, S * 0.84);
  ctx.strokeStyle = `rgba(${BRASS_RGB},0.06)`;
  ctx.lineWidth = 2;
  ctx.strokeRect(S * 0.16, S * 0.16, S * 0.68, S * 0.68);

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(8, 8);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

/**
 * Builds the room. Returns a Group holding floor, walls, ceiling and the
 * light fittings — everything static, built once.
 */
export function createRoom() {
  const room = new THREE.Group();

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(ROOM_SIZE, ROOM_SIZE),
    new THREE.MeshLambertMaterial({ map: createCarpetTexture() })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = FLOOR_Y;
  floor.receiveShadow = true;
  room.add(floor);

  const ceiling = new THREE.Mesh(
    new THREE.PlaneGeometry(ROOM_SIZE, ROOM_SIZE),
    new THREE.MeshLambertMaterial({ color: 0x0c0a09 })
  );
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.y = CEILING_Y;
  room.add(ceiling);

  // One texture for the three plain walls, one with the crest for the back
  // wall the players face.
  const plainWall = createWallTexture();
  const backWall = createWallTexture({ crest: true });
  const walls = [
    { rotY: 0, pos: [0, -ROOM_HALF], map: backWall },
    { rotY: Math.PI, pos: [0, ROOM_HALF], map: plainWall },
    { rotY: Math.PI / 2, pos: [-ROOM_HALF, 0], map: plainWall },
    { rotY: -Math.PI / 2, pos: [ROOM_HALF, 0], map: plainWall },
  ];
  walls.forEach(({ rotY, pos, map }) => {
    const wall = new THREE.Mesh(
      new THREE.PlaneGeometry(ROOM_SIZE, WALL_H),
      new THREE.MeshLambertMaterial({ map })
    );
    wall.position.set(pos[0], FLOOR_Y + WALL_H / 2, pos[1]);
    wall.rotation.y = rotY;
    room.add(wall);
  });

  // The cove the wall wash comes from: a thin warm line where each wall
  // meets the ceiling. MeshBasic, so it glows without lighting anything.
  const coveMat = new THREE.MeshBasicMaterial({ color: 0x8a6a45 });
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
    new THREE.MeshBasicMaterial({ color: 0x9c8a70 })
  );
  diffuser.rotation.x = Math.PI / 2;
  diffuser.position.set(0, CEILING_Y - 0.125, -0.4);
  room.add(diffuser);

  return room;
}
