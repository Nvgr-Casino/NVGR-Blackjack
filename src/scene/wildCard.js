import * as THREE from 'three';
import { place } from './furniture.js';
import { FLOOR_Y, m } from './scale.js';
import { walkway, brandSign, staffPosts, facing } from './layout.js';
import { canvasTex, grain, gold, brass, velvet, feltTexture, marble, wood, chipStack, bottleRow, giltText } from './casinoKit.js';

// The Wild Card: the gaming salon of a grand European casino, as the
// Belle Époque built them. Its furniture all its own:
//
//   - roulette: four tables of mahogany and baize, each with its wheel
//     turning, the ball running round the track, chips on the layout;
//   - a great crystal chandelier over the table, tier on tier of candles
//     and drops, and gilt chandeliers over the roulette;
//   - walls of ivory boiserie, red damask in gilded frames, pilasters
//     between, a frieze of gold; tall gilt mirrors over consoles;
//   - a painted ceiling: a sky in a gilded oval, coffers round it;
//   - a parquet de Versailles, an Aubusson carpet under the table;
//   - salons of white Louis sofas and bergères round marble tables;
//   - marble busts on columns, palms;
//   - the Bar Américain in mahogany and Carrara, its back of arched
//     mirrors; the cashier's cage, its brass grille, CAISSE in gold.

const half = 36;
const CEIL = FLOOR_Y + m(6.0);

const GOLD = gold();
const BRASS = brass();
const MAHOGANY = wood('#4a1a0e', '#1a0604');
const CARRARA = marble('#ece8e0', '#8a8a90');
const RED_VELVET = velvet(0x6a0c16, 0xff8a8a);

// ---------- the floor ----------
// Parquet de Versailles: a square of oak, a frame of boards round a
// lattice woven on the diagonal, every board its own shade.
function paintParquet(ctx, S) {
  const tones = ['#5e3c22', '#54351e', '#664228', '#4c301a', '#6c482a'];
  const board = (draw) => {
    ctx.fillStyle = tones[Math.floor(Math.random() * tones.length)];
    draw();
  };
  ctx.fillStyle = '#3a2412';
  ctx.fillRect(0, 0, S, S);
  const b = S * 0.07;
  // The frame.
  board(() => ctx.fillRect(0, 0, S, b));
  board(() => ctx.fillRect(0, S - b, S, b));
  board(() => ctx.fillRect(0, b, b, S - 2 * b));
  board(() => ctx.fillRect(S - b, b, b, S - 2 * b));
  // The lattice, inside it.
  ctx.save();
  ctx.beginPath();
  ctx.rect(b, b, S - 2 * b, S - 2 * b);
  ctx.clip();
  ctx.translate(S / 2, S / 2);
  ctx.rotate(Math.PI / 4);
  const step = (S - 2 * b) / 2.2;
  const strip = b * 0.7;
  for (let i = -3; i <= 3; i++) {
    for (let j = -3; j <= 3; j++) {
      board(() => ctx.fillRect(i * step - strip / 2, j * step + strip / 2, strip, step - strip));
      board(() => ctx.fillRect(i * step + strip / 2, j * step - strip / 2, step - strip, strip));
      board(() => ctx.fillRect(i * step + strip / 2, j * step + strip / 2, step - strip, step - strip));
    }
  }
  ctx.restore();
  // Joints and grain.
  ctx.strokeStyle = 'rgba(30,16,6,0.6)';
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, S - 2, S - 2);
  ctx.strokeRect(b, b, S - 2 * b, S - 2 * b);
  for (let k = 0; k < 500; k++) {
    ctx.strokeStyle = `rgba(40,20,6,${0.05 + Math.random() * 0.12})`;
    ctx.lineWidth = 1;
    const x = Math.random() * S, y = Math.random() * S;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + (Math.random() - 0.5) * 60, y + (Math.random() - 0.5) * 60);
    ctx.stroke();
  }
  grain(ctx, S, S, 10);
}

