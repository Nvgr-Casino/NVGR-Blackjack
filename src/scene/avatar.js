import * as THREE from 'three';
import { FLOOR_Y, SEAT_TOP_Y, m } from './scale.js';
import { BRASS, LEATHER } from './table.js';

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

  // A high-backed casino dining chair: a tall framed back panel standing
  // behind a padded seat, on four tapered legs, facing local +Z toward the
  // table.
  //
  // Two earlier attempts missed. Boxes in the carpet's own deep red
  // dissolved into the room; wrapping the back right around the cushion in
  // a cylinder turned it into a drum. What makes a chair read as a chair at
  // a glance is a back that is plainly a *back* — taller than it is wide,
  // flat, and clearly behind the sitter — with daylight under the seat.
  // The same matte leather and brushed brass the table's rail and trim
  // use, so chairs and table read as one set of furniture.
  const leatherMat = LEATHER;
  const goldMat = BRASS;
  // The frame is dark walnut; brass is kept to the legs, so it accents the
  // chair instead of outlining it.
  const frameMat = new THREE.MeshStandardMaterial({ color: 0x2a1a11, roughness: 0.55, metalness: 0 });

  const seatY = SEAT_TOP_Y;
  const seatW = m(0.46);
  const seatD = m(0.44);
  const backW = seatW * 0.92;
  const backH = m(0.62);
  const backLean = -0.1;
  const backZ = -seatD / 2 + m(0.03);

  // Padded seat.
  const seat = new THREE.Mesh(
    new THREE.BoxGeometry(seatW, m(0.09), seatD), leatherMat
  );
  seat.position.set(0, seatY - m(0.045), 0);
  seat.castShadow = true;
  seat.receiveShadow = true;
  group.add(seat);

  // Walnut edging along the seat's front lip.
  const lip = new THREE.Mesh(
    new THREE.BoxGeometry(seatW + m(0.015), m(0.02), m(0.02)), frameMat
  );
  lip.position.set(0, seatY - m(0.085), seatD / 2);
  group.add(lip);

  // The back: a padded panel inside a walnut frame, leaning back slightly.
  const backGroup = new THREE.Group();
  backGroup.position.set(0, seatY + backH / 2 + m(0.03), backZ);
  backGroup.rotation.x = backLean;
  group.add(backGroup);

  const panel = new THREE.Mesh(
    new THREE.BoxGeometry(backW, backH, m(0.06)), leatherMat
  );
  panel.castShadow = true;
  backGroup.add(panel);

  // Uprights either side and a cap rail across the top — the frame is what
  // stops the panel reading as a floating slab.
  [-1, 1].forEach((side) => {
    const post = new THREE.Mesh(
      new THREE.BoxGeometry(m(0.028), backH + m(0.06), m(0.055)), frameMat
    );
    post.position.set(side * (backW / 2 + m(0.012)), 0, 0);
    post.castShadow = true;
    backGroup.add(post);
  });

  const cap = new THREE.Mesh(
    new THREE.BoxGeometry(backW + m(0.075), m(0.035), m(0.07)), frameMat
  );
  cap.position.set(0, backH / 2 + m(0.03), 0);
  backGroup.add(cap);

  // Four tapered legs, splayed just enough to look designed.
  const legH = seatY - FLOOR_Y - m(0.09);
  [[1, 1], [1, -1], [-1, 1], [-1, -1]].forEach(([sx, sz]) => {
    const leg = new THREE.Mesh(
      new THREE.CylinderGeometry(m(0.018), m(0.012), legH, 10), goldMat
    );
    leg.position.set(sx * seatW * 0.4, FLOOR_Y + legH / 2, sz * seatD * 0.38);
    leg.rotation.z = -sx * 0.08;
    leg.rotation.x = sz * 0.08;
    leg.castShadow = true;
    group.add(leg);
  });

  return group;
}


