import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { place } from './furniture.js';
import { FLOOR_Y, m } from './scale.js';
import { createBar } from './luxury.js';
import { onyxMaterial } from './onyx.js';

// The set pieces the rooms are dressed with, first made for the High
// Roller and shared by every room: floors and rugs, chandeliers and
// ceilings of light, bars, a piano, champagne, dice, fire, searchlights —
// and a dome painted round the camera, for a room open to a sky or a sea.

// ---------- a world round the camera ----------
// A sphere round the camera painted by `fragmentShader` (which gets the
// view direction as vDir, and a uTime), drawn first and behind everything:
// a sky, a sea, the deep — as far off as the horizon, and moving.
export function cameraDome(fragmentShader, uniforms = {}) {
  const mat = new THREE.ShaderMaterial({
    vertexShader: 'varying vec3 vDir;\nvoid main() { vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader,
    uniforms: { uTime: { value: 0 }, ...uniforms },
    side: THREE.BackSide, depthWrite: false, depthTest: false,
  });
  const dome = new THREE.Mesh(new THREE.SphereGeometry(45, 48, 32), mat);
  dome.renderOrder = -1000;
  dome.frustumCulled = false;
  dome.onBeforeRender = (r, s, cam) => { dome.position.copy(cam.position); dome.updateMatrixWorld(); };
  dome.userData.tick = (dt, now) => { mat.uniforms.uTime.value = now / 1000; };
  return dome;
}
// Noise for the shaders.
export const GLSL_NOISE = `
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float hash3(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
}
float fbm(vec2 p) { float v = 0.0, a = 0.5; for (int i = 0; i < 4; i++) { v += a * noise(p); p *= 2.03; a *= 0.5; } return v; }
`;

// A glowing sign or picture of light: `draw(ctx, w, h)` paints it on a
// transparent canvas; it is shown unlit, adding light, `w` by `h`.
export function lightPanel(draw, w, h, px = 1024) {
  const c = document.createElement('canvas');
  c.width = px;
  c.height = Math.round((px * h) / w);
  draw(c.getContext('2d'), c.width, c.height);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, side: THREE.DoubleSide }));
}

// ---------- the floor ----------
// White marble in large slabs, veined in grey and gold, a fine gold inlay
// between the slabs.
export function paintMarbleFloor(ctx, S) {
  ctx.fillStyle = '#ece8e1';
  ctx.fillRect(0, 0, S, S);
  for (let v = 0; v < 16; v++) {
    const gold = v % 4 === 0;
    ctx.strokeStyle = gold ? `rgba(196,160,92,${0.25 + Math.random() * 0.2})` : `rgba(120,116,110,${0.1 + Math.random() * 0.12})`;
    ctx.lineWidth = (gold ? 1.5 : 1) + Math.random() * 2.5;
    ctx.beginPath();
    let x = Math.random() * S, y = 0;
    ctx.moveTo(x, y);
    while (y < S) { x += (Math.random() - 0.5) * 80; y += 20 + Math.random() * 40; ctx.lineTo(x, y); }
    ctx.stroke();
  }
  const img = ctx.getImageData(0, 0, S, S);
  for (let i = 0; i < img.data.length; i += 4) { const n = (Math.random() - 0.5) * 6; img.data[i] += n; img.data[i + 1] += n; img.data[i + 2] += n; }
  ctx.putImageData(img, 0, 0);
  ctx.strokeStyle = 'rgba(196,160,92,0.95)';
  ctx.lineWidth = 4;
  ctx.strokeRect(2, 2, S - 4, S - 4);
}

