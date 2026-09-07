import * as THREE from 'three';

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

  const floorY = -0.91;
  const seatH = 0.4; // seat cushion's top surface, above the floor
  const seatY = floorY + seatH;

  const seat = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.16, 0.54), cushionMat);
  seat.position.set(0, seatY, 0);
  seat.castShadow = true;
  seat.receiveShadow = true;
  group.add(seat);

  // Reclined backrest, tall enough to read as a lounge chair, not a stool.
  const back = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.56, 0.14), cushionMat);
  back.position.set(0, seatY + 0.34, -0.22);
  back.rotation.x = -0.16;
  back.castShadow = true;
  group.add(back);

  // Padded armrests on both sides.
  [-1, 1].forEach((side) => {
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.24, 0.5), cushionMat);
    arm.position.set(side * 0.34, seatY + 0.13, -0.02);
    arm.castShadow = true;
    group.add(arm);
  });

  // Thin gold trim along the seat's front edge, matching the table's rim.
  const trim = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.02, 0.02), goldMat);
  trim.position.set(0, seatY - 0.07, 0.28);
  group.add(trim);

  const legOffsets = [
    [0.26, 0.2], [-0.26, 0.2], [0.26, -0.2], [-0.26, -0.2],
  ];
  legOffsets.forEach(([x, z]) => {
    const legHeight = seatH - 0.14;
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.02, legHeight, 8), woodMat);
    leg.position.set(x, floorY + legHeight / 2, z);
    leg.castShadow = true;
    group.add(leg);
  });

  return group;
}
