import * as THREE from 'three';
import { FLOOR_Y, m } from './scale.js';
import { walkway, brandSign, staffPosts } from './layout.js';
import { canvasTex, grain, gold, velvet, feltTexture, marble, chipStack, bottleRow, giltText } from './casinoKit.js';

// The Golden Ace: a gold room in the Art Deco manner, black lacquer and
// gold leaf, the casino of the ocean-liner age. Its furniture all its own:
//
//   - baccarat: three tables, each its kidney of baize marked BANKER,
//     PLAYER and TIE at every seat, a padded rail round the players;
//   - craps: a long tub of a table, its layout of the pass line, the
//     field and the numbers, a pair of dice on the felt, chips in the
//     racks along its rail;
//   - over the table, a chandelier of stepped glass, tier under tier, in
//     a ceiling that steps up in trays edged with light;
//   - black lacquer walls between fluted gold pilasters, fans of gold
//     over them; sunburst mirrors; sconces of frosted glass;
//   - a floor of black marble inlaid with white fans and gold;
//   - banquettes of emerald velvet in vertical channels, tub chairs,
//     black tables rimmed in gold; torchères throwing light up the walls;
//   - a bar fronted in gold fluting, black marble on it, champagne on ice.

const half = 36;
const CEIL = FLOOR_Y + m(5.4);

const GOLD = gold();
const BLACK_MARBLE = marble('#0e0e10', '#7a7a80', { veins: 16 });
const LACQUER = new THREE.MeshStandardMaterial({ color: 0x0a0a0c, roughness: 0.12, metalness: 0.3 });
const EMERALD = velvet(0x0a3a24, 0x7affc0);
const LEATHER = new THREE.MeshStandardMaterial({ color: 0x101010, roughness: 0.45 });
const FROSTED = new THREE.MeshStandardMaterial({ color: 0xfff6e8, roughness: 0.4, emissive: 0xffe8c0, emissiveIntensity: 0.9, transparent: true, opacity: 0.92 });
const CHROME = new THREE.MeshStandardMaterial({ color: 0xdfe3e8, roughness: 0.08, metalness: 1.0 });
const light = (color) => new THREE.MeshBasicMaterial({ color, toneMapped: false });

// Fit a flat shape's UVs to 0..1 over its bounds, so a layout drawn on a
// canvas lies over the whole of it.
function fitUV(geo) {
  geo.computeBoundingBox();
  const { min, max } = geo.boundingBox;
  const pos = geo.attributes.position, uv = geo.attributes.uv;
  for (let i = 0; i < pos.count; i++) uv.setXY(i, (pos.getX(i) - min.x) / (max.x - min.x), (pos.getY(i) - min.y) / (max.y - min.y));
  uv.needsUpdate = true;
  return geo;
}

// ---------- the floor ----------
// Black marble in large squares, joints of brass, a keystone of white
// marble at every corner.
function paintDecoFloor(ctx, S) {
  ctx.fillStyle = '#0e0e10';
  ctx.fillRect(0, 0, S, S);
  for (let v = 0; v < 16; v++) {
    ctx.strokeStyle = '#8a8a90';
    ctx.globalAlpha = 0.12 + Math.random() * 0.3;
    ctx.lineWidth = 0.6 + Math.random() * 1.6;
    ctx.beginPath();
    let x = Math.random() * S, y = Math.random() * S;
    ctx.moveTo(x, y);
    for (let k = 0; k < 14; k++) { x += (Math.random() - 0.5) * 90; y += (Math.random() - 0.5) * 90; ctx.lineTo(x, y); }
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  ctx.strokeStyle = '#b8964e';
  ctx.lineWidth = 4;
  ctx.strokeRect(0, 0, S, S);
  const k = S * 0.08;
  [[0, 0], [S, 0], [0, S], [S, S]].forEach(([cx, cy]) => {
    ctx.fillStyle = '#e4e0d8';
    ctx.beginPath();
    ctx.moveTo(cx, cy - k);
    ctx.lineTo(cx + k, cy);
    ctx.lineTo(cx, cy + k);
    ctx.lineTo(cx - k, cy);
    ctx.closePath();
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.stroke();
  });
  grain(ctx, S, S, 6);
}

// ---------- the walls ----------
// Black lacquer between fluted gold pilasters, a fan of gold rising over
// each bay, a frieze of chevrons; a dado edged in gold.
function paintDecoWall(ctx, d) {
  const { texW: W, texH: H, px } = d;
  const u = px * m(1);
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#0c0c0e');
  g.addColorStop(1, '#141416');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  const goldG = (x0, y0, x1, y1) => {
    const gg = ctx.createLinearGradient(x0, y0, x1, y1);
    gg.addColorStop(0, '#8a6a2a');
    gg.addColorStop(0.5, '#f2d68a');
    gg.addColorStop(1, '#8a6a2a');
    return gg;
  };
  const frieze = u * 0.5, dado = H - u * 0.9, bay = u * 2.4, pil = u * 0.32;
  for (let x = 0; x < W; x += bay) {
    // The pilaster.
    ctx.fillStyle = goldG(x, 0, x + pil, 0);
    ctx.fillRect(x, frieze, pil, dado - frieze);
    for (let f = 1; f < 4; f++) {
      ctx.fillStyle = 'rgba(60,40,10,0.5)';
      ctx.fillRect(x + (pil * f) / 4 - 2, frieze + u * 0.1, 4, dado - frieze - u * 0.2);
    }
    // The fan over the bay: rays of gold from the dado's centre.
    const cx = x + pil + (bay - pil) / 2, cy = dado - u * 0.05;
    ctx.save();
    ctx.beginPath();
    ctx.rect(x + pil, frieze, bay - pil, dado - frieze);
    ctx.clip();
    for (let k = 0; k <= 12; k++) {
      const a = Math.PI + (k / 12) * Math.PI;
      ctx.strokeStyle = k % 2 ? 'rgba(201,162,79,0.35)' : 'rgba(201,162,79,0.7)';
      ctx.lineWidth = k % 2 ? 2 : 4;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * u * 0.35, cy + Math.sin(a) * u * 0.35);
      ctx.lineTo(cx + Math.cos(a) * u * 1.15, cy + Math.sin(a) * u * 1.15);
      ctx.stroke();
    }
    [u * 0.35, u * 1.15].forEach((r) => {
      ctx.strokeStyle = 'rgba(201,162,79,0.8)';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(cx, cy, r, Math.PI, Math.PI * 2);
      ctx.stroke();
    });
    ctx.restore();
  }
  // The frieze of chevrons.
  ctx.fillStyle = '#0a0a0a';
  ctx.fillRect(0, 0, W, frieze);
  ctx.strokeStyle = goldG(0, 0, 0, frieze);
  ctx.lineWidth = 5;
  for (let x = 0; x < W; x += u * 0.3) {
    ctx.beginPath();
    ctx.moveTo(x, frieze * 0.8);
    ctx.lineTo(x + u * 0.15, frieze * 0.25);
    ctx.lineTo(x + u * 0.3, frieze * 0.8);
    ctx.stroke();
  }
  ctx.fillStyle = goldG(0, 0, 0, 12);
  ctx.fillRect(0, frieze - 6, W, 8);
  // The dado.
  ctx.fillStyle = '#060606';
  ctx.fillRect(0, dado, W, H - dado);
  ctx.fillStyle = '#c9a24f';
  ctx.fillRect(0, dado - 5, W, 8);
  ctx.fillRect(0, dado + u * 0.25, W, 3);
  ctx.fillRect(0, H - u * 0.12, W, 4);
}

