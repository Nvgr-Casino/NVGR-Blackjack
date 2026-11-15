// "Meet the house": the casino's dealers on a dark stage, each under a cone
// of warm light on a black pedestal ringed in gold, standing on the game's
// motion-captured idle. The camera drifts along the line of them and glides
// in on whoever is chosen; left alone it moves from one to the next.
// It draws only while on screen.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { loadFigure } from './figures3d.js';

const SMALL = window.matchMedia('(max-width: 760px)').matches;
const HEIGHT = 1.72;

// A soft cone of light, brightest at the lamp and fading to nothing.
function lightCone(height, radius) {
  const geo = new THREE.CylinderGeometry(0.05, radius, height, 48, 1, true);
  geo.translate(0, -height / 2, 0);
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    uniforms: { color: { value: new THREE.Color(0xffd9a0) }, h: { value: height } },
    vertexShader: 'varying float vY; varying vec3 vN; varying vec3 vV; void main(){ vY = position.y; vec4 mv = modelViewMatrix * vec4(position,1.); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }',
    fragmentShader: 'uniform vec3 color; uniform float h; varying float vY; varying vec3 vN; varying vec3 vV; void main(){ float along = clamp(1. + vY / h, 0., 1.); float rim = pow(abs(dot(vN, vV)), 1.6); gl_FragColor = vec4(color, along * along * rim * 0.16); }',
  });
  return new THREE.Mesh(geo, mat);
}

