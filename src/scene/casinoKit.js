import * as THREE from 'three';
import { m } from './scale.js';

// Materials and small things the casino rooms are made of: canvas
// textures, felt, marble, wood, velvet, metals, stacks of chips, bottles.
// The rooms build their own furniture from these.

// A phone paints these at most 1024 px on a side: the same picture, drawn
// smaller, so it costs a quarter of the memory (the renderer caps what it
// uploads there at 1024 anyway — see scene.js).
const PHONE = window.matchMedia('(pointer: coarse)').matches || window.innerWidth < 820;
export function canvasTex(w, h, draw, { repeat = false } = {}) {
  const c = document.createElement('canvas');
  const k = PHONE ? Math.min(1, 1024 / Math.max(w, h)) : 1;
  c.width = Math.round(w * k);
  c.height = Math.round(h * k);
  const ctx = c.getContext('2d');
  // Drawn in the full-size coordinates either way.
  ctx.scale(k, k);
  draw(ctx, w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

// Fine grain over whatever is on the canvas: the weave of cloth, the
// grain of stone.
export function grain(ctx, w, h, amount = 14) {
  // Over the canvas's own pixels, whatever size it was drawn at.
  const img = ctx.getImageData(0, 0, ctx.canvas.width, ctx.canvas.height);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (Math.random() - 0.5) * amount;
    img.data[i] += n;
    img.data[i + 1] += n;
    img.data[i + 2] += n;
  }
  ctx.putImageData(img, 0, 0);
}

// ---------- metals ----------
export const gold = () => new THREE.MeshStandardMaterial({ color: 0xd4af62, roughness: 0.25, metalness: 0.95 });
export const brass = () => new THREE.MeshStandardMaterial({ color: 0xb8965a, roughness: 0.3, metalness: 0.9 });
export const chrome = () => new THREE.MeshStandardMaterial({ color: 0xdfe3e8, roughness: 0.1, metalness: 1.0 });

// ---------- cloth ----------
export function velvet(color, sheen = 0xffffff) {
  return new THREE.MeshPhysicalMaterial({ color, roughness: 0.85, sheen: 1, sheenRoughness: 0.35, sheenColor: new THREE.Color(sheen) });
}
// Baize for a gaming table, its weave in it.
export function feltTexture(hex, w = 512, h = 512) {
  return canvasTex(w, h, (ctx) => {
    ctx.fillStyle = hex;
    ctx.fillRect(0, 0, w, h);
    grain(ctx, w, h, 12);
  });
}

// ---------- stone ----------
// Marble: a base, soft clouds through it, veins wandering across.
export function marbleTexture(base, vein, { S = 1024, veins = 26, cloud = 'rgba(255,255,255,0.05)' } = {}) {
  return canvasTex(S, S, (ctx) => {
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, S, S);
    for (let k = 0; k < 40; k++) {
      const x = Math.random() * S, y = Math.random() * S, r = S * (0.05 + Math.random() * 0.2);
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, cloud);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.fillRect(x - r, y - r, 2 * r, 2 * r);
    }
    for (let v = 0; v < veins; v++) {
      ctx.strokeStyle = vein;
      ctx.globalAlpha = 0.15 + Math.random() * 0.5;
      ctx.lineWidth = 0.6 + Math.random() * 2.4;
      ctx.beginPath();
      let x = Math.random() * S, y = Math.random() * S;
      ctx.moveTo(x, y);
      const a = Math.random() * Math.PI;
      for (let k = 0; k < 18; k++) {
        x += Math.cos(a) * S * 0.04 + (Math.random() - 0.5) * S * 0.04;
        y += Math.sin(a) * S * 0.04 + (Math.random() - 0.5) * S * 0.04;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    grain(ctx, S, S, 6);
  }, { repeat: true });
}
export function marble(base, vein, opts = {}) {
  return new THREE.MeshStandardMaterial({ map: marbleTexture(base, vein, opts), roughness: 0.12, metalness: 0.05 });
}

// ---------- wood ----------
// Polished wood: a base, long grain through it.
export function woodTexture(base, dark, { S = 512, across = false } = {}) {
  return canvasTex(S, S, (ctx) => {
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, S, S);
    for (let k = 0; k < 120; k++) {
      ctx.strokeStyle = dark;
      ctx.globalAlpha = 0.08 + Math.random() * 0.25;
      ctx.lineWidth = 0.5 + Math.random() * 2.5;
      const p = Math.random() * S;
      ctx.beginPath();
      if (across) { ctx.moveTo(0, p); ctx.bezierCurveTo(S * 0.3, p + 8, S * 0.6, p - 8, S, p + 4); }
      else { ctx.moveTo(p, 0); ctx.bezierCurveTo(p + 8, S * 0.3, p - 8, S * 0.6, p + 4, S); }
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    grain(ctx, S, S, 8);
  }, { repeat: true });
}
export function wood(base, dark, opts = {}) {
  return new THREE.MeshStandardMaterial({ map: woodTexture(base, dark, opts), roughness: 0.32, metalness: 0.05 });
}

// ---------- chips ----------
// Stacks of casino chips: each chip striped on its edge, the stack a
// little untidy.
const CHIP_COLORS = { white: '#eeeae0', red: '#b3122e', green: '#14743a', black: '#141414', purple: '#5a1a7a', gold: '#c9a24f', blue: '#1a4aa8' };
const chipMats = {};
function chipMat(name) {
  if (chipMats[name]) return chipMats[name];
  const col = CHIP_COLORS[name];
  const edge = canvasTex(256, 32, (ctx, w, h) => {
    ctx.fillStyle = col;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = name === 'white' ? '#1a4aa8' : '#f2efe6';
    for (let i = 0; i < 8; i++) ctx.fillRect(i * 32 + 8, 0, 14, h);
  });
  const face = canvasTex(128, 128, (ctx, w) => {
    ctx.fillStyle = col;
    ctx.fillRect(0, 0, w, w);
    ctx.strokeStyle = name === 'white' ? '#1a4aa8' : '#f2efe6';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(w / 2, w / 2, w * 0.34, 0, Math.PI * 2);
    ctx.stroke();
    for (let i = 0; i < 8; i++) {
      ctx.save();
      ctx.translate(w / 2, w / 2);
      ctx.rotate((i / 8) * Math.PI * 2);
      ctx.fillStyle = ctx.strokeStyle;
      ctx.fillRect(-6, -w / 2, 12, 14);
      ctx.restore();
    }
  });
  const side = new THREE.MeshStandardMaterial({ map: edge, roughness: 0.5 });
  const top = new THREE.MeshStandardMaterial({ map: face, roughness: 0.45 });
  chipMats[name] = [side, top, top];
  return chipMats[name];
}
const chipGeo = new THREE.CylinderGeometry(m(0.02), m(0.02), m(0.0033), 24);
export function chipStack(parent, x, y, z, n, color) {
  const g = new THREE.Group();
  for (let i = 0; i < n; i++) {
    const c = new THREE.Mesh(chipGeo, chipMat(color));
    c.position.set((Math.random() - 0.5) * m(0.002), m(0.0033) * (i + 0.5), (Math.random() - 0.5) * m(0.002));
    c.rotation.y = Math.random() * Math.PI;
    g.add(c);
  }
  g.position.set(x, y, z);
  parent.add(g);
  return g;
}

// ---------- bottles ----------
// Bottles turned on a lathe, the shapes of a back bar: wine, champagne,
// whisky, cognac, gin.
const BOTTLE_PROFILES = {
  wine: [[0, 0], [0.037, 0], [0.037, 0.2], [0.033, 0.23], [0.014, 0.26], [0.013, 0.31], [0.015, 0.315], [0, 0.315]],
  champagne: [[0, 0], [0.043, 0], [0.043, 0.18], [0.035, 0.24], [0.016, 0.28], [0.016, 0.32], [0.019, 0.33], [0, 0.33]],
  whisky: [[0, 0], [0.04, 0], [0.042, 0.16], [0.038, 0.18], [0.016, 0.2], [0.015, 0.24], [0.018, 0.245], [0, 0.245]],
  cognac: [[0, 0], [0.03, 0], [0.055, 0.06], [0.05, 0.13], [0.018, 0.17], [0.015, 0.22], [0.02, 0.225], [0, 0.225]],
  gin: [[0, 0], [0.035, 0], [0.035, 0.2], [0.03, 0.21], [0.015, 0.23], [0.015, 0.27], [0, 0.27]],
};
const bottleGeos = {};
export function bottleGeometry(kind) {
  if (!bottleGeos[kind]) bottleGeos[kind] = new THREE.LatheGeometry(BOTTLE_PROFILES[kind].map(([r, y]) => new THREE.Vector2(m(r), m(y))), 16);
  return bottleGeos[kind];
}
export const BOTTLE_KINDS = Object.keys(BOTTLE_PROFILES);
const glassCache = {};
export function bottleGlass(color) {
  if (!glassCache[color]) glassCache[color] = new THREE.MeshPhysicalMaterial({ color, roughness: 0.05, metalness: 0, clearcoat: 1, emissive: color, emissiveIntensity: 0.25 });
  return glassCache[color];
}
// A shelf of bottles along x, from x0 to x1, standing on y at depth z.
export function bottleRow(parent, x0, x1, y, z, palette, step = m(0.11)) {
  let i = 0;
  for (let x = x0; x <= x1; x += step, i++) {
    const n = BOTTLE_KINDS.length;
    const kind = BOTTLE_KINDS[(((i * 7 + Math.floor(x * 13)) % n) + n) % n];
    const b = new THREE.Mesh(bottleGeometry(kind), bottleGlass(palette[(i * 5 + 1) % palette.length]));
    b.position.set(x, y, z);
    parent.add(b);
  }
}

// Gilt lettering cut from a canvas: transparent where there are no letters.
export function giltText(text, w, h, font) {
  const tex = canvasTex(1024, Math.round((1024 * h) / w), (ctx, W, H) => {
    ctx.font = font.replace('{S}', Math.round(H * 0.7));
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const g = ctx.createLinearGradient(0, H * 0.15, 0, H * 0.85);
    g.addColorStop(0, '#fff0b8');
    g.addColorStop(0.45, '#d4a84a');
    g.addColorStop(0.55, '#8a6220');
    g.addColorStop(1, '#e8c470');
    ctx.shadowColor = 'rgba(0,0,0,0.55)';
    ctx.shadowBlur = 6;
    ctx.shadowOffsetY = 3;
    ctx.fillStyle = g;
    ctx.fillText(text, W / 2, H / 2);
  });
  return new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: tex, transparent: true, alphaTest: 0.1, roughness: 0.3, metalness: 0.6, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.25 }));
}
