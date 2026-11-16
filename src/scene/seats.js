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
//
// Seat 1 is "first base", on the dealer's left (+x, as the dealer faces the
// players) — the right-hand end of the table as the players see it — and
// the seats count round to the dealer's right. A dealer deals and plays the
// table from their left to their right, so seat order is deal order. It ran
// the other way, dealing from third base.
const SEAT_ANGLES_DEG = [95, 45, 0, -45, -95];

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
    betSpot: dir.clone().multiplyScalar(TABLE_RADIUS * 0.81).setY(0.02),
    handSpot: dir.clone().multiplyScalar(TABLE_RADIUS * 0.585).setY(0.04),
    facingAngle: Math.atan2(-dir.x, -dir.z), // yaw so local +Z points at the table center
    // A dealt card's rank/suit reads upright to a viewer facing world -Z
    // (the camera's own default gaze) at rotation.y=0 — that's offset by PI
    // from facingAngle (which points a chair's front at the table center,
    // the opposite convention). This is the rotation that keeps a card
    // right-side-up for whoever is actually sitting in this seat.
    cardAngle: rad,
  };
});

// Where the camera sits when a given seat is yours: the view card-table
// games are played from, high over your own place at the rail and looking
// down across the felt. The whole table fills the screen and the dealer is
// seen from the chest down: their hands, the rack, the shoe and every card,
// which is what the game is about, with your own cards just above the
// action bar. From lower down the dealer stood head to foot at the top of a
// long, flat table, and the cards were small in the middle of it.
//
// Screen shape decides the exact spot. On a wide screen the camera is just
// over the rail in front of your chair. A tall phone screen is narrow, and
// from there the table ran off both sides of it, so the camera rises higher
// over your chair and looks more steeply down, to take in its whole width.
// `toward` moves the aim from the dealer's cards toward the dealer (up to
// 1) or, below 0, toward you.
const VIEWS = {
  wide: { back: m(-0.126), height: m(2.61), lookY: -0.35, toward: -0.26 },
  tall: { back: m(0.62), height: m(4.19), lookY: -0.8, toward: -0.56 },
};
export const isTallScreen = () => window.innerWidth < window.innerHeight;
const view = () => (isTallScreen() ? VIEWS.tall : VIEWS.wide);

// From the end seats the dealer stands well off the line to their own cards,
// so aiming at the cards leaves the dealer pushed to the edge of the
// picture. The further out a seat, the more its aim moves back toward the
// dealer, which brings them to the middle; the centre seat aims as before.
const OUTER_AIM = 0.55;

export function cameraLookAtForSeat(seat) {
  const out = seat ? Math.abs(Math.atan2(seat.position.x, seat.position.z)) / (Math.PI / 2) : 0;
  const v = view();
  const target = DEALER.handSpot.clone().lerp(DEALER.position, Math.min(1, Math.max(v.toward, Math.min(1, out) * OUTER_AIM)));
  return target.setY(v.lookY);
}

// The two end seats sit right out beside the dealer. Viewed from exactly
// there, the table runs off sideways and the dealer is seen in profile at
// the edge of the frame — accurate, and tiring to watch. So each outer
// seat's camera swings in toward the middle of the table, to the middle of
// the gap between that seat and the next one in: still your own side, but
// facing the dealer, with the whole table in front of you — and between
// the chairs, not behind the next player's head, where a fixed share of
// the angle once put it.
function cameraAngle(seat) {
  const deg = SEAT_ANGLES_DEG[seat.index];
  if (deg === 0) return 0;
  const inward = SEAT_ANGLES_DEG.filter((d) => Math.abs(d) < Math.abs(deg) && Math.sign(d || deg) === Math.sign(deg));
  const next = inward.length ? inward.reduce((a, b) => (Math.abs(b) > Math.abs(a) ? b : a)) : 0;
  // Seen from high over the felt, a camera far round the side shows the
  // table turned on its edge, like a map, not like a seat at it: so the
  // view swings in further, to half that angle, and every seat sees the
  // table mostly from the front, its own place still nearest.
  return THREE.MathUtils.degToRad((deg + next) / 4);
}

export function cameraPositionForSeat(seat) {
  const { back, height } = view();
  const angle = cameraAngle(seat);
  const radius = SEAT_RADIUS + back;
  return new THREE.Vector3(Math.sin(angle) * radius, FLOOR_Y + height, Math.cos(angle) * radius);
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
  // Close in against the table's back edge, as a dealer stands.
  position: new THREE.Vector3(0, 0, TABLE_BACK_Z - 0.5),
  // The dealer's gear, laid out as at any casino blackjack table: the shoe
  // on the dealer's left (+x, as they face the players), its mouth turned
  // toward the middle; the chip rack straight in front of them; the discard
  // holder on their right. A card comes out of the shoe under the left
  // hand, which slides it across to the handoff point, where the right hand
  // takes it and deals it.
  shoePosition: new THREE.Vector3(1.22, 0, TABLE_BACK_Z + 0.36),
  deckPosition: new THREE.Vector3(1.16, 0.06, TABLE_BACK_Z + 0.4),
  handoffPosition: new THREE.Vector3(0.78, 0.012, TABLE_BACK_Z + 0.95),
  discardPosition: new THREE.Vector3(-1.6, 0, TABLE_BACK_Z + 0.4),
  // The chip rack; losing bets go in, payouts come out.
  trayPosition: new THREE.Vector3(0, 0.01, TABLE_BACK_Z + 0.4),
  // Pulled just clear of the rail/tray/shoe cluster so the dealer's cards
  // (and hand-value badge) aren't lost in that clutter, and short of the
  // BLACKJACK lettering printed across the felt in front of them.
  handSpot: new THREE.Vector3(0, 0.04, TABLE_BACK_Z + 0.97),
  facingAngle: 0,
};
