// The front page of nvgrcasino.com: the opening curtain, the dealer in the hero,
// the film strip of games, the hand played by
// scrolling, and everything that rises into view on the way down.
import './landing.css';
import Lenis from 'lenis';
import qrcode from 'qrcode-generator';

const APK = 'https://github.com/Nvgr-Casino/NVGR-Blackjack/releases/download/android/NVGR-Casino.apk';
const STILL = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const FINE = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

// Always the secure address (GitHub Pages enforces it at the server too).
if (location.protocol === 'http:' && location.hostname.endsWith('nvgrcasino.com')) location.replace('https://' + location.host + location.pathname + location.search + location.hash);
// An invite link from before the game moved to /play/ still reaches its table.
if (/[?&]room=/.test(location.search)) location.replace('./play/' + location.search);
document.getElementById('year').textContent = new Date().getFullYear();

// ---------- smooth scrolling ----------
const lenis = STILL ? null : new Lenis({ duration: 1.15, easing: (t) => 1 - Math.pow(1 - t, 4), smoothWheel: true });
if (lenis) {
  const raf = (t) => { lenis.raf(t); requestAnimationFrame(raf); };
  requestAnimationFrame(raf);
}
document.querySelectorAll('a[href^="#"]').forEach((a) => a.addEventListener('click', (e) => {
  const target = document.querySelector(a.getAttribute('href'));
  if (!target) return;
  e.preventDefault();
  if (lenis) lenis.scrollTo(target, { offset: 0 }); else target.scrollIntoView({ behavior: 'smooth' });
}));

// ---------- the curtain, then the hero rises ----------
const curtain = document.getElementById('curtain');
let seen = false;
try { seen = sessionStorage.getItem('nvgr-curtain') === '1'; sessionStorage.setItem('nvgr-curtain', '1'); } catch { /* private mode */ }
const t0 = performance.now();
function open() {
  if (document.body.classList.contains('ready')) return;
  curtain.classList.add('up');
  setTimeout(() => curtain.classList.add('gone'), 1400);
  setTimeout(() => {
    document.body.classList.add('ready');
    document.querySelectorAll('.rise').forEach((el, i) => { el.style.setProperty('--d', `${0.35 + i * 0.12}s`); el.classList.add('in'); });
    document.querySelectorAll('.hero-title .word').forEach((w, i) => { w.style.transitionDelay = `${0.1 + i * 0.07}s`; });
  }, seen || STILL ? 0 : 350);
}
if (seen || STILL) { curtain.classList.add('gone'); open(); }
else {
  document.fonts.ready.then(() => setTimeout(open, Math.max(0, 1500 - (performance.now() - t0))));
  setTimeout(open, 3200);
}

// ---------- the dealer ----------
const dealerCanvas = document.getElementById('dealer3d');
if (!STILL) {
  import('./heroDealer.js').then(({ startHeroDealer }) => {
    startHeroDealer(dealerCanvas, { onReady: () => dealerCanvas.classList.add('ready') });
  }).catch(() => { /* the words stand alone */ });
}

// ---------- lines that rise ----------
// A heading is split into its real lines (as the browser wraps it), each
// masked and slid up in turn; italics are kept.
function splitLines(el) {
  const words = [];
  const walk = (node, wrap) => {
    [...node.childNodes].forEach((n) => {
      if (n.nodeType === 3) n.textContent.split(/(\s+)/).forEach((part) => { if (part.trim()) words.push({ text: part, wrap }); });
      else if (n.nodeType === 1) walk(n, n.tagName.toLowerCase());
    });
  };
  walk(el, null);
  el.innerHTML = words.map((w, i) => `<span class="w" data-i="${i}">${w.wrap ? `<${w.wrap}>${w.text}</${w.wrap}>` : w.text}</span>`).join(' ');
  const lines = [];
  let top = null;
  el.querySelectorAll('.w').forEach((span) => {
    if (span.offsetTop !== top) { lines.push([]); top = span.offsetTop; }
    lines[lines.length - 1].push(span.innerHTML);
  });
  el.innerHTML = lines.map((l, i) => `<span class="rl"><span style="--d:${i * 0.09}s">${l.join(' ')}</span></span>`).join('');
}
document.fonts.ready.then(() => document.querySelectorAll('.reveal-lines').forEach(splitLines));

