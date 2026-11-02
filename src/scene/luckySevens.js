import * as THREE from 'three';
import { FLOOR_Y, m } from './scale.js';
import { walkway, brandSign, staffPosts } from './layout.js';
import { lightPanel, roundRug, lightRing } from './decor.js';

// Lucky Sevens: a neon lounge off the Las Vegas Strip, the room every new
// player starts in, and the loudest. Everything in it is its own:
//
//   - over the table, a slot machine the size of a car: three reels in a
//     gold frame ringed with marquee bulbs, spinning;
//   - neon on every wall — LUCKY SEVENS over the sign, cherries, 777,
//     dice, a horseshoe, JACKPOT — flickering now and then;
//   - banks of slot machines down the sides, reels turning, each with its
//     chrome stool;
//   - red vinyl booths round chrome-rimmed tables, in the manner of the old
//     Strip;
//   - a chrome bar edged in neon, its bottles lit on glass shelves under a
//     neon BAR;
//   - a carpet as loud as a casino's, a neon grid overhead.

const half = 36;
const VIOLET = 0x150a26;

// ---------- materials ----------
const chrome = new THREE.MeshStandardMaterial({ color: 0xe6e9ee, roughness: 0.12, metalness: 1.0 });
const redVinyl = new THREE.MeshStandardMaterial({ color: 0xb3122e, roughness: 0.35, metalness: 0.05 });
const blackGloss = new THREE.MeshStandardMaterial({ color: 0x0b0a10, roughness: 0.1, metalness: 0.2 });
const neon = (color) => new THREE.MeshBasicMaterial({ color, toneMapped: false });

// ---------- the carpet ----------
// A casino carpet: deep violet, scattered with stars, rings and diamonds
// in magenta, teal and gold — busy enough that nobody looks at the floor.
function paintVegasCarpet(ctx, S) {
  ctx.fillStyle = '#1a0b2e';
  ctx.fillRect(0, 0, S, S);
  const wrap = (fn) => [-S, 0, S].forEach((dx) => [-S, 0, S].forEach((dy) => fn(dx, dy)));
  const star = (x, y, r, col) => {
    ctx.fillStyle = col;
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
      const rr = i % 2 ? r * 0.45 : r;
      ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
    }
    ctx.closePath();
    ctx.fill();
  };
  const shapes = [];
  for (let i = 0; i < 26; i++) shapes.push({ kind: i % 3, x: Math.random() * S, y: Math.random() * S, r: 10 + Math.random() * 22, col: ['#e0328a', '#21c4c0', '#e8b84a', '#7a3ad8'][i % 4] });
  shapes.forEach((sh) => wrap((dx, dy) => {
    const x = sh.x + dx, y = sh.y + dy;
    if (sh.kind === 0) star(x, y, sh.r, sh.col);
    else if (sh.kind === 1) { ctx.strokeStyle = sh.col; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(x, y, sh.r, 0, Math.PI * 2); ctx.stroke(); }
    else { ctx.fillStyle = sh.col; ctx.beginPath(); ctx.moveTo(x, y - sh.r); ctx.lineTo(x + sh.r * 0.6, y); ctx.lineTo(x, y + sh.r); ctx.lineTo(x - sh.r * 0.6, y); ctx.closePath(); ctx.fill(); }
  }));
  const img = ctx.getImageData(0, 0, S, S);
  for (let i = 0; i < img.data.length; i += 4) { const n = (Math.random() - 0.5) * 12; img.data[i] += n; img.data[i + 1] += n; img.data[i + 2] += n; }
  ctx.putImageData(img, 0, 0);
}

// ---------- the walls ----------
// Deep violet lacquer, ribbed with chrome, a mirror band at waist height.
function paintNeonWall(ctx, d) {
  const { texW: W, texH: H, px } = d;
  const u = px * m(1);
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#1e0f36');
  g.addColorStop(1, '#0f0720');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  for (let x = 0; x < W; x += u * 0.9) {
    ctx.fillStyle = 'rgba(210,215,230,0.18)';
    ctx.fillRect(x, 0, 3, H);
  }
  const band = H - u * 1.2;
  const mg = ctx.createLinearGradient(0, band, 0, band + u * 0.5);
  mg.addColorStop(0, 'rgba(180,170,220,0.35)');
  mg.addColorStop(1, 'rgba(60,40,90,0.35)');
  ctx.fillStyle = mg;
  ctx.fillRect(0, band, W, u * 0.5);
  ctx.fillStyle = 'rgba(230,235,245,0.6)';
  ctx.fillRect(0, band - 3, W, 6);
  ctx.fillRect(0, band + u * 0.5, W, 6);
}

