import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { createTable } from './table.js';
import { createChipStack } from './chip.js';
import { createDeckStack, playShuffle } from './deal.js';
import { createChair } from './avatar.js';
import { updateSeatedCharacters } from './character.js';
import { createDealerFigure, setDealerModel, startDealerIdle, updateDealerAnimations } from './dealer.js';
import { createBetRing, createCardShoe, createChipTray } from './props.js';
import { createRoom, ROOM_HALF } from './room.js';
import { TABLE_BACK_Z } from './table.js';
import { SEATS, DEALER, cameraPositionForSeat, cameraLookAtForSeat } from './seats.js';
import { tickAnimations } from './animator.js';
import { cameraOverride } from './cameraFocus.js';

// Step 1-2: static table + deal animation. Step 3 (current): seats, a
// dealer figure, and empty chairs around the table — no fixed "you" seat or
// placeholder AI players; src/ui/gameController.js's seat picker decides
// which seat is yours at runtime, and only that seat's chair gets hidden.
export function initScene(canvas) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x140407);
  // Fog now only has to soften the far corners of a real room, not stand in
  // for a horizon — pulled back from 9–20, which at these distances would
  // have greyed the far wall (and the house sign on it) into nothing.
  scene.fog = new THREE.Fog(0x140407, 16, 44);

  const camera = new THREE.PerspectiveCamera(
    54,
    window.innerWidth / window.innerHeight,
    0.1,
    100
  );
  // Wide enough, and pulled back far enough (see cameraPositionForSeat), to
  // keep the dealer's cards and every seat's hand spot in frame at once —
  // a tighter, closer framing left no single seat's view able to show
  // enough of the table to follow the round. Default to the center seat's
  // view until the player picks one; gameController.js repositions this
  // once they do.
  const openingSeat = SEATS[2];
  camera.position.copy(cameraPositionForSeat(openingSeat));
  camera.lookAt(cameraLookAtForSeat(openingSeat));

  // Phones are fill-rate bound, not triangle bound — this scene is only
  // ~29k triangles, so nothing is limited by geometry. What costs is every
  // *pixel*: a phone at devicePixelRatio 3 asks for nine times the fragments
  // of a 1x screen, and each one then pays for every light in the scene and
  // a shadow lookup on top. So the mobile tier trims per-pixel work — a
  // smaller shadow map, fewer decorative lights — rather than detail.
  const lowPower = window.matchMedia('(pointer: coarse)').matches || window.innerWidth < 820;

  // Render resolution, though, is not guessed from the device any more.
  // Capping phones at 1.5x while their screens are 3x meant the whole image
  // was drawn at half resolution and upscaled — which is what "everything
  // looks low quality" actually was, cards included; their textures were
  // never the limit. Everyone now starts at full quality and the renderer
  // measures whether the device can hold it (see adaptQuality), so a fast
  // phone keeps a sharp picture and only a struggling one gives resolution
  // up. Antialiasing is on everywhere for the same reason.
  const DPR_STEPS = [2, 1.5, 1.25, 1];
  let dprStep = 0;
  const applyPixelRatio = () => renderer.setPixelRatio(Math.min(window.devicePixelRatio, DPR_STEPS[dprStep]));

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  applyPixelRatio();
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = lowPower ? THREE.PCFShadowMap : THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  // Lifted from 0.82. The whole room was reading as dull and murky — ACES
  // rolls highlights off hard, and at that exposure the felt, the gold and
  // the figures all sat in the bottom of the curve together with nothing
  // bright enough to give the picture any snap.
  renderer.toneMappingExposure = 1.15;

  // PBR environment lighting so the gold rim and chip metal actually pick up
  // reflections instead of looking flat-lit.
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.maxPolarAngle = Math.PI / 2.15;
  // Now that the table is inside a room, the orbit has to stay inside it
  // too: pulling back past the walls, or rising above the ceiling, would
  // put the camera outside a box whose faces are all pointing inward — you
  // would look straight through the back of a wall into the void. These two
  // limits keep the camera in the room at every distance it can reach.
  controls.minPolarAngle = Math.PI / 3;
  controls.minDistance = 3;
  controls.maxDistance = ROOM_HALF - 2;
  controls.target.copy(cameraLookAtForSeat(openingSeat));

  // Ambient is the one light that costs essentially nothing per fragment —
  // no position, no attenuation, no shadow. So the mobile tier spends its
  // savings here: dropping three point lights left the carpet and the far
  // corners nearly black, and this buys that brightness back without
  // buying back the cost.
  const ambient = new THREE.AmbientLight(0xfff2d0, lowPower ? 0.95 : 0.7);
  scene.add(ambient);

  const key = new THREE.DirectionalLight(0xfff2d0, 1.25);
  key.position.set(3, 8, 4);
  key.castShadow = true;
  key.shadow.mapSize.set(lowPower ? 1024 : 2048, lowPower ? 1024 : 2048);
  key.shadow.camera.left = -9;
  key.shadow.camera.right = 9;
  key.shadow.camera.top = 9;
  key.shadow.camera.bottom = -9;
  key.shadow.camera.near = 1;
  key.shadow.camera.far = 20;
  key.shadow.bias = -0.0015;
  scene.add(key);

  // Every point light is paid for by every lit fragment on screen, so the
  // purely decorative one stands down on phones. The room's own sconces do
  // the same job from the walls.
  if (!lowPower) {
    const rimLight = new THREE.PointLight(0xeac35e, 0.5, 14);
    rimLight.position.set(-4, 3, -3);
    scene.add(rimLight);
  }

  // Overhead pendant lamp — a casino-style hanging light over the table.
  const pendant = createPendantLamp();
  scene.add(pendant);

  // The room the table stands in — carpet, panelled walls, ceiling and the
  // house signage. Static, so it is built once and never touched again.
  scene.add(createRoom({ lowPower }));

  const table = createTable();
  scene.add(table);

  const deck = createDeckStack();
  scene.add(deck);

  // The dealer's chip tray and card shoe sit directly on the felt, right at
  // the back edge in front of the dealer — a raised wooden rail bench used
  // to hold them instead, which read as a clumsy platform bolted onto the
  // table rather than gear actually resting on the felt.
  const dealerGearZ = TABLE_BACK_Z + 0.3;

  const tray = createChipTray(1.1);
  tray.position.set(-0.75, 0.03, dealerGearZ);
  scene.add(tray);

  [0, 1, 2].forEach((colorIndex, i) => {
    const stack = createChipStack(3 + colorIndex, colorIndex);
    stack.position.set(-1.05 + i * 0.32, 0.06, dealerGearZ);
    scene.add(stack);
  });

  const shoe = createCardShoe();
  shoe.position.set(0.75, 0.03, dealerGearZ);
  scene.add(shoe);

  // No chair for the dealer — they stand, like every real one.

  const dealer = createDealerFigure();
  dealer.position.copy(DEALER.position);
  scene.add(dealer);
  startDealerIdle(dealer);

  // Every seat gets a chair — none is fixed as "yours". gameController.js's
  // seat picker hides whichever chair the player has actually chosen (that
  // seat becomes the camera's own point of view) and shows it again if they
  // switch away.
  const chairsBySeat = new Map();
  SEATS.forEach((seat) => {
    const ring = createBetRing(0.22);
    ring.position.copy(seat.betSpot);
    scene.add(ring);

    const chair = createChair();
    chair.position.copy(seat.position);
    chair.rotation.y = seat.facingAngle;
    scene.add(chair);
    chairsBySeat.set(seat.index, chair);
  });

  window.addEventListener('resize', onResize);

  // A perspective camera's fov is vertical, so on a narrow phone screen the
  // horizontal view collapses and the table falls out of frame at the
  // sides. Holding the *horizontal* field of view constant instead means
  // the table stays framed the same way at any aspect ratio, portrait
  // included — the view just gets taller rather than cropping inward.
  const BASE_FOV = 54;
  const BASE_ASPECT = 16 / 9;
  const H_FOV = 2 * Math.atan(Math.tan((BASE_FOV * Math.PI) / 360) * BASE_ASPECT);
  // On a phone held upright the aspect falls to about 0.46, and holding the
  // horizontal view fixed there demands a vertical fov of ~126°. The old
  // ceiling of 100° was still far too wide: it framed the table as a small
  // island with a third of the screen given to ceiling above and empty
  // carpet below. 80° is the tightest framing that still keeps every seat's
  // hand and bet spot comfortably on screen (checked by projecting the
  // outermost ones — they land at 0.57 and 0.78 of half-width), and it puts
  // the table, the dealer and the house sign where they belong.
  const MAX_FOV = 80;
  function onResize() {
    const aspect = window.innerWidth / window.innerHeight;
    camera.aspect = aspect;
    camera.fov = aspect < BASE_ASPECT
      ? Math.min(MAX_FOV, (2 * Math.atan(Math.tan(H_FOV / 2) / aspect) * 180) / Math.PI)
      : BASE_FOV;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  }
  onResize();

  // Watches how long frames are actually taking and gives up resolution only
  // if the device cannot hold a smooth one. It only ever steps down, never
  // back up: a system that also climbs will oscillate around whatever level
  // is marginal, and a picture that keeps changing sharpness is worse than
  // one that settles slightly soft. The first few seconds are ignored
  // because models and textures are still being decoded then, and judging
  // the device on that would downgrade everyone.
  const SETTLE_MS = 4000;
  const WINDOW_FRAMES = 60;
  const SLOW_FRAME_MS = 22;   // ~45fps; below this and it reads as juddery
  const startedAt = performance.now();
  let windowFrames = [];
  let slowWindows = 0;

  function adaptQuality(frameMs, now) {
    if (now - startedAt < SETTLE_MS || dprStep >= DPR_STEPS.length - 1) return;
    // A backgrounded tab has its frame callbacks throttled to a crawl or
    // stopped outright, so those gaps say nothing about how fast the device
    // is — counting them would quietly downgrade anyone who switched tabs.
    if (document.hidden || frameMs > 100) { windowFrames = []; return; }
    windowFrames.push(frameMs);
    if (windowFrames.length < WINDOW_FRAMES) return;
    // Median, not mean: one stall while a texture uploads shouldn't count as
    // the device being slow.
    const median = windowFrames.slice().sort((a, b) => a - b)[WINDOW_FRAMES >> 1];
    windowFrames = [];
    // Two bad windows in a row, so a single hiccup doesn't cost sharpness.
    slowWindows = median > SLOW_FRAME_MS ? slowWindows + 1 : 0;
    if (slowWindows >= 2) {
      slowWindows = 0;
      dprStep++;
      applyPixelRatio();
    }
  }

  const clock = new THREE.Clock();
  let lastFrame = performance.now();
  function animate() {
    requestAnimationFrame(animate);
    const now = performance.now();
    adaptQuality(now - lastFrame, now);
    lastFrame = now;
    tickAnimations();
    const delta = clock.getDelta();
    updateDealerAnimations(delta);
    updateSeatedCharacters(delta);
    if (!cameraOverride.active) controls.update();
    renderer.render(scene, camera);
  }
  animate();

  // Dev-only handle for poking at the scene from the console. tickDealer is
  // this module's own bound copy of the animation step: importing the
  // dealer module from the console gets a second instance with its own
  // (empty) set of active dealers, so stepping it there silently does
  // nothing and makes the figure look frozen when it isn't.
  if (import.meta.env.DEV) {
    window.__nvgr = {
      scene, camera, dealer, deck, renderer, controls,
      tickDealer: updateDealerAnimations,
      // This module's own bound copies, for the same reason as tickDealer:
      // importing them from the console gets a second instance whose
      // animation queue nothing is draining.
      tickAnimations, shuffleDeck: () => playShuffle(deck),
    };
  }

  return {
    scene, camera, renderer, controls, dealer, deck, chairsBySeat,
    setFeltTheme: table.userData.setFeltTheme,
    setDealerModel: (key) => setDealerModel(dealer, key),
  };
}

