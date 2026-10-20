import * as THREE from 'three';
import { TABLE_RADIUS, TABLE_BACK_Z } from './table.js';
import { m } from './scale.js';

// Half a metre of clearance between the felt's edge and the chair, so a
// seated figure reaches the table rather than growing out of it. At 0.85
// the mocap pose — which leans forward with its hands on the table — put
// forearms through the rim.
const SEAT_RADIUS = TABLE_RADIUS + m(0.5);
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
// Over the seated player's shoulder. Their head now sits around y=1.4, so
// the camera is about a metre above and a metre back of it — close enough
// to read as their view, far enough that they are in it.
const CAMERA_BACK_DISTANCE = m(0.72);
const CAMERA_HEIGHT = m(1.3);
export const CAMERA_LOOK_AT = new THREE.Vector3(0, 0.65, -1.0);

// What a player in this seat is actually looking at: halfway between their
// own cards and the dealer's, lifted off the felt.
//
// Aiming every seat at one fixed point in the middle of the table was fine
// while the camera never left the middle seat. Once it sits where the
// player really sits, that fixed point tilts the view too far away: your
// own hand lands near the bottom of the frame — behind the betting panel —
// and the further round the table your seat is, the further off-centre it
// drifts. Splitting the difference with the dealer frames your cards and
// theirs identically from all five chairs.
const LOOK_LIFT = 0.3;
export function cameraLookAtForSeat(seat) {
  return seat.handSpot.clone().lerp(DEALER.handSpot, 0.5).setY(LOOK_LIFT);
}

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
  // Clear of the table's wooden skirt, which runs 0.45 further back than
  // the felt does — a body standing at the old rail position was inside it.
  // Close enough to still lean over the felt, which is where a dealer
  // stands.
  position: new THREE.Vector3(0, 0, TABLE_BACK_Z - 0.62),
  deckPosition: new THREE.Vector3(0.7, 0.05, TABLE_BACK_Z + 0.4),
  // Pulled just clear of the rail/tray/shoe cluster so the dealer's cards
  // (and hand-value badge) aren't lost in that clutter — with the back
  // stretch of felt shrunk down, this now lands right at the start of the
  // front curve instead of needing a long forward push to close a big gap.
  handSpot: new THREE.Vector3(0, 0.04, TABLE_BACK_Z + 1.15),
  facingAngle: 0,
};