// A round rug of navy and gold under the table, and a ring of light let
// into the marble round it.
export function roundRug(radius, { base = '#141a38', gold = '#c9a86a', bright = '#e8cd8a', z = -0.4 } = {}) {
  const S = 1536;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const ctx = c.getContext('2d');
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, S, S);
  // A fine lattice in the weave, and the borders.
  ctx.strokeStyle = 'rgba(214,180,110,0.12)';
  ctx.lineWidth = 2;
  for (let k = -S; k < S * 2; k += 48) {
    ctx.beginPath(); ctx.moveTo(k, 0); ctx.lineTo(k + S, S); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(k, S); ctx.lineTo(k + S, 0); ctx.stroke();
  }
  [[0.49, 30, gold], [0.455, 6, bright], [0.43, 3, gold], [0.2, 4, gold]].forEach(([r, w, col]) => {
    ctx.strokeStyle = col; ctx.lineWidth = w;
    ctx.beginPath(); ctx.arc(S / 2, S / 2, S * r, 0, Math.PI * 2); ctx.stroke();
  });
  const img = ctx.getImageData(0, 0, S, S);
  for (let i = 0; i < img.data.length; i += 4) { const n = (Math.random() - 0.5) * 10; img.data[i] += n; img.data[i + 1] += n; img.data[i + 2] += n; }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  const rug = new THREE.Mesh(new THREE.CircleGeometry(radius, 96), new THREE.MeshLambertMaterial({ map: tex }));
  rug.rotation.x = -Math.PI / 2;
  rug.position.set(0, FLOOR_Y + 0.006, z);
  rug.receiveShadow = true;
  return rug;
}
export function lightRing(radius, color = 0xffd58a) {
  const ring = new THREE.Mesh(new THREE.RingGeometry(radius - m(0.03), radius + m(0.03), 128), new THREE.MeshBasicMaterial({ color, toneMapped: false }));
  ring.rotation.x = -Math.PI / 2;
  ring.position.set(0, FLOOR_Y + 0.008, -0.4);
  return ring;
}

// ---------- the chandelier of crystal rain ----------
// Drops on threads from a gilt ring in the ceiling, in a falling spiral —
// longest at the back of the ring away from the sign's line of sight, so
// no seat looks at the sign through them — each one twinkling now and then.
export function crystalRain(room, CEILING_Y, center) {
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

// ---------- the starburst ceiling ----------
// Lines of gold light running out from the chandelier across the dark
// ceiling, a ring of it round the chandelier and a cove round the room.
export function starburstCeiling(room, half, CEILING_Y, color = 0xffd58a) {
  const glow = new THREE.MeshBasicMaterial({ color, toneMapped: false });
  const RAYS = 28;
  const inner = m(3.6);
  for (let i = 0; i < RAYS; i++) {
    const a = (i / RAYS) * Math.PI * 2;
    // Each runs out to the ceiling's edge.
    const reach = Math.min(half / Math.abs(Math.cos(a) || 1e-6), half / Math.abs(Math.sin(a) || 1e-6)) - m(0.8);
    const len = reach - inner;
    const ray = new THREE.Mesh(new THREE.BoxGeometry(m(0.035), m(0.02), len), glow);
    const mid = inner + len / 2;
    ray.position.set(Math.sin(a) * mid, CEILING_Y - m(0.03), -0.4 + Math.cos(a) * mid);
    ray.rotation.y = a;
    room.add(ray);
  }
  [inner, inner + m(0.25)].forEach((r) => {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(r, m(0.025), 4, 96), glow);
    ring.rotation.x = Math.PI / 2;
    ring.position.set(0, CEILING_Y - m(0.03), -0.4);
    room.add(ring);
  });
}

// ---------- piers of light up the glass ----------
export function lightPiers(room, half, CEILING_Y, color = 0xffd08a) {
  const glow = new THREE.MeshBasicMaterial({ color, toneMapped: false });
  const H = CEILING_Y - FLOOR_Y - m(0.1);
  const geo = new THREE.BoxGeometry(m(0.05), H, m(0.05));
  const step = m(3.6);
  const n = Math.floor((2 * half) / step);
  for (let i = 1; i < n; i++) {
    const t = -half + (i * 2 * half) / n;
    [[t, -half + m(0.1)], [-half + m(0.1), t], [half - m(0.1), t]].forEach(([x, z]) => {
      const pier = new THREE.Mesh(geo, glow);
      pier.position.set(x, FLOOR_Y + H / 2, z);
      room.add(pier);
    });
  }
}

