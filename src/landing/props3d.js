// What both 3D scenes on the front page are made of: textures painted on a
// canvas for casino chips (face and striped edge) and for the back of a
// playing card, in the casino's black and gold.
import * as THREE from 'three';

export function canvasTex(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

// A chip's face: a coloured disc with white edge spots, a gold ring and a
// small inlaid crown of four points.
export function chipFace(col, spot) {
  return canvasTex(512, 512, (ctx, w) => {
    const c = w / 2;
    const g = ctx.createRadialGradient(c * 0.8, c * 0.7, 20, c, c, c);
    g.addColorStop(0, col[0]); g.addColorStop(1, col[1]);
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(c, c, c, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = spot; ctx.lineWidth = 64;
    for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; ctx.beginPath(); ctx.arc(c, c, c - 40, a - 0.17, a + 0.17); ctx.stroke(); }
    const gold = ctx.createLinearGradient(0, 0, w, w);
    gold.addColorStop(0, '#fff1c2'); gold.addColorStop(0.5, '#c8953a'); gold.addColorStop(1, '#ffe39a');
    ctx.strokeStyle = gold; ctx.lineWidth = 10;
    ctx.beginPath(); ctx.arc(c, c, c * 0.6, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.arc(c, c, c * 0.52, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = gold;
    ctx.font = '700 120px Unbounded, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('N', c, c + 6);
  });
}
// The chip's edge: stripes round the rim.
export function chipEdge(col, spot) {
  return canvasTex(512, 32, (ctx, w, h) => {
    ctx.fillStyle = col; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = spot;
    for (let i = 0; i < 16; i++) ctx.fillRect((i / 16) * w + 6, 0, w / 32, h);
  });
}
// A card back: graphite with a fine gold lattice and a gold frame.
export function cardBack() {
  return canvasTex(512, 716, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, '#141416'); g.addColorStop(0.5, '#1d1b18'); g.addColorStop(1, '#0b0b0c');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    ctx.save(); ctx.beginPath(); ctx.roundRect(34, 34, w - 68, h - 68, 22); ctx.clip();
    ctx.strokeStyle = 'rgba(217,181,106,0.32)'; ctx.lineWidth = 2;
    for (let i = -20; i < 40; i++) {
      ctx.beginPath(); ctx.moveTo(i * 28, 0); ctx.lineTo(i * 28 + h, h); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(i * 28 + h, 0); ctx.lineTo(i * 28, h); ctx.stroke();
    }
    ctx.restore();
    const gold = ctx.createLinearGradient(0, 0, w, h);
    gold.addColorStop(0, '#fff1c2'); gold.addColorStop(0.5, '#c8953a'); gold.addColorStop(1, '#ffe39a');
    ctx.strokeStyle = gold; ctx.lineWidth = 12;
    ctx.beginPath(); ctx.roundRect(22, 22, w - 44, h - 44, 30); ctx.stroke();
  });
}