// ---------- the ceiling ----------
// Trays stepping up toward the middle, each edged in gold with a line of
// light along it.
function steppedCeiling(room) {
  const MATT = new THREE.MeshStandardMaterial({ color: 0x0c0c0e, roughness: 0.6, metalness: 0 });
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(2 * half, 2 * half), MATT);
  ceil.rotation.x = Math.PI / 2;
  ceil.position.y = CEIL;
  room.add(ceil);
  const cove = light(0xffd8a0);
  [[2 * half, m(0.7)], [m(19), m(0.5)], [m(13), m(0.32)], [m(8), m(0.15)]].forEach(([size, drop], k, all) => {
    const inner = all[k + 1] ? all[k + 1][0] : 0;
    const y = CEIL - drop;
    if (!inner) return;
    const band = (size - inner) / 2;
    [[size, band, 0, -(size - band) / 2], [size, band, 0, (size - band) / 2], [band, inner, -(size - band) / 2, 0], [band, inner, (size - band) / 2, 0]].forEach(([w, d, x, z]) => {
      const slab = new THREE.Mesh(new THREE.BoxGeometry(w, CEIL - y, d), MATT);
      slab.position.set(x, (CEIL + y) / 2, z - 0.4);
      room.add(slab);
    });
    // The gold fascia and the light along the inner edge.
    [[inner, 0, -inner / 2], [inner, 0, inner / 2], [0, inner, -inner / 2], [0, inner, inner / 2]].forEach(([w, d, o]) => {
      const along = w > 0;
      const fascia = new THREE.Mesh(new THREE.BoxGeometry(along ? inner + m(0.1) : m(0.05), m(0.12), along ? m(0.05) : inner + m(0.1)), GOLD);
      fascia.position.set(along ? 0 : o, y - m(0.06), (along ? o : 0) - 0.4);
      room.add(fascia);
      const line = new THREE.Mesh(new THREE.BoxGeometry(along ? inner : m(0.03), m(0.02), along ? m(0.03) : inner), cove);
      line.position.set(along ? 0 : o * 0.97, y + m(0.02), (along ? o * 0.97 : 0) - 0.4);
      room.add(line);
      void d;
    });
  });
}

// ---------- the chandelier ----------
// Tiers of frosted glass, each smaller than the one above, gold bands
// between, rods of glass hanging round the lowest.
function decoChandelier(room, x, y, z) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  room.add(g);
  let ty = 0;
  [[m(1.25), m(0.28)], [m(0.95), m(0.26)], [m(0.65), m(0.24)], [m(0.38), m(0.2)]].forEach(([r, h], i) => {
    const glass = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 0.96, h, 48, 1, true), FROSTED);
    glass.position.y = ty - h / 2;
    g.add(glass);
    [ty, ty - h].forEach((by) => {
      const band = new THREE.Mesh(new THREE.TorusGeometry(r, m(0.018), 6, 64), GOLD);
      band.rotation.x = Math.PI / 2;
      band.position.y = by;
      g.add(band);
    });
    const floor = new THREE.Mesh(new THREE.CircleGeometry(r, 48), FROSTED);
    floor.rotation.x = Math.PI / 2;
    floor.position.y = ty - h;
    g.add(floor);
    ty -= h + m(0.04) * (i < 3 ? 1 : 0);
  });
  // Rods of glass round the top tier.
  const rods = new THREE.InstancedMesh(new THREE.CylinderGeometry(m(0.012), m(0.012), m(0.9), 6), FROSTED, 72);
  const mtx = new THREE.Matrix4();
  for (let i = 0; i < 72; i++) {
    const a = (i / 72) * Math.PI * 2;
    const len = 0.75 + 0.25 * Math.abs(Math.sin(a * 6));
    mtx.makeScale(1, len, 1);
    mtx.setPosition(Math.cos(a) * m(1.35), -m(0.45) * len, Math.sin(a) * m(1.35));
    rods.setMatrixAt(i, mtx);
  }
  g.add(rods);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(m(1.35), m(0.02), 6, 64), GOLD);
  ring.rotation.x = Math.PI / 2;
  g.add(ring);
  const len = CEIL - y;
  [0, 1, 2, 3].forEach((k) => {
    const a = (k / 4) * Math.PI * 2 + Math.PI / 4;
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(m(0.012), m(0.012), len, 6), GOLD);
    rod.position.set(Math.cos(a) * m(1.2), len / 2, Math.sin(a) * m(1.2));
    g.add(rod);
  });
}

