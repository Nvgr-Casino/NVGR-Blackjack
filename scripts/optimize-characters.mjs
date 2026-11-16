// Finishes a character built in Blender (scripts/blender/build_character.py)
// for the table: its materials set as the game draws them, the parts nobody
// sees dropped, its textures compressed and its mesh packed.
//
//   node scripts/optimize-characters.mjs <in.raw.glb> <out.glb> [--size 2048] [--ratio 0.3]
//
// MakeHuman's exporter marks every material see-through and two-sided.
// Skin, cloth and eyes are opaque and one-sided here; brows, lashes and hair
// are cut-outs (alpha-tested), which a phone draws far more cheaply than
// blended transparency. The teeth and tongue sit behind closed lips.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { prune } from '@gltf-transform/functions';
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer';

const args = process.argv.slice(2);
const [input, output] = args;
const opt = (k, d) => (args.includes(k) ? Number(args[args.indexOf(k) + 1]) : d);
const size = opt('--size', 2048);
// The share of the smoothed mesh kept (meshopt's simplifier, which keeps
// the outline and the skinning): about 0.3 brings a figure back near its
// unsmoothed weight with the rounded silhouette.
const ratio = opt('--ratio', 0.3);
if (!input || !output) { console.error('usage: node scripts/optimize-characters.mjs <in.raw.glb> <out.glb> [--size 2048]'); process.exit(1); }

await MeshoptDecoder.ready;
await MeshoptEncoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder });
const doc = await io.read(input);
const root = doc.getRoot();

const CUTOUT = /eyebrow|eyelash|hair|short0|long0|bob0|braid|ponytail|afro|high-poly|low-poly/i;
const HIDDEN = /teeth|tongue/i;
for (const node of root.listNodes()) {
  const mesh = node.getMesh();
  if (mesh && HIDDEN.test(mesh.getName())) { node.setMesh(null); mesh.dispose(); }
}
for (const mat of root.listMaterials()) {
  const n = mat.getName();
  mat.setDoubleSided(false);
  if (CUTOUT.test(n)) { mat.setAlphaMode('MASK'); mat.setAlphaCutoff(0.4); }
  else mat.setAlphaMode('OPAQUE');
  // Cloth and skin are not lacquered.
  const cc = mat.getExtension('KHR_materials_clearcoat');
  if (cc) mat.setExtension('KHR_materials_clearcoat', null);
  mat.setMetallicFactor(0);
}
await doc.transform(prune());

const work = mkdtempSync(join(tmpdir(), 'nvgr-char-'));
const tmp = join(work, 'mid.glb');
await io.write(tmp, doc);
execFileSync('npx', ['gltf-transform', 'optimize', tmp, output, '--compress', 'meshopt', '--texture-compress', 'webp', '--texture-size', String(size), '--simplify', ratio < 1 ? 'true' : 'false', '--simplify-ratio', String(ratio), '--simplify-error', '0.0008'], { stdio: 'pipe', shell: process.platform === 'win32' });
rmSync(work, { recursive: true, force: true });
console.log(`${output}: ${(statSync(output).size / 1048576).toFixed(2)} MB`);
