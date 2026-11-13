import * as THREE from 'three';
import { m } from './scale.js';
import { canvasTex, grain } from './casinoKit.js';
import { WHEEL_ORDER } from '../roulette/rules.js';
import { numberFill } from '../roulette/layout.js';
import { spinPlan, ballRun, seedFor } from '../roulette/spinPlan.js';

// The roulette wheel, built as the grandest real ones are (the Monte Carlo
// wheels of the early 1900s, and the bespoke wheels made after them): a
// head of black ebony between lines of brass stringing, NVGR CASINO round
// it in gold letters between gilt rosettes; a ball track of black piano lacquer, so the ivory
// ball shows against it every inch of its run; gilt diamonds on the
// track; the rotor's numbers in gold on red and black lacquer, a band of
// tulipwood round them, domed gold frets between the pockets with a bead
// at each inner end; a cone hand-painted in gold leaf — scrolls, fleurs, a
// laurel wreath round a crown; and a French turret, fluted gold, its four
// arms curling out in an S to acorn finials, a pearl-tipped crown on top.
//
// Everything is in the wheel's own frame, its centre at the origin on the
// table's top; the table places and scales it. It turns slowly always;
// spun, it turns faster and slows, and the ball runs the other way round
// the track for twenty-odd laps, spirals down, strikes a diamond, hops
// from pocket to pocket and settles in the pocket of the number drawn — by
// a plan seeded from the spin itself (src/roulette/spinPlan.js), so every
// client sees the same run.

const POCKET_STEP = (Math.PI * 2) / 37;
// The angle, round the wheel's axis, of a pocket when the rotor is turned
// by `rotor`. Pocket i is centred at i·step − 90° on the rotor's face.
const pocketAngle = (number, rotor) => WHEEL_ORDER.indexOf(number) * POCKET_STEP - Math.PI / 2 - rotor;

// The head: black ebony under deep lacquer, lines of brass stringing at
// its edges, and the house's name in gold letters round it — NVGR and
// CASINO in turn, set between the gilt rosettes. The letters face in, so
// the players across the table read them upright.
function paintMarquetry(ctx, S) {
  const c = S / 2;
  ctx.fillStyle = '#0a0806';
  ctx.fillRect(0, 0, S, S);
  // A faint grain in the black.
  for (let k = 0; k < 500; k++) {
    const a = Math.random() * Math.PI * 2, r0 = c * (0.84 + Math.random() * 0.15);
    ctx.strokeStyle = `rgba(60,36,22,${0.06 + Math.random() * 0.1})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(c, c, r0, a, a + 0.04 + Math.random() * 0.15);
    ctx.stroke();
  }
  // Brass stringing at both edges of the band.
  [[0.995, 9], [0.978, 2], [0.862, 2], [0.848, 5]].forEach(([r, w]) => {
    ctx.strokeStyle = '#e2c27a';
    ctx.lineWidth = w;
    ctx.beginPath();
    ctx.arc(c, c, c * r, 0, Math.PI * 2);
    ctx.stroke();
  });
  // The lettering. The rosettes stand at every eighth of the circle (the
  // canvas's angle is the wheel's), so the words sit between them.
  const R = c * 0.918;
  const size = S * 0.034;
  const spacing = (size * 0.95) / R;      // radians a letter
  for (let k = 0; k < 8; k++) {
    const word = k % 2 ? 'CASINO' : 'NVGR';
    const mid = (k + 0.5) * (Math.PI / 4);
    const chars = word.split('');
    chars.forEach((ch, i) => {
      const ang = mid - (i - (chars.length - 1) / 2) * spacing;
      ctx.save();
      ctx.translate(c + Math.cos(ang) * R, c + Math.sin(ang) * R);
      ctx.rotate(ang - Math.PI / 2);
      const g = ctx.createLinearGradient(0, -size / 2, 0, size / 2);
      g.addColorStop(0, '#fff0b8');
      g.addColorStop(0.5, '#e0b860');
      g.addColorStop(1, '#a87a2c');
      ctx.fillStyle = g;
      ctx.font = `700 ${size}px 'Cinzel', Georgia, serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(ch, 0, 0);
      ctx.restore();
    });
  }
  grain(ctx, S, S, 4);
}

