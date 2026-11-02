import * as THREE from 'three';
import { place } from './furniture.js';
import { FLOOR_Y, m } from './scale.js';
import { walkway, brandSign, staffPosts, facing } from './layout.js';
import { canvasTex, grain, brass, feltTexture, marble, wood, chipStack, bottleRow, giltText } from './casinoKit.js';

// The Full House: a private card club, the poker room of an old casino.
// Its furniture all its own:
//
//   - poker: four oval tables of walnut, black leather rails and green
//     baize, cards dealt and the flop out, chips before every seat, each
//     under a billiard lamp of three green glass shades;
//   - walls of green leather studded with brass, over mahogany panelling;
//     oil paintings in gilt frames; a ceiling of oak beams over plaster;
//   - a fireplace of black marble, its fire burning, chesterfields and
//     wing chairs before it, a clock on the mantel;
//   - a library wall of books, a reading chair, an oil lamp;
//   - the cigar humidor, the grandfather clock;
//   - a whisky bar of walnut, its front padded in leather, banker's lamps
//     on the counter, the bottles lit amber behind;
//   - herringbone oak and Persian carpets underfoot.

const half = 36;
const CEIL = FLOOR_Y + m(4.6);

const BRASS = brass();
const WALNUT = wood('#3a2214', '#140a04');
const OAK = wood('#5a3a1e', '#2a1808', { across: true });
const BLACK_MARBLE = marble('#141416', '#6a6a70', { veins: 18 });
const LEATHER = new THREE.MeshStandardMaterial({ color: 0x141010, roughness: 0.42 });
const OXBLOOD = new THREE.MeshStandardMaterial({ color: 0x3a0c0c, roughness: 0.45 });
const FELT = new THREE.MeshStandardMaterial({ map: feltTexture('#164a2c'), roughness: 0.95 });
const GREEN_GLASS = new THREE.MeshStandardMaterial({ color: 0x0e5a2a, roughness: 0.15, emissive: 0x0a4a20, emissiveIntensity: 0.6, side: THREE.DoubleSide });
const BULB = new THREE.MeshBasicMaterial({ color: 0xfff0c8, toneMapped: false });

// ---------- the floor ----------
// Wide planks of dark oak, staggered, each board its own shade.
function paintPlanks(ctx, S) {
  ctx.fillStyle = '#24160a';
  ctx.fillRect(0, 0, S, S);
  const rows = 8, rh = S / rows;
  const tones = ['#4a2e18', '#452a16', '#4e321a', '#422814', '#50341c'];
  for (let r = 0; r < rows; r++) {
    let x = -Math.random() * S * 0.5;
    while (x < S) {
      const len = S * (0.35 + Math.random() * 0.4);
      [0, -S, S].forEach((dx) => {
        ctx.fillStyle = tones[Math.floor(Math.random() * tones.length)];
        ctx.fillRect(x + dx + 1, r * rh + 1, len - 2, rh - 2);
      });
      for (let g = 0; g < 10; g++) {
        ctx.strokeStyle = `rgba(20,10,2,${0.1 + Math.random() * 0.15})`;
        ctx.lineWidth = 1;
        const y = r * rh + Math.random() * rh;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.bezierCurveTo(x + len * 0.3, y + 3, x + len * 0.6, y - 3, x + len, y + 1);
        ctx.stroke();
      }
      x += len;
    }
  }
  grain(ctx, S, S, 8);
}

// A Persian carpet: a field of madder red, a medallion of navy and ivory,
// guls and vines in the border.
function persianRug(w, d, x = 0, z = -0.4) {
  const W = 2048, H = Math.round((2048 * d) / w);
  const tex = canvasTex(W, H, (ctx) => {
    ctx.fillStyle = '#6a1414';
    ctx.fillRect(0, 0, W, H);
    // The field's lattice of small guls.
    for (let y = H * 0.16; y < H * 0.84; y += H * 0.07) {
      for (let x = W * 0.12 + ((y / (H * 0.07)) % 2) * W * 0.025; x < W * 0.88; x += W * 0.05) {
        ctx.fillStyle = '#1a2440';
        ctx.beginPath();
        ctx.moveTo(x, y - H * 0.018);
        ctx.lineTo(x + W * 0.012, y);
        ctx.lineTo(x, y + H * 0.018);
        ctx.lineTo(x - W * 0.012, y);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#d8b06a';
        ctx.fillRect(x - 2, y - 2, 4, 4);
      }
    }
    // The medallion.
    ctx.save();
    ctx.translate(W / 2, H / 2);
    const lobes = (r, col) => {
      ctx.fillStyle = col;
      ctx.beginPath();
      for (let k = 0; k <= 64; k++) {
        const a = (k / 64) * Math.PI * 2;
        const rr = r * (1 + 0.12 * Math.cos(a * 8));
        ctx.lineTo(Math.cos(a) * rr * (W / H), Math.sin(a) * rr);
      }
      ctx.fill();
    };
    lobes(H * 0.26, '#d8c49a');
    lobes(H * 0.22, '#1a2440');
    lobes(H * 0.14, '#8a1a1a');
    lobes(H * 0.07, '#d8b06a');
    ctx.restore();
    // The border, its bands and its vine.
    const b = H * 0.1;
    ctx.fillStyle = '#1a2440';
    [[0, 0, W, b], [0, H - b, W, b], [0, 0, b, H], [W - b, 0, b, H]].forEach((r) => ctx.fillRect(...r));
    ctx.strokeStyle = '#d8c49a';
    ctx.lineWidth = 6;
    ctx.strokeRect(b * 0.2, b * 0.2, W - b * 0.4, H - b * 0.4);
    ctx.strokeRect(b, b, W - 2 * b, H - 2 * b);
    ctx.strokeStyle = '#b8862a';
    ctx.lineWidth = 4;
    ctx.beginPath();
    for (let x = 0; x < W; x += 4) ctx.lineTo(x, b / 2 + Math.sin(x / 30) * b * 0.15);
    ctx.stroke();
    ctx.beginPath();
    for (let x = 0; x < W; x += 4) ctx.lineTo(x, H - b / 2 + Math.sin(x / 30) * b * 0.15);
    ctx.stroke();
    grain(ctx, W, H, 22);
  });
  const rug = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshLambertMaterial({ map: tex }));
  rug.rotation.x = -Math.PI / 2;
  rug.position.set(x, FLOOR_Y + 0.006, z);
  rug.receiveShadow = true;
  return rug;
}

