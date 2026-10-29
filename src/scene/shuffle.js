import * as THREE from 'three';
import { animate, easeInOutCubic } from './animator.js';
import { createCard, CARD_HEIGHT } from './card.js';
import { createCardStack, STACKED_CARD } from './props.js';
import { dealCard, DEAL_MS } from './deal.js';
import { dealerReach } from './dealer.js';
import { TABLE_BACK_Z } from './table.js';

// The shuffle, as a dealer does it between hands once the cut card has
// come out:
//
//   1. the left hand lifts what is left out of the shoe, the right hand
//      empties the discard holder, and the two stacks go down side by side
//      on the felt in front of the rack;
//   2. three riffles — the halves' inner ends lifted and let go, cards
//      falling in from each in turn into one pile, squared up, split again;
//   3. the yellow cut card pushed into the pile a deck or so from the back;
//   4. the pile loaded back into the shoe;
//   5. one card burned, straight into the discard holder.
//
// The room has already shuffled the cards themselves (roomLogic.js's
// shuffleShoe); this is the dealer doing it where everyone can see.
const RIFFLES = 3;
const RIFFLE_MS = 1100;
const RIFFLE_START = 1800;
const FLUTTER = 16;       // cards seen falling in a riffle
const CUT_START = RIFFLE_START + RIFFLES * RIFFLE_MS;
const LOAD_START = CUT_START + 600;
const BURN_START = LOAD_START + 650;
export const SHUFFLE_MS = BURN_START + 720;

// Moves `obj` to `to` after `delay`, carried with a little lift.
function carry(obj, to, ms, delay = 0, lift = 0.06) {
  setTimeout(() => {
    const from = obj.position.clone();
    animate({
      duration: ms,
      easing: easeInOutCubic,
      onUpdate: (k) => {
        obj.position.lerpVectors(from, to, k);
        obj.position.y += Math.sin(k * Math.PI) * lift;
      },
    });
  }, delay);
}

const at = (ms, fn) => setTimeout(fn, ms);

/**
 * Plays the shuffle. `shoeLeft` is how many cards are still in the shoe,
 * `total` how many it holds full, `cutAt` where the new cut card goes.
 * Returns how long it takes.
 */