// ---------- baccarat ----------
let bacTex = null;
function baccaratLayout() {
  if (bacTex) return bacTex;
  bacTex = canvasTex(2048, 1100, (ctx, W, H) => {
    ctx.fillStyle = '#5a0a14';
    ctx.fillRect(0, 0, W, H);
    grain(ctx, W, H, 14);
    // Seven seats round the arc: at each, TIE, BANKER, PLAYER boxes.
    const cx = W / 2, cy = H * 0.12, R0 = H * 0.5;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let i = 0; i < 7; i++) {
      const a = Math.PI * (0.16 + (i / 6) * 0.68);
      ctx.save();
      ctx.translate(cx + Math.cos(a) * R0 * 1.55, cy + Math.sin(a) * R0 * 1.15);
      ctx.rotate(a - Math.PI / 2);
      [['TIE 8 TO 1', -150, '#2a8a4a'], ['BANKER', -60, '#c9a24f'], ['PLAYER', 40, '#f2efe6']].forEach(([t, dy, col]) => {
        ctx.strokeStyle = col;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.roundRect(-95, dy - 36, 190, 72, 30);
        ctx.stroke();
        ctx.fillStyle = col;
        ctx.font = '700 30px Georgia, serif';
        ctx.fillText(t, 0, dy);
      });
      ctx.fillStyle = '#f2efe6';
      ctx.font = '700 44px Georgia, serif';
      ctx.fillText(String(i + 1), 0, 120);
      ctx.restore();
    }
    ctx.strokeStyle = '#c9a24f';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.ellipse(cx, cy, R0 * 1.92, R0 * 1.48, 0, 0.05, Math.PI - 0.05);
    ctx.stroke();
    ctx.fillStyle = '#c9a24f';
    ctx.font = "700 italic 70px Georgia, serif";
    ctx.fillText('BACCARAT', cx, H * 0.3);
    ctx.font = '600 30px Georgia, serif';
    ctx.fillText('BANKER PAYS 19 TO 20  ·  TIE PAYS 8 TO 1', cx, H * 0.38);
  });
  return bacTex;
}
const BAC_FELT = new THREE.MeshStandardMaterial({ map: null, roughness: 0.95 });
// A baccarat table: a kidney of baize on a lacquered body, a padded rail
// round the players' side, the dealer's straight side with its shoe and
// tray; chips at the seats.
function baccaratTable(room, x, z, yaw) {
  const g = new THREE.Group();
  const R = m(1.35), D = m(0.35), H = FLOOR_Y + m(0.76);
  const s = new THREE.Shape();
  s.moveTo(-R, 0);
  s.absellipse(0, 0, R, R * 0.78, Math.PI, 0, true);
  s.lineTo(R, -D);
  s.lineTo(m(0.45), -D);
  s.quadraticCurveTo(0, -D + m(0.28), -m(0.45), -D);
  s.lineTo(-R, -D);
  s.lineTo(-R, 0);
  // The baize: the same outline drawn the other way up, so it faces up
  // when laid flat, the players' side toward them.
  const f = new THREE.Shape();
  f.moveTo(-R, 0);
  f.absellipse(0, 0, R, R * 0.78, Math.PI, Math.PI * 2, false);
  f.lineTo(R, D);
  f.lineTo(m(0.45), D);
  f.quadraticCurveTo(0, D - m(0.28), -m(0.45), D);
  f.lineTo(-R, D);
  f.lineTo(-R, 0);
  if (!BAC_FELT.map) BAC_FELT.map = baccaratLayout();
  const felt = new THREE.Mesh(fitUV(new THREE.ShapeGeometry(f, 48)), BAC_FELT);
  felt.rotation.x = -Math.PI / 2;
  felt.position.y = H;
  g.add(felt);
  const body = new THREE.Mesh(new THREE.ExtrudeGeometry(s, { depth: m(0.12), bevelEnabled: false, curveSegments: 48 }), LACQUER);
  body.rotation.x = Math.PI / 2;
  body.position.y = H - 0.002;
  g.add(body);
  const trim = new THREE.Mesh(new THREE.ExtrudeGeometry(s, { depth: m(0.02), bevelEnabled: false, curveSegments: 48 }), GOLD);
  trim.rotation.x = Math.PI / 2;
  trim.position.y = H - m(0.12);
  g.add(trim);
  // The rail round the arc.
  const pts = [];
  for (let k = 0; k <= 48; k++) {
    const a = Math.PI + (k / 48) * Math.PI;
    pts.push(new THREE.Vector3(Math.cos(a) * R, 0, -Math.sin(a) * R * 0.78));
  }
  const rail = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 64, m(0.05), 10, false), LEATHER);
  rail.position.y = H + m(0.03);
  g.add(rail);
  [-1, 1].forEach((sx) => {
    const ped = new THREE.Mesh(new THREE.CylinderGeometry(m(0.1), m(0.16), m(0.64), 20), LACQUER);
    ped.position.set(sx * m(0.55), FLOOR_Y + m(0.32), m(0.25));
    g.add(ped);
    const band = new THREE.Mesh(new THREE.TorusGeometry(m(0.16), m(0.012), 6, 24), GOLD);
    band.rotation.x = Math.PI / 2;
    band.position.set(sx * m(0.55), FLOOR_Y + m(0.02), m(0.25));
    g.add(band);
  });
  // The shoe and the chip tray on the dealer's side.
  const shoe = new THREE.Mesh(new THREE.BoxGeometry(m(0.16), m(0.1), m(0.32)), LACQUER);
  shoe.position.set(m(0.55), H + m(0.05), -D + m(0.25));
  shoe.rotation.y = 0.3;
  g.add(shoe);
  const tray = new THREE.Mesh(new THREE.BoxGeometry(m(0.6), m(0.03), m(0.16)), CHROME);
  tray.position.set(0, H + m(0.015), -D + m(0.12));
  g.add(tray);
  ['gold', 'purple', 'black', 'green', 'red', 'white'].forEach((c, i) => chipStack(g, -m(0.25) + i * m(0.1), H + m(0.03), -D + m(0.12), 14, c));
  for (let i = 0; i < 7; i++) {
    if (i % 2) continue;
    const a = Math.PI * (0.16 + (i / 6) * 0.68);
    chipStack(g, Math.cos(a) * R * 0.62, H + 0.004, Math.sin(a) * R * 0.5, 5 + i, ['purple', 'gold', 'black', 'red'][i % 4]);
  }
  // Stools of gold and emerald round the players' side.
  for (let i = 0; i < 7; i++) {
    const a = Math.PI * (0.16 + (i / 6) * 0.68);
    const sx = Math.cos(a) * (R + m(0.32)), sz = Math.sin(a) * (R * 0.78 + m(0.32));
    const seat = new THREE.Mesh(new THREE.CylinderGeometry(m(0.2), m(0.18), m(0.1), 24), EMERALD);
    seat.position.set(sx, FLOOR_Y + m(0.7), sz);
    g.add(seat);
    const post = new THREE.Mesh(new THREE.CylinderGeometry(m(0.025), m(0.025), m(0.65), 10), GOLD);
    post.position.set(sx, FLOOR_Y + m(0.33), sz);
    g.add(post);
    const foot = new THREE.Mesh(new THREE.CylinderGeometry(m(0.17), m(0.19), m(0.03), 24), GOLD);
    foot.position.set(sx, FLOOR_Y + m(0.015), sz);
    g.add(foot);
  }
  g.position.set(x, 0, z);
  g.rotation.y = yaw;
  room.add(g);
}

