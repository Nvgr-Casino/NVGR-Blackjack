import * as THREE from 'three';
import { FLOOR_Y, m } from './scale.js';
import { walkway, staffPosts } from './layout.js';
import { createBrandSign } from './luxury.js';
import { cameraDome, GLSL_NOISE } from './decor.js';

// The Golden Ace: Atlantis — a hall of white marble and gold on the floor
// of the sea, open to the water through a colonnade and a vault of glass.
// Its furniture all its own:
//
//   - outside, the deep: light falling in shafts from the surface far
//     above, motes drifting, the sea floor, schools of fish circling the
//     hall, a manta ray gliding over it;
//   - over the table a pearl the size of a man in an open golden scallop
//     shell, glowing, turning slowly;
//   - columns of water at the corners, fish and bubbles in them;
//     jellyfish drifting, lit from within;
//   - chairs with fanned scallop backs, coral in gold on plinths, tables
//     on stems of golden coral, a bar whose front is an aquarium;
//   - white marble underfoot, a border of waves in gold, a golden compass
//     rose round the table.

const half = 36;
const COL_H = m(4.4);
const VAULT_RISE = m(3.2);

const marble = new THREE.MeshStandardMaterial({ color: 0xf2efe8, roughness: 0.25 });
const gold = new THREE.MeshStandardMaterial({ color: 0xd8b25e, roughness: 0.2, metalness: 1.0, emissive: 0x2a1e08, emissiveIntensity: 0.4 });
const pearlWhite = new THREE.MeshStandardMaterial({ color: 0xf6f0ea, roughness: 0.2, metalness: 0.25 });

// ---------- the deep ----------
const DEEP = GLSL_NOISE + `
uniform float uTime;
varying vec3 vDir;
void main() {
  vec3 d = normalize(vDir);
  float h = d.y;
  float az = atan(d.x, -d.z);
  vec3 col = mix(vec3(0.0, 0.07, 0.14), vec3(0.04, 0.32, 0.45), smoothstep(-0.2, 0.9, h));
  // The surface far above, rippling with light.
  float surf = smoothstep(0.55, 1.0, h);
  float rip = fbm(d.xz / max(h, 0.2) * 3.0 + vec2(uTime * 0.05, uTime * 0.03));
  col += vec3(0.4, 0.75, 0.8) * surf * (0.3 + rip * 0.7);
  // Shafts of light falling from it.
  float shafts = pow(max(0.0, sin(az * 9.0 + sin(uTime * 0.2 + az * 3.0) * 0.6)), 6.0) * smoothstep(-0.1, 0.6, h) * (1.0 - surf);
  col += vec3(0.25, 0.55, 0.6) * shafts * 0.45;
  // Motes drifting in the water.
  vec3 sd = d * 90.0 + vec3(0.0, uTime * 0.6, 0.0);
  float s = hash3(floor(sd));
  if (s > 0.985) col += vec3(0.5, 0.8, 0.8) * smoothstep(0.2, 0.0, length(fract(sd) - 0.5)) * 0.5;
  // Rocks and weed on the far sea floor, dim.
  float ridge = -0.02 + (fbm(vec2(az * 3.0, 1.0)) - 0.5) * 0.12;
  if (h < ridge) col = mix(col, vec3(0.02, 0.12, 0.16), 0.8);
  // The sea floor itself: sand, caustics playing on it.
  if (h < -0.03) {
    vec2 p = d.xz / max(-h, 0.03);
    float c = abs(sin(p.x * 1.3 + fbm(p * 0.4 + uTime * 0.1) * 4.0)) * abs(sin(p.y * 1.3 - fbm(p * 0.4 - uTime * 0.1) * 4.0));
    vec3 sand = mix(vec3(0.1, 0.22, 0.24), vec3(0.3, 0.42, 0.4), smoothstep(-0.03, -0.5, h));
    col = mix(col, sand + vec3(0.35, 0.55, 0.5) * pow(1.0 - c, 10.0) * 0.4, smoothstep(-0.03, -0.12, h));
  }
  gl_FragColor = vec4(col, 1.0);
}`;

