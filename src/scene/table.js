import * as THREE from 'three';
import { FLOOR_Y, m } from './scale.js';

// A real casino "D" table: a semicircular front for the players plus a pair
// of straight parallel sides running back to a flat rear edge for the
// dealer. TABLE_RADIUS is the semicircle's radius (and so the felt's full
// width, held constant all the way back); SIDE_LENGTH is how far the
// straight sides run before the flat back edge closes the shape off.
// Sized as a five-spot table, which is what this one is: about 2.1 m
// across overall. It was built to a seven-seat 2.4 m spec, so five players
// sat far apart around a wide, empty felt.
export const TABLE_RADIUS = m(0.885);
const SIDE_LENGTH = 1.0;
export const TABLE_BACK_Z = -SIDE_LENGTH;

// How far the wooden apron and padded rail reach past the felt.
const SKIRT = 0.45;

// Builds the D-shaped outline: up the left straight side, across the front
// semicircle, down the right straight side, then THREE.Shape auto-closes
// with one final straight line back to the start — the flat back edge.
// Angle 0 = +Z = the player-facing front, matching seats.js.
function buildTableShape(radius, sideLength) {
  const shape = new THREE.Shape();
  const segments = 64;
  shape.moveTo(-radius, -sideLength);
  shape.lineTo(-radius, 0);
  for (let i = 0; i <= segments; i++) {
    const rad = THREE.MathUtils.degToRad(-90 + 180 * (i / segments));
    shape.lineTo(Math.sin(rad) * radius, Math.cos(rad) * radius);
  }
  shape.lineTo(radius, -sideLength);
  return shape;
}

// The padded rail: a band following the front and both sides between two
// radii, open along the dealer's back edge — a real table has no armrest
// where the dealer stands.
function buildRailShape(inner, outer, sideLength) {
  const shape = new THREE.Shape();
  const segments = 64;
  shape.moveTo(-outer, -sideLength);
  shape.lineTo(-outer, 0);
  for (let i = 0; i <= segments; i++) {
    const rad = THREE.MathUtils.degToRad(-90 + 180 * (i / segments));
    shape.lineTo(Math.sin(rad) * outer, Math.cos(rad) * outer);
  }
  shape.lineTo(outer, -sideLength);
  shape.lineTo(inner, -sideLength);
  shape.lineTo(inner, 0);
  for (let i = segments; i >= 0; i--) {
    const rad = THREE.MathUtils.degToRad(-90 + 180 * (i / segments));
    shape.lineTo(Math.sin(rad) * inner, Math.cos(rad) * inner);
  }
  shape.lineTo(-inner, -sideLength);
  return shape;
}

// THREE.ShapeGeometry uses raw shape coordinates as UVs; this remaps them
// to the shape's bounding box so the felt texture spans the whole surface.
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

// Each table picks a cloth. Real baize is a deep, slightly dusty colour,
// never a bright one — the old reds and blues were closer to a poster than
// a fabric, and under the light pool they glowed. These sit lower and
// greyer, and the one cream ink used for the markings reads on all of them.
export const FELT_THEMES = {
  red: { hi: '#7c2633', lo: '#3d1219' },
  green: { hi: '#24624a', lo: '#0f3022' },
  blue: { hi: '#24496e', lo: '#10233a' },
  purple: { hi: '#4d3a66', lo: '#231a33' },
  black: { hi: '#2e2d2f', lo: '#131314' },
};
export const FELT_THEME_KEYS = Object.keys(FELT_THEMES);
export function feltTheme(key) { return FELT_THEMES[key] || FELT_THEMES.red; }

// The felt canvas is sized in proportion to the felt itself, so a circle
// drawn on it is a circle on the table. It used to be 1000x1900 for a
// 5.2x3.6 surface — every arc came out an ellipse and every letter
// stretched. Markings are now placed in world units through toPx.
const FELT_SPAN_X = TABLE_RADIUS * 2;
const FELT_SPAN_Z = TABLE_RADIUS + SIDE_LENGTH;
const FELT_W = 2048;
const FELT_H = Math.round((FELT_W * FELT_SPAN_Z) / FELT_SPAN_X);
const PX = FELT_W / FELT_SPAN_X;
// World (x, z) on the felt to canvas pixels. The canvas's top edge is the
// dealer's back edge.
const toPx = (x, z) => [(x + TABLE_RADIUS) * PX, (z + SIDE_LENGTH) * PX];

// A player reads the felt at a shallow angle, which squashes lettering
// along the table; drawing it taller by this much cancels that out.
const FORESHORTEN = 1.5;

