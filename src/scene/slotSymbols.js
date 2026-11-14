// The salon's reel symbols, painted: cut gemstones facet by facet, a gold
// crown, the NVGR crest as a wild, royals in gold or platinum and enamel,
// sevens and chrome BAR plates, cherries, the casino's own ace, wheel, dice
// and chips. Each machine gets one atlas of its own symbols, on its own
// ground (midnight, ivory reel strip or velvet), that its reels map their
// faces from, with a second, blurred copy for while a reel is spinning.
//
// Each cell's ground runs on unbroken from top to bottom, so the symbols
// sit on one continuous strip round the reel as on a real machine.

import { LOGO_URL } from '../app/uiHelpers.js';

const PHONE = window.matchMedia('(pointer: coarse)').matches || window.innerWidth < 820;
// Pixels across a square cell; a wider cell (three reels) is wider still.
export const CELL = PHONE ? 256 : 512;
const S = 512; // every symbol is drawn in a 512 square and scaled to the cell
// The ground being painted, for the symbols that look different on it.
let STYLE = 'midnight';

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

// Platinum and chrome, for the machines trimmed in silver.
function silverGrad(ctx, x0, y0, x1, y1, warm = false) {
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  const c = warm ? ['#ffffff', '#dcdde4', '#8c8f9c', '#d4d6de', '#f4f4f8', '#6e717c'] : ['#ffffff', '#d6dde8', '#7c8698', '#c8d0dc', '#f2f6fb', '#5e6676'];
  [0, 0.18, 0.42, 0.6, 0.8, 1].forEach((t, i) => g.addColorStop(t, c[i]));
  return g;
}
const metalGrad = (ctx, metal, x0, y0, x1, y1) => (metal === 'gold' ? goldGrad(ctx, x0, y0, x1, y1) : silverGrad(ctx, x0, y0, x1, y1, metal === 'platinum'));

