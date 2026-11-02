import * as THREE from 'three';
import { FLOOR_Y, m } from './scale.js';
import { walkway, brandSign, staffPosts } from './layout.js';
import { drawCasinoCrest } from './crest.js';

// The Wild Card: Le Grand Cirque — a big top dressed for a night of play,
// the joker its patron. Its furniture is all its own:
//
//   - overhead, the tent: striped silk rising in four panels to a peak,
//     bunting strung from it to the walls;
//   - the table in a circus ring, a curb of red and gold round it with an
//     opening at each corner, sawdust gold underfoot inside it;
//   - over the table, a carousel turning — a striped canopy, bulbs round
//     its rim, giant joker cards hung from it;
//   - a carousel bar: a round counter under its own striped canopy, the
//     bartender inside the ring of it, drum stools round it;
//   - round tufted settees of red velvet, each with a column at its heart
//     crowned in gold; circus drums for stools and tables;
//   - giant playing cards on stands, gold balloons up in the tent, walls of
//     red velvet drapery, a harlequin floor of plum, gold and black.

const half = 36;
const WALL_TOP = FLOOR_Y + m(4.2);
const TENT_RISE = m(5.6);
const RING_R = m(6.2);

const gold = new THREE.MeshStandardMaterial({ color: 0xd4af5a, roughness: 0.25, metalness: 0.95, emissive: 0x2a1e08, emissiveIntensity: 0.4 });
const velvet = new THREE.MeshStandardMaterial({ color: 0x8a0f22, roughness: 0.85, metalness: 0 });

// Stripes on a canvas: `n` bands of the two colours, a gold edge along the
// bottom (v = 0 is the foot of the canvas).
function stripes(n, a, b, w = 2048, h = 256, edge = true) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  for (let i = 0; i < n; i++) {
    ctx.fillStyle = i % 2 ? b : a;
    ctx.fillRect((i / n) * w, 0, w / n + 1, h);
  }
  // Silk sheen down each band.
  for (let i = 0; i < n; i++) {
    const g = ctx.createLinearGradient((i / n) * w, 0, ((i + 1) / n) * w, 0);
    g.addColorStop(0, 'rgba(0,0,0,0.12)'); g.addColorStop(0.5, 'rgba(255,255,255,0.1)'); g.addColorStop(1, 'rgba(0,0,0,0.12)');
    ctx.fillStyle = g;
    ctx.fillRect((i / n) * w, 0, w / n, h);
  }
  if (edge) { ctx.fillStyle = '#d4af5a'; ctx.fillRect(0, h - h * 0.06, w, h * 0.06); }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

