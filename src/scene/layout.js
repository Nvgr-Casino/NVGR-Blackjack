import * as THREE from 'three';
import { place } from './furniture.js';
import { createRug } from './luxury.js';
import { FLOOR_Y, m } from './scale.js';

// How the rooms are furnished: in arrangements, not one piece at a time.
//
// Every seat in the furniture library faces its own +z. A piece that
// should face something is turned toward it by one rule (facing), so a
// group reads as a group — a sofa and two armchairs all drawn up to the
// same coffee table — instead of each chair at an angle of its own.

/** The yaw that turns a piece standing at (x, z) to face (tx, tz). */
export const facing = (x, z, tx, tz) => Math.atan2(tx - x, tz - z);

/**
 * A conversation group against a side wall: a sofa with its back to the
 * wall, a coffee table in front of it, and an armchair at each end of the
 * table turned in to it, on a rug. `side` is -1 (left wall) or 1 (right);
 * `z` is where along the wall it sits.
 */
export function lounge(room, half, side, z, { sofa, chair, table = 'modern_coffee_table_01', rug, sofaSize = 1, chairSize = 1 }) {
  const sofaX = side * (half - m(0.55));
  const tableX = side * (half - m(1.55));
  const chairX = side * (half - m(1.75));
  place(room, sofa, { x: sofaX, z, yaw: facing(sofaX, z, 0, z), size: sofaSize });
  place(room, table, { x: tableX, z });
  [-1, 1].forEach((end) => {
    const cz = z + end * m(1.15);
    place(room, chair, { x: chairX, z: cz, yaw: facing(chairX, cz, tableX, z), size: chairSize });
  });
  if (rug) {
    // Already laid flat by createRug: sized, not turned, to run along the wall.
    const r = createRug(m(2.6), m(3.4), rug);
    r.position.set(side * (half - m(1.4)), FLOOR_Y + 0.006, z);
    room.add(r);
  }
}

// ---------- bookcases ----------

const BOOK_COLORS = [0x5a1d1d, 0x23331f, 0x1f2b44, 0x6b4a22, 0x3a2418, 0x2c1a2e, 0x704d2a, 0x1c1c1c, 0x7a6a4a];
const ray = new THREE.Raycaster();

/**
 * Fills a bookcase (a placed Shelf_01, with its back to a wall) with rows
 * of books standing on its boards. The boards are found on the model by
 * casting down through it, so every book stands on wood and inside the
 * case — never floating, or through its back.
 */
export function fillShelf(holder, { colors = BOOK_COLORS, gold = 0xc9a86a } = {}) {
  holder.userData.loaded.then((h) => {
    if (!h) return;
    h.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(h);
    const size = box.getSize(new THREE.Vector3());
    const centre = box.getCenter(new THREE.Vector3());
    // The case's own frame: it may be turned to any wall.
    const inv = new THREE.Matrix4().copy(h.matrixWorld).invert();
    const toLocal = (v) => v.clone().applyMatrix4(inv);

    // Board tops, from a line down the middle of the case.
    ray.set(new THREE.Vector3(centre.x, box.max.y + 0.1, centre.z), new THREE.Vector3(0, -1, 0));
    const hits = ray.intersectObject(h, true)
      .filter((x) => x.face && x.face.normal.clone().transformDirection(x.object.matrixWorld).y > 0.6)
      .map((x) => x.point.y);
    const tops = [...new Set(hits.map((y) => +y.toFixed(3)))].sort((a, b) => a - b);
    // Each board with room above it to the next.
    const rows = [];
    for (let i = 0; i < tops.length - 1; i++) {
      const gap = tops[i + 1] - tops[i];
      if (gap > m(0.16)) rows.push({ y: tops[i], gap });
    }
    if (!rows.length) return;

    // The inside of the case, side to side and front to back, in its frame.
    const lmin = toLocal(box.min), lmax = toLocal(box.max);
    const xs = [lmin.x, lmax.x].sort((a, b) => a - b);
    const zs = [lmin.z, lmax.z].sort((a, b) => a - b);
    const width = xs[1] - xs[0];
    const depth = zs[1] - zs[0];
    const inner = { x0: xs[0] + width * 0.07, x1: xs[1] - width * 0.07 };

    const unit = 1 / h.scale.x; // book sizes below are in scene units
    const books = [];
    rows.forEach(({ y, gap }) => {
      const ly = toLocal(new THREE.Vector3(centre.x, y, centre.z)).y;
      let x = inner.x0;
      while (x < inner.x1) {
        const w = (m(0.025) + Math.random() * m(0.025)) * unit;
        if (x + w > inner.x1) break;
        const hgt = Math.min(gap * unit * 0.86, (m(0.19) + Math.random() * m(0.09)) * unit);
        // Now and then a gap, or a book leaning on its neighbour.
        if (Math.random() < 0.05) { x += w * 2; continue; }
        books.push({ x: x + w / 2, y: ly + hgt / 2, w, h: hgt, d: depth * 0.72, lean: Math.random() < 0.04 ? 0.18 : 0 });
        x += w + 0.002 * unit;
      }
    });
    const geo = new THREE.BoxGeometry(1, 1, 1);
    const mat = new THREE.MeshStandardMaterial({ roughness: 0.75, metalness: 0 });
    const mesh = new THREE.InstancedMesh(geo, mat, books.length);
    const mtx = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const zMid = (zs[0] + zs[1]) / 2 + depth * 0.06;
    books.forEach((b, i) => {
      q.setFromAxisAngle(new THREE.Vector3(0, 0, 1), b.lean);
      mtx.compose(new THREE.Vector3(b.x, b.y, zMid), q, new THREE.Vector3(b.w, b.h, b.d));
      mesh.setMatrixAt(i, mtx);
      const c = new THREE.Color(colors[Math.floor(Math.random() * colors.length)]);
      if (Math.random() < 0.12) c.lerp(new THREE.Color(gold), 0.35);
      mesh.setColorAt(i, c.multiplyScalar(0.8 + Math.random() * 0.4));
    });
    mesh.receiveShadow = true;
    h.add(mesh);
    (h.userData.owned = h.userData.owned || []).push(mesh);
  });
  return holder;
}