// ---------- the ground ----------
// Painted over the whole cell, W by H in symbol units, the same all the way
// down so the strip runs on unbroken.
function ground(ctx, W, H) {
  const g = ctx.createLinearGradient(0, 0, W, 0);
  if (STYLE === 'ivory') {
    // A mechanical reel's printed strip: warm ivory, shaded at the edges.
    g.addColorStop(0, '#9c917c'); g.addColorStop(0.12, '#d6ccb4'); g.addColorStop(0.5, '#ece4d2'); g.addColorStop(0.88, '#d6ccb4'); g.addColorStop(1, '#9c917c');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(120,100,70,0.05)';
    for (let x = 6; x < W; x += 9) ctx.fillRect(x, 0, 1, H);
    return;
  }
  if (STYLE === 'crimson') {
    // Red silk, shaded at the edges, a fine gold lattice woven through.
    g.addColorStop(0, '#2a0306'); g.addColorStop(0.18, '#5a0a12'); g.addColorStop(0.5, '#7a1018'); g.addColorStop(0.82, '#5a0a12'); g.addColorStop(1, '#2a0306');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = 'rgba(230,190,110,0.07)'; ctx.lineWidth = 2;
    for (let y = 0; y < H; y += 64) for (let x = (y / 64) % 2 ? 32 : 0; x < W + 64; x += 64) {
      ctx.beginPath(); ctx.moveTo(x, y - 24); ctx.lineTo(x + 24, y); ctx.lineTo(x, y + 24); ctx.lineTo(x - 24, y); ctx.closePath(); ctx.stroke();
    }
    return;
  }
  if (STYLE === 'velvet') {
    // Midnight blue velvet with a fine silver point.
    g.addColorStop(0, '#04050d'); g.addColorStop(0.2, '#0b1030'); g.addColorStop(0.5, '#131a44'); g.addColorStop(0.8, '#0b1030'); g.addColorStop(1, '#04050d');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(200,214,240,0.06)';
    for (let y = 16; y < H; y += 32) for (let x = 16 + ((y / 32) % 2) * 16; x < W; x += 32) { ctx.beginPath(); ctx.arc(x, y, 1.6, 0, Math.PI * 2); ctx.fill(); }
    return;
  }
  // Deep midnight, darker toward the reel's edges.
  g.addColorStop(0, '#05050a'); g.addColorStop(0.18, '#0d0e1b'); g.addColorStop(0.5, '#141629'); g.addColorStop(0.82, '#0d0e1b'); g.addColorStop(1, '#05050a');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  // A faint damask of gold points, in a pattern that tiles top to bottom.
  ctx.fillStyle = 'rgba(214, 178, 110, 0.05)';
  for (let y = 16; y < H; y += 32) for (let x = 16 + ((y / 32) % 2) * 16; x < W; x += 32) { ctx.beginPath(); ctx.arc(x, y, 1.6, 0, Math.PI * 2); ctx.fill(); }
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
function letter(ctx, text, x, y, size, pal, { spacing = 0, weight = 900, metal = 'gold' } = {}) {
  ctx.save();
  ctx.font = `${weight} ${size}px Cinzel, "Cinzel", Georgia, serif`;
  if ('letterSpacing' in ctx) ctx.letterSpacing = spacing + 'px';
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  const top = y - size * 0.72;
  ctx.shadowColor = 'rgba(0,0,0,0.8)'; ctx.shadowBlur = size * 0.08; ctx.shadowOffsetY = size * 0.04;
  ctx.lineJoin = 'round';
  ctx.lineWidth = pal ? size * 0.11 : size * 0.06;
  ctx.strokeStyle = metalGrad(ctx, metal, 0, top, 0, y);
  ctx.strokeText(text, x, y);
  ctx.shadowColor = 'transparent';
  if (pal) {
    const g = ctx.createLinearGradient(0, top, 0, y);
    g.addColorStop(0, rgb(tone(pal, 0.85))); g.addColorStop(0.45, rgb(tone(pal, 0.55))); g.addColorStop(1, rgb(tone(pal, 0.28)));
    ctx.fillStyle = g;
  } else {
    ctx.fillStyle = metal === 'gold' ? goldGrad(ctx, 0, top, 0, y, 1.05) : metalGrad(ctx, metal, 0, top, 0, y);
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

// ---------- Imperial Sevens ----------
// A seven in enamel, rimmed in polished chrome.
function drawSeven(ctx, pal) {
  const c = S / 2;
  ctx.save();
  ctx.font = '900 400px Cinzel, "Cinzel", Georgia, serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  const y = c + 150, top = y - 300;
  ctx.shadowColor = 'rgba(0,0,0,0.45)'; ctx.shadowBlur = 18; ctx.shadowOffsetY = 10;
  ctx.lineJoin = 'round';
  ctx.lineWidth = 44; ctx.strokeStyle = '#2a2a30'; ctx.strokeText('7', c, y);
  ctx.shadowColor = 'transparent';
  ctx.lineWidth = 34; ctx.strokeStyle = silverGrad(ctx, 0, top, 0, y); ctx.strokeText('7', c, y);
  const g = ctx.createLinearGradient(0, top, 0, y);
  g.addColorStop(0, rgb(tone(pal, 0.9))); g.addColorStop(0.5, rgb(tone(pal, 0.55))); g.addColorStop(1, rgb(tone(pal, 0.25)));
  ctx.fillStyle = g; ctx.fillText('7', c, y);
  ctx.save(); ctx.beginPath(); ctx.rect(0, top - 10, S, 110); ctx.clip();
  ctx.fillStyle = 'rgba(255,255,255,0.3)'; ctx.fillText('7', c, y); ctx.restore();
  ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.strokeText('7', c, y);
  ctx.restore();
}
const GOLD_PAL = { deep: [70, 40, 4], dark: [140, 92, 22], mid: [214, 160, 58], light: [250, 214, 120], white: [255, 246, 214] };
// BAR plates: black lacquer in a chrome bevel, the word in polished silver.
function plate(ctx, cx, cy, w, h) {
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.45)'; ctx.shadowBlur = 12; ctx.shadowOffsetY = 6;
  ctx.fillStyle = silverGrad(ctx, 0, cy - h / 2, 0, cy + h / 2);
  ctx.beginPath(); ctx.roundRect(cx - w / 2, cy - h / 2, w, h, h * 0.22); ctx.fill();
  ctx.restore();
  const g = ctx.createLinearGradient(0, cy - h / 2, 0, cy + h / 2);
  g.addColorStop(0, '#2a2a30'); g.addColorStop(0.5, '#0b0b0e'); g.addColorStop(1, '#1a1a20');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.roundRect(cx - w / 2 + 9, cy - h / 2 + 9, w - 18, h - 18, h * 0.16); ctx.fill();
  ctx.save();
  ctx.font = `900 ${h * 0.62}px Cinzel, "Cinzel", Georgia, serif`;
  if ('letterSpacing' in ctx) ctx.letterSpacing = `${h * 0.12}px`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = silverGrad(ctx, 0, cy - h * 0.3, 0, cy + h * 0.3);
  ctx.fillText('BAR', cx + h * 0.06, cy + h * 0.04);
  ctx.restore();
}
function drawBars(ctx, n) {
  const c = S / 2, h = n === 1 ? 130 : n === 2 ? 108 : 92, w = 400, gap = 16;
  const total = n * h + (n - 1) * gap;
  for (let k = 0; k < n; k++) plate(ctx, c, c - total / 2 + h / 2 + k * (h + gap), w, h);
}
// Two cherries on their stems, polished deep red.
function drawCherries(ctx) {
  const c = S / 2;
  const fruit = (x, y, r) => {
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.4)'; ctx.shadowBlur = 16; ctx.shadowOffsetY = 8;
    const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.08, x, y, r);
    g.addColorStop(0, '#ff8a94'); g.addColorStop(0.25, '#d8142e'); g.addColorStop(0.7, '#8a0718'); g.addColorStop(1, '#3c0208');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.beginPath(); ctx.ellipse(x - r * 0.38, y - r * 0.42, r * 0.2, r * 0.11, -0.7, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(60,0,8,0.6)'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(x + r * 0.05, y - r * 0.9, r * 0.12, 0, Math.PI); ctx.stroke();
  };
  // The stems, from the fruit up to where they join.
  ctx.lineCap = 'round';
  const stem = (x0, y0, cx1, cy1, x1, y1) => {
    ctx.strokeStyle = '#3d5a1e'; ctx.lineWidth = 12; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.quadraticCurveTo(cx1, cy1, x1, y1); ctx.stroke();
    ctx.strokeStyle = 'rgba(170,210,110,0.5)'; ctx.lineWidth = 3; ctx.stroke();
  };
  stem(c - 92, c + 30, c - 60, c - 110, c + 30, c - 170);
  stem(c + 96, c + 60, c + 70, c - 80, c + 30, c - 170);
  // A leaf where they meet.
  const lg = ctx.createLinearGradient(c + 30, c - 200, c + 170, c - 120);
  lg.addColorStop(0, '#5f9a2a'); lg.addColorStop(1, '#2c5212');
  ctx.fillStyle = lg;
  ctx.beginPath(); ctx.moveTo(c + 30, c - 170); ctx.quadraticCurveTo(c + 110, c - 250, c + 190, c - 150); ctx.quadraticCurveTo(c + 100, c - 120, c + 30, c - 170); ctx.fill();
  ctx.strokeStyle = 'rgba(200,240,150,0.5)'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(c + 34, c - 168); ctx.quadraticCurveTo(c + 110, c - 180, c + 186, c - 152); ctx.stroke();
  fruit(c - 92, c + 92, 86);
  fruit(c + 96, c + 116, 80);
}
// The Diamond wild: a brilliant on a lacquer plate, WILD and 2× in gold.
function drawDiamondWild(ctx) {
  const c = S / 2;
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 20; ctx.shadowOffsetY = 8;
  ctx.fillStyle = silverGrad(ctx, 0, 40, 0, S - 40);
  ctx.beginPath(); ctx.roundRect(46, 40, S - 92, S - 80, 36); ctx.fill();
  ctx.restore();
  const p = ctx.createLinearGradient(0, 50, 0, S - 50);
  p.addColorStop(0, '#20263a'); p.addColorStop(1, '#070910');
  ctx.fillStyle = p; ctx.beginPath(); ctx.roundRect(58, 52, S - 116, S - 104, 28); ctx.fill();
  halo(ctx, c, c - 30, 190, [160, 200, 255], 0.35);
  diamondProfile(ctx, c, c - 34, 300, 270, GEMS.diamond);
  glint(ctx, c - 64, c - 140, 44); glint(ctx, c + 80, c - 90, 26, 0.8);
  letter(ctx, 'WILD', c - 40, S - 92, 64, null, { spacing: 10, weight: 900 });
  // The 2× medallion.
  ctx.save();
  ctx.fillStyle = goldGrad(ctx, 0, S - 160, 0, S - 60);
  ctx.beginPath(); ctx.arc(c + 128, S - 112, 46, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#7a0e1e'; ctx.beginPath(); ctx.arc(c + 128, S - 112, 38, 0, Math.PI * 2); ctx.fill();
  ctx.font = '900 40px Cinzel, Georgia, serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = goldGrad(ctx, 0, S - 140, 0, S - 90); ctx.fillText('2×', c + 130, S - 109);
  ctx.restore();
}

// ---------- High Roller ----------
// The ace of spades, a black card edged in gold.
function spadePath(ctx, x, y, s) {
  ctx.beginPath(); ctx.moveTo(x, y - s);
  ctx.bezierCurveTo(x + s * 0.35, y - s * 0.55, x + s, y - s * 0.25, x + s * 0.9, y + s * 0.2);
  ctx.bezierCurveTo(x + s * 0.82, y + s * 0.55, x + s * 0.35, y + s * 0.6, x + s * 0.08, y + s * 0.32);
  ctx.lineTo(x + s * 0.28, y + s * 0.95); ctx.lineTo(x - s * 0.28, y + s * 0.95); ctx.lineTo(x - s * 0.08, y + s * 0.32);
  ctx.bezierCurveTo(x - s * 0.35, y + s * 0.6, x - s * 0.82, y + s * 0.55, x - s * 0.9, y + s * 0.2);
  ctx.bezierCurveTo(x - s, y - s * 0.25, x - s * 0.35, y - s * 0.55, x, y - s);
}
function drawAce(ctx) {
  const c = S / 2;
  halo(ctx, c, c, 240, [255, 200, 100], 0.3);
  ctx.save(); ctx.translate(c, c); ctx.rotate(-0.08);
  const w = 300, h = 420;
  ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.7)'; ctx.shadowBlur = 26; ctx.shadowOffsetY = 12;
  ctx.fillStyle = goldGrad(ctx, 0, -h / 2, 0, h / 2);
  ctx.beginPath(); ctx.roundRect(-w / 2, -h / 2, w, h, 26); ctx.fill(); ctx.restore();
  const g = ctx.createLinearGradient(0, -h / 2, 0, h / 2);
  g.addColorStop(0, '#1d1a17'); g.addColorStop(1, '#070606');
  ctx.fillStyle = g; ctx.beginPath(); ctx.roundRect(-w / 2 + 10, -h / 2 + 10, w - 20, h - 20, 20); ctx.fill();
  ctx.strokeStyle = 'rgba(232,196,120,0.6)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.roundRect(-w / 2 + 22, -h / 2 + 22, w - 44, h - 44, 14); ctx.stroke();
  ctx.fillStyle = goldGrad(ctx, 0, -110, 0, 110);
  spadePath(ctx, 0, -10, 105); ctx.fill();
  ctx.strokeStyle = 'rgba(255,240,200,0.8)'; ctx.lineWidth = 3; spadePath(ctx, 0, -10, 105); ctx.stroke();
  ctx.font = '900 64px Cinzel, Georgia, serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = goldGrad(ctx, 0, -h / 2, 0, -h / 2 + 90);
  ctx.fillText('A', -w / 2 + 52, -h / 2 + 60);
  ctx.save(); ctx.rotate(Math.PI); ctx.fillText('A', -w / 2 + 52, -h / 2 + 60); ctx.restore();
  ctx.restore();
  glint(ctx, c - 70, c - 150, 34, 0.8);
}
// The wheel from above: mahogany, gold, thirty-seven pockets and the turret.
function drawWheel(ctx) {
  const c = S / 2, R = 210;
  ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.7)'; ctx.shadowBlur = 24; ctx.shadowOffsetY = 10;
  const wood = ctx.createRadialGradient(c - 60, c - 60, 20, c, c, R);
  wood.addColorStop(0, '#7a3418'); wood.addColorStop(1, '#2a0c04');
  ctx.fillStyle = wood; ctx.beginPath(); ctx.arc(c, c, R, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  ctx.strokeStyle = goldGrad(ctx, c - R, c - R, c + R, c + R); ctx.lineWidth = 10;
  ctx.beginPath(); ctx.arc(c, c, R - 18, 0, Math.PI * 2); ctx.stroke();
  const ORDER = [0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26];
  const r0 = R - 26, r1 = R - 82;
  ORDER.forEach((n, i) => {
    const a0 = (i / 37) * Math.PI * 2 - Math.PI / 2, a1 = ((i + 1) / 37) * Math.PI * 2 - Math.PI / 2;
    ctx.beginPath(); ctx.arc(c, c, r0, a0, a1); ctx.arc(c, c, r1, a1, a0, true); ctx.closePath();
    ctx.fillStyle = n === 0 ? '#0f7a3c' : i % 2 ? '#141414' : '#b3122e'; ctx.fill();
    ctx.strokeStyle = goldGrad(ctx, c - R, c - R, c + R, c + R); ctx.lineWidth = 1.5; ctx.stroke();
  });
  const cone = ctx.createRadialGradient(c - 30, c - 30, 10, c, c, r1);
  cone.addColorStop(0, '#9a4a20'); cone.addColorStop(1, '#3a1206');
  ctx.fillStyle = cone; ctx.beginPath(); ctx.arc(c, c, r1, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = goldGrad(ctx, c - r1, c - r1, c + r1, c + r1); ctx.lineWidth = 6; ctx.stroke();
  // The turret's cross.
  ctx.fillStyle = goldGrad(ctx, c - 80, c - 80, c + 80, c + 80);
  for (let k = 0; k < 4; k++) {
    ctx.save(); ctx.translate(c, c); ctx.rotate((k * Math.PI) / 2);
    ctx.beginPath(); ctx.moveTo(-8, 0); ctx.lineTo(8, 0); ctx.lineTo(4, -r1 * 0.78); ctx.arc(0, -r1 * 0.78, 10, 0, Math.PI * 2); ctx.lineTo(-4, -r1 * 0.78); ctx.closePath(); ctx.fill();
    ctx.restore();
  }
  ctx.beginPath(); ctx.arc(c, c, 26, 0, Math.PI * 2); ctx.fill();
  // The ball, in a pocket.
  const bx = c + Math.cos(-0.9) * (r0 - 18), by = c + Math.sin(-0.9) * (r0 - 18);
  const bg = ctx.createRadialGradient(bx - 4, by - 4, 1, bx, by, 12);
  bg.addColorStop(0, '#ffffff'); bg.addColorStop(1, '#a8a8b0');
  ctx.fillStyle = bg; ctx.beginPath(); ctx.arc(bx, by, 11, 0, Math.PI * 2); ctx.fill();
  glint(ctx, c - 120, c - 120, 30, 0.7);
}
// Two red dice, seen from above and a little to the side.
function die3d(ctx, x, y, s, faces, tilt) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(tilt);
  const d = s * 0.42; // depth of the visible sides
  const faceDraw = (pts, shade, n, m) => {
    ctx.beginPath(); pts.forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py))); ctx.closePath();
    const g = ctx.createLinearGradient(pts[0][0], pts[0][1], pts[2][0], pts[2][1]);
    g.addColorStop(0, `rgba(${Math.round(226 * shade)},${Math.round(40 * shade)},${Math.round(63 * shade)},1)`);
    g.addColorStop(1, `rgba(${Math.round(150 * shade)},${Math.round(14 * shade)},${Math.round(30 * shade)},1)`);
    ctx.fillStyle = g; ctx.fill();
    ctx.strokeStyle = 'rgba(255,170,180,0.35)'; ctx.lineWidth = 2; ctx.stroke();
    // Pips: placed on the unit square, mapped onto the face.
    const P = { 1: [[0.5, 0.5]], 2: [[0.25, 0.25], [0.75, 0.75]], 3: [[0.25, 0.25], [0.5, 0.5], [0.75, 0.75]], 4: [[0.25, 0.25], [0.75, 0.25], [0.25, 0.75], [0.75, 0.75]], 5: [[0.25, 0.25], [0.75, 0.25], [0.5, 0.5], [0.25, 0.75], [0.75, 0.75]], 6: [[0.25, 0.22], [0.75, 0.22], [0.25, 0.5], [0.75, 0.5], [0.25, 0.78], [0.75, 0.78]] }[n];
    const [a, b, , e] = pts;
    P.forEach(([u, v]) => {
      const px = a[0] + (b[0] - a[0]) * u + (e[0] - a[0]) * v, py = a[1] + (b[1] - a[1]) * u + (e[1] - a[1]) * v;
      ctx.save(); ctx.translate(px, py); ctx.transform((b[0] - a[0]) / s, (b[1] - a[1]) / s, (e[0] - a[0]) / s, (e[1] - a[1]) / s, 0, 0);
      ctx.fillStyle = '#fbf7ef'; ctx.beginPath(); ctx.arc(0, 0, s * 0.085 * m, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    });
  };
  const h = s / 2;
  ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 20; ctx.shadowOffsetY = 12;
  ctx.fillStyle = '#5a0612'; ctx.beginPath(); ctx.rect(-h, -h, s, s + d); ctx.fill(); ctx.restore();
  faceDraw([[-h, -h], [h, -h], [h, h], [-h, h]], 1, faces[0], 1);
  faceDraw([[-h, h], [h, h], [h, h + d], [-h, h + d]], 0.7, faces[1], 1);
  ctx.restore();
}
function drawDice(ctx) {
  const c = S / 2;
  halo(ctx, c, c, 230, [255, 70, 90], 0.22);
  die3d(ctx, c - 92, c - 40, 170, [5, 3], -0.22);
  die3d(ctx, c + 96, c + 30, 160, [6, 2], 0.18);
  glint(ctx, c - 150, c - 110, 26, 0.8);
}
// A stack of black chips, edged in white and gold.
function drawChips(ctx) {
  const c = S / 2, rx = 150, ry = 52, th = 30, n = 6;
  halo(ctx, c, c, 230, [200, 210, 255], 0.18);
  const base = c + 130;
  for (let k = 0; k < n; k++) {
    const y = base - k * th;
    const side = ctx.createLinearGradient(c - rx, 0, c + rx, 0);
    side.addColorStop(0, '#060606'); side.addColorStop(0.45, '#2a2a2e'); side.addColorStop(1, '#050505');
    ctx.fillStyle = side;
    ctx.beginPath(); ctx.ellipse(c, y, rx, ry, 0, 0, Math.PI); ctx.lineTo(c - rx, y - th); ctx.ellipse(c, y - th, rx, ry, 0, Math.PI, 0, true); ctx.closePath(); ctx.fill();
    // The edge spots, white, round the visible half.
    // Three edge spots in view, offset chip to chip as a real stack sits.
    for (let j = 0; j < 3; j++) {
      const a = (0.2 + j * 0.3 + (k % 2) * 0.15) * Math.PI;
      const x = c + Math.cos(a) * rx, w = Math.sin(a) * 26;
      ctx.fillStyle = '#e9e4d8'; ctx.fillRect(x - w / 2, y - th + Math.sin(a) * ry + 8, w, th - 16);
    }
    // A fine gold line round each chip's edge.
    ctx.strokeStyle = 'rgba(214,178,110,0.55)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(c, y - th / 2, rx, ry, 0, 0.05, Math.PI - 0.05); ctx.stroke();
  }
  // The top: black with a gold ring and the house's name.
  const top = base - n * th;
  ctx.fillStyle = '#0c0c0e'; ctx.beginPath(); ctx.ellipse(c, top, rx, ry, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = goldGrad(ctx, c - rx, top, c + rx, top); ctx.lineWidth = 5;
  ctx.beginPath(); ctx.ellipse(c, top, rx * 0.68, ry * 0.68, 0, 0, Math.PI * 2); ctx.stroke();
  for (let j = 0; j < 8; j++) {
    const a = (j / 8) * Math.PI * 2;
    ctx.save(); ctx.translate(c + Math.cos(a) * rx * 0.86, top + Math.sin(a) * ry * 0.86); ctx.scale(1, ry / rx);
    ctx.fillStyle = '#f2efe6'; ctx.fillRect(-9, -14, 18, 28); ctx.restore();
  }
  ctx.save(); ctx.translate(c, top); ctx.scale(1, ry / rx);
  ctx.font = '700 46px Cinzel, Georgia, serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = goldGrad(ctx, 0, -30, 0, 30); ctx.fillText('NVGR', 0, 2);
  ctx.restore();
}
// The Golden Chip scatter, face on.
function drawGoldChip(ctx) {
  const c = S / 2, R = 190;
  halo(ctx, c, c - 10, 250, [255, 200, 90], 0.45);
  ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.7)'; ctx.shadowBlur = 26; ctx.shadowOffsetY = 12;
  ctx.fillStyle = goldGrad(ctx, c - R, c - R, c + R, c + R);
  ctx.beginPath(); ctx.arc(c, c - 16, R, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  for (let j = 0; j < 8; j++) {
    const a = (j / 8) * Math.PI * 2 + Math.PI / 8;
    ctx.save(); ctx.translate(c + Math.cos(a) * (R - 26), c - 16 + Math.sin(a) * (R - 26)); ctx.rotate(a + Math.PI / 2);
    ctx.fillStyle = '#7a0e1e'; ctx.fillRect(-20, -18, 40, 36);
    ctx.fillStyle = '#f6efdc'; ctx.fillRect(-8, -18, 16, 36);
    ctx.restore();
  }
  ctx.fillStyle = '#120d06'; ctx.beginPath(); ctx.arc(c, c - 16, R - 58, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = goldGrad(ctx, c - R, c - R, c + R, c + R); ctx.lineWidth = 6;
  ctx.beginPath(); ctx.arc(c, c - 16, R - 66, 0, Math.PI * 2); ctx.stroke();
  letter(ctx, 'NVGR', c, c + 2, 64, null, { spacing: 6, weight: 900 });
  letter(ctx, 'GOLD', c, c + 52, 30, null, { spacing: 8, weight: 700 });
  glint(ctx, c - 100, c - 130, 46); glint(ctx, c + 110, c - 40, 26, 0.8);
  letter(ctx, 'SCATTER', c, S - 26, 34, null, { spacing: 6, weight: 700 });
}
// The royals in platinum over enamel.
function drawPlatinumRoyal(ctx, ch) {
  const pal = { K: GEMS.sapphire, Q: GEMS.amethyst, J: GEMS.emerald, '10': GEMS.ruby }[ch];
  halo(ctx, S / 2, S / 2, 220, pal.mid, 0.2);
  if (ch === '10') letter(ctx, '10', S / 2 - 6, S / 2 + 100, 260, pal, { metal: 'platinum' });
  else if (ch === 'Q') letter(ctx, ch, S / 2 - 40, S / 2 + 100, 270, pal, { metal: 'platinum' });
  else letter(ctx, ch, S / 2, S / 2 + 118, 330, pal, { metal: 'platinum' });
  ctx.save();
  ctx.strokeStyle = silverGrad(ctx, S / 2 - 120, 0, S / 2 + 120, 0); ctx.lineWidth = 5; ctx.lineCap = 'round';
  const y = S / 2 + 168, w = 120, cx = S / 2;
  ctx.beginPath(); ctx.moveTo(cx - w, y); ctx.bezierCurveTo(cx - w * 0.6, y - 18, cx - w * 0.3, y + 18, cx, y);
  ctx.bezierCurveTo(cx + w * 0.3, y + 18, cx + w * 0.6, y - 18, cx + w, y); ctx.stroke();
  ctx.restore();
}


// ---------- Jade Panda ----------
const JADE = { deep: [2, 30, 18], dark: [10, 78, 50], mid: [30, 150, 96], light: [120, 214, 160], white: [226, 255, 236] };
// A panda's face, drawn in fur-soft gradients: ears, eye patches, muzzle.
function pandaFace(ctx, cx, cy, r) {
  const soft = (x, y, rx, ry, c0, c1, rot = 0) => {
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
    const g = ctx.createRadialGradient(-rx * 0.25, -ry * 0.3, 1, 0, 0, Math.max(rx, ry));
    g.addColorStop(0, c0); g.addColorStop(1, c1);
    ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  };
  // Ears, then the head.
  soft(cx - r * 0.72, cy - r * 0.7, r * 0.34, r * 0.32, '#3a3a3e', '#0a0a0c');
  soft(cx + r * 0.72, cy - r * 0.7, r * 0.34, r * 0.32, '#3a3a3e', '#0a0a0c');
  ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.45)'; ctx.shadowBlur = r * 0.12; ctx.shadowOffsetY = r * 0.05;
  soft(cx, cy, r, r * 0.88, '#ffffff', '#cfd2d6');
  ctx.restore();
  // Eye patches, tilted down and out.
  soft(cx - r * 0.38, cy - r * 0.06, r * 0.24, r * 0.32, '#36363a', '#08080a', 0.55);
  soft(cx + r * 0.38, cy - r * 0.06, r * 0.24, r * 0.32, '#36363a', '#08080a', -0.55);
  // Eyes: dark with a point of light.
  [-1, 1].forEach((sd) => {
    ctx.fillStyle = '#f3efe4'; ctx.beginPath(); ctx.arc(cx + sd * r * 0.36, cy - r * 0.08, r * 0.085, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(cx + sd * r * 0.355, cy - r * 0.075, r * 0.06, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(cx + sd * r * 0.335, cy - r * 0.1, r * 0.02, 0, Math.PI * 2); ctx.fill();
  });
  // Muzzle, nose and mouth.
  soft(cx, cy + r * 0.32, r * 0.34, r * 0.25, '#ffffff', '#e2e4e8');
  ctx.fillStyle = '#111'; ctx.beginPath(); ctx.ellipse(cx, cy + r * 0.2, r * 0.11, r * 0.075, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#1a1a1a'; ctx.lineWidth = r * 0.03; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(cx, cy + r * 0.27); ctx.lineTo(cx, cy + r * 0.36);
  ctx.moveTo(cx - r * 0.1, cy + r * 0.42); ctx.quadraticCurveTo(cx, cy + r * 0.38, cx, cy + r * 0.36); ctx.quadraticCurveTo(cx, cy + r * 0.38, cx + r * 0.1, cy + r * 0.42);
  ctx.stroke();
}
// A bamboo stem, jointed, with two leaves.
function bamboo(ctx, x, y0, y1, w, lean) {
  ctx.save(); ctx.translate(x, y1); ctx.rotate(lean);
  const h = y1 - y0;
  const g = ctx.createLinearGradient(-w / 2, 0, w / 2, 0);
  g.addColorStop(0, '#2c5a1a'); g.addColorStop(0.45, '#8fc24a'); g.addColorStop(1, '#2a4c14');
  ctx.fillStyle = g; ctx.fillRect(-w / 2, -h, w, h);
  ctx.fillStyle = '#1e3a10';
  for (let k = 1; k < 4; k++) ctx.fillRect(-w / 2 - 2, -h * k / 4, w + 4, 5);
  const leaf = (yy, dir) => {
    const lg = ctx.createLinearGradient(0, yy, dir * 90, yy - 40);
    lg.addColorStop(0, '#4f8a24'); lg.addColorStop(1, '#2a5512');
    ctx.fillStyle = lg;
    ctx.beginPath(); ctx.moveTo(0, yy); ctx.quadraticCurveTo(dir * 50, yy - 40, dir * 110, yy - 30); ctx.quadraticCurveTo(dir * 50, yy - 10, 0, yy); ctx.fill();
  };
  leaf(-h * 0.72, 1); leaf(-h * 0.5, -1);
  ctx.restore();
}
// The Panda Wild: a gold medallion, jade within, bamboo and the panda.
function drawPandaWild(ctx) {
  const c = S / 2, R = 200;
  halo(ctx, c, c, 250, [255, 200, 90], 0.4);
  ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.7)'; ctx.shadowBlur = 24; ctx.shadowOffsetY = 10;
  ctx.fillStyle = goldGrad(ctx, c - R, c - R, c + R, c + R);
  ctx.beginPath(); ctx.arc(c, c - 10, R, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  const jade = ctx.createRadialGradient(c - 50, c - 70, 20, c, c - 10, R - 18);
  jade.addColorStop(0, rgb(JADE.light)); jade.addColorStop(0.55, rgb(JADE.mid)); jade.addColorStop(1, rgb(JADE.deep));
  ctx.fillStyle = jade; ctx.beginPath(); ctx.arc(c, c - 10, R - 18, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = 'rgba(255,240,200,0.55)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(c, c - 10, R - 30, 0, Math.PI * 2); ctx.stroke();
  ctx.save(); ctx.beginPath(); ctx.arc(c, c - 10, R - 18, 0, Math.PI * 2); ctx.clip();
  bamboo(ctx, c - 120, c - 190, c + 190, 26, -0.12);
  bamboo(ctx, c + 128, c - 170, c + 190, 22, 0.14);
  pandaFace(ctx, c, c - 4, 118);
  ctx.restore();
  // The word on a ruby ribbon across the foot.
  const ry = S - 78;
  ctx.fillStyle = '#5c0b18';
  ctx.beginPath(); ctx.moveTo(84, ry - 24); ctx.lineTo(S - 84, ry - 24); ctx.lineTo(S - 68, ry + 2); ctx.lineTo(S - 84, ry + 28); ctx.lineTo(84, ry + 28); ctx.lineTo(68, ry + 2); ctx.closePath(); ctx.fill();
  const rg = ctx.createLinearGradient(0, ry - 24, 0, ry + 28);
  rg.addColorStop(0, '#c4203a'); rg.addColorStop(1, '#7c0e20');
  ctx.fillStyle = rg; ctx.fillRect(98, ry - 20, S - 196, 44);
  ctx.strokeStyle = goldGrad(ctx, 98, 0, S - 98, 0); ctx.lineWidth = 3; ctx.strokeRect(98, ry - 20, S - 196, 44);
  letter(ctx, 'WILD', c, ry + 16, 42, null, { spacing: 14, weight: 900 });
}
// A Golden Pearl: a glowing orb in a gold setting.
function drawPearl(ctx) {
  const c = S / 2, R = 150;
  halo(ctx, c, c, 250, [255, 210, 110], 0.55);
  ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 20; ctx.shadowOffsetY = 8;
  ctx.fillStyle = goldGrad(ctx, c - R - 30, c - R - 30, c + R + 30, c + R + 30);
  ctx.beginPath(); ctx.arc(c, c, R + 26, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  // The setting's eight claws.
  ctx.fillStyle = goldGrad(ctx, c - R, c - R, c + R, c + R);
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2;
    ctx.beginPath(); ctx.arc(c + Math.cos(a) * (R + 4), c + Math.sin(a) * (R + 4), 16, 0, Math.PI * 2); ctx.fill();
  }
  const g = ctx.createRadialGradient(c - R * 0.35, c - R * 0.4, R * 0.08, c, c, R);
  g.addColorStop(0, '#fffbe8'); g.addColorStop(0.3, '#ffe39a'); g.addColorStop(0.7, '#e2a73c'); g.addColorStop(1, '#8a5a12');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(c, c, R, 0, Math.PI * 2); ctx.fill();
  // A soft band of reflected light across it.
  ctx.save(); ctx.beginPath(); ctx.arc(c, c, R, 0, Math.PI * 2); ctx.clip();
  const band = ctx.createLinearGradient(c - R, c + R * 0.2, c + R, c + R * 0.6);
  band.addColorStop(0, 'rgba(255,255,255,0)'); band.addColorStop(0.5, 'rgba(255,255,255,0.22)'); band.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = band; ctx.fillRect(c - R, c - R, R * 2, R * 2);
  ctx.restore();
  glint(ctx, c - 58, c - 64, 52); glint(ctx, c + 60, c + 56, 22, 0.7);
}
// A gold ingot: the boat-shaped sycee with its rounded crown.
function drawIngot(ctx) {
  const c = S / 2;
  halo(ctx, c, c + 10, 240, [255, 196, 90], 0.32);
  ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.65)'; ctx.shadowBlur = 24; ctx.shadowOffsetY = 12;
  ctx.fillStyle = goldGrad(ctx, 0, c - 40, 0, c + 140);
  ctx.beginPath();
  ctx.moveTo(c - 210, c - 10);
  ctx.quadraticCurveTo(c - 190, c + 120, c, c + 128);
  ctx.quadraticCurveTo(c + 190, c + 120, c + 210, c - 10);
  ctx.quadraticCurveTo(c + 150, c + 30, c, c + 30);
  ctx.quadraticCurveTo(c - 150, c + 30, c - 210, c - 10);
  ctx.fill(); ctx.restore();
  // The raised ends, curling up.
  [-1, 1].forEach((sd) => {
    ctx.fillStyle = goldGrad(ctx, c + sd * 210, c - 60, c + sd * 120, c + 40);
    ctx.beginPath(); ctx.moveTo(c + sd * 212, c - 12); ctx.quadraticCurveTo(c + sd * 222, c - 70, c + sd * 168, c - 52); ctx.quadraticCurveTo(c + sd * 150, c + 6, c + sd * 120, c + 22); ctx.closePath(); ctx.fill();
  });
  // The crown in the middle.
  const dome = ctx.createRadialGradient(c - 30, c - 80, 10, c, c - 30, 120);
  dome.addColorStop(0, '#fff3cc'); dome.addColorStop(0.45, '#e9bd62'); dome.addColorStop(1, '#8a5a18');
  ctx.fillStyle = dome; ctx.beginPath(); ctx.ellipse(c, c - 20, 120, 92, 0, Math.PI, 0); ctx.quadraticCurveTo(c, c + 40, c - 120, c - 20); ctx.fill();
  ctx.strokeStyle = 'rgba(255,246,214,0.7)'; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.ellipse(c, c - 20, 112, 84, 0, Math.PI * 1.15, Math.PI * 1.6); ctx.stroke();
  glint(ctx, c - 40, c - 86, 40); glint(ctx, c + 150, c + 10, 22, 0.8);
}
// A red silk lantern, gold caps and a tassel.
function drawLantern(ctx) {
  const c = S / 2;
  halo(ctx, c, c, 230, [255, 90, 60], 0.32);
  const top = c - 150, bot = c + 120, rx = 150;
  ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 22; ctx.shadowOffsetY = 10;
  const body = ctx.createRadialGradient(c - 40, c - 40, 20, c, c - 10, 200);
  body.addColorStop(0, '#ff7a5a'); body.addColorStop(0.4, '#d8182c'); body.addColorStop(1, '#5a0410');
  ctx.fillStyle = body; ctx.beginPath(); ctx.ellipse(c, (top + bot) / 2, rx, (bot - top) / 2, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  // The ribs of the frame.
  ctx.strokeStyle = 'rgba(80,0,10,0.55)'; ctx.lineWidth = 4;
  [-0.75, -0.42, 0, 0.42, 0.75].forEach((k) => { ctx.beginPath(); ctx.ellipse(c, (top + bot) / 2, rx * Math.abs(k) + 2, (bot - top) / 2, 0, k < 0 ? Math.PI / 2 : -Math.PI / 2, k < 0 ? Math.PI * 1.5 : Math.PI / 2); ctx.stroke(); });
  // The glow within.
  const glow = ctx.createRadialGradient(c, c, 10, c, c, 110);
  glow.addColorStop(0, 'rgba(255,220,140,0.55)'); glow.addColorStop(1, 'rgba(255,220,140,0)');
  ctx.fillStyle = glow; ctx.beginPath(); ctx.ellipse(c, (top + bot) / 2, rx, (bot - top) / 2, 0, 0, Math.PI * 2); ctx.fill();
  // Gold caps.
  [[top, -1], [bot, 1]].forEach(([y, sd]) => {
    ctx.fillStyle = goldGrad(ctx, c - 80, y - 20, c + 80, y + 20);
    ctx.beginPath(); ctx.roundRect(c - 78, y - (sd < 0 ? 26 : 4), 156, 30, 8); ctx.fill();
  });
  ctx.fillStyle = goldGrad(ctx, c - 8, top - 70, c + 8, top);
  ctx.fillRect(c - 5, top - 70, 10, 46);
  // The tassel.
  ctx.fillStyle = goldGrad(ctx, c - 14, bot + 26, c + 14, bot + 60);
  ctx.beginPath(); ctx.arc(c, bot + 40, 14, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#b8141f'; ctx.lineWidth = 3;
  for (let k = -5; k <= 5; k++) { ctx.beginPath(); ctx.moveTo(c + k * 2, bot + 50); ctx.lineTo(c + k * 4, bot + 120); ctx.stroke(); }
  letter(ctx, '福', c, c + 34, 110, null, { weight: 900 });
}
// A carved jade disc, a gold cord through it.
function drawJadeDisc(ctx) {
  const c = S / 2, R = 190, r0 = 62;
  halo(ctx, c, c, 240, JADE.mid, 0.3);
  ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 22; ctx.shadowOffsetY = 10;
  const g = ctx.createRadialGradient(c - 70, c - 80, 20, c, c, R);
  g.addColorStop(0, rgb(JADE.white)); g.addColorStop(0.3, rgb(JADE.light)); g.addColorStop(0.7, rgb(JADE.mid)); g.addColorStop(1, rgb(JADE.dark));
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(c, c, R, 0, Math.PI * 2); ctx.arc(c, c, r0, 0, Math.PI * 2, true); ctx.fill('evenodd'); ctx.restore();
  // Carved rings and a band of raised grain.
  ctx.strokeStyle = rgb(JADE.deep, 0.5); ctx.lineWidth = 4;
  [R - 18, r0 + 20].forEach((rr) => { ctx.beginPath(); ctx.arc(c, c, rr, 0, Math.PI * 2); ctx.stroke(); });
  ctx.fillStyle = rgb(JADE.deep, 0.35);
  for (let k = 0; k < 28; k++) for (let j = 0; j < 3; j++) {
    const a = (k / 28) * Math.PI * 2 + j * 0.06, rr = r0 + 40 + j * 28;
    ctx.beginPath(); ctx.arc(c + Math.cos(a) * rr, c + Math.sin(a) * rr, 5, 0, Math.PI * 2); ctx.fill();
  }
  ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(c, c, R - 6, Math.PI * 1.05, Math.PI * 1.55); ctx.stroke();
  // The cord, knotted at the top.
  ctx.strokeStyle = goldGrad(ctx, c - 30, c - R - 40, c + 30, c - R + 20); ctx.lineWidth = 9;
  ctx.beginPath(); ctx.moveTo(c - 26, c - R + 6); ctx.quadraticCurveTo(c, c - R - 60, c + 26, c - R + 6); ctx.stroke();
  glint(ctx, c - 90, c - 110, 40);
}
// A folding fan of red silk, gold ribs and a gold rivet.
function drawFan(ctx) {
  const c = S / 2, pivot = [c, c + 150], R = 300, a0 = -Math.PI * 0.9, a1 = -Math.PI * 0.1;
  halo(ctx, c, c, 240, [255, 90, 70], 0.25);
  ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.55)'; ctx.shadowBlur = 20; ctx.shadowOffsetY = 10;
  const folds = 14;
  for (let k = 0; k < folds; k++) {
    const t0 = a0 + ((a1 - a0) * k) / folds, t1 = a0 + ((a1 - a0) * (k + 1)) / folds;
    ctx.beginPath(); ctx.moveTo(pivot[0] + Math.cos(t0) * 90, pivot[1] + Math.sin(t0) * 90);
    ctx.lineTo(pivot[0] + Math.cos(t0) * R, pivot[1] + Math.sin(t0) * R);
    ctx.arc(pivot[0], pivot[1], R, t0, t1);
    ctx.lineTo(pivot[0] + Math.cos(t1) * 90, pivot[1] + Math.sin(t1) * 90);
    ctx.closePath();
    ctx.fillStyle = k % 2 ? '#a50f22' : '#d01c30'; ctx.fill();
  }
  ctx.restore();
  // A gold band painted along the edge, and a plum branch across.
  ctx.strokeStyle = goldGrad(ctx, c - R, c - R, c + R, c); ctx.lineWidth = 14;
  ctx.beginPath(); ctx.arc(pivot[0], pivot[1], R - 22, a0, a1); ctx.stroke();
  ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(pivot[0], pivot[1], R - 46, a0, a1); ctx.stroke();
  ctx.strokeStyle = '#3a1a0a'; ctx.lineWidth = 6;
  ctx.beginPath(); ctx.moveTo(c - 150, c + 20); ctx.quadraticCurveTo(c - 40, c - 60, c + 120, c - 40); ctx.stroke();
  [[c - 100, c - 18], [c - 30, c - 48], [c + 50, c - 50], [c + 110, c - 40]].forEach(([x, y]) => {
    ctx.fillStyle = '#ffd6dc'; for (let p = 0; p < 5; p++) { const a = (p / 5) * Math.PI * 2; ctx.beginPath(); ctx.arc(x + Math.cos(a) * 9, y + Math.sin(a) * 9, 7, 0, Math.PI * 2); ctx.fill(); }
    ctx.fillStyle = '#e6b84a'; ctx.beginPath(); ctx.arc(x, y, 4, 0, Math.PI * 2); ctx.fill();
  });
  // The ribs at the base, and the rivet.
  ctx.strokeStyle = goldGrad(ctx, c - 90, c + 60, c + 90, c + 150); ctx.lineWidth = 6;
  for (let k = 0; k <= folds; k += 2) { const t = a0 + ((a1 - a0) * k) / folds; ctx.beginPath(); ctx.moveTo(pivot[0], pivot[1]); ctx.lineTo(pivot[0] + Math.cos(t) * 92, pivot[1] + Math.sin(t) * 92); ctx.stroke(); }
  ctx.fillStyle = goldGrad(ctx, c - 18, c + 132, c + 18, c + 168);
  ctx.beginPath(); ctx.arc(pivot[0], pivot[1], 18, 0, Math.PI * 2); ctx.fill();
}
// The royals in jade enamel, rimmed in gold.
function drawJadeRoyal(ctx, ch) {
  const pal = { A: JADE, K: GOLD_PAL, Q: JADE, J: GOLD_PAL }[ch];
  halo(ctx, S / 2, S / 2, 220, pal.mid, 0.2);
  if (ch === 'Q') letter(ctx, ch, S / 2 - 40, S / 2 + 100, 270, pal);
  else letter(ctx, ch, S / 2, S / 2 + 118, 330, pal);
  flourish(ctx, S / 2, S / 2 + 168, 120);
}

// Paints one symbol, centred in its cell (W by H symbol units).
function paint(ctx, sym, logo, W, H) {
  ground(ctx, W, H);
  if (sym === 'blank') {
    // The strip between symbols: nothing but a fine rule across it.
    ctx.fillStyle = 'rgba(120,100,70,0.12)'; ctx.fillRect(W * 0.3, H / 2 - 1, W * 0.4, 2);
    return;
  }
  ctx.save();
  ctx.translate((W - S) / 2, (H - S) / 2);
  // A wide cell (three reels) shows its symbol a little smaller in height.
  if (H < S) { const k = H / S; ctx.translate(S / 2, S / 2); ctx.scale(k * 1.04, k * 1.04); ctx.translate(-S / 2, -S / 2); }
  if (sym === 'wild') drawWild(ctx, logo);
  else if (sym === 'crown') drawCrown(ctx);
  else if (sym === 'A' || sym === 'K' || sym === 'Q' || sym === 'J') drawRoyal(ctx, sym);
  else if (sym === 'seven_r') drawSeven(ctx, GEMS.ruby);
  else if (sym === 'seven_b') drawSeven(ctx, GEMS.sapphire);
  else if (sym === 'seven_g') drawSeven(ctx, GOLD_PAL);
  else if (sym === 'bar1') drawBars(ctx, 1);
  else if (sym === 'bar2') drawBars(ctx, 2);
  else if (sym === 'bar3') drawBars(ctx, 3);
  else if (sym === 'cherry') drawCherries(ctx);
  else if (sym === 'dwild') drawDiamondWild(ctx);
  else if (sym === 'ace') drawAce(ctx);
  else if (sym === 'wheel') drawWheel(ctx);
  else if (sym === 'dice') drawDice(ctx);
  else if (sym === 'chips') drawChips(ctx);
  else if (sym === 'goldchip') drawGoldChip(ctx);
  else if (sym === 'pK') drawPlatinumRoyal(ctx, 'K');
  else if (sym === 'pQ') drawPlatinumRoyal(ctx, 'Q');
  else if (sym === 'pJ') drawPlatinumRoyal(ctx, 'J');
  else if (sym === 'p10') drawPlatinumRoyal(ctx, '10');
  else if (sym === 'pwild') drawPandaWild(ctx);
  else if (sym === 'pearl') drawPearl(ctx);
  else if (sym === 'ingot') drawIngot(ctx);
  else if (sym === 'lantern') drawLantern(ctx);
  else if (sym === 'jade') drawJadeDisc(ctx);
  else if (sym === 'fan') drawFan(ctx);
  else if (sym === 'jA' || sym === 'jK' || sym === 'jQ' || sym === 'jJ') drawJadeRoyal(ctx, sym[1]);
  else drawGem(ctx, sym);
  ctx.restore();
}

/**
 * A machine's atlas: { sharp, blur } canvases laid out `cols` across, a
 * cell `cellW` by `cellH` pixels for each of the game's symbols; `aspect` is
 * a reel face's height over its width. `ready` settles once the crest and
 * the lettering's font are in (the atlas is painted at once, and again then;
 * onRepaint hears of it).
 */
export function createSymbolAtlas(game, aspect = 1) {
  const symbols = game.symbols;
  // Symbol units: the shorter side is 512.
  const W = aspect < 1 ? S / aspect : S, H = aspect < 1 ? S : S * aspect;
  const cellW = Math.round((CELL * W) / S), cellH = Math.round((CELL * H) / S);
  const cols = aspect < 0.8 ? 3 : 4;
  const rows = Math.ceil(symbols.length / cols);
  const sharp = document.createElement('canvas');
  sharp.width = cellW * cols; sharp.height = cellH * rows;
  const blur = document.createElement('canvas');
  blur.width = sharp.width; blur.height = sharp.height;
  const listeners = [];
  const style = game.look.ground;
  function draw(logo) {
    STYLE = style;
    const ctx = sharp.getContext('2d');
    ctx.clearRect(0, 0, sharp.width, sharp.height);
    symbols.forEach((sym, i) => {
      ctx.save();
      ctx.translate((i % cols) * cellW, Math.floor(i / cols) * cellH);
      ctx.scale(cellW / W, cellH / H);
      ctx.beginPath(); ctx.rect(0, 0, W, H); ctx.clip();
      paint(ctx, sym, logo, W, H);
      ctx.restore();
    });
    // The spinning copy: each cell smeared up and down its own column,
    // wrapping, as a reel's strip blurs past the window.
    const b = blur.getContext('2d');
    b.clearRect(0, 0, blur.width, blur.height);
    symbols.forEach((sym, i) => {
      const x = (i % cols) * cellW, y = Math.floor(i / cols) * cellH;
      b.save();
      b.beginPath(); b.rect(x, y, cellW, cellH); b.clip();
      const passes = 30, reach = cellH * 0.4;
      b.globalAlpha = 1;
      b.drawImage(sharp, x, y, cellW, cellH, x, y, cellW, cellH);
      for (let k = 0; k < passes; k++) {
        const dy = ((k / (passes - 1)) - 0.5) * 2 * reach;
        b.globalAlpha = 0.085;
        b.drawImage(sharp, x, y, cellW, cellH, x, y + dy, cellW, cellH);
        b.drawImage(sharp, x, y, cellW, cellH, x, y + dy + (dy > 0 ? -cellH : cellH), cellW, cellH);
      }
      // A dark wash, so the blur reads as speed and not glare.
      b.globalAlpha = style === 'ivory' ? 0.1 : 0.18; b.fillStyle = '#000'; b.fillRect(x, y, cellW, cellH);
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
  return {
    sharp, blur, ready, cols, rows, cellW, cellH,
    index: (sym) => symbols.indexOf(sym),
    onRepaint: (fn) => listeners.push(fn),
  };
}