// ---------- craps ----------
let crapsTex = null;
function crapsLayout() {
  if (crapsTex) return crapsTex;
  crapsTex = canvasTex(2048, 820, (ctx, W, H) => {
    ctx.fillStyle = '#0e5232';
    ctx.fillRect(0, 0, W, H);
    grain(ctx, W, H, 14);
    ctx.strokeStyle = '#f2efe6';
    ctx.fillStyle = '#f2efe6';
    ctx.lineWidth = 4;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    // The two ends are the same: draw one, mirror it.
    const half = (flip) => {
      ctx.save();
      if (flip) { ctx.translate(W, 0); ctx.scale(-1, 1); }
      const x0 = 40, x1 = W * 0.36;
      // The numbers along the top.
      const nums = ['4', '5', 'SIX', '8', 'NINE', '10'];
      const nw = (x1 - x0 - 120) / 6;
      nums.forEach((n, i) => {
        const x = x0 + 120 + i * nw;
        ctx.strokeRect(x, 40, nw, 150);
        ctx.font = '700 56px Georgia, serif';
        ctx.save();
        if (flip) { ctx.translate(x + nw / 2, 115); ctx.scale(-1, 1); ctx.fillText(n, 0, 0); } else ctx.fillText(n, x + nw / 2, 115);
        ctx.restore();
      });
      // DON'T COME, COME, FIELD, DON'T PASS, PASS LINE.
      const text = (t, x, y, size = 40, col = '#f2efe6') => {
        ctx.fillStyle = col;
        ctx.font = `700 ${size}px Georgia, serif`;
        ctx.save();
        ctx.translate(x, y);
        if (flip) ctx.scale(-1, 1);
        ctx.fillText(t, 0, 0);
        ctx.restore();
        ctx.fillStyle = '#f2efe6';
      };
      ctx.strokeRect(x0, 40, 120, 150);
      text("DON'T", x0 + 60, 95, 26);
      text('COME', x0 + 60, 135, 26);
      ctx.strokeRect(x0 + 120, 190, x1 - x0 - 120, 150);
      text('COME', (x0 + 120 + x1) / 2, 265, 70, '#e8c050');
      ctx.strokeRect(x0 + 120, 340, x1 - x0 - 120, 150);
      text('2 · 3 · 4 · 9 · 10 · 11 · 12', (x0 + 120 + x1) / 2, 395, 44);
      text('FIELD', (x0 + 120 + x1) / 2, 450, 50, '#e8c050');
      ctx.strokeRect(x0 + 120, 490, x1 - x0 - 120, 90);
      text("DON'T PASS BAR", (x0 + 120 + x1) / 2, 535, 36);
      ctx.strokeRect(x0, 580, x1 - x0, 140);
      text('PASS LINE', (x0 + x1) / 2, 650, 64, '#f2efe6');
      ctx.strokeRect(x0, 190, 120, 390);
      ctx.restore();
    };
    half(false);
    half(true);
    // The proposition bets in the middle.
    const px0 = W * 0.38, px1 = W * 0.62;
    ctx.strokeRect(px0, 60, px1 - px0, 660);
    ctx.fillStyle = '#9a1222';
    ctx.fillRect(px0 + 10, 70, px1 - px0 - 20, 90);
    ctx.fillStyle = '#f2efe6';
    ctx.font = '700 40px Georgia, serif';
    ctx.fillText('SEVEN · 5 TO 1', W / 2, 115);
    [['HARD 6', '9 TO 1'], ['HARD 10', '7 TO 1'], ['HARD 8', '9 TO 1'], ['HARD 4', '7 TO 1']].forEach(([t, p], i) => {
      const x = px0 + 10 + (i % 2) * ((px1 - px0 - 20) / 2), y = 180 + Math.floor(i / 2) * 150;
      ctx.strokeRect(x, y, (px1 - px0 - 20) / 2, 140);
      ctx.font = '700 36px Georgia, serif';
      ctx.fillText(t, x + (px1 - px0 - 20) / 4, y + 55);
      ctx.font = '600 28px Georgia, serif';
      ctx.fillText(p, x + (px1 - px0 - 20) / 4, y + 100);
    });
    ctx.fillStyle = '#9a1222';
    ctx.fillRect(px0 + 10, 490, px1 - px0 - 20, 90);
    ctx.fillStyle = '#f2efe6';
    ctx.font = '700 36px Georgia, serif';
    ctx.fillText('ANY CRAPS · 7 TO 1', W / 2, 535);
    ctx.font = "700 italic 46px Georgia, serif";
    ctx.fillStyle = '#e8c050';
    ctx.fillText('The Golden Ace', W / 2, 650);
  });
  return crapsTex;
}
// A die: ivory-white with black pips (red on the one), corners rounded by
// a bevel.
function die(parent, x, y, z, ry) {
  const faces = [3, 4, 1, 6, 2, 5].map((n) => new THREE.MeshStandardMaterial({ roughness: 0.25, map: canvasTex(64, 64, (ctx, w) => {
    ctx.fillStyle = '#c8141e';
    ctx.fillRect(0, 0, w, w);
    ctx.fillStyle = '#ffffff';
    const P = { 1: [[0.5, 0.5]], 2: [[0.27, 0.27], [0.73, 0.73]], 3: [[0.25, 0.25], [0.5, 0.5], [0.75, 0.75]], 4: [[0.27, 0.27], [0.73, 0.27], [0.27, 0.73], [0.73, 0.73]], 5: [[0.25, 0.25], [0.75, 0.25], [0.5, 0.5], [0.25, 0.75], [0.75, 0.75]], 6: [[0.27, 0.22], [0.73, 0.22], [0.27, 0.5], [0.73, 0.5], [0.27, 0.78], [0.73, 0.78]] }[n];
    P.forEach(([px, py]) => { ctx.beginPath(); ctx.arc(px * w, py * w, w * 0.09, 0, Math.PI * 2); ctx.fill(); });
  }) }));
  const d = new THREE.Mesh(new THREE.BoxGeometry(m(0.019), m(0.019), m(0.019)), faces);
  d.position.set(x, y + m(0.0095), z);
  d.rotation.y = ry;
  parent.add(d);
}
// The craps table: a long tub, its walls of lacquered wood padded on top
// in leather, a groove of chips round the rail; the layout sunk inside.
function crapsTable(room, x, z, yaw) {
  const g = new THREE.Group();
  const L = m(3.8), W = m(1.5), H = FLOOR_Y + m(0.92), FELT_Y = FLOOR_Y + m(0.72);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(L - m(0.3), W - m(0.3)), new THREE.MeshStandardMaterial({ map: crapsLayout(), roughness: 0.95 }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = FELT_Y;
  g.add(floor);
  const base = new THREE.Mesh(new THREE.BoxGeometry(L - m(0.3), FELT_Y - FLOOR_Y - m(0.25), W - m(0.3)), LACQUER);
  base.position.y = FLOOR_Y + m(0.25) + (FELT_Y - FLOOR_Y - m(0.25)) / 2;
  g.add(base);
  // The walls, the padded rail on them, the chip groove inside it.
  [[L, m(0.15), 0, (W - m(0.15)) / 2], [L, m(0.15), 0, -(W - m(0.15)) / 2], [m(0.15), W - m(0.3), (L - m(0.15)) / 2, 0], [m(0.15), W - m(0.3), -(L - m(0.15)) / 2, 0]].forEach(([w, d, wx, wz]) => {
    const wall = new THREE.Mesh(new THREE.BoxGeometry(w, H - FELT_Y + m(0.1), d), LACQUER);
    wall.position.set(wx, FELT_Y + (H - FELT_Y) / 2 - m(0.05), wz);
    g.add(wall);
    const pad = new THREE.Mesh(new THREE.BoxGeometry(w + m(0.02), m(0.06), d + m(0.04)), LEATHER);
    pad.position.set(wx, H + m(0.03), wz);
    g.add(pad);
    const strip = new THREE.Mesh(new THREE.BoxGeometry(w > d ? w : m(0.012), m(0.012), w > d ? m(0.012) : d), GOLD);
    strip.position.set(wx, H - m(0.05), wz + (w > d ? Math.sign(wz) * (d / 2 + m(0.001)) : 0));
    g.add(strip);
  });
  [-1, 1].forEach((sx) => [-1, 1].forEach((sz) => {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(m(0.22), m(0.25), m(0.22)), LACQUER);
    leg.position.set(sx * (L / 2 - m(0.5)), FLOOR_Y + m(0.125), sz * (W / 2 - m(0.4)));
    g.add(leg);
  }));
  // Chips round the rail's groove, and on the pass line.
  ['red', 'green', 'black', 'purple', 'gold', 'white'].forEach((c, i) => {
    [-1, 1].forEach((sz) => chipStack(g, -L / 2 + m(0.5) + i * m(0.5), H + m(0.06), sz * (W / 2 - m(0.07)), 8 + (i % 3) * 3, c));
  });
  [-1.3, -0.9, 0.9, 1.3].forEach((t, i) => chipStack(g, m(t), FELT_Y + 0.003, W / 2 - m(0.38), 3 + i, ['red', 'green', 'black', 'red'][i]));
  die(g, m(0.25), FELT_Y, m(0.1), 0.4);
  die(g, m(0.29), FELT_Y, m(0.15), 1.1);
  // The stick, lying on the rail.
  const stick = new THREE.Mesh(new THREE.CylinderGeometry(m(0.008), m(0.008), m(1.2), 6), new THREE.MeshStandardMaterial({ color: 0xc8a070, roughness: 0.5 }));
  stick.rotation.set(0, 0, Math.PI / 2);
  stick.position.set(0, H + m(0.07), -W / 2 + m(0.05));
  g.add(stick);
  g.position.set(x, 0, z);
  g.rotation.y = yaw;
  room.add(g);
}