// ---------- the walls ----------
// Green leather in panels edged with brass nailheads, over mahogany
// panelling; a picture rail, a cornice of walnut.
function paintClubWall(ctx, d) {
  const { texW: W, texH: H, px } = d;
  const u = px * m(1);
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#163222');
  g.addColorStop(1, '#1e3e2a');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  grain(ctx, W, H, 14);
  const dado = H - u * 1.15, rail = u * 0.7;
  // The leather panels and their nailheads.
  const pw = u * 1.5;
  for (let x = u * 0.15; x < W; x += pw) {
    const y0 = rail + u * 0.15, h = dado - y0 - u * 0.15;
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.lineWidth = 4;
    ctx.strokeRect(x, y0, pw - u * 0.2, h);
    ctx.fillStyle = '#c8a260';
    for (let t = 0; t < 1; t += 0.035) {
      [[x + t * (pw - u * 0.2), y0], [x + t * (pw - u * 0.2), y0 + h]].forEach(([nx, ny]) => { ctx.beginPath(); ctx.arc(nx, ny, 3.2, 0, Math.PI * 2); ctx.fill(); });
    }
    for (let t = 0; t < 1; t += 0.02) {
      [[x, y0 + t * h], [x + pw - u * 0.2, y0 + t * h]].forEach(([nx, ny]) => { ctx.beginPath(); ctx.arc(nx, ny, 3.2, 0, Math.PI * 2); ctx.fill(); });
    }
  }
  // The cornice and picture rail.
  ctx.fillStyle = '#2a180c';
  ctx.fillRect(0, 0, W, rail * 0.6);
  ctx.fillStyle = '#b8965a';
  ctx.fillRect(0, rail - 5, W, 6);
  // The panelling.
  const pg = ctx.createLinearGradient(0, dado, 0, H);
  pg.addColorStop(0, '#4a1c10');
  pg.addColorStop(1, '#2e100a');
  ctx.fillStyle = pg;
  ctx.fillRect(0, dado, W, H - dado);
  for (let x = u * 0.1; x < W; x += u * 0.9) {
    ctx.strokeStyle = 'rgba(0,0,0,0.5)';
    ctx.lineWidth = 5;
    ctx.strokeRect(x + 3, dado + u * 0.18 + 3, u * 0.7, H - dado - u * 0.45);
    ctx.strokeStyle = 'rgba(200,140,90,0.22)';
    ctx.lineWidth = 3;
    ctx.strokeRect(x, dado + u * 0.18, u * 0.7, H - dado - u * 0.45);
  }
  ctx.fillStyle = '#1e0c06';
  ctx.fillRect(0, dado - 8, W, 14);
  ctx.fillRect(0, H - u * 0.14, W, u * 0.14);
}

// ---------- the ceiling ----------
// Beams of oak across warm plaster.
function beamedCeiling(room) {
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(2 * half, 2 * half), new THREE.MeshStandardMaterial({ color: 0x9a8a6c, roughness: 0.9 }));
  const beamMat = OAK.clone();
  beamMat.map = OAK.map.clone();
  beamMat.map.repeat.set(12, 1);
  beamMat.map.needsUpdate = true;
  beamMat.color.setHex(0x8a7a6a);
  ceil.rotation.x = Math.PI / 2;
  ceil.position.y = CEIL;
  room.add(ceil);
  for (let x = -half + m(2.2); x < half; x += m(2.4)) {
    const beam = new THREE.Mesh(new THREE.BoxGeometry(m(0.32), m(0.42), 2 * half), beamMat);
    beam.position.set(x, CEIL - m(0.21), 0);
    room.add(beam);
  }
  [-half + m(0.2), half - m(0.2)].forEach((z) => {
    const b = new THREE.Mesh(new THREE.BoxGeometry(2 * half, m(0.5), m(0.4)), beamMat);
    b.position.set(0, CEIL - m(0.25), z);
    room.add(b);
  });
}

