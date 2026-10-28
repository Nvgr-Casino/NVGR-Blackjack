import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { BRASS } from './table.js';
import { CHIP_RADIUS, CHIP_HEIGHT, createChipColumn } from './chip.js';

// A betting circle printed on the felt, in the same cream ink as the
// felt's own markings. It used to be a glowing gold torus standing proud of
// the cloth; a real one is ink, flat and matte.
export function createBetRing(radius = 0.4) {
  const geometry = new THREE.RingGeometry(radius - 0.012, radius, 64);
  const material = new THREE.MeshLambertMaterial({
    color: 0xe8dcc0,
    transparent: true,
    opacity: 0.5,
    depthWrite: false,
  });
  const ring = new THREE.Mesh(geometry, material);
  ring.rotation.x = -Math.PI / 2;
  return ring;
}

// The card shoe: a clear acrylic box with a brass top and foot, the deck's
// red backs showing through it. Plain opacity, not transmission — any
// transmissive material makes three.js render the whole scene a second
// time to refract it.
export function createCardShoe() {
  const group = new THREE.Group();
  const acrylic = new THREE.MeshStandardMaterial({
    color: 0xdfe6ea, roughness: 0.12, metalness: 0, transparent: true, opacity: 0.32, depthWrite: false,
  });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.2, 0.4), acrylic);
  body.position.y = 0.12;
  group.add(body);

  // The cards inside, seen through the acrylic.
  const cards = new THREE.Mesh(
    new THREE.BoxGeometry(0.36, 0.14, 0.3),
    new THREE.MeshStandardMaterial({ color: 0x74202c, roughness: 0.6, metalness: 0 })
  );
  cards.position.y = 0.1;
  group.add(cards);

  const top = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.02, 0.26), BRASS);
  top.position.set(0, 0.225, -0.07);
  group.add(top);
  const foot = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.025, 0.42), BRASS);
  foot.position.y = 0.0125;
  group.add(foot);

  group.rotation.x = -0.12;
  return group;
}

// The dealer's chip rack: a brass-framed tray of troughs, every one full of
// chips lying on their edges, a colour to a trough — the bank the dealer
// pays from and sweeps losing bets back into. Centred on its origin, its
// troughs running along local Z, toward the players.
const RACK_COLUMNS = 10;
const RACK_DEPTH = 0.42;
export function createChipRack() {
  const group = new THREE.Group();
  const colW = CHIP_RADIUS * 2 + 0.016;
  const width = colW * RACK_COLUMNS;

  const base = new THREE.Mesh(new THREE.BoxGeometry(width + 0.06, 0.025, RACK_DEPTH + 0.06), BRASS);
  base.position.y = 0.0125;
  base.receiveShadow = true;
  base.castShadow = true;
  group.add(base);
  const floor = new THREE.Mesh(
    new THREE.BoxGeometry(width, 0.01, RACK_DEPTH),
    new THREE.MeshStandardMaterial({ color: 0x15100c, roughness: 0.7, metalness: 0 })
  );
  floor.position.y = 0.03;
  group.add(floor);

  // Dividers and end walls, merged into one mesh.
  const parts = [];
  for (let i = 0; i <= RACK_COLUMNS; i++) {
    const g = new THREE.BoxGeometry(0.01, 0.055, RACK_DEPTH);
    g.translate(-width / 2 + i * colW, 0.05, 0);
    parts.push(g);
  }
  [-1, 1].forEach((side) => {
    const g = new THREE.BoxGeometry(width + 0.06, 0.07, 0.025);
    g.translate(0, 0.055, side * (RACK_DEPTH / 2 + 0.0125));
    parts.push(g);
  });
  const frame = new THREE.Mesh(mergeGeometries(parts), BRASS);
  frame.castShadow = true;
  group.add(frame);

  const perColumn = Math.floor((RACK_DEPTH - 0.02) / CHIP_HEIGHT);
  for (let i = 0; i < RACK_COLUMNS; i++) {
    const column = createChipColumn(perColumn, i);
    column.position.set(-width / 2 + colW * (i + 0.5), 0.035 + CHIP_RADIUS * 0.8, 0);
    group.add(column);
  }
  return group;
}