// ---------- reveals, staggered within a group ----------
const groups = new Map();
document.querySelectorAll('.reveal').forEach((el) => {
  const i = groups.get(el.parentElement) || 0;
  groups.set(el.parentElement, i + 1);
  el.style.setProperty('--d', `${Math.min(i, 5) * 0.1}s`);
});
const revealer = new IntersectionObserver((entries) => entries.forEach((e) => {
  if (!e.isIntersecting) return;
  e.target.classList.add('in');
  revealer.unobserve(e.target);
}), { threshold: 0.2, rootMargin: '0px 0px -6% 0px' });
document.querySelectorAll('.reveal, .reveal-lines').forEach((el) => revealer.observe(el));

// ---------- the bar ----------
const bar = document.getElementById('bar');
let lastY = 0;
function onScroll() {
  const y = window.scrollY;
  bar.classList.toggle('solid', y > 40);
  bar.classList.toggle('away', y > lastY + 2 && y > window.innerHeight * 0.9);
  if (y < lastY - 2) bar.classList.remove('away');
  lastY = y;
  games();
}
window.addEventListener('scroll', onScroll, { passive: true });

// ---------- the cursor ----------
const cursor = document.querySelector('.cursor');
if (FINE && !STILL) {
  let cx = innerWidth / 2, cy = innerHeight / 2, tx = cx, ty = cy;
  window.addEventListener('pointermove', (e) => { tx = e.clientX; ty = e.clientY; cursor.classList.add('on'); }, { passive: true });
  document.addEventListener('pointerleave', () => cursor.classList.remove('on'));
  document.addEventListener('pointerover', (e) => cursor.classList.toggle('big', !!e.target.closest('a, button, label, .g-card, select, input, textarea')));
  (function follow() {
    cx += (tx - cx) * 0.2; cy += (ty - cy) * 0.2;
    cursor.style.transform = `translate(${cx}px, ${cy}px)`;
    requestAnimationFrame(follow);
  })();
}

// ---------- the games, a film strip that scrolls sideways ----------
const gamesSection = document.getElementById('games');
const track = document.getElementById('gamesTrack');
const gamesNo = document.getElementById('gamesNo');
const gamesBar = document.getElementById('gamesBar');
const cards = [...track.querySelectorAll('.g-card')];
function games() {
  if (window.innerWidth <= 900) return;
  const r = gamesSection.getBoundingClientRect();
  const p = Math.max(0, Math.min(1, -r.top / (r.height - window.innerHeight)));
  const travel = track.scrollWidth - window.innerWidth + parseFloat(getComputedStyle(track).paddingLeft);
  track.style.transform = `translate3d(${-p * travel}px, 0, 0)`;
  gamesBar.style.transform = `scaleX(${p})`;
  gamesNo.textContent = String(Math.min(cards.length, 1 + Math.floor(p * cards.length * 0.999))).padStart(2, '0');
  // Each picture drifts a little against the strip's movement.
  cards.forEach((c) => {
    const cr = c.getBoundingClientRect();
    const k = (cr.left + cr.width / 2 - window.innerWidth / 2) / window.innerWidth;
    c.querySelector('img').style.objectPosition = `${50 + k * 18}% 50%`;
  });
}
window.addEventListener('resize', games);
onScroll();

// ---------- the floor band drifts as it passes ----------
const bandImg = document.getElementById('bandImg');
function band() {
  const r = bandImg.parentElement.getBoundingClientRect();
  if (r.bottom < 0 || r.top > window.innerHeight) return;
  const k = (r.top + r.height / 2 - window.innerHeight / 2) / window.innerHeight;
  bandImg.style.transform = `translate3d(0, ${(-k * 8).toFixed(2)}%, 0) scale(1.02)`;
}
window.addEventListener('scroll', band, { passive: true });
band();

