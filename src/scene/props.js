import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { BRASS } from './table.js';
import { CHIP_RADIUS, CHIP_HEIGHT, createChipColumn } from './chip.js';
import { CARD_WIDTH, CARD_HEIGHT, cardBackMaterial, cardEdgeMaterial } from './card.js';

// How thick a card is in a stack. A dealt card is drawn thicker so it
// catches the light on the felt; stacked, that would make six decks a
// tower, so the shoe and discard holder use the real ratio — six decks come
// to the height of one card's long side, near enough as they do in life.
export const STACKED_CARD = 0.00125;

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
//
// Its look is the modern clear shoe of a card room: a low wedge of clear
// acrylic, tall at the back and sloping down to the mouth, on a thin white
// base, its edges picked out in white, so the cards and the yellow cut card
// show through and it sits on the felt lightly. (It was a dark box with
// brass trim and a crest plate: the heaviest thing on the table.)
const SHOE_LENGTH = 0.62;
const SHOE_INNER = CARD_HEIGHT + 0.012;
// The cards lean back, their tops away from the mouth, as in a card-room
// shoe: so the floor they stand on falls toward the back, from a little
// above the base at the front.
const FLOOR_SLOPE = -0.35;
const FLOOR_LEN = 0.34;
const FLOOR_FRONT = 0.014 + FLOOR_LEN * Math.sin(-FLOOR_SLOPE);
const BACK_H = FLOOR_FRONT + CARD_WIDTH * 0.97;  // the wedge, tall at the back...
const FRONT_H = CARD_WIDTH * 0.42;        // ...and low at the mouth
const MOUTH_X = -SHOE_LENGTH / 2;
const WHITE_ACRYLIC = new THREE.MeshStandardMaterial({ color: 0xf2f4f3, roughness: 0.28, metalness: 0 });
// Clear acrylic. Plain opacity, not transmission: any transmissive material
// makes three.js render the whole scene a second time to refract it.
const GLASS = new THREE.MeshStandardMaterial({
  color: 0xe8f0f4, roughness: 0.06, metalness: 0, transparent: true, opacity: 0.22, depthWrite: false,
});
export function createCardShoe() {
  const group = new THREE.Group();
  const wall = 0.008;
  const w = SHOE_INNER + wall * 2;
  // Down the stack (toward the back, and down the floor), and up each card.
  const along = new THREE.Vector3(Math.cos(FLOOR_SLOPE), Math.sin(FLOOR_SLOPE), 0);
  const up = new THREE.Vector3(-Math.sin(FLOOR_SLOPE), Math.cos(FLOOR_SLOPE), 0);
  // Turns a box built with its thin side on y so that side runs `along`.
  const STAND = FLOOR_SLOPE - Math.PI / 2;
  const front = new THREE.Vector3(MOUTH_X + 0.06, FLOOR_FRONT, 0);
  const at = (depth, rise) => front.clone().addScaledVector(along, depth).addScaledVector(up, rise);

  const base = new THREE.Mesh(new THREE.BoxGeometry(SHOE_LENGTH, 0.012, w + 0.01), WHITE_ACRYLIC);
  base.position.y = 0.006;
  base.castShadow = true;
  base.receiveShadow = true;
  group.add(base);
  const floor = new THREE.Mesh(new THREE.BoxGeometry(FLOOR_LEN, 0.008, SHOE_INNER), WHITE_ACRYLIC);
  floor.rotation.z = FLOOR_SLOPE;
  floor.position.copy(front.clone().addScaledVector(along, FLOOR_LEN / 2 - 0.02)).add(new THREE.Vector3(0, -0.006, 0));
  group.add(floor);
  // A riser under the floor's front edge, so it does not float.
  const riser = new THREE.Mesh(new THREE.BoxGeometry(0.01, FLOOR_FRONT, SHOE_INNER), WHITE_ACRYLIC);
  riser.position.set(front.x - 0.02, FLOOR_FRONT / 2, 0);
  group.add(riser);
  // The two sides: clear wedges, their sloping top edge and back edge in
  // white.
  const backX = SHOE_LENGTH / 2;
  const profile = new THREE.Shape();
  profile.moveTo(MOUTH_X, 0.012);
  profile.lineTo(backX, 0.012);
  profile.lineTo(backX, BACK_H);
  profile.lineTo(MOUTH_X + 0.05, FRONT_H);
  profile.lineTo(MOUTH_X, FRONT_H * 0.72);
  profile.closePath();
  const sideGeo = new THREE.ExtrudeGeometry(profile, { depth: wall, bevelEnabled: false });
  const topLen = Math.hypot(backX - (MOUTH_X + 0.05), BACK_H - FRONT_H);
  const topAngle = Math.atan2(BACK_H - FRONT_H, backX - (MOUTH_X + 0.05));
  [-1, 1].forEach((side) => {
    const g = new THREE.Mesh(sideGeo, GLASS);
    g.position.z = side > 0 ? SHOE_INNER / 2 : -SHOE_INNER / 2 - wall;
    group.add(g);
    const edge = new THREE.Mesh(new THREE.BoxGeometry(topLen, 0.007, wall + 0.003), WHITE_ACRYLIC);
    edge.rotation.z = topAngle;
    edge.position.set((backX + MOUTH_X + 0.05) / 2, (BACK_H + FRONT_H) / 2, side * (SHOE_INNER / 2 + wall / 2));
    group.add(edge);
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.007, BACK_H - 0.012, wall + 0.003), WHITE_ACRYLIC);
    post.position.set(backX - 0.0035, 0.012 + (BACK_H - 0.012) / 2, side * (SHOE_INNER / 2 + wall / 2));
    group.add(post);
  });
  const backWall = new THREE.Mesh(new THREE.BoxGeometry(wall, BACK_H - 0.012, w), GLASS);
  backWall.position.set(backX - wall / 2, 0.012 + (BACK_H - 0.012) / 2, 0);
  group.add(backWall);
  // The faceplate, parallel to the cards, stopping a slot's height above
  // the floor; and the ramp the card comes out down.
  const SLOT = 0.018;
  const plateH = FRONT_H * 1.25;
  const plate = new THREE.Mesh(new THREE.BoxGeometry(plateH, wall, w), GLASS);
  plate.rotation.z = STAND;
  plate.position.copy(at(-wall, SLOT + plateH / 2));
  group.add(plate);
  const ramp = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.008, SHOE_INNER), WHITE_ACRYLIC);
  ramp.rotation.z = 0.22;
  ramp.position.set(MOUTH_X + 0.018, 0.014, 0);
  group.add(ramp);

  // The cards: one stack standing on the sloping floor.
  const cards = stackMesh();
  cards.rotation.z = STAND;
  group.add(cards);
  const block = new THREE.Mesh(new THREE.BoxGeometry(CARD_WIDTH * 0.75, 0.05, SHOE_INNER * 0.92), WHITE_ACRYLIC);
  block.rotation.z = STAND;
  block.castShadow = true;
  group.add(block);
  const cut = new THREE.Mesh(new THREE.BoxGeometry(CARD_WIDTH * 1.08, 0.004, CARD_HEIGHT * 0.98), CUT_CARD);
  cut.rotation.z = STAND;
  group.add(cut);

  /** Cards left in the shoe, how many it holds full, and where the cut card is. */
  group.userData.setLevel = (left, total = 312, cutAt = 0) => {
    const n = Math.max(0, Math.min(left, total));
    // Drawn at about half the real depth: six decks of cards at the size
    // the table draws them stood as a block taller than the shoe.
    const depth = n * STACKED_CARD * 0.5;
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
      cut.position.copy(at((n - cutAt) * STACKED_CARD * 0.5, CARD_WIDTH * 0.54));
    } else {
      cut.rotation.set(0, 0.5, 0);
      cut.position.set(MOUTH_X - 0.02, 0.014, SHOE_INNER / 2 + 0.16);
    }
  };
  group.userData.setLevel(0);
  // A little under the cards' own scale, so it sits on the felt as neatly
  // as a real shoe beside cards drawn larger than life.
  group.scale.setScalar(0.8);

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
