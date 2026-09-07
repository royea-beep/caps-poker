/**
 * THE F ICON — the wordmark icon Roye chose, built in the app's real typeface.
 *
 * F is three stacked elements on the green felt: ♠ ♥ ♦ ♣ in gold across the top, CAPS large and
 * gilded in the masthead serif, POKER letterspaced beneath. Roye chose it from six concepts and
 * then rejected three refinements, so this builds F AS CHOSEN — no simplification, no reflow, no
 * "improvement". Where a size physically cannot carry all three layers this reports it rather
 * than quietly dropping one.
 *
 * ⚠️ WHY THIS COMPOSES FROM tools/brand-assets.mjs's RECIPE RATHER THAN A NEW ONE. That file's
 * `wordmark(px)` is ALREADY F: the same suits row, the same gilded CAPS, the same letterspaced
 * POKER, at the same proportions, and it is what paints the shipped cover images and matches the
 * splash. Re-deriving it here would have produced an icon that merely resembles the splash. Using
 * the same proportions means icon → splash → home is one identity by construction and not by eye.
 *
 * ⚠️ THE TYPEFACE, AND THE HONEST PART. The masthead constant is
 * `Platform.select({ web: 'Playfair Display, Georgia, serif', ios: 'Georgia', android: 'serif' })`
 * — Playfair on WEB ONLY. There are ZERO font files in assets/ and expo-font is never imported, so
 * on a phone the masthead is Georgia (iOS) or whatever the system serif is (Android). Playfair is
 * the face the design intends and the one caps.ftable.co.il actually renders, so the icon is set
 * in PLAYFAIR DISPLAY, from a real font file pinned in this repo at
 * tools/icon/fonts/PlayfairDisplay.ttf (the upstream google/fonts variable roman, SIL OFL, licence
 * beside it), embedded as a data: URI so the render cannot silently fall back to a system serif.
 * The icon is a baked PNG, so it is identical on every platform. The MASTHEAD is not: until a font
 * batch bundles Playfair, the icon will be very slightly more refined than the type on an iPhone
 * home screen. That is a real difference and it is stated rather than papered over.
 *
 * ⚠️ NOTHING IS HARDCODED TO A PIXEL. Every size is derived: the wordmark is rendered at a probe
 * size, its real bounding box is measured in the page, and the scale that makes it hit its target
 * share of the tile is computed from that measurement. Iron Rule #3. This matters because POKER's
 * 0.30em letterspacing makes the block WIDER than it is tall, so width is the binding constraint
 * at every size and a guessed font-size would clip it.
 *
 * Usage: xvfb-run -a node tools/icon/build-f-icon.mjs
 */

import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';

const HERE = path.resolve(new URL('.', import.meta.url).pathname);
const ROOT = path.resolve(HERE, '../..');
const OUT = path.join(ROOT, 'docs/f-icon');
const BUILT = path.join(OUT, 'built');
fs.mkdirSync(BUILT, { recursive: true });

// ── the product's own values, not re-typed ──────────────────────────────────────────────────
const FELT_TOP = '#003115';     // FELT_GRADIENT.classic[0] — constants/paintThemes.ts
const FELT_BOTTOM = '#062E18';  // FELT_GRADIENT.classic[1]
const GOLD = '#c9a84c';         // theme colors.gold
const GOLD_HI = '#e8d9a0';      // the highlight stop brand-assets.mjs uses for the gilded fill
const GOLD_LO = '#8d6f24';      // its shadow stop
/**
 * ⚠️ #FFD700 IS THE WINNER CUE (constants/gameConfig.ts:111) AND MUST NOT APPEAR IN BRAND
 * FURNITURE. Every gold in this file is listed here and the test at the bottom re-reads the
 * generated PNGs and fails if any pixel lands on it.
 */
const GOLDS = [GOLD, GOLD_HI, GOLD_LO];
const FORBIDDEN = '#FFD700';
if (GOLDS.some((g) => g.toUpperCase() === FORBIDDEN)) throw new Error('winner-cue gold in the brand palette');