// ---------- neon ----------
// A tube of light drawn on the canvas: a wide soft glow, a bright core.
function glowStroke(ctx, color, width, draw) {
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = color;
  [[width * 3, 0.18], [width * 1.8, 0.35], [width, 1]].forEach(([w, a]) => {
    ctx.globalAlpha = a;
    ctx.lineWidth = w;
    ctx.shadowColor = color;
    ctx.shadowBlur = width * 2;
    draw();
    ctx.stroke();
  });
  ctx.globalAlpha = 1;
  ctx.lineWidth = width * 0.35;
  ctx.strokeStyle = '#ffffff';
  ctx.shadowBlur = 0;
  draw();
  ctx.stroke();
  ctx.restore();
}
function neonText(ctx, text, x, y, size, color, font = "700 italic {S}px 'Cinzel', Georgia, serif") {
  ctx.save();
  ctx.font = font.replace('{S}', size);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  [[size * 0.16, 0.25], [size * 0.08, 0.5]].forEach(([w, a]) => {
    ctx.globalAlpha = a; ctx.lineWidth = w; ctx.strokeStyle = color; ctx.shadowColor = color; ctx.shadowBlur = size * 0.3;
    ctx.strokeText(text, x, y);
  });
  ctx.globalAlpha = 1;
  ctx.shadowBlur = size * 0.15;
  ctx.lineWidth = size * 0.035;
  ctx.strokeStyle = '#ffffff';
  ctx.strokeText(text, x, y);
  ctx.restore();
}
// The neon pieces, each drawn into a w x h canvas.
const NEON_ART = {
  sevens: (ctx, w, h) => { neonText(ctx, '777', w / 2, h / 2, h * 0.55, '#ff2a4a'); },
  cherries: (ctx, w, h) => {
    glowStroke(ctx, '#3cff7a', h * 0.025, () => { ctx.beginPath(); ctx.moveTo(w * 0.35, h * 0.62); ctx.quadraticCurveTo(w * 0.45, h * 0.2, w * 0.62, h * 0.18); ctx.moveTo(w * 0.62, h * 0.62); ctx.quadraticCurveTo(w * 0.6, h * 0.35, w * 0.62, h * 0.18); });
    [[0.33, 0.7], [0.63, 0.7]].forEach(([cx, cy]) => glowStroke(ctx, '#ff2a6a', h * 0.03, () => { ctx.beginPath(); ctx.arc(w * cx, h * cy, h * 0.14, 0, Math.PI * 2); }));
  },
  dice: (ctx, w, h) => {
    [[0.3, 0.55, -0.2], [0.68, 0.5, 0.25]].forEach(([cx, cy, rot]) => {
      ctx.save(); ctx.translate(w * cx, h * cy); ctx.rotate(rot);
      glowStroke(ctx, '#29e0ff', h * 0.025, () => { ctx.beginPath(); ctx.roundRect(-h * 0.2, -h * 0.2, h * 0.4, h * 0.4, h * 0.06); });
      [[-1, -1], [0, 0], [1, 1]].forEach(([u, v]) => glowStroke(ctx, '#ffffff', h * 0.02, () => { ctx.beginPath(); ctx.arc(u * h * 0.1, v * h * 0.1, h * 0.02, 0, Math.PI * 2); }));
      ctx.restore();
    });
  },
  horseshoe: (ctx, w, h) => {
    glowStroke(ctx, '#ffc23a', h * 0.05, () => { ctx.beginPath(); ctx.arc(w / 2, h * 0.45, h * 0.28, Math.PI * 0.85, Math.PI * 2.15, false); });
    neonText(ctx, 'LUCK', w / 2, h * 0.85, h * 0.16, '#ff4fd8');
  },
  jackpot: (ctx, w, h) => { neonText(ctx, 'JACKPOT', w / 2, h / 2, h * 0.42, '#ffd23a'); },
  suits: (ctx, w, h) => { neonText(ctx, '♠ ♥ ♦ ♣', w / 2, h / 2, h * 0.5, '#ff4fd8', "700 {S}px Georgia, 'Segoe UI Symbol', serif"); },
  title: (ctx, w, h) => {
    neonText(ctx, 'LUCKY', w * 0.24, h * 0.5, h * 0.44, '#ff3ad0');
    neonText(ctx, 'SEVENS', w * 0.765, h * 0.5, h * 0.44, '#29e0ff');
    neonText(ctx, '★', w * 0.5, h * 0.5, h * 0.38, '#ffd23a', "700 {S}px Georgia, 'Segoe UI Symbol', serif");
  },
};
function neonPiece(room, kind, w, h, x, y, z, yaw, flickers) {
  const p = lightPanel(NEON_ART[kind], w, h, 1024);
  p.position.set(x, y, z);
  p.rotation.y = yaw;
  room.add(p);
  flickers.push({ mat: p.material, next: performance.now() + 4000 + Math.random() * 12000, until: 0 });
}

