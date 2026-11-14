import * as THREE from 'three';
import { cameraOverride } from '../scene/cameraFocus.js';
import { animate, easeInOutCubic } from '../scene/animator.js';
import { m } from '../scene/scale.js';

// The slot salon's 3D driver: the seat before your machine and the view
// from it, your machine's reels and lights, and its buttons and handle
// answering a tap. src/app/slotsBridge.js plays the game and calls these.

export function createSlotsDriver({ scene, camera, controls, renderer, set, salon }) {
  // Your machine, whichever game it is now (it changes when you switch).
  const api = () => salon.userData.machine.userData;

  // The salon moves every frame while it is out: your machine and the
  // neighbours playing on their own.
  const prior = scene.onBeforeRender;
  scene.onBeforeRender = (...args) => {
    if (set.visible) salon.userData.update(performance.now());
    if (prior) prior.apply(scene, args);
  };

  // ---------- the view ----------
  // Framed to fit: from the button deck to the jackpot on the topper,
  // above the dock at the bottom of the screen, at any shape of screen.
  let seated = false;
  function framing() {
    const aspect = camera.aspect;
    const tall = aspect < 1;
    // The box to show, in the machine's own metres.
    const y0 = tall ? 0.86 : 0.74, y1 = tall ? 1.84 : 1.86;
    const halfW = tall ? 0.39 : 0.6;
    // How much of the screen's height the dock covers.
    const dock = tall ? 0.3 : 0.17;
    const vfov = (camera.fov * Math.PI) / 180;
    const hfov = 2 * Math.atan(Math.tan(vfov / 2) * aspect);
    const halfH = (y1 - y0) / 2 / (1 - dock);
    const dist = Math.max(halfH / Math.tan(vfov / 2), halfW / Math.tan(hfov / 2));
    // The box at the top of the view, the dock's share below it.
    const centreY = y1 - halfH;
    const front = 0.6;
    return {
      position: salon.userData.onMachine(0, centreY + 0.02, front + dist),
      look: salon.userData.onMachine(0, centreY, front),
    };
  }
  let flight = 0;
  function fly(animated) {
    const { position, look } = framing();
    const my = ++flight;
    cameraOverride.active = true;
    if (!animated) {
      camera.position.copy(position);
      camera.lookAt(look);
      controls.target.copy(look);
      return;
    }
    const from = camera.position.clone();
    const fromLook = controls.target.clone();
    animate({
      duration: 900,
      easing: easeInOutCubic,
      onUpdate: (t) => {
        if (my !== flight) return;
        camera.position.lerpVectors(from, position, t);
        const l = fromLook.clone().lerp(look, t);
        camera.lookAt(l);
        controls.target.copy(l);
      },
    });
  }
  function onResize() { if (seated) { camera.clearViewOffset(); camera.updateProjectionMatrix(); fly(false); } }
  window.addEventListener('resize', () => setTimeout(onResize, 0));

  function sit() {
    if (seated) return;
    seated = true;
    salon.userData.myChair.visible = false;
    controls.enabled = false;
    // The scene shifts a tall screen's picture up a little for the tables;
    // the machine is framed for itself.
    camera.clearViewOffset();
    camera.updateProjectionMatrix();
    fly(false);
  }
  function stand() {
    if (!seated) return;
    seated = false;
    ++flight;
    salon.userData.myChair.visible = true;
    controls.enabled = true;
    cameraOverride.active = false;
    // Back to the scene's own framing for the tables.
    window.dispatchEvent(new Event('resize'));
  }

  // ---------- a tap on the machine ----------
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  let onButton = null;
  renderer.domElement.addEventListener('pointerdown', (e) => {
    if (!seated || !set.visible || !onButton) return;
    const r = renderer.domElement.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const hit = ray.intersectObjects(api().buttons, false)[0];
    if (hit && hit.distance < m(3)) onButton(hit.object.userData.button);
  });

  return {
    sit, stand,
    get seated() { return seated; },
    setOnButton(fn) { onButton = fn; },
    /** Puts the game `id` in front of you. */
    setGame: (id) => salon.userData.setGame(id),
    currentGame: () => salon.userData.machine.userData.game.id,
    spinTo: (stops, opts) => api().spinTo(stops, opts),
    rest: (stops) => api().rest(stops),
    showWins: (wins, scatter) => api().showWins(wins, scatter),
    setMeters: (v) => api().setMeters(v),
    setBet: (b) => api().setBet(b),
    pullHandle: () => api().pullHandle(),
    pressButton: (id) => api().pressButton(id),
    get spinning() { return api().spinning; },
  };
}
