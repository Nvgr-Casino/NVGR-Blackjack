import * as THREE from 'three';
import { FLOOR_Y, m } from './scale.js';
import { walkway, brandSign, staffPosts } from './layout.js';
import { lightPanel, roundRug } from './decor.js';

// Lucky Sevens: a slot lounge on the Las Vegas Strip, the room every new
// player starts in. Built to look like the real thing, its furniture all
// its own:
//
//   - banks of modern video slots: gloss-black cabinets edged in light, a
//     big screen with the game on it (five reels of shaded symbols, the
//     title over them, the credit and bet meters under), a top box with
//     the game's logo and its jackpot, a deck of lit buttons, a padded
//     swivel chair; now and then one spins and settles, reel by reel;
//   - over the table, a ring of LED showing the progressive jackpot,
//     climbing as it does on any casino floor;
//   - neon lettering on the walls, as the Strip has it: LUCKY SEVENS over
//     the sign, HIGH LIMIT, 777, JACKPOT, SLOTS;
//   - booths of oxblood leather, tufted, round black tables rimmed in brass;
//   - a bar fronted in backlit amber glass, bottles lit on its shelves;
//   - a casino carpet (dense, ornate, burgundy, navy and gold), walnut
//     panelling over black marble, a coffered ceiling with coves of light.

const half = 36;
const CEIL = FLOOR_Y + m(4.9);

