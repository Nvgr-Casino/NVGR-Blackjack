// Renders the card faces the table uses from the vector deck in art/cards-svg.
//
// The deck is Byron Knoll's Vector Playing Cards (public domain), as
// collected at github.com/notpeter/Vector-Playing-Cards. The court cards are
// up to a megabyte of SVG each — too much to download and rasterise in the
// browser on every visit — so they are rendered once, here, to small WebP
// images that ship with the game.
//
// Each card is rendered at high density, fitted to a real poker card's
// proportions (the artwork is drawn at 1 : 1.452, a poker card is 1 : 1.4 —
// a squash of under 4% that nobody can see) and flattened onto white card
// stock. The artwork carries a thin black outline, which a printed card
// doesn't have, so that is trimmed off; and its indices sit tight to the
// edge, so it is inset in a margin of plain stock, where a printed card's
// would be. The card geometry rounds the corners itself.
//
// Run with `npm run cards` after changing anything in art/cards-svg.
import { readdirSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';

const SRC = 'art/cards-svg';
const OUT = 'public/cards';
const WIDTH = 640;
const HEIGHT = Math.round(WIDTH * (88.9 / 63.5));
// The outline to trim, and the stock margin to add, as fractions of size.
const TRIM = 0.006;
const MARGIN = 0.03;
// Pure white, to match the white the artwork itself is drawn on.
const STOCK = '#ffffff';

// Card stock everywhere outside a rounded rectangle the size of the art.
function cornerMask(w, h) {
  const r = Math.round(w * 0.06);
  const d = `M0 0H${w}V${h}H0Z M${r} 0H${w - r}A${r} ${r} 0 0 1 ${w} ${r}V${h - r}A${r} ${r} 0 0 1 ${w - r} ${h}`
    + `H${r}A${r} ${r} 0 0 1 0 ${h - r}V${r}A${r} ${r} 0 0 1 ${r} 0Z`;
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><path fill="${STOCK}" fill-rule="evenodd" d="${d}"/></svg>`);
}

mkdirSync(OUT, { recursive: true });

const files = readdirSync(SRC).filter((f) => /^(10|[2-9AJQK])[CDHS]\.svg$/.test(f));
for (const file of files) {
  const rank = file.slice(0, -5);
  const suit = file.slice(-5, -4);
  const { data, info } = await sharp(join(SRC, file), { density: 600 })
    .flatten({ background: STOCK })
    .toBuffer({ resolveWithObject: true });
  const dx = Math.round(info.width * TRIM);
  const dy = Math.round(info.height * TRIM);
  const padX = Math.round(WIDTH * MARGIN);
  const padY = Math.round(HEIGHT * MARGIN);
  const w = WIDTH - padX * 2;
  const h = HEIGHT - padY * 2;
  const trimmed = await sharp(data)
    .extract({ left: dx, top: dy, width: info.width - dx * 2, height: info.height - dy * 2 })
    .resize(w, h, { fit: 'fill', kernel: 'lanczos3' })
    .toBuffer();
  await sharp(trimmed)
    // Trimming straightens the outline off the sides but leaves its curved
    // corners behind; stock painted round a rounded rectangle covers them.
    .composite([{ input: cornerMask(w, h) }])
    .extend({ top: padY, bottom: padY, left: padX, right: padX, background: STOCK })
    .webp({ quality: 90, smartSubsample: true })
    .toFile(join(OUT, `${rank}-${suit}.webp`));
}
console.log(`Rendered ${files.length} cards to ${OUT} at ${WIDTH}x${HEIGHT}.`);
