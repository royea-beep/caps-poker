/**
 * BRAND ASSETS — splash proof, social images, and an icon PROPOSAL.
 *
 * §1 THE SPLASH WAS ALREADY BROUGHT TO THE CURRENT IDENTITY on 2026-09-02 (commit 19b3b18).
 * The brief's premise — "declared background maroon, image green with a sans-serif yellow
 * wordmark" — is a STALE measurement. Measured today: assets/splash.png is a deep-green felt
 * vignette with the gilded serif CAPS wordmark, and app.json declares #071C12, which is inside
 * that green. So this tool does not repaint it; it COMPOSITES it the way iOS will, at every
 * supported device shape, so the image-meets-background seam can be looked at rather than
 * asserted.
 *
 * §2 THE SOCIAL IMAGES are built from the same values as the shipped icon (tools/icon/
 * build-icon.mjs), so the profile mark on Facebook is the mark on the home screen, not a
 * lookalike.
 *
 * Usage: node tools/brand-assets.mjs
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(new URL('../', import.meta.url).pathname);
const ASSETS = path.join(ROOT, 'assets');
const OUT_SOCIAL = path.join(ROOT, 'docs/social');
const OUT_PROOF = path.join(ROOT, 'docs/splash-proof');
fs.mkdirSync(OUT_SOCIAL, { recursive: true });
fs.mkdirSync(OUT_PROOF, { recursive: true });

/** One set of values, read from the product, not re-typed. */
const FELT_TOP = '#003115';        // FELT_GRADIENT.classic[0]
const FELT_BOTTOM = '#062E18';     // FELT_GRADIENT.classic[1]
const SPLASH_BG = '#071C12';       // app.json expo.splash.backgroundColor
const GOLD = '#c9a84c';
const GOLD_HI = '#e8d9a0';
const CARD_FACE = '#FCFAF3';
const CARD_INK = '#1a1a2e';
const SPADE = 'M50 6 C50 6 14 38 14 58 C14 72 25 80 36 80 C42 80 46 78 50 74 C54 78 58 80 64 80 C75 80 86 72 86 58 C86 38 50 6 50 6 Z M44 78 C44 86 40 92 34 95 L66 95 C60 92 56 86 56 78 Z';

const feltGround = (w, h) => `
  background:
    radial-gradient(120% 80% at 50% 34%, rgba(38,86,56,.95) 0%, rgba(0,0,0,0) 62%),
    linear-gradient(180deg, ${FELT_TOP} 0%, ${FELT_BOTTOM} 55%, #010805 100%);
  width:${w}px;height:${h}px;position:relative;overflow:hidden;`;

/** The card mark, identical in construction to the shipped icon: 0.70 deck aspect, gold inset. */
const cardMark = (S, frac) => {
  const w = Math.round(S * frac);
  const h = Math.round(w / 0.70);
  return `<div style="position:absolute;left:50%;top:50%;width:${w}px;height:${h}px;
    margin:${-h / 2}px 0 0 ${-w / 2}px;border-radius:${Math.round(w * 0.085)}px;background:${CARD_FACE};
    box-shadow:0 ${Math.round(S * 0.018)}px ${Math.round(S * 0.05)}px rgba(0,0,0,.75),
      inset 0 0 0 ${Math.max(1, Math.round(w * 0.012))}px ${GOLD};
    display:flex;align-items:center;justify-content:center">
    <svg viewBox="0 0 100 100" width="${Math.round(w * 0.62)}" height="${Math.round(w * 0.62)}">
      <path d="${SPADE}" fill="${CARD_INK}"/></svg></div>`;
};

const wordmark = (px) => `
  <div style="text-align:center;line-height:1">
    <div style="font-size:${Math.round(px * 0.22)}px;letter-spacing:${Math.round(px * 0.16)}px;
                color:${GOLD};opacity:.85;margin-bottom:${Math.round(px * 0.16)}px">&#9824; &#9829; &#9830; &#9827;</div>
    <div style="font-family:Georgia,'Times New Roman',serif;font-weight:700;font-size:${px}px;
                letter-spacing:${Math.round(px * 0.02)}px;
                background:linear-gradient(180deg,${GOLD_HI} 0%,${GOLD} 46%,#8d6f24 100%);
                -webkit-background-clip:text;background-clip:text;color:transparent;
                text-shadow:0 ${Math.round(px * 0.03)}px ${Math.round(px * 0.06)}px rgba(0,0,0,.55)">CAPS</div>
    <div style="font-family:Georgia,serif;font-size:${Math.round(px * 0.20)}px;
                letter-spacing:${Math.round(px * 0.30)}px;color:${GOLD};margin-top:${Math.round(px * 0.10)}px;
                text-indent:${Math.round(px * 0.30)}px">POKER</div>
  </div>`;

