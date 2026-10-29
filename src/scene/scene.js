import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { createTable } from './table.js';
import { createPokerTable, POKER_SEATS_3D, POKER_DEALER } from './pokerTable.js';
import { playShoeShuffle } from './shuffle.js';
import { place } from './furniture.js';
import { updateSeatedCharacters } from './character.js';
import { createDealerFigure, setDealerModel, startDealerIdle, updateDealerAnimations } from './dealer.js';
import { createBetRing, createCardShoe, createChipRack, createDiscardHolder, SHOE_MOUTH } from './props.js';
import { createRoom, disposeRoom, ROOM_HALF, CEILING_Y } from './room.js';
import { FLOOR_Y, m } from './scale.js';
import { SEATS, DEALER, cameraPositionForSeat, cameraLookAtForSeat } from './seats.js';
import { tickAnimations } from './animator.js';
import { cameraOverride } from './cameraFocus.js';

// Step 1-2: static table + deal animation. Step 3 (current): seats, a
// dealer figure, and empty chairs around the table — no fixed "you" seat or
// placeholder AI players; src/ui/gameController.js's seat picker decides
// which seat is yours at runtime, and only that seat's chair gets hidden.
export function initScene(canvas) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0b0908);
  // Softens only the far corners; the room's darkness does the rest.
  scene.fog = new THREE.Fog(0x0b0908, 18, 44);

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
  // Never below 1x. Steps under that bought a few frames at the cost of the
  // whole picture going soft — the cards most of all, being the finest
  // detail on screen — and a blurred card is worse than a slightly slower
  // one. The finer steps at the top let a capable GPU keep more sharpness.
  const DPR_STEPS = [2, 1.75, 1.5, 1.25, 1];
  let dprStep = 0;
  const applyPixelRatio = () => renderer.setPixelRatio(Math.min(window.devicePixelRatio, DPR_STEPS[dprStep]));

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  applyPixelRatio();
  renderer.shadowMap.enabled = true;
  // Plain PCF everywhere: the soft variant's extra taps cost about a quarter
  // of the frame on integrated graphics, for edges hardly anyone notices.
  renderer.shadowMap.type = THREE.PCFShadowMap;
  // AgX rather than ACES: ACES pushes saturated colours toward neon as they
  // brighten, which is a good part of why the red felt and the gold glared.
  // AgX rolls them off toward white the way film does, so the felt stays
  // cloth-coloured under the light.
  renderer.toneMapping = THREE.AgXToneMapping;
  renderer.toneMappingExposure = 1.0;

  // A faint environment, so metal and leather have something soft to
  // reflect. At full strength it put a white sheen on every surface — the
  // "shiny" look — so it is kept well down.
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.3;

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

  // Lighting is how a real table is lit: one pool of warm light from the
  // ceiling panel straight above the felt, falling off into a dim room,
  // plus a low fill so faces in the chairs never go black. Two lights in
  // all, no point lights — cheaper than the five it replaces, and it is the
  // falloff, not more light, that makes the table the thing you look at.
  const fill = new THREE.HemisphereLight(0xf3e6d2, 0x2a1d16, lowPower ? 1.1 : 0.9);
  scene.add(fill);

  const key = new THREE.SpotLight(0xffe7c8, 60, 0, 0.78, 0.65, 2);
  key.position.set(0, CEILING_Y - 0.2, -0.4);
  key.target.position.set(0, FLOOR_Y, -0.2);
  scene.add(key.target);
  key.castShadow = true;
  const SHADOW_MAP = lowPower ? 1024 : 1536;
  key.shadow.mapSize.set(SHADOW_MAP, SHADOW_MAP);
  key.shadow.camera.near = 2;
  key.shadow.camera.far = 12;
  key.shadow.bias = -0.0008;
  key.shadow.normalBias = 0.02;
  scene.add(key);

  // A soft wash down the back wall, behind the dealer, so the consoles and
  // paintings there read in the dark rather than disappearing into it. No
  // shadow: it lights only the wall's dressing.
  const wash = new THREE.SpotLight(0xffdcb4, 30, 0, 0.75, 0.9, 2);
  wash.position.set(0, CEILING_Y - 0.3, -ROOM_HALF + 4);
  wash.target.position.set(0, FLOOR_Y + m(1.2), -ROOM_HALF);
  scene.add(wash.target);
  scene.add(wash);

  // The room the table stands in — carpet, walls, ceiling, fittings and
  // furniture — one per stakes tier (rooms.js). Built for the middle tier
  // to begin with; the table's own room replaces it once the room is known
  // (setRoomTheme, from table3dBridge.js).
  let room = null;
  let roomTier = 0;
  function setRoomTheme(tier) {
    if (tier === roomTier) return;
    roomTier = tier;
    const next = createRoom(tier);
    if (room) { scene.remove(room); disposeRoom(room); }
    room = next;
    scene.add(room);
    // The table's light hangs from this room's ceiling, and the wash lights
    // this room's back wall.
    const { half, ceiling } = room.userData.dims;
    key.position.y = ceiling - 0.2;
    wash.position.set(0, ceiling - 0.3, -half + 4);
    wash.target.position.set(0, FLOOR_Y + m(1.2), -half);
    const l = room.userData.theme.light;
    fill.color.setHex(l.sky);
    fill.groundColor.setHex(l.ground);
    fill.intensity = l.fill * (lowPower ? 1.2 : 1);
    key.color.setHex(l.key);
    key.intensity = l.keyPower;
    wash.color.setHex(l.wash);
    wash.intensity = l.washPower;
    scene.background.setHex(l.fog);
    scene.fog.color.setHex(l.fog);
  }
  setRoomTheme(3);

  // Two tables, one shown at a time (setGame): the blackjack table with its
  // shoe, rack, discard holder, circles and five chairs, and the Hold'em
  // table with its six. The room, the light and the dealer are shared; the
  // dealer moves to the side of whichever table is out.
  const blackjackSet = new THREE.Group();
  scene.add(blackjackSet);
  const pokerSet = new THREE.Group();
  pokerSet.visible = false;
  scene.add(pokerSet);

  const table = createTable();
  blackjackSet.add(table);

  // The dealer's gear sits directly on the felt at its back edge, laid out
  // as at a casino table (see seats.js): the shoe on the dealer's left, its
  // mouth angled in toward the middle and the dealer; the chip rack in
  // front of them; the discard holder on their right.
  const rack = createChipRack();
  rack.position.copy(DEALER.trayPosition);
  blackjackSet.add(rack);

  const shoe = createCardShoe();
  shoe.position.copy(DEALER.shoePosition);
  shoe.rotation.y = 0.35;
  blackjackSet.add(shoe);
  shoe.updateMatrixWorld(true);
  // Cards come out at the shoe's mouth, lying along it.
  DEALER.deckPosition.copy(shoe.localToWorld(SHOE_MOUTH.clone()));
  DEALER.shoeYaw = shoe.rotation.y;

  const discard = createDiscardHolder();
  discard.position.copy(DEALER.discardPosition);
  discard.rotation.y = -0.3;
  blackjackSet.add(discard);
  discard.updateMatrixWorld(true);

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
    blackjackSet.add(ring);

    // A tufted leather dining chair (Poly Haven), turned to face the table.
    const chair = place(blackjackSet, 'dining_chair_02', {
      x: seat.position.x, z: seat.position.z, yaw: seat.facingAngle, shadows: true,
    });
    chairsBySeat.set(seat.index, chair);
  });

  // The Hold'em table and its six chairs.
  const pokerTable = createPokerTable();
  pokerSet.add(pokerTable);
  const pokerChairs = new Map();
  POKER_SEATS_3D.forEach((seat) => {
    pokerChairs.set(seat.index, place(pokerSet, 'dining_chair_02', {
      x: seat.position.x, z: seat.position.z, yaw: seat.facingAngle, shadows: true,
    }));
  });

  let game = 'blackjack';
  function setGame(next) {
    if (next === game) return;
    game = next;
    const poker = game === 'holdem';
    blackjackSet.visible = !poker;
    pokerSet.visible = poker;
    dealer.position.copy(poker ? POKER_DEALER.position : DEALER.position);
  }

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
    // A portrait screen's extra height went to the wall above the dealer
    // while the table sat low, under the action buttons. Shifting the
    // projection lifts the table up the screen without tilting the camera,
    // so the angle you look at the table from is the same on every device.
    if (aspect < 1) {
      const w = window.innerWidth, h = window.innerHeight;
      camera.setViewOffset(w, h, 0, h * 0.07, w, h);
    } else {
      camera.clearViewOffset();
    }
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
  const SETTLE_MS = 3000;
  const WINDOW_FRAMES = 30;
  const SLOW_FRAME_MS = 22;   // ~45fps; below this and it reads as juddery
  let settleUntil = performance.now() + SETTLE_MS;
  let windowFrames = [];
  let slowWindows = 0;

  function adaptQuality(frameMs, now) {
    if (now < settleUntil || dprStep >= DPR_STEPS.length - 1) return;
    // A backgrounded tab has its frame callbacks throttled to a crawl or
    // stopped outright, so those gaps say nothing about how fast the device
    // is — counting them would quietly downgrade anyone who switched tabs.
    // Only gaps of a second or more are treated that way. This used to drop
    // anything over 100 ms, and a slow GPU's ordinary frames were over that,
    // so the one device that needed to step down never did.
    if (document.hidden || frameMs > 1000) { windowFrames = []; return; }
    windowFrames.push(frameMs);
    if (windowFrames.length < WINDOW_FRAMES) return;
    // The mean, not the median. A GPU that cannot keep up does not deliver
    // evenly slow frames: the browser queues several at 16 ms and then
    // blocks for 170 ms while the GPU catches up. The median of that is a
    // perfect 16.6 — measured on a laptop running at 17 fps — so it never
    // saw the problem. The mean is the real frame rate.
    const mean = windowFrames.reduce((a, b) => a + b, 0) / windowFrames.length;
    windowFrames = [];
    // Two bad windows in a row, so a single hiccup doesn't cost sharpness.
    // Far over budget is no hiccup, though: jump straight down.
    slowWindows = mean > SLOW_FRAME_MS ? slowWindows + 1 : 0;
    if (slowWindows >= 2 || mean > SLOW_FRAME_MS * 2) {
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
    // main.js hides the canvas outside a table (sign-in, lobby). It used to
    // go on drawing the whole room behind them at full cost regardless.
    if (canvas.style.display === 'none') {
      lastFrame = now;
      settleUntil = now + SETTLE_MS;
      clock.getDelta();
      return;
    }
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
      scene, camera, dealer, shoe, discard, renderer, controls,
      tickDealer: updateDealerAnimations,
      // This module's own bound copies, for the same reason as tickDealer:
      // importing them from the console gets a second instance whose
      // animation queue nothing is draining.
      tickAnimations,
      shuffle: () => playShoeShuffle({ scene, dealer, shoe, discard, shoeLeft: 60, total: 312, cutAt: 70 }),
    };
  }

  return {
    scene, camera, renderer, controls, dealer, shoe, discard, chairsBySeat,
    setFeltTheme: table.userData.setFeltTheme,
    setDealerModel: (key) => setDealerModel(dealer, key),
    setRoomTheme,
    setGame,
    pokerChairs,
    setPokerFelt: pokerTable.userData.setFeltTheme,
  };
}