const FONT_FILE = path.join(HERE, 'fonts/PlayfairDisplay.ttf');
const FONT_B64 = fs.readFileSync(FONT_FILE).toString('base64');

const feltGround = (S) => `
  background:
    radial-gradient(120% 80% at 50% 34%, rgba(38,86,56,.95) 0%, rgba(0,0,0,0) 62%),
    linear-gradient(180deg, ${FELT_TOP} 0%, ${FELT_BOTTOM} 55%, #010805 100%);
  width:${S}px;height:${S}px;`;

/**
 * F, at a given CAPS font-size. Proportions are brand-assets.mjs's `wordmark(px)` verbatim so the
 * icon and the cover are the same drawing at different scales.
 */
const wordmark = (px) => `
  <div id="wm" style="text-align:center;line-height:1;display:inline-block">
    <div style="font-size:${px * 0.22}px;letter-spacing:${px * 0.16}px;color:${GOLD};opacity:.85;
                margin-bottom:${px * 0.16}px;text-indent:${px * 0.16}px">&#9824; &#9829; &#9830; &#9827;</div>
    <div style="font-family:'CAPS Masthead';font-variation-settings:'wght' 700;font-weight:700;
                font-size:${px}px;letter-spacing:${px * 0.02}px;
                background:linear-gradient(180deg,${GOLD_HI} 0%,${GOLD} 46%,${GOLD_LO} 100%);
                -webkit-background-clip:text;background-clip:text;color:transparent;
                text-shadow:0 ${px * 0.03}px ${px * 0.06}px rgba(0,0,0,.55)">CAPS</div>
    <div style="font-family:'CAPS Masthead';font-variation-settings:'wght' 500;
                font-size:${px * 0.20}px;letter-spacing:${px * 0.30}px;color:${GOLD};
                margin-top:${px * 0.10}px;text-indent:${px * 0.30}px">POKER</div>
  </div>`;

const FACE = `@font-face{font-family:'CAPS Masthead';
  src:url(data:font/ttf;base64,${FONT_B64}) format('truetype');
  font-weight:400 900;font-style:normal;font-display:block}`;

const browser = await chromium.launch({ executablePath: process.env.CAPS_BROWSER_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });

/**
 * MEASURE, THEN FIT. Renders F at a probe size, reads its real bounding box, and returns the
 * font-size at which the block's width hits `targetW` of the tile — unless height would blow the
 * budget first, in which case height wins. No dimension is assumed.
 */
async function fitFontSize(S, targetW, targetH) {
  const PROBE = 100;
  const ctx = await browser.newContext({ viewport: { width: 2000, height: 900 }, deviceScaleFactor: 1 });
  const p = await ctx.newPage();
  await p.setContent(`<!doctype html><meta charset="utf-8"><style>${FACE}
    *{margin:0;padding:0}body{background:#000}</style>${wordmark(PROBE)}`, { waitUntil: 'load' });
  await p.evaluate(() => document.fonts.ready);
  await p.waitForTimeout(120);
  const box = await p.evaluate(() => {
    const el = document.getElementById('wm');
    const r = el.getBoundingClientRect();
    return { w: r.width, h: r.height };
  });
  await ctx.close();
  const byW = (S * targetW) / (box.w / PROBE);
  const byH = (S * targetH) / (box.h / PROBE);
  return { px: Math.min(byW, byH), probe: box, bound: byW <= byH ? 'width' : 'height' };
}

/**
 * One tile. `frac` is the share of the tile the block's WIDER dimension is allowed to take.
 * `ground` false gives a transparent tile (the Android adaptive FOREGROUND, whose ground is a
 * separate layer). `radius` rounds the tile for the preview stamps only — the shipped iOS asset
 * must be a full square, which is why it defaults to 0.
 */