// ---------- the floor ----------
// White marble, a border of gold waves round each tile.
function paintMosaic(ctx, S) {
  ctx.fillStyle = '#efebe3';
  ctx.fillRect(0, 0, S, S);
  for (let v = 0; v < 10; v++) {
    ctx.strokeStyle = `rgba(150,160,170,${0.08 + Math.random() * 0.1})`;
    ctx.lineWidth = 1 + Math.random() * 2;
    ctx.beginPath();
    let x = Math.random() * S, y = 0;
    ctx.moveTo(x, y);
    while (y < S) { x += (Math.random() - 0.5) * 60; y += 25 + Math.random() * 30; ctx.lineTo(x, y); }
    ctx.stroke();
  }
  // The wave border: running scrolls along each edge.
  ctx.strokeStyle = 'rgba(200,160,80,0.9)';
  ctx.lineWidth = 5;
  const wave = (horizontal, at) => {
    ctx.beginPath();
    for (let t = 0; t <= S; t += 4) {
      const k = (t / S) * Math.PI * 16;
      const off = Math.sin(k) * 12 + Math.sin(k * 2) * 4;
      if (horizontal) ctx.lineTo(t, at + off); else ctx.lineTo(at + off, t);
    }
    ctx.stroke();
  };
  [24, S - 24].forEach((at) => { wave(true, at); wave(false, at); });
  ctx.strokeStyle = 'rgba(200,160,80,0.6)';
  ctx.lineWidth = 3;
  ctx.strokeRect(4, 4, S - 8, S - 8);
}
// The golden compass rose round the table.
function compassRose(room) {
  const S = 2048;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const ctx = c.getContext('2d');
  const cx = S / 2;
  ctx.fillStyle = 'rgba(0,0,0,0)';
  ctx.fillRect(0, 0, S, S);
  [[0.49, 18], [0.46, 5], [0.3, 4]].forEach(([r, w]) => { ctx.strokeStyle = '#c99a3a'; ctx.lineWidth = w; ctx.beginPath(); ctx.arc(cx, cx, S * r, 0, Math.PI * 2); ctx.stroke(); });
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    const long = i % 4 === 0, mid = i % 2 === 0;
    const R = S * (long ? 0.49 : mid ? 0.42 : 0.36);
    ctx.fillStyle = i % 2 ? '#e8c87a' : '#b88a2a';
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * R, cx + Math.sin(a) * R);
    ctx.lineTo(cx + Math.cos(a + 0.09) * S * 0.31, cx + Math.sin(a + 0.09) * S * 0.31);
    ctx.lineTo(cx + Math.cos(a - 0.09) * S * 0.31, cx + Math.sin(a - 0.09) * S * 0.31);
    ctx.closePath();
    ctx.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  const rose = new THREE.Mesh(new THREE.CircleGeometry(m(6.2), 96), new THREE.MeshLambertMaterial({ map: t, transparent: true }));
  rose.rotation.x = -Math.PI / 2;
  rose.position.set(0, FLOOR_Y + 0.006, -0.4);
  room.add(rose);
}

// ---------- the hall ----------
// White columns with gold capitals round the hall, a vault of ribs across
// it with the sea showing between them.
function colonnade(room) {
  const step = m(4);
  const n = Math.round((2 * half) / step);
  const column = (x, z) => {
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(m(0.32), m(0.36), COL_H - m(0.6), 20), marble);
    shaft.position.set(x, FLOOR_Y + COL_H / 2, z);
    room.add(shaft);
    [[m(0.15), m(0.95)], [COL_H - m(0.15), m(0.9)]].forEach(([y, w]) => {
      const b = new THREE.Mesh(new THREE.BoxGeometry(w, m(0.3), w), y > m(1) ? gold : marble);
      b.position.set(x, FLOOR_Y + y, z);
      room.add(b);
    });
  };
  for (let i = 0; i <= n; i++) {
    const t = -half + i * step;
    [[t, -half], [t, half], [-half, t], [half, t]].forEach(([x, z]) => column(x, z));
  }
  // An entablature round the top.
  [[2 * half, 0, -half], [2 * half, 0, half], [2 * half, Math.PI / 2, -half], [2 * half, Math.PI / 2, half]].forEach(([len, yaw, off]) => {
    const beam = new THREE.Mesh(new THREE.BoxGeometry(len + m(1), m(0.5), m(0.9)), marble);
    beam.rotation.y = yaw;
    if (yaw) beam.position.set(off, FLOOR_Y + COL_H + m(0.25), 0); else beam.position.set(0, FLOOR_Y + COL_H + m(0.25), off);
    room.add(beam);
    const band = new THREE.Mesh(new THREE.BoxGeometry(len + m(1.02), m(0.1), m(0.92)), gold);
    band.rotation.y = yaw;
    band.position.copy(beam.position).setY(FLOOR_Y + COL_H + m(0.05));
    room.add(band);
  });
  // The vault: ribs across from side to side.
  const ribTop = FLOOR_Y + COL_H + m(0.5);
  for (let i = 0; i <= n; i += 2) {
    const z = -half + i * step;
    const rib = new THREE.Mesh(new THREE.TorusGeometry(half, m(0.12), 6, 64, Math.PI), marble);
    rib.scale.set(1, VAULT_RISE / half, 1);
    rib.position.set(0, ribTop, z);
    room.add(rib);
  }
  // And a spine along its crown.
  const spine = new THREE.Mesh(new THREE.BoxGeometry(m(0.1), m(0.08), 2 * half), gold);
  spine.position.set(0, ribTop + VAULT_RISE, 0);
  room.add(spine);
  return ribTop;
}

