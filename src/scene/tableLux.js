import * as THREE from 'three';
import { FLOOR_Y, m } from './scale.js';

// What makes both tables the house's own, over and above wood, leather and
// cloth: gold ink on the felt over a faint woven lattice, and light — a
// glowing line round the foot of the pedestal and a soft pool of the same
// light on the floor under the table, in a colour each room chooses
// (rooms.js's tableGlow), so a table seems to float in its own glow.

/** The gold the felt's lettering and lines are printed in. */
export const GOLD_INK = 'rgba(230,198,126,0.92)';
export const GOLD_INK_SOFT = 'rgba(230,198,126,0.55)';

/** A faint diamond lattice woven into the cloth, `step` pixels apart. */
export function feltWeave(ctx, W, H, step) {
  ctx.save();
  ctx.strokeStyle = 'rgba(255,240,210,0.035)';
  ctx.lineWidth = Math.max(1, step * 0.04);
  for (let k = -H; k < W + H; k += step) {
    ctx.beginPath(); ctx.moveTo(k, 0); ctx.lineTo(k + H, H); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(k, H); ctx.lineTo(k + H, 0); ctx.stroke();
  }
  ctx.restore();
}

// A flat ring between two outlines (each a closed THREE.Shape), as a shape
// with a hole.
function ringShape(outer, inner) {
  const s = new THREE.Shape(outer.getPoints(64));
  s.holes.push(new THREE.Path(inner.getPoints(64).reverse()));
  return s;
}

let haloTex = null;
function haloTexture() {
  if (haloTex) return haloTex;
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(128, 128, 30, 128, 128, 128);
  g.addColorStop(0, 'rgba(255,255,255,0.85)');
  g.addColorStop(0.55, 'rgba(255,255,255,0.32)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 256);
  haloTex = new THREE.CanvasTexture(c);
  haloTex.colorSpace = THREE.SRGBColorSpace;
  return haloTex;
}

/**
 * The glow under a table: a line of light round the pedestal's foot —
 * between the outlines `footOuter` and `footInner`, laid flat (shape y
 * becoming world z) — and the pool of it on the floor, `w` by `d` round
 * (cx, cz). Adds them to `group` and gives it userData.setGlow(color).
 */
export function addTableGlow(group, { footOuter, footInner, w, d, cx = 0, cz = 0, edge = null }) {
  const glowMat = new THREE.MeshBasicMaterial({ color: 0xffc878, toneMapped: false });
  // A line of the same light along the underside of the table's edge,
  // where it shows from every chair.
  if (edge) {
    const line = new THREE.Mesh(new THREE.ExtrudeGeometry(ringShape(edge.outer, edge.inner), { depth: m(0.022), bevelEnabled: false, curveSegments: 48 }), glowMat);
    line.rotation.x = Math.PI / 2;
    line.position.y = edge.y;
    group.add(line);
  }
  const foot = new THREE.Mesh(new THREE.ExtrudeGeometry(ringShape(footOuter, footInner), { depth: m(0.03), bevelEnabled: false, curveSegments: 32 }), glowMat);
  foot.rotation.x = Math.PI / 2;
  foot.position.y = FLOOR_Y + m(0.03);
  group.add(foot);
  const poolMat = new THREE.MeshBasicMaterial({ map: haloTexture(), color: 0xffc878, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false });
  const pool = new THREE.Mesh(new THREE.PlaneGeometry(w, d), poolMat);
  pool.rotation.x = -Math.PI / 2;
  pool.position.set(cx, FLOOR_Y + 0.012, cz);
  pool.renderOrder = 1;
  group.add(pool);
  group.userData.setGlow = (color) => { glowMat.color.setHex(color); poolMat.color.setHex(color); };
}

/** Lacquer for a pedestal: black with a deep sheen. */
export const PEDESTAL_LACQUER = new THREE.MeshStandardMaterial({ color: 0x0d0c10, roughness: 0.22, metalness: 0.35 });
/** The gold of piping and inlay. */
export const GOLD = new THREE.MeshStandardMaterial({ color: 0xd4af62, roughness: 0.25, metalness: 0.9, emissive: 0x3a2a0c, emissiveIntensity: 0.4 });
