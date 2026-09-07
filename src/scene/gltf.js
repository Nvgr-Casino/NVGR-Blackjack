import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';

// One loader for every model in the scene.
//
// The models ship meshopt-compressed with WebP textures (see `npm run
// models`), which is what lets the whole cast — nine rigged figures —
// weigh 4.7MB instead of 17MB. That compression is not optional at
// runtime: without the decoder registered here the files do not parse at
// all, so every model load goes through this module rather than each
// caller building its own GLTFLoader and forgetting.
const loader = new GLTFLoader();
loader.setMeshoptDecoder(MeshoptDecoder);

// Models are shared between every seat that picked the same character, so
// a file is fetched and parsed once however many chairs are wearing it.
// Callers clone what they need (see SkeletonUtils.clone — a skinned mesh
// cannot be cloned with .clone(), the copies would share one skeleton).
const inFlight = new Map();

export function loadGltf(url) {
  if (!inFlight.has(url)) {
    inFlight.set(url, new Promise((resolve, reject) => {
      loader.load(url, resolve, undefined, reject);
    }));
  }
  return inFlight.get(url);
}
