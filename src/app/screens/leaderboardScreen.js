// The leaderboard: a framed panel with tabs (Richest, Tournament winnings),
// the top three on a podium — gold in the middle, crowned — the rest in a
// clean ranked list, and your own place held at the foot.
import { safeKey } from '../roomLogic.js';
import { esc } from '../uiHelpers.js';
import { characterPortraitDataURL, defaultCharacterFor } from '../../scene/character.js';
import * as S from '../session.js';
import * as Leaderboard from '../leaderboard.js';
import { openProfile } from './profile.js';

let by = 'chips';
const face = (e, size = 96) => characterPortraitDataURL(e.character || defaultCharacterFor(e.key || ''), size);
const value = (e) => (by === 'winnings' ? e.winnings : e.chips).toLocaleString();
const short = (n) => n >= 1e9 ? `${+(n / 1e9).toFixed(1)}B` : n >= 1e6 ? `${+(n / 1e6).toFixed(1)}M` : n >= 1e4 ? `${Math.round(n / 1e3)}K` : n.toLocaleString();
const CROWN = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 18 2 7l5.5 4L12 4l4.5 7L22 7l-1 11z"/></svg>';

export function openLeaderboard() {
  draw();
  if (!Leaderboard.entries) Leaderboard.loadLeaderboard().then(draw).catch(draw);
}
function close() { const el = document.getElementById('lbOverlay'); if (el) el.remove(); }

function html() {
  const list = Leaderboard.ranked(by);
  const myKey = safeKey(S.session.uid || '');
  const mine = list.findIndex((e) => e.key === myKey);
  let body;
  if (!Leaderboard.entries) body = '<div class="fh-empty">Loading the leaderboard…</div>';
  else if (!list.length) body = `<div class="fh-empty">${by === 'winnings' ? 'No tournament winnings yet. Be the first.' : 'Nobody on the board yet.'}</div>`;
  else {
    const top = list.slice(0, 3);
    const order = [1, 0, 2].filter((i) => top[i]);
    const podium = `<div class="lb-podium">${order.map((i) => {
      const e = top[i];
      return `<button class="lb-spot p${i + 1} ${e.key === myKey ? 'me' : ''}" data-lb-prof="${esc(e.key)}" data-lb-name="${esc(e.name)}">
        ${i === 0 ? `<span class="lb-crown">${CROWN}</span>` : ''}
        <span class="lb-portrait"><img src="${face(e, 128)}" alt=""><i>${i + 1}</i></span>
        <b>${esc(e.name)}</b>
        <span class="lb-amt">${short(by === 'winnings' ? e.winnings : e.chips)}</span>
      </button>`;
    }).join('')}</div>`;
    const rows = list.slice(3, 50).map((e, k) => `
      <button class="lb-row ${e.key === myKey ? 'me' : ''}" data-lb-prof="${esc(e.key)}" data-lb-name="${esc(e.name)}">
        <span class="lb-rank">${k + 4}</span>
        <img class="lb-face" src="${face(e, 64)}" alt="">
        <span class="lb-name">${esc(e.name)}${by === 'winnings' ? `<small>${e.wins} win${e.wins === 1 ? '' : 's'} · ${e.cashes} cash${e.cashes === 1 ? '' : 'es'}</small>` : ''}</span>
        <span class="lb-val">${value(e)}</span>
      </button>`).join('');
    body = `${podium}<div class="lb-list">${rows}</div>`;
  }
  const me = mine >= 0 ? list[mine] : null;
  return `
    <main class="fh lb">
      <header class="fh-top">
        <button class="fh-back" data-lb-close aria-label="Back"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg></button>
        <h1>Leaderboard</h1><span></span>
      </header>
      <nav class="fh-tabs" role="tablist">
        <button class="fh-tab ${by === 'chips' ? 'on' : ''}" data-lb-by="chips" role="tab" aria-selected="${by === 'chips'}">Richest</button>
        <button class="fh-tab ${by === 'winnings' ? 'on' : ''}" data-lb-by="winnings" role="tab" aria-selected="${by === 'winnings'}">Tournament winnings</button>
      </nav>
      <section class="fh-panel lb-panel">
        <div class="lb-scroll">${body}</div>
        ${me ? `<div class="lb-row lb-mine"><span class="lb-rank">${mine + 1}</span><img class="lb-face" src="${face(me, 64)}" alt=""><span class="lb-name">You<small>${esc(me.name)}</small></span><span class="lb-val">${value(me)}</span></div>` : ''}
      </section>
    </main>`;
}

function draw() {
  let el = document.getElementById('lbOverlay');
  if (!el) {
    el = document.createElement('div');
    el.id = 'lbOverlay';
    el.className = 'lb-overlay';
    el.addEventListener('click', (e) => {
      if (e.target.closest('[data-lb-close]')) return close();
      const t = e.target.closest('[data-lb-by]');
      if (t) { by = t.dataset.lbBy; return draw(); }
      const p = e.target.closest('[data-lb-prof]');
      if (p) openProfile(p.dataset.lbProf, p.dataset.lbName);
    });
    document.body.appendChild(el);
  }
  el.innerHTML = html();
}
