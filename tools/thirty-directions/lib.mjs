/**
 * THIRTY DIRECTIONS — the shared shell every direction is drawn into.
 *
 * ── THE EXPERIMENTAL DESIGN, STATED BECAUSE IT IS THE WHOLE POINT ───────────────────────────
 * The C2 control set is IDENTICAL in all thirty renders: Play Online, Practice vs bots, the
 * daily-bonus strip, the balance pill, the tab bar — same text, same sizes, same colours, same
 * order as ships today. **The art is the only variable.**
 *
 * Two reasons, both load-bearing:
 *   1. Ranking. If the buttons moved between directions, a direction could win on layout and be
 *      recorded as winning on art. Holding them fixed means every difference in the pictures is
 *      the thing being judged.
 *   2. The floor. Contrast and target size are measured on the SAME controls every time, so a
 *      floor failure can only have been caused by the art changing what sits behind them — which
 *      is exactly the failure worth catching before anyone falls in love with a picture.
 *
 * ── IRON RULE #3 ────────────────────────────────────────────────────────────────────────────
 * Board count is DYNAMIC — 2P=4, 3P=3, 4P=2. Every direction that draws boards takes the count
 * as an argument and is rendered at the 3-player default the home screen actually shows. No
 * direction may say "four boards" in copy, and `assertNoBoardCountClaim()` below fails the
 * build if one does. The app already had to retract exactly that sentence once.
 *
 * ── WHAT THESE RENDERS ARE, AND ARE NOT ─────────────────────────────────────────────────────
 * CSS and SVG only, drawn in the same browser engine the app's web build runs in. No photos, no
 * illustration, no 3D. Several directions below are ideas whose finished form needs a
 * photographer or an illustrator, and the render is a sketch of the idea rather than the thing.
 * Where that is true the direction says so in its own `needs` field, and the report repeats it.
 * A render that flatters an idea it cannot actually deliver is the same failure as a claim
 * without evidence.
 *
 * Grain and felt weave ARE real here — SVG `feTurbulence` is genuine procedural noise, not a
 * picture of noise — so the texture directions are honest renders rather than sketches.
 */

import fs from 'node:fs';
import path from 'node:path';

/** Where the Google Fonts TTFs are cached. Never committed — binaries do not belong in the repo. */
export const FONT_CACHE = process.env.CAPS_FONT_CACHE
  || '/tmp/claude-0/-home-user-caps-poker/29632af8-42ab-5a2c-a794-9f3ca7c63779/scratchpad/fontcache';

/** The SHIPPED palette, lifted from constants/paintThemes.ts (OBSIDIAN) — not invented here. */
export const P = {
  bg:        '#0a0a0a',
  surface:   '#161922',
  gold:      '#c9a84c',
  goldLight: '#e8c96a',
  mint:      '#4FD6A8',
  mintLight: '#7FE3C2',
  green:     '#22C55E',   // the shipped Play Online fill
  text:      '#f0ead6',
  textMuted: '#9aa19b',
  cardFace:  '#FCFAF3',   // heroPip / Card face. NOT #FFFEF8 — that value has never rendered
  cardRed:   '#c0392b',
  cardBlack: '#1a1a2e',
  feltTop:   '#003115',   // FELT_GRADIENT.classic
  feltBot:   '#062E18',
  panel:     '#04351A',   // the shipped hero table panel
};

const FONTS = [
  ['Playfair Display', 400, 'playfair-400.ttf'],
  ['Playfair Display', 700, 'playfair-700.ttf'],
  ['Playfair Display', 900, 'playfair-900.ttf'],
  ['Inter', 400, 'inter-400.ttf'],
  ['Inter', 600, 'inter-600.ttf'],
  ['Inter', 800, 'inter-800.ttf'],
  ['Bebas Neue', 400, 'bebas-400.ttf'],
  ['Cormorant Garamond', 700, 'cormorant-700.ttf'],
];

/**
 * Fonts embedded as data URIs rather than linked.
 *
 * WHY EMBEDDED. A `<link>` to fonts.googleapis.com makes every render depend on the network at
 * screenshot time, and a font that arrives late renders the fallback instead — silently, and
 * only sometimes. Thirty pictures where an unknown subset used DejaVu Serif would be worse than
 * useless for a judgement about typography. Embedded bytes cannot half-load.
 *
 * ⚠️ THE MACHINE HAS NO DISPLAY FACES OF ITS OWN. `fc-list` here returns DejaVu, Liberation,
 * FreeSerif, Bitstream Charter and Noto Color Emoji — nothing a designer would set a masthead
 * in. Without this cache the typography directions would be judged on a substitute, which would
 * make the verdict about the substitute. Playfair Display is not an outside import: the app
 * already sets `DISPLAY_FONT` to `'Playfair Display, Georgia, serif'` on web.
 */
