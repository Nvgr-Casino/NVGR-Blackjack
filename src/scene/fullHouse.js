import * as THREE from 'three';
import { FLOOR_Y, m } from './scale.js';
import { walkway, staffPosts } from './layout.js';
import { createBrandSign } from './luxury.js';
import { cameraDome, GLSL_NOISE } from './decor.js';
import { drawCasinoCrest } from './crest.js';

// The Full House: a pavilion in a moonlit garden. A deck of pale wood
// under a coffered ceiling on red lacquer columns, open on every side to a
// Japanese garden at night; its furniture all its own:
//
//   - hundreds of paper lanterns hung under the ceiling, swaying a little;
//   - behind the dealer a torii gate, the house sign hung in it, and
//     through it a koi pond, the koi turning in it among lily pads;
//   - cherry trees in blossom round the garden, petals drifting down;
//     stone lanterns, groves of bamboo, rocks in raked gravel;
//   - low tables of black lacquer with silk cushions round them;
//   - a tea-house bar of cedar under navy noren, sake on its shelves;
//   - over it all a great moon, stars, and mountains in the mist.

const half = 36;
const P = 22;                         // the pavilion's half-width
const CEIL = FLOOR_Y + m(4.2);

const lacquerRed = new THREE.MeshStandardMaterial({ color: 0xa3161e, roughness: 0.3, metalness: 0.05 });
const darkWood = new THREE.MeshStandardMaterial({ color: 0x2a1a10, roughness: 0.6 });
const blackLacquer = new THREE.MeshStandardMaterial({ color: 0x0b0a0c, roughness: 0.15, metalness: 0.2 });
const stone = new THREE.MeshStandardMaterial({ color: 0x8a8880, roughness: 0.95 });
const glowWarm = new THREE.MeshBasicMaterial({ color: 0xffc070, toneMapped: false });

// ---------- the night ----------
const NIGHT = GLSL_NOISE + `
uniform float uTime;
uniform vec3 uMoon;
varying vec3 vDir;
void main() {
  vec3 d = normalize(vDir);
  float h = d.y;
  float az = atan(d.x, -d.z);
  vec3 col = mix(vec3(0.10, 0.13, 0.26), vec3(0.015, 0.02, 0.06), smoothstep(0.0, 0.8, h));
  // Stars.
  vec3 sd = d * 150.0;
  float s = hash3(floor(sd));
  if (s > 0.975 && h > 0.04) {
    float st = smoothstep(0.15, 0.0, length(fract(sd) - 0.5)) * (0.6 + 0.4 * sin(uTime * (1.0 + s * 2.0) + s * 50.0));
    col += vec3(0.85, 0.9, 1.0) * st;
  }
  // The moon, large and warm, a halo round it.
  float mo = dot(d, uMoon);
  col += vec3(1.0, 0.95, 0.82) * smoothstep(0.9982, 0.9988, mo) * 1.8;
  col += vec3(0.4, 0.42, 0.6) * pow(max(mo, 0.0), 40.0) * 0.6;
  // Mountains in three ranges, the far ones paler in the mist.
  for (int i = 0; i < 3; i++) {
    float fi = float(i);
    float ridge = 0.04 + fi * -0.012 + (fbm(vec2(az * (2.0 + fi * 1.6) + fi * 7.0, fi)) - 0.5) * (0.14 - fi * 0.03);
    vec3 hill = mix(vec3(0.16, 0.19, 0.3), vec3(0.04, 0.05, 0.09), fi / 2.0);
    if (h < ridge) col = mix(col, hill, 0.92);
  }
  // Mist along the foot of them.
  col = mix(col, vec3(0.22, 0.25, 0.36), smoothstep(0.06, -0.02, h) * 0.6);
  if (h < -0.02) col = vec3(0.03, 0.035, 0.05);
  gl_FragColor = vec4(col, 1.0);
}`;