// ---------- the pearl ----------
// A scallop shell: a fan of ribbed petals, in gold.
function scallopHalf(R) {
  const s = new THREE.Shape();
  const ribs = 13;
  s.moveTo(0, 0);
  for (let i = 0; i <= ribs * 2; i++) {
    const a = Math.PI * 0.1 + (i / (ribs * 2)) * Math.PI * 0.8;
    const r = i % 2 ? R * 0.94 : R;
    s.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  s.lineTo(0, 0);
  const geo = new THREE.ExtrudeGeometry(s, { depth: m(0.06), bevelEnabled: true, bevelThickness: m(0.03), bevelSize: m(0.03), bevelSegments: 2, curveSegments: 4 });
  // Cupped: pushed out toward its middle.
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i);
    const r = Math.hypot(x, y) / R;
    pos.setZ(i, pos.getZ(i) + Math.sin(Math.min(1, r) * Math.PI) * R * 0.25);
  }
  geo.computeVertexNormals();
  return geo;
}
function pearlShell(room, ribTop) {
  const g = new THREE.Group();
  const cy = FLOOR_Y + m(4.2);
  g.position.set(0, cy, -0.4);
  room.add(g);
  const R = m(1.4);
  const lower = new THREE.Mesh(scallopHalf(R), gold);
  lower.rotation.x = -Math.PI / 2;
  lower.position.set(0, -m(0.1), R * 0.45);
  g.add(lower);
  const upper = new THREE.Mesh(scallopHalf(R), gold);
  upper.rotation.x = -Math.PI / 2 - 1.1;
  upper.scale.z = -1;
  upper.position.set(0, -m(0.05), R * 0.45 - m(0.1));
  g.add(upper);
  const pearl = new THREE.Mesh(new THREE.SphereGeometry(m(0.42), 48, 32), new THREE.MeshStandardMaterial({ color: 0xfaf6f0, roughness: 0.12, metalness: 0.15, emissive: 0xe8e0ff, emissiveIntensity: 0.55 }));
  pearl.position.set(0, m(0.32), 0);
  g.add(pearl);
  const glowC = document.createElement('canvas');
  glowC.width = glowC.height = 128;
  const gx = glowC.getContext('2d');
  const gg = gx.createRadialGradient(64, 64, 0, 64, 64, 64);
  gg.addColorStop(0, 'rgba(230,240,255,0.85)'); gg.addColorStop(0.4, 'rgba(160,220,255,0.3)'); gg.addColorStop(1, 'rgba(160,220,255,0)');
  gx.fillStyle = gg; gx.fillRect(0, 0, 128, 128);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(glowC), blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
  halo.scale.set(m(2.4), m(2.4), 1);
  halo.position.copy(pearl.position);
  g.add(halo);
  const rod = new THREE.Mesh(new THREE.CylinderGeometry(m(0.025), m(0.025), ribTop + VAULT_RISE - cy, 6), gold);
  rod.position.set(0, cy + (ribTop + VAULT_RISE - cy) / 2, -0.4);
  room.add(rod);
  return (dt) => { g.rotation.y += dt * 0.08; };
}