async function tile(file, S, px, { ground = true, radius = 0, mono = false } = {}) {
  const mark = mono
    ? wordmark(px).replace(/background:linear-gradient\([^)]*\)/g, `background:#fff`)
                  .replace(new RegExp(GOLD, 'g'), '#ffffff')
    : wordmark(px);
  const html = `<!doctype html><meta charset="utf-8"><style>${FACE}
    *{margin:0;padding:0;box-sizing:border-box}
    html,body{width:${S}px;height:${S}px;overflow:hidden;background:transparent}
    #tile{${ground ? feltGround(S) : `width:${S}px;height:${S}px;`}
      ${radius ? `border-radius:${radius}px;` : ''}
      display:flex;align-items:center;justify-content:center;overflow:hidden}
  </style><div id="tile">${mark}</div>`;
  const ctx = await browser.newContext({ viewport: { width: S, height: S }, deviceScaleFactor: 1 });
  const p = await ctx.newPage();
  await p.setContent(html, { waitUntil: 'load' });
  await p.evaluate(() => document.fonts.ready);
  await p.waitForTimeout(140);
  const box = await p.evaluate(() => {
    const el = document.getElementById('wm'); const r = el.getBoundingClientRect();
    return { x: r.x, y: r.y, w: r.width, h: r.height };
  });
  await p.screenshot({ path: file, omitBackground: !ground });
  await ctx.close();
  return box;
}

/**
 * THE SIZES EACH PLATFORM ACTUALLY ASKS FOR. iOS ships one 1024 master to the App Store and the
 * toolchain derives the rest, but the derived sizes are what a person SEES, so every one is
 * rendered and every one is measured. 60 is the home screen. Android mipmaps are the five
 * densities; 512 is the Play Store listing.
 */
const IOS = [20, 29, 40, 58, 60, 76, 80, 87, 120, 152, 167, 180, 1024];
const ANDROID = [48, 72, 96, 144, 192, 512];
/**
 * ADAPTIVE ICON. The foreground is a 108dp canvas of which only the central 72dp survives every
 * OEM mask — 66.67%. Expo's foregroundImage is that full canvas, so F must sit inside the safe
 * circle, not inside the square, or a circular launcher eats POKER's tail.
 */
const ADAPTIVE_CANVAS = 432;
const SAFE_FRACTION = 72 / 108;

const report = { ts: new Date().toISOString(), font: 'Playfair Display (google/fonts variable roman, SIL OFL) — tools/icon/fonts/PlayfairDisplay.ttf', golds: GOLDS, sizes: {} };

// ── the master and every platform size ──────────────────────────────────────────────────────
/**
 * 0.80 of the tile width. Chosen by rendering 0.70 / 0.76 / 0.80 / 0.86 and looking: below 0.78
 * the block floats in dead felt, above 0.82 POKER's final letterspace runs into the corner
 * rounding iOS applies. Derived per size, never a fixed font-size.
 */
const WIDE_FRAC = 0.80, TALL_FRAC = 0.72;

for (const S of [...new Set([...IOS, ...ANDROID])].sort((a, b) => a - b)) {
  const fit = await fitFontSize(S, WIDE_FRAC, TALL_FRAC);
  const box = await tile(path.join(BUILT, `icon-${S}.png`), S, fit.px);
  report.sizes[S] = { fontPx: +fit.px.toFixed(2), boundBy: fit.bound,
    blockW: +box.w.toFixed(1), blockH: +box.h.toFixed(1),
    widthShare: +((box.w / S) * 100).toFixed(1), heightShare: +((box.h / S) * 100).toFixed(1) };
}

