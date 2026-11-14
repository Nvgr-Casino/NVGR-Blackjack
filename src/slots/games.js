// The salon's machines: what each pays, its reels, and how it looks. Each
// was tuned by simulation, with a well-mixed generator, (tests/slots-rules.test.mjs) to give back about
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
    A: [6, 20, 80], K: [5, 15, 60], Q: [4, 12, 50], J: [2, 8, 30],
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
    [1, 1, 1, 2, 2, 3, 4, 3, 18],
    [1, 1, 2, 2, 2, 3, 4, 3, 17],
    [1, 1, 1, 2, 2, 3, 4, 3, 18],
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
    pK: [6, 20, 80], pQ: [5, 15, 60], pJ: [4, 12, 50], p10: [2, 8, 30],
  },
  scatterPays: [3, 15, 100],
  counts: FIVE_REEL_COUNTS,
  look: { ground: 'velvet', lacquer: 0x0a1230, trim: 'platinum', led: [0.62, 0.8, 1], accent: '#2e8cff', title: 'HIGH ROLLER', showcase: ['ace', 'wheel', 'dice', 'chips'] },
});

// ---------- Jade Panda ----------
// Four jackpots and Hold & Spin. Six or more Golden Pearls anywhere lock in
// place with prizes on them and the other places respin, three at a time,
// starting over with every new pearl. The Mini and Minor are fixed; the
// Major and Grand grow with every spin until they are won. Jade lacquer and
// gold; the reels on red silk.
export const JADE_PANDA = makeGame({
  id: 'jadepanda',
  name: 'Jade Panda',
  tagline: 'Five reels · ten lines · Hold & Spin · four jackpots',
  symbols: ['pwild', 'pearl', 'ingot', 'lantern', 'jade', 'fan', 'jA', 'jK', 'jQ', 'jJ'],
  names: { pwild: 'Panda Wild', pearl: 'Golden Pearl', ingot: 'Gold Ingot', lantern: 'Red Lantern', jade: 'Jade Disc', fan: 'Silk Fan', jA: 'Ace', jK: 'King', jQ: 'Queen', jJ: 'Jack' },
  wild: 'pwild', scatter: null,
  wildNote: 'Stands in for every symbol but the Golden Pearl.',
  lines: TEN_LINES,
  pays: {
    pwild: [60, 300, 1200], ingot: [30, 120, 600], lantern: [18, 70, 300], jade: [14, 46, 170], fan: [12, 35, 115],
    jA: [6, 21, 80], jK: [5, 14, 58], jQ: [3, 10, 40], jJ: [2, 6, 25],
  },
  feature: {
    type: 'holdspin', orb: 'pearl', trigger: 6, chance: 0.03,
    note: 'Six or more anywhere start Hold & Spin. Pearls lock with a prize; every new one resets the respins to three. Fill all fifteen places for the Grand.',
    // Prizes, as multiples of the bet, and how often each comes.
    prizes: [[1, 30], [2, 24], [3, 16], [5, 12], [8, 7], [10, 5], [15, 2.5], ['mini', 2.4], ['minor', 0.5], ['major', 0.08]],
  },
  // The jackpots, as multiples of the bet; the Major and Grand grow by
  // `grow` every spin.
  jackpots: {
    mini: { seed: 10, note: 'On a pearl, ten times your bet.' },
    minor: { seed: 40, note: 'On a pearl, forty times your bet.' },
    major: { seed: 150, grow: 0.006, note: 'On a pearl. Grows with every spin.' },
    grand: { seed: 1000, grow: 0.012, note: 'Fill all fifteen places. Grows with every spin.' },
  },
  // Pearls come in pairs on the strip, so several can show on one reel.
  stacks: { pearl: 2 },
  counts: [
    // pwild pearl(pairs) ingot lantern jade fan A K Q J
    [2, 2, 2, 3, 3, 4, 4, 4, 5, 5],
    [3, 1, 2, 3, 3, 4, 4, 4, 4, 5],
    [4, 2, 2, 3, 3, 3, 4, 4, 5, 5],
    [3, 1, 2, 3, 3, 4, 4, 4, 4, 5],
    [2, 2, 2, 3, 3, 4, 4, 4, 5, 5],
  ],
  look: { ground: 'crimson', lacquer: 0x0b3324, trim: 'gold', led: [0.55, 1, 0.66], accent: '#c4203a', title: 'JADE PANDA', showcase: ['pwild', 'ingot', 'lantern', 'jade'] },
});

// Jade Panda joins the salon once its Hold & Spin has been seen on the floor.
export const PANDA_READY = false;
export const GAMES = { crownjewels: CROWN_JEWELS, imperialsevens: IMPERIAL_SEVENS, highroller: HIGH_ROLLER, ...(PANDA_READY ? { jadepanda: JADE_PANDA } : {}) };
export const GAME_LIST = PANDA_READY ? [CROWN_JEWELS, JADE_PANDA, IMPERIAL_SEVENS, HIGH_ROLLER] : [CROWN_JEWELS, IMPERIAL_SEVENS, HIGH_ROLLER];
/** The jackpots at their seeds, as multiples of the bet. */
export const seedPots = (game) => (game.jackpots ? Object.fromEntries(Object.entries(game.jackpots).map(([k, v]) => [k, v.seed])) : null);
export const DEFAULT_GAME = 'crownjewels';
export const gameOf = (id) => GAMES[id] || GAMES[DEFAULT_GAME];
