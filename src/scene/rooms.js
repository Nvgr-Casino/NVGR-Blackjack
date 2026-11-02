import { ROOM_NAMES } from '../app/roomLogic.js';
import { LUCKY_SEVENS } from './luckySevens.js';
import { WILD_CARD } from './wildCard.js';
import { FULL_HOUSE } from './fullHouse.js';
import { GOLDEN_ACE } from './goldenAce.js';
import { HIGH_ROLLER } from './highRoller.js';
import { ROYAL_FLUSH } from './royalFlush.js';

// Every table is in a room of its own, dressed for its stakes and named
// for a hand or a turn of the game, and every one of them a casino room
// with its own character: a slot lounge on the Strip (luckySevens.js), a
// Belle Epoque gaming salon with roulette (wildCard.js), a private card
// club with poker (fullHouse.js), an Art Deco gold room with baccarat and
// craps (goldenAce.js), a sky lounge over New York at night
// (highRoller.js), and at the top a glass pavilion above the clouds
// (royalFlush.js). casinoKit.js holds the materials they share. room.js
// paints the walls, floor and fittings from these; scene.js sets the
// light from them; each one furnishes itself.
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
  // Lucky Sevens — 100 / 2K: a slot lounge on the Strip.
  1: { name: ROOM_NAMES[0], ...LUCKY_SEVENS },
  // The Wild Card — 500 / 10K: a Belle Epoque gaming salon.
  2: { name: ROOM_NAMES[1], ...WILD_CARD },
  // The Full House — 1K / 25K: a private card club.
  3: { name: ROOM_NAMES[2], ...FULL_HOUSE },
  // The Golden Ace — 5K / 100K: an Art Deco gold room.
  4: { name: ROOM_NAMES[3], ...GOLDEN_ACE },
  // The High Roller — 25K / 500K: the sky lounge over New York.
  5: { name: ROOM_NAMES[4], ...HIGH_ROLLER },
  // The Royal Flush — 100K / 2M: above the clouds.
  6: { name: ROOM_NAMES[5], ...ROYAL_FLUSH },
};