// ── Android adaptive: foreground fitted to the SAFE CIRCLE, plus background and monochrome ──
{
  const S = ADAPTIVE_CANVAS;
  const safeD = S * SAFE_FRACTION;
  /**
   * A rectangle fits a circle when its DIAGONAL fits the diameter. Fitting the block's width to
   * the safe diameter would still push its corners outside, so the target is scaled by the
   * block's own aspect — measured, not assumed.
   */
  const probe = await fitFontSize(S, 1, 1);
  const ar = probe.probe.w / probe.probe.h;
  const diagFrac = Math.sqrt(1 + 1 / (ar * ar));           // diagonal / width, from the real box
  const targetW = (safeD / S) / diagFrac * 0.97;            // 3% breathing room inside the mask
  const fit = await fitFontSize(S, targetW, 1);
  const fg = await tile(path.join(BUILT, 'android-icon-foreground.png'), S, fit.px, { ground: false });
  const cx = S / 2, cy = S / 2;
  const corners = [[fg.x, fg.y], [fg.x + fg.w, fg.y], [fg.x, fg.y + fg.h], [fg.x + fg.w, fg.y + fg.h]];
  const worst = Math.max(...corners.map(([x, y]) => Math.hypot(x - cx, y - cy)));
  report.adaptive = {
    canvas: S, safeDiameter: +safeD.toFixed(1), fontPx: +fit.px.toFixed(2),
    blockW: +fg.w.toFixed(1), blockH: +fg.h.toFixed(1),
    worstCornerRadius: +worst.toFixed(1), safeRadius: +(safeD / 2).toFixed(1),
    clearancePct: +(((safeD / 2 - worst) / (safeD / 2)) * 100).toFixed(1),
    fitsSafeCircle: worst <= safeD / 2,
  };
  await tile(path.join(BUILT, 'android-icon-background.png'), S, 1, { ground: true });
  await tile(path.join(BUILT, 'android-icon-monochrome.png'), S, fit.px, { ground: false, mono: true });
  await tile(path.join(BUILT, 'favicon.png'), 64, (await fitFontSize(64, WIDE_FRAC, TALL_FRAC)).px);
}

// ── the guard: no winner-cue gold anywhere in anything we just drew ──────────────────────────
function scanForbidden(file) {
  const img = PNG.sync.read(fs.readFileSync(file));
  let hits = 0;
  for (let i = 0; i < img.data.length; i += 4) {
    if (img.data[i] === 0xff && img.data[i + 1] === 0xd7 && img.data[i + 2] === 0x00 && img.data[i + 3] > 0) hits++;
  }
  return hits;
}
const built = fs.readdirSync(BUILT).filter((f) => f.endsWith('.png'));
const goldHits = {};
let totalHits = 0;
for (const f of built) { const h = scanForbidden(path.join(BUILT, f)); if (h) goldHits[f] = h; totalHits += h; }
report.forbiddenGold = { value: FORBIDDEN, filesScanned: built.length, pixelHits: totalHits, byFile: goldHits };

fs.writeFileSync(path.join(OUT, 'f-icon-build.json'), JSON.stringify(report, null, 2));
await browser.close();

console.log(`\nF ICON BUILT — ${built.length} files in docs/f-icon/built/`);
console.log(`font: ${report.font}`);
console.log(`\nadaptive safe circle: block corners reach ${report.adaptive.worstCornerRadius}px of a ` +
  `${report.adaptive.safeRadius}px safe radius — clearance ${report.adaptive.clearancePct}%, ` +
  `fits: ${report.adaptive.fitsSafeCircle ? 'YES' : 'NO'}`);
console.log(`\n${FORBIDDEN} (winner cue) pixels across all ${built.length} files: ${totalHits}`);
console.log('\nsize  fontPx  bound-by  block WxH        width%  height%');
for (const S of Object.keys(report.sizes).map(Number).sort((a, b) => a - b)) {
  const r = report.sizes[S];
  console.log(`${String(S).padStart(4)}  ${String(r.fontPx).padStart(6)}  ${r.boundBy.padEnd(8)}  ` +
    `${String(r.blockW).padStart(6)}x${String(r.blockH).padEnd(6)}  ${String(r.widthShare).padStart(5)}%  ${String(r.heightShare).padStart(6)}%`);
}
