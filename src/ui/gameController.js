import * as THREE from 'three';
import { dealCard, revealCard, playShuffle } from '../scene/deal.js';
import { CARD_WIDTH, CARD_HEIGHT } from '../scene/card.js';
import { createChip, createChipForValue, createChipStack, CHIP_HEIGHT, DENOMINATIONS } from '../scene/chip.js';
import { CHANNEL_RADIUS, CHANNEL_Y } from '../scene/table.js';
import { createCharacter, playerReach, playerHandPosition } from '../scene/character.js';
import { dealerReach } from '../scene/dealer.js';
import { cameraOverride } from '../scene/cameraFocus.js';
import { createHandBadge } from '../scene/handBadge.js';
import { SEATS, DEALER, cameraPositionForSeat, cameraLookAtForSeat, isTallScreen } from '../scene/seats.js';
import { animate, easeOutCubic, easeInOutCubic } from '../scene/animator.js';
import { m, SEAT_TOP_Y } from '../scene/scale.js';

// Pure 3D/visual driver for the table — no DOM, no game rules. It knows how
// to put a card/chip/badge somewhere on the felt for a given seat index and
// how to move the camera; it has no idea whether that seat is "mine", a
// stranger's, or empty. src/app/table3dBridge.js is the thing that watches
// the real Firebase room and calls these primitives; this file used to also
// own the local single-player Round.js state and all the HTML controls —
// both moved out once the game went from local-only to a real shared table.

const CARD_GAP = CARD_WIDTH * 1.3;
const MIN_CARD_GAP = CARD_WIDTH * 0.35;
const SPLIT_HAND_GAP = CARD_GAP * 1.7;

function gapForHand(count, fanMaxWidth) {
  if (count <= 1) return CARD_GAP;
  return Math.max(MIN_CARD_GAP, Math.min(CARD_GAP, fanMaxWidth / count));
}

function cardSlot(anchor, facingAngle, index, gap = CARD_GAP) {
  const localX = (index - 0.5) * gap;
  const cos = Math.cos(facingAngle);
  const sin = Math.sin(facingAngle);
  return new THREE.Vector3(anchor.x + localX * cos, anchor.y, anchor.z - localX * sin);
}

function refanExisting(meshes, anchor, facingAngle, gap) {
  meshes.forEach((mesh, i) => {
    const start = mesh.position.clone();
    const target = cardSlot(anchor, facingAngle, i, gap);
    if (start.distanceToSquared(target) < 0.0001) return;
    animate({
      duration: 220,
      easing: easeOutCubic,
      onUpdate: (t) => mesh.position.lerpVectors(start, target, t),
    });
  });
}

function seatOutwardDir(seat) {
  return seat.position.clone().setY(0).normalize();
}

function handAnchor(seat, handIndex, handCount) {
  if (handCount <= 1) return seat.handSpot.clone();
  const cos = Math.cos(seat.facingAngle);
  const sin = Math.sin(seat.facingAngle);
  const localX = (handIndex - (handCount - 1) / 2) * SPLIT_HAND_GAP;
  return new THREE.Vector3(seat.handSpot.x + localX * cos, seat.handSpot.y, seat.handSpot.z - localX * sin);
}