// ---------- marquee bulbs ----------
// Bulbs along `points`, a light chasing round them.
function marquee(room, points, chasers) {
  const geo = new THREE.SphereGeometry(m(0.035), 8, 6);
  const mesh = new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }), points.length);
  const mtx = new THREE.Matrix4();
  points.forEach((p, i) => { mtx.makeTranslation(p.x, p.y, p.z); mesh.setMatrixAt(i, mtx); mesh.setColorAt(i, new THREE.Color(0xffd890)); });
  room.add(mesh);
  chasers.push({ mesh, n: points.length });
}
function rectPoints(cx, cy, z, w, h, step, axis = 'z') {
  const pts = [];
  const per = (len) => Math.max(2, Math.round(len / step));
  const push = (x, y) => pts.push(axis === 'z' ? new THREE.Vector3(cx + x, cy + y, z) : new THREE.Vector3(z, cy + y, cx + x));
  for (let i = 0; i < per(w); i++) push(-w / 2 + (i / per(w)) * w, h / 2);
  for (let i = 0; i < per(h); i++) push(w / 2, h / 2 - (i / per(h)) * h);
  for (let i = 0; i < per(w); i++) push(w / 2 - (i / per(w)) * w, -h / 2);
  for (let i = 0; i < per(h); i++) push(-w / 2, -h / 2 + (i / per(h)) * h);
  return pts;
}

