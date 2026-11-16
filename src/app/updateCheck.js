// The Android app is installed from the website, not a store, so nothing
// updates it on its own. On opening, the app asks GitHub which version the
// download link now serves; when that is newer than this build, a notice
// offers the update. The new APK is signed with the same key, so Android
// installs it over this one and the player keeps their account.

import { IN_APP } from '../platform.js';
import { Capacitor, registerPlugin } from '@capacitor/core';

const ApkUpdater = registerPlugin('ApkUpdater');

const APK_URL = 'https://github.com/Nvgr-Casino/NVGR-Blackjack/releases/download/android/NVGR-Casino.apk';
const RELEASE_API = 'https://api.github.com/repos/Nvgr-Casino/NVGR-Blackjack/releases/tags/android';
// Set by the Android build (the workflow's run number); empty elsewhere.
const THIS_BUILD = Number(import.meta.env.VITE_APP_BUILD) || 0;
const SNOOZE_KEY = 'nvgr-update-snoozed';

function snoozed(build) {
  try { return localStorage.getItem(SNOOZE_KEY) === String(build); } catch { return false; }
}
function snooze(build) {
  try { localStorage.setItem(SNOOZE_KEY, String(build)); } catch { /* private storage */ }
}

function showNotice(latest, url = APK_URL) {
  if (document.getElementById('updateNotice')) return;
  const el = document.createElement('div');
  el.id = 'updateNotice';
  el.className = 'update-notice';
  el.setAttribute('role', 'status');
  el.innerHTML = `
    <div class="un-text">
      <strong>A new version of NVGR Casino is available</strong>
      <span>Version 1.0.${latest}. Your account and chips carry over.</span>
    </div>
    <div class="un-actions">
      <button class="btn btn-ghost btn-sm" data-un="later">Later</button>
      <button class="btn btn-primary btn-sm" data-un="update">Update</button>
    </div>`;
  el.addEventListener('click', (e) => {
    const act = e.target.closest('[data-un]');
    if (!act) return;
    if (act.dataset.un === 'update') {
      if (Capacitor.isPluginAvailable('ApkUpdater')) { updateInApp(el, latest, url); return; }
      // An app from before in-app updates: the phone's browser downloads it.
      window.location.href = url;
    } else {
      snooze(latest);
    }
    el.remove();
  });
  document.body.appendChild(el);
}

// Downloading inside the app, with a progress bar, then Android's installer.
async function updateInApp(el, latest, url) {
  el.innerHTML = `
    <div class="un-text">
      <strong>Downloading version 1.0.${latest}</strong>
      <span class="un-bar"><i style="width:0%"></i></span>
      <span class="un-pct">0%</span>
    </div>`;
  const bar = el.querySelector('.un-bar i'), pct = el.querySelector('.un-pct');
  const listener = await ApkUpdater.addListener('progress', ({ percent }) => {
    bar.style.width = `${percent}%`;
    pct.textContent = `${percent}%`;
  });
  try {
    await ApkUpdater.download({ url });
    listener.remove();
    const install = async () => {
      const r = await ApkUpdater.install();
      if (r && r.needsPermission) {
        el.innerHTML = `
          <div class="un-text"><strong>Allow updates for NVGR Casino</strong><span>Turn on "Allow from this source", come back, then tap Install.</span></div>
          <div class="un-actions"><button class="btn btn-primary btn-sm" data-un-install>Install</button></div>`;
        el.querySelector('[data-un-install]').onclick = install;
      } else {
        el.innerHTML = `
          <div class="un-text"><strong>Ready to install version 1.0.${latest}</strong><span>Confirm on Android's screen. The app restarts on the new version.</span></div>
          <div class="un-actions"><button class="btn btn-primary btn-sm" data-un-install>Install</button></div>`;
        el.querySelector('[data-un-install]').onclick = install;
      }
    };
    await install();
  } catch {
    listener.remove();
    el.innerHTML = `
      <div class="un-text"><strong>The update did not download</strong><span>Check your connection and try again.</span></div>
      <div class="un-actions"><button class="btn btn-primary btn-sm" data-un-retry>Try again</button></div>`;
    el.querySelector('[data-un-retry]').onclick = () => updateInApp(el, latest, url);
  }
}

// Android keeps the app alive in the background, so reopening it usually
// resumes it rather than starting it again: the check also runs each time
// the app comes back into view (at most every ten minutes) and every half
// hour while it is open, not only when it starts.
let lastCheck = 0;
let watching = false;
function watch() {
  if (watching) return;
  watching = true;
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && Date.now() - lastCheck > 10 * 60 * 1000) checkForAppUpdate();
  });
  setInterval(() => { if (!document.hidden) checkForAppUpdate(); }, 30 * 60 * 1000);
}

export async function checkForAppUpdate() {
  if (!IN_APP || !THIS_BUILD) return;
  watch();
  lastCheck = Date.now();
  try {
    const res = await fetch(RELEASE_API, { cache: 'no-store', headers: { Accept: 'application/vnd.github+json' } });
    if (!res.ok) return;
    const release = await res.json();
    const m = /version 1\.0\.(\d+)/.exec(release.body || '');
    const latest = m ? Number(m[1]) : 0;
    // The file itself, from this release, with the version on the link: the
    // fixed download address could be answered from a cache with the
    // previous version for a while after a new one is published, so the
    // update installed the old app and the notice came straight back.
    const asset = (release.assets || []).find((a) => /\.apk$/i.test(a.name));
    const url = `${(asset && asset.browser_download_url) || APK_URL}?v=${latest}`;
    if (latest > THIS_BUILD && !snoozed(latest)) showNotice(latest, url);
  } catch { /* offline: try again next launch */ }
}