// ---------- the floor and walls ----------
function paintHarlequin(ctx, S) {
  // Two diamonds across the tile, two down: plum and black in turn, on
  // lines of gold.
  ctx.fillStyle = '#14101c';
  ctx.fillRect(0, 0, S, S);
  const d = S / 2;
  for (let j = -1; j < 3; j++) {
    for (let i = -1; i < 3; i++) {
      const cx = i * d + d / 2, cy = j * d + d / 2;
      ctx.fillStyle = (i + j) % 2 === 0 ? '#4a1866' : '#1c1426';
      ctx.beginPath();
      ctx.moveTo(cx, cy - d / 2); ctx.lineTo(cx + d / 2, cy); ctx.lineTo(cx, cy + d / 2); ctx.lineTo(cx - d / 2, cy);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = (i + j) % 2 === 0 ? '#1c1426' : '#4a1866';
      ctx.beginPath();
      ctx.moveTo(cx + d / 2, cy); ctx.lineTo(cx + d, cy - d / 2); ctx.lineTo(cx + d, cy + d / 2);
      ctx.closePath(); ctx.fill();
    }
  }
  ctx.strokeStyle = 'rgba(212,175,90,0.85)';
  ctx.lineWidth = 4;
  for (let k = -S; k <= 2 * S; k += d) {
    ctx.beginPath(); ctx.moveTo(k, 0); ctx.lineTo(k + S, S); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(k, S); ctx.lineTo(k + S, 0); ctx.stroke();
  }
  const img = ctx.getImageData(0, 0, S, S);
  for (let i = 0; i < img.data.length; i += 4) { const nn = (Math.random() - 0.5) * 8; img.data[i] += nn; img.data[i + 1] += nn; img.data[i + 2] += nn; }
  ctx.putImageData(img, 0, 0);
}
// Red velvet hung in deep folds, a gold fringe along its head, framed
// posters of the house's own circus between the folds.
function paintDrapery(ctx, d, which) {
  const { texW: W, texH: H, px, texY } = d;
  const u = px * m(1);
  const fold = u * 0.45;
  for (let x = 0; x < W; x += fold) {
    const g = ctx.createLinearGradient(x, 0, x + fold, 0);
    g.addColorStop(0, '#4a0612'); g.addColorStop(0.5, '#a3162e'); g.addColorStop(1, '#4a0612');
    ctx.fillStyle = g;
    ctx.fillRect(x, 0, fold + 1, H);
  }
  // The fringe at the top.
  ctx.fillStyle = '#d4af5a';
  ctx.fillRect(0, 0, W, u * 0.12);
  for (let x = 0; x < W; x += u * 0.05) ctx.fillRect(x, u * 0.12, u * 0.018, u * 0.14 + (x % 3) * 2);
  // Posters, except behind the sign.
  const poster = (cx, title) => {
    const pw = u * 1.5, ph = u * 2.1, top = texY(FLOOR_Y + m(3.2));
    ctx.fillStyle = '#d4af5a';
    ctx.fillRect(cx - pw / 2 - 10, top - 10, pw + 20, ph + 20);
    const g = ctx.createLinearGradient(0, top, 0, top + ph);
    g.addColorStop(0, '#f6e7c4'); g.addColorStop(1, '#e4c690');
    ctx.fillStyle = g;
    ctx.fillRect(cx - pw / 2, top, pw, ph);
    ctx.fillStyle = '#8a0f22';
    ctx.textAlign = 'center';
    ctx.font = `900 ${u * 0.2}px 'Cinzel', Georgia, serif`;
    ctx.fillText('LE GRAND', cx, top + ph * 0.14);
    ctx.font = `900 ${u * 0.3}px 'Cinzel', Georgia, serif`;
    ctx.fillText('CIRQUE', cx, top + ph * 0.27);
    ctx.fillStyle = '#3c1250';
    ctx.font = `700 ${u * 0.5}px Georgia, 'Segoe UI Symbol', serif`;
    ctx.fillText(title, cx, top + ph * 0.6);
    drawCasinoCrest(ctx, { x: cx, y: top + ph * 0.84, width: pw * 0.55, alpha: 1, rgb: '138,15,34' });
  };
  ['♠', '♥', '♦', '♣', '★'].forEach((sym, i) => {
    const cx = ((i + 0.5) / 5) * W;
    if (which === 'back' && Math.abs(cx - W / 2) < u * 2.5) return;
    poster(cx, sym);
  });
}

// ---------- the tent ----------
function bigTop(room) {
  // Four panels from the walls' head to a peak over the table; stripes
  // running up each to the top.
  const R = half * Math.SQRT2;
  const tent = new THREE.Mesh(new THREE.ConeGeometry(R, TENT_RISE, 4, 1, true),
    new THREE.MeshLambertMaterial({ map: stripes(48, '#b3122e', '#f3e6cf', 2048, 256, false), side: THREE.DoubleSide, emissive: 0xffffff, emissiveMap: null, emissiveIntensity: 0 }));
  tent.material.emissive.setHex(0x3a1a10);
  tent.rotation.y = Math.PI / 4;
  tent.position.set(0, WALL_TOP + TENT_RISE / 2, 0);
  room.add(tent);
  // A gold cap at the peak, and a valance of scallops round the walls' head.
  const cap = new THREE.Mesh(new THREE.ConeGeometry(m(0.5), m(0.9), 16), gold);
  cap.position.set(0, WALL_TOP + TENT_RISE - m(0.1), 0);
  room.add(cap);
  const scallop = new THREE.CircleGeometry(m(0.3), 16, Math.PI, Math.PI);
  const scMat = new THREE.MeshLambertMaterial({ color: 0xd4af5a, side: THREE.DoubleSide, emissive: 0x3a2808 });
  const n = Math.floor((2 * half) / m(0.6));
  const sc = new THREE.InstancedMesh(scallop, scMat, n * 4);
  const mtx = new THREE.Matrix4();
  let k = 0;
  [[0, -1], [0, 1], [-1, 0], [1, 0]].forEach(([sx, sz]) => {
    for (let i = 0; i < n; i++) {
      const t = -half + (i + 0.5) * ((2 * half) / n);
      const x = sx ? sx * (half - 0.05) : t, z = sz ? sz * (half - 0.05) : t;
      mtx.makeRotationY(sx ? -sx * Math.PI / 2 : sz > 0 ? Math.PI : 0);
      mtx.setPosition(x, WALL_TOP, z);
      sc.setMatrixAt(k++, mtx);
    }
  });
  room.add(sc);
}