// ---------- cards ----------
const SUITS = { S: ['♠', '#141414'], H: ['♥', '#b3122e'], D: ['♦', '#b3122e'], C: ['♣', '#141414'] };
const cardTexs = {};
function cardFace(rank, suit) {
  const key = rank + suit;
  if (cardTexs[key]) return cardTexs[key];
  const [sym, col] = SUITS[suit];
  cardTexs[key] = canvasTex(180, 252, (ctx, w, h) => {
    ctx.fillStyle = '#fbf8f0';
    ctx.beginPath();
    ctx.roundRect(0, 0, w, h, 14);
    ctx.fill();
    ctx.fillStyle = col;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '700 40px Georgia, serif';
    ctx.fillText(rank, 26, 30);
    ctx.font = '34px Georgia, serif';
    ctx.fillText(sym + '︎', 26, 66);
    ctx.save();
    ctx.translate(w - 26, h - 30);
    ctx.rotate(Math.PI);
    ctx.font = '700 40px Georgia, serif';
    ctx.fillText(rank, 0, 0);
    ctx.font = '34px Georgia, serif';
    ctx.fillText(sym + '︎', 0, 36);
    ctx.restore();
    ctx.font = '110px Georgia, serif';
    ctx.fillText(sym + '︎', w / 2, h / 2 + 6);
  });
  return cardTexs[key];
}
let backTex = null;
function cardBack() {
  if (!backTex) {
    backTex = canvasTex(180, 252, (ctx, w, h) => {
      ctx.fillStyle = '#fbf8f0';
      ctx.beginPath();
      ctx.roundRect(0, 0, w, h, 14);
      ctx.fill();
      ctx.fillStyle = '#7a1420';
      ctx.fillRect(12, 12, w - 24, h - 24);
      ctx.strokeStyle = 'rgba(255,230,200,0.35)';
      ctx.lineWidth = 2;
      for (let k = -h; k < w + h; k += 12) {
        ctx.beginPath(); ctx.moveTo(k, 12); ctx.lineTo(k + h, h); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(k + h, 12); ctx.lineTo(k, h); ctx.stroke();
      }
    });
  }
  return backTex;
}
const CARD_GEO = new THREE.PlaneGeometry(m(0.063), m(0.088));
function card(parent, x, y, z, rot, rank, suit) {
  const tex = rank ? cardFace(rank, suit) : cardBack();
  const c = new THREE.Mesh(CARD_GEO, new THREE.MeshStandardMaterial({ map: tex, transparent: true, alphaTest: 0.5, roughness: 0.5 }));
  c.rotation.set(-Math.PI / 2, 0, rot);
  c.position.set(x, y, z);
  parent.add(c);
}

