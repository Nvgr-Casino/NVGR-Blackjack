import * as THREE from 'three';
import { FLOOR_Y, SEAT_TOP_Y, m } from './scale.js';

// A flat circular "player card" — portrait circle + name + chip count —
// matching how the reference casino game shows other players, instead of
// a 3D body. It's a Sprite, so it always faces the camera regardless of
// table angle. Real name/chip data comes in step 4; placeholders for now.
export function createPlayerPortrait({ name = 'Guest', chips = 12500, accentColor = '#5c2a2a' } = {}) {
  const canvas = document.createElement('canvas');
  canvas.width = 300;
  canvas.height = 200;
  const ctx = canvas.getContext('2d');

  const cx = 150, cy = 70, r = 62;

  // Soft drop shadow behind the portrait disc.
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.6)';
  ctx.shadowBlur = 18;
  ctx.fillStyle = accentColor;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Gold ring border.
  ctx.strokeStyle = '#eac35e';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.arc(cx, cy, r - 2, 0, Math.PI * 2);
  ctx.stroke();

  // Initials.
  const initials = name.trim().split(/\s+/).slice(0, 2).map((w) => w[0].toUpperCase()).join('');
  ctx.fillStyle = '#f6ecd9';
  ctx.font = '700 52px Georgia, serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(initials, cx, cy + 4);

  // Name plate.
  ctx.font = '700 26px Georgia, serif';
  ctx.fillStyle = '#f6ecd9';
  ctx.shadowColor = 'rgba(0,0,0,0.8)';
  ctx.shadowBlur = 6;
  ctx.fillText(name, cx, cy + r + 30);

  // Chip count with a small chip glyph.
  ctx.shadowBlur = 0;
  ctx.font = '600 22px Georgia, serif';
  ctx.fillStyle = '#eac35e';
  const chipText = chips.toLocaleString();
  ctx.fillText(chipText, cx + 10, cy + r + 60);
  ctx.beginPath();
  ctx.arc(cx - 10 - ctx.measureText(chipText).width / 2 - 14, cy + r + 60, 9, 0, Math.PI * 2);
  ctx.fillStyle = '#eac35e';
  ctx.fill();
  ctx.strokeStyle = '#8a1017';
  ctx.lineWidth = 2;
  ctx.stroke();

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;

  const material = new THREE.SpriteMaterial({ map: texture, transparent: true });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(0.9, 0.6, 1);
  return sprite;
}

// A small upholstered lounge chair (armrests + a reclined back), matching
// a plush casino lounge rather than a bare barstool. Faces local +Z — the
// direction seats.js's facingAngle points toward the table.
export function createChair() {
  const group = new THREE.Group();

  const woodMat = new THREE.MeshLambertMaterial({ color: 0x2b140c });
  const goldMat = new THREE.MeshStandardMaterial({ color: 0xd4af52, roughness: 0.3, metalness: 0.7 });
  const cushionMat = new THREE.MeshLambertMaterial({ color: 0x6e1420 });

  // Derived from the shared scale so the cushion always meets the floor
  // and the figures sitting on it (see scale.js).
  const floorY = FLOOR_Y;
  const seatY = SEAT_TOP_Y;

  // Every dimension is a real measurement through the shared scale, so the
  // chair grows with the room instead of staying doll-sized when the world
  // changes size around it.
  const seat = new THREE.Mesh(new THREE.BoxGeometry(m(0.52), m(0.07), m(0.48)), cushionMat);
  seat.position.set(0, seatY, 0);
  seat.castShadow = true;
  seat.receiveShadow = true;
  group.add(seat);

  // Reclined backrest, tall enough to read as a lounge chair, not a stool.
  const back = new THREE.Mesh(new THREE.BoxGeometry(m(0.52), m(0.5), m(0.1)), cushionMat);
  back.position.set(0, seatY + m(0.3), -m(0.2));
  back.rotation.x = -0.16;
  back.castShadow = true;
  group.add(back);

  // Padded armrests on both sides.
  [-1, 1].forEach((side) => {
    const arm = new THREE.Mesh(new THREE.BoxGeometry(m(0.08), m(0.2), m(0.44)), cushionMat);
    arm.position.set(side * m(0.3), seatY + m(0.11), -m(0.02));
    arm.castShadow = true;
    group.add(arm);
  });

  // Thin gold trim along the seat's front edge, matching the table's rim.
  const trim = new THREE.Mesh(new THREE.BoxGeometry(m(0.54), m(0.018), m(0.018)), goldMat);
  trim.position.set(0, seatY - m(0.06), m(0.25));
  group.add(trim);

  const legOffsets = [
    [m(0.23), m(0.18)], [-m(0.23), m(0.18)], [m(0.23), -m(0.18)], [-m(0.23), -m(0.18)],
  ];
  legOffsets.forEach(([x, z]) => {
    const legHeight = seatY - floorY - m(0.05);
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(m(0.022), m(0.018), legHeight, 8), woodMat);
    leg.position.set(x, floorY + legHeight / 2, z);
    leg.castShadow = true;
    group.add(leg);
  });

  return group;
}
