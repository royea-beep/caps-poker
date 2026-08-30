/**
 * THE CAPS APP ICON — C1, composed FOR the square.
 *
 * ⚠️ A CROPPED HERO IS NOT AN ICON, and the icon sheet from handoff 127 says so in its own header.
 * C1's hero is a card rotated -4 degrees, floating in a radial pool, occupying ~60% of a 393x852
 * portrait frame. Squeezing that into 1024x1024 gives a small tilted card with dead space above
 * and below. What follows is the same idea REDRAWN for a square:
 *
 *   upright        a 4-degree tilt reads as craft at 1024 and as a mistake at 60. Gone.
 *   sized to mask   the card fills 56% of the frame on iOS and 36% on the Android
 *                  foreground — both DERIVED from the safe area, not chosen by eye.
 *   safe areas     iOS masks a superellipse; Android masks anything down to a CIRCLE of 66%
 *                  diameter. The Android foreground is therefore drawn SMALLER than the iOS
 *                  icon — same design, different safe area, which is the whole point of shipping
 *                  a separate foreground rather than the same PNG twice.
 *   gold hairline  one line of D1's #c9a84c around the card. It is what makes these two ROLES OF
 *                  ONE IDENTITY rather than two designs: same deck, same ink, same cream.
 *
 * WHAT IT DOES NOT DO: no rank glyph in the corners. At 60px a corner "A" is three pixels of
 * mud, and C1's measured strength was that it is ONE clean shape. Adding detail that only exists
 * at 1024 would trade the thing that won for decoration.
 *
 * Outputs, matching exactly what app.json already points at — no config change is required:
 *   assets/icon.png                      1024  iOS + general
 *   assets/adaptive-icon.png             1024  legacy Android key, kept in step
 *   assets/android-icon-foreground.png   1024  card only, inside the 66% safe circle
 *   assets/android-icon-background.png   1024  ground only
 *   assets/android-icon-monochrome.png   1024  silhouette for themed icons
 *   assets/favicon.png                     64  web
 *
 * Usage: xvfb-run -a node tools/icon/build-icon.mjs
 */

import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(new URL('../../', import.meta.url).pathname);
const ASSETS = path.join(ROOT, 'assets');

/** D1's palette, so the two share one set of values rather than two similar ones. */
const INK = {
  ground: '#0a0a0a',
  groundLift: '#1b1f26',
  cardFace: '#FCFAF3',
  cardInk: '#1a1a2e',
  gold: '#c9a84c',
  androidBg: '#0a0a0a',
};

/** The spade, as vector — the app has no react-native-svg, but an icon is a baked PNG. */
const SPADE = 'M50 6 C50 6 14 38 14 58 C14 72 25 80 36 80 C42 80 46 78 50 74 C54 78 58 80 64 80 C75 80 86 72 86 58 C86 38 50 6 50 6 Z M44 78 C44 86 40 92 34 95 L66 95 C60 92 56 86 56 78 Z';

/**
 * One card, centred in a square of side S.
 * `frac` is the card's WIDTH as a fraction of S — the single knob that respects each platform's
 * safe area. Everything else derives from it (Iron Rule #3: no second set of literals).
 */
function cardMarkup(S, frac, { shadow = true, mono = false } = {}) {
  const w = Math.round(S * frac);
  const h = Math.round(w / 0.70);            // the deck's own aspect, same as components/Card.tsx
  const r = Math.round(w * 0.085);
  const face = mono ? '#ffffff' : INK.cardFace;
  const ink = mono ? INK.ground : INK.cardInk;
  const edge = mono ? 'transparent' : INK.gold;
  return `<div style="position:absolute;left:50%;top:50%;width:${w}px;height:${h}px;
    margin:${-h / 2}px 0 0 ${-w / 2}px;border-radius:${r}px;background:${face};
    box-shadow:${shadow ? `0 ${Math.round(S * 0.018)}px ${Math.round(S * 0.05)}px rgba(0,0,0,.75),` : ''}
      inset 0 0 0 ${Math.max(1, Math.round(w * 0.012))}px ${edge};
    display:flex;align-items:center;justify-content:center">
    <svg viewBox="0 0 100 100" width="${Math.round(w * 0.62)}" height="${Math.round(w * 0.62)}">
      <path d="${SPADE}" fill="${ink}"/></svg>
  </div>`;
}