// Bunting: strings of pennants from high under the tent to the walls.
function bunting(room) {
  const cols = [0xb3122e, 0xd4af5a, 0x3c1250, 0xf3e6cf];
  const flag = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-m(0.13), 0, 0), new THREE.Vector3(m(0.13), 0, 0), new THREE.Vector3(0, -m(0.32), 0)]);
  flag.computeVertexNormals();
  const per = 26, strings = 12;
  const mesh = new THREE.InstancedMesh(flag, new THREE.MeshLambertMaterial({ color: 0xffffff, side: THREE.DoubleSide }), per * strings);
  const wire = [];
  const mtx = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  let k = 0;
  for (let s = 0; s < strings; s++) {
    const a = (s / strings) * Math.PI * 2;
    const from = new THREE.Vector3(Math.sin(a) * m(1.0), WALL_TOP + TENT_RISE * 0.72, -0.4 + Math.cos(a) * m(1.0));
    const reach = half / Math.max(Math.abs(Math.sin(a)), Math.abs(Math.cos(a)));
    const to = new THREE.Vector3(Math.sin(a) * reach * 0.98, WALL_TOP - m(0.1), Math.cos(a) * reach * 0.98);
    let prev = from;
    for (let i = 1; i <= per; i++) {
      const t = i / (per + 1);
      const p = from.clone().lerp(to, t);
      p.y -= Math.sin(t * Math.PI) * m(0.9);
      wire.push(prev, p);
      prev = p;
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.atan2(to.x - from.x, to.z - from.z) + Math.PI / 2);
      mtx.compose(p, q, new THREE.Vector3(1, 1, 1));
      mesh.setMatrixAt(k, mtx);
      mesh.setColorAt(k, new THREE.Color(cols[(i + s) % cols.length]));
      k++;
    }
    wire.push(prev, to);
  }
  room.add(mesh);
  room.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(wire), new THREE.LineBasicMaterial({ color: 0x3a2a1a })));
}

// ---------- the ring ----------
// A curb of red and gold round the table, an opening at each corner, and
// gold sawdust inside it with a star at its heart.
function circusRing(room) {
  const segs = 4, gap = 0.2;
  for (let i = 0; i < segs; i++) {
    const a0 = (i / segs) * Math.PI * 2 + Math.PI / 4 + gap / 2;
    const a1 = a0 + (Math.PI * 2) / segs - gap;
    const shape = new THREE.Shape();
    shape.absarc(0, 0, RING_R + m(0.3), a0, a1, false);
    shape.absarc(0, 0, RING_R, a1, a0, true);
    const curb = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: m(0.32), bevelEnabled: true, bevelThickness: m(0.03), bevelSize: m(0.03), bevelSegments: 2, curveSegments: 32 }), velvet);
    curb.rotation.x = Math.PI / 2;
    curb.position.set(0, FLOOR_Y + m(0.35), -0.4);
    room.add(curb);
    const capShape = new THREE.Shape();
    capShape.absarc(0, 0, RING_R + m(0.34), a0, a1, false);
    capShape.absarc(0, 0, RING_R - m(0.04), a1, a0, true);
    const capMesh = new THREE.Mesh(new THREE.ExtrudeGeometry(capShape, { depth: m(0.04), bevelEnabled: false, curveSegments: 32 }), gold);
    capMesh.rotation.x = Math.PI / 2;
    capMesh.position.set(0, FLOOR_Y + m(0.39), -0.4);
    room.add(capMesh);
  }
  // Sawdust gold inside it, a star at the centre.
  const S = 1024;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  g.addColorStop(0, '#d9b874'); g.addColorStop(1, '#b8904a');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, S, S);
  for (let k = 0; k < 9000; k++) { ctx.fillStyle = `rgba(${90 + Math.random() * 80},${60 + Math.random() * 50},20,0.25)`; ctx.fillRect(Math.random() * S, Math.random() * S, 2, 2); }
  ctx.strokeStyle = 'rgba(138,15,34,0.7)';
  ctx.lineWidth = 10;
  ctx.beginPath(); ctx.arc(S / 2, S / 2, S * 0.47, 0, Math.PI * 2); ctx.stroke();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  const floor = new THREE.Mesh(new THREE.CircleGeometry(RING_R, 96), new THREE.MeshLambertMaterial({ map: t }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, FLOOR_Y + 0.006, -0.4);
  floor.receiveShadow = true;
  room.add(floor);
}