// An Aubusson carpet under the table: a rose-cream ground, a medallion of
// flowers, a border of rose and sage.
function aubusson(w, d) {
  const W = 2048, H = Math.round((2048 * d) / w);
  const tex = canvasTex(W, H, (ctx) => {
    ctx.fillStyle = '#dcc7a6';
    ctx.fillRect(0, 0, W, H);
    const flower = (x, y, r) => {
      const cols = ['#a8424e', '#c86a6e', '#6a8a5a', '#d8a85a', '#8a3a46'];
      for (let k = 0; k < 6; k++) {
        const a = (k / 6) * Math.PI * 2;
        ctx.fillStyle = cols[(k + Math.floor(x)) % cols.length];
        ctx.beginPath();
        ctx.ellipse(x + Math.cos(a) * r * 0.5, y + Math.sin(a) * r * 0.5, r * 0.45, r * 0.25, a, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = '#e8c87a';
      ctx.beginPath();
      ctx.arc(x, y, r * 0.2, 0, Math.PI * 2);
      ctx.fill();
    };
    const leaf = (x, y, a, r) => {
      ctx.fillStyle = '#5a7a4a';
      ctx.beginPath();
      ctx.ellipse(x, y, r, r * 0.3, a, 0, Math.PI * 2);
      ctx.fill();
    };
    // The border.
    const bw = H * 0.1;
    ctx.fillStyle = '#7a2a34';
    ctx.fillRect(0, 0, W, bw);
    ctx.fillRect(0, H - bw, W, bw);
    ctx.fillRect(0, 0, bw, H);
    ctx.fillRect(W - bw, 0, bw, H);
    ctx.strokeStyle = '#d8b46a';
    ctx.lineWidth = 6;
    ctx.strokeRect(bw * 0.15, bw * 0.15, W - bw * 0.3, H - bw * 0.3);
    ctx.strokeRect(bw, bw, W - 2 * bw, H - 2 * bw);
    for (let x = bw; x < W - bw; x += bw * 0.9) {
      [bw / 2, H - bw / 2].forEach((y) => { leaf(x - bw * 0.25, y, 0.5, bw * 0.2); flower(x, y, bw * 0.28); });
    }
    for (let y = bw * 1.5; y < H - bw; y += bw * 0.9) {
      [bw / 2, W - bw / 2].forEach((x) => { leaf(x, y - bw * 0.25, 1.2, bw * 0.2); flower(x, y, bw * 0.28); });
    }
    // The medallion.
    ctx.save();
    ctx.translate(W / 2, H / 2);
    ctx.fillStyle = '#efe0c4';
    ctx.beginPath();
    ctx.ellipse(0, 0, W * 0.3, H * 0.3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#7a2a34';
    ctx.lineWidth = 10;
    ctx.stroke();
    for (let k = 0; k < 28; k++) {
      const a = (k / 28) * Math.PI * 2;
      leaf(Math.cos(a) * W * 0.27, Math.sin(a) * H * 0.27, a, H * 0.03);
      flower(Math.cos(a + 0.1) * W * 0.27, Math.sin(a + 0.1) * H * 0.27, H * 0.025);
    }
    for (let k = 0; k < 12; k++) {
      const a = (k / 12) * Math.PI * 2;
      flower(Math.cos(a) * W * 0.12, Math.sin(a) * H * 0.12, H * 0.04);
    }
    flower(0, 0, H * 0.07);
    ctx.restore();
    // Sprigs over the field.
    for (let k = 0; k < 60; k++) {
      const x = bw * 1.5 + Math.random() * (W - bw * 3), y = bw * 1.5 + Math.random() * (H - bw * 3);
      if (((x - W / 2) / (W * 0.32)) ** 2 + ((y - H / 2) / (H * 0.32)) ** 2 < 1) continue;
      leaf(x - 8, y + 6, Math.random() * 3, H * 0.012);
      flower(x, y, H * 0.012);
    }
    grain(ctx, W, H, 18);
  });
  const rug = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshLambertMaterial({ map: tex }));
  rug.rotation.x = -Math.PI / 2;
  rug.position.set(0, FLOOR_Y + 0.006, -0.4);
  rug.receiveShadow = true;
  return rug;
}

// ---------- the walls ----------
// Ivory boiserie: a dado of framed panels; above it, tall panels of red
// damask in gilded mouldings, pilasters between; a frieze of gold.
function paintSalonWall(ctx, d) {
  const { texW: W, texH: H, px } = d;
  const u = px * m(1);
  ctx.fillStyle = '#e6dcc6';
  ctx.fillRect(0, 0, W, H);
  const frieze = u * 0.55, dado = H - u * 0.95;
  const gilt = (x, y, w, h, lw = 6) => {
    ctx.strokeStyle = 'rgba(80,50,10,0.5)';
    ctx.lineWidth = lw + 4;
    ctx.strokeRect(x + 2, y + 2, w, h);
    const g = ctx.createLinearGradient(x, y, x + w, y + h);
    g.addColorStop(0, '#f2d68a');
    g.addColorStop(0.5, '#b8903e');
    g.addColorStop(1, '#f6e2a0');
    ctx.strokeStyle = g;
    ctx.lineWidth = lw;
    ctx.strokeRect(x, y, w, h);
  };
  // The damask: a repeat of palmettes, dark on red.
  const damask = canvasTex(96, 128, (c) => {
    c.fillStyle = '#7a1420';
    c.fillRect(0, 0, 96, 128);
    c.fillStyle = '#5a0c16';
    const palm = (x, y, s) => {
      c.beginPath();
      c.moveTo(x, y - s);
      c.bezierCurveTo(x + s * 0.8, y - s * 0.4, x + s * 0.5, y + s * 0.6, x, y + s);
      c.bezierCurveTo(x - s * 0.5, y + s * 0.6, x - s * 0.8, y - s * 0.4, x, y - s);
      c.fill();
    };
    palm(48, 64, 34);
    [[0, 0], [96, 0], [0, 128], [96, 128]].forEach(([x, y]) => palm(x, y, 22));
  }).image;
  const pattern = ctx.createPattern(damask, 'repeat');
  const panelW = u * 1.9, pil = u * 0.45;
  for (let x = pil; x < W; x += panelW + pil) {
    const y0 = frieze + u * 0.25, h = dado - y0 - u * 0.25;
    ctx.fillStyle = pattern;
    ctx.fillRect(x + u * 0.12, y0, panelW - u * 0.24, h);
    gilt(x + u * 0.12, y0, panelW - u * 0.24, h, 8);
    gilt(x + u * 0.22, y0 + u * 0.1, panelW - u * 0.44, h - u * 0.2, 3);
    // The pilaster after it: fluted, a gilt capital.
    const px0 = x + panelW;
    ctx.fillStyle = '#ece4d0';
    ctx.fillRect(px0, frieze, pil, dado - frieze);
    for (let f = 1; f < 5; f++) {
      ctx.fillStyle = 'rgba(120,100,70,0.25)';
      ctx.fillRect(px0 + (pil * f) / 5 - 2, frieze + u * 0.4, 4, dado - frieze - u * 0.6);
    }
    ctx.fillStyle = '#c9a24f';
    ctx.fillRect(px0 - 4, frieze + u * 0.1, pil + 8, u * 0.18);
    // The dado panel below.
    gilt(x + u * 0.15, dado + u * 0.15, panelW - u * 0.3, H - dado - u * 0.35, 4);
  }
  // The dado rail and the frieze.
  ctx.fillStyle = '#c9a24f';
  ctx.fillRect(0, dado - 6, W, 12);
  const fg = ctx.createLinearGradient(0, 0, 0, frieze);
  fg.addColorStop(0, '#8a6a2a');
  fg.addColorStop(0.5, '#e8c87a');
  fg.addColorStop(1, '#8a6a2a');
  ctx.fillStyle = fg;
  ctx.fillRect(0, 0, W, frieze);
  ctx.fillStyle = 'rgba(70,40,10,0.45)';
  for (let x = 0; x < W; x += u * 0.16) {
    ctx.beginPath();
    ctx.ellipse(x, frieze * 0.55, u * 0.05, frieze * 0.25, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  // The skirting.
  ctx.fillStyle = '#3a2412';
  ctx.fillRect(0, H - u * 0.12, W, u * 0.12);
}

// ---------- the ceiling ----------
// A sky painted in a gilded oval, coffers round it, all of it ivory and
// gold.
function paintedCeiling(room) {
  const S = 2048;
  const tex = canvasTex(S, S, (ctx) => {
    ctx.fillStyle = '#e8dfca';
    ctx.fillRect(0, 0, S, S);
    // Coffers.
    const n = 10, c = S / n;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      const x = i * c, y = j * c;
      const g = ctx.createLinearGradient(x, y, x + c, y + c);
      g.addColorStop(0, '#d8cdb2');
      g.addColorStop(1, '#f2ead8');
      ctx.fillStyle = g;
      ctx.fillRect(x + c * 0.12, y + c * 0.12, c * 0.76, c * 0.76);
      ctx.strokeStyle = '#c9a24f';
      ctx.lineWidth = 6;
      ctx.strokeRect(x + c * 0.16, y + c * 0.16, c * 0.68, c * 0.68);
      ctx.fillStyle = '#c9a24f';
      ctx.beginPath();
      ctx.arc(x + c / 2, y + c / 2, c * 0.08, 0, Math.PI * 2);
      ctx.fill();
    }
    // The oval of sky, over the table.
    ctx.save();
    ctx.translate(S / 2, S / 2);
    ctx.beginPath();
    ctx.ellipse(0, 0, S * 0.17, S * 0.13, 0, 0, Math.PI * 2);
    ctx.save();
    ctx.clip();
    const sky = ctx.createRadialGradient(0, 0, 0, 0, 0, S * 0.18);
    sky.addColorStop(0, '#efe2c8');
    sky.addColorStop(0.5, '#b8c4c8');
    sky.addColorStop(1, '#8a9aa8');
    ctx.fillStyle = sky;
    ctx.fillRect(-S * 0.3, -S * 0.3, S * 0.6, S * 0.6);
    for (let k = 0; k < 90; k++) {
      const a = Math.random() * Math.PI * 2, r = S * (0.05 + Math.random() * 0.11);
      const x = Math.cos(a) * r, y = Math.sin(a) * r * 0.78, cr = S * (0.015 + Math.random() * 0.035);
      const g = ctx.createRadialGradient(x, y, 0, x, y, cr);
      g.addColorStop(0, 'rgba(250,244,230,0.4)');
      g.addColorStop(1, 'rgba(250,244,230,0)');
      ctx.fillStyle = g;
      ctx.fillRect(x - cr, y - cr, cr * 2, cr * 2);
    }
    ctx.restore();
    [[0, 34, '#b8903e'], [-24, 10, '#f2d68a'], [24, 8, '#8a6a2a']].forEach(([dr, lw, col]) => {
      ctx.strokeStyle = col;
      ctx.lineWidth = lw;
      ctx.beginPath();
      ctx.ellipse(0, 0, S * 0.17 + dr, S * 0.13 + dr, 0, 0, Math.PI * 2);
      ctx.stroke();
    });
    ctx.restore();
    grain(ctx, S, S, 6);
  });
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(2 * half, 2 * half), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.7, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.12 }));
  ceil.rotation.x = Math.PI / 2;
  ceil.position.set(0, CEIL, -0.4);
  room.add(ceil);
  // A gilt cornice round the room.
  [[2 * half, m(0.4), 0, -half + m(0.2)], [2 * half, m(0.4), 0, half - m(0.2)], [m(0.4), 2 * half, -half + m(0.2), 0], [m(0.4), 2 * half, half - m(0.2), 0]].forEach(([w, dd, x, z]) => {
    const c = new THREE.Mesh(new THREE.BoxGeometry(w, m(0.3), dd), GOLD);
    c.position.set(x, CEIL - m(0.15), z);
    room.add(c);
  });
}

