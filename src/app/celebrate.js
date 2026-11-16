// A shower of gold leaf for a reward: the daily bonus, a level gift. Flakes
// of gold and ivory burst up from where the reward was collected, turn as
// they fall and fade, in about two seconds; nothing at all for anyone who
// has asked their device for reduced motion.

const COLOURS = ['#f7de98', '#e3be6a', '#c99a45', '#fff4d6', '#b8862f'];

export function goldShower(originEl = null) {
  if (typeof window === 'undefined' || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const c = document.createElement('canvas');
  c.className = 'gold-shower';
  c.setAttribute('aria-hidden', 'true');
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const W = window.innerWidth, H = window.innerHeight;
  c.width = W * dpr; c.height = H * dpr;
  document.body.appendChild(c);
  const ctx = c.getContext('2d');
  ctx.scale(dpr, dpr);

  const r = originEl && originEl.getBoundingClientRect ? originEl.getBoundingClientRect() : null;
  const ox = r ? r.left + r.width / 2 : W / 2, oy = r ? r.top + r.height / 2 : H * 0.45;
  const N = Math.round(Math.min(160, 70 + W / 10));
  const flakes = Array.from({ length: N }, () => {
    const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.2, v = 6 + Math.random() * 9;
    return {
      x: ox, y: oy, vx: Math.cos(a) * v, vy: Math.sin(a) * v,
      w: 4 + Math.random() * 7, h: 2 + Math.random() * 4,
      rot: Math.random() * Math.PI, spin: (Math.random() - 0.5) * 0.35, tilt: Math.random() * Math.PI,
      colour: COLOURS[(Math.random() * COLOURS.length) | 0], diamond: Math.random() < 0.25,
    };
  });
  const start = performance.now(), DUR = 2200;
  function frame(now) {
    const t = now - start;
    ctx.clearRect(0, 0, W, H);
    const fade = Math.max(0, 1 - Math.max(0, t - DUR * 0.55) / (DUR * 0.45));
    for (const f of flakes) {
      f.vy += 0.32; f.vx *= 0.985; f.vy *= 0.985;
      f.x += f.vx; f.y += f.vy; f.rot += f.spin; f.tilt += 0.12;
      ctx.save();
      ctx.translate(f.x, f.y); ctx.rotate(f.rot);
      ctx.scale(1, Math.abs(Math.cos(f.tilt)) * 0.85 + 0.15);   // a flake turning in the light
      ctx.globalAlpha = fade;
      ctx.fillStyle = f.colour;
      if (f.diamond) { ctx.beginPath(); ctx.moveTo(0, -f.w / 2); ctx.lineTo(f.h, 0); ctx.lineTo(0, f.w / 2); ctx.lineTo(-f.h, 0); ctx.closePath(); ctx.fill(); }
      else ctx.fillRect(-f.w / 2, -f.h / 2, f.w, f.h);
      ctx.restore();
    }
    if (t < DUR) requestAnimationFrame(frame); else c.remove();
  }
  requestAnimationFrame(frame);
}