// ---------- life outside ----------
function fishGeometry(len) {
  const body = new THREE.SphereGeometry(len * 0.5, 10, 6);
  body.scale(1, 0.45, 0.22);
  const tail = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-len * 0.45, 0, 0), new THREE.Vector3(-len * 0.8, len * 0.22, 0), new THREE.Vector3(-len * 0.8, -len * 0.22, 0)]);
  tail.computeVertexNormals();
  return [body, tail];
}
// Schools of fish, each turning its own circle round the hall.
function schools(room) {
  const groups = [];
  const COLORS = [0xffd24a, 0xb8d8e8, 0xff7a3a];
  for (let s = 0; s < 4; s++) {
    const [body, tail] = fishGeometry(m(0.5 - s * 0.06));
    const mat = new THREE.MeshBasicMaterial({ color: COLORS[s % 3], side: THREE.DoubleSide });
    const N = 40;
    const bodies = new THREE.InstancedMesh(body, mat, N);
    const tails = new THREE.InstancedMesh(tail, mat, N);
    room.add(bodies, tails);
    groups.push({
      bodies, tails, N,
      R: half * (1.25 + s * 0.22), y: FLOOR_Y + m(1.6 + s * 1.3), speed: (0.05 + s * 0.012) * (s % 2 ? -1 : 1), ph: s * 1.7,
      offs: Array.from({ length: N }, () => [(Math.random() - 0.5) * m(5), (Math.random() - 0.5) * m(1.6), (Math.random() - 0.5) * m(3), Math.random() * 6]),
    });
  }
  const mtx = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1);
  const up = new THREE.Vector3(0, 1, 0);
  return (dt, now) => {
    const t = now / 1000;
    groups.forEach((g) => {
      const base = g.ph + t * g.speed;
      for (let i = 0; i < g.N; i++) {
        const [dx, dy, dr, ph] = g.offs[i];
        const a = base + dx / g.R;
        const r = g.R + dr;
        p.set(Math.sin(a) * r, g.y + dy + Math.sin(t * 0.8 + ph) * m(0.2), Math.cos(a) * r);
        q.setFromAxisAngle(up, a + (g.speed > 0 ? Math.PI : 0));
        mtx.compose(p, q, one);
        g.bodies.setMatrixAt(i, mtx);
        g.tails.setMatrixAt(i, mtx);
      }
      g.bodies.instanceMatrix.needsUpdate = true;
      g.tails.instanceMatrix.needsUpdate = true;
    });
  };
}
// A manta ray gliding in a great circle over the vault, its wings beating
// slowly.
function manta(room) {
  const W = m(5), L = m(3.2);
  const geo = new THREE.BufferGeometry();
  const v = [0, 0, L * 0.5, -W / 2, 0, -L * 0.1, 0, 0, -L * 0.5, W / 2, 0, -L * 0.1];
  geo.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
  geo.setIndex([0, 1, 2, 0, 2, 3]);
  geo.computeVertexNormals();
  const ray = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0x0c2230, side: THREE.DoubleSide }));
  const g = new THREE.Group();
  g.add(ray);
  room.add(g);
  const pos = geo.attributes.position;
  return (dt, now) => {
    const t = now / 1000;
    const a = t * 0.04;
    g.position.set(Math.sin(a) * half * 1.4, FLOOR_Y + m(11), Math.cos(a) * half * 1.4);
    g.rotation.y = a + Math.PI / 2;
    const flap = Math.sin(t * 1.3) * m(0.8);
    pos.setY(1, flap); pos.setY(3, flap);
    pos.needsUpdate = true;
  };
}
// Jellyfish: bells lit within, pulsing, drifting up and down.
function jellyfish(room) {
  const list = [];
  const bell = new THREE.SphereGeometry(m(0.35), 16, 10, 0, Math.PI * 2, 0, Math.PI / 2);
  for (let i = 0; i < 10; i++) {
    const col = [0xff8ad8, 0x8ad8ff, 0xc8a0ff][i % 3];
    const mat = new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.55, depthWrite: false, toneMapped: false, side: THREE.DoubleSide });
    const j = new THREE.Group();
    j.add(new THREE.Mesh(bell, mat));
    for (let k = 0; k < 5; k++) {
      const tent = new THREE.Mesh(new THREE.CylinderGeometry(m(0.008), m(0.004), m(0.9), 4), mat);
      tent.position.set((k - 2) * m(0.09), -m(0.45), 0);
      j.add(tent);
    }
    const a = (i / 10) * Math.PI * 2;
    const r = half + m(2) + (i % 3) * m(2);
    j.position.set(Math.sin(a) * r, FLOOR_Y + m(2.5) + (i % 4) * m(1), Math.cos(a) * r);
    room.add(j);
    list.push({ j, y: j.position.y, ph: Math.random() * 6 });
  }
  return (dt, now) => list.forEach((l) => {
    const t = now / 1000 + l.ph;
    l.j.position.y = l.y + Math.sin(t * 0.4) * m(0.6);
    const s = 1 + Math.sin(t * 2.2) * 0.12;
    l.j.scale.set(s, 1 / s, s);
  });
}

