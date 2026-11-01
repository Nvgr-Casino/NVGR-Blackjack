import { place } from './furniture.js';
import { ROOM_NAMES } from '../app/roomLogic.js';
import { FLOOR_Y, m } from './scale.js';
import { createDrape, createRug, createTrayCeiling, createBrandSign } from './luxury.js';
import { lounge, bookcase, sconce, pilaster, walkway, facing, barCorner, brandSign, staffPosts } from './layout.js';
import * as THREE from 'three';

// Every table is in a room of its own, dressed for its stakes — each one
// light and alive: pale walls and bright floors under chandeliers, a bar
// in the corner with a bartender behind it, plants, pictures and places to
// sit, rising in richness from an easy lounge to a penthouse at the top.
// room.js paints the walls, floor and fittings from these; scene.js sets
// the light from them; each one furnishes itself with Poly Haven pieces
// (CC0) and fittings of our own (luxury.js).
//
// Every room is laid out the same way, so each reads as a whole:
//   - the back wall, which every player faces past the dealer: the lit
//     house sign over the dealer's head, flanked symmetrically;
//   - the bar in the back-left corner, seen past the dealer's shoulder
//     (layout.js's barCorner), with the waiters' pickup at its end;
//   - a conversation group on a rug against each side wall, under a
//     chandelier, the house crest on the wall over it;
//   - a rug under the table and a tray ceiling with a cove of light over
//     it; sconces along the walls; plants in the corners;
//   - the front wall, behind the players, with a second, smaller sign;
//   - a clear loop round the table for the waiters (layout.js's walkway)
//     and the posts where they stand between rounds (staffPosts).
//
// Positions are in the room's frame: the back wall at z = -half, the side
// walls at x = ±half, the table at the middle. Distances along the walls
// are in metres (m), so a room keeps its proportions at any size.

const backOf = (half, out = 0.25) => -half + m(out);
const facingIn = (side) => -side * Math.PI / 2;
const onWall = (half) => -half + m(0.03);
const frontOf = (half, out = 0.25) => half - m(out);

// Sconces in pairs on the back wall either side of the sign, and down each
// side wall.
function sconces(room, half, opts, { back = [1.5], sides = [-3.6, 2.4] } = {}) {
  const y = FLOOR_Y + m(1.85);
  back.forEach((x) => [-1, 1].forEach((s) => sconce(room, s * m(x), y, onWall(half) + m(0.02), 0, opts)));
  sides.forEach((z) => [-1, 1].forEach((s) => sconce(room, s * (half - m(0.05)), y, m(z), facingIn(s), opts)));
}

// Everything every room has: the sign front and back, a rug and a tray
// ceiling over the table, the bar, a lounge on each side wall under a
// chandelier (the crest on the wall above it, room.js), plants in the open
// corners, the waiters' loop and posts.
function salon(room, half, CEILING_Y, t) {
  brandSign(room, half, { rgb: t.signRgb, plate: t.signPlate });
  brandSign(room, half, { wall: 'front', width: m(1.6), rgb: t.signRgb, plate: t.signPlate });
  room.add(createRug(20, 16, t.rug));
  room.add(createTrayCeiling(13, 10.5, CEILING_Y, t.cove, t.trayFrame));
  barCorner(room, half, CEILING_Y, t.bar);
  [-1, 1].forEach((side) => {
    lounge(room, half, side, m(0.2), { ...t.lounge, chair: side < 0 ? t.lounge.chair : (t.lounge.chair2 || t.lounge.chair) });
    place(room, t.chandelier, { x: side * (half - m(1.55)), y: CEILING_Y, z: m(0.2), size: t.chandelierSize || 1.2 });
    // Plants: both front corners, and the back-right one (the bar has the left).
    place(room, t.plant, { x: side * (half - m(0.6)), z: frontOf(half, 0.6), size: 1.7 });
    place(room, t.plant2 || t.plant, { x: side * m(1.6), z: frontOf(half, 0.5), size: 1.5 });
  });
  place(room, t.plant, { x: half - m(0.6), z: -half + m(0.6), size: 1.7 });
  walkway(room);
  staffPosts(room, [[10, -9.6], [-10.2, 10.2], [10.2, 10.2]]);
}

