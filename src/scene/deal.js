import * as THREE from 'three';
import { createCard } from './card.js';
import { animate, easeOutCubic } from './animator.js';
import { playDealGesture } from './dealer.js';
import { DEALER } from './seats.js';

export const DECK_POSITION = DEALER.deckPosition;

// How a card is dealt. The dealer's left hand goes to the shoe and slides
// the front card out through the mouth and across the felt to the handoff
// point in front of the chip rack; the right hand takes it there, carries
// it low and sets it down in front of the player, and it is turned face up
// where it lies. Nothing is thrown. Where a seat is past a relaxed arm's
// length, the card leaves the hand and slides the last stretch along the
// cloth, as dealers do. The timings are shared with the dealer's own
// gesture (see dealer.js's playDealGesture).
export const DEAL_MS = 720;
export const DEAL_PULL = 0.2;    // left hand at the shoe's mouth
export const DEAL_PICK = 0.42;   // card at the handoff, the right hand takes it
export const DEAL_SET = 0.84;    // card set down; then it turns over
const CARRY_LIFT = 0.05;         // carried just clear of the felt

const smooth = (x) => x * x * (3 - 2 * x);

// `faceDown` keeps the dealer's hole card back-up until revealCard() turns
// it. `faceAngle` is the card's resting yaw once it lands — the receiving
// seat's angle, so it reads right-way-up to whoever is sitting there.
export function dealCard({ scene, dealer, rank, suit, to, duration = DEAL_MS, faceDown = false, faceAngle = 0 }) {
  const card = createCard(rank, suit);
  const from = DECK_POSITION.clone();
  const handoff = DEALER.handoffPosition.clone();
  // The yaw it comes out of the shoe at, along the shoe's mouth.
  const shoeYaw = DEALER.shoeYaw || 0;

  card.position.copy(from);
  card.rotation.x = Math.PI; // face down, as it comes out of the shoe
  card.rotation.y = shoeYaw;
  scene.add(card);

  if (dealer) playDealGesture(dealer, to, duration);

  animate({
    duration,
    easing: (t) => t, // phased below
    onUpdate: (t) => {
      if (t < DEAL_PULL) return; // waiting in the shoe for the hand
      if (t < DEAL_PICK) {
        // Slid out of the shoe and across, flat on the cloth.
        const k = smooth((t - DEAL_PULL) / (DEAL_PICK - DEAL_PULL));
        card.position.lerpVectors(from, handoff, k);
        return;
      }
      if (t < DEAL_SET) {
        const k = smooth((t - DEAL_PICK) / (DEAL_SET - DEAL_PICK));
        card.position.lerpVectors(handoff, to, k);
        card.position.y += Math.sin(k * Math.PI) * CARRY_LIFT;
        card.rotation.y = shoeYaw + (faceAngle - shoeYaw) * k;
        return;
      }
      card.position.copy(to);
      card.rotation.y = faceAngle;
      if (!faceDown) {
        // Turned over in place, the near edge lifting as it goes.
        const k = smooth((t - DEAL_SET) / (1 - DEAL_SET));
        card.rotation.x = Math.PI * (1 - k);
        card.position.y = to.y + Math.sin(k * Math.PI) * 0.06;
      }
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