/** A bookcase against the back wall at `x`, filled. */
export function bookcase(room, x, z, { size = 1.35, stain = 0x5b3b26, yaw = 0 } = {}) {
  return fillShelf(place(room, 'Shelf_01', { x, z, size, stain, yaw }));
}

// ---------- fittings ----------

const brass = (color = 0xc9a86a) => new THREE.MeshStandardMaterial({ color, roughness: 0.3, metalness: 0.85 });

/**
 * A wall sconce: a brass back plate and arm holding a glowing shade. It
 * gives the walls points of warm light without the cost of a real light.
 * `yaw` turns it to face out from its wall.
 */
export function sconce(room, x, y, z, yaw, { metal = 0xc9a86a, glow = 0xffd9a0 } = {}) {
  const g = new THREE.Group();
  const plate = new THREE.Mesh(new THREE.CylinderGeometry(m(0.05), m(0.05), m(0.012), 20), brass(metal));
  plate.rotation.x = Math.PI / 2;
  g.add(plate);
  const arm = new THREE.Mesh(new THREE.CylinderGeometry(m(0.008), m(0.008), m(0.14), 8), brass(metal));
  arm.rotation.x = Math.PI / 2;
  arm.position.z = m(0.07);
  g.add(arm);
  const shade = new THREE.Mesh(
    new THREE.CylinderGeometry(m(0.05), m(0.075), m(0.13), 20, 1, true),
    new THREE.MeshBasicMaterial({ color: glow, side: THREE.DoubleSide }),
  );
  shade.position.set(0, m(0.05), m(0.14));
  g.add(shade);
  // A soft halo on the wall above it.
  const halo = new THREE.Mesh(new THREE.PlaneGeometry(m(0.6), m(0.8)), new THREE.MeshBasicMaterial({ map: haloTexture(), transparent: true, depthWrite: false, opacity: 0.55, color: glow }));
  halo.position.set(0, m(0.12), m(0.004));
  g.add(halo);
  g.position.set(x, y, z);
  g.rotation.y = yaw;
  room.add(g);
  return g;
}

let halo = null;
function haloTexture() {
  if (halo) return halo;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d');
  const grd = ctx.createRadialGradient(64, 60, 2, 64, 64, 62);
  grd.addColorStop(0, 'rgba(255,255,255,0.9)');
  grd.addColorStop(0.4, 'rgba(255,255,255,0.25)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, 128, 128);
  halo = new THREE.CanvasTexture(c);
  halo.colorSpace = THREE.SRGBColorSpace;
  return halo;
}

/**
 * A pilaster on a wall: a fluted shaft between a plinth and a capital,
 * in `color` with `trim` (brass, say) on its ends.
 */
export function pilaster(room, x, z, yaw, height, { color = 0x15141a, trim = 0xc9a86a } = {}) {
  const g = new THREE.Group();
  const body = new THREE.MeshStandardMaterial({ color, roughness: 0.45, metalness: 0.1 });
  const shaft = new THREE.Mesh(new THREE.BoxGeometry(m(0.32), height - m(0.5), m(0.08)), body);
  shaft.position.y = height / 2;
  g.add(shaft);
  for (let i = -2; i <= 2; i++) {
    const flute = new THREE.Mesh(new THREE.BoxGeometry(m(0.012), height - m(0.7), m(0.01)), brass(trim));
    flute.position.set(i * m(0.055), height / 2, m(0.045));
    g.add(flute);
  }
  [m(0.12), height - m(0.12)].forEach((y) => {
    const band = new THREE.Mesh(new THREE.BoxGeometry(m(0.4), m(0.24), m(0.12)), brass(trim));
    band.position.y = y;
    g.add(band);
  });
  g.position.set(x, FLOOR_Y, z);
  g.rotation.y = yaw;
  room.add(g);
  return g;
}

/**
 * The waiters' walk round the table: a loop clear of the chairs and the
 * furniture, as corner points (the waiters round them off). Kept on the
 * room for waiters.js.
 */
export function walkway(room, { x = 6.2, back = -5.4, front = 6.4 } = {}) {
  room.userData.walkway = [
    new THREE.Vector3(-x, FLOOR_Y, back),
    new THREE.Vector3(x, FLOOR_Y, back),
    new THREE.Vector3(x, FLOOR_Y, front),
    new THREE.Vector3(-x, FLOOR_Y, front),
  ];
}
