import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { m } from './scale.js';

// The dice: casino red with white pips, sharp-cornered as precision dice
// are. A throw is a flight from the shooter's hand to the back wall, a
// rebound, a few hops across the felt and a roll to rest on the faces that
// were drawn. The path is worked out from the roll itself, so every client
// sees the same dice do the same thing.

export const DIE = m(0.04);
const PHONE = window.matchMedia('(pointer: coarse)').matches || window.innerWidth < 820;

// Faces in the order a box's sides come: +x, −x, +y, −y, +z, −z. Opposite
// faces add to seven.
const FACE_VALUES = [2, 5, 1, 6, 3, 4];
// The turn that brings face `v` up.
const FACE_UP = {
  1: new THREE.Quaternion(),
  6: new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI),
  2: new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI / 2),
  5: new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), -Math.PI / 2),
  3: new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2),
  4: new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2),
};

let materials = null;
function dieMaterials() {
  if (materials) return materials;
  materials = FACE_VALUES.map((v) => {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(54, 50, 6, 64, 64, 90);
    g.addColorStop(0, '#e2283f'); g.addColorStop(1, '#8e0d1d');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 128, 128);
    const P = { 1: [[0, 0]], 2: [[-1, -1], [1, 1]], 3: [[-1, -1], [0, 0], [1, 1]], 4: [[-1, -1], [1, -1], [-1, 1], [1, 1]], 5: [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]], 6: [[-1, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [1, 1]] }[v];
    P.forEach(([dx, dy]) => {
      const x = 64 + dx * 34, y = 64 + dy * 34;
      // Each pip drilled and filled: a little shadow, then white.
      ctx.fillStyle = 'rgba(60,0,8,0.6)'; ctx.beginPath(); ctx.arc(x + 1.5, y + 2, 12, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fbf7ef'; ctx.beginPath(); ctx.arc(x, y, 11, 0, Math.PI * 2); ctx.fill();
    });
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
    return PHONE
      ? new THREE.MeshStandardMaterial({ map: t, roughness: 0.18, metalness: 0, emissive: 0x2a0006, emissiveIntensity: 0.6 })
      : new THREE.MeshPhysicalMaterial({ map: t, roughness: 0.12, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.05, emissive: 0x2a0006, emissiveIntensity: 0.6 });
  });
  return materials;
}

// A small, repeatable random sequence from a number.
function seeded(seed) {
  let s = (Math.floor(seed) % 2147483647 + 2147483647) % 2147483647 || 1;
  return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
}

/**
 * The pair of dice on a table. `bounds` is the felt's inner box in the
 * table's frame: { x0, x1, z0 (the back wall), z1 } at felt height `y`.
 */