// ---------- materials ----------
const gloss = new THREE.MeshStandardMaterial({ color: 0x0c0c10, roughness: 0.18, metalness: 0.35 });
const gunmetal = new THREE.MeshStandardMaterial({ color: 0x2a2c32, roughness: 0.35, metalness: 0.8 });
const chrome = new THREE.MeshStandardMaterial({ color: 0xd8dce2, roughness: 0.12, metalness: 1.0 });
const brass = new THREE.MeshStandardMaterial({ color: 0xb8965a, roughness: 0.28, metalness: 0.95 });
const blackStone = new THREE.MeshStandardMaterial({ color: 0x0c0b0e, roughness: 0.08, metalness: 0.1 });
const light = (color) => new THREE.MeshBasicMaterial({ color, toneMapped: false });
const canvasTex = (w, h, draw) => {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
};
// Oxblood leather, tufted in diamonds, a button in each.
const leather = (() => {
  const t = canvasTex(512, 512, (ctx) => {
    ctx.fillStyle = '#4a0c14';
    ctx.fillRect(0, 0, 512, 512);
    const img = ctx.getImageData(0, 0, 512, 512);
    for (let i = 0; i < img.data.length; i += 4) {
      const n = (Math.random() - 0.5) * 18;
      img.data[i] += n;
      img.data[i + 1] += n * 0.4;
      img.data[i + 2] += n * 0.4;
    }
    ctx.putImageData(img, 0, 0);
    for (let y = 0; y < 4; y++) for (let x = 0; x < 5; x++) {
      const cx = x * 128 + (y % 2) * 64, cy = y * 128 + 64;
      const g = ctx.createRadialGradient(cx, cy, 3, cx, cy, 70);
      g.addColorStop(0, 'rgba(0,0,0,0.55)');
      g.addColorStop(0.15, 'rgba(0,0,0,0.2)');
      g.addColorStop(0.7, 'rgba(255,220,220,0.06)');
      g.addColorStop(1, 'rgba(0,0,0,0.15)');
      ctx.fillStyle = g;
      ctx.fillRect(cx - 70, cy - 70, 140, 140);
      ctx.fillStyle = '#2a060a';
      ctx.beginPath();
      ctx.arc(cx, cy, 5, 0, Math.PI * 2);
      ctx.fill();
    }
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return new THREE.MeshStandardMaterial({ map: t, roughness: 0.45, metalness: 0.05 });
})();

// ---------- the carpet ----------
// A casino carpet: a dense ornament of scrolls and rosettes in gold, teal
// and rose over burgundy and navy, every part of it busy.
function paintCasinoCarpet(ctx, S) {
  ctx.fillStyle = '#3a0c18';
  ctx.fillRect(0, 0, S, S);
  const wrap = (fn) => [-S, 0, S].forEach((dx) => [-S, 0, S].forEach((dy) => { ctx.save(); ctx.translate(dx, dy); fn(); ctx.restore(); }));
  const cells = (shift, fn) => {
    for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) {
      const x = i * (S / 4) + (((j + shift) % 2) * S) / 8, y = j * (S / 4) + S / 8;
      wrap(() => fn(x, y));
    }
  };
  // A navy lattice of lozenges.
  ctx.fillStyle = '#141838';
  cells(0, (x, y) => {
    ctx.beginPath();
    ctx.moveTo(x, y - S / 10);
    ctx.lineTo(x + S / 12, y);
    ctx.lineTo(x, y + S / 10);
    ctx.lineTo(x - S / 12, y);
    ctx.closePath();
    ctx.fill();
  });
  // Gold acanthus curling round each lozenge.
  ctx.strokeStyle = '#c9a24f';
  ctx.lineWidth = S / 200;
  cells(0, (x, y) => {
    for (let k = 0; k < 4; k++) {
      const a = (k / 4) * Math.PI * 2 + Math.PI / 4;
      const p = (r, da = 0) => [x + Math.cos(a + da) * S * r, y + Math.sin(a + da) * S * r];
      ctx.beginPath();
      ctx.moveTo(...p(0.05));
      ctx.bezierCurveTo(...p(0.12), ...p(0.12, 0.8), ...p(0.08, 0.5));
      ctx.stroke();
    }
  });
  // Rosettes at the crossings: teal petals round a rose heart.
  cells(1, (x, y) => {
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2;
      ctx.fillStyle = k % 2 ? '#1f6a6a' : '#2a8a84';
      ctx.beginPath();
      ctx.ellipse(x + Math.cos(a) * S * 0.022, y + Math.sin(a) * S * 0.022, S * 0.02, S * 0.008, a, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#b8485a';
    ctx.beginPath();
    ctx.arc(x, y, S * 0.012, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#e8c86a';
    ctx.beginPath();
    ctx.arc(x, y, S * 0.005, 0, Math.PI * 2);
    ctx.fill();
  });
  for (let k = 0; k < 400; k++) {
    ctx.fillStyle = `rgba(232,200,106,${0.3 + Math.random() * 0.4})`;
    ctx.fillRect(Math.random() * S, Math.random() * S, 3, 3);
  }
  // The weave.
  const img = ctx.getImageData(0, 0, S, S);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (Math.random() - 0.5) * 16;
    img.data[i] += n;
    img.data[i + 1] += n;
    img.data[i + 2] += n;
  }
  ctx.putImageData(img, 0, 0);
}

// ---------- the walls ----------
// Dark walnut panelling in tall frames over a black marble base, a brass
// rail between.
function paintLoungeWall(ctx, d) {
  const { texW: W, texH: H, px } = d;
  const u = px * m(1);
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#2a1810');
  g.addColorStop(1, '#1a0e08');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  for (let k = 0; k < 160; k++) {
    ctx.strokeStyle = `rgba(80,50,30,${0.15 + Math.random() * 0.2})`;
    ctx.lineWidth = 1 + Math.random() * 2;
    const x = Math.random() * W;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.bezierCurveTo(x + 20, H * 0.3, x - 20, H * 0.6, x + 10, H);
    ctx.stroke();
  }
  const base = H - u * 1.0;
  for (let x = u * 0.2; x < W; x += u * 1.6) {
    ctx.strokeStyle = 'rgba(0,0,0,0.6)';
    ctx.lineWidth = 6;
    ctx.strokeRect(x + 3, u * 0.45 + 3, u * 1.3, base - u * 0.75);
    ctx.strokeStyle = 'rgba(180,140,90,0.25)';
    ctx.lineWidth = 3;
    ctx.strokeRect(x, u * 0.45, u * 1.3, base - u * 0.75);
  }
  ctx.fillStyle = '#0c0b0e';
  ctx.fillRect(0, base, W, H - base);
  for (let k = 0; k < 30; k++) {
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.lineWidth = 1 + Math.random() * 2;
    ctx.beginPath();
    let x = Math.random() * W, y = base;
    ctx.moveTo(x, y);
    while (y < H) { x += (Math.random() - 0.5) * 40; y += 10 + Math.random() * 15; ctx.lineTo(x, y); }
    ctx.stroke();
  }
  ctx.fillStyle = '#b8965a';
  ctx.fillRect(0, base - 5, W, 10);
}

// ---------- the slot game ----------
// Symbols drawn as a video slot draws them: shaded, outlined, glinting.
function drawSymbol(ctx, kind, cx, cy, s) {
  ctx.save();
  ctx.translate(cx, cy);
  const metal = (c0, c1) => {
    const g = ctx.createLinearGradient(0, -s / 2, 0, s / 2);
    g.addColorStop(0, c0);
    g.addColorStop(0.45, '#ffffff');
    g.addColorStop(0.55, c0);
    g.addColorStop(1, c1);
    return g;
  };
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  if (kind === '7' || kind === 'blue7') {
    ctx.font = `900 ${s * 0.95}px Georgia, serif`;
    ctx.lineWidth = s * 0.1;
    ctx.strokeStyle = '#2a1404';
    ctx.strokeText('7', 0, s * 0.04);
    ctx.fillStyle = kind === '7' ? metal('#ff3a2a', '#7a0806') : metal('#3a8aff', '#06207a');
    ctx.fillText('7', 0, s * 0.04);
    ctx.lineWidth = s * 0.03;
    ctx.strokeStyle = '#f2d27a';
    ctx.strokeText('7', 0, s * 0.04);
  } else if (kind === 'bar') {
    ctx.fillStyle = metal('#3a3a3e', '#0a0a0c');
    ctx.beginPath();
    ctx.roundRect(-s * 0.45, -s * 0.2, s * 0.9, s * 0.4, s * 0.08);
    ctx.fill();
    ctx.lineWidth = s * 0.03;
    ctx.strokeStyle = '#f2d27a';
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.font = `900 ${s * 0.26}px Georgia, serif`;
    ctx.fillText('BAR', 0, s * 0.02);
  } else if (kind === 'gem') {
    const pts = [[0, -0.45], [0.38, -0.12], [0.24, 0.42], [-0.24, 0.42], [-0.38, -0.12]];
    ctx.beginPath();
    pts.forEach(([x, y], i) => (i ? ctx.lineTo(x * s, y * s) : ctx.moveTo(x * s, y * s)));
    ctx.closePath();
    const g = ctx.createLinearGradient(-s / 2, -s / 2, s / 2, s / 2);
    g.addColorStop(0, '#9affc8');
    g.addColorStop(0.5, '#0a8a4a');
    g.addColorStop(1, '#043a20');
    ctx.fillStyle = g;
    ctx.fill();
    ctx.lineWidth = s * 0.03;
    ctx.strokeStyle = '#d8ffe8';
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = s * 0.015;
    ctx.beginPath();
    ctx.moveTo(0, -0.45 * s);
    ctx.lineTo(0, 0.42 * s);
    ctx.moveTo(-0.38 * s, -0.12 * s);
    ctx.lineTo(0.38 * s, -0.12 * s);
    ctx.stroke();
  } else if (kind === 'bell') {
    ctx.beginPath();
    ctx.moveTo(-s * 0.36, s * 0.3);
    ctx.quadraticCurveTo(-s * 0.3, -s * 0.42, 0, -s * 0.42);
    ctx.quadraticCurveTo(s * 0.3, -s * 0.42, s * 0.36, s * 0.3);
    ctx.closePath();
    ctx.fillStyle = metal('#ffd24a', '#8a5a06');
    ctx.fill();
    ctx.lineWidth = s * 0.03;
    ctx.strokeStyle = '#4a2a04';
    ctx.stroke();
    ctx.fillStyle = '#8a5a06';
    ctx.beginPath();
    ctx.arc(0, s * 0.36, s * 0.08, 0, Math.PI * 2);
    ctx.fill();
  } else if (kind === 'cherry') {
    ctx.strokeStyle = '#2a5a1a';
    ctx.lineWidth = s * 0.05;
    ctx.beginPath();
    ctx.moveTo(-s * 0.18, s * 0.1);
    ctx.quadraticCurveTo(-s * 0.05, -s * 0.35, s * 0.15, -s * 0.4);
    ctx.moveTo(s * 0.18, s * 0.1);
    ctx.quadraticCurveTo(s * 0.12, -s * 0.2, s * 0.15, -s * 0.4);
    ctx.stroke();
    [[-0.2, 0.22], [0.2, 0.22]].forEach(([x, y]) => {
      const g = ctx.createRadialGradient(x * s - s * 0.06, y * s - s * 0.06, s * 0.02, x * s, y * s, s * 0.2);
      g.addColorStop(0, '#ff9a9a');
      g.addColorStop(0.4, '#d4142a');
      g.addColorStop(1, '#5a0410');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x * s, y * s, s * 0.18, 0, Math.PI * 2);
      ctx.fill();
    });
  } else if (kind === 'wild') {
    ctx.fillStyle = metal('#ffe08a', '#8a5a06');
    ctx.beginPath();
    ctx.roundRect(-s * 0.46, -s * 0.3, s * 0.92, s * 0.6, s * 0.1);
    ctx.fill();
    ctx.fillStyle = '#5a0c14';
    ctx.font = `900 italic ${s * 0.3}px Georgia, serif`;
    ctx.fillText('WILD', 0, s * 0.02);
  } else {
    ctx.font = `900 ${s * 0.7}px Georgia, serif`;
    ctx.lineWidth = s * 0.08;
    ctx.strokeStyle = '#1a1030';
    ctx.strokeText(kind, 0, 0);
    ctx.fillStyle = metal(kind === 'A' ? '#ff5a9a' : kind === 'K' ? '#5ac8ff' : '#b88aff', '#2a0a3a');
    ctx.fillText(kind, 0, 0);
  }
  ctx.restore();
}
const SYMBOLS = ['7', 'bar', 'gem', 'bell', 'cherry', 'wild', 'A', 'K', 'Q', 'blue7'];
// A reel shows three symbols; each cell is as tall for its width as the
// reel window makes it.
const CELL_W = 160, CELL_H = 220;

// A column of symbols for a reel, drawn tall so it can scroll.
let reelColTex = null;
function reelColumn() {
  if (reelColTex) return reelColTex;
  reelColTex = canvasTex(CELL_W, CELL_H * SYMBOLS.length, (ctx, w) => {
    SYMBOLS.forEach((k, i) => {
      const y0 = i * CELL_H;
      const g = ctx.createLinearGradient(0, y0, 0, y0 + CELL_H);
      g.addColorStop(0, '#d8d4e0');
      g.addColorStop(0.5, '#ffffff');
      g.addColorStop(1, '#d8d4e0');
      ctx.fillStyle = g;
      ctx.fillRect(0, y0, w, CELL_H);
      drawSymbol(ctx, k, w / 2, y0 + CELL_H / 2, w * 0.82);
    });
  });
  reelColTex.wrapS = reelColTex.wrapT = THREE.RepeatWrapping;
  return reelColTex;
}
// The game around the reels: its title, the window, the meters.
const GAMES = [
  { title: 'DIAMOND SEVENS', a: '#1a0628', b: '#6a1450', gold: '#f2c84a', edge: 0xc84aff },
  { title: 'GOLDEN EMPIRE', a: '#1a0c02', b: '#6a4208', gold: '#ffe08a', edge: 0xffb02a },
  { title: 'LUCKY FORTUNE', a: '#021828', b: '#0a5070', gold: '#ffd24a', edge: 0x2ac8ff },
  { title: 'RUBY NIGHTS', a: '#28020a', b: '#7a0820', gold: '#f2c84a', edge: 0xff2a4a },
];
const screenMats = GAMES.map((g) => new THREE.MeshBasicMaterial({
  toneMapped: false,
  map: canvasTex(512, 640, (ctx, w, h) => {
    const bg = ctx.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, g.b);
    bg.addColorStop(0.5, g.a);
    bg.addColorStop(1, g.b);
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);
    // Rays behind the title.
    ctx.save();
    ctx.translate(w / 2, h * 0.1);
    for (let i = 0; i < 24; i++) {
      ctx.rotate(Math.PI / 12);
      ctx.fillStyle = i % 2 ? 'rgba(255,230,160,0.1)' : 'rgba(255,230,160,0.02)';
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(w, -30);
      ctx.lineTo(w, 30);
      ctx.fill();
    }
    ctx.restore();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '900 italic 44px Georgia, serif';
    ctx.lineWidth = 8;
    ctx.strokeStyle = '#1a0a04';
    ctx.strokeText(g.title, w / 2, h * 0.1);
    const tg = ctx.createLinearGradient(0, h * 0.06, 0, h * 0.14);
    tg.addColorStop(0, '#fff6d0');
    tg.addColorStop(1, g.gold);
    ctx.fillStyle = tg;
    ctx.fillText(g.title, w / 2, h * 0.1);
    // The reel window (the reels are drawn over it) and its frame.
    ctx.fillStyle = '#0a0612';
    ctx.fillRect(w * 0.04, h * 0.2, w * 0.92, h * 0.58);
    ctx.strokeStyle = g.gold;
    ctx.lineWidth = 8;
    ctx.strokeRect(w * 0.04 - 4, h * 0.2 - 4, w * 0.92 + 8, h * 0.58 + 8);
    // Payline markers either side of the window.
    ctx.font = '700 15px Arial, sans-serif';
    for (let i = 0; i < 5; i++) {
      const y = h * (0.24 + i * 0.125);
      [w * 0.02, w * 0.98].forEach((x) => {
        ctx.fillStyle = ['#ff3a3a', '#3aff6a', '#3a8aff', '#ffd23a', '#ff3aff'][i];
        ctx.beginPath();
        ctx.arc(x, y, 9, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#000';
        ctx.fillText(String(i + 1), x, y + 1);
      });
    }
    ctx.font = '700 17px Arial, sans-serif';
    ctx.fillStyle = g.gold;
    ctx.fillText('25 LINES  ·  3 OF A KIND PAYS  ·  WILD SUBSTITUTES', w / 2, h * 0.805);
    // The meters.
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(0, h * 0.83, w, h * 0.17);
    ctx.font = '700 18px Arial, sans-serif';
    ctx.fillStyle = '#ffd24a';
    ctx.fillText('CREDIT', w * 0.2, h * 0.865);
    ctx.fillText('BET', w * 0.5, h * 0.865);
    ctx.fillText('WIN', w * 0.8, h * 0.865);
    ctx.font = '700 30px Arial, sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText('$' + (800 + Math.floor(Math.random() * 9000)).toLocaleString() + '.00', w * 0.2, h * 0.93);
    ctx.fillText('$5.00', w * 0.5, h * 0.93);
    ctx.fillText('$0.00', w * 0.8, h * 0.93);
  }),
}));
const topperMats = GAMES.map((g) => new THREE.MeshBasicMaterial({
  toneMapped: false,
  map: canvasTex(512, 256, (ctx, w, h) => {
    const bg = ctx.createRadialGradient(w / 2, h / 2, 10, w / 2, h / 2, w / 2);
    bg.addColorStop(0, g.b);
    bg.addColorStop(1, '#05030a');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);
    const [first, second] = g.title.split(' ');
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '900 italic 62px Georgia, serif';
    ctx.lineWidth = 8;
    ctx.strokeStyle = '#1a0a04';
    ctx.strokeText(first, w / 2, h * 0.32);
    ctx.fillStyle = g.gold;
    ctx.fillText(first, w / 2, h * 0.32);
    ctx.font = '700 30px Georgia, serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(second, w / 2, h * 0.58);
    // Its jackpot, in a dark LED window.
    ctx.fillStyle = '#080404';
    ctx.fillRect(w * 0.18, h * 0.72, w * 0.64, h * 0.22);
    ctx.fillStyle = '#ff3a2a';
    ctx.shadowColor = '#ff3a2a';
    ctx.shadowBlur = 10;
    ctx.font = '700 30px "Courier New", monospace';
    ctx.fillText('$' + (12000 + Math.floor(Math.random() * 80000)).toLocaleString() + '.' + String(Math.floor(Math.random() * 100)).padStart(2, '0'), w / 2, h * 0.835);
  }),
}));
const deckTex = canvasTex(512, 160, (ctx, w, h) => {
  ctx.fillStyle = '#101014';
  ctx.fillRect(0, 0, w, h);
  const btn = (x, y, bw, bh, col, label) => {
    const g = ctx.createLinearGradient(0, y, 0, y + bh);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(0.3, col);
    g.addColorStop(1, col);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.roundRect(x, y, bw, bh, 6);
    ctx.fill();
    ctx.fillStyle = '#1a1a1a';
    ctx.font = '700 13px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, x + bw / 2, y + bh / 2);
  };
  ['BET 1', 'BET 5', 'BET 10', 'MAX BET'].forEach((l, i) => btn(20 + i * 80, 30, 70, 44, '#f2c84a', l));
  btn(360, 22, 130, 60, '#3adc6a', 'SPIN');
  btn(20, 100, 90, 34, '#5ac8ff', 'CASH OUT');
  btn(120, 100, 90, 34, '#ff6a6a', 'SERVICE');
  // The bill slot.
  ctx.fillStyle = '#2a2c32';
  ctx.fillRect(360, 104, 130, 26);
  ctx.fillStyle = '#3adc6a';
  ctx.fillRect(370, 115, 110, 4);
});
const deckMat = new THREE.MeshStandardMaterial({ map: deckTex, roughness: 0.3, emissive: 0xffffff, emissiveMap: deckTex, emissiveIntensity: 0.55 });
const edgeMats = GAMES.map((g) => light(g.edge));
const candleMat = light(0xc8281c);

