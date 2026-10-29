// Imports characters and animations from Microsoft Rocketbox (MIT licence,
// github.com/microsoft/Microsoft-Rocketbox) into table-ready GLBs.
//
//   npm run rocketbox -- avatar Professions/Business_Male_01 rb_bm01
//   npm run rocketbox -- clip m_sit_table_breathe_01 rb_sit_m
//   npm run rocketbox -- avatar Professions/Business_Male_04 rb_dealer_m4 black-vest
//
// An avatar may take a recipe from scripts/dealer-recolor.mjs, which re-dyes
// its clothes into a house uniform — for the dealers at the higher tables.
//
// An avatar is an FBX whose textures are separate 2048px TGAs. fbx2gltf
// cannot read TGA, so it converts the mesh and skeleton and leaves 1x1
// placeholders; this script decodes the TGAs itself (uncompressed, stored
// bottom-up) and puts each onto its material by name — `<name>_color` and
// `<name>_normal` for body and head, `<prefix>_opacity_color` for the hair
// and eyelash cut-outs — then runs the same meshopt + WebP pass the other
// models get.
//
// A clip is one of the library's motion captures. All of them are recorded
// on the same Biped skeleton as every avatar, so one clip file drives any
// of them; only the skeleton and the animation are kept.
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync, readFileSync, rmSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import convert from 'fbx2gltf';
import sharp from 'sharp';
import { NodeIO } from '@gltf-transform/core';
import { recolor, RECIPES } from './dealer-recolor.mjs';

const REPO = 'https://raw.githubusercontent.com/microsoft/Microsoft-Rocketbox/master/Assets';
const API = 'https://api.github.com/repos/microsoft/Microsoft-Rocketbox/contents/Assets';
const OUT_DIR = 'public/models/characters';
const TEXTURE_SIZE = 1024;

const [kind, src, name, recipe] = process.argv.slice(2);
if (recipe && !RECIPES[recipe]) {
  console.error('unknown recipe ' + recipe + ' (have: ' + Object.keys(RECIPES).join(', ') + ')');
  process.exit(1);
}
if (!['avatar', 'clip'].includes(kind) || !src || !name) {
  console.error('usage: npm run rocketbox -- avatar <Group/Avatar_Name> <out-name>');
  console.error('       npm run rocketbox -- clip <animation_name> <out-name>');
  process.exit(1);
}
mkdirSync(OUT_DIR, { recursive: true });
// Downloads go in a fresh directory of their own.
const work = mkdtempSync(join(tmpdir(), 'rocketbox-'));

async function download(url, file) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  writeFileSync(file, Buffer.from(await res.arrayBuffer()));
  return file;
}

// Uncompressed true-colour TGA (type 2), 24 or 32 bit, to PNG.
async function tgaToPng(file, dyeWith = null) {
  const b = readFileSync(file);
  const type = b[2], width = b.readUInt16LE(12), height = b.readUInt16LE(14), bpp = b[16], desc = b[17];
  if (type !== 2 || (bpp !== 24 && bpp !== 32)) throw new Error(`unsupported TGA (type ${type}, ${bpp}bpp): ${file}`);
  const channels = bpp / 8;
  const offset = 18 + b[0];
  const topDown = (desc & 0x20) !== 0;
  const rgba = Buffer.alloc(width * height * channels);
  for (let y = 0; y < height; y++) {
    const srcRow = topDown ? y : height - 1 - y;
    for (let x = 0; x < width; x++) {
      const s = offset + (srcRow * width + x) * channels;
      const d = (y * width + x) * channels;
      rgba[d] = b[s + 2]; rgba[d + 1] = b[s + 1]; rgba[d + 2] = b[s];   // BGR(A) -> RGB(A)
      if (channels === 4) rgba[d + 3] = b[s + 3];
    }
  }
  if (dyeWith) recolor(rgba, channels, dyeWith);
  return sharp(rgba, { raw: { width, height, channels } })
    .resize(TEXTURE_SIZE, TEXTURE_SIZE, { kernel: 'lanczos3' })
    .png()
    .toBuffer();
}

function optimize(input, output) {
  execFileSync('npx', [
    'gltf-transform', 'optimize', input, output,
    '--compress', 'meshopt',
    '--texture-compress', 'webp',
    '--texture-size', String(TEXTURE_SIZE),
    '--simplify', 'false',
  ], { stdio: 'pipe', shell: process.platform === 'win32' });
}

const io = new NodeIO();
const dst = join(OUT_DIR, name + '.glb');

if (kind === 'avatar') {
  const base = src.split('/').pop();
  console.log(`downloading ${base}…`);
  const fbx = await download(`${REPO}/Avatars/${src}/Export/${base}.fbx`, join(work, base + '.fbx'));
  const listing = await (await fetch(`${API}/Avatars/${src}/Textures`)).json();
  const tgas = new Map();
  for (const f of listing.filter((x) => /_(color|normal)\.tga$/i.test(x.name))) {
    tgas.set(f.name.replace(/\.tga$/i, '').toLowerCase(), await download(f.download_url, join(work, f.name)));
  }

  console.log('converting…');
  const raw = join(work, 'raw.glb');
  await convert(fbx, raw, ['--binary']);
  const doc = await io.read(raw);

  const texture = async (key) => {
    const file = tgas.get(key);
    if (!file) return null;
    // Only the clothes are re-dyed: the body sheet, never the head.
    const dyeWith = recipe && /_body_color$/.test(key) ? recipe : null;
    return doc.createTexture(key).setImage(await tgaToPng(file, dyeWith)).setMimeType('image/png');
  };
  for (const mat of doc.getRoot().listMaterials()) {
    const key = mat.getName().toLowerCase();
    if (key.endsWith('_opacity')) {
      // Hair, lashes and brows: one RGBA sheet, cut out by its alpha.
      const tex = await texture(key + '_color');
      if (tex) mat.setBaseColorTexture(tex);
      // Single-sided: the hair is layered cards facing outward, and drawing
      // their backs shows the inner layers through every gap as dark wedges.
      mat.setAlphaMode('MASK').setAlphaCutoff(0.4).setDoubleSided(false);
      mat.setNormalTexture(null);
    } else {
      const color = await texture(key + '_color');
      const normal = await texture(key + '_normal');
      if (color) mat.setBaseColorTexture(color);
      mat.setNormalTexture(normal);
    }
    mat.setMetallicFactor(0).setRoughnessFactor(0.75);
  }
  // The 1x1 placeholders fbx2gltf left behind are now unreferenced, and
  // the optimize pass prunes them. (Not pruned here: @gltf-transform's
  // functions package loads its own copy of sharp, and two in one process
  // fail to load.)
  const textured = join(work, 'textured.glb');
  await io.write(textured, doc);
  console.log('compressing…');
  optimize(textured, dst);
} else {
  console.log(`downloading ${src}…`);
  const fbx = await download(`${REPO}/Animations/all_animations_max_motextr_static/${src}.max.fbx`, join(work, src + '.fbx'));
  const raw = join(work, 'raw.glb');
  await convert(fbx, raw, ['--binary']);
  const doc = await io.read(raw);
  // Skeleton and motion only: the capture carries a stand-in mesh.
  for (const node of doc.getRoot().listNodes()) { node.setMesh(null); node.setSkin(null); }
  for (const anim of doc.getRoot().listAnimations()) anim.setName(src);
  const stripped = join(work, 'clip.glb');
  await io.write(stripped, doc);
  optimize(stripped, dst);
}

rmSync(work, { recursive: true, force: true });
console.log(`${name}: ${(statSync(dst).size / 1048576).toFixed(2)}MB -> ${dst}`);
