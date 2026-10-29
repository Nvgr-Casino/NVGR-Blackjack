import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { BRASS } from './table.js';
import { CHIP_RADIUS, CHIP_HEIGHT, createChipColumn } from './chip.js';
import { CARD_WIDTH, CARD_HEIGHT, cardBackMaterial, cardEdgeMaterial } from './card.js';

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

// How thick a card is in a stack. A dealt card is drawn thicker so it
// catches the light on the felt; stacked, that would make six decks a
// tower, so the shoe and discard holder use the real ratio — six decks come
// to the height of one card's long side, near enough as they do in life.
export const STACKED_CARD = 0.00125;

// Smoked acrylic. Plain opacity, not transmission — any transmissive
// material makes three.js render the whole scene a second time to refract
// it.
const SMOKED = new THREE.MeshStandardMaterial({
  color: 0x2a2f33, roughness: 0.15, metalness: 0, transparent: true, opacity: 0.5, depthWrite: false,
});
// The shoe's own body: deep smoked acrylic, nearly opaque, so the shoe
// reads as a shoe and not a glass box; the cards show through its clear
// faceplate.
const SHOE_BODY = new THREE.MeshStandardMaterial({
  color: 0x151b1a, roughness: 0.2, metalness: 0, transparent: true, opacity: 0.86,
});
const CLEAR = new THREE.MeshStandardMaterial({
  color: 0xdfe6ea, roughness: 0.12, metalness: 0, transparent: true, opacity: 0.28, depthWrite: false,
});
const BLACK = new THREE.MeshStandardMaterial({ color: 0x141414, roughness: 0.55, metalness: 0 });
const CUT_CARD = new THREE.MeshStandardMaterial({ color: 0xf2c230, roughness: 0.45, metalness: 0 });

// A box of stacked cards, backs on its two broad faces and white stock on
// its edges, built one unit thick so a stack's size is just its scale.
function stackMesh() {
  const back = cardBackMaterial();
  const edge = cardEdgeMaterial();
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), [edge, edge, back, back, edge, edge]);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

/**
 * A stack of face-down cards, `count` deep, lying flat: what the dealer
 * lifts out of the shoe and the discard holder to shuffle. Its origin is at
 * the bottom of the stack.
 */
export function createCardStack(count = 0) {
  const group = new THREE.Group();
  const mesh = stackMesh();
  group.add(mesh);
  group.userData.setCount = (n) => {
    const h = Math.max(n, 1) * STACKED_CARD;
    mesh.scale.set(CARD_WIDTH, h, CARD_HEIGHT);
    mesh.position.y = h / 2;
    group.visible = n > 0;
  };
  group.userData.setCount(count);
  return group;
}

