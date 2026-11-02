import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { FLOOR_Y, m } from './scale.js';
import { createBrandSign } from './luxury.js';
import { walkway, staffPosts } from './layout.js';
import { canvasTex, grain, velvet, marble, bottleRow } from './casinoKit.js';

// The Royal Flush: above the clouds, the top room of all.
//
// A round pavilion of glass at the top of the world, open to the night on
// every side and overhead. Below, a sea of cloud lit by the moon, drifting,
// seen even through a ring of glass let into the floor at the edge. Above,
// more stars than a city ever shows, the Milky Way, the moon, and the
// northern lights moving in slow green and violet curtains. The glass is a
// ring of tall panes between gold mullions under a dome of gold ribs.
// Underfoot, black obsidian inlaid with constellations in glowing gold.
// Over the table turns an orrery, and round it five great cards of gold
// leaf, the royal flush in spades. A red carpet runs from the table between
// gold posts and velvet ropes to a dais of two thrones at the glass. Crowns
// turn on columns of black marble; lounges of gilt and red velvet chairs
// sit round marble tables, candles burning; the bar is black marble fluted
// in gold under a great crown.
//
// The sky and the cloud are one painted dome round the camera, drawn first
// and behind everything, so they are as far off as the horizon, and move.

const R = 38;                    // the pavilion's radius, to the glass
const GLASS_H = m(5.0);          // the panes' height
const DOME_RISE = m(4.2);        // the dome over them
const SOLID = R - m(2.6);        // the floor's radius; glass from there to the panes

