import * as THREE from 'three';
import { place } from './furniture.js';
import { FLOOR_Y, m } from './scale.js';
import { createDrape, createBrandSign, createBackBar, createRug } from './luxury.js';
import { lounge, walkway, facing, barCorner, brandSign, staffPosts } from './layout.js';
import { onyxMaterial } from './onyx.js';
import {
  paintMarbleFloor, roundRug, lightRing, crystalRain, starburstCeiling, lightPiers, windowBar,
  goldDice, searchlights, fireTable, grandPiano, champagneTower,
} from './decor.js';

// The High Roller: a Manhattan sky club on the top floor of a tower, New
// York at night through glass floor to ceiling on three sides (room.js's
// createSkyline). Made to be looked at:
//
//   - a floor of white marble veined with gold, inlaid with gold, a ring of
//     light round the table on a round rug of navy and gold;
//   - over the table, a chandelier of crystal rain — hundreds of glowing
//     drops on fine threads falling in a spiral, twinkling — and lines of
//     gold light running out from it across the ceiling like a starburst;
//   - glowing gold piers up the glass, framing the city between them;
//   - down the right-hand glass, a long window bar: a counter of backlit
//     onyx facing the room, stools turned to the view;
//   - two great gold dice on a plinth of black marble, one tumbling;
//   - a black grand piano by the glass, a tower of champagne, walls of lit
//     wine either side of the sign behind the players, pictures in gilt;
//   - the onyx bar at the back left, a lounge round a fire table at the
//     back right, searchlights sweeping over the city;
//   - the house sign hung on fine cables over the floor behind the dealer.

