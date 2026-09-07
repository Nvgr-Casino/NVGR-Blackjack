import * as THREE from 'three';

// A real casino "D" table: a semicircular front for the players plus a pair
// of straight parallel sides running back to a flat rear edge for the
// dealer — an actual capital-D silhouette, not just a circle with a corner
// snipped off. TABLE_RADIUS is the semicircle's radius (and so the felt's
// full width, held constant all the way back rather than tapering like a
// circle would); SIDE_LENGTH is how far those straight sides run before the
// flat back edge closes the shape off.
// Both shrunk: the straight back stretch used to leave a big dead zone of
// empty felt between the dealer's rail and where their cards actually land
// — SIDE_LENGTH is cut down to just enough depth for the rail/shoe/tray to
// sit behind the dealer without that gap, and the whole table is a little
// smaller overall so the dealer reads as close instead of far across an
// empty table.
export const TABLE_RADIUS = 2.6;
const SIDE_LENGTH = 1.0;
export const TABLE_BACK_Z = -SIDE_LENGTH;

// Builds the D-shaped outline: up the left straight side, across the front
// semicircle, down the right straight side, then THREE.Shape auto-closes
// with one final straight line back to the start — that's the flat back
// edge. Angle 0 = +Z = the player-facing front, matching seats.js.
function buildTableShape(radius, sideLength) {
  const shape = new THREE.Shape();
  const segments = 48;
  shape.moveTo(-radius, -sideLength);
  shape.lineTo(-radius, 0);
  for (let i = 0; i <= segments; i++) {
    const deg = -90 + 180 * (i / segments);
    const rad = THREE.MathUtils.degToRad(deg);
    shape.lineTo(Math.sin(rad) * radius, Math.cos(rad) * radius);
  }
  shape.lineTo(radius, -sideLength);
  return shape;
}

// THREE.ShapeGeometry does not normalize UVs to the shape's bounding box —
// it uses the raw shape-space (x, y) coordinates directly. For a shape sized
// in real world units (here, roughly -3..3.5) that puts almost every vertex
// outside the [0,1] UV range, so the texture sampler clamps nearly the whole
// surface to a single edge pixel — which is exactly the "empty with a
// stray stripe" look the felt had. This remaps UVs to the shape's actual
// bounding box so the full texture spreads across the full surface.
function normalizeShapeUVs(geometry) {
  geometry.computeBoundingBox();
  const { min, max } = geometry.boundingBox;
  const width = max.x - min.x;
  const height = max.y - min.y;
  const position = geometry.attributes.position;
  const uv = geometry.attributes.uv;
  for (let i = 0; i < position.count; i++) {
    uv.setXY(
      i,
      (position.getX(i) - min.x) / width,
      1 - (position.getY(i) - min.y) / height
    );
  }
  uv.needsUpdate = true;
}

const FELT_W = 1000;
const FELT_H = 1900;

// Each table picks a cloth. Every one of these is a deep, saturated colour,
// so the single bright gold ink used for the rules text and the house crest
// keeps its contrast on all of them — the lettering is never restyled per
// table, only the cloth underneath it changes.
export const FELT_THEMES = {
  red: { hi: '#cc2c42', lo: '#7d1420' },
  green: { hi: '#127a4f', lo: '#06371f' },
  blue: { hi: '#1b5fa8', lo: '#0a2647' },
  purple: { hi: '#5b3a8a', lo: '#24123f' },
  black: { hi: '#33333a', lo: '#0d0d10' },
};
export const FELT_THEME_KEYS = Object.keys(FELT_THEMES);
export function feltTheme(key) { return FELT_THEMES[key] || FELT_THEMES.red; }

