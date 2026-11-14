// The Crown Jewels reel symbols, painted: cut gemstones facet by facet, a
// gold crown, the NVGR crest as the wild, and the royals in gold and enamel.
// They go into one atlas (four across, three down) that the reels map their
// faces from, with a second, blurred copy for while a reel is spinning.
//
// Each cell's ground runs on unbroken from top to bottom, so the symbols
// sit on one continuous strip round the reel as on a real machine.

import { LOGO_URL } from '../app/uiHelpers.js';
import { SYMBOLS } from '../slots/rules.js';

export const ATLAS_COLS = 4;
export const ATLAS_ROWS = 3;
const PHONE = window.matchMedia('(pointer: coarse)').matches || window.innerWidth < 820;
export const CELL = PHONE ? 256 : 512;
const S = 512; // every symbol is drawn in a 512 cell and scaled to CELL
export const symbolCell = (sym) => SYMBOLS.indexOf(sym);

// ---------- colour ----------
const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
const rgb = (c, a = 1) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;
// A tone between a gem's darkest and its brightest, 0 to 1.
function tone(pal, v) {
  v = Math.max(0, Math.min(1, v));
  const stops = [pal.deep, pal.dark, pal.mid, pal.light, pal.white];
  const x = v * (stops.length - 1);
  const i = Math.min(stops.length - 2, Math.floor(x));
  return mix(stops[i], stops[i + 1], x - i);
}
const GEMS = {
  ruby: { deep: [38, 0, 8], dark: [96, 4, 22], mid: [178, 14, 42], light: [238, 70, 90], white: [255, 214, 220] },
  emerald: { deep: [0, 26, 14], dark: [3, 72, 40], mid: [10, 140, 78], light: [80, 214, 140], white: [214, 255, 230] },
  sapphire: { deep: [2, 8, 40], dark: [10, 30, 110], mid: [26, 74, 196], light: [96, 150, 250], white: [216, 232, 255] },
  diamond: { deep: [58, 70, 92], dark: [124, 142, 170], mid: [196, 212, 232], light: [236, 244, 255], white: [255, 255, 255] },
  amethyst: { deep: [26, 4, 40], dark: [70, 16, 104], mid: [128, 46, 178], light: [196, 128, 240], white: [240, 222, 255] },
};
// A gold for metalwork, as a gradient over a span.
function goldGrad(ctx, x0, y0, x1, y1, bright = 1) {
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  const k = (c) => rgb(c.map((v) => Math.min(255, Math.round(v * bright))));
  g.addColorStop(0, k([255, 240, 196]));
  g.addColorStop(0.18, k([236, 196, 110]));
  g.addColorStop(0.42, k([170, 118, 40]));
  g.addColorStop(0.6, k([226, 182, 92]));
  g.addColorStop(0.8, k([255, 226, 150]));
  g.addColorStop(1, k([140, 92, 30]));
  return g;
}

// ---------- the ground ----------
// Deep midnight, darker toward the reel's edges, the same all the way down.
function ground(ctx) {
  const g = ctx.createLinearGradient(0, 0, S, 0);
  g.addColorStop(0, '#05050a');
  g.addColorStop(0.18, '#0d0e1b');
  g.addColorStop(0.5, '#141629');
  g.addColorStop(0.82, '#0d0e1b');
  g.addColorStop(1, '#05050a');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, S, S);
  // A faint damask of gold points, in a pattern that tiles top to bottom.
  ctx.fillStyle = 'rgba(214, 178, 110, 0.05)';
  for (let y = 16; y < S; y += 32) for (let x = 16 + ((y / 32) % 2) * 16; x < S; x += 32) { ctx.beginPath(); ctx.arc(x, y, 1.6, 0, Math.PI * 2); ctx.fill(); }
}
// A soft pool of light behind a symbol, in its colour.
function halo(ctx, cx, cy, r, c, a = 0.35) {
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
  g.addColorStop(0, rgb(c, a));
  g.addColorStop(1, rgb(c, 0));
  ctx.fillStyle = g;
  ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
}
// A four-pointed glint.
function glint(ctx, x, y, r, a = 1) {
  ctx.save();
  const g = ctx.createRadialGradient(x, y, 0, x, y, r * 0.6);
  g.addColorStop(0, `rgba(255,255,255,${a})`);
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
  ctx.fillStyle = `rgba(255,255,255,${a})`;
  ctx.beginPath();
  ctx.moveTo(x, y - r); ctx.quadraticCurveTo(x, y, x + r * 0.12, y);
  ctx.quadraticCurveTo(x, y, x, y + r); ctx.quadraticCurveTo(x, y, x - r * 0.12, y);
  ctx.quadraticCurveTo(x, y, x, y - r);
  ctx.moveTo(x - r * 0.75, y); ctx.quadraticCurveTo(x, y, x, y + r * 0.1);
  ctx.quadraticCurveTo(x, y, x + r * 0.75, y); ctx.quadraticCurveTo(x, y, x, y - r * 0.1);
  ctx.quadraticCurveTo(x, y, x - r * 0.75, y);
  ctx.fill();
  ctx.restore();
}
function poly(ctx, pts) {
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.closePath();
}
// How bright a facet facing `angle` is, under a light from the upper left.
const LIGHT = -Math.PI * 0.72;
const facetLight = (angle, k = 0) => 0.5 + 0.38 * Math.cos(angle - LIGHT) + k;

