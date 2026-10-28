import * as THREE from 'three';

// A small floating marker showing a running hand total next to a hand.
// Starts hidden; call setValue() once there's something safe to reveal
// (the dealer's hidden hole card means their true total isn't known yet).
//
// Drawn as the same dark pill with cream lettering the interface uses, so
// the numbers over the felt and the panels around it read as one design.
// It used to be a glossy red disc with a gold ring — the loudest thing on
// the table, for a number.
const W = 192;
const H = 96;

export function createHandBadge(size = 0.34) {
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;

  // Not tone-mapped: this is interface, and should show the exact colours
  // it was drawn in rather than the scene's film curve.
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false, toneMapped: false });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(size * (W / H) * 0.62, size * 0.62, 1);
  sprite.visible = false;
  sprite.renderOrder = 10;

  function setValue(value) {
    const text = String(value);
    ctx.clearRect(0, 0, W, H);
    ctx.font = `600 ${text.length > 2 ? 42 : 50}px Inter, system-ui, sans-serif`;
    const pillW = Math.min(W - 6, Math.max(H - 6, ctx.measureText(text).width + 48));
    const x = (W - pillW) / 2;
    ctx.beginPath();
    ctx.roundRect(x, 3, pillW, H - 6, (H - 6) / 2);
    ctx.fillStyle = 'rgba(20, 17, 15, 0.9)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(239, 232, 222, 0.28)';
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.fillStyle = '#efe8de';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, W / 2, H / 2 + 2);
    texture.needsUpdate = true;
    sprite.visible = true;
  }

  function hide() {
    sprite.visible = false;
  }

  return { sprite, setValue, hide };
}