// ---------- the chandelier ----------
// Tier on tier: gilt hoops, arms ending in candles, chains of crystal
// drops falling between them.
const CRYSTAL = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.02, metalness: 0.1, clearcoat: 1, emissive: 0xfff0d8, emissiveIntensity: 0.35, transparent: true, opacity: 0.9 });
const CANDLE = new THREE.MeshStandardMaterial({ color: 0xf6efe0, roughness: 0.6 });
const FLAME = new THREE.MeshBasicMaterial({ color: 0xffe2a8, toneMapped: false });
function crystalChandelier(room, x, y, z, s = 1) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  g.scale.setScalar(s);
  room.add(g);
  // The stem, turned like a baluster, and its chain to the ceiling.
  const stem = new THREE.Mesh(new THREE.LatheGeometry([[0, 0], [0.06, 0], [0.09, 0.08], [0.05, 0.2], [0.11, 0.45], [0.05, 0.7], [0.08, 0.95], [0.03, 1.2], [0, 1.2]].map(([r, h]) => new THREE.Vector2(m(r), m(h) - m(0.3))), 24), GOLD);
  g.add(stem);
  const chainLen = (CEIL - y) / s - m(0.9);
  const chain = new THREE.Mesh(new THREE.CylinderGeometry(m(0.015), m(0.015), chainLen, 6), GOLD);
  chain.position.y = m(0.9) + chainLen / 2;
  g.add(chain);
  const drops = [];
  const flames = [];
  [[m(1.0), 0, 12], [m(0.68), m(0.42), 9], [m(0.4), m(0.8), 6]].forEach(([r, ty, arms]) => {
    const hoop = new THREE.Mesh(new THREE.TorusGeometry(r, m(0.022), 8, 64), GOLD);
    hoop.rotation.x = Math.PI / 2;
    hoop.position.y = ty;
    g.add(hoop);
    for (let i = 0; i < arms; i++) {
      const a = (i / arms) * Math.PI * 2;
      const cx = Math.cos(a) * r, cz = Math.sin(a) * r;
      // The arm, curling out from the stem to the candle cup.
      const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(0, ty - m(0.08), 0), new THREE.Vector3(cx * 0.5, ty - m(0.14), cz * 0.5), new THREE.Vector3(cx, ty, cz), new THREE.Vector3(cx, ty + m(0.06), cz)]);
      g.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 12, m(0.014), 5, false), GOLD));
      const cup = new THREE.Mesh(new THREE.CylinderGeometry(m(0.045), m(0.025), m(0.04), 12), GOLD);
      cup.position.set(cx, ty + m(0.08), cz);
      g.add(cup);
      const candle = new THREE.Mesh(new THREE.CylinderGeometry(m(0.016), m(0.016), m(0.14), 8), CANDLE);
      candle.position.set(cx, ty + m(0.17), cz);
      g.add(candle);
      const flame = new THREE.Mesh(new THREE.SphereGeometry(m(0.018), 8, 6), FLAME);
      flame.scale.y = 1.8;
      flame.position.set(cx, ty + m(0.27), cz);
      g.add(flame);
      flames.push(flame);
      // A swag of drops to the next arm, and a pendant under the cup.
      const b = ((i + 0.5) / arms) * Math.PI * 2;
      for (let k = 1; k < 8; k++) {
        const t = k / 8;
        const aa = a + (b - a) * 2 * t;
        drops.push([Math.cos(aa) * r, ty - m(0.03) - Math.sin(t * Math.PI) * m(0.12), Math.sin(aa) * r, 0.8]);
      }
      for (let k = 0; k < 4; k++) drops.push([cx, ty - m(0.04) - k * m(0.045), cz, k === 3 ? 1.8 : 1]);
    }
  });
  // Strands of crystal hanging inside the lowest hoop.
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2, r = m(0.82);
    for (let k = 0; k < 7; k++) drops.push([Math.cos(a) * r * (1 - k * 0.07), -m(0.05) - k * m(0.06), Math.sin(a) * r * (1 - k * 0.07), k === 6 ? 1.8 : 1]);
  }
  const drop = new THREE.InstancedMesh(new THREE.OctahedronGeometry(m(0.022)), CRYSTAL, drops.length);
  const mtx = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3();
  drops.forEach(([dx, dy, dz, k], i) => {
    sc.set(k * 0.8, k * 1.6, k * 0.8);
    mtx.compose(new THREE.Vector3(dx, dy, dz), q, sc);
    drop.setMatrixAt(i, mtx);
  });
  g.add(drop);
  // The glow it throws.
  const gc = canvasTex(128, 128, (ctx) => {
    const gg = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    gg.addColorStop(0, 'rgba(255,226,170,0.55)');
    gg.addColorStop(0.5, 'rgba(255,210,140,0.15)');
    gg.addColorStop(1, 'rgba(255,210,140,0)');
    ctx.fillStyle = gg;
    ctx.fillRect(0, 0, 128, 128);
  });
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: gc, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
  glow.scale.set(m(3.4), m(3.4), 1);
  glow.position.y = m(0.3);
  g.add(glow);
  return (dt, now) => flames.forEach((f, i) => { f.scale.y = 1.6 + Math.sin(now / 90 + i * 1.7) * 0.25; });
}

