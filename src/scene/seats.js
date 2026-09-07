import * as THREE from 'three';
import { TABLE_RADIUS, TABLE_BACK_Z } from './table.js';

const SEAT_RADIUS = TABLE_RADIUS + 0.85;
// The table's front is a semicircle spanning -90..90deg before the straight
// sides begin — the two outer seats sit right out past that curve, beside
// the straight sides that run back toward the dealer, using the space that
// used to sit empty at the dealer's left and right flanks. The inner three
// stay spread across the curve itself with real elbow room between them.
const SEAT_ANGLES_DEG = [-95, -45, 0, 45, 95];

// Seats arc across the near side (+Z, camera side) of the table. Any seat
// can be "you" — which one is chosen at runtime (see src/ui/gameController.js's
// seat picker), not fixed here. The dealer stands opposite, at -Z.
export const SEATS = SEAT_ANGLES_DEG.map((deg, i) => {
  const rad = THREE.MathUtils.degToRad(deg);
  const dir = new THREE.Vector3(Math.sin(rad), 0, Math.cos(rad));
  return {
    index: i,
    position: dir.clone().multiplyScalar(SEAT_RADIUS),
    // Bet spot sits clear of the rim, and handSpot is pulled inward enough
    // to clear a dealt card's own footprint (CARD_HEIGHT, now real-card
    // sized) plus the chip stack's radius — retuned down from a much wider
    // gap that was sized for the old, oversized card/chip art.
    betSpot: dir.clone().multiplyScalar(TABLE_RADIUS - 0.5).setY(0.02),
    handSpot: dir.clone().multiplyScalar(TABLE_RADIUS - 1.08).setY(0.04),
    facingAngle: Math.atan2(-dir.x, -dir.z), // yaw so local +Z points at the table center
    // A dealt card's rank/suit reads upright to a viewer facing world -Z
    // (the camera's own default gaze) at rotation.y=0 — that's offset by PI
    // from facingAngle (which points a chair's front at the table center,
    // the opposite convention). This is the rotation that keeps a card
    // right-side-up for whoever is actually sitting in this seat.
    cardAngle: rad,
  };
});

// Where the camera sits when a given seat is "yours" — behind that seat's
// own position (further from the table along the same radial line it
// already sits on), at a fixed height. The look-at target stays the same
// world point regardless of which seat is chosen (the dealer/table-center
// area), so switching seats reads as moving around the same table rather
// than each seat getting its own bespoke framing.
// Pulled back and raised further than a literal seated eye-line would sit —
// tight to the seat cropped the dealer and the rest of the felt out of
// frame, so no single seat's view showed enough of the table to make sense
// of the round. This wider, higher vantage keeps the whole felt (dealer's
// cards down to every seat's hand spot) in frame from any of the 5 seats.
const CAMERA_BACK_DISTANCE = 2.25;
const CAMERA_HEIGHT = 3.85;
export const CAMERA_LOOK_AT = new THREE.Vector3(0, 0.65, -1.0);

export function cameraPositionForSeat(seat) {
  const dir = seat.position.clone().setY(0).normalize();
  return new THREE.Vector3(
    seat.position.x + dir.x * CAMERA_BACK_DISTANCE,
    CAMERA_HEIGHT,
    seat.position.z + dir.z * CAMERA_BACK_DISTANCE
  );
}

// The dealer stands behind the flat back rail (TABLE_BACK_Z is negative).
// The rail itself (tray + shoe) sits just behind that edge; the deck is on
// the felt, just in front of it.
export const RAIL_Z = TABLE_BACK_Z - 0.3;
export const DEALER = {
  // Just behind the rail, not a full extra step back — pulled in close
  // enough that the (now much taller, real-model) dealer reads as standing
  // right at the table instead of off in the distance behind their own gear.
  position: new THREE.Vector3(0, 0, RAIL_Z - 0.05),
  deckPosition: new THREE.Vector3(0.7, 0.05, TABLE_BACK_Z + 0.4),
  // Pulled just clear of the rail/tray/shoe cluster so the dealer's cards
  // (and hand-value badge) aren't lost in that clutter — with the back
  // stretch of felt shrunk down, this now lands right at the start of the
  // front curve instead of needing a long forward push to close a big gap.
  handSpot: new THREE.Vector3(0, 0.04, TABLE_BACK_Z + 1.15),
  facingAngle: 0,
};
