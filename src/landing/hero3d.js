// The front page's hero: casino chips and playing cards drifting in a dark
// sky over a fine gold grid that runs to the horizon, lit warm and cool
// white, with motes of gold light. The camera follows the pointer (or the
// phone's tilt) a little, and the whole scene sinks away as you scroll.
// It draws only while on screen, and gives up quietly where WebGL can't run.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { canvasTex, chipFace, chipEdge, cardBack } from './props3d.js';

const SMALL = window.matchMedia('(max-width: 760px)').matches;

export function startHero(canvas) {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: !SMALL, alpha: true, powerPreference: 'high-performance' });
  } catch (e) { return null; }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, SMALL ? 1.5 : 1.75));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.85;

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x05030a, 0.03);
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

  const camera = new THREE.PerspectiveCamera(SMALL ? 58 : 42, 1, 0.1, 200);
  camera.position.set(0, 1.2, 12);

  // Light: warm gold from above, warm and cool white from either side.
  scene.add(new THREE.AmbientLight(0x3a3630, 0.35));
  const key = new THREE.DirectionalLight(0xffe2a8, 0.95); key.position.set(2, 6, 6); scene.add(key);
  const magenta = new THREE.PointLight(0xffd9a0, 14, 26); magenta.position.set(-7, 1, 3); scene.add(magenta);
  const cyan = new THREE.PointLight(0xdfe6f2, 12, 26); cyan.position.set(7, -1, 3); scene.add(cyan);

  // The grid floor, fine gold lines fading into the fog.
  const grid = new THREE.GridHelper(160, 80, 0x8a6c38, 0x2a2620);
  grid.position.y = -3.2;
  grid.material.transparent = true; grid.material.opacity = 0.8;
  scene.add(grid);
  // A glowing horizon line behind it all.
  const horizon = new THREE.Mesh(new THREE.PlaneGeometry(200, 0.08), new THREE.MeshBasicMaterial({ color: new THREE.Color(0xffe2a8).multiplyScalar(1.6) }));
  horizon.position.set(0, -3.1, -60); scene.add(horizon);

  const group = new THREE.Group();
  scene.add(group);
  const floaters = [];
  const rand = (a, b) => a + Math.random() * (b - a);

  // Chips.
  // Black, ivory, gold and a deep wine: the colours of a high-limit table.
  const CHIPS = [
    [['#2c2c30', '#070708'], '#d9b56a'], [['#d8ceb6', '#8f846e'], '#1a1a1c'],
    [['#e8c983', '#8a6a2c'], '#1a1a1c'], [['#6a1626', '#2a0610'], '#c4b89f'], [['#2c2c30', '#070708'], '#c4b89f'],
  ];
  const chipGeo = new THREE.CylinderGeometry(0.62, 0.62, 0.14, 64, 1);
  const chipCount = SMALL ? 9 : 14;
  for (let i = 0; i < chipCount; i++) {
    const [face, spot] = CHIPS[i % CHIPS.length];
    const faceTex = chipFace(face, spot);
    // Satin, not gloss: a chip shows its colours, not a glare.
    const faceMat = new THREE.MeshStandardMaterial({ map: faceTex, roughness: 0.72, metalness: 0, envMapIntensity: 0.22 });
    const edgeMat = new THREE.MeshStandardMaterial({ map: chipEdge(face[1], spot), roughness: 0.75, envMapIntensity: 0.2 });
    const chip = new THREE.Mesh(chipGeo, [edgeMat, faceMat, faceMat]);
    floaters.push({ obj: chip, spin: new THREE.Vector3(rand(-0.6, 0.6), rand(-0.9, 0.9), rand(-0.4, 0.4)) });
  }
  // Cards: aces and kings face up, and a few backs.
  const loader = new THREE.TextureLoader();
  const backTex = cardBack();
  const cardGeo = new THREE.BoxGeometry(1.25, 1.75, 0.012);
  const FACES = ['A-S', 'K-H', 'A-H', 'Q-S', 'A-D', 'K-S'];
  const cardCount = SMALL ? 5 : 8;
  for (let i = 0; i < cardCount; i++) {
    const faceTex = loader.load(`${import.meta.env.BASE_URL}cards/hd/${FACES[i % FACES.length]}.webp`);
    faceTex.colorSpace = THREE.SRGBColorSpace; faceTex.anisotropy = 8;
    const edge = new THREE.MeshStandardMaterial({ color: 0xa8996f, roughness: 0.7, envMapIntensity: 0.3 });
    const front = new THREE.MeshStandardMaterial({ map: faceTex, color: 0xd8d2c4, roughness: 0.7, envMapIntensity: 0.25 });
    const back = new THREE.MeshStandardMaterial({ map: backTex, roughness: 0.6, envMapIntensity: 0.3, emissive: 0x000000, emissiveIntensity: 0 });
    const card = new THREE.Mesh(cardGeo, [edge, edge, edge, edge, front, back]);
    floaters.push({ obj: card, spin: new THREE.Vector3(rand(-0.4, 0.4), rand(-0.7, 0.7), rand(-0.3, 0.3)) });
  }
  // Scattered round the middle, leaving the title clear.
  floaters.forEach((f, i) => {
    const side = i % 2 ? 1 : -1;
    // Nearer pieces sit further out, so none crosses the words in the middle.
    const z = rand(-6, 2.5);
    // (Distant ones further out too: perspective pulls them toward the middle.)
    const x = side * (rand(SMALL ? 1.8 : 3.8, SMALL ? 4.2 : 8.5) * (12 - z) / 12 + Math.max(0, z) * 0.6);
    f.home = new THREE.Vector3(x, rand(-2.4, 3.4), z);
    f.obj.position.copy(f.home);
    f.obj.rotation.set(rand(0, Math.PI), rand(0, Math.PI), rand(0, Math.PI));
    f.bob = rand(0, Math.PI * 2);
    f.bobSpeed = rand(0.4, 0.9);
    group.add(f.obj);
  });

  // Motes of light rising slowly.
  const N = SMALL ? 500 : 1200;
  const pos = new Float32Array(N * 3), col = new Float32Array(N * 3);
  const palette = [new THREE.Color(0xffd98a), new THREE.Color(0xfff1d0), new THREE.Color(0xc9a35a), new THREE.Color(0xffffff)];
  for (let i = 0; i < N; i++) {
    pos[i * 3] = rand(-30, 30); pos[i * 3 + 1] = rand(-3, 16); pos[i * 3 + 2] = rand(-40, 8);
    const c = palette[i % palette.length]; col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
  }
  const motesGeo = new THREE.BufferGeometry();
  motesGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  motesGeo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const dot = canvasTex(64, 64, (ctx) => { const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(1, 'rgba(255,255,255,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, 64, 64); });
  const motes = new THREE.Points(motesGeo, new THREE.PointsMaterial({ size: 0.12, map: dot, vertexColors: true, color: new THREE.Color(2, 2, 2), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  scene.add(motes);

  // Bloom for the neon.
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  // Only the brightest things glow: the grid, the horizon, the motes.
  const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.3, 0.4, 1.0);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    composer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  resize();
  window.addEventListener('resize', resize);

  // The pointer (or tilt) leans the camera; scrolling sinks the scene.
  const aim = { x: 0, y: 0 }, look = { x: 0, y: 0 };
  window.addEventListener('pointermove', (e) => { aim.x = (e.clientX / innerWidth) * 2 - 1; aim.y = (e.clientY / innerHeight) * 2 - 1; }, { passive: true });
  window.addEventListener('deviceorientation', (e) => { if (e.gamma == null) return; aim.x = Math.max(-1, Math.min(1, e.gamma / 30)); aim.y = Math.max(-1, Math.min(1, (e.beta - 45) / 30)); }, { passive: true });

  let visible = true, running = true;
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; }).observe(canvas);
  document.addEventListener('visibilitychange', () => { running = !document.hidden; });

  const clock = new THREE.Clock();
  function frame() {
    requestAnimationFrame(frame);
    if (!visible || !running) { clock.getDelta(); return; }
    const dt = Math.min(clock.getDelta(), 0.05), t = clock.elapsedTime;
    look.x += (aim.x - look.x) * 0.04; look.y += (aim.y - look.y) * 0.04;
    const scroll = Math.min(1, window.scrollY / innerHeight);
    camera.position.x = look.x * 1.4;
    camera.position.y = 1.2 - look.y * 0.8 + scroll * 3;
    camera.lookAt(0, 0.4 + scroll * 1.5, 0);
    floaters.forEach((f) => {
      f.obj.rotation.x += f.spin.x * dt; f.obj.rotation.y += f.spin.y * dt; f.obj.rotation.z += f.spin.z * dt;
      f.obj.position.y = f.home.y + Math.sin(t * f.bobSpeed + f.bob) * 0.35 - scroll * 2;
    });
    grid.position.z = (t * 1.6) % 2;
    const p = motesGeo.attributes.position.array;
    for (let i = 1; i < p.length; i += 3) { p[i] += dt * 0.25; if (p[i] > 16) p[i] = -3; }
    motesGeo.attributes.position.needsUpdate = true;
    magenta.intensity = 14 + Math.sin(t * 0.8) * 3;
    cyan.intensity = 12 + Math.cos(t * 0.7) * 3;
    composer.render();
  }
  frame();
  return { renderer };
}
