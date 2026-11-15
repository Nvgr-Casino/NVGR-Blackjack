// "How a hand plays", told by scrolling. A black-and-gold blackjack table
// under a warm light: as the page scrolls, the camera glides down to a
// player's seat, a stack of chips slides into the betting circle, four
// cards come off the shoe and across the felt (the player's two turning
// face up), the hand is a blackjack, and the winnings slide over. Every
// frame is worked out from how far the section has scrolled, so scrolling
// back plays it backwards.
import * as THREE from 'three';
import { canvasTex, chipFace, chipEdge, cardBack } from './props3d.js';
import { loadFigure } from './figures3d.js';

const SMALL = window.matchMedia('(max-width: 760px)').matches;
const clamp01 = (v) => Math.max(0, Math.min(1, v));
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
/** How far through [a, b] the story is, 0 to 1, eased. */
const span = (p, a, b) => ease(clamp01((p - a) / (b - a)));

// The felt: black, finely grained, with the layout printed in gold.
function feltTexture() {
  return canvasTex(2048, 1228, (ctx, W, H) => {
    ctx.fillStyle = '#0c0c0d'; ctx.fillRect(0, 0, W, H);
    for (let i = 0; i < 26000; i++) {
      ctx.fillStyle = Math.random() < 0.5 ? 'rgba(255,255,255,0.025)' : 'rgba(0,0,0,0.35)';
      ctx.fillRect(Math.random() * W, Math.random() * H, 2, 2);
    }
    const gold = ctx.createLinearGradient(0, 0, W, 0);
    gold.addColorStop(0, '#8a6a2c'); gold.addColorStop(0.5, '#f1d79a'); gold.addColorStop(1, '#8a6a2c');
    // Table coordinates: x -5..5 across, z -3..3 toward the player.
    const u = (x) => ((x + 5) / 10) * W, v = (z) => ((z + 3) / 6) * H;
    // The arc of lettering across the middle.
    const cx = u(0), cy = v(-2.6), R = (v(0.15) - cy);
    ctx.strokeStyle = gold; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(cx, cy, R + 70, Math.PI * 0.22, Math.PI * 0.78); ctx.stroke();
    ctx.beginPath(); ctx.arc(cx, cy, R - 70, Math.PI * 0.25, Math.PI * 0.75); ctx.stroke();
    const text = (str, radius, size, spread) => {
      ctx.save(); ctx.fillStyle = gold; ctx.font = `700 ${size}px Unbounded, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const chars = [...str], step = spread / chars.length;
      chars.forEach((ch, i) => {
        const a = Math.PI / 2 + spread / 2 - (i + 0.5) * step;
        ctx.save(); ctx.translate(cx + Math.cos(a) * radius, cy + Math.sin(a) * radius); ctx.rotate(a - Math.PI / 2); ctx.fillText(ch, 0, 0); ctx.restore();
      });
      ctx.restore();
    };
    // Spread to fit: about three-quarters of a letter's height per letter.
    text('BLACKJACK PAYS 3 TO 2', R + 18, 56, 1.55);
    text('DEALER STANDS ON ALL 17s', R - 34, 30, 1.0);
    // The betting circle in front of the player.
    ctx.strokeStyle = gold; ctx.lineWidth = 6;
    ctx.beginPath(); ctx.ellipse(u(0), v(2.05), 112, 112, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(u(0), v(2.05), 96, 96, 0, 0, Math.PI * 2); ctx.stroke();
    // The crest at the dealer's side.
    ctx.fillStyle = gold; ctx.font = '800 54px Unbounded, sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('NVGR', u(0), v(-2.25));
  });
}

export function startStory(canvas, onProgress) {
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' }); } catch (e) { return null; }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, SMALL ? 1.5 : 1.75));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.95;
  renderer.shadowMap.enabled = !SMALL;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.setClearColor(0x070708, 1);

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x070708, 14, 34);
  const camera = new THREE.PerspectiveCamera(SMALL ? 52 : 38, 1, 0.1, 60);

  // A warm pool of light on the felt, and a little cool fill.
  scene.add(new THREE.HemisphereLight(0x7a7468, 0x0a0a0a, 0.35));
  const spot = new THREE.SpotLight(0xffe2b0, 90, 22, 0.55, 0.6, 1.4);
  spot.position.set(0.6, 8, 2.5); spot.target.position.set(0, 0, 0.6);
  spot.castShadow = !SMALL; spot.shadow.mapSize.set(1024, 1024); spot.shadow.bias = -0.0004;
  scene.add(spot, spot.target);
  const rim = new THREE.DirectionalLight(0xc8d4ff, 0.35); rim.position.set(-4, 3, -4); scene.add(rim);

  // The dealer, behind the table: one of the game's own (figures3d.js), in
  // the high-limit black waistcoat, on the game's idle. The table's units
  // are about a tenth of a metre (a card is 0.62 wide), so a 1.72 m dealer
  // is some seventeen of them, standing with the felt at his waist.
  const dealerLight = new THREE.SpotLight(0xffe6c0, 160, 40, 0.38, 0.7, 1.2);
  dealerLight.position.set(0, 16, 6); dealerLight.target.position.set(0, 5, -3.9);
  scene.add(dealerLight, dealerLight.target);
  let dealerMixer = null;
  loadFigure('m4', 17).then(({ group, mixer }) => {
    group.position.set(0, -8.1, -3.9);
    scene.add(group);
    dealerMixer = mixer;
    shown = -1;
  }).catch(() => { /* the table plays without him */ });

  // The table: felt, and a padded rail with a gold line along it.
  const felt = new THREE.Mesh(new THREE.PlaneGeometry(10, 6), new THREE.MeshStandardMaterial({ map: feltTexture(), roughness: 0.95 }));
  felt.rotation.x = -Math.PI / 2; felt.receiveShadow = true; scene.add(felt);
  const railCurve = new THREE.EllipseCurve(0, -2.2, 5.2, 5.0, Math.PI * 0.08, Math.PI * 0.92, false);
  const railPts = railCurve.getPoints(80).map((p) => new THREE.Vector3(p.x, 0.12, -p.y));
  const railPath = new THREE.CatmullRomCurve3(railPts);
  const rail = new THREE.Mesh(new THREE.TubeGeometry(railPath, 120, 0.16, 16, false), new THREE.MeshStandardMaterial({ color: 0x141210, roughness: 0.55, metalness: 0.1 }));
  scene.add(rail);
  const goldLine = new THREE.Mesh(new THREE.TubeGeometry(railPath, 120, 0.025, 8, false), new THREE.MeshStandardMaterial({ color: 0xd9b56a, roughness: 0.3, metalness: 1 }));
  goldLine.position.set(0, 0.17, 0.02); scene.add(goldLine);

  // The shoe.
  const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.45, 1.05), new THREE.MeshStandardMaterial({ color: 0x0f0e0d, roughness: 0.4, metalness: 0.3 }));
  shoe.position.set(2.9, 0.225, -1.7); shoe.rotation.y = -0.35; shoe.castShadow = true; scene.add(shoe);
  const shoeTrim = new THREE.Mesh(new THREE.BoxGeometry(0.77, 0.04, 1.07), new THREE.MeshStandardMaterial({ color: 0xd9b56a, metalness: 1, roughness: 0.3 }));
  shoeTrim.position.copy(shoe.position); shoeTrim.position.y = 0.44; shoeTrim.rotation.y = shoe.rotation.y; scene.add(shoeTrim);
  const SHOE_MOUTH = new THREE.Vector3(2.55, 0.32, -1.25);

  // Cards: the player's ace of spades and king of hearts, the dealer's nine
  // up and one face down.
  const loader = new THREE.TextureLoader();
  const back = new THREE.MeshStandardMaterial({ map: cardBack(), roughness: 0.6 });
  const edge = new THREE.MeshStandardMaterial({ color: 0xb8ab8a, roughness: 0.7 });
  const cardGeo = new THREE.BoxGeometry(0.62, 0.87, 0.008);
  const card = (face) => {
    const t = loader.load(`${import.meta.env.BASE_URL}cards/hd/${face}.webp`);
    t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
    const m = new THREE.Mesh(cardGeo, [edge, edge, edge, edge, new THREE.MeshStandardMaterial({ map: t, roughness: 0.6 }), back]);
    m.castShadow = true;
    scene.add(m);
    return m;
  };
  // Dealing order: player, dealer, player, dealer (hole card stays down).
  const deals = [
    { mesh: card('A-S'), to: new THREE.Vector3(-0.36, 0, 1.2), yaw: 0.06, up: true },
    { mesh: card('9-D'), to: new THREE.Vector3(-0.36, 0, -1.05), yaw: -0.04, up: true },
    { mesh: card('K-H'), to: new THREE.Vector3(0.34, 0, 1.25), yaw: -0.08, up: true },
    { mesh: card('7-C'), to: new THREE.Vector3(0.34, 0, -1.0), yaw: 0.05, up: false },
  ];
  deals.forEach((d, i) => { d.to.y = 0.006 + i * 0.002; });

  // Chips: the player's bet, then the winnings from the dealer's tray.
  const chipGeo = new THREE.CylinderGeometry(0.21, 0.21, 0.05, 48);
  const chipMat = (face, spot) => {
    const f = new THREE.MeshStandardMaterial({ map: chipFace(face, spot), roughness: 0.7, envMapIntensity: 0.3 });
    return [new THREE.MeshStandardMaterial({ map: chipEdge(face[1], spot), roughness: 0.75 }), f, f];
  };
  const BLACK = chipMat(['#2c2c30', '#070708'], '#d9b56a');
  const GOLD = chipMat(['#e8c983', '#8a6a2c'], '#1a1a1c');
  const WINE = chipMat(['#6a1626', '#2a0610'], '#c4b89f');
  const BET = new THREE.Vector3(0, 0, 2.05);
  const mkChip = (mat) => { const c = new THREE.Mesh(chipGeo, mat); c.castShadow = true; c.receiveShadow = true; scene.add(c); return c; };
  const bet = [BLACK, GOLD, BLACK, WINE, BLACK].map(mkChip);
  const win = [GOLD, GOLD, BLACK, GOLD, WINE, GOLD, BLACK].map(mkChip);
  const WIN_AT = new THREE.Vector3(0.62, 0, 2.45);

  // From the seat, facing the dealer; then down to the felt for the hand.
  const camFrom = { pos: new THREE.Vector3(0, 6.4, SMALL ? 14 : 12), look: new THREE.Vector3(0, 4.6, -3.6) };
  const camTo = { pos: new THREE.Vector3(0, SMALL ? 4.6 : 3.9, SMALL ? 6.4 : 5.6), look: new THREE.Vector3(0, 0, 0.55) };
  const tmp = new THREE.Vector3();

  function pose(p) {
    // 0.00–0.22: the camera comes down to the seat.
    const c = span(p, 0, 0.22);
    camera.position.lerpVectors(camFrom.pos, camTo.pos, c);
    tmp.lerpVectors(camFrom.look, camTo.look, c);
    camera.lookAt(tmp);
    // 0.22–0.42: the bet slides in, chip by chip, and stacks.
    bet.forEach((chip, i) => {
      const k = span(p, 0.22 + i * 0.035, 0.3 + i * 0.035);
      chip.position.set(BET.x + (1 - k) * (i % 2 ? 0.4 : -0.4), 0.025 + i * 0.05 + (1 - k) * 0.6, BET.z + (1 - k) * 3.2);
      chip.rotation.set(0, i * 0.7 + (1 - k) * 3, 0);
      chip.visible = k > 0.001;
    });
    // 0.42–0.74: four cards off the shoe, along an arc, the player's turning up.
    deals.forEach((d, i) => {
      const k = span(p, 0.42 + i * 0.075, 0.52 + i * 0.075);
      d.mesh.visible = k > 0.001;
      d.mesh.position.lerpVectors(SHOE_MOUTH, d.to, k);
      d.mesh.position.y += Math.sin(Math.PI * k) * 0.55;
      const flip = d.up ? span(k, 0.35, 0.95) : 0;
      d.mesh.rotation.set(Math.PI / 2 - flip * Math.PI, 0, 0);
      d.mesh.rotateZ(d.yaw * k + (1 - k) * 0.9);
    });
    // 0.80–0.95: blackjack: the winnings slide over from the dealer.
    win.forEach((chip, i) => {
      const k = span(p, 0.8 + i * 0.016, 0.88 + i * 0.016);
      chip.visible = k > 0.001;
      chip.position.set(WIN_AT.x - (1 - k) * 0.6, 0.025 + i * 0.05 + Math.sin(Math.PI * k) * 0.3, WIN_AT.z - (1 - k) * 4);
      chip.rotation.set(0, i * 0.9 + (1 - k) * 4, 0);
    });
    // The light warms a little at the win.
    spot.intensity = 90 + span(p, 0.78, 0.9) * 40;
  }

  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  resize();
  window.addEventListener('resize', resize);

  // Progress through the pinned section: 0 as it reaches the top, 1 as it leaves.
  const section = canvas.closest('.story');
  let target = 0, shown = -1, visible = false;
  const measure = () => {
    const r = section.getBoundingClientRect();
    target = clamp01(-r.top / (r.height - innerHeight));
  };
  window.addEventListener('scroll', measure, { passive: true });
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; }).observe(section);
  measure();

  let p = target, last = performance.now();
  (function frame(now = performance.now()) {
    requestAnimationFrame(frame);
    const dt = Math.min(0.25, (now - last) / 1000); last = now;
    if (!visible) return;
    // A little smoothing, so a flick of the wheel glides; by time, not by
    // frame, so a slow device keeps up with the scroll.
    p += (target - p) * (1 - Math.exp(-dt * 9));
    if (Math.abs(target - p) < 0.0005) p = target;
    // The dealer breathes and shifts whether or not the page is scrolling.
    if (dealerMixer) { dealerMixer.update(dt); shown = -1; }
    if (Math.abs(p - shown) < 0.0004) return;
    shown = p;
    pose(p);
    renderer.render(scene, camera);
    if (onProgress) onProgress(p);
  })();
  pose(p); renderer.render(scene, camera);
  // In the dev server, any moment of the story on demand: __story(0.9).
  if (import.meta.env.DEV) window.__story = (v) => { p = target = shown = v; pose(v); renderer.render(scene, camera); if (onProgress) onProgress(v); };
  return { renderer };
}
