import * as THREE from 'three';
import { canvasTex } from './casinoKit.js';

// Seat chips, as roulette and baccarat are played: each seat bets in a
// colour of its own, so whose chips are whose is plain on the felt. A
// stack is drawn as one cylinder, its edge striped once per chip.

// Colours that stand out on the felt and on the red and black numbers.
export const SEAT_CHIP_COLORS = ['#f2c230', '#2e8cff', '#f4f1ea', '#a65ce8', '#ff8a1c', '#22c7b8', '#ef4f8f'];
export const CHIP_R = 0.085;
export const CHIP_H = 0.022;

const mats = new Map();
function chipMaterials(seatIndex, count) {
  const key = seatIndex + ':' + count;
  if (mats.has(key)) return mats.get(key);
  const color = SEAT_CHIP_COLORS[seatIndex % SEAT_CHIP_COLORS.length];
  // The white seat's chips are striped dark, the rest white.
  const stripe = color === '#f4f1ea' ? '#1a1a1a' : '#ffffff';
  const side = canvasTex(128, 16, (ctx, w, h) => {
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = stripe;
    for (let i = 0; i < 6; i++) ctx.fillRect((i / 6) * w, 0, (w / 6) * 0.32, h);
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fillRect(0, h - 2, w, 2);
  });
  side.wrapS = side.wrapT = THREE.RepeatWrapping;
  side.repeat.set(1, count);
  const top = canvasTex(128, 128, (ctx, w) => {
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, w, w);
    ctx.strokeStyle = stripe;
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.arc(w / 2, w / 2, w * 0.3, 0, Math.PI * 2);
    ctx.stroke();
    for (let i = 0; i < 8; i++) {
      ctx.save();
      ctx.translate(w / 2, w / 2);
      ctx.rotate((i / 8) * Math.PI * 2);
      ctx.fillStyle = stripe;
      ctx.fillRect(-6, -w / 2, 12, 16);
      ctx.restore();
    }
    ctx.fillStyle = stripe;
    ctx.font = "700 22px 'Cinzel', Georgia, serif";
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('NVGR', w / 2, w / 2 + 1);
  });
  const set = [new THREE.MeshStandardMaterial({ map: side, roughness: 0.45 }), new THREE.MeshStandardMaterial({ map: top, roughness: 0.4 }), new THREE.MeshStandardMaterial({ map: top, roughness: 0.4 })];
  mats.set(key, set);
  return set;
}

/** A stack of `count` of a seat's chips, standing centred on its origin. */
export function seatStack(seatIndex, count) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(CHIP_R, CHIP_R, CHIP_H * count, 28), chipMaterials(seatIndex, count));
  mesh.castShadow = true;
  mesh.userData.count = count;
  return mesh;
}
