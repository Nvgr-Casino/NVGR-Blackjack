import * as THREE from 'three';
import { place } from './furniture.js';
import { FLOOR_Y, m } from './scale.js';
import { createRug, createDrape, createBrandSign, createTrayCeiling, createBackBar } from './luxury.js';
import { lounge, walkway, facing, barCorner, brandSign, staffPosts } from './layout.js';
import { onyxMaterial } from './onyx.js';

// The High Roller: a sky lounge on the top floor of a tower, New York at
// night through glass floor to ceiling on three sides (room.js's
// createSkyline). What is in it is made to be looked at:
//
//   - over the table, a chandelier of crystal rain: hundreds of glowing
//     drops on fine threads, falling in a spiral, catching the light and
//     twinkling;
//   - along the right-hand glass, an infinity pool lit from within, its
//     water moving, the city beyond its edge;
//   - searchlights sweeping slowly across the sky over the city;
//   - a bar of backlit amber onyx, glowing from inside the stone;
//   - a lounge round a long fire table at the back right, turned to the
//     view;
//   - black marble underfoot, inlaid with gold, a line of gold light along
//     the foot of all the glass;
//   - the house sign hung on fine cables before the glass over the dealer;
//   - a black grand piano by the glass, its lid up; a tower of champagne
//     by the bar; walls of wine either side of the second sign, behind the
//     players, and great gilt-framed pictures beyond them.
//
// The drapes that once hung between every bay are gone but for the
// corners: they framed the view by cutting it up.

// ---------- the floor ----------
// Black marble in large slabs, soft white veins, a fine gold inlay between
// the slabs.
export function paintPenthouseFloor(ctx, S) {
  ctx.fillStyle = '#1a1920';
  ctx.fillRect(0, 0, S, S);
  for (let v = 0; v < 14; v++) {
    ctx.strokeStyle = `rgba(220,214,200,${0.06 + Math.random() * 0.1})`;
    ctx.lineWidth = 1 + Math.random() * 2.5;
    ctx.beginPath();
    let x = Math.random() * S, y = 0;
    ctx.moveTo(x, y);
    while (y < S) { x += (Math.random() - 0.5) * 70; y += 25 + Math.random() * 40; ctx.lineTo(x, y); }
    ctx.stroke();
  }
  const img = ctx.getImageData(0, 0, S, S);
  for (let i = 0; i < img.data.length; i += 4) { const n = (Math.random() - 0.5) * 8; img.data[i] += n; img.data[i + 1] += n; img.data[i + 2] += n; }
  ctx.putImageData(img, 0, 0);
  ctx.strokeStyle = 'rgba(214,180,110,0.85)';
  ctx.lineWidth = 3;
  ctx.strokeRect(1.5, 1.5, S - 3, S - 3);
}

