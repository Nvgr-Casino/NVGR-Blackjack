import * as THREE from 'three';

// A hand's running total, beside its cards: a round badge in the colour of
// how the hand stands, read at a glance across the table. Dark with a white
// number while a player's hand is in play, blue for the dealer's, green
// when it has won, red when it has bust, slate when it has lost, grey for a
// push; and only a blackjack is yellow, shown as BJ (yellow until it is
// paid, then green). A soft total ("5/15") is too long for a circle and
// sits in a pill of the same colour.
//
// And a result tag (WON, LOST, BUST, BLACKJACK, PUSH): a small solid label
// set over the hand once the round is settled.
//
// Not tone-mapped and drawn over the felt: this is interface, and shows
// the exact colours it was drawn in.

export const BADGE_TONES = {
  player: { fill: ['#22314d', '#121c30'], ink: '#ffffff' },
  bj: { fill: ['#ffd24a', '#f2a900'], ink: '#1d1405' },
  dealer: { fill: ['#4aa3ff', '#1f6fd6'], ink: '#ffffff' },
  win: { fill: ['#3fd273', '#16a34a'], ink: '#ffffff' },
  blackjack: { fill: ['#ffe28a', '#d9a520'], ink: '#2a1a00' },
  bust: { fill: ['#ff5a52', '#d1241b'], ink: '#ffffff' },
  lose: { fill: ['#5d6b80', '#3a4558'], ink: '#ffffff' },
  push: { fill: ['#9aa3b2', '#6b7486'], ink: '#ffffff' },
};

const W = 256;
const H = 128;

function spriteFor(canvas, size, aspect) {
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false, toneMapped: false });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(size * aspect, size, 1);
  sprite.visible = false;
  sprite.renderOrder = 10;
  return { sprite, texture };
}

function fillOf(ctx, tone, y0, y1) {
  const g = ctx.createLinearGradient(0, y0, 0, y1);
  g.addColorStop(0, tone.fill[0]);
  g.addColorStop(1, tone.fill[1]);
  return g;
}

export function createHandBadge(size = 0.3) {
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  const { sprite, texture } = spriteFor(canvas, size, W / H);

  function setValue(value, toneKey = 'player') {
    const tone = BADGE_TONES[toneKey] || BADGE_TONES.player;
    const text = String(value);
    ctx.clearRect(0, 0, W, H);
    const d = H - 16;                     // the circle's diameter
    ctx.font = `800 ${text.length > 2 ? 50 : 62}px Inter, system-ui, sans-serif`;
    const w = text.length > 2 ? Math.min(W - 16, ctx.measureText(text).width + 52) : d;
    const x = (W - w) / 2, y = 8;
    // A soft shadow under it, a white rim round it.
    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.45)';
    ctx.shadowBlur = 10;
    ctx.shadowOffsetY = 3;
    ctx.beginPath();
    ctx.roundRect(x, y, w, d, d / 2);
    ctx.fillStyle = fillOf(ctx, tone, y, y + d);
    ctx.fill();
    ctx.restore();
    ctx.lineWidth = 6;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.92)';
    ctx.beginPath();
    ctx.roundRect(x + 3, y + 3, w - 6, d - 6, (d - 6) / 2);
    ctx.stroke();
    ctx.fillStyle = tone.ink;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, W / 2, y + d / 2 + 3);
    texture.needsUpdate = true;
    sprite.visible = true;
  }

  function hide() { sprite.visible = false; }

  return { sprite, setValue, hide };
}

// A blackjack is yellow while it stands, green once it is paid.
const TAG_TEXT = { win: 'WON', blackjack: 'BLACKJACK', bjwin: 'BLACKJACK', bust: 'BUST', lose: 'LOST', push: 'PUSH' };
const TAG_TONE = { win: 'win', blackjack: 'bj', bjwin: 'win', bust: 'bust', lose: 'lose', push: 'push' };
const TW = 384;
const TH = 112;

export function createResultTag(size = 0.2) {
  const canvas = document.createElement('canvas');
  canvas.width = TW;
  canvas.height = TH;
  const ctx = canvas.getContext('2d');
  const { sprite, texture } = spriteFor(canvas, size, TW / TH);

  function show(outcome) {
    const tone = BADGE_TONES[TAG_TONE[outcome]];
    const text = TAG_TEXT[outcome];
    if (!tone || !text) { sprite.visible = false; return; }
    ctx.clearRect(0, 0, TW, TH);
    ctx.font = `800 ${text.length > 5 ? 54 : 66}px Inter, system-ui, sans-serif`;
    ctx.letterSpacing = '3px';
    const w = Math.min(TW - 12, ctx.measureText(text).width + 56);
    const x = (TW - w) / 2, y = 10, h = TH - 20;
    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.45)';
    ctx.shadowBlur = 10;
    ctx.shadowOffsetY = 3;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 12);
    ctx.fillStyle = fillOf(ctx, tone, y, y + h);
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = tone.ink;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, TW / 2, TH / 2 + 3);
    ctx.letterSpacing = '0px';
    texture.needsUpdate = true;
    sprite.visible = true;
  }

  function hide() { sprite.visible = false; }

  return { sprite, show, hide };
}