export function fontFaces() {
  return FONTS.map(([fam, wght, file]) => {
    const p = path.join(FONT_CACHE, file);
    if (!fs.existsSync(p)) throw new Error(`missing font ${file} — see tools/thirty-directions/README`);
    const b64 = fs.readFileSync(p).toString('base64');
    return `@font-face{font-family:'${fam}';font-weight:${wght};font-style:normal;` +
           `src:url(data:font/ttf;base64,${b64}) format('truetype');}`;
  }).join('\n');
}

export const DISPLAY = `'Playfair Display', Georgia, serif`;
export const UI = `'Inter', system-ui, -apple-system, sans-serif`;
export const POSTER = `'Bebas Neue', Impact, sans-serif`;
export const GARAMOND = `'Cormorant Garamond', Georgia, serif`;

/** Iron Rule #3, enforced rather than remembered. */
const BOARD_CLAIMS = /\b(four|4)\s+boards\b/i;
export function assertNoBoardCountClaim(id, html) {
  if (BOARD_CLAIMS.test(html.replace(/<[^>]*>/g, ' '))) {
    throw new Error(
      `${id}: copy claims a fixed board count. Board count is DYNAMIC (2P=4, 3P=3, 4P=2) and the ` +
      `app already had to retract this exact sentence once (FACTUAL FIX 2026-08-11).`);
  }
}

// ── PRIMITIVES ────────────────────────────────────────────────────────────────────────────────

/** Procedural grain. Real noise via feTurbulence, not an image of noise. */
export function grain(id = 'grain', { opacity = 0.055, freq = 0.8, octaves = 3 } = {}) {
  return `<svg class="grain" data-grain="${id}" aria-hidden="true" style="opacity:${opacity}">
    <filter id="f_${id}"><feTurbulence type="fractalNoise" baseFrequency="${freq}" numOctaves="${octaves}" stitchTiles="stitch"/>
      <feColorMatrix type="saturate" values="0"/></filter>
    <rect width="100%" height="100%" filter="url(#f_${id})"/></svg>`;
}

/** Felt weave — a finer, directional turbulence than grain, so it reads as cloth not dust. */
export function weave(id = 'weave', { opacity = 0.12, freq = '0.9 2.4' } = {}) {
  return `<svg class="grain" data-weave="${id}" aria-hidden="true" style="opacity:${opacity}">
    <filter id="w_${id}"><feTurbulence type="turbulence" baseFrequency="${freq}" numOctaves="2" stitchTiles="stitch"/>
      <feColorMatrix type="saturate" values="0"/></filter>
    <rect width="100%" height="100%" filter="url(#w_${id})"/></svg>`;
}

const SUIT_PATHS = {
  spade: 'M50 6 C50 6 14 38 14 58 C14 72 25 80 36 80 C42 80 46 78 50 74 C54 78 58 80 64 80 C75 80 86 72 86 58 C86 38 50 6 50 6 Z M44 78 C44 86 40 92 34 95 L66 95 C60 92 56 86 56 78 Z',
  heart: 'M50 92 C50 92 10 62 10 38 C10 24 21 14 33 14 C41 14 47 18 50 24 C53 18 59 14 67 14 C79 14 90 24 90 38 C90 62 50 92 50 92 Z',
  diamond: 'M50 6 L88 50 L50 94 L12 50 Z',
  club: 'M50 8 C40 8 32 16 32 26 C32 30 33 33 35 36 C32 34 28 33 24 33 C14 33 6 41 6 51 C6 61 14 69 24 69 C31 69 37 65 40 59 C41 68 40 76 34 82 L66 82 C60 76 59 68 60 59 C63 65 69 69 76 69 C86 69 94 61 94 51 C94 41 86 33 76 33 C72 33 68 34 65 36 C67 33 68 30 68 26 C68 16 60 8 50 8 Z',
};

/** A suit glyph as vector, at any size and colour. Emoji suits are a different (worse) look. */
export function suit(kind, { size = 100, fill = P.gold, opacity = 1, style = '' } = {}) {
  return `<svg viewBox="0 0 100 100" width="${size}" height="${size}" aria-hidden="true"
    style="opacity:${opacity};${style}"><path d="${SUIT_PATHS[kind]}" fill="${fill}"/></svg>`;
}

/**
 * A playing card. `w` drives everything else — Iron Rule #3 applied at the primitive level, so a
 * card is never a bag of pixel literals.
 */