// ---------- the lounges ----------
// A banquette of emerald velvet, its back in vertical channels, a gold
// kick plate under it.
function banquette(room, x, z, yaw, len) {
  const g = new THREE.Group();
  const seat = new THREE.Mesh(new THREE.BoxGeometry(len, m(0.2), m(0.6)), EMERALD);
  seat.position.set(0, FLOOR_Y + m(0.38), m(0.05));
  g.add(seat);
  const plinth = new THREE.Mesh(new THREE.BoxGeometry(len, m(0.28), m(0.62)), LACQUER);
  plinth.position.set(0, FLOOR_Y + m(0.14), m(0.04));
  g.add(plinth);
  const kick = new THREE.Mesh(new THREE.BoxGeometry(len, m(0.05), m(0.01)), GOLD);
  kick.position.set(0, FLOOR_Y + m(0.06), m(0.355));
  g.add(kick);
  const n = Math.round(len / m(0.2));
  const channel = new THREE.CapsuleGeometry(m(0.085), m(0.8), 4, 10);
  for (let i = 0; i < n; i++) {
    const c = new THREE.Mesh(channel, EMERALD);
    c.scale.z = 0.55;
    c.position.set(-len / 2 + (i + 0.5) * (len / n), FLOOR_Y + m(0.95), -m(0.22));
    c.rotation.x = -0.12;
    g.add(c);
  }
  const cap = new THREE.Mesh(new THREE.BoxGeometry(len + m(0.04), m(0.05), m(0.16)), GOLD);
  cap.position.set(0, FLOOR_Y + m(1.48), -m(0.28));
  g.add(cap);
  g.position.set(x, 0, z);
  g.rotation.y = yaw;
  room.add(g);
}
// A round table of black lacquer rimmed in gold, on a stepped pedestal,
// a champagne coupe on it.
function cocktailTable(room, x, z) {
  const top = new THREE.Mesh(new THREE.CylinderGeometry(m(0.38), m(0.38), m(0.04), 40), LACQUER);
  top.position.set(x, FLOOR_Y + m(0.62), z);
  room.add(top);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(m(0.38), m(0.014), 6, 48), GOLD);
  rim.rotation.x = Math.PI / 2;
  rim.position.set(x, FLOOR_Y + m(0.62), z);
  room.add(rim);
  [[m(0.05), m(0.6), m(0.31)], [m(0.22), m(0.04), m(0.02)], [m(0.16), m(0.04), m(0.06)]].forEach(([r, h, y]) => {
    const p = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 24), GOLD);
    p.position.set(x, FLOOR_Y + y, z);
    room.add(p);
  });
  const coupe = new THREE.Mesh(new THREE.LatheGeometry([[0, 0], [0.035, 0], [0.004, 0.01], [0.004, 0.09], [0.05, 0.1], [0.055, 0.125], [0.05, 0.125], [0, 0.105]].map(([r, h]) => new THREE.Vector2(m(r), m(h))), 20), new THREE.MeshPhysicalMaterial({ color: 0xf2e8c8, roughness: 0.02, clearcoat: 1, emissive: 0x3a2a08, emissiveIntensity: 0.4 }));
  coupe.position.set(x + m(0.1), FLOOR_Y + m(0.64), z);
  room.add(coupe);
}
// A tub chair: a barrel of emerald velvet open at the front, on gold feet.
function tubChair(room, x, z, yaw) {
  const g = new THREE.Group();
  const shell = new THREE.Mesh(new THREE.CylinderGeometry(m(0.38), m(0.34), m(0.5), 32, 1, true, Math.PI * 0.25, Math.PI * 1.5), EMERALD);
  shell.material.side = THREE.DoubleSide;
  shell.position.y = FLOOR_Y + m(0.6);
  g.add(shell);
  const seat = new THREE.Mesh(new THREE.CylinderGeometry(m(0.34), m(0.34), m(0.14), 32), EMERALD);
  seat.position.y = FLOOR_Y + m(0.38);
  g.add(seat);
  const band = new THREE.Mesh(new THREE.CylinderGeometry(m(0.345), m(0.345), m(0.04), 32), GOLD);
  band.position.y = FLOOR_Y + m(0.3);
  g.add(band);
  [0, 1, 2, 3].forEach((k) => {
    const a = (k / 4) * Math.PI * 2 + Math.PI / 4;
    const foot = new THREE.Mesh(new THREE.CylinderGeometry(m(0.02), m(0.012), m(0.28), 8), GOLD);
    foot.position.set(Math.cos(a) * m(0.26), FLOOR_Y + m(0.14), Math.sin(a) * m(0.26));
    g.add(foot);
  });
  g.position.set(x, 0, z);
  g.rotation.y = yaw;
  room.add(g);
}
// A sunburst mirror: a round glass in rays of gold, long and short.
function sunburst(room, x, y, z, yaw, r = m(0.55)) {
  const g = new THREE.Group();
  const glass = new THREE.Mesh(new THREE.CircleGeometry(r, 48), new THREE.MeshStandardMaterial({ color: 0xc8ccd0, roughness: 0.03, metalness: 1.0 }));
  g.add(glass);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(r, m(0.04), 8, 48), GOLD);
  g.add(rim);
  for (let k = 0; k < 36; k++) {
    const a = (k / 36) * Math.PI * 2, len = k % 2 ? r * 0.55 : r * 0.95;
    const ray = new THREE.Mesh(new THREE.BoxGeometry(len, m(0.022), m(0.02)), GOLD);
    ray.position.set(Math.cos(a) * (r + len / 2 + m(0.03)), Math.sin(a) * (r + len / 2 + m(0.03)), 0);
    ray.rotation.z = a;
    g.add(ray);
  }
  g.position.set(x, y, z);
  g.rotation.y = yaw;
  room.add(g);
}
// A sconce: a shield of frosted glass between gold bands.
function sconce(room, x, y, z, yaw) {
  const g = new THREE.Group();
  const glass = new THREE.Mesh(new THREE.CylinderGeometry(m(0.13), m(0.06), m(0.42), 24, 1, true, -Math.PI / 2, Math.PI), FROSTED);
  glass.material.side = THREE.DoubleSide;
  g.add(glass);
  [m(0.21), 0, -m(0.21)].forEach((by, i) => {
    const r = [m(0.13), m(0.095), m(0.06)][i];
    const band = new THREE.Mesh(new THREE.TorusGeometry(r, m(0.008), 4, 24, Math.PI), GOLD);
    band.rotation.set(Math.PI / 2, 0, 0);
    band.position.y = by;
    g.add(band);
  });
  g.position.set(x, y, z);
  g.rotation.y = yaw;
  room.add(g);
}
// A torchère: a fluted gold column, a bowl of glass throwing light up.
function torchere(room, x, z) {
  const col = new THREE.Mesh(new THREE.CylinderGeometry(m(0.04), m(0.06), m(1.7), 12), GOLD);
  col.position.set(x, FLOOR_Y + m(0.85), z);
  room.add(col);
  const foot = new THREE.Mesh(new THREE.CylinderGeometry(m(0.18), m(0.22), m(0.05), 24), GOLD);
  foot.position.set(x, FLOOR_Y + m(0.025), z);
  room.add(foot);
  const bowl = new THREE.Mesh(new THREE.CylinderGeometry(m(0.28), m(0.08), m(0.18), 32, 1, true), FROSTED);
  bowl.material.side = THREE.DoubleSide;
  bowl.position.set(x, FLOOR_Y + m(1.78), z);
  room.add(bowl);
  const glow = new THREE.Mesh(new THREE.CircleGeometry(m(0.27), 32), light(0xfff0d0));
  glow.rotation.x = -Math.PI / 2;
  glow.position.set(x, FLOOR_Y + m(1.84), z);
  room.add(glow);
}