// ---------- water columns ----------
// Floor-to-vault cylinders of water, fish turning in them, bubbles rising.
function waterColumn(room, x, z) {
  const R = m(0.8), H = COL_H;
  const glass = new THREE.Mesh(new THREE.CylinderGeometry(R, R, H, 32, 1, true), new THREE.MeshBasicMaterial({ color: 0x3ab8d8, transparent: true, opacity: 0.32, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }));
  glass.position.set(x, FLOOR_Y + H / 2, z);
  room.add(glass);
  [0, H].forEach((y) => {
    const ring = new THREE.Mesh(new THREE.CylinderGeometry(R + m(0.08), R + m(0.08), m(0.25), 32), gold);
    ring.position.set(x, FLOOR_Y + y + (y ? -m(0.12) : m(0.12)), z);
    room.add(ring);
  });
  const [body, tail] = fishGeometry(m(0.22));
  const mat = new THREE.MeshBasicMaterial({ color: 0xffb02a, side: THREE.DoubleSide });
  const fish = [0, 1, 2, 3].map((i) => { const f = new THREE.Group(); f.add(new THREE.Mesh(body, mat), new THREE.Mesh(tail, mat)); room.add(f); return { f, y: FLOOR_Y + m(0.8 + i * 0.8), ph: i * 1.6 }; });
  const N = 30;
  const bub = new THREE.InstancedMesh(new THREE.SphereGeometry(m(0.035), 6, 4), new THREE.MeshBasicMaterial({ color: 0xe8fbff, transparent: true, opacity: 0.7, toneMapped: false }), N);
  room.add(bub);
  const bs = Array.from({ length: N }, () => ({ a: Math.random() * 6, r: Math.random() * R * 0.7, y: Math.random() * H, v: 0.4 + Math.random() * 0.6 }));
  const mtx = new THREE.Matrix4();
  return (dt, now) => {
    const t = now / 1000;
    fish.forEach((fh) => {
      const a = t * 0.6 + fh.ph;
      fh.f.position.set(x + Math.cos(a) * R * 0.55, fh.y, z + Math.sin(a) * R * 0.55);
      fh.f.rotation.y = -a - Math.PI / 2;
    });
    bs.forEach((b, i) => {
      b.y += b.v * dt;
      if (b.y > H) b.y = 0;
      mtx.makeTranslation(x + Math.cos(b.a) * b.r, FLOOR_Y + b.y, z + Math.sin(b.a) * b.r);
      bub.setMatrixAt(i, mtx);
    });
    bub.instanceMatrix.needsUpdate = true;
  };
}

