// Prepares the Space Shuttle for the crash game: the Smithsonian's 3D scan
// of the orbiter Discovery (National Air and Space Museum, released CC0:
// https://3d.si.edu/object/3d/orbiter-space-shuttle-ov-103-discovery:d8c636ce-4ebc-11ea-b77f-2e728ce88125),
// its 150k-triangle, 4K-texture version.
//
//   node scripts/prepare-shuttle.mjs <discovery.glb> <out.glb>
//
// The scan carries the real orbiter's NASA insignia and US flags. Those are
// the only strongly coloured things on a black, white and grey craft, so
// they are found by their colour, and filled from the white tiles round
// them (each masked pixel takes a weighted average of the unmasked pixels
// near it, widening until it finds some). Its landing gear, down as it
// stands in the museum, is cut away (shuttle-gear.mjs). Then the textures are brought to
// a size a phone draws comfortably and the mesh packed.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import sharp from 'sharp';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { cutGear } from './shuttle-gear.mjs';

const [input, output] = process.argv.slice(2);
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const doc = await io.read(input);
console.log(cutGear(doc));
const mat = doc.getRoot().listMaterials()[0];
const tex = mat.getBaseColorTexture();

const { data, info } = await sharp(Buffer.from(tex.getImage())).removeAlpha().raw().toBuffer({ resolveWithObject: true });
const W = info.width, H = info.height, N = W * H;

// Strongly coloured pixels: the insignia's blue, the flag's red and blue.
let mask = new Uint8Array(N);
for (let i = 0, j = 0; j < N; i += 3, j++) {
  const r = data[i], g = data[i + 1], b = data[i + 2];
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
  if (mx > 50 && (mx - mn) / mx > 0.4) mask[j] = 1;
}
// Grown by a few pixels, to take the anti-aliased edges and the white
// lettering and stars inside the insignia.
function dilate(m, r) {
  const out = new Uint8Array(N);
  const tmp = new Uint8Array(N);
  for (let y = 0; y < H; y++) {
    let run = 0;
    for (let x = 0; x < W; x++) { if (m[y * W + x]) run = r + 1; if (run > 0) { tmp[y * W + x] = 1; run--; } }
    run = 0;
    for (let x = W - 1; x >= 0; x--) { if (m[y * W + x]) run = r + 1; if (run > 0) { tmp[y * W + x] = 1; run--; } }
  }
  for (let x = 0; x < W; x++) {
    let run = 0;
    for (let y = 0; y < H; y++) { if (tmp[y * W + x]) run = r + 1; if (run > 0) { out[y * W + x] = 1; run--; } }
    run = 0;
    for (let y = H - 1; y >= 0; y--) { if (tmp[y * W + x]) run = r + 1; if (run > 0) { out[y * W + x] = 1; run--; } }
  }
  return out;
}
// Only clusters big enough to be markings, not the odd coloured speck of
// grime: blocks of 32x32 with at least 40 coloured pixels.
const B = 32;
const keep = new Uint8Array(N);
for (let by = 0; by < H; by += B) for (let bx = 0; bx < W; bx += B) {
  let n = 0;
  for (let y = by; y < Math.min(H, by + B); y++) for (let x = bx; x < Math.min(W, bx + B); x++) n += mask[y * W + x];
  if (n >= 40) for (let y = Math.max(0, by - B); y < Math.min(H, by + 2 * B); y++) for (let x = Math.max(0, bx - B); x < Math.min(W, bx + 2 * B); x++) if (mask[y * W + x]) keep[y * W + x] = 1;
}
mask = dilate(keep, 10);
let masked = 0; for (let j = 0; j < N; j++) masked += mask[j];

// Fill: normalised box blur of the unmasked image, at growing radii, each
// masked pixel taking the first radius that reaches unmasked pixels.
function boxBlur(src, rad) {
  const tmp = new Float32Array(N), out = new Float32Array(N);
  for (let y = 0; y < H; y++) {
    let acc = 0; const row = y * W;
    for (let x = -rad; x <= rad; x++) acc += src[row + Math.min(W - 1, Math.max(0, x))];
    for (let x = 0; x < W; x++) {
      tmp[row + x] = acc;
      acc += src[row + Math.min(W - 1, x + rad + 1)] - src[row + Math.max(0, x - rad)];
    }
  }
  for (let x = 0; x < W; x++) {
    let acc = 0;
    for (let y = -rad; y <= rad; y++) acc += tmp[Math.min(H - 1, Math.max(0, y)) * W + x];
    for (let y = 0; y < H; y++) {
      out[y * W + x] = acc;
      acc += tmp[Math.min(H - 1, y + rad + 1) * W + x] - tmp[Math.max(0, y - rad) * W + x];
    }
  }
  return out;
}
const weight = new Float32Array(N);
for (let j = 0; j < N; j++) weight[j] = mask[j] ? 0 : 1;
const done = new Uint8Array(N);
for (const rad of [12, 24, 48, 96]) {
  const w = boxBlur(weight, rad);
  const chans = [0, 1, 2].map((c) => {
    const ch = new Float32Array(N);
    for (let j = 0; j < N; j++) ch[j] = weight[j] * data[j * 3 + c];
    return boxBlur(ch, rad);
  });
  for (let j = 0; j < N; j++) {
    if (!mask[j] || done[j] || w[j] < 1) continue;
    // A touch of the tile texture's own grain, so the fill is not flat.
    const n = (Math.random() - 0.5) * 6;
    for (let c = 0; c < 3; c++) data[j * 3 + c] = Math.max(0, Math.min(255, chans[c][j] / w[j] + n));
    done[j] = 1;
  }
}
const png = await sharp(data, { raw: { width: W, height: H, channels: 3 } }).png().toBuffer();
tex.setImage(png).setMimeType('image/png');
console.log(`markings cleaned: ${masked} pixels (${((masked / N) * 100).toFixed(2)}% of the texture)`);

const work = mkdtempSync(join(tmpdir(), 'nvgr-shuttle-'));
const mid = join(work, 'mid.glb');
await io.write(mid, doc);
execFileSync('npx', ['gltf-transform', 'optimize', mid, output, '--compress', 'meshopt', '--texture-compress', 'webp', '--texture-size', '2048', '--simplify', 'false'], { stdio: 'pipe', shell: process.platform === 'win32' });
rmSync(work, { recursive: true, force: true });
console.log(`${output}: ${(statSync(output).size / 1048576).toFixed(2)} MB`);