// ---------- the window bar ----------
// A long counter down the right-hand glass, its onyx front to the room,
// stools on the room side turned to the view.
export function windowBar(room, half, z0, z1) {
  const len = z1 - z0;
  const cz = (z0 + z1) / 2;
  const bar = createBar(len, '216,180,110', { bodyMaterial: onyxMaterial(), top: 0x111014 });
  bar.position.set(half - m(1.4), 0, cz);
  bar.rotation.y = -Math.PI / 2;
  room.add(bar);
  const stools = Math.floor(len / m(0.85));
  for (let i = 0; i < stools; i++) {
    const z = z0 + (i + 0.5) * (len / stools);
    place(room, 'bar_chair_round_01', { x: half - m(1.95), z, yaw: Math.PI / 2 });
  }
}

// ---------- the dice ----------
// Two great gold dice on a plinth of black marble: one square on the
// plinth, the other tumbling, caught on a corner.
export function goldDice(room, x, z) {
  const plinthMat = new THREE.MeshStandardMaterial({ color: 0x141318, roughness: 0.2, metalness: 0.1 });
  const plinth = new THREE.Mesh(new THREE.BoxGeometry(m(2.2), m(0.5), m(1.5)), plinthMat);
  plinth.position.set(x, FLOOR_Y + m(0.25), z);
  room.add(plinth);
  const trim = new THREE.Mesh(new THREE.BoxGeometry(m(2.24), m(0.03), m(1.54)), new THREE.MeshStandardMaterial({ color: 0xc9a86a, roughness: 0.3, metalness: 0.9 }));
  trim.position.set(x, FLOOR_Y + m(0.5), z);
  room.add(trim);
  const S = m(0.8);
  const gold = new THREE.MeshStandardMaterial({ color: 0xd8b25e, roughness: 0.18, metalness: 1.0, emissive: 0x3a2808, emissiveIntensity: 0.35 });
  const pipMat = new THREE.MeshStandardMaterial({ color: 0x0c0b0f, roughness: 0.4 });
  const pipGeo = new THREE.CircleGeometry(S * 0.085, 20);
  // Pips on each face, laid just proud of it: 1 opposite 6, 2 opposite 5, 3 opposite 4.
  const LAYOUT = { 1: [[0, 0]], 2: [[-1, -1], [1, 1]], 3: [[-1, -1], [0, 0], [1, 1]], 4: [[-1, -1], [1, -1], [-1, 1], [1, 1]], 5: [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]], 6: [[-1, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [1, 1]] };
  const FACES = [[1, new THREE.Vector3(0, 1, 0)], [6, new THREE.Vector3(0, -1, 0)], [2, new THREE.Vector3(0, 0, 1)], [5, new THREE.Vector3(0, 0, -1)], [3, new THREE.Vector3(1, 0, 0)], [4, new THREE.Vector3(-1, 0, 0)]];
  const die = () => {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(new RoundedBoxGeometry(S, S, S, 4, S * 0.12), gold));
    FACES.forEach(([n, normal]) => {
      const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);
      LAYOUT[n].forEach(([u, v]) => {
        const pip = new THREE.Mesh(pipGeo, pipMat);
        pip.position.set(u * S * 0.26, v * S * 0.26, S / 2 + 0.003).applyQuaternion(q);
        pip.quaternion.copy(q);
        g.add(pip);
      });
    });
    return g;
  };
  const a = die();
  a.position.set(x - m(0.5), FLOOR_Y + m(0.5) + S / 2, z);
  a.rotation.y = 0.4;
  room.add(a);
  const b = die();
  // Balanced on a corner, as if still rolling.
  b.position.set(x + m(0.55), FLOOR_Y + m(0.5) + S * 0.87, z + m(0.1));
  b.rotation.set(Math.PI / 4, 0.7, Math.atan(1 / Math.SQRT2));
  room.add(b);
}

// ---------- searchlights over the city ----------
// Pale beams rising from the city and sweeping slowly back and forth —
// out beyond the glass, in front of the skyline.
export function searchlights(room, half) {
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
export function fireTable(room, x, z, length) {
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
export function keysTexture() {
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
export function grandPiano(room, x, z, yaw) {
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
export function champagneTower(room, x, z) {
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