// A video slot: cabinet, screen, top box, button deck, light along its
// edges, and a padded swivel chair before it.
function slotMachine(room, x, z, yaw, game, machines) {
  const g = new THREE.Group();
  const W = m(0.66), D = m(0.62);
  const base = new THREE.Mesh(new THREE.BoxGeometry(W, m(0.82), D), gloss);
  base.position.y = FLOOR_Y + m(0.41);
  g.add(base);
  const kick = new THREE.Mesh(new THREE.BoxGeometry(W + m(0.02), m(0.08), D + m(0.02)), gunmetal);
  kick.position.y = FLOOR_Y + m(0.04);
  g.add(kick);
  // The button deck, sloped toward the player.
  const deck = new THREE.Mesh(new THREE.BoxGeometry(W, m(0.06), m(0.34)), [gunmetal, gunmetal, deckMat, gunmetal, gunmetal, gunmetal]);
  deck.position.set(0, FLOOR_Y + m(0.86), D / 2 + m(0.05));
  deck.rotation.x = 0.2;
  g.add(deck);
  // The screen housing, leaning back a little.
  const head = new THREE.Group();
  head.position.set(0, FLOOR_Y + m(0.9), 0);
  head.rotation.x = -0.1;
  g.add(head);
  const housing = new THREE.Mesh(new THREE.BoxGeometry(W, m(0.86), m(0.36)), gloss);
  housing.position.set(0, m(0.43), m(0.05));
  head.add(housing);
  const SW = W * 0.88, SH = m(0.76);
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(SW, SH), screenMats[game]);
  screen.position.set(0, m(0.44), m(0.232));
  head.add(screen);
  // A chrome bezel round the screen.
  [[SW + m(0.03), m(0.015), 0, SH / 2], [SW + m(0.03), m(0.015), 0, -SH / 2], [m(0.015), SH, SW / 2, 0], [m(0.015), SH, -SW / 2, 0]].forEach(([bw, bh, bx, by]) => {
    const b = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, m(0.012)), chrome);
    b.position.set(bx, m(0.44) + by, m(0.234));
    head.add(b);
  });
  // Five reels over the screen's window, each its own scrolling column.
  const reels = [];
  const winW = SW * 0.92, winH = SH * 0.58;
  const winY = m(0.44) + SH * (0.5 - 0.2 - 0.29);
  for (let i = 0; i < 5; i++) {
    const tex = reelColumn().clone();
    tex.needsUpdate = true;
    tex.repeat.set(1, 3 / SYMBOLS.length);
    tex.offset.y = Math.floor(Math.random() * SYMBOLS.length) / SYMBOLS.length;
    const reel = new THREE.Mesh(new THREE.PlaneGeometry(winW / 5 - m(0.005), winH - m(0.008)), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }));
    reel.position.set(-winW / 2 + (i + 0.5) * (winW / 5), winY, m(0.2335));
    head.add(reel);
    reels.push(tex);
  }
  // The top box, its logo lit, its jackpot in it.
  const top = new THREE.Mesh(new THREE.BoxGeometry(W, m(0.36), m(0.3)), gloss);
  top.position.set(0, m(1.06), m(0.02));
  head.add(top);
  const logo = new THREE.Mesh(new THREE.PlaneGeometry(W * 0.9, m(0.3)), topperMats[game]);
  logo.position.set(0, m(1.06), m(0.172));
  head.add(logo);
  // Light along the cabinet's edges, in the game's colour.
  [-1, 1].forEach((s) => {
    const strip = new THREE.Mesh(new THREE.BoxGeometry(m(0.012), m(1.95), m(0.012)), edgeMats[game]);
    strip.position.set(s * (W / 2 + m(0.006)), FLOOR_Y + m(1.0), D / 2 - m(0.04));
    g.add(strip);
  });
  // The candle on top that calls an attendant.
  const candle = new THREE.Mesh(new THREE.CylinderGeometry(m(0.025), m(0.025), m(0.1), 12), candleMat);
  candle.position.set(0, FLOOR_Y + m(2.18), -m(0.08));
  g.add(candle);
  // Its chair: a padded seat with a back, on a chrome column.
  const chair = new THREE.Group();
  chair.position.set(0, 0, D / 2 + m(0.62));
  const col = new THREE.Mesh(new THREE.CylinderGeometry(m(0.035), m(0.035), m(0.5), 12), chrome);
  col.position.y = FLOOR_Y + m(0.25);
  chair.add(col);
  const foot = new THREE.Mesh(new THREE.CylinderGeometry(m(0.24), m(0.26), m(0.03), 24), chrome);
  foot.position.y = FLOOR_Y + m(0.015);
  chair.add(foot);
  const seat = new THREE.Mesh(new THREE.CylinderGeometry(m(0.24), m(0.22), m(0.12), 24), leather);
  seat.position.y = FLOOR_Y + m(0.56);
  chair.add(seat);
  const back = new THREE.Mesh(new THREE.BoxGeometry(m(0.42), m(0.42), m(0.08)), leather);
  back.position.set(0, FLOOR_Y + m(0.86), m(0.2));
  back.rotation.x = -0.12;
  chair.add(back);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(m(0.16), m(0.012), 6, 24), chrome);
  ring.rotation.x = Math.PI / 2;
  ring.position.y = FLOOR_Y + m(0.25);
  chair.add(ring);
  g.add(chair);
  g.position.set(x, 0, z);
  g.rotation.y = yaw;
  room.add(g);
  machines.push({ reels, spinUntil: 0, next: performance.now() + 2000 + Math.random() * 20000, stops: reels.map(() => 0) });
}

