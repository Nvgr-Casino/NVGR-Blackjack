// The casino's own people, for the front page: a dealer from the game,
// loaded exactly as the tables load them (the same files, rig fitting and
// materials, src/scene), standing with the game's motion-captured idle.
// Scaled to `height` in the caller's units with the feet on y = 0 and the
// hips over the origin, facing +z.
import * as THREE from 'three';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { loadGltf } from '../scene/gltf.js';
import { resolveRig, withoutRootMotion, prepareFigureMaterials, fitClipToRig } from '../scene/rig.js';

const url = (file) => `${import.meta.env.BASE_URL}models/characters/${file}`;

// The game's dealers (src/scene/dealer.js DEALER_MODELS) and their idles.
export const DEALERS = {
  m1: { file: 'rb_dealer_m.glb', clip: 'rb_idle_m.glb' },
  f2: { file: 'rb_dealer_f2.glb', clip: 'rb_idle_f.glb' },
  m3: { file: 'rb_dealer_m3.glb', clip: 'rb_idle_m.glb' },
  f3: { file: 'rb_dealer_f3.glb', clip: 'rb_idle_f.glb' },
  m4: { file: 'rb_dealer_m4.glb', clip: 'rb_idle_m.glb' },
  f4: { file: 'rb_dealer_f4.glb', clip: 'rb_idle_f.glb' },
  m5: { file: 'rb_dealer_m5.glb', clip: 'rb_idle_m.glb' },
  f5: { file: 'rb_dealer_f5.glb', clip: 'rb_idle_f.glb' },
};

export async function loadFigure(key, height) {
  const spec = DEALERS[key];
  const [gltf, clipGltf] = await Promise.all([loadGltf(url(spec.file)), loadGltf(url(spec.clip))]);
  const model = cloneSkinned(gltf.scene);
  const bones = resolveRig(model);
  model.updateMatrixWorld(true);
  // In its bind pose the figure stands upright, so its box is its height.
  const size = new THREE.Box3().setFromObject(model).getSize(new THREE.Vector3());
  if (size.y > 0) model.scale.setScalar(height / size.y);
  model.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(model);
  model.position.y -= box.min.y;
  if (bones.hips) {
    model.updateMatrixWorld(true);
    const hip = bones.hips.getWorldPosition(new THREE.Vector3());
    model.position.x -= hip.x;
    model.position.z -= hip.z;
  }
  prepareFigureMaterials(model, { hero: true });
  model.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false; } });
  const mixer = new THREE.AnimationMixer(model);
  const idle = clipGltf.animations[0];
  if (idle) {
    const action = mixer.clipAction(withoutRootMotion(fitClipToRig(idle, clipGltf.scene, model), bones.hips));
    action.play();
    // Each starts somewhere different in the loop, so none moves in step.
    action.time = Math.random() * idle.duration;
  }
  const group = new THREE.Group();
  group.add(model);
  return { group, mixer, bones };
}
