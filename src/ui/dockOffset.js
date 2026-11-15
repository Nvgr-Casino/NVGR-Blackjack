// Where the 3D view sits while a betting board is open. On most screens the
// board lies along the bottom, so the picture is lifted (a vertical view
// offset of `lift` of the height). On a phone on its side there is no
// height to spare: the board docks to the right edge instead (app.css), and
// the picture slides left by half the board's width, so the wheel or table
// sits in the free space beside it. The share of the slide follows the lift
// as it eases in and out.
export const isPhoneLandscape = () => window.innerWidth > window.innerHeight && window.innerHeight <= 520;

export function viewOffsetFor(camera, lift) {
  const w = window.innerWidth, h = window.innerHeight;
  if (isPhoneLandscape()) {
    const panel = document.querySelector('.hud-dock .dock-panel.rl-dock, .hud-dock .dock-panel.bc-dock, .hud-dock .dock-panel.cr-dock');
    const width = panel ? panel.getBoundingClientRect().width : 0;
    return { x: Math.min(1, lift / 0.1) * (width / 2), y: 0, w, h };
  }
  return { x: 0, y: ((camera.aspect < 1 ? 0.07 : 0) + lift) * h, w, h };
}

/** Applies it: a view offset where there is one to apply, none otherwise. */
export function applyViewOffset(camera, lift) {
  const o = viewOffsetFor(camera, lift);
  if (o.x || o.y) camera.setViewOffset(o.w, o.h, o.x, o.y, o.w, o.h);
  else camera.clearViewOffset();
  camera.updateProjectionMatrix();
}
