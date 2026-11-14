import * as THREE from 'three';
import { cardSound } from './sfx.js';
import { createCard } from './card.js';
import { animate, easeOutCubic } from './animator.js';
import { playDealGesture, dealerFingertip } from './dealer.js';
import { DEALER } from './seats.js';

export const DECK_POSITION = DEALER.deckPosition;

// How a card is dealt, as a dealer at a live table does it. The left hand
// rests on the shoe throughout; the right hand goes to the shoe's mouth,
// draws the front card out flat along the felt, and carries it across,
// pinched under the fingers, to the player's spot, turning it face up as
// it is set down, and presses it flat before going back to the shoe for
// the next. The card keeps step with the hand all the way (the same points,
// the same easing as the hand's own path, dealer.js's playDealGesture).
// Where a seat is past a relaxed arm's length, the card slides the last
// stretch along the cloth from the fingers, as dealers do.
export const DEAL_MS = 820;
export const DEAL_PULL = 0.26;   // the right hand at the shoe's mouth
export const DEAL_SET = 0.8;     // the card set down at the spot
const DRAW = 0.18;               // the first part of the carry: drawn out flat
const CARRY_LIFT = 0.045;        // carried just clear of the felt
const HOLD_NEAR = 0.45;          // how near the fingers must be to carry it

const smooth = (x) => x * x * (3 - 2 * x);

// `faceDown` keeps the dealer's hole card back-up until revealCard() turns
// it. `faceAngle` is the card's resting yaw once it lands — the receiving
// seat's angle, so it reads right-way-up to whoever is sitting there.
export function dealCard({ scene, dealer, rank, suit, to, duration = DEAL_MS, faceDown = false, faceAngle = 0 }) {
  const card = createCard(rank, suit);
  const from = DECK_POSITION.clone();
  // The yaw it comes out of the shoe at, along the shoe's mouth.
  const shoeYaw = DEALER.shoeYaw || 0;

  card.position.copy(from);
  card.rotation.x = Math.PI; // face down, as it comes out of the shoe
  card.rotation.y = shoeYaw;
  scene.add(card);

  if (dealer) playDealGesture(dealer, to, duration);
  // The soft sound of it landing, as it is set down.
  cardSound(duration * DEAL_SET);

  animate({
    duration,
    easing: (t) => t, // phased below
    onUpdate: (t) => {
      if (t < DEAL_PULL) return; // waiting in the shoe for the hand
      if (t < DEAL_SET) {
        // In step with the hand: the same path, the same easing.
        const k = smooth((t - DEAL_PULL) / (DEAL_SET - DEAL_PULL));
        card.position.lerpVectors(from, to, k);
        // Held in the fingers: where the fingertips are close to the card's
        // path, the card goes with them, so hand and card move as one.
        const tip = dealer && dealerFingertip(dealer);
        if (tip) {
          const dx = tip.x - card.position.x, dz = tip.z - card.position.z;
          const off = Math.hypot(dx, dz);
          const w = off < HOLD_NEAR ? 1 - smooth(off / HOLD_NEAR) : 0;
          // Not while it is set down: the last stretch lands on its spot.
          const land = 1 - smooth(Math.max(0, (k - 0.85) / 0.15));
          card.position.x += dx * w * land;
          card.position.z += dz * w * land;
        }
        // Drawn out flat at first, then lifted just clear as it is carried.
        const carry = Math.max(0, (k - DRAW) / (1 - DRAW));
        card.position.y += Math.sin(carry * Math.PI) * CARRY_LIFT;
        card.rotation.y = shoeYaw + (faceAngle - shoeYaw) * smooth(Math.min(1, k * 1.4));
        // Turned face up in the fingers over the last of the carry, the near
        // edge rising as the wrist turns.
        if (!faceDown && k > 0.5) {
          const f = smooth((k - 0.5) / 0.5);
          card.rotation.x = Math.PI * (1 - f);
          card.position.y += Math.sin(f * Math.PI) * 0.05;
        }
        return;
      }
      card.position.copy(to);
      card.rotation.y = faceAngle;
      card.rotation.x = faceDown ? Math.PI : 0;
    },
  });

  return card;
}

// Flips an already-dealt face-down card face-up in place — the dealer's
// hole-card reveal once the player's turn ends.
export function revealCard(card, duration = 400) {
  const startX = card.rotation.x;
  const y = card.position.y;
  animate({
    duration,
    easing: easeOutCubic,
    onUpdate: (t) => {
      card.rotation.x = THREE.MathUtils.lerp(startX, 0, t);
      // Lifted on its far edge as it rolls over, and back down flat.
      card.position.y = y + Math.sin(t * Math.PI) * 0.06;
    },
    onComplete: () => { card.position.y = y; },
  });
}
