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
