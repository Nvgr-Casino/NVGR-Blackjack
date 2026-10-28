import * as THREE from 'three';
import { BRASS } from './table.js';

// A betting circle printed on the felt, in the same cream ink as the
// felt's own markings. It used to be a glowing gold torus standing proud of
// the cloth; a real one is ink, flat and matte.
export function createBetRing(radius = 0.4) {
  const geometry = new THREE.RingGeometry(radius - 0.012, radius, 64);
  const material = new THREE.MeshLambertMaterial({
    color: 0xe8dcc0,
    transparent: true,
    opacity: 0.5,
    depthWrite: false,
  });
  const ring = new THREE.Mesh(geometry, material);
  ring.rotation.x = -Math.PI / 2;
  return ring;
}

// The card shoe the deck sits in: a smoked, satin-black box on a brass
// foot.
export function createCardShoe() {
  const group = new THREE.Group();

  // Plain opacity, not transmission: any transmissive material makes
  // three.js render the whole scene a second time to refract it.
  const bodyMat = new THREE.MeshStandardMaterial({
    color: 0x161414,
    roughness: 0.45,
    metalness: 0,
    transparent: true,
    opacity: 0.9,
  });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.22, 0.4), bodyMat);
  body.position.y = 0.11;
  body.castShadow = true;
  group.add(body);

  const foot = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.025, 0.42), BRASS);
  foot.position.y = 0.0125;
  group.add(foot);

  group.rotation.x = -0.12;
  return group;
}

// The dealer's chip tray: a shallow walnut rack the chip stacks sit in.
export function createChipTray(width = 1.4) {
  const group = new THREE.Group();

  const woodMat = new THREE.MeshStandardMaterial({ color: 0x2a1a11, roughness: 0.6, metalness: 0 });
  const base = new THREE.Mesh(new THREE.BoxGeometry(width, 0.05, 0.42), woodMat);
  base.position.y = 0.025;
  base.receiveShadow = true;
  base.castShadow = true;
  group.add(base);

  [-1, 1].forEach((side) => {
    const wall = new THREE.Mesh(new THREE.BoxGeometry(width, 0.05, 0.025), woodMat);
    wall.position.set(0, 0.06, side * 0.2);
    group.add(wall);
  });

  return group;
}
