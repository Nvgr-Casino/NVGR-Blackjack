import * as THREE from 'three';
import { place } from './furniture.js';
import { FLOOR_Y, m } from './scale.js';
import { createBrandSign } from './luxury.js';
import { walkway, facing, barCorner, staffPosts } from './layout.js';
import { onyxMaterial } from './onyx.js';

// The Penthouse: above the clouds.
//
// A round pavilion of glass at the top of the world, open to the night on
// every side and overhead. Below, a sea of cloud lit by the moon, drifting.
// Above, more stars than a city ever shows, the Milky Way across them, the
// moon, and the northern lights moving in slow green and violet curtains.
// The glass is a ring of tall panes between gold mullions under a dome of
// gold ribs. Underfoot, black obsidian inlaid with constellations in
// glowing gold, a ring of light round the table, a round rug of night
// sky. Over the table turns an orrery — gilt rings, planets in their
// orbits, a sun glowing at its heart. The bar is backlit onyx; lounges
// sit at the glass, turned out to the view.
//
// The sky and the cloud are one painted dome round the camera, drawn first
// and behind everything (as the terrace's sea and sunset are), so they
// are as far off as the horizon, and move.

const R = 30;                    // the pavilion's radius, to the glass
const GLASS_H = m(4.4);          // the panes' height
const DOME_RISE = m(3.4);        // the dome over them

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
  const PANES = 36;
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

// ---------- the room ----------
export const PENTHOUSE = {
  tableGlow: 0xb8c8ff,
  half: 31,
  ceilingY: 11.0,
  open: { back: true, sides: true, front: true },
  ceiling: null, noPanel: true, noCove: true,
  floorRadius: R + 0.2,
  floorPx: 2048, floorRepeat: 1,
  paintFloor: paintObsidian,
  wall: { style: 'lacquer', base: 0x17171b, trim: 0xc9a86a, skirting: 0x08080a },
  floor: { style: 'marble', base: 0x121116, pattern: 0xd9d2c3 },
  cove: 0xd8b878, diffuser: 0xc8aa80, accent: 0xd8b46e, washAlpha: 0,
  light: { sky: 0xaabaff, ground: 0x2a2038, fill: 1.75, key: 0xffe6c8, keyPower: 100, wash: 0xb8c4ff, washPower: 26, fog: 0x070912, fogNear: 60, fogFar: 160 },
  furnish(room, half, CEILING_Y) {
    const updates = [];
    const night = createNight();
    room.add(night);
    updates.push((dt, now) => { night.material.uniforms.uTime.value = now / 1000; });
    const { apexY } = pavilion(room);
    room.add(floorLight(R * 2));
    room.add(nightRug(m(4.1)));
    updates.push(orrery(room, apexY));

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

    // The bar of backlit onyx, in from the glass at the back left.
    barCorner(room, R * 0.68, CEILING_Y, { length: m(3.8), bodyMaterial: onyxMaterial(), top: 0x111014, wood: 0x16121a, rgb: '216,180,110', lamp: null });

    // Lounges at the glass, turned out to the view — each a sofa and two
    // chairs round a low table on a round rug, a palm beside it.
    [52, 118, -118, 158, 202].forEach((deg) => {
      const a = THREE.MathUtils.degToRad(deg);
      const out = new THREE.Vector3(Math.sin(a), 0, -Math.cos(a));
      const c = out.clone().multiplyScalar(R * 0.8);
      const view = out.clone().multiplyScalar(R * 2);
      const side = new THREE.Vector3(-out.z, 0, out.x);
      place(room, 'modern_coffee_table_01', { x: c.x, z: c.z, yaw: facing(c.x, c.z, view.x, view.z) });
      const sofa = c.clone().addScaledVector(out, -m(1.15));
      place(room, 'Sofa_01', { x: sofa.x, z: sofa.z, yaw: facing(sofa.x, sofa.z, view.x, view.z), size: 1.1 });
      [-1, 1].forEach((s) => {
        const ch = c.clone().addScaledVector(side, s * m(1.2)).addScaledVector(out, -m(0.1));
        place(room, 'mid_century_lounge_chair', { x: ch.x, z: ch.z, yaw: facing(ch.x, ch.z, c.x + out.x * 3, c.z + out.z * 3) });
      });
      const plant = c.clone().addScaledVector(side, m(2.3)).addScaledVector(out, m(0.4));
      place(room, 'potted_plant_02', { x: plant.x, z: plant.z, size: 2.0 });
      const rug = new THREE.Mesh(new THREE.CircleGeometry(m(1.9), 64), new THREE.MeshLambertMaterial({ color: 0x1a1d3c }));
      rug.rotation.x = -Math.PI / 2;
      rug.position.set(c.x - out.x * m(0.4), FLOOR_Y + 0.005, c.z - out.z * m(0.4));
      room.add(rug);
    });
    walkway(room, { x: 10.5, back: -9.5, front: 10.5 });
    staffPosts(room, [[12.5, -12.5], [-13, 12.5], [12.5, 12.5]]);
    room.userData.update = (dt, now) => updates.forEach((u) => u(dt, now));
  },
};
