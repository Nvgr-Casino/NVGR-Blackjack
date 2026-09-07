import * as THREE from 'three';

const SUIT_GLYPH = { S: '♠', H: '♥', D: '♦', C: '♣' };
const RED_SUITS = ['H', 'D'];

// Sized a bit past a literal real playing card (2.5in x 3.5in, same ratio)
// so the rank/suit stay easy to read from the wider, pulled-back table view
// — true-to-life size read as too small once the camera moved back to show
// the whole table at once.
export const CARD_WIDTH = 0.3;
export const CARD_HEIGHT = 0.42;
export const CARD_THICKNESS = 0.01;

const TEX_W = 512;
const TEX_H = 716;

function roundedRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawCorner(ctx, rank, suit, color) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.font = '900 114px Arial, sans-serif';
  ctx.fillText(rank, 0, 0);
  ctx.font = '700 88px Arial, sans-serif';
  ctx.fillText(SUIT_GLYPH[suit], 0, 88);
  ctx.restore();
}

const FACE_RANKS = ['J', 'Q', 'K'];

// A simplified double-ended court-card illustration — crown, face, and
// robed shoulders, mirrored top and bottom like a real J/Q/K, instead of
// just a big letter. Drawn centered on (0,0); caller translates/rotates.
function drawCourtFigure(ctx, rank, suit, color) {
  const gold = '#c9a13a';
  const skin = '#f2c9a0';
  const ink = '#2a1a10';

  ctx.save();

  // Frame around the whole figure, like a real court card's inner border.
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  roundedRect(ctx, -95, -115, 190, 230, 10);
  ctx.stroke();

  // Shoulders / robe.
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(-70, 100);
  ctx.quadraticCurveTo(-62, 48, 0, 44);
  ctx.quadraticCurveTo(62, 48, 70, 100);
  ctx.lineTo(-70, 100);
  ctx.closePath();
  ctx.fill();

  // Gold collar trim.
  ctx.strokeStyle = gold;
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(-62, 96);
  ctx.quadraticCurveTo(-55, 52, 0, 48);
  ctx.quadraticCurveTo(55, 52, 62, 96);
  ctx.stroke();

  // Head.
  ctx.beginPath();
  ctx.ellipse(0, 10, 30, 34, 0, 0, Math.PI * 2);
  ctx.fillStyle = skin;
  ctx.fill();
  ctx.strokeStyle = ink;
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Hair/beard, distinct per rank.
  ctx.fillStyle = '#4a3320';
  if (rank === 'K') {
    // A solid chin-beard dome, not a thin crescent — two close curves here
    // filled to almost no visible area the first time this was tried.
    ctx.beginPath();
    ctx.moveTo(-25, 14);
    ctx.quadraticCurveTo(-30, 55, 0, 62);
    ctx.quadraticCurveTo(30, 55, 25, 14);
    ctx.quadraticCurveTo(0, 28, -25, 14);
    ctx.closePath();
    ctx.fill();
  } else if (rank === 'Q') {
    ctx.beginPath();
    ctx.ellipse(-32, 14, 13, 36, 0.25, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(32, 14, 13, 36, -0.25, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.beginPath();
    ctx.ellipse(0, -6, 30, 16, 0, Math.PI, 0);
    ctx.fill();
  }

  // Crown (a simple cap with a jewel band for the Jack, a fuller crown for
  // King/Queen).
  ctx.fillStyle = gold;
  ctx.strokeStyle = '#8a6a20';
  ctx.lineWidth = 2;
  ctx.beginPath();
  if (rank === 'J') {
    ctx.moveTo(-22, -20);
    ctx.lineTo(22, -20);
    ctx.lineTo(18, -34);
    ctx.lineTo(-18, -34);
    ctx.closePath();
  } else {
    ctx.moveTo(-34, -14);
    ctx.lineTo(-34, -38);
    ctx.lineTo(-17, -20);
    ctx.lineTo(0, -46);
    ctx.lineTo(17, -20);
    ctx.lineTo(34, -38);
    ctx.lineTo(34, -14);
    ctx.closePath();
  }
  ctx.fill();
  ctx.stroke();
  if (rank !== 'J') {
    [-17, 0, 17].forEach((x) => {
      ctx.beginPath();
      ctx.arc(x, -30, 3.4, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
    });
  }

  // Face: eyes and a simple mouth line.
  ctx.fillStyle = ink;
  ctx.beginPath();
  ctx.arc(-10, 8, 2.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(10, 8, 2.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = ink;
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(-7, 20);
  ctx.quadraticCurveTo(0, 24, 7, 20);
  ctx.stroke();

  // Small suit mark on the chest, tying the figure to its suit.
  ctx.fillStyle = gold;
  ctx.font = '26px Georgia, serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(SUIT_GLYPH[suit], 0, 72);

  ctx.restore();
}

function faceCacheKey(rank, suit) {
  return `${rank}-${suit}`;
}

const textureCache = new Map();

function finalizeTexture(canvas) {
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

function makeFaceTexture(rank, suit) {
  const key = faceCacheKey(rank, suit);
  if (textureCache.has(key)) return textureCache.get(key);

  const canvas = document.createElement('canvas');
  canvas.width = TEX_W;
  canvas.height = TEX_H;
  const ctx = canvas.getContext('2d');
  // Classic printed-card colors — flat, saturated red and true black, no
  // muted tones.
  const color = RED_SUITS.includes(suit) ? '#d0021b' : '#111111';

  // Bright flat white card stock — no tint, no vignette, no gold frame or
  // watermark. A real playing card is just crisp white with a thin edge.
  ctx.fillStyle = '#ffffff';
  roundedRect(ctx, 0, 0, TEX_W, TEX_H, 22);
  ctx.fill();

  ctx.strokeStyle = '#dcdcdc';
  ctx.lineWidth = 2;
  roundedRect(ctx, 6, 6, TEX_W - 12, TEX_H - 12, 18);
  ctx.stroke();

  if (FACE_RANKS.includes(rank)) {
    // Double-ended court-card illustration instead of a big letter.
    ctx.save();
    ctx.translate(TEX_W / 2, TEX_H / 2 - 118);
    drawCourtFigure(ctx, rank, suit, color);
    ctx.restore();

    ctx.save();
    ctx.translate(TEX_W / 2, TEX_H / 2 + 118);
    ctx.rotate(Math.PI);
    drawCourtFigure(ctx, rank, suit, color);
    ctx.restore();
  } else {
    // Big center rank + suit — bold sans, flat fill, matching a real card's
    // plain jumbo index.
    ctx.fillStyle = color;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '900 196px Arial, sans-serif';
    ctx.fillText(rank, TEX_W / 2, TEX_H / 2 - 74);
    ctx.font = '700 168px Arial, sans-serif';
    ctx.fillText(SUIT_GLYPH[suit], TEX_W / 2, TEX_H / 2 + 138);
  }

  // Corner pips, top-left and (rotated) bottom-right.
  ctx.save();
  ctx.translate(76, 96);
  drawCorner(ctx, rank, suit, color);
  ctx.restore();

  ctx.save();
  ctx.translate(TEX_W - 76, TEX_H - 96);
  ctx.rotate(Math.PI);
  drawCorner(ctx, rank, suit, color);
  ctx.restore();

  const texture = finalizeTexture(canvas);
  textureCache.set(key, texture);
  return texture;
}

let backTextureCache = null;
function makeBackTexture() {
  if (backTextureCache) return backTextureCache;

  const canvas = document.createElement('canvas');
  canvas.width = TEX_W;
  canvas.height = TEX_H;
  const ctx = canvas.getContext('2d');

  const bgGrad = ctx.createRadialGradient(
    TEX_W / 2, TEX_H * 0.35, TEX_H * 0.05,
    TEX_W / 2, TEX_H * 0.5, TEX_H * 0.8
  );
  bgGrad.addColorStop(0, '#8a1017');
  bgGrad.addColorStop(1, '#340608');
  ctx.fillStyle = bgGrad;
  roundedRect(ctx, 0, 0, TEX_W, TEX_H, 28);
  ctx.fill();

  ctx.strokeStyle = '#d4af52';
  ctx.lineWidth = 8;
  roundedRect(ctx, 16, 16, TEX_W - 32, TEX_H - 32, 22);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(212,175,82,0.55)';
  ctx.lineWidth = 2;
  roundedRect(ctx, 30, 30, TEX_W - 60, TEX_H - 60, 18);
  ctx.stroke();

  // Diamond lattice motif.
  ctx.strokeStyle = 'rgba(212,175,82,0.4)';
  ctx.lineWidth = 1.5;
  const step = 46;
  for (let x = -TEX_H; x < TEX_W + TEX_H; x += step) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + TEX_H, TEX_H);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x, TEX_H);
    ctx.lineTo(x + TEX_H, 0);
    ctx.stroke();
  }

  // Center gold crest.
  ctx.fillStyle = '#3f0a0c';
  ctx.beginPath();
  ctx.arc(TEX_W / 2, TEX_H / 2, 92, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#d4af52';
  ctx.lineWidth = 4;
  ctx.stroke();
  ctx.fillStyle = '#eac35e';
  ctx.font = '110px Georgia, serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('♦', TEX_W / 2, TEX_H / 2 + 8);

  backTextureCache = finalizeTexture(canvas);
  return backTextureCache;
}

// A hand of cards gets rebuilt many times over a session (every deal, hit,
// split, new round). Every card of a given rank/suit is visually identical,
// so geometry and materials are built once and shared across every mesh —
// only the textures were cached before, but a fresh BoxGeometry and three
// fresh MeshLambertMaterials were still being allocated per card, which
// piles up as GC churn over a long session and was part of what read as
// the whole scene getting less smooth over time.
let sharedGeometry = null;
function getGeometry() {
  if (!sharedGeometry) sharedGeometry = new THREE.BoxGeometry(CARD_WIDTH, CARD_THICKNESS, CARD_HEIGHT);
  return sharedGeometry;
}

let sharedEdgeMat = null;
function getEdgeMaterial() {
  // Lambert, not Standard: card stock is matte, and Standard keeps a thin
  // specular lobe even at high roughness — while a card is tumbling through
  // its deal animation, that lobe flashes bright as it sweeps past the key
  // light, which read as a brightness bug. Same fix as the felt.
  if (!sharedEdgeMat) sharedEdgeMat = new THREE.MeshLambertMaterial({ color: 0xf4f4f0 });
  return sharedEdgeMat;
}

const faceMatCache = new Map();
function getFaceMaterial(rank, suit) {
  const key = faceCacheKey(rank, suit);
  if (!faceMatCache.has(key)) {
    // Basic, not Lambert: a lit material multiplies the texture by the
    // scene's warm, dim-ish light color (the felt's lighting is tuned for
    // mood, not for showing white paper true-white), which is exactly why
    // "bright white" card stock was actually rendering as a dull tan/gray.
    // The card face is flat printed stock, not a lit 3D surface, so it
    // doesn't need to respond to scene lights at all — showing the texture
    // exactly as drawn is the correct, and simplest, fix.
    faceMatCache.set(key, new THREE.MeshBasicMaterial({ map: makeFaceTexture(rank, suit) }));
  }
  return faceMatCache.get(key);
}

let sharedBackMat = null;
function getBackMaterial() {
  if (!sharedBackMat) sharedBackMat = new THREE.MeshLambertMaterial({ map: makeBackTexture() });
  return sharedBackMat;
}

// Card lies flat with its face pointing up (+Y) and back pointing down (-Y),
// so a dealt card sits on the table with no extra rotation needed.
export function createCard(rank, suit) {
  const edgeMat = getEdgeMaterial();
  // BoxGeometry material order: +X, -X, +Y, -Y, +Z, -Z
  const materials = [edgeMat, edgeMat, getFaceMaterial(rank, suit), getBackMaterial(), edgeMat, edgeMat];
  const mesh = new THREE.Mesh(getGeometry(), materials);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.userData = { rank, suit };
  return mesh;
}
