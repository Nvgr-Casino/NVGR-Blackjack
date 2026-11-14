// The salon's machines: what each pays, its reels, and how it looks. Each
// was tuned by simulation (tests/slots-rules.test.mjs) to give back about
// 95 per cent over the long run, a usual figure for a casino's floor.

import { makeGame } from './rules.js';

const TEN_LINES = [
  [1, 1, 1, 1, 1], [0, 0, 0, 0, 0], [2, 2, 2, 2, 2], [0, 1, 2, 1, 0], [2, 1, 0, 1, 2],
  [0, 0, 1, 2, 2], [2, 2, 1, 0, 0], [1, 0, 0, 0, 1], [1, 2, 2, 2, 1], [0, 1, 1, 1, 0],
];
const FIVE_LINES = [[1, 1, 1], [0, 0, 0], [2, 2, 2], [0, 1, 2], [2, 1, 0]];
// Five-reel counts, symbol by symbol (wild, top, scatter, then down the table).
const FIVE_REEL_COUNTS = [
  [2, 2, 2, 3, 3, 4, 4, 4, 5, 5],
  [3, 2, 2, 3, 3, 4, 4, 4, 4, 5],
  [4, 2, 2, 3, 3, 3, 4, 4, 5, 5],
  [3, 2, 2, 3, 3, 4, 4, 4, 4, 5],
  [2, 2, 2, 3, 3, 4, 4, 4, 5, 5],
];

// ---------- Crown Jewels ----------
// Gemstones, a crown and the royals in enamel; the NVGR crest is wild,
// Diamonds scatter. Black lacquer and gold.
export const CROWN_JEWELS = makeGame({
  id: 'crownjewels',
  name: 'Crown Jewels',
  tagline: 'Five reels · ten lines · NVGR wild · Diamond scatter',
  symbols: ['wild', 'crown', 'diamond', 'ruby', 'emerald', 'sapphire', 'A', 'K', 'Q', 'J'],
  names: { wild: 'NVGR Wild', crown: 'Crown', diamond: 'Diamond', ruby: 'Ruby', emerald: 'Emerald', sapphire: 'Sapphire', A: 'Ace', K: 'King', Q: 'Queen', J: 'Jack' },
  wild: 'wild', scatter: 'diamond',
  wildNote: 'Stands in for every symbol but the Diamond.',
  scatterNote: 'Anywhere on the reels, paid on your whole bet.',
  lines: TEN_LINES,
  pays: {
    wild: [50, 250, 1000], crown: [25, 100, 500], ruby: [15, 60, 250], emerald: [12, 40, 150], sapphire: [10, 30, 100],
    A: [6, 20, 80], K: [4, 12, 50], Q: [3, 10, 40], J: [2, 6, 25],
  },
  scatterPays: [3, 15, 100],
  counts: FIVE_REEL_COUNTS,
  look: { ground: 'midnight', lacquer: 0x0b0a0d, trim: 'gold', led: [1, 0.81, 0.48], accent: '#c4203a', title: 'CROWN JEWELS', showcase: ['crown', 'ruby', 'sapphire', 'emerald'] },
});

// ---------- Imperial Sevens ----------
// The classic high-limit stepper: three reels on ivory strips, sevens in
// ruby, sapphire and gold, chrome BAR plates, cherries, and blanks between.
// The Diamond wild stands in for any symbol and doubles the win, twice
// over with two. Ruby lacquer and chrome.
export const IMPERIAL_SEVENS = makeGame({
  id: 'imperialsevens',
  name: 'Imperial Sevens',
  tagline: 'Three reels · five lines · Diamond wild doubles every win',
  symbols: ['dwild', 'seven_r', 'seven_b', 'seven_g', 'bar3', 'bar2', 'bar1', 'cherry', 'blank'],
  names: { dwild: 'Diamond Wild', seven_r: 'Ruby Seven', seven_b: 'Sapphire Seven', seven_g: 'Gold Seven', bar3: 'Triple Bar', bar2: 'Double Bar', bar1: 'Bar', cherry: 'Cherries', blank: 'Blank' },
  wild: 'dwild', scatter: null, wildMultiplier: 2,
  wildNote: 'Stands in for any symbol. One in a win doubles it; two make it four times.',
  lines: FIVE_LINES,
  pays: { dwild: [1000], seven_r: [200], seven_b: [100], seven_g: [80], bar3: [50], bar2: [25], bar1: [12], cherry: [20] },
  groups: [
    { id: 'any7', name: 'Any three Sevens', members: ['seven_r', 'seven_b', 'seven_g'], pays: [30] },
    { id: 'anybar', name: 'Any three Bars', members: ['bar1', 'bar2', 'bar3'], pays: [6] },
  ],
  partial: { cherry: { 1: 2, 2: 5 } },
  counts: [
    // dwild r7 b7 g7 bar3 bar2 bar1 cherry blank
    [1, 1, 1, 2, 2, 3, 4, 3, 20],
    [1, 1, 2, 2, 2, 3, 4, 3, 19],
    [1, 1, 1, 2, 2, 3, 4, 3, 20],
  ],
  look: { ground: 'ivory', lacquer: 0x3a060d, trim: 'chrome', led: [1, 0.42, 0.42], accent: '#1b2f7a', title: 'IMPERIAL SEVENS', showcase: ['seven_r', 'seven_b', 'seven_g', 'bar3'] },
});

// ---------- High Roller ----------
// The casino itself on the reels: a gold ace of spades, the wheel, the dice,
// a stack of black chips, and the royals in platinum. The crest is wild; the
// Golden Chip scatters. Midnight blue lacquer and platinum.
export const HIGH_ROLLER = makeGame({
  id: 'highroller',
  name: 'High Roller',
  tagline: 'Five reels · ten lines · NVGR wild · Golden Chip scatter',
  symbols: ['wild', 'ace', 'goldchip', 'wheel', 'dice', 'chips', 'pK', 'pQ', 'pJ', 'p10'],
  names: { wild: 'NVGR Wild', ace: 'Ace of Spades', goldchip: 'Golden Chip', wheel: 'The Wheel', dice: 'The Dice', chips: 'Black Chips', pK: 'King', pQ: 'Queen', pJ: 'Jack', p10: 'Ten' },
  wild: 'wild', scatter: 'goldchip',
  wildNote: 'Stands in for every symbol but the Golden Chip.',
  scatterNote: 'Anywhere on the reels, paid on your whole bet.',
  lines: TEN_LINES,
  pays: {
    wild: [50, 250, 1000], ace: [25, 100, 500], wheel: [15, 60, 250], dice: [12, 40, 150], chips: [10, 30, 100],
    pK: [6, 20, 80], pQ: [4, 12, 50], pJ: [3, 10, 40], p10: [2, 6, 25],
  },
  scatterPays: [3, 15, 100],
  counts: FIVE_REEL_COUNTS,
  look: { ground: 'velvet', lacquer: 0x0a1230, trim: 'platinum', led: [0.62, 0.8, 1], accent: '#2e8cff', title: 'HIGH ROLLER', showcase: ['ace', 'wheel', 'dice', 'chips'] },
});

export const GAMES = { crownjewels: CROWN_JEWELS, imperialsevens: IMPERIAL_SEVENS, highroller: HIGH_ROLLER };
export const GAME_LIST = [CROWN_JEWELS, IMPERIAL_SEVENS, HIGH_ROLLER];
export const DEFAULT_GAME = 'crownjewels';
export const gameOf = (id) => GAMES[id] || GAMES[DEFAULT_GAME];
