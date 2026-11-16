// Fine gold dust drifting up through the light: the loading screen's and
// the sign-in's atmosphere. Motes of a few sizes rise slowly, sway, and
// catch the light as they turn (a slow twinkle); a few larger ones are out
// of focus, nearer the eye. Nothing for anyone who has asked for reduced
// motion. Returns a function that stops it and removes the canvas.

export function goldDust(parent, { count = 70, className = 'gold-dust' } = {}) {
  if (!parent || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return () => {};
  const c = document.createElement('canvas');
  c.className = className;
  c.setAttribute('aria-hidden', 'true');
  parent.prepend(c);
  const ctx = c.getContext('2d');
  let W = 0, H = 0, dpr = 1;
  const size = () => {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = c.clientWidth || window.innerWidth; H = c.clientHeight || window.innerHeight;
    c.width = W * dpr; c.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  size();
  window.addEventListener('resize', size);
  const mote = (fresh) => {
    const near = Math.random() < 0.12;
    return {
      x: Math.random() * W, y: fresh ? Math.random() * H : H + 10,
      r: near ? 2.2 + Math.random() * 2.4 : 0.6 + Math.random() * 1.3,
      vy: near ? 0.22 + Math.random() * 0.2 : 0.08 + Math.random() * 0.22,
      sway: Math.random() * Math.PI * 2, swaySpeed: 0.004 + Math.random() * 0.01,
      tw: Math.random() * Math.PI * 2, twSpeed: 0.02 + Math.random() * 0.05,
      near,
    };
  };
  const motes = Array.from({ length: count }, () => mote(true));
  let raf = 0, alive = true;
  function frame() {
    if (!alive) return;
    ctx.clearRect(0, 0, W, H);
    for (const m of motes) {
      m.y -= m.vy; m.sway += m.swaySpeed; m.tw += m.twSpeed;
      const x = m.x + Math.sin(m.sway) * 14;
      if (m.y < -12) Object.assign(m, mote(false));
      const glint = 0.35 + 0.65 * Math.max(0, Math.sin(m.tw));
      const fadeTop = Math.min(1, m.y / (H * 0.25));
      const a = (m.near ? 0.18 : 0.55) * glint * Math.max(0, fadeTop);
      const g = ctx.createRadialGradient(x, m.y, 0, x, m.y, m.r * (m.near ? 3 : 2.4));
      g.addColorStop(0, `rgba(255, 236, 184, ${a})`);
      g.addColorStop(0.4, `rgba(232, 196, 110, ${a * 0.55})`);
      g.addColorStop(1, 'rgba(232, 196, 110, 0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(x, m.y, m.r * (m.near ? 3 : 2.4), 0, Math.PI * 2); ctx.fill();
    }
    raf = requestAnimationFrame(frame);
  }
  raf = requestAnimationFrame(frame);
  return () => { alive = false; cancelAnimationFrame(raf); window.removeEventListener('resize', size); c.remove(); };
}