// ---------- roulette ----------
const ORDER = [0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26];
const REDS = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);
const numColor = (n) => (n === 0 ? '#137a3a' : REDS.has(n) ? '#b3122e' : '#141414');

// The layout: the zero, the numbers in three rows of twelve, the dozens,
// the even chances, the columns. Lines in white on the baize.
let layoutTex = null;
function rouletteLayout() {
  if (layoutTex) return layoutTex;
  layoutTex = canvasTex(1024, 600, (ctx, W, H) => {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#0e5a32');
    g.addColorStop(1, '#0c4e2c');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    grain(ctx, W, H, 12);
    const M = 20, Z = 74, C = 84, RH = 118;
    const cw = (W - 2 * M - Z - C) / 12;
    const gx = (col) => W - M - Z - (col + 1) * cw; // a column's left edge, counted from the zero
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#f2efe6';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    // The zero.
    ctx.fillStyle = numColor(0);
    ctx.fillRect(W - M - Z, M, Z, 3 * RH);
    ctx.strokeRect(W - M - Z, M, Z, 3 * RH);
    ctx.fillStyle = '#ffffff';
    ctx.font = '700 46px Georgia, serif';
    ctx.save();
    ctx.translate(W - M - Z / 2, M + 1.5 * RH);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText('0', 0, 0);
    ctx.restore();
    // The numbers.
    for (let col = 0; col < 12; col++) {
      for (let row = 0; row < 3; row++) {
        const n = col * 3 + (3 - row);
        const x = gx(col), y = M + row * RH;
        ctx.fillStyle = numColor(n);
        ctx.fillRect(x + 6, y + 6, cw - 12, RH - 12);
        ctx.strokeRect(x, y, cw, RH);
        ctx.fillStyle = '#ffffff';
        ctx.font = '700 40px Georgia, serif';
        ctx.save();
        ctx.translate(x + cw / 2, y + RH / 2);
        ctx.rotate(-Math.PI / 2);
        ctx.fillText(String(n), 0, 0);
        ctx.restore();
      }
    }
    // The columns, at the far end.
    for (let row = 0; row < 3; row++) {
      const x = M, y = M + row * RH;
      ctx.strokeRect(x, y, C, RH);
      ctx.fillStyle = '#f2efe6';
      ctx.font = '700 22px Georgia, serif';
      ctx.save();
      ctx.translate(x + C / 2, y + RH / 2);
      ctx.rotate(-Math.PI / 2);
      ctx.fillText('2 to 1', 0, 0);
      ctx.restore();
    }
    // The dozens and the even chances.
    const y1 = M + 3 * RH, y2 = y1 + 84;
    ctx.font = '700 28px Georgia, serif';
    ['1st 12', '2nd 12', '3rd 12'].forEach((t, i) => {
      const x = gx(i * 4 + 3);
      ctx.strokeRect(x, y1, cw * 4, 84);
      ctx.fillStyle = '#f2efe6';
      ctx.fillText(t, x + cw * 2, y1 + 42);
    });
    ['1-18', 'EVEN', 'red', 'black', 'ODD', '19-36'].forEach((t, i) => {
      const x = gx(i * 2 + 1);
      ctx.strokeRect(x, y2, cw * 2, 84);
      if (t === 'red' || t === 'black') {
        ctx.fillStyle = t === 'red' ? '#b3122e' : '#141414';
        ctx.beginPath();
        ctx.moveTo(x + cw, y2 + 14);
        ctx.lineTo(x + cw * 1.7, y2 + 42);
        ctx.lineTo(x + cw, y2 + 70);
        ctx.lineTo(x + cw * 0.3, y2 + 42);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      } else {
        ctx.fillStyle = '#f2efe6';
        ctx.fillText(t, x + cw, y2 + 42);
      }
    });
  });
  return layoutTex;
}
// The wheel's face: thirty-seven pockets, numbered round the rim, frets
// of silver between, the cone of wood inside.
let wheelTex = null;
function wheelFace() {
  if (wheelTex) return wheelTex;
  wheelTex = canvasTex(1024, 1024, (ctx, S) => {
    const c = S / 2;
    const cone = ctx.createRadialGradient(c, c, 0, c, c, c * 0.72);
    cone.addColorStop(0, '#8a5a2a');
    cone.addColorStop(1, '#3a1a0a');
    ctx.fillStyle = cone;
    ctx.fillRect(0, 0, S, S);
    const step = (Math.PI * 2) / 37;
    ORDER.forEach((n, i) => {
      const a0 = i * step - Math.PI / 2 - step / 2, a1 = a0 + step;
      ctx.fillStyle = numColor(n);
      ctx.beginPath();
      ctx.arc(c, c, c * 0.98, a0, a1);
      ctx.arc(c, c, c * 0.72, a1, a0, true);
      ctx.closePath();
      ctx.fill();
      // The pocket, deeper toward the hub.
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.beginPath();
      ctx.arc(c, c, c * 0.84, a0, a1);
      ctx.arc(c, c, c * 0.72, a1, a0, true);
      ctx.closePath();
      ctx.fill();
      ctx.save();
      ctx.translate(c, c);
      ctx.rotate(a0 + step / 2 + Math.PI / 2);
      ctx.fillStyle = '#ffffff';
      ctx.font = '700 34px Georgia, serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(n), 0, -c * 0.91);
      ctx.restore();
      ctx.strokeStyle = '#d8dce2';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(c + Math.cos(a0) * c * 0.72, c + Math.sin(a0) * c * 0.72);
      ctx.lineTo(c + Math.cos(a0) * c * 0.98, c + Math.sin(a0) * c * 0.98);
      ctx.stroke();
    });
    [[0.98, 6], [0.84, 3], [0.72, 6]].forEach(([r, lw]) => {
      ctx.strokeStyle = '#d8dce2';
      ctx.lineWidth = lw;
      ctx.beginPath();
      ctx.arc(c, c, c * r, 0, Math.PI * 2);
      ctx.stroke();
    });
    // Gilt spokes on the cone.
    ctx.strokeStyle = '#d4af62';
    ctx.lineWidth = 10;
    for (let k = 0; k < 4; k++) {
      const a = (k / 4) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(c + Math.cos(a) * c * 0.12, c + Math.sin(a) * c * 0.12);
      ctx.lineTo(c + Math.cos(a) * c * 0.66, c + Math.sin(a) * c * 0.66);
      ctx.stroke();
    }
  });
  return wheelTex;
}