// ---------- the night: stars, aurora, moon, and cloud below ----------
const NIGHT_VERT = `
varying vec3 vDir;
void main() { vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const NIGHT_FRAG = `
uniform float uTime;
uniform vec3 uMoon;
varying vec3 vDir;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float hash3(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
}
float fbm(vec2 p) { float v = 0.0, a = 0.5; for (int i = 0; i < 4; i++) { v += a * noise(p); p *= 2.03; a *= 0.5; } return v; }
void main() {
  vec3 d = normalize(vDir);
  float h = d.y;
  float az = atan(d.x, -d.z);
  // The night itself: indigo at the horizon to near black overhead.
  vec3 col = mix(vec3(0.07, 0.09, 0.22), vec3(0.01, 0.015, 0.05), smoothstep(0.0, 0.75, h));
  // The Milky Way: a soft band of dust and light across the sky.
  float band = exp(-pow(dot(d, normalize(vec3(0.35, 0.45, 0.82))), 2.0) * 22.0);
  col += vec3(0.24, 0.22, 0.36) * band * (0.35 + fbm(vec2(az * 3.0, h * 6.0)) * 0.9) * smoothstep(0.0, 0.15, h);
  // Stars, a few bright, twinkling.
  vec3 sd = d * 160.0;
  vec3 cell = floor(sd);
  float s = hash3(cell);
  if (s > 0.972 && h > -0.02) {
    vec3 f = fract(sd) - 0.5;
    float star = smoothstep(0.16, 0.0, length(f)) * (0.55 + 0.45 * sin(uTime * (1.5 + s * 3.0) + s * 90.0));
    col += vec3(0.85, 0.9, 1.0) * star * (s > 0.995 ? 1.8 : 0.9);
  }
  // The northern lights: curtains hanging in the upper sky, their folds
  // moving, green at the foot to violet at the crown.
  for (int i = 0; i < 3; i++) {
    float fi = float(i);
    float base = 0.2 + fi * 0.07 + sin(az * 2.0 + uTime * 0.07 + fi * 2.1) * 0.05 + (fbm(vec2(az * 1.6 + fi, uTime * 0.04)) - 0.5) * 0.12;
    float y = h - base;
    float curtain = smoothstep(-0.02, 0.0, y) * exp(-y * (6.0 + fi * 2.0));
    float folds = 0.45 + 0.55 * fbm(vec2(az * 9.0 + fi * 3.0, uTime * 0.12));
    vec3 aur = mix(vec3(0.1, 0.95, 0.55), vec3(0.55, 0.3, 0.95), smoothstep(0.0, 0.22, y));
    col += aur * curtain * folds * (0.42 - fi * 0.1) * smoothstep(-0.2, 0.6, cos(az * 0.8 - 0.4));
  }
  // The moon, and its light round it.
  float mo = dot(d, uMoon);
  col += vec3(0.95, 0.96, 1.0) * smoothstep(0.99955, 0.99975, mo) * 1.6;
  col += vec3(0.35, 0.42, 0.7) * pow(max(mo, 0.0), 80.0) * 0.5;
  // Below: a sea of cloud, moonlit on its tops, drifting.
  if (h < 0.03) {
    vec2 p = d.xz / max(0.06 - h, 0.02);
    float c = fbm(p * 0.25 + vec2(uTime * 0.008, uTime * 0.003));
    float c2 = fbm(p * 0.9 - vec2(uTime * 0.012, 0.0));
    float k = smoothstep(0.32, 0.78, c * 0.7 + c2 * 0.3);
    vec3 cloud = mix(vec3(0.05, 0.06, 0.14), vec3(0.52, 0.56, 0.74), k);
    vec2 toMoon = normalize(uMoon.xz);
    cloud += vec3(0.3, 0.33, 0.5) * pow(max(dot(normalize(d.xz), toMoon), 0.0), 6.0) * k * 0.6;
    // Aurora light caught on the cloud tops.
    cloud += vec3(0.05, 0.25, 0.15) * k * 0.4;
    col = mix(col, cloud, smoothstep(0.03, -0.04, h));
  }
  gl_FragColor = vec4(col, 1.0);
}`;

function createNight() {
  const mat = new THREE.ShaderMaterial({
    vertexShader: NIGHT_VERT,
    fragmentShader: NIGHT_FRAG,
    uniforms: { uTime: { value: 0 }, uMoon: { value: new THREE.Vector3(-0.42, 0.32, -0.85).normalize() } },
    side: THREE.BackSide, depthWrite: false, depthTest: false,
  });
  const dome = new THREE.Mesh(new THREE.SphereGeometry(45, 48, 32), mat);
  dome.renderOrder = -1000;
  dome.frustumCulled = false;
  dome.onBeforeRender = (r, s, cam) => { dome.position.copy(cam.position); dome.updateMatrixWorld(); };
  return dome;
}

// ---------- the floor ----------
// Obsidian: near black, a deep sheen of violet in it, faint veins.
function paintObsidian(ctx, S) {
  const g = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  g.addColorStop(0, '#15131c');
  g.addColorStop(1, '#0b0a10');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, S, S);
  for (let v = 0; v < 40; v++) {
    ctx.strokeStyle = `rgba(150,140,190,${0.03 + Math.random() * 0.05})`;
    ctx.lineWidth = 1 + Math.random() * 2;
    ctx.beginPath();
    let x = Math.random() * S, y = Math.random() * S;
    ctx.moveTo(x, y);
    for (let k = 0; k < 12; k++) { x += (Math.random() - 0.5) * 120; y += (Math.random() - 0.5) * 120; ctx.lineTo(x, y); }
    ctx.stroke();
  }
}

// Constellations in glowing gold let into the floor, and a ring of light
// round the table: drawn on a sheet laid just over the floor, adding light.
const CONSTELLATIONS = [
  [[0.18, 0.22], [0.24, 0.26], [0.29, 0.25], [0.34, 0.3], [0.31, 0.36], [0.26, 0.37]],
  [[0.7, 0.18], [0.74, 0.24], [0.79, 0.22], [0.83, 0.28], [0.78, 0.33]],
  [[0.14, 0.66], [0.2, 0.62], [0.25, 0.68], [0.22, 0.75], [0.16, 0.78]],
  [[0.72, 0.7], [0.77, 0.66], [0.82, 0.7], [0.8, 0.77], [0.86, 0.8], [0.9, 0.74]],
  [[0.46, 0.86], [0.52, 0.82], [0.58, 0.86], [0.55, 0.92]],
  [[0.48, 0.1], [0.53, 0.14], [0.5, 0.19], [0.44, 0.16]],
];
function floorLight(size) {
  const S = 2048;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const ctx = c.getContext('2d');
  ctx.strokeStyle = 'rgba(232,196,120,0.75)';
  CONSTELLATIONS.forEach((pts) => {
    ctx.lineWidth = 3;
    ctx.beginPath();
    pts.forEach(([x, y], i) => (i ? ctx.lineTo(x * S, y * S) : ctx.moveTo(x * S, y * S)));
    ctx.stroke();
    pts.forEach(([x, y], i) => {
      const r = i % 3 === 0 ? 9 : 6;
      const g = ctx.createRadialGradient(x * S, y * S, 0, x * S, y * S, r * 3);
      g.addColorStop(0, 'rgba(255,236,190,1)');
      g.addColorStop(0.35, 'rgba(240,200,120,0.6)');
      g.addColorStop(1, 'rgba(240,200,120,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(x * S, y * S, r * 3, 0, Math.PI * 2); ctx.fill();
    });
  });
  // Scattered single stars, clear of the table and the glass.
  for (let k = 0; k < 160; k++) {
    const x = Math.random() * S, y = Math.random() * S;
    const r = Math.hypot(x - S / 2, y - S / 2);
    if (r < S * 0.22 || r > S * 0.49) continue;
    ctx.fillStyle = `rgba(240,210,150,${0.3 + Math.random() * 0.5})`;
    ctx.beginPath(); ctx.arc(x, y, 1.5 + Math.random() * 2.5, 0, Math.PI * 2); ctx.fill();
  }
  // The ring of light round the table, a finer one inside it, and one
  // along the glass.
  const ringR = (11 / size) * S;
  [[ringR, 10, 0.9], [ringR - 22, 3, 0.6], [S * 0.485, 6, 0.7]].forEach(([r, w, a]) => {
    ctx.strokeStyle = `rgba(240,204,130,${a})`;
    ctx.lineWidth = w;
    ctx.beginPath(); ctx.arc(S / 2, S / 2, r, 0, Math.PI * 2); ctx.stroke();
  });
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  const sheet = new THREE.Mesh(new THREE.CircleGeometry(size / 2, 96),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
  sheet.rotation.x = -Math.PI / 2;
  sheet.position.y = FLOOR_Y + 0.008;
  return sheet;
}

// A round rug of night under the table: deep blue, gold rings, a scatter
// of stars.
function nightRug(radius) {
  const S = 1536;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  g.addColorStop(0, '#1c2350');
  g.addColorStop(1, '#0d1130');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, S, S);
  for (let k = 0; k < 500; k++) {
    const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * S * 0.46;
    ctx.fillStyle = `rgba(230,210,160,${0.15 + Math.random() * 0.35})`;
    ctx.beginPath(); ctx.arc(S / 2 + Math.cos(a) * r, S / 2 + Math.sin(a) * r, 1 + Math.random() * 2, 0, Math.PI * 2); ctx.fill();
  }
  [[0.49, 14, '#c9a86a'], [0.46, 4, '#e8cd8a'], [0.43, 2, '#c9a86a']].forEach(([r, w, col]) => {
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
  rug.position.set(0, FLOOR_Y + 0.006, -0.4);
  rug.receiveShadow = true;
  return rug;
}

// ---------- the pavilion ----------
const goldMaterial = () => new THREE.MeshStandardMaterial({ color: 0xd4af62, roughness: 0.25, metalness: 0.9, emissive: 0x2a1e08, emissiveIntensity: 0.5 });

function pavilion(room) {
  const gold = goldMaterial();
  // The glass: barely there, a breath of blue where the light catches it.
  const glass = new THREE.Mesh(new THREE.CylinderGeometry(R, R, GLASS_H, 96, 1, true),
    new THREE.MeshBasicMaterial({ color: 0x9fc0ff, transparent: true, opacity: 0.05, depthWrite: false, side: THREE.DoubleSide }));
  glass.position.y = FLOOR_Y + GLASS_H / 2;
  room.add(glass);
  // Mullions round the ring, and gold rings at the foot and the head.
  const PANES = 44;
  const mull = new THREE.InstancedMesh(new THREE.BoxGeometry(m(0.05), GLASS_H, m(0.07)), gold, PANES);
  const mtx = new THREE.Matrix4();
  for (let i = 0; i < PANES; i++) {
    const a = (i / PANES) * Math.PI * 2;
    mtx.makeRotationY(-a);
    mtx.setPosition(Math.sin(a) * R, FLOOR_Y + GLASS_H / 2, Math.cos(a) * R);
    mull.setMatrixAt(i, mtx);
  }
  room.add(mull);
  [[FLOOR_Y + 0.03, m(0.05)], [FLOOR_Y + GLASS_H, m(0.07)]].forEach(([y, t]) => {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(R, t, 6, 128), gold);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = y;
    room.add(ring);
  });
  // The light along the foot of the glass.
  const foot = new THREE.Mesh(new THREE.TorusGeometry(R - m(0.15), m(0.02), 4, 128), new THREE.MeshBasicMaterial({ color: 0xffcf80, toneMapped: false }));
  foot.rotation.x = Math.PI / 2;
  foot.position.y = FLOOR_Y + 0.02;
  room.add(foot);
  // The dome: gold ribs rising from the ring to an oculus, and two rings
  // of latitude, the sky between.
  const top = FLOOR_Y + GLASS_H;
  const OCULUS = m(0.9);
  const domePoint = (a, t) => {
    const r = Math.max(OCULUS, R * Math.cos(t * Math.PI / 2));
    return new THREE.Vector3(Math.sin(a) * r, top + DOME_RISE * Math.sin(t * Math.PI / 2), Math.cos(a) * r);
  };
  const RIBS = 18;
  for (let i = 0; i < RIBS; i++) {
    const a = (i / RIBS) * Math.PI * 2;
    const pts = Array.from({ length: 16 }, (_, k) => domePoint(a, (k / 15) * 0.97));
    room.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, m(0.035), 5, false), gold));
  }
  [0.45, 0.78].forEach((t) => {
    const p = domePoint(0, t);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(Math.hypot(p.x, p.z), m(0.03), 5, 96), gold);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = p.y;
    room.add(ring);
  });
  const ocu = domePoint(0, 0.97);
  const oculus = new THREE.Mesh(new THREE.TorusGeometry(Math.hypot(ocu.x, ocu.z), m(0.07), 8, 48), gold);
  oculus.rotation.x = Math.PI / 2;
  oculus.position.y = ocu.y;
  room.add(oculus);
  return { apexY: ocu.y };
}

// The ring of glass in the floor between the obsidian and the panes, ribs
// of gold across it, the cloud far below.
function glassRing() {
  const g = new THREE.Group();
  const glass = new THREE.Mesh(new THREE.RingGeometry(SOLID, R, 128), new THREE.MeshStandardMaterial({ color: 0x9fb8e0, transparent: true, opacity: 0.12, roughness: 0.05, metalness: 0.2, depthWrite: false }));
  glass.rotation.x = -Math.PI / 2;
  glass.position.y = FLOOR_Y;
  g.add(glass);
  const gold = goldMaterial();
  const ribs = new THREE.InstancedMesh(new THREE.BoxGeometry(m(0.04), m(0.03), R - SOLID), gold, 44);
  const mtx = new THREE.Matrix4();
  for (let i = 0; i < 44; i++) {
    const a = (i / 44) * Math.PI * 2;
    mtx.makeRotationY(a);
    mtx.setPosition(Math.sin(a) * (SOLID + R) / 2, FLOOR_Y, Math.cos(a) * (SOLID + R) / 2);
    ribs.setMatrixAt(i, mtx);
  }
  g.add(ribs);
  const edge = new THREE.Mesh(new THREE.TorusGeometry(SOLID, m(0.04), 6, 128), gold);
  edge.rotation.x = Math.PI / 2;
  edge.position.y = FLOOR_Y;
  g.add(edge);
  return g;
}

// ---------- the orrery ----------
// Gilt rings tilted on three axes, turning; a sun at the heart; planets in
// their orbits. Hung from the oculus over the table, well above any seat's
// line to the sign.
function orrery(room, apexY) {
  const g = new THREE.Group();
  const cy = FLOOR_Y + m(4.4);
  g.position.set(0, cy, -0.4);
  room.add(g);
  const gold = goldMaterial();
  const rod = new THREE.Mesh(new THREE.CylinderGeometry(m(0.02), m(0.02), apexY - cy, 6), gold);
  rod.position.set(0, cy + (apexY - cy) / 2, -0.4);
  room.add(rod);
  const sun = new THREE.Mesh(new THREE.SphereGeometry(m(0.26), 32, 16), new THREE.MeshBasicMaterial({ color: 0xffd27a, toneMapped: false }));
  g.add(sun);
  const gc = document.createElement('canvas');
  gc.width = gc.height = 128;
  const gx = gc.getContext('2d');
  const gg = gx.createRadialGradient(64, 64, 0, 64, 64, 64);
  gg.addColorStop(0, 'rgba(255,220,140,0.9)'); gg.addColorStop(0.4, 'rgba(255,190,90,0.35)'); gg.addColorStop(1, 'rgba(255,190,90,0)');
  gx.fillStyle = gg; gx.fillRect(0, 0, 128, 128);
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(gc), blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
  glow.scale.set(m(1.6), m(1.6), 1);
  g.add(glow);
  const rings = [];
  [[m(1.25), 0.35, 0.0], [m(1.45), -0.6, 0.9], [m(1.65), 1.2, 0.3]].forEach(([r, tx, tz]) => {
    const holder = new THREE.Group();
    holder.rotation.set(tx, 0, tz);
    g.add(holder);
    const spin = new THREE.Group();
    holder.add(spin);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(r, m(0.025), 8, 96), gold);
    ring.rotation.x = Math.PI / 2;
    spin.add(ring);
    rings.push({ spin, speed: 0 });
  });
  // A planet on each ring, each at its own pace.
  [[m(1.25), 0x7fb0ff, m(0.09), 0.5], [m(1.45), 0xe07a4a, m(0.12), 0.32], [m(1.65), 0xe9d7a0, m(0.15), 0.22]].forEach(([r, color, size, speed], i) => {
    const planet = new THREE.Mesh(new THREE.SphereGeometry(size, 20, 12), new THREE.MeshStandardMaterial({ color, roughness: 0.5, emissive: color, emissiveIntensity: 0.25 }));
    planet.position.set(r, 0, 0);
    rings[i].spin.add(planet);
    rings[i].speed = speed;
  });
  // An outer band of the zodiac, still.
  const band = new THREE.Mesh(new THREE.TorusGeometry(m(1.95), m(0.04), 8, 96), gold);
  band.rotation.x = Math.PI / 2 - 0.2;
  g.add(band);
  return (dt) => rings.forEach((r) => { r.spin.rotation.y += r.speed * dt; });
}

// ---------- royal furniture ----------
const ROYAL_GOLD = goldMaterial();
const RED_VELVET = velvet(0x5a0812, 0xff7080);
const WHITE_MARBLE = marble('#f0ede6', '#9a9aa0');
const BLACK_MARBLE = marble('#0e0e12', '#6a6a78', { veins: 18 });
const GEMS = [0xb3122e, 0x1a4ab8, 0x0a8a4a].map((c) => new THREE.MeshPhysicalMaterial({ color: c, roughness: 0.05, clearcoat: 1, emissive: c, emissiveIntensity: 0.35 }));
const PEARL = new THREE.MeshStandardMaterial({ color: 0xf6f0e6, roughness: 0.25, metalness: 0.2 });
const ERMINE = new THREE.MeshStandardMaterial({ color: 0xf4f0e8, roughness: 0.9 });

// A crown: a band of gold set with stones, points tipped with pearls, two
// arches crossing over a cap of red velvet, an orb and cross on top.
function crown(r) {
  const g = new THREE.Group();
  const h = r * 0.7;
  const band = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 0.92, h, 48, 1, true), ROYAL_GOLD);
  band.material.side = THREE.DoubleSide;
  band.position.y = h / 2;
  g.add(band);
  const ermine = new THREE.Mesh(new THREE.TorusGeometry(r * 0.95, r * 0.12, 10, 48), ERMINE);
  ermine.rotation.x = Math.PI / 2;
  ermine.position.y = r * 0.05;
  g.add(ermine);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const gem = new THREE.Mesh(new THREE.SphereGeometry(r * 0.09, 12, 8), GEMS[i % 3]);
    gem.position.set(Math.cos(a) * r * 0.99, h * 0.5, Math.sin(a) * r * 0.99);
    gem.scale.set(1, 1.3, 0.6);
    gem.lookAt(0, h * 0.5, 0);
    g.add(gem);
    const point = new THREE.Mesh(new THREE.ConeGeometry(r * 0.14, r * 0.45, 12), ROYAL_GOLD);
    point.position.set(Math.cos(a) * r, h + r * 0.22, Math.sin(a) * r);
    g.add(point);
    const pearl = new THREE.Mesh(new THREE.SphereGeometry(r * 0.07, 10, 8), PEARL);
    pearl.position.set(Math.cos(a) * r, h + r * 0.48, Math.sin(a) * r);
    g.add(pearl);
  }
  const cap = new THREE.Mesh(new THREE.SphereGeometry(r * 0.88, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), RED_VELVET);
  cap.position.y = h * 0.9;
  cap.scale.y = 0.8;
  g.add(cap);
  [0, Math.PI / 2].forEach((ry) => {
    const arch = new THREE.Mesh(new THREE.TorusGeometry(r * 0.94, r * 0.05, 8, 40, Math.PI), ROYAL_GOLD);
    arch.position.y = h * 0.9;
    arch.rotation.y = ry;
    arch.scale.y = 0.9;
    g.add(arch);
  });
  const orb = new THREE.Mesh(new THREE.SphereGeometry(r * 0.13, 16, 12), ROYAL_GOLD);
  orb.position.y = h * 0.9 + r * 0.92;
  g.add(orb);
  [[r * 0.05, r * 0.32, 0], [r * 0.22, r * 0.05, r * 0.08]].forEach(([w, hh, dy]) => {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(w, hh, r * 0.05), ROYAL_GOLD);
    bar.position.y = orb.position.y + r * 0.26 + dy;
    g.add(bar);
  });
  return g;
}
// A crown on a column of black marble banded in gold, turning slowly.
function crownPlinth(room, x, z) {
  const col = new THREE.Mesh(new THREE.BoxGeometry(m(0.5), m(1.15), m(0.5)), BLACK_MARBLE);
  col.position.set(x, FLOOR_Y + m(0.575), z);
  room.add(col);
  [m(0.04), m(1.12)].forEach((y) => {
    const band = new THREE.Mesh(new THREE.BoxGeometry(m(0.6), m(0.07), m(0.6)), ROYAL_GOLD);
    band.position.set(x, FLOOR_Y + y, z);
    room.add(band);
  });
  const cushion = new THREE.Mesh(new RoundedBoxGeometry(m(0.48), m(0.09), m(0.48), 3, m(0.035)), RED_VELVET);
  cushion.position.set(x, FLOOR_Y + m(1.2), z);
  room.add(cushion);
  const c = crown(m(0.17));
  c.position.set(x, FLOOR_Y + m(1.25), z);
  room.add(c);
  return (dt) => { c.rotation.y += dt * 0.25; };
}

// A chair in the Louis manner: a frame of carved gilt, red velvet on the
// seat, the back and the arms. A throne is the same, its back tall and
// arched, a crown on its crest.
const LEG_GEO = new THREE.LatheGeometry([[0, 0], [0.025, 0], [0.03, 0.03], [0.018, 0.14], [0.032, 0.3], [0.04, 0.34], [0, 0.34]].map(([r, h]) => new THREE.Vector2(m(r), m(h))), 12);
function royalChair(room, x, z, yaw, { throne = false } = {}) {
  const g = new THREE.Group();
  const W = throne ? m(0.72) : m(0.62), D = m(0.56), backH = throne ? m(1.25) : m(0.62);
  [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => {
    const leg = new THREE.Mesh(LEG_GEO, ROYAL_GOLD);
    leg.position.set(sx * (W / 2 - m(0.05)), FLOOR_Y, sz * (D / 2 - m(0.05)));
    g.add(leg);
  });
  const rail = new THREE.Mesh(new THREE.BoxGeometry(W, m(0.07), D), ROYAL_GOLD);
  rail.position.y = FLOOR_Y + m(0.37);
  g.add(rail);
  const seat = new THREE.Mesh(new RoundedBoxGeometry(W - m(0.04), m(0.12), D - m(0.04), 3, m(0.04)), RED_VELVET);
  seat.position.y = FLOOR_Y + m(0.46);
  g.add(seat);
  // The back: an arched panel of velvet in a gilt frame.
  const s = new THREE.Shape();
  const bw = W - m(0.08);
  s.moveTo(-bw / 2, 0);
  s.lineTo(bw / 2, 0);
  s.lineTo(bw / 2, backH - bw * 0.35);
  s.quadraticCurveTo(bw / 2, backH, 0, backH);
  s.quadraticCurveTo(-bw / 2, backH, -bw / 2, backH - bw * 0.35);
  s.lineTo(-bw / 2, 0);
  const back = new THREE.Mesh(new THREE.ExtrudeGeometry(s, { depth: m(0.06), bevelEnabled: true, bevelThickness: m(0.025), bevelSize: m(0.02), bevelSegments: 3, curveSegments: 16 }), RED_VELVET);
  back.position.set(0, FLOOR_Y + m(0.5), -D / 2 + m(0.02));
  back.rotation.x = -0.1;
  g.add(back);
  const frame = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(s.getPoints(24).map((p) => new THREE.Vector3(p.x, p.y, 0)), true), 80, m(0.022), 6, true), ROYAL_GOLD);
  frame.position.set(0, FLOOR_Y + m(0.5), -D / 2 + m(0.1));
  frame.rotation.x = -0.1;
  g.add(frame);
  // The arms.
  [-1, 1].forEach((sx) => {
    const pad = new THREE.Mesh(new RoundedBoxGeometry(m(0.08), m(0.06), D - m(0.1), 2, m(0.025)), RED_VELVET);
    pad.position.set(sx * (W / 2 - m(0.02)), FLOOR_Y + m(0.68), -m(0.02));
    g.add(pad);
    const post = new THREE.Mesh(new THREE.CylinderGeometry(m(0.018), m(0.024), m(0.24), 10), ROYAL_GOLD);
    post.position.set(sx * (W / 2 - m(0.02)), FLOOR_Y + m(0.54), D / 2 - m(0.08));
    g.add(post);
    const scroll = new THREE.Mesh(new THREE.SphereGeometry(m(0.035), 12, 8), ROYAL_GOLD);
    scroll.position.set(sx * (W / 2 - m(0.02)), FLOOR_Y + m(0.69), D / 2 - m(0.06));
    g.add(scroll);
  });
  if (throne) {
    const c = crown(m(0.1));
    c.position.set(0, FLOOR_Y + m(0.5) + backH * Math.cos(0.1) + m(0.01), -D / 2 - backH * Math.sin(0.1) + m(0.06));
    g.add(c);
  }
  g.position.set(x, 0, z);
  g.rotation.y = yaw;
  room.add(g);
}
// A round table of white marble on a gilt pedestal, a candelabrum on it,
// its candles burning.
const FLAME = new THREE.MeshBasicMaterial({ color: 0xffe2a8, toneMapped: false });
const CANDLE = new THREE.MeshStandardMaterial({ color: 0xf6efe0, roughness: 0.6 });
function candleTable(room, x, z, flames) {
  const top = new THREE.Mesh(new THREE.CylinderGeometry(m(0.48), m(0.48), m(0.05), 48), WHITE_MARBLE);
  top.position.set(x, FLOOR_Y + m(0.6), z);
  room.add(top);
  const ped = new THREE.Mesh(new THREE.LatheGeometry([[0, 0], [0.28, 0], [0.26, 0.04], [0.08, 0.12], [0.05, 0.3], [0.08, 0.5], [0.16, 0.58], [0, 0.58]].map(([r, h]) => new THREE.Vector2(m(r), m(h))), 24), ROYAL_GOLD);
  ped.position.set(x, FLOOR_Y, z);
  room.add(ped);
  const stem = new THREE.Mesh(new THREE.LatheGeometry([[0, 0], [0.08, 0], [0.03, 0.05], [0.02, 0.25], [0.035, 0.3], [0, 0.3]].map(([r, h]) => new THREE.Vector2(m(r), m(h))), 16), ROYAL_GOLD);
  stem.position.set(x, FLOOR_Y + m(0.625), z);
  room.add(stem);
  [-1, 0, 1].forEach((k) => {
    const cx = x + k * m(0.14), cy = FLOOR_Y + m(0.625) + m(0.3) + (k ? 0 : m(0.06));
    if (k) {
      const arm = new THREE.Mesh(new THREE.TorusGeometry(m(0.07), m(0.01), 6, 16, Math.PI), ROYAL_GOLD);
      arm.position.set(x + k * m(0.07), FLOOR_Y + m(0.625) + m(0.28), z);
      arm.rotation.z = Math.PI;
      room.add(arm);
    }
    const candle = new THREE.Mesh(new THREE.CylinderGeometry(m(0.014), m(0.014), m(0.16), 8), CANDLE);
    candle.position.set(cx, cy + m(0.08), z);
    room.add(candle);
    const flame = new THREE.Mesh(new THREE.SphereGeometry(m(0.014), 8, 6), FLAME);
    flame.scale.y = 1.9;
    flame.position.set(cx, cy + m(0.19), z);
    room.add(flame);
    flames.push(flame);
  });
}

// ---------- the cards ----------
// Five great cards of gold leaf, the ten to the ace of spades, the royal
// flush itself, turning slowly over the orrery.
function drawRoyalCrown(ctx, cx, cy, w) {
  ctx.beginPath();
  ctx.moveTo(cx - w / 2, cy + w * 0.3);
  ctx.lineTo(cx - w / 2, cy - w * 0.15);
  ctx.lineTo(cx - w / 4, cy + w * 0.08);
  ctx.lineTo(cx, cy - w * 0.32);
  ctx.lineTo(cx + w / 4, cy + w * 0.08);
  ctx.lineTo(cx + w / 2, cy - w * 0.15);
  ctx.lineTo(cx + w / 2, cy + w * 0.3);
  ctx.closePath();
  ctx.fill();
  [[-0.5, -0.15], [0, -0.32], [0.5, -0.15]].forEach(([dx, dy]) => { ctx.beginPath(); ctx.arc(cx + dx * w, cy + dy * w - w * 0.05, w * 0.06, 0, Math.PI * 2); ctx.fill(); });
}
function royalCardFace(rank) {
  return canvasTex(512, 716, (ctx, W, H) => {
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(0, 0, W, H, 36);
    ctx.clip();
    const g = ctx.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, '#8a6a2a');
    g.addColorStop(0.3, '#f2dc9a');
    g.addColorStop(0.5, '#b8903e');
    g.addColorStop(0.72, '#f6e4a8');
    g.addColorStop(1, '#8a6a2a');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    for (let k = 0; k < 400; k++) {
      ctx.strokeStyle = `rgba(255,255,255,${Math.random() * 0.08})`;
      const y = Math.random() * H;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y + (Math.random() - 0.5) * 20);
      ctx.stroke();
    }
    ctx.strokeStyle = '#1a1206';
    ctx.lineWidth = 3;
    ctx.strokeRect(26, 26, W - 52, H - 52);
    ctx.lineWidth = 1.5;
    ctx.strokeRect(34, 34, W - 68, H - 68);
    ctx.fillStyle = '#141008';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const spade = '♠︎';
    const corner = () => {
      ctx.font = `700 ${rank === '10' ? 64 : 76}px Georgia, serif`;
      ctx.fillText(rank, 74, 92);
      ctx.font = '62px Georgia, serif';
      ctx.fillText(spade, 74, 160);
    };
    corner();
    ctx.save();
    ctx.translate(W, H);
    ctx.rotate(Math.PI);
    corner();
    ctx.restore();
    if (rank === '10') {
      [[0.34, 0.2], [0.66, 0.2], [0.5, 0.3], [0.34, 0.4], [0.66, 0.4], [0.34, 0.6], [0.66, 0.6], [0.5, 0.7], [0.34, 0.8], [0.66, 0.8]].forEach(([px, py]) => {
        ctx.save();
        ctx.translate(px * W, py * H);
        if (py > 0.5) ctx.rotate(Math.PI);
        ctx.font = '96px Georgia, serif';
        ctx.fillText(spade, 0, 0);
        ctx.restore();
      });
    } else if (rank === 'A') {
      ctx.strokeStyle = '#141008';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(W / 2, H / 2, W * 0.34, 0, Math.PI * 2);
      ctx.stroke();
      for (let k = 0; k < 36; k++) {
        const a = (k / 36) * Math.PI * 2;
        ctx.beginPath();
        ctx.arc(W / 2 + Math.cos(a) * W * 0.37, H / 2 + Math.sin(a) * W * 0.37, 4, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.font = '300px Georgia, serif';
      ctx.fillText(spade, W / 2, H / 2 + 10);
      ctx.font = "600 24px 'Cinzel', Georgia, serif";
      ctx.fillText('NVGR · CASINO', W / 2, H * 0.83);
    } else {
      ctx.strokeRect(W * 0.2, H * 0.16, W * 0.6, H * 0.68);
      ctx.strokeRect(W * 0.22, H * 0.175, W * 0.56, H * 0.65);
      drawRoyalCrown(ctx, W / 2, H * 0.3, W * 0.32);
      ctx.font = "700 220px 'Cinzel', Georgia, serif";
      ctx.fillText(rank, W / 2, H * 0.54);
      ctx.font = '110px Georgia, serif';
      ctx.fillText(spade, W / 2, H * 0.73);
    }
    ctx.restore();
  });
}
let royalBackTex = null;
function royalCardBack() {
  if (royalBackTex) return royalBackTex;
  royalBackTex = canvasTex(512, 716, (ctx, W, H) => {
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(0, 0, W, H, 36);
    ctx.clip();
    ctx.fillStyle = '#0c0a08';
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = '#c9a24f';
    ctx.lineWidth = 2;
    for (let k = -H; k < W + H; k += 28) {
      ctx.beginPath(); ctx.moveTo(k, 0); ctx.lineTo(k + H, H); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(k + H, 0); ctx.lineTo(k, H); ctx.stroke();
    }
    ctx.lineWidth = 6;
    ctx.strokeRect(22, 22, W - 44, H - 44);
    ctx.fillStyle = '#0c0a08';
    ctx.beginPath();
    ctx.arc(W / 2, H / 2, W * 0.26, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#d8b46a';
    drawRoyalCrown(ctx, W / 2, H / 2 - 30, W * 0.26);
    ctx.font = "700 54px 'Cinzel', Georgia, serif";
    ctx.textAlign = 'center';
    ctx.fillText('NVGR', W / 2, H / 2 + 60);
    ctx.restore();
  });
  return royalBackTex;
}
function royalCards(room) {
  const ring = new THREE.Group();
  ring.position.set(0, FLOOR_Y + m(5.1), -0.4);
  room.add(ring);
  const CW = m(0.8), CH = m(1.12), r = m(2.8);
  const geo = new THREE.PlaneGeometry(CW, CH);
  const back = new THREE.MeshStandardMaterial({ map: royalCardBack(), transparent: true, alphaTest: 0.5, roughness: 0.4, metalness: 0.3, emissive: 0xffffff, emissiveMap: royalCardBack(), emissiveIntensity: 0.35 });
  const cards = ['10', 'J', 'Q', 'K', 'A'].map((rank, i) => {
    const tex = royalCardFace(rank);
    const holder = new THREE.Group();
    const a = (i / 5) * Math.PI * 2;
    holder.position.set(Math.sin(a) * r, 0, Math.cos(a) * r);
    holder.rotation.order = 'YXZ';
    holder.rotation.y = a + Math.PI;
    holder.rotation.x = 0.3;
    const front = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: tex, transparent: true, alphaTest: 0.5, roughness: 0.32, metalness: 0.55, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.3 }));
    holder.add(front);
    const rear = new THREE.Mesh(geo, back);
    rear.rotation.y = Math.PI;
    holder.add(rear);
    ring.add(holder);
    return holder;
  });
  return (dt, now) => {
    ring.rotation.y += dt * 0.06;
    cards.forEach((c, i) => { c.position.y = Math.sin(now / 2200 + i * 1.3) * m(0.12); });
  };
}

// ---------- the red carpet ----------
// A runner of crimson edged in gold from the table to the thrones, posts
// of gold either side with ropes of red velvet swagged between.
function redCarpet(room, z0, z1) {
  const len = z1 - z0, w = m(1.7);
  const tex = canvasTex(256, 2048, (ctx, W, H) => {
    ctx.fillStyle = '#7a0a14';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#c9a24f';
    ctx.fillRect(8, 0, 12, H);
    ctx.fillRect(W - 20, 0, 12, H);
    ctx.fillRect(28, 0, 3, H);
    ctx.fillRect(W - 31, 0, 3, H);
    grain(ctx, W, H, 18);
  });
  const run = new THREE.Mesh(new THREE.PlaneGeometry(w, len), new THREE.MeshLambertMaterial({ map: tex }));
  run.rotation.x = -Math.PI / 2;
  run.position.set(0, FLOOR_Y + 0.007, (z0 + z1) / 2);
  room.add(run);
  const posts = [];
  for (let z = 12; z < z1 - m(1.5); z += m(1.8)) posts.push(z);
  [-1, 1].forEach((s) => {
    posts.forEach((z, i) => {
      const px = s * (w / 2 + m(0.35));
      const post = new THREE.Mesh(new THREE.CylinderGeometry(m(0.03), m(0.03), m(0.95), 12), ROYAL_GOLD);
      post.position.set(px, FLOOR_Y + m(0.475), z);
      room.add(post);
      const foot = new THREE.Mesh(new THREE.CylinderGeometry(m(0.14), m(0.16), m(0.04), 24), ROYAL_GOLD);
      foot.position.set(px, FLOOR_Y + m(0.02), z);
      room.add(foot);
      const knob = new THREE.Mesh(new THREE.SphereGeometry(m(0.05), 16, 12), ROYAL_GOLD);
      knob.position.set(px, FLOOR_Y + m(0.97), z);
      room.add(knob);
      const next = posts[i + 1];
      if (next === undefined) return;
      const pts = [];
      for (let k = 0; k <= 12; k++) {
        const t = k / 12;
        pts.push(new THREE.Vector3(px, FLOOR_Y + m(0.88) - Math.sin(t * Math.PI) * m(0.22), z + (next - z) * t));
      }
      room.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 16, m(0.022), 8, false), RED_VELVET));
    });
  });
}

// ---------- the bar ----------
// The royal bar: black marble fluted in gold, a top of white marble; the
// back of black marble, a gilt-framed mirror and shelves of cognac and
// champagne in it, a great crown over all.
function royalBar(room, deg, dist) {
  const a = THREE.MathUtils.degToRad(deg);
  const cx = Math.sin(a) * dist, cz = -Math.cos(a) * dist - 0.4;
  const yaw = Math.atan2(-cx, -cz);
  const g = new THREE.Group();
  g.position.set(cx, 0, cz);
  g.rotation.y = yaw;
  room.add(g);
  const len = m(5.0);
  const body = new THREE.Mesh(new THREE.BoxGeometry(len, m(1.0), m(0.6)), BLACK_MARBLE);
  body.position.y = FLOOR_Y + m(0.5);
  g.add(body);
  const n = Math.round(len / m(0.09));
  const flute = new THREE.InstancedMesh(new THREE.CylinderGeometry(m(0.022), m(0.022), m(0.8), 8, 1, false, -Math.PI / 2, Math.PI), ROYAL_GOLD, n);
  const mtx = new THREE.Matrix4();
  for (let i = 0; i < n; i++) {
    mtx.makeTranslation(-len / 2 + (i + 0.5) * (len / n), FLOOR_Y + m(0.52), m(0.3));
    flute.setMatrixAt(i, mtx);
  }
  g.add(flute);
  const top = new THREE.Mesh(new THREE.BoxGeometry(len + m(0.14), m(0.07), m(0.82)), WHITE_MARBLE);
  top.position.set(0, FLOOR_Y + m(1.035), -m(0.05));
  g.add(top);
  const edge = new THREE.Mesh(new THREE.BoxGeometry(len + m(0.16), m(0.02), m(0.84)), ROYAL_GOLD);
  edge.position.set(0, FLOOR_Y + m(0.995), -m(0.05));
  g.add(edge);
  const backZ = -m(1.45);
  const backWall = new THREE.Mesh(new THREE.BoxGeometry(len + m(0.4), m(3.0), m(0.2)), BLACK_MARBLE);
  backWall.position.set(0, FLOOR_Y + m(1.5), backZ);
  g.add(backWall);
  const mirror = new THREE.Mesh(new THREE.PlaneGeometry(len - m(0.4), m(1.5)), new THREE.MeshStandardMaterial({ color: 0xc8ccd4, roughness: 0.03, metalness: 1.0 }));
  mirror.position.set(0, FLOOR_Y + m(1.75), backZ + m(0.101));
  g.add(mirror);
  const frame = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([sx, sy]) => new THREE.Vector3(sx * (len - m(0.4)) / 2, sy * m(0.75), 0)), true, 'catmullrom', 0), 64, m(0.035), 6, true), ROYAL_GOLD);
  frame.position.set(0, FLOOR_Y + m(1.75), backZ + m(0.12));
  g.add(frame);
  const SHELF = new THREE.MeshStandardMaterial({ color: 0xdfe8e8, roughness: 0.05, transparent: true, opacity: 0.35 });
  [1.2, 1.7].forEach((y) => {
    const shelf = new THREE.Mesh(new THREE.BoxGeometry(len - m(0.6), m(0.02), m(0.24)), SHELF);
    shelf.position.set(0, FLOOR_Y + m(y), backZ + m(0.24));
    g.add(shelf);
    bottleRow(g, -len / 2 + m(0.45), len / 2 - m(0.45), FLOOR_Y + m(y) + m(0.01), backZ + m(0.24), [0x8a4a10, 0x1a3a1a, 0xc88a3a, 0xe8dca0, 0x3a0a14]);
  });
  const big = crown(m(0.5));
  big.position.set(0, FLOOR_Y + m(3.05), backZ);
  g.add(big);
  // Stools of gold and red velvet.
  for (let i = 0; i < 5; i++) {
    const sx = -len / 2 + (i + 0.5) * (len / 5);
    const post = new THREE.Mesh(new THREE.CylinderGeometry(m(0.025), m(0.03), m(0.74), 12), ROYAL_GOLD);
    post.position.set(sx, FLOOR_Y + m(0.37), m(0.75));
    g.add(post);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(m(0.18), m(0.2), m(0.03), 24), ROYAL_GOLD);
    base.position.set(sx, FLOOR_Y + m(0.015), m(0.75));
    g.add(base);
    const seat = new THREE.Mesh(new RoundedBoxGeometry(m(0.42), m(0.1), m(0.42), 3, m(0.04)), RED_VELVET);
    seat.position.set(sx, FLOOR_Y + m(0.79), m(0.75));
    g.add(seat);
  }
  const toWorld = (lx, lz) => new THREE.Vector3(cx + lx * Math.cos(yaw) + lz * Math.sin(yaw), 0, cz - lx * Math.sin(yaw) + lz * Math.cos(yaw));
  room.userData.bar = {
    bartender: { pos: toWorld(-len * 0.1, -m(0.75)), yaw },
    pickup: { pos: toWorld(len / 2 + m(0.55), m(0.1)), look: toWorld(0, 0) },
  };
}

// ---------- the room ----------
export const ROYAL_FLUSH = {
  tableGlow: 0xb8c8ff,
  half: R + 1,
  ceilingY: 11.0,
  open: { back: true, sides: true, front: true },
  ceiling: null, noPanel: true, noCove: true,
  floorRadius: SOLID,
  floorPx: 2048, floorRepeat: 1,
  paintFloor: paintObsidian,
  wall: { style: 'lacquer', base: 0x17171b, trim: 0xc9a86a, skirting: 0x08080a },
  floor: { style: 'marble', base: 0x121116, pattern: 0xd9d2c3 },
  cove: 0xd8b878, diffuser: 0xc8aa80, accent: 0xd8b46e, washAlpha: 0,
  light: { sky: 0xaabaff, ground: 0x2a2038, fill: 1.85, key: 0xffe6c8, keyPower: 100, wash: 0xb8c4ff, washPower: 28, fog: 0x070912, fogNear: 70, fogFar: 160 },
  furnish(room) {
    const updates = [];
    const flames = [];
    const night = createNight();
    room.add(night);
    updates.push((dt, now) => { night.material.uniforms.uTime.value = now / 1000; });
    const { apexY } = pavilion(room);
    room.add(glassRing());
    room.add(floorLight(SOLID * 2));
    room.add(nightRug(m(4.1)));
    updates.push(orrery(room, apexY));
    updates.push(royalCards(room));

    // The house sign, hung on fine cables behind the dealer, the night and
    // the northern lights beyond it.
    const signW = m(3.0);
    const sign = createBrandSign(signW, { rgb: '236,206,140', plate: '#0b0d1a', halo: false });
    const signY = FLOOR_Y + m(2.85);
    const signZ = -m(9.0);
    sign.position.set(0, signY, signZ);
    room.add(sign);
    const cable = new THREE.MeshStandardMaterial({ color: 0xc9a86a, roughness: 0.3, metalness: 0.9 });
    [-1, 1].forEach((s) => {
      const t = signY + signW * 0.31;
      const len = FLOOR_Y + GLASS_H + m(1.6) - t;
      const c = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, len, 6), cable);
      c.position.set(s * signW * 0.42, t + len / 2, signZ);
      room.add(c);
    });

    // The royal bar, in from the glass at the back left.
    royalBar(room, -50, R * 0.64);
    // The red carpet from the table to a dais of thrones at the glass.
    const daisZ = SOLID - m(1.6);
    redCarpet(room, m(4.3), daisZ - m(0.6));
    const dais = new THREE.Mesh(new THREE.CylinderGeometry(m(1.6), m(1.65), m(0.14), 64), BLACK_MARBLE);
    dais.position.set(0, FLOOR_Y + m(0.07), daisZ);
    room.add(dais);
    const daisRim = new THREE.Mesh(new THREE.TorusGeometry(m(1.6), m(0.02), 6, 64), ROYAL_GOLD);
    daisRim.rotation.x = Math.PI / 2;
    daisRim.position.set(0, FLOOR_Y + m(0.14), daisZ);
    room.add(daisRim);
    [-1, 1].forEach((s) => {
      const t = new THREE.Group();
      t.position.y = m(0.14);
      room.add(t);
      royalChair(t, s * m(0.6), daisZ, Math.PI, { throne: true });
    });
    // Crowns on columns, two flanking the sign, two flanking the carpet.
    [25, -25, 150, -150].forEach((deg) => {
      const a = THREE.MathUtils.degToRad(deg);
      updates.push(crownPlinth(room, Math.sin(a) * R * 0.48, -Math.cos(a) * R * 0.48));
    });
    // Lounges at the glass: chairs of gilt and velvet round marble tables
    // with candles on them, on rugs of night.
    [50, 100, 138, -138, -100].forEach((deg) => {
      const a = THREE.MathUtils.degToRad(deg);
      const out = new THREE.Vector3(Math.sin(a), 0, -Math.cos(a));
      const c = out.clone().multiplyScalar(R * 0.72);
      const rug = nightRug(m(1.9));
      rug.position.set(c.x, FLOOR_Y + 0.005, c.z);
      room.add(rug);
      candleTable(room, c.x, c.z, flames);
      [Math.PI, Math.PI / 3, -Math.PI / 3].forEach((da) => {
        const ca = Math.atan2(out.x, out.z) + da;
        const px = c.x + Math.sin(ca) * m(1.05), pz = c.z + Math.cos(ca) * m(1.05);
        royalChair(room, px, pz, Math.atan2(c.x - px, c.z - pz));
      });
    });
    walkway(room, { x: 10.5, back: -9.5, front: 10.5 });
    staffPosts(room, [[12.5, -12.5], [-13, 12.5], [12.5, 12.5]]);
    updates.push((dt, now) => flames.forEach((f, i) => { f.scale.y = 1.7 + Math.sin(now / 95 + i * 1.9) * 0.3; }));
    room.userData.update = (dt, now) => updates.forEach((u) => u(dt, now));
  },
};
