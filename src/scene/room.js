import * as THREE from 'three';
import { drawCasinoCrest } from './crest.js';
import logoUrl from '../assets/nvgr-mark.png';
import { FLOOR_Y } from './scale.js';

// The salon the table stands in. Before this the table floated on a dark
// disc in an empty void, which read as a 3D asset rather than a place —
// walls give the room a horizon, somewhere for the light to fall off
// against, and somewhere to put the house's name.
//
// The room is deliberately one fixed livery (burgundy, dark wood, gold)
// even though each table picks its own felt colour: the house is the
// constant and the tables are the variable, the same way a real floor
// works. Retinting the walls per table would also mean repainting every
// wall texture on each join.

// Floor height comes from the shared scale (see scale.js).
export const CEILING_Y = 6.4; // just clears the pendant lamp's cord
export const ROOM_HALF = 13;  // walls at ±13 in x and z
const WALL_H = CEILING_Y - FLOOR_Y;
const ROOM_SIZE = ROOM_HALF * 2;

// Texture resolution is chosen so a wall's pixels-per-world-unit comes out
// the same horizontally and vertically — otherwise the crests painted into
// it would come out stretched.
const WALL_TEX_W = 2048;
const WALL_TEX_H = Math.round((WALL_TEX_W * WALL_H) / ROOM_SIZE); // ≈576
const PX_PER_UNIT = WALL_TEX_W / ROOM_SIZE;

const GOLD = '#d4af52';
const GOLD_LIT = '#f2dc9c';

// Vertical bands of the wall, as fractions of its height measured from the
// top: a gold cornice, the papered upper wall, a chair rail, then panelled
// wainscot down to the floor.
const CORNICE_END = 0.055;
// The dado sits low — about a third of the dealer's height, which is where
// a real one lands. It used to reach 2.7 units, chest height on the dealer,
// which both looked wrong and pushed the wall marks up out of frame.
const RAIL_START = 0.84;
const RAIL_END = 0.865;

// Every wall mark hangs at this world height, and it is not a matter of
// taste. The camera looks *down* at the table, so on a wall this far away
// the whole upper half of the room sits above the top of the frame —
// branding painted at a natural eye-line height is branding nobody ever
// sees. This height lands the marks in the band between the far wall's
// floor line and the top of the screen, clear of both the dealer's head
// below and the HUD bar above.
const MARK_Y = 1.4;
// Texture space runs from the top of the wall down, so a world height
// converts by measuring down from the ceiling.
const markTexY = (worldY) => (CEILING_Y - worldY) * PX_PER_UNIT;

function goldBand(ctx, y, h) {
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, '#8a6a26');
  g.addColorStop(0.45, GOLD_LIT);
  g.addColorStop(0.55, GOLD);
  g.addColorStop(1, '#6f5220');
  ctx.fillStyle = g;
  ctx.fillRect(0, y, WALL_TEX_W, h);
}

