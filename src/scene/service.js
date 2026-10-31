import * as THREE from 'three';
import { createCupHolder, createDrink, disposeDrink } from './drinks.js';
import { createWaiters } from './waiters.js';
import { createChipForValue } from './chip.js';
import { animate, easeInOutCubic } from './animator.js';
import { HOLDER_RADIUS, HOLDER_RING } from './table.js';
import { ovalPoint, POKER_HOLDER_GROW, POKER_HOLDER_RING, POKER_DEALER } from './pokerTable.js';
import { SEATS, DEALER } from './seats.js';
import { m } from './scale.js';

// Service at the tables: a cup holder let into the rail at every seat, the
// drinks in them, the waiters who bring them (waiters.js), and a tip
// tossed to the dealer. Both tables have their holders; the table that is
// out shows its own (they live in its set, so they hide with it).

const ray = new THREE.Raycaster();
const DOWN = new THREE.Vector3(0, -1, 0);

// The top of `table` at (x, z), found by dropping a ray onto it.
function topAt(table, x, z) {
  table.updateMatrixWorld(true);
  ray.set(new THREE.Vector3(x, 3, z), DOWN);
  const hit = ray.intersectObject(table, true)[0];
  return hit ? hit.point.y : 0.06;
}

// On the blackjack table's rail, toward its edge, a little round to the
// player's right.
function blackjackSpot(seat) {
  const r = HOLDER_RADIUS;
  const phi = Math.atan2(seat.position.x, seat.position.z) + 0.25;
  const s = Math.sin(phi), c = Math.cos(phi);
  // The front is a half circle; past it the rail runs straight back.
  return Math.abs(phi) <= Math.PI / 2 ? new THREE.Vector3(s * r, 0, c * r) : new THREE.Vector3(Math.sign(s) * r, 0, (r * c) / Math.abs(s));
}
function pokerSpot(seat) {
  return ovalPoint(seat.theta + 0.24, POKER_HOLDER_GROW);
}

export function createService({ scene, blackjackSet, pokerSet, blackjackTable, pokerTable }) {
  const waiters = createWaiters(scene);
  const games = {
    blackjack: { set: blackjackSet, table: blackjackTable, seats: SEATS, spot: blackjackSpot, ring: HOLDER_RING, dealer: () => DEALER.position },
    holdem: { set: pokerSet, table: pokerTable, seats: null, spot: pokerSpot, ring: POKER_HOLDER_RING, dealer: () => POKER_DEALER.position },
  };
  const holders = {};

  function ensureHolders(game, seats) {
    if (holders[game]) return holders[game];
    const g = games[game];
    holders[game] = seats.map((seat) => {
      const at = g.spot(seat);
      const holder = createCupHolder(g.ring);
      holder.position.set(at.x, topAt(g.table, at.x, at.z) + 0.002, at.z);
      g.set.add(holder);
      return { holder, drink: null, type: null, seat };
    });
    return holders[game];
  }

  function show(entry, type) {
    if (entry.type === type) return;
    if (entry.drink) { entry.holder.remove(entry.drink); disposeDrink(entry.drink); }
    entry.drink = null;
    entry.type = type || null;
    if (!type) return;
    const d = createDrink(type);
    d.position.y = entry.holder.userData.seatY;
    entry.holder.add(d);
    entry.drink = d;
  }

  /** The drinks standing at a table: { seatIndex: type }, without waiters. */
  function setDrinks(game, bySeat) {
    const list = holders[game];
    if (!list) return;
    list.forEach((entry, i) => { if (!entry.pending) show(entry, bySeat[i] || null); });
  }

  /**
   * A waiter brings a `type` drink to `seatIndex` and sets it in the cup
   * holder. Until it arrives the holder keeps whatever was there.
   */
  function deliver(game, seatIndex, type) {
    const entry = (holders[game] || [])[seatIndex];
    if (!entry) return;
    entry.pending = (entry.pending || 0) + 1;
    const seat = entry.seat;
    const out = seat.outward ? seat.outward.clone() : seat.position.clone().setY(0).normalize();
    // Beside the chair on the side away from the middle, a step back.
    const side = new THREE.Vector3(-out.z, 0, out.x);
    if (side.x * seat.position.x < 0) side.negate();
    if (Math.abs(seat.position.x) < m(0.3)) side.set(1, 0, 0);
    const stop = seat.position.clone().addScaledVector(out, m(0.25)).addScaledVector(side, m(0.62));
    stop.y = 0;
    const holderWorld = entry.holder.getWorldPosition(new THREE.Vector3());
    waiters.deliver(stop, holderWorld, type, (from) => {
      const glass = createDrink(type);
      scene.add(glass);
      const to = holderWorld.clone().add(new THREE.Vector3(0, entry.holder.userData.seatY, 0));
      const start = from || to.clone().add(new THREE.Vector3(0, m(0.4), 0));
      const mid = start.clone().lerp(to, 0.5).add(new THREE.Vector3(0, m(0.12), 0));
      animate({
        duration: from ? 650 : 1,
        easing: easeInOutCubic,
        onUpdate: (t) => {
          // Over the rail in a low arc, as a hand sets it down.
          const a = start.clone().lerp(mid, t), b = mid.clone().lerp(to, t);
          glass.position.copy(a.lerp(b, t));
        },
        onComplete: () => {
          scene.remove(glass);
          disposeDrink(glass);
          entry.pending -= 1;
          entry.type = null;
          show(entry, type);
        },
      });
    });
  }

  /** A tip: a chip of `value` tossed from `seatIndex`'s place to the dealer. */
  function tip(game, seatIndex, value) {
    const entry = (holders[game] || [])[seatIndex];
    if (!entry) return;
    const g = games[game];
    const chip = createChipForValue(value, 0);
    const from = entry.holder.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0, m(0.05), 0));
    const to = g.dealer().clone().setY(0.05).add(new THREE.Vector3(0, 0, m(0.35)));
    const top = from.clone().lerp(to, 0.5).setY(m(0.5));
    scene.add(chip);
    animate({
      duration: 900,
      easing: easeInOutCubic,
      onUpdate: (t) => {
        const a = from.clone().lerp(top, t), b = top.clone().lerp(to, t);
        chip.position.copy(a.lerp(b, t));
        chip.rotation.x = t * Math.PI * 3;
      },
      onComplete: () => {
        animate({ duration: 500, onUpdate: (t) => { chip.position.y = 0.05 - t * 0.03; chip.scale.setScalar(1 - t); }, onComplete: () => scene.remove(chip) });
      },
    });
  }

  return {
    /** Readies a game's cup holders, for its seats (poker's are passed in, as scene.js builds them). */
    prepare(game, seats) { ensureHolders(game, seats || games[game].seats); },
    setDrinks,
    deliver,
    tip,
    setRoom: (room, tier) => waiters.setRoom(room, tier),
    update: (dt) => waiters.update(dt),
  };
}
