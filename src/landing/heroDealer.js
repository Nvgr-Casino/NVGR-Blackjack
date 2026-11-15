// The front page's opening shot: Victor, one of the casino's own dealers,
// in a film close-up: a warm key light from the front left, a cool emerald
// rim from behind on one side and a warm one on the other, the rest of the
// frame falling away to black. He stands on the game's motion-captured
// idle, and over it his neck and head turn toward the visitor's pointer
// (on a phone, their touch); left alone he glances about on his own.
// Draws only while on screen.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { loadFigure } from './figures3d.js';

const NARROW = () => window.innerWidth < 900;

export function startHeroDealer(canvas, { onReady } = {}) {
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' }); } catch (e) { return null; }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.18;

  // A portrait lens.
  const camera = new THREE.PerspectiveCamera(24, 1, 0.1, 50);

  // Film lighting.
  scene.add(new THREE.HemisphereLight(0x6f6a60, 0x050606, 0.25));
  const key = new THREE.SpotLight(0xffe2bc, 42, 12, 0.5, 0.65, 1.4);
  key.position.set(-1.6, 2.7, 2.4); key.target.position.set(0, 1.45, 0);
  scene.add(key, key.target);
  const rimCool = new THREE.SpotLight(0x5fd6b0, 30, 10, 0.5, 0.8, 1.4);
  rimCool.position.set(1.7, 2.2, -1.6); rimCool.target.position.set(0, 1.4, 0);
  scene.add(rimCool, rimCool.target);
  const rimWarm = new THREE.SpotLight(0xffb36b, 18, 10, 0.5, 0.8, 1.4);
  rimWarm.position.set(-1.8, 2.0, -1.4); rimWarm.target.position.set(0, 1.4, 0);
  scene.add(rimWarm, rimWarm.target);

  let figure = null;
  loadFigure('m4', 1.78).then((f) => {
    figure = f;
    figure.group.rotation.y = 0;
    scene.add(figure.group);
    if (onReady) onReady();
  }).catch(() => { /* the words stand alone */ });

  // Framing: chest up, with the head a little above the middle. On a wide
  // screen he stands right of centre (the words are on the left); narrow,
  // he is centred in the upper part.
  function frame() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    const narrow = NARROW();
    camera.fov = narrow ? 27 : 24;
    camera.position.set(0, narrow ? 1.52 : 1.42, narrow ? 2.5 : 2.6);
    camera.lookAt(0, narrow ? 1.4 : 1.36, 0);
    camera.clearViewOffset();
    // Slide the picture so he sits about two thirds across. (On a narrow
    // screen the canvas itself is only the top half, above the words.)
    if (!narrow) camera.setViewOffset(w, h, -w * 0.2, 0, w, h);
    camera.updateProjectionMatrix();
  }
  frame();
  window.addEventListener('resize', frame);

  // Where the visitor is pointing, as -1..1 relative to his head on screen.
  const aim = { x: 0, y: 0, at: 0 };
  const onPoint = (x, y) => {
    if (!figure) return;
    const head = figure.bones.head || figure.bones.neck;
    if (!head) return;
    const p = head.getWorldPosition(new THREE.Vector3()).project(camera);
    const r = canvas.getBoundingClientRect();
    const hx = r.left + (p.x + 1) / 2 * r.width, hy = r.top + (1 - p.y) / 2 * r.height;
    aim.x = Math.max(-1, Math.min(1, (x - hx) / (window.innerWidth * 0.45)));
    aim.y = Math.max(-1, Math.min(1, (y - hy) / (window.innerHeight * 0.55)));
    aim.at = performance.now();
  };
  window.addEventListener('pointermove', (e) => onPoint(e.clientX, e.clientY), { passive: true });
  window.addEventListener('touchstart', (e) => { const t = e.touches[0]; if (t) onPoint(t.clientX, t.clientY); }, { passive: true });
  window.addEventListener('touchmove', (e) => { const t = e.touches[0]; if (t) onPoint(t.clientX, t.clientY); }, { passive: true });

  // Turns a bone about a world axis, on top of whatever the idle set.
  const qa = new THREE.Quaternion(), qb = new THREE.Quaternion(), qc = new THREE.Quaternion();
  const UP = new THREE.Vector3(0, 1, 0), RIGHT = new THREE.Vector3(1, 0, 0);
  function turn(bone, axis, angle) {
    if (!bone || !angle) return;
    bone.getWorldQuaternion(qa);
    qb.setFromAxisAngle(axis, angle).multiply(qa);
    bone.parent.getWorldQuaternion(qc);
    bone.quaternion.copy(qc.invert().multiply(qb));
    bone.updateMatrixWorld(true);
  }

  let visible = true, running = true;
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; }).observe(canvas);
  document.addEventListener('visibilitychange', () => { running = !document.hidden; });

  const look = { yaw: 0, pitch: 0 };
  const clock = new THREE.Clock();
  (function tick(now = performance.now()) {
    requestAnimationFrame(tick);
    const dt = Math.min(clock.getDelta(), 0.1);
    if (!visible || !running) return;
    if (figure) {
      figure.mixer.update(dt);
      figure.group.updateMatrixWorld(true);
      // Left alone a few seconds, he glances about the room by himself.
      let tx = aim.x, ty = aim.y;
      if (now - aim.at > 3500) {
        const t = now / 1000;
        tx = Math.sin(t * 0.35) * 0.55 + Math.sin(t * 0.9) * 0.12;
        ty = Math.sin(t * 0.27 + 1) * 0.25;
      }
      const k = 1 - Math.exp(-dt * 4);
      look.yaw += (tx * 0.6 - look.yaw) * k;
      // Up a fair way, down only a little: looking far down, his eyes seem shut.
      const pitchTo = ty < 0 ? ty * 0.26 : ty * 0.09;
      look.pitch += (pitchTo - look.pitch) * k;
      // The neck takes a share, the head the rest, as a person turns.
      turn(figure.bones.neck, UP, look.yaw * 0.4);
      turn(figure.bones.neck, RIGHT, look.pitch * 0.4);
      turn(figure.bones.head, UP, look.yaw * 0.6);
      turn(figure.bones.head, RIGHT, look.pitch * 0.6);
    }
    // The light breathes, very slightly.
    rimCool.intensity = 30 + Math.sin(now / 1800) * 4;
    renderer.render(scene, camera);
  })();
  return { renderer };
}