// ---------- cut stones ----------
// A brilliant cut seen from above: table, star, bezel and girdle facets.
function brilliant(ctx, cx, cy, rx, ry, pal, { shadow = true } = {}) {
  const n = 8;
  const at = (k, r) => {
    const a = -Math.PI / 2 + (k * Math.PI) / n;
    return [cx + Math.cos(a) * rx * r, cy + Math.sin(a) * ry * r];
  };
  if (shadow) {
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.7)'; ctx.shadowBlur = rx * 0.18; ctx.shadowOffsetY = rx * 0.08;
    ctx.fillStyle = rgb(pal.deep);
    ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
  const T = 0.5, ST = 0.74;
  for (let i = 0; i < n; i++) {
    const t0 = at(2 * i, T), t1 = at(2 * i + 2, T);
    const s = at(2 * i + 1, ST);
    const o0 = at(2 * i, 1), o1 = at(2 * i + 1, 1), o2 = at(2 * i + 2, 1);
    const sPrev = at(2 * i - 1, ST);
    const ang = (k) => -Math.PI / 2 + (k * Math.PI) / n;
    // Girdle facets, two to each star.
    [[s, o0, o1], [s, o1, o2]].forEach((f, j) => {
      poly(ctx, f); ctx.fillStyle = rgb(tone(pal, facetLight(ang(2 * i + 0.5 + j), j ? -0.12 : 0.06)));
      ctx.fill();
    });
    // The kite between two stars.
    poly(ctx, [t0, sPrev, o0, s]);
    ctx.fillStyle = rgb(tone(pal, facetLight(ang(2 * i), 0.1) * 0.9));
    ctx.fill();
    // The star on the table's edge.
    poly(ctx, [t0, s, t1]);
    ctx.fillStyle = rgb(tone(pal, facetLight(ang(2 * i + 1), i % 2 ? 0.15 : -0.05)));
    ctx.fill();
  }
  // The table: deep in the middle where it reflects the pavilion beneath.
  const table = [];
  for (let k = 0; k < 2 * n; k += 2) table.push(at(k, T));
  poly(ctx, table);
  const g = ctx.createLinearGradient(cx - rx * 0.5, cy - ry * 0.5, cx + rx * 0.5, cy + ry * 0.5);
  g.addColorStop(0, rgb(tone(pal, 0.82)));
  g.addColorStop(0.5, rgb(tone(pal, 0.45)));
  g.addColorStop(1, rgb(tone(pal, 0.62)));
  ctx.fillStyle = g; ctx.fill();
  // The pavilion's arrows, seen through the table.
  ctx.save(); poly(ctx, table); ctx.clip();
  for (let i = 0; i < n; i++) {
    const a = at(2 * i, T * 0.98), b = at(2 * i + 2, T * 0.98);
    poly(ctx, [[cx, cy], a, b]);
    ctx.fillStyle = rgb(tone(pal, i % 2 ? 0.3 : 0.55), 0.55);
    ctx.fill();
  }
  ctx.restore();
  // Facet edges, as hairlines of light.
  ctx.save();
  ctx.strokeStyle = rgb(pal.white, 0.22); ctx.lineWidth = Math.max(1, rx * 0.012);
  for (let i = 0; i < n; i++) {
    const t0 = at(2 * i, T), s = at(2 * i + 1, ST), o0 = at(2 * i, 1), o1 = at(2 * i + 1, 1);
    ctx.beginPath(); ctx.moveTo(...t0); ctx.lineTo(...s); ctx.lineTo(...o1); ctx.moveTo(...s); ctx.lineTo(...o0); ctx.moveTo(...t0); ctx.lineTo(...o0); ctx.stroke();
  }
  ctx.restore();
  // Depth: the stone darkens toward its rim and glows at its heart, and a
  // soft sheen lies across its upper left, as light on a polished crown.
  ctx.save();
  ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2); ctx.clip();
  const depth = ctx.createRadialGradient(cx - rx * 0.15, cy - ry * 0.2, rx * 0.1, cx, cy, rx * 1.02);
  depth.addColorStop(0, rgb(pal.light, 0.28));
  depth.addColorStop(0.55, rgb(pal.mid, 0));
  depth.addColorStop(1, rgb(pal.deep, 0.75));
  ctx.fillStyle = depth; ctx.fillRect(cx - rx, cy - ry, rx * 2, ry * 2);
  const sheen = ctx.createLinearGradient(cx - rx, cy - ry, cx, cy);
  sheen.addColorStop(0, 'rgba(255,255,255,0.32)');
  sheen.addColorStop(0.6, 'rgba(255,255,255,0.08)');
  sheen.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = sheen;
  ctx.beginPath(); ctx.ellipse(cx - rx * 0.28, cy - ry * 0.34, rx * 0.62, ry * 0.4, -0.6, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  // The table's edge, crisp, so the cut reads.
  poly(ctx, table);
  ctx.strokeStyle = rgb(pal.white, 0.6); ctx.lineWidth = Math.max(1.2, rx * 0.016); ctx.stroke();
  // The girdle, a fine bright rim with a dark line outside.
  ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  ctx.strokeStyle = rgb(pal.deep, 0.9); ctx.lineWidth = Math.max(1.5, rx * 0.03); ctx.stroke();
  ctx.beginPath(); ctx.ellipse(cx, cy, rx * 0.985, ry * 0.985, 0, 0, Math.PI * 2);
  ctx.strokeStyle = rgb(pal.light, 0.5); ctx.lineWidth = Math.max(1, rx * 0.012); ctx.stroke();
}
// An emerald cut: an octagon stepped down in rings to a long table.
function stepCut(ctx, cx, cy, w, h, pal) {
  const oct = (sw, sh, c) => [
    [cx - sw / 2 + c, cy - sh / 2], [cx + sw / 2 - c, cy - sh / 2], [cx + sw / 2, cy - sh / 2 + c], [cx + sw / 2, cy + sh / 2 - c],
    [cx + sw / 2 - c, cy + sh / 2], [cx - sw / 2 + c, cy + sh / 2], [cx - sw / 2, cy + sh / 2 - c], [cx - sw / 2, cy - sh / 2 + c],
  ];
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.7)'; ctx.shadowBlur = w * 0.1; ctx.shadowOffsetY = w * 0.05;
  poly(ctx, oct(w, h, w * 0.2)); ctx.fillStyle = rgb(pal.deep); ctx.fill();
  ctx.restore();
  const rings = [1, 0.84, 0.7, 0.56];
  // The direction each of the eight sides faces.
  const facing = [-Math.PI / 2, -Math.PI / 4, 0, Math.PI / 4, Math.PI / 2, Math.PI * 0.75, Math.PI, -Math.PI * 0.75];
  for (let r = 0; r < rings.length - 1; r++) {
    const a = oct(w * rings[r], h * (rings[r] * 0.9 + 0.1), w * 0.2 * rings[r]);
    const b = oct(w * rings[r + 1], h * (rings[r + 1] * 0.9 + 0.1), w * 0.2 * rings[r + 1]);
    for (let i = 0; i < 8; i++) {
      const j = (i + 1) % 8;
      // Side i runs from vertex i to i+1; the corner bevels face between.
      poly(ctx, [a[i], a[j], b[j], b[i]]);
      ctx.fillStyle = rgb(tone(pal, facetLight(facing[i], (r % 2 ? -0.14 : 0.1) - r * 0.04)));
      ctx.fill();
    }
  }
  const t = oct(w * 0.56, h * 0.6, w * 0.112);
  poly(ctx, t);
  const g = ctx.createLinearGradient(cx - w * 0.3, cy - h * 0.3, cx + w * 0.3, cy + h * 0.3);
  g.addColorStop(0, rgb(tone(pal, 0.78))); g.addColorStop(0.45, rgb(tone(pal, 0.42))); g.addColorStop(0.55, rgb(tone(pal, 0.5))); g.addColorStop(1, rgb(tone(pal, 0.66)));
  ctx.fillStyle = g; ctx.fill();
  // Step reflections across the table.
  ctx.save(); poly(ctx, t); ctx.clip();
  ctx.strokeStyle = rgb(pal.white, 0.14); ctx.lineWidth = w * 0.012;
  [0.7, 0.45].forEach((k) => { poly(ctx, oct(w * 0.56 * k, h * 0.6 * k, w * 0.112 * k)); ctx.stroke(); });
  ctx.restore();
  ctx.strokeStyle = rgb(pal.white, 0.25); ctx.lineWidth = Math.max(1, w * 0.008);
  rings.forEach((k) => { poly(ctx, oct(w * k, h * (k * 0.9 + 0.1), w * 0.2 * k)); ctx.stroke(); });
  poly(ctx, oct(w, h, w * 0.2)); ctx.strokeStyle = rgb(pal.deep); ctx.lineWidth = w * 0.02; ctx.stroke();
}
// A diamond seen side on: the crown above the girdle, the pavilion below.
function diamondProfile(ctx, cx, cy, w, h, pal) {
  const top = cy - h * 0.42, girdle = cy - h * 0.12, culet = cy + h * 0.5;
  const tw = w * 0.36, gw = w / 2;
  ctx.save();
  ctx.shadowColor = 'rgba(160,200,255,0.55)'; ctx.shadowBlur = w * 0.22;
  poly(ctx, [[cx - tw, top], [cx + tw, top], [cx + gw, girdle], [cx, culet], [cx - gw, girdle]]);
  ctx.fillStyle = rgb(pal.dark); ctx.fill();
  ctx.restore();
  // The crown: the table's edge in four, the girdle in eight.
  const T = [0, 1, 2, 3, 4].map((i) => [cx - tw + (i * 2 * tw) / 4, top]);
  const G = [0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => [cx - gw + (i * 2 * gw) / 8, girdle]);
  const fire = [[255, 190, 210], [190, 255, 220], [200, 210, 255], [255, 240, 190]];
  for (let i = 0; i < 4; i++) {
    const a = T[i], b = T[i + 1], g0 = G[2 * i], g1 = G[2 * i + 1], g2 = G[2 * i + 2];
    const side = (i - 1.5) / 1.5;
    poly(ctx, [a, g0, g1]); ctx.fillStyle = rgb(tone(pal, 0.86 - side * 0.18 - 0.08)); ctx.fill();
    poly(ctx, [a, g1, b]); ctx.fillStyle = rgb(tone(pal, 0.98 - Math.abs(side) * 0.2)); ctx.fill();
    poly(ctx, [b, g1, g2]); ctx.fillStyle = rgb(tone(pal, 0.7 - side * 0.12)); ctx.fill();
  }
  // The pavilion: long facets running down to the point.
  for (let i = 0; i < 8; i++) {
    const a = G[i], b = G[i + 1];
    const mid = [cx + ((a[0] + b[0]) / 2 - cx) * 0.45, girdle + (culet - girdle) * 0.55];
    const side = (i - 3.5) / 3.5;
    poly(ctx, [a, b, mid]); ctx.fillStyle = rgb(tone(pal, 0.62 + (i % 2 ? 0.2 : -0.1) - side * 0.15)); ctx.fill();
    poly(ctx, [a, mid, [cx, culet]]); ctx.fillStyle = rgb(tone(pal, 0.4 + (i % 2 ? -0.08 : 0.16) - side * 0.12)); ctx.fill();
    // A touch of fire in a few facets.
    if (i === 2 || i === 5) { poly(ctx, [a, b, mid]); ctx.fillStyle = rgb(fire[i % 4], 0.35); ctx.fill(); }
  }
  poly(ctx, [T[0], T[4], G[8], G[0]]);
  ctx.save(); ctx.clip();
  ctx.fillStyle = rgb(fire[0], 0.12); ctx.fillRect(cx - gw, top, gw * 0.6, girdle - top);
  ctx.fillStyle = rgb(fire[2], 0.14); ctx.fillRect(cx + gw * 0.3, top, gw * 0.7, girdle - top);
  ctx.restore();
  // Edges.
  ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = w * 0.007;
  ctx.beginPath();
  for (let i = 0; i < 4; i++) { ctx.moveTo(...T[i]); ctx.lineTo(...G[2 * i + 1]); ctx.lineTo(...T[i + 1]); ctx.moveTo(...G[2 * i]); ctx.lineTo(...T[i]); }
  ctx.moveTo(...G[0]); ctx.lineTo(...G[8]);
  for (let i = 0; i <= 8; i++) { ctx.moveTo(...G[i]); ctx.lineTo(cx, culet); }
  ctx.stroke();
  poly(ctx, [[cx - tw, top], [cx + tw, top], [cx + gw, girdle], [cx, culet], [cx - gw, girdle]]);
  ctx.strokeStyle = 'rgba(70,90,120,0.9)'; ctx.lineWidth = w * 0.014; ctx.stroke();
}

