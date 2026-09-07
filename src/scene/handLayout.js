import * as THREE from 'three';

// Evenly fans `count` card slots around `anchor`, spread along the axis
// perpendicular to `facingAngle` (a seat's own left/right) — not a fixed
// world-space axis, so it lays out correctly for seats at any angle around
// the table. Grows outward from the anchor as more cards are added (hits),
// rather than needing a fixed number of pre-planned slots.
export function fanPositions(anchor, facingAngle, count, gap = 0.24) {
  const cos = Math.cos(facingAngle);
  const sin = Math.sin(facingAngle);
  const positions = [];
  for (let i = 0; i < count; i++) {
    const localX = (i - (count - 1) / 2) * gap;
    positions.push(new THREE.Vector3(anchor.x + localX * cos, anchor.y, anchor.z - localX * sin));
  }
  return positions;
}