export function card(rank, kind, {
  w = 60, rot = 0, x = 0, y = 0, z = 0, face = true, dim = 0, lift = 1, cls = '',
} = {}) {
  const h = Math.round(w / 0.7);
  const red = kind === 'heart' || kind === 'diamond';
  const ink = red ? P.cardRed : P.cardBlack;
  const pad = Math.max(3, w * 0.08);
  const rankPx = Math.round(w * 0.30);
  const shadow = `0 ${Math.round(w * 0.13 * lift)}px ${Math.round(w * 0.30 * lift)}px rgba(0,0,0,${0.55 * lift})`;
  const inner = face
    ? `<div style="position:absolute;top:${pad}px;left:${pad}px;font:800 ${rankPx}px ${UI};color:${ink};line-height:1">${rank}</div>
       <div style="position:absolute;top:${pad + rankPx * 1.05}px;left:${pad}px">${suit(kind, { size: rankPx * 0.78, fill: ink })}</div>
       <div style="position:absolute;left:50%;top:50%;transform:translate(-50%,-50%)">${suit(kind, { size: w * 0.46, fill: ink, opacity: 0.16 })}</div>`
    : `<div style="position:absolute;inset:${Math.round(w * 0.07)}px;border-radius:${Math.round(w * 0.07)}px;
         background:radial-gradient(circle at 50% 45%, #2f3644, #191d26);
         box-shadow:inset 0 0 0 1px rgba(79,214,168,0.30)"></div>`;
  return `<div class="card ${cls}" style="position:absolute;left:${x}px;top:${y}px;width:${w}px;height:${h}px;
    border-radius:${Math.round(w * 0.09)}px;background:${face ? P.cardFace : '#2A2F3D'};
    transform:rotate(${rot}deg) translateZ(${z}px);box-shadow:${shadow};
    ${dim ? `filter:brightness(${1 - dim})` : ''};overflow:hidden">${inner}</div>`;
}

/** A casino chip, drawn as concentric rings. Flat by nature — see each direction's `needs`. */
export function chip(size, colour, { x = 0, y = 0, rot = 0, edge = '#ffffff' } = {}) {
  return `<div style="position:absolute;left:${x}px;top:${y}px;width:${size}px;height:${size}px;border-radius:50%;
    transform:rotate(${rot}deg);background:${colour};
    box-shadow:0 ${size * 0.06}px ${size * 0.14}px rgba(0,0,0,.6), inset 0 0 0 ${size * 0.085}px ${edge},
      inset 0 0 0 ${size * 0.10}px ${colour}, inset 0 0 0 ${size * 0.16}px ${edge};"></div>`;
}

// ── THE FIXED CONTROL SET ─────────────────────────────────────────────────────────────────────

/**
 * Exactly the C2 controls that ship, in the order they ship. `onDark` lets a direction say its
 * art is light behind the strip so the daily-bonus row keeps its contrast — the ONE concession,
 * because otherwise a light direction would fail the floor for a reason that is a five-minute
 * fix rather than a property of the idea.
 */