// ---------- the joker ----------
// A playing card a metre and more tall: the joker on its face, the house
// back on the other.
function jokerFace() {
  const W = 512, H = 768;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#fbf6ea';
  ctx.beginPath(); ctx.roundRect(0, 0, W, H, 36); ctx.fill();
  ctx.strokeStyle = '#d4af5a'; ctx.lineWidth = 12;
  ctx.beginPath(); ctx.roundRect(24, 24, W - 48, H - 48, 24); ctx.stroke();
  ctx.fillStyle = '#8a0f22';
  ctx.textAlign = 'center';
  ctx.font = "900 64px 'Cinzel', Georgia, serif";
  ctx.fillText('JOKER', W / 2, 110);
  // The jester's cap: three points, a bell on each.
  const cx = W / 2, cy = 400;
  [[-150, '#8a0f22'], [0, '#3c1250'], [150, '#d4af5a']].forEach(([dx, col]) => {
    ctx.fillStyle = col;
    ctx.beginPath(); ctx.moveTo(cx - 110 + dx * 0.4, cy); ctx.quadraticCurveTo(cx + dx * 0.9, cy - 220, cx + dx * 1.05, cy - 150); ctx.lineTo(cx + 110 + dx * 0.4, cy); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#d4af5a';
    ctx.beginPath(); ctx.arc(cx + dx * 1.05, cy - 150, 20, 0, Math.PI * 2); ctx.fill();
  });
  // The face: a mask, a grin.
  ctx.fillStyle = '#f3e6cf';
  ctx.beginPath(); ctx.ellipse(cx, cy + 90, 120, 130, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#14101c'; ctx.lineWidth = 8;
  ctx.beginPath(); ctx.arc(cx, cy + 110, 60, 0.2 * Math.PI, 0.8 * Math.PI); ctx.stroke();
  ctx.fillStyle = '#3c1250';
  [[-45, 60], [45, 60]].forEach(([dx, dy]) => { ctx.beginPath(); ctx.moveTo(cx + dx - 30, cy + dy); ctx.lineTo(cx + dx, cy + dy - 22); ctx.lineTo(cx + dx + 30, cy + dy); ctx.lineTo(cx + dx, cy + dy + 22); ctx.closePath(); ctx.fill(); });
  ctx.fillStyle = '#8a0f22';
  ctx.beginPath(); ctx.arc(cx, cy + 92, 14, 0, Math.PI * 2); ctx.fill();
  ctx.font = "900 54px 'Cinzel', Georgia, serif";
  ctx.fillText('★  NVGR  ★', W / 2, H - 70);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}
function cardBack() {
  const W = 256, H = 384;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#8a0f22';
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = '#d4af5a'; ctx.lineWidth = 6;
  ctx.strokeRect(14, 14, W - 28, H - 28);
  for (let k = -H; k < W + H; k += 22) { ctx.globalAlpha = 0.3; ctx.beginPath(); ctx.moveTo(k, 0); ctx.lineTo(k + H, H); ctx.stroke(); ctx.beginPath(); ctx.moveTo(k + H, 0); ctx.lineTo(k, H); ctx.stroke(); }
  ctx.globalAlpha = 1;
  drawCasinoCrest(ctx, { x: W / 2, y: H / 2, width: W * 0.6, alpha: 1, rgb: '232,198,122' });
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
let faceTex = null, backTex = null;
function giantCard(w) {
  faceTex = faceTex || jokerFace();
  backTex = backTex || cardBack();
  const h = w * 1.5;
  const edge = new THREE.MeshLambertMaterial({ color: 0xf3e6cf });
  const card = new THREE.Mesh(new THREE.BoxGeometry(w, h, m(0.02)), [edge, edge, edge, edge,
    new THREE.MeshLambertMaterial({ map: faceTex, emissive: 0xffffff, emissiveMap: faceTex, emissiveIntensity: 0.2 }),
    new THREE.MeshLambertMaterial({ map: backTex })]);
  return card;
}

// ---------- the carousel ----------
// A canopy turning over the table: a striped crown, bulbs round its rim,
// jokers hung from it, gold stars between.
function carousel(room) {
  const g = new THREE.Group();
  const y = FLOOR_Y + m(5.0);
  g.position.set(0, y, -0.4);
  room.add(g);
  const R = m(2.2);
  const canopy = new THREE.Mesh(new THREE.ConeGeometry(R, m(1.0), 32, 1, true), new THREE.MeshLambertMaterial({ map: stripes(16, '#b3122e', '#f3e6cf', 1024, 128), side: THREE.DoubleSide, emissive: 0x2a1408 }));
  canopy.position.y = m(0.5);
  g.add(canopy);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(R, m(0.06), 8, 64), gold);
  rim.rotation.x = Math.PI / 2;
  g.add(rim);
  const bulbs = new THREE.InstancedMesh(new THREE.SphereGeometry(m(0.04), 8, 6), new THREE.MeshBasicMaterial({ color: 0xffe2a0, toneMapped: false }), 48);
  const mtx = new THREE.Matrix4();
  for (let i = 0; i < 48; i++) { const a = (i / 48) * Math.PI * 2; mtx.makeTranslation(Math.cos(a) * R, -m(0.06), Math.sin(a) * R); bulbs.setMatrixAt(i, mtx); }
  g.add(bulbs);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(m(0.04), m(0.04), WALL_TOP + TENT_RISE - y, 8), gold);
  pole.position.y = (WALL_TOP + TENT_RISE - y) / 2;
  g.add(pole);
  // Jokers on ropes from the rim, turning with it.
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const card = giantCard(m(0.7));
    card.position.set(Math.cos(a) * R * 0.92, -m(0.85), Math.sin(a) * R * 0.92);
    card.rotation.y = -a + Math.PI / 2;
    g.add(card);
    const rope = new THREE.Mesh(new THREE.CylinderGeometry(m(0.008), m(0.008), m(0.3), 4), gold);
    rope.position.set(Math.cos(a) * R * 0.92, -m(0.15), Math.sin(a) * R * 0.92);
    g.add(rope);
  }
  return (dt) => { g.rotation.y += dt * 0.12; };
}

