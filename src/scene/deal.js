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

// How a card is dealt: the dealer's hand goes to the shoe and takes it,
// carries it low across the felt and sets it down in front of the player,
// then turns it face up where it lies. Nothing is thrown. Where a seat is
// past a relaxed arm's length, the card leaves the hand and slides the
// last stretch along the cloth, as dealers do. The timings are shared with
// the dealer's own gesture (see dealer.js's playDealGesture).
export const DEAL_MS = 650;
export const DEAL_PICK = 0.34;   // hand reaches the shoe
export const DEAL_SET = 0.84;    // card set down; then it turns over
const CARRY_LIFT = 0.05;         // carried just clear of the felt

const smooth = (x) => x * x * (3 - 2 * x);

// `faceDown` keeps the dealer's hole card back-up until revealCard() turns
// it. `faceAngle` is the card's resting yaw once it lands — the receiving
// seat's angle, so it reads right-way-up to whoever is sitting there.
export function dealCard({ scene, dealer, rank, suit, to, duration = DEAL_MS, faceDown = false, faceAngle = 0 }) {
  const card = createCard(rank, suit);
  const from = DECK_POSITION.clone();
  const turn = Math.PI * 0.5;

  card.position.copy(from);
  card.rotation.x = Math.PI; // face down, as it comes out of the shoe
  card.rotation.y = faceAngle + turn;
  scene.add(card);

  if (dealer) playDealGesture(dealer, to, duration);

  animate({
    duration,
    easing: (t) => t, // phased below
    onUpdate: (t) => {
      if (t < DEAL_PICK) return; // waiting in the shoe for the hand
      if (t < DEAL_SET) {
        const k = smooth((t - DEAL_PICK) / (DEAL_SET - DEAL_PICK));
        card.position.lerpVectors(from, to, k);
        card.position.y += Math.sin(k * Math.PI) * CARRY_LIFT;
        card.rotation.y = faceAngle + turn * (1 - k);
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