// ---------- the ground ----------
// Raked gravel: pale grey, combed in lines.
function gravelTexture() {
  const S = 512;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#b8b6ae';
  ctx.fillRect(0, 0, S, S);
  for (let k = 0; k < 20000; k++) { ctx.fillStyle = `rgba(${80 + Math.random() * 80},${80 + Math.random() * 80},${75 + Math.random() * 70},0.4)`; ctx.fillRect(Math.random() * S, Math.random() * S, 2, 2); }
  ctx.strokeStyle = 'rgba(60,58,52,0.35)';
  ctx.lineWidth = 3;
  for (let y = 8; y < S; y += 16) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(S, y); ctx.stroke(); }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  return t;
}
function paintGravel(ctx, S) {
  const img = gravelTexture().image;
  ctx.drawImage(img, 0, 0, S, S);
}
// Pale cedar planks for the deck.
function deckTexture() {
  const S = 1024;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const ctx = c.getContext('2d');
  for (let i = 0; i < 16; i++) {
    const shade = 180 + ((i * 37) % 30) - 15;
    ctx.fillStyle = `rgb(${shade},${shade - 40},${shade - 85})`;
    ctx.fillRect(0, i * (S / 16), S, S / 16 - 3);
    ctx.strokeStyle = 'rgba(90,60,30,0.12)';
    for (let g = 0; g < 4; g++) { ctx.beginPath(); ctx.moveTo(0, i * (S / 16) + 6 + g * 14); ctx.bezierCurveTo(S * 0.3, i * (S / 16) + g * 14, S * 0.7, i * (S / 16) + 12 + g * 14, S, i * (S / 16) + 6 + g * 14); ctx.stroke(); }
    ctx.fillStyle = 'rgba(40,25,10,0.5)';
    ctx.fillRect(((i * 211) % S), i * (S / 16), 3, S / 16);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  return t;
}

// ---------- the pavilion ----------
function pavilion(room) {
  // The deck, flush with the gravel, in a frame of dark wood.
  const tex = deckTexture();
  tex.repeat.set(4, 4);
  const deck = new THREE.Mesh(new THREE.PlaneGeometry(2 * P, 2 * P), new THREE.MeshLambertMaterial({ map: tex }));
  deck.rotation.x = -Math.PI / 2;
  deck.position.y = FLOOR_Y + 0.004;
  deck.receiveShadow = true;
  room.add(deck);
  [[2 * P + m(0.3), m(0.3), 0, -P], [2 * P + m(0.3), m(0.3), 0, P], [m(0.3), 2 * P, -P, 0], [m(0.3), 2 * P, P, 0]].forEach(([w, d, x, z]) => {
    const beam = new THREE.Mesh(new THREE.BoxGeometry(w, m(0.1), d), darkWood);
    beam.position.set(x, FLOOR_Y + m(0.05), z);
    room.add(beam);
  });
  // Red columns round the edge, a beam along their heads.
  const step = (2 * P) / 6;
  for (let i = 0; i <= 6; i++) {
    const t = -P + i * step;
    [[t, -P], [t, P], [-P, t], [P, t]].forEach(([x, z]) => {
      if (Math.abs(x) < 0.1 && z < 0) return;   // the gate stands there
      const col = new THREE.Mesh(new THREE.CylinderGeometry(m(0.16), m(0.18), CEIL - FLOOR_Y, 16), lacquerRed);
      col.position.set(x, (CEIL + FLOOR_Y) / 2, z);
      room.add(col);
      const base = new THREE.Mesh(new THREE.CylinderGeometry(m(0.24), m(0.26), m(0.18), 12), stone);
      base.position.set(x, FLOOR_Y + m(0.09), z);
      room.add(base);
    });
  }
  [[2 * P, 0, -P], [2 * P, 0, P], [2 * P, Math.PI / 2, -P], [2 * P, Math.PI / 2, P]].forEach(([len, yaw, off]) => {
    const beam = new THREE.Mesh(new THREE.BoxGeometry(len + m(0.8), m(0.35), m(0.35)), lacquerRed);
    beam.rotation.y = yaw;
    if (yaw) beam.position.set(off, CEIL - m(0.17), 0); else beam.position.set(0, CEIL - m(0.17), off);
    room.add(beam);
  });
  // The coffered ceiling of dark wood, and the roof's eaves beyond it.
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(2 * P, 2 * P), new THREE.MeshLambertMaterial({ color: 0x3a2414, emissive: 0x24160c, emissiveIntensity: 0.6 }));
  ceil.rotation.x = Math.PI / 2;
  ceil.position.y = CEIL + m(0.2);
  room.add(ceil);
  for (let k = -P + step / 2; k < P; k += step / 2) {
    [[2 * P, m(0.18), 0, k], [m(0.18), 2 * P, k, 0]].forEach(([w, d, x, z]) => {
      const b = new THREE.Mesh(new THREE.BoxGeometry(w, m(0.22), d), darkWood);
      b.position.set(x, CEIL + m(0.08), z);
      room.add(b);
    });
  }
  const eave = new THREE.Mesh(new THREE.BoxGeometry(2 * P + m(3.4), m(0.25), 2 * P + m(3.4)), new THREE.MeshLambertMaterial({ color: 0x1a1a1e }));
  eave.position.y = CEIL + m(0.4);
  room.add(eave);
  const fascia = new THREE.Mesh(new THREE.BoxGeometry(2 * P + m(3.5), m(0.08), 2 * P + m(3.5)), new THREE.MeshStandardMaterial({ color: 0xc9a24f, roughness: 0.3, metalness: 0.9 }));
  fascia.position.y = CEIL + m(0.27);
  room.add(fascia);
}

