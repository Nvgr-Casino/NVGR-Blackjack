// Small shared bits ported from index4.html, used by more than one screen.
// nvgr-mark.png is the supplied artwork (nvgr-logo.png, gold on solid
// black) keyed to real transparency: alpha taken from the brightest
// channel and the colour un-premultiplied, so the glow still reads as
// glow over the dark page instead of sitting in a black box.
import logoUrl from '../assets/nvgr-mark.png';

export const LOGO_URL = logoUrl;

export function brandMark(className = '') {
  return `<img class="brand-mark ${className}" src="${logoUrl}" alt="NVGR Blackjack 21">`;
}

// The house brand: NVGR Casino, the company Blackjack 21 sits under (and
// whatever tables come after it). Drawn as inline SVG rather than shipped
// as art so it stays crisp at every size, inherits the page's Cinzel
// serif, and can be recoloured from CSS.
export function casinoMark(className = '') {
  return `
<svg class="casino-mark ${className}" viewBox="0 0 560 222" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="NVGR Casino">
  <defs>
    <linearGradient id="nvgrCasinoGold" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#fff4cf"/>
      <stop offset="0.32" stop-color="#f2d179"/>
      <stop offset="0.54" stop-color="#d9ae45"/>
      <stop offset="0.79" stop-color="#a9822f"/>
      <stop offset="1" stop-color="#e8c561"/>
    </linearGradient>
  </defs>
  <g fill="url(#nvgrCasinoGold)">
    <g transform="translate(280 2) scale(1.16)">
      <path d="M-47 50 L-47 15 L-23 37 L0 5 L23 37 L47 15 L47 50 Z"/>
      <rect x="-52" y="53" width="104" height="13" rx="4"/>
      <circle cx="-47" cy="11" r="5.5"/>
      <circle cx="0" cy="1" r="6.5"/>
      <circle cx="47" cy="11" r="5.5"/>
      <path d="M-24 57 L-19 62 L-24 67 L-29 62 Z"/>
      <path d="M24 57 L29 62 L24 67 L19 62 Z"/>
    </g>
    <text x="283" y="152" text-anchor="middle" font-family="Cinzel, Georgia, serif" font-size="88" font-weight="700" letter-spacing="6">NVGR</text>
    <rect x="116" y="174" width="134" height="2.2" rx="1"/>
    <path d="M280 167 L288 175 L280 183 L272 175 Z"/>
    <rect x="310" y="174" width="134" height="2.2" rx="1"/>
    <text x="289" y="213" text-anchor="middle" font-family="Cinzel, Georgia, serif" font-size="29" font-weight="600" letter-spacing="18">CASINO</text>
  </g>
</svg>`;
}

export function esc(s) {
  return (s || '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] || c));
}

export const SUIT_FLOAT_HTML = `
  <div class="suit-float" style="top:8%;left:6%;">♠</div>
  <div class="suit-float" style="top:60%;left:88%;animation-delay:3s;">♥</div>
  <div class="suit-float" style="top:80%;left:10%;animation-delay:6s;">♦</div>
  <div class="suit-float" style="top:20%;left:82%;animation-delay:9s;">♣</div>
  <div class="bg-card" style="top:12%;left:2%;transform:rotate(-18deg);"></div>
  <div class="bg-card" style="top:55%;left:90%;transform:rotate(14deg);"></div>
  <div class="bg-card" style="top:75%;left:4%;transform:rotate(9deg);"></div>
  <div class="bg-card" style="top:18%;left:86%;transform:rotate(-10deg);"></div>
`;