// ---------- the bar ----------
// A bar fronted in fluted gold, a top of black marble; the back of black
// lacquer stepped like a skyscraper, a mirror in it, shelves lit white;
// champagne on ice along the counter.
function decoBar(room) {
  const len = m(5.6);
  const x = -half + m(1.1) + len / 2;
  const z = -half + m(2.0);
  const body = new THREE.Mesh(new THREE.BoxGeometry(len, m(1.0), m(0.58)), LACQUER);
  body.position.set(x, FLOOR_Y + m(0.5), z);
  room.add(body);
  const n = Math.round(len / m(0.07));
  const flute = new THREE.InstancedMesh(new THREE.CylinderGeometry(m(0.033), m(0.033), m(0.86), 10, 1, false, -Math.PI / 2, Math.PI), GOLD, n);
  const mtx = new THREE.Matrix4();
  for (let i = 0; i < n; i++) {
    mtx.makeTranslation(x - len / 2 + (i + 0.5) * (len / n), FLOOR_Y + m(0.53), z + m(0.29));
    flute.setMatrixAt(i, mtx);
  }
  room.add(flute);
  const top = new THREE.Mesh(new THREE.BoxGeometry(len + m(0.14), m(0.07), m(0.8)), BLACK_MARBLE);
  top.position.set(x, FLOOR_Y + m(1.035), z - m(0.05));
  room.add(top);
  const kick = new THREE.Mesh(new THREE.BoxGeometry(len, m(0.08), m(0.62)), BLACK_MARBLE);
  kick.position.set(x, FLOOR_Y + m(0.04), z);
  room.add(kick);
  // The stepped back.
  [[len, m(3.2)], [len * 0.7, m(3.6)], [len * 0.4, m(4.0)]].forEach(([w, h]) => {
    const step = new THREE.Mesh(new THREE.BoxGeometry(w, h, m(0.12)), LACQUER);
    step.position.set(x, FLOOR_Y + h / 2, -half + m(0.12));
    room.add(step);
    const edge = new THREE.Mesh(new THREE.BoxGeometry(w + m(0.02), m(0.03), m(0.13)), GOLD);
    edge.position.set(x, FLOOR_Y + h, -half + m(0.12));
    room.add(edge);
  });
  const mirror = new THREE.Mesh(new THREE.PlaneGeometry(len - m(0.6), m(1.6)), new THREE.MeshStandardMaterial({ color: 0xc8ccd0, roughness: 0.03, metalness: 1.0 }));
  mirror.position.set(x, FLOOR_Y + m(1.75), -half + m(0.19));
  room.add(mirror);
  const SHELF = new THREE.MeshStandardMaterial({ color: 0xdfe8e8, roughness: 0.05, transparent: true, opacity: 0.35 });
  [1.15, 1.6, 2.05].forEach((y) => {
    const shelf = new THREE.Mesh(new THREE.BoxGeometry(len - m(0.6), m(0.02), m(0.24)), SHELF);
    shelf.position.set(x, FLOOR_Y + m(y), -half + m(0.34));
    room.add(shelf);
    const strip = new THREE.Mesh(new THREE.BoxGeometry(len - m(0.6), m(0.01), m(0.02)), light(0xffffff));
    strip.position.set(x, FLOOR_Y + m(y) - m(0.015), -half + m(0.44));
    room.add(strip);
    bottleRow(room, x - len / 2 + m(0.4), x + len / 2 - m(0.4), FLOOR_Y + m(y) + m(0.01), -half + m(0.34), [0x1a3a1a, 0xe8dca0, 0x0a0a0a, 0xc8a050, 0x3a0a1a, 0xdfe8e8]);
  });
  // Champagne on ice.
  [-0.3, 0.3].forEach((t) => {
    const bx = x + t * len, bz = z - m(0.1);
    const bucket = new THREE.Mesh(new THREE.CylinderGeometry(m(0.1), m(0.08), m(0.22), 24), CHROME);
    bucket.position.set(bx, FLOOR_Y + m(1.18), bz);
    room.add(bucket);
    const bottle = new THREE.Mesh(new THREE.CylinderGeometry(m(0.012), m(0.04), m(0.32), 12), new THREE.MeshPhysicalMaterial({ color: 0x1a3a1a, roughness: 0.05, clearcoat: 1 }));
    bottle.position.set(bx, FLOOR_Y + m(1.32), bz);
    bottle.rotation.z = 0.25;
    room.add(bottle);
    const foil = new THREE.Mesh(new THREE.CylinderGeometry(m(0.014), m(0.014), m(0.08), 10), GOLD);
    foil.position.set(bx - m(0.05), FLOOR_Y + m(1.5), bz);
    foil.rotation.z = 0.25;
    room.add(foil);
  });
  const sign = giltText('Champagne Bar', m(2.6), m(0.42), "italic 600 {S}px Georgia, serif");
  sign.position.set(x, FLOOR_Y + m(2.85), -half + m(0.19));
  room.add(sign);
  // Stools of gold and emerald.
  for (let i = 0; i < 6; i++) {
    const sx = x - len / 2 + (i + 0.5) * (len / 6);
    const post = new THREE.Mesh(new THREE.CylinderGeometry(m(0.025), m(0.03), m(0.74), 12), GOLD);
    post.position.set(sx, FLOOR_Y + m(0.37), z + m(0.75));
    room.add(post);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(m(0.18), m(0.2), m(0.03), 24), GOLD);
    base.position.set(sx, FLOOR_Y + m(0.015), z + m(0.75));
    room.add(base);
    const seat = new THREE.Mesh(new THREE.CylinderGeometry(m(0.21), m(0.2), m(0.1), 24), EMERALD);
    seat.position.set(sx, FLOOR_Y + m(0.79), z + m(0.75));
    room.add(seat);
    const back = new THREE.Mesh(new THREE.CylinderGeometry(m(0.21), m(0.21), m(0.22), 24, 1, true, Math.PI * 0.6, Math.PI * 0.8), EMERALD);
    back.material.side = THREE.DoubleSide;
    back.position.set(sx, FLOOR_Y + m(0.95), z + m(0.75));
    room.add(back);
  }
  room.userData.bar = {
    bartender: { pos: new THREE.Vector3(x - len * 0.1, 0, -half + m(0.9)), yaw: 0 },
    pickup: { pos: new THREE.Vector3(x + len / 2 + m(0.55), 0, z - m(0.1)), look: new THREE.Vector3(x, 0, z) },
  };
}

