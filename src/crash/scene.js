// Liftoff's picture: the Space Shuttle Discovery climbing away from the
// real Earth, India below, on its own canvas and renderer (the casino's
// rooms have nothing to do with it). src/app/crashBridge.js tells it, each
// frame, where the round is; everything here is only what that looks like.
//
//  - the craft: the Smithsonian's 3D scan of the orbiter (CC0), markings
//    and landing gear removed (scripts/prepare-shuttle.mjs), three main
//    engines firing: a white core with shock diamonds in a faint blue sheath.
//  - the Earth: NASA's Blue Marble by day and Black Marble city lights by
//    night (public domain), a thin atmosphere at its edge.
//  - the sky: black, as it is above the air; the Milky Way faint across it,
//    steady stars at three depths drifting past as the craft climbs, and
//    the sun's glare at the corner.
//  - the climb: the path's height is the multiplier, drawn as the craft's
//    own vapour trail; the camera eases back to keep it all in view.
//  - the break-up: a white flash, a fireball burning out to smoke, a vast
//    cloud of vapour, tile panels flung out trailing smoke, and sparks.

import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { Line2 } from 'three/examples/jsm/lines/Line2.js';
import { LineGeometry } from 'three/examples/jsm/lines/LineGeometry.js';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
import { K } from './rounds.js';
import { PHONE_LITE } from '../platform.js';

const ASSET = (p) => `${import.meta.env.BASE_URL}models/crash/${p}`;

// The path: x by time, y by the multiplier — straight up to 10x, then on a
// gentler curve (the same slope where they meet) so a long flight stays in
// the frame.
const PX = 4.2;
const pathY = (m) => (m <= 10 ? (m - 1) * 30 : 270 + 300 * Math.log(m / 10));
const pathAt = (t, out = new THREE.Vector3()) => out.set(t * PX, pathY(Math.exp(K * t)), 0);

function glowTexture(stops, size = 256) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  const ctx = c.getContext('2d'); const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  stops.forEach(([o, col]) => g.addColorStop(o, col)); ctx.fillStyle = g; ctx.fillRect(0, 0, size, size);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