// ---------- the lanterns ----------
// Paper lanterns: ribbed, lit within, red and white, swaying.
function lanterns(room) {
  const geo = new THREE.SphereGeometry(m(0.17), 16, 12);
  geo.scale(1, 1.25, 1);
  const reds = new THREE.MeshBasicMaterial({ color: 0xff5a3a, toneMapped: false });
  const whites = new THREE.MeshBasicMaterial({ color: 0xffe6b8, toneMapped: false });
  const cap = new THREE.CylinderGeometry(m(0.08), m(0.08), m(0.04), 12);
  const list = [];
  // Clear of the table and of the line from the seats to the sign.
  const clear = (x, z) => Math.hypot(x, z + 0.4) < m(5) || (Math.abs(x) < m(3.2) && z < 0);
  for (let i = 0; i < 110; i++) {
    let x, z;
    do { x = (Math.random() * 2 - 1) * (P - m(1)); z = (Math.random() * 2 - 1) * (P - m(1)); } while (clear(x, z));
    const drop = m(0.35) + Math.random() * m(0.8);
    const g = new THREE.Group();
    g.position.set(x, CEIL, z);
    const l = new THREE.Mesh(geo, Math.random() < 0.6 ? reds : whites);
    l.position.y = -drop;
    g.add(l);
    [-1, 1].forEach((s) => { const c = new THREE.Mesh(cap, blackLacquer); c.position.y = -drop + s * m(0.21); g.add(c); });
    const cord = new THREE.Mesh(new THREE.CylinderGeometry(m(0.006), m(0.006), drop - m(0.21), 4), blackLacquer);
    cord.position.y = -(drop - m(0.21)) / 2;
    g.add(cord);
    room.add(g);
    list.push({ g, ph: Math.random() * 6, amp: 0.02 + Math.random() * 0.03 });
  }
  return (dt, now) => list.forEach((l) => { l.g.rotation.z = Math.sin(now / 1700 + l.ph) * l.amp; l.g.rotation.x = Math.cos(now / 2100 + l.ph) * l.amp; });
}

// ---------- the torii ----------
// The gate behind the dealer, red, the sign hung in it.
function torii(room) {
  const z = -P;
  const H = m(4.0), span = m(4.2);
  [-1, 1].forEach((s) => {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(m(0.2), m(0.24), H, 16), lacquerRed);
    post.position.set(s * span / 2, FLOOR_Y + H / 2, z);
    room.add(post);
    const foot = new THREE.Mesh(new THREE.CylinderGeometry(m(0.28), m(0.28), m(0.35), 16), blackLacquer);
    foot.position.set(s * span / 2, FLOOR_Y + m(0.175), z);
    room.add(foot);
  });
  const kasagi = new THREE.Mesh(new THREE.BoxGeometry(span + m(1.6), m(0.28), m(0.4)), blackLacquer);
  kasagi.position.set(0, FLOOR_Y + H + m(0.2), z);
  room.add(kasagi);
  const shimaki = new THREE.Mesh(new THREE.BoxGeometry(span + m(1.3), m(0.22), m(0.34)), lacquerRed);
  shimaki.position.set(0, FLOOR_Y + H, z);
  room.add(shimaki);
  // The ends of the top beam sweep up.
  [-1, 1].forEach((s) => {
    const tip = new THREE.Mesh(new THREE.BoxGeometry(m(0.7), m(0.24), m(0.4)), blackLacquer);
    tip.position.set(s * (span / 2 + m(1.0)), FLOOR_Y + H + m(0.32), z);
    tip.rotation.z = s * 0.25;
    room.add(tip);
  });
  const nuki = new THREE.Mesh(new THREE.BoxGeometry(span + m(0.6), m(0.18), m(0.22)), lacquerRed);
  nuki.position.set(0, FLOOR_Y + H - m(0.75), z);
  room.add(nuki);
  const sign = createBrandSign(m(2.2), { rgb: '236,206,140', plate: '#1a0e0a', halo: false });
  sign.position.set(0, FLOOR_Y + m(2.6), z + m(0.05));
  room.add(sign);
}