// ---------- the chandelier of crystal rain ----------
// Drops on threads from a gilt ring in the ceiling, in a falling spiral —
// longest at the back of the ring away from the sign's line of sight, so
// no seat looks at the sign through them — each one twinkling now and then.
function crystalRain(room, CEILING_Y, center) {
  const N = 900;
  const ringR = m(3.0);
  const drop = new THREE.OctahedronGeometry(m(0.035), 0);
  drop.scale(1, 1.8, 1);
  const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false });
  const crystals = new THREE.InstancedMesh(drop, mat, N);
  const mtx = new THREE.Matrix4();
  const base = [];
  const threads = [];
  const lowest = 5.1;   // world y: kept above the line from any seat to the sign
  for (let i = 0; i < N; i++) {
    const turn = i / N;
    const a = turn * Math.PI * 2 * 7 + (Math.random() - 0.5) * 0.08;
    const r = ringR * (0.25 + 0.75 * ((i * 37) % N) / N);
    const x = center.x + Math.cos(a) * r;
    const z = center.z + Math.sin(a) * r;
    // A spiral that falls toward the middle.
    const depth = (1 - r / ringR) * (CEILING_Y - lowest) * 0.85 + Math.sin(a * 1.0) * 0.25 + 0.4;
    const y = Math.max(lowest, CEILING_Y - depth);
    mtx.makeRotationY(Math.random() * Math.PI);
    mtx.setPosition(x, y, z);
    crystals.setMatrixAt(i, mtx);
    crystals.setColorAt(i, new THREE.Color(0xfff1d6));
    base.push(new THREE.Color().setHSL(0.11, 0.6, 0.78 + Math.random() * 0.12));
    threads.push(new THREE.Vector3(x, CEILING_Y, z), new THREE.Vector3(x, y + m(0.06), z));
  }
  crystals.instanceColor.needsUpdate = true;
  room.add(crystals);
  room.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(threads),
    new THREE.LineBasicMaterial({ color: 0xd8c08a, transparent: true, opacity: 0.35 })));
  const brass = new THREE.MeshStandardMaterial({ color: 0xc9a86a, roughness: 0.25, metalness: 0.9 });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(ringR + m(0.1), m(0.06), 8, 64), brass);
  ring.rotation.x = Math.PI / 2;
  ring.position.set(center.x, CEILING_Y - m(0.04), center.z);
  room.add(ring);
  const glow = new THREE.Mesh(new THREE.CircleGeometry(ringR + m(0.05), 48), new THREE.MeshBasicMaterial({ color: 0xffd9a0, toneMapped: false, transparent: true, opacity: 0.35 }));
  glow.rotation.x = Math.PI / 2;
  glow.position.set(center.x, CEILING_Y - 0.01, center.z);
  room.add(glow);
  // Twinkling: a few drops at a time flare and fade.
  const flare = new Float32Array(N);
  const c = new THREE.Color();
  return (dt) => {
    for (let k = 0; k < 6; k++) flare[Math.floor(Math.random() * N)] = 1;
    for (let i = 0; i < N; i++) {
      if (flare[i] <= 0) continue;
      flare[i] = Math.max(0, flare[i] - dt * 1.6);
      c.copy(base[i]).lerp(new THREE.Color(0xffffff), flare[i]).multiplyScalar(1 + flare[i] * 1.6);
      crystals.setColorAt(i, c);
    }
    crystals.instanceColor.needsUpdate = true;
  };
}

