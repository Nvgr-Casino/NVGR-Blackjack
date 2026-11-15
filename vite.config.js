import { defineConfig } from 'vite';

// The site is served from https://nvgr-casino.github.io/NVGR-Blackjack/, so
// every built asset URL has to carry that project path — without this the
// bundle would ask for /assets/... at the domain root and 404.
//
// Two pages: the game (index.html) and the website's front page
// (landing.html). scripts/site-layout.mjs then puts the front page at the
// root and the game at /play/. The Android app (--mode app) is the game
// alone.
export default defineConfig(({ mode }) => ({
  base: '/NVGR-Blackjack/',
  build: {
    rollupOptions: {
      input: mode === 'app' ? { index: 'index.html' } : { index: 'index.html', landing: 'landing.html' },
    },
  },
}));