const ground = (S) => `radial-gradient(70% 58% at 50% 42%, ${INK.groundLift} 0%, ${INK.ground} 72%)`;

/**
 * iOS / general / favicon. The card is TALLER than it is wide (0.70 aspect), so the width
 * fraction is not the binding constraint — the height is. At 0.62 the card stood 0.886 of the
 * frame high and came within a few pixels of the top and bottom edges. 0.56 gives 0.80 height,
 * i.e. a real 10% margin top and bottom, which is what iOS's superellipse wants.
 */
const full = (S) => `<div style="position:absolute;inset:0;background:${ground(S)}"></div>
  ${cardMarkup(S, 0.56)}`;

/**
 * Android adaptive FOREGROUND — the size is derived, not guessed.
 *
 * ⚠️ THE FIRST VERSION USED 0.40 AND ITS COMMENT CLAIMED THE CARD CLEARED THE MASK. It did not,
 * and the approval sheet's dashed 66% ring showed the corners poking out. The binding constraint
 * is the DIAGONAL, not the width: a card of width f has height f/0.70, so its half-diagonal is
 *     f * sqrt(0.25 + (1/1.4)^2 / 4) = f * 0.8719
 * and to sit inside a circle of radius 0.33 that needs f <= 0.33 / 0.8719 = 0.3785.
 * 0.36 takes that with a little margin, because a launcher may also parallax-scale the layer.
 */
const ANDROID_SAFE_CIRCLE = 0.66;
const CARD_HALF_DIAGONAL = Math.sqrt(0.25 + (1 / 0.70) ** 2 / 4);   // 0.8719 for the deck's aspect
const ANDROID_FG_FRAC = +((ANDROID_SAFE_CIRCLE / 2 / CARD_HALF_DIAGONAL) * 0.95).toFixed(3);

const androidFg = (S) => `<div style="position:absolute;inset:0;background:transparent"></div>
  ${cardMarkup(S, ANDROID_FG_FRAC)}`;

const androidBg = (S) => `<div style="position:absolute;inset:0;background:${ground(S)}"></div>`;

/** Themed icons: a flat silhouette the launcher recolours. No gradient, no shadow, no gold. */
const monochrome = (S) => `<div style="position:absolute;inset:0;background:transparent"></div>
  ${cardMarkup(S, ANDROID_FG_FRAC, { shadow: false, mono: true })}`;

const JOBS = [
  { file: 'icon.png', size: 1024, art: full, transparent: false },
  { file: 'adaptive-icon.png', size: 1024, art: full, transparent: false },
  { file: 'android-icon-foreground.png', size: 1024, art: androidFg, transparent: true },
  { file: 'android-icon-background.png', size: 1024, art: androidBg, transparent: false },
  { file: 'android-icon-monochrome.png', size: 1024, art: monochrome, transparent: true },
  { file: 'favicon.png', size: 64, art: full, transparent: false },
];

const browser = await chromium.launch({ headless: false, executablePath: process.env.CAPS_BROWSER_PATH });
for (const j of JOBS) {
  const S = j.size;
  const html = `<!doctype html><meta charset="utf-8"><style>
    *{box-sizing:border-box;margin:0;padding:0}
    html,body{width:${S}px;height:${S}px;overflow:hidden;background:${j.transparent ? 'transparent' : INK.ground}}
    .f{position:relative;width:${S}px;height:${S}px;overflow:hidden}
  </style><div class="f">${j.art(S)}</div>`;
  const ctx = await browser.newContext({ viewport: { width: S, height: S }, deviceScaleFactor: 1 });
  const p = await ctx.newPage();
  await p.setContent(html, { waitUntil: 'load' });
  await p.waitForTimeout(200);
  await p.screenshot({ path: path.join(ASSETS, j.file), omitBackground: j.transparent });
  await ctx.close();
  const bytes = fs.statSync(path.join(ASSETS, j.file)).size;
  console.log(`${j.file.padEnd(32)} ${S}x${S}  ${String(bytes).padStart(7)} bytes${j.transparent ? '  (alpha)' : ''}`);
}
await browser.close();