// ---------- poker ----------
function stadium(L, W) {
  const s = new THREE.Shape();
  const r = W / 2, hl = L / 2 - r;
  s.moveTo(-hl, -r);
  s.lineTo(hl, -r);
  s.absarc(hl, 0, r, -Math.PI / 2, Math.PI / 2, false);
  s.lineTo(-hl, r);
  s.absarc(-hl, 0, r, Math.PI / 2, (3 * Math.PI) / 2, false);
  return s;
}
const FLOPS = [
  [['A', 'S'], ['K', 'S'], ['7', 'H']],
  [['Q', 'D'], ['Q', 'C'], ['4', 'S'], ['J', 'H']],
  [['10', 'H'], ['9', 'H'], ['2', 'C'], ['8', 'D'], ['K', 'H']],
  [['5', 'C'], ['5', 'D'], ['A', 'H']],
];
// An oval poker table of walnut: a black leather rail, a wood racetrack,
// green baize; cards and chips before the seats, the board in the middle;
// wooden chairs round it, a billiard lamp of three green shades over it.
function pokerTable(room, x, z, yaw, k) {
  const g = new THREE.Group();
  const L = m(2.6), W = m(1.3), H = FLOOR_Y + m(0.78);
  const felt = new THREE.Mesh(new THREE.ShapeGeometry(stadium(L - m(0.3), W - m(0.3)), 32), FELT);
  felt.rotation.x = -Math.PI / 2;
  felt.position.y = H;
  g.add(felt);
  const track = new THREE.Mesh(new THREE.ExtrudeGeometry((() => { const s = stadium(L - m(0.14), W - m(0.14)); s.holes.push(stadium(L - m(0.3), W - m(0.3))); return s; })(), { depth: m(0.02), bevelEnabled: false, curveSegments: 32 }), WALNUT);
  track.rotation.x = -Math.PI / 2;
  track.position.y = H - m(0.012);
  g.add(track);
  const rail = new THREE.Mesh(new THREE.ExtrudeGeometry((() => { const s = stadium(L, W); s.holes.push(stadium(L - m(0.14), W - m(0.14))); return s; })(), { depth: m(0.05), bevelEnabled: true, bevelThickness: m(0.03), bevelSize: m(0.025), bevelSegments: 5, curveSegments: 32 }), LEATHER);
  rail.rotation.x = -Math.PI / 2;
  rail.position.y = H;
  g.add(rail);
  const apron = new THREE.Mesh(new THREE.ExtrudeGeometry(stadium(L - m(0.06), W - m(0.06)), { depth: m(0.12), bevelEnabled: false, curveSegments: 32 }), WALNUT);
  apron.rotation.x = -Math.PI / 2;
  apron.position.y = H - m(0.14);
  g.add(apron);
  [-1, 1].forEach((s) => {
    const ped = new THREE.Mesh(new THREE.CylinderGeometry(m(0.09), m(0.14), m(0.62), 16), WALNUT);
    ped.position.set(s * m(0.6), FLOOR_Y + m(0.33), 0);
    g.add(ped);
    const foot = new THREE.Mesh(new THREE.BoxGeometry(m(0.16), m(0.06), W * 0.7), WALNUT);
    foot.position.set(s * m(0.6), FLOOR_Y + m(0.03), 0);
    g.add(foot);
  });
  // The seats round it: two down each side, one at each end.
  const seats = [[-0.5, 1], [0.5, 1], [-0.5, -1], [0.5, -1]].map(([sx, sz]) => [sx * L * 0.55, sz * (W / 2 + m(0.35))]);
  seats.push([L / 2 + m(0.35), 0], [-L / 2 - m(0.35), 0]);
  const cy = H + 0.004;
  const colours = ['red', 'green', 'black', 'white', 'blue', 'purple'];
  seats.forEach(([sx, sz], i) => {
    // Where the player's cards and chips lie: in from the rail toward them.
    const ix = sx * 0.62, iz = sz * 0.5;
    card(g, ix - m(0.02), cy + i * 0.0002, iz, Math.atan2(sx, sz) + 0.1);
    card(g, ix + m(0.02), cy + 0.0005 + i * 0.0002, iz, Math.atan2(sx, sz) - 0.1);
    chipStack(g, sx * 0.72 + m(0.06), cy, sz * 0.68, 6 + ((i * 5 + k) % 9), colours[(i + k) % colours.length]);
    chipStack(g, sx * 0.72 - m(0.04), cy, sz * 0.68 + m(0.03), 3 + ((i * 3 + k) % 7), colours[(i + k + 2) % colours.length]);
  });
  // The board and the pot.
  FLOPS[k % FLOPS.length].forEach(([r, s], i, all) => card(g, (i - (all.length - 1) / 2) * m(0.075), cy, -m(0.06), 0, r, s));
  chipStack(g, -m(0.08), cy, m(0.12), 9, 'black');
  chipStack(g, m(0.0), cy, m(0.14), 14, 'red');
  chipStack(g, m(0.08), cy, m(0.11), 7, 'green');
  // The dealer button.
  const btn = new THREE.Mesh(new THREE.CylinderGeometry(m(0.022), m(0.022), m(0.008), 20), new THREE.MeshStandardMaterial({ color: 0xf4f0e6, roughness: 0.3 }));
  btn.position.set(seats[k % 4][0] * 0.5, cy + m(0.004), seats[k % 4][1] * 0.35);
  g.add(btn);
  g.position.set(x, 0, z);
  g.rotation.y = yaw;
  room.add(g);
  // Chairs, placed in the room's frame.
  const c = Math.cos(yaw), s = Math.sin(yaw);
  seats.forEach(([sx, sz]) => {
    const wx = x + sx * c + sz * s, wz = z - sx * s + sz * c;
    place(room, 'dining_chair_02', { x: wx, z: wz, yaw: facing(wx, wz, x, z) });
  });
  billiardLamp(room, x, z, yaw);
}
// Three shades of green glass on a brass bar, hung on chains, a pool of
// light under each on the table.
function billiardLamp(room, x, z, yaw) {
  const g = new THREE.Group();
  const y = FLOOR_Y + m(1.95);
  const bar = new THREE.Mesh(new THREE.CylinderGeometry(m(0.02), m(0.02), m(1.9), 10), BRASS);
  bar.rotation.z = Math.PI / 2;
  bar.position.y = y + m(0.1);
  g.add(bar);
  const shadeGeo = new THREE.CylinderGeometry(m(0.07), m(0.2), m(0.18), 24, 1, true);
  [-1, 0, 1].forEach((i) => {
    const shade = new THREE.Mesh(shadeGeo, GREEN_GLASS);
    shade.position.set(i * m(0.72), y, 0);
    g.add(shade);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(m(0.03), m(0.07), m(0.05), 16), BRASS);
    cap.position.set(i * m(0.72), y + m(0.1), 0);
    g.add(cap);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(m(0.045), 12, 8), BULB);
    bulb.position.set(i * m(0.72), y - m(0.04), 0);
    g.add(bulb);
  });
  [-1, 1].forEach((i) => {
    const len = CEIL - y - m(0.1);
    const chain = new THREE.Mesh(new THREE.CylinderGeometry(m(0.008), m(0.008), len, 6), BRASS);
    chain.position.set(i * m(0.85), y + m(0.1) + len / 2, 0);
    g.add(chain);
  });
  g.position.set(x, 0, z);
  g.rotation.y = yaw;
  room.add(g);
}