function createPendantLamp() {
  const group = new THREE.Group();
  group.position.set(0, 4.2, -1.6);

  const cordMat = new THREE.MeshStandardMaterial({ color: 0x1c1c1c, roughness: 0.6 });
  const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 2.2, 8), cordMat);
  cord.position.y = 1.1;
  group.add(cord);

  const shadeMat = new THREE.MeshStandardMaterial({
    color: 0x2a0e12,
    roughness: 0.5,
    metalness: 0.2,
    emissive: 0x3a1010,
    emissiveIntensity: 0.3,
  });
  const shade = new THREE.Mesh(new THREE.ConeGeometry(0.55, 0.4, 24, 1, true), shadeMat);
  shade.position.y = -0.05;
  // Deliberately no castShadow: this hangs directly over the table and its
  // shadow was the mystery "stripe" across the felt that survived every
  // material/lighting fix — a decorative shade doesn't need a real shadow.
  group.add(shade);

  const rimMat = new THREE.MeshStandardMaterial({ color: 0xd4af52, roughness: 0.3, metalness: 0.7 });
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.025, 8, 32), rimMat);
  rim.rotation.x = Math.PI / 2;
  rim.position.y = -0.25;
  group.add(rim);

  const bulb = new THREE.PointLight(0xffdc9a, 1.6, 9, 2);
  bulb.position.y = -0.3;
  group.add(bulb);

  const bulbMesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.07, 12, 10),
    new THREE.MeshStandardMaterial({ color: 0xfff2c2, emissive: 0xffdc9a, emissiveIntensity: 1.2 })
  );
  bulbMesh.position.y = -0.28;
  group.add(bulbMesh);

  return group;
}