// ---------- the pond ----------
const POND_FRAG = `
uniform float uTime;
varying vec2 vUv;
void main() {
  vec2 p = vUv * 6.0;
  float w = sin(p.x * 2.0 + uTime * 0.6) * 0.5 + sin(p.y * 2.7 - uTime * 0.5) * 0.5 + sin((p.x + p.y) * 3.3 + uTime) * 0.3;
  vec3 col = mix(vec3(0.03, 0.08, 0.1), vec3(0.06, 0.16, 0.2), 0.5 + 0.3 * w);
  // The moon on the water.
  float glint = smoothstep(0.92, 1.0, sin(p.x * 9.0 + w * 2.0) * sin(p.y * 7.0 - w));
  col += vec3(0.7, 0.75, 0.9) * glint * 0.35 * smoothstep(0.2, 0.8, vUv.y);
  gl_FragColor = vec4(col, 1.0);
}`;
function koiPond(room, cx, cz, rx, rz) {
  const water = new THREE.Mesh(new THREE.CircleGeometry(1, 64), new THREE.ShaderMaterial({
    vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: POND_FRAG, uniforms: { uTime: { value: 0 } },
  }));
  water.scale.set(rx, rz, 1);
  water.rotation.x = -Math.PI / 2;
  water.position.set(cx, FLOOR_Y + 0.02, cz);
  room.add(water);
  // Stones round its edge.
  for (let i = 0; i < 34; i++) {
    const a = (i / 34) * Math.PI * 2;
    const r = new THREE.Mesh(new THREE.DodecahedronGeometry(m(0.3 + Math.random() * 0.25), 0), stone);
    r.position.set(cx + Math.cos(a) * rx * 1.04, FLOOR_Y + m(0.08), cz + Math.sin(a) * rz * 1.04);
    r.scale.y = 0.55;
    r.rotation.set(Math.random(), Math.random(), Math.random());
    room.add(r);
  }
  // Lily pads, a flower on some.
  const pad = new THREE.CircleGeometry(m(0.32), 20, 0.3, Math.PI * 2 - 0.3);
  const padMat = new THREE.MeshLambertMaterial({ color: 0x2f6a2a, side: THREE.DoubleSide });
  for (let i = 0; i < 22; i++) {
    const a = Math.random() * Math.PI * 2, rr = Math.sqrt(Math.random()) * 0.85;
    const p = new THREE.Mesh(pad, padMat);
    p.rotation.set(-Math.PI / 2, 0, Math.random() * 6);
    p.position.set(cx + Math.cos(a) * rx * rr, FLOOR_Y + 0.03, cz + Math.sin(a) * rz * rr);
    room.add(p);
    if (i % 3 === 0) {
      const f = new THREE.Mesh(new THREE.SphereGeometry(m(0.09), 10, 6), new THREE.MeshBasicMaterial({ color: 0xffc8de, toneMapped: false }));
      f.scale.y = 0.6;
      f.position.set(p.position.x, FLOOR_Y + m(0.06), p.position.z);
      room.add(f);
    }
  }
  // The koi, orange and white, each turning its own slow circle.
  const body = new THREE.SphereGeometry(m(0.16), 12, 8);
  body.scale(1, 0.35, 0.45);
  const koiMats = [0xff6a1a, 0xfff0e0, 0xff3a1a].map((c) => new THREE.MeshLambertMaterial({ color: c, emissive: c, emissiveIntensity: 0.2 }));
  const koi = [];
  for (let i = 0; i < 12; i++) {
    const k = new THREE.Mesh(body, koiMats[i % 3]);
    room.add(k);
    koi.push({ k, r: 0.25 + Math.random() * 0.55, speed: (0.15 + Math.random() * 0.2) * (i % 2 ? 1 : -1), ph: Math.random() * 6 });
  }
  return (dt, now) => {
    water.material.uniforms.uTime.value = now / 1000;
    koi.forEach((f) => {
      const a = f.ph + (now / 1000) * f.speed;
      f.k.position.set(cx + Math.cos(a) * rx * f.r, FLOOR_Y + 0.015, cz + Math.sin(a) * rz * f.r);
      f.k.rotation.y = -a + (f.speed > 0 ? 0 : Math.PI);
    });
  };
}

