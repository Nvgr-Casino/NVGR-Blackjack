import { place } from './furniture.js';
import { ROOM_NAMES } from '../app/roomLogic.js';
import { FLOOR_Y, m } from './scale.js';
import { createDrape, createRug, createBar, createTrayCeiling } from './luxury.js';

// Every table is in a room of its own, dressed for its stakes. The cheapest
// table is a bright, easy lounge; each step up is darker, richer and
// quieter, to a penthouse at the top. room.js paints the walls, floor
// and fittings from these; scene.js sets the light from them; each one
// furnishes itself with Poly Haven pieces (CC0) against its walls.
//
// The back wall, behind the dealer, is the one every player looks at, so
// it is the one each room dresses most. The side walls are caught at the
// edges of the view. The house crest is on every wall (room.js).
//
// Positions are in the room's frame: the back wall at z = -half, the side
// walls at x = ±half, the table at the middle.

const backOf = (half, out = 0.25) => -half + m(out);
const wallX = (half, side, out = 0.55) => side * (half - m(out));
const facingIn = (side) => -side * Math.PI / 2;
const onWall = (half) => -half + m(0.03);

export const ROOM_THEMES = {
  // The Lounge — 100 / 2K. Honey oak, a teal carpet, mid-century seating,
  // plants, and more light than any other room.
  1: {
    name: ROOM_NAMES[0],
    wall: { style: 'slats', base: 0x6b4b30, skirting: 0x1c130c },
    floor: { style: 'ornate', base: 0x1f3a3b, pattern: 0x3c6a68 },
    ceiling: 0x17120e, cove: 0xd0a468, diffuser: 0xc2ab84, accent: 0xc9a466, washAlpha: 0.3,
    light: { sky: 0xf6e9d6, ground: 0x2e2419, fill: 1.15, key: 0xffe9cc, keyPower: 64, wash: 0xffe0bc, washPower: 34, fog: 0x0f0c0a },
    furnish(room, half, CEILING_Y) {
      [-1, 1].forEach((side) => {
        place(room, 'fancy_picture_frame_02', { x: side * m(1.7), y: FLOOR_Y + m(1.5), z: onWall(half), size: 1.5 });
        place(room, 'potted_plant_04', { x: side * m(1.05), z: backOf(half, 0.35), size: 1.5 });
        place(room, 'potted_plant_01', { x: side * (half - m(0.6)), z: -half + m(0.6), size: 1.4 });
        // A sofa and a coffee table along each side wall, set back toward
        // the corners where the seated view takes them in whole.
        place(room, 'sofa_02', { x: wallX(half, side, 0.5), z: -m(1.6), yaw: facingIn(side) });
        place(room, 'modern_coffee_table_01', { x: wallX(half, side, 1.35), z: -m(1.6), yaw: facingIn(side) });
        place(room, 'mid_century_lounge_chair', { x: wallX(half, side, 0.9), z: m(0.3), yaw: facingIn(side) + side * 0.6 });
        place(room, 'modern_ceiling_lamp_01', { x: wallX(half, side, 1.3), y: CEILING_Y - m(0.05), z: -m(1.6) });
      });
    },
  },

  // The Parlour — 500 / 10K. Green damask over a walnut dado, a burgundy
  // carpet, chesterfields, a grandfather clock.
  2: {
    name: ROOM_NAMES[1],
    wall: { style: 'damask', base: 0x1b3427, motif: 0x2e5641, dado: 0x34231a, rail: 0x8f6f47, skirting: 0x120c08 },
    floor: { style: 'ornate', base: 0x3a1417, pattern: 0x6e2c2c },
    ceiling: 0x120e0b, cove: 0xc49660, diffuser: 0xb09a78, accent: 0xcaa76c,
    light: { sky: 0xf3e6d2, ground: 0x2a1d16, fill: 1.0, key: 0xffe5c4, keyPower: 60, wash: 0xffdcb4, washPower: 32, fog: 0x0c0a09 },
    furnish(room, half, CEILING_Y) {
      [-1, 1].forEach((side) => {
        const x = side * m(1.6);
        place(room, 'ClassicConsole_01', { x, z: backOf(half) });
        place(room, side < 0 ? 'mantel_clock_01' : 'brass_vase_01', { x: x - side * m(0.25), y: FLOOR_Y + m(0.8), z: backOf(half), size: side < 0 ? 1.4 : 1.2 });
        place(room, 'fancy_picture_frame_02', { x, y: FLOOR_Y + m(1.5), z: onWall(half), size: 1.6 });
        place(room, side < 0 ? 'vintage_grandfather_clock_01' : 'potted_plant_02', { x: side * (half - m(0.5)), z: -half + m(0.4), size: side < 0 ? 1.15 : 1.6 });
        place(room, 'sofa_03', { x: wallX(half, side), z: -m(0.4), yaw: facingIn(side) });
        place(room, side < 0 ? 'ArmChair_01' : 'GreenChair_01', { x: wallX(half, side, 1.1), z: m(1.1), yaw: facingIn(side) + side * 0.6 });
        place(room, 'round_wooden_table_01', { x: wallX(half, side, 0.45), z: m(0.85), size: 0.8 });
      });
    },
  },

  // The Library — 1K / 25K. The original salon: walnut slats, a deep brown
  // carpet, now with bookcases, reading chairs, a chess set and a bust.
  3: {
    name: ROOM_NAMES[2],
    wall: { style: 'slats', base: 0x31241b, skirting: 0x100c0a },
    floor: { style: 'ornate', base: 0x34271f, pattern: 0x5a4632 },
    ceiling: 0x0c0a09, cove: 0x8a6a45, diffuser: 0x9c8a70, accent: 0xb0925c,
    light: { sky: 0xf3e6d2, ground: 0x2a1d16, fill: 0.9, key: 0xffe7c8, keyPower: 60, wash: 0xffdcb4, washPower: 30, fog: 0x0b0908 },
    furnish(room, half, CEILING_Y) {
      [-1, 1].forEach((side) => {
        const x = side * m(1.75);
        place(room, 'Shelf_01', { x, z: backOf(half, 0.22), size: 1.35, stain: 0x5b3b26 });
        place(room, 'book_encyclopedia_set_01', { x: x - side * m(0.1), y: FLOOR_Y + m(1.1), z: backOf(half, 0.25), size: 1.35 });
        place(room, 'book_encyclopedia_set_01', { x: x + side * m(0.12), y: FLOOR_Y + m(0.62), z: backOf(half, 0.25), size: 1.35 });
        place(room, 'potted_plant_02', { x: side * (half - m(0.55)), z: -half + m(0.55), size: 1.6 });
        place(room, 'ArmChair_01', { x: wallX(half, side, 0.75), z: -m(0.6), yaw: facingIn(side) });
        place(room, 'side_table_tall_01', { x: wallX(half, side, 0.35), z: m(0.3) });
        place(room, 'vintage_oil_lamp', { x: wallX(half, side, 0.35), y: FLOOR_Y + m(0.72), z: m(0.3), size: 1.2 });
        place(room, 'ArmChair_01', { x: wallX(half, side, 0.75), z: m(1.3), yaw: facingIn(side) - side * 0.4 });
      });
      place(room, 'vintage_cabinet_01', { x: -m(3.0), z: -m(1.6), yaw: Math.PI / 2 });
      place(room, 'marble_bust_01', { x: m(3.0), y: FLOOR_Y + m(0.72), z: -m(1.6), yaw: -Math.PI / 2, size: 1.2 });
      place(room, 'side_table_tall_01', { x: m(3.0), z: -m(1.6) });
    },
  },

  // The Gold Room — 5K / 100K. Black lacquer framed in brass, a black and
  // gold carpet, chandeliers, mirrors over gilt consoles.
  4: {
    name: ROOM_NAMES[3],
    wall: { style: 'lacquer', base: 0x111013, trim: 0xbd9658, skirting: 0x060506 },
    floor: { style: 'ornate', base: 0x141216, pattern: 0x8f703c },
    ceiling: 0x09080a, cove: 0xdcb26a, diffuser: 0xb39a72, accent: 0xd6b46e, washAlpha: 0.2,
    light: { sky: 0xf1e4cf, ground: 0x1c1712, fill: 0.8, key: 0xffe4bc, keyPower: 66, wash: 0xffd9a8, washPower: 34, fog: 0x070607 },
    furnish(room, half, CEILING_Y) {
      [-1, 1].forEach((side) => {
        const x = side * m(1.6);
        place(room, 'ClassicConsole_01', { x, z: backOf(half) });
        place(room, side < 0 ? 'horse_statue_01' : 'brass_vase_02', { x: x - side * m(0.2), y: FLOOR_Y + m(0.8), z: backOf(half), size: side < 0 ? 1.1 : 1.3 });
        place(room, 'ornate_mirror_01', { x, y: FLOOR_Y + m(1.25), z: onWall(half), size: 1.5 });
        place(room, 'Chandelier_01', { x: side * m(2.2), y: CEILING_Y, z: -m(1.4), size: 1.2 });
        place(room, 'Sofa_01', { x: wallX(half, side), z: -m(0.3), yaw: facingIn(side) });
        place(room, 'side_table_tall_01', { x: wallX(half, side, 0.35), z: m(1.0) });
        place(room, 'brass_vase_02', { x: wallX(half, side, 0.35), y: FLOOR_Y + m(0.72), z: m(1.0), size: 1.1 });
        place(room, 'potted_plant_02', { x: side * (half - m(0.55)), z: -half + m(0.55), size: 1.6 });
      });
    },
  },

  // The Penthouse — 25K / 500K. The top floor of a tower at night, and the
  // largest room: half as wide again as the salons, and taller, with glass
  // floor to ceiling on three sides — the city's skyline outside and its
  // lights spread out below (room.js's createSkyline) — velvet drapes
  // between the bays, a black marble floor under a bordered rug, a marble
  // bar with the house crest on its front, a lounge turned to the view,
  // crystal chandeliers and a tray ceiling with a cove of light.
  5: {
    name: ROOM_NAMES[4],
    half: 13,
    ceilingY: 8.2,
    windows: true,
    wall: { style: 'lacquer', base: 0x17171b, trim: 0xc9a86a, skirting: 0x08080a },
    floor: { style: 'marble', base: 0x1b1a1f, pattern: 0xd9d2c3 },
    ceiling: 0x0a0a0d, cove: 0xd8b878, diffuser: 0xc8aa80, accent: 0xd8b46e, washAlpha: 0.16,
    light: { sky: 0xc9d3ff, ground: 0x1a1420, fill: 0.85, key: 0xffe6c8, keyPower: 92, wash: 0xffd8b0, washPower: 30, fog: 0x05060b },
    furnish(room, half, CEILING_Y) {
      const velvet = 0x2a1418;
      const wallH = CEILING_Y - FLOOR_Y;

      // Drapes between the glass bays, down both sides and at the ends of
      // the back wall.
      [-1, 1].forEach((side) => {
        for (const z of [-half + m(0.5), -m(2.5), m(1.5)]) {
          const d = createDrape(wallH - 0.4, m(0.9), velvet);
          d.position.set(side * (half - 0.25), FLOOR_Y, z);
          d.rotation.y = facingIn(side);
          room.add(d);
        }
        const d = createDrape(wallH - 0.4, m(0.9), velvet);
        d.position.set(side * m(1.45), FLOOR_Y, -half + 0.25);
        room.add(d);
      });

      // A rug under the table and chairs.
      room.add(createRug(15, 12, { base: '#2a1418', border: '#141014', accent: '#c9a86a' }));
      // A tray ceiling over the table, round its light.
      room.add(createTrayCeiling(9, 7, CEILING_Y, 0xe8c48a));

      // The bar, along the glass at the back left, with stools and a bar
      // top of bottles and goblets.
      const bar = createBar(m(2.6));
      bar.position.set(-half + m(2.2), 0, -half + m(1.4));
      room.add(bar);
      [-1, 0, 1].forEach((k) => {
        place(room, 'bar_chair_round_01', { x: -half + m(2.2) + k * m(0.75), z: -half + m(1.85), yaw: Math.PI });
      });
      place(room, 'wine_bottles_01', { x: -half + m(1.7), y: FLOOR_Y + m(1.08), z: -half + m(1.15), size: 1.1 });
      place(room, 'brass_goblets', { x: -half + m(2.6), y: FLOOR_Y + m(1.08), z: -half + m(1.15), size: 1.1 });

      // A lounge at the back right, turned to the view.
      place(room, 'Sofa_01', { x: half - m(2.4), z: -half + m(2.4), yaw: Math.PI * 0.75 });
      place(room, 'modern_coffee_table_01', { x: half - m(1.75), z: -half + m(1.75), yaw: Math.PI * 0.75 });
      place(room, 'mid_century_lounge_chair', { x: half - m(0.9), z: -half + m(2.7), yaw: -Math.PI * 0.6 });
      place(room, 'mid_century_lounge_chair', { x: half - m(2.7), z: -half + m(0.9), yaw: Math.PI * 0.9 });

      [-1, 1].forEach((side) => {
        // Seating along each glass side wall.
        place(room, 'Sofa_01', { x: wallX(half, side, 0.7), z: m(0.2), yaw: facingIn(side) });
        place(room, 'modern_coffee_table_01', { x: wallX(half, side, 1.6), z: m(0.2), yaw: facingIn(side) });
        place(room, 'potted_plant_04', { x: wallX(half, side, 0.5), z: m(1.9), size: 1.8 });
        // Art on plinths flanking the dealer's panel.
        place(room, 'side_table_tall_01', { x: side * m(2.1), z: backOf(half, 0.35), size: 1.1 });
        place(room, side < 0 ? 'marble_bust_01' : 'horse_statue_01', { x: side * m(2.1), y: FLOOR_Y + m(0.8), z: backOf(half, 0.35), size: 1.25 });
      });
      place(room, 'potted_plant_04', { x: -half + m(0.6), z: -half + m(0.6), size: 2 });
      // Grand crystal chandeliers, one over the bar and one over the lounge,
      // on long drops so they hang into the top corners of the players'
      // view — the middle above the dealer is out of a seated view, which
      // looks down at the felt. (Poly Haven's chandeliers have their origin
      // at the ceiling rose, so they hang from y = the ceiling.)
      place(room, 'Chandelier_03', { x: -half + m(2.2), y: CEILING_Y, z: -half + m(1.5), size: 2.4 });
      place(room, 'Chandelier_03', { x: half - m(1.9), y: CEILING_Y, z: -half + m(1.9), size: 2.4 });
    },
  },
};
