// The front page of nvgrcasino.com: the 3D hero, the scroll-played hand of
// blackjack, everything that moves as
// you scroll, the playable slot, the QR code to the APK and the latest
// build's details.
import './landing.css';
import Lenis from 'lenis';
import qrcode from 'qrcode-generator';

const APK = 'https://github.com/Nvgr-Casino/NVGR-Blackjack/releases/download/android/NVGR-Casino.apk';
const STILL = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Always the secure address: a visit to http://nvgrcasino.com moves to
// https (GitHub Pages' "Enforce HTTPS" does the same at the server).
if (location.protocol === 'http:' && location.hostname.endsWith('nvgrcasino.com')) location.replace('https://' + location.host + location.pathname + location.search + location.hash);

// An invite link from before the game moved to /play/ (…/?room=CODE)
// still takes you to that table.
if (/[?&]room=/.test(location.search)) location.replace('./play/' + location.search);

document.getElementById('year').textContent = new Date().getFullYear();

// ---------- smooth scrolling ----------
const lenis = STILL ? null : new Lenis({ duration: 1.1, easing: (t) => 1 - Math.pow(1 - t, 4), smoothWheel: true });
if (lenis) {
  const raf = (t) => { lenis.raf(t); requestAnimationFrame(raf); };
  requestAnimationFrame(raf);
}
document.querySelectorAll('a[href^="#"]').forEach((a) => a.addEventListener('click', (e) => {
  const target = document.querySelector(a.getAttribute('href'));
  if (!target) return;
  e.preventDefault();
  if (lenis) lenis.scrollTo(target); else target.scrollIntoView({ behavior: 'smooth' });
}));

// The headline rises in once the fonts are ready.
document.fonts.ready.then(() => requestAnimationFrame(() => document.body.classList.add('ready')));
setTimeout(() => document.body.classList.add('ready'), 1200);

// The 3D hero, loaded after the page itself so the words come first.
if (!STILL) {
  import('./hero3d.js').then(({ startHero }) => {
    const ok = startHero(document.getElementById('hero3d'));
    if (ok) document.querySelector('.hero-fallback').style.opacity = '0';
  }).catch(() => { /* the gradient behind it stays */ });
}

// ---------- reveals, staggered within each group ----------
const groups = new Map();
document.querySelectorAll('.reveal').forEach((el) => {
  const parent = el.parentElement;
  const i = groups.get(parent) || 0;
  groups.set(parent, i + 1);
  el.style.setProperty('--d', `${Math.min(i, 6) * 0.09}s`);
});
const revealer = new IntersectionObserver((entries) => {
  entries.forEach((e) => {
    if (!e.isIntersecting) return;
    e.target.classList.add('in');
    revealer.unobserve(e.target);
    const n = e.target.querySelector('[data-count]');
    if (n) countUp(n);
  });
}, { threshold: 0.15, rootMargin: '0px 0px -8% 0px' });
document.querySelectorAll('.reveal').forEach((el) => revealer.observe(el));

