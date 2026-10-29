// Gives one Rocketbox avatar another's head and hair:
//
//   node scripts/transplant-head.mjs <body.glb> <donor.glb> <out.glb>
//
// Rocketbox's only waistcoat — the dealer's uniform — comes on a bald
// figure, Business_Male_04. Every Rocketbox adult of a sex shares one Biped
// skeleton, so the head can come from someone else: the donor's head and
// hair primitives are carried across, each vertex moved out of the donor's
// bind pose and into the body's (through the joint-space position it has
// in the donor, blended by its skin weights), and its joint indices
// renamed onto the body's skin. The body's own head is dropped.
//
// Both inputs are the game's own compressed GLBs; the output gets the same
// meshopt + WebP pass as every other model.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder } from 'meshoptimizer';

const [bodyFile, donorFile, outFile] = process.argv.slice(2);
if (!bodyFile || !donorFile || !outFile) {
  console.error('usage: node scripts/transplant-head.mjs <body.glb> <donor.glb> <out.glb>');
  process.exit(1);
}

await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
const body = await io.read(bodyFile);
const donor = await io.read(donorFile);

// ---------- column-major 4x4 helpers ----------
function invert(m) {
  const [a00, a01, a02, a03, a10, a11, a12, a13, a20, a21, a22, a23, a30, a31, a32, a33] = m;
  const b00 = a00 * a11 - a01 * a10, b01 = a00 * a12 - a02 * a10, b02 = a00 * a13 - a03 * a10;
  const b03 = a01 * a12 - a02 * a11, b04 = a01 * a13 - a03 * a11, b05 = a02 * a13 - a03 * a12;
  const b06 = a20 * a31 - a21 * a30, b07 = a20 * a32 - a22 * a30, b08 = a20 * a33 - a23 * a30;
  const b09 = a21 * a32 - a22 * a31, b10 = a21 * a33 - a23 * a31, b11 = a22 * a33 - a23 * a32;
  const det = 1 / (b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06);
  return [
    (a11 * b11 - a12 * b10 + a13 * b09) * det, (a02 * b10 - a01 * b11 - a03 * b09) * det,
    (a31 * b05 - a32 * b04 + a33 * b03) * det, (a22 * b04 - a21 * b05 - a23 * b03) * det,
    (a12 * b08 - a10 * b11 - a13 * b07) * det, (a00 * b11 - a02 * b08 + a03 * b07) * det,
    (a32 * b02 - a30 * b05 - a33 * b01) * det, (a20 * b05 - a22 * b02 + a23 * b01) * det,
    (a10 * b10 - a11 * b08 + a13 * b06) * det, (a01 * b08 - a00 * b10 - a03 * b06) * det,
    (a30 * b04 - a31 * b02 + a33 * b00) * det, (a21 * b02 - a20 * b04 - a23 * b00) * det,
    (a11 * b07 - a10 * b09 - a12 * b06) * det, (a00 * b09 - a01 * b07 + a02 * b06) * det,
    (a31 * b01 - a30 * b03 - a32 * b00) * det, (a20 * b03 - a21 * b01 + a22 * b00) * det,
  ];
}
function multiply(a, b) {
  const out = new Array(16);
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) {
    let s = 0;
    for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k];
    out[c * 4 + r] = s;
  }
  return out;
}
const applyPoint = (m, [x, y, z]) => [
  m[0] * x + m[4] * y + m[8] * z + m[12], m[1] * x + m[5] * y + m[9] * z + m[13], m[2] * x + m[6] * y + m[10] * z + m[14],
];
const applyDir = (m, [x, y, z]) => [m[0] * x + m[4] * y + m[8] * z, m[1] * x + m[5] * y + m[9] * z, m[2] * x + m[6] * y + m[10] * z];

// ---------- the two skins ----------
function skinOf(doc) {
  const node = doc.getRoot().listNodes().find((n) => n.getMesh() && n.getSkin());
  const skin = node.getSkin();
  const joints = skin.listJoints();
  const ibm = skin.getInverseBindMatrices();
  const matrices = joints.map((_, i) => Array.from(ibm.getElement(i, new Array(16))));
  return { node, mesh: node.getMesh(), joints, names: joints.map((j) => j.getName()), matrices };
}
const B = skinOf(body);
const D = skinOf(donor);
const bodyIndex = new Map(B.names.map((n, i) => [n, i]));

// Donor joint i → body joint index, and the matrix that carries a point
// bound to that joint from the donor's bind space into the body's.
const remap = D.names.map((n) => bodyIndex.get(n));
const carry = D.names.map((n, i) => {
  const bi = bodyIndex.get(n);
  if (bi === undefined) return null;
  return multiply(invert(B.matrices[bi]), D.matrices[i]);
});
const missing = D.names.filter((n, i) => remap[i] === undefined);
if (missing.length) console.warn('donor joints with no match on the body:', missing.join(', '));

const isHead = (p) => /_(head|opacity)$/i.test((p.getMaterial() && p.getMaterial().getName()) || '');

