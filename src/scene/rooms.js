import { place } from './furniture.js';
import { ROOM_NAMES } from '../app/roomLogic.js';
import { FLOOR_Y, m } from './scale.js';
import { createDrape, createRug, createTrayCeiling, createBrandSign } from './luxury.js';
import { lounge, walkway, facing, barCorner, brandSign, staffPosts } from './layout.js';
import { TERRACE, DECO, LIBRARY, MIRRORS } from './showrooms.js';
import * as THREE from 'three';

// Every table is in a room of its own, dressed for its stakes, and each is
// built round an idea of its own (showrooms.js): a terrace over the sea at
// sunset, an Art Deco ballroom, a two-storey library under a dome of
// stars, a hall of mirrors — and at the top, the Penthouse, the city at
// night below its glass. room.js paints the walls, floor and fittings from
// these; scene.js sets the light from them; each one furnishes itself.
//
// Every room has the same bones, so each reads as a casino: the lit house
// sign over the dealer, the bar in the back-left corner with its
// bartender, a lounge on each side, a rug under the table, and a clear
// loop round it for the waiters (layout.js's walkway) with the posts where
// they stand (staffPosts).
//
// Positions are in the room's frame: the back wall at z = -half, the side
// walls at x = ±half, the table at the middle. Distances along the walls
// are in metres (m), so a room keeps its proportions at any size.

const backOf = (half, out = 0.25) => -half + m(out);
const facingIn = (side) => -side * Math.PI / 2;