const FELT = new THREE.MeshStandardMaterial({ map: feltTexture('#0e5a32'), roughness: 0.95 });
const LEATHER = new THREE.MeshStandardMaterial({ color: 0x2a140c, roughness: 0.5 });
const CHROME = new THREE.MeshStandardMaterial({ color: 0xdfe3e8, roughness: 0.1, metalness: 1.0 });
const IVORY = new THREE.MeshStandardMaterial({ color: 0xf4f0e6, roughness: 0.2 });

function roundedRect(w, d, r) {
  const s = new THREE.Shape();
  s.moveTo(-w / 2 + r, -d / 2);
  s.lineTo(w / 2 - r, -d / 2);
  s.quadraticCurveTo(w / 2, -d / 2, w / 2, -d / 2 + r);
  s.lineTo(w / 2, d / 2 - r);
  s.quadraticCurveTo(w / 2, d / 2, w / 2 - r, d / 2);
  s.lineTo(-w / 2 + r, d / 2);
  s.quadraticCurveTo(-w / 2, d / 2, -w / 2, d / 2 - r);
  s.lineTo(-w / 2, -d / 2 + r);
  s.quadraticCurveTo(-w / 2, -d / 2, -w / 2 + r, -d / 2);
  return s;
}

// A roulette table: a mahogany cabinet on turned legs, baize, a padded
// rail; the wheel at one end in its bowl, the layout along the rest.
function rouletteTable(room, x, z, yaw) {
  const g = new THREE.Group();
  const L = m(2.8), W = m(1.4), H = FLOOR_Y + m(0.86);
  const body = new THREE.Mesh(new THREE.BoxGeometry(L - m(0.12), m(0.2), W - m(0.12)), MAHOGANY);
  body.position.y = H - m(0.12);
  g.add(body);
  const apron = new THREE.Mesh(new THREE.BoxGeometry(L - m(0.16), m(0.025), W - m(0.16)), GOLD);
  apron.position.y = H - m(0.23);
  g.add(apron);
  const legGeo = new THREE.LatheGeometry([[0, 0], [0.045, 0], [0.05, 0.06], [0.03, 0.2], [0.045, 0.42], [0.035, 0.55], [0.06, 0.62], [0, 0.62]].map(([r, h]) => new THREE.Vector2(m(r), m(h))), 16);
  [[-1, -1], [1, -1], [-1, 1], [1, 1], [0, -1], [0, 1]].forEach(([sx, sz]) => {
    const leg = new THREE.Mesh(legGeo, MAHOGANY);
    leg.position.set(sx * (L / 2 - m(0.2)), FLOOR_Y, sz * (W / 2 - m(0.2)));
    g.add(leg);
  });
  const felt = new THREE.Mesh(new THREE.ShapeGeometry(roundedRect(L - m(0.16), W - m(0.16), m(0.1))), FELT);
  felt.rotation.x = -Math.PI / 2;
  felt.position.y = H;
  g.add(felt);
  const railShape = roundedRect(L, W, m(0.16));
  railShape.holes.push(roundedRect(L - m(0.16), W - m(0.16), m(0.1)));
  const rail = new THREE.Mesh(new THREE.ExtrudeGeometry(railShape, { depth: m(0.05), bevelEnabled: true, bevelThickness: m(0.025), bevelSize: m(0.02), bevelSegments: 4, curveSegments: 12 }), LEATHER);
  rail.rotation.x = -Math.PI / 2;
  rail.position.y = H - m(0.01);
  g.add(rail);
  // The layout, along the end away from the wheel.
  const LZ = m(1.62), WZ = m(0.95);
  const layout = new THREE.Mesh(new THREE.PlaneGeometry(LZ, WZ), new THREE.MeshStandardMaterial({ map: rouletteLayout(), roughness: 0.95 }));
  layout.rotation.x = -Math.PI / 2;
  layout.position.set(-L / 2 + m(0.12) + LZ / 2, H + 0.003, 0);
  g.add(layout);
  // The wheel: a bowl of polished wood, the ball track round it, the
  // rotor turning in it, a chrome turret at its heart.
  const wx = L / 2 - m(0.62);
  const bowl = new THREE.Mesh(new THREE.LatheGeometry([[0.47, 0], [0.47, 0.1], [0.45, 0.115], [0.42, 0.105], [0.36, 0.07], [0.34, 0.06], [0, 0.06]].map(([r, h]) => new THREE.Vector2(m(r), m(h))), 64), MAHOGANY);
  bowl.position.set(wx, H - m(0.02), 0);
  g.add(bowl);
  const trim = new THREE.Mesh(new THREE.TorusGeometry(m(0.465), m(0.01), 6, 64), GOLD);
  trim.rotation.x = Math.PI / 2;
  trim.position.set(wx, H + m(0.095), 0);
  g.add(trim);
  const rotor = new THREE.Group();
  rotor.position.set(wx, H + m(0.045), 0);
  g.add(rotor);
  const face = new THREE.Mesh(new THREE.CircleGeometry(m(0.34), 64), new THREE.MeshStandardMaterial({ map: wheelFace(), roughness: 0.3, metalness: 0.1 }));
  face.rotation.x = -Math.PI / 2;
  rotor.add(face);
  const turret = new THREE.Mesh(new THREE.LatheGeometry([[0, 0.12], [0.012, 0.11], [0.02, 0.07], [0.012, 0.05], [0.04, 0.02], [0.05, 0], [0, 0]].map(([r, h]) => new THREE.Vector2(m(r), m(h))), 24), CHROME);
  rotor.add(turret);
  for (let k = 0; k < 4; k++) {
    const a = (k / 4) * Math.PI * 2;
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(m(0.007), m(0.007), m(0.11), 8), CHROME);
    arm.rotation.set(0, -a, Math.PI / 2);
    arm.position.set(Math.cos(a) * m(0.055), m(0.075), Math.sin(a) * m(0.055));
    rotor.add(arm);
    const knob = new THREE.Mesh(new THREE.SphereGeometry(m(0.012), 10, 8), CHROME);
    knob.position.set(Math.cos(a) * m(0.11), m(0.075), Math.sin(a) * m(0.11));
    rotor.add(knob);
  }
  const ball = new THREE.Mesh(new THREE.SphereGeometry(m(0.011), 12, 8), IVORY);
  g.add(ball);
  // Chips on the layout, and a stack of each colour by the wheel.
  const chipY = H + 0.004;
  const lx = -L / 2 + m(0.12) + LZ / 2;
  [['red', -0.2, 0.1, 4], ['green', -0.55, -0.25, 6], ['purple', 0.05, 0.25, 3], ['white', -0.65, 0.05, 5], ['black', -0.35, -0.05, 2]].forEach(([c, cx, cz, n]) => chipStack(g, lx + m(cx), chipY, m(cz), n, c));
  ['white', 'red', 'green', 'black', 'purple', 'gold'].forEach((c, i) => chipStack(g, wx - m(0.3) + i * m(0.075), chipY, W / 2 - m(0.2), 12 + (i % 3) * 4, c));
  g.position.set(x, 0, z);
  g.rotation.y = yaw;
  room.add(g);
  // The wheel turns one way; the ball runs the other on the track, slows,
  // drops into a pocket and rides it round, then is spun again.
  let ballA = Math.random() * Math.PI * 2, ballV = 0, ballR = m(0.3), next = performance.now() + Math.random() * 8000, settled = null;
  return (dt, now) => {
    rotor.rotation.y += dt * 0.7;
    if (now > next) {
      ballV = -9 - Math.random() * 2;
      next = now + 18000 + Math.random() * 12000;
      settled = null;
    }
    if (ballV < -0.9) {
      ballA += ballV * dt;
      ballV *= 1 - dt * 0.2;
      ballR = m(0.42) - (1 - Math.min(1, -ballV / 9)) * m(0.1);
    } else {
      if (settled === null) settled = ballA + rotor.rotation.y;
      ballR = m(0.3);
      ballA = settled - rotor.rotation.y;
    }
    ball.position.set(wx + Math.cos(ballA) * ballR, H + (ballR > m(0.36) ? m(0.09) : m(0.055)), Math.sin(ballA) * ballR);
  };
}