// A black-and-gold carpet under the table, stepped in the Deco manner.
function decoRug(w, d) {
  const W = 2048, H = Math.round((2048 * d) / w);
  const tex = canvasTex(W, H, (ctx) => {
    ctx.fillStyle = '#0c0c0e';
    ctx.fillRect(0, 0, W, H);
    [0.02, 0.05, 0.07].forEach((t, i) => {
      ctx.strokeStyle = i === 1 ? '#0a3a24' : '#c9a24f';
      ctx.lineWidth = i === 1 ? 26 : 8;
      ctx.strokeRect(W * t, H * t * (W / H), W * (1 - 2 * t), H - 2 * H * t * (W / H));
    });
    // Stepped corners.
    [[0, 0, 1, 1], [W, 0, -1, 1], [0, H, 1, -1], [W, H, -1, -1]].forEach(([cx, cy, sx, sy]) => {
      ctx.strokeStyle = '#c9a24f';
      ctx.lineWidth = 5;
      for (let k = 1; k <= 3; k++) {
        const s = W * (0.08 + k * 0.03);
        ctx.beginPath();
        ctx.moveTo(cx + sx * s, cy + sy * W * 0.1);
        ctx.lineTo(cx + sx * s, cy + sy * s);
        ctx.lineTo(cx + sx * W * 0.1, cy + sy * s);
        ctx.stroke();
      }
    });
    grain(ctx, W, H, 12);
  });
  const rug = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshLambertMaterial({ map: tex }));
  rug.rotation.x = -Math.PI / 2;
  rug.position.set(0, FLOOR_Y + 0.006, -0.4);
  rug.receiveShadow = true;
  return rug;
}