// ---------- the fireplace ----------
// A chimneypiece of black marble, a fire of logs burning in it, the glow
// it throws on the hearth.
function fireplace(room, x, z, yaw) {
  const g = new THREE.Group();
  const surround = new THREE.Mesh(new THREE.BoxGeometry(m(2.2), m(1.3), m(0.35)), BLACK_MARBLE);
  surround.position.y = FLOOR_Y + m(0.65);
  g.add(surround);
  const mantel = new THREE.Mesh(new THREE.BoxGeometry(m(2.5), m(0.1), m(0.45)), BLACK_MARBLE);
  mantel.position.y = FLOOR_Y + m(1.35);
  g.add(mantel);
  const hearth = new THREE.Mesh(new THREE.BoxGeometry(m(2.4), m(0.05), m(0.8)), BLACK_MARBLE);
  hearth.position.set(0, FLOOR_Y + m(0.025), m(0.3));
  g.add(hearth);
  const box = new THREE.Mesh(new THREE.BoxGeometry(m(1.1), m(0.85), m(0.36)), new THREE.MeshStandardMaterial({ color: 0x080606, roughness: 1 }));
  box.position.set(0, FLOOR_Y + m(0.47), m(0.01));
  g.add(box);
  const chimney = new THREE.Mesh(new THREE.BoxGeometry(m(1.9), CEIL - FLOOR_Y - m(1.4), m(0.3)), WALNUT);
  chimney.position.set(0, (CEIL + FLOOR_Y + m(1.4)) / 2, -m(0.03));
  g.add(chimney);
  // The logs, glowing, and the flames over them.
  const ember = new THREE.MeshStandardMaterial({ color: 0x2a1408, emissive: 0xff4a10, emissiveIntensity: 0.7, roughness: 1 });
  [[-0.15, 0.3], [0.15, -0.3], [0, 0.05]].forEach(([dx, rot], i) => {
    const log = new THREE.Mesh(new THREE.CylinderGeometry(m(0.06), m(0.07), m(0.7), 10), ember);
    log.rotation.set(0, rot, Math.PI / 2);
    log.position.set(m(dx), FLOOR_Y + m(0.12) + i * m(0.06), m(0.18));
    g.add(log);
  });
  const flameTex = canvasTex(128, 256, (ctx, w, h) => {
    const gr = ctx.createRadialGradient(w / 2, h * 0.8, 4, w / 2, h * 0.7, h * 0.6);
    gr.addColorStop(0, 'rgba(255,240,180,1)');
    gr.addColorStop(0.25, 'rgba(255,170,60,0.85)');
    gr.addColorStop(0.6, 'rgba(220,70,10,0.35)');
    gr.addColorStop(1, 'rgba(120,20,0,0)');
    ctx.fillStyle = gr;
    ctx.beginPath();
    ctx.moveTo(w * 0.1, h);
    ctx.quadraticCurveTo(w * 0.05, h * 0.4, w / 2, 0);
    ctx.quadraticCurveTo(w * 0.95, h * 0.4, w * 0.9, h);
    ctx.fill();
  });
  const flameMat = new THREE.MeshBasicMaterial({ map: flameTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, side: THREE.DoubleSide });
  const flames = [];
  for (let i = 0; i < 7; i++) {
    const f = new THREE.Mesh(new THREE.PlaneGeometry(m(0.22), m(0.42)), flameMat);
    f.position.set(m(-0.33 + i * 0.11), FLOOR_Y + m(0.35), m(0.18) + (i % 2) * m(0.03));
    f.rotation.y = (i - 3) * 0.2;
    g.add(f);
    flames.push(f);
  }
  const glowTex = canvasTex(128, 128, (ctx) => {
    const gg = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    gg.addColorStop(0, 'rgba(255,140,50,0.45)');
    gg.addColorStop(1, 'rgba(255,140,50,0)');
    ctx.fillStyle = gg;
    ctx.fillRect(0, 0, 128, 128);
  });
  const pool = new THREE.Mesh(new THREE.PlaneGeometry(m(4.5), m(3.0)), new THREE.MeshBasicMaterial({ map: glowTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
  pool.rotation.x = -Math.PI / 2;
  pool.position.set(0, FLOOR_Y + 0.012, m(1.0));
  g.add(pool);
  g.position.set(x, 0, z);
  g.rotation.y = yaw;
  room.add(g);
  place(room, 'mantel_clock_01', { x: x + Math.sin(yaw) * m(0.05), y: FLOOR_Y + m(1.4), z: z + Math.cos(yaw) * m(0.05), yaw, size: 1.6 });
  place(room, 'fancy_picture_frame_02', { x: x + Math.sin(yaw) * m(0.14), y: FLOOR_Y + m(2.2), z: z + Math.cos(yaw) * m(0.14), yaw, size: 2.4 });
  return (dt, now) => {
    flames.forEach((f, i) => {
      const t = now / 1000;
      f.scale.y = 0.8 + Math.sin(t * 7 + i * 1.9) * 0.18 + Math.sin(t * 13 + i) * 0.1;
      f.scale.x = 0.9 + Math.sin(t * 5 + i * 2.3) * 0.1;
    });
    pool.material.opacity = 0.85 + Math.sin(now / 120) * 0.1;
  };
}

// ---------- the library ----------
// A wall of books in walnut cases, spines of every leather.
function bookcase(room, x, z, yaw, w = m(2.4)) {
  const g = new THREE.Group();
  const h = m(2.8), d = m(0.38);
  const carcass = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), WALNUT);
  carcass.position.set(0, FLOOR_Y + h / 2, -d / 2);
  g.add(carcass);
  const back = new THREE.Mesh(new THREE.PlaneGeometry(w - m(0.1), h - m(0.2)), new THREE.MeshStandardMaterial({ color: 0x140a06, roughness: 1 }));
  back.position.set(0, FLOOR_Y + h / 2, 0.01);
  g.add(back);
  const SPINES = [0x5a1a14, 0x1a2a1a, 0x2a1a3a, 0x6a4a1a, 0x1a1a2a, 0x4a2a14, 0x7a6a4a, 0x3a0a0a];
  const rows = 6, rowH = (h - m(0.3)) / rows;
  const books = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ roughness: 0.6 }), rows * 60);
  const mtx = new THREE.Matrix4(), col = new THREE.Color();
  let n = 0;
  for (let r = 0; r < rows; r++) {
    const y0 = FLOOR_Y + m(0.15) + r * rowH;
    const shelf = new THREE.Mesh(new THREE.BoxGeometry(w - m(0.06), m(0.03), d), WALNUT);
    shelf.position.set(0, y0, -d / 2 + 0.02);
    g.add(shelf);
    let bx = -w / 2 + m(0.06);
    while (bx < w / 2 - m(0.1) && n < rows * 60) {
      const bw = m(0.025 + Math.random() * 0.03), bh = rowH * (0.62 + Math.random() * 0.25);
      mtx.makeScale(bw, bh, m(0.24));
      mtx.setPosition(bx + bw / 2, y0 + m(0.015) + bh / 2, -m(0.13) + 0.03);
      books.setMatrixAt(n, mtx);
      books.setColorAt(n, col.setHex(SPINES[Math.floor(Math.random() * SPINES.length)]));
      n++;
      bx += bw + m(0.002);
      if (Math.random() < 0.04) bx += m(0.12);
    }
  }
  books.count = n;
  g.add(books);
  const cornice = new THREE.Mesh(new THREE.BoxGeometry(w + m(0.1), m(0.12), d + m(0.06)), WALNUT);
  cornice.position.set(0, FLOOR_Y + h + m(0.06), -d / 2);
  g.add(cornice);
  g.position.set(x, 0, z);
  g.rotation.y = yaw;
  room.add(g);
}