// ---------- the room ----------
// 28 m of floor across and tall, the window bar down its right-hand side.
export const HIGH_ROLLER = {
  tableGlow: 0xffe2b0,
  half: 36,
  ceilingY: 11.0,
  windows: true,
  wall: { style: 'lacquer', base: 0x17171b, trim: 0xc9a86a, skirting: 0x08080a },
  floor: { style: 'marble', base: 0xece8e1, pattern: 0xc4a05c },
  floorPx: 1024, floorRepeat: 72 / 5,
  paintFloor: paintMarbleFloor,
  noPanel: true,
  ceiling: 0x161a2c, ceilingGlow: 0.3, cove: 0xd8b878, diffuser: 0xc8aa80, accent: 0xd8b46e, washAlpha: 0.16,
  light: { sky: 0xd4dcff, ground: 0x6a5a50, fill: 1.55, key: 0xffe6c8, keyPower: 96, wash: 0xffd8b0, washPower: 34, fog: 0x05060b, fogNear: 30, fogFar: 90 },
  furnish(room, half, CEILING_Y) {
    const wallH = CEILING_Y - FLOOR_Y;
    const updates = [];
    // Drapes only at the corners, framing the glass.
    const velvet = 0x2a1418;
    [-1, 1].forEach((side) => {
      const d1 = createDrape(wallH - 0.4, m(0.9), velvet);
      d1.position.set(side * (half - m(0.5)), FLOOR_Y, -half + 0.25);
      room.add(d1);
      const d2 = createDrape(wallH - 0.4, m(0.9), velvet);
      d2.position.set(side * (half - 0.25), FLOOR_Y, half - m(0.6));
      d2.rotation.y = -side * Math.PI / 2;
      room.add(d2);
    });
    // A line of gold light along the foot of all the glass.
    const goldLight = new THREE.MeshBasicMaterial({ color: 0xffcf80, toneMapped: false });
    [[2 * half, 0.04, 0, -half + 0.12], [0.04, 2 * half, -half + 0.12, 0], [0.04, 2 * half, half - 0.12, 0]].forEach(([w, d, x, z]) => {
      const strip = new THREE.Mesh(new THREE.BoxGeometry(w, 0.03, d), goldLight);
      strip.position.set(x, FLOOR_Y + 0.02, z);
      room.add(strip);
    });

    // The house sign, larger, hung on fine cables from the ceiling behind
    // the dealer — out over the floor, not at the far glass, where in a
    // room this size it would be small.
    const signW = m(3.0);
    const sign = createBrandSign(signW, { rgb: '236,202,128', plate: '#0b0b0f', halo: false });
    const signY = FLOOR_Y + m(2.85);
    const signZ = -m(9.0);
    sign.position.set(0, signY, signZ);
    room.add(sign);
    const cableMat = new THREE.MeshStandardMaterial({ color: 0xc9a86a, roughness: 0.3, metalness: 0.9 });
    [-1, 1].forEach((s) => {
      const len = CEILING_Y - (signY + signW * 0.31);
      const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, len, 6), cableMat);
      cable.position.set(s * signW * 0.42, signY + signW * 0.31 + len / 2, signZ);
      room.add(cable);
    });
    brandSign(room, half, { wall: 'front', width: m(2.2), rgb: '236,202,128', plate: '#0b0b0f' });

    // Gold light across the ceiling from the chandelier, and up the glass.
    starburstCeiling(room, half, CEILING_Y);
    lightPiers(room, half, CEILING_Y);

    // Crystal rain over the table.
    updates.push(crystalRain(room, CEILING_Y, new THREE.Vector3(0, 0, -0.4)));

    // A round rug of navy and gold under the table and chairs, a ring of
    // light in the marble round it.
    room.add(roundRug(m(4.4)));
    room.add(lightRing(m(4.9)));

    // The onyx bar, at the back left.
    barCorner(room, half, CEILING_Y, { length: m(3.8), bodyMaterial: onyxMaterial(), top: 0x111014, wood: 0x16121a, rgb: '216,180,110', lamp: 'Chandelier_03', lampSize: 1.4 });

    // The fire-table lounge at the back right, turned to the view.
    const fx = half - m(3.1), fz = -half + m(2.6);
    updates.push(fireTable(room, fx, fz, m(1.8)));
    [[0, 1.2, 'Sofa_01'], [0, -1.15, 'Sofa_01'], [-1.6, 0, 'mid_century_lounge_chair']].forEach(([dx, dz, id]) => {
      const px = fx + m(dx), pz = fz + m(dz);
      place(room, id, { x: px, z: pz, yaw: facing(px, pz, fx, fz), size: id === 'Sofa_01' ? 1.1 : 1 });
    });
    const r = createRug(m(4.2), m(4.0), { base: '#1d1a22', border: '#0d0b10', accent: '#c9a86a' });
    r.position.set(fx, FLOOR_Y + 0.006, fz);
    room.add(r);

    // Down the right-hand glass, the window bar, its stools to the view.
    windowBar(room, half, -m(6.5), m(7.5));
    // Two great gold dice, out on the floor at the front right.
    goldDice(room, m(6.2), m(5.2));

    // A lounge on the left, a tall palm at each end of it.
    lounge(room, half, -1, m(0.9), { sofa: 'Sofa_01', chair: 'mid_century_lounge_chair', sofaSize: 1.15, rug: { base: '#141a38', border: '#0a0d20', accent: '#c9a86a' } });
    place(room, 'Chandelier_03', { x: -(half - m(1.55)), y: CEILING_Y, z: m(0.9), size: 2.2 });
    [m(-1.6), m(3.4)].forEach((z) => place(room, 'potted_plant_02', { x: -(half - m(0.6)), z, size: 2.0 }));
    // Art on plinths flanking the sign.
    [-1, 1].forEach((side) => {
      place(room, 'side_table_tall_01', { x: side * m(2.6), z: -half + m(0.6), size: 1.1 });
      place(room, side < 0 ? 'marble_bust_01' : 'horse_statue_01', { x: side * m(2.6), y: FLOOR_Y + m(0.8), z: -half + m(0.6), size: 1.25 });
    });

    // Searchlights over the city.
    updates.push(searchlights(room, half));

    // The front half of the floor: two more conversation groups, drawn up
    // round their tables and turned toward the table and the view.
    [[-m(4.2), m(7.4)], [m(1.2), m(8.4)]].forEach(([gx, gz]) => {
      place(room, 'modern_coffee_table_01', { x: gx, z: gz });
      [[0, 1.2, 'Sofa_01'], [-1.25, -0.2, 'mid_century_lounge_chair'], [1.25, -0.2, 'mid_century_lounge_chair']].forEach(([dx, dz, id]) => {
        const px = gx + m(dx), pz = gz + m(dz);
        place(room, id, { x: px, z: pz, yaw: facing(px, pz, gx, gz), size: id === 'Sofa_01' ? 1.1 : 1 });
      });
      const gr = createRug(m(3.8), m(3.4), { base: '#141a38', border: '#0a0d20', accent: '#c9a86a' });
      gr.position.set(gx, FLOOR_Y + 0.006, gz);
      room.add(gr);
      place(room, 'Chandelier_03', { x: gx, y: CEILING_Y, z: gz, size: 2.2 });
    });
    // A grand piano by the glass at the front left, played to the room.
    grandPiano(room, -(half - m(3.4)), m(5.2), Math.PI * 0.62);
    // A tower of champagne out from the bar.
    champagneTower(room, -half + m(6.4), -half + m(4.2));
    // Walls of wine either side of the sign behind the players, and great
    // pictures in gilt beyond them.
    [-1, 1].forEach((side) => {
      const wine = createBackBar(m(3.2), { wood: 0x14101a, rgb: '216,180,110' });
      wine.position.set(side * m(3.4), 0, half - m(0.42));
      wine.rotation.y = Math.PI;
      room.add(wine);
      place(room, 'fancy_picture_frame_01', { x: side * m(7.6), y: FLOOR_Y + m(1.9), z: half - m(0.05), yaw: Math.PI, size: 2.6 });
    });
    walkway(room, { x: 10.5, back: -9.2, front: 11.0 });
    staffPosts(room, [[13, -12.5], [-13, 13.5], [7, 16.5]]);
    room.userData.update = (dt, now) => updates.forEach((u) => u(dt, now));
  },
};