// The rotor's face: thirty-seven pockets of red and black lacquer (the
// zero green), their numbers in gold round the rim; the cone inside left
// to the 3D cone laid over it.
function paintRotor(ctx, S) {
  const c = S / 2;
  ctx.fillStyle = '#2a1206';
  ctx.fillRect(0, 0, S, S);
  WHEEL_ORDER.forEach((n, i) => {
    const a0 = i * POCKET_STEP - Math.PI / 2 - POCKET_STEP / 2, a1 = a0 + POCKET_STEP;
    // The number's tile, lacquered, a highlight across it.
    const g = ctx.createRadialGradient(c, c, c * 0.72, c, c, c);
    // A deep, saturated lacquer red: it reads as red, not pink, under the
    // wheel's own light.
    const base = n === 0 ? numberFill(0) : numberFill(n) === '#141414' ? '#141414' : '#9c0016';
    g.addColorStop(0, base);
    g.addColorStop(0.55, n === 0 ? '#14a04a' : base === '#141414' ? '#26262a' : '#b8001a');
    g.addColorStop(1, base);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(c, c, c * 0.995, a0, a1);
    ctx.arc(c, c, c * 0.76, a1, a0, true);
    ctx.closePath();
    ctx.fill();
    // The pocket below it, deeper and darker.
    ctx.fillStyle = n === 0 ? '#08542a' : base === '#141414' ? '#0a0a0c' : '#8a0010';
    ctx.beginPath();
    ctx.arc(c, c, c * 0.76, a0, a1);
    ctx.arc(c, c, c * 0.6, a1, a0, true);
    ctx.closePath();
    ctx.fill();
    ctx.save();
    ctx.translate(c, c);
    ctx.rotate(a0 + POCKET_STEP / 2 + Math.PI / 2);
    const gold = ctx.createLinearGradient(0, -c * 0.95, 0, -c * 0.8);
    gold.addColorStop(0, '#fff0b8');
    gold.addColorStop(1, '#c8963c');
    ctx.fillStyle = gold;
    ctx.font = `800 ${S * 0.048}px Georgia, serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(n), 0, -c * 0.85);
    ctx.restore();
  });
  // The number arcs' rim: a band of tulipwood, striped, between brass.
  for (let k = 0; k < 220; k++) {
    const a = (k / 220) * Math.PI * 2;
    ctx.strokeStyle = k % 2 ? '#c8826a' : '#e0a888';
    ctx.lineWidth = S * 0.012;
    ctx.beginPath();
    ctx.arc(c, c, c * 0.968, a, a + (Math.PI * 2) / 220 + 0.002);
    ctx.stroke();
  }
  [[0.995, 0.008], [0.94, 0.005], [0.76, 0.006], [0.6, 0.008]].forEach(([r, lw]) => {
    ctx.strokeStyle = '#e2c27a';
    ctx.lineWidth = S * lw;
    ctx.beginPath();
    ctx.arc(c, c, c * r, 0, Math.PI * 2);
    ctx.stroke();
  });
}

// The cone, hand-painted as the bespoke wheels' are: ebony lacquer, gold
// leaf scrolling out from a laurel wreath and a crown at its heart, a ring
// of fleurs between, rays of gold to the edge.
function paintCone(ctx, S) {
  const c = S / 2;
  const g = ctx.createRadialGradient(c, c, 0, c, c, c);
  g.addColorStop(0, '#2a1608');
  g.addColorStop(0.7, '#160c06');
  g.addColorStop(1, '#0c0604');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, S, S);
  const gold = (y0, y1) => { const gg = ctx.createLinearGradient(0, y0, 0, y1); gg.addColorStop(0, '#fff0b8'); gg.addColorStop(0.5, '#d4a84a'); gg.addColorStop(1, '#8a6220'); return gg; };
  ctx.lineCap = 'round';
  // Rays to the edge, long and short.
  for (let i = 0; i < 32; i++) {
    const a = (i / 32) * Math.PI * 2;
    ctx.strokeStyle = 'rgba(226,194,122,0.85)';
    ctx.lineWidth = i % 2 ? S * 0.003 : S * 0.006;
    ctx.beginPath();
    ctx.moveTo(c + Math.cos(a) * c * 0.62, c + Math.sin(a) * c * 0.62);
    ctx.lineTo(c + Math.cos(a) * c * (i % 2 ? 0.86 : 0.97), c + Math.sin(a) * c * (i % 2 ? 0.86 : 0.97));
    ctx.stroke();
  }
  // Scrolls: a pair of curls between each long ray.
  ctx.strokeStyle = '#d8b25e';
  ctx.lineWidth = S * 0.005;
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
    [-1, 1].forEach((side) => {
      ctx.beginPath();
      for (let t = 0; t <= 1.001; t += 0.05) {
        const r = c * (0.42 + 0.16 * t);
        const ang = a + side * (0.05 + 0.32 * t) + side * Math.sin(t * Math.PI * 2) * 0.05;
        const x = c + Math.cos(ang) * r, y = c + Math.sin(ang) * r;
        if (t === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
      const end = a + side * 0.37;
      ctx.beginPath();
      ctx.arc(c + Math.cos(end) * c * 0.58, c + Math.sin(end) * c * 0.58, S * 0.012, 0, Math.PI * 2);
      ctx.stroke();
    });
    // A fleur at the ray's foot.
    ctx.save();
    ctx.translate(c + Math.cos(a) * c * 0.66, c + Math.sin(a) * c * 0.66);
    ctx.rotate(a + Math.PI / 2);
    ctx.fillStyle = gold(-S * 0.03, S * 0.03);
    ctx.beginPath();
    ctx.moveTo(0, -S * 0.035);
    ctx.quadraticCurveTo(S * 0.016, -S * 0.012, 0, S * 0.012);
    ctx.quadraticCurveTo(-S * 0.016, -S * 0.012, 0, -S * 0.035);
    ctx.fill();
    ctx.restore();
  }
  // The laurel wreath.
  [-1, 1].forEach((side) => {
    for (let k = 0; k < 9; k++) {
      const a = Math.PI / 2 + side * (0.35 + k * 0.28);
      ctx.save();
      ctx.translate(c + Math.cos(a) * c * 0.3, c + Math.sin(a) * c * 0.3);
      ctx.rotate(a + side * 0.9);
      ctx.fillStyle = gold(-S * 0.02, S * 0.02);
      ctx.beginPath();
      ctx.ellipse(0, 0, S * 0.022, S * 0.008, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  });
  // The crown within it.
  ctx.fillStyle = gold(c - S * 0.06, c + S * 0.04);
  const w = S * 0.16, h = S * 0.1, y = c + S * 0.02;
  ctx.beginPath();
  ctx.moveTo(c - w / 2, y);
  ctx.lineTo(c - w / 2, y - h * 0.55);
  ctx.lineTo(c - w / 4, y - h * 0.25);
  ctx.lineTo(c, y - h);
  ctx.lineTo(c + w / 4, y - h * 0.25);
  ctx.lineTo(c + w / 2, y - h * 0.55);
  ctx.lineTo(c + w / 2, y);
  ctx.closePath();
  ctx.fill();
  ctx.fillRect(c - w / 2, y + S * 0.008, w, S * 0.018);
  [[-0.5, -0.55], [0, -1], [0.5, -0.55]].forEach(([dx, dy]) => { ctx.beginPath(); ctx.arc(c + dx * w, y + dy * h - S * 0.008, S * 0.01, 0, Math.PI * 2); ctx.fill(); });
  // Rings of gold, inner and outer.
  [[0.98, 0.008], [0.62, 0.004], [0.4, 0.004]].forEach(([r, lw]) => {
    ctx.strokeStyle = '#e2c27a';
    ctx.lineWidth = S * lw;
    ctx.beginPath();
    ctx.arc(c, c, c * r, 0, Math.PI * 2);
    ctx.stroke();
  });
  grain(ctx, S, S, 5);
}

export function createWheel() {
  const g = new THREE.Group();
  const GOLD = new THREE.MeshPhysicalMaterial({ color: 0xe0b85e, roughness: 0.18, metalness: 1, clearcoat: 0.6, clearcoatRoughness: 0.1 });
  const DARK_GOLD = new THREE.MeshStandardMaterial({ color: 0xa8823a, roughness: 0.3, metalness: 1 });
  const WOOD = new THREE.MeshPhysicalMaterial({ map: canvasTex(2048, 2048, paintMarquetry), roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.06 });
  const SIDE = new THREE.MeshPhysicalMaterial({ color: 0x4a1a0a, roughness: 0.35, clearcoat: 1, clearcoatRoughness: 0.1 });
  const EBONY = new THREE.MeshPhysicalMaterial({ color: 0x0a0806, roughness: 0.12, metalness: 0.1, clearcoat: 1, clearcoatRoughness: 0.02, side: THREE.DoubleSide });

  // ---------- the drum ----------
  const drum = new THREE.Mesh(new THREE.CylinderGeometry(m(0.56), m(0.55), m(0.13), 96, 1, true), SIDE);
  drum.position.y = m(0.045);
  g.add(drum);
  // Gilt beads down its side, top and foot.
  [[m(0.562), m(0.108), m(0.016)], [m(0.555), m(0.06), m(0.007)], [m(0.553), -m(0.01), m(0.012)]].forEach(([r, y, t]) => {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(r, t, 10, 128), GOLD);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = y;
    g.add(ring);
  });
  const headTop = new THREE.Mesh(new THREE.RingGeometry(m(0.47), m(0.56), 128), WOOD);
  headTop.rotation.x = -Math.PI / 2;
  headTop.position.y = m(0.11);
  g.add(headTop);
  const innerBead = new THREE.Mesh(new THREE.TorusGeometry(m(0.47), m(0.01), 10, 128), GOLD);
  innerBead.rotation.x = Math.PI / 2;
  innerBead.position.y = m(0.11);
  g.add(innerBead);
  // Gilt rosettes round the head, between the diamonds.
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2;
    const ros = new THREE.Mesh(new THREE.SphereGeometry(m(0.018), 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), GOLD);
    ros.position.set(Math.cos(a) * m(0.515), m(0.11), Math.sin(a) * m(0.515));
    ros.scale.y = 0.6;
    g.add(ros);
    const petals = new THREE.Mesh(new THREE.TorusGeometry(m(0.022), m(0.004), 6, 16), DARK_GOLD);
    petals.rotation.x = Math.PI / 2;
    petals.position.copy(ros.position);
    g.add(petals);
  }

  // ---------- the track ----------
  // Black lacquer sloping in to the rotor; the ball runs its outer edge.
  const track = new THREE.Mesh(new THREE.LatheGeometry([[0.47, 0.11], [0.455, 0.098], [0.42, 0.082], [0.38, 0.062], [0.36, 0.054]].map(([r, h]) => new THREE.Vector2(m(r), m(h))), 128), EBONY);
  g.add(track);
  // Gilt diamonds, upright and lying in turn.
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2 + Math.PI / 8;
    const d = new THREE.Mesh(new THREE.OctahedronGeometry(m(0.018)), GOLD);
    d.scale.set(k % 2 ? 0.6 : 1, k % 2 ? 1.1 : 0.5, 2);
    d.position.set(Math.cos(a) * m(0.405), m(0.075), Math.sin(a) * m(0.405));
    d.rotation.y = -a;
    g.add(d);
  }

  // ---------- the rotor ----------
  const rotor = new THREE.Group();
  rotor.position.y = m(0.045);
  g.add(rotor);
  // A softer gloss than the wood's, so the light does not wash the reds
  // out toward pink.
  const rotorTex = canvasTex(1536, 1536, paintRotor);
  const face = new THREE.Mesh(new THREE.CircleGeometry(m(0.355), 96), new THREE.MeshPhysicalMaterial({ map: rotorTex, roughness: 0.4, clearcoat: 0.3, clearcoatRoughness: 0.3 }));
  face.rotation.x = -Math.PI / 2;
  rotor.add(face);
  // The frets: rounded bars of gold, scalloped high at the rim and low at
  // the hub, a bead at the inner end of each.
  const fretGeo = new THREE.CapsuleGeometry(m(0.0035), m(0.056), 4, 8);
  fretGeo.rotateZ(Math.PI / 2);
  const frets = new THREE.InstancedMesh(fretGeo, GOLD, 37);
  const beads = new THREE.InstancedMesh(new THREE.SphereGeometry(m(0.006), 12, 8), GOLD, 37);
  const fm = new THREE.Matrix4();
  const fq = new THREE.Quaternion(), fs = new THREE.Vector3(1, 1, 1), fp = new THREE.Vector3();
  const tilt = new THREE.Quaternion();
  for (let i = 0; i < 37; i++) {
    const a = i * POCKET_STEP - Math.PI / 2 + POCKET_STEP / 2;
    fq.setFromAxisAngle(new THREE.Vector3(0, 1, 0), -a);
    tilt.setFromAxisAngle(new THREE.Vector3(0, 0, 1), -0.18);
    fq.multiply(tilt);
    fp.set(Math.cos(a) * m(0.242), m(0.012), Math.sin(a) * m(0.242));
    fm.compose(fp, fq, fs);
    frets.setMatrixAt(i, fm);
    fm.makeTranslation(Math.cos(a) * m(0.214), m(0.008), Math.sin(a) * m(0.214));
    beads.setMatrixAt(i, fm);
  }
  rotor.add(frets);
  rotor.add(beads);
  // A gilt ring between the numbers and the pockets, the frets meeting it.
  [[m(0.355), m(0.012), m(0.006)], [m(0.27), m(0.006), m(0.02)], [m(0.212), m(0.007), m(0.016)]].forEach(([r, t, y]) => {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(r, t, 10, 128), GOLD);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = y;
    rotor.add(ring);
  });
  const coneTex = canvasTex(1024, 1024, paintCone);
  const cone = new THREE.Mesh(new THREE.LatheGeometry([[0.212, 0.016], [0.19, 0.022], [0.15, 0.032], [0.1, 0.044], [0.06, 0.052], [0, 0.055]].map(([r, h]) => new THREE.Vector2(m(r), m(h))), 96), new THREE.MeshPhysicalMaterial({ map: coneTex, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.08 }));
  // Lay the cone's star over its slope: map by angle and radius.
  {
    const pos = cone.geometry.attributes.position, uv = cone.geometry.attributes.uv;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i);
      uv.setXY(i, 0.5 + x / (2 * m(0.212)), 0.5 - z / (2 * m(0.212)));
    }
    uv.needsUpdate = true;
  }
  rotor.add(cone);
  // The turret, French and sculpted: a fluted column of gold on a stepped
  // base, four arms curling out in an S to acorn finials, a crown above.
  const turretBase = new THREE.Mesh(new THREE.LatheGeometry([[0, 0.052], [0.072, 0.052], [0.068, 0.058], [0.05, 0.064], [0.046, 0.072], [0.032, 0.08], [0, 0.08]].map(([r, h]) => new THREE.Vector2(m(r), m(h))), 64), GOLD);
  rotor.add(turretBase);
  const column = new THREE.Mesh(new THREE.CylinderGeometry(m(0.011), m(0.016), m(0.11), 16), GOLD);
  column.position.y = m(0.135);
  rotor.add(column);
  // Flutes down the column.
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2;
    const flute = new THREE.Mesh(new THREE.CylinderGeometry(m(0.0022), m(0.0028), m(0.1), 6), DARK_GOLD);
    flute.position.set(Math.cos(a) * m(0.0135), m(0.135), Math.sin(a) * m(0.0135));
    rotor.add(flute);
  }
  const knop = new THREE.Mesh(new THREE.LatheGeometry([[0, 0.17], [0.012, 0.17], [0.026, 0.182], [0.022, 0.196], [0.01, 0.204], [0, 0.206]].map(([r, h]) => new THREE.Vector2(m(r), m(h))), 32), GOLD);
  rotor.add(knop);
  for (let k = 0; k < 4; k++) {
    const a = (k / 4) * Math.PI * 2;
    const dir = new THREE.Vector3(Math.cos(a), 0, Math.sin(a));
    const pts = [
      new THREE.Vector3(0, m(0.15), 0).addScaledVector(dir, m(0.012)),
      new THREE.Vector3(0, m(0.168), 0).addScaledVector(dir, m(0.05)),
      new THREE.Vector3(0, m(0.15), 0).addScaledVector(dir, m(0.095)),
      new THREE.Vector3(0, m(0.158), 0).addScaledVector(dir, m(0.13)),
    ];
    rotor.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, m(0.0055), 8, false), GOLD));
    const acorn = new THREE.Mesh(new THREE.SphereGeometry(m(0.014), 16, 12), GOLD);
    acorn.scale.y = 1.3;
    acorn.position.copy(pts[3]).add(new THREE.Vector3(0, m(0.006), 0)).addScaledVector(dir, m(0.008));
    rotor.add(acorn);
    const cup = new THREE.Mesh(new THREE.SphereGeometry(m(0.0145), 16, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), DARK_GOLD);
    cup.position.copy(acorn.position);
    rotor.add(cup);
  }
  const crown = new THREE.Group();
  crown.position.y = m(0.206);
  rotor.add(crown);
  const band = new THREE.Mesh(new THREE.CylinderGeometry(m(0.02), m(0.017), m(0.016), 20, 1, true), GOLD);
  band.material = new THREE.MeshPhysicalMaterial({ color: 0xe0b85e, roughness: 0.18, metalness: 1, side: THREE.DoubleSide });
  crown.add(band);
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2;
    const tip = new THREE.Mesh(new THREE.ConeGeometry(m(0.0055), m(0.02), 6), GOLD);
    tip.position.set(Math.cos(a) * m(0.019), m(0.017), Math.sin(a) * m(0.019));
    crown.add(tip);
    const pearl = new THREE.Mesh(new THREE.SphereGeometry(m(0.0035), 10, 8), new THREE.MeshStandardMaterial({ color: 0xf6f0e6, roughness: 0.25 }));
    pearl.position.set(Math.cos(a) * m(0.019), m(0.028), Math.sin(a) * m(0.019));
    crown.add(pearl);
  }
  const orb = new THREE.Mesh(new THREE.SphereGeometry(m(0.008), 14, 10), GOLD);
  orb.position.y = m(0.024);
  crown.add(orb);
  const ball = new THREE.Mesh(new THREE.SphereGeometry(m(0.012), 20, 14), new THREE.MeshPhysicalMaterial({ color: 0xfffcf4, roughness: 0.1, clearcoat: 1, emissive: 0x222018 }));
  ball.castShadow = true;
  g.add(ball);

  // ---------- the spin ----------
  // The rotor turns anticlockwise seen from above; the croupier gives it a
  // push with each spin, and it slows back to an idle turn over a minute.
  // The ball runs clockwise, by the spin's plan (src/roulette/spinPlan.js).
  const IDLE = 0.55;                  // rad/s, between spins
  const PUSH = 2.9;                   // rad/s, just after the croupier's push
  const TAU = 28;                     // s, how long the push takes to fade
  const RT = m(0.43), RD = m(0.405), RE = m(0.355);  // the ball's track, the diamonds' ring, the rotor's edge
  // The pockets' ring, inside the numbers' (the face's 0.6–0.76 of its
  // radius, between the gold frets): where the ball comes to rest.
  const RP = m(0.241);
  const YT = m(0.098), YP = m(0.058), YE = m(0.064);
  const STEP = POCKET_STEP;
  let base = 0;                       // the rotor's angle at `baseAt`, before any push
  let baseAt = 0;
  let pushAt = null;                  // when the last push was given (ms)
  let spin = null;                    // { start, T, number, plan, rel }
  let resting = null;
  const pushed = (now) => {
    if (pushAt === null) return 0;
    const s = Math.max(0, (now - pushAt) / 1000);
    return (PUSH - IDLE) * TAU * (1 - Math.exp(-s / TAU));
  };
  const rotorAt = (now) => base + IDLE * (now - baseAt) / 1000 + pushed(now);
  function placeBall(angle, r, y) { ball.position.set(Math.cos(angle) * r, y, Math.sin(angle) * r); }

  // The bounces: from where the ball lands on the rotor to the pocket it
  // settles in, measured round the rotor itself; most of the way covered
  // in the first, biggest hops, a pocket or so of jitter between.
  function bounceWaypoints(plan, number, start) {
    const t2 = start + plan.T2 * 1000;
    const enter = ballRun(plan, plan.T2).angle + rotorAt(t2);
    let target = pocketAngle(number, 0);
    const lo = enter + plan.turns * Math.PI * 0.8;
    target += Math.ceil((lo - target) / (Math.PI * 2)) * Math.PI * 2;
    const n = plan.hops.length;
    const pts = [enter];
    for (let i = 1; i < n; i++) {
      const f = 1 - Math.pow(1 - i / n, 1.7);
      pts.push(enter + (target - enter) * f + plan.hops[i].jitter * STEP);
    }
    pts.push(target);
    return pts;
  }

  function update(now) {
    const a = rotorAt(now);
    rotor.rotation.y = a;
    if (spin) {
      const { plan, rel } = spin;
      const t = (now - spin.start) / 1000;
      if (t < plan.T1) {
        // On the rim, a hair's wobble in it.
        const { angle } = ballRun(plan, Math.max(0, t));
        placeBall(angle, RT + Math.sin(t * 7) * m(0.002), YT);
      } else if (t < plan.T2) {
        // Down the track, a jolt off the diamond near the end.
        const { angle } = ballRun(plan, t);
        const s = (t - plan.T1) / plan.spiral;
        const e = s * s * (3 - 2 * s);
        let r = RT + (RE - RT) * e, y = YT + (YE - YT) * e;
        const k = (t - plan.TD) / 0.28;
        if (k > 0 && k < 1) { y += Math.sin(k * Math.PI) * m(0.03); r += Math.sin(k * Math.PI) * m(0.012); }
        placeBall(angle, r, y);
      } else if (t < plan.T3) {
        // Hopping from pocket to pocket, round with the rotor under it.
        const i = plan.hops.findIndex((h) => t < h.t0 + h.dur);
        const hop = plan.hops[i];
        const s = (t - hop.t0) / hop.dur;
        const relAngle = rel[i] + (rel[i + 1] - rel[i]) * s;
        const r0 = i === 0 ? RE : plan.hops[i - 1].r * m(1), r1 = hop.r * m(1);
        placeBall(relAngle - a, r0 + (r1 - r0) * s, YP + 4 * s * (1 - s) * m(hop.h));
      } else {
        placeBall(pocketAngle(spin.number, a), RP, YP);
      }
    } else if (resting !== null) {
      placeBall(pocketAngle(resting, a), RP, YP);
    } else {
      placeBall(Math.PI * 0.25, RT, YT);
    }
  }
  // Spins to `number`, the spin having begun at `start` (a Date.now() time,
  // the same for every client).
  function spinTo(number, start) {
    if (spin && spin.start === start && spin.number === number) return;
    const now = Date.now();
    // The croupier's push, given at `start`.
    const angleThen = rotorAt(Math.min(now, start));
    base = angleThen;
    baseAt = start;
    pushAt = start;
    const plan = spinPlan(seedFor(start, number));
    spin = { start, number, plan, rel: null, T: (plan.T3 + 0.4) * 1000 };
    spin.rel = bounceWaypoints(plan, number, start);
    resting = null;
  }
  function rest(number) {
    if (spin) {
      if (Date.now() - spin.start < spin.T) return;
      spin = null;
    }
    resting = number === undefined ? null : number;
  }
  // Where the spin is: 0 at its start, 1 when the ball settles; null when
  // the wheel is not spinning.
  function progress(now = Date.now()) {
    if (!spin) return null;
    return Math.max(0, (now - spin.start) / (spin.plan.T3 * 1000));
  }
  const ballWorld = (out) => ball.getWorldPosition(out);

  g.userData.api = { update, spinTo, rest, progress, ballWorld, get spinning() { return !!spin && Date.now() - spin.start < spin.T; } };
  return g;
}
