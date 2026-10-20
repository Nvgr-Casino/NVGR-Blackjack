// Turns a Mixamo FBX download into a table-ready character.
//
//   npm run character -- "C:/path/Seated Idle.fbx" mx_louise
//
// Mixamo only exports FBX, and a character with a motion-capture clip
// baked in arrives around 50MB. Two steps get it to roughly 3MB with its
// textures still at 2048 and its mesh untouched: convert to glTF, then run
// the same meshopt + WebP pass the rest of the models use.
//
// Textures stay at 2048 rather than being cut to 1024. The size is paid
// for in download, not in frame time, and at 4096 the same model is only
// about 4MB — the compression is recovering waste (PNG, unpacked
// geometry), not trading away detail.
import { execFileSync } from 'node:child_process';
import { statSync, rmSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import convert from 'fbx2gltf';

const [src, name] = process.argv.slice(2);
if (!src || !name) {
  console.error('usage: npm run character -- <file.fbx> <output-name>');
  process.exit(1);
}
if (!existsSync(src)) {
  console.error('no such file: ' + src);
  process.exit(1);
}

const OUT_DIR = 'public/models/characters';
const TEXTURE_SIZE = 2048;
mkdirSync(OUT_DIR, { recursive: true });

const raw = join(tmpdir(), name + '.raw.glb');
const dst = join(OUT_DIR, name + '.glb');
const before = statSync(src).size;

console.log(`converting ${name}…`);
await convert(src, raw, ['--binary']);

console.log('compressing…');
execFileSync('npx', [
  'gltf-transform', 'optimize', raw, dst,
  '--compress', 'meshopt',
  '--texture-compress', 'webp',
  '--texture-size', String(TEXTURE_SIZE),
  // Never on: this is the one step that actually removes detail, and
  // detail is the thing being paid for.
  '--simplify', 'false',
], { stdio: 'pipe', shell: process.platform === 'win32' });

rmSync(raw, { force: true });

const after = statSync(dst).size;
const mb = (n) => (n / 1048576).toFixed(1);
console.log(`${name}: ${mb(before)}MB -> ${mb(after)}MB  ->  ${dst}`);