// ---------- the garden ----------
// A cherry tree in blossom: a dark trunk, a few boughs, clouds of pink.
const blossom = new THREE.MeshLambertMaterial({ color: 0xffb8d0, emissive: 0x5a2a3a, emissiveIntensity: 0.5 });
function cherryTree(room, x, z, scale = 1) {
  const bark = new THREE.MeshStandardMaterial({ color: 0x2a1c18, roughness: 0.9 });
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(m(0.12) * scale, m(0.22) * scale, m(2.2) * scale, 8), bark);
  trunk.position.set(x, FLOOR_Y + m(1.1) * scale, z);
  trunk.rotation.z = 0.08;
  room.add(trunk);
  const puffs = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(m(0.5) * scale, 1), blossom, 14);
  const mtx = new THREE.Matrix4();
  for (let i = 0; i < 14; i++) {
    const a = Math.random() * Math.PI * 2, r = Math.random() * m(1.4) * scale;
    const s = 0.7 + Math.random() * 0.7;
    mtx.makeScale(s, s * 0.8, s);
    mtx.setPosition(x + Math.cos(a) * r, FLOOR_Y + m(2.4) * scale + Math.random() * m(1.0) * scale, z + Math.sin(a) * r);
    puffs.setMatrixAt(i, mtx);
  }
  room.add(puffs);
  for (let b = 0; b < 4; b++) {
    const a = (b / 4) * Math.PI * 2 + Math.random();
    const bough = new THREE.Mesh(new THREE.CylinderGeometry(m(0.04) * scale, m(0.08) * scale, m(1.4) * scale, 6), bark);
    bough.position.set(x + Math.cos(a) * m(0.4) * scale, FLOOR_Y + m(2.3) * scale, z + Math.sin(a) * m(0.4) * scale);
    bough.rotation.set(Math.sin(a) * 0.9, 0, -Math.cos(a) * 0.9);
    room.add(bough);
  }
}
// A stone lantern: a footed post, a lit firebox, a roof, a jewel on top.
function stoneLantern(room, x, z) {
  const parts = [[m(0.28), m(0.3), m(0.15)], [m(0.1), m(0.12), m(0.6)], [m(0.3), m(0.3), m(0.1)]];
  let y = FLOOR_Y;
  parts.forEach(([r0, r1, h]) => {
    const p = new THREE.Mesh(new THREE.CylinderGeometry(r0, r1, h, 6), stone);
    p.position.set(x, y + h / 2, z);
    room.add(p);
    y += h;
  });
  const box = new THREE.Mesh(new THREE.BoxGeometry(m(0.32), m(0.3), m(0.32)), stone);
  box.position.set(x, y + m(0.15), z);
  room.add(box);
  const fire = new THREE.Mesh(new THREE.BoxGeometry(m(0.34), m(0.16), m(0.2)), glowWarm);
  fire.position.set(x, y + m(0.15), z);
  room.add(fire);
  const roof = new THREE.Mesh(new THREE.ConeGeometry(m(0.42), m(0.28), 6), stone);
  roof.position.set(x, y + m(0.44), z);
  room.add(roof);
  const jewel = new THREE.Mesh(new THREE.SphereGeometry(m(0.07), 8, 6), stone);
  jewel.position.set(x, y + m(0.62), z);
  room.add(jewel);
}
// A grove of bamboo: green canes at their own heights, jointed.
function bamboo(room, x, z) {
  const mat = new THREE.MeshLambertMaterial({ color: 0x5a8a3a });
  const n = 22;
  const canes = new THREE.InstancedMesh(new THREE.CylinderGeometry(m(0.04), m(0.05), 1, 8), mat, n);
  const mtx = new THREE.Matrix4();
  for (let i = 0; i < n; i++) {
    const h = m(3) + Math.random() * m(3);
    mtx.makeScale(1, h, 1);
    mtx.setPosition(x + (Math.random() - 0.5) * m(2.2), FLOOR_Y + h / 2, z + (Math.random() - 0.5) * m(2.2));
    canes.setMatrixAt(i, mtx);
  }
  room.add(canes);
  const leaves = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(m(0.45), 0), new THREE.MeshLambertMaterial({ color: 0x3e6e2a }), 10);
  for (let i = 0; i < 10; i++) {
    mtx.makeScale(1, 0.5, 1);
    mtx.setPosition(x + (Math.random() - 0.5) * m(2.4), FLOOR_Y + m(3.5) + Math.random() * m(2.4), z + (Math.random() - 0.5) * m(2.4));
    leaves.setMatrixAt(i, mtx);
  }
  room.add(leaves);
}
// A rock set in raked circles of gravel.
function rockGarden(room, x, z) {
  const r = new THREE.Mesh(new THREE.DodecahedronGeometry(m(0.8), 1), stone);
  r.scale.set(1.3, 0.75, 1);
  r.position.set(x, FLOOR_Y + m(0.35), z);
  r.rotation.y = Math.random() * 3;
  room.add(r);
  const rings = new THREE.Mesh(new THREE.RingGeometry(m(1.3), m(3.2), 48, 6), new THREE.MeshBasicMaterial({ color: 0x6a6860, transparent: true, opacity: 0.25, wireframe: true }));
  rings.rotation.x = -Math.PI / 2;
  rings.position.set(x, FLOOR_Y + 0.01, z);
  room.add(rings);
}
// Petals drifting down over the garden and the deck's edge.
function petals(room) {
  const N = 260;
  const geo = new THREE.PlaneGeometry(m(0.05), m(0.04));
  const mesh = new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial({ color: 0xffc8dc, side: THREE.DoubleSide, toneMapped: false }), N);
  room.add(mesh);
  const ps = Array.from({ length: N }, () => ({ x: (Math.random() * 2 - 1) * half, z: (Math.random() * 2 - 1) * half, y: FLOOR_Y + Math.random() * m(5), v: 0.15 + Math.random() * 0.25, ph: Math.random() * 6 }));
  const mtx = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const one = new THREE.Vector3(1, 1, 1);
  const pos = new THREE.Vector3();
  return (dt, now) => {
    ps.forEach((p, i) => {
      p.y -= p.v * dt;
      if (p.y < FLOOR_Y) { p.y = FLOOR_Y + m(5); p.x = (Math.random() * 2 - 1) * half; p.z = (Math.random() * 2 - 1) * half; }
      e.set(now / 700 + p.ph, now / 900 + p.ph, 0);
      q.setFromEuler(e);
      pos.set(p.x + Math.sin(now / 1200 + p.ph) * 0.4, p.y, p.z);
      mtx.compose(pos, q, one);
      mesh.setMatrixAt(i, mtx);
    });
    mesh.instanceMatrix.needsUpdate = true;
  };
}

