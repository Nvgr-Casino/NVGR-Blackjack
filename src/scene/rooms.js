import { ROOM_NAMES } from '../app/roomLogic.js';
import { TERRACE, DECO, LIBRARY, MIRRORS } from './showrooms.js';
import { PENTHOUSE } from './penthouse.js';

// Every table is in a room of its own, dressed for its stakes, and each is
// built round an idea of its own (showrooms.js): a terrace over the sea at
// sunset, an Art Deco ballroom, a two-storey library under a dome of
// stars, a hall of mirrors — and at the top, the Penthouse, the city at
// night below its glass. room.js paints the walls, floor and fittings from
// these; scene.js sets the light from them; each one furnishes itself
// (the Penthouse in penthouse.js).
//
// Every room has the same bones, so each reads as a casino: the lit house
// sign over the dealer, the bar in the back-left corner with its
// bartender, a lounge on each side, a rug under the table, and a clear
// loop round it for the waiters (layout.js's walkway) with the posts where
// they stand (staffPosts).
//
// Positions are in the room's frame: the back wall at z = -half, the side
// walls at x = ±half, the table at the middle. Distances along the walls
// are in metres (m), so a room keeps its proportions at any size.

export const ROOM_THEMES = {
  // The Lounge — 100 / 2K: the terrace over the sea.
  1: { name: ROOM_NAMES[0], ...TERRACE },
  // The Parlour — 500 / 10K: the Art Deco ballroom.
  2: { name: ROOM_NAMES[1], ...DECO },
  // The Library — 1K / 25K: two storeys of books under the stars.
  3: { name: ROOM_NAMES[2], ...LIBRARY },
  // The Gold Room — 5K / 100K: the hall of mirrors.
  4: { name: ROOM_NAMES[3], ...MIRRORS },

  // The Penthouse — 25K / 500K: the sky lounge over New York (penthouse.js).
  5: { name: ROOM_NAMES[4], ...PENTHOUSE },
};