export function createTableDriver({ scene, camera, controls, dealer, deck, chairsBySeat }) {
  // Indexed by seat: yourMeshes[seatIndex][handIndex] = [cardMesh, ...]
  const seatMeshes = [];
  const seatBadges = [];
  const betChipMeshes = [];
  const pendingStack = [];
  const dealerMeshes = [];
  // Where the camera sits. Seat 3 is only the opening guess, used until the
  // room tells us which seat is actually yours — see followSeat.
  let viewSeatIndex = 2;
  // False until the room has placed the camera in the player's own chair
  // once; see followSeat.
  let seatFollowed = false;

  // Hand totals sit on the felt just beyond the cards, on the dealer's side
  // of them — directly above the hand as you look at it. Hovering high over
  // the hand, perspective pulled them up the screen and onto other hands.
  const BADGE_Y = 0.1;
  const BADGE_BEYOND = CARD_HEIGHT * 0.95;
  const dealerBadge = createHandBadge();
  dealerBadge.sprite.position.set(DEALER.handSpot.x, BADGE_Y, DEALER.handSpot.z - BADGE_BEYOND);
  scene.add(dealerBadge.sprite);

  function ensureSeat(seatIndex) {
    if (!seatMeshes[seatIndex]) seatMeshes[seatIndex] = [[]];
    if (!seatBadges[seatIndex]) seatBadges[seatIndex] = [];
    if (!betChipMeshes[seatIndex]) betChipMeshes[seatIndex] = [];
    if (pendingStack[seatIndex] === undefined) pendingStack[seatIndex] = 0;
  }


  // ---------- seated characters ----------
  // One figure per occupied seat, your own included. Hiding your whole
  // figure once left a hole at the table where you were sitting, whichever
  // way the camera turned; only the head is held back, and only while the
  // camera is right behind it (below).
  const seatCharacters = new Map(); // seatIndex -> { id, group }

  // A seated player's own chips, in the rim's channel in front of their
  // place, as at a real table. Where their bets come from and their
  // winnings go back to.
  const stashes = new Map(); // seatIndex -> group
  function channelPoint(seat, offsetDeg = 0) {
    const a = Math.atan2(seat.position.x, seat.position.z) + THREE.MathUtils.degToRad(offsetDeg);
    return new THREE.Vector3(Math.sin(a) * CHANNEL_RADIUS, CHANNEL_Y, Math.cos(a) * CHANNEL_RADIUS);
  }
  function placeStash(seatIndex) {
    if (stashes.has(seatIndex)) return;
    const seat = SEATS[seatIndex];
    const group = new THREE.Group();
    [[-4.5, 6, 0], [-1.5, 9, 1], [1.5, 4, 2]].forEach(([deg, count, color]) => {
      const stack = createChipStack(count, color);
      stack.position.copy(channelPoint(seat, deg));
      group.add(stack);
    });
    scene.add(group);
    stashes.set(seatIndex, group);
  }
  function removeStash(seatIndex) {
    const group = stashes.get(seatIndex);
    if (group) scene.remove(group);
    stashes.delete(seatIndex);
  }

  // A seated figure leans in over the felt, so from some views your own head
  // sits squarely between the camera and your own cards. Then your figure is
  // not drawn — the whole figure, never a body without its head, which is
  // what the first version of this left you looking at. From every other
  // view it is: the seat-1 view, swung in toward the middle of the table,
  // has your own figure in the corner of the picture, and it should be
  // whole. The same goes for anyone else's head in that line, or a figure
  // the camera is right inside.
  const HEAD_CLEARANCE = m(0.35);
  const OCCLUDE_RADIUS = m(0.2);
  const headPoint = new THREE.Vector3();
  const segment = new THREE.Line3();
  const nearest = new THREE.Vector3();
  const priorBeforeRender = scene.onBeforeRender;
  scene.onBeforeRender = (...args) => {
    seatCharacters.forEach(({ group }, seatIndex) => {
      const model = group.children[0];
      if (!model) return;
      const seat = SEATS[seatIndex];
      const inward = seatOutwardDir(seat).multiplyScalar(-m(0.2));
      headPoint.copy(seat.position).add(inward).setY(SEAT_TOP_Y + m(0.72));
      let hidden = camera.position.distanceTo(headPoint) < HEAD_CLEARANCE;
      // Any head squarely between the camera and your own cards.
      if (!hidden) {
        segment.set(camera.position, SEATS[viewSeatIndex].handSpot);
        segment.closestPointToPoint(headPoint, true, nearest);
        hidden = nearest.distanceTo(headPoint) < OCCLUDE_RADIUS;
      }
      model.visible = !hidden;
    });
    priorBeforeRender.apply(scene, args);
  };

  function applySeatCharacter(seatIndex, characterId) {
    const existing = seatCharacters.get(seatIndex);
    if (existing && existing.id === characterId) {
      existing.group.visible = true;
      return;
    }
    if (existing) releaseFigure(existing.group);
    if (!characterId) { seatCharacters.delete(seatIndex); return; }

    const seat = SEATS[seatIndex];
    if (!seat) return;
    placeStash(seatIndex);
    const group = createCharacter(characterId);
    group.position.copy(seat.position);
    group.rotation.y = seat.facingAngle;
    scene.add(group);
    seatCharacters.set(seatIndex, { id: characterId, group });
  }

  function releaseFigure(group) {
    scene.remove(group);
    if (group.userData.release) group.userData.release();
  }

  function clearSeatCharacter(seatIndex) {
    const existing = seatCharacters.get(seatIndex);
    if (!existing) return;
    releaseFigure(existing.group);
    seatCharacters.delete(seatIndex);
    removeStash(seatIndex);
  }

  // ---------- camera / seat viewpoint ----------
  // Every seat's camera sits on one circle around the table's look-at
  // point, so a move between two of them is a change of angle. Interpolating
  // the angle sweeps the view around the table; interpolating the positions
  // directly would cut the chord between them and, for seats on opposite
  // sides, drive the camera straight through the table.
  function glideTo(destination, lookAt, duration) {
    const from = camera.position.clone();
    const fromLook = controls.target.clone();
    // Every seat's camera sits on one circle about the table's centre, so
    // the sweep is around that centre — not around the look-at point, which
    // is itself moving.
    const a0 = Math.atan2(from.x, from.z);
    const a1 = Math.atan2(destination.x, destination.z);
    let sweep = a1 - a0;
    while (sweep > Math.PI) sweep -= Math.PI * 2;
    while (sweep < -Math.PI) sweep += Math.PI * 2;
    const r0 = Math.hypot(from.x, from.z);
    const r1 = Math.hypot(destination.x, destination.z);
    const look = fromLook.clone();

    cameraOverride.active = true;
    animate({
      duration,
      easing: easeInOutCubic,
      onUpdate: (t) => {
        const angle = a0 + sweep * t;
        const radius = r0 + (r1 - r0) * t;
        camera.position.set(
          Math.sin(angle) * radius,
          from.y + (destination.y - from.y) * t,
          Math.cos(angle) * radius
        );
        look.lerpVectors(fromLook, lookAt, t);
        camera.lookAt(look);
      },
      onComplete: () => {
        camera.position.copy(destination);
        controls.target.copy(lookAt);
        camera.lookAt(lookAt);
        // OrbitControls re-derives its orbit from wherever the camera
        // actually is on the next update, so handing control back here needs
        // no resync — it simply picks up from the new seat.
        cameraOverride.active = false;
      },
    });
  }

  function setViewSeat(seatIndex, { animated = true } = {}) {
    if (seatIndex === viewSeatIndex) return;
    viewSeatIndex = seatIndex;

    const destination = cameraPositionForSeat(SEATS[viewSeatIndex]);
    const lookAt = cameraLookAtForSeat(SEATS[viewSeatIndex]);
    if (animated) {
      glideTo(destination, lookAt, 620);
    } else {
      camera.position.copy(destination);
      camera.lookAt(lookAt);
      controls.target.copy(lookAt);
    }
  }

  // Puts the camera in the chair the player is actually sitting in, and
  // keeps it there when they move. The first move of a session is a snap
  // rather than a sweep: on joining there is no previous seat to travel
  // from, and gliding in from the default view reads as a glitch.
  function followSeat(seatIndex) {
    if (seatIndex === null || seatIndex === undefined || seatIndex < 0) return;
    setViewSeat(seatIndex, { animated: seatFollowed });
    seatFollowed = true;
  }

  function releaseViewSeat() { seatFollowed = false; }

  // Turning a phone, or resizing a window past square, changes which seat
  // view fits the screen (see seats.js), so the camera snaps to the new one.
  // Only on that change: a resize within the same shape keeps wherever you
  // have dragged the view to.
  let wasTall = isTallScreen();
  window.addEventListener('resize', () => {
    const tall = isTallScreen();
    if (tall === wasTall || cameraOverride.active) return;
    wasTall = tall;
    const seat = SEATS[viewSeatIndex];
    const lookAt = cameraLookAtForSeat(seat);
    camera.position.copy(cameraPositionForSeat(seat));
    camera.lookAt(lookAt);
    controls.target.copy(lookAt);
  });


  // ---------- cards ----------
  function dealCardToSeat(seatIndex, handIndex, cardIndex, card, handCount, opts = {}) {
    ensureSeat(seatIndex);
    const seat = SEATS[seatIndex];
    const anchor = handAnchor(seat, handIndex, handCount);
    if (!seatMeshes[seatIndex][handIndex]) seatMeshes[seatIndex][handIndex] = [];
    const existing = seatMeshes[seatIndex][handIndex];

    const fanMaxWidth = handCount > 1 ? 0.9 : 1.58;
    const gap = gapForHand(cardIndex + 1, fanMaxWidth);
    refanExisting(existing, anchor, seat.facingAngle, gap);

    const to = cardSlot(anchor, seat.facingAngle, cardIndex, gap);
    const mesh = dealCard({ scene, dealer, rank: card.rank, suit: card.suit, to, faceAngle: seat.cardAngle, ...opts });
    existing.push(mesh);
    return mesh;
  }

  function dealDealerCard(index, card, opts = {}) {
    const gap = gapForHand(index + 1, 1.58);
    refanExisting(dealerMeshes, DEALER.handSpot, DEALER.facingAngle, gap);
    const to = cardSlot(DEALER.handSpot, DEALER.facingAngle, index, gap);
    const mesh = dealCard({ scene, dealer, rank: card.rank, suit: card.suit, to, faceAngle: DEALER.facingAngle, ...opts });
    dealerMeshes.push(mesh);
    return mesh;
  }

  function revealDealerCard(index) {
    if (dealerMeshes[index]) revealCard(dealerMeshes[index]);
  }

  function slideCard(mesh, to, duration = 280) {
    const start = mesh.position.clone();
    animate({ duration, easing: easeOutCubic, onUpdate: (t) => mesh.position.lerpVectors(start, to, t) });
  }

  // Splits the existing 2-card hand at (seatIndex, handIndex) in place — the
  // second card physically slides to become the new hand's first card,
  // matching the original "the dealer separates your pair" animation.
  function splitSeatHand(seatIndex, handIndex, newHandCount) {
    ensureSeat(seatIndex);
    const seat = SEATS[seatIndex];
    const meshes = seatMeshes[seatIndex][handIndex] || [];
    const [keptMesh, movedMesh] = meshes;
    if (!keptMesh || !movedMesh) return;
    const anchor0 = handAnchor(seat, handIndex, newHandCount);
    const anchor1 = handAnchor(seat, handIndex + 1, newHandCount);
    slideCard(keptMesh, cardSlot(anchor0, seat.facingAngle, 0));
    slideCard(movedMesh, cardSlot(anchor1, seat.facingAngle, 0));
    seatMeshes[seatIndex][handIndex] = [keptMesh];
    seatMeshes[seatIndex].splice(handIndex + 1, 0, [movedMesh]);
  }

  function clearAllMeshes() {
    seatMeshes.forEach((hands) => hands && hands.forEach((h) => h && h.forEach((m) => scene.remove(m))));
    seatMeshes.length = 0;
    dealerMeshes.forEach((m) => scene.remove(m));
    dealerMeshes.length = 0;
    seatBadges.forEach((hands) => hands && hands.forEach((b) => b && b.hide()));
    dealerBadge.hide();
  }

  // ---------- hand-value badges ----------
  function setSeatBadge(seatIndex, handIndex, handCount, valueText) {
    ensureSeat(seatIndex);
    const seat = SEATS[seatIndex];
    if (!seatBadges[seatIndex][handIndex]) {
      const badge = createHandBadge(0.2);
      scene.add(badge.sprite);
      seatBadges[seatIndex][handIndex] = badge;
    }
    const badge = seatBadges[seatIndex][handIndex];
    const anchor = handAnchor(seat, handIndex, handCount);
    const inward = seatOutwardDir(seat).multiplyScalar(-BADGE_BEYOND);
    badge.sprite.position.set(anchor.x + inward.x, BADGE_Y, anchor.z + inward.z);
    badge.setValue(valueText);
  }
  function hideSeatBadges(seatIndex) {
    (seatBadges[seatIndex] || []).forEach((b) => b && b.hide());
  }
  function setDealerBadge(valueText) { dealerBadge.setValue(valueText); }
  function hideDealerBadge() { dealerBadge.hide(); }

  // ---------- chips, moved by hand ----------
  // Every chip on the table is put there by somebody's hand. A player
  // carries their bet out to their circle; the dealer sweeps a losing bet
  // back to the rack, or takes a stack from the rack and sets it beside a
  // winning one; then the winner draws it all back to their own place.
  // Chips used to be tossed through the air, from nobody, to and from the
  // dealer's chest.
  //
  // The dealer settles one seat at a time, from their right round to their
  // left — the reverse of the deal — as a real one does; dealerTask queues
  // each settlement behind the last.
  let dealerFreeAt = 0;
  function dealerTask(durationMs, run) {
    const now = performance.now();
    const wait = Math.max(0, dealerFreeAt - now);
    dealerFreeAt = now + wait + durationMs;
    setTimeout(run, wait);
  }

  // Slides a chip to `to` after `delay` ms, kept low over the felt with
  // only a small lift — carried, not thrown.
  function slideChip(mesh, to, delay, duration, lift = 0.06) {
    setTimeout(() => {
      const from = mesh.position.clone();
      animate({
        duration,
        easing: easeInOutCubic,
        onUpdate: (t) => {
          mesh.position.lerpVectors(from, to, t);
          mesh.position.y += Math.sin(t * Math.PI) * lift;
        },
      });
    }, delay);
  }

  const stackHeight = (n) => CHIP_HEIGHT * n + CHIP_HEIGHT / 2;
  const seatFigure = (seatIndex) => {
    const entry = seatCharacters.get(seatIndex);
    return entry ? entry.group : null;
  };

  // `value`, when given, spawns a chip labeled/colored for that exact
  // bet-ladder amount (see chip.js's LADDER_COLORS) instead of one of the
  // 4 fixed on-table denominations — used both for the local player's own
  // tap-to-bet chips and for showing another seat's already-confirmed bet.
  const PLACE_MS = 380;
  function addBetChipVisual(seatIndex, colorIndex, value) {
    ensureSeat(seatIndex);
    const seat = SEATS[seatIndex];
    const chip = value != null ? createChipForValue(value, colorIndex) : createChip(colorIndex);
    const to = seat.betSpot.clone().setY(stackHeight(pendingStack[seatIndex]));
    pendingStack[seatIndex]++;

    // From the player's own hand, which goes out to the circle with it.
    const figure = seatFigure(seatIndex);
    const hand = playerHandPosition(figure);
    const from = hand || channelPoint(seat).setY(0.1);
    if (hand) playerReach(figure, [{ at: PLACE_MS, pos: to.clone().setY(to.y + 0.08) }], { returnMs: 380 });

    chip.position.copy(from);
    scene.add(chip);
    betChipMeshes[seatIndex].push(chip);
    slideChip(chip, to, 0, PLACE_MS, 0.12);
    return chip;
  }

  function clearBetChipsForSeat(seatIndex) {
    ensureSeat(seatIndex);
    betChipMeshes[seatIndex].forEach((m) => scene.remove(m));
    betChipMeshes[seatIndex].length = 0;
    pendingStack[seatIndex] = 0;
  }

  // The dealer reaches out to a losing bet and sweeps it back to the rack.
  const REACH_OUT_MS = 360;
  const SWEEP_MS = 460;
  function collectBetChipsForSeat(seatIndex) {
    ensureSeat(seatIndex);
    const seat = SEATS[seatIndex];
    const meshes = betChipMeshes[seatIndex].splice(0, betChipMeshes[seatIndex].length);
    pendingStack[seatIndex] = 0;
    dealerTask(REACH_OUT_MS + SWEEP_MS + 200, () => {
      const rack = DEALER.trayPosition.clone().setY(0.08);
      dealerReach(dealer, [
        { at: REACH_OUT_MS, pos: seat.betSpot },
        { at: REACH_OUT_MS + SWEEP_MS, pos: rack },
      ]);
      meshes.forEach((mesh, i) => {
        slideChip(mesh, rack.clone().setY(stackHeight(i)), REACH_OUT_MS, SWEEP_MS, 0.04);
        setTimeout(() => scene.remove(mesh), REACH_OUT_MS + SWEEP_MS + 60);
      });
    });
  }

  // Where a payout is set down: beside the bet, on the dealer's side of it.
  function payoutSpot(seat) {
    const dir = seatOutwardDir(seat);
    const across = new THREE.Vector3(dir.z, 0, -dir.x);
    return seat.betSpot.clone().addScaledVector(across, 0.3).addScaledVector(dir, -0.12);
  }

  // The dealer takes a stack from the rack and sets it beside a winning bet;
  // the player then draws bet and winnings back to their place.
  const TAKE_MS = 300;
  const CARRY_MS = 480;
  function payoutChipsForSeat(seatIndex, count) {
    ensureSeat(seatIndex);
    const seat = SEATS[seatIndex];
    dealerTask(TAKE_MS + CARRY_MS + 200, () => {
      const rack = DEALER.trayPosition.clone().setY(0.08);
      const spot = payoutSpot(seat);
      dealerReach(dealer, [
        { at: TAKE_MS, pos: rack },
        { at: TAKE_MS + CARRY_MS, pos: spot },
      ]);
      const paid = [];
      setTimeout(() => {
        for (let i = 0; i < count; i++) {
          const chip = createChip(i % DENOMINATIONS.length);
          chip.position.copy(rack).setY(stackHeight(i));
          scene.add(chip);
          paid.push(chip);
          betChipMeshes[seatIndex].push(chip);
          slideChip(chip, spot.clone().setY(stackHeight(i)), 0, CARRY_MS, 0.1);
        }
      }, TAKE_MS);
      setTimeout(() => drawChipsHome(seatIndex), TAKE_MS + CARRY_MS + 650);
    });
  }

  // The player reaches out and draws everything on their spot back to their
  // own place at the rail, where it joins their stack. Also how a pushed bet
  // goes home.
  const DRAW_REACH_MS = 380;
  const DRAW_BACK_MS = 520;
  function drawChipsHome(seatIndex) {
    ensureSeat(seatIndex);
    const seat = SEATS[seatIndex];
    const meshes = betChipMeshes[seatIndex].splice(0, betChipMeshes[seatIndex].length);
    pendingStack[seatIndex] = 0;
    if (!meshes.length) return;
    // Back into the channel, beside the player's own chips.
    const home = channelPoint(seat, 4.5).setY(CHANNEL_Y);
    const figure = seatFigure(seatIndex);
    if (figure) {
      playerReach(figure, [
        { at: DRAW_REACH_MS, pos: seat.betSpot.clone().setY(0.12) },
        { at: DRAW_REACH_MS + DRAW_BACK_MS, pos: home },
      ]);
    }
    meshes.forEach((mesh, i) => {
      slideChip(mesh, home.clone().setY(CHANNEL_Y + stackHeight(i)), DRAW_REACH_MS, DRAW_BACK_MS, 0.03);
      setTimeout(() => scene.remove(mesh), DRAW_REACH_MS + DRAW_BACK_MS + 80);
    });
  }

  return {
    setViewSeat,
    followSeat,
    releaseViewSeat,
    shuffleDeck: () => { if (deck) playShuffle(deck); },
    getViewSeat: () => viewSeatIndex,
    dealCardToSeat,
    dealDealerCard,
    revealDealerCard,
    splitSeatHand,
    clearAllMeshes,
    setSeatBadge,
    hideSeatBadges,
    setDealerBadge,
    hideDealerBadge,
    applySeatCharacter,
    clearSeatCharacter,
    addBetChipVisual,
    clearBetChipsForSeat,
    collectBetChipsForSeat,
    payoutChipsForSeat,
    drawChipsHome,
  };
}