// ---------- the bar ----------
// A round counter under a striped canopy on gold poles, the bartender
// inside it, bottles round the central column, drum stools round it.
function carouselBar(room) {
  const x = -m(9.6), z = -m(9.6);
  const Rout = m(1.7), Rin = m(1.05);
  const ring = new THREE.Shape();
  ring.absarc(0, 0, Rout, 0, Math.PI * 2, false);
  const hole = new THREE.Path();
  hole.absarc(0, 0, Rin, 0, Math.PI * 2, true);
  ring.holes.push(hole);
  const counter = new THREE.Mesh(new THREE.ExtrudeGeometry(ring, { depth: m(1.05), bevelEnabled: false, curveSegments: 48 }), new THREE.MeshLambertMaterial({ map: stripes(24, '#8a0f22', '#f3e6cf', 1024, 128) }));
  counter.rotation.x = Math.PI / 2;
  counter.position.set(x, FLOOR_Y + m(1.05), z);
  room.add(counter);
  const top = new THREE.Mesh(new THREE.ExtrudeGeometry(ring, { depth: m(0.05), bevelEnabled: false, curveSegments: 48 }), gold);
  top.rotation.x = Math.PI / 2;
  top.position.set(x, FLOOR_Y + m(1.1), z);
  room.add(top);
  // The central column with shelves of bottles round it.
  const col = new THREE.Mesh(new THREE.CylinderGeometry(m(0.22), m(0.22), m(3.1), 16), gold);
  col.position.set(x, FLOOR_Y + m(1.55), z);
  room.add(col);
  const bottleColors = [0x3a6a2a, 0x7a2a12, 0xe8d8a0, 0x4a1a30, 0xc9a24f];
  [1.35, 1.75].forEach((y) => {
    const shelf = new THREE.Mesh(new THREE.CylinderGeometry(m(0.55), m(0.55), m(0.03), 32), gold);
    shelf.position.set(x, FLOOR_Y + m(y), z);
    room.add(shelf);
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const b = new THREE.Mesh(new THREE.CylinderGeometry(m(0.035), m(0.04), m(0.28), 10), new THREE.MeshStandardMaterial({ color: bottleColors[i % 5], roughness: 0.15, emissive: bottleColors[i % 5], emissiveIntensity: 0.3 }));
      b.position.set(x + Math.cos(a) * m(0.42), FLOOR_Y + m(y) + m(0.155), z + Math.sin(a) * m(0.42));
      room.add(b);
    }
  });
  // Its canopy, on four gold poles.
  const canopy = new THREE.Mesh(new THREE.ConeGeometry(Rout + m(0.4), m(1.1), 32, 1, true), new THREE.MeshLambertMaterial({ map: stripes(16, '#3c1250', '#d4af5a', 1024, 128), side: THREE.DoubleSide, emissive: 0x1a0a20 }));
  canopy.position.set(x, FLOOR_Y + m(3.45), z);
  room.add(canopy);
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const p = new THREE.Mesh(new THREE.CylinderGeometry(m(0.04), m(0.04), m(2.9), 8), gold);
    p.position.set(x + Math.cos(a) * (Rout + m(0.25)), FLOOR_Y + m(1.45), z + Math.sin(a) * (Rout + m(0.25)));
    room.add(p);
  }
  // Drum stools round it, on the room's side.
  for (let i = 0; i < 7; i++) {
    const a = Math.PI * 0.05 + (i / 6) * Math.PI * 0.9;
    drumStool(room, x + Math.cos(a) * (Rout + m(0.45)), z + Math.sin(a) * (Rout + m(0.45)), m(0.2), m(0.72));
  }
  room.userData.bar = {
    bartender: { pos: new THREE.Vector3(x - m(0.6), 0, z - m(0.4)), yaw: Math.PI * 0.25 },
    pickup: { pos: new THREE.Vector3(x + Rout + m(0.75), 0, z + m(0.2)), look: new THREE.Vector3(x, 0, z) },
  };
}