// ---------- the symbols ----------
function drawGem(ctx, kind) {
  const c = S / 2;
  if (kind === 'ruby') {
    halo(ctx, c, c, 230, GEMS.ruby.mid, 0.32);
    brilliant(ctx, c, c, 170, 150, GEMS.ruby);
    glint(ctx, c - 58, c - 62, 46); glint(ctx, c + 70, c + 30, 26, 0.8);
  } else if (kind === 'sapphire') {
    halo(ctx, c, c, 230, GEMS.sapphire.mid, 0.32);
    brilliant(ctx, c, c, 158, 172, GEMS.sapphire);
    glint(ctx, c - 50, c - 74, 44); glint(ctx, c + 54, c + 58, 24, 0.75);
  } else if (kind === 'emerald') {
    halo(ctx, c, c, 230, GEMS.emerald.mid, 0.3);
    stepCut(ctx, c, c, 280, 340, GEMS.emerald);
    glint(ctx, c - 70, c - 110, 42); glint(ctx, c + 80, c + 96, 22, 0.7);
  } else if (kind === 'diamond') {
    halo(ctx, c, c, 240, [150, 190, 255], 0.3);
    diamondProfile(ctx, c, c + 10, 360, 330, GEMS.diamond);
    glint(ctx, c - 70, c - 120, 54); glint(ctx, c + 96, c - 64, 30, 0.85); glint(ctx, c + 10, c + 60, 22, 0.7);
    // The scatter's word, small, in gold.
    letter(ctx, 'SCATTER', c, S - 34, 34, null, { spacing: 6, weight: 700 });
  }
}
function pearl(ctx, x, y, r) {
  const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r);
  g.addColorStop(0, '#ffffff'); g.addColorStop(0.45, '#f1ebe0'); g.addColorStop(1, '#a89c8a');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
}
// A cross pattée: four arms flaring out from a small centre.
function crossPattee(ctx, x, y, r) {
  ctx.beginPath();
  for (let k = 0; k < 4; k++) {
    const a = (k * Math.PI) / 2 - Math.PI / 2;
    const ca = Math.cos(a), sa = Math.sin(a);
    const px = -sa, py = ca; // across the arm
    const n = r * 0.16, f = r * 0.42;
    ctx.lineTo(x + px * n, y + py * n);
    ctx.lineTo(x + ca * r + px * f, y + sa * r + py * f);
    ctx.quadraticCurveTo(x + ca * r * 0.86, y + sa * r * 0.86, x + ca * r - px * f, y + sa * r - py * f);
    ctx.lineTo(x - px * n, y - py * n);
  }
  ctx.closePath();
}
// A fleur-de-lis, standing on (x, y).
function fleur(ctx, x, y, h) {
  const w = h * 0.62;
  ctx.beginPath();
  // The tall middle petal.
  ctx.moveTo(x, y - h);
  ctx.bezierCurveTo(x + w * 0.32, y - h * 0.72, x + w * 0.2, y - h * 0.42, x + w * 0.08, y - h * 0.3);
  // The right petal, curling out and down.
  ctx.bezierCurveTo(x + w * 0.5, y - h * 0.62, x + w * 0.86, y - h * 0.38, x + w * 0.52, y - h * 0.12);
  ctx.bezierCurveTo(x + w * 0.5, y - h * 0.3, x + w * 0.3, y - h * 0.3, x + w * 0.16, y - h * 0.2);
  ctx.lineTo(x + w * 0.12, y);
  ctx.lineTo(x - w * 0.12, y);
  ctx.lineTo(x - w * 0.16, y - h * 0.2);
  ctx.bezierCurveTo(x - w * 0.3, y - h * 0.3, x - w * 0.5, y - h * 0.3, x - w * 0.52, y - h * 0.12);
  ctx.bezierCurveTo(x - w * 0.86, y - h * 0.38, x - w * 0.5, y - h * 0.62, x - w * 0.08, y - h * 0.3);
  ctx.bezierCurveTo(x - w * 0.2, y - h * 0.42, x - w * 0.32, y - h * 0.72, x, y - h);
  ctx.closePath();
}
function drawCrown(ctx) {
  const c = S / 2;
  halo(ctx, c, c + 10, 240, [255, 196, 90], 0.26);
  const bx0 = c - 172, bx1 = c + 172, by0 = c + 50, by1 = c + 128;
  const capTop = c - 118;
  // The velvet cap, deep crimson, seen between the arches.
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.75)'; ctx.shadowBlur = 26; ctx.shadowOffsetY = 12;
  const cap = ctx.createRadialGradient(c - 30, c - 50, 10, c, c, 180);
  cap.addColorStop(0, '#8e1430'); cap.addColorStop(0.55, '#4c0819'); cap.addColorStop(1, '#1d0309');
  ctx.fillStyle = cap;
  ctx.beginPath(); ctx.moveTo(bx0 + 30, by0); ctx.bezierCurveTo(bx0 + 34, capTop - 6, bx1 - 34, capTop - 6, bx1 - 30, by0); ctx.closePath(); ctx.fill();
  ctx.restore();
  // The arches: slim gold bands, beaded with pearls along both edges,
  // rising from the band to meet beneath the orb.
  const archPath = (sx) => { ctx.beginPath(); ctx.moveTo(sx, by0 + 2); ctx.bezierCurveTo(sx + (c - sx) * 0.02, capTop - 30, c - (c - sx) * 0.45, capTop - 22, c, capTop + 6); };
  const along = (sx, t) => {
    const x0 = sx, y0 = by0 + 2, x1 = sx + (c - sx) * 0.02, y1 = capTop - 30, x2 = c - (c - sx) * 0.45, y2 = capTop - 22, x3 = c, y3 = capTop + 6;
    const u = 1 - t;
    return [u * u * u * x0 + 3 * u * u * t * x1 + 3 * u * t * t * x2 + t * t * t * x3, u * u * u * y0 + 3 * u * u * t * y1 + 3 * u * t * t * y2 + t * t * t * y3];
  };
  [bx0 + 26, bx1 - 26].forEach((sx) => {
    archPath(sx);
    ctx.lineCap = 'round';
    ctx.lineWidth = 20; ctx.strokeStyle = 'rgba(60,36,8,0.9)'; ctx.stroke();
    ctx.lineWidth = 16; ctx.strokeStyle = goldGrad(ctx, bx0, capTop - 40, bx1, by0, 0.98); ctx.stroke();
    ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(255,246,214,0.7)'; ctx.stroke();
    for (let k = 1; k < 12; k++) {
      const [x, y] = along(sx, k / 12);
      pearl(ctx, x + (sx < c ? -9 : 9) * (1 - k / 12) , y - 7 * (k / 12), 4.5);
    }
  });
  // The front half-arch, straight up the middle.
  ctx.lineWidth = 20; ctx.strokeStyle = 'rgba(60,36,8,0.9)';
  ctx.beginPath(); ctx.moveTo(c, by0 + 2); ctx.lineTo(c, capTop + 8); ctx.stroke();
  ctx.lineWidth = 16; ctx.strokeStyle = goldGrad(ctx, c - 10, 0, c + 10, 0); ctx.stroke();
  for (let k = 1; k < 8; k++) pearl(ctx, c, by0 - ((by0 - capTop) * k) / 8, 4.5);
  // The orb, its band, and the cross on top.
  const oy = capTop - 22;
  const og = ctx.createRadialGradient(c - 10, oy - 10, 2, c, oy, 30);
  og.addColorStop(0, '#fff3cc'); og.addColorStop(0.4, '#e2b45a'); og.addColorStop(1, '#6e4a12');
  ctx.fillStyle = og; ctx.beginPath(); ctx.arc(c, oy, 26, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = 'rgba(90,56,14,0.9)'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.ellipse(c, oy, 26, 7, 0, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = goldGrad(ctx, c - 30, oy - 90, c + 30, oy - 20);
  crossPattee(ctx, c, oy - 58, 30); ctx.fill();
  brilliant(ctx, c, oy - 58, 8, 8, GEMS.sapphire, { shadow: false });
  // On the band: crosses pattée at the middle and the ends, fleurs between.
  [[-1, 'cross'], [-0.5, 'fleur'], [0, 'cross'], [0.5, 'fleur'], [1, 'cross']].forEach(([k, kind]) => {
    const x = c + k * 150;
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 8; ctx.shadowOffsetY = 4;
    ctx.fillStyle = goldGrad(ctx, x - 40, by0 - 80, x + 40, by0);
    if (kind === 'cross') { crossPattee(ctx, x, by0 - 34, k === 0 ? 34 : 28); ctx.fill(); }
    else { fleur(ctx, x, by0 + 2, 74); ctx.fill(); }
    ctx.restore();
    ctx.strokeStyle = 'rgba(255,240,200,0.5)'; ctx.lineWidth = 1.5;
    if (kind === 'cross') { crossPattee(ctx, x, by0 - 34, k === 0 ? 34 : 28); ctx.stroke(); brilliant(ctx, x, by0 - 34, 8, 8, k === 0 ? GEMS.ruby : GEMS.emerald, { shadow: false }); }
    else { fleur(ctx, x, by0 + 2, 74); ctx.stroke(); }
  });
  // The band, jewelled, over a fine rim of ermine.
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 16; ctx.shadowOffsetY = 8;
  ctx.fillStyle = '#f2ece2';
  ctx.beginPath(); ctx.roundRect(bx0 - 6, by1 - 8, bx1 - bx0 + 12, 26, 13); ctx.fill();
  ctx.restore();
  ctx.fillStyle = '#16120e';
  for (let x = bx0 + 12; x < bx1; x += 34) { ctx.beginPath(); ctx.moveTo(x, by1 + 2); ctx.lineTo(x + 3, by1 + 12); ctx.lineTo(x - 3, by1 + 12); ctx.closePath(); ctx.fill(); }
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 10; ctx.shadowOffsetY = 5;
  ctx.fillStyle = goldGrad(ctx, 0, by0, 0, by1);
  ctx.beginPath(); ctx.roundRect(bx0, by0, bx1 - bx0, by1 - by0 - 6, 8); ctx.fill();
  ctx.restore();
  ctx.strokeStyle = 'rgba(90,56,14,0.85)'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(bx0 + 6, by0 + 13); ctx.lineTo(bx1 - 6, by0 + 13); ctx.moveTo(bx0 + 6, by1 - 19); ctx.lineTo(bx1 - 6, by1 - 19); ctx.stroke();
  ctx.strokeStyle = 'rgba(255,246,214,0.6)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(bx0 + 8, by0 + 3); ctx.lineTo(bx1 - 8, by0 + 3); ctx.stroke();
  const my = (by0 + by1 - 6) / 2;
  brilliant(ctx, c, my, 26, 20, GEMS.ruby);
  brilliant(ctx, c - 86, my, 18, 15, GEMS.sapphire); brilliant(ctx, c + 86, my, 18, 15, GEMS.sapphire);
  brilliant(ctx, c - 146, my, 14, 12, GEMS.emerald); brilliant(ctx, c + 146, my, 14, 12, GEMS.emerald);
  [-116, -44, 44, 116].forEach((dx) => pearl(ctx, c + dx, my, 7));
  glint(ctx, c - 10, my - 8, 16, 0.9);
  glint(ctx, c - 120, by0 - 50, 22, 0.6);
}
// Lettering in gold over an enamel colour, with a dark bevel beneath.
function letter(ctx, text, x, y, size, pal, { spacing = 0, weight = 900 } = {}) {
  ctx.save();
  ctx.font = `${weight} ${size}px Cinzel, "Cinzel", Georgia, serif`;
  if ('letterSpacing' in ctx) ctx.letterSpacing = spacing + 'px';
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  const top = y - size * 0.72;
  ctx.shadowColor = 'rgba(0,0,0,0.8)'; ctx.shadowBlur = size * 0.08; ctx.shadowOffsetY = size * 0.04;
  ctx.lineJoin = 'round';
  ctx.lineWidth = pal ? size * 0.11 : size * 0.06;
  ctx.strokeStyle = goldGrad(ctx, 0, top, 0, y);
  ctx.strokeText(text, x, y);
  ctx.shadowColor = 'transparent';
  if (pal) {
    const g = ctx.createLinearGradient(0, top, 0, y);
    g.addColorStop(0, rgb(tone(pal, 0.85))); g.addColorStop(0.45, rgb(tone(pal, 0.55))); g.addColorStop(1, rgb(tone(pal, 0.28)));
    ctx.fillStyle = g;
  } else {
    ctx.fillStyle = goldGrad(ctx, 0, top, 0, y, 1.05);
  }
  ctx.fillText(text, x, y);
  // A line of light across the top of the enamel.
  if (pal) {
    ctx.save(); ctx.beginPath(); ctx.rect(0, top - 4, S, size * 0.3); ctx.clip();
    ctx.fillStyle = 'rgba(255,255,255,0.28)'; ctx.fillText(text, x, y); ctx.restore();
    ctx.lineWidth = size * 0.018; ctx.strokeStyle = 'rgba(255,240,200,0.75)'; ctx.strokeText(text, x, y);
  }
  ctx.restore();
}
function flourish(ctx, cx, y, w) {
  ctx.save();
  ctx.strokeStyle = goldGrad(ctx, cx - w, y, cx + w, y); ctx.lineWidth = 5; ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(cx - w, y); ctx.bezierCurveTo(cx - w * 0.6, y - 18, cx - w * 0.3, y + 18, cx, y);
  ctx.bezierCurveTo(cx + w * 0.3, y + 18, cx + w * 0.6, y - 18, cx + w, y);
  ctx.stroke();
  ctx.fillStyle = goldGrad(ctx, cx - 10, y - 10, cx + 10, y + 10);
  ctx.beginPath(); ctx.moveTo(cx, y - 12); ctx.lineTo(cx + 9, y); ctx.lineTo(cx, y + 12); ctx.lineTo(cx - 9, y); ctx.closePath(); ctx.fill();
  ctx.restore();
}
function drawRoyal(ctx, ch) {
  const pal = { A: GEMS.ruby, K: GEMS.sapphire, Q: GEMS.emerald, J: GEMS.amethyst }[ch];
  halo(ctx, S / 2, S / 2, 220, pal.mid, 0.22);
  // The Q's long tail needs the room: a touch smaller and left of centre.
  if (ch === 'Q') letter(ctx, ch, S / 2 - 40, S / 2 + 100, 270, pal);
  else letter(ctx, ch, S / 2, S / 2 + 118, 330, pal);
  flourish(ctx, S / 2, S / 2 + 168, 120);
}
function drawWild(ctx, logo) {
  const c = S / 2;
  halo(ctx, c, c, 250, [255, 190, 80], 0.42);
  // A plate of black lacquer in a gold frame.
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.8)'; ctx.shadowBlur = 24; ctx.shadowOffsetY = 10;
  ctx.fillStyle = goldGrad(ctx, 0, 40, 0, S - 40);
  ctx.beginPath(); ctx.roundRect(40, 34, S - 80, S - 68, 34); ctx.fill();
  ctx.restore();
  const p = ctx.createLinearGradient(0, 50, 0, S - 50);
  p.addColorStop(0, '#1b1612'); p.addColorStop(1, '#060505');
  ctx.fillStyle = p; ctx.beginPath(); ctx.roundRect(54, 48, S - 108, S - 96, 26); ctx.fill();
  ctx.strokeStyle = 'rgba(232,196,120,0.55)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.roundRect(66, 60, S - 132, S - 120, 20); ctx.stroke();
  if (logo) {
    // Inside the frame, clear of the ribbon.
    ctx.save();
    ctx.beginPath(); ctx.roundRect(54, 48, S - 108, S - 96, 26); ctx.clip();
    const w = S - 150;
    ctx.drawImage(logo, c - w / 2, 46, w, w);
    ctx.restore();
  }
  // The word on a ruby ribbon across the foot.
  const ry = S - 104;
  ctx.fillStyle = '#5c0b18';
  ctx.beginPath(); ctx.moveTo(70, ry - 26); ctx.lineTo(S - 70, ry - 26); ctx.lineTo(S - 56, ry + 2); ctx.lineTo(S - 70, ry + 30); ctx.lineTo(70, ry + 30); ctx.lineTo(56, ry + 2); ctx.closePath(); ctx.fill();
  const rg = ctx.createLinearGradient(0, ry - 26, 0, ry + 30);
  rg.addColorStop(0, '#c4203a'); rg.addColorStop(1, '#7c0e20');
  ctx.fillStyle = rg; ctx.fillRect(84, ry - 22, S - 168, 48);
  ctx.strokeStyle = goldGrad(ctx, 84, 0, S - 84, 0); ctx.lineWidth = 3; ctx.strokeRect(84, ry - 22, S - 168, 48);
  letter(ctx, 'WILD', c, ry + 17, 46, null, { spacing: 14, weight: 900 });
}

