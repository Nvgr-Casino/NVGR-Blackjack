// The craps layout, in one place: where each bet's box is, for the felt
// painted on the 3D table (src/scene/crapsTable.js) and the board you tap in
// the dock (src/app/crapsBridge.js), so the two always agree.
//
// Board units: 2400 across, 1200 deep; y = 0 is the far side, by the dealer
// and the back wall, y = 1200 the near side, by the players.

export const BOARD_W = 2400;
export const BOARD_H = 1200;

const box = (id, x, y, w, h, extra = {}) => ({ id, x, y, w, h, ...extra });

// The bands along the players' side, nearest first, and their odds boxes.
const PASS = box('pass', 60, 1052, 1830, 118, { band: true });
const PASS_ODDS = box('passodds', 1910, 1052, 430, 118);
const DONT = box('dontpass', 150, 948, 1660, 92, { band: true });
const DONT_ODDS = box('dontodds', 1830, 948, 420, 92);
const FIELD = box('field', 150, 782, 2100, 154, { band: true });
// The place numbers.
const NUMBERS = [4, 5, 6, 8, 9, 10];
const PLACE = NUMBERS.map((n, i) => box('place' + n, 150 + i * 350, 520, 350, 250, { number: n }));
// The propositions in the middle, by the stickman.
const PX = 780, PW = 840, PY = 40;
const PROPS = [
  box('any7', PX, PY, PW, 74),
  box('hard6', PX, PY + 80, PW / 2, 112, { dice: [3, 3] }),
  box('hard10', PX + PW / 2, PY + 80, PW / 2, 112, { dice: [5, 5] }),
  box('hard8', PX, PY + 192, PW / 2, 112, { dice: [4, 4] }),
  box('hard4', PX + PW / 2, PY + 192, PW / 2, 112, { dice: [2, 2] }),
  box('aces', PX, PY + 310, PW / 4, 100, { dice: [1, 1] }),
  box('acedeuce', PX + PW / 4, PY + 310, PW / 4, 100, { dice: [1, 2] }),
  box('yo', PX + PW / 2, PY + 310, PW / 4, 100, { dice: [5, 6] }),
  box('twelve', PX + (3 * PW) / 4, PY + 310, PW / 4, 100, { dice: [6, 6] }),
  box('anycraps', PX, PY + 416, PW, 64),
];
export const AREAS = [PASS, PASS_ODDS, DONT, DONT_ODDS, FIELD, ...PLACE, ...PROPS];
export const area = (id) => AREAS.find((a) => a.id === id) || null;
export const PROP_BOX = { x: PX, y: PY, w: PW, h: 480 };
// Where the puck sits: on the point's box, or off at the left.
export function puckSpot(point) {
  if (point) { const a = area('place' + point); return { x: a.x + a.w / 2, y: a.y + 52 }; }
  return { x: 400, y: 300 };
}
// A bet's spot. Band bets sit before the player who made them (`seatX`,
// 0 to 1 along the band); box bets in the box's middle.
export function spotOf(id, seatX = 0.5) {
  const a = area(id);
  if (!a) return null;
  if (a.band) return { x: a.x + 60 + seatX * (a.w - 120), y: a.y + a.h / 2 };
  if (a.number) return { x: a.x + a.w / 2, y: a.y + a.h * 0.62 };
  return { x: a.x + a.w / 2, y: a.y + a.h / 2 };
}

export const FELT = '#0d4a32';
export const INK = '#e8cf8e';
export const INK_SOFT = 'rgba(232,207,142,0.55)';
const RED = '#c4203a';