export const ROOM_THEMES = {
  // The Lounge — 100 / 2K. Bright and easy: sand-coloured panelled walls
  // over a light oak wainscot, a honey-oak parquet, teal velvet and brass,
  // palms, globe pendants, and more daylight-warm light than any other
  // room.
  1: {
    name: ROOM_NAMES[0],
    wall: { style: 'panels', base: 0xeedfc4, panel: 0xf8eed9, shade: 0xd2bd98, wainscot: 0xa8794a, rail: 0xd8b878, skirting: 0x4a3220 },
    floor: { style: 'parquet', base: 0xb3814f },
    ceiling: 0xf0e8d8, cove: 0xffdba4, diffuser: 0xfff3dc, accent: 0xb8914f, crest: 0x8a6428, washAlpha: 0.18,
    light: { sky: 0xfff5e6, ground: 0x7a5c3e, fill: 1.95, key: 0xfff0dc, keyPower: 72, wash: 0xffe8cc, washPower: 46, fog: 0x8c7a62, fogNear: 36, fogFar: 95 },
    furnish(room, half, CEILING_Y) {
      salon(room, half, CEILING_Y, {
        signRgb: '226,190,118', signPlate: '#173634',
        rug: { base: '#2d5f5b', border: '#1b3b38', accent: '#d2ad6a' },
        cove: 0xffd9a0, trayFrame: 0xe6dccb,
        bar: { body: 0x1f4a47, top: 0xf2eee6, wood: 0x6b4a2c, rgb: '214,178,110', lamp: 'modern_ceiling_lamp_01' },
        lounge: { sofa: 'sofa_02', chair: 'mid_century_lounge_chair', rug: { base: '#e9dcc4', border: '#2d5f5b', accent: '#c9a466' } },
        chandelier: 'modern_ceiling_lamp_01', chandelierSize: 1.4,
        plant: 'potted_plant_04', plant2: 'potted_plant_01',
      });
      // The back wall: a cabinet with a picture over it either side of the sign.
      [-1, 1].forEach((side) => {
        place(room, 'fancy_picture_frame_02', { x: side * m(2.5), y: FLOOR_Y + m(1.7), z: onWall(half), size: 1.6 });
        place(room, 'vintage_cabinet_01', { x: side * m(2.5), z: backOf(half, 0.3), size: 1 });
      });
      place(room, 'potted_plant_01', { x: m(3.9), z: backOf(half, 0.5), size: 1.6 });
      sconces(room, half, { metal: 0xc9a466, glow: 0xffe2b0 });
    },
  },

  // The Parlour — 500 / 10K. Cream panelling over an emerald wainscot, a
  // walnut parquet, chesterfields, gilt mirrors over consoles, a
  // grandfather clock, crystal overhead.
  2: {
    name: ROOM_NAMES[1],
    wall: { style: 'panels', base: 0xe5d8bd, panel: 0xf1e6cf, shade: 0xc4b28f, wainscot: 0x1f4a37, rail: 0xc9a466, skirting: 0x12241b },
    floor: { style: 'parquet', base: 0x7a5232 },
    ceiling: 0xece2cf, cove: 0xffd7a0, diffuser: 0xfff0d2, accent: 0xb48c4a, crest: 0x8a6428, washAlpha: 0.18,
    light: { sky: 0xfff2e0, ground: 0x6a4c34, fill: 1.8, key: 0xffecd4, keyPower: 70, wash: 0xffe2c0, washPower: 44, fog: 0x76644c, fogNear: 34, fogFar: 92 },
    furnish(room, half, CEILING_Y) {
      salon(room, half, CEILING_Y, {
        signRgb: '226,190,118', signPlate: '#14301f',
        rug: { base: '#7a1f2a', border: '#4a1018', accent: '#d2ad6a' },
        cove: 0xffd7a0, trayFrame: 0xe2d6bf,
        bar: { body: 0x1b3d2d, top: 0xf0ebe0, wood: 0x3d2718, rgb: '214,178,110', lamp: 'Chandelier_01', lampSize: 0.8 },
        lounge: { sofa: 'sofa_03', chair: 'ArmChair_01', chair2: 'GreenChair_01', rug: { base: '#1f4a37', border: '#122a1f', accent: '#c9a466' } },
        chandelier: 'Chandelier_01', chandelierSize: 1.2,
        plant: 'potted_plant_02',
      });
      [-1, 1].forEach((side) => {
        const x = side * m(2.5);
        place(room, 'ClassicConsole_01', { x, z: backOf(half) });
        place(room, side < 0 ? 'mantel_clock_01' : 'brass_vase_01', { x, y: FLOOR_Y + m(0.8), z: backOf(half), size: side < 0 ? 1.4 : 1.2 });
        place(room, 'ornate_mirror_01', { x, y: FLOOR_Y + m(1.35), z: onWall(half), size: 1.4 });
      });
      place(room, 'vintage_grandfather_clock_01', { x: m(4.1), z: backOf(half, 0.35), size: 1.15 });
      sconces(room, half, { metal: 0xc9a466, glow: 0xffdcae });
    },
  },

  // The Library — 1K / 25K. Sage-green panelling over a walnut wainscot, a
  // claret patterned carpet, honey bookcases filled to the top either side
  // of the sign, chesterfields to read in, reading lamps, a marble bust.
  3: {
    name: ROOM_NAMES[2],
    wall: { style: 'panels', base: 0x8d9876, panel: 0x9daa86, shade: 0x6f7a5a, wainscot: 0x5a3a22, rail: 0xc9a466, skirting: 0x22160e },
    floor: { style: 'ornate', base: 0x7a2e2a, pattern: 0xc08a54 },
    ceiling: 0xebe1cd, cove: 0xffd49a, diffuser: 0xfff0d4, accent: 0xc49a56, crest: 0xf0d088, washAlpha: 0.2,
    light: { sky: 0xfff1de, ground: 0x5e4430, fill: 1.75, key: 0xffead0, keyPower: 70, wash: 0xffdcb4, washPower: 44, fog: 0x6a5a44, fogNear: 34, fogFar: 92 },
    furnish(room, half, CEILING_Y) {
      salon(room, half, CEILING_Y, {
        signRgb: '226,190,118', signPlate: '#2a1a10',
        rug: { base: '#24382c', border: '#14211a', accent: '#d2ad6a' },
        cove: 0xffd49a, trayFrame: 0xe4d9c4,
        bar: { body: 0x3b2616, top: 0xece4d4, wood: 0x4a2f1c, rgb: '214,178,110', lamp: 'Chandelier_01', lampSize: 0.8 },
        lounge: { sofa: 'sofa_03', chair: 'ArmChair_01', table: 'round_wooden_table_01', rug: { base: '#7a2e2a', border: '#4a1a18', accent: '#c9a466' } },
        chandelier: 'Chandelier_01', chandelierSize: 1.2,
        plant: 'potted_plant_02',
      });
      // Bookcases either side of the sign, and down the right of the back
      // wall; a bust and a lamp on stands.
      [-1, 1].forEach((side) => bookcase(room, side * m(1.95), backOf(half, 0.2)));
      bookcase(room, m(3.15), backOf(half, 0.2));
      [-1, 1].forEach((side) => {
        [-3.8, -2.6].forEach((z) => bookcase(room, side * (half - m(0.2)), m(z), { yaw: facingIn(side) }));
        place(room, 'vintage_oil_lamp', { x: side * (half - m(1.55)), y: FLOOR_Y + m(0.75), z: m(0.2), size: 1.2 });
      });
      place(room, 'side_table_tall_01', { x: m(4.4), z: backOf(half, 0.4) });
      place(room, 'marble_bust_01', { x: m(4.4), y: FLOOR_Y + m(0.72), z: backOf(half, 0.4), size: 1.2 });
      sconces(room, half, { metal: 0xc9a466, glow: 0xffd49a }, { back: [], sides: [-1.6, 2.4] });
    },
  },

  // The Gold Room — 5K / 100K. Ivory lacquer framed in gold, a black and
  // white marble floor, gilt pilasters, mirrors over consoles, crystal
  // chandeliers, a navy rug under the table: bright, formal and rich.
  4: {
    name: ROOM_NAMES[3],
    wall: { style: 'lacquer', base: 0xebe3d3, trim: 0xc49a48, skirting: 0x1a1714 },
    floor: { style: 'checker', base: 0xeee8dc, pattern: 0x1c1b20 },
    ceiling: 0xf2ebdd, cove: 0xffe0a8, diffuser: 0xfff3da, accent: 0xb8903e, crest: 0x9a7330, washAlpha: 0.16,
    light: { sky: 0xfff4e4, ground: 0x6e5c44, fill: 1.8, key: 0xfff0d8, keyPower: 76, wash: 0xffe4b8, washPower: 46, fog: 0x807260, fogNear: 36, fogFar: 95 },
    furnish(room, half, CEILING_Y) {
      const wallH = CEILING_Y - FLOOR_Y;
      salon(room, half, CEILING_Y, {
        signRgb: '232,198,122', signPlate: '#141318',
        rug: { base: '#1d2540', border: '#10142a', accent: '#d8b46e' },
        cove: 0xffe0a8, trayFrame: 0xece4d4,
        bar: { body: 0x141318, top: 0xf2ece2, wood: 0x2a1c14, rgb: '226,190,118', lamp: 'Chandelier_03', lampSize: 1.2 },
        lounge: { sofa: 'Sofa_01', chair: 'ArmChair_01', rug: { base: '#1d2540', border: '#10142a', accent: '#d8b46e' }, sofaSize: 1.15 },
        chandelier: 'Chandelier_03', chandelierSize: 2.2,
        plant: 'potted_plant_02',
      });
      [-1, 1].forEach((side) => {
        const x = side * m(2.55);
        place(room, 'ClassicConsole_01', { x, z: backOf(half) });
        place(room, side < 0 ? 'horse_statue_01' : 'brass_vase_02', { x, y: FLOOR_Y + m(0.8), z: backOf(half), size: side < 0 ? 1.1 : 1.3 });
        place(room, 'ornate_mirror_01', { x, y: FLOOR_Y + m(1.35), z: onWall(half), size: 1.5 });
        // Gilt pilasters framing the sign and the consoles, and down the side walls.
        [1.45, 3.5].forEach((px) => { if (side > 0 || px < 3) pilaster(room, side * m(px), onWall(half) + m(0.04), 0, wallH, { color: 0xe6dccb, trim: 0xc49a48 }); });
        [-4.2, -1.6, 2.0, 4.6].forEach((pz) => pilaster(room, side * (half - m(0.04)), m(pz), facingIn(side), wallH, { color: 0xe6dccb, trim: 0xc49a48 }));
      });
      // A crystal chandelier over the table's light, either side of it.
      [-1, 1].forEach((s) => place(room, 'Chandelier_03', { x: s * m(2.8), y: CEILING_Y, z: -m(1.2), size: 1.8 }));
      sconces(room, half, { metal: 0xd6b46e, glow: 0xffdfae }, { back: [], sides: [-2.9, 0.8, 3.3] });
    },
  },

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
