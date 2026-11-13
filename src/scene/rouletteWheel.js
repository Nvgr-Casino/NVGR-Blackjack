import * as THREE from 'three';
import { m } from './scale.js';
import { canvasTex, grain } from './casinoKit.js';
import { WHEEL_ORDER } from '../roulette/rules.js';
import { numberFill } from '../roulette/layout.js';
import { spinPlan, ballRun, seedFor } from '../roulette/spinPlan.js';

// The roulette wheel, built grand: a drum of figured wood ringed in heavy
// gold, gilt rosettes on its head; a ball track of black piano lacquer, so
// the ivory ball shows against it every inch of its run; gilt diamonds on
// the track; the rotor with its numbers in gold on red and black lacquer,
// raised gold frets between the pockets, a broad gold rim, a cone of
// walnut inlaid with a gold star, and a gold turret crowned at its top.
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

// Figured wood for the drum's head: leaves of two woods, gold between.
function paintMarquetry(ctx, S) {
  const c = S / 2;
  const leaves = 36;
  for (let i = 0; i < leaves; i++) {
    const a0 = (i / leaves) * Math.PI * 2, a1 = ((i + 1) / leaves) * Math.PI * 2;
    const g = ctx.createRadialGradient(c, c, c * 0.4, c, c, c);
    g.addColorStop(0, i % 2 ? '#6a2a12' : '#9a5a2a');
    g.addColorStop(1, i % 2 ? '#3a1206' : '#6a3414');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(c, c);
    ctx.arc(c, c, c, a0, a1);
    ctx.closePath();
    ctx.fill();
    for (let k = 0; k < 8; k++) {
      const a = a0 + (a1 - a0) * Math.random();
      ctx.strokeStyle = `rgba(20,6,2,${0.1 + Math.random() * 0.2})`;
      ctx.lineWidth = 1 + Math.random() * 2;
      ctx.beginPath();
      ctx.moveTo(c + Math.cos(a) * c * 0.4, c + Math.sin(a) * c * 0.4);
      ctx.lineTo(c + Math.cos(a + 0.012) * c, c + Math.sin(a + 0.012) * c);
      ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(232,200,120,0.75)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(c + Math.cos(a0) * c * 0.86, c + Math.sin(a0) * c * 0.86);
    ctx.lineTo(c + Math.cos(a0) * c, c + Math.sin(a0) * c);
    ctx.stroke();
  }
  [[0.985, 12], [0.95, 3], [0.88, 8], [0.865, 2]].forEach(([r, w]) => {
    ctx.strokeStyle = '#e2c27a';
    ctx.lineWidth = w;
    ctx.beginPath();
    ctx.arc(c, c, c * r, 0, Math.PI * 2);
    ctx.stroke();
  });
  grain(ctx, S, S, 8);
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
    const base = numberFill(n);
    g.addColorStop(0, base);
    g.addColorStop(0.55, n === 0 ? '#1aa050' : base === '#141414' ? '#2c2c30' : '#d8203c');
    g.addColorStop(1, base);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(c, c, c * 0.995, a0, a1);
    ctx.arc(c, c, c * 0.76, a1, a0, true);
    ctx.closePath();
    ctx.fill();
    // The pocket below it, deeper and darker.
    ctx.fillStyle = n === 0 ? '#0a4a26' : base === '#141414' ? '#0a0a0c' : '#6a0816';
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
    ctx.font = `800 ${S * 0.052}px Georgia, serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(n), 0, -c * 0.875);
    ctx.restore();
  });
  [[0.995, 0.008], [0.76, 0.006], [0.6, 0.008]].forEach(([r, lw]) => {
    ctx.strokeStyle = '#e2c27a';
    ctx.lineWidth = S * lw;
    ctx.beginPath();
    ctx.arc(c, c, c * r, 0, Math.PI * 2);
    ctx.stroke();
  });
}

// The cone: walnut, a star of gold let into it.
function paintCone(ctx, S) {
  const c = S / 2;
  const g = ctx.createRadialGradient(c, c, 0, c, c, c);
  g.addColorStop(0, '#9a6232');
  g.addColorStop(1, '#3a1a08');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, S, S);
  for (let k = 0; k < 90; k++) {
    const a = Math.random() * Math.PI * 2;
    ctx.strokeStyle = `rgba(30,10,2,${0.08 + Math.random() * 0.12})`;
    ctx.beginPath();
    ctx.moveTo(c + Math.cos(a) * c * 0.1, c + Math.sin(a) * c * 0.1);
    ctx.lineTo(c + Math.cos(a) * c, c + Math.sin(a) * c);
    ctx.stroke();
  }
  ctx.fillStyle = '#e2c27a';
  ctx.beginPath();
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    const r = i % 2 ? c * 0.34 : c * 0.95;
    ctx.lineTo(c + Math.cos(a) * r, c + Math.sin(a) * r);
  }
  ctx.closePath();
  ctx.globalAlpha = 0.85;
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.strokeStyle = '#7a5418';
  ctx.lineWidth = 3;
  ctx.stroke();
  grain(ctx, S, S, 8);
}

export function createWheel() {
  const g = new THREE.Group();
  const GOLD = new THREE.MeshPhysicalMaterial({ color: 0xe0b85e, roughness: 0.18, metalness: 1, clearcoat: 0.6, clearcoatRoughness: 0.1 });
  const DARK_GOLD = new THREE.MeshStandardMaterial({ color: 0xa8823a, roughness: 0.3, metalness: 1 });
  const WOOD = new THREE.MeshPhysicalMaterial({ map: canvasTex(1024, 1024, paintMarquetry), roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.06 });
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
  const face = new THREE.Mesh(new THREE.CircleGeometry(m(0.355), 96), new THREE.MeshPhysicalMaterial({ map: canvasTex(1536, 1536, paintRotor), roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.08 }));
  face.rotation.x = -Math.PI / 2;
  rotor.add(face);
  const frets = new THREE.InstancedMesh(new THREE.BoxGeometry(m(0.06), m(0.02), m(0.004)), GOLD, 37);
  const fm = new THREE.Matrix4();
  for (let i = 0; i < 37; i++) {
    const a = i * POCKET_STEP - Math.PI / 2 + POCKET_STEP / 2;
    fm.makeRotationY(-a);
    fm.setPosition(Math.cos(a) * m(0.24), m(0.01), Math.sin(a) * m(0.24));
    frets.setMatrixAt(i, fm);
  }
  rotor.add(frets);
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
  // The turret: gold, turned, four arms to gold balls, a crown at its top.
  const turret = new THREE.Mesh(new THREE.LatheGeometry([[0, 0.2], [0.012, 0.19], [0.016, 0.175], [0.01, 0.16], [0.022, 0.135], [0.013, 0.115], [0.03, 0.09], [0.046, 0.07], [0.062, 0.06], [0.07, 0.052], [0, 0.052]].map(([r, h]) => new THREE.Vector2(m(r), m(h))), 48), GOLD);
  rotor.add(turret);
  for (let k = 0; k < 4; k++) {
    const a = (k / 4) * Math.PI * 2;
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(m(0.006), m(0.01), m(0.13), 12), GOLD);
    arm.rotation.set(0, -a, Math.PI / 2);
    arm.position.set(Math.cos(a) * m(0.07), m(0.125), Math.sin(a) * m(0.07));
    rotor.add(arm);
    const knob = new THREE.Mesh(new THREE.SphereGeometry(m(0.016), 18, 12), GOLD);
    knob.position.set(Math.cos(a) * m(0.135), m(0.125), Math.sin(a) * m(0.135));
    rotor.add(knob);
  }
  const crown = new THREE.Group();
  crown.position.y = m(0.2);
  rotor.add(crown);
  const band = new THREE.Mesh(new THREE.CylinderGeometry(m(0.018), m(0.016), m(0.014), 16, 1, true), GOLD);
  band.material = GOLD;
  crown.add(band);
  for (let k = 0; k < 5; k++) {
    const a = (k / 5) * Math.PI * 2;
    const tip = new THREE.Mesh(new THREE.ConeGeometry(m(0.005), m(0.016), 6), GOLD);
    tip.position.set(Math.cos(a) * m(0.017), m(0.014), Math.sin(a) * m(0.017));
    crown.add(tip);
  }
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
  const RP = m(0.3);
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
