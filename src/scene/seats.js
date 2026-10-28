import * as THREE from 'three';
import { TABLE_RADIUS, TABLE_BACK_Z } from './table.js';
import { m, FLOOR_Y } from './scale.js';

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

// Where the camera sits when a given seat is yours: a little above a
// seated eye-line, aimed at the dealer's cards — the view a live-dealer
// stream uses, because it is the one you can watch for an hour without
// effort. The dealer's face sits at the top of the frame, your own cards
// sit just above the action bar, and every other hand is in between. The
// earlier view was lower and over your shoulder, so the back of your own
// head filled the middle of the screen and everything had to be read
// around it.
//
// Screen shape decides the exact spot. A wide screen has little height to
// spare between the dealer's head and the action bar, so the camera sits a
// short way behind the chair, which shortens that span. A tall phone screen
// has height to spare but a field of view that reaches far down, so the
// camera sits directly above the chair, where your own head can't come
// into shot.
const VIEWS = {
  wide: { back: m(0.35), height: m(1.75), lookY: 0.5 },
  tall: { back: 0, height: m(1.7), lookY: 0.7 },
};
export const isTallScreen = () => window.innerWidth < window.innerHeight;
const view = () => (isTallScreen() ? VIEWS.tall : VIEWS.wide);

export function cameraLookAtForSeat() {
  return DEALER.handSpot.clone().setY(view().lookY);
}

export function cameraPositionForSeat(seat) {
  const { back, height } = view();
  const dir = seat.position.clone().setY(0).normalize();
  return seat.position.clone().addScaledVector(dir, back).setY(FLOOR_Y + height);
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