export function startHouse(canvas, roster, onFocus) {
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' }); } catch (e) { return null; }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, SMALL ? 1.5 : 1.75));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = !SMALL;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.setClearColor(0x070708, 1);

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x070708, 6, 15);
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.35;
  const camera = new THREE.PerspectiveCamera(SMALL ? 40 : 30, 1, 0.1, 60);

  scene.add(new THREE.HemisphereLight(0x8a8070, 0x000000, 0.3));
  const rim = new THREE.DirectionalLight(0xd8ccb8, 0.3); rim.position.set(-3, 4, -5); scene.add(rim);

  // The floor: black lacquer, a soft sheen rather than a mirror.
  const floor = new THREE.Mesh(new THREE.CircleGeometry(12, 96), new THREE.MeshStandardMaterial({ color: 0x080808, roughness: 0.5, metalness: 0.2, envMapIntensity: 0.12 }));
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
  // Behind them, a curved wall of dark fluted panels with fine gold seams,
  // like the walls of a private salon.
  const wallTex = (() => {
    const c = document.createElement('canvas'); c.width = 2048; c.height = 512;
    const ctx = c.getContext('2d');
    const panel = 2048 / 24;
    for (let i = 0; i < 24; i++) {
      const g = ctx.createLinearGradient(i * panel, 0, (i + 1) * panel, 0);
      g.addColorStop(0, '#0c0b0a'); g.addColorStop(0.5, '#1a1714'); g.addColorStop(1, '#0a0908');
      ctx.fillStyle = g; ctx.fillRect(i * panel, 0, panel, 512);
      ctx.fillStyle = 'rgba(217,181,106,0.55)'; ctx.fillRect(i * panel, 0, 2, 512);
    }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
    return t;
  })();
  const wall = new THREE.Mesh(new THREE.CylinderGeometry(9, 9, 7, 96, 1, true, Math.PI * 0.72, Math.PI * 0.56),
    new THREE.MeshStandardMaterial({ map: wallTex, side: THREE.BackSide, roughness: 0.7, metalness: 0.1, envMapIntensity: 0.2 }));
  wall.position.set(0, 3.5, 4.2);
  scene.add(wall);
  // A gold rail where the wall meets the floor.
  const railArc = new THREE.Mesh(new THREE.TorusGeometry(8.9, 0.03, 8, 160, Math.PI * 0.56), new THREE.MeshStandardMaterial({ color: 0xd9b56a, metalness: 1, roughness: 0.3, emissive: 0x3a2808, emissiveIntensity: 0.5 }));
  railArc.rotation.set(Math.PI / 2, 0, Math.PI * 1.22);
  railArc.position.set(0, 0.6, 4.2);
  scene.add(railArc);

  const gold = new THREE.MeshStandardMaterial({ color: 0xd9b56a, metalness: 1, roughness: 0.28, emissive: 0x3a2808, emissiveIntensity: 0.4 });
  const lacquer = new THREE.MeshStandardMaterial({ color: 0x111112, metalness: 0.3, roughness: 0.25 });

  // Five places along a gentle arc, facing the camera's side.
  const count = SMALL ? Math.min(3, roster.length) : roster.length;
  const spots = roster.slice(0, count).map((d, i) => {
    const t = count === 1 ? 0 : i / (count - 1) - 0.5;
    const a = t * (SMALL ? 0.7 : 1.05);
    const R = 6;
    const pos = new THREE.Vector3(Math.sin(a) * R, 0, R - Math.cos(a) * R - 1.2);
    const stand = new THREE.Group();
    stand.position.copy(pos);
    stand.lookAt(0, 0, 9);
    scene.add(stand);
    const plinth = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.6, 0.12, 64), lacquer);
    plinth.position.y = 0.06; plinth.receiveShadow = true; stand.add(plinth);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.585, 0.012, 12, 96), gold);
    ring.rotation.x = Math.PI / 2; ring.position.y = 0.12; stand.add(ring);
    const lamp = new THREE.SpotLight(0xffe0b0, 26, 9, 0.42, 0.55, 1.6);
    lamp.position.set(pos.x, 5.2, pos.z + 0.6);
    lamp.target.position.set(pos.x, 1, pos.z);
    lamp.castShadow = !SMALL && i === Math.floor(count / 2);
    if (lamp.castShadow) { lamp.shadow.mapSize.set(1024, 1024); lamp.shadow.bias = -0.0003; }
    scene.add(lamp, lamp.target);
    const cone = lightCone(5.1, 0.95);
    cone.position.set(pos.x, 5.2, pos.z);
    scene.add(cone);
    return { ...d, pos, stand, lamp, mixer: null };
  });

  // The dealers, each as their file arrives.
  spots.forEach((s) => {
    loadFigure(s.key, HEIGHT).then(({ group, mixer }) => {
      group.position.y = 0.12;
      s.stand.add(group);
      s.mixer = mixer;
    }).catch(() => { /* an empty plinth, then */ });
  });

  // Motes drifting through the light.
  const N = SMALL ? 260 : 600;
  const pts = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) { pts[i * 3] = (Math.random() - 0.5) * 12; pts[i * 3 + 1] = Math.random() * 5; pts[i * 3 + 2] = (Math.random() - 0.5) * 6 - 0.5; }
  const motesGeo = new THREE.BufferGeometry(); motesGeo.setAttribute('position', new THREE.BufferAttribute(pts, 3));
  const motes = new THREE.Points(motesGeo, new THREE.PointsMaterial({ color: 0xffe2a8, size: 0.025, transparent: true, opacity: 0.6, depthWrite: false, blending: THREE.AdditiveBlending }));
  scene.add(motes);

  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  resize();
  window.addEventListener('resize', resize);

  // Where the camera is going: the whole line, or one dealer close up.
  let focus = -1, auto = true, autoAt = performance.now() + 3500;
  const camPos = new THREE.Vector3(0, 1.75, 8.2), camLook = new THREE.Vector3(0, 1.2, 0);
  const wantPos = camPos.clone(), wantLook = camLook.clone();
  function aim() {
    if (focus < 0) { wantPos.set(0, 1.7, SMALL ? 9.4 : 8.2); wantLook.set(0, 1.15, 0); return; }
    const s = spots[focus];
    const toward = new THREE.Vector3(0, 0, 9).sub(s.pos).setY(0).normalize();
    wantPos.copy(s.pos).addScaledVector(toward, SMALL ? 3.4 : 2.9).setY(1.55);
    wantPos.x += SMALL ? 0 : 0.55;
    wantLook.copy(s.pos).setY(1.25);
    wantLook.x += SMALL ? 0 : 0.45;
  }
  function setFocus(i, byUser = false) {
    focus = i;
    if (byUser) { auto = false; }
    aim();
    spots.forEach((s, k) => { s.lamp.intensity = focus < 0 || k === focus ? 26 : 9; });
    if (onFocus) onFocus(focus);
  }
  aim();

  let visible = true, running = true;
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; }).observe(canvas);
  document.addEventListener('visibilitychange', () => { running = !document.hidden; });

  // A little parallax with the pointer.
  const lean = { x: 0, y: 0 };
  canvas.addEventListener('pointermove', (e) => {
    const r = canvas.getBoundingClientRect();
    lean.x = ((e.clientX - r.left) / r.width - 0.5) * 2;
    lean.y = ((e.clientY - r.top) / r.height - 0.5) * 2;
  }, { passive: true });

  const clock = new THREE.Clock();
  (function frame(now = performance.now()) {
    requestAnimationFrame(frame);
    const dt = Math.min(clock.getDelta(), 0.1);
    if (!visible || !running) return;
    if (auto && now > autoAt) { setFocus((focus + 1) % spots.length); autoAt = now + 4200; }
    const k = 1 - Math.exp(-dt * 2.2);
    camPos.lerp(wantPos, k); camLook.lerp(wantLook, k);
    camera.position.set(camPos.x + lean.x * 0.25, camPos.y - lean.y * 0.12, camPos.z);
    camera.lookAt(camLook);
    spots.forEach((s) => { if (s.mixer) s.mixer.update(dt); });
    const p = motesGeo.attributes.position.array;
    for (let i = 1; i < p.length; i += 3) { p[i] += dt * 0.12; if (p[i] > 5) p[i] = 0; }
    motesGeo.attributes.position.needsUpdate = true;
    renderer.render(scene, camera);
  })();

  return { setFocus: (i) => setFocus(i, true), resume: () => { auto = true; autoAt = performance.now() + 2500; }, count: spots.length };
}
