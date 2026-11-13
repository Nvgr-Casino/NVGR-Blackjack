import * as THREE from 'three';
import { createCharacter } from './character.js';
import { createCard } from './card.js';
import { seatStack, CHIP_H } from './seatChips.js';
import { SEATS } from './seats.js';
import { POKER_SEATS_3D } from './pokerTable.js';
import { ROULETTE_SEATS_3D } from './rouletteTable.js';
import { BACCARAT_SEATS_3D, betSpot as baccaratBetSpot } from './baccaratTable.js';

// The lobby carousel's players: a few guests seated at each game's table
// as it glides past, cards in front of them and chips out, so the floor
// reads as a casino in play rather than a showroom of empty chairs. They
// belong to the lobby only — scene.js shows them while the carousel is up
// and hides them the moment a real table is opened, so they never sit in a
// real player's seat.

// Who sits where: seats chosen to leave the near side of each table open
// to the camera, so the felt and the dealer stay in view.
const CAST = {
  blackjack: [[0, 'rb_bf01'], [1, 'rb_bm02'], [3, 'rb_bf03'], [4, 'rb_bm05']],
  holdem: [[0, 'rb_bm03'], [1, 'rb_bf02'], [4, 'rb_bm01'], [5, 'rb_bf04']],
  roulette: [[1, 'rb_bf04'], [3, 'rb_bm05'], [5, 'rb_bf01']],
  baccarat: [[1, 'rb_bm02'], [2, 'rb_bf03'], [5, 'rb_bm01'], [6, 'rb_bf02']],
};
const HANDS = [['K', 'S', '7', 'H'], ['A', 'D', '9', 'C'], ['Q', 'H', '8', 'S'], ['10', 'C', 'J', 'D']];

function card(rank, suit, at, yaw, faceDown, dx) {
  const mesh = createCard(rank, suit, { sharp: true });
  mesh.rotation.order = 'YXZ';
  mesh.rotation.y = yaw;
  if (faceDown) mesh.rotation.z = Math.PI;
  const side = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
  mesh.position.copy(at).addScaledVector(side, dx);
  return mesh;
}
function chips(seat, count, at) {
  const mesh = seatStack(seat, count);
  mesh.position.set(at.x, at.y + (CHIP_H * count) / 2, at.z);
  return mesh;
}

export function createLobbyCrowd(sets) {
  let groups = {};
  let built = false;
  function build() {
    built = true;
    groups = {};
    Object.entries(CAST).forEach(([game, cast]) => {
      const g = new THREE.Group();
      g.visible = false;
      sets[game].add(g);
      groups[game] = g;
      cast.forEach(([seatIndex, id], k) => {
        const seat = game === 'blackjack' ? SEATS[seatIndex] : game === 'holdem' ? POKER_SEATS_3D[seatIndex]
          : game === 'roulette' ? ROULETTE_SEATS_3D[seatIndex] : BACCARAT_SEATS_3D[seatIndex];
        const figure = createCharacter(id);
        figure.position.copy(seat.position);
        figure.rotation.y = seat.facingAngle;
        g.add(figure);
        const hand = HANDS[k % HANDS.length];
        if (game === 'blackjack') {
          // Two cards up on the felt, and the bet in the circle.
          const at = seat.handSpot.clone().setY(0.012);
          g.add(card(hand[0], hand[1], at, seat.cardAngle, false, -0.07));
          g.add(card(hand[2], hand[3], at.clone().setY(0.014), seat.cardAngle, false, 0.07));
          g.add(chips(seatIndex, 3 + k, seat.betSpot.clone().setY(0.012)));
        } else if (game === 'holdem') {
          // Two cards down, and a stack by the rail.
          const at = seat.cardSpot.clone().setY(0.012);
          g.add(card(hand[0], hand[1], at, seat.cardAngle, true, -0.06));
          g.add(card(hand[2], hand[3], at.clone().setY(0.014), seat.cardAngle, true, 0.06));
          g.add(chips(seatIndex, 6 + k * 2, seat.stackSpot));
          g.add(chips(seatIndex, 2 + k, seat.betSpot.clone().setY(0.012)));
        } else if (game === 'roulette') {
          g.add(chips(seatIndex, 8 + k * 3, seat.stackSpot));
        } else {
          g.add(chips(seatIndex, 3 + k, baccaratBetSpot(seatIndex, k % 2 ? 'player' : 'banker')));
          g.add(chips(seatIndex, 9 + k * 2, seat.stackSpot));
        }
      });
    });
  }
  // Taken down entirely when hidden, so their animation costs nothing at
  // the tables; the models stay cached, so seating them again is quick.
  function clear() {
    built = false;
    Object.entries(groups).forEach(([game, g]) => {
      g.traverse((o) => { if (o.userData && o.userData.release) o.userData.release(); });
      sets[game].remove(g);
    });
    groups = {};
  }
  return {
    /** Seats the guests, or sends them home. */
    show(on) {
      if (on && !built) build();
      else if (!on && built) clear();
      Object.values(groups).forEach((g) => { g.visible = on; });
    },
  };
}
