import * as THREE from 'three';
import { m } from './scale.js';

// The bar's drinks, made here rather than loaded: each a glass turned on a
// lathe from its profile, with the drink inside it and its garnish. A
// little under life size (DRINK_SCALE), so the glass stands in its cup
// holder and beside the chips rather than towering over them.
//
// Also the brass cup holder let into each seat's rim, and the waiter's
// tray.

export const DRINK_SCALE = 0.8;

// The menu (src/app/service.js prices it). Each: what it is, its glass, the
// colour of the drink, and its garnish.
export const DRINKS = {
  water: { name: 'Sparkling water', glass: 'highball', color: 0xd9eef5, fill: 0.8, alpha: 0.25, extra: 'lemon' },
  cola: { name: 'Cola', glass: 'highball', color: 0x2b1208, fill: 0.82, alpha: 0.9, extra: 'ice' },
  beer: { name: 'Beer', glass: 'pint', color: 0xd08a1e, fill: 0.86, alpha: 0.82, extra: 'foam' },
  wine: { name: 'Red wine', glass: 'wine', color: 0x5a0d1b, fill: 0.42, alpha: 0.92 },
  mojito: { name: 'Mojito', glass: 'highball', color: 0xcfe6a4, fill: 0.85, alpha: 0.55, extra: 'mint' },
  whiskey: { name: 'Whisky', glass: 'tumbler', color: 0xb5651d, fill: 0.45, alpha: 0.85, extra: 'ice' },
  martini: { name: 'Martini', glass: 'martini', color: 0xe9e4c8, fill: 0.7, alpha: 0.45, extra: 'olive' },
  champagne: { name: 'Champagne', glass: 'flute', color: 0xf2d98a, fill: 0.78, alpha: 0.6, extra: 'bubbles' },
};

// Profiles, [radius, height] from the foot up, in metres.
const PROFILES = {
  tumbler: [[0, 0], [0.04, 0], [0.042, 0.012], [0.044, 0.085], [0.045, 0.09]],
  highball: [[0, 0], [0.031, 0], [0.033, 0.01], [0.035, 0.14], [0.036, 0.145]],
  pint: [[0, 0], [0.03, 0], [0.032, 0.01], [0.04, 0.14], [0.042, 0.15]],
  wine: [[0, 0], [0.035, 0], [0.034, 0.004], [0.004, 0.01], [0.004, 0.09], [0.03, 0.11], [0.042, 0.14], [0.037, 0.19], [0.036, 0.195]],
  martini: [[0, 0], [0.034, 0], [0.032, 0.004], [0.004, 0.01], [0.004, 0.1], [0.06, 0.16], [0.062, 0.162]],
  flute: [[0, 0], [0.03, 0], [0.028, 0.004], [0.003, 0.01], [0.003, 0.09], [0.018, 0.12], [0.024, 0.19], [0.023, 0.21]],
};
// Where the bowl starts for stemmed glasses — the drink sits above it.
const BOWL_FROM = { wine: 0.095, martini: 0.1, flute: 0.095 };

// Glass: clear, with a clear-coat that catches the room's light, and a
// brighter rim so the shape reads even where the glass itself barely shows.
const glassMaterial = new THREE.MeshPhysicalMaterial({
  color: 0xeef6ff, roughness: 0.04, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.04,
  transparent: true, opacity: 0.3, depthWrite: false, side: THREE.DoubleSide,
});
const rimMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.1, transparent: true, opacity: 0.55 });
const latheCache = new Map();
function lathe(name) {
  if (!latheCache.has(name)) {
    const pts = PROFILES[name].map(([r, h]) => new THREE.Vector2(m(r), m(h)));
    latheCache.set(name, new THREE.LatheGeometry(pts, 28));
  }
  return latheCache.get(name);
}

// The drink inside: a solid of the glass's own inner profile, from the
// bottom (or the bowl) up to the fill line.
function liquid(spec) {
  const prof = PROFILES[spec.glass];
  const top = prof[prof.length - 1][1];
  const from = BOWL_FROM[spec.glass] || 0.012;
  const to = from + (top - from) * spec.fill;
  const radiusAt = (h) => {
    for (let i = 1; i < prof.length; i++) {
      const [r0, h0] = prof[i - 1], [r1, h1] = prof[i];
      if (h <= h1) return r0 + (r1 - r0) * ((h - h0) / Math.max(1e-6, h1 - h0));
    }
    return prof[prof.length - 1][0];
  };
  const pts = [];
  pts.push(new THREE.Vector2(0, m(from)));
  for (let k = 0; k <= 8; k++) {
    const h = from + ((to - from) * k) / 8;
    pts.push(new THREE.Vector2(m(radiusAt(h) * 0.93), m(h)));
  }
  pts.push(new THREE.Vector2(0, m(to)));
  const mat = new THREE.MeshStandardMaterial({ color: spec.color, roughness: 0.15, transparent: spec.alpha < 1, opacity: spec.alpha, depthWrite: spec.alpha > 0.8 });
  const mesh = new THREE.Mesh(new THREE.LatheGeometry(pts, 24), mat);
  mesh.userData.top = m(to);
  mesh.userData.topR = m(radiusAt(to) * 0.93);
  return mesh;
}

