// Crown Jewels, the house's slot machine: five reels, three rows, ten lines.
// The rules, and nothing of the screen: a spin is a draw of five stops on
// five fixed reel strips, and what it pays follows from the pay table.
//
// A line pays for three, four or five of a kind from the leftmost reel. The
// NVGR crest is wild: it stands in for anything but the Diamond, and five of
// it on a line is the top prize. Diamonds are scattered: three or more
// anywhere pay on the whole bet, on top of the lines. The bet is spread over
// all ten lines, so it is always a multiple of ten.
//
// The strips were tuned by simulation (tests/slots-rules.test.mjs) to give
// back about 96 per cent over the long run, a usual figure for a casino's
// floor.

export const SYMBOLS = ['wild', 'crown', 'diamond', 'ruby', 'emerald', 'sapphire', 'A', 'K', 'Q', 'J'];
export const SYMBOL_NAME = {
  wild: 'NVGR Wild', crown: 'Crown', diamond: 'Diamond', ruby: 'Ruby', emerald: 'Emerald', sapphire: 'Sapphire',
  A: 'Ace', K: 'King', Q: 'Queen', J: 'Jack',
};
export const REELS = 5;
export const ROWS = 3;

// The ten lines, as the row (0 top, 2 bottom) they cross on each reel.
export const LINES = [
  [1, 1, 1, 1, 1],
  [0, 0, 0, 0, 0],
  [2, 2, 2, 2, 2],
  [0, 1, 2, 1, 0],
  [2, 1, 0, 1, 2],
  [0, 0, 1, 2, 2],
  [2, 2, 1, 0, 0],
  [1, 0, 0, 0, 1],
  [1, 2, 2, 2, 1],
  [0, 1, 1, 1, 0],
];

// What a line pays, times the bet on one line, for 3, 4 and 5 of a kind.
export const PAYS = {
  wild: [50, 250, 1000],
  crown: [25, 100, 500],
  ruby: [15, 60, 250],
  emerald: [12, 40, 150],
  sapphire: [10, 30, 100],
  A: [6, 20, 80],
  K: [5, 15, 60],
  Q: [4, 12, 50],
  J: [2, 8, 30],
};
// Diamonds anywhere, times the whole bet, for 3, 4 and 5.
export const SCATTER_PAYS = [3, 15, 100];

// The reel strips, each read top to bottom and round again. Built from the
// counts of each symbol on each reel, spread out so a symbol does not sit
// next to itself.
const COUNTS = [
  // wild crown diamond ruby emerald sapphire A K Q J
  [2, 2, 2, 3, 3, 4, 4, 4, 5, 5],
  [3, 2, 2, 3, 3, 4, 4, 4, 4, 5],
  [4, 2, 2, 3, 3, 3, 4, 4, 5, 5],
  [3, 2, 2, 3, 3, 4, 4, 4, 4, 5],
  [2, 2, 2, 3, 3, 4, 4, 4, 5, 5],
];
function spread(counts) {
  // Deal the symbols round like cards, the rarest first, into the gaps.
  const total = counts.reduce((a, b) => a + b, 0);
  const strip = new Array(total).fill(null);
  const order = SYMBOLS.map((s, i) => [s, counts[i]]).sort((a, b) => a[1] - b[1]);
  let cursor = 0;
  for (const [sym, n] of order) {
    for (let k = 0; k < n; k++) {
      // The next empty place at about the right spacing.
      let at = Math.round(cursor + (k * total) / n) % total;
      while (strip[at] !== null) at = (at + 1) % total;
      strip[at] = sym;
    }
    cursor += 3;
  }
  return strip;
}
export const STRIPS = COUNTS.map(spread);

// The three symbols showing on a reel that stopped at `stop` (the top row).
export function windowOf(stops) {
  return stops.map((stop, reel) => {
    const s = STRIPS[reel];
    return [0, 1, 2].map((row) => s[(stop + row) % s.length]);
  });
}

// One line's pay, times the line bet, and how many reels it ran.
export function linePay(symbols) {
  const first = symbols.find((s) => s !== 'wild') || 'wild';
  if (first === 'diamond') {
    // A line can still be all wilds before a diamond.
    let w = 0;
    while (w < symbols.length && symbols[w] === 'wild') w++;
    return w >= 3 ? { symbol: 'wild', count: w, pay: PAYS.wild[w - 3] } : null;
  }
  let n = 0;
  while (n < symbols.length && (symbols[n] === first || symbols[n] === 'wild')) n++;
  let best = n >= 3 && PAYS[first] ? { symbol: first, count: n, pay: PAYS[first][n - 3] } : null;
  // Wilds alone at the start may pay more than what they complete.
  let w = 0;
  while (w < symbols.length && symbols[w] === 'wild') w++;
  if (w >= 3 && (!best || PAYS.wild[w - 3] > best.pay)) best = { symbol: 'wild', count: w, pay: PAYS.wild[w - 3] };
  return best;
}

// Everything a spin pays at `bet` (a multiple of ten): each winning line
// and the scatter, and the total.
export function evaluate(stops, bet) {
  const grid = windowOf(stops);
  const lineBet = bet / LINES.length;
  const wins = [];
  LINES.forEach((rows, line) => {
    const r = linePay(rows.map((row, reel) => grid[reel][row]));
    if (r) wins.push({ line, symbol: r.symbol, count: r.count, amount: Math.round(r.pay * lineBet), cells: rows.slice(0, r.count).map((row, reel) => [reel, row]) });
  });
  const diamonds = [];
  grid.forEach((col, reel) => col.forEach((s, row) => { if (s === 'diamond') diamonds.push([reel, row]); }));
  let scatter = null;
  if (diamonds.length >= 3) {
    const n = Math.min(5, diamonds.length);
    scatter = { count: diamonds.length, amount: SCATTER_PAYS[n - 3] * bet, cells: diamonds };
  }
  const total = wins.reduce((a, w) => a + w.amount, 0) + (scatter ? scatter.amount : 0);
  return { grid, wins, scatter, total };
}

// A fair stop on each reel: rejection sampling over two bytes.
export function drawStops(rand = cryptoInt) {
  return STRIPS.map((s) => rand(s.length));
}
function cryptoInt(n) {
  const buf = new Uint16Array(1);
  const limit = Math.floor(65536 / n) * n;
  for (;;) {
    globalThis.crypto.getRandomValues(buf);
    if (buf[0] < limit) return buf[0] % n;
  }
}

// The bets offered: each a multiple of ten, from the smallest coin up.
export const BETS = [10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000, 50000, 100000];

// How a win is presented, by how many times the bet it is.
export function winTier(total, bet) {
  if (!total) return null;
  const x = total / bet;
  return x >= 100 ? 'mega' : x >= 25 ? 'big' : x >= 8 ? 'great' : 'win';
}
