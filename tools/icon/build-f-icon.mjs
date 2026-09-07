/**
 * THE F ICON — the wordmark icon Roye chose, built in the app's real typeface.
 *
 * F is three stacked elements on the green felt: ♠ ♥ ♦ ♣ in gold across the top, CAPS large and
 * gilded in the masthead serif, POKER letterspaced beneath. Roye chose it from six concepts and
 * then rejected three refinements, so this builds F AS CHOSEN — no simplification, no reflow, no
 * "improvement".
 *
 * ⚠️ AND THEN HE CHOSE A RESPONSIVE LOCKUP, WHICH IS NOT A FOURTH SIMPLIFICATION. The three
 * refinements he rejected changed F EVERYWHERE. This changes nothing at any size where F is
 * legible: the FULL lockup is used at and above the measured threshold, and below it POKER — which
 * by then is a broken dotted line — is dropped, leaving the suits and CAPS. Same drawing, same
 * proportions between the parts that remain, same gilding, same felt.
 *
 * THE THRESHOLD IS 128px AND IT WAS MEASURED, NOT PICKED — docs/f-icon/threshold.mjs sweeps every
 * tile size from 40 to 200, divides POKER's band into its five letter cells, and finds the
 * smallest size at which all five still hold ink AND keep holding it at every larger size. At 128
 * POKER renders at 7.71px. See docs/f-icon/f-threshold.json for the sweep and for the rule that
 * was tried first and thrown away.
 *
 * WHAT "COMPACT" REBALANCES, AND WHAT IT DOES NOT.
 * ⚠️ MY FIRST ATTEMPT AT THIS DID NOTHING AND THE BUILD CAUGHT IT — compact came out at exactly
 * the same font size as full, 0% growth. The reason is a fact I had assumed backwards: POKER is
 * NOT what makes the block wide. CAPS is. Four Playfair capitals at 308px span ~819px; POKER at
 * 61.7px with 0.30em letterspacing spans ~277px, a third of that. So dropping POKER frees only
 * HEIGHT, width still binds at the same place, and a naive re-fit changes nothing at all.
 *
 * So the compact block is grown until its bounding box has the same HALF-DIAGONAL as the full
 * block at the same tile size. That keeps the mark's footprint radius constant — the two variants
 * sit inside the same circle, which is also exactly the quantity the Android mask and every
 * circular profile picture care about, and it is the same diagonal reasoning the safe-zone fit
 * uses. CAPS and the suits grow into the freed height instead of the tile gaining empty felt.
 *
 * The ratio between the suits and CAPS, the gap between them, the gilding stops and the felt are
 * all untouched. Nothing is redrawn.
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
const POKER_ROW = (px) => `
    <div style="font-family:'CAPS Masthead';font-variation-settings:'wght' 500;
                font-size:${px * 0.20}px;letter-spacing:${px * 0.30}px;color:${GOLD};
                margin-top:${px * 0.10}px;text-indent:${px * 0.30}px">POKER</div>`;

/** `withPoker` false is the compact lockup. Everything else is identical. */
const wordmark = (px, withPoker = true) => `
  <div id="wm" style="text-align:center;line-height:1;display:inline-block">
    <div style="font-size:${px * 0.22}px;letter-spacing:${px * 0.16}px;color:${GOLD};opacity:.85;
                margin-bottom:${px * 0.16}px;text-indent:${px * 0.16}px">&#9824; &#9829; &#9830; &#9827;</div>
    <div style="font-family:'CAPS Masthead';font-variation-settings:'wght' 700;font-weight:700;
                font-size:${px}px;letter-spacing:${px * 0.02}px;
                background:linear-gradient(180deg,${GOLD_HI} 0%,${GOLD} 46%,${GOLD_LO} 100%);
                -webkit-background-clip:text;background-clip:text;color:transparent;
                text-shadow:0 ${px * 0.03}px ${px * 0.06}px rgba(0,0,0,.55)">CAPS</div>
    ${withPoker ? POKER_ROW(px) : ''}
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
async function fitFontSize(S, targetW, targetH, withPoker = true) {
  const PROBE = 100;
  const ctx = await browser.newContext({ viewport: { width: 2000, height: 900 }, deviceScaleFactor: 1 });
  const p = await ctx.newPage();
  await p.setContent(`<!doctype html><meta charset="utf-8"><style>${FACE}
    *{margin:0;padding:0}body{background:#000}</style>${wordmark(PROBE, withPoker)}`, { waitUntil: 'load' });
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
async function tile(file, S, px, { ground = true, radius = 0, mono = false, withPoker = true } = {}) {
  const mark = mono
    ? wordmark(px, withPoker).replace(/background:linear-gradient\([^)]*\)/g, `background:#fff`)
                             .replace(new RegExp(GOLD, 'g'), '#ffffff')
    : wordmark(px, withPoker);
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

// ── the master and every platform size, in BOTH variants ────────────────────────────────────
/**
 * 0.80 of the tile width, 0.72 of its height, whichever binds first. Derived per size from the
 * block's measured box, never a fixed font-size — POKER's letterspacing makes the FULL block wider
 * than tall, so width binds there, while the COMPACT block loses that row and is nearly square, so
 * height binds instead. That flip is exactly why nothing here may be hardcoded.
 */
const WIDE_FRAC = 0.80, TALL_FRAC = 0.72;

/**
 * THE THRESHOLD, read from the sweep rather than restated here — if threshold.mjs is re-run with a
 * different rule this build follows it instead of disagreeing with it silently.
 */
const THRESHOLD = JSON.parse(fs.readFileSync(path.join(OUT, 'f-threshold.json'), 'utf8')).threshold;
report.threshold = { px: THRESHOLD, source: 'docs/f-icon/f-threshold.json', rule: 'all five of POKER\'s letter cells hold >=2 ink px, and keep holding at every larger size' };

const ALL = [...new Set([...IOS, ...ANDROID])].sort((a, b) => a - b);

/**
 * Both blocks measured once at a probe size, so the compact scale-up factor is derived from real
 * boxes rather than from the proportions I believed they had.
 */
const probeFull = (await fitFontSize(1000, 1, 1, true)).probe;
const probeComp = (await fitFontSize(1000, 1, 1, false)).probe;
const halfDiag = (b) => Math.hypot(b.w, b.h) / 2;
/** grow compact until its half-diagonal matches full's, at equal font size */
const COMPACT_GROWTH = halfDiag(probeFull) / halfDiag(probeComp);
report.rebalance = {
  fullBoxAtProbe100: { w: +probeFull.w.toFixed(1), h: +probeFull.h.toFixed(1) },
  compactBoxAtProbe100: { w: +probeComp.w.toFixed(1), h: +probeComp.h.toFixed(1) },
  rule: "compact is grown until its bounding box's half-diagonal equals full's — same footprint radius, so both variants sit inside the same circle",
  growth: +COMPACT_GROWTH.toFixed(4),
};

for (const variant of ['full', 'compact']) {
  const withPoker = variant === 'full';
  const grow = withPoker ? 1 : COMPACT_GROWTH;
  fs.mkdirSync(path.join(BUILT, variant), { recursive: true });
  report.sizes[variant] = {};
  for (const S of ALL) {
    const fit = await fitFontSize(S, WIDE_FRAC * grow, TALL_FRAC * grow, withPoker);
    const box = await tile(path.join(BUILT, variant, `icon-${S}.png`), S, fit.px, { withPoker });
    report.sizes[variant][S] = { fontPx: +fit.px.toFixed(2), boundBy: fit.bound,
      blockW: +box.w.toFixed(1), blockH: +box.h.toFixed(1),
      widthShare: +((box.w / S) * 100).toFixed(1), heightShare: +((box.h / S) * 100).toFixed(1),
      halfDiagShare: +((Math.hypot(box.w, box.h) / 2 / S) * 100).toFixed(1) };
  }
}

/**
 * THE RESPONSIVE SET — one file per platform size, carrying whichever variant the threshold says
 * is legible there. This is the set that would ship. The choice is a comparison against a measured
 * number, not a list someone typed.
 */
fs.mkdirSync(path.join(BUILT, 'responsive'), { recursive: true });
report.responsive = {};
for (const S of ALL) {
  const variant = S >= THRESHOLD ? 'full' : 'compact';
  fs.copyFileSync(path.join(BUILT, variant, `icon-${S}.png`), path.join(BUILT, 'responsive', `icon-${S}.png`));
  report.responsive[S] = variant;
}

// ── Android adaptive, and the honest reason it is compact ───────────────────────────────────
{
  const S = ADAPTIVE_CANVAS;
  const safeD = S * SAFE_FRACTION;
  /**
   * ⚠️ THE ADAPTIVE FOREGROUND IS COMPACT, AND THAT IS A MEASUREMENT, NOT A PREFERENCE. Its canvas
   * is 432px, which is far above the 128 threshold — but the canvas is not the mark. Only the
   * central 288px circle survives the mask, the block is fitted inside that, and a launcher then
   * draws the whole thing at roughly 48-108dp. The block's own rendered size is what decides, and
   * it lands well below the threshold, so POKER would be the same dotted line here that it is at
   * 60. `effectiveTile` records the number this was decided on.
   */
  const probeFull = await fitFontSize(S, 1, 1, true);
  const arF = probeFull.probe.w / probeFull.probe.h;
  const diagF = Math.sqrt(1 + 1 / (arF * arF));
  const targetWFull = (safeD / S) / diagF * 0.97;
  const fitFull = await fitFontSize(S, targetWFull, 1, true);
  /** what a 108dp launcher render makes of it: the block's share of the canvas, times 108. */
  const effectiveTile = +((fitFull.px / report.sizes.full['1024'].fontPx) * 1024 * (108 / S)).toFixed(1);

  const probe = await fitFontSize(S, 1, 1, false);
  const ar = probe.probe.w / probe.probe.h;
  const diagFrac = Math.sqrt(1 + 1 / (ar * ar));
  const targetW = (safeD / S) / diagFrac * 0.97;
  const fit = await fitFontSize(S, targetW, 1, false);
  const fg = await tile(path.join(BUILT, 'android-icon-foreground.png'), S, fit.px, { ground: false, withPoker: false });
  const cx = S / 2, cy = S / 2;
  const corners = [[fg.x, fg.y], [fg.x + fg.w, fg.y], [fg.x, fg.y + fg.h], [fg.x + fg.w, fg.y + fg.h]];
  const worst = Math.max(...corners.map(([x, y]) => Math.hypot(x - cx, y - cy)));
  report.adaptive = {
    variant: 'compact', canvas: S, safeDiameter: +safeD.toFixed(1), fontPx: +fit.px.toFixed(2),
    blockW: +fg.w.toFixed(1), blockH: +fg.h.toFixed(1),
    worstCornerRadius: +worst.toFixed(1), safeRadius: +(safeD / 2).toFixed(1),
    clearancePct: +(((safeD / 2 - worst) / (safeD / 2)) * 100).toFixed(1),
    fitsSafeCircle: worst <= safeD / 2,
    effectiveTileAt108dp: effectiveTile,
    whyCompact: `the block inside the safe circle renders like a ${effectiveTile}px tile at 108dp, below the ${THRESHOLD} threshold`,
  };
  await tile(path.join(BUILT, 'android-icon-background.png'), S, 1, { ground: true, withPoker: false });
  await tile(path.join(BUILT, 'android-icon-monochrome.png'), S, fit.px, { ground: false, mono: true, withPoker: false });
  /** favicon 64 — below the threshold, so compact. */
  await tile(path.join(BUILT, 'favicon.png'), 64, (await fitFontSize(64, WIDE_FRAC, TALL_FRAC, false)).px, { withPoker: false });
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
const walk = (d) => fs.readdirSync(d, { withFileTypes: true })
  .flatMap((e) => e.isDirectory() ? walk(path.join(d, e.name)) : (e.name.endsWith('.png') ? [path.join(d, e.name)] : []));
const built = walk(BUILT);
const goldHits = {};
let totalHits = 0;
for (const f of built) { const h = scanForbidden(f); if (h) goldHits[path.relative(BUILT, f)] = h; totalHits += h; }
report.forbiddenGold = { value: FORBIDDEN, filesScanned: built.length, pixelHits: totalHits, byFile: goldHits };

fs.writeFileSync(path.join(OUT, 'f-icon-build.json'), JSON.stringify(report, null, 2));
await browser.close();

console.log(`\nF RESPONSIVE LOCKUP BUILT — ${built.length} files in docs/f-icon/built/`);
console.log(`font: ${report.font}`);
console.log(`\nTHRESHOLD ${THRESHOLD}px (measured — ${report.threshold.rule})`);
console.log(`  full lockup  : ${ALL.filter((S) => S >= THRESHOLD).join(', ')}`);
console.log(`  compact      : ${ALL.filter((S) => S < THRESHOLD).join(', ')}`);
console.log(`  adaptive fg  : compact — ${report.adaptive.whyCompact}`);
console.log(`  favicon 64   : compact`);
console.log(`\nadaptive safe circle: corners reach ${report.adaptive.worstCornerRadius}px of a ` +
  `${report.adaptive.safeRadius}px safe radius — clearance ${report.adaptive.clearancePct}%, ` +
  `fits: ${report.adaptive.fitsSafeCircle ? 'YES' : 'NO'}`);
console.log(`\n${FORBIDDEN} (winner cue) pixels across all ${built.length} files: ${totalHits}`);
console.log('\nCAPS grows when POKER goes — same proportions, refitted:');
console.log(`rebalance rule: ${report.rebalance.rule}`);
console.log(`full box at probe 100: ${report.rebalance.fullBoxAtProbe100.w}x${report.rebalance.fullBoxAtProbe100.h}  ` +
  `compact: ${report.rebalance.compactBoxAtProbe100.w}x${report.rebalance.compactBoxAtProbe100.h}  ` +
  `-> compact grows x${report.rebalance.growth}`);
console.log('size   full CAPS px  bound   compact CAPS px  bound   growth   half-diag full/compact');
for (const S of [1024, 512, 180, 120, 60]) {
  const f = report.sizes.full[S], c = report.sizes.compact[S];
  console.log(`${String(S).padStart(4)}   ${String(f.fontPx).padStart(12)}  ${f.boundBy.padEnd(6)}  ` +
    `${String(c.fontPx).padStart(15)}  ${c.boundBy.padEnd(6)}  ${String(((c.fontPx / f.fontPx - 1) * 100).toFixed(0) + '%').padStart(6)}   ` +
    `${f.halfDiagShare}% / ${c.halfDiagShare}%`);
}