// Canvas-painted felt: a warm radial vignette, the house-rules text placed
// where the dealer's rail props won't cover it, and a subtle branding line.
function createFeltTexture(themeKey) {
  const theme = feltTheme(themeKey);
  const canvas = document.createElement('canvas');
  canvas.width = FELT_W;
  canvas.height = FELT_H;
  const ctx = canvas.getContext('2d');

  const gradient = ctx.createRadialGradient(
    FELT_W / 2, FELT_H * 0.38, FELT_H * 0.06,
    FELT_W / 2, FELT_H * 0.5, FELT_H * 0.62
  );
  gradient.addColorStop(0, theme.hi);
  gradient.addColorStop(1, theme.lo);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, FELT_W, FELT_H);

  // Break up tone-mapping banding on the smooth gradient with a little
  // grain — without this a visible hard ring/streak shows up where the
  // gradient's slope changes, especially under ACES tone mapping.
  const grain = ctx.getImageData(0, 0, FELT_W, FELT_H);
  const px = grain.data;
  for (let i = 0; i < px.length; i += 4) {
    const n = (Math.random() - 0.5) * 10;
    px[i] += n;
    px[i + 1] += n;
    px[i + 2] += n;
  }
  ctx.putImageData(grain, 0, 0);

  ctx.strokeStyle = 'rgba(234,195,94,0.32)';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(FELT_W / 2, FELT_H * 0.62, FELT_W * 0.42, Math.PI * 0.06, Math.PI * 0.94);
  ctx.stroke();

  // Plain fill, no stroke/shadow — every "make it fancier" attempt at a
  // drop shadow or outline came out looking worse (too dark, too harsh, or
  // just messy at this texture resolution). A clean, opaque, high-contrast
  // fill in one consistent font reads better than any of them did.
  function inkedText(text, x, y, font, fillStyle) {
    ctx.font = font;
    ctx.fillStyle = fillStyle;
    ctx.fillText(text, x, y);
  }

  // One font for everything on the felt (mixing an italic script with a
  // blocky engraved caps font read as cluttered) — Cinzel, a clean classic
  // Roman-inscription-style serif, at full opacity for real contrast.
  const FELT_FONT = (px, weight = 600) => `${weight} ${px}px 'Cinzel', Georgia, serif`;

  ctx.textAlign = 'center';
  inkedText('BLACKJACK PAYS 3 TO 2', FELT_W / 2, FELT_H * 0.335, FELT_FONT(FELT_W * 0.044, 700), '#fff6d4');
  inkedText(
    'DEALER MUST HIT ON 16 · STAND ON ALL 17s', FELT_W / 2, FELT_H * 0.4,
    FELT_FONT(FELT_W * 0.022, 700), '#ffeec0'
  );

  // The NVGR Casino house crest, inked into the felt the way a real house
  // mark is — the same crown/wordmark/rule/CASINO lockup drawn in the UI
  // (see casinoMark in src/app/uiHelpers.js), kept to the same geometry so
  // the table and the site read as one brand. Drawn in the crest's own SVG
  // coordinates and scaled into place, so the two stay easy to keep in sync.
  function drawCasinoCrest(cx, cy, targetW, alpha) {
    const CREST_W = 328; // rule-to-rule width in the crest's own units
    // The felt is read at a shallow angle, which squashes everything
    // vertically — a stacked lockup like this collapses into itself (the
    // crown lands in the middle of the wordmark). Pre-stretching the
    // vertical axis cancels that out, so it reads square on the table.
    const FORESHORTEN = 1.65;
    const s = targetW / CREST_W;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(s, s * FORESHORTEN);
    ctx.translate(-280, -111); // crest centre → origin
    ctx.fillStyle = `rgba(255,236,176,${alpha})`;

    ctx.save();
    ctx.translate(280, 2);
    ctx.scale(1.16, 1.16);
    ctx.beginPath();
    ctx.moveTo(-47, 50); ctx.lineTo(-47, 15); ctx.lineTo(-23, 37); ctx.lineTo(0, 5);
    ctx.lineTo(23, 37); ctx.lineTo(47, 15); ctx.lineTo(47, 50); ctx.closePath();
    ctx.fill();
    ctx.beginPath(); ctx.roundRect(-52, 53, 104, 13, 4); ctx.fill();
    [[-47, 11, 5.5], [0, 1, 6.5], [47, 11, 5.5]].forEach(([jx, jy, jr]) => {
      ctx.beginPath(); ctx.arc(jx, jy, jr, 0, Math.PI * 2); ctx.fill();
    });
    [-24, 24].forEach((dx) => {
      ctx.beginPath();
      ctx.moveTo(dx, 57); ctx.lineTo(dx + 5, 62); ctx.lineTo(dx, 67); ctx.lineTo(dx - 5, 62);
      ctx.closePath(); ctx.fill();
    });
    ctx.restore();

    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.letterSpacing = '6px';
    ctx.font = FELT_FONT(88, 700);
    ctx.fillText('NVGR', 283, 152);

    ctx.fillRect(116, 174, 134, 2.2);
    ctx.fillRect(310, 174, 134, 2.2);
    ctx.beginPath();
    ctx.moveTo(280, 167); ctx.lineTo(288, 175); ctx.lineTo(280, 183); ctx.lineTo(272, 175);
    ctx.closePath(); ctx.fill();

    ctx.letterSpacing = '18px';
    ctx.font = FELT_FONT(29, 600);
    ctx.fillText('CASINO', 289, 213);
    ctx.letterSpacing = '0px';
    ctx.restore();
  }

  const crestSpots = [
    { x: 0.5, y: 0.55, rot: 0, scale: 1.15, alpha: 0.92 },
    { x: 0.23, y: 0.63, rot: -0.3, scale: 0.62, alpha: 0.72 },
    { x: 0.77, y: 0.63, rot: 0.3, scale: 0.62, alpha: 0.72 },
    { x: 0.17, y: 0.83, rot: -0.15, scale: 0.5, alpha: 0.66 },
    { x: 0.83, y: 0.83, rot: 0.15, scale: 0.5, alpha: 0.66 },
  ];
  crestSpots.forEach(({ x, y, rot, scale, alpha }) => {
    ctx.save();
    ctx.translate(FELT_W * x, FELT_H * y);
    ctx.rotate(rot);
    drawCasinoCrest(0, 0, FELT_W * 0.2 * scale, alpha);
    ctx.restore();
  });

  const suits = ['♠', '♥', '♦', '♣'];
  ctx.font = `${FELT_W * 0.045}px Georgia, serif`;
  ctx.fillStyle = 'rgba(234,195,94,0.1)';
  suits.forEach((s, i) => {
    const angle = (i / suits.length) * Math.PI * 2;
    const r = FELT_W * 0.34;
    ctx.fillText(s, FELT_W / 2 + Math.cos(angle) * r, FELT_H * 0.58 + Math.sin(angle) * r * 0.55);
  });

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  // The felt is viewed at a steep, near-grazing angle from this camera —
  // without anisotropic filtering, mipmapping blurs fine text into an
  // indistinct bright smear (this, not lighting, was the real cause of the
  // "stripe with no visible text").
  texture.anisotropy = 16;
  return texture;
}