export const ROOM_THEMES = {
  // The Lounge — 100 / 2K: the terrace over the sea.
  1: { name: ROOM_NAMES[0], ...TERRACE },
  // The Parlour — 500 / 10K: the Art Deco ballroom.
  2: { name: ROOM_NAMES[1], ...DECO },
  // The Library — 1K / 25K: two storeys of books under the stars.
  3: { name: ROOM_NAMES[2], ...LIBRARY },
  // The Gold Room — 5K / 100K: the hall of mirrors.
  4: { name: ROOM_NAMES[3], ...MIRRORS },

  // The Penthouse — 25K / 500K. The top floor of a tower at night, and the
  // largest room by far, glass floor to ceiling on three sides — the
  // city's skyline outside and its lights spread out below (room.js's
  // createSkyline) — velvet drapes between the bays, a black marble floor
  // under a bordered rug, the house sign hung on fine cables in front of
  // the glass behind the dealer, a marble bar, lounges drawn up round their
  // tables, crystal chandeliers and a tray ceiling with a cove of light.
  5: {
    name: ROOM_NAMES[4],
    half: 21,
    ceilingY: 9.6,
    windows: true,
    wall: { style: 'lacquer', base: 0x17171b, trim: 0xc9a86a, skirting: 0x08080a },
    floor: { style: 'marble', base: 0x1b1a1f, pattern: 0xd9d2c3 },
    ceiling: 0x0a0a0d, ceilingGlow: 0, cove: 0xd8b878, diffuser: 0xc8aa80, accent: 0xd8b46e, washAlpha: 0.16,
    light: { sky: 0xc9d3ff, ground: 0x1a1420, fill: 1.0, key: 0xffe6c8, keyPower: 92, wash: 0xffd8b0, washPower: 30, fog: 0x05060b, fogNear: 30, fogFar: 90 },
    furnish(room, half, CEILING_Y) {
      const velvet = 0x2a1418;
      const wallH = CEILING_Y - FLOOR_Y;
      const drape = (x, z, yaw) => {
        const d = createDrape(wallH - 0.4, m(0.9), velvet);
        d.position.set(x, FLOOR_Y, z);
        d.rotation.y = yaw;
        room.add(d);
      };
      // Drapes at even intervals down both glass sides, and at the ends of
      // the glass behind the dealer — framing the view, not cutting it.
      [-1, 1].forEach((side) => {
        for (let k = 0; k < 5; k++) drape(side * (half - 0.25), -half + m(0.5) + k * ((2 * half - m(1)) / 4), facingIn(side));
        drape(side * (half - m(0.5)), -half + 0.25, 0);
        drape(side * m(3.6), -half + 0.25, 0);
      });

      // The house sign, hung on fine cables before the glass over the
      // dealer, the city behind it.
      const signW = m(2.4);
      const sign = createBrandSign(signW, { rgb: '236,202,128', plate: '#0b0b0f', halo: false });
      const signY = FLOOR_Y + m(2.9);
      sign.position.set(0, signY, -half + m(1.1));
      room.add(sign);
      const cableMat = new THREE.MeshStandardMaterial({ color: 0xc9a86a, roughness: 0.3, metalness: 0.9 });
      [-1, 1].forEach((s) => {
        const len = CEILING_Y - (signY + signW * 0.31);
        const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, len, 6), cableMat);
        cable.position.set(s * signW * 0.42, signY + signW * 0.31 + len / 2, -half + m(1.1));
        room.add(cable);
      });

      // A rug under the table and chairs, and a tray ceiling over them.
      room.add(createRug(22, 18, { base: '#2a1418', border: '#141014', accent: '#c9a86a' }));
      room.add(createTrayCeiling(13, 10.5, CEILING_Y, 0xe8c48a));

      // The bar, at the back left, against the glass.
      barCorner(room, half, CEILING_Y, { length: m(3.6), body: 0x141316, top: 0xe9e3d7, wood: 0x1a1418, rgb: '216,180,110', lamp: 'Chandelier_03', lampSize: 1.6 });

      // A lounge at the back right, drawn up round its table and turned to
      // the view, under the second chandelier.
      const lx = half - m(2.9), lz = -half + m(2.6);
      place(room, 'modern_coffee_table_01', { x: lx, z: lz, yaw: Math.PI / 4 });
      [[0, 1.25], [-1.25, 0], [1.15, -0.2]].forEach(([dx, dz], i) => {
        const px = lx + m(dx), pz = lz + m(dz);
        place(room, i === 0 ? 'Sofa_01' : 'mid_century_lounge_chair', { x: px, z: pz, yaw: facing(px, pz, lx, lz), size: i === 0 ? 1.15 : 1 });
      });
      const r = createRug(m(3.6), m(3.6), { base: '#1d1a22', border: '#0d0b10', accent: '#c9a86a' });
      r.position.set(lx, FLOOR_Y + 0.006, lz);
      room.add(r);
      place(room, 'Chandelier_03', { x: lx, y: CEILING_Y, z: lz, size: 2.4 });

      [-1, 1].forEach((side) => {
        // A conversation group on each glass side.
        lounge(room, half, side, m(0.9), { sofa: 'Sofa_01', chair: 'mid_century_lounge_chair', sofaSize: 1.15, rug: { base: '#24161b', border: '#120b0e', accent: '#c9a86a' } });
        place(room, 'potted_plant_04', { x: side * (half - m(0.6)), z: m(3.3), size: 1.8 });
        place(room, 'potted_plant_04', { x: side * (half - m(0.6)), z: half - m(0.7), size: 1.8 });
        // Art on plinths flanking the sign.
        place(room, 'side_table_tall_01', { x: side * m(2.4), z: backOf(half, 0.6), size: 1.1 });
        place(room, side < 0 ? 'marble_bust_01' : 'horse_statue_01', { x: side * m(2.4), y: FLOOR_Y + m(0.8), z: backOf(half, 0.6), size: 1.25 });
      });
      brandSign(room, half, { wall: 'front', width: m(1.6), rgb: '236,202,128', plate: '#0b0b0f' });
      walkway(room, { x: 9.0, back: -7.8, front: 9.2 });
      staffPosts(room, [[11, -10.5], [-11, 11], [11, 11]]);
    },
  },
};
