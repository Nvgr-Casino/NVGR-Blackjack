// The Android app's launcher icons and splash screens. The icons are the
// Golden Ace art (assets-src/golden-ace-icon.png: a gold-rimmed ace of
// spades fanned over a second card, on crimson velvet), as the classic
// square and round icons and, with the cards drawn smaller so the
// launcher's mask never clips them, as the adaptive icon's layer. The
// splash, shown while the game loads, is NVGR Casino's logo on black,
// before the game's own "NVGR Casino presents" opening.
//
//   node scripts/android-assets.mjs
import sharp from 'sharp';
import { readdirSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const LOGO = 'src/assets/nvgr-logo.png';
const ICON = 'assets-src/golden-ace-icon.png';
const ADAPTIVE = 'assets-src/golden-ace-adaptive.png';
const RES = 'android/app/src/main/res';
const BLACK = { r: 0, g: 0, b: 0, alpha: 1 };
const DENSITY = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };

for (const [name, k] of Object.entries(DENSITY)) {
  const dir = join(RES, `mipmap-${name}`);
  const legacy = Math.round(48 * k);
  await sharp(ICON).resize(legacy).png().toFile(join(dir, 'ic_launcher.png'));
  const circle = Buffer.from(`<svg width="${legacy}" height="${legacy}"><circle cx="${legacy / 2}" cy="${legacy / 2}" r="${legacy / 2}"/></svg>`);
  await sharp(await sharp(ICON).resize(legacy).png().toBuffer()).composite([{ input: circle, blend: 'dest-in' }]).png().toFile(join(dir, 'ic_launcher_round.png'));
  // Adaptive: a full-bleed 108dp layer; the mask keeps its middle 72dp.
  const fg = Math.round(108 * k);
  await sharp(ADAPTIVE).resize(fg).png().toFile(join(dir, 'ic_launcher_foreground.png'));
}
// The adaptive icon's background, and no stock vector foreground to shadow ours.
writeFileSync(join(RES, 'values/ic_launcher_background.xml'), '<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">#0C0205</color>\n</resources>\n');
const stock = join(RES, 'drawable-v24/ic_launcher_foreground.xml');
if (existsSync(stock)) rmSync(stock);

// Splashes: the logo on black at 60% of the screen's short side.
for (const dir of readdirSync(RES).filter((d) => d.startsWith('drawable'))) {
  const file = join(RES, dir, 'splash.png');
  if (!existsSync(file)) continue;
  const { width, height } = await sharp(file).metadata();
  const logo = await sharp(LOGO).resize(Math.round(Math.min(width, height) * 0.6)).png().toBuffer();
  const out = await sharp({ create: { width, height, channels: 4, background: BLACK } }).composite([{ input: logo, gravity: 'centre' }]).png().toBuffer();
  writeFileSync(file, out);
}
console.log('icons and splashes written');