// ---------- the jackpot ----------
// A ring of LED over the table, the progressive jackpot running round it,
// climbing.
function jackpotRing(room) {
  const c = document.createElement('canvas');
  c.width = 4096;
  c.height = 96;
  const ctx = c.getContext('2d');
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  let amount = 1284377.42;
  const draw = () => {
    ctx.fillStyle = '#050303';
    ctx.fillRect(0, 0, c.width, c.height);
    // The dots of the panel.
    ctx.fillStyle = 'rgba(255,60,40,0.07)';
    for (let y = 3; y < c.height; y += 6) for (let x = 3; x < c.width; x += 6) ctx.fillRect(x, y, 4, 4);
    const text = `GRAND JACKPOT   $${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    ctx.font = '700 70px "Courier New", monospace';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = '#ff3a1a';
    ctx.shadowBlur = 14;
    ctx.fillStyle = '#ff4a2a';
    // Twice round the ring.
    const w = ctx.measureText(text).width;
    ctx.fillText(text, (c.width / 2 - w) / 2, c.height / 2);
    ctx.fillText(text, c.width / 2 + (c.width / 2 - w) / 2, c.height / 2);
    ctx.shadowBlur = 0;
    tex.needsUpdate = true;
    inner.needsUpdate = true;
  };
  // The inside of the ring reads the right way round too.
  const inner = tex.clone();
  inner.wrapS = THREE.RepeatWrapping;
  inner.repeat.x = -1;
  draw();
  const R = m(2.6), H = m(0.38);
  const y = FLOOR_Y + m(4.05);
  const ringMesh = new THREE.Group();
  ringMesh.position.set(0, y, -0.4);
  ringMesh.add(new THREE.Mesh(new THREE.CylinderGeometry(R, R, H, 96, 1, true), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false })));
  ringMesh.add(new THREE.Mesh(new THREE.CylinderGeometry(R - 0.02, R - 0.02, H, 96, 1, true), new THREE.MeshBasicMaterial({ map: inner, toneMapped: false, side: THREE.BackSide })));
  room.add(ringMesh);
  [y + H / 2, y - H / 2].forEach((ry) => {
    const band = new THREE.Mesh(new THREE.TorusGeometry(R, m(0.04), 8, 96), gunmetal);
    band.rotation.x = Math.PI / 2;
    band.position.set(0, ry, -0.4);
    room.add(band);
  });
  const rodH = CEIL - y - H / 2;
  [0, 1, 2].forEach((k) => {
    const a = (k / 3) * Math.PI * 2;
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(m(0.015), m(0.015), rodH, 6), chrome);
    rod.position.set(Math.cos(a) * R, y + H / 2 + rodH / 2, -0.4 + Math.sin(a) * R);
    room.add(rod);
  });
  let last = 0;
  return (dt, now) => {
    ringMesh.rotation.y += dt * 0.05;
    if (now - last > 400) {
      last = now;
      amount += 0.37 + Math.random() * 2.1;
      draw();
    }
  };
}

// ---------- neon ----------
// Lettering in neon tube: a soft glow round a bright white-hot core.
function neonType(ctx, w, h, text, color, sizeK) {
  const size = h * sizeK;
  ctx.font = `italic 700 ${size}px Georgia, serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  [[size * 0.14, 0.22], [size * 0.07, 0.45]].forEach(([lw, a]) => {
    ctx.globalAlpha = a;
    ctx.lineWidth = lw;
    ctx.strokeStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = size * 0.35;
    ctx.strokeText(text, w / 2, h / 2);
  });
  ctx.globalAlpha = 1;
  ctx.shadowBlur = size * 0.12;
  ctx.lineWidth = size * 0.03;
  ctx.strokeStyle = '#fff6f0';
  ctx.strokeText(text, w / 2, h / 2);
}
function neonSign(room, text, color, w, h, x, y, z, yaw, flickers, sizeK = 0.62) {
  const p = lightPanel((ctx, cw, ch) => neonType(ctx, cw, ch, text, color, sizeK), w, h, 1024);
  p.position.set(x, y, z);
  p.rotation.y = yaw;
  room.add(p);
  flickers.push({ mat: p.material, next: performance.now() + 6000 + Math.random() * 20000, until: 0 });
}

// ---------- booths ----------
// A half-round booth of tufted leather, a brass cap along its back, round
// a black stone table with a small lamp on it.
function booth(room, x, z, yaw) {
  const g = new THREE.Group();
  const Rin = m(0.62), Rout = m(1.2), arc = Math.PI * 1.15, start = Math.PI / 2 - arc / 2 + Math.PI;
  const ring = (r0, r1) => {
    const s = new THREE.Shape();
    s.absarc(0, 0, r1, start, start + arc, false);
    s.absarc(0, 0, r0, start + arc, start, true);
    return s;
  };
  const seat = new THREE.Mesh(new THREE.ExtrudeGeometry(ring(Rin, Rout), { depth: m(0.45), bevelEnabled: true, bevelThickness: m(0.04), bevelSize: m(0.04), bevelSegments: 4, curveSegments: 32 }), leather);
  seat.rotation.x = Math.PI / 2;
  seat.position.y = FLOOR_Y + m(0.48);
  g.add(seat);
  const back = new THREE.Mesh(new THREE.ExtrudeGeometry(ring(Rout - m(0.04), Rout + m(0.16)), { depth: m(1.05), bevelEnabled: true, bevelThickness: m(0.05), bevelSize: m(0.05), bevelSegments: 4, curveSegments: 32 }), leather);
  back.rotation.x = Math.PI / 2;
  back.position.y = FLOOR_Y + m(1.12);
  g.add(back);
  const top = new THREE.Mesh(new THREE.CylinderGeometry(m(0.5), m(0.5), m(0.04), 40), blackStone);
  top.position.y = FLOOR_Y + m(0.74);
  g.add(top);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(m(0.5), m(0.018), 8, 48), brass);
  rim.rotation.x = Math.PI / 2;
  rim.position.y = FLOOR_Y + m(0.74);
  g.add(rim);
  const post = new THREE.Mesh(new THREE.CylinderGeometry(m(0.05), m(0.25), m(0.72), 20), brass);
  post.position.y = FLOOR_Y + m(0.36);
  g.add(post);
  const lamp = new THREE.Mesh(new THREE.CylinderGeometry(m(0.07), m(0.11), m(0.13), 16, 1, true), new THREE.MeshStandardMaterial({ color: 0xffd8a0, emissive: 0xffb060, emissiveIntensity: 1.2, side: THREE.DoubleSide }));
  lamp.position.y = FLOOR_Y + m(0.98);
  g.add(lamp);
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(m(0.01), m(0.03), m(0.2), 8), brass);
  stem.position.y = FLOOR_Y + m(0.86);
  g.add(stem);
  g.position.set(x, 0, z);
  g.rotation.y = yaw;
  room.add(g);
}

