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

  // A barrel chair: a curved padded back wrapping a round cushion, on
  // splayed gold legs. The old one was three boxes in the same deep red as
  // the carpet and the walls, so five pieces of furniture simply dissolved
  // into the room. Black leather against burgundy is the strongest contrast
  // the house livery allows, and the curve is what makes it read as a
  // designed chair rather than a crate.
  const leatherMat = new THREE.MeshStandardMaterial({
    color: 0x16161a, roughness: 0.42, metalness: 0.12,
  });
  const goldMat = new THREE.MeshStandardMaterial({
    color: 0xe8c266, roughness: 0.2, metalness: 0.9,
  });

  const seatY = SEAT_TOP_Y;
  const seatR = m(0.27);

  // Round cushion, slightly tapered like a real upholstered pad.
  const seat = new THREE.Mesh(
    new THREE.CylinderGeometry(seatR, seatR * 0.92, m(0.11), 28),
    leatherMat
  );
  seat.position.set(0, seatY - m(0.055), 0);
  seat.castShadow = true;
  seat.receiveShadow = true;
  group.add(seat);

  // Gold piping around the cushion's edge.
  const piping = new THREE.Mesh(
    new THREE.TorusGeometry(seatR, m(0.012), 8, 32),
    goldMat
  );
  piping.rotation.x = Math.PI / 2;
  piping.position.set(0, seatY - m(0.11), 0);
  group.add(piping);

  // The wrap-around back: an open cylinder arc behind and around the sides,
  // leaning back a little. thetaStart puts the opening toward the table.
  const BACK_SWEEP = Math.PI * 1.08;
  const back = new THREE.Mesh(
    new THREE.CylinderGeometry(seatR * 1.04, seatR * 1.04, m(0.46), 28, 1, true,
      Math.PI / 2 - BACK_SWEEP / 2, BACK_SWEEP),
    leatherMat
  );
  back.position.set(0, seatY + m(0.2), -m(0.03));
  back.rotation.x = -0.07;
  back.material.side = THREE.DoubleSide;
  back.castShadow = true;
  group.add(back);

  // Gold rail capping the back's top edge, following the same arc.
  const rail = new THREE.Mesh(
    new THREE.TorusGeometry(seatR * 1.04, m(0.016), 8, 32, BACK_SWEEP),
    goldMat
  );
  rail.rotation.x = Math.PI / 2;
  rail.rotation.z = Math.PI / 2 - BACK_SWEEP / 2;
  rail.position.set(0, seatY + m(0.43), -m(0.03));
  group.add(rail);

  // Four splayed gold legs.
  const legH = seatY - FLOOR_Y - m(0.11);
  [[1, 1], [1, -1], [-1, 1], [-1, -1]].forEach(([sx, sz]) => {
    const leg = new THREE.Mesh(
      new THREE.CylinderGeometry(m(0.016), m(0.011), legH, 10),
      goldMat
    );
    leg.position.set(sx * seatR * 0.62, FLOOR_Y + legH / 2, sz * seatR * 0.62);
    leg.rotation.z = -sx * 0.1;
    leg.rotation.x = sz * 0.1;
    leg.castShadow = true;
    group.add(leg);
  });

  return group;
}