export function controls(W) {
  const s = W / 393;                       // one scale, derived — no second set of literals
  const px = (n) => Math.round(n * s);
  /**
   * TOUCH TARGETS ARE FLOORED, NOT SCALED — `utils/responsive.ts` ships exactly this as `rb()`:
   * "always at least 44pt (Apple Human Interface Guidelines)".
   *
   * A first pass scaled them with `px()` like everything else, and at 320 that put the profile
   * button at 36x36 and the bonus pill at 39 high — a floor failure on all thirty renders. I
   * took that for a finding about the app, since `rb()` is used in only four places app-wide and
   * NOT ONCE on the home screen. Then I measured the real export
   * (tests/home-target-audit.mjs): 20 controls at 393, 375 AND 320, ZERO under 44pt. The app is
   * fine. The harness was wrong, and it would have shipped a defect report about code that does
   * not have the defect.
   */
  const tap = (n) => Math.max(44, Math.round(n * s));
  // THE CONCESSION THAT WAS WRONG. A first pass darkened this ink for "light art" directions so
  // the legal strip would keep its contrast. It sits in `.controls`, BELOW the hero, on the page
  // background — never on the art. Darkening it put cream-on-black text at 2.12:1 and reported
  // I2 and J2 as floor failures caused by their art. They were caused by this line.
  const dim = P.textMuted;
  return `
  <div class="controls" style="padding:0 ${px(24)}px">
    <button class="ctl" aria-label="Play Online. Real players and instant bot tables"
      style="width:100%;height:${tap(78)}px;border:0;border-radius:${px(18)}px;background:${P.green};
      display:flex;align-items:center;gap:${px(14)}px;padding:0 ${px(18)}px;cursor:pointer">
      <span style="font-size:${px(26)}px" aria-hidden="true">🎮</span>
      <span style="flex:1 1 auto;text-align:left">
        <span style="display:block;font:800 ${px(23)}px ${UI};color:#06210F">Play Online</span>
        <span style="display:block;font:600 ${px(14)}px ${UI};color:#0b3b1d;margin-top:${px(2)}px">Real players · instant bot tables</span>
      </span>
      <span style="font:700 ${px(24)}px ${UI};color:#06210F" aria-hidden="true">›</span>
    </button>
    <button class="ctl" aria-label="Practice against bots"
      style="width:100%;height:${tap(66)}px;margin-top:${px(12)}px;border:2px solid ${P.mint};
      border-radius:${px(18)}px;background:transparent;font:800 ${px(22)}px ${UI};color:${P.mint};cursor:pointer">
      Practice vs bots</button>
    <button class="ctl" aria-label="Claim daily bonus, day 2"
      style="height:${tap(48)}px;margin:${px(14)}px auto 0;display:block;padding:0 ${px(22)}px;
      border:1px solid ${P.gold};border-radius:${px(24)}px;background:rgba(201,168,76,0.10);
      font:700 ${px(16)}px ${UI};color:${P.goldLight};cursor:pointer">🎁 Claim daily bonus · Day 2</button>
    <div style="text-align:center;margin-top:${px(16)}px;font:400 ${px(11)}px ${UI};color:${dim}">
      Free play | Virtual chips only | No real-money gambling | 18+</div>
  </div>
  <nav class="tabbar" aria-label="Main" style="height:${tap(64)}px">
    ${['Home', 'Play', 'Friends', 'Cups', 'Profile'].map((t, i) => `
      <button class="ctl tab" aria-label="${t}" aria-current="${i === 0 ? 'page' : 'false'}"
        style="flex:1;height:100%;border:0;background:transparent;color:${i === 0 ? P.mint : 'rgba(255,255,255,0.52)'};
        font:700 ${px(11)}px ${UI};cursor:pointer">${t}</button>`).join('')}
  </nav>`;
}

/** The balance pill and avatar — the top chrome, also held constant. */
export function topBar(W) {
  const s = W / 393, px = (n) => Math.round(n * s);
  const tap = (n) => Math.max(44, Math.round(n * s));   // see controls() — floored, per rb()
  return `<header class="topbar" style="padding:${px(10)}px ${px(16)}px 0">
    <div style="display:flex;justify-content:flex-end;align-items:center;gap:${px(10)}px">
      <div style="display:flex;align-items:center;gap:${px(7)}px;background:rgba(0,0,0,0.55);
        border-radius:${px(14)}px;padding:${px(9)}px ${px(14)}px;backdrop-filter:blur(6px)">
        <span style="font-size:${px(16)}px" aria-hidden="true">🪙</span>
        <span style="font:800 ${px(17)}px ${UI};color:${P.text}">2,530</span></div>
      <button class="ctl" aria-label="Profile" style="width:${tap(44)}px;height:${tap(44)}px;border:0;
        border-radius:50%;background:rgba(0,0,0,0.55);font-size:${px(20)}px;cursor:pointer">👤</button>
    </div></header>`;
}

// ── PAGE SHELL ────────────────────────────────────────────────────────────────────────────────

/**
 * One page = one direction at one width. Height is fixed at the 393×852 aspect so the 320 render
 * is the same screen on a narrower phone, not a different crop.
 */
export function page({ id, title, W, art, artStyle = '' }) {
  const H = Math.round(W * 852 / 393);
  const body = `
    <div class="hero" style="${artStyle}">${art}</div>
    ${controls(W)}`;
  assertNoBoardCountClaim(id, body);
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<title>${id} — ${title}</title>
<style>
${fontFaces()}
*{box-sizing:border-box;margin:0;padding:0}
html,body{width:${W}px;height:${H}px;overflow:hidden;background:${P.bg}}
body{font-family:${UI};-webkit-font-smoothing:antialiased;position:relative}
.screen{position:absolute;inset:0;display:flex;flex-direction:column}
.hero{position:relative;flex:1 1 auto;overflow:hidden}
.controls{flex:0 0 auto;padding-bottom:${Math.round(W / 393 * 10)}px;position:relative;z-index:5}
.tabbar{flex:0 0 auto;display:flex;border-top:1px solid rgba(255,255,255,0.07);
  background:rgba(10,10,10,0.92);position:relative;z-index:5}
.grain{position:absolute;inset:0;width:100%;height:100%;pointer-events:none;mix-blend-mode:overlay}
.ctl{-webkit-tap-highlight-color:transparent}
</style></head><body><div class="screen">
  ${topBar(W)}
  ${body}
</div></body></html>`;
}