export function playShoeShuffle({ scene, dealer, shoe, discard, shoeLeft, total, cutAt }) {
  const work = new THREE.Vector3(0, 0.012, TABLE_BACK_Z + 0.95);
  const apart = CARD_HEIGHT / 2 + 0.04;
  // The dealer's left half (+x) and right half.
  const leftSpot = work.clone().add(new THREE.Vector3(apart, 0, 0));
  const rightSpot = work.clone().add(new THREE.Vector3(-apart, 0, 0));
  const inShoe = shoe.localToWorld(new THREE.Vector3(0, 0.16, 0));
  const discardTop = discard.localToWorld(discard.userData.top());
  const discards = discard.userData.count();
  const half = Math.round(total / 2);

  // Stacks lie with their long side across the dealer, as a riffle is done.
  // Turned first, then tilted about the world's z for the riffle.
  const stack = (n) => {
    const s = createCardStack(n);
    s.rotation.order = 'ZYX';
    s.rotation.y = Math.PI / 2;
    scene.add(s);
    return s;
  };
  const leftHalf = stack(0);
  const rightHalf = stack(0);
  const pile = stack(0);
  pile.position.copy(work);

  // 1. Out of the shoe and the discard holder.
  at(350, () => {
    leftHalf.userData.setCount(shoeLeft);
    leftHalf.position.copy(inShoe);
    shoe.userData.setLevel(0, total);
    carry(leftHalf, leftSpot, 500);
  });
  at(800, () => {
    rightHalf.userData.setCount(discards);
    rightHalf.position.copy(discardTop);
    discard.userData.setCount(0);
    carry(rightHalf, rightSpot, 500);
  });
  // Evened up into two halves.
  at(1400, () => {
    leftHalf.userData.setCount(half);
    rightHalf.userData.setCount(total - half);
  });

  // 2. The riffles.
  const leftPath = [{ at: 350, pos: inShoe }, { at: 850, pos: leftSpot }];
  const rightPath = [{ at: 800, pos: discardTop }, { at: 1300, pos: rightSpot }];
  for (let r = 0; r < RIFFLES; r++) {
    const s = RIFFLE_START + r * RIFFLE_MS;
    const last = r === RIFFLES - 1;
    leftPath.push({ at: s + 100, pos: leftSpot }, { at: s + 800, pos: work });
    rightPath.push({ at: s + 100, pos: rightSpot }, { at: s + 800, pos: work });
    if (!last) {
      leftPath.push({ at: s + RIFFLE_MS, pos: leftSpot });
      rightPath.push({ at: s + RIFFLE_MS, pos: rightSpot });
    }

    // Inner ends lifted.
    at(s, () => {
      animate({
        duration: 150,
        onUpdate: (k) => { leftHalf.rotation.z = -0.16 * k; rightHalf.rotation.z = 0.16 * k; },
      });
    });
    // Cards falling in from each half in turn; the halves run down and the
    // pile builds as they do.
    for (let i = 0; i < FLUTTER; i++) {
      const fromLeft = i % 2 === 0;
      at(s + 150 + i * 30, () => {
        const done = (i + 1) / FLUTTER;
        leftHalf.userData.setCount(Math.round(half * (1 - done)));
        rightHalf.userData.setCount(Math.round((total - half) * (1 - done)));
        const src = fromLeft ? leftHalf : rightHalf;
        const card = createCard('A', 'S');
        card.rotation.set(Math.PI, Math.PI / 2, 0);
        const start = src.position.clone()
          .add(new THREE.Vector3(fromLeft ? -apart * 0.6 : apart * 0.6, 0.04, 0));
        card.position.copy(start);
        scene.add(card);
        const end = work.clone().setY(work.y + total * done * STACKED_CARD + 0.004);
        animate({
          duration: 170,
          onUpdate: (k) => { card.position.lerpVectors(start, end, k); },
          onComplete: () => {
            scene.remove(card);
            pile.userData.setCount(Math.round(total * done));
          },
        });
      });
    }
    // Squared up; and, but for the last, split again.
    at(s + 150 + FLUTTER * 30 + 200, () => {
      leftHalf.rotation.z = 0;
      rightHalf.rotation.z = 0;
      leftHalf.userData.setCount(0);
      rightHalf.userData.setCount(0);
      pile.userData.setCount(total);
    });
    if (!last) {
      at(s + 850, () => {
        pile.userData.setCount(0);
        leftHalf.userData.setCount(half);
        rightHalf.userData.setCount(total - half);
        leftHalf.position.copy(work);
        rightHalf.position.copy(work);
        carry(leftHalf, leftSpot, 220, 0, 0.02);
        carry(rightHalf, rightSpot, 220, 0, 0.02);
      });
    }
  }

  // 3. The cut card, pushed in from the front a deck or so up from the
  // bottom — the end that goes to the back of the shoe.
  const cutStart = CUT_START;
  const cutCard = new THREE.Mesh(
    new THREE.BoxGeometry(CARD_HEIGHT, 0.004, CARD_HEIGHT * 0.7),
    new THREE.MeshStandardMaterial({ color: 0xf2c230, roughness: 0.45, metalness: 0 })
  );
  const cutY = work.y + Math.max(cutAt, 1) * STACKED_CARD;
  at(cutStart, () => {
    cutCard.position.set(work.x, cutY, work.z + 0.45);
    scene.add(cutCard);
    carry(cutCard, new THREE.Vector3(work.x, cutY, work.z + 0.06), 320, 0, 0);
  });
  rightPath.push({ at: cutStart, pos: work.clone().add(new THREE.Vector3(0, 0, 0.45)) },
    { at: cutStart + 320, pos: work.clone().add(new THREE.Vector3(0, 0, 0.08)) });

  // 4. Into the shoe.
  const loadStart = LOAD_START;
  leftPath.push({ at: loadStart, pos: work }, { at: loadStart + 500, pos: inShoe });
  at(loadStart, () => {
    carry(pile, inShoe, 500, 0, 0.1);
    carry(cutCard, inShoe.clone().add(new THREE.Vector3(0, cutY - work.y, 0.06)), 500, 0, 0.1);
  });
  at(loadStart + 500, () => {
    scene.remove(pile, leftHalf, rightHalf, cutCard);
    cutCard.geometry.dispose();
    shoe.userData.setLevel(total, total, cutAt);
  });

  dealerReach(dealer, leftPath, { hand: 'left', returnMs: 400 });
  dealerReach(dealer, rightPath, { returnMs: 400 });

  // 5. The burn card.
  const burnStart = BURN_START;
  at(burnStart, () => {
    shoe.userData.setLevel(total - 1, total, cutAt);
    const to = discard.localToWorld(discard.userData.top());
    const card = dealCard({ scene, dealer, rank: 'A', suit: 'S', to, faceDown: true, faceAngle: discard.rotation.y });
    setTimeout(() => { scene.remove(card); discard.userData.setCount(1); }, DEAL_MS);
  });

  return SHUFFLE_MS;
}
