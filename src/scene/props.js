import * as THREE from 'three';

// A thin painted ring marking where a seat's bet goes, like the etched
// betting circles on a real casino table felt.
export function createBetRing(radius = 0.4) {
  const geometry = new THREE.TorusGeometry(radius, 0.012, 8, 48);
  const material = new THREE.MeshStandardMaterial({
    color: 0xeac35e,
    emissive: 0xeac35e,
    emissiveIntensity: 0.25,
    roughness: 0.6,
    transparent: true,
    opacity: 0.55,
  });
  const ring = new THREE.Mesh(geometry, material);
  ring.rotation.x = -Math.PI / 2;
  return ring;
}

// A simple card-dispensing shoe sitting where the deck lives — reads as
// "casino" more than a bare stack of cards.
export function createCardShoe() {
  const group = new THREE.Group();

  const bodyMat = new THREE.MeshPhysicalMaterial({
    color: 0x1c1c1c,
    roughness: 0.25,
    metalness: 0.1,
    transmission: 0.35,
    transparent: true,
    opacity: 0.9,
  });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.22, 0.4), bodyMat);
  body.position.y = 0.11;
  body.castShadow = true;
  group.add(body);

  const trimMat = new THREE.MeshStandardMaterial({ color: 0xd4af52, roughness: 0.3, metalness: 0.7 });
  const trim = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.03, 0.42), trimMat);
  trim.position.y = 0.01;
  group.add(trim);

  group.rotation.x = -0.12;
  return group;
}

// The dealer's chip tray — a shallow wooden rack the placeholder chip
// stacks sit inside, instead of floating loose on the felt.
export function createChipTray(width = 1.4) {
  const group = new THREE.Group();

  const woodMat = new THREE.MeshStandardMaterial({ color: 0x2b140c, roughness: 0.6 });
  const base = new THREE.Mesh(new THREE.BoxGeometry(width, 0.05, 0.42), woodMat);
  base.position.y = 0.025;
  base.receiveShadow = true;
  base.castShadow = true;
  group.add(base);

  const trimMat = new THREE.MeshStandardMaterial({ color: 0xd4af52, roughness: 0.3, metalness: 0.7 });
  [-1, 1].forEach((side) => {
    const wall = new THREE.Mesh(new THREE.BoxGeometry(width, 0.06, 0.03), trimMat);
    wall.position.set(0, 0.06, side * 0.2);
    group.add(wall);
  });

  return group;
}
