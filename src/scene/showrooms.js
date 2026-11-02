import * as THREE from 'three';
import { place } from './furniture.js';
import { FLOOR_Y, m } from './scale.js';
import { createRug, createDrape, createBrandSign } from './luxury.js';
import { lounge, pilaster, walkway, barCorner, brandSign, staffPosts, sconce } from './layout.js';
import { drawCasinoCrest } from './crest.js';

// The four rooms below the High Roller, each built round an idea of its own
// rather than one salon in four colours:
//
//   Lucky Sevens   — a terrace on a cliff over the sea at sunset: a white
//                    colonnade and balustrade open on three sides, a
//                    pergola strung with lights, palms, and the sun going
//                    down behind the dealer.
//   The Wild Card  — an Art Deco ballroom: peacock lacquer and gold, a
//                    giant gold sunburst behind the dealer, a starburst
//                    inlaid in the floor round the table, a stepped ceiling
//                    ringed with light, fluted black columns.
//   The Full House — a two-storey library: books floor to ceiling, a
//                    gallery with a brass rail all round, a ladder, a glass
//                    dome of stars over the table, green banker's lamps.
//   The Golden Ace — a hall of mirrors: arched gilt mirrors down every
//                    wall, a sky painted on the ceiling, crystal
//                    chandeliers, a marble fireplace with a fire in it,
//                    red velvet.
//
// Each still has what every room has (common, below): the house sign
// over the dealer, the bar in the back-left corner with its bartender, a
// lounge on each side, the rug under the table, the waiters' loop and
// posts. Most of the richness is painted (canvas textures) or instanced,
// so a phone can draw it: a single light on the table, a fill, and the
// rest glows of itself.

const rgb = (hex) => [(hex >> 16) & 255, (hex >> 8) & 255, hex & 255];
const css = (hex, a = 1) => { const [r, g, b] = rgb(hex); return `rgba(${r},${g},${b},${a})`; };
const shade = (hex, d) => { const [r, g, b] = rgb(hex).map((c) => Math.max(0, Math.min(255, c + d))); return `rgb(${r},${g},${b})`; };
const facingIn = (side) => -side * Math.PI / 2;

// Grain over a whole canvas.
function grain(ctx, w, h, amount) {
  const img = ctx.getImageData(0, 0, w, h);
  const p = img.data;
  for (let i = 0; i < p.length; i += 4) {
    const n = (Math.random() - 0.5) * amount;
    p[i] += n; p[i + 1] += n; p[i + 2] += n;
  }
  ctx.putImageData(img, 0, 0);
}

// Every piece of the salon all four share.
function common(room, half, CEILING_Y, t) {
  brandSign(room, half, { rgb: t.signRgb, plate: t.signPlate, y: t.signY });
  if (t.frontSign !== false) brandSign(room, half, { wall: 'front', width: m(1.6), rgb: t.signRgb, plate: t.signPlate, y: t.signY });
  if (t.rug) room.add(createRug(20, 16, t.rug));
  barCorner(room, half, CEILING_Y, t.bar);
  [-1, 1].forEach((side) => lounge(room, half, side, m(0.2), { ...t.lounge, chair: side < 0 ? t.lounge.chair : (t.lounge.chair2 || t.lounge.chair) }));
  walkway(room);
  staffPosts(room, [[10, -9.6], [-10.2, 10.2], [10.2, 10.2]]);
}

// =====================================================================
// The Lounge: a terrace over the sea at sunset
// =====================================================================

