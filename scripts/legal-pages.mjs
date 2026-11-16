// The Terms of Service and the Privacy Policy as pages on the website, from
// the same text the app shows (src/app/legalText.js).
//
//   node scripts/legal-pages.mjs
import { writeFileSync, mkdirSync } from 'node:fs';
import { TERMS, PRIVACY } from '../src/app/legalText.js';

const page = (title, body) => `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title} · NVGR Casino</title><meta name="description" content="${title} for NVGR Casino, a social casino game.">
<link rel="icon" href="/icons/icon-192.png">
<style>
  body { margin: 0; font: 16px/1.65 -apple-system, "Segoe UI", Roboto, Inter, sans-serif; color: #2b3345; background: #f6f5f1; }
  header { background: linear-gradient(160deg, #2458a6, #133673); padding: 18px 20px; }
  header a { color: #fff; text-decoration: none; font-weight: 700; letter-spacing: 0.08em; }
  nav { margin-top: 6px; display: flex; gap: 16px; font-size: 14px; }
  nav a { color: rgba(255,255,255,0.85); font-weight: 600; letter-spacing: 0; }
  main { max-width: 760px; margin: 0 auto; padding: 24px 20px 60px; }
  h2 { font-size: 28px; color: #13284f; margin: 0; } h3 { color: #13284f; margin: 26px 0 6px; font-size: 18px; }
  .legal-date { color: #6a7387; font-size: 14px; } a { color: #1a4fa8; }
</style></head>
<body><header><a href="/">NVGR CASINO</a><nav><a href="/terms.html">Terms of Service</a><a href="/privacy.html">Privacy Policy</a></nav></header>
<main>${body}</main></body></html>
`;
mkdirSync('public', { recursive: true });
writeFileSync('public/terms.html', page('Terms of Service', TERMS));
writeFileSync('public/privacy.html', page('Privacy Policy', PRIVACY));
console.log('legal pages written');