// ---------- the bar ----------
// A counter fronted in backlit amber glass, a black stone top, a wall of
// bottles lit from beneath on glass shelves, leather stools.
function amberBar(room, flickers) {
  const len = m(5.4);
  const x = -half + m(1.0) + len / 2;
  const z = -half + m(1.9);
  const glow = canvasTex(1024, 256, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#ffd08a');
    g.addColorStop(1, '#c86a1a');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(120,50,10,0.35)';
    ctx.lineWidth = 2;
    for (let i = 0; i < w; i += 32) { ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, h); ctx.stroke(); }
    for (let j = 0; j < h; j += 32) { ctx.beginPath(); ctx.moveTo(0, j); ctx.lineTo(w, j); ctx.stroke(); }
  });
  const amber = new THREE.MeshStandardMaterial({ map: glow, emissive: 0xffffff, emissiveMap: glow, emissiveIntensity: 0.9, roughness: 0.2 });
  const front = new THREE.Mesh(new THREE.BoxGeometry(len, m(1.0), m(0.55)), [gunmetal, gunmetal, gunmetal, gunmetal, amber, gunmetal]);
  front.position.set(x, FLOOR_Y + m(0.5), z);
  room.add(front);
  const top = new THREE.Mesh(new THREE.BoxGeometry(len + m(0.12), m(0.06), m(0.75)), blackStone);
  top.position.set(x, FLOOR_Y + m(1.03), z - m(0.05));
  room.add(top);
  const rail = new THREE.Mesh(new THREE.CylinderGeometry(m(0.022), m(0.022), len, 12), brass);
  rail.rotation.z = Math.PI / 2;
  rail.position.set(x, FLOOR_Y + m(0.2), z + m(0.42));
  room.add(rail);
  const wall = new THREE.Mesh(new THREE.BoxGeometry(len, m(2.8), m(0.12)), new THREE.MeshStandardMaterial({ color: 0x14110e, roughness: 0.3, metalness: 0.3 }));
  wall.position.set(x, FLOOR_Y + m(1.4), -half + m(0.14));
  room.add(wall);
  const BOTTLES = [0x2a4a1a, 0x6a2a0a, 0xe8d8a0, 0x3a0a1a, 0xb8865a, 0x1a2a4a];
  const bottleMats = BOTTLES.map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.08, metalness: 0.1, emissive: c, emissiveIntensity: 0.35 }));
  const bottleGeo = new THREE.CylinderGeometry(m(0.035), m(0.04), m(0.3), 12);
  const neckGeo = new THREE.CylinderGeometry(m(0.012), m(0.02), m(0.1), 8);
  const shelfMat = new THREE.MeshStandardMaterial({ color: 0xcfe0e0, roughness: 0.05, transparent: true, opacity: 0.4 });
  const stripMat = light(0xffd8a0);
  [1.05, 1.5, 1.95].forEach((y, row) => {
    const shelf = new THREE.Mesh(new THREE.BoxGeometry(len - m(0.2), m(0.02), m(0.28)), shelfMat);
    shelf.position.set(x, FLOOR_Y + m(y), -half + m(0.32));
    room.add(shelf);
    const strip = new THREE.Mesh(new THREE.BoxGeometry(len - m(0.2), m(0.01), m(0.02)), stripMat);
    strip.position.set(x, FLOOR_Y + m(y) - m(0.015), -half + m(0.42));
    room.add(strip);
    const n = Math.floor((len - m(0.4)) / m(0.13));
    for (let i = 0; i < n; i++) {
      const mat = bottleMats[(i * 3 + row) % BOTTLES.length];
      const bx = x - len / 2 + m(0.25) + i * m(0.13);
      const b = new THREE.Mesh(bottleGeo, mat);
      b.position.set(bx, FLOOR_Y + m(y) + m(0.16), -half + m(0.32));
      room.add(b);
      const neck = new THREE.Mesh(neckGeo, mat);
      neck.position.set(bx, FLOOR_Y + m(y) + m(0.36), -half + m(0.32));
      room.add(neck);
    }
  });
  neonSign(room, 'Bar', '#ffb05a', m(1.6), m(0.6), x, FLOOR_Y + m(2.45), -half + m(0.22), 0, flickers, 0.7);
  // Leather stools before it.
  for (let i = 0; i < 6; i++) {
    const sx = x - len / 2 + (i + 0.5) * (len / 6);
    const post = new THREE.Mesh(new THREE.CylinderGeometry(m(0.03), m(0.03), m(0.72), 12), chrome);
    post.position.set(sx, FLOOR_Y + m(0.36), z + m(0.7));
    room.add(post);
    const foot = new THREE.Mesh(new THREE.CylinderGeometry(m(0.2), m(0.22), m(0.03), 24), chrome);
    foot.position.set(sx, FLOOR_Y + m(0.015), z + m(0.7));
    room.add(foot);
    const seat = new THREE.Mesh(new THREE.CylinderGeometry(m(0.21), m(0.2), m(0.1), 24), leather);
    seat.position.set(sx, FLOOR_Y + m(0.77), z + m(0.7));
    room.add(seat);
  }
  room.userData.bar = {
    bartender: { pos: new THREE.Vector3(x - len * 0.1, 0, -half + m(0.85)), yaw: 0 },
    pickup: { pos: new THREE.Vector3(x + len / 2 + m(0.55), 0, z - m(0.1)), look: new THREE.Vector3(x, 0, z) },
  };
}

