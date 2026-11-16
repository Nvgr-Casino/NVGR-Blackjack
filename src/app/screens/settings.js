// Settings: the sound (music and effects, each with a switch and its own
// volume), the account (who you are, signing out), and a way to tell the
// house about a problem or an idea. An overlay of its own, like the
// profile, over whatever screen is showing.

import { ref, push } from 'firebase/database';
import { db } from '../../firebase/config.js';
import { esc } from '../uiHelpers.js';
import { safeKey } from '../roomLogic.js';
import { IN_APP } from '../../platform.js';
import * as S from '../session.js';
import * as Sfx from '../../scene/sfx.js';

const FEEDBACK_EMAIL = 'feedback@nvgrcasino.com';
const BUILD = Number(import.meta.env.VITE_APP_BUILD) || 0;

let st = null;   // { kind, note, busy }

export function openSettings() {
  st = { kind: 'bug', note: '', busy: false };
  draw();
}
export function closeSettings() {
  st = null;
  const el = document.getElementById('stOverlay');
  if (el) el.remove();
}

const toggle = (id, on, label) => `<button class="st-switch ${on ? 'on' : ''}" role="switch" aria-checked="${on}" aria-label="${label}" data-st-toggle="${id}"><i></i></button>`;
const slider = (id, v, label) => `<input class="st-range" type="range" min="0" max="100" step="1" value="${Math.round(v * 100)}" aria-label="${label}" data-st-range="${id}" style="--v:${Math.round(v * 100)}%">`;

function html() {
  const guest = !!S.session.guest;
  return `
    <div class="pf-card st-card" role="dialog" aria-modal="true" aria-label="Settings">
      <header class="pf-titlebar">
        <span class="pf-rule"></span><h2>Settings</h2><span class="pf-rule"></span>
        <button class="pf-close" data-st="close" aria-label="Close"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg></button>
      </header>
      <div class="st-grid">
        <section class="st-section">
          <h3>Sound</h3>
          <div class="st-row"><span class="st-label">Music</span>${toggle('music', Sfx.isMusicOn(), 'Music')}${slider('music', Sfx.musicVolume(), 'Music volume')}</div>
          <div class="st-row"><span class="st-label">Sound effects</span>${toggle('sound', Sfx.isSoundOn(), 'Sound effects')}${slider('sound', Sfx.soundVolume(), 'Sound effects volume')}</div>
          <h3>Account</h3>
          <div class="st-account">
            <span><b>${esc(S.session.name || 'Player')}</b><small>${guest ? 'Playing as a guest: your chips stay on this device.' : 'Signed in: your chips follow you to every device.'}</small></span>
            <button class="pf-btn ghost" data-st="signout">Sign out</button>
          </div>
        </section>
        <section class="st-section">
          <h3>Help us improve</h3>
          <div class="segmented st-seg" role="tablist">
            <button class="seg ${st.kind === 'bug' ? 'active' : ''}" data-st-kind="bug" role="tab" aria-selected="${st.kind === 'bug'}">Report a problem</button>
            <button class="seg ${st.kind === 'idea' ? 'active' : ''}" data-st-kind="idea" role="tab" aria-selected="${st.kind === 'idea'}">Suggest a feature</button>
          </div>
          <textarea class="st-text" id="stText" maxlength="1500" placeholder="${st.kind === 'bug' ? 'What happened, and what were you doing when it did?' : 'What would you like to see in NVGR Casino?'}"></textarea>
          <button class="pf-btn st-send" data-st="send" ${st.busy ? 'disabled' : ''}>${st.busy ? 'Sending…' : 'Send'}</button>
          ${st.note ? `<p class="pf-note">${esc(st.note)}</p>` : ''}
        </section>
      </div>
      <p class="st-version">NVGR Casino${BUILD ? ` · version 1.0.${BUILD}` : ''}</p>
    </div>`;
}

function draw() {
  if (!st) return;
  let el = document.getElementById('stOverlay');
  const text = el && el.querySelector('#stText') ? el.querySelector('#stText').value : '';
  if (!el) {
    el = document.createElement('div');
    el.id = 'stOverlay';
    el.className = 'pf-overlay';
    el.addEventListener('click', onClick);
    el.addEventListener('input', onInput);
    document.body.appendChild(el);
  }
  el.innerHTML = html();
  const ta = el.querySelector('#stText');
  if (ta && text) ta.value = text;
}

function onInput(e) {
  const r = e.target.closest('[data-st-range]');
  if (!r) return;
  const v = Number(r.value) / 100;
  r.style.setProperty('--v', `${r.value}%`);
  if (r.dataset.stRange === 'music') Sfx.setMusicVolume(v); else Sfx.setSoundVolume(v);
}

async function onClick(e) {
  if (e.target === e.currentTarget) return closeSettings();
  if (!st) return;
  const t = e.target.closest('[data-st],[data-st-toggle],[data-st-kind]');
  if (!t) return;
  const d = t.dataset;
  if (d.st === 'close') return closeSettings();
  if (d.st === 'signout') { closeSettings(); return S.doSignOut(); }
  if (d.stToggle === 'music') { Sfx.setMusicOn(!Sfx.isMusicOn()); return draw(); }
  if (d.stToggle === 'sound') { Sfx.setSoundOn(!Sfx.isSoundOn()); return draw(); }
  if (d.stKind) { st.kind = d.stKind; st.note = ''; return draw(); }
  if (d.st === 'send') {
    const ta = document.getElementById('stText');
    const text = (ta && ta.value || '').trim();
    if (text.length < 5) { st.note = 'Please write a little more, so we can act on it.'; return draw(); }
    st.busy = true; st.note = ''; draw();
    const report = {
      kind: st.kind, text: text.slice(0, 1500), name: (S.session.name || '').slice(0, 40), at: Date.now(),
      platform: IN_APP ? 'android-app' : 'web', build: BUILD, agent: navigator.userAgent.slice(0, 160),
    };
    try {
      // Kept in the database for the house to read.
      await push(ref(db, 'reports/' + safeKey(S.session.uid)), report);
      st.note = st.kind === 'bug' ? 'Thank you. Your report has been sent to the team.' : 'Thank you. Your suggestion has been sent to the team.';
      if (ta) ta.value = '';
    } catch {
      // Until the database takes reports, the phone's email does.
      const subject = encodeURIComponent(st.kind === 'bug' ? 'NVGR Casino: a problem' : 'NVGR Casino: a suggestion');
      const body = encodeURIComponent(`${text}\n\n— ${report.name}, ${report.platform}${BUILD ? `, version 1.0.${BUILD}` : ''}`);
      window.location.href = `mailto:${FEEDBACK_EMAIL}?subject=${subject}&body=${body}`;
      st.note = 'Your email app has opened with your message, ready to send.';
    }
    st.busy = false;
    draw();
  }
}