// Paints one symbol into a 512 cell at (x, y) of a context scaled to CELL.
function paint(ctx, sym, logo) {
  ground(ctx);
  if (sym === 'wild') drawWild(ctx, logo);
  else if (sym === 'crown') drawCrown(ctx);
  else if (sym === 'A' || sym === 'K' || sym === 'Q' || sym === 'J') drawRoyal(ctx, sym);
  else drawGem(ctx, sym);
}

/**
 * The atlas: { sharp, blur } canvases, and `ready`, a promise that settles
 * once the crest and the lettering's font are in (the atlas is painted at
 * once, and painted again then; call onRepaint to hear of it).
 */
export function createSymbolAtlas() {
  const W = CELL * ATLAS_COLS, H = CELL * ATLAS_ROWS;
  const sharp = document.createElement('canvas');
  sharp.width = W; sharp.height = H;
  const blur = document.createElement('canvas');
  blur.width = W; blur.height = H;
  const listeners = [];
  function draw(logo) {
    const ctx = sharp.getContext('2d');
    ctx.clearRect(0, 0, W, H);
    SYMBOLS.forEach((sym, i) => {
      ctx.save();
      ctx.translate((i % ATLAS_COLS) * CELL, Math.floor(i / ATLAS_COLS) * CELL);
      ctx.scale(CELL / S, CELL / S);
      ctx.beginPath(); ctx.rect(0, 0, S, S); ctx.clip();
      paint(ctx, sym, logo);
      ctx.restore();
    });
    // The spinning copy: each cell smeared up and down its own column,
    // wrapping, as a reel's strip blurs past the window.
    const b = blur.getContext('2d');
    b.clearRect(0, 0, W, H);
    SYMBOLS.forEach((sym, i) => {
      const x = (i % ATLAS_COLS) * CELL, y = Math.floor(i / ATLAS_COLS) * CELL;
      b.save();
      b.beginPath(); b.rect(x, y, CELL, CELL); b.clip();
      const passes = 30, reach = CELL * 0.4;
      b.globalAlpha = 1;
      b.drawImage(sharp, x, y, CELL, CELL, x, y, CELL, CELL);
      for (let k = 0; k < passes; k++) {
        const dy = ((k / (passes - 1)) - 0.5) * 2 * reach;
        b.globalAlpha = 0.085;
        b.drawImage(sharp, x, y, CELL, CELL, x, y + dy, CELL, CELL);
        b.drawImage(sharp, x, y, CELL, CELL, x, y + dy + (dy > 0 ? -CELL : CELL), CELL, CELL);
      }
      // A dark wash, so the blur reads as speed and not glare.
      b.globalAlpha = 0.18; b.fillStyle = '#000'; b.fillRect(x, y, CELL, CELL);
      b.restore();
    });
    listeners.forEach((fn) => fn());
  }
  draw(null);
  const logo = new Image();
  const logoIn = new Promise((res) => { logo.onload = () => res(logo); logo.onerror = () => res(null); });
  logo.src = LOGO_URL;
  const fontIn = (document.fonts ? Promise.all([document.fonts.load('900 100px Cinzel'), document.fonts.load('700 100px Cinzel')]).catch(() => {}) : Promise.resolve());
  const ready = Promise.all([logoIn, fontIn]).then(([img]) => { draw(img); });
  return { sharp, blur, ready, onRepaint: (fn) => listeners.push(fn) };
}