// The Milky Way: a soft band of light with dark dust lanes along it and a
// dense speckle of faint stars, on a canvas laid far behind everything.
function milkyWayTexture() {
  const W = PHONE_LITE ? 1024 : 2048, H = W / 2;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const ctx = c.getContext('2d');
  let s = 7; const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  ctx.translate(W / 2, H / 2); ctx.rotate(-0.42); ctx.translate(-W / 2, -H / 2);
  // The glow: many faint blobs along the band, thickest at its middle.
  for (let i = 0; i < 900; i++) {
    const x = rnd() * W * 1.3 - W * 0.15;
    const spread = (rnd() + rnd() + rnd() - 1.5) * H * 0.12;
    const y = H / 2 + spread;
    const r = 30 + rnd() * 90;
    const warm = rnd();
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    const a = 0.035 * (1 - Math.abs(spread) / (H * 0.3));
    g.addColorStop(0, warm > 0.7 ? `rgba(255,230,200,${a})` : `rgba(200,215,255,${a})`);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  // Dust lanes, darker, down the middle.
  ctx.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < 260; i++) {
    const x = rnd() * W * 1.3 - W * 0.15;
    const y = H / 2 + (rnd() - 0.5) * H * 0.07 + Math.sin(x / 180) * 18;
    const r = 14 + rnd() * 40;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, 'rgba(0,0,0,0.22)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

// Drawn with the casino's own renderer (scene.js), borrowed while Liftoff
// is up: a second WebGL context beside the rooms' was more graphics memory
// than iPhone Safari allows, and it closed the page.
export function createCrashScene(renderer) {
  const phone = Math.min(innerWidth, innerHeight) < 600;
  // The renderer's settings for the rooms, put back when Liftoff closes.
  let saved = null;
  function borrow() {
    saved = { tone: renderer.toneMapping, exposure: renderer.toneMappingExposure, shadows: renderer.shadowMap.enabled, space: renderer.outputColorSpace, ratio: renderer.getPixelRatio() };
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.95;
    renderer.shadowMap.enabled = false;
    renderer.setPixelRatio(Math.min(devicePixelRatio, phone ? 1.5 : 2, saved.ratio));
  }
  function giveBack() {
    if (!saved) return;
    renderer.toneMapping = saved.tone;
    renderer.toneMappingExposure = saved.exposure;
    renderer.shadowMap.enabled = saved.shadows;
    renderer.outputColorSpace = saved.space;
    renderer.setPixelRatio(saved.ratio);
    saved = null;
  }
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x010206);
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.9;
  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 6000);

  // ---------- the sky ----------
  const sky = new THREE.Group(); scene.add(sky);
  const milky = new THREE.Mesh(new THREE.PlaneGeometry(5200, 2600), new THREE.MeshBasicMaterial({ map: milkyWayTexture(), transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
  milky.position.set(300, 500, -2400); sky.add(milky);
  // The sun, just off the top left: a blinding point and its glare.
  const sun = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture([[0, 'rgba(255,255,255,1)'], [0.04, 'rgba(255,253,245,1)'], [0.12, 'rgba(255,240,220,0.35)'], [0.4, 'rgba(255,220,190,0.06)'], [1, 'rgba(255,200,160,0)']], 512), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
  sun.scale.set(1400, 1400, 1); sun.position.set(-1500, 1150, -2300); sky.add(sun);

  // Stars at three depths. Each layer follows the camera and wraps round,
  // drifting past at its own rate — an endless field however high it goes.
  function starLayer(count, spread, depth, size, rate) {
    const pos = new Float32Array(count * 3), mag = new Float32Array(count), tint = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * spread; pos[i * 3 + 1] = (Math.random() - 0.5) * spread; pos[i * 3 + 2] = depth + (Math.random() - 0.5) * 60;
      // Mostly faint, a few bright; white, some blue, some warm.
      mag[i] = Math.pow(Math.random(), 3.2);
      const k = Math.random();
      const col = k < 0.15 ? [0.75, 0.85, 1] : k < 0.3 ? [1, 0.88, 0.72] : [1, 1, 1];
      tint.set(col, i * 3);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('mag', new THREE.BufferAttribute(mag, 1));
    g.setAttribute('tint', new THREE.BufferAttribute(tint, 3));
    const mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { offset: { value: new THREE.Vector2() }, spread: { value: spread }, size: { value: size * renderer.getPixelRatio() } },
      vertexShader: `attribute float mag; attribute vec3 tint; uniform vec2 offset; uniform float spread; uniform float size; varying float a; varying vec3 c;
        void main(){ vec3 p = position; p.xy = mod(p.xy - offset + spread * 0.5, spread) - spread * 0.5; vec4 mv = modelViewMatrix * vec4(p, 1.0); gl_Position = projectionMatrix * mv;
          a = 0.35 + 0.65 * mag; c = tint; gl_PointSize = size * (0.55 + 1.3 * mag) * (300.0 / -mv.z); }`,
      fragmentShader: 'varying float a; varying vec3 c; void main(){ float d = length(gl_PointCoord - 0.5); float s = smoothstep(0.5, 0.0, d); gl_FragColor = vec4(c, s * s * a); }',
    });
    const p = new THREE.Points(g, mat); p.frustumCulled = false; scene.add(p);
    p.userData.rate = rate;
    return p;
  }
  const stars = [starLayer(1400, 3400, -900, 2.6, 0.08), starLayer(700, 2000, -480, 3.0, 0.3), starLayer(260, 1100, -260, 3.4, 0.55)];

  // ---------- the real Earth ----------
  const texLoader = new THREE.TextureLoader();
  const dayTex = texLoader.load(ASSET('earth_day.jpg')); dayTex.colorSpace = THREE.SRGBColorSpace; dayTex.anisotropy = 8;
  const nightTex = texLoader.load(ASSET('earth_night.jpg')); nightTex.colorSpace = THREE.SRGBColorSpace; nightTex.anisotropy = 8;
  const SUN = new THREE.Vector3(-0.78, 0.32, 0.36).normalize();
  const SHIP_SUN = new THREE.Vector3(-0.55, 0.55, 0.62).normalize();
  const planet = new THREE.Group(); scene.add(planet);
  const EARTH_R = 900;
  const earthMat = new THREE.ShaderMaterial({
    uniforms: { day: { value: dayTex }, night: { value: nightTex }, sun: { value: SUN.clone() } },
    vertexShader: 'varying vec2 vUv; varying vec3 vN; varying vec3 vV; void main(){ vUv = uv; vN = normalize(mat3(modelMatrix)*normal); vec4 wp = modelMatrix*vec4(position,1.0); vV = normalize(cameraPosition - wp.xyz); gl_Position = projectionMatrix*viewMatrix*wp; }',
    fragmentShader: `uniform sampler2D day; uniform sampler2D night; uniform vec3 sun; varying vec2 vUv; varying vec3 vN; varying vec3 vV;
      void main(){
        float l = dot(normalize(vN), sun);
        vec3 d = texture2D(day, vUv).rgb;
        vec3 n = texture2D(night, vUv).rgb;
        float dayK = smoothstep(-0.12, 0.25, l);
        vec3 col = d * (0.05 + 1.35 * pow(max(l, 0.0), 0.8)) * dayK + n * vec3(1.0, 0.78, 0.5) * 1.6 * (1.0 - dayK);
        float rim = pow(1.0 - max(dot(normalize(vN), vV), 0.0), 2.5);
        col = mix(col, vec3(0.42, 0.62, 1.0) * (0.15 + 0.6 * smoothstep(-0.3, 0.4, l)), rim * 0.55);
        gl_FragColor = vec4(col, 1.0);
        #include <colorspace_fragment>
      }`,
  });
  const earth = new THREE.Mesh(new THREE.SphereGeometry(EARTH_R, 128, 64), earthMat);
  earth.position.set(0, -1050, -1250); planet.add(earth);
  {
    // India (22N, 78E) a little below the horizon in view, north toward it.
    const phi = ((78 + 180) / 360) * Math.PI * 2, theta = ((90 - 22) / 180) * Math.PI;
    const india = new THREE.Vector3(-Math.cos(phi) * Math.sin(theta), Math.cos(theta), Math.sin(phi) * Math.sin(theta)).normalize();
    const toward = new THREE.Vector3(-0.2, 0.93, 0.34).normalize();
    const q = new THREE.Quaternion().setFromUnitVectors(india, toward);
    const north = new THREE.Vector3(0, 1, 0).applyQuaternion(q).projectOnPlane(toward).normalize();
    const up = new THREE.Vector3(0, 0.34, -0.93).projectOnPlane(toward).normalize();
    const roll = Math.atan2(new THREE.Vector3().crossVectors(north, up).dot(toward), north.dot(up));
    earth.quaternion.copy(new THREE.Quaternion().setFromAxisAngle(toward, roll).multiply(q));
  }
  const atm = new THREE.Mesh(new THREE.SphereGeometry(EARTH_R * 1.045, 128, 64), new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.BackSide,
    uniforms: { sun: { value: SUN.clone() } },
    vertexShader: 'varying vec3 vN; varying vec3 vV; void main(){ vN = normalize(mat3(modelMatrix)*normal); vec4 wp = modelMatrix*vec4(position,1.0); vV = normalize(cameraPosition - wp.xyz); gl_Position = projectionMatrix*viewMatrix*wp; }',
    fragmentShader: 'uniform vec3 sun; varying vec3 vN; varying vec3 vV; void main(){ float c = abs(dot(normalize(vN), vV)); float r = smoothstep(0.0, 0.32, c) * pow(1.0 - c, 3.0); float lit = 0.25 + 0.75*smoothstep(-0.4, 0.5, dot(-normalize(vN), sun)); gl_FragColor = vec4(vec3(0.38,0.62,1.0) * r * 2.6 * lit, 1.0); }',
  }));
  atm.position.copy(earth.position); planet.add(atm);

  const key = new THREE.DirectionalLight(0xfff6ea, 2.3); key.position.copy(SHIP_SUN).multiplyScalar(100); scene.add(key);
  const earthshine = new THREE.DirectionalLight(0x6f9cff, 0.9); earthshine.position.set(0.2, -1, 0.3).multiplyScalar(100); scene.add(earthshine);
  scene.add(new THREE.AmbientLight(0x1a2236, 0.6));

  // ---------- the craft ----------
  const rocket = new THREE.Group();
  const body = new THREE.Group(); rocket.add(body);
  const SHUTTLE_SCALE = 0.44;
  const flame = new THREE.Group();
  let ready = false;
  const loader = new GLTFLoader(); loader.setMeshoptDecoder(MeshoptDecoder);
  loader.load(ASSET('shuttle.glb'), (g) => {
    const model = g.scene;
    model.traverse((o) => { if (o.isMesh) o.material.envMapIntensity = 0.6; });
    const inner = new THREE.Group(); inner.add(model);
    // The scan's length runs along z, nose at +z: stood up on its tail.
    inner.rotation.x = -Math.PI / 2;
    // The top three-quarters toward the camera: the payload bay and wings.
    const side = new THREE.Group(); side.add(inner); side.rotation.y = Math.PI / 2 + 1.0;
    side.scale.setScalar(SHUTTLE_SCALE);
    // Centred on its own, before it joins the craft: measured in place it
    // took in wherever the craft had flown to by the time it loaded.
    side.updateMatrixWorld(true);
    side.position.sub(new THREE.Box3().setFromObject(side).getCenter(new THREE.Vector3()));
    body.add(side);
    // The nozzles end 17.1 m aft.
    inner.add(flame); flame.rotation.x = Math.PI / 2; flame.position.set(0, 0, -17.1);
    ready = true;
  });
  const plumeMat = (inner, outer, o, fall, diamonds) => new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    uniforms: { time: { value: 0 }, inner: { value: new THREE.Color(inner) }, outer: { value: new THREE.Color(outer) }, opacity: { value: o }, fall: { value: fall }, diamonds: { value: diamonds } },
    vertexShader: 'uniform float time; varying vec2 vUv; varying vec3 vN; varying vec3 vV; void main(){ vUv = uv; vec3 p = position; p.xz *= 1.0 + 0.035*sin(time*53.0 + uv.y*11.0); vec4 wp = modelMatrix*vec4(p,1.0); vN = normalize(mat3(modelMatrix)*normal); vV = normalize(cameraPosition - wp.xyz); gl_Position = projectionMatrix*viewMatrix*wp; }',
    fragmentShader: 'uniform vec3 inner; uniform vec3 outer; uniform float opacity; uniform float fall; uniform float diamonds; varying vec2 vUv; varying vec3 vN; varying vec3 vV; void main(){ float t = vUv.y; float face = pow(abs(dot(normalize(vN), normalize(vV))), 1.3); float d = mix(1.0, 0.55 + 0.45*smoothstep(0.2, 0.9, sin((1.0-t)*31.0)), diamonds); vec3 c = mix(outer, inner, pow(t, 1.5)); gl_FragColor = vec4(c, pow(t, fall) * opacity * face * d); }',
  });
  const flameMats = [];
  [[0, -1.6], [-1.3, -3.6], [1.3, -3.6]].forEach(([x, y]) => {
    const g = new THREE.Group(); g.position.set(x, 0, -y); flame.add(g);
    const core = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 0.3, 7.5, 32, 1, true), plumeMat(0xffffff, 0x9cc4ff, 0.95, 1.1, 1)); core.position.y = -3.75; g.add(core);
    const sheath = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 4.2, 26, 32, 1, true), plumeMat(0xcfe0ff, 0x3a55c8, 0.32, 2.2, 0)); sheath.position.y = -13; g.add(sheath);
    flameMats.push(core.material, sheath.material);
  });
  const engineGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture([[0, 'rgba(240,246,255,1)'], [0.25, 'rgba(170,200,255,0.5)'], [1, 'rgba(120,150,255,0)']]), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  engineGlow.scale.set(9, 9, 1); engineGlow.position.set(0, -0.8, 2.6); flame.add(engineGlow);
  scene.add(rocket);

  const smokeTex = glowTexture([[0, 'rgba(235,240,250,0.55)'], [0.4, 'rgba(200,210,230,0.18)'], [1, 'rgba(160,170,200,0)']]);
  const puffs = [];
  for (let i = 0; i < 90; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: smokeTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 }));
    s.userData = { life: 0, drift: new THREE.Vector3() }; scene.add(s); puffs.push(s);
  }
  let puffIdx = 0;

  // ---------- the vapour trail ----------
  const lineMat = new LineMaterial({ color: 0xffffff, vertexColors: true, linewidth: 2.2, worldUnits: false, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  const glowMat = new LineMaterial({ color: 0xffffff, vertexColors: true, linewidth: 14, worldUnits: false, transparent: true, opacity: 0.2, depthWrite: false, blending: THREE.AdditiveBlending });
  const line = new Line2(new LineGeometry(), lineMat); const lineGlow = new Line2(new LineGeometry(), glowMat);
  line.frustumCulled = lineGlow.frustumCulled = false;
  scene.add(lineGlow, line);
  const tmp = new THREE.Vector3();
  let trailFor = -1;
  function drawTrail(t) {
    if (Math.abs(t - trailFor) < 1e-4) return;
    trailFor = t;
    const n = Math.max(2, Math.min(240, Math.ceil(t * 6)));
    const pts = [], cols = [];
    for (let i = 0; i <= n; i++) {
      pathAt((t * i) / n, tmp); pts.push(tmp.x, tmp.y, -0.5);
      const k = Math.pow(i / n, 1.4); cols.push(0.75 * k, 0.82 * k, 0.95 * k);
    }
    line.geometry.dispose(); line.geometry = new LineGeometry(); line.geometry.setPositions(pts); line.geometry.setColors(cols);
    lineGlow.geometry.dispose(); lineGlow.geometry = new LineGeometry(); lineGlow.geometry.setPositions(pts); lineGlow.geometry.setColors(cols);
  }

  // ---------- the break-up ----------
  function puffTexture(seed, fire) {
    const c = document.createElement('canvas'); c.width = c.height = 256;
    const ctx = c.getContext('2d');
    let r = seed * 9301 + 49297; const rnd = () => ((r = (r * 9301 + 49297) % 233280) / 233280);
    for (let i = 0; i < 46; i++) {
      const a = rnd() * Math.PI * 2, d = Math.pow(rnd(), 0.7) * 70, x = 128 + Math.cos(a) * d, y = 128 + Math.sin(a) * d, rad = 26 + rnd() * 46;
      const g = ctx.createRadialGradient(x - rad * 0.25, y - rad * 0.3, 0, x, y, rad);
      if (fire) { g.addColorStop(0, 'rgba(255,250,235,0.55)'); g.addColorStop(0.45, 'rgba(255,190,90,0.3)'); g.addColorStop(1, 'rgba(200,60,10,0)'); }
      else { const k = 200 + rnd() * 55; g.addColorStop(0, `rgba(${k},${k},${k},0.42)`); g.addColorStop(0.6, `rgba(${k - 60},${k - 60},${k - 50},0.22)`); g.addColorStop(1, 'rgba(90,90,100,0)'); }
      ctx.fillStyle = g; ctx.fillRect(0, 0, 256, 256);
    }
    ctx.globalCompositeOperation = 'destination-in';
    const m = ctx.createRadialGradient(128, 128, 40, 128, 128, 128); m.addColorStop(0, 'rgba(0,0,0,1)'); m.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = m; ctx.fillRect(0, 0, 256, 256);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  }
  const fireTex = [1, 2, 3].map((i) => puffTexture(i, true));
  const cloudTex = [4, 5, 6, 7].map((i) => puffTexture(i, false));
  const pool = (n, make) => Array.from({ length: n }, (_, i) => { const o = make(i); o.visible = false; o.userData = { v: new THREE.Vector3(), life: 0 }; scene.add(o); return o; });
  const sprite = (map, additive) => new THREE.Sprite(new THREE.SpriteMaterial({ map, transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending, opacity: 0 }));
  const TILE_WHITE = new THREE.MeshStandardMaterial({ color: 0xe6e3dc, metalness: 0.05, roughness: 0.7 });
  const TILE_BLACK = new THREE.MeshStandardMaterial({ color: 0x1c1d20, metalness: 0.05, roughness: 0.8 });
  const METAL = new THREE.MeshStandardMaterial({ color: 0x8a8c90, metalness: 0.8, roughness: 0.4 });
  const flash = sprite(glowTexture([[0, 'rgba(255,255,255,1)'], [0.25, 'rgba(255,240,220,0.8)'], [1, 'rgba(255,200,150,0)']]), true);
  flash.userData.life = 0; scene.add(flash);
  const fireballs = pool(16, (i) => sprite(fireTex[i % 3], true));
  const clouds = pool(30, (i) => sprite(cloudTex[i % 4], false));
  const trailPuffs = pool(phone ? 260 : 420, (i) => sprite(cloudTex[i % 4], false));
  const sparkTex = glowTexture([[0, 'rgba(255,252,240,1)'], [0.15, 'rgba(255,220,150,0.9)'], [0.4, 'rgba(255,150,60,0.2)'], [1, 'rgba(255,120,40,0)']]);
  const sparks = pool(80, () => sprite(sparkTex, true));
  const debris = pool(22, (i) => {
    const big = i < 3;
    const geo = big ? new THREE.BoxGeometry(2.6 + i, 1.1, 1.6) : new THREE.BoxGeometry(0.5 + Math.random() * 1.6, 0.08, 0.4 + Math.random() * 1.1);
    return new THREE.Mesh(geo, big ? METAL : i % 2 ? TILE_WHITE : TILE_BLACK);
  });
  let trailIdx = 0, shake = 0;
  const rand = (a, b) => a + Math.random() * (b - a);
  const randDir = (flat = 0.6) => new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, (Math.random() - 0.5) * flat).normalize();

  function burst(at) {
    flash.position.copy(at); flash.userData.life = 1;
    fireballs.forEach((f) => {
      const d = randDir();
      f.position.copy(at).addScaledVector(d, rand(0, 3)); f.userData.v.copy(d).multiplyScalar(rand(5, 16));
      f.userData.life = f.userData.max = rand(0.7, 1.1); f.userData.size = rand(5, 10);
      f.material.rotation = Math.random() * 6.28; f.visible = true;
    });
    clouds.forEach((c) => {
      const d = randDir();
      c.position.copy(at).addScaledVector(d, rand(0, 4)); c.userData.v.copy(d).multiplyScalar(rand(6, 22));
      c.userData.delay = rand(0.04, 0.22); c.userData.life = c.userData.max = rand(2.6, 3.4); c.userData.size = rand(7, 13);
      c.userData.spin = rand(-0.25, 0.25); c.material.rotation = Math.random() * 6.28; c.material.opacity = 0; c.visible = true;
    });
    sparks.forEach((s) => {
      s.position.copy(at); s.userData.v.copy(randDir()).multiplyScalar(rand(25, 70));
      s.userData.life = rand(0.35, 0.8); s.userData.size = rand(0.35, 0.8); s.visible = true;
    });
    debris.forEach((d, i) => {
      d.position.copy(at).addScaledVector(randDir(), rand(0, 2));
      d.userData.v.copy(randDir(0.8)).multiplyScalar(i < 3 ? rand(8, 16) : rand(16, 42));
      d.userData.spin = new THREE.Vector3(rand(-6, 6), rand(-6, 6), rand(-6, 6));
      d.userData.life = 2.6; d.userData.last = null; d.visible = true;
    });
    shake = 1;
  }
  function clearBreakup() {
    flash.userData.life = 0; flash.material.opacity = 0;
    [fireballs, clouds, sparks, debris, trailPuffs].forEach((list) => list.forEach((o) => { o.visible = false; o.userData.life = 0; }));
    shake = 0;
  }
  function updateBreakup(dt) {
    if (flash.userData.life > 0) {
      flash.userData.life -= dt * 4; const l = Math.max(0, flash.userData.life);
      flash.material.opacity = l; flash.scale.setScalar(30 + (1 - l) * 50);
    } else flash.material.opacity = 0;
    fireballs.forEach((f) => {
      if (!f.visible) return;
      f.userData.life -= dt; if (f.userData.life <= 0) { f.visible = false; return; }
      const k = 1 - f.userData.life / f.userData.max;
      f.userData.v.multiplyScalar(Math.pow(0.2, dt)); f.position.addScaledVector(f.userData.v, dt);
      f.scale.setScalar(f.userData.size * (1 + k * 1.6));
      f.material.opacity = Math.min(1, (1 - k) * 1.6);
      f.material.color.setRGB(1, 1 - k * 0.45, 1 - k * 0.8);
    });
    clouds.forEach((c) => {
      if (!c.visible) return;
      if (c.userData.delay > 0) { c.userData.delay -= dt; return; }
      c.userData.life -= dt; if (c.userData.life <= 0) { c.visible = false; return; }
      const k = 1 - c.userData.life / c.userData.max;
      c.userData.v.multiplyScalar(Math.pow(0.35, dt)); c.position.addScaledVector(c.userData.v, dt);
      c.scale.setScalar(c.userData.size * (1 + Math.sqrt(k) * 2.4));
      c.material.rotation += c.userData.spin * dt;
      c.material.opacity = Math.min(1, k * 8) * Math.pow(1 - k, 1.3) * 0.95;
      const g = 0.95 - k * 0.35; c.material.color.setRGB(g, g, g * 1.03);
    });
    sparks.forEach((s) => {
      if (!s.visible) return;
      s.userData.life -= dt; if (s.userData.life <= 0) { s.visible = false; return; }
      s.userData.v.multiplyScalar(Math.pow(0.4, dt)); s.position.addScaledVector(s.userData.v, dt);
      s.material.opacity = Math.min(1, s.userData.life * 2); s.scale.setScalar(s.userData.size);
    });
    debris.forEach((d) => {
      if (!d.visible) return;
      d.userData.life -= dt; if (d.userData.life <= 0) { d.visible = false; return; }
      d.userData.v.y -= 4 * dt; d.position.addScaledVector(d.userData.v, dt);
      d.rotation.x += d.userData.spin.x * dt; d.rotation.y += d.userData.spin.y * dt; d.rotation.z += d.userData.spin.z * dt;
      // A streak of smoke behind each piece, laid by distance so it is
      // unbroken at any frame rate.
      if (d.userData.life > 0.9) {
        const from = d.userData.last || d.position.clone(), gap = from.distanceTo(d.position);
        const n = Math.min(6, Math.floor(gap / 0.7));
        for (let k = 1; k <= n; k++) {
          const p = trailPuffs[trailIdx++ % trailPuffs.length];
          p.position.lerpVectors(from, d.position, k / n); p.userData.life = p.userData.max = rand(1.0, 1.6);
          p.userData.size = rand(0.9, 1.6); p.material.rotation = Math.random() * 6.28; p.material.opacity = 0; p.visible = true;
        }
        if (n || !d.userData.last) d.userData.last = d.position.clone();
      }
    });
    trailPuffs.forEach((p) => {
      if (!p.visible) return;
      p.userData.life -= dt; if (p.userData.life <= 0) { p.visible = false; return; }
      const k = 1 - p.userData.life / p.userData.max;
      p.scale.setScalar(p.userData.size * (1 + k * 2.5));
      p.material.opacity = Math.min(1, k * 10) * (1 - k) * 0.75;
      const g = 0.85 - k * 0.3; p.material.color.setRGB(g, g, g);
    });
    shake = Math.max(0, shake - dt * 1.8);
  }

  // ---------- post ----------
  // The glow on the flames and the flash. Not in a phone's browser: its
  // buffers, several the size of the screen, are graphics memory iPhone
  // Safari doesn't have to spare beside the casino's rooms.
  const glow = !PHONE_LITE;
  const composer = glow ? new EffectComposer(renderer) : null;
  const bloom = glow ? new UnrealBloomPass(new THREE.Vector2(1, 1), 0.38, 0.4, 1.0) : null;
  if (glow) {
    composer.addPass(new RenderPass(scene, camera));
    composer.addPass(bloom);
    composer.addPass(new OutputPass());
  }

  let snapCam = true;
  function resize() {
    const w = innerWidth, h = innerHeight;
    renderer.setSize(w, h, false);
    if (glow) { composer.setPixelRatio(renderer.getPixelRatio()); composer.setSize(w, h); bloom.setSize(w, h); }
    camera.aspect = w / h; camera.updateProjectionMatrix();
    lineMat.resolution.set(w, h); glowMat.resolution.set(w, h);
    snapCam = true;
  }
  addEventListener('resize', () => { if (running) resize(); });

  // ---------- each frame ----------
  const clock = new THREE.Clock();
  const camPos = new THREE.Vector3(), camLook = new THREE.Vector3(), lookTarget = new THREE.Vector3();
  const p = new THREE.Vector3(), ahead = new THREE.Vector3(), back = new THREE.Vector3();
  let running = false, raf = 0, getState = null;
  let shownRound = null, shownPhase = null;

  function frame() {
    if (!running) return;
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.1, clock.getDelta()), now = clock.elapsedTime;
    const st = getState ? getState() : { phase: 'bet', flyMs: 0, id: null };
    flameMats.forEach((m) => (m.uniforms.time.value = now));

    // A new round: the sky cleared of the last one's pieces.
    if (st.id !== shownRound) { if (shownRound !== null && st.phase !== 'crash') clearBreakup(); shownRound = st.id; }
    const t = st.phase === 'bet' ? 0 : st.flyMs / 1000;
    pathAt(t, p);
    // The break-up, the moment the flight ends — seen only by those
    // watching it happen, not by someone arriving after.
    if (st.phase === 'crash' && shownPhase === 'fly') burst(p);
    shownPhase = st.phase;

    pathAt(t + 0.05, ahead);
    const dir = ahead.sub(p).normalize();
    rocket.visible = ready && st.phase !== 'crash';
    rocket.position.copy(p);
    const tilt = st.phase === 'bet' ? 0 : Math.min(0.55, Math.atan2(dir.x, dir.y) * 0.7);
    rocket.rotation.set(0, 0, -tilt);
    rocket.rotateY(Math.sin(now * 0.4) * 0.12);
    const thrust = st.phase === 'fly' ? 1 : 0.35 + 0.05 * Math.sin(now * 20);
    flame.scale.set(1, thrust * (0.9 + 0.12 * Math.sin(now * 33)), 1);
    engineGlow.material.opacity = 0.5 + 0.5 * thrust;
    drawTrail(st.phase === 'bet' ? 0.001 : t);
    line.visible = lineGlow.visible = st.phase !== 'bet';

    if (rocket.visible && st.phase === 'fly') {
      const s = puffs[puffIdx++ % puffs.length];
      back.set(0, -14, 0).applyEuler(rocket.rotation);
      s.position.copy(rocket.position).add(back);
      s.position.x += (Math.random() - 0.5) * 0.8; s.position.y += (Math.random() - 0.5) * 0.8;
      s.userData.life = 1; s.userData.drift.copy(back).normalize().multiplyScalar(3 + Math.random() * 3);
    }
    puffs.forEach((s) => {
      if (s.userData.life <= 0) { s.material.opacity = 0; return; }
      s.userData.life -= dt * 1.1;
      s.position.addScaledVector(s.userData.drift, dt);
      const l = Math.max(0, s.userData.life); s.material.opacity = l * 0.12; s.scale.setScalar(2 + (1 - l) * 6);
    });
    updateBreakup(dt);

    // The camera frames the craft right of centre and below the
    // multiplier, easing back as the climb grows; the Earth falls away.
    const tall = innerHeight > innerWidth;
    const span = 70 + Math.max(p.x * 1.6, p.y) * 0.75;
    const lookX = p.x - span * (tall ? 0.05 : 0.2), lookY = p.y + span * (tall ? 0.12 : 0.13);
    camPos.set(lookX, lookY - span * 0.08, span * (tall ? 1.7 : 1.05));
    const ease = snapCam ? 1 : 1 - Math.pow(st.phase === 'bet' ? 0.0018 : 0.013, dt);
    snapCam = false;
    camera.position.lerp(camPos, ease);
    camLook.lerp(lookTarget.set(lookX, lookY, 0), ease);
    camera.lookAt(camLook);
    if (shake > 0) { const a = shake * shake * 1.6; camera.position.x += (Math.random() - 0.5) * a; camera.position.y += (Math.random() - 0.5) * a; }
    sky.position.set(camera.position.x, camera.position.y, camera.position.z - 73);
    stars.forEach((s) => {
      s.position.set(camera.position.x, camera.position.y, camera.position.z - 73);
      s.material.uniforms.offset.value.set(camera.position.x * s.userData.rate, camera.position.y * s.userData.rate);
    });
    planet.position.set(camera.position.x * 0.9, camera.position.y * 0.9 - p.y * 0.12 + (tall ? 210 : 0), 0);
    if (glow) composer.render(); else renderer.render(scene, camera);
  }

  if (import.meta.env.DEV) window.__lift = { scene, camera, rocket, renderer, bloom };

  return {
    /** Starts drawing; `state()` is asked each frame where the round is. */
    start(state) {
      getState = state;
      if (running) return;
      running = true;
      borrow();
      snapCam = true;
      shownPhase = null;
      clock.getDelta();
      resize();
      frame();
    },
    stop() {
      running = false;
      cancelAnimationFrame(raf);
      clearBreakup();
      // Its textures, meshes and buffers off the graphics card: they come
      // back by themselves the next time Liftoff is drawn.
      scene.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        const mats = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : [];
        mats.forEach((mat) => {
          Object.values(mat).forEach((v) => { if (v && v.isTexture) v.dispose(); });
          if (mat.uniforms) Object.values(mat.uniforms).forEach((u) => { if (u && u.value && u.value.isTexture) u.value.dispose(); });
        });
      });
      if (glow) { composer.renderTarget1.dispose(); composer.renderTarget2.dispose(); bloom.dispose(); }
      giveBack();
    },
    get ready() { return ready; },
  };
}