// ---------- furniture ----------
// A low round table of black lacquer, silk cushions round it.
function lowTable(room, x, z, silk) {
  const top = new THREE.Mesh(new THREE.CylinderGeometry(m(0.6), m(0.6), m(0.05), 32), blackLacquer);
  top.position.set(x, FLOOR_Y + m(0.33), z);
  room.add(top);
  const leg = new THREE.Mesh(new THREE.CylinderGeometry(m(0.35), m(0.4), m(0.3), 24), blackLacquer);
  leg.position.set(x, FLOOR_Y + m(0.15), z);
  room.add(leg);
  const gold = new THREE.Mesh(new THREE.TorusGeometry(m(0.6), m(0.012), 6, 48), new THREE.MeshStandardMaterial({ color: 0xc9a24f, roughness: 0.3, metalness: 0.9 }));
  gold.rotation.x = Math.PI / 2;
  gold.position.set(x, FLOOR_Y + m(0.355), z);
  room.add(gold);
  const cushion = new THREE.MeshStandardMaterial({ color: silk, roughness: 0.6 });
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const c = new RoundedCushion(m(0.62), m(0.12), cushion);
    c.position.set(x + Math.cos(a) * m(1.0), FLOOR_Y + m(0.06), z + Math.sin(a) * m(1.0));
    c.rotation.y = -a;
    room.add(c);
  }
}
class RoundedCushion extends THREE.Mesh {
  constructor(size, h, mat) {
    const g = new THREE.BoxGeometry(size, h, size, 2, 1, 2);
    super(g, mat);
  }
}
// The tea-house bar: a cedar counter under navy noren, sake bottles on
// the shelves behind, a red lantern at each end.
function teaBar(room) {
  const len = m(5);
  const x = -P + m(0.9) + len / 2;
  const z = -P + m(1.9);
  const cedar = new THREE.MeshStandardMaterial({ color: 0xc89060, roughness: 0.55 });
  const counter = new THREE.Mesh(new THREE.BoxGeometry(len, m(1.0), m(0.6)), cedar);
  counter.position.set(x, FLOOR_Y + m(0.5), z);
  room.add(counter);
  const top = new THREE.Mesh(new THREE.BoxGeometry(len + m(0.1), m(0.08), m(0.72)), darkWood);
  top.position.set(x, FLOOR_Y + m(1.04), z);
  room.add(top);
  // The noren: cloth panels hung from a rod over the counter, the crest
  // on them.
  const norenTex = (() => {
    const c = document.createElement('canvas');
    c.width = 1024; c.height = 256;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#1c2a5a';
    ctx.fillRect(0, 0, 1024, 256);
    for (let i = 1; i < 5; i++) { ctx.fillStyle = '#0e1530'; ctx.fillRect((i / 5) * 1024 - 3, 30, 6, 226); }
    drawCasinoCrest(ctx, { x: 512, y: 140, width: 300, alpha: 1, rgb: '236,226,200' });
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  })();
  const noren = new THREE.Mesh(new THREE.PlaneGeometry(len, m(0.8)), new THREE.MeshLambertMaterial({ map: norenTex, side: THREE.DoubleSide }));
  noren.position.set(x, FLOOR_Y + m(2.25), z + m(0.32));
  room.add(noren);
  const rod = new THREE.Mesh(new THREE.CylinderGeometry(m(0.02), m(0.02), len + m(0.3), 8), darkWood);
  rod.rotation.z = Math.PI / 2;
  rod.position.set(x, FLOOR_Y + m(2.66), z + m(0.32));
  room.add(rod);
  // Shelves of sake behind.
  const back = new THREE.Mesh(new THREE.BoxGeometry(len, m(2.6), m(0.3)), darkWood);
  back.position.set(x, FLOOR_Y + m(1.3), -P + m(0.25));
  room.add(back);
  const sake = new THREE.CylinderGeometry(m(0.045), m(0.06), m(0.3), 12);
  const mats = [0xf2efe6, 0x2a4a2a, 0x1c2a5a, 0x6a2a1a].map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.3 }));
  [1.1, 1.6, 2.1].forEach((y, row) => {
    const shelf = new THREE.Mesh(new THREE.BoxGeometry(len - m(0.2), m(0.04), m(0.3)), cedar);
    shelf.position.set(x, FLOOR_Y + m(y), -P + m(0.5));
    room.add(shelf);
    for (let i = 0; i < 26; i++) {
      const b = new THREE.Mesh(sake, mats[(i + row) % 4]);
      b.position.set(x - len / 2 + m(0.25) + i * m(0.175), FLOOR_Y + m(y) + m(0.17), -P + m(0.5));
      room.add(b);
    }
  });
  [-1, 1].forEach((s) => {
    const l = new THREE.Mesh(new THREE.SphereGeometry(m(0.3), 16, 12), new THREE.MeshBasicMaterial({ color: 0xff5a3a, toneMapped: false }));
    l.scale.y = 1.3;
    l.position.set(x + s * (len / 2 + m(0.2)), FLOOR_Y + m(2.0), z + m(0.3));
    room.add(l);
  });
  // Low stools of cedar.
  for (let i = 0; i < 5; i++) {
    const st = new THREE.Mesh(new THREE.CylinderGeometry(m(0.2), m(0.18), m(0.7), 12), cedar);
    st.position.set(x - len / 2 + (i + 0.5) * (len / 5), FLOOR_Y + m(0.35), z + m(0.7));
    room.add(st);
  }
  room.userData.bar = {
    bartender: { pos: new THREE.Vector3(x - len * 0.1, 0, -P + m(0.85)), yaw: 0 },
    pickup: { pos: new THREE.Vector3(x + len / 2 + m(0.6), 0, z), look: new THREE.Vector3(x, 0, z) },
  };
}

