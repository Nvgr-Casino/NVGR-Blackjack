import * as THREE from 'three';
import { createCard } from './card.js';
import { animate, easeOutCubic } from './animator.js';
import { playDealGesture } from './dealer.js';
import { DEALER } from './seats.js';

export const DECK_POSITION = DEALER.deckPosition;

// A stack of face-down cards marking the deck, purely decorative.
export function createDeckStack(count = 12) {
  const group = new THREE.Group();
  for (let i = 0; i < count; i++) {
    const card = createCard('A', 'S'); // rank/suit irrelevant, only the back shows
    card.position.copy(DECK_POSITION);
    card.position.y += 0.008 * i;
    card.rotation.x = Math.PI; // face down
    group.add(card);
  }
  return group;
}

// Slides + flips a single card from the deck to `to`, with a dealer arm
// swing (if given) timed to the deal. Pass `faceDown: true` for the
// dealer's hidden hole card — it slides into place but stays back-up until
// revealCard() flips it later. Returns the card mesh once animation starts
// (it keeps animating on its own via the shared scheduler).
// `faceAngle` is the card's resting yaw once it lands — it should match the
// receiving seat's facingAngle so the rank/suit reads right-side-up to
// whoever is sitting there, not just to a viewer facing world -Z. Defaults
// to 0 for the dealer's own cards (dealer always faces the same way).
export function dealCard({ scene, dealer, rank, suit, to, duration = 550, faceDown = false, faceAngle = 0 }) {
  const card = createCard(rank, suit);
  const from = DECK_POSITION.clone();
  const spin = Math.PI * 0.55;

  card.position.copy(from);
  card.rotation.x = Math.PI; // face down, as it leaves the deck
  card.rotation.y = faceAngle + spin;
  scene.add(card);

  if (dealer) playDealGesture(dealer, to, duration);

  animate({
    duration,
    easing: easeOutCubic,
    onUpdate: (t) => {
      card.position.lerpVectors(from, to, t);
      card.position.y += Math.sin(t * Math.PI) * 0.55; // arc while airborne
      card.rotation.x = faceDown ? Math.PI : Math.PI * (1 - t); // flips face-up on arrival, unless dealt hidden
      card.rotation.y = faceAngle + spin * (1 - t);
    },
  });

  return card;
}

// Riffles the deck stack — played when the cut card comes out and the shoe
// is replaced, so a reshuffle is something you watch happen rather than a
// line of text in the log.
//
// The stack splits in two, the halves arc apart and come back together
// interleaved, twice. The second pass is deliberately shallower than the
// first: a real riffle settles rather than repeating itself identically,
// and two identical passes read as a loop.
let shuffling = false;

export function playShuffle(deck, duration = 1500) {
  const cards = deck.children;
  if (cards.length < 2) return;
  // A second shuffle starting mid-riffle would capture the cards where they
  // are *mid-flight* as its resting position, and the stack would never
  // square up again. Shoe changes are minutes apart in a real game, so
  // ignoring an overlapping one costs nothing.
  if (shuffling) return;
  shuffling = true;

  const start = cards.map((c) => c.position.clone());
  const half = Math.ceil(cards.length / 2);
  const baseY = Math.min(...start.map((p) => p.y));

  // Where each card ends up once the two halves are woven together: the
  // bottom half takes the even slots, the top half the odd ones.
  const settled = cards.map((card, i) => {
    const slot = i < half ? i * 2 : (i - half) * 2 + 1;
    return baseY + 0.008 * Math.min(slot, cards.length - 1);
  });

  animate({
    duration,
    easing: (t) => t, // the shaping below is the easing; a second curve on top muddies it
    onUpdate: (t) => {
      // Two passes: 0→0.55 and 0.55→1.
      const pass = t < 0.55 ? t / 0.55 : (t - 0.55) / 0.45;
      const depth = t < 0.55 ? 1 : 0.55;
      // Apart at the middle of a pass, together at either end of it.
      const spread = Math.sin(pass * Math.PI) * depth;
      const smooth = Math.sin(Math.min(t, 1) * Math.PI * 0.5); // 0 → 1 across the whole shuffle

      cards.forEach((card, i) => {
        const side = i < half ? -1 : 1;
        card.position.x = start[i].x + side * 0.17 * spread;
        card.position.z = start[i].z + side * 0.03 * spread;
        card.position.y = THREE.MathUtils.lerp(start[i].y, settled[i], smooth)
          + Math.sin(pass * Math.PI) * 0.035 * depth;
        // A touch of yaw so the halves fan rather than sliding flat.
        card.rotation.y = side * 0.09 * spread;
      });
    },
    onComplete: () => {
      cards.forEach((card, i) => {
        card.position.x = start[i].x;
        card.position.z = start[i].z;
        card.position.y = settled[i];
        card.rotation.y = 0;
      });
      shuffling = false;
    },
  });
}

// Flips an already-dealt face-down card face-up in place — the dealer's
// hole-card reveal once the player's turn ends.
export function revealCard(card, duration = 400) {
  const startX = card.rotation.x;
  animate({
    duration,
    easing: easeOutCubic,
    onUpdate: (t) => {
      card.rotation.x = THREE.MathUtils.lerp(startX, 0, t);
    },
  });
}