// A low table of walnut, a leather top.
function clubTable(room, x, z, yaw = 0) {
  const g = new THREE.Group();
  const top = new THREE.Mesh(new THREE.BoxGeometry(m(1.2), m(0.05), m(0.65)), WALNUT);
  top.position.y = FLOOR_Y + m(0.44);
  g.add(top);
  const inset = new THREE.Mesh(new THREE.PlaneGeometry(m(1.05), m(0.5)), OXBLOOD);
  inset.rotation.x = -Math.PI / 2;
  inset.position.y = FLOOR_Y + m(0.4655);
  g.add(inset);
  [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(m(0.03), m(0.022), m(0.42), 10), WALNUT);
    leg.position.set(sx * m(0.52), FLOOR_Y + m(0.21), sz * m(0.27));
    g.add(leg);
  });
  g.position.set(x, 0, z);
  g.rotation.y = yaw;
  room.add(g);
  // A decanter and two glasses on it.
  const dec = new THREE.Mesh(new THREE.LatheGeometry([[0, 0], [0.06, 0], [0.065, 0.08], [0.03, 0.16], [0.015, 0.2], [0.03, 0.24], [0, 0.24]].map(([r, h]) => new THREE.Vector2(m(r), m(h))), 20), new THREE.MeshPhysicalMaterial({ color: 0xb8701a, roughness: 0.02, transmission: 0, clearcoat: 1, emissive: 0x3a1a04, emissiveIntensity: 0.4 }));
  dec.position.set(x, FLOOR_Y + m(0.465), z);
  room.add(dec);
}

