import * as THREE from 'three';
import { crestPlateCanvas, drawCasinoCrest } from './crest.js';
import { FLOOR_Y, m } from './scale.js';

// Fittings no furniture library has: drapes at the glass, rugs, a bar
// with the house crest on its front and a lit back bar behind it, a tray
// ceiling, and the house sign. Built from plain geometry and painted
// canvases, so they cost nothing to download.

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
export function createBar(length, accentRgb = '216,180,110', { body: bodyColor = 0x141316, top: topColor = 0xe9e3d7, bodyMaterial = null } = {}) {
  const group = new THREE.Group();
  const h = m(1.08), depth = m(0.62);
  // The body's own material, if it has one (the Penthouse's backlit onyx).
  const lacquer = bodyMaterial || new THREE.MeshStandardMaterial({ color: bodyColor, roughness: 0.3, metalness: 0 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(length, h - m(0.05), depth), lacquer);
  body.position.set(0, FLOOR_Y + (h - m(0.05)) / 2, -depth / 2);
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);
  const top = new THREE.Mesh(
    new THREE.BoxGeometry(length + m(0.08), m(0.05), depth + m(0.12)),
    new THREE.MeshStandardMaterial({ color: topColor, roughness: 0.22, metalness: 0 })
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
export function createTrayCeiling(w, d, y, coveColor, frameColor = 0x0d0c10) {
  const group = new THREE.Group();
  const frameMat = new THREE.MeshLambertMaterial({ color: frameColor });
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

// ---------- the house sign ----------

/**
 * The house sign: the NVGR crest in gilt, lit from within, on a plate in a
 * brass frame, with the glow of its light thrown on what is behind it. It
 * hangs where every player looks — on the wall behind the dealer — and is
 * drawn unlit (it is a light), so it reads in any room. `width` across;
 * its origin is its centre, and it faces +z.
 *
 * `plate` is the panel's colour (null for none: the crest alone, as if
 * cut out and floating, for a sign hung in front of glass).
 */
export function createBrandSign(width, { rgb = '232,196,120', plate = '#121114', frame = true, halo = true } = {}) {
  const height = width * 0.62;
  const group = new THREE.Group();
  const px = 1024;
  const canvas = document.createElement('canvas');
  canvas.width = px;
  canvas.height = Math.round(px * 0.62);
  const draw = () => {
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (plate) {
      ctx.fillStyle = plate;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.strokeStyle = `rgba(${rgb},0.55)`;
      ctx.lineWidth = 4;
      ctx.strokeRect(26, 26, canvas.width - 52, canvas.height - 52);
    }
    // The light of the letters, then the letters.
    ctx.save();
    ctx.shadowColor = `rgba(${rgb},0.9)`;
    ctx.shadowBlur = 28;
    drawCasinoCrest(ctx, { x: canvas.width / 2, y: canvas.height / 2 + canvas.height * 0.02, width: canvas.width * 0.62, alpha: 1, rgb });
    ctx.restore();
    drawCasinoCrest(ctx, { x: canvas.width / 2, y: canvas.height / 2 + canvas.height * 0.02, width: canvas.width * 0.62, alpha: 1, rgb: '255,240,200' });
  };
  draw();
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  // The crest's lettering is a webfont: drawn again once it has loaded.
  if (document.fonts && document.fonts.load) {
    document.fonts.load("700 88px 'Cinzel'").then(() => { draw(); tex.needsUpdate = true; }).catch(() => {});
  }
  const face = new THREE.Mesh(new THREE.PlaneGeometry(width, height),
    new THREE.MeshBasicMaterial({ map: tex, transparent: !plate, toneMapped: false, fog: false }));
  face.position.z = 0.02;
  group.add(face);
  if (frame && plate) {
    const t = width * 0.022;
    const brass = new THREE.MeshStandardMaterial({ color: 0xc9a25e, roughness: 0.3, metalness: 0.85 });
    [[width + t * 2, t, 0, height / 2 + t / 2], [width + t * 2, t, 0, -height / 2 - t / 2], [t, height, width / 2 + t / 2, 0], [t, height, -width / 2 - t / 2, 0]]
      .forEach(([w, h, x, y]) => {
        const bar = new THREE.Mesh(new THREE.BoxGeometry(w, h, t * 1.6), brass);
        bar.position.set(x, y, t * 0.5);
        group.add(bar);
      });
  }
  if (halo) {
    // Its light on the wall round it.
    const g = document.createElement('canvas');
    g.width = g.height = 256;
    const gx = g.getContext('2d');
    const grad = gx.createRadialGradient(128, 128, 20, 128, 128, 128);
    grad.addColorStop(0, `rgba(${rgb},0.55)`);
    grad.addColorStop(0.5, `rgba(${rgb},0.18)`);
    grad.addColorStop(1, `rgba(${rgb},0)`);
    gx.fillStyle = grad;
    gx.fillRect(0, 0, 256, 256);
    const glowTex = new THREE.CanvasTexture(g);
    glowTex.colorSpace = THREE.SRGBColorSpace;
    const glow = new THREE.Mesh(new THREE.PlaneGeometry(width * 1.9, height * 2.1),
      new THREE.MeshBasicMaterial({ map: glowTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, fog: false }));
    glow.position.z = 0.005;
    group.add(glow);
  }
  return group;
}

// ---------- the back bar ----------

/**
 * The wall behind a bar: a tall cabinet `length` long with a mirrored
 * back, three glass shelves lit from beneath and rows of bottles on them,
 * and a small lit crest at the top. Its origin is on the floor at the
 * middle of its front; it faces +z.
 */
export function createBackBar(length, { wood = 0x2a1c14, rgb = '232,196,120' } = {}) {
  const group = new THREE.Group();
  const h = m(2.75), depth = m(0.38);
  const woodMat = new THREE.MeshStandardMaterial({ color: wood, roughness: 0.5, metalness: 0 });
  const carcass = new THREE.Mesh(new THREE.BoxGeometry(length, h, m(0.06)), woodMat);
  carcass.position.set(0, FLOOR_Y + h / 2, -depth + m(0.03));
  group.add(carcass);
  // A low cupboard along the bottom.
  const base = new THREE.Mesh(new THREE.BoxGeometry(length, m(0.9), depth), woodMat);
  base.position.set(0, FLOOR_Y + m(0.45), -depth / 2);
  group.add(base);
  // The mirror, warm with the light of the shelves.
  const mirror = new THREE.Mesh(new THREE.PlaneGeometry(length - m(0.12), h - m(1.25)),
    new THREE.MeshStandardMaterial({ color: 0x8a7a66, roughness: 0.12, metalness: 0.9 }));
  mirror.position.set(0, FLOOR_Y + m(0.9) + (h - m(1.25)) / 2 + m(0.05), -depth + m(0.065));
  group.add(mirror);
  [-1, 1].forEach((s) => {
    const side = new THREE.Mesh(new THREE.BoxGeometry(m(0.06), h, depth), woodMat);
    side.position.set(s * (length / 2 - m(0.03)), FLOOR_Y + h / 2, -depth / 2);
    group.add(side);
  });
  const crown = new THREE.Mesh(new THREE.BoxGeometry(length + m(0.08), m(0.12), depth + m(0.06)), woodMat);
  crown.position.set(0, FLOOR_Y + h + m(0.06), -depth / 2);
  group.add(crown);
  // Glass shelves, each with a strip of light under it.
  const glass = new THREE.MeshStandardMaterial({ color: 0xcfe6e0, roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.35 });
  const light = new THREE.MeshBasicMaterial({ color: 0xffd9a0, toneMapped: false });
  const BOTTLE_COLORS = [0x2f5a2a, 0x6b3a12, 0xd9c79a, 0x3a1a12, 0x9fc4c8, 0x7a1e2a, 0xc9a24f, 0x1d2e4a];
  const bottleMats = BOTTLE_COLORS.map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.15, metalness: 0.1, emissive: c, emissiveIntensity: 0.25 }));
  const bottleGeo = new THREE.CylinderGeometry(m(0.035), m(0.04), m(0.26), 10);
  const neckGeo = new THREE.CylinderGeometry(m(0.012), m(0.02), m(0.09), 8);
  [1.1, 1.5, 1.9].forEach((y, row) => {
    const shelf = new THREE.Mesh(new THREE.BoxGeometry(length - m(0.14), m(0.02), depth - m(0.1)), glass);
    shelf.position.set(0, FLOOR_Y + m(y), -depth / 2 - m(0.02));
    group.add(shelf);
    const strip = new THREE.Mesh(new THREE.BoxGeometry(length - m(0.16), m(0.012), m(0.02)), light);
    strip.position.set(0, FLOOR_Y + m(y) - m(0.02), -m(0.06));
    group.add(strip);
    const n = Math.floor((length - m(0.3)) / m(0.13));
    for (let i = 0; i < n; i++) {
      const mat = bottleMats[(i * 3 + row * 5) % bottleMats.length];
      const x = -length / 2 + m(0.2) + i * m(0.13);
      const tall = 0.85 + ((i * 7 + row) % 4) * 0.08;
      const b = new THREE.Mesh(bottleGeo, mat);
      b.scale.y = tall;
      b.position.set(x, FLOOR_Y + m(y) + m(0.01) + m(0.13) * tall, -depth / 2 - m(0.02));
      group.add(b);
      const neck = new THREE.Mesh(neckGeo, mat);
      neck.position.set(x, FLOOR_Y + m(y) + m(0.01) + m(0.26) * tall + m(0.045), -depth / 2 - m(0.02));
      group.add(neck);
    }
  });
  // The house crest, lit, over the middle.
  const sign = createBrandSign(Math.min(length * 0.3, m(0.62)), { rgb, plate: null, frame: false, halo: false });
  sign.position.set(0, FLOOR_Y + m(2.5), -depth + m(0.08));
  group.add(sign);
  return group;
}
