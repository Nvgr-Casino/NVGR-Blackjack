// The roulette layout's geometry, drawn the same way twice: on the 3D
// table's felt (src/scene/rouletteTable.js) and as the board you tap to bet
// on (src/app/rouletteBridge.js). Both read it from here, in the same
// units, so a chip put down on the board lands on the same spot of the felt.
//
// Seen from the players' side: the zero at the left, by the wheel; the
// numbers in three rows of twelve running to the right, 3 6 9 … along the
// far row and 1 4 7 … along the near one; the columns' 2 to 1 at the right
// end; the dozens and then the even chances along the near edge.

import { numbersFor, colorOf } from './rules.js';

export const BOARD_W = 2048;
export const BOARD_H = 1090;
export const MARGIN = 40;
export const ZERO_W = 150;
export const COLUMN_W = 170;
export const ROW_H = 230;
export const BAND_H = 160;
export const CELL_W = (BOARD_W - 2 * MARGIN - ZERO_W - COLUMN_W) / 12;
export const GRID_X = MARGIN + ZERO_W;
export const GRID_BOTTOM = MARGIN + 3 * ROW_H;

export const colOf = (n) => Math.floor((n - 1) / 3);      // 0 … 11, left to right
export const rowOf = (n) => 2 - ((n - 1) % 3);            // 0 far, 2 near
export const cellX = (n) => GRID_X + colOf(n) * CELL_W;
export const cellY = (n) => MARGIN + rowOf(n) * ROW_H;
export const EVEN_CHANCES = ['low', 'even', 'red', 'black', 'odd', 'high'];

// Where a chip for the bet sits on the board.
export function spotOf(id) {
  const nums = numbersFor(id);
  if (!nums) return null;
  const [kind] = id.split(':');
  const midX = (n) => cellX(n) + CELL_W / 2;
  const midY = (n) => cellY(n) + ROW_H / 2;
  if (kind === 'n') return nums[0] === 0 ? { x: MARGIN + ZERO_W / 2, y: MARGIN + 1.5 * ROW_H } : { x: midX(nums[0]), y: midY(nums[0]) };
  if (kind === 's') {
    const [a, b] = nums;
    if (a === 0) return { x: GRID_X, y: midY(b) };
    if (b - a === 3) return { x: cellX(a) + CELL_W, y: midY(a) };
    return { x: midX(a), y: cellY(b) + ROW_H };
  }
  if (kind === 't') return { x: midX(nums[0]), y: GRID_BOTTOM };
  if (kind === 'c') return { x: cellX(nums[0]) + CELL_W, y: cellY(nums[0]) };
  if (kind === 'l') return { x: cellX(nums[0]) + CELL_W, y: GRID_BOTTOM };
  if (kind === 'col') { const k = Number(id.slice(4)); return { x: BOARD_W - MARGIN - COLUMN_W / 2, y: MARGIN + (3 - k) * ROW_H + ROW_H / 2 }; }
  if (kind === 'd') { const k = Number(id.slice(2)); return { x: GRID_X + (4 * (k - 1) + 2) * CELL_W, y: GRID_BOTTOM + BAND_H / 2 }; }
  const i = EVEN_CHANCES.indexOf(id);
  return { x: GRID_X + (2 * i + 1) * CELL_W, y: GRID_BOTTOM + BAND_H * 1.5 };
}

// Every bet there is: the big areas (the numbers, the outside bets) and
// the small ones on their lines (splits, streets, corners, six lines).
export const AREA_BETS = [
  ...Array.from({ length: 37 }, (_, n) => 'n:' + n),
  'd:1', 'd:2', 'd:3', 'col:1', 'col:2', 'col:3', ...EVEN_CHANCES,
];
export const LINE_BETS = (() => {
  const out = ['s:0-1', 's:0-2', 's:0-3'];
  for (let n = 1; n <= 36; n++) {
    if (n <= 33) out.push(`s:${n}-${n + 3}`);
    if (n % 3 !== 0) out.push(`s:${n}-${n + 1}`);
    if (n % 3 === 1) out.push('t:' + n);
    if (n <= 32 && n % 3 !== 0) out.push('c:' + n);
    if (n <= 31 && n % 3 === 1) out.push('l:' + n);
  }
  return out;
})();

// The rectangle a big area covers, for drawing and for tapping.
export function areaRect(id) {
  const [kind, arg] = id.split(':');
  if (kind === 'n') {
    const n = Number(arg);
    return n === 0 ? { x: MARGIN, y: MARGIN, w: ZERO_W, h: 3 * ROW_H } : { x: cellX(n), y: cellY(n), w: CELL_W, h: ROW_H };
  }
  if (kind === 'col') { const k = Number(arg); return { x: BOARD_W - MARGIN - COLUMN_W, y: MARGIN + (3 - k) * ROW_H, w: COLUMN_W, h: ROW_H }; }
  if (kind === 'd') { const k = Number(arg); return { x: GRID_X + 4 * (k - 1) * CELL_W, y: GRID_BOTTOM, w: 4 * CELL_W, h: BAND_H }; }
  const i = EVEN_CHANCES.indexOf(id);
  return { x: GRID_X + 2 * i * CELL_W, y: GRID_BOTTOM + BAND_H, w: 2 * CELL_W, h: BAND_H };
}

export const POCKET_COLORS = { red: '#b3122e', black: '#141414', green: '#0f7a3c' };
// The cloth: deep emerald, its markings in gold.
export const FELT_COLOR = '#0a4a34';
export const LINE_COLOR = '#e3c47e';
export const numberFill = (n) => POCKET_COLORS[colorOf(n)];
