// The one place that decides how big things are.
//
// These numbers used to live as literals in five files — a floor height in
// avatar.js, another in dealer.js, a third in room.js, a standing height
// in character.js — and they drifted apart until the table measured 5.7
// widths per its own height. Ours was a pancake twice as wide as it should
// be, which is why no figure ever sat at it believably.
//
// Everything is now a real measurement converted through one factor, and
// that factor comes from the table itself rather than a guess. The felt
// stays at y=0 because every card, chip and bet spot is placed against it;
// the floor moves to give the table its real height.
//
// Reference: a casino-grade table is 780–820 mm tall including the padded
// rail (manufacturer spec, macaumr.com). Its width depends on how many
// spots it has — see table.js.

// Scene units per metre. It was first derived by fitting the original
// table to a seven-seat 2.4 m spec, and is kept as that fixed number now
// that the table has its own real size: every figure, chair and card is
// already measured against it.
export const UNITS_PER_METRE = 6.1 / 2.4;
export const m = (metres) => metres * UNITS_PER_METRE;

// 0.80 m, the middle of the real 780–820 mm range. The earlier 0.75 m was
// the low end of a dining table, not a casino one — combined with a tall
// dealer it made the table read as sitting too low.
export const TABLE_TOP_Y = 0;
export const TABLE_HEIGHT = m(0.8);
export const FLOOR_Y = TABLE_TOP_Y - TABLE_HEIGHT;

// Casino game chairs sit a little higher than dining chairs to suit the
// taller table: 0.5 m to the cushion.
export const SEAT_TOP_Y = FLOOR_Y + m(0.5);

// Standing heights the figures are scaled to (models are measured in their
// standing bind pose). An average adult, not a tall one — the dealer used
// to be given 1.8 m for "presence", which across a 0.8 m table is exactly
// what made them loom. A dealer is a person at the table, not over it.
export const PLAYER_HEIGHT = m(1.72);
export const DEALER_HEIGHT = m(1.72);
