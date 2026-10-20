// The one place that decides how big things are.
//
// These numbers used to live as literals in five files — a floor height in
// avatar.js, another in dealer.js, a third in room.js, a standing height
// in character.js — and they drifted apart until the table measured 5.7
// widths per its own height. A real blackjack table is about 2.5. Ours was
// a pancake twice as wide as it should be, which is why no figure ever sat
// at it believably: either the people looked like dolls or the table
// looked like a runway.
//
// So the scale is derived from one real measurement instead of guessed.
// The felt stays at y=0 because every card, chip and bet spot is placed
// against it; the floor moves down to give the table its real height.

// A casino blackjack table is about 0.75m from floor to felt, and the felt
// is 5.2 units across in this scene. Fixing the height at a believable
// ratio is what sets everything else.
export const TABLE_TOP_Y = 0;
export const TABLE_HEIGHT = 1.95;
export const FLOOR_Y = TABLE_TOP_Y - TABLE_HEIGHT;

// Everything below is a real-world measurement converted through this.
export const UNITS_PER_METRE = TABLE_HEIGHT / 0.75;
export const m = (metres) => metres * UNITS_PER_METRE;

// Chair cushion height — 0.45m, a dining/gaming chair.
export const SEAT_TOP_Y = FLOOR_Y + m(0.45);

// Standing height the figures are scaled to. Models are measured in their
// bind pose, which is standing, so this is a standing height even though
// everyone here is sitting down.
export const PLAYER_HEIGHT = m(1.75);
// The dealer is given a little more presence across the table rather than
// being a different species: 1.8m, not the 4.2 it once was.
export const DEALER_HEIGHT = m(1.8);
