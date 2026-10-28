// Imports furniture and props from Poly Haven (CC0 — public domain) as
// compressed GLBs.
//
//   npm run polyhaven -- dining_chair_02:0.3 ClassicConsole_01 sofa_03
//
// A ratio after the id (":0.3") simplifies that piece to about that share
// of its triangles. Scanned pieces can run to tens of thousands — a chair
// at 22k, a potted palm at 70k — far more than a chair at the edge of the
// frame can show, and every one is paid for again in the shadow pass.
//
// Poly Haven's models are photogrammetry-grade and modelled in metres. Each
// is fetched at 1k from its glTF listing, then given the same meshopt + WebP
// pass every other model in the game gets. They land in
// public/models/furniture/<id>.glb.
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync, rmSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';

const OUT_DIR = 'public/models/furniture';
const RES = '1k';
const UA = { 'User-Agent': 'nvgr-blackjack-build' };

const ids = process.argv.slice(2);
if (!ids.length) {
  console.error('usage: npm run polyhaven -- <asset-id> [asset-id…]');
  process.exit(1);
}
mkdirSync(OUT_DIR, { recursive: true });

async function fetchOk(url) {
  const res = await fetch(url, { headers: UA });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res;
}

for (const arg of ids) {
  const [id, ratio] = arg.split(':');
  // Each asset downloads into a fresh directory of its own.
  const work = mkdtempSync(join(tmpdir(), 'polyhaven-'));
  const files = await (await fetchOk(`https://api.polyhaven.com/files/${id}`)).json();
  const entry = files.gltf && files.gltf[RES] && files.gltf[RES].gltf;
  if (!entry) { console.error(`${id}: no ${RES} glTF`); continue; }

  const gltfPath = join(work, `${id}.gltf`);
  writeFileSync(gltfPath, Buffer.from(await (await fetchOk(entry.url)).arrayBuffer()));
  for (const [rel, info] of Object.entries(entry.include || {})) {
    const target = join(work, rel);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, Buffer.from(await (await fetchOk(info.url)).arrayBuffer()));
  }

  const dst = join(OUT_DIR, `${id}.glb`);
  execFileSync('npx', [
    'gltf-transform', 'optimize', gltfPath, dst,
    '--compress', 'meshopt',
    '--texture-compress', 'webp',
    '--texture-size', '1024',
    ...(ratio
      ? ['--simplify', 'true', '--simplify-ratio', ratio, '--simplify-error', '0.002']
      : ['--simplify', 'false']),
  ], { stdio: 'pipe', shell: process.platform === 'win32' });
  rmSync(work, { recursive: true, force: true });
  console.log(`${id}: ${(statSync(dst).size / 1048576).toFixed(2)}MB -> ${dst}`);
}