// ---------- the salons ----------
// A low table of Carrara on gilt legs.
function marbleTable(room, x, z, w, d, yaw = 0) {
  const g = new THREE.Group();
  const top = new THREE.Mesh(new THREE.BoxGeometry(w, m(0.04), d), CARRARA);
  top.position.y = FLOOR_Y + m(0.44);
  g.add(top);
  const frame = new THREE.Mesh(new THREE.BoxGeometry(w - m(0.04), m(0.06), d - m(0.04)), GOLD);
  frame.position.y = FLOOR_Y + m(0.39);
  g.add(frame);
  [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(m(0.022), m(0.012), m(0.36), 10), GOLD);
    leg.position.set(sx * (w / 2 - m(0.06)), FLOOR_Y + m(0.18), sz * (d / 2 - m(0.06)));
    g.add(leg);
  });
  g.position.set(x, 0, z);
  g.rotation.y = yaw;
  room.add(g);
}
// A salon against a wall: a white Louis sofa, two bergères, a marble
// table, a carpet under them.
const SALON_RUG = new THREE.MeshLambertMaterial({ color: 0x5a1820 });
function salon(room, x, z, inward) {
  const yaw = Math.atan2(inward.x, inward.z);
  const tx = x + inward.x * m(1.2), tz = z + inward.z * m(1.2);
  const rug = new THREE.Mesh(new THREE.PlaneGeometry(m(3.4), m(2.9)), SALON_RUG);
  rug.rotation.set(-Math.PI / 2, 0, yaw);
  rug.position.set(tx, FLOOR_Y + 0.005, tz);
  room.add(rug);
  place(room, 'Sofa_01', { x, z, yaw, size: 1.15 });
  marbleTable(room, tx, tz, m(1.0), m(0.55), yaw);
  const side = new THREE.Vector3(-inward.z, 0, inward.x);
  [-1, 1].forEach((s) => {
    const cx = tx + inward.x * m(0.95) + side.x * s * m(0.65), cz = tz + inward.z * m(0.95) + side.z * s * m(0.65);
    place(room, 'ArmChair_01', { x: cx, z: cz, yaw: facing(cx, cz, tx, tz) });
  });
}
// A marble bust on a column.
function bust(room, x, z, yaw) {
  const col = new THREE.Mesh(new THREE.CylinderGeometry(m(0.2), m(0.22), m(1.1), 20), CARRARA);
  col.position.set(x, FLOOR_Y + m(0.55), z);
  room.add(col);
  [m(0.03), m(1.1)].forEach((y) => {
    const band = new THREE.Mesh(new THREE.BoxGeometry(m(0.5), m(0.06), m(0.5)), CARRARA);
    band.position.set(x, FLOOR_Y + y, z);
    room.add(band);
  });
  place(room, 'marble_bust_01', { x, y: FLOOR_Y + m(1.13), z, yaw, size: 1.5 });
}
// A tall gilt mirror on the wall, a console under it.
function mirrorConsole(room, x, z, yaw) {
  const inward = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw));
  place(room, 'ornate_mirror_01', { x: x + inward.x * 0.05, y: FLOOR_Y + m(1.25), z: z + inward.z * 0.05, yaw, size: 4.2 });
  place(room, 'ClassicConsole_01', { x: x + inward.x * m(0.32), z: z + inward.z * m(0.32), yaw });
}

