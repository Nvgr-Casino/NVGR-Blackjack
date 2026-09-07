import * as THREE from 'three';

// A small floating circular badge showing a running hand total — the pink
// "17"-style marker real casino-table games show next to a hand. Starts
// hidden; call setValue() once there's something safe to reveal (the
// dealer's hidden hole card means their true total isn't known yet).
export function createHandBadge(size = 0.34) {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;

  const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(size, size, 1);
  sprite.visible = false;
  sprite.renderOrder = 10;

  function setValue(value) {
    ctx.clearRect(0, 0, 128, 128);
    ctx.beginPath();
    ctx.arc(64, 64, 58, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(150, 24, 40, 0.95)';
    ctx.fill();
    ctx.strokeStyle = '#eac35e';
    ctx.lineWidth = 5;
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    const text = String(value);
    // A soft-hand total like "7/17" is wider than a plain "17" — shrink to fit.
    const fontSize = text.length > 2 ? 38 : 54;
    ctx.font = `700 ${fontSize}px Georgia, serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 64, 68);
    texture.needsUpdate = true;
    sprite.visible = true;
  }

  function hide() {
    sprite.visible = false;
  }

  return { sprite, setValue, hide };
}