// A faint diamond lattice with a suit pip at each crossing — enough texture
// that the upper wall isn't a flat colour, faint enough that it never
// competes with the branding sitting on top of it.
function damask(ctx, top, height) {
  const step = PX_PER_UNIT * 1.6;
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, top, WALL_TEX_W, height);
  ctx.clip();

  ctx.strokeStyle = 'rgba(234,195,94,0.07)';
  ctx.lineWidth = 1.5;
  for (let x = -height; x < WALL_TEX_W + height; x += step) {
    ctx.beginPath();
    ctx.moveTo(x, top); ctx.lineTo(x + height, top + height);
    ctx.moveTo(x, top + height); ctx.lineTo(x + height, top);
    ctx.stroke();
  }

  ctx.fillStyle = 'rgba(234,195,94,0.09)';
  ctx.font = `${step * 0.3}px Georgia, serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const suits = ['♠', '♥', '♦', '♣'];
  let n = 0;
  for (let y = top + step / 2; y < top + height; y += step) {
    for (let x = step / 2; x < WALL_TEX_W; x += step) {
      ctx.fillText(suits[n++ % suits.length], x, y);
    }
  }
  ctx.restore();
}

// Wainscot: recessed panels in a gold frame, the way a real gaming room's
// dado is built.
function panelling(ctx, top, height) {
  ctx.fillStyle = '#25100b';
  ctx.fillRect(0, top, WALL_TEX_W, height);

  const panels = 12;
  const w = WALL_TEX_W / panels;
  const inset = w * 0.12;
  const padY = height * 0.16;
  for (let i = 0; i < panels; i++) {
    const x = i * w + inset;
    const y = top + padY;
    const pw = w - inset * 2;
    const ph = height - padY * 2;
    ctx.fillStyle = '#31170f';
    ctx.fillRect(x, y, pw, ph);
    ctx.strokeStyle = 'rgba(212,175,82,0.34)';
    ctx.lineWidth = 2.5;
    ctx.strokeRect(x, y, pw, ph);
    // A highlight on the top/left edges reads as a bevel under the room's
    // overhead light without needing real geometry.
    ctx.strokeStyle = 'rgba(255,235,180,0.10)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x, y + ph); ctx.lineTo(x, y); ctx.lineTo(x + pw, y);
    ctx.stroke();
  }
}

/**
 * Paints one wall. `crests` places the house mark along the upper band,
 * each entry positioned by `u` (0–1 across the wall).
 */
function createWallTexture(crests) {
  const canvas = document.createElement('canvas');
  canvas.width = WALL_TEX_W;
  canvas.height = WALL_TEX_H;
  const ctx = canvas.getContext('2d');

  // Upper wall: deep burgundy, darker toward the floor so the room reads as
  // lit from the pendant above rather than uniformly flat.
  const wall = ctx.createLinearGradient(0, 0, 0, WALL_TEX_H);
  wall.addColorStop(0, '#5e1a29');
  wall.addColorStop(0.55, '#45121f');
  wall.addColorStop(1, '#2a0b13');
  ctx.fillStyle = wall;
  ctx.fillRect(0, 0, WALL_TEX_W, WALL_TEX_H);

  const upperTop = CORNICE_END * WALL_TEX_H;
  const upperH = RAIL_START * WALL_TEX_H - upperTop;
  damask(ctx, upperTop, upperH);

  goldBand(ctx, 0, CORNICE_END * WALL_TEX_H);
  goldBand(ctx, RAIL_START * WALL_TEX_H, (RAIL_END - RAIL_START) * WALL_TEX_H);
  panelling(ctx, RAIL_END * WALL_TEX_H, (1 - RAIL_END) * WALL_TEX_H);

  // Marks go on last so they sit over the rail and panelling rather than
  // being buried under them.
  crests.forEach(({ u, width, alpha }) => {
    drawCasinoCrest(ctx, {
      x: WALL_TEX_W * u,
      y: markTexY(MARK_Y),
      width: width * PX_PER_UNIT,
      alpha,
    });
  });

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 16;
  return texture;
}

// Patterned carpet — a gold lattice over deep red, tiled across the floor.
function createCarpetTexture() {
  const S = 512;
  const canvas = document.createElement('canvas');
  canvas.width = S;
  canvas.height = S;
  const ctx = canvas.getContext('2d');

  // Lit brighter than it looks it should be. Lambert takes no light from
  // the environment probe the way the old Standard material did, so the
  // carpet lost most of its fill light in the swap and went almost black
  // between the table and the walls. Putting the brightness into the
  // texture rather than into scene-wide ambient keeps it off the felt and
  // the figures, which were already lit correctly.
  ctx.fillStyle = '#5c1a24';
  ctx.fillRect(0, 0, S, S);

  // Grain first, so the lattice drawn on top stays crisp.
  const img = ctx.getImageData(0, 0, S, S);
  const px = img.data;
  for (let i = 0; i < px.length; i += 4) {
    const n = (Math.random() - 0.5) * 16;
    px[i] += n; px[i + 1] += n; px[i + 2] += n;
  }
  ctx.putImageData(img, 0, 0);

  ctx.strokeStyle = 'rgba(212,175,82,0.16)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(0, S / 2); ctx.lineTo(S / 2, 0); ctx.lineTo(S, S / 2); ctx.lineTo(S / 2, S);
  ctx.closePath();
  ctx.stroke();

  ctx.strokeStyle = 'rgba(212,175,82,0.10)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(S / 2, S / 2, S * 0.17, 0, Math.PI * 2);
  ctx.stroke();

  ctx.fillStyle = 'rgba(212,175,82,0.13)';
  [[S / 2, S / 2], [0, 0], [S, 0], [0, S], [S, S]].forEach(([x, y]) => {
    ctx.beginPath();
    ctx.moveTo(x, y - 13); ctx.lineTo(x + 10, y); ctx.lineTo(x, y + 13); ctx.lineTo(x - 10, y);
    ctx.closePath();
    ctx.fill();
  });

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(7, 7);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 16;
  return texture;
}

function createCeilingTexture() {
  const S = 512;
  const canvas = document.createElement('canvas');
  canvas.width = S;
  canvas.height = S;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#160509';
  ctx.fillRect(0, 0, S, S);
  ctx.strokeStyle = 'rgba(212,175,82,0.10)';
  ctx.lineWidth = 6;
  ctx.strokeRect(S * 0.06, S * 0.06, S * 0.88, S * 0.88);
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(5, 5);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

// A wall-mounted uplighter: a small gold half-cone throwing warm light up
// the wall behind it.
function createSconce() {
  const group = new THREE.Group();
  const shade = new THREE.Mesh(
    new THREE.ConeGeometry(0.26, 0.5, 14, 1, true),
    new THREE.MeshStandardMaterial({
      color: 0x6b511f, roughness: 0.35, metalness: 0.8,
      emissive: 0xffc061, emissiveIntensity: 0.85, side: THREE.DoubleSide,
    })
  );
  group.add(shade);
  const bracket = new THREE.Mesh(
    new THREE.BoxGeometry(0.1, 0.34, 0.1),
    new THREE.MeshStandardMaterial({ color: 0x4a3a18, roughness: 0.5, metalness: 0.7 })
  );
  bracket.position.y = -0.36;
  group.add(bracket);
  return group;
}

/**
 * Builds the room. Returns a Group holding floor, walls, ceiling and the
 * house signage — everything static, so it is created once and never
 * touched again.
 */
export function createRoom({ lowPower = false } = {}) {
  const room = new THREE.Group();

  // Lambert, not Standard, for every surface in here. The walls, carpet and
  // ceiling are matte — they have no specular response worth paying for —
  // yet between them they cover most of the screen, so shading them with
  // the full PBR model (and an environment probe lookup per fragment) was
  // the single most expensive thing the room added. Lambert still supports
  // the emissive map the gold needs.
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
    new THREE.MeshLambertMaterial({ map: createCeilingTexture() })
  );
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.y = CEILING_Y;
  room.add(ceiling);

  // The back wall is the one every player is looking at — past the dealer —
  // so it carries the illuminated sign and its painted crests only flank
  // the centre. The side walls, caught in peripheral view, carry the house
  // mark full size. The front wall sits behind the camera and gets the
  // lightest treatment.
  const wallSpecs = [
    { rotY: 0, pos: [0, 0, -ROOM_HALF], crests: [{ u: 0.15, width: 2.4, alpha: 0.46 }, { u: 0.85, width: 2.4, alpha: 0.46 }] },
    { rotY: Math.PI, pos: [0, 0, ROOM_HALF], crests: [{ u: 0.3, width: 2.4, alpha: 0.34 }, { u: 0.7, width: 2.4, alpha: 0.34 }] },
    { rotY: Math.PI / 2, pos: [-ROOM_HALF, 0, 0], crests: [{ u: 0.22, width: 3.3, alpha: 0.58 }, { u: 0.5, width: 3.3, alpha: 0.58 }, { u: 0.78, width: 3.3, alpha: 0.58 }] },
    { rotY: -Math.PI / 2, pos: [ROOM_HALF, 0, 0], crests: [{ u: 0.22, width: 3.3, alpha: 0.58 }, { u: 0.5, width: 3.3, alpha: 0.58 }, { u: 0.78, width: 3.3, alpha: 0.58 }] },
  ];

  wallSpecs.forEach(({ rotY, pos, crests }) => {
    const map = createWallTexture(crests);
    const wall = new THREE.Mesh(
      new THREE.PlaneGeometry(ROOM_SIZE, WALL_H),
      new THREE.MeshLambertMaterial({
        map,
        // The room is lit dimly on purpose, and gold that only ever reflects
        // is gold you cannot read. Re-using the colour map as an emissive
        // map lets the bright texels — the cornice, the rail, the crests —
        // carry a little light of their own, so the branding stays legible
        // in the corners the pendant never reaches.
        emissiveMap: map,
        emissive: 0xffffff,
        emissiveIntensity: 0.16,
      })
    );
    wall.position.set(pos[0], FLOOR_Y + WALL_H / 2, pos[2]);
    wall.rotation.y = rotY;
    wall.receiveShadow = true;
    room.add(wall);
  });

  // The illuminated house sign above the dealer. MeshBasicMaterial on
  // purpose: it ignores the room's lighting entirely, which is exactly how
  // a backlit sign behaves against a dim wall.
  // Hung on the same line as the wall crests, and sized to fill the band
  // between the floor line and the top of the frame. It clears the dealer
  // easily: the dealer is four times closer to the camera, so their head
  // sits well below the far wall's floor line on screen.
  // Larger than the CASINO crests flanking it — the artwork carries its own
  // transparent margin, so the plane has to be bigger than the crests to
  // read as bigger than them.
  const SIGN_SIZE = 3.0;
  const signMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0 });
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(SIGN_SIZE, SIGN_SIZE), signMat);
  sign.position.set(0, MARK_Y - 0.1, -ROOM_HALF + 0.06);
  room.add(sign);
  new THREE.TextureLoader().load(logoUrl, (tex) => {
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 16;
    signMat.map = tex;
    signMat.opacity = 1;
    signMat.needsUpdate = true;
  });

  // Warm spill from the sign onto the wall around it, so the sign reads as
  // a light source in the room rather than a sticker on the wall.
  const signGlow = new THREE.PointLight(0xffc46a, 1.5, 11, 2);
  signGlow.position.set(0, MARK_Y, -ROOM_HALF + 1.6);
  room.add(signGlow);

  // Sconces down both side walls. Only the middle pair ever carries a real
  // light — the rest are emissive fixtures, which cost nothing per fragment
  // and read the same at this distance. On a phone even that pair stands
  // down, leaving the glowing shades: two fewer lights for every fragment
  // on screen, for a difference you have to hunt for.
  [-ROOM_HALF + 0.12, ROOM_HALF - 0.12].forEach((x) => {
    const inward = x < 0 ? 1 : -1;
    [-6.5, 0, 6.5].forEach((z) => {
      const sconce = createSconce();
      sconce.position.set(x, 2.6, z);
      sconce.rotation.z = inward * -0.32;
      room.add(sconce);
      if (z === 0 && !lowPower) {
        const lamp = new THREE.PointLight(0xffb964, 0.85, 13, 2);
        lamp.position.set(x + inward * 0.5, 3.0, z);
        room.add(lamp);
      }
    });
  });

  return room;
}
