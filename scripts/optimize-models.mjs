// Compresses every model under public/models in place.
//
// This is what buys the headroom for better-looking characters. Rigged
// human models are dominated by their textures, and shipping them raw is
// what makes "realistic" and "runs on a phone" look like a choice between
// two things. Meshopt-compressed geometry with resized WebP textures took
// the current cast from 17.1MB to 4.7MB with no mesh simplification at
// all, so nothing was given up to get it.
//
// Mesh simplification is deliberately off: it is the one step here that
// actually removes detail, and detail is the thing we are trying to buy.
// Turn it on only for a model that is genuinely too dense.
//
// Run with `npm run models` after adding or replacing anything in
// public/models. The runtime needs src/scene/gltf.js's meshopt decoder to
// read the output — compressed files do not parse without it.
import { execFileSync } from 'node:child_process';
import { readdirSync, statSync, renameSync, rmSync } from 'node:fs';
import { join, extname, dirname, basename } from 'node:path';

const ROOT = 'public/models';
const TEXTURE_SIZE = 1024;

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return walk(path);
    return ['.glb', '.gltf'].includes(extname(path).toLowerCase()) ? [path] : [];
  });
}

let before = 0;
let after = 0;
for (const src of walk(ROOT)) {
  // Always emit .glb: a .gltf can carry its buffers in separate files, and
  // the compressed output has to be one self-contained thing to ship.
  const dst = join(dirname(src), basename(src, extname(src)) + '.glb');
  // The temp name has to keep the .glb extension. gltf-transform picks its
  // output container from the extension alone, so writing to "name.glb.tmp"
  // silently produced glTF *JSON* with the buffer and textures as separate
  // sidecar files — which still loaded, so nothing looked wrong, but it
  // meant three HTTP requests per model instead of one and a palette
  // texture shared by filename across every character in a folder.
  const tmp = dst.replace(/\.glb$/, '.tmp.glb');
  const sizeBefore = statSync(src).size;

  execFileSync('npx', [
    'gltf-transform', 'optimize', src, tmp,
    '--compress', 'meshopt',
    '--texture-compress', 'webp',
    '--texture-size', String(TEXTURE_SIZE),
    '--simplify', 'false',
  ], { stdio: 'pipe', shell: process.platform === 'win32' });

  if (src !== dst) rmSync(src);
  renameSync(tmp, dst);

  const sizeAfter = statSync(dst).size;
  before += sizeBefore;
  after += sizeAfter;
  const kb = (n) => (n / 1024).toFixed(0).padStart(6);
  console.log(`${basename(dst).padEnd(24)} ${kb(sizeBefore)} KB -> ${kb(sizeAfter)} KB`);
}

console.log(`\nTOTAL ${(before / 1048576).toFixed(1)} MB -> ${(after / 1048576).toFixed(1)} MB`);