// The sky and the sea are one painted dome round the camera, drawn first
// and behind everything: a sunset gradient with the sun low behind the
// dealer and soft cloud, headlands either side, and the sea to the
// horizon, its swell moving and a path of light on it toward the sun.
// It moves with the camera, so it is as far off as the horizon.
const SKY_VERT = `
varying vec3 vDir;
void main() {
  vDir = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;
const SKY_FRAG = `
uniform float uTime;
uniform vec3 uSun;
varying vec3 vDir;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
}
void main() {
  vec3 d = normalize(vDir);
  float h = d.y;
  float az = atan(d.x, -d.z);
  vec3 horizon = vec3(1.0, 0.63, 0.36);
  vec3 low = vec3(0.98, 0.47, 0.42);
  vec3 high = vec3(0.42, 0.29, 0.52);
  vec3 zen = vec3(0.10, 0.13, 0.33);
  vec3 sky = mix(horizon, low, smoothstep(0.0, 0.07, h));
  sky = mix(sky, high, smoothstep(0.07, 0.28, h));
  sky = mix(sky, zen, smoothstep(0.28, 0.85, h));
  float s = max(dot(d, uSun), 0.0);
  sky += vec3(1.0, 0.55, 0.22) * pow(s, 7.0) * 0.55;
  sky += vec3(1.0, 0.92, 0.72) * smoothstep(0.99935, 0.99965, s) * 2.2;
  // Long low cloud, lit from beneath by the sun.
  float c = noise(vec2(az * 2.6 + uTime * 0.004, h * 16.0)) * noise(vec2(az * 6.0, h * 34.0 + 3.0));
  float band = smoothstep(0.015, 0.06, h) * (1.0 - smoothstep(0.2, 0.36, h));
  sky = mix(sky, mix(vec3(1.0, 0.7, 0.55), vec3(0.95, 0.5, 0.55), smoothstep(0.05, 0.25, h)), smoothstep(0.22, 0.55, c) * band * 0.75);
  vec3 col = sky;
  // Headlands to either side, hazy with distance.
  float side = smoothstep(0.55, 1.25, abs(az));
  float hill = (noise(vec2(az * 3.5, 0.0)) * 0.65 + noise(vec2(az * 12.0, 4.0)) * 0.35) * 0.055 * side;
  if (h >= 0.0 && h < hill) col = mix(vec3(0.36, 0.22, 0.34), vec3(0.62, 0.38, 0.42), 1.0 - h / max(hill, 0.0001));
  if (h < 0.0) {
    vec2 p = d.xz / max(-h, 0.003);
    float w = noise(p * 0.55 + vec2(uTime * 0.12, uTime * 0.07)) * 0.55 + noise(p * 1.9 - vec2(uTime * 0.18, 0.0)) * 0.45;
    vec3 sea = mix(vec3(0.07, 0.20, 0.30), vec3(0.05, 0.13, 0.22), smoothstep(0.0, 0.35, -h));
    float fres = pow(1.0 - clamp(-h * 5.0, 0.0, 1.0), 3.0);
    sea = mix(sea, horizon * 0.92, fres * 0.75);
    vec3 r = reflect(d, vec3(0.0, 1.0, 0.0));
    float g = pow(max(dot(r, uSun), 0.0), 40.0);
    sea += vec3(1.0, 0.72, 0.42) * g * (0.35 + 2.6 * smoothstep(0.55, 0.92, w));
    sea += vec3(0.9, 0.6, 0.5) * 0.06 * w;
    col = sea;
  }
  gl_FragColor = vec4(col, 1.0);
}`;

function createSeaSky() {
  const mat = new THREE.ShaderMaterial({
    vertexShader: SKY_VERT,
    fragmentShader: SKY_FRAG,
    uniforms: { uTime: { value: 0 }, uSun: { value: new THREE.Vector3(0.22, 0.03, -1).normalize() } },
    side: THREE.BackSide,
    depthWrite: false,
    depthTest: false,
  });
  const dome = new THREE.Mesh(new THREE.SphereGeometry(45, 48, 32), mat);
  dome.renderOrder = -1000;
  dome.frustumCulled = false;
  // Kept centred on the camera, so it never comes nearer.
  dome.onBeforeRender = (r, s, cam) => { dome.position.copy(cam.position); dome.updateMatrixWorld(); };
  return dome;
}

// Pale travertine, laid in large slabs.
function paintTravertine(ctx, S) {
  const cell = S / 2;
  for (let y = 0; y < 2; y++) {
    for (let x = 0; x < 2; x++) {
      const base = [0xeadcc2, 0xe4d3b6, 0xefe2ca, 0xe0cfb1][(x + y * 2) % 4];
      ctx.fillStyle = css(base);
      ctx.fillRect(x * cell, y * cell, cell, cell);
      // Its veins and pores.
      for (let k = 0; k < 6; k++) {
        ctx.strokeStyle = `rgba(170,140,100,${0.06 + Math.random() * 0.06})`;
        ctx.lineWidth = 1 + Math.random() * 3;
        ctx.beginPath();
        const yy = y * cell + Math.random() * cell;
        ctx.moveTo(x * cell, yy);
        ctx.bezierCurveTo(x * cell + cell * 0.3, yy + (Math.random() - 0.5) * 30, x * cell + cell * 0.7, yy + (Math.random() - 0.5) * 30, x * cell + cell, yy + (Math.random() - 0.5) * 20);
        ctx.stroke();
      }
      for (let k = 0; k < 90; k++) {
        ctx.fillStyle = 'rgba(150,120,85,0.18)';
        ctx.beginPath();
        ctx.ellipse(x * cell + Math.random() * cell, y * cell + Math.random() * cell, 1 + Math.random() * 4, 0.6 + Math.random() * 1.5, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.strokeStyle = 'rgba(120,96,70,0.45)';
      ctx.lineWidth = 3;
      ctx.strokeRect(x * cell + 1.5, y * cell + 1.5, cell - 3, cell - 3);
    }
  }
  grain(ctx, S, S, 10);
}

// The villa's own wall behind the players: warm stucco, tall arched doors
// with the light of the rooms inside them, a terracotta base, the crest.
function paintVilla(ctx, d) {
  const { texW: W, texH: H, px } = d;
  const u = px * m(1);
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#f3e4c8');
  g.addColorStop(1, '#e6d0ae');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  grain(ctx, W, H, 12);
  ctx.fillStyle = '#b5643c';
  ctx.fillRect(0, H - u * 0.35, W, u * 0.35);
  const doorW = u * 1.2, doorH = u * 2.7;
  for (let x = u * 1.0; x + doorW < W; x += u * 2.4) {
    if (Math.abs(x + doorW / 2 - W / 2) < u * 1.3) continue;
    const top = H - u * 0.35 - doorH;
    // Light from inside.
    const glow = ctx.createLinearGradient(0, top, 0, top + doorH);
    glow.addColorStop(0, '#ffd89a');
    glow.addColorStop(1, '#c98a4a');
    ctx.fillStyle = '#3a2a1e';
    ctx.beginPath();
    ctx.moveTo(x - 10, top + doorH);
    ctx.lineTo(x - 10, top + doorW / 2);
    ctx.arc(x + doorW / 2, top + doorW / 2, doorW / 2 + 10, Math.PI, 0);
    ctx.lineTo(x + doorW + 10, top + doorH);
    ctx.fill();
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.moveTo(x, top + doorH);
    ctx.lineTo(x, top + doorW / 2);
    ctx.arc(x + doorW / 2, top + doorW / 2, doorW / 2, Math.PI, 0);
    ctx.lineTo(x + doorW, top + doorH);
    ctx.fill();
    ctx.strokeStyle = '#3a2a1e';
    ctx.lineWidth = 6;
    for (let k = 1; k < 4; k++) { ctx.beginPath(); ctx.moveTo(x, top + doorH - k * doorH / 4); ctx.lineTo(x + doorW, top + doorH - k * doorH / 4); ctx.stroke(); }
    ctx.beginPath(); ctx.moveTo(x + doorW / 2, top); ctx.lineTo(x + doorW / 2, top + doorH); ctx.stroke();
  }
  drawCasinoCrest(ctx, { x: W / 2, y: H * 0.32, width: u * 1.6, alpha: 0.85, rgb: '150,96,52' });
}

// A balustrade along a line: plinth, vase-turned balusters, a rail.
function balustrade(room, from, to, mats) {
  const len = from.distanceTo(to);
  const dir = to.clone().sub(from).normalize();
  const yaw = Math.atan2(dir.x, dir.z);
  const mid = from.clone().lerp(to, 0.5);
  const H = m(1.0);
  const plinth = new THREE.Mesh(new THREE.BoxGeometry(m(0.3), m(0.14), len), mats.stone);
  plinth.position.set(mid.x, FLOOR_Y + m(0.07), mid.z);
  plinth.rotation.y = yaw;
  room.add(plinth);
  const rail = new THREE.Mesh(new THREE.BoxGeometry(m(0.28), m(0.12), len), mats.stone);
  rail.position.set(mid.x, FLOOR_Y + H - m(0.06), mid.z);
  rail.rotation.y = yaw;
  room.add(rail);
  const profile = [[0, 0], [0.06, 0], [0.06, 0.05], [0.04, 0.12], [0.075, 0.38], [0.05, 0.6], [0.035, 0.66], [0.06, 0.72], [0.06, 0.74], [0, 0.74]]
    .map(([x, y]) => new THREE.Vector2(m(x), m(y)));
  const geo = new THREE.LatheGeometry(profile, 10);
  const step = m(0.2);
  const n = Math.floor(len / step);
  const inst = new THREE.InstancedMesh(geo, mats.stone, n);
  const mtx = new THREE.Matrix4();
  for (let i = 0; i < n; i++) {
    const p = from.clone().addScaledVector(dir, (i + 0.5) * (len / n));
    mtx.makeTranslation(p.x, FLOOR_Y + m(0.14), p.z);
    inst.setMatrixAt(i, mtx);
  }
  room.add(inst);
}

function column(room, x, z, height, mats, { capital = mats.stone, radius = m(0.19) } = {}) {
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.92, radius, height - m(0.5), 20), mats.stone);
  shaft.position.set(x, FLOOR_Y + m(0.25) + (height - m(0.5)) / 2, z);
  room.add(shaft);
  [[m(0.12), m(0.25)], [height - m(0.12), m(0.25)]].forEach(([y, h], i) => {
    const block = new THREE.Mesh(new THREE.BoxGeometry(radius * 2.6, h, radius * 2.6), i ? capital : mats.stone);
    block.position.set(x, FLOOR_Y + y, z);
    room.add(block);
  });
}

// Lights strung in a sag between two points: a fine wire and warm bulbs.
function stringLights(from, to, sag, bulbs, out) {
  const pts = [];
  for (let i = 0; i <= bulbs; i++) {
    const t = i / bulbs;
    const p = from.clone().lerp(to, t);
    p.y -= Math.sin(t * Math.PI) * sag;
    pts.push(p);
  }
  out.wire.push(...pts.slice(0, -1).flatMap((p, i) => [p, pts[i + 1]]));
  out.bulbs.push(...pts.slice(1, -1));
}

const TERRACE_SIGN_Y = FLOOR_Y + m(2.6);

export const TERRACE = {
  tableGlow: 0xffa860,
  open: { back: true, sides: true },
  ceiling: null, noPanel: true, noCove: true,
  floorPx: 1024, floorRepeat: 36 / 3.2,
  paintFloor: paintTravertine,
  paintWall: (ctx, d) => paintVilla(ctx, d),
  cove: 0xffd9a0, diffuser: 0xfff3dc, accent: 0xb8914f, washAlpha: 0,
  wall: { style: 'panels', base: 0xf3e4c8, wainscot: 0xe6d0ae, rail: 0xb5643c, skirting: 0xb5643c },
  floor: { style: 'parquet', base: 0xeadcc2 },
  light: { sky: 0xffd2b0, ground: 0x8a6a50, fill: 2.0, key: 0xffe6c8, keyPower: 84, wash: 0xffc89a, washPower: 34, fog: 0xf0a878, fogNear: 60, fogFar: 140 },
  furnish(room, half, CEILING_Y) {
    const stone = new THREE.MeshStandardMaterial({ color: 0xf2e9da, roughness: 0.7, metalness: 0 });
    const wood = new THREE.MeshStandardMaterial({ color: 0x6b4a2e, roughness: 0.7, metalness: 0 });
    const mats = { stone };
    room.add(createSeaSky());
    const sky = room.children[room.children.length - 1];
    const edge = half - m(0.15);
    // The balustrade round three sides, open to the sea.
    balustrade(room, new THREE.Vector3(-edge, 0, -edge), new THREE.Vector3(edge, 0, -edge), mats);
    [-1, 1].forEach((s) => balustrade(room, new THREE.Vector3(s * edge, 0, -edge), new THREE.Vector3(s * edge, 0, half - m(0.6)), mats));
    // The colonnade, and the pergola on it.
    const topY = CEILING_Y - FLOOR_Y;
    const colsX = [-1, -0.5, 0.5, 1].map((k) => k * edge);
    colsX.forEach((x) => column(room, x, -edge, topY, mats));
    [-0.5, 0, 0.5].forEach((k) => [-1, 1].forEach((s) => column(room, s * edge, k * edge, topY, mats)));
    [-1, 1].forEach((s) => column(room, s * edge, half - m(0.6), topY, mats));
    const beamY = CEILING_Y - m(0.12);
    const archi = (x, z, w, d) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, m(0.3), d), stone); b.position.set(x, beamY, z); room.add(b); };
    archi(0, -edge, edge * 2 + m(0.4), m(0.42));
    [-1, 1].forEach((s) => archi(s * edge, 0, m(0.42), edge * 2 + m(0.4)));
    for (let z = -edge + m(1.1); z < half - m(0.8); z += m(1.25)) {
      const b = new THREE.Mesh(new THREE.BoxGeometry(edge * 2, m(0.2), m(0.1)), wood);
      b.position.set(0, beamY + m(0.2), z);
      room.add(b);
    }
    // Lights strung across under the pergola.
    const strung = { wire: [], bulbs: [] };
    for (let z = -edge + m(1.6); z < half - m(1.5); z += m(2.4)) {
      stringLights(new THREE.Vector3(-edge, beamY - m(0.1), z), new THREE.Vector3(edge, beamY - m(0.1), z + m(0.8)), m(0.55), 30, strung);
    }
    room.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(strung.wire), new THREE.LineBasicMaterial({ color: 0x2a2018 })));
    const bulbMat = new THREE.MeshBasicMaterial({ color: 0xffe0a0, toneMapped: false });
    const bulbs = new THREE.InstancedMesh(new THREE.SphereGeometry(m(0.035), 8, 6), bulbMat, strung.bulbs.length);
    const mtx = new THREE.Matrix4();
    strung.bulbs.forEach((p, i) => { mtx.makeTranslation(p.x, p.y - m(0.04), p.z); bulbs.setMatrixAt(i, mtx); });
    room.add(bulbs);
    // The arch behind the dealer, the house sign hung in it on chains, the
    // sunset beyond.
    const pierH = m(2.2);
    [-1, 1].forEach((s) => {
      const pier = new THREE.Mesh(new THREE.BoxGeometry(m(0.5), pierH, m(0.5)), stone);
      pier.position.set(s * m(1.75), FLOOR_Y + pierH / 2, -edge + m(0.35));
      room.add(pier);
    });
    const arch = new THREE.Mesh(new THREE.TorusGeometry(m(1.75), m(0.25), 10, 40, Math.PI), stone);
    arch.position.set(0, FLOOR_Y + pierH, -edge + m(0.35));
    room.add(arch);
    const sign = createBrandSign(m(2.0), { rgb: '236,200,124', plate: '#1d2b33', halo: false });
    sign.position.set(0, TERRACE_SIGN_Y, -edge + m(0.4));
    room.add(sign);
    const chain = new THREE.MeshStandardMaterial({ color: 0xc9a86a, roughness: 0.3, metalness: 0.9 });
    [-1, 1].forEach((s) => {
      const top = FLOOR_Y + pierH + m(1.55);
      const bottom = TERRACE_SIGN_Y + m(0.62);
      const c = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, top - bottom, 6), chain);
      c.position.set(s * m(0.7), (top + bottom) / 2, -edge + m(0.4));
      room.add(c);
    });
    // Palms between the columns and at the corners, lanterns on the piers.
    [-0.25, 0.25, 0.75].forEach((k) => place(room, 'potted_plant_04', { x: k * edge, z: -edge + m(0.6), size: 3.4 }));
    [-1, 1].forEach((s) => {
      [-0.25, 0.25, 0.75].forEach((k) => place(room, 'potted_plant_04', { x: s * (edge - m(0.6)), z: k * edge, size: 3.4 }));
      sconce(room, s * m(1.75), FLOOR_Y + m(1.6), -edge + m(0.62), 0, { metal: 0xc9a466, glow: 0xffd9a0 });
    });
    common(room, half, CEILING_Y, {
      signRgb: '236,200,124', signPlate: '#1d2b33', frontSign: false,
      rug: { base: '#1f5c66', border: '#123a40', accent: '#e6c27a' },
      bar: { body: 0xf2ece2, top: 0xffffff, wood: 0x8a6440, rgb: '190,140,80', lamp: 'modern_ceiling_lamp_01' },
      lounge: { sofa: 'sofa_02', chair: 'mid_century_lounge_chair', rug: { base: '#f2e6cf', border: '#1f5c66', accent: '#d8b06a' } },
    });
    // The house sign on the villa wall, under its crest.
    const villaSign = createBrandSign(m(1.4), { rgb: '236,200,124', plate: '#1d2b33' });
    villaSign.position.set(0, FLOOR_Y + m(2.2), half - 0.04);
    villaSign.rotation.y = Math.PI;
    room.add(villaSign);
    room.userData.update = (dt, now) => { sky.material.uniforms.uTime.value = now / 1000; };
  },
};

// =====================================================================
// The Parlour: an Art Deco ballroom
// =====================================================================

const DECO_TEAL = 0x17635f;
const DECO_GOLD = '212,172,92';

function paintDecoWall(ctx, d, which) {
  const { texW: W, texH: H, px, texY } = d;
  const u = px * m(1);
  const gold = `rgba(${DECO_GOLD},0.95)`;
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, shade(DECO_TEAL, 14));
  g.addColorStop(1, shade(DECO_TEAL, -6));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  // The great sunburst behind the dealer.
  if (which === 'back') {
    const cx = W / 2, cy = texY(FLOOR_Y + m(2.75));
    const R = u * 6;
    for (let i = 0; i < 64; i++) {
      const a0 = (i / 64) * Math.PI * 2, a1 = ((i + 0.5) / 64) * Math.PI * 2;
      const grd = ctx.createRadialGradient(cx, cy, u * 0.8, cx, cy, R);
      grd.addColorStop(0, `rgba(${DECO_GOLD},0.85)`);
      grd.addColorStop(1, `rgba(${DECO_GOLD},0)`);
      ctx.fillStyle = grd;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, R, a0, a1);
      ctx.fill();
    }
    [1.6, 2.1, 2.5].forEach((r, i) => { ctx.strokeStyle = gold; ctx.lineWidth = 6 - i * 1.5; ctx.beginPath(); ctx.arc(cx, cy, u * r, 0, Math.PI * 2); ctx.stroke(); });
  }
  // Fluted black pilasters, gold-edged, and between them stepped
  // "skyscraper" motifs rising to a fan under the frieze.
  const bay = u * 2.4;
  for (let x = 0; x < W + bay; x += bay) {
    ctx.fillStyle = '#0b0c0f';
    ctx.fillRect(x - u * 0.18, 0, u * 0.36, H);
    ctx.strokeStyle = gold;
    ctx.lineWidth = 3;
    ctx.strokeRect(x - u * 0.18, 0, u * 0.36, H);
    for (let k = -2; k <= 2; k++) { ctx.fillStyle = `rgba(${DECO_GOLD},0.35)`; ctx.fillRect(x + k * u * 0.06 - 1, u * 0.7, 2, H - u * 1.9); }
    const cx = x + bay / 2;
    if (which === 'back' && Math.abs(cx - W / 2) < u * 3.2) continue;
    ctx.strokeStyle = gold;
    ctx.lineWidth = 3;
    const top = u * 0.85;
    for (let s = 0; s < 4; s++) {
      const w = u * (0.9 - s * 0.18), y = top + s * u * 0.32;
      ctx.beginPath();
      ctx.moveTo(cx - w, y + u * 2.2);
      ctx.lineTo(cx - w, y + u * 0.3);
      ctx.lineTo(cx, y);
      ctx.lineTo(cx + w, y + u * 0.3);
      ctx.lineTo(cx + w, y + u * 2.2);
      ctx.stroke();
    }
    ctx.beginPath(); ctx.moveTo(cx, top + u * 1.3); ctx.lineTo(cx, H - u * 1.1); ctx.stroke();
    // A fan at the foot of it.
    for (let r = 0; r < 9; r++) {
      const a = Math.PI + (r / 8) * Math.PI;
      ctx.beginPath(); ctx.moveTo(cx, H - u * 1.1); ctx.lineTo(cx + Math.cos(a) * u * 0.55, H - u * 1.1 + Math.sin(a) * u * 0.55); ctx.stroke();
    }
  }
  // The frieze: a band of gold fans along the top.
  ctx.fillStyle = '#0b0c0f';
  ctx.fillRect(0, 0, W, u * 0.55);
  for (let x = u * 0.3; x < W; x += u * 0.6) {
    ctx.fillStyle = `rgba(${DECO_GOLD},0.9)`;
    ctx.beginPath(); ctx.moveTo(x, u * 0.5); ctx.arc(x, u * 0.5, u * 0.26, Math.PI, 0); ctx.fill();
    ctx.fillStyle = '#0b0c0f';
    ctx.beginPath(); ctx.moveTo(x, u * 0.5); ctx.arc(x, u * 0.5, u * 0.15, Math.PI, 0); ctx.fill();
  }
  ctx.fillStyle = gold;
  ctx.fillRect(0, u * 0.55, W, 5);
  // A black marble dado with a gold rail.
  const dado = H - u * 0.95;
  ctx.fillStyle = '#101114';
  ctx.fillRect(0, dado, W, H - dado);
  for (let k = 0; k < 40; k++) {
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.lineWidth = 1 + Math.random() * 2;
    ctx.beginPath();
    let x = Math.random() * W, y = dado;
    ctx.moveTo(x, y);
    while (y < H) { x += (Math.random() - 0.5) * 50; y += 12 + Math.random() * 20; ctx.lineTo(x, y); }
    ctx.stroke();
  }
  ctx.fillStyle = gold;
  ctx.fillRect(0, dado - 4, W, 8);
  if (which !== 'back') drawCasinoCrest(ctx, { x: W / 2, y: texY(FLOOR_Y + m(2.6)), width: u * 1.6, alpha: 0.95, rgb: DECO_GOLD });
}

// Terrazzo, one sheet for the whole floor: a gold starburst inlaid round
// the table in black and gold rings, banded borders, chips of stone.
function paintDecoFloor(ctx, S) {
  ctx.fillStyle = '#eee5d3';
  ctx.fillRect(0, 0, S, S);
  for (let k = 0; k < 9000; k++) {
    ctx.fillStyle = ['rgba(150,120,90,0.35)', 'rgba(40,40,40,0.25)', 'rgba(200,170,110,0.4)', 'rgba(120,140,130,0.3)'][k % 4];
    ctx.fillRect(Math.random() * S, Math.random() * S, 1 + Math.random() * 3, 1 + Math.random() * 3);
  }
  const c = S / 2, unit = S / 36;
  const gold = `rgba(${DECO_GOLD},1)`;
  // Borders.
  [1.2, 1.6].forEach((b, i) => { ctx.strokeStyle = i ? gold : '#111'; ctx.lineWidth = i ? 6 : 26; ctx.strokeRect(unit * b, unit * b, S - unit * b * 2, S - unit * b * 2); });
  // The starburst.
  const R = unit * 11;
  for (let i = 0; i < 32; i++) {
    const a = (i / 32) * Math.PI * 2;
    const long = i % 2 === 0;
    ctx.fillStyle = long ? gold : '#16171b';
    ctx.beginPath();
    ctx.moveTo(c + Math.cos(a - 0.05) * unit * 4.5, c + Math.sin(a - 0.05) * unit * 4.5);
    ctx.lineTo(c + Math.cos(a) * (long ? R : R * 0.78), c + Math.sin(a) * (long ? R : R * 0.78));
    ctx.lineTo(c + Math.cos(a + 0.05) * unit * 4.5, c + Math.sin(a + 0.05) * unit * 4.5);
    ctx.fill();
  }
  [[4.5, '#16171b', 22], [4.9, gold, 6], [R / unit + 0.4, gold, 6], [R / unit + 0.9, '#16171b', 16]].forEach(([r, col, w]) => {
    ctx.strokeStyle = col; ctx.lineWidth = w; ctx.beginPath(); ctx.arc(c, c, unit * r, 0, Math.PI * 2); ctx.stroke();
  });
  grain(ctx, S, S, 8);
}

// A stepped ceiling: frames one inside another, each a step higher, each
// with a line of gold light along its inner edge; and over the table a
// chandelier of glowing frosted tiers.
function decoCeiling(room, CEILING_Y) {
  const black = new THREE.MeshStandardMaterial({ color: 0x0f4e4a, emissive: 0x0f4e4a, emissiveIntensity: 0.35, roughness: 0.3, metalness: 0.3 });
  const glow = new THREE.MeshBasicMaterial({ color: 0xffd58a, toneMapped: false });
  [[26, 22, 0.95], [19, 16, 0.65], [13, 10.5, 0.35]].forEach(([w, d, drop]) => {
    const y = CEILING_Y - drop;
    const t = 0.8;
    [[w, t, 0, d / 2], [w, t, 0, -d / 2], [t, d, w / 2, 0], [t, d, -w / 2, 0]].forEach(([bw, bd, x, z]) => {
      const b = new THREE.Mesh(new THREE.BoxGeometry(bw, 0.35, bd), black);
      b.position.set(x, y, z);
      room.add(b);
    });
    [[w - t, 0.05, 0, d / 2 - t / 2 - 0.03], [w - t, 0.05, 0, -d / 2 + t / 2 + 0.03]].forEach(([bw, bd, x, z]) => {
      const l = new THREE.Mesh(new THREE.BoxGeometry(bw, 0.05, bd), glow);
      l.position.set(x, y - 0.18, z);
      room.add(l);
    });
    [[0.05, d - t, w / 2 - t / 2 - 0.03, 0], [0.05, d - t, -w / 2 + t / 2 + 0.03, 0]].forEach(([bw, bd, x, z]) => {
      const l = new THREE.Mesh(new THREE.BoxGeometry(bw, 0.05, bd), glow);
      l.position.set(x, y - 0.18, z);
      room.add(l);
    });
  });
  const frosted = new THREE.MeshBasicMaterial({ color: 0xffe9c0, toneMapped: false });
  const brass = new THREE.MeshStandardMaterial({ color: 0xc9a25e, roughness: 0.3, metalness: 0.85 });
  [[1.7, 0], [1.25, 0.5], [0.85, 0.95], [0.45, 1.3]].forEach(([r, up]) => {
    const tier = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 0.92, 0.28, 32, 1, true), frosted);
    tier.position.set(0, CEILING_Y - 2.6 + up, -0.4);
    room.add(tier);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(r, 0.04, 6, 40), brass);
    rim.rotation.x = Math.PI / 2;
    rim.position.set(0, CEILING_Y - 2.6 + up - 0.14, -0.4);
    room.add(rim);
  });
  const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.3, 8), brass);
  rod.position.set(0, CEILING_Y - 0.65, -0.4);
  room.add(rod);
}

export const DECO = {
  tableGlow: 0xffd27a,
  ceilingY: 8.4,
  paintWall: paintDecoWall,
  floorPx: 2048, floorRepeat: 1,
  paintFloor: paintDecoFloor,
  noPanel: true,
  ceiling: DECO_TEAL, ceilingGlow: 0.35, cove: 0xffd58a, diffuser: 0xfff0d2, accent: 0xd4ac5c, washAlpha: 0,
  wall: { style: 'panels', base: DECO_TEAL, wainscot: 0x101114, rail: 0xd4ac5c, skirting: 0x0b0c0f },
  floor: { style: 'parquet', base: 0xeee5d3 },
  light: { sky: 0xfff0dc, ground: 0x8a7050, fill: 2.1, key: 0xffe8c8, keyPower: 84, wash: 0xffd9a0, washPower: 56, fog: 0x3a3a34, fogNear: 40, fogFar: 110 },
  furnish(room, half, CEILING_Y) {
    decoCeiling(room, CEILING_Y);
    // Fluted black columns with gilt capitals at the corners of the floor,
    // each throwing a ring of light up from its top.
    const black = new THREE.MeshStandardMaterial({ color: 0x0d0e11, roughness: 0.3, metalness: 0.25 });
    const gilt = new THREE.MeshStandardMaterial({ color: 0xd4ac5c, roughness: 0.28, metalness: 0.9 });
    const glow = new THREE.MeshBasicMaterial({ color: 0xffd58a, toneMapped: false });
    const H = CEILING_Y - FLOOR_Y - 1.0;
    [[-12, -10.4], [12, -10.4], [-12, 12], [12, 12]].forEach(([x, z]) => {
      const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.46, H, 16), black);
      shaft.position.set(x, FLOOR_Y + H / 2, z);
      room.add(shaft);
      [[0.25, 1.3], [H - 0.3, 1.4]].forEach(([y, s]) => {
        const b = new THREE.Mesh(new THREE.CylinderGeometry(0.46 * s, 0.5 * s, 0.5, 16), gilt);
        b.position.set(x, FLOOR_Y + y, z);
        room.add(b);
      });
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.05, 6, 32), glow);
      ring.rotation.x = Math.PI / 2;
      ring.position.set(x, FLOOR_Y + H + 0.02, z);
      room.add(ring);
    });
    // Mirrors and urns either side of the sunburst.
    [-1, 1].forEach((side) => {
      place(room, 'ClassicConsole_01', { x: side * m(3.0), z: -half + m(0.25) });
      place(room, 'brass_vase_02', { x: side * m(3.0), y: FLOOR_Y + m(0.8), z: -half + m(0.25), size: 1.4 });
      place(room, 'potted_plant_02', { x: side * (half - m(0.6)), z: half - m(0.6), size: 1.8 });
      place(room, 'Chandelier_01', { x: side * (half - m(1.55)), y: CEILING_Y - 1.0, z: m(0.2), size: 1.3 });
    });
    place(room, 'potted_plant_02', { x: half - m(0.6), z: -half + m(0.6), size: 1.8 });
    common(room, half, CEILING_Y, {
      signRgb: '232,196,120', signPlate: '#0b0c0f',
      // No rug: the starburst inlaid in the floor is the room's centrepiece.
      rug: null,
      bar: { body: 0x0d0e11, top: 0xf2ece2, wood: 0x1a1210, rgb: '212,172,92', lamp: 'Chandelier_01', lampSize: 0.8 },
      lounge: { sofa: 'Sofa_01', chair: 'GreenChair_01', chair2: 'ArmChair_01', rug: { base: '#16171b', border: '#0b0c0f', accent: '#d4ac5c' }, sofaSize: 1.1 },
    });
  },
};

// =====================================================================
// The Library: two storeys of books under a dome of stars
// =====================================================================

const BOOK_COLORS = ['#6b1f22', '#24402c', '#1f2c4a', '#7a5a2c', '#3a2418', '#5a1a32', '#2e3f3a', '#8a6a3a', '#1c1c1e', '#4a2a1a', '#7a2a1a', '#2a3a5a'];

// A shelf of books, painted: spines of every width, height and colour,
// gilt bands across some, now and then one leaning or a gap.
function paintShelf(ctx, x0, x1, yTop, yBottom, scale) {
  let x = x0 + 2;
  const h = yBottom - yTop;
  while (x < x1 - 6) {
    if (Math.random() < 0.04) { x += scale * (0.05 + Math.random() * 0.06); continue; }
    const w = scale * (0.022 + Math.random() * 0.03);
    if (x + w > x1 - 2) break;
    const bh = h * (0.68 + Math.random() * 0.28);
    const col = BOOK_COLORS[Math.floor(Math.random() * BOOK_COLORS.length)];
    ctx.fillStyle = col;
    ctx.fillRect(x, yBottom - bh, w - 1, bh);
    // Rounded spine: light down one side, dark down the other.
    const sg = ctx.createLinearGradient(x, 0, x + w, 0);
    sg.addColorStop(0, 'rgba(255,255,255,0.12)');
    sg.addColorStop(0.5, 'rgba(255,255,255,0)');
    sg.addColorStop(1, 'rgba(0,0,0,0.35)');
    ctx.fillStyle = sg;
    ctx.fillRect(x, yBottom - bh, w - 1, bh);
    if (Math.random() < 0.6) {
      ctx.fillStyle = 'rgba(214,180,110,0.85)';
      ctx.fillRect(x + 1, yBottom - bh + bh * 0.12, w - 3, Math.max(1.5, bh * 0.025));
      ctx.fillRect(x + 1, yBottom - bh * 0.18, w - 3, Math.max(1.5, bh * 0.02));
    }
    x += w;
  }
  // Shadow under the shelf above.
  const shadowG = ctx.createLinearGradient(0, yTop, 0, yTop + h * 0.3);
  shadowG.addColorStop(0, 'rgba(0,0,0,0.5)');
  shadowG.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = shadowG;
  ctx.fillRect(x0, yTop, x1 - x0, h * 0.3);
}

const GALLERY_Y = m(2.6);   // the gallery's floor, above the room's

function paintLibraryWall(ctx, d, which) {
  const { texW: W, texH: H, px, texY } = d;
  const u = px * m(1);
  const wood = '#3b2414', woodLight = '#5a3820';
  ctx.fillStyle = wood;
  ctx.fillRect(0, 0, W, H);
  const floorY = texY(FLOOR_Y);
  const galleryY = texY(FLOOR_Y + GALLERY_Y);
  const tiers = [[galleryY + u * 0.06, floorY - u * 0.12], [u * 0.5, galleryY - u * 0.32]];
  const bayW = u * 1.0;
  tiers.forEach(([top, bottom]) => {
    for (let x = 0; x < W; x += bayW) {
      // The niche behind the sign, on the back wall's lower tier.
      if (which === 'back' && bottom > galleryY && Math.abs(x + bayW / 2 - W / 2) < u * 1.6) {
        ctx.fillStyle = '#24160d';
        ctx.fillRect(x, top, bayW, bottom - top);
        continue;
      }
      ctx.fillStyle = '#1c110a';
      ctx.fillRect(x + u * 0.04, top, bayW - u * 0.08, bottom - top);
      for (let y = top; y + u * 0.3 < bottom; y += u * 0.34) {
        paintShelf(ctx, x + u * 0.05, x + bayW - u * 0.05, y + u * 0.02, y + u * 0.32, u);
        ctx.fillStyle = woodLight;
        ctx.fillRect(x + u * 0.04, y + u * 0.32, bayW - u * 0.08, u * 0.025);
      }
      ctx.fillStyle = woodLight;
      ctx.fillRect(x, top, u * 0.05, bottom - top);
    }
  });
  // The gallery's fascia, and the crown along the top.
  ctx.fillStyle = woodLight;
  ctx.fillRect(0, galleryY - u * 0.32, W, u * 0.38);
  ctx.fillStyle = 'rgba(214,180,110,0.85)';
  ctx.fillRect(0, galleryY - u * 0.3, W, 4);
  ctx.fillRect(0, galleryY + u * 0.03, W, 4);
  ctx.fillStyle = woodLight;
  ctx.fillRect(0, 0, W, u * 0.5);
  ctx.fillStyle = 'rgba(214,180,110,0.8)';
  ctx.fillRect(0, u * 0.45, W, 4);
}

// Night sky for the dome: deep blue to the rim, stars, a few brighter, and
// the dome's gilt ribs.
function starTexture() {
  const S = 1024;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  g.addColorStop(0, '#1a2a5a');
  g.addColorStop(0.7, '#0e1838');
  g.addColorStop(1, '#070b1e');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, S, S);
  for (let i = 0; i < 1400; i++) {
    const r = Math.random() < 0.04 ? 1.8 + Math.random() * 1.2 : 0.5 + Math.random();
    ctx.fillStyle = `rgba(255,${235 + Math.random() * 20},${200 + Math.random() * 55},${0.5 + Math.random() * 0.5})`;
    ctx.beginPath(); ctx.arc(Math.random() * S, Math.random() * S, r, 0, Math.PI * 2); ctx.fill();
  }
  ctx.strokeStyle = 'rgba(214,180,110,0.9)';
  ctx.lineWidth = 6;
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2;
    ctx.beginPath(); ctx.moveTo(S / 2, S / 2); ctx.lineTo(S / 2 + Math.cos(a) * S / 2, S / 2 + Math.sin(a) * S / 2); ctx.stroke();
  }
  [0.18, 0.5].forEach((r) => { ctx.beginPath(); ctx.arc(S / 2, S / 2, S * r, 0, Math.PI * 2); ctx.stroke(); });
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// A banker's lamp: brass foot and stem, green glass shade, its light on
// the table under it.
function bankersLamp(room, x, y, z, yaw = 0) {
  const g = new THREE.Group();
  const brass = new THREE.MeshStandardMaterial({ color: 0xc9a25e, roughness: 0.3, metalness: 0.85 });
  const foot = new THREE.Mesh(new THREE.CylinderGeometry(m(0.07), m(0.08), m(0.025), 16), brass);
  g.add(foot);
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(m(0.008), m(0.008), m(0.3), 8), brass);
  stem.position.y = m(0.15);
  g.add(stem);
  const shadeGeo = new THREE.CylinderGeometry(m(0.07), m(0.07), m(0.28), 16, 1, true, 0, Math.PI);
  const shadeMesh = new THREE.Mesh(shadeGeo, new THREE.MeshStandardMaterial({ color: 0x1d6b3e, emissive: 0x1d6b3e, emissiveIntensity: 0.9, roughness: 0.2, side: THREE.DoubleSide }));
  shadeMesh.rotation.z = Math.PI / 2;
  shadeMesh.position.y = m(0.31);
  g.add(shadeMesh);
  const pool = new THREE.Mesh(new THREE.CircleGeometry(m(0.28), 24), new THREE.MeshBasicMaterial({ color: 0xffd9a0, transparent: true, opacity: 0.25, depthWrite: false, toneMapped: false }));
  pool.rotation.x = -Math.PI / 2;
  pool.position.y = 0.004;
  g.add(pool);
  g.position.set(x, y, z);
  g.rotation.y = yaw;
  room.add(g);
}

export const LIBRARY = {
  tableGlow: 0xffbe6a,
  ceilingY: 9.6,
  ceilingHole: { x: 0, z: -0.4, r: m(2.4) },
  paintWall: paintLibraryWall,
  noPanel: true,
  ceiling: 0x6a4428, ceilingGlow: 0.45, cove: 0xffd49a, diffuser: 0xfff0d4, accent: 0xc49a56, washAlpha: 0,
  wall: { style: 'panels', base: 0x3b2414, wainscot: 0x3b2414, rail: 0xc49a56, skirting: 0x22160e },
  floor: { style: 'ornate', base: 0x7a2420, pattern: 0xc89a5a },
  light: { sky: 0xfff0dc, ground: 0x8a6440, fill: 2.35, key: 0xffe6c4, keyPower: 84, wash: 0xffd6a4, washPower: 60, fog: 0x3a2a1e, fogNear: 40, fogFar: 110 },
  furnish(room, half, CEILING_Y) {
    const wood = new THREE.MeshStandardMaterial({ color: 0x4a2c18, roughness: 0.55, metalness: 0 });
    const brass = new THREE.MeshStandardMaterial({ color: 0xc9a25e, roughness: 0.3, metalness: 0.85 });
    // The gallery: a walk round the walls at the second storey, on
    // brackets, with a brass rail on turned balusters — broken at the
    // middle of the back wall, where the sign is.
    const depth = m(0.85);
    const gy = FLOOR_Y + GALLERY_Y;
    const runs = [
      // Clear of the bar's tall back bar in the back-left corner.
      { from: [-half + m(4.1), -half + depth / 2], to: [-m(1.7), -half + depth / 2] },
      { from: [m(1.7), -half + depth / 2], to: [half, -half + depth / 2] },
      { from: [-half + depth / 2, -half + m(2.4)], to: [-half + depth / 2, half] },
      { from: [half - depth / 2, -half + depth], to: [half - depth / 2, half] },
    ];
    const railGeo = new THREE.CylinderGeometry(m(0.012), m(0.012), m(0.95), 6);
    let count = 0;
    const posts = [];
    runs.forEach(({ from, to }) => {
      const a = new THREE.Vector3(from[0], 0, from[1]);
      const b = new THREE.Vector3(to[0], 0, to[1]);
      const len = a.distanceTo(b);
      const along = b.clone().sub(a).normalize();
      const across = new THREE.Vector3(along.z, 0, -along.x);
      // Which way is into the room.
      const inward = across.dot(new THREE.Vector3(-a.x, 0, -a.z)) > 0 ? across : across.negate();
      const mid = a.clone().lerp(b, 0.5);
      const slab = new THREE.Mesh(new THREE.BoxGeometry(along.x ? len : depth, m(0.12), along.x ? depth : len), wood);
      slab.position.set(mid.x, gy - m(0.06), mid.z);
      room.add(slab);
      const edgeLine = mid.clone().addScaledVector(inward, depth / 2 - m(0.04));
      const rail = new THREE.Mesh(new THREE.BoxGeometry(along.x ? len : m(0.06), m(0.05), along.x ? m(0.06) : len), brass);
      rail.position.set(edgeLine.x, gy + m(0.95), edgeLine.z);
      room.add(rail);
      const n = Math.floor(len / m(0.16));
      for (let i = 0; i <= n; i++) posts.push(a.clone().addScaledVector(along, (i / n) * len).addScaledVector(inward, depth / 2 - m(0.04)));
      count += n + 1;
    });
    const inst = new THREE.InstancedMesh(railGeo, brass, count);
    const mtx = new THREE.Matrix4();
    posts.forEach((p, i) => { mtx.makeTranslation(p.x, gy + m(0.475), p.z); inst.setMatrixAt(i, mtx); });
    room.add(inst);
    // Brackets under it, a bay apart.
    for (let x = -half + m(4.5); x < half; x += m(1.0)) {
      if (Math.abs(x) < m(1.7)) continue;
      const br = new THREE.Mesh(new THREE.BoxGeometry(m(0.08), m(0.4), depth * 0.8), wood);
      br.position.set(x, gy - m(0.3), -half + depth * 0.4);
      room.add(br);
    }
    // The ladder, leaning on the lower shelves left of the sign.
    const lx = -m(2.6);
    [-1, 1].forEach((s) => {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(m(0.05), m(2.6), m(0.05)), wood);
      rail.position.set(lx + s * m(0.22), FLOOR_Y + m(1.25), -half + m(0.45));
      rail.rotation.x = -0.25;
      room.add(rail);
    });
    for (let k = 0; k < 8; k++) {
      const rung = new THREE.Mesh(new THREE.CylinderGeometry(m(0.015), m(0.015), m(0.44), 6), brass);
      rung.rotation.z = Math.PI / 2;
      const y = m(0.2) + k * m(0.3);
      rung.position.set(lx, FLOOR_Y + y, -half + m(0.45) + Math.sin(0.25) * (m(1.25) - y));
      room.add(rung);
    }
    // The dome over the table: a ring of gilt in the ceiling and the night
    // sky in it.
    const domeR = m(2.4);
    const dome = new THREE.Mesh(new THREE.SphereGeometry(domeR, 40, 16, 0, Math.PI * 2, 0, Math.PI / 2),
      new THREE.MeshBasicMaterial({ map: starTexture(), side: THREE.BackSide, toneMapped: false }));
    dome.position.set(0, CEILING_Y - 0.01, -0.4);
    dome.scale.y = 0.55;
    room.add(dome);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(domeR, m(0.08), 8, 48), brass);
    ring.rotation.x = Math.PI / 2;
    ring.position.set(0, CEILING_Y - 0.02, -0.4);
    room.add(ring);
    // Coffers in the wooden ceiling round it.
    const beamMat = new THREE.MeshStandardMaterial({ color: 0x5a3820, emissive: 0x3a2412, emissiveIntensity: 0.5, roughness: 0.6 });
    for (let k = -3; k <= 3; k++) {
      // None across the dome's opening.
      if (Math.abs(k * m(2.0)) < domeR + m(0.3)) continue;
      [[2 * half, m(0.18), k * m(2.0), 'x'], [m(0.18), 2 * half, k * m(2.0), 'z']].forEach(([w, d2, off, axis]) => {
        const b = new THREE.Mesh(new THREE.BoxGeometry(w, m(0.2), d2), beamMat);
        b.position.set(axis === 'z' ? off : 0, CEILING_Y - m(0.1), axis === 'x' ? off : 0);
        room.add(b);
      });
    }
    // Reading lamps, a globe of a lamp on each lounge's table.
    [-1, 1].forEach((side) => {
      bankersLamp(room, side * (half - m(1.55)), FLOOR_Y + m(0.76), m(0.2), side * Math.PI / 2);
      place(room, 'Chandelier_01', { x: side * (half - m(1.55)), y: CEILING_Y - 0.1, z: m(0.2), size: 1.1 });
      place(room, 'potted_plant_02', { x: side * (half - m(0.6)), z: half - m(0.6), size: 1.7 });
    });
    place(room, 'side_table_tall_01', { x: m(2.4), z: -half + m(0.4) });
    place(room, 'marble_bust_01', { x: m(2.4), y: FLOOR_Y + m(0.72), z: -half + m(0.4), size: 1.2 });
    common(room, half, CEILING_Y, {
      signRgb: '232,196,120', signPlate: '#24160d', signY: FLOOR_Y + m(1.9),
      rug: { base: '#1f3a2c', border: '#10201a', accent: '#d2ad6a' },
      bar: { body: 0x3b2616, top: 0xece4d4, wood: 0x4a2f1c, rgb: '214,178,110', lamp: 'Chandelier_01', lampSize: 0.8 },
      lounge: { sofa: 'sofa_03', chair: 'ArmChair_01', table: 'round_wooden_table_01', rug: { base: '#5a1a1a', border: '#3a1010', accent: '#c9a466' } },
    });
  },
};

// =====================================================================
// The Gold Room: a hall of mirrors
// =====================================================================

// An arched mirror in a gilt frame: the glass a cool silver with a sheen
// across it and the blur of the chandeliers' light caught high in it.
function paintMirror(ctx, x, top, w, h) {
  const arch = w / 2;
  const path = () => {
    ctx.beginPath();
    ctx.moveTo(x, top + h);
    ctx.lineTo(x, top + arch);
    ctx.arc(x + w / 2, top + arch, w / 2, Math.PI, 0);
    ctx.lineTo(x + w, top + h);
    ctx.closePath();
  };
  ctx.save();
  path();
  ctx.clip();
  const g = ctx.createLinearGradient(x, top, x + w, top + h);
  g.addColorStop(0, '#e6e2da');
  g.addColorStop(0.45, '#b9bcc0');
  g.addColorStop(1, '#d8d2c6');
  ctx.fillStyle = g;
  ctx.fillRect(x, top, w, h);
  for (let k = 0; k < 3; k++) {
    ctx.fillStyle = 'rgba(255,255,255,0.16)';
    ctx.beginPath();
    const sx = x + w * (0.1 + k * 0.3);
    ctx.moveTo(sx, top + h);
    ctx.lineTo(sx + w * 0.12, top + h);
    ctx.lineTo(sx + w * 0.42, top);
    ctx.lineTo(sx + w * 0.3, top);
    ctx.fill();
  }
  for (let k = 0; k < 4; k++) {
    const gx = x + w * (0.2 + Math.random() * 0.6), gy = top + h * (0.12 + Math.random() * 0.2);
    const rg = ctx.createRadialGradient(gx, gy, 0, gx, gy, w * 0.16);
    rg.addColorStop(0, 'rgba(255,226,170,0.9)');
    rg.addColorStop(1, 'rgba(255,226,170,0)');
    ctx.fillStyle = rg;
    ctx.fillRect(gx - w * 0.2, gy - w * 0.2, w * 0.4, w * 0.4);
  }
  ctx.restore();
  ctx.strokeStyle = '#c49a48';
  ctx.lineWidth = w * 0.07;
  path();
  ctx.stroke();
  ctx.strokeStyle = '#e8cd8a';
  ctx.lineWidth = w * 0.015;
  path();
  ctx.stroke();
}

function paintMirrorWall(ctx, d, which) {
  const { texW: W, texH: H, px, texY } = d;
  const u = px * m(1);
  ctx.fillStyle = '#f2eadb';
  ctx.fillRect(0, 0, W, H);
  grain(ctx, W, H, 6);
  const floorY = texY(FLOOR_Y);
  // A gilt frieze, a dado of ivory panels.
  ctx.fillStyle = '#c49a48';
  ctx.fillRect(0, u * 0.35, W, u * 0.12);
  for (let x = 10; x < W; x += u * 0.16) { ctx.beginPath(); ctx.arc(x, u * 0.58, u * 0.035, 0, Math.PI * 2); ctx.fill(); }
  const dado = floorY - u * 0.9;
  ctx.fillRect(0, dado - 5, W, 10);
  ctx.strokeStyle = 'rgba(196,154,72,0.8)';
  ctx.lineWidth = 3;
  for (let x = u * 0.2; x < W; x += u * 1.3) ctx.strokeRect(x, dado + u * 0.15, u * 1.0, u * 0.55);
  // The mirrors, a whole number to the wall so they sit the same from
  // either end (the pilasters between them are placed the same way).
  const bay = W / Math.round(d.size / m(2.6));
  const mw = u * 1.5, mTop = u * 0.85, mH = dado - u * 0.15 - mTop;
  for (let cx = bay / 2; cx < W; cx += bay) {
    if (which === 'back' && Math.abs(cx - W / 2) < u * 2.2) continue;
    paintMirror(ctx, cx - mw / 2, mTop, mw, mH);
  }
  if (which !== 'back') drawCasinoCrest(ctx, { x: W / 2, y: u * 1.45, width: u * 1.0, alpha: 0.95, rgb: '176,132,52' });
}

function paintDiagonalMarble(ctx, S) {
  ctx.fillStyle = '#f0ebe1';
  ctx.fillRect(0, 0, S, S);
  ctx.save();
  ctx.translate(S / 2, S / 2);
  ctx.rotate(Math.PI / 4);
  const cell = S / Math.SQRT2 / 2;
  for (let y = -3; y < 3; y++) {
    for (let x = -3; x < 3; x++) {
      if ((x + y) % 2 === 0) continue;
      ctx.fillStyle = '#1a191e';
      ctx.fillRect(x * cell, y * cell, cell, cell);
    }
  }
  ctx.restore();
  for (let k = 0; k < 18; k++) {
    ctx.strokeStyle = 'rgba(120,110,100,0.12)';
    ctx.lineWidth = 1 + Math.random() * 2;
    ctx.beginPath();
    let x = Math.random() * S, y = 0;
    ctx.moveTo(x, y);
    while (y < S) { x += (Math.random() - 0.5) * 40; y += 20 + Math.random() * 30; ctx.lineTo(x, y); }
    ctx.stroke();
  }
  grain(ctx, S, S, 6);
}

// The painted sky over the room: blue going to gold at its edges, clouds,
// in a gilt frame.
function frescoTexture() {
  const W = 1536, H = 1152;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(W / 2, H / 2, 50, W / 2, H / 2, W * 0.6);
  g.addColorStop(0, '#9cc4e6');
  g.addColorStop(0.6, '#c8d9e4');
  g.addColorStop(1, '#f2d9a8');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  for (let k = 0; k < 34; k++) {
    const cx = Math.random() * W, cy = Math.random() * H, r = 60 + Math.random() * 140;
    for (let j = 0; j < 7; j++) {
      const x = cx + (Math.random() - 0.5) * r * 1.6, y = cy + (Math.random() - 0.5) * r * 0.6;
      const rg = ctx.createRadialGradient(x, y, 0, x, y, r * (0.4 + Math.random() * 0.4));
      rg.addColorStop(0, 'rgba(255,250,244,0.85)');
      rg.addColorStop(0.6, 'rgba(255,236,226,0.35)');
      rg.addColorStop(1, 'rgba(255,236,226,0)');
      ctx.fillStyle = rg;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }
  }
  ctx.strokeStyle = '#c49a48';
  ctx.lineWidth = 34;
  ctx.strokeRect(17, 17, W - 34, H - 34);
  ctx.strokeStyle = '#e8cd8a';
  ctx.lineWidth = 6;
  ctx.strokeRect(46, 46, W - 92, H - 92);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

// A marble fireplace, a fire burning in it.
function fireplace(room, z) {
  const marble = new THREE.MeshStandardMaterial({ color: 0xf3eee4, roughness: 0.25, metalness: 0 });
  const g = new THREE.Group();
  const W = m(1.9), H = m(1.25), D = m(0.4);
  [[-1, 0], [1, 0]].forEach(([s]) => {
    const jamb = new THREE.Mesh(new THREE.BoxGeometry(m(0.3), H, D), marble);
    jamb.position.set(s * (W / 2 - m(0.15)), FLOOR_Y + H / 2, 0);
    g.add(jamb);
  });
  const shelf = new THREE.Mesh(new THREE.BoxGeometry(W + m(0.2), m(0.1), D + m(0.12)), marble);
  shelf.position.set(0, FLOOR_Y + H + m(0.05), 0.02);
  g.add(shelf);
  const lintel = new THREE.Mesh(new THREE.BoxGeometry(W, m(0.25), D), marble);
  lintel.position.set(0, FLOOR_Y + H - m(0.125), 0);
  g.add(lintel);
  const box = new THREE.Mesh(new THREE.BoxGeometry(W - m(0.6), H - m(0.25), m(0.05)), new THREE.MeshBasicMaterial({ color: 0x0a0605 }));
  box.position.set(0, FLOOR_Y + (H - m(0.25)) / 2, -D / 2 + m(0.03));
  g.add(box);
  // The fire: soft flames that breathe.
  const fc = document.createElement('canvas');
  fc.width = 128; fc.height = 256;
  const fx = fc.getContext('2d');
  const fg = fx.createRadialGradient(64, 220, 4, 64, 190, 120);
  fg.addColorStop(0, 'rgba(255,240,180,1)');
  fg.addColorStop(0.3, 'rgba(255,150,40,0.9)');
  fg.addColorStop(0.7, 'rgba(200,60,10,0.4)');
  fg.addColorStop(1, 'rgba(120,20,0,0)');
  fx.fillStyle = fg;
  fx.fillRect(0, 0, 128, 256);
  const flameTex = new THREE.CanvasTexture(fc);
  flameTex.colorSpace = THREE.SRGBColorSpace;
  const flames = [];
  for (let i = 0; i < 4; i++) {
    const f = new THREE.Mesh(new THREE.PlaneGeometry(m(0.45), m(0.75)), new THREE.MeshBasicMaterial({ map: flameTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
    f.position.set((i - 1.5) * m(0.22), FLOOR_Y + m(0.36), -D / 2 + m(0.08) + i * 0.005);
    g.add(f);
    flames.push(f);
  }
  g.position.set(0, 0, z);
  room.add(g);
  return (now) => flames.forEach((f, i) => {
    const t = now / 1000 + i * 1.7;
    f.scale.set(0.9 + Math.sin(t * 3.1) * 0.08, 0.85 + Math.sin(t * 4.3 + i) * 0.15 + Math.sin(t * 9.7) * 0.05, 1);
    f.material.opacity = 0.8 + Math.sin(t * 6.1) * 0.15;
  });
}

export const MIRRORS = {
  tableGlow: 0xffdc96,
  ceilingY: 8.8,
  paintWall: paintMirrorWall,
  floorPx: 1024, floorRepeat: 36 / 4,
  paintFloor: paintDiagonalMarble,
  noPanel: true,
  ceiling: 0xf2eadb, ceilingGlow: 0.55, cove: 0xffe0a8, diffuser: 0xfff3da, accent: 0xb8903e, washAlpha: 0,
  wall: { style: 'lacquer', base: 0xf2eadb, trim: 0xc49a48, skirting: 0x1a1714 },
  floor: { style: 'checker', base: 0xf0ebe1, pattern: 0x1a191e },
  light: { sky: 0xfff4e4, ground: 0x7a6650, fill: 1.9, key: 0xfff0d8, keyPower: 76, wash: 0xffe4b8, washPower: 50, fog: 0x8a7a66, fogNear: 40, fogFar: 120 },
  furnish(room, half, CEILING_Y) {
    const wallH = CEILING_Y - FLOOR_Y;
    // The painted sky in its frame, the gilt coffering round it.
    const fresco = new THREE.Mesh(new THREE.PlaneGeometry(20, 15), new THREE.MeshBasicMaterial({ map: frescoTexture() }));
    fresco.rotation.x = Math.PI / 2;
    fresco.position.set(0, CEILING_Y - 0.03, -0.4);
    room.add(fresco);
    // Gilt pilasters between the mirrors, down every wall.
    const bay = (2 * half) / Math.round((2 * half) / m(2.6));
    for (let p = -half + bay; p < half - 0.5; p += bay) {
      [-1, 1].forEach((s) => pilaster(room, s * (half - m(0.04)), p, facingIn(s), wallH, { color: 0xefe6d6, trim: 0xc49a48 }));
      if (Math.abs(p) > m(2.2) && p > -half + m(4.2)) pilaster(room, p, -half + m(0.04), 0, wallH, { color: 0xefe6d6, trim: 0xc49a48 });
      pilaster(room, p, half - m(0.04), Math.PI, wallH, { color: 0xefe6d6, trim: 0xc49a48 });
    }
    // The fireplace behind the dealer, the house sign over it.
    const fire = fireplace(room, -half + m(0.22));
    // Crystal in pairs either side of the table — never between a seat and
    // the sign — and over each lounge.
    [[-m(3.0), -m(2.2)], [m(3.0), -m(2.2)], [-m(3.0), m(2.4)], [m(3.0), m(2.4)]].forEach(([x, z]) => place(room, 'Chandelier_03', { x, y: CEILING_Y, z, size: 2.0 }));
    [-1, 1].forEach((side) => {
      place(room, 'Chandelier_03', { x: side * (half - m(1.55)), y: CEILING_Y, z: m(0.2), size: 1.8 });
      place(room, 'potted_plant_02', { x: side * (half - m(0.6)), z: half - m(0.6), size: 1.8 });
      // Red velvet either side of the fireplace's wall.
      const dr = createDrape(wallH - m(0.4), m(1.1), 0x7a1420);
      dr.position.set(side * m(2.05), FLOOR_Y, -half + m(0.15));
      room.add(dr);
      place(room, side < 0 ? 'horse_statue_01' : 'brass_vase_02', { x: side * m(0.75), y: FLOOR_Y + m(1.33), z: -half + m(0.25), size: side < 0 ? 0.8 : 0.9 });
    });
    place(room, 'potted_plant_02', { x: half - m(0.6), z: -half + m(0.6), size: 1.8 });
    common(room, half, CEILING_Y, {
      signRgb: '232,198,122', signPlate: '#7a1420', signY: FLOOR_Y + m(2.45),
      rug: { base: '#7a1420', border: '#3a0a10', accent: '#e0bf72' },
      bar: { body: 0xefe6d6, top: 0x1d1c20, wood: 0x2a1c14, rgb: '196,154,72', lamp: 'Chandelier_03', lampSize: 1.2 },
      lounge: { sofa: 'Sofa_01', chair: 'ArmChair_01', rug: { base: '#7a1420', border: '#3a0a10', accent: '#e0bf72' }, sofaSize: 1.15 },
    });
    room.userData.update = (dt, now) => fire(now);
  },
};