// ---------- drums ----------
// A circus drum: red and cream stripes, gold rims, a star on its side; a
// stool, or (wider) a low table.
let drumTex = null;
function drumStool(room, x, z, r, h) {
  drumTex = drumTex || stripes(16, '#b3122e', '#f3e6cf', 1024, 256, false);
  const side = new THREE.MeshLambertMaterial({ map: drumTex });
  const top = new THREE.MeshLambertMaterial({ color: 0x3c1250 });
  const d = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 24), [side, top, top]);
  d.position.set(x, FLOOR_Y + h / 2, z);
  room.add(d);
  [h, 0.001].forEach((y) => {
    const rim = new THREE.Mesh(new THREE.TorusGeometry(r, m(0.025), 6, 32), gold);
    rim.rotation.x = Math.PI / 2;
    rim.position.set(x, FLOOR_Y + y, z);
    room.add(rim);
  });
}

// ---------- settees ----------
// A round settee in tufted red velvet, a column rising from its heart
// crowned with a gold finial.
function borne(room, x, z) {
  const seat = new THREE.Mesh(new THREE.CylinderGeometry(m(1.1), m(1.05), m(0.45), 32), velvet);
  seat.position.set(x, FLOOR_Y + m(0.225), z);
  room.add(seat);
  const cushion = new THREE.Mesh(new THREE.TorusGeometry(m(0.82), m(0.18), 10, 32), velvet);
  cushion.rotation.x = Math.PI / 2;
  cushion.position.set(x, FLOOR_Y + m(0.5), z);
  room.add(cushion);
  const back = new THREE.Mesh(new THREE.CylinderGeometry(m(0.2), m(0.42), m(1.1), 24), velvet);
  back.position.set(x, FLOOR_Y + m(1.0), z);
  room.add(back);
  const finial = new THREE.Mesh(new THREE.SphereGeometry(m(0.16), 16, 12), gold);
  finial.position.set(x, FLOOR_Y + m(1.65), z);
  room.add(finial);
  const band = new THREE.Mesh(new THREE.TorusGeometry(m(1.08), m(0.025), 6, 48), gold);
  band.rotation.x = Math.PI / 2;
  band.position.set(x, FLOOR_Y + m(0.04), z);
  room.add(band);
}