// Drop the body's own head (and any hair it has).
for (const prim of B.mesh.listPrimitives().filter(isHead)) {
  B.mesh.removePrimitive(prim);
  prim.dispose();
}

// ---------- copy across ----------
function copyTexture(tex) {
  if (!tex) return null;
  return body.createTexture(tex.getName()).setImage(tex.getImage()).setMimeType(tex.getMimeType());
}
function copyMaterial(mat) {
  const m = body.createMaterial(mat.getName())
    .setBaseColorFactor(mat.getBaseColorFactor())
    .setAlphaMode(mat.getAlphaMode())
    .setAlphaCutoff(mat.getAlphaCutoff())
    .setDoubleSided(mat.getDoubleSided())
    .setMetallicFactor(mat.getMetallicFactor())
    .setRoughnessFactor(mat.getRoughnessFactor());
  m.setBaseColorTexture(copyTexture(mat.getBaseColorTexture()));
  m.setNormalTexture(copyTexture(mat.getNormalTexture()));
  return m;
}
const buffer = body.getRoot().listBuffers()[0];
const accessor = (type, array) => body.createAccessor().setType(type).setArray(array).setBuffer(buffer);

// Reads an accessor out as floats, element by element: compressed models
// store UVs and weights as normalised integers, which only getElement
// decodes.
function floats(acc) {
  const size = acc.getElementSize();
  const out = new Float32Array(acc.getCount() * size);
  const el = new Array(size);
  for (let i = 0; i < acc.getCount(); i++) {
    acc.getElement(i, el);
    for (let c = 0; c < size; c++) out[i * size + c] = el[c];
  }
  return out;
}

for (const prim of D.mesh.listPrimitives().filter(isHead)) {
  const pos = prim.getAttribute('POSITION');
  const nrm = prim.getAttribute('NORMAL');
  const joints = prim.getAttribute('JOINTS_0');
  const weights = prim.getAttribute('WEIGHTS_0');
  const n = pos.getCount();
  const outPos = new Float32Array(n * 3);
  const outNrm = nrm ? new Float32Array(n * 3) : null;
  const outJoints = new Uint16Array(n * 4);
  const j = [0, 0, 0, 0], w = [0, 0, 0, 0], p = [0, 0, 0], q = [0, 0, 0];
  for (let v = 0; v < n; v++) {
    pos.getElement(v, p);
    if (nrm) nrm.getElement(v, q);
    joints.getElement(v, j);
    weights.getElement(v, w);
    const P = [0, 0, 0], N = [0, 0, 0];
    let total = 0;
    for (let k = 0; k < 4; k++) {
      if (!w[k] || !carry[j[k]]) continue;
      const tp = applyPoint(carry[j[k]], p);
      const tn = applyDir(carry[j[k]], q);
      for (let c = 0; c < 3; c++) { P[c] += tp[c] * w[k]; N[c] += tn[c] * w[k]; }
      total += w[k];
    }
    const len = Math.hypot(N[0], N[1], N[2]) || 1;
    for (let c = 0; c < 3; c++) {
      outPos[v * 3 + c] = total ? P[c] / total : p[c];
      if (outNrm) outNrm[v * 3 + c] = N[c] / len;
    }
    for (let k = 0; k < 4; k++) outJoints[v * 4 + k] = w[k] && remap[j[k]] !== undefined ? remap[j[k]] : 0;
  }

  const copy = body.createPrimitive()
    .setMaterial(copyMaterial(prim.getMaterial()))
    .setAttribute('POSITION', accessor('VEC3', outPos))
    .setAttribute('JOINTS_0', accessor('VEC4', outJoints))
    .setAttribute('WEIGHTS_0', accessor('VEC4', floats(weights)));
  if (outNrm) copy.setAttribute('NORMAL', accessor('VEC3', outNrm));
  const uv = prim.getAttribute('TEXCOORD_0');
  if (uv) copy.setAttribute('TEXCOORD_0', accessor('VEC2', floats(uv)));
  const idx = prim.getIndices();
  if (idx) copy.setIndices(accessor('SCALAR', new Uint32Array(idx.getArray())));
  B.mesh.addPrimitive(copy);
}

// Written without meshopt (it would need the encoder), then given the usual
// compression pass.
const work = mkdtempSync(join(tmpdir(), 'transplant-'));
const raw = join(work, 'raw.glb');
body.getRoot().listExtensionsUsed().filter((e) => e.extensionName === 'EXT_meshopt_compression').forEach((e) => e.dispose());
await io.write(raw, body);
execFileSync('npx', [
  'gltf-transform', 'optimize', raw, outFile,
  '--compress', 'meshopt', '--texture-compress', 'webp', '--texture-size', '1024', '--simplify', 'false',
], { stdio: 'pipe', shell: process.platform === 'win32' });
rmSync(work, { recursive: true, force: true });
console.log(`${outFile}: ${(statSync(outFile).size / 1048576).toFixed(2)}MB`);