// ---------- furniture ----------
// A chair with a fanned scallop back, pearl white with gold, on a gold base.
function shellChair(room, x, z, yaw) {
  const g = new THREE.Group();
  const seat = new THREE.Mesh(new THREE.CylinderGeometry(m(0.38), m(0.34), m(0.14), 24), pearlWhite);
  seat.position.y = FLOOR_Y + m(0.45);
  g.add(seat);
  const back = new THREE.Mesh(scallopHalf(m(0.7)), pearlWhite);
  back.position.set(0, FLOOR_Y + m(0.45), -m(0.3));
  back.rotation.x = 0.15;
  g.add(back);
  const base = new THREE.Mesh(new THREE.CylinderGeometry(m(0.05), m(0.28), m(0.4), 16), gold);
  base.position.y = FLOOR_Y + m(0.2);
  g.add(base);
  g.position.set(x, 0, z);
  g.rotation.y = yaw;
  room.add(g);
}
// A table of glass on a stem of golden coral.
function coralTable(room, x, z) {
  const top = new THREE.Mesh(new THREE.CylinderGeometry(m(0.55), m(0.55), m(0.04), 32), new THREE.MeshStandardMaterial({ color: 0xbfe8f0, roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.6 }));
  top.position.set(x, FLOOR_Y + m(0.62), z);
  room.add(top);
  coral(room, x, z, m(0.6), gold, 3);
}
// Coral: a few branching arms, tapering.
function coral(room, x, z, h, mat, depth = 4) {
  const grow = (from, dir, len, r, d) => {
    if (d <= 0) return;
    const to = from.clone().addScaledVector(dir, len);
    const b = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.6, r, len, 6), mat);
    b.position.copy(from).lerp(to, 0.5);
    b.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    room.add(b);
    for (let k = 0; k < 2; k++) {
      const nd = dir.clone().add(new THREE.Vector3((Math.random() - 0.5) * 1.2, 0.2, (Math.random() - 0.5) * 1.2)).normalize();
      grow(to, nd, len * 0.7, r * 0.65, d - 1);
    }
  };
  grow(new THREE.Vector3(x, FLOOR_Y, z), new THREE.Vector3(0, 1, 0), h * 0.45, m(0.08), depth);
}
// Coral in colour, on a marble plinth.
function coralPiece(room, x, z, color) {
  const plinth = new THREE.Mesh(new THREE.CylinderGeometry(m(0.55), m(0.6), m(0.6), 24), marble);
  plinth.position.set(x, FLOOR_Y + m(0.3), z);
  room.add(plinth);
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.6, emissive: color, emissiveIntensity: 0.25 });
  const base = new THREE.Vector3(x, FLOOR_Y + m(0.6), z);
  const grow = (from, dir, len, r, d) => {
    if (d <= 0) return;
    const to = from.clone().addScaledVector(dir, len);
    const b = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.6, r, len, 6), mat);
    b.position.copy(from).lerp(to, 0.5);
    b.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    room.add(b);
    for (let k = 0; k < 3; k++) {
      const nd = dir.clone().add(new THREE.Vector3((Math.random() - 0.5) * 1.3, 0.3, (Math.random() - 0.5) * 1.3)).normalize();
      grow(to, nd, len * 0.72, r * 0.7, d - 1);
    }
  };
  grow(base, new THREE.Vector3(0, 1, 0), m(0.5), m(0.1), 4);
}
// The reef bar: a curved counter whose front is a lit aquarium, a gold
// top, shelves of bottles behind on a marble wall.
function reefBar(room) {
  const len = m(5);
  const x = -half + m(1.2) + len / 2;
  const z = -half + m(2.2);
  const tank = new THREE.Mesh(new THREE.BoxGeometry(len, m(1.0), m(0.5)), new THREE.MeshBasicMaterial({ color: 0x1a8ab8, transparent: true, opacity: 0.85, toneMapped: false }));
  tank.position.set(x, FLOOR_Y + m(0.5), z);
  room.add(tank);
  // Fish in the tank, and weed.
  const [body, tail] = fishGeometry(m(0.16));
  const fishMat = new THREE.MeshBasicMaterial({ color: 0xffd24a, side: THREE.DoubleSide });
  const fish = [];
  for (let i = 0; i < 8; i++) {
    const f = new THREE.Group();
    f.add(new THREE.Mesh(body, fishMat), new THREE.Mesh(tail, fishMat));
    room.add(f);
    fish.push({ f, y: FLOOR_Y + m(0.25 + (i % 4) * 0.18), ph: i * 0.8, sp: 0.15 + Math.random() * 0.15 });
  }
  const top = new THREE.Mesh(new THREE.BoxGeometry(len + m(0.1), m(0.06), m(0.7)), gold);
  top.position.set(x, FLOOR_Y + m(1.03), z - m(0.05));
  room.add(top);
  const wall = new THREE.Mesh(new THREE.BoxGeometry(len, m(2.8), m(0.2)), marble);
  wall.position.set(x, FLOOR_Y + m(1.4), -half + m(0.4));
  room.add(wall);
  const bottle = new THREE.CylinderGeometry(m(0.035), m(0.04), m(0.28), 10);
  const mats = [0x2ab8c8, 0xd8b25e, 0x88c8a8, 0xe8e0d0].map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.1, emissive: c, emissiveIntensity: 0.3 }));
  [1.2, 1.7, 2.2].forEach((y, row) => {
    const shelf = new THREE.Mesh(new THREE.BoxGeometry(len - m(0.2), m(0.03), m(0.25)), gold);
    shelf.position.set(x, FLOOR_Y + m(y), -half + m(0.62));
    room.add(shelf);
    for (let i = 0; i < 28; i++) {
      const b = new THREE.Mesh(bottle, mats[(i + row) % 4]);
      b.position.set(x - len / 2 + m(0.25) + i * m(0.165), FLOOR_Y + m(y) + m(0.155), -half + m(0.62));
      room.add(b);
    }
  });
  // Shell-backed stools.
  for (let i = 0; i < 5; i++) shellChair(room, x - len / 2 + (i + 0.5) * (len / 5), z + m(0.75), Math.PI);
  room.userData.bar = {
    bartender: { pos: new THREE.Vector3(x - len * 0.1, 0, -half + m(1.1)), yaw: 0 },
    pickup: { pos: new THREE.Vector3(x + len / 2 + m(0.6), 0, z), look: new THREE.Vector3(x, 0, z) },
  };
  return (dt, now) => fish.forEach((fh) => {
    const t = now / 1000 * fh.sp + fh.ph;
    const u = (Math.sin(t) + 1) / 2;
    fh.f.position.set(x - len * 0.45 + u * len * 0.9, fh.y, z);
    fh.f.rotation.y = Math.cos(t) > 0 ? 0 : Math.PI;
  });
}

