// Lays out the built website: the front page (landing.html) becomes the
// site's index, and the game moves to /play/. Every asset URL in the build
// is absolute (vite.config.js base), so the pages work from either place.
//
//   node scripts/site-layout.mjs        (run by `npm run build`)
import { renameSync, mkdirSync, existsSync } from 'node:fs';

const DIST = 'dist';
if (!existsSync(`${DIST}/landing.html`)) throw new Error('dist/landing.html missing: build the site first');
mkdirSync(`${DIST}/play`, { recursive: true });
renameSync(`${DIST}/index.html`, `${DIST}/play/index.html`);
renameSync(`${DIST}/landing.html`, `${DIST}/index.html`);
console.log('site laid out: front page at /, game at /play/');