const centred = (inner) => `<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center">${inner}</div>`;

/**
 * The sizes each platform actually asks for. Profiles are served as circles on every one of
 * them, which is why the mark is centred with margin rather than filling the square.
 */
const SOCIAL = [
  { file: 'caps-profile-1024.png',        w: 1024, h: 1024, kind: 'profile', note: 'master square' },
  { file: 'caps-profile-facebook-360.png', w: 360, h: 360,  kind: 'profile', note: 'Facebook page profile' },
  { file: 'caps-profile-instagram-320.png', w: 320, h: 320, kind: 'profile', note: 'Instagram profile' },
  { file: 'caps-profile-tiktok-200.png',  w: 200,  h: 200,  kind: 'profile', note: 'TikTok profile' },
  { file: 'caps-cover-facebook-1640x664.png', w: 1640, h: 664, kind: 'cover', note: 'Facebook page cover' },
  { file: 'caps-cover-wide-1920x1080.png',    w: 1920, h: 1080, kind: 'cover', note: 'general landscape hero' },
];

const browser = await chromium.launch({ executablePath: process.env.CAPS_CHROMIUM || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });

// ── SOCIAL ────────────────────────────────────────────────────────────────────
for (const s of SOCIAL) {
  const inner = s.kind === 'profile'
    ? cardMark(Math.min(s.w, s.h), 0.46)          // 0.46 keeps the card inside a circular crop
    : centred(wordmark(Math.round(s.h * 0.20)));
  const html = `<!doctype html><meta charset="utf-8"><style>*{box-sizing:border-box;margin:0;padding:0}
    html,body{width:${s.w}px;height:${s.h}px;overflow:hidden}</style>
    <div style="${feltGround(s.w, s.h)}">${inner}</div>`;
  const ctx = await browser.newContext({ viewport: { width: s.w, height: s.h }, deviceScaleFactor: 1 });
  const p = await ctx.newPage();
  await p.setContent(html, { waitUntil: 'load' });
  await p.waitForTimeout(250);
  await p.screenshot({ path: path.join(OUT_SOCIAL, s.file) });
  await ctx.close();
  console.log(`social  ${s.file.padEnd(34)} ${s.w}x${s.h}  ${s.note}`);
}

// ── SPLASH PROOF: composite exactly as iOS `contain` will, per supported shape ────────────────
// ios.supportsTablet is FALSE in app.json, so iPad shapes are out of scope and are not claimed.
const SHAPES = [
  ['iPhone SE / 8    375x667',  375, 667],
  ['iPhone 8 Plus    414x736',  414, 736],
  ['iPhone 13 mini   375x812',  375, 812],
  ['iPhone 15        393x852',  393, 852],
  ['iPhone 15 ProMax 430x932',  430, 932],
];
const splashB64 = fs.readFileSync(path.join(ASSETS, 'splash.png')).toString('base64');
for (const [label, w, h] of SHAPES) {
  const html = `<!doctype html><meta charset="utf-8"><style>*{box-sizing:border-box;margin:0;padding:0}
    html,body{width:${w}px;height:${h}px;overflow:hidden;background:${SPLASH_BG}}</style>
    <div style="width:${w}px;height:${h}px;background:${SPLASH_BG};display:flex;align-items:center;justify-content:center">
      <img src="data:image/png;base64,${splashB64}" style="max-width:100%;max-height:100%;object-fit:contain;display:block">
    </div>`;
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2 });
  const p = await ctx.newPage();
  await p.setContent(html, { waitUntil: 'load' });
  await p.waitForTimeout(250);
  const file = `splash-${w}x${h}.png`;
  await p.screenshot({ path: path.join(OUT_PROOF, file) });
  await ctx.close();
  console.log(`splash  ${file.padEnd(34)} ${label}`);
}
await browser.close();
console.log('\nsocial -> docs/social/   splash proof -> docs/splash-proof/');
