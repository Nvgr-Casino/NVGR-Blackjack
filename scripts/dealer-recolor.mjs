// Re-dyes a Rocketbox body texture into a house uniform, for the dealers
// at the higher-limit tables (see src/scene/dealer.js). Rocketbox has no
// formal-wear avatars, but it has dealers' waistcoats in grey; these turn
// one into black or burgundy over a white shirt, or a brown knit dress into
// a black one. Skin is left alone.
//
// Each recipe works on raw RGB(A) pixels, by colour alone: what is skin is
// warm, saturated and light; of the cloth, the darker tones are the
// waistcoat (and trousers, out of sight behind the table) and the lighter
// ones the shirt. The cloth's own shading is kept, so folds and stitching
// still read.

function hsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h;
  if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return [h * 60, s, l];
}

const BAND = 0.04;
const smoothstep = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

const isSkin = (h, s, l) => h < 50 && s > 0.2 && l > 0.43;

// Shade `[r, g, b]` by the pixel's own lightness relative to `mid`.
const dye = (rgb, l, mid, gain = 1) => rgb.map((c) => Math.max(0, Math.min(255, c * Math.pow(l / mid, gain))));

export const RECIPES = {
  // A grey waistcoat over a grey shirt: the waistcoat black, the shirt white.
  // Measured on Business_Male_04: waistcoat 0.15-0.2 lightness, shirt
  // 0.27-0.38, trousers 0.12.
  'black-vest': { split: 0.215, dark: [26, 25, 28], light: [238, 238, 236] },
  'burgundy-vest': { split: 0.215, dark: [96, 18, 32], light: [238, 236, 232] },
  // Everything that isn't skin goes to the one colour.
  'black-all': { split: 1.01, dark: [24, 23, 27] },
  'black-dress': { split: 1.01, dark: [22, 20, 26] },
};

/** Re-dyes `pixels` (RGB or RGBA, `channels` per pixel) in place. */
export function recolor(pixels, channels, recipeName) {
  const recipe = RECIPES[recipeName];
  if (!recipe) throw new Error('unknown recipe ' + recipeName);
  for (let i = 0; i < pixels.length; i += channels) {
    const r = pixels[i], g = pixels[i + 1], b = pixels[i + 2];
    const [h, s, l] = hsl(r, g, b);
    if (l < 0.02 || isSkin(h, s, l)) continue;
    // Darker cloth is the waistcoat, shaded about the middle of its own
    // range so folds stay; lighter cloth the shirt. Blended across a narrow
    // band at the split, or the seam between them speckles.
    const dark = dye(recipe.dark, l, recipe.split * 0.7, 0.8);
    const t = recipe.light ? smoothstep(recipe.split - BAND, recipe.split + BAND, l) : 0;
    const light = t > 0 ? dye(recipe.light, l, recipe.split + 0.08, 0.35) : dark;
    for (let c = 0; c < 3; c++) pixels[i + c] = Math.round(dark[c] + (light[c] - dark[c]) * t);
  }
  return pixels;
}