// ---------- the room ----------
export const GOLDEN_ACE = {
  tableGlow: 0x6fe0ff,
  half,
  ceilingY: FLOOR_Y + COL_H + m(0.5),
  open: { back: true, sides: true, front: true },
  ceiling: null, noPanel: true, noCove: true,
  floorPx: 1024, floorRepeat: 72 / 4,
  paintFloor: paintMosaic,
  accent: 0xd8b25e, cove: 0x9fe0ff, diffuser: 0xe8fbff, washAlpha: 0,
  wall: { style: 'panels', base: 0xf2efe8, wainscot: 0xf2efe8, rail: 0xd8b25e, skirting: 0x9aa0a0 },
  floor: { style: 'marble', base: 0xefebe3, pattern: 0xc99a3a },
  light: { sky: 0xb0e8ff, ground: 0x2a5060, fill: 2.0, key: 0xfff2e0, keyPower: 92, wash: 0x9fe0ff, washPower: 36, fog: 0x063048, fogNear: 50, fogFar: 140 },
  furnish(room, h, CEILING_Y) {
    const updates = [];
    const deep = cameraDome(DEEP);
    room.add(deep);
    updates.push(deep.userData.tick);
    const ribTop = colonnade(room);
    compassRose(room);
    updates.push(pearlShell(room, ribTop));
    updates.push(schools(room));
    updates.push(manta(room));
    updates.push(jellyfish(room));
    [[-m(11), -m(11)], [m(11), -m(11)], [-m(11), m(11)], [m(11), m(11)]].forEach(([x, z]) => updates.push(waterColumn(room, x, z)));
    // The sign, between two columns of gold behind the dealer.
    const sign = createBrandSign(m(2.6), { rgb: '236,206,140', plate: '#08283a', halo: false });
    sign.position.set(0, FLOOR_Y + m(2.8), -half + m(0.5));
    room.add(sign);
    [-1, 1].forEach((s) => {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(m(0.12), m(0.12), m(3.6), 16), gold);
      post.position.set(s * m(1.6), FLOOR_Y + m(1.8), -half + m(0.5));
      room.add(post);
    });
    updates.push(reefBar(room));
    // Shell chairs round coral tables; coral on plinths along the edge.
    [[-m(8), m(3)], [m(8), m(3)], [-m(8), m(9)], [m(8), m(9)], [m(9), -m(6)]].forEach(([x, z]) => {
      coralTable(room, x, z);
      [0, 1, 2].forEach((k) => { const a = (k / 3) * Math.PI * 2 + 0.5; shellChair(room, x + Math.cos(a) * m(1.05), z + Math.sin(a) * m(1.05), Math.atan2(-Math.cos(a), -Math.sin(a))); });
    });
    [[-half + m(1.6), -m(4)], [-half + m(1.6), m(4)], [half - m(1.6), -m(4)], [half - m(1.6), m(4)], [-m(5), half - m(1.6)], [m(5), half - m(1.6)]].forEach(([x, z], i) => coralPiece(room, x, z, [0xff7a6a, 0xff9a3a, 0xc85aff][i % 3]));

    walkway(room);
    staffPosts(room, [[10, -9.6], [-10.2, 10.2], [10.2, 10.2]]);
    room.userData.update = (dt, now) => updates.forEach((u) => u(dt, now));
  },
};
