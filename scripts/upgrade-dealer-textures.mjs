// Gives the dealers their full-resolution textures back. The dealer GLBs
// (scripts/import-rocketbox.mjs, transplant-head.mjs) were built with their
// Rocketbox textures cut to 1024px and the specular maps left out; this
// keeps each model exactly as it is (mesh, skeleton, transplanted heads,
// badges) and replaces its textures with the originals from Microsoft
// Rocketbox (MIT licence, github.com/microsoft/Microsoft-Rocketbox) at
// 2048px: colour, normal, and the specular map turned into roughness, so
// skin, cloth and hair catch the light as their own material does.
//
// A material is named for its texture set (m015_body, f019_head, …), which
// says which files it needs. A uniform that was re-dyed (dealer-recolor.mjs)
// is dyed again with whichever recipe brings the new sheet closest to the
// old one, so every dealer keeps the colours it has now.
//
//   node scripts/upgrade-dealer-textures.mjs [file …]   (default: every rb_dealer_*.glb)
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync, readdirSync, rmSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import sharp from 'sharp';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer';
import { recolor, RECIPES } from './dealer-recolor.mjs';

const SIZE = 2048;
const DIR = 'public/models/characters';
const RAW = 'https://raw.githubusercontent.com/microsoft/Microsoft-Rocketbox/master/';
const files = process.argv.slice(2).length ? process.argv.slice(2) : readdirSync(DIR).filter((f) => /^rb_dealer_.*\.glb$/.test(f)).map((f) => join(DIR, f));

await MeshoptDecoder.ready;
await MeshoptEncoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder });

// Where each texture set the dealers wear lives in the library (found by
// probing the avatars' folders; the whole tree is too big to list at once).
const FOLDER = {
  f002: 'Adults/Female_Adult_02', f011: 'Adults/Female_Adult_11', f018: 'Adults/Female_Adult_15', f019: 'Adults/Female_Adult_13',
  m004: 'Adults/Male_Adult_03', m013: 'Adults/Male_Adult_07', m014: 'Adults/Male_Adult_08', m015: 'Professions/Business_Male_04',
  m025: 'Professions/Business_Male_06', m027: 'Adults/Male_Adult_20',
};
const pathOf = { get: (key) => { const f = FOLDER[key.split('_')[0]]; return f ? `Assets/Avatars/${f}/Textures/${key}.tga` : null; } };

// Downloads go in a fresh directory of their own, each file once.
const work = mkdtempSync(join(tmpdir(), 'rocketbox-hd-'));
const got = new Map();
async function fetchTga(key) {
  if (got.has(key)) return got.get(key);
  const path = pathOf.get(key);
  if (!path) { got.set(key, null); return null; }
  const file = join(work, key + '.tga');
  if (!existsSync(file)) {
    process.stdout.write(`  ${key}… `);
    const res = await fetch(RAW + path.split('/').map(encodeURIComponent).join('/'));
    if (res.status === 404) { got.set(key, null); console.log('none'); return null; }
    if (!res.ok) throw new Error(`${res.status} ${path}`);
    writeFileSync(file, Buffer.from(await res.arrayBuffer()));
    console.log((statSync(file).size / 1048576).toFixed(1) + 'MB');
  }
  got.set(key, file);
  return file;
}
// Uncompressed true-colour TGA (type 2), 24 or 32 bit, to raw RGB(A).
function decodeTga(file) {
  const b = readFileSync(file);
  const type = b[2], width = b.readUInt16LE(12), height = b.readUInt16LE(14), bpp = b[16], desc = b[17];
  if (type !== 2 || (bpp !== 24 && bpp !== 32)) throw new Error(`unsupported TGA (type ${type}, ${bpp}bpp): ${file}`);
  const channels = bpp / 8, offset = 18 + b[0], topDown = (desc & 0x20) !== 0;
  const px = Buffer.alloc(width * height * channels);
  for (let y = 0; y < height; y++) {
    const sr = topDown ? y : height - 1 - y;
    for (let x = 0; x < width; x++) {
      const s = offset + (sr * width + x) * channels, d = (y * width + x) * channels;
      px[d] = b[s + 2]; px[d + 1] = b[s + 1]; px[d + 2] = b[s];
      if (channels === 4) px[d + 3] = b[s + 3];
    }
  }
  return { px, width, height, channels };
}
const png = (img, size = SIZE) => sharp(img.px, { raw: { width: img.width, height: img.height, channels: img.channels } }).resize(size, size, { kernel: 'lanczos3' }).png().toBuffer();
// The mean colour of an image, small, for comparing sheets.
async function meanOf(buf, isRaw) {
  const s = isRaw ? sharp(buf.px, { raw: { width: buf.width, height: buf.height, channels: buf.channels } }) : sharp(buf);
  const { channels } = await s.stats();
  return channels.slice(0, 3).map((c) => c.mean);
}
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
// Roughness from a specular sheet: shiny where it is bright. glTF keeps
// roughness in the green channel of the metal-rough texture.
function roughnessFrom(spec) {
  const { px, width, height, channels } = spec;
  const out = Buffer.alloc(width * height * 3);
  for (let i = 0, j = 0; i < px.length; i += channels, j += 3) {
    const s = (px[i] + px[i + 1] + px[i + 2]) / 3 / 255;
    out[j] = 255; out[j + 1] = Math.round(255 * Math.min(0.92, Math.max(0.45, 0.88 - s * 0.42))); out[j + 2] = 0;
  }
  return { px: out, width, height, channels: 3 };
}

