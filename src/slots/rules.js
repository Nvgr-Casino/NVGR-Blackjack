// The slot machines' rules, for any machine: a spin is a draw of one stop
// on each of the machine's reel strips, and what it pays follows from its
// pay table. Nothing of the screen here; each machine is described in
// src/slots/games.js and made playable by makeGame().
//
// A line pays for a run of one symbol from the leftmost reel. The wild
// stands in for anything but the scatter and the blanks, and on some
// machines doubles a win for every wild in it. A group pays for a mixed run
// (any three sevens, any bars). A few symbols pay a little for one or two at
// the start of a line (a cherry). Scatters pay anywhere on the reels, on
// the whole bet.

// The bets offered: each a multiple of ten, so a line bet is whole on every
// machine (ten lines or five).
export const BETS = [10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000, 50000, 100000];

// How a win is presented, by how many times the bet it is.
export function winTier(total, bet) {
  if (!total) return null;
  const x = total / bet;
  return x >= 100 ? 'mega' : x >= 25 ? 'big' : x >= 8 ? 'great' : 'win';
}

// A reel strip from the counts of each symbol: dealt round like cards, the
// rarest first, into the gaps, so a symbol seldom sits next to itself.
function spread(symbols, counts) {
  const total = counts.reduce((a, b) => a + b, 0);
  const strip = new Array(total).fill(null);
  const order = symbols.map((s, i) => [s, counts[i]]).filter(([, n]) => n > 0).sort((a, b) => a[1] - b[1]);
  let cursor = 0;
  for (const [sym, n] of order) {
    for (let k = 0; k < n; k++) {
      let at = Math.round(cursor + (k * total) / n) % total;
      while (strip[at] !== null) at = (at + 1) % total;
      strip[at] = sym;
    }
    cursor += 3;
  }
  return strip;
}

function cryptoInt(n) {
  const buf = new Uint16Array(1);
  const limit = Math.floor(65536 / n) * n;
  for (;;) {
    globalThis.crypto.getRandomValues(buf);
    if (buf[0] < limit) return buf[0] % n;
  }
}