// ---------- the ceiling ----------
// Coffers of dark lacquer between beams edged in brass, a line of warm
// light along each beam.
function cofferedCeiling(room) {
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(2 * half, 2 * half), new THREE.MeshStandardMaterial({ color: 0x0e0c10, roughness: 0.3, metalness: 0.3 }));
  ceil.rotation.x = Math.PI / 2;
  ceil.position.y = CEIL;
  room.add(ceil);
  const step = m(3.6);
  const beam = new THREE.MeshStandardMaterial({ color: 0x0a0706, roughness: 0.22, metalness: 0.5 });
  const cove = light(0xffc884);
  for (let k = -half + step; k < half; k += step) {
    [true, false].forEach((alongX) => {
      const [w, d] = alongX ? [2 * half, m(0.3)] : [m(0.3), 2 * half];
      const [bx, bz] = alongX ? [0, k] : [k, 0];
      const b = new THREE.Mesh(new THREE.BoxGeometry(w, m(0.35), d), beam);
      b.position.set(bx, CEIL - m(0.17), bz);
      room.add(b);
      [-1, 1].forEach((sd) => {
        const edge = new THREE.Mesh(new THREE.BoxGeometry(alongX ? w : m(0.025), m(0.025), alongX ? m(0.025) : d), brass);
        edge.position.set(bx + (alongX ? 0 : sd * m(0.15)), CEIL - m(0.35), bz + (alongX ? sd * m(0.15) : 0));
        room.add(edge);
      });
      const line = new THREE.Mesh(new THREE.BoxGeometry(alongX ? w : m(0.02), m(0.015), alongX ? m(0.02) : d), cove);
      line.position.set(bx + (alongX ? 0 : m(0.17)), CEIL - m(0.04), bz + (alongX ? m(0.17) : 0));
      room.add(line);
    });
  }
}

