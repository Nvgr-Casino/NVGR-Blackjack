import * as THREE from 'three';
import { crestPlateCanvas } from './crest.js';
import { FLOOR_Y, m } from './scale.js';

// Fittings for the penthouse that no furniture library has: drapes at the
// glass, a rug under the table, a bar with the house crest on its front,
// and a tray ceiling. Built from plain geometry and painted canvases, so
// they cost nothing to download.

const BRASS = new THREE.MeshStandardMaterial({ color: 0xb8955a, roughness: 0.35, metalness: 0.8 });

/**
 * Heavy velvet drapes, floor to ceiling, gathered in folds, with a brass
 * tie-back. `width` is how wide they hang; they face +z.
 */
export function createDrape(height, width, color) {
  const geometry = new THREE.PlaneGeometry(width, height, 40, 1);
  const pos = geometry.attributes.position;
  const folds = Math.max(3, Math.round(width / 0.28));
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    // Gathered tighter toward the tie-back, a third of the way up.
    const pinch = 1 - 0.45 * Math.exp(-(((y + height / 2) - height * 0.32) ** 2) / (height * 0.05));
    pos.setX(i, x * pinch);
    pos.setZ(i, Math.sin((x / width + 0.5) * folds * Math.PI * 2) * 0.07);
  }
  geometry.computeVertexNormals();
  const drape = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color, roughness: 0.92, metalness: 0, side: THREE.DoubleSide }));
  drape.receiveShadow = true;
  const group = new THREE.Group();
  drape.position.y = height / 2;
  group.add(drape);
  // The tie-back wraps the drape where it is gathered in.
  const tie = new THREE.Mesh(new THREE.TorusGeometry(width * 0.3, 0.025, 8, 24), BRASS);
  tie.position.set(0, height * 0.32, 0);
  tie.rotation.x = Math.PI / 2;
  tie.scale.set(1, 0.3, 1);
  group.add(tie);
  return group;
}

/** A rug of the theme's colours, with a patterned border, lying on the floor. */
export function createRug(w, d, { base, border, accent }) {
  const S = 1024;
  const canvas = document.createElement('canvas');
  canvas.width = S;
  canvas.height = Math.round((S * d) / w);
  const ctx = canvas.getContext('2d');
  const H = canvas.height;
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, S, H);
  ctx.strokeStyle = border;
  ctx.lineWidth = S * 0.035;
  ctx.strokeRect(S * 0.04, S * 0.04, S - S * 0.08, H - S * 0.08);
  ctx.strokeStyle = accent;
  ctx.lineWidth = 3;
  ctx.strokeRect(S * 0.075, S * 0.075, S - S * 0.15, H - S * 0.15);
  ctx.strokeRect(S * 0.015, S * 0.015, S - S * 0.03, H - S * 0.03);
  // A key pattern running round inside the border.
  ctx.fillStyle = accent;
  for (let x = S * 0.1; x < S * 0.9; x += S * 0.04) {
    ctx.fillRect(x, S * 0.09, S * 0.02, 3);
    ctx.fillRect(x, H - S * 0.09, S * 0.02, 3);
  }
  const img = ctx.getImageData(0, 0, S, H);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (Math.random() - 0.5) * 10;
    img.data[i] += n; img.data[i + 1] += n; img.data[i + 2] += n;
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  const rug = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshLambertMaterial({ map: tex }));
  rug.rotation.x = -Math.PI / 2;
  rug.position.y = FLOOR_Y + 0.006;
  rug.receiveShadow = true;
  return rug;
}

// The crest in brass on black lacquer, for the bar's front.
function crestPanel(w, h, accentRgb) {
  const tex = new THREE.CanvasTexture(crestPlateCanvas(w, h, { rgb: accentRgb }));
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * A bar counter `length` long, its front facing +z: a black lacquer body
 * with brass trim and the house crest on the front, a marble top, and a
 * brass foot rail. Its origin is on the floor at the middle of the front.
 */
export function createBar(length, accentRgb = '216,180,110') {
  const group = new THREE.Group();
  const h = m(1.08), depth = m(0.62);
  const lacquer = new THREE.MeshStandardMaterial({ color: 0x141316, roughness: 0.3, metalness: 0 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(length, h - m(0.05), depth), lacquer);
  body.position.set(0, FLOOR_Y + (h - m(0.05)) / 2, -depth / 2);
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);
  const top = new THREE.Mesh(
    new THREE.BoxGeometry(length + m(0.08), m(0.05), depth + m(0.12)),
    new THREE.MeshStandardMaterial({ color: 0xe9e3d7, roughness: 0.22, metalness: 0 })
  );
  top.position.set(0, FLOOR_Y + h - m(0.025), -depth / 2 + m(0.04));
  top.castShadow = true;
  group.add(top);
  const pw = Math.min(length * 0.35, m(1.3)), ph = h * 0.55;
  const panel = new THREE.Mesh(new THREE.PlaneGeometry(pw, ph), new THREE.MeshLambertMaterial({ map: crestPanel(pw, ph, accentRgb) }));
  panel.position.set(0, FLOOR_Y + h * 0.52, 0.004);
  group.add(panel);
  [-1, 1].forEach((s) => {
    const trim = new THREE.Mesh(new THREE.BoxGeometry(m(0.02), h - m(0.1), m(0.02)), BRASS);
    trim.position.set(s * (length / 2 - m(0.02)), FLOOR_Y + h / 2, m(0.01));
    group.add(trim);
  });
  const rail = new THREE.Mesh(new THREE.CylinderGeometry(m(0.022), m(0.022), length, 12), BRASS);
  rail.rotation.z = Math.PI / 2;
  rail.position.set(0, FLOOR_Y + m(0.22), m(0.16));
  group.add(rail);
  return group;
}

/**
 * A tray ceiling: the middle of the ceiling raised in a frame, with a
 * hidden cove of light round its edge. `w` by `d`, hung at `y`.
 */
export function createTrayCeiling(w, d, y, coveColor) {
  const group = new THREE.Group();
  const frameMat = new THREE.MeshLambertMaterial({ color: 0x0d0c10 });
  const glow = new THREE.MeshBasicMaterial({ color: coveColor });
  const t = m(0.18);
  [
    [w + t * 2, d / 2 + t / 2, 0, 1], [w + t * 2, d / 2 + t / 2, 0, -1],
  ].forEach(([len, off, , s]) => {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(len, m(0.25), t), frameMat);
    bar.position.set(0, y - m(0.12), s * off);
    group.add(bar);
    const line = new THREE.Mesh(new THREE.BoxGeometry(len - t, 0.03, 0.03), glow);
    line.position.set(0, y - m(0.26), s * (off - t / 2 - 0.02));
    group.add(line);
  });
  [-1, 1].forEach((s) => {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(t, m(0.25), d), frameMat);
    bar.position.set(s * (w / 2 + t / 2), y - m(0.12), 0);
    group.add(bar);
    const line = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.03, d - t), glow);
    line.position.set(s * (w / 2 - 0.02), y - m(0.26), 0);
    group.add(line);
  });
  return group;
}
