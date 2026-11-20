// Liftoff on the lobby floor: the Space Shuttle Discovery as a museum
// piece — the same scan the game flies, stood nose-up on a slim brass
// mount above a black lacquer plinth ringed in gold, turning slowly. The
// model loads only when the display is first shown.

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { FLOOR_Y, m } from './scale.js';

export function createLiftoffDisplay() {
  const group = new THREE.Group();
  const lacquer = new THREE.MeshStandardMaterial({ color: 0x0c0c0e, roughness: 0.18, metalness: 0.2 });
  const gold = new THREE.MeshStandardMaterial({ color: 0xc9a25a, roughness: 0.28, metalness: 1 });
  const glass = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.05, metalness: 0, transmission: 0.9, transparent: true, opacity: 0.18, thickness: 0.02 });

  const PLINTH_H = m(0.82);
  const base = new THREE.Mesh(new THREE.CylinderGeometry(m(0.62), m(0.68), PLINTH_H, 64), lacquer);
  base.position.y = FLOOR_Y + PLINTH_H / 2;
  base.castShadow = base.receiveShadow = true;
  group.add(base);
  [0.02, PLINTH_H - 0.012].forEach((y, i) => {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(i ? m(0.625) : m(0.68), m(0.012), 12, 96), gold);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = FLOOR_Y + y;
    group.add(ring);
  });
  const top = new THREE.Mesh(new THREE.CylinderGeometry(m(0.6), m(0.6), m(0.02), 64), lacquer);
  top.position.y = FLOOR_Y + PLINTH_H + m(0.01);
  group.add(top);
  // A glass case over it, barely there.
  const CASE_H = m(1.7);
  const dome = new THREE.Mesh(new THREE.CylinderGeometry(m(0.56), m(0.56), CASE_H, 64, 1, true), glass);
  dome.position.y = FLOOR_Y + PLINTH_H + CASE_H / 2;
  group.add(dome);
  const lid = new THREE.Mesh(new THREE.TorusGeometry(m(0.56), m(0.008), 8, 96), gold);
  lid.rotation.x = Math.PI / 2;
  lid.position.y = FLOOR_Y + PLINTH_H + CASE_H;
  group.add(lid);
  // The mount.
  const mount = new THREE.Mesh(new THREE.CylinderGeometry(m(0.012), m(0.02), m(0.36), 16), gold);
  mount.position.y = FLOOR_Y + PLINTH_H + m(0.18);
  group.add(mount);

  const craft = new THREE.Group();
  craft.position.y = FLOOR_Y + PLINTH_H + m(0.36);
  group.add(craft);
  let loaded = false;
  function load() {
    if (loaded) return;
    loaded = true;
    const loader = new GLTFLoader();
    loader.setMeshoptDecoder(MeshoptDecoder);
    loader.load(`${import.meta.env.BASE_URL}models/crash/shuttle.glb`, (g) => {
      const model = g.scene;
      model.traverse((o) => { if (o.isMesh) { o.castShadow = true; } });
      const inner = new THREE.Group();
      inner.add(model);
      inner.rotation.x = -Math.PI / 2;        // nose up
      const box = new THREE.Box3().setFromObject(inner);
      const size = box.getSize(new THREE.Vector3());
      const s = m(1.15) / size.y;
      inner.scale.setScalar(s);
      const b2 = new THREE.Box3().setFromObject(inner);
      inner.position.x -= (b2.min.x + b2.max.x) / 2;
      inner.position.z -= (b2.min.z + b2.max.z) / 2;
      inner.position.y -= b2.min.y;
      craft.add(inner);
    }, undefined, () => { loaded = false; });
  }
  // Larger than life beside the tables, so it holds its place on the floor.
  group.scale.setScalar(1.35);
  group.userData.update = (dt) => { craft.rotation.y += dt * 0.25; };
  group.userData.load = load;
  return group;
}
