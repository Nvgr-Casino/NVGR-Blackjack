import * as THREE from 'three';
import { createSlotMachine, CAB_W, SEAT_Z, REEL_CENTER } from './slotMachine.js';
import { place } from './furniture.js';
import { createCharacter } from './character.js';
import { m, FLOOR_Y } from './scale.js';
import { drawStops, evaluate } from '../slots/rules.js';

// The high-limit slot salon: a gently curved bank of Crown Jewels machines,
// yours in the middle, a chair before each, guests at a couple of them,
// lacquered end pillars, and the salon's name in gold above the toppers.
// The neighbours play on their own now and then, as at a real bank.
//
// The set stands with your machine's front just behind the origin, facing
// +z, so it sits in the lobby's carousel like any table.

const PHONE = window.matchMedia('(pointer: coarse)').matches || window.innerWidth < 820;
const COUNT = PHONE ? 3 : 5;
const MINE = Math.floor(COUNT / 2);
// The arc the bank stands on, concave toward the player.
const ARC = m(5.2);
const SPACING = m(CAB_W + 0.03) / ARC;   // radians between machines
const BACK = -m(0.15);                   // your machine's back, from the origin
const GUESTS = PHONE ? [[0, 'rb_bf01']] : [[0, 'rb_bf02'], [3, 'rb_bm02']];

// Where machine i stands and which way it faces.
function slot(i) {
  const a = (i - MINE) * SPACING;
  return {
    angle: a,
    position: new THREE.Vector3(Math.sin(a) * ARC, FLOOR_Y, BACK + ARC - Math.cos(a) * ARC),
  };
}

function signTexture() {
  const W = 2048, H = 192;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d');
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#0d0b0b'); bg.addColorStop(1, '#050404');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
  const gold = (x0, y0, x1, y1) => {
    const g = ctx.createLinearGradient(x0, y0, x1, y1);
    g.addColorStop(0, '#fff0c4'); g.addColorStop(0.25, '#e4c07a'); g.addColorStop(0.5, '#a97e32'); g.addColorStop(0.75, '#e2bd6e'); g.addColorStop(1, '#8a6224');
    return g;
  };
  ctx.fillStyle = gold(0, 0, 0, H);
  ctx.fillRect(0, 8, W, 5); ctx.fillRect(0, H - 13, W, 5);
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = '700 84px Cinzel, Georgia, serif';
  if ('letterSpacing' in ctx) ctx.letterSpacing = '30px';
  ctx.shadowColor = 'rgba(255,170,60,0.6)'; ctx.shadowBlur = 22;
  ctx.fillStyle = gold(0, 50, 0, 140);
  ctx.fillText('HIGH LIMIT SALON', W / 2 + 15, H / 2 + 4);
  ctx.shadowBlur = 0;
  // Rubies either side of the name.
  [W / 2 - 640, W / 2 + 640].forEach((x) => {
    ctx.fillStyle = '#c4203a';
    ctx.beginPath(); ctx.moveTo(x, H / 2 - 16); ctx.lineTo(x + 12, H / 2); ctx.lineTo(x, H / 2 + 16); ctx.lineTo(x - 12, H / 2); ctx.closePath(); ctx.fill();
  });
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  // Seen from inside the curve: mirrored back the right way round.
  t.wrapS = THREE.RepeatWrapping;
  t.repeat.x = -1;
  t.offset.x = 1;
  return t;
}