// ---------- the hand, played by scrolling ----------
const story = document.getElementById('hand');
const steps = [...story.querySelectorAll('.story-steps li')];
const storyPin = story.querySelector('.story-pin');
function storyProgress(p) {
  storyPin.style.setProperty('--p', p.toFixed(4));
  storyPin.style.setProperty('--win', Math.max(0, Math.min(1, (p - 0.8) / 0.08)).toFixed(3));
  story.classList.toggle('started', p > 0.02);
  let on = 0;
  steps.forEach((li, i) => { if (p >= Number(li.dataset.at)) on = i; });
  steps.forEach((li, i) => { li.classList.toggle('on', i === on); li.classList.toggle('past', i < on); });
}
storyProgress(0);
new IntersectionObserver(([e], obs) => {
  if (!e.isIntersecting) return;
  obs.disconnect();
  import('./story3d.js').then(({ startStory }) => startStory(document.getElementById('story3d'), storyProgress)).catch(() => { /* the captions still read */ });
}, { rootMargin: '700px 0px' }).observe(story);

// ---------- the app: QR code and the latest build ----------
const qr = qrcode(0, 'M');
qr.addData(APK);
qr.make();
document.getElementById('qr').innerHTML = qr.createSvgTag({ cellSize: 3, margin: 0, scalable: true });
fetch('https://api.github.com/repos/Nvgr-Casino/NVGR-Blackjack/releases/tags/android')
  .then((r) => (r.ok ? r.json() : null))
  .then((rel) => {
    const apk = rel && (rel.assets || []).find((a) => a.name === 'NVGR-Casino.apk');
    if (!apk) return;
    const version = ((rel.body || '').match(/version (\d+\.\d+\.\d+)/) || [])[1];
    const date = new Date(apk.updated_at).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
    document.querySelectorAll('.apk-meta').forEach((el) => { el.textContent = `${version ? 'v' + version + ' · ' : ''}${Math.round(apk.size / 1048576)} MB · ${date}`; });
  })
  .catch(() => {});

// ---------- feedback, as an email to the house ----------
const fb = document.getElementById('fbForm');
fb.addEventListener('submit', (e) => {
  e.preventDefault();
  const data = new FormData(fb);
  const ideas = data.getAll('idea');
  const note = String(data.get('note') || '').trim();
  const done = document.getElementById('fbDone');
  if (!ideas.length && !note) { done.textContent = 'Please select a feature or add a comment.'; return; }
  const name = String(data.get('name') || '').trim();
  const body = [ideas.length ? `Requested features:\n- ${ideas.join('\n- ')}` : '', note ? `\nComments:\n${note}` : '', `\nPlatform: ${data.get('device')}`, name ? `From: ${name}` : ''].filter(Boolean).join('\n');
  location.href = `mailto:feedback@nvgrcasino.com?subject=${encodeURIComponent('NVGR Casino feedback' + (name ? ' from ' + name : ''))}&body=${encodeURIComponent(body)}`;
  done.textContent = 'Your email app will open with your feedback filled in. Thank you.';
  leaf(fb.querySelector('button'));
});
// A little brass leaf from the button.
function leaf(el) {
  if (STILL) return;
  const r = el.getBoundingClientRect();
  const colors = ['#c9a86a', '#ecd8a8', '#f3eee3', '#8f7139'];
  for (let i = 0; i < 46; i++) {
    const p = document.createElement('i');
    p.className = 'confetti';
    p.style.background = colors[i % colors.length];
    document.body.appendChild(p);
    let x = r.left + r.width / 2, y = r.top, vx = (Math.random() - 0.5) * 11, vy = -5 - Math.random() * 8, rot = 0, life = 0;
    const tick = () => {
      life++; vy += 0.38; x += vx; y += vy; rot += 12;
      p.style.transform = `translate(${x}px, ${y}px) rotate(${rot}deg)`;
      p.style.opacity = String(Math.max(0, 1 - life / 90));
      if (life < 90) requestAnimationFrame(tick); else p.remove();
    };
    requestAnimationFrame(tick);
  }
}
