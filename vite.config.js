import { defineConfig } from 'vite';

// The site is served from https://nvgr-casino.github.io/NVGR-Blackjack/, so
// every built asset URL has to carry that project path — without this the
// bundle would ask for /assets/... at the domain root and 404.
export default defineConfig({
  base: '/NVGR-Blackjack/',
});