export function createSlotSalon() {
  const group = new THREE.Group();
  const machines = [];
  const chairs = [];
  for (let i = 0; i < COUNT; i++) {
    const { angle, position } = slot(i);
    const mach = createSlotMachine({ full: i === MINE });
    mach.position.copy(position);
    mach.rotation.y = -angle;
    group.add(mach);
    machines.push(mach);
    // The chair before it, facing the machine.
    // The machine's face looks along (−sin a, 0, cos a).
    const at = position.clone().addScaledVector(new THREE.Vector3(-Math.sin(angle), 0, Math.cos(angle)), m(SEAT_Z));
    const chair = place(group, 'dining_chair_02', { x: at.x, z: at.z, yaw: Math.PI - angle, shadows: true });
    chairs.push({ chair, at, yaw: Math.PI - angle });
  }
  // End pillars: lacquer with a gold inlay and a line of light.
  const lacquer = new THREE.MeshStandardMaterial({ color: 0x0c0b0e, roughness: 0.25, metalness: 0.2 });
  const gold = new THREE.MeshStandardMaterial({ color: 0xd9b26a, roughness: 0.22, metalness: 1, envMapIntensity: 1.6 });
  const glow = new THREE.MeshBasicMaterial({ color: 0xffcf7a, toneMapped: false });
  [-1, 1].forEach((side) => {
    const a = (side * (COUNT / 2) + side * 0.12) * SPACING;
    const p = new THREE.Vector3(Math.sin(a) * ARC, FLOOR_Y, BACK + ARC - Math.cos(a) * ARC);
    const pillar = new THREE.Group();
    pillar.position.copy(p);
    pillar.rotation.y = -a;
    const body = new THREE.Mesh(new THREE.BoxGeometry(m(0.12), m(2.3), m(0.8)), lacquer);
    body.position.set(0, m(1.15), m(0.38));
    pillar.add(body);
    const inlay = new THREE.Mesh(new THREE.BoxGeometry(m(0.124), m(2.0), m(0.012)), gold);
    inlay.position.set(0, m(1.15), m(0.785));
    pillar.add(inlay);
    const line = new THREE.Mesh(new THREE.BoxGeometry(m(0.01), m(1.9), m(0.01)), glow);
    line.position.set(0, m(1.15), m(0.792));
    pillar.add(line);
    const cap = new THREE.Mesh(new THREE.BoxGeometry(m(0.16), m(0.04), m(0.84)), gold);
    cap.position.set(0, m(2.32), m(0.38));
    pillar.add(cap);
    group.add(pillar);
  });
  // The salon's name on a curved fascia above the toppers.
  const span = (COUNT + 0.5) * SPACING;
  const signR = ARC - m(0.42);
  const sign = new THREE.Mesh(
    new THREE.CylinderGeometry(signR, signR, m(0.24), 48, 1, true, Math.PI - span / 2, span),
    new THREE.MeshBasicMaterial({ map: signTexture(), side: THREE.BackSide, toneMapped: false }),
  );
  sign.position.set(0, FLOOR_Y + m(2.42), BACK + ARC);
  group.add(sign);

  // Guests at a couple of the other machines.
  const guests = [];
  GUESTS.forEach(([i, id]) => {
    if (i === MINE || i >= COUNT) return;
    const fig = createCharacter(id);
    fig.position.copy(chairs[i].at);
    fig.rotation.y = chairs[i].yaw;
    group.add(fig);
    guests.push(fig);
  });

  // The neighbours play on their own: a spin every so often.
  const nextSpin = machines.map((_, i) => (i === MINE ? Infinity : performance.now() + 2500 + Math.random() * 7000));
  function update(now) {
    machines.forEach((mach, i) => {
      mach.userData.update(now);
      if (i !== MINE && now >= nextSpin[i] && !mach.userData.spinning) {
        const stops = drawStops((n) => Math.floor(Math.random() * n));
        const result = evaluate(stops, 100);
        mach.userData.spinTo(stops, { onDone: () => { if (result.total) mach.userData.showWins(result.wins, result.scatter); } });
        nextSpin[i] = now + 6000 + Math.random() * 9000;
      }
    });
  }

  // Your seat: the chair before your machine, and the view from it.
  const mine = machines[MINE];
  const myChair = chairs[MINE].chair;
  const reelWorld = new THREE.Vector3(REEL_CENTER.x, REEL_CENTER.y, REEL_CENTER.z);
  group.userData = {
    update,
    machine: mine,
    machines,
    myChair,
    /** A point on your machine, from its own metres, in the set's frame. */
    onMachine: (x, y, z) => new THREE.Vector3(m(x), m(y), m(z)).applyAxisAngle(new THREE.Vector3(0, 1, 0), mine.rotation.y).add(mine.position),
    reelCenter: () => reelWorld.clone().multiplyScalar(m(1)).add(mine.position),
  };
  return group;
}