// Dyed pixel by pixel, a waistcoat's brightest weave threads cross into
// the shirt's range and come out as white specks. A speck is a shirt pixel
// with little shirt round it: those are dyed the waistcoat's colour too.
async function despeckle(img, plain, recipe) {
  const { width, height, channels } = img;
  const shirt = Buffer.alloc(width * height);
  for (let i = 0, j = 0; j < shirt.length; i += channels, j++) {
    const l = (Math.max(plain[i], plain[i + 1], plain[i + 2]) + Math.min(plain[i], plain[i + 1], plain[i + 2])) / 510;
    shirt[j] = l > recipe.split ? 255 : 0;
  }
  const around = await sharp(shirt, { raw: { width, height, channels: 1 } }).blur(Math.max(1.5, width / 700)).raw().toBuffer();
  for (let i = 0, j = 0; j < shirt.length; i += channels, j++) {
    if (!shirt[j] || around[j] > 100) continue;
    const r = plain[i], g = plain[i + 1], b = plain[i + 2];
    if (r > g + 18 && r > b + 30 && r > 110) continue; // skin
    const l = (Math.max(r, g, b) + Math.min(r, g, b)) / 510;
    const k = Math.pow(l / 0.18, 0.9);
    for (let c = 0; c < 3; c++) img.px[i + c] = Math.min(255, recipe.dark[c] * k);
  }
}

// The parts of a body sheet that are only ever shirt, as [x0, y0, x1, y1]
// fractions of the sheet from its top left: Business_Male_04's sleeves.
const SHIRT = { m015_body: [[0.0, 0.42, 0.3, 0.83], [0.7, 0.42, 1.0, 0.83]] };
function whiten(img, plain, rects, light) {
  const { width, height, channels } = img;
  rects.forEach(([x0, y0, x1, y1]) => {
    for (let y = Math.floor(y0 * height); y < Math.ceil(y1 * height); y++) {
      for (let x = Math.floor(x0 * width); x < Math.ceil(x1 * width); x++) {
        const i = (y * width + x) * channels;
        const r = plain[i], g = plain[i + 1], b = plain[i + 2];
        // Skin (the hands at the sleeve's end) is left alone.
        if (r > g + 18 && r > b + 30 && r > 90) continue;
        const l = (Math.max(r, g, b) + Math.min(r, g, b)) / 510;
        const k = Math.min(1.08, Math.pow(Math.max(0.05, l) / 0.34, 0.85));
        img.px[i] = Math.min(255, light[0] * k); img.px[i + 1] = Math.min(255, light[1] * k); img.px[i + 2] = Math.min(255, light[2] * k);
      }
    }
  });
}

for (const file of files) {
  console.log(`\n${file}`);
  const doc = await io.read(file);
  for (const mat of doc.getRoot().listMaterials()) {
    const key = mat.getName().toLowerCase();
    if (key.endsWith('_opacity')) {
      const f = await fetchTga(key + '_color');
      if (f) mat.setBaseColorTexture(doc.createTexture(key + '_color').setImage(await png(decodeTga(f))).setMimeType('image/png'));
      continue;
    }
    const colorFile = await fetchTga(key + '_color');
    if (!colorFile) { console.log('  (no source for ' + key + ', kept)'); continue; }
    let color = decodeTga(colorFile);
    // A dyed uniform: dyed again with the recipe nearest what it is now.
    if (key.endsWith('_body') && mat.getBaseColorTexture()) {
      const now = await meanOf(mat.getBaseColorTexture().getImage(), false);
      let best = null, bestD = dist(await meanOf(color, true), now);
      for (const name of Object.keys(RECIPES)) {
        const trial = { ...color, px: Buffer.from(color.px) };
        recolor(trial.px, trial.channels, name);
        const d = dist(await meanOf(trial, true), now);
        if (d < bestD) { best = name; bestD = d; }
      }
      if (best) {
        const plain = Buffer.from(color.px);
        recolor(color.px, color.channels, best);
        if (RECIPES[best].light) await despeckle(color, plain, RECIPES[best]);
        // Where the sheet is all shirt (the sleeves), shirt it stays: dyed
        // by brightness alone, its folds and shadows took the waistcoat's
        // colour as streaks. White there, with the cloth's own shading.
        const shirt = SHIRT[key];
        if (shirt && RECIPES[best].light) whiten(color, plain, shirt, RECIPES[best].light);
        console.log(`  ${key}: dyed ${best}${shirt ? ' (sleeves kept white)' : ''}`);
      }
    }
    mat.setBaseColorTexture(doc.createTexture(key + '_color').setImage(await png(color)).setMimeType('image/png'));
    const normalFile = await fetchTga(key + '_normal');
    if (normalFile) mat.setNormalTexture(doc.createTexture(key + '_normal').setImage(await png(decodeTga(normalFile))).setMimeType('image/png'));
    const specFile = await fetchTga(key + '_specular');
    if (specFile) {
      mat.setMetallicRoughnessTexture(doc.createTexture(key + '_rough').setImage(await png(roughnessFrom(decodeTga(specFile)), SIZE / 2)).setMimeType('image/png'));
      mat.setMetallicFactor(0).setRoughnessFactor(1);
    }
  }
  const tmp = join(work, 'out.glb');
  await io.write(tmp, doc);
  execFileSync('npx', ['gltf-transform', 'optimize', tmp, file, '--compress', 'meshopt', '--texture-compress', 'webp', '--texture-size', String(SIZE), '--simplify', 'false'], { stdio: 'pipe', shell: process.platform === 'win32' });
  console.log(`  -> ${(statSync(file).size / 1048576).toFixed(2)}MB`);
}
rmSync(work, { recursive: true, force: true });
console.log('\ndone');