// ---------- the bar ----------
// A whisky bar: walnut, its front padded in buttoned leather, a brass
// rail; banker's lamps along the counter; amber-lit shelves of bottles.
function whiskyBar(room) {
  const len = m(5.6);
  const x = -half + m(1.1) + len / 2;
  const z = -half + m(2.0);
  const body = new THREE.Mesh(new THREE.BoxGeometry(len, m(1.0), m(0.6)), WALNUT);
  body.position.set(x, FLOOR_Y + m(0.5), z);
  room.add(body);
  const pad = new THREE.Mesh(new THREE.BoxGeometry(len - m(0.1), m(0.62), m(0.05)), OXBLOOD);
  pad.position.set(x, FLOOR_Y + m(0.56), z + m(0.31));
  room.add(pad);
  const buttons = new THREE.InstancedMesh(new THREE.SphereGeometry(m(0.012), 8, 6), new THREE.MeshStandardMaterial({ color: 0x1a0404, roughness: 0.5 }), 200);
  const mtx = new THREE.Matrix4();
  let n = 0;
  for (let i = 0; i < 40; i++) for (let j = 0; j < 4; j++) {
    mtx.makeTranslation(x - len / 2 + m(0.12) + i * ((len - m(0.24)) / 39) + (j % 2) * m(0.035), FLOOR_Y + m(0.33) + j * m(0.15), z + m(0.337));
    buttons.setMatrixAt(n++, mtx);
  }
  buttons.count = n;
  room.add(buttons);
  const top = new THREE.Mesh(new THREE.BoxGeometry(len + m(0.14), m(0.07), m(0.8)), WALNUT);
  top.position.set(x, FLOOR_Y + m(1.035), z - m(0.05));
  room.add(top);
  const rail = new THREE.Mesh(new THREE.CylinderGeometry(m(0.024), m(0.024), len, 12), BRASS);
  rail.rotation.z = Math.PI / 2;
  rail.position.set(x, FLOOR_Y + m(0.18), z + m(0.45));
  room.add(rail);
  // Banker's lamps along the counter.
  [-0.3, 0.05, 0.4].forEach((t) => {
    const lx = x + t * len, lz = z - m(0.15);
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(m(0.012), m(0.05), m(0.3), 10), BRASS);
    stem.position.set(lx, FLOOR_Y + m(1.22), lz);
    room.add(stem);
    const shade = new THREE.Mesh(new THREE.CylinderGeometry(m(0.07), m(0.07), m(0.26), 16, 1, true, 0, Math.PI), GREEN_GLASS);
    shade.rotation.set(0, 0, Math.PI / 2);
    shade.position.set(lx, FLOOR_Y + m(1.4), lz + m(0.03));
    room.add(shade);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(m(0.03), 10, 6), BULB);
    bulb.position.set(lx, FLOOR_Y + m(1.37), lz + m(0.05));
    room.add(bulb);
  });
  // The back bar: walnut, amber light behind the shelves.
  const back = new THREE.Mesh(new THREE.BoxGeometry(len, m(3.0), m(0.14)), WALNUT);
  back.position.set(x, FLOOR_Y + m(1.5), -half + m(0.16));
  room.add(back);
  const amber = new THREE.Mesh(new THREE.PlaneGeometry(len - m(0.4), m(1.5)), new THREE.MeshBasicMaterial({ color: 0xc8782a, toneMapped: false }));
  amber.position.set(x, FLOOR_Y + m(1.75), -half + m(0.235));
  room.add(amber);
  const SHELF = new THREE.MeshStandardMaterial({ color: 0xdfe8e8, roughness: 0.05, transparent: true, opacity: 0.35 });
  [1.1, 1.55, 2.0].forEach((y) => {
    const shelf = new THREE.Mesh(new THREE.BoxGeometry(len - m(0.4), m(0.02), m(0.26)), SHELF);
    shelf.position.set(x, FLOOR_Y + m(y), -half + m(0.38));
    room.add(shelf);
    bottleRow(room, x - len / 2 + m(0.3), x + len / 2 - m(0.3), FLOOR_Y + m(y) + m(0.01), -half + m(0.38), [0x8a4a10, 0x6a3008, 0xa8661a, 0x2a1a0a, 0xc88a3a, 0x3a2a10], m(0.12));
  });
  const sign = giltText('Whisky & Cigars', m(2.6), m(0.4), "italic 600 {S}px Georgia, serif");
  sign.position.set(x, FLOOR_Y + m(2.75), -half + m(0.24));
  room.add(sign);
  // Stools of walnut and leather.
  for (let i = 0; i < 6; i++) {
    const sx = x - len / 2 + (i + 0.5) * (len / 6);
    const post = new THREE.Mesh(new THREE.CylinderGeometry(m(0.03), m(0.04), m(0.74), 12), WALNUT);
    post.position.set(sx, FLOOR_Y + m(0.37), z + m(0.75));
    room.add(post);
    const foot = new THREE.Mesh(new THREE.TorusGeometry(m(0.16), m(0.012), 6, 24), BRASS);
    foot.rotation.x = Math.PI / 2;
    foot.position.set(sx, FLOOR_Y + m(0.25), z + m(0.75));
    room.add(foot);
    const seat = new THREE.Mesh(new THREE.CylinderGeometry(m(0.21), m(0.19), m(0.1), 24), OXBLOOD);
    seat.position.set(sx, FLOOR_Y + m(0.79), z + m(0.75));
    room.add(seat);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(m(0.18), m(0.2), m(0.03), 24), WALNUT);
    base.position.set(sx, FLOOR_Y + m(0.015), z + m(0.75));
    room.add(base);
  }
  room.userData.bar = {
    bartender: { pos: new THREE.Vector3(x - len * 0.1, 0, -half + m(0.9)), yaw: 0 },
    pickup: { pos: new THREE.Vector3(x + len / 2 + m(0.55), 0, z - m(0.1)), look: new THREE.Vector3(x, 0, z) },
  };
}

// The main table's light: a ring of brass with green shades round it.
function tableChandelier(room) {
  const y = FLOOR_Y + m(3.55);
  const g = new THREE.Group();
  g.position.set(0, y, -0.4);
  room.add(g);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(m(1.5), m(0.03), 8, 64), BRASS);
  ring.rotation.x = Math.PI / 2;
  g.add(ring);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const shade = new THREE.Mesh(new THREE.CylinderGeometry(m(0.06), m(0.16), m(0.15), 20, 1, true), GREEN_GLASS);
    shade.position.set(Math.cos(a) * m(1.5), -m(0.06), Math.sin(a) * m(1.5));
    g.add(shade);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(m(0.035), 10, 6), BULB);
    bulb.position.set(Math.cos(a) * m(1.5), -m(0.1), Math.sin(a) * m(1.5));
    g.add(bulb);
  }
  [0, 1, 2].forEach((k) => {
    const a = (k / 3) * Math.PI * 2;
    const len = CEIL - y;
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(m(0.01), m(0.01), len, 6), BRASS);
    rod.position.set(Math.cos(a) * m(1.5), len / 2, Math.sin(a) * m(1.5));
    g.add(rod);
  });
}

// Double doors in the front wall: walnut, panelled, brass handles.
function doors(room) {
  [-1, 1].forEach((s) => {
    const door = new THREE.Mesh(new THREE.BoxGeometry(m(0.95), m(2.6), m(0.08)), WALNUT);
    door.position.set(s * m(0.5), FLOOR_Y + m(1.3), half - m(0.04));
    room.add(door);
    [0.75, 1.9].forEach((y) => {
      const p = new THREE.Mesh(new THREE.BoxGeometry(m(0.7), y > 1 ? m(1.0) : m(0.8), m(0.02)), WALNUT);
      p.position.set(s * m(0.5), FLOOR_Y + m(y), half - m(0.09));
      room.add(p);
    });
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(m(0.015), m(0.015), m(0.3), 8), BRASS);
    handle.position.set(s * m(0.1), FLOOR_Y + m(1.1), half - m(0.12));
    room.add(handle);
  });
  const frame = new THREE.Mesh(new THREE.BoxGeometry(m(2.3), m(0.2), m(0.14)), WALNUT);
  frame.position.set(0, FLOOR_Y + m(2.7), half - m(0.07));
  room.add(frame);
}