// The dealing shoe. Six decks stand on edge in a long box of smoked
// acrylic, each card's long side across the box, on a floor that slopes
// down to the front, so the stack leans forward against the faceplate; a
// weighted block behind it keeps it there. The dealer slides the front
// card out through the slot under the faceplate and down the ramp. The
// yellow cut card stands in the stack where it was put after the shuffle,
// and comes out with the cards around it — the sign this is the shoe's
// last hand.
//
// Built along local x with the mouth at -x; scene.js turns it so the mouth
// faces the middle of the table.
const SHOE_LENGTH = 0.7;
const SHOE_INNER = CARD_HEIGHT + 0.02;
const FLOOR_SLOPE = 0.18;                 // rising toward the back
const FLOOR_FRONT = 0.035;
const SHOE_HEIGHT = CARD_WIDTH + 0.13;
const MOUTH_X = -SHOE_LENGTH / 2;
export function createCardShoe() {
  const group = new THREE.Group();
  const wall = 0.014;
  const w = SHOE_INNER + wall * 2;
  // Down the stack (toward the back, and up the floor), and up each card.
  const along = new THREE.Vector3(Math.cos(FLOOR_SLOPE), Math.sin(FLOOR_SLOPE), 0);
  const up = new THREE.Vector3(-Math.sin(FLOOR_SLOPE), Math.cos(FLOOR_SLOPE), 0);
  // Turns a box built with its thin side on y so that side runs `along`.
  const STAND = FLOOR_SLOPE - Math.PI / 2;
  const front = new THREE.Vector3(MOUTH_X + 0.075, FLOOR_FRONT, 0);
  const at = (depth, rise) => front.clone().addScaledVector(along, depth).addScaledVector(up, rise);

  const base = new THREE.Mesh(new THREE.BoxGeometry(SHOE_LENGTH, 0.022, w), BLACK);
  base.position.y = 0.011;
  base.castShadow = true;
  base.receiveShadow = true;
  group.add(base);
  const floorLen = SHOE_LENGTH - 0.07;
  const floor = new THREE.Mesh(new THREE.BoxGeometry(floorLen, 0.012, SHOE_INNER), BLACK);
  floor.rotation.z = FLOOR_SLOPE;
  floor.position.copy(front.clone().addScaledVector(along, floorLen / 2 - 0.02)).add(new THREE.Vector3(0, -0.008, 0));
  group.add(floor);
  [-1, 1].forEach((side) => {
    const g = new THREE.Mesh(new THREE.BoxGeometry(SHOE_LENGTH, SHOE_HEIGHT, wall), SHOE_BODY);
    g.position.set(0, 0.022 + SHOE_HEIGHT / 2, side * (SHOE_INNER / 2 + wall / 2));
    group.add(g);
    // Brass trim along the top of each side.
    const trim = new THREE.Mesh(new THREE.BoxGeometry(SHOE_LENGTH, 0.014, wall + 0.006), BRASS);
    trim.position.set(0, 0.022 + SHOE_HEIGHT, side * (SHOE_INNER / 2 + wall / 2));
    group.add(trim);
  });
  const backWall = new THREE.Mesh(new THREE.BoxGeometry(wall, SHOE_HEIGHT, w), SHOE_BODY);
  backWall.position.set(SHOE_LENGTH / 2 - wall / 2, 0.022 + SHOE_HEIGHT / 2, 0);
  group.add(backWall);
  // The faceplate, parallel to the cards, stopping a slot's height above
  // the floor; and the ramp the card comes out down.
  const SLOT = 0.022;
  const plateH = SHOE_HEIGHT - SLOT;
  const plate = new THREE.Mesh(new THREE.BoxGeometry(plateH, wall, w), SMOKED);
  plate.rotation.z = STAND;
  plate.position.copy(at(-wall, SLOT + plateH / 2));
  group.add(plate);
  const ramp = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.012, SHOE_INNER), BRASS);
  ramp.rotation.z = 0.22;
  ramp.position.set(MOUTH_X + 0.02, 0.02, 0);
  group.add(ramp);

  // The cards: one stack standing on the sloping floor.
  const cards = stackMesh();
  cards.rotation.z = STAND;
  group.add(cards);
  const block = new THREE.Mesh(new THREE.BoxGeometry(CARD_WIDTH * 0.75, 0.06, SHOE_INNER * 0.92), BRASS);
  block.rotation.z = STAND;
  block.castShadow = true;
  group.add(block);
  const cut = new THREE.Mesh(new THREE.BoxGeometry(CARD_WIDTH * 1.08, 0.004, CARD_HEIGHT * 0.98), CUT_CARD);
  cut.rotation.z = STAND;
  group.add(cut);

  /** Cards left in the shoe, how many it holds full, and where the cut card is. */
  group.userData.setLevel = (left, total = 312, cutAt = 0) => {
    const n = Math.max(0, Math.min(left, total));
    const depth = n * STACKED_CARD;
    cards.visible = n > 0;
    cards.scale.set(CARD_WIDTH, Math.max(depth, 0.0005), CARD_HEIGHT);
    cards.position.copy(at(depth / 2, CARD_WIDTH / 2));
    block.position.copy(at(depth + 0.032, CARD_WIDTH * 0.375));
    // The cut card stands `cutAt` cards from the back of the stack; once
    // that many are left it has come out, and lies on the felt beside the
    // mouth, where the whole table can see this is the last hand.
    cut.visible = n > 0 && cutAt > 0;
    if (n > cutAt) {
      cut.rotation.set(0, 0, STAND);
      cut.position.copy(at((n - cutAt) * STACKED_CARD, CARD_WIDTH * 0.54));
    } else {
      cut.rotation.set(0, 0.5, 0);
      cut.position.set(MOUTH_X - 0.02, 0.014, SHOE_INNER / 2 + 0.16);
    }
  };
  group.userData.setLevel(0);

  // Wood grain doesn't reach the shoe; it should not cast its own odd
  // shadows through transparent walls either.
  group.traverse((o) => { if (o.isMesh && o.material && o.material.transparent) o.castShadow = false; });
  return group;
}

// Where a card leaves the shoe: at the foot of the ramp, in the shoe's own
// frame.
export const SHOE_MOUTH = new THREE.Vector3(MOUTH_X - 0.04, 0.012, 0);

// The discard holder: an open clear box on the dealer's right that every
// used card goes into, face down, as it is picked up from the table. It
// fills through the shoe, and is emptied back into the shuffle.
export function createDiscardHolder() {
  const group = new THREE.Group();
  const wall = 0.012;
  const innerW = CARD_WIDTH + 0.03;
  const innerD = CARD_HEIGHT + 0.03;
  const h = 312 * STACKED_CARD * 0.9;
  const base = new THREE.Mesh(new THREE.BoxGeometry(innerW + wall * 2, 0.018, innerD + wall * 2), BLACK);
  base.position.y = 0.009;
  base.receiveShadow = true;
  group.add(base);
  [
    [innerW + wall * 2, wall, 0, innerD / 2 + wall / 2],
    [innerW + wall * 2, wall, 0, -innerD / 2 - wall / 2],
    [wall, innerD, innerW / 2 + wall / 2, 0],
    [wall, innerD, -innerW / 2 - wall / 2, 0],
  ].forEach(([sx, sz, x, z]) => {
    const g = new THREE.Mesh(new THREE.BoxGeometry(sx, h, sz), CLEAR);
    g.position.set(x, 0.018 + h / 2, z);
    group.add(g);
  });
  const stack = createCardStack(0);
  stack.position.y = 0.018;
  group.add(stack);
  let count = 0;
  group.userData.setCount = (n) => { count = Math.max(0, n); stack.userData.setCount(count); };
  group.userData.count = () => count;
  // The top of the pile, where the next card lands, in the holder's frame.
  group.userData.top = () => new THREE.Vector3(0, 0.018 + count * STACKED_CARD + 0.004, 0);
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
