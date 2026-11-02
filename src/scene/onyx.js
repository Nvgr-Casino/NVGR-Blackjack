import * as THREE from 'three';

// Amber onyx, lit from behind: bands of honey and cream, veined — for the
// front of the Penthouse's bar, which glows from within the stone.
export function onyxMaterial() {
  const W = 1024, H = 512;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, '#e9a64a');
  g.addColorStop(0.5, '#f6d38c');
  g.addColorStop(1, '#d8862e');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  for (let k = 0; k < 60; k++) {
    ctx.strokeStyle = `rgba(${150 + Math.random() * 80},${70 + Math.random() * 60},${20 + Math.random() * 30},${0.12 + Math.random() * 0.25})`;
    ctx.lineWidth = 2 + Math.random() * 10;
    ctx.beginPath();
    let y = Math.random() * H;
    ctx.moveTo(0, y);
    for (let x = 0; x <= W; x += 40) { y += (Math.random() - 0.5) * 30; ctx.lineTo(x, y); }
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return new THREE.MeshStandardMaterial({ map: tex, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.85, roughness: 0.2, metalness: 0 });
}