// ---------- the infinity pool ----------
const WATER_VERT = `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const WATER_FRAG = `
uniform float uTime;
uniform vec2 uSize;
varying vec2 vUv;
float wave(vec2 p, float t) {
  return sin(p.x * 3.1 + t * 1.3) * 0.5 + sin(p.y * 2.3 - t * 1.1) * 0.5
       + sin((p.x + p.y) * 4.7 + t * 1.9) * 0.35 + sin((p.x - p.y) * 6.1 - t * 2.3) * 0.25;
}
void main() {
  vec2 p = vUv * uSize;
  float t = uTime;
  float w = wave(p, t);
  // Caustics: the bright net of light on the floor of a lit pool.
  float n = abs(sin(p.x * 5.0 + w * 1.6 + t * 0.7)) * abs(sin(p.y * 5.0 - w * 1.4 - t * 0.6));
  float caustic = pow(1.0 - n, 8.0);
  vec3 deep = vec3(0.02, 0.36, 0.50);
  vec3 shallow = vec3(0.10, 0.72, 0.82);
  vec3 col = mix(deep, shallow, 0.55 + 0.25 * w);
  col += vec3(0.75, 0.95, 1.0) * caustic * 0.55;
  // The far edge, where it spills over toward the city: brighter, as the
  // light catches the lip.
  col += vec3(0.6, 0.85, 1.0) * smoothstep(0.92, 1.0, vUv.x) * 0.5;
  gl_FragColor = vec4(col, 1.0);
}`;

function infinityPool(room, x0, x1, z0, z1, ceilingY) {
  const w = x1 - x0, d = z1 - z0;
  const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
  const water = new THREE.Mesh(new THREE.PlaneGeometry(w, d),
    new THREE.ShaderMaterial({ vertexShader: WATER_VERT, fragmentShader: WATER_FRAG, uniforms: { uTime: { value: 0 }, uSize: { value: new THREE.Vector2(w / 2.5, d / 2.5) } } }));
  water.rotation.x = -Math.PI / 2;
  water.position.set(cx, FLOOR_Y + 0.02, cz);
  room.add(water);
  // A coping of white stone round three sides; the side to the glass is
  // the infinity edge, a fine line of light.
  const stone = new THREE.MeshStandardMaterial({ color: 0xece6da, roughness: 0.4, metalness: 0 });
  const c = m(0.3);
  [[w + c * 2, c, cx, z0 - c / 2], [w + c * 2, c, cx, z1 + c / 2], [c, d, x0 - c / 2, cz]].forEach(([bw, bd, x, z]) => {
    const b = new THREE.Mesh(new THREE.BoxGeometry(bw, 0.06, bd), stone);
    b.position.set(x, FLOOR_Y + 0.03, z);
    room.add(b);
  });
  const lip = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.04, d), new THREE.MeshBasicMaterial({ color: 0x8fe6ff, toneMapped: false }));
  lip.position.set(x1 + 0.03, FLOOR_Y + 0.025, cz);
  room.add(lip);
  // Its light thrown up on the ceiling over it.
  const halo = new THREE.Mesh(new THREE.PlaneGeometry(w * 1.1, d * 1.05), new THREE.MeshBasicMaterial({ color: 0x3fb8d0, transparent: true, opacity: 0.14, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
  halo.rotation.x = Math.PI / 2;
  halo.position.set(cx, ceilingY - 0.02, cz);
  room.add(halo);
  // Loungers along the deck on its inner side, set back from the edge.
  for (let z = z0 + m(1.0); z < z1 - m(0.6); z += m(1.8)) place(room, 'mid_century_lounge_chair', { x: x0 - m(1.7), z, yaw: Math.PI / 2 });
  // And between the deck and the room, a long stone planter of palms, so
  // the pool is a place of its own.
  const px = x0 - m(3.6);
  const darkStone = new THREE.MeshStandardMaterial({ color: 0x1d1c22, roughness: 0.3, metalness: 0.1 });
  const planter = new THREE.Mesh(new THREE.BoxGeometry(m(0.8), m(0.55), d * 0.9), darkStone);
  planter.position.set(px, FLOOR_Y + m(0.275), cz);
  room.add(planter);
  const trim = new THREE.Mesh(new THREE.BoxGeometry(m(0.84), m(0.03), d * 0.9 + m(0.04)), new THREE.MeshStandardMaterial({ color: 0xc9a86a, roughness: 0.3, metalness: 0.9 }));
  trim.position.set(px, FLOOR_Y + m(0.56), cz);
  room.add(trim);
  for (let z = z0 + m(0.8); z < z1 - m(0.4); z += m(1.7)) place(room, 'potted_plant_02', { x: px, y: FLOOR_Y + m(0.4), z, size: 2.3 });
  return (dt, now) => { water.material.uniforms.uTime.value = now / 1000; };
}

// ---------- searchlights over the city ----------
// Pale beams rising from the city and sweeping slowly back and forth —
// out beyond the glass, in front of the skyline.
function searchlights(room, half) {
  const c = document.createElement('canvas');
  c.width = 64; c.height = 256;
  const ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 256, 0, 0);
  g.addColorStop(0, 'rgba(220,230,255,0.55)');
  g.addColorStop(1, 'rgba(220,230,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 256);
  const side = ctx.createLinearGradient(0, 0, 64, 0);
  side.addColorStop(0, 'rgba(0,0,0,1)'); side.addColorStop(0.5, 'rgba(0,0,0,0)'); side.addColorStop(1, 'rgba(0,0,0,1)');
  ctx.globalCompositeOperation = 'destination-out';
  ctx.fillStyle = side;
  ctx.fillRect(0, 0, 64, 256);
  const tex = new THREE.CanvasTexture(c);
  const beams = [];
  [[-0.55, 1.0], [0.35, 1.25], [1.05, 0.8]].forEach(([az, speed], i) => {
    const pivot = new THREE.Group();
    const r = half * 2.0;
    pivot.position.set(Math.sin(az) * r, -half * 0.6, -Math.cos(az) * r);
    const len = half * 2.4;
    const beam = new THREE.Mesh(new THREE.PlaneGeometry(half * 0.22, len),
      new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false, toneMapped: false }));
    beam.position.y = len / 2;
    pivot.add(beam);
    // Faces the room's middle, so it is seen broadside.
    pivot.lookAt(0, pivot.position.y, 0);
    room.add(pivot);
    beams.push({ pivot, speed, phase: i * 2.1, baseZ: pivot.rotation.z });
  });
  // Each swings slowly to and fro in the plane it is seen in.
  return (dt, now) => {
    const t = now / 1000;
    beams.forEach((b) => { b.pivot.rotation.z = b.baseZ + Math.sin(t * 0.12 * b.speed + b.phase) * 0.5; });
  };
}

// ---------- the fire table ----------
function fireTable(room, x, z, length) {
  const stone = new THREE.MeshStandardMaterial({ color: 0x1b1a1f, roughness: 0.35, metalness: 0.1 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(length, m(0.42), m(0.7)), stone);
  body.position.set(x, FLOOR_Y + m(0.21), z);
  room.add(body);
  const glass = new THREE.Mesh(new THREE.BoxGeometry(length * 0.85, m(0.02), m(0.22)), new THREE.MeshBasicMaterial({ color: 0xff8a3a, toneMapped: false }));
  glass.position.set(x, FLOOR_Y + m(0.43), z);
  room.add(glass);
  const fc = document.createElement('canvas');
  fc.width = 128; fc.height = 256;
  const fx = fc.getContext('2d');
  const fg = fx.createRadialGradient(64, 230, 4, 64, 200, 130);
  fg.addColorStop(0, 'rgba(255,245,200,1)');
  fg.addColorStop(0.3, 'rgba(255,160,50,0.9)');
  fg.addColorStop(0.7, 'rgba(220,70,10,0.35)');
  fg.addColorStop(1, 'rgba(120,20,0,0)');
  fx.fillStyle = fg;
  fx.fillRect(0, 0, 128, 256);
  const tex = new THREE.CanvasTexture(fc);
  tex.colorSpace = THREE.SRGBColorSpace;
  const flames = [];
  const n = Math.round(length / m(0.25));
  for (let i = 0; i < n; i++) {
    const f = new THREE.Mesh(new THREE.PlaneGeometry(m(0.3), m(0.45)), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false }));
    f.position.set(x - length * 0.42 + (i + 0.5) * (length * 0.84 / n), FLOOR_Y + m(0.43) + m(0.2), z);
    f.rotation.y = (i % 2) * Math.PI / 2;
    room.add(f);
    flames.push(f);
  }
  return (dt, now) => flames.forEach((f, i) => {
    const t = now / 1000 + i * 1.3;
    f.scale.set(0.85 + Math.sin(t * 3.3) * 0.1, 0.8 + Math.sin(t * 4.7 + i) * 0.2 + Math.sin(t * 11.0) * 0.06, 1);
  });
}

// ---------- a grand piano ----------
// Black lacquer: the case in the shape of a grand seen from above —
// straight along the spine, the curve of the bentside to the tail — its
// lid propped open on a stick, a keyboard, three legs, a bench.
function keysTexture() {
  const c = document.createElement('canvas');
  c.width = 1024; c.height = 64;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#f4f0e6';
  ctx.fillRect(0, 0, 1024, 64);
  const white = 1024 / 52;
  for (let i = 0; i <= 52; i++) { ctx.fillStyle = '#b8b2a6'; ctx.fillRect(i * white, 0, 1.5, 64); }
  const pattern = [1, 1, 0, 1, 1, 1, 0];
  for (let i = 0; i < 51; i++) {
    if (!pattern[(i + 5) % 7]) continue;
    ctx.fillStyle = '#101012';
    ctx.fillRect((i + 1) * white - white * 0.3, 0, white * 0.6, 38);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
function grandPiano(room, x, z, yaw) {
  const g = new THREE.Group();
  const lacquer = new THREE.MeshStandardMaterial({ color: 0x08080a, roughness: 0.1, metalness: 0.25 });
  const W = m(1.5), L = m(2.1);
  const outline = new THREE.Shape();
  outline.moveTo(0, 0);
  outline.lineTo(W, 0);
  outline.lineTo(W, -L * 0.32);
  outline.bezierCurveTo(W, -L * 0.72, W * 0.55, -L * 0.58, W * 0.42, -L * 0.96);
  outline.bezierCurveTo(W * 0.32, -L * 1.06, 0, -L * 1.02, 0, -L * 0.86);
  outline.lineTo(0, 0);
  const top = m(1.0);
  const body = new THREE.Mesh(new THREE.ExtrudeGeometry(outline, { depth: m(0.32), bevelEnabled: true, bevelThickness: m(0.01), bevelSize: m(0.01), bevelSegments: 2, curveSegments: 24 }), lacquer);
  body.rotation.x = Math.PI / 2;
  body.position.y = FLOOR_Y + top;
  g.add(body);
  // The lid, hinged along the spine and propped up.
  const hinge = new THREE.Group();
  hinge.position.set(0, FLOOR_Y + top + m(0.012), 0);
  hinge.rotation.z = 0.55;
  g.add(hinge);
  const lid = new THREE.Mesh(new THREE.ExtrudeGeometry(outline, { depth: m(0.02), bevelEnabled: false, curveSegments: 24 }), lacquer);
  lid.rotation.x = Math.PI / 2;
  lid.position.y = m(0.02);
  hinge.add(lid);
  const gold = new THREE.MeshStandardMaterial({ color: 0xc9a86a, roughness: 0.3, metalness: 0.9 });
  const stickLen = Math.sin(0.55) * W * 0.85;
  const stick = new THREE.Mesh(new THREE.CylinderGeometry(m(0.008), m(0.008), stickLen, 6), gold);
  stick.position.set(W * 0.85, FLOOR_Y + top + stickLen / 2, -L * 0.4);
  g.add(stick);
  // The keyboard, its fallboard and the cheeks either side.
  const keys = new THREE.Mesh(new THREE.BoxGeometry(W * 0.9, m(0.03), m(0.17)), [lacquer, lacquer, new THREE.MeshStandardMaterial({ map: keysTexture(), roughness: 0.3 }), lacquer, lacquer, lacquer]);
  keys.position.set(W / 2, FLOOR_Y + top - m(0.2), m(0.085));
  g.add(keys);
  const fall = new THREE.Mesh(new THREE.BoxGeometry(W * 0.9, m(0.12), m(0.03)), lacquer);
  fall.position.set(W / 2, FLOOR_Y + top - m(0.12), m(0.0));
  g.add(fall);
  [0.03, 0.97].forEach((k) => {
    const cheek = new THREE.Mesh(new THREE.BoxGeometry(m(0.05), m(0.2), m(0.2)), lacquer);
    cheek.position.set(W * k, FLOOR_Y + top - m(0.2), m(0.09));
    g.add(cheek);
  });
  // Legs, each with a brass castor.
  [[W * 0.08, m(0.06)], [W * 0.92, m(0.06)], [W * 0.38, -L * 0.88]].forEach(([lx, lz]) => {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(m(0.05), m(0.035), top - m(0.32), 12), lacquer);
    leg.position.set(lx, FLOOR_Y + (top - m(0.32)) / 2, lz);
    g.add(leg);
    const castor = new THREE.Mesh(new THREE.CylinderGeometry(m(0.04), m(0.04), m(0.04), 12), gold);
    castor.position.set(lx, FLOOR_Y + m(0.02), lz);
    g.add(castor);
  });
  const bench = new THREE.Mesh(new THREE.BoxGeometry(W * 0.6, m(0.08), m(0.38)), lacquer);
  bench.position.set(W / 2, FLOOR_Y + m(0.48), m(0.62));
  g.add(bench);
  [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(m(0.04), m(0.44), m(0.04)), lacquer);
    leg.position.set(W / 2 + sx * W * 0.27, FLOOR_Y + m(0.22), m(0.62) + sz * m(0.15));
    g.add(leg);
  });
  g.position.set(x, 0, z);
  g.rotation.y = yaw;
  room.add(g);
}

// ---------- a tower of champagne ----------
// Coupes stacked in a pyramid on a round table, each brimming, the whole
// of it catching the light.
function champagneTower(room, x, z) {
  // Its own round table of white marble on a gilt stem, a known height.
  const TOP = m(0.9);
  const marble = new THREE.MeshStandardMaterial({ color: 0xf2ede4, roughness: 0.2 });
  const gilt = new THREE.MeshStandardMaterial({ color: 0xc9a86a, roughness: 0.3, metalness: 0.9 });
  const top = new THREE.Mesh(new THREE.CylinderGeometry(m(0.5), m(0.5), m(0.04), 40), marble);
  top.position.set(x, FLOOR_Y + TOP - m(0.02), z);
  room.add(top);
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(m(0.04), m(0.06), TOP - m(0.04), 16), gilt);
  stem.position.set(x, FLOOR_Y + (TOP - m(0.04)) / 2, z);
  room.add(stem);
  const foot = new THREE.Mesh(new THREE.CylinderGeometry(m(0.24), m(0.27), m(0.04), 32), gilt);
  foot.position.set(x, FLOOR_Y + m(0.02), z);
  room.add(foot);
  const glass = new THREE.MeshStandardMaterial({ color: 0xfaf4e8, roughness: 0.05, metalness: 0.2, transparent: true, opacity: 0.7, emissive: 0x3a3020, emissiveIntensity: 0.4 });
  const wine = new THREE.MeshBasicMaterial({ color: 0xf2cf7a, toneMapped: false });
  const profile = [[0, 0], [0.04, 0], [0.04, 0.006], [0.006, 0.012], [0.005, 0.1], [0.02, 0.11], [0.055, 0.125], [0.06, 0.145]].map(([px, py]) => new THREE.Vector2(m(px * 1.3), m(py * 1.3)));
  const coupe = new THREE.LatheGeometry(profile, 16);
  const fill = new THREE.CircleGeometry(m(0.068), 16);
  const H = m(0.145 * 1.3), step = m(0.155);
  let y = FLOOR_Y + TOP;
  for (let n = 4; n >= 1; n--) {
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        const gx = x + (i - (n - 1) / 2) * step, gz = z + (j - (n - 1) / 2) * step;
        const c = new THREE.Mesh(coupe, glass);
        c.position.set(gx, y, gz);
        room.add(c);
        const f = new THREE.Mesh(fill, wine);
        f.rotation.x = -Math.PI / 2;
        f.position.set(gx, y + H - m(0.008), gz);
        room.add(f);
      }
    }
    y += H;
  }
}

// ---------- the room ----------
// The largest room by far: 28 m of floor across, and tall, with a pool
// deck of its own down the right-hand side.
export const HIGH_ROLLER = {
  tableGlow: 0xffe2b0,
  half: 36,
  ceilingY: 11.0,
  windows: true,
  wall: { style: 'lacquer', base: 0x17171b, trim: 0xc9a86a, skirting: 0x08080a },
  floor: { style: 'marble', base: 0x121116, pattern: 0xd9d2c3 },
  floorPx: 1024, floorRepeat: 72 / 5,
  paintFloor: paintPenthouseFloor,
  noPanel: true,
  ceiling: 0x161a2c, ceilingGlow: 0.3, cove: 0xd8b878, diffuser: 0xc8aa80, accent: 0xd8b46e, washAlpha: 0.16,
  light: { sky: 0xd4dcff, ground: 0x3a2c38, fill: 1.6, key: 0xffe6c8, keyPower: 96, wash: 0xffd8b0, washPower: 34, fog: 0x05060b, fogNear: 30, fogFar: 90 },
  furnish(room, half, CEILING_Y) {
    const wallH = CEILING_Y - FLOOR_Y;
    const updates = [];
    // Drapes only at the corners, framing the glass.
    const velvet = 0x2a1418;
    [-1, 1].forEach((side) => {
      const d1 = createDrape(wallH - 0.4, m(0.9), velvet);
      d1.position.set(side * (half - m(0.5)), FLOOR_Y, -half + 0.25);
      room.add(d1);
      const d2 = createDrape(wallH - 0.4, m(0.9), velvet);
      d2.position.set(side * (half - 0.25), FLOOR_Y, half - m(0.6));
      d2.rotation.y = -side * Math.PI / 2;
      room.add(d2);
    });
    // A line of gold light along the foot of all the glass.
    const goldLight = new THREE.MeshBasicMaterial({ color: 0xffcf80, toneMapped: false });
    [[2 * half, 0.04, 0, -half + 0.12], [0.04, 2 * half, -half + 0.12, 0], [0.04, 2 * half, half - 0.12, 0]].forEach(([w, d, x, z]) => {
      const strip = new THREE.Mesh(new THREE.BoxGeometry(w, 0.03, d), goldLight);
      strip.position.set(x, FLOOR_Y + 0.02, z);
      room.add(strip);
    });

    // The house sign, larger, hung on fine cables from the ceiling behind
    // the dealer — out over the floor, not at the far glass, where in a
    // room this size it would be small.
    const signW = m(3.0);
    const sign = createBrandSign(signW, { rgb: '236,202,128', plate: '#0b0b0f', halo: false });
    const signY = FLOOR_Y + m(2.85);
    const signZ = -m(9.0);
    sign.position.set(0, signY, signZ);
    room.add(sign);
    const cableMat = new THREE.MeshStandardMaterial({ color: 0xc9a86a, roughness: 0.3, metalness: 0.9 });
    [-1, 1].forEach((s) => {
      const len = CEILING_Y - (signY + signW * 0.31);
      const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, len, 6), cableMat);
      cable.position.set(s * signW * 0.42, signY + signW * 0.31 + len / 2, signZ);
      room.add(cable);
    });
    brandSign(room, half, { wall: 'front', width: m(2.2), rgb: '236,202,128', plate: '#0b0b0f' });

    // Tray ceilings one inside the other, each ringed with gold light, so
    // the great ceiling is a thing to look up at, not a dark void.
    room.add(createTrayCeiling(54, 46, CEILING_Y, 0xe8c48a, 0x1c2034));
    room.add(createTrayCeiling(30, 25, CEILING_Y - m(0.25), 0xe8c48a, 0x1c2034));

    // Crystal rain over the table.
    updates.push(crystalRain(room, CEILING_Y, new THREE.Vector3(0, 0, -0.4)));

    // A rug under the table and chairs.
    room.add(createRug(26, 21, { base: '#5a1622', border: '#2a0a10', accent: '#e0bf72' }));

    // The onyx bar, at the back left.
    barCorner(room, half, CEILING_Y, { length: m(3.8), bodyMaterial: onyxMaterial(), top: 0x111014, wood: 0x16121a, rgb: '216,180,110', lamp: 'Chandelier_03', lampSize: 1.4 });

    // The fire-table lounge at the back right, turned to the view.
    const fx = half - m(3.1), fz = -half + m(2.6);
    updates.push(fireTable(room, fx, fz, m(1.8)));
    [[0, 1.2, 'Sofa_01'], [0, -1.15, 'Sofa_01'], [-1.6, 0, 'mid_century_lounge_chair']].forEach(([dx, dz, id]) => {
      const px = fx + m(dx), pz = fz + m(dz);
      place(room, id, { x: px, z: pz, yaw: facing(px, pz, fx, fz), size: id === 'Sofa_01' ? 1.1 : 1 });
    });
    const r = createRug(m(4.2), m(4.0), { base: '#1d1a22', border: '#0d0b10', accent: '#c9a86a' });
    r.position.set(fx, FLOOR_Y + 0.006, fz);
    room.add(r);

    // The infinity pool along the right-hand glass.
    updates.push(infinityPool(room, half - m(5.3), half - m(0.35), -m(6.0), m(9.0), CEILING_Y));

    // A lounge on the left, and palms.
    lounge(room, half, -1, m(0.9), { sofa: 'Sofa_01', chair: 'mid_century_lounge_chair', sofaSize: 1.15, rug: { base: '#24161b', border: '#120b0e', accent: '#c9a86a' } });
    place(room, 'Chandelier_03', { x: -(half - m(1.55)), y: CEILING_Y, z: m(0.9), size: 2.2 });
    [[-(half - m(0.6)), m(3.6)], [-(half - m(0.6)), half - m(0.8)], [half - m(0.6), half - m(0.8)], [half - m(0.6), -m(3.4)]].forEach(([x, z]) => place(room, 'potted_plant_04', { x, z, size: 2.2 }));
    // Art on plinths flanking the sign.
    [-1, 1].forEach((side) => {
      place(room, 'side_table_tall_01', { x: side * m(2.6), z: -half + m(0.6), size: 1.1 });
      place(room, side < 0 ? 'marble_bust_01' : 'horse_statue_01', { x: side * m(2.6), y: FLOOR_Y + m(0.8), z: -half + m(0.6), size: 1.25 });
    });

    // Searchlights over the city.
    updates.push(searchlights(room, half));

    // The front half of the floor: two more conversation groups, drawn up
    // round their tables and turned toward the table and the view.
    [[-m(4.2), m(7.4)], [m(1.2), m(8.4)]].forEach(([gx, gz]) => {
      place(room, 'modern_coffee_table_01', { x: gx, z: gz });
      [[0, 1.2, 'Sofa_01'], [-1.25, -0.2, 'mid_century_lounge_chair'], [1.25, -0.2, 'mid_century_lounge_chair']].forEach(([dx, dz, id]) => {
        const px = gx + m(dx), pz = gz + m(dz);
        place(room, id, { x: px, z: pz, yaw: facing(px, pz, gx, gz), size: id === 'Sofa_01' ? 1.1 : 1 });
      });
      const gr = createRug(m(3.8), m(3.4), { base: '#1d1a22', border: '#0d0b10', accent: '#c9a86a' });
      gr.position.set(gx, FLOOR_Y + 0.006, gz);
      room.add(gr);
      place(room, 'Chandelier_03', { x: gx, y: CEILING_Y, z: gz, size: 2.2 });
    });
    // A grand piano by the glass at the front left, played to the room.
    grandPiano(room, -(half - m(3.4)), m(5.2), Math.PI * 0.62);
    // A tower of champagne out from the bar.
    champagneTower(room, -half + m(6.4), -half + m(4.2));
    // Walls of wine either side of the sign behind the players, and great
    // pictures in gilt beyond them.
    [-1, 1].forEach((side) => {
      const wine = createBackBar(m(3.2), { wood: 0x14101a, rgb: '216,180,110' });
      wine.position.set(side * m(3.4), 0, half - m(0.42));
      wine.rotation.y = Math.PI;
      room.add(wine);
      place(room, 'fancy_picture_frame_01', { x: side * m(7.6), y: FLOOR_Y + m(1.9), z: half - m(0.05), yaw: Math.PI, size: 2.6 });
    });
    walkway(room, { x: 10.5, back: -9.2, front: 11.0 });
    staffPosts(room, [[13, -12.5], [-13, 13.5], [7, 16.5]]);
    room.userData.update = (dt, now) => updates.forEach((u) => u(dt, now));
  },
};