// ---------- counters ----------
function countUp(el) {
  const to = Number(el.dataset.count), prefix = el.dataset.prefix || '';
  const fmt = (v) => prefix + (el.dataset.format === 'k' ? (v >= 1000 ? Math.round(v / 1000) + 'K' : Math.round(v)) : Math.round(v).toLocaleString());
  if (STILL || !to) { el.textContent = fmt(to); return; }
  const t0 = performance.now(), ms = 1600;
  const step = (now) => {
    const k = Math.min(1, (now - t0) / ms);
    el.textContent = fmt(to * (1 - Math.pow(1 - k, 4)));
    if (k < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

// ---------- scroll: progress bar, nav, timeline ----------
const bar = document.querySelector('.progress i');
const nav = document.getElementById('nav');
const line = document.querySelector('.timeline-line');
const timeline = document.querySelector('.timeline');
let lastY = 0;
function onScroll() {
  const y = window.scrollY, max = document.documentElement.scrollHeight - innerHeight;
  bar.style.transform = `scaleX(${max > 0 ? y / max : 0})`;
  nav.classList.toggle('scrolled', y > 40);
  nav.classList.toggle('hide', y > lastY && y > innerHeight * 0.8);
  lastY = y;
  const r = timeline.getBoundingClientRect();
  const fill = Math.max(0, Math.min(1, (innerHeight * 0.7 - r.top) / r.height));
  line.style.setProperty('--fill', fill.toFixed(3));
}
window.addEventListener('scroll', onScroll, { passive: true });
onScroll();

// ---------- the glow that follows the pointer ----------
const glow = document.querySelector('.cursor');
let gx = innerWidth / 2, gy = innerHeight / 2, tx = gx, ty = gy;
window.addEventListener('pointermove', (e) => { tx = e.clientX; ty = e.clientY; }, { passive: true });
(function follow() {
  gx += (tx - gx) * 0.12; gy += (ty - gy) * 0.12;
  glow.style.transform = `translate(${gx}px, ${gy}px)`;
  requestAnimationFrame(follow);
})();

// ---------- cards tilt toward the pointer, with a moving shine ----------
document.querySelectorAll('.tilt').forEach((card) => {
  card.addEventListener('pointermove', (e) => {
    if (e.pointerType === 'touch') return;
    const r = card.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
    card.style.transform = `rotateY(${(px - 0.5) * 14}deg) rotateX(${(0.5 - py) * 12}deg) translateZ(10px)`;
    card.style.setProperty('--mx', `${px * 100}%`);
    card.style.setProperty('--my', `${py * 100}%`);
  });
  card.addEventListener('pointerleave', () => { card.style.transform = ''; });
});

// ---------- QR code to the APK, for visitors on a computer ----------
const qr = qrcode(0, 'M');
qr.addData(APK);
qr.make();
document.getElementById('qrHero').innerHTML = qr.createSvgTag({ cellSize: 3, margin: 0, scalable: true });

// ---------- the latest build ----------
fetch('https://api.github.com/repos/Nvgr-Casino/NVGR-Blackjack/releases/tags/android')
  .then((r) => (r.ok ? r.json() : null))
  .then((rel) => {
    const apk = rel && (rel.assets || []).find((a) => a.name === 'NVGR-Casino.apk');
    if (!apk) return;
    const version = ((rel.body || '').match(/version (\d+\.\d+\.\d+)/) || [])[1];
    const mb = Math.round(apk.size / 1048576);
    const date = new Date(apk.updated_at).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
    document.querySelectorAll('.apk-meta').forEach((el) => { el.textContent = `${version ? 'v' + version + ' · ' : ''}${mb} MB · updated ${date}`; });
    document.querySelectorAll('.apk-version').forEach((el) => { el.textContent = `${version ? 'v' + version : 'Android'}, ${date}`; });
  })
  .catch(() => { document.querySelectorAll('.apk-version').forEach((el) => { el.textContent = 'Android test build'; }); });

// ---------- the slot ----------
const SYMBOLS = [
  { ch: '7', cls: 's7' }, { ch: '♠', cls: 'sg' }, { ch: '♦', cls: 'sc' },
  { ch: '★', cls: 'sg' }, { ch: '♥', cls: 's7' }, { ch: '♣', cls: 'sv' },
];
const reels = [...document.querySelectorAll('#reels .strip')];
const LEN = 30; // symbols on each strip
const strips = reels.map(() => Array.from({ length: LEN }, () => Math.floor(Math.random() * SYMBOLS.length)));
const symH = () => reels[0].parentElement.clientHeight;
function paint(i) {
  // Each symbol exactly one window tall, so the reel stops square on it.
  const h = symH();
  reels[i].innerHTML = strips[i].map((s) => `<div class="sym ${SYMBOLS[s].cls}" style="height:${h}px">${SYMBOLS[s].ch}</div>`).join('');
}
reels.forEach((_, i) => { paint(i); reels[i].style.transform = `translateY(${-(LEN - 1) * symH()}px)`; });

const machine = document.querySelector('.machine');
const msg = document.getElementById('spinMsg');
const btn = document.getElementById('spinBtn');
let spins = 0;
btn.addEventListener('click', () => {
  if (btn.disabled) return;
  btn.disabled = true;
  machine.classList.remove('win');
  msg.textContent = 'Spinning…';
  spins++;
  // Every few spins, and the first time, the reels are kind.
  const lucky = spins === 1 || Math.random() < 0.28;
  const results = lucky ? Array(3).fill(Math.random() < 0.5 ? 0 : Math.floor(Math.random() * SYMBOLS.length)) : SYMBOLS.map((_, k) => k).sort(() => Math.random() - 0.5).slice(0, 3);
  const h = symH();
  let done = 0;
  reels.forEach((strip, i) => {
    // Keep the symbol showing now at the top, a fresh run below it, and the
    // result at the bottom; then run from the top to the bottom.
    const showing = strips[i][LEN - 1];
    strips[i] = [showing, ...Array.from({ length: LEN - 2 }, () => Math.floor(Math.random() * SYMBOLS.length)), results[i]];
    paint(i);
    strip.style.transition = 'none';
    strip.style.transform = 'translateY(0)';
    void strip.offsetHeight;
    strip.classList.add('blur');
    const ms = 1400 + i * 450;
    strip.style.transition = `transform ${ms}ms cubic-bezier(.12,.75,.18,1.02)`;
    strip.style.transform = `translateY(${-(LEN - 1) * h}px)`;
    setTimeout(() => strip.classList.remove('blur'), ms - 350);
    setTimeout(() => {
      done++;
      if (done < 3) return;
      btn.disabled = false;
      const win = results[0] === results[1] && results[1] === results[2];
      if (win) {
        machine.classList.add('win');
        msg.textContent = results[0] === 0 ? 'Three sevens. In the game, wins pay out in chips.' : 'Three of a kind. In the game, wins pay out in chips.';
        burst();
      } else {
        msg.textContent = 'No win this time. Spin again.';
      }
    }, ms + 30);
  });
});

// Gold leaf and white, from the machine.
function burst() {
  if (STILL) return;
  const r = machine.getBoundingClientRect();
  const colors = ['#d9b56a', '#f6e6bd', '#b08a45', '#ffffff', '#8c6c3a'];
  for (let i = 0; i < 90; i++) {
    const p = document.createElement('i');
    p.className = 'confetti';
    p.style.background = colors[i % colors.length];
    document.body.appendChild(p);
    const x0 = r.left + r.width / 2, y0 = r.top + r.height * 0.35;
    const a = Math.random() * Math.PI * 2, v = 6 + Math.random() * 10;
    let x = x0, y = y0, vx = Math.cos(a) * v, vy = Math.sin(a) * v - 8, rot = Math.random() * 360, life = 0;
    const tick = () => {
      life++; vy += 0.45; vx *= 0.985; x += vx; y += vy; rot += 12;
      p.style.transform = `translate(${x}px, ${y}px) rotate(${rot}deg)`;
      p.style.opacity = String(Math.max(0, 1 - life / 110));
      if (life < 110) requestAnimationFrame(tick); else p.remove();
    };
    requestAnimationFrame(tick);
  }
}

// ---------- the story: a hand of blackjack, played by scrolling ----------
const story = document.getElementById('story');
const steps = [...story.querySelectorAll('.story-steps li')];
const storyPin = story.querySelector('.story-pin');
function storyProgress(p) {
  storyPin.style.setProperty('--p', p.toFixed(4));
  // The win banner rises with the winnings.
  const w = Math.max(0, Math.min(1, (p - 0.8) / 0.08));
  storyPin.style.setProperty('--win', w.toFixed(3));
  story.classList.toggle('started', p > 0.02);
  let on = 0;
  steps.forEach((li, i) => { if (p >= Number(li.dataset.at)) on = i; });
  steps.forEach((li, i) => { li.classList.toggle('on', i === on); li.classList.toggle('past', i < on); });
}
storyProgress(0);
// Built when it comes near, so the page opens fast.
new IntersectionObserver(([e], obs) => {
  if (!e.isIntersecting) return;
  obs.disconnect();
  import('./story3d.js').then(({ startStory }) => startStory(document.getElementById('story3d'), storyProgress)).catch(() => { /* captions still read */ });
}, { rootMargin: '600px 0px' }).observe(story);

// ---------- headings decode into place ----------
const GLYPHS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789♠♥♦♣';
function decode(el) {
  const node = [...el.childNodes].reverse().find((n) => n.nodeType === 3 && n.textContent.trim());
  if (!node || STILL) return;
  const final = node.textContent;
  const t0 = performance.now(), ms = 900;
  const step = (now) => {
    const k = Math.min(1, (now - t0) / ms);
    const fixed = Math.floor(final.length * k);
    node.textContent = final.slice(0, fixed) + final.slice(fixed).replace(/[^\s.,']/g, () => GLYPHS[Math.floor(Math.random() * GLYPHS.length)]);
    if (k < 1) requestAnimationFrame(step); else node.textContent = final;
  };
  requestAnimationFrame(step);
}
const decoder = new IntersectionObserver((entries) => {
  entries.forEach((e) => { if (e.isIntersecting) { decoder.unobserve(e.target); setTimeout(() => decode(e.target), 150); } });
}, { threshold: 0.6 });
document.querySelectorAll('.title').forEach((el) => decoder.observe(el));

// ---------- buttons lean toward the pointer ----------
if (window.matchMedia('(hover: hover)').matches && !STILL) {
  document.querySelectorAll('.btn-neon, .btn-glass, .nav-play, .btn-spin').forEach((b) => {
    b.addEventListener('pointermove', (e) => {
      const r = b.getBoundingClientRect();
      const dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
      b.style.transform = `translate(${dx * 0.18}px, ${dy * 0.28}px)`;
    });
    b.addEventListener('pointerleave', () => { b.style.transform = ''; });
  });
}

// ---------- feedback: composed into an email to the house ----------
const FEEDBACK_TO = 'feedback@nvgrcasino.com';
const fb = document.getElementById('fbForm');
fb.addEventListener('submit', (e) => {
  e.preventDefault();
  const data = new FormData(fb);
  const ideas = data.getAll('idea');
  const note = String(data.get('note') || '').trim();
  const done = document.getElementById('fbDone');
  if (!ideas.length && !note) { done.textContent = 'Please select a feature or add a comment.'; return; }
  const name = String(data.get('name') || '').trim();
  const body = [
    ideas.length ? `Requested features:\n- ${ideas.join('\n- ')}` : '',
    note ? `\nComments:\n${note}` : '',
    `\nPlatform: ${data.get('device')}`,
    name ? `From: ${name}` : '',
  ].filter(Boolean).join('\n');
  location.href = `mailto:${FEEDBACK_TO}?subject=${encodeURIComponent('NVGR Casino feedback' + (name ? ' from ' + name : ''))}&body=${encodeURIComponent(body)}`;
  done.textContent = 'Your email app will open with your feedback filled in. Thank you.';
  burstFrom(fb.querySelector('.fb-send'));
});
// Gold leaf from the button, as at the slot.
function burstFrom(el) {
  if (STILL) return;
  const r = el.getBoundingClientRect();
  const colors = ['#d9b56a', '#f6e6bd', '#b08a45', '#ffffff'];
  for (let i = 0; i < 50; i++) {
    const p = document.createElement('i');
    p.className = 'confetti';
    p.style.background = colors[i % colors.length];
    document.body.appendChild(p);
    let x = r.left + r.width / 2, y = r.top, vx = (Math.random() - 0.5) * 12, vy = -6 - Math.random() * 9, rot = 0, life = 0;
    const tick = () => {
      life++; vy += 0.4; x += vx; y += vy; rot += 14;
      p.style.transform = `translate(${x}px, ${y}px) rotate(${rot}deg)`;
      p.style.opacity = String(Math.max(0, 1 - life / 90));
      if (life < 90) requestAnimationFrame(tick); else p.remove();
    };
    requestAnimationFrame(tick);
  }
}

// ---------- meet the house ----------
const ROSTER = [
  { key: 'm4', name: 'Victor', tag: 'High-limit tables', line: 'Deals the high-limit rooms, in a black waistcoat and bow tie.' },
  { key: 'f5', name: 'Elena', tag: 'Blackjack', line: 'Deals blackjack at the top tables, in the black dress of the high-limit rooms.' },
  { key: 'm5', name: 'Marcus', tag: 'Roulette', line: 'Runs the roulette wheel, in the burgundy waistcoat of the penthouse tables.' },
  { key: 'f4', name: 'Sofia', tag: 'Baccarat', line: 'Deals baccarat from the shoe, in the black waistcoat of the house.' },
  { key: 'm1', name: 'James', tag: 'Everyday tables', line: 'Deals the low-limit tables, where every new player starts.' },
];
const houseEl = document.getElementById('house');
const namesEl = document.getElementById('houseNames');
const card = document.getElementById('houseCard');
let house = null;
function showDealer(i) {
  [...namesEl.children].forEach((b, k) => b.classList.toggle('on', k === i));
  const d = i >= 0 ? ROSTER[i] : null;
  card.classList.add('swap');
  setTimeout(() => {
    document.getElementById('houseTag').textContent = d ? d.tag : 'The dealers';
    document.getElementById('houseName').textContent = d ? d.name : 'The floor staff';
    document.getElementById('houseLine').textContent = d ? d.line : 'Select a dealer below.';
    card.classList.remove('swap');
  }, 220);
}
new IntersectionObserver(([e], obs) => {
  if (!e.isIntersecting) return;
  obs.disconnect();
  import('./house3d.js').then(({ startHouse }) => {
    house = startHouse(document.getElementById('house3d'), ROSTER, (i) => showDealer(i));
    if (!house) return;
    namesEl.innerHTML = ROSTER.slice(0, house.count).map((d, i) => `<button role="tab" class="auto" data-i="${i}">${d.name}<span class="bar"><i></i></span></button>`).join('');
    namesEl.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => {
      namesEl.querySelectorAll('button').forEach((x) => x.classList.remove('auto'));
      house.setFocus(Number(b.dataset.i));
    }));
  }).catch(() => { /* the card still introduces them */ });
}, { rootMargin: '500px 0px' }).observe(houseEl);
