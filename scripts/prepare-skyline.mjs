// Prepares the Penthouse's view from a panorama photograph:
//
//   node scripts/prepare-skyline.mjs <photo.jpg>
//
// Writes two copies to public/assets/skyline/ — 8192 px wide for screens
// that can take a texture that size, 4096 for phones — with a gentle lift
// in contrast and colour so the city's lights read through the glass, the
// black sky given the deep blue glow a city throws up into it at night,
// and the photograph's own metadata (camera, place) left behind.
import sharp from 'sharp';
import { mkdirSync, statSync } from 'node:fs';

const src = process.argv[2];
if (!src) {
  console.error('usage: node scripts/prepare-skyline.mjs <photo.jpg>');
  process.exit(1);
}
const OUT = 'public/assets/skyline';
mkdirSync(OUT, { recursive: true });
// Where the horizon is, from the top (room.js's PHOTO_HORIZON).
const HORIZON = 0.452;
for (const [width, name] of [[8192, 'night_skyline_ny.webp'], [4096, 'night_skyline_ny_4k.webp']]) {
  const dst = `${OUT}/${name}`;
  const graded = await sharp(src)
    .resize({ width })
    .modulate({ brightness: 1.06, saturation: 1.12 })
    .linear(1.08, -4)
    .toBuffer({ resolveWithObject: true });
  const { width: w, height: h } = graded.info;
  // The glow: deep blue at the horizon, fading to night overhead; screened
  // on, so the lights on the horizon are untouched and only the black lifts.
  const glow = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
    <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#05060c"/>
      <stop offset="${(HORIZON * 0.55).toFixed(3)}" stop-color="#0b1022"/>
      <stop offset="${(HORIZON * 0.96).toFixed(3)}" stop-color="#2a2f52"/>
      <stop offset="${(HORIZON * 1.03).toFixed(3)}" stop-color="#1a1d33"/>
      <stop offset="${(HORIZON * 1.15).toFixed(3)}" stop-color="#000000"/>
      <stop offset="1" stop-color="#000000"/>
    </linearGradient></defs>
    <rect width="100%" height="100%" fill="url(#g)"/>
  </svg>`);
  await sharp(graded.data)
    .composite([{ input: glow, blend: 'screen' }])
    .webp({ quality: 84 })
    .toFile(dst);
  const meta = await sharp(dst).metadata();
  console.log(`${name}: ${meta.width}x${meta.height}, ${(statSync(dst).size / 1024).toFixed(0)} KB`);
}