function createFeltTexture(themeKey) {
  const theme = feltTheme(themeKey);
  const canvas = document.createElement('canvas');
  canvas.width = FELT_W;
  canvas.height = FELT_H;
  const ctx = canvas.getContext('2d');

  // The cloth: lit a little brighter in the middle, the way it is under
  // the light above it, falling off toward the rail.
  const [gx, gy] = toPx(0, 0.4);
  const gradient = ctx.createRadialGradient(gx, gy, PX * 0.3, gx, gy, PX * 3.2);
  gradient.addColorStop(0, theme.hi);
  gradient.addColorStop(1, theme.lo);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, FELT_W, FELT_H);

  // Grain, so the smooth gradient doesn't band under tone mapping and the
  // cloth reads as woven.
  const grain = ctx.getImageData(0, 0, FELT_W, FELT_H);
  const px = grain.data;
  for (let i = 0; i < px.length; i += 4) {
    const n = (Math.random() - 0.5) * 9;
    px[i] += n; px[i + 1] += n; px[i + 2] += n;
  }
  ctx.putImageData(grain, 0, 0);

  // The markings a real table carries, and nothing else: the payout line,
  // the dealer's rule, and the insurance band. One cream ink, one typeface.
  // The old felt also carried five crests and a ring of suit pips; on a
  // table this size that read as wallpaper and fought the cards for
  // attention.
  const INK = 'rgba(232,220,192,0.80)';
  const INK_SOFT = 'rgba(232,220,192,0.45)';
  const font = (worldSize, weight = 600) => `${weight} ${worldSize * PX}px 'Cinzel', Georgia, serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const label = (text, z, size, fill, weight) => {
    const [x, y] = toPx(0, z);
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(1, FORESHORTEN);
    ctx.fillStyle = fill;
    ctx.font = font(size, weight);
    ctx.fillText(text, 0, 0);
    ctx.restore();
  };
  // Positions are proportions of the table's radius, so the layout holds
  // whatever size the table is.
  const R = TABLE_RADIUS;
  label('BLACKJACK PAYS 3 TO 2', R * 0.215, 0.105, INK, 700);
  label('DEALER MUST DRAW TO 16 AND STAND ON ALL 17s', R * 0.29, 0.048, INK_SOFT, 600);

  // Insurance band: two printed arcs concentric with the table's own front
  // edge, with the line set between them, letter by letter.
  const [ox, oy] = toPx(0, 0);
  const INNER = R * 0.385;
  const OUTER = R * 0.46;
  const ARC_FROM = THREE.MathUtils.degToRad(28);
  const ARC_TO = THREE.MathUtils.degToRad(152);
  ctx.strokeStyle = INK_SOFT;
  ctx.lineWidth = 0.012 * PX;
  [INNER, OUTER].forEach((r) => {
    ctx.beginPath();
    ctx.arc(ox, oy, r * PX, ARC_FROM, ARC_TO);
    ctx.stroke();
  });
  const band = 'INSURANCE PAYS 2 TO 1';
  const bandR = ((INNER + OUTER) / 2) * PX;
  const spread = THREE.MathUtils.degToRad(46);
  ctx.fillStyle = INK_SOFT;
  ctx.font = font(0.066, 700);
  [...band].forEach((ch, i) => {
    // Left to right as the player reads it: canvas angles grow clockwise,
    // and +90deg points at the players.
    const a = Math.PI / 2 + spread / 2 - (spread * i) / (band.length - 1);
    ctx.save();
    ctx.translate(ox + Math.cos(a) * bandR, oy + Math.sin(a) * bandR);
    ctx.rotate(a - Math.PI / 2);
    ctx.fillText(ch, 0, 0);
    ctx.restore();
  });

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  // Read at a near-grazing angle: without anisotropic filtering, mipmapping
  // blurs the lettering into a smear.
  texture.anisotropy = 16;
  return texture;
}

// Dark walnut for the apron: long soft grain on a deep brown.
function createWoodTexture() {
  const w = 1024, h = 128;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#2a1a11';
  ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < 60; i++) {
    ctx.strokeStyle = `rgba(${70 + Math.random() * 20},${44 + Math.random() * 12},${26},${0.12 + Math.random() * 0.18})`;
    ctx.lineWidth = 1 + Math.random() * 2.5;
    ctx.beginPath();
    const y = Math.random() * h;
    ctx.moveTo(0, y);
    ctx.bezierCurveTo(w * 0.3, y + (Math.random() - 0.5) * 10, w * 0.7, y + (Math.random() - 0.5) * 10, w, y);
    ctx.stroke();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(4, 1);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

// Shared finishes, matte throughout. Brass is brushed rather than polished:
// rough enough that it takes the light softly instead of flashing.
export const BRASS = new THREE.MeshStandardMaterial({ color: 0x9c7d4a, roughness: 0.42, metalness: 0.75 });
// Dark brown rather than black: pure black reads as a hole in the picture,
// and brown lets the cushion's curve show where the light rolls off it.
export const LEATHER = new THREE.MeshStandardMaterial({ color: 0x241a14, roughness: 0.55, metalness: 0 });

export function createTable() {
  const group = new THREE.Group();

  const feltGeo = new THREE.ShapeGeometry(buildTableShape(TABLE_RADIUS, SIDE_LENGTH), 1);
  normalizeShapeUVs(feltGeo);
  // Lambert: felt is matte fabric with no specular at all. Double-sided
  // because the +90deg turn that maps the shape's y onto world z (keeping
  // the front of the D toward the players) leaves its face pointing down.
  const feltMat = new THREE.MeshLambertMaterial({ map: createFeltTexture('red'), side: THREE.DoubleSide });
  // Repainting the cloth regenerates the whole texture, so it happens only
  // when a table asks for a different colour — never per frame.
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

  // The padded leather armrest every real table has, in place of the flat
  // gold border. Extruded with a deep bevel so its cross-section is a
  // rounded cushion rather than a slab.
  const RAIL_BEVEL = m(0.022);
  const railShape = buildRailShape(
    TABLE_RADIUS - 0.02 + RAIL_BEVEL,
    TABLE_RADIUS + SKIRT - RAIL_BEVEL,
    SIDE_LENGTH
  );
  const rail = new THREE.Mesh(
    new THREE.ExtrudeGeometry(railShape, {
      depth: m(0.008),
      bevelEnabled: true,
      bevelThickness: RAIL_BEVEL,
      bevelSize: RAIL_BEVEL,
      bevelSegments: 5,
      curveSegments: 32,
    }),
    LEATHER
  );
  rail.rotation.x = Math.PI / 2;
  // Extrusion runs down from y; the bevel adds RAIL_BEVEL above and below.
  rail.position.y = m(0.008) + RAIL_BEVEL + 0.01;
  rail.castShadow = true;
  rail.receiveShadow = true;
  group.add(rail);

  // A fine brass bead where the felt meets the rail.
  const bead = new THREE.Mesh(
    new THREE.ShapeGeometry(buildRailShape(TABLE_RADIUS - 0.035, TABLE_RADIUS - 0.005, SIDE_LENGTH), 1),
    new THREE.MeshStandardMaterial({ color: 0x9c7d4a, roughness: 0.42, metalness: 0.75, side: THREE.DoubleSide })
  );
  bead.rotation.x = Math.PI / 2;
  bead.position.y = 0.013;
  group.add(bead);

  // Wooden apron below the rail, and the dealer's ledge along the back.
  const woodMat = new THREE.MeshStandardMaterial({ map: createWoodTexture(), roughness: 0.6, metalness: 0 });
  const APRON = m(0.15);
  const apron = new THREE.Mesh(
    new THREE.ExtrudeGeometry(buildTableShape(TABLE_RADIUS + SKIRT, SIDE_LENGTH + SKIRT), {
      depth: APRON, bevelEnabled: false, curveSegments: 32,
    }),
    woodMat
  );
  apron.rotation.x = Math.PI / 2;
  apron.position.y = 0.005;
  apron.receiveShadow = true;
  apron.castShadow = true;
  group.add(apron);

  // Pedestal: the same outline set well in, so seated knees clear it.
  const INSET = m(0.6);
  const pedestalTop = 0.005 - APRON;
  const pedestal = new THREE.Mesh(
    new THREE.ExtrudeGeometry(
      buildTableShape(TABLE_RADIUS + SKIRT - INSET, SIDE_LENGTH + SKIRT - INSET * 0.4),
      { depth: pedestalTop - FLOOR_Y, bevelEnabled: false, curveSegments: 32 }
    ),
    new THREE.MeshStandardMaterial({ color: 0x120d0a, roughness: 0.7, metalness: 0 })
  );
  pedestal.rotation.x = Math.PI / 2;
  pedestal.position.y = pedestalTop;
  pedestal.castShadow = true;
  pedestal.receiveShadow = true;
  group.add(pedestal);

  // A low brass kickplate where the pedestal meets the carpet.
  const kick = new THREE.Mesh(
    new THREE.ExtrudeGeometry(
      buildTableShape(TABLE_RADIUS + SKIRT - INSET + m(0.015), SIDE_LENGTH + SKIRT - INSET * 0.4 + m(0.015)),
      { depth: m(0.05), bevelEnabled: false, curveSegments: 32 }
    ),
    BRASS
  );
  kick.rotation.x = Math.PI / 2;
  kick.position.y = FLOOR_Y + m(0.05);
  group.add(kick);

  return group;
}
