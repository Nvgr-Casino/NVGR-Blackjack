// Minimal tween scheduler — avoids pulling in a full animation library for
// what's currently just position/rotation/fov lerps.
const active = [];

export function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3);
}

// Eases in as well as out. For a move the eye follows the whole way —
// the camera sweeping between seats — starting at full speed reads as a
// jerk, which easeOutCubic alone can't avoid.
export function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

export function animate({ duration, onUpdate, onComplete, easing = easeOutCubic }) {
  active.push({ start: performance.now(), duration, onUpdate, onComplete, easing });
}

export function tickAnimations(now = performance.now()) {
  for (let i = active.length - 1; i >= 0; i--) {
    const a = active[i];
    const t = Math.min(1, (now - a.start) / a.duration);
    a.onUpdate(a.easing(t), t);
    if (t >= 1) {
      active.splice(i, 1);
      if (a.onComplete) a.onComplete();
    }
  }
}
