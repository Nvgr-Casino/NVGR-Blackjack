// The Android app's launcher icons and splash screens, all drawn from the
// casino's logo (src/assets/nvgr-logo.png, gold on black): the classic
// square and round icons, the adaptive icon's foreground (the logo inside
// the safe circle Android's masks keep) on a black background, and a
// splash of the logo centred on black for every screen density and
// orientation the Android project ships.
//
//   node scripts/android-assets.mjs
import sharp from 'sharp';
import { readdirSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const LOGO = 'src/assets/nvgr-logo.png';
const RES = 'android/app/src/main/res';
const BLACK = { r: 0, g: 0, b: 0, alpha: 1 };
const DENSITY = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };

// The logo at `size`, centred on a black square of `canvas`.
const onBlack = async (canvas, size) => sharp({ create: { width: canvas, height: canvas, channels: 4, background: BLACK } })
  .composite([{ input: await sharp(LOGO).resize(Math.round(size)).png().toBuffer(), gravity: 'centre' }])
  .png();

for (const [name, k] of Object.entries(DENSITY)) {
  const dir = join(RES, `mipmap-${name}`);
  const legacy = Math.round(48 * k);
  // Square: the logo nearly edge to edge on black.
  await (await onBlack(legacy, legacy * 0.96)).toFile(join(dir, 'ic_launcher.png'));
  // Round: the same, cut to a circle.
  const circle = Buffer.from(`<svg width="${legacy}" height="${legacy}"><circle cx="${legacy / 2}" cy="${legacy / 2}" r="${legacy / 2}"/></svg>`);
  await sharp(await (await onBlack(legacy, legacy * 0.92)).toBuffer()).composite([{ input: circle, blend: 'dest-in' }]).png().toFile(join(dir, 'ic_launcher_round.png'));
  // Adaptive foreground: 108dp, with the logo inside the 72dp the masks keep.
  const fg = Math.round(108 * k);
  await (await onBlack(fg, fg * (72 / 108))).toFile(join(dir, 'ic_launcher_foreground.png'));
}
// The adaptive icon's background, and no stock vector foreground to shadow ours.
writeFileSync(join(RES, 'values/ic_launcher_background.xml'), '<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">#000000</color>\n</resources>\n');
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