// ---------- the bar ----------
// The Bar Américain: mahogany panelled, a Carrara top, a brass rail; the
// back of tall arched mirrors in gilt frames, glass shelves of bottles.
function barAmericain(room) {
  const len = m(5.6);
  const x = -half + m(1.1) + len / 2;
  const z = -half + m(2.0);
  const front = new THREE.Mesh(new THREE.BoxGeometry(len, m(1.0), m(0.6)), MAHOGANY);
  front.position.set(x, FLOOR_Y + m(0.5), z);
  room.add(front);
  for (let i = 0; i < 8; i++) {
    const px = x - len / 2 + (i + 0.5) * (len / 8);
    const f = new THREE.Mesh(new THREE.BoxGeometry(len / 8 - m(0.08), m(0.66), m(0.01)), GOLD);
    f.position.set(px, FLOOR_Y + m(0.52), z + m(0.302));
    room.add(f);
    const p = new THREE.Mesh(new THREE.BoxGeometry(len / 8 - m(0.12), m(0.62), m(0.02)), MAHOGANY);
    p.position.set(px, FLOOR_Y + m(0.52), z + m(0.31));
    room.add(p);
  }
  const top = new THREE.Mesh(new THREE.BoxGeometry(len + m(0.14), m(0.06), m(0.8)), CARRARA);
  top.position.set(x, FLOOR_Y + m(1.03), z - m(0.05));
  room.add(top);
  const rail = new THREE.Mesh(new THREE.CylinderGeometry(m(0.024), m(0.024), len, 12), BRASS);
  rail.rotation.z = Math.PI / 2;
  rail.position.set(x, FLOOR_Y + m(0.18), z + m(0.45));
  room.add(rail);
  // The back: mahogany, three arched mirrors framed in gilt, shelves.
  const back = new THREE.Mesh(new THREE.BoxGeometry(len, m(3.2), m(0.14)), MAHOGANY);
  back.position.set(x, FLOOR_Y + m(1.6), -half + m(0.16));
  room.add(back);
  const MIRROR = new THREE.MeshStandardMaterial({ color: 0xb8c0c4, roughness: 0.04, metalness: 1.0 });
  [-1, 0, 1].forEach((k) => {
    const w = len / 3 - m(0.3), h = m(2.2);
    const s = new THREE.Shape();
    s.moveTo(-w / 2, 0);
    s.lineTo(w / 2, 0);
    s.lineTo(w / 2, h - w / 2);
    s.absarc(0, h - w / 2, w / 2, 0, Math.PI, false);
    s.lineTo(-w / 2, 0);
    const mir = new THREE.Mesh(new THREE.ShapeGeometry(s, 24), MIRROR);
    mir.position.set(x + k * (len / 3), FLOOR_Y + m(1.0), -half + m(0.235));
    room.add(mir);
    const curve = new THREE.CatmullRomCurve3(s.getPoints(40).map((p) => new THREE.Vector3(p.x, p.y, 0)), true);
    const frame = new THREE.Mesh(new THREE.TubeGeometry(curve, 120, m(0.03), 6, true), GOLD);
    frame.position.copy(mir.position);
    frame.position.z += 0.01;
    room.add(frame);
  });
  const SHELF = new THREE.MeshStandardMaterial({ color: 0xdfe8e8, roughness: 0.05, transparent: true, opacity: 0.35 });
  [1.15, 1.6, 2.05].forEach((y) => {
    const shelf = new THREE.Mesh(new THREE.BoxGeometry(len - m(0.3), m(0.02), m(0.26)), SHELF);
    shelf.position.set(x, FLOOR_Y + m(y), -half + m(0.38));
    room.add(shelf);
    bottleRow(room, x - len / 2 + m(0.25), x + len / 2 - m(0.25), FLOOR_Y + m(y) + m(0.01), -half + m(0.38), [0x2a4a1a, 0x5a2a0a, 0xe8dca0, 0x3a0a14, 0xa8763a, 0x1a2a3a, 0xc8d8c0]);
  });
  // Stools of brass and red velvet.
  for (let i = 0; i < 6; i++) {
    const sx = x - len / 2 + (i + 0.5) * (len / 6);
    const post = new THREE.Mesh(new THREE.CylinderGeometry(m(0.025), m(0.03), m(0.74), 12), BRASS);
    post.position.set(sx, FLOOR_Y + m(0.37), z + m(0.75));
    room.add(post);
    const foot = new THREE.Mesh(new THREE.TorusGeometry(m(0.16), m(0.012), 6, 24), BRASS);
    foot.rotation.x = Math.PI / 2;
    foot.position.set(sx, FLOOR_Y + m(0.25), z + m(0.75));
    room.add(foot);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(m(0.18), m(0.2), m(0.03), 24), BRASS);
    base.position.set(sx, FLOOR_Y + m(0.015), z + m(0.75));
    room.add(base);
    const seat = new THREE.Mesh(new THREE.CylinderGeometry(m(0.21), m(0.2), m(0.1), 24), RED_VELVET);
    seat.position.set(sx, FLOOR_Y + m(0.79), z + m(0.75));
    room.add(seat);
  }
  room.userData.bar = {
    bartender: { pos: new THREE.Vector3(x - len * 0.1, 0, -half + m(0.9)), yaw: 0 },
    pickup: { pos: new THREE.Vector3(x + len / 2 + m(0.55), 0, z - m(0.1)), look: new THREE.Vector3(x, 0, z) },
  };
}

// The cashier's cage: a counter of marble and mahogany, a brass grille
// over it with its windows, CAISSE in gold above.
function caisse(room) {
  const len = m(4.4);
  const x = half - m(1.1) - len / 2;
  const z = -half + m(1.0);
  const counter = new THREE.Mesh(new THREE.BoxGeometry(len, m(1.1), m(0.7)), MAHOGANY);
  counter.position.set(x, FLOOR_Y + m(0.55), z);
  room.add(counter);
  const top = new THREE.Mesh(new THREE.BoxGeometry(len + m(0.1), m(0.05), m(0.8)), CARRARA);
  top.position.set(x, FLOOR_Y + m(1.12), z);
  room.add(top);
  // The grille: brass bars, three windows in it.
  const bars = new THREE.InstancedMesh(new THREE.CylinderGeometry(m(0.008), m(0.008), m(1.2), 6), BRASS, 90);
  const mtx = new THREE.Matrix4();
  let n = 0;
  for (let i = 0; i < 90; i++) {
    const bx = x - len / 2 + (i + 0.5) * (len / 90);
    if ([-1, 0, 1].some((k) => Math.abs(bx - (x + (k * len) / 3)) < m(0.3))) continue;
    mtx.makeTranslation(bx, FLOOR_Y + m(1.75), z + m(0.3));
    bars.setMatrixAt(n++, mtx);
  }
  bars.count = n;
  room.add(bars);
  [m(1.15), m(2.35)].forEach((y) => {
    const r = new THREE.Mesh(new THREE.BoxGeometry(len, m(0.05), m(0.05)), BRASS);
    r.position.set(x, FLOOR_Y + y, z + m(0.3));
    room.add(r);
  });
  const wall = new THREE.Mesh(new THREE.BoxGeometry(len, m(2.6), m(0.1)), MAHOGANY);
  wall.position.set(x, FLOOR_Y + m(1.3), -half + m(0.1));
  room.add(wall);
  const label = giltText('CAISSE', m(2.2), m(0.45), "600 {S}px 'Cinzel', Georgia, serif");
  label.position.set(x, FLOOR_Y + m(2.75), -half + m(0.17));
  room.add(label);
  chipStack(room, x - m(0.4), FLOOR_Y + m(1.145), z, 20, 'gold');
  chipStack(room, x - m(0.32), FLOOR_Y + m(1.145), z + m(0.05), 14, 'purple');
}

