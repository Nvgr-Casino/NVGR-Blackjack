// The NVGR Casino house crest as a canvas drawing — the same crown /
// wordmark / rule / CASINO lockup the site draws as SVG (see casinoMark in
// src/app/uiHelpers.js), kept to the same geometry so the felt, the room
// and the web pages all read as one brand.
//
// It lives here rather than inside the felt because the room's walls need
// the identical mark; two hand-copied versions would drift apart the first
// time the brand is touched.

// Rule-to-rule width in the crest's own drawing units, and the point in
// those units that counts as its centre.
export const CREST_W = 328;
const CENTER_X = 280;
const CENTER_Y = 111;

// One font for the whole mark — Cinzel, a classic Roman-inscription serif.
export function crestFont(px, weight = 600) {
  return `${weight} ${px}px 'Cinzel', Georgia, serif`;
}

/**
 * Paints the crest centred on (x, y), scaled so it measures `width` across.
 *
 * `foreshorten` stretches the vertical axis. A surface read at a shallow
 * grazing angle — the felt, which the camera looks along rather than at —
 * squashes a stacked lockup like this into itself until the crown lands in
 * the middle of the wordmark; pre-stretching cancels that out. Anything
 * viewed face-on, like a wall, wants the default 1.
 */
export function drawCasinoCrest(ctx, { x, y, width, alpha = 1, rgb = '255,236,176', foreshorten = 1 }) {
  const s = width / CREST_W;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s * foreshorten);
  ctx.translate(-CENTER_X, -CENTER_Y);
  ctx.fillStyle = `rgba(${rgb},${alpha})`;

  // Crown
  ctx.save();
  ctx.translate(280, 2);
  ctx.scale(1.16, 1.16);
  ctx.beginPath();
  ctx.moveTo(-47, 50); ctx.lineTo(-47, 15); ctx.lineTo(-23, 37); ctx.lineTo(0, 5);
  ctx.lineTo(23, 37); ctx.lineTo(47, 15); ctx.lineTo(47, 50); ctx.closePath();
  ctx.fill();
  ctx.beginPath(); ctx.roundRect(-52, 53, 104, 13, 4); ctx.fill();
  [[-47, 11, 5.5], [0, 1, 6.5], [47, 11, 5.5]].forEach(([jx, jy, jr]) => {
    ctx.beginPath(); ctx.arc(jx, jy, jr, 0, Math.PI * 2); ctx.fill();
  });
  [-24, 24].forEach((dx) => {
    ctx.beginPath();
    ctx.moveTo(dx, 57); ctx.lineTo(dx + 5, 62); ctx.lineTo(dx, 67); ctx.lineTo(dx - 5, 62);
    ctx.closePath(); ctx.fill();
  });
  ctx.restore();

  // Wordmark
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.letterSpacing = '6px';
  ctx.font = crestFont(88, 700);
  ctx.fillText('NVGR', 283, 152);

  // Rule with a centre diamond
  ctx.fillRect(116, 174, 134, 2.2);
  ctx.fillRect(310, 174, 134, 2.2);
  ctx.beginPath();
  ctx.moveTo(280, 167); ctx.lineTo(288, 175); ctx.lineTo(280, 183); ctx.lineTo(272, 175);
  ctx.closePath(); ctx.fill();

  ctx.letterSpacing = '18px';
  ctx.font = crestFont(29, 600);
  ctx.fillText('CASINO', 289, 213);
  ctx.letterSpacing = '0px';
  ctx.restore();
}

/**
 * The crest on a plate: brass on black lacquer within a fine brass border —
 * for the bar front, the shoe, a dealer's name badge. `w` by `h` are the
 * plate's proportions; returns a canvas to make a texture from.
 */
export function crestPlateCanvas(w, h, { background = '#121114', rgb = '216,180,110', px = 1024 } = {}) {
  const canvas = document.createElement('canvas');
  canvas.width = px;
  canvas.height = Math.max(8, Math.round((px * h) / w));
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const inset = Math.max(4, canvas.height * 0.06);
  ctx.strokeStyle = `rgba(${rgb},0.8)`;
  ctx.lineWidth = Math.max(2, canvas.height * 0.015);
  ctx.strokeRect(inset, inset, canvas.width - inset * 2, canvas.height - inset * 2);
  drawCasinoCrest(ctx, {
    x: canvas.width / 2, y: canvas.height / 2 + canvas.height * 0.03,
    width: Math.min(canvas.width * 0.8, canvas.height * 1.35), alpha: 0.95, rgb,
  });
  return canvas;
}
