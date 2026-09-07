import { animate, easeOutCubic } from './animator.js';

// While a focus is active, scene.js skips controls.update() — OrbitControls
// recomputes camera.position from its own internal state every call, which
// would otherwise stomp on this manual move.
export const cameraOverride = { active: false };

// Dollies the camera toward `focusPoint` and holds it there — for the
// round-long "zoomed onto your hand" view, not just a brief pulse. Returns
// a `release()` function the caller invokes later (when the round ends) to
// ease back to the original wide view.
export function focusOn(camera, originalTarget, focusPoint, options = {}) {
  const { approach = 0.5, duration = 420 } = options;
  cameraOverride.active = true;

  const originalPos = camera.position.clone();
  const zoomedPos = originalPos.clone().lerp(focusPoint, approach);
  const lookAtScratch = originalTarget.clone();

  animate({
    duration,
    easing: easeOutCubic,
    onUpdate: (t) => {
      camera.position.lerpVectors(originalPos, zoomedPos, t);
      lookAtScratch.lerpVectors(originalTarget, focusPoint, t);
      camera.lookAt(lookAtScratch);
    },
  });

  let released = false;
  return function release(outDuration = duration) {
    if (released) return;
    released = true;
    animate({
      duration: outDuration,
      easing: easeOutCubic,
      onUpdate: (t) => {
        camera.position.lerpVectors(zoomedPos, originalPos, t);
        lookAtScratch.lerpVectors(focusPoint, originalTarget, t);
        camera.lookAt(lookAtScratch);
      },
      onComplete: () => {
        camera.position.copy(originalPos);
        camera.lookAt(originalTarget);
        cameraOverride.active = false;
      },
    });
  };
}