/** A machine, playable, from its description. */
export function makeGame(def) {
  // A stacked symbol comes in runs on the strip (a count is of runs), so
  // several can show on one reel at once, as bonus pearls do.
  const stacks = def.stacks || {};
  const strips = def.counts.map((c) => spread(def.symbols, c).flatMap((sym) => Array(stacks[sym] || 1).fill(sym)));
  const reels = strips.length;
  const rows = 3;
  const lines = def.lines;
  const wild = def.wild;
  const scatter = def.scatter || null;
  const mult = def.wildMultiplier || 1;
  // A run's pays start at three of a kind: [3, 4, 5] on five reels, [3] on three.
  const minCount = 3;
  const groups = def.groups || [];
  const partial = def.partial || {};
  const payFor = (sym, n) => (def.pays[sym] && n >= minCount ? def.pays[sym][n - minCount] || 0 : 0);

  function windowOf(stops) {
    return stops.map((stop, reel) => {
      const s = strips[reel];
      return [0, 1, 2].map((row) => s[(stop + row) % s.length]);
    });
  }
  // The best a line's symbols pay, times the line bet.
  function linePay(sy) {
    const isWild = (s) => s === wild;
    let best = null;
    const consider = (r) => { if (r && r.pay > 0 && (!best || r.pay > best.pay)) best = r; };
    // Wilds alone at the start of the line.
    let w = 0;
    while (w < sy.length && isWild(sy[w])) w++;
    if (w >= minCount) consider({ symbol: wild, count: w, pay: payFor(wild, w) });
    // A run of one symbol, wilds standing in.
    const first = sy.find((s) => !isWild(s));
    if (first && first !== scatter && def.pays[first]) {
      let n = 0, wilds = 0;
      while (n < sy.length && (sy[n] === first || isWild(sy[n]))) { if (isWild(sy[n])) wilds++; n++; }
      if (n >= minCount) consider({ symbol: first, count: n, pay: payFor(first, n) * Math.pow(mult, wilds) });
    }
    // A mixed run of one group.
    groups.forEach((g) => {
      let n = 0, wilds = 0;
      while (n < sy.length && (g.members.includes(sy[n]) || isWild(sy[n]))) { if (isWild(sy[n])) wilds++; n++; }
      // All wild is the wilds' own pay, not the group's.
      if (n >= minCount && wilds < n && g.pays[n - minCount]) consider({ symbol: g.id, count: n, pay: g.pays[n - minCount] * Math.pow(mult, wilds) });
    });
    // One or two of a symbol at the start of the line.
    Object.entries(partial).forEach(([sym, table]) => {
      let n = 0;
      while (n < sy.length && sy[n] === sym) n++;
      if (table[n]) consider({ symbol: sym, count: n, pay: table[n] });
    });
    return best;
  }
  function evaluate(stops, bet) {
    const grid = windowOf(stops);
    const lineBet = bet / lines.length;
    const wins = [];
    lines.forEach((rowsOn, line) => {
      const r = linePay(rowsOn.map((row, reel) => grid[reel][row]));
      if (r) wins.push({ line, symbol: r.symbol, count: r.count, amount: Math.round(r.pay * lineBet), cells: rowsOn.slice(0, r.count).map((row, reel) => [reel, row]) });
    });
    // Enough bonus pearls anywhere start the Hold & Spin feature.
    let feature = null;
    if (def.feature) {
      const cells = [];
      grid.forEach((col, reel) => col.forEach((s, row) => { if (s === def.feature.orb) cells.push([reel, row]); }));
      if (cells.length >= def.feature.trigger) feature = { cells };
    }
    let scat = null;
    if (scatter) {
      const cells = [];
      grid.forEach((col, reel) => col.forEach((s, row) => { if (s === scatter) cells.push([reel, row]); }));
      if (cells.length >= 3) {
        const p = def.scatterPays;
        scat = { count: cells.length, amount: p[Math.min(p.length - 1, cells.length - 3)] * bet, cells };
      }
    }
    const total = wins.reduce((a, x) => a + x.amount, 0) + (scat ? scat.amount : 0);
    return { grid, wins, scatter: scat, feature, total };
  }
  // ---------- Hold & Spin ----------
  // The pearls that started it lock where they are, each with a prize; the
  // other places respin. Three respins, and every new pearl puts the count
  // back to three. A prize is a multiple of the bet, or a jackpot (Mini,
  // Minor, Major); filling all fifteen places wins the Grand as well.
  // `pots` are the jackpots now, as multiples of the bet. `rand` gives 0..1.
  function drawPrize(rand) {
    const table = def.feature.prizes;
    const sum = table.reduce((a, [, w]) => a + w, 0);
    let x = rand() * sum;
    for (const [v, w] of table) { if ((x -= w) < 0) return v; }
    return table[0][0];
  }
  function holdSpin(startCells, bet, pots, rand) {
    const total = reels * rows;
    const held = new Map(startCells.map(([reel, row]) => [reel * rows + row, drawPrize(rand)]));
    const start = [...held].map(([cell, prize]) => ({ cell, prize }));
    const steps = [];
    let left = 3;
    while (left > 0 && held.size < total) {
      left--;
      const landed = [];
      for (let cell = 0; cell < total; cell++) {
        if (held.has(cell)) continue;
        if (rand() < def.feature.chance) { const prize = drawPrize(rand); held.set(cell, prize); landed.push({ cell, prize }); }
      }
      if (landed.length) left = 3;
      steps.push({ landed, respinsLeft: left });
    }
    const grand = held.size === total;
    const worth = (p) => (typeof p === 'number' ? p : pots[p]);
    let win = 0;
    const jackpots = [];
    held.forEach((p) => { win += worth(p); if (typeof p !== 'number') jackpots.push(p); });
    if (grand) { win += pots.grand; jackpots.push('grand'); }
    return { start, steps, grand, jackpots, amount: Math.round(win * bet) };
  }
  const drawStops = (rand = cryptoInt) => strips.map((s) => rand(s.length));
  // The top prize on a line, at a bet: the machine's jackpot.
  const jackpot = (bet) => (def.jackpots ? def.jackpots.grand.seed * bet : Math.max(...def.pays[wild]) * (bet / lines.length));
  const nameOf = (sym) => (def.names && def.names[sym]) || (groups.find((g) => g.id === sym) || {}).name || sym;

  return { ...def, strips, reels, rows, windowOf, linePay, evaluate, drawStops, jackpot, nameOf, minCount, holdSpin };
}
