import { PHONE_LITE } from '../platform.js';
// On a phone, the 3D models' textures cost more memory than the screen can
// show for them: each figure carries several 1024 px colour and normal
// maps, every piece of furniture its own set. iPhone Safari gives a page
// little memory before it kills it ("A problem repeatedly occurred"), so on
// a phone a model keeps its colour, at most 512 px, and gives up the fine
// surface maps — at a figure's size on a phone screen they are not seen.

export const PHONE = PHONE_LITE;

const DROP = ['normalMap', 'roughnessMap', 'metalnessMap', 'aoMap', 'bumpMap'];
const MAX = 512;
const shrunk = new WeakSet();

function shrink(tex, max = MAX) {
  if (!tex || shrunk.has(tex)) return;
  shrunk.add(tex);
  const im = tex.image;
  const w = im && (im.width || 0), h = im && (im.height || 0);
  if (!w || !h || Math.max(w, h) <= max) return;
  const k = max / Math.max(w, h);
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w * k));
  c.height = Math.max(1, Math.round(h * k));
  c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
  tex.image = c;
  tex.needsUpdate = true;
}

/**
 * Lightens a loaded model's materials for a phone; does nothing elsewhere.
 * A `hero` (the dealer, the one figure the table is about) keeps its fine
 * surface maps, every map at 1024 px: its hands and face are looked at.
 */
export function lightenForPhone(root, { hero = false } = {}) {
  if (!PHONE || !root) return;
  if (hero) {
    root.traverse((o) => {
      if (!o.isMesh) return;
      for (const m of [].concat(o.material)) {
        if (!m) continue;
        ['map', 'normalMap', 'roughnessMap', 'emissiveMap'].forEach((k) => { if (m[k]) shrink(m[k], 1024); });
      }
    });
    return;
  }
  root.traverse((o) => {
    if (!o.isMesh) return;
    for (const m of [].concat(o.material)) {
      if (!m) continue;
      let changed = false;
      // A glTF material's metalness and roughness are factors on its map:
      // with the map gone they stand alone, and a metalness of 1 turns
      // leather to black mirror. Set to what the map mostly said instead.
      if (m.metalnessMap) { m.metalness = Math.min(m.metalness, 0.1); }
      if (m.roughnessMap) { m.roughness = Math.min(Math.max(m.roughness, 0.55), 0.8); }
      DROP.forEach((k) => { if (m[k]) { m[k] = null; changed = true; } });
      if (m.map) shrink(m.map);
      if (m.emissiveMap) shrink(m.emissiveMap);
      if (changed) m.needsUpdate = true;
    }
  });
}
