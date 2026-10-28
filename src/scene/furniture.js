import * as THREE from 'three';
import { loadGltf } from './gltf.js';
import { UNITS_PER_METRE, FLOOR_Y, m } from './scale.js';

// Furniture from Poly Haven (CC0 — public domain): photographed, real-sized
// pieces, modelled in metres and imported by scripts/import-polyhaven.mjs.
// Each loads in the background and appears when ready, so the table never
// waits on a sofa.

const url = (id) => `${import.meta.env.BASE_URL}models/furniture/${id}.glb`;

// One load per piece however many times it is placed.
const cache = new Map();
function piece(id) {
  if (!cache.has(id)) cache.set(id, loadGltf(url(id)).then((g) => g.scene));
  return cache.get(id);
}

/**
 * Places a copy of `id` under `parent`, standing on the floor (or at the
 * given height), turned `yaw` radians. `size` scales a piece past its real
 * size where a room needs it. Shadows are cast only by what is near the
 * table's light; the rest of the room is in its own dim light anyway.
 */
export function place(parent, id, { x = 0, y = FLOOR_Y, z = 0, yaw = 0, size = 1, shadows = false } = {}) {
  const holder = new THREE.Group();
  holder.position.set(x, y, z);
  holder.rotation.y = yaw;
  holder.scale.setScalar(UNITS_PER_METRE * size);
  parent.add(holder);
  piece(id).then((scene) => {
    const copy = scene.clone(true);
    copy.traverse((o) => {
      if (!o.isMesh) return;
      o.castShadow = shadows;
      o.receiveShadow = true;
    });
    holder.add(copy);
  }).catch(() => { /* a missing piece leaves the spot empty */ });
  return holder;
}

/**
 * Furnishes the salon around the table, against its walls. `half` is the
 * distance from the room's centre to each wall.
 *
 * The back wall is the one every player looks at past the dealer, so it is
 * the dressed one: a pair of carved consoles with brass vases, a painting
 * over each, and palms in the corners. The side walls, caught at the edge
 * of the view, carry a leather sofa each with a tall side table and an
 * ottoman.
 */
export function furnishRoom(room, half) {
  const back = -half + m(0.25);
  [-1, 1].forEach((side) => {
    const x = side * m(1.6);
    place(room, 'ClassicConsole_01', { x, z: back });
    place(room, 'brass_vase_01', { x: x - side * m(0.3), y: FLOOR_Y + m(0.8), z: back, size: 1.2 });
    place(room, 'fancy_picture_frame_01', { x, y: FLOOR_Y + m(1.45), z: -half + m(0.03), size: 1.6 });
    place(room, 'potted_plant_02', { x: side * (half - m(0.55)), z: -half + m(0.55), size: 1.6 });

    const wall = side * (half - m(0.55));
    const yaw = -side * Math.PI / 2;
    place(room, 'sofa_03', { x: wall, z: -m(0.4), yaw });
    place(room, 'side_table_tall_01', { x: side * (half - m(0.35)), z: m(0.85) });
    place(room, 'Ottoman_01', { x: wall - side * m(1.0), z: -m(0.4), yaw });
  });
}