// ---------- the room ----------
export const GOLDEN_ACE = {
  tableGlow: 0xffc860,
  half,
  ceilingY: CEIL,
  ceiling: null, noPanel: true, noCove: true,
  paintWall: (ctx, d) => paintDecoWall(ctx, d),
  floorPx: 1024, floorRepeat: 72 / m(1.2),
  paintFloor: paintDecoFloor,
  accent: 0xd4af5a, cove: 0xffd8a0, diffuser: 0xfff0d2, washAlpha: 0,
  wall: { style: 'panels', base: 0x0c0c0e, wainscot: 0x060606, rail: 0xc9a24f, skirting: 0x060606 },
  floor: { style: 'marble', base: 0x0e0e10, pattern: 0xe6e2da },
  light: { sky: 0xfff0dc, ground: 0x3a3020, fill: 2.4, key: 0xfff0dc, keyPower: 100, wash: 0xffd8a0, washPower: 46, fog: 0x0c0a08, fogNear: 60, fogFar: 160 },
  furnish(room) {
    steppedCeiling(room);
    decoChandelier(room, 0, FLOOR_Y + m(4.55), -0.4);
    room.add(decoRug(m(7.0), m(5.8)));

    // The sign, the room's name in gold over it, a sunburst either side.
    brandSign(room, half, { rgb: '236,206,140', plate: '#0a0a0c' });
    const title = giltText('THE GOLDEN ACE', m(5.0), m(0.7), "600 {S}px 'Cinzel', Georgia, serif");
    title.position.set(0, FLOOR_Y + m(3.85), -half + m(0.04));
    room.add(title);
    [-1, 1].forEach((s) => sunburst(room, s * m(3.6), FLOOR_Y + m(2.75), -half + m(0.05), 0));
    brandSign(room, half, { wall: 'front', width: m(1.8), y: FLOOR_Y + m(3.6), rgb: '236,206,140', plate: '#0a0a0c' });

    // Baccarat on the left, craps and baccarat on the right; the dealers
    // stand on the wall side, the players face them.
    baccaratTable(room, -m(7.8), -m(4.4), Math.PI / 2);
    baccaratTable(room, -m(7.8), m(3.6), Math.PI / 2);
    crapsTable(room, m(8.0), -m(1.0), Math.PI / 2);
    baccaratTable(room, m(8.0), m(6.2), -Math.PI / 2);

    // Banquettes down the front of the side walls, tables and tub chairs
    // before them; mirrors and sconces over them.
    [-1, 1].forEach((side) => {
      const wx = side * (half - m(0.45));
      banquette(room, wx, m(8.4), -side * Math.PI / 2, m(5.6));
      [m(6.6), m(8.4), m(10.2)].forEach((z) => {
        cocktailTable(room, wx - side * m(1.0), z);
        tubChair(room, wx - side * m(1.75), z, side * Math.PI / 2);
      });
      [m(6.6), m(10.2)].forEach((z) => sunburst(room, side * (half - 0.06), FLOOR_Y + m(2.5), z, -side * Math.PI / 2, m(0.42)));
      [-m(11), -m(7), -m(3), m(1), m(4.5), m(12.2)].forEach((z) => sconce(room, side * (half - m(0.08)), FLOOR_Y + m(2.6), z, -side * Math.PI / 2));
      [-m(9), m(1.2), m(12.5)].forEach((z) => torchere(room, side * (half - m(0.6)), z));
    });
    // Along the front wall, a banquette either side of the doors.
    [-1, 1].forEach((s) => {
      banquette(room, s * m(6.2), half - m(0.45), Math.PI, m(6.0));
      [m(4.4), m(6.2), m(8.0)].forEach((x) => {
        cocktailTable(room, s * x, half - m(1.45));
        tubChair(room, s * x, half - m(2.2), 0);
      });
    });
    decoBar(room);

    walkway(room, { x: 10.5, back: -9.2, front: 10.5 });
    staffPosts(room, [[10.5, -9.6], [-10.5, 10.5], [10.5, 10.5]]);
  },
};