// ---------- the room ----------
export const FULL_HOUSE = {
  tableGlow: 0xffb070,
  half,
  ceilingY: CEIL + m(0.2),
  open: { back: true, sides: true, front: true },
  ceiling: null, noPanel: true, noCove: true,
  floorPx: 512, floorRepeat: 72 / 3,
  paintFloor: paintGravel,
  accent: 0xc9a24f, cove: 0xffc070, diffuser: 0xffe6c0, washAlpha: 0,
  wall: { style: 'panels', base: 0x2a1a10, wainscot: 0x2a1a10, rail: 0xc9a24f, skirting: 0x1a1008 },
  floor: { style: 'ornate', base: 0xb8b6ae, pattern: 0x6a6860 },
  light: { sky: 0xb4c0e8, ground: 0x4a3a28, fill: 1.9, key: 0xffe6c8, keyPower: 92, wash: 0xffc890, washPower: 30, fog: 0x0a0e1a, fogNear: 50, fogFar: 150 },
  furnish(room, h, CEILING_Y) {
    const updates = [];
    const sky = cameraDome(NIGHT, { uMoon: { value: new THREE.Vector3(0.35, 0.36, -0.86).normalize() } });
    room.add(sky);
    updates.push(sky.userData.tick);
    // The garden beyond the room's edge, out to the mountains.
    const tex = gravelTexture();
    tex.repeat.set(40, 40);
    const ground = new THREE.Mesh(new THREE.CircleGeometry(140, 64), new THREE.MeshLambertMaterial({ map: tex, color: 0x9a988e }));
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = FLOOR_Y - 0.02;
    room.add(ground);
    pavilion(room);
    updates.push(lanterns(room));
    torii(room);
    updates.push(koiPond(room, 0, -P - m(6.5), m(6), m(3.6)));
    // Cherry trees round the garden, stone lanterns along the deck, bamboo
    // in the corners, rocks in raked gravel.
    [[-P - m(4), -P - m(3)], [P + m(4), -P - m(3)], [-P - m(5), m(2)], [P + m(5), m(2)], [-P - m(3.5), P + m(4)], [P + m(3.5), P + m(4)], [-m(9), -P - m(10)], [m(9), -P - m(10)], [0, P + m(6)]].forEach(([x, z], i) => cherryTree(room, x, z, 1.1 + (i % 3) * 0.25));
    [[-m(4), -P - m(1.2)], [m(4), -P - m(1.2)], [-P - m(1.2), -m(6)], [-P - m(1.2), m(6)], [P + m(1.2), -m(6)], [P + m(1.2), m(6)], [-m(6), P + m(1.2)], [m(6), P + m(1.2)]].forEach(([x, z]) => stoneLantern(room, x, z));
    [[-P - m(7), -P - m(7)], [P + m(7), -P - m(7)], [-P - m(7), P + m(7)], [P + m(7), P + m(7)]].forEach(([x, z]) => bamboo(room, x, z));
    [[-P - m(8), -m(4)], [P + m(8), m(5)], [m(5), P + m(8)]].forEach(([x, z]) => rockGarden(room, x, z));
    updates.push(petals(room));
    // Inside the pavilion: low tables with cushions, the tea-house bar.
    [[-m(9), m(2)], [m(9), m(2)], [-m(9), m(8)], [m(9), m(8)], [m(9), -m(5)]].forEach(([x, z], i) => lowTable(room, x, z, [0x9a1a24, 0xc9a24f, 0x1c2a5a][i % 3]));
    teaBar(room);

    walkway(room);
    staffPosts(room, [[10, -9.6], [-10.2, 10.2], [10.2, 10.2]]);
    room.userData.update = (dt, now) => updates.forEach((u) => u(dt, now));
  },
};