// Giant playing cards standing on gold easels, fanned in threes.
function cardFan(room, x, z, yaw) {
  const g = new THREE.Group();
  [-0.3, 0, 0.3].forEach((a, i) => {
    const card = giantCard(m(0.9));
    card.position.set((i - 1) * m(0.35), FLOOR_Y + m(1.15) + (i === 1 ? m(0.1) : 0), -i * 0.01);
    card.rotation.z = -a;
    g.add(card);
  });
  const stand = new THREE.Mesh(new THREE.BoxGeometry(m(1.4), m(0.3), m(0.4)), gold);
  stand.position.set(0, FLOOR_Y + m(0.15), 0);
  g.add(stand);
  g.position.set(x, 0, z);
  g.rotation.y = yaw;
  room.add(g);
}

// Balloons up in the tent, gold and red, drifting.
function balloons(room) {
  const geo = new THREE.SphereGeometry(m(0.28), 16, 12);
  const list = [];
  const cols = [0xd4af5a, 0xb3122e, 0xf3e6cf];
  for (let i = 0; i < 36; i++) {
    const mat = new THREE.MeshStandardMaterial({ color: cols[i % 3], roughness: 0.25, metalness: cols[i % 3] === 0xd4af5a ? 0.7 : 0.1 });
    const b = new THREE.Mesh(geo, mat);
    b.scale.y = 1.15;
    const a = Math.random() * Math.PI * 2, r = m(4) + Math.random() * (half * 0.75);
    b.position.set(Math.cos(a) * r, WALL_TOP + m(0.6) + Math.random() * m(2.4), Math.sin(a) * r);
    room.add(b);
    list.push({ b, y: b.position.y, ph: Math.random() * 6 });
  }
  return (dt, now) => list.forEach((l) => { l.b.position.y = l.y + Math.sin(now / 1500 + l.ph) * m(0.12); });
}

// ---------- the room ----------
export const WILD_CARD = {
  tableGlow: 0xffb04a,
  half,
  ceilingY: WALL_TOP,
  ceiling: null, noPanel: true, noCove: true,
  paintWall: paintDrapery,
  floorPx: 512, floorRepeat: 72 / 6,
  paintFloor: paintHarlequin,
  accent: 0xd4af5a, cove: 0xd4af5a, diffuser: 0xfff0d2, washAlpha: 0,
  wall: { style: 'panels', base: 0x8a0f22, wainscot: 0x4a0612, rail: 0xd4af5a, skirting: 0x14101c },
  floor: { style: 'ornate', base: 0x3c1250, pattern: 0xc9a24f },
  light: { sky: 0xffe6cc, ground: 0x7a3a2a, fill: 2.1, key: 0xfff0dc, keyPower: 92, wash: 0xffd0a0, washPower: 44, fog: 0x2a0e18, fogNear: 60, fogFar: 160 },
  furnish(room, h, CEILING_Y) {
    const updates = [];
    bigTop(room);
    bunting(room);
    circusRing(room);
    updates.push(carousel(room));
    updates.push(balloons(room));
    brandSign(room, half, { rgb: '236,200,124', plate: '#3c1250' });
    brandSign(room, half, { wall: 'front', width: m(1.8), rgb: '236,200,124', plate: '#3c1250' });
    carouselBar(room);
    // Settees and drum tables out on the floor beyond the ring.
    [[m(-9.5), m(3.5)], [m(9.5), m(3.5)], [m(9.5), -m(8.5)]].forEach(([x, z]) => borne(room, x, z));
    [[m(-6.5), m(10)], [m(6.5), m(10)], [m(-12.5), -m(1.5)], [m(12.5), -m(1.5)]].forEach(([x, z]) => {
      drumStool(room, x, z, m(0.55), m(0.55));
      [0, 1, 2, 3].forEach((k) => { const a = (k / 4) * Math.PI * 2 + 0.4; drumStool(room, x + Math.cos(a) * m(0.95), z + Math.sin(a) * m(0.95), m(0.2), m(0.45)); });
    });
    // Cards fanned on stands along the walls.
    [[-(half - m(0.8)), m(6), Math.PI / 2], [half - m(0.8), m(6), -Math.PI / 2], [-(half - m(0.8)), -m(6), Math.PI / 2], [half - m(0.8), -m(6), -Math.PI / 2], [m(5), -(half - m(0.8)), 0], [-m(5), half - m(0.8), Math.PI]].forEach(([x, z, yaw]) => cardFan(room, x, z, yaw));

    walkway(room);
    staffPosts(room, [[10, -9.6], [-10.2, 10.2], [10.2, 10.2]]);
    room.userData.update = (dt, now) => updates.forEach((u) => u(dt, now));
  },
};