// ---------- painting it ----------
function pips(ctx, x, y, s, n) {
  const P = { 1: [[0, 0]], 2: [[-1, -1], [1, 1]], 3: [[-1, -1], [0, 0], [1, 1]], 4: [[-1, -1], [1, -1], [-1, 1], [1, 1]], 5: [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]], 6: [[-1, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [1, 1]] }[n];
  // Printed in ivory with red pips, so the real red dice stand out on them.
  ctx.fillStyle = '#efe4c8';
  ctx.beginPath(); ctx.roundRect(x - s / 2, y - s / 2, s, s, s * 0.18); ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 2; ctx.stroke();
  ctx.fillStyle = RED;
  P.forEach(([dx, dy]) => { ctx.beginPath(); ctx.arc(x + dx * s * 0.27, y + dy * s * 0.27, s * 0.09, 0, Math.PI * 2); ctx.fill(); });
}
function text(ctx, t, x, y, size, color = INK, { font = 'Cinzel', weight = 700, spacing = 0, rot = 0 } = {}) {
  ctx.save();
  ctx.translate(x, y); ctx.rotate(rot);
  ctx.fillStyle = color;
  ctx.font = `${weight} ${size}px ${font === 'Cinzel' ? "'Cinzel', Georgia, serif" : font}`;
  if ('letterSpacing' in ctx) ctx.letterSpacing = spacing + 'px';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(t, 0, 0);
  ctx.restore();
}
/** Paints the whole layout over a BOARD_W × BOARD_H canvas. */
export function paintLayout(ctx, { felt = FELT } = {}) {
  const W = BOARD_W, H = BOARD_H;
  ctx.fillStyle = felt;
  ctx.fillRect(0, 0, W, H);
  // A soft pool of light in the middle of the cloth.
  const g = ctx.createRadialGradient(W / 2, H * 0.55, 100, W / 2, H * 0.55, W * 0.6);
  g.addColorStop(0, 'rgba(255,255,255,0.06)'); g.addColorStop(1, 'rgba(0,0,0,0.22)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = INK; ctx.lineWidth = 6; ctx.lineJoin = 'round';
  const frame = (a, r = 18) => { ctx.beginPath(); ctx.roundRect(a.x, a.y, a.w, a.h, r); ctx.stroke(); };
  // Pass line and its odds.
  frame(PASS, 40);
  text(ctx, 'PASS LINE', PASS.x + PASS.w / 2, PASS.y + PASS.h / 2 + 4, 74, INK, { spacing: 22 });
  frame(PASS_ODDS, 30);
  text(ctx, 'PASS ODDS', PASS_ODDS.x + PASS_ODDS.w / 2, PASS_ODDS.y + 44, 40, INK, { spacing: 6 });
  text(ctx, 'up to 3×', PASS_ODDS.x + PASS_ODDS.w / 2, PASS_ODDS.y + 88, 30, INK_SOFT, { font: 'Georgia, serif', weight: 400 });
  // Don't pass, barring the 12.
  frame(DONT, 26);
  text(ctx, "DON'T PASS BAR", DONT.x + DONT.w / 2 - 70, DONT.y + DONT.h / 2 + 3, 54, INK, { spacing: 12 });
  pips(ctx, DONT.x + DONT.w / 2 + 330, DONT.y + DONT.h / 2, 50, 6);
  pips(ctx, DONT.x + DONT.w / 2 + 392, DONT.y + DONT.h / 2, 50, 6);
  frame(DONT_ODDS, 26);
  text(ctx, 'LAY ODDS', DONT_ODDS.x + DONT_ODDS.w / 2, DONT_ODDS.y + 36, 38, INK, { spacing: 6 });
  text(ctx, 'up to 6×', DONT_ODDS.x + DONT_ODDS.w / 2, DONT_ODDS.y + 70, 26, INK_SOFT, { font: 'Georgia, serif', weight: 400 });
  // The field.
  frame(FIELD, 30);
  text(ctx, 'FIELD', FIELD.x + 170, FIELD.y + FIELD.h / 2 + 4, 70, INK, { spacing: 10 });
  const fieldNums = [['2', true, 'PAYS DOUBLE'], ['3'], ['4'], ['9'], ['10'], ['11'], ['12', true, 'PAYS TRIPLE']];
  fieldNums.forEach(([n, circle, note], i) => {
    const x = FIELD.x + 430 + i * 250, y = FIELD.y + FIELD.h / 2 - 8;
    if (circle) {
      ctx.save(); ctx.strokeStyle = INK; ctx.lineWidth = 5;
      ctx.beginPath(); ctx.arc(x, y, 50, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
      text(ctx, note, x, FIELD.y + FIELD.h - 22, 22, INK_SOFT, { font: 'Georgia, serif', weight: 700, spacing: 2 });
    }
    text(ctx, n, x, y + 4, 70, circle ? '#f6e3b4' : INK, { font: 'Georgia, serif', weight: 700 });
  });
  // The place numbers, SIX and NINE spelt out as they are on every table.
  PLACE.forEach((a) => {
    ctx.strokeRect(a.x, a.y, a.w, a.h);
    const label = a.number === 6 ? 'SIX' : a.number === 9 ? 'NINE' : String(a.number);
    text(ctx, label, a.x + a.w / 2, a.y + a.h * 0.5, label.length > 2 ? 92 : 130, a.number === 6 || a.number === 8 ? '#f6e3b4' : INK, { font: label.length > 2 ? 'Cinzel' : 'Georgia, serif', weight: 700 });
    const [p, q] = { 4: [9, 5], 5: [7, 5], 6: [7, 6], 8: [7, 6], 9: [7, 5], 10: [9, 5] }[a.number];
    text(ctx, `PLACE ${p} TO ${q}`, a.x + a.w / 2, a.y + a.h - 28, 26, INK_SOFT, { font: 'Georgia, serif', weight: 700, spacing: 2 });
  });
  // The propositions.
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.16)';
  ctx.beginPath(); ctx.roundRect(PROP_BOX.x - 14, PROP_BOX.y - 14, PROP_BOX.w + 28, PROP_BOX.h + 28, 26); ctx.fill();
  ctx.restore();
  ctx.lineWidth = 4;
  PROPS.forEach((a) => {
    ctx.strokeRect(a.x, a.y, a.w, a.h);
    const cx = a.x + a.w / 2, cy = a.y + a.h / 2;
    if (a.id === 'any7') { text(ctx, 'SEVEN', cx - 150, cy + 3, 48, '#ff6b7f', { spacing: 10 }); text(ctx, '4 TO 1', cx + 220, cy + 3, 36, INK); }
    else if (a.id === 'anycraps') { text(ctx, 'ANY CRAPS', cx - 120, cy + 3, 40, '#ff6b7f', { spacing: 8 }); text(ctx, '7 TO 1', cx + 240, cy + 3, 32, INK); }
    else if (a.id.startsWith('hard')) {
      pips(ctx, cx - 112, cy - 4, 56, a.dice[0]); pips(ctx, cx - 50, cy - 4, 56, a.dice[1]);
      text(ctx, `${a.id === 'hard6' || a.id === 'hard8' ? 9 : 7} TO 1`, cx + 100, cy - 14, 36, INK);
      text(ctx, 'HARD ' + a.id.slice(4), cx + 100, cy + 26, 22, INK_SOFT, { font: 'Georgia, serif', weight: 700, spacing: 2 });
    } else {
      pips(ctx, cx - 30, cy - 18, 42, a.dice[0]); pips(ctx, cx + 30, cy - 18, 42, a.dice[1]);
      text(ctx, `${a.id === 'aces' || a.id === 'twelve' ? 30 : 15} TO 1`, cx, cy + 30, 28, INK);
    }
  });
  // The house's name, either side of the propositions.
  text(ctx, 'NVGR', 455, 210, 96, INK, { spacing: 18 });
  text(ctx, 'CASINO', 455, 296, 40, INK_SOFT, { spacing: 16 });
  text(ctx, 'CRAPS', 1945, 210, 82, INK, { spacing: 16 });
  text(ctx, 'ODDS 3× · LAY 6×', 1945, 296, 30, INK_SOFT, { font: 'Georgia, serif', weight: 700, spacing: 3 });
}