export function createDice({ y = 0, bounds }) {
  const group = new THREE.Group();
  const geo = new RoundedBoxGeometry(DIE, DIE, DIE, 3, DIE * 0.1);
  const dice = [0, 1].map(() => {
    const mesh = new THREE.Mesh(geo, dieMaterials());
    mesh.castShadow = true;
    group.add(mesh);
    return mesh;
  });
  const rest = DIE / 2;
  let plan = null;

  // Where the stickman keeps the dice between throws: by the back wall.
  function park() {
    dice.forEach((d, i) => {
      d.position.set((i - 0.5) * DIE * 1.4, y + rest, bounds.z0 + m(0.14));
      d.quaternion.copy(FACE_UP[i ? 5 : 2]);
    });
  }
  park();

  /** Shows two dice lying at rest showing `d1` and `d2`, where a throw left them. */
  function showAt(d1, d2, seed) {
    const p = makePlan(d1, d2, seed, new THREE.Vector3(0, y + m(0.2), bounds.z1));
    dice.forEach((d, i) => { d.position.copy(p.dice[i].restPos); d.quaternion.copy(p.dice[i].restQ); });
  }

  function makePlan(d1, d2, seed, from) {
    const rnd = seeded(seed);
    const values = [d1, d2];
    const hitX = THREE.MathUtils.clamp(from.x * 0.4 + (rnd() - 0.5) * m(0.6), bounds.x0 + m(0.3), bounds.x1 - m(0.3));
    return {
      dice: values.map((v, i) => {
        const side = i ? 1 : -1;
        const launch = from.clone().add(new THREE.Vector3(side * DIE * 0.8, 0, 0));
        const wall = new THREE.Vector3(hitX + side * m(0.05) + (rnd() - 0.5) * m(0.04), y + m(0.06) + rnd() * m(0.05), bounds.z0 + rest);
        // Where it comes to rest: back off the wall toward the middle.
        const restPos = new THREE.Vector3(
          THREE.MathUtils.clamp(hitX + side * (m(0.07) + rnd() * m(0.1)) + (rnd() - 0.5) * m(0.08), bounds.x0 + m(0.15), bounds.x1 - m(0.15)),
          y + rest,
          bounds.z0 + m(0.22) + rnd() * m(0.32),
        );
        // The hops between the wall and rest: three, each lower and shorter.
        const hops = [];
        let at = wall.clone().setY(y + rest);
        const span = restPos.clone().sub(at);
        [0.45, 0.28, 0.17].forEach((share, k) => {
          const next = at.clone().addScaledVector(span, share).add(new THREE.Vector3((rnd() - 0.5) * m(0.05), 0, 0));
          hops.push({ from: at.clone(), to: next.clone(), height: [m(0.11), m(0.05), m(0.022)][k], ms: [330, 230, 150][k] });
          at = next;
        });
        const restQ = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rnd() * Math.PI * 2).multiply(FACE_UP[v]);
        const axis = new THREE.Vector3(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5).normalize();
        return { launch, wall, hops, slideFrom: at, restPos, restQ, axis, turns: 9 + rnd() * 5, delay: i * 40 };
      }),
    };
  }

  /** A throw from `from` (the shooter's hand), started at `startMs` (wall-clock). */
  function throwDice(d1, d2, startMs, from) {
    plan = makePlan(d1, d2, startMs + d1 * 7 + d2 * 13, from);
    plan.start = startMs;
    plan.landed = false;
  }
  const FLIGHT = 820, WIND = 260, SLIDE = 520;
  const tmpQ = new THREE.Quaternion();
  // Where die `i` is, `t` ms after the throw; returns whether it is still.
  function pose(d, i, t) {
    const p = plan.dice[i];
    t -= p.delay;
    const hopsMs = p.hops.reduce((a, h) => a + h.ms, 0);
    const moving = FLIGHT + hopsMs;
    if (t < WIND) { d.visible = false; return false; }
    d.visible = true;
    let u = t - WIND;
    if (u < FLIGHT) {
      const k = u / FLIGHT;
      d.position.lerpVectors(p.launch, p.wall, k);
      d.position.y += Math.sin(k * Math.PI) * m(0.38) * (1 - k * 0.35);
    } else {
      u -= FLIGHT;
      let done = false;
      for (const h of p.hops) {
        if (u < h.ms) { const k = u / h.ms; d.position.lerpVectors(h.from, h.to, k); d.position.y += Math.sin(k * Math.PI) * h.height; done = true; break; }
        u -= h.ms;
      }
      if (!done) {
        // The last of it: a roll to rest, easing out.
        const k = Math.min(1, u / SLIDE);
        const e = 1 - Math.pow(1 - k, 3);
        d.position.lerpVectors(p.slideFrom, p.restPos, e);
      }
    }
    // Tumbling all the way, slowing to land on its face.
    const all = moving + SLIDE;
    const k = Math.min(1, (t - WIND) / all);
    const left = Math.pow(1 - k, 2.2) * p.turns * Math.PI * 2;
    tmpQ.setFromAxisAngle(p.axis, left);
    d.quaternion.copy(p.restQ).multiply(tmpQ);
    // Never through the felt while it turns.
    d.position.y = Math.max(d.position.y, y + rest * (1 + 0.42 * Math.min(1, left)));
    return t - WIND >= all;
  }
  let onLand = null;
  function update(now) {
    if (!plan) return;
    const t = now - plan.start;
    let still = true;
    dice.forEach((d, i) => { if (!pose(d, i, t)) still = false; });
    if (t > WIND + FLIGHT && !plan.hitWall) { plan.hitWall = true; if (onLand) onLand('wall'); }
    if (still && !plan.landed) { plan.landed = true; if (onLand) onLand('rest'); }
  }
  /** The dice back with the stickman, ready for the next shooter. */
  function collect() { plan = null; dice.forEach((d) => { d.visible = true; }); park(); }

  group.userData = {
    throwDice, update, collect, showAt,
    get throwing() { return !!plan && !plan.landed; },
    get restPoint() { return plan ? plan.dice[0].restPos.clone().lerp(plan.dice[1].restPos, 0.5) : null; },
    setOnLand(fn) { onLand = fn; },
  };
  return group;
}