// Simple procedural wood-grain stripes for the table's outer skirt.
function createWoodTexture() {
  const w = 512, h = 128;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#2b140c';
  ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < 40; i++) {
    ctx.strokeStyle = `rgba(90,50,26,${0.15 + Math.random() * 0.2})`;
    ctx.lineWidth = 1 + Math.random() * 2;
    ctx.beginPath();
    const y = Math.random() * h;
    ctx.moveTo(0, y);
    ctx.bezierCurveTo(w * 0.3, y + (Math.random() - 0.5) * 14, w * 0.7, y + (Math.random() - 0.5) * 14, w, y);
    ctx.stroke();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(6, 2);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function createTable() {
  const group = new THREE.Group();

  // A slightly larger gold D-shape sits under a slightly smaller felt
  // D-shape, so its exposed edge reads as the table's rim/border — simpler
  // and more robust than mitering a torus around a non-circular outline.
  const goldGeo = new THREE.ShapeGeometry(buildTableShape(TABLE_RADIUS + 0.16, SIDE_LENGTH + 0.16), 1);
  normalizeShapeUVs(goldGeo);
  const goldMat = new THREE.MeshStandardMaterial({ color: 0xd4af52, roughness: 0.28, metalness: 0.7, side: THREE.DoubleSide });
  const goldBorder = new THREE.Mesh(goldGeo, goldMat);
  goldBorder.rotation.x = Math.PI / 2;
  goldBorder.receiveShadow = true;
  group.add(goldBorder);

  const feltGeo = new THREE.ShapeGeometry(buildTableShape(TABLE_RADIUS, SIDE_LENGTH), 1);
  normalizeShapeUVs(feltGeo);
  // Lambert, not Standard: felt is matte fabric with zero specular, and
  // MeshStandardMaterial keeps a thin specular lobe even at roughness=1,
  // which showed up as a visible highlight streak from the key light on
  // this large flat surface.
  const feltMat = new THREE.MeshLambertMaterial({ map: createFeltTexture('red'), side: THREE.DoubleSide });
  // Repainting the cloth means regenerating the whole texture (the rules
  // text and crest are baked into it), so it is done only when a table
  // actually asks for a different colour — never per frame.
  let feltThemeKey = 'red';
  group.userData.setFeltTheme = (key) => {
    const next = FELT_THEMES[key] ? key : 'red';
    if (next === feltThemeKey) return;
    feltThemeKey = next;
    feltMat.map.dispose();
    feltMat.map = createFeltTexture(next);
    feltMat.needsUpdate = true;
  };
  const felt = new THREE.Mesh(feltGeo, feltMat);
  felt.rotation.x = Math.PI / 2;
  felt.position.y = 0.01;
  felt.receiveShadow = true;
  group.add(felt);

  // Wood skirt below, extruded from the same D outline (a plain circular
  // cylinder no longer matches now that the felt has straight sides and a
  // flat back — its corners would overhang past a round base).
  const baseShape = buildTableShape(TABLE_RADIUS + 0.45, SIDE_LENGTH + 0.45);
  const baseGeo = new THREE.ExtrudeGeometry(baseShape, { depth: 0.9, bevelEnabled: false, curveSegments: 24 });
  const baseMat = new THREE.MeshStandardMaterial({ map: createWoodTexture(), roughness: 0.7 });
  const base = new THREE.Mesh(baseGeo, baseMat);
  base.rotation.x = Math.PI / 2;
  base.position.y = -0.01;
  base.receiveShadow = true;
  base.castShadow = true;
  group.add(base);

  return group;
}