// The entrance in the front wall: velvet curtains either side of an
// opening of light, a gilt pelmet over it.
function entrance(room) {
  const w = m(3.2), h = m(3.8);
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: 0xffe8c0, toneMapped: false }));
  glow.position.set(0, FLOOR_Y + h / 2, half - 0.06);
  glow.rotation.y = Math.PI;
  room.add(glow);
  [-1, 1].forEach((s) => {
    const pts = [];
    for (let k = 0; k <= 12; k++) pts.push(new THREE.Vector2(m(0.25) + Math.sin(k * 1.3) * m(0.04), (k / 12) * h));
    const curtain = new THREE.Mesh(new THREE.LatheGeometry(pts, 16, 0, Math.PI), RED_VELVET);
    curtain.scale.set(1.6, 1, 0.5);
    curtain.position.set(s * (w / 2 + m(0.1)), FLOOR_Y, half - m(0.25));
    room.add(curtain);
  });
  const pelmet = new THREE.Mesh(new THREE.BoxGeometry(w + m(1.2), m(0.5), m(0.25)), GOLD);
  pelmet.position.set(0, FLOOR_Y + h + m(0.25), half - m(0.2));
  room.add(pelmet);
}

// ---------- the room ----------
export const WILD_CARD = {
  tableGlow: 0xffc070,
  half,
  ceilingY: CEIL,
  ceiling: null, noPanel: true, noCove: true,
  paintWall: (ctx, d) => paintSalonWall(ctx, d),
  floorPx: 1024, floorRepeat: 72 / m(0.9),
  paintFloor: paintParquet,
  accent: 0xd4af5a, cove: 0xd4af5a, diffuser: 0xfff0d2, washAlpha: 0,
  wall: { style: 'panels', base: 0xe6dcc6, wainscot: 0xe6dcc6, rail: 0xd4af5a, skirting: 0x3a2412 },
  floor: { style: 'wood', base: 0x8a5a2e, pattern: 0x6e4420 },
  light: { sky: 0xfff0dc, ground: 0x6a4a2a, fill: 2.0, key: 0xfff0dc, keyPower: 96, wash: 0xffd8a8, washPower: 40, fog: 0x2a1e14, fogNear: 60, fogFar: 160 },
  furnish(room) {
    const updates = [];
    paintedCeiling(room);
    room.add(aubusson(m(7.4), m(6.0)));
    updates.push(crystalChandelier(room, 0, FLOOR_Y + m(4.9), -0.4, 1.15));

    // The sign, the room's name in gilt over it.
    brandSign(room, half, { rgb: '236,206,140', plate: '#2a0a10' });
    const plaque = new THREE.Mesh(new THREE.BoxGeometry(m(5.0), m(0.85), m(0.05)), new THREE.MeshStandardMaterial({ color: 0x1a0a08, roughness: 0.25, metalness: 0.2 }));
    plaque.position.set(0, FLOOR_Y + m(4.0), -half + m(0.03));
    room.add(plaque);
    const plaqueFrame = new THREE.Mesh(new THREE.BoxGeometry(m(5.12), m(0.97), m(0.03)), GOLD);
    plaqueFrame.position.set(0, FLOOR_Y + m(4.0), -half + m(0.015));
    room.add(plaqueFrame);
    const title = giltText('The Wild Card', m(4.6), m(0.8), "italic 600 {S}px 'Cinzel', Georgia, serif");
    title.position.set(0, FLOOR_Y + m(4.0), -half + m(0.06));
    room.add(title);
    brandSign(room, half, { wall: 'front', width: m(1.8), y: FLOOR_Y + m(4.5), rgb: '236,206,140', plate: '#2a0a10' });

    // Roulette either side of the table, a gilt chandelier over each.
    [-1, 1].forEach((side) => {
      [-m(4.6), m(3.4)].forEach((z) => {
        updates.push(rouletteTable(room, side * m(7.4), z, Math.PI / 2));
        place(room, 'Chandelier_01', { x: side * m(7.4), y: CEIL - m(1.7), z, size: 2.4 });
      });
      updates.push(rouletteTable(room, side * m(11.2), -m(1.4), Math.PI / 2));
      place(room, 'Chandelier_01', { x: side * m(11.2), y: CEIL - m(1.7), z: -m(1.4), size: 2.4 });
    });
    // Mirrors over consoles down the side walls; salons in the front half.
    [-1, 1].forEach((side) => {
      const wx = side * (half - 0.05);
      [-m(10.5), -m(4.6), m(1.3)].forEach((z) => mirrorConsole(room, wx, z, -side * Math.PI / 2));
      [m(6.0), m(10.6)].forEach((z) => salon(room, side * (half - m(0.75)), z, new THREE.Vector3(-side, 0, 0)));
      place(room, 'potted_plant_01', { x: side * (half - m(0.7)), z: half - m(0.7), size: 1.6 });
      place(room, 'potted_plant_01', { x: side * m(2.6), z: half - m(0.7), size: 1.4 });
    });
    // Busts flanking the sign, and the front salons.
    [-1, 1].forEach((side) => bust(room, side * m(3.4), -half + m(0.6), 0));
    [-m(6), m(6)].forEach((x) => salon(room, x, half - m(0.75), new THREE.Vector3(0, 0, -1)));
    entrance(room);
    barAmericain(room);
    caisse(room);

    walkway(room, { x: 10.5, back: -9.2, front: 10.5 });
    staffPosts(room, [[10.5, -9.6], [-10.5, 10.5], [10.5, 10.5]]);
    room.userData.update = (dt, now) => updates.forEach((u) => u(dt, now));
  },
};