// ---------- the room ----------
export const FULL_HOUSE = {
  tableGlow: 0xffc070,
  half,
  ceilingY: CEIL,
  ceiling: null, noPanel: true, noCove: true,
  paintWall: (ctx, d) => paintClubWall(ctx, d),
  floorPx: 1024, floorRepeat: 72 / m(1.8),
  paintFloor: paintPlanks,
  accent: 0xb8965a, cove: 0xffc884, diffuser: 0xfff0d2, washAlpha: 0,
  wall: { style: 'panels', base: 0x163222, wainscot: 0x4a1c10, rail: 0xb8965a, skirting: 0x1e0c06 },
  floor: { style: 'wood', base: 0x5a3a1e, pattern: 0x4a2e16 },
  light: { sky: 0xffe8cc, ground: 0x4a3020, fill: 2.1, key: 0xfff0dc, keyPower: 96, wash: 0xffc890, washPower: 40, fog: 0x14100a, fogNear: 60, fogFar: 150 },
  furnish(room) {
    const updates = [];
    beamedCeiling(room);
    room.add(persianRug(m(7.0), m(5.6)));
    tableChandelier(room);

    // The sign, the room's name in gilt on a walnut board over it.
    brandSign(room, half, { rgb: '236,206,140', plate: '#1a0e06' });
    const board = new THREE.Mesh(new THREE.BoxGeometry(m(4.6), m(0.8), m(0.06)), WALNUT);
    board.position.set(0, FLOOR_Y + m(3.65), -half + m(0.03));
    room.add(board);
    const title = giltText('The Full House', m(4.3), m(0.72), "italic 600 {S}px 'Cinzel', Georgia, serif");
    title.position.set(0, FLOOR_Y + m(3.65), -half + m(0.065));
    room.add(title);
    brandSign(room, half, { wall: 'front', width: m(1.6), y: FLOOR_Y + m(3.4), rgb: '236,206,140', plate: '#1a0e06' });

    // Poker either side of the table.
    [-1, 1].forEach((side, si) => {
      [-m(4.8), m(3.6)].forEach((z, zi) => pokerTable(room, side * m(7.6), z, Math.PI / 2, si * 2 + zi));
    });
    // The fireplace on the right wall, chesterfields and wing chairs
    // before it on a carpet.
    const fx = half - m(0.2), fz = m(6.4);
    updates.push(fireplace(room, fx, fz, -Math.PI / 2));
    room.add(persianRug(m(3.6), m(4.6), fx - m(2.4), fz));
    [-1, 1].forEach((s) => place(room, 'sofa_02', { x: fx - m(2.4), z: fz + s * m(1.45), yaw: s > 0 ? Math.PI : 0, size: 1.05 }));
    clubTable(room, fx - m(2.4), fz, Math.PI / 2);
    place(room, 'GreenChair_01', { x: fx - m(4.1), z: fz - m(0.5), yaw: facing(fx - m(4.1), fz - m(0.5), fx, fz) });
    place(room, 'GreenChair_01', { x: fx - m(4.1), z: fz + m(0.5), yaw: facing(fx - m(4.1), fz + m(0.5), fx, fz) });
    // The library on the left wall: cases of books, a reading chair, a
    // lamp on a table by it.
    [m(3.2), m(5.8), m(8.4), m(11)].forEach((z) => bookcase(room, -half + m(0.02), z, Math.PI / 2));
    room.add(persianRug(m(3.2), m(4.2), -half + m(2.4), m(7.1)));
    [m(6.2), m(8.0)].forEach((z) => place(room, 'GreenChair_01', { x: -half + m(1.6), z, yaw: Math.PI / 2 }));
    clubTable(room, -half + m(2.8), m(7.1), Math.PI / 2);
    place(room, 'vintage_oil_lamp', { x: -half + m(2.8), y: FLOOR_Y + m(0.465), z: m(7.5), size: 1.2 });
    // The humidor and the clock at the back right, paintings down the
    // walls.
    place(room, 'vintage_cabinet_01', { x: half - m(1.5), z: -half + m(0.4) });
    place(room, 'vintage_grandfather_clock_01', { x: half - m(0.4), z: -half + m(2.0), yaw: -Math.PI / 2 });
    [-1, 1].forEach((side) => {
      [-m(10), -m(5), m(0)].forEach((z) => place(room, 'fancy_picture_frame_02', { x: side * (half - 0.08), y: FLOOR_Y + m(2.2), z, yaw: -side * Math.PI / 2, size: 2.6 }));
    });
    [-m(6), m(6)].forEach((x) => {
      place(room, 'fancy_picture_frame_02', { x, y: FLOOR_Y + m(2.2), z: half - 0.08, yaw: Math.PI, size: 2.6 });
      place(room, 'sofa_02', { x, z: half - m(0.6), yaw: Math.PI, size: 1.05 });
      clubTable(room, x, half - m(1.6));
    });
    place(room, 'horse_statue_01', { x: half - m(1.5), y: FLOOR_Y + m(2.24), z: -half + m(0.4), size: 2.2 });
    doors(room);
    whiskyBar(room);

    walkway(room, { x: 10.5, back: -9.2, front: 10.5 });
    staffPosts(room, [[10.5, -9.6], [-10.5, 10.5], [10.5, 10.5]]);
    room.userData.update = (dt, now) => updates.forEach((u) => u(dt, now));
  },
};
