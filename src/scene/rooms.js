import { place } from './furniture.js';
import { ROOM_NAMES } from '../app/roomLogic.js';
import { FLOOR_Y, m } from './scale.js';
import { createDrape, createRug, createBar, createTrayCeiling } from './luxury.js';
import { lounge, bookcase, sconce, pilaster, walkway, facing } from './layout.js';

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
// walls at x = ±half, the table at the middle. Each room is laid out the
// same way: the back wall dressed symmetrically behind the dealer, a
// conversation group (layout.js's lounge) on a rug against each side wall,
// sconces along the walls, and a clear loop between the table and the
// furniture that the waiters walk (layout.js's walkway).

const backOf = (half, out = 0.25) => -half + m(out);
const facingIn = (side) => -side * Math.PI / 2;
const onWall = (half) => -half + m(0.03);

// Sconces in pairs along the back wall and down each side wall.
function sconces(room, half, opts, { back = [3.2], sides = [-3.4, 1.2] } = {}) {
  const y = FLOOR_Y + m(1.75);
  back.forEach((x) => [-1, 1].forEach((s) => sconce(room, s * m(x), y, onWall(half) + m(0.02), 0, opts)));
  sides.forEach((z) => [-1, 1].forEach((s) => sconce(room, s * (half - m(0.05)), y, m(z), facingIn(s), opts)));
}

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
        place(room, 'fancy_picture_frame_02', { x: side * m(1.8), y: FLOOR_Y + m(1.5), z: onWall(half), size: 1.5 });
        place(room, 'potted_plant_04', { x: side * m(1.05), z: backOf(half, 0.35), size: 1.5 });
        place(room, 'potted_plant_01', { x: side * (half - m(0.6)), z: -half + m(0.6), size: 1.4 });
        place(room, 'potted_plant_01', { x: side * (half - m(0.6)), z: half - m(0.6), size: 1.4 });
        lounge(room, half, side, -m(0.6), { sofa: 'sofa_02', chair: 'mid_century_lounge_chair', rug: { base: '#203a3a', border: '#142626', accent: '#c9a466' } });
        place(room, 'modern_ceiling_lamp_01', { x: side * (half - m(1.55)), y: CEILING_Y - m(0.05), z: -m(0.6) });
      });
      sconces(room, half, { metal: 0xc9a466, glow: 0xffe2b0 });
      walkway(room);
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
        const x = side * m(1.7);
        place(room, 'ClassicConsole_01', { x, z: backOf(half) });
        place(room, side < 0 ? 'mantel_clock_01' : 'brass_vase_01', { x, y: FLOOR_Y + m(0.8), z: backOf(half), size: side < 0 ? 1.4 : 1.2 });
        place(room, 'fancy_picture_frame_02', { x, y: FLOOR_Y + m(1.55), z: onWall(half), size: 1.6 });
        place(room, 'potted_plant_02', { x: side * (half - m(0.55)), z: half - m(0.55), size: 1.6 });
        lounge(room, half, side, -m(0.6), { sofa: 'sofa_03', chair: side < 0 ? 'ArmChair_01' : 'GreenChair_01', rug: { base: '#3a1417', border: '#1e0a0c', accent: '#caa76c' } });
      });
      place(room, 'vintage_grandfather_clock_01', { x: -half + m(0.5), z: -half + m(0.4), size: 1.15 });
      place(room, 'potted_plant_02', { x: half - m(0.55), z: -half + m(0.55), size: 1.6 });
      sconces(room, half, { metal: 0xbf9a5e, glow: 0xffdcae });
      walkway(room);
    },
  },

  // The Library — 1K / 25K. Walnut slats and a deep brown carpet, a wall of
  // filled bookcases behind the dealer, chesterfields to read in, a bust.
  3: {
    name: ROOM_NAMES[2],
    wall: { style: 'slats', base: 0x31241b, skirting: 0x100c0a },
    floor: { style: 'ornate', base: 0x34271f, pattern: 0x5a4632 },
    ceiling: 0x0c0a09, cove: 0x8a6a45, diffuser: 0x9c8a70, accent: 0xb0925c,
    light: { sky: 0xf3e6d2, ground: 0x2a1d16, fill: 0.95, key: 0xffe7c8, keyPower: 60, wash: 0xffdcb4, washPower: 34, fog: 0x0b0908 },
    furnish(room, half, CEILING_Y) {
      // Four bookcases across the back, two either side of the crest.
      [1.55, 2.95].forEach((x) => [-1, 1].forEach((side) => bookcase(room, side * m(x), backOf(half, 0.2))));
      [-1, 1].forEach((side) => {
        // Two more on each side wall, toward the back corners.
        [-3.4, -2.0].forEach((z) => bookcase(room, side * (half - m(0.2)), m(z), { yaw: facingIn(side) }));
        lounge(room, half, side, m(0.6), { sofa: 'sofa_03', chair: 'ArmChair_01', table: 'round_wooden_table_01', rug: { base: '#3a2a1e', border: '#1c130d', accent: '#b0925c' } });
        place(room, 'vintage_oil_lamp', { x: side * (half - m(1.55)), y: FLOOR_Y + m(0.75), z: m(0.6), size: 1.2 });
        place(room, 'potted_plant_02', { x: side * (half - m(0.55)), z: half - m(0.55), size: 1.6 });
      });
      place(room, 'side_table_tall_01', { x: -m(4.2), z: backOf(half, 0.4) });
      place(room, 'marble_bust_01', { x: -m(4.2), y: FLOOR_Y + m(0.72), z: backOf(half, 0.4), size: 1.2 });
      place(room, 'side_table_tall_01', { x: m(4.2), z: backOf(half, 0.4) });
      place(room, 'vintage_oil_lamp', { x: m(4.2), y: FLOOR_Y + m(0.72), z: backOf(half, 0.4), size: 1.3 });
      sconces(room, half, { metal: 0xa8875a, glow: 0xffd49a }, { back: [], sides: [1.6, 3.4] });
      walkway(room);
    },
  },

  // The Gold Room — 5K / 100K. Black lacquer framed in brass, a black and
  // gold carpet, pilasters, mirrors over gilt consoles, chandeliers.
  4: {
    name: ROOM_NAMES[3],
    wall: { style: 'lacquer', base: 0x111013, trim: 0xbd9658, skirting: 0x060506 },
    floor: { style: 'ornate', base: 0x141216, pattern: 0x8f703c },
    ceiling: 0x09080a, cove: 0xdcb26a, diffuser: 0xb39a72, accent: 0xd6b46e, washAlpha: 0.2,
    light: { sky: 0xf1e4cf, ground: 0x1c1712, fill: 0.85, key: 0xffe4bc, keyPower: 66, wash: 0xffd9a8, washPower: 36, fog: 0x070607 },
    furnish(room, half, CEILING_Y) {
      const wallH = CEILING_Y - FLOOR_Y;
      [-1, 1].forEach((side) => {
        const x = side * m(1.75);
        place(room, 'ClassicConsole_01', { x, z: backOf(half) });
        place(room, side < 0 ? 'horse_statue_01' : 'brass_vase_02', { x, y: FLOOR_Y + m(0.8), z: backOf(half), size: side < 0 ? 1.1 : 1.3 });
        place(room, 'ornate_mirror_01', { x, y: FLOOR_Y + m(1.3), z: onWall(half), size: 1.5 });
        // Pilasters framing the consoles and marching down the side walls.
        [0.75, 2.75, 4.4].forEach((px) => pilaster(room, side * m(px), onWall(half) + m(0.04), 0, wallH));
        [-3.6, -0.6, 2.4].forEach((pz) => pilaster(room, side * (half - m(0.04)), m(pz), facingIn(side), wallH));
        lounge(room, half, side, -m(0.6), { sofa: 'Sofa_01', chair: 'ArmChair_01', rug: { base: '#141216', border: '#0a090b', accent: '#c9a466' }, sofaSize: 1.15 });
        place(room, 'Chandelier_01', { x: side * (half - m(1.55)), y: CEILING_Y, z: -m(0.6), size: 1.2 });
        place(room, 'potted_plant_02', { x: side * (half - m(0.55)), z: -half + m(0.55), size: 1.6 });
        place(room, 'potted_plant_02', { x: side * (half - m(0.55)), z: half - m(0.55), size: 1.6 });
      });
      sconces(room, half, { metal: 0xd6b46e, glow: 0xffd9a0 }, { back: [3.75], sides: [-2.1, 0.9] });
      walkway(room);
    },
  },

  // The Penthouse — 25K / 500K. The top floor of a tower at night, and the
  // largest room by far, with glass floor to ceiling on three sides — the
  // city's skyline outside and its lights spread out below (room.js's
  // createSkyline) — velvet drapes between the bays, a black marble floor
  // under a bordered rug, a marble bar with the house crest on its front,
  // lounges drawn up round their tables, crystal chandeliers and a tray
  // ceiling with a cove of light.
  5: {
    name: ROOM_NAMES[4],
    half: 16,
    ceilingY: 8.6,
    windows: true,
    wall: { style: 'lacquer', base: 0x17171b, trim: 0xc9a86a, skirting: 0x08080a },
    floor: { style: 'marble', base: 0x1b1a1f, pattern: 0xd9d2c3 },
    ceiling: 0x0a0a0d, cove: 0xd8b878, diffuser: 0xc8aa80, accent: 0xd8b46e, washAlpha: 0.16,
    light: { sky: 0xc9d3ff, ground: 0x1a1420, fill: 0.9, key: 0xffe6c8, keyPower: 92, wash: 0xffd8b0, washPower: 30, fog: 0x05060b },
    furnish(room, half, CEILING_Y) {
      const velvet = 0x2a1418;
      const wallH = CEILING_Y - FLOOR_Y;
      const drape = (x, z, yaw) => {
        const d = createDrape(wallH - 0.4, m(0.9), velvet);
        d.position.set(x, FLOOR_Y, z);
        d.rotation.y = yaw;
        room.add(d);
      };
      // Drapes at even intervals down both glass sides, and either side of
      // the solid panel behind the dealer.
      [-1, 1].forEach((side) => {
        for (let k = 0; k < 5; k++) drape(side * (half - 0.25), -half + m(0.5) + k * ((2 * half - m(1)) / 4), facingIn(side));
        drape(side * m(1.45), -half + 0.25, 0);
        drape(side * (half - m(0.5)), -half + 0.25, 0);
      });

      // A rug under the table and chairs, and a tray ceiling over them.
      room.add(createRug(17, 14, { base: '#2a1418', border: '#141014', accent: '#c9a86a' }));
      room.add(createTrayCeiling(10, 8, CEILING_Y, 0xe8c48a));

      // The bar, along the glass at the back left, with stools and bottles.
      const barX = -half + m(2.4);
      const barZ = -half + m(1.4);
      const bar = createBar(m(3.2));
      bar.position.set(barX, 0, barZ);
      room.add(bar);
      [-1.5, -0.5, 0.5, 1.5].forEach((k) => place(room, 'bar_chair_round_01', { x: barX + k * m(0.75), z: barZ + m(0.55), yaw: Math.PI }));
      place(room, 'wine_bottles_01', { x: barX - m(0.8), y: FLOOR_Y + m(1.08), z: barZ - m(0.25), size: 1.1 });
      place(room, 'brass_goblets', { x: barX + m(0.6), y: FLOOR_Y + m(1.08), z: barZ - m(0.25), size: 1.1 });
      place(room, 'Chandelier_03', { x: barX, y: CEILING_Y, z: barZ + m(0.2), size: 2.4 });

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
        // Art on plinths flanking the dealer's panel.
        place(room, 'side_table_tall_01', { x: side * m(2.3), z: backOf(half, 0.35), size: 1.1 });
        place(room, side < 0 ? 'marble_bust_01' : 'horse_statue_01', { x: side * m(2.3), y: FLOOR_Y + m(0.8), z: backOf(half, 0.35), size: 1.25 });
      });
      walkway(room, { x: 7, back: -6.2, front: 7.2 });
    },
  },
};
