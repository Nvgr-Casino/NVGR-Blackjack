import { defineConfig } from 'vite';

// The site is served from the root of its own domain, https://nvgrcasino.com/
// (GitHub Pages, custom domain), so asset URLs start at /. The old address,
// nvgr-casino.github.io/NVGR-Blackjack/, redirects there.
//
// Two pages: the game (index.html) and the website's front page
// (landing.html). scripts/site-layout.mjs then puts the front page at the
// root and the game at /play/. The Android app (--mode app) is the game
// alone.
export default defineConfig(({ mode }) => ({
  base: '/',
  build: {
    rollupOptions: {
      input: mode === 'app' ? { index: 'index.html' } : { index: 'index.html', landing: 'landing.html' },
    },
  },
}));