/** A drink of `type` (a key of DRINKS), standing on its own base at y = 0. */
export function createDrink(type) {
  const spec = DRINKS[type] || DRINKS.water;
  const g = new THREE.Group();
  const glass = new THREE.Mesh(lathe(spec.glass), glassMaterial);
  glass.renderOrder = 2;
  g.add(glass);
  const lip = PROFILES[spec.glass][PROFILES[spec.glass].length - 1];
  const rim = new THREE.Mesh(new THREE.TorusGeometry(m(lip[0]), m(0.0016), 6, 28), rimMaterial);
  rim.rotation.x = Math.PI / 2;
  rim.position.y = m(lip[1]);
  g.add(rim);
  const drink = liquid(spec);
  g.add(drink);
  const top = drink.userData.top;
  const r = drink.userData.topR;
  if (spec.extra === 'ice') {
    const ice = new THREE.MeshStandardMaterial({ color: 0xeaf6fb, roughness: 0.1, transparent: true, opacity: 0.7 });
    [[-0.3, 0.1], [0.35, -0.2]].forEach(([dx, dz], i) => {
      const cube = new THREE.Mesh(new THREE.BoxGeometry(r * 0.7, r * 0.7, r * 0.7), ice);
      cube.position.set(dx * r, top - r * 0.15, dz * r);
      cube.rotation.set(0.3 * i, 0.5 + i, 0.2);
      g.add(cube);
    });
  } else if (spec.extra === 'foam') {
    const foam = new THREE.Mesh(new THREE.CylinderGeometry(r * 1.04, r, m(0.018), 24), new THREE.MeshStandardMaterial({ color: 0xfff6e0, roughness: 0.9 }));
    foam.position.y = top + m(0.008);
    g.add(foam);
  } else if (spec.extra === 'olive') {
    const pick = new THREE.Mesh(new THREE.CylinderGeometry(m(0.0015), m(0.0015), m(0.09), 6), new THREE.MeshStandardMaterial({ color: 0xc9a86a, metalness: 0.6, roughness: 0.3 }));
    pick.position.set(r * 0.3, top + m(0.01), 0);
    pick.rotation.z = 0.5;
    g.add(pick);
    const olive = new THREE.Mesh(new THREE.SphereGeometry(m(0.009), 12, 8), new THREE.MeshStandardMaterial({ color: 0x5e7a2a, roughness: 0.5 }));
    olive.scale.set(1, 1.3, 1);
    olive.position.set(r * 0.15, top - m(0.012), 0);
    g.add(olive);
  } else if (spec.extra === 'lemon' || spec.extra === 'mint') {
    const mat = new THREE.MeshStandardMaterial({ color: spec.extra === 'lemon' ? 0xf2d64b : 0x2e8b3a, roughness: 0.6 });
    const slice = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.8, r * 0.8, m(0.004), 16, 1, false, 0, Math.PI), mat);
    slice.position.set(r * 0.6, top + m(0.004), 0);
    slice.rotation.z = Math.PI / 2.4;
    g.add(slice);
  } else if (spec.extra === 'bubbles') {
    const b = new THREE.MeshBasicMaterial({ color: 0xfff6d6, transparent: true, opacity: 0.8 });
    for (let i = 0; i < 6; i++) {
      const s = new THREE.Mesh(new THREE.SphereGeometry(m(0.0018), 6, 4), b);
      s.position.set((Math.random() - 0.5) * r, top * (0.55 + Math.random() * 0.4), (Math.random() - 0.5) * r);
      g.add(s);
    }
  }
  g.scale.setScalar(DRINK_SCALE);
  g.userData.type = type;
  return g;
}

/** Frees a drink made by createDrink (the glass's shape is shared). */
export function disposeDrink(g) {
  g.traverse((o) => {
    if (!o.isMesh || o.geometry === latheCache.get(DRINKS[g.userData.type]?.glass)) return;
    o.geometry.dispose();
    if (o.material !== glassMaterial && o.material !== rimMaterial) o.material.dispose();
  });
}

const BRASS = new THREE.MeshStandardMaterial({ color: 0xb8955a, roughness: 0.3, metalness: 0.85 });
const WELL = new THREE.MeshStandardMaterial({ color: 0x0c0a09, roughness: 0.9 });

/**
 * A cup holder let into the rim: a brass ring of radius `R` round a dark
 * well. Its top is at y = 0; a drink stands in it at `seatY`.
 */
export function createCupHolder(R = m(0.04)) {
  const g = new THREE.Group();
  const ring = new THREE.Mesh(new THREE.TorusGeometry(R, m(0.006), 10, 32), BRASS);
  ring.rotation.x = Math.PI / 2;
  ring.position.y = m(0.003);
  g.add(ring);
  const well = new THREE.Mesh(new THREE.CylinderGeometry(R * 0.96, R * 0.96, m(0.012), 32), WELL);
  well.position.y = -m(0.004);
  g.add(well);
  g.userData.seatY = -m(0.008);
  return g;
}

/** The waiter's tray: a silver disc with a raised rim. */
export function createTray() {
  const g = new THREE.Group();
  const silver = new THREE.MeshStandardMaterial({ color: 0xd8d8dc, roughness: 0.22, metalness: 0.9 });
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(m(0.19), m(0.18), m(0.008), 36), silver);
  g.add(disc);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(m(0.19), m(0.005), 8, 36), silver);
  rim.rotation.x = Math.PI / 2;
  rim.position.y = m(0.006);
  g.add(rim);
  return g;
}