// ---------- the room ----------
export const LUCKY_SEVENS = {
  tableGlow: 0xffb060,
  half,
  ceilingY: CEIL,
  ceiling: null,
  noPanel: true,
  paintWall: (ctx, d) => paintLoungeWall(ctx, d),
  floorPx: 1024, floorRepeat: 72 / 4,
  paintFloor: paintCasinoCarpet,
  cove: 0xffc884, diffuser: 0xffffff, accent: 0xb8965a, washAlpha: 0,
  wall: { style: 'panels', base: 0x2a1810, wainscot: 0x0c0b0e, rail: 0xb8965a, skirting: 0x0a0806 },
  floor: { style: 'ornate', base: 0x3a0c18, pattern: 0xc9a24f },
  light: { sky: 0xfff0e0, ground: 0x4a2a24, fill: 2.3, key: 0xfff0e0, keyPower: 92, wash: 0xffc890, washPower: 40, fog: 0x120a0a, fogNear: 60, fogFar: 150 },
  furnish(room) {
    const flickers = [];
    const machines = [];
    const updates = [];
    cofferedCeiling(room);

    // The sign, LUCKY SEVENS in neon over it.
    brandSign(room, half, { rgb: '236,206,140', plate: '#120a08' });
    neonSign(room, 'Lucky Sevens', '#ff3a6a', m(5.0), m(1.0), 0, FLOOR_Y + m(4.0), -half + 0.08, 0, flickers);
    // Neon down the side walls: the signs of a slot floor.
    [-1, 1].forEach((side) => {
      [['High Limit', '#ffb05a'], ['777', '#ff3a2a'], ['Jackpot', '#ffd24a'], ['Slots', '#5ac8ff']].forEach(([t, c], i) => {
        neonSign(room, t, c, m(2.8), m(0.9), side * (half - 0.08), FLOOR_Y + m(3.5), -m(10) + i * m(6.5), -side * Math.PI / 2, flickers, 0.6);
      });
    });
    brandSign(room, half, { wall: 'front', width: m(1.8), rgb: '236,206,140', plate: '#120a08' });

    // The progressive jackpot over the table, on a rug framing it.
    updates.push(jackpotRing(room));
    room.add(roundRug(m(4.4), { base: '#1a0a10', gold: '#b8965a', bright: '#e0c07a' }));

    // Banks of slots down both walls, and islands back to back out on the
    // floor either side of the table.
    [-1, 1].forEach((side) => {
      for (let i = 0; i < 9; i++) slotMachine(room, side * (half - m(0.75)), -m(10.8) + i * m(0.78), side < 0 ? Math.PI / 2 : -Math.PI / 2, (i + (side > 0 ? 2 : 0)) % 4, machines);
      for (let i = 0; i < 7; i++) {
        const z = -m(4.6) + i * m(0.78);
        slotMachine(room, side * m(7.2) - m(0.45), z, -Math.PI / 2, (i + 1) % 4, machines);
        slotMachine(room, side * m(7.2) + m(0.45), z, Math.PI / 2, (i + 3) % 4, machines);
      }
    });
    // A bank along the back wall either side of the sign.
    for (let i = 0; i < 9; i++) slotMachine(room, m(4.4) + i * m(0.78), -half + m(0.75), 0, i % 4, machines);
    for (let i = 0; i < 3; i++) slotMachine(room, -m(4.4) - i * m(0.78), -half + m(0.75), 0, (i + 2) % 4, machines);
    // Booths in the front half.
    [-1, 1].forEach((side) => [m(3.2), m(6.6), m(10)].forEach((z) => booth(room, side * (half - m(2.2)), z, side < 0 ? -Math.PI / 2 : Math.PI / 2)));
    [-m(4.5), m(4.5)].forEach((x) => booth(room, x, half - m(2.3), Math.PI));
    amberBar(room, flickers);

    walkway(room);
    staffPosts(room, [[10, -9.6], [-10.2, 10.2], [10.2, 10.2]]);

    const N = SYMBOLS.length;
    room.userData.update = (dt, now) => {
      updates.forEach((u) => u(dt, now));
      // Now and then a machine spins: its reels run, then stop one by one
      // on a symbol, left to right.
      machines.forEach((mc) => {
        if (now > mc.next && now > mc.spinUntil) {
          mc.stops = mc.reels.map((_, i) => now + 1400 + i * 260);
          mc.spinUntil = mc.stops[mc.stops.length - 1];
          mc.next = now + 6000 + Math.random() * 22000;
        }
        if (now < mc.spinUntil + 100) {
          mc.reels.forEach((tex, i) => {
            if (now < mc.stops[i]) tex.offset.y = (tex.offset.y + dt * 3.2) % 1;
            else tex.offset.y = Math.round(tex.offset.y * N) / N;
          });
        }
      });
      flickers.forEach((f) => {
        if (now > f.next) {
          f.until = now + 120 + Math.random() * 300;
          f.next = now + 8000 + Math.random() * 20000;
        }
        f.mat.opacity = now < f.until ? (Math.random() < 0.5 ? 0.3 : 1) : 1;
      });
    };
  },
};