// ---------- the reels ----------
// A strip of slot symbols for a reel to wear.
function reelStrip() {
  const W = 256, H = 2048, N = 8;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#f5efe2';
  ctx.fillRect(0, 0, W, H);
  const cell = H / N;
  const SYMS = [['7', '#d41a2c'], ['BAR', '#141414'], ['★', '#e0a810'], ['7', '#1a4fd4'], ['♦', '#d41a6a'], ['BAR', '#141414'], ['♣', '#1a8a3a'], ['7', '#d41a2c']];
  SYMS.forEach(([sym, col], i) => {
    const y = i * cell + cell / 2;
    ctx.fillStyle = col;
    ctx.strokeStyle = '#c99a2a';
    ctx.lineWidth = 6;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    if (sym === 'BAR') {
      ctx.fillRect(W * 0.14, y - cell * 0.16, W * 0.72, cell * 0.32);
      ctx.fillStyle = '#ffffff';
      ctx.font = `900 ${cell * 0.22}px Georgia, serif`;
      ctx.fillText('BAR', W / 2, y + 2);
    } else {
      ctx.font = `900 ${cell * 0.62}px Georgia, 'Segoe UI Symbol', serif`;
      ctx.strokeText(sym, W / 2, y);
      ctx.fillText(sym, W / 2, y);
    }
    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    ctx.fillRect(0, i * cell, W, 3);
  });
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

// The same symbols for a great reel turning on its side: laid round the
// cylinder (along u), each turned so it stands upright as it comes over
// the top toward the players.
function reelBand() {
  const N = 8, CELL = 256;
  const c = document.createElement('canvas');
  c.width = N * CELL; c.height = CELL;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#f5efe2';
  ctx.fillRect(0, 0, c.width, c.height);
  const SYMS = [['7', '#d41a2c'], ['BAR', '#141414'], ['★', '#e0a810'], ['7', '#1a4fd4'], ['♦', '#d41a6a'], ['BAR', '#141414'], ['♣', '#1a8a3a'], ['7', '#d41a2c']];
  SYMS.forEach(([sym, col], i) => {
    ctx.save();
    ctx.translate(i * CELL + CELL / 2, CELL / 2);
    ctx.rotate(Math.PI / 2);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = col;
    if (sym === 'BAR') {
      ctx.fillRect(-CELL * 0.36, -CELL * 0.16, CELL * 0.72, CELL * 0.32);
      ctx.fillStyle = '#ffffff';
      ctx.font = `900 ${CELL * 0.22}px Georgia, serif`;
      ctx.fillText('BAR', 0, 2);
    } else {
      ctx.strokeStyle = '#c99a2a';
      ctx.lineWidth = 6;
      ctx.font = `900 ${CELL * 0.62}px Georgia, 'Segoe UI Symbol', serif`;
      ctx.strokeText(sym, 0, 0);
      ctx.fillText(sym, 0, 0);
    }
    ctx.restore();
    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    ctx.fillRect(i * CELL, 0, 3, CELL);
  });
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// The great slot machine over the table: three reels turning in a gold
// frame, marquee bulbs round it.
function giantSlot(room, CEILING_Y, chasers) {
  const band = reelBand();
  const R = m(0.62), W = m(0.72), GAP = m(0.12);
  const cy = FLOOR_Y + m(3.45);
  const cz = -0.4;
  const reels = [];
  const reelMat = new THREE.MeshBasicMaterial({ map: band, toneMapped: false });
  for (let i = -1; i <= 1; i++) {
    // Each turns about its own axis, along x.
    const spin = new THREE.Group();
    spin.position.set(i * (W + GAP), cy, cz);
    room.add(spin);
    const reel = new THREE.Mesh(new THREE.CylinderGeometry(R, R, W, 48, 1, true), reelMat);
    reel.rotation.z = Math.PI / 2;
    spin.add(reel);
    spin.rotation.x = Math.random() * Math.PI * 2;
    reels.push({ spin, speed: 1.1 + Math.abs(i) * 0.45 + (i > 0 ? 0.35 : 0) });
  }
  // The frame, front and back, in gold.
  const gold = new THREE.MeshStandardMaterial({ color: 0xd8b25e, roughness: 0.2, metalness: 1.0, emissive: 0x3a2808, emissiveIntensity: 0.4 });
  const FW = 3 * W + 2 * GAP + m(0.5), FH = 2 * R + m(0.4);
  [[FW, m(0.12), 0, FH / 2], [FW, m(0.12), 0, -FH / 2], [m(0.12), FH, FW / 2, 0], [m(0.12), FH, -FW / 2, 0]].forEach(([w, h, x, y]) => {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(w, h, 2 * R + m(0.2)), gold);
    bar.position.set(x, cy + y, cz);
    room.add(bar);
  });
  // A crown of red light on top, LUCKY 7 lettered on it.
  const crown = lightPanel((ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, 'rgba(255,60,80,0.95)'); g.addColorStop(1, 'rgba(150,0,30,0.95)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.roundRect(4, 4, w - 8, h - 8, h * 0.4); ctx.fill();
    ctx.fillStyle = '#fff4c8'; ctx.font = `900 ${h * 0.6}px Georgia, serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('LUCKY ★ 7', w / 2, h / 2 + 2);
  }, FW * 0.7, m(0.55), 1024);
  crown.material.blending = THREE.NormalBlending;
  [1, -1].forEach((s) => {
    const c = crown.clone();
    c.position.set(0, cy + FH / 2 + m(0.36), cz + s * (R + m(0.11)));
    c.rotation.y = s > 0 ? 0 : Math.PI;
    room.add(c);
  });
  // Bulbs round the frame, on the face the players see.
  marquee(room, rectPoints(0, cy, cz + R + m(0.11), FW + m(0.1), FH + m(0.1), m(0.16)), chasers);
  // The chains it hangs from.
  [-1, 1].forEach((s) => {
    const len = CEILING_Y - (cy + FH / 2);
    const chain = new THREE.Mesh(new THREE.CylinderGeometry(m(0.02), m(0.02), len, 6), chrome);
    chain.position.set(s * FW * 0.4, cy + FH / 2 + len / 2, cz);
    room.add(chain);
  });
  return (dt) => reels.forEach((r) => { r.spin.rotation.x -= dt * r.speed; });
}

// ---------- slot machines ----------
// A cabinet of chrome and red with a lit top, a window of three reels
// turning, a lever, and its stool.
function slotMachine(room, x, z, yaw, strip, spinners) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(m(0.68), m(1.35), m(0.6)), new THREE.MeshStandardMaterial({ color: 0x7a0c1e, roughness: 0.3, metalness: 0.3 }));
  body.position.y = FLOOR_Y + m(0.675);
  g.add(body);
  const trim = new THREE.Mesh(new THREE.BoxGeometry(m(0.72), m(0.06), m(0.64)), chrome);
  [m(0.62), m(1.35)].forEach((y) => { const t = trim.clone(); t.position.y = FLOOR_Y + y; g.add(t); });
  const top = new THREE.Mesh(new THREE.BoxGeometry(m(0.66), m(0.32), m(0.4)), neon([0xffd23a, 0x29e0ff, 0xff3ad0][Math.floor(Math.random() * 3)]));
  top.position.set(0, FLOOR_Y + m(1.55), -m(0.05));
  g.add(top);
  // The reel window, three reels behind glass.
  for (let i = -1; i <= 1; i++) {
    const tex = strip.clone();
    tex.needsUpdate = true;
    tex.repeat.set(1, 0.38);
    tex.offset.y = Math.random();
    const reel = new THREE.Mesh(new THREE.PlaneGeometry(m(0.16), m(0.26)), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }));
    reel.position.set(i * m(0.18), FLOOR_Y + m(1.05), m(0.301));
    g.add(reel);
    spinners.push({ tex, speed: 0.6 + Math.random() * 0.8, pause: 0 });
  }
  const bezel = new THREE.Mesh(new THREE.BoxGeometry(m(0.6), m(0.36), m(0.02)), chrome);
  bezel.position.set(0, FLOOR_Y + m(1.05), m(0.295));
  g.add(bezel);
  const lever = new THREE.Mesh(new THREE.CylinderGeometry(m(0.015), m(0.015), m(0.4), 8), chrome);
  lever.position.set(m(0.38), FLOOR_Y + m(1.15), 0);
  g.add(lever);
  const knob = new THREE.Mesh(new THREE.SphereGeometry(m(0.045), 12, 8), new THREE.MeshStandardMaterial({ color: 0xe0102a, roughness: 0.2 }));
  knob.position.set(m(0.38), FLOOR_Y + m(1.36), 0);
  g.add(knob);
  // Its stool.
  const stoolPost = new THREE.Mesh(new THREE.CylinderGeometry(m(0.03), m(0.12), m(0.62), 12), chrome);
  stoolPost.position.set(0, FLOOR_Y + m(0.31), m(0.75));
  g.add(stoolPost);
  const seat = new THREE.Mesh(new THREE.CylinderGeometry(m(0.2), m(0.2), m(0.09), 20), redVinyl);
  seat.position.set(0, FLOOR_Y + m(0.66), m(0.75));
  g.add(seat);
  g.position.set(x, 0, z);
  g.rotation.y = yaw;
  room.add(g);
}

// ---------- booths ----------
// A half-round booth of tufted red vinyl, chrome along its top, round a
// table with a chrome rim on a chrome pedestal.
let tuftTex = null;
function tufted() {
  if (tuftTex) return tuftTex;
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#b3122e';
  ctx.fillRect(0, 0, 256, 256);
  for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) {
    const cx = x * 64 + (y % 2) * 32, cy = y * 64 + 32;
    const g = ctx.createRadialGradient(cx, cy, 2, cx, cy, 34);
    g.addColorStop(0, 'rgba(0,0,0,0.5)'); g.addColorStop(0.2, 'rgba(0,0,0,0.12)'); g.addColorStop(1, 'rgba(255,255,255,0.06)');
    ctx.fillStyle = g; ctx.fillRect(cx - 34, cy - 34, 68, 68);
  }
  tuftTex = new THREE.CanvasTexture(c);
  tuftTex.colorSpace = THREE.SRGBColorSpace;
  tuftTex.wrapS = tuftTex.wrapT = THREE.RepeatWrapping;
  tuftTex.repeat.set(6, 1);
  return tuftTex;
}
function booth(room, x, z, yaw) {
  const g = new THREE.Group();
  const Rin = m(0.62), Rout = m(1.2), arc = Math.PI * 1.15, start = Math.PI / 2 - arc / 2 + Math.PI;
  const ring = (r0, r1) => {
    const s = new THREE.Shape();
    s.absarc(0, 0, r1, start, start + arc, false);
    s.absarc(0, 0, r0, start + arc, start, true);
    return s;
  };
  const seat = new THREE.Mesh(new THREE.ExtrudeGeometry(ring(Rin, Rout), { depth: m(0.45), bevelEnabled: true, bevelThickness: m(0.03), bevelSize: m(0.03), bevelSegments: 3, curveSegments: 32 }), redVinyl);
  seat.rotation.x = Math.PI / 2;
  seat.position.y = FLOOR_Y + m(0.48);
  g.add(seat);
  const back = new THREE.Mesh(new THREE.ExtrudeGeometry(ring(Rout - m(0.04), Rout + m(0.16)), { depth: m(1.05), bevelEnabled: true, bevelThickness: m(0.04), bevelSize: m(0.04), bevelSegments: 4, curveSegments: 32 }), new THREE.MeshStandardMaterial({ map: tufted(), roughness: 0.4 }));
  back.rotation.x = Math.PI / 2;
  back.position.y = FLOOR_Y + m(1.1);
  g.add(back);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(Rout + m(0.06), m(0.03), 8, 48, arc), chrome);
  rim.rotation.x = Math.PI / 2;
  rim.rotation.z = -start;
  rim.position.y = FLOOR_Y + m(1.15);
  g.add(rim);
  const tTop = new THREE.Mesh(new THREE.CylinderGeometry(m(0.5), m(0.5), m(0.04), 40), blackGloss);
  tTop.position.y = FLOOR_Y + m(0.74);
  g.add(tTop);
  const tRim = new THREE.Mesh(new THREE.TorusGeometry(m(0.5), m(0.02), 8, 48), chrome);
  tRim.rotation.x = Math.PI / 2;
  tRim.position.y = FLOOR_Y + m(0.74);
  g.add(tRim);
  const post = new THREE.Mesh(new THREE.CylinderGeometry(m(0.05), m(0.25), m(0.72), 20), chrome);
  post.position.y = FLOOR_Y + m(0.36);
  g.add(post);
  g.position.set(x, 0, z);
  g.rotation.y = yaw;
  room.add(g);
}

// ---------- the bar ----------
// A chrome counter edged in neon, a black glass top, a wall of lit
// bottles on glass shelves behind it, neon BAR above, and stools.
function neonBar(room, flickers) {
  const len = m(5.0);
  const x = -half + m(0.9) + len / 2;
  const z = -half + m(1.8);
  const counter = new THREE.Mesh(new THREE.BoxGeometry(len, m(1.05), m(0.6)), chrome);
  counter.position.set(x, FLOOR_Y + m(0.525), z);
  room.add(counter);
  const top = new THREE.Mesh(new THREE.BoxGeometry(len + m(0.1), m(0.05), m(0.75)), blackGloss);
  top.position.set(x, FLOOR_Y + m(1.08), z - m(0.05));
  room.add(top);
  [[m(0.06), 0xff3ad0], [m(0.98), 0x29e0ff]].forEach(([y, c]) => {
    const strip = new THREE.Mesh(new THREE.BoxGeometry(len, m(0.025), m(0.025)), neon(c));
    strip.position.set(x, FLOOR_Y + y, z + m(0.31));
    room.add(strip);
  });
  // The bottle wall.
  const wall = new THREE.Mesh(new THREE.BoxGeometry(len, m(2.6), m(0.1)), new THREE.MeshStandardMaterial({ color: 0x0e0818, roughness: 0.2, metalness: 0.4 }));
  wall.position.set(x, FLOOR_Y + m(1.3), -half + m(0.12));
  room.add(wall);
  const colors = [0xff3ad0, 0x29e0ff, 0xffd23a, 0x7a5cff, 0x3cff7a];
  const bottleGeo = new THREE.CylinderGeometry(m(0.035), m(0.04), m(0.28), 10);
  [1.0, 1.45, 1.9].forEach((y, row) => {
    const shelf = new THREE.Mesh(new THREE.BoxGeometry(len - m(0.2), m(0.02), m(0.28)), neon(0xe8e0ff));
    shelf.position.set(x, FLOOR_Y + m(y), -half + m(0.3));
    room.add(shelf);
    const n = Math.floor((len - m(0.4)) / m(0.14));
    for (let i = 0; i < n; i++) {
      const b = new THREE.Mesh(bottleGeo, new THREE.MeshStandardMaterial({ color: colors[(i + row) % colors.length], emissive: colors[(i + row) % colors.length], emissiveIntensity: 0.6, roughness: 0.1 }));
      b.position.set(x - len / 2 + m(0.25) + i * m(0.14), FLOOR_Y + m(y) + m(0.15), -half + m(0.3));
      room.add(b);
    }
  });
  neonPiece(room, 'title', m(2.6), m(0.7), x, FLOOR_Y + m(2.35), -half + m(0.2), 0, flickers);
  // Stools before the counter.
  for (let i = 0; i < 5; i++) {
    const sx = x - len / 2 + (i + 0.5) * (len / 5);
    const post = new THREE.Mesh(new THREE.CylinderGeometry(m(0.03), m(0.14), m(0.75), 12), chrome);
    post.position.set(sx, FLOOR_Y + m(0.375), z + m(0.65));
    room.add(post);
    const seat = new THREE.Mesh(new THREE.CylinderGeometry(m(0.21), m(0.21), m(0.1), 20), redVinyl);
    seat.position.set(sx, FLOOR_Y + m(0.8), z + m(0.65));
    room.add(seat);
  }
  room.userData.bar = {
    bartender: { pos: new THREE.Vector3(x - len * 0.1, 0, -half + m(0.85)), yaw: 0 },
    pickup: { pos: new THREE.Vector3(x + len / 2 + m(0.55), 0, z - m(0.1)), look: new THREE.Vector3(x, 0, z) },
  };
}

// ---------- cocktail tables ----------
// A high round table of black glass on a chrome pole, a ring of neon under
// its edge, two chrome stools.
function cocktailTable(room, x, z, color) {
  const top = new THREE.Mesh(new THREE.CylinderGeometry(m(0.38), m(0.38), m(0.04), 32), blackGloss);
  top.position.set(x, FLOOR_Y + m(1.05), z);
  room.add(top);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(m(0.36), m(0.015), 6, 48), neon(color));
  ring.rotation.x = Math.PI / 2;
  ring.position.set(x, FLOOR_Y + m(1.02), z);
  room.add(ring);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(m(0.04), m(0.22), m(1.03), 16), chrome);
  pole.position.set(x, FLOOR_Y + m(0.515), z);
  room.add(pole);
  [-1, 1].forEach((s) => {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(m(0.03), m(0.14), m(0.75), 12), chrome);
    post.position.set(x + s * m(0.6), FLOOR_Y + m(0.375), z);
    room.add(post);
    const seat = new THREE.Mesh(new THREE.CylinderGeometry(m(0.2), m(0.2), m(0.09), 20), redVinyl);
    seat.position.set(x + s * m(0.6), FLOOR_Y + m(0.8), z);
    room.add(seat);
  });
}

// ---------- the room ----------
export const LUCKY_SEVENS = {
  tableGlow: 0xff4fd0,
  half,
  ceilingY: 9.4,
  paintWall: (ctx, d) => paintNeonWall(ctx, d),
  floorPx: 512, floorRepeat: 72 / 4,
  paintFloor: paintVegasCarpet,
  noPanel: true,
  ceiling: 0x0c0618, ceilingGlow: 0.15, cove: 0xff3ad0, diffuser: 0xffffff, accent: 0xff3ad0, washAlpha: 0,
  wall: { style: 'panels', base: VIOLET, wainscot: VIOLET, rail: 0xe6e9ee, skirting: 0x0a0612 },
  floor: { style: 'ornate', base: 0x1a0b2e, pattern: 0xe0328a },
  light: { sky: 0xe6d0ff, ground: 0x4a2a5a, fill: 2.0, key: 0xfff0e0, keyPower: 96, wash: 0xff9ad8, washPower: 40, fog: 0x140a24, fogNear: 60, fogFar: 150 },
  furnish(room, h, CEILING_Y) {
    const flickers = [];
    const chasers = [];
    const spinners = [];
    const updates = [];

    // A neon grid overhead.
    const tube = (color) => neon(color);
    for (let k = -half + m(3); k < half; k += m(3.2)) {
      const a = new THREE.Mesh(new THREE.BoxGeometry(m(0.03), m(0.03), 2 * half), tube(0xff3ad0));
      a.position.set(k, CEILING_Y - m(0.04), 0);
      room.add(a);
      const b = new THREE.Mesh(new THREE.BoxGeometry(2 * half, m(0.03), m(0.03)), tube(0x29e0ff));
      b.position.set(0, CEILING_Y - m(0.08), k);
      room.add(b);
    }

    // The sign, with bulbs chasing round it, LUCKY SEVENS in neon over it.
    brandSign(room, half, { rgb: '255,214,120', plate: '#14081e' });
    marquee(room, rectPoints(0, FLOOR_Y + m(2.75), -half + 0.1, m(2.4), m(1.5), m(0.14)), chasers);
    neonPiece(room, 'title', m(5.0), m(1.3), 0, FLOOR_Y + m(4.05), -half + 0.08, 0, flickers);
    // Neon down the side walls and across the front.
    const kinds = ['sevens', 'cherries', 'dice', 'horseshoe', 'jackpot', 'suits'];
    [-1, 1].forEach((side) => {
      [-m(9), -m(3), m(3), m(9)].forEach((z, i) => neonPiece(room, kinds[(i + (side > 0 ? 2 : 0)) % kinds.length], m(2.4), m(1.5), side * (half - 0.08), FLOOR_Y + m(2.9), z, -side * Math.PI / 2, flickers));
    });
    [-m(6), m(6)].forEach((x, i) => neonPiece(room, i ? 'jackpot' : 'sevens', m(3.2), m(1.4), x, FLOOR_Y + m(2.9), half - 0.08, Math.PI, flickers));
    brandSign(room, half, { wall: 'front', width: m(1.8), rgb: '255,214,120', plate: '#14081e' });

    // The great slot machine over the table.
    updates.push(giantSlot(room, CEILING_Y, chasers));
    // A ring of light round the table, on a rug of the carpet's own violet.
    room.add(roundRug(m(4.4), { base: '#120822', gold: '#e0328a', bright: '#29e0ff' }));
    room.add(lightRing(m(4.9), 0xff4fd0));

    // Banks of slot machines down both sides, facing in.
    const strip = reelStrip();
    [-1, 1].forEach((side) => {
      for (let i = 0; i < 9; i++) {
        const z = -m(11) + i * m(1.05);
        slotMachine(room, side * (half - m(0.7)), z, side < 0 ? Math.PI / 2 : -Math.PI / 2, strip, spinners);
      }
    });
    // Islands of machines back to back out on the floor either side of the
    // table, and high tables between them.
    [-1, 1].forEach((side) => {
      for (let i = 0; i < 6; i++) {
        const z = -m(4.6) + i * m(1.05);
        slotMachine(room, side * m(7.2) - m(0.42), z, -Math.PI / 2, strip, spinners);
        slotMachine(room, side * m(7.2) + m(0.42), z, Math.PI / 2, strip, spinners);
      }
      [[m(9.8), -m(6.4)], [m(9.8), m(3.2)], [m(4.8), m(7.8)]].forEach(([x, z], i) => cocktailTable(room, side * x, z, [0xff3ad0, 0x29e0ff, 0xffd23a][i]));
    });
    // Booths in the front half, in a row each side.
    [-1, 1].forEach((side) => {
      [m(3.2), m(6.6), m(10)].forEach((z) => booth(room, side * (half - m(2.2)), z, side < 0 ? -Math.PI / 2 : Math.PI / 2));
    });
    [-m(4.5), m(4.5)].forEach((x) => booth(room, x, half - m(2.3), Math.PI));
    // The bar.
    neonBar(room, flickers);

    walkway(room);
    staffPosts(room, [[10, -9.6], [-10.2, 10.2], [10.2, 10.2]]);

    const glow = new THREE.Color();
    room.userData.update = (dt, now) => {
      updates.forEach((u) => u(dt, now));
      // Reels in the machines, each now and then pausing on a line.
      spinners.forEach((sp) => {
        if (sp.pause > now) return;
        sp.tex.offset.y = (sp.tex.offset.y + dt * sp.speed) % 1;
        if (Math.random() < 0.003) sp.pause = now + 1500 + Math.random() * 2500;
      });
      // Bulbs chasing: every third lit, the pattern stepping on.
      const step = Math.floor(now / 140);
      chasers.forEach((c) => {
        for (let i = 0; i < c.n; i++) {
          c.mesh.setColorAt(i, glow.setHex((i + step) % 3 === 0 ? 0xfff2c0 : 0x7a5a20));
        }
        c.mesh.instanceColor.needsUpdate = true;
      });
      // Neon flickering now and then, as old neon does.
      flickers.forEach((f) => {
        if (now > f.next) { f.until = now + 120 + Math.random() * 380; f.next = now + 6000 + Math.random() * 16000; }
        f.mat.opacity = now < f.until ? (Math.random() < 0.5 ? 0.25 : 1) : 1;
      });
    };
  },
};
