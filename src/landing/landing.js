// The front page of nvgrcasino.com: the testing-phase notice, the Android
// download and the way into the game (./play/).
import './landing.css';

// An invite link from before the game moved to /play/ (…/?room=CODE)
// still takes you to that table.
if (/[?&]room=/.test(location.search)) location.replace('./play/' + location.search);

document.getElementById('year').textContent = new Date().getFullYear();

// The newest APK's version and size, from the repository's "android" release.
fetch('https://api.github.com/repos/Nvgr-Casino/NVGR-Blackjack/releases/tags/android')
  .then((r) => (r.ok ? r.json() : null))
  .then((rel) => {
    if (!rel) return;
    const apk = (rel.assets || []).find((a) => a.name === 'NVGR-Casino.apk');
    if (!apk) return;
    const version = (rel.body || '').match(/version (\d+\.\d+\.\d+)/);
    const mb = Math.round(apk.size / 1048576);
    const date = new Date(apk.updated_at).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
    document.getElementById('apkMeta').textContent = `${version ? 'v' + version[1] + ' · ' : ''}${mb} MB · updated ${date}`;
  })
  .catch(() => { /* the button works without it */ });
