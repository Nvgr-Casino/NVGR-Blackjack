import * as THREE from 'three';
import { dealCard, revealCard, playShuffle } from '../scene/deal.js';
import { CARD_WIDTH, CARD_HEIGHT } from '../scene/card.js';
import { createChip, createChipForValue, CHIP_HEIGHT, DENOMINATIONS } from '../scene/chip.js';
import { createCharacter } from '../scene/character.js';
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

  // A seated figure leans in over the felt, so from your own chair the back
  // of your own head sits squarely between the camera and your cards. Any
  // head the camera is right behind isn't drawn; the body still is, so your
  // own shoulders and arms are at the bottom of the picture, and turning the
  // view to look at yourself brings the head back.
  const HEAD_CLEARANCE = m(0.95);
  const headPoint = new THREE.Vector3();
  const priorBeforeRender = scene.onBeforeRender;
  scene.onBeforeRender = (...args) => {
    seatCharacters.forEach(({ group }, seatIndex) => {
      const meshes = group.userData.headMeshes;
      if (!meshes || !meshes.length) return;
      const seat = SEATS[seatIndex];
      const inward = seatOutwardDir(seat).multiplyScalar(-m(0.2));
      headPoint.copy(seat.position).add(inward).setY(SEAT_TOP_Y + m(0.72));
      const show = camera.position.distanceTo(headPoint) > HEAD_CLEARANCE;
      for (const mesh of meshes) mesh.visible = show;
    });
    priorBeforeRender.apply(scene, args);
  };

  function applySeatCharacter(seatIndex, characterId) {
    const existing = seatCharacters.get(seatIndex);
    if (existing && existing.id === characterId) {
      existing.group.visible = true;
      return;
    }
    if (existing) scene.remove(existing.group);
    if (!characterId) { seatCharacters.delete(seatIndex); return; }

    const seat = SEATS[seatIndex];
    if (!seat) return;
    const group = createCharacter(characterId);
    group.position.copy(seat.position);
    group.rotation.y = seat.facingAngle;
    scene.add(group);
    seatCharacters.set(seatIndex, { id: characterId, group });
  }

  function clearSeatCharacter(seatIndex) {
    const existing = seatCharacters.get(seatIndex);
    if (!existing) return;
    scene.remove(existing.group);
    seatCharacters.delete(seatIndex);
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

  // ---------- bet chips ----------
  // `value`, when given, spawns a chip labeled/colored for that exact
  // bet-ladder amount (see chip.js's LADDER_COLORS) instead of one of the
  // 4 fixed on-table denominations — used both for the local player's own
  // tap-to-bet chips and for showing another seat's already-confirmed bet.
  function addBetChipVisual(seatIndex, colorIndex, value) {
    ensureSeat(seatIndex);
    const seat = SEATS[seatIndex];
    const dir = seatOutwardDir(seat);
    const chip = value != null ? createChipForValue(value, colorIndex) : createChip(colorIndex);
    const from = new THREE.Vector3(seat.betSpot.x + dir.x * 1.3, 0.35, seat.betSpot.z + dir.z * 1.3);
    chip.position.copy(from);
    scene.add(chip);
    betChipMeshes[seatIndex].push(chip);

    const to = seat.betSpot.clone();
    to.y = CHIP_HEIGHT * pendingStack[seatIndex] + CHIP_HEIGHT / 2;
    pendingStack[seatIndex]++;

    animate({
      duration: 420,
      easing: easeOutCubic,
      onUpdate: (t) => {
        chip.position.lerpVectors(from, to, t);
        chip.position.y += Math.sin(t * Math.PI) * 0.4;
      },
    });
    return chip;
  }

  function clearBetChipsForSeat(seatIndex) {
    ensureSeat(seatIndex);
    betChipMeshes[seatIndex].forEach((m) => scene.remove(m));
    betChipMeshes[seatIndex].length = 0;
    pendingStack[seatIndex] = 0;
  }

  function tossChip(mesh, from, to, duration) {
    mesh.position.copy(from);
    animate({
      duration,
      easing: easeOutCubic,
      onUpdate: (t) => {
        mesh.position.lerpVectors(from, to, t);
        mesh.position.y += Math.sin(t * Math.PI) * 0.35;
      },
    });
  }

  function collectBetChipsForSeat(seatIndex) {
    ensureSeat(seatIndex);
    const from = DEALER.position.clone();
    from.y = 0.4;
    const meshes = betChipMeshes[seatIndex].splice(0, betChipMeshes[seatIndex].length);
    meshes.forEach((mesh, i) => {
      const start = mesh.position.clone();
      tossChip(mesh, start, from, 420 + i * 60);
      setTimeout(() => scene.remove(mesh), 420 + i * 60 + 20);
    });
    pendingStack[seatIndex] = 0;
  }

  function payoutChipsForSeat(seatIndex, count) {
    ensureSeat(seatIndex);
    const seat = SEATS[seatIndex];
    const from = DEALER.position.clone();
    from.y = 0.4;
    for (let i = 0; i < count; i++) {
      const colorIndex = i % DENOMINATIONS.length;
      const chip = createChip(colorIndex);
      scene.add(chip);
      betChipMeshes[seatIndex].push(chip);
      const to = seat.betSpot.clone();
      to.y = CHIP_HEIGHT * (pendingStack[seatIndex] + i) + CHIP_HEIGHT / 2;
      tossChip(chip, from, to, 420 + i * 90);
    }
    pendingStack[seatIndex] += count;
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
  };
}
