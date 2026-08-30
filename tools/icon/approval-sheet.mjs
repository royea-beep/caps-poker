/**
 * THE APPROVAL SHEET — the BUILT thing, not the concept render.
 *
 * Row 1: the D1 home screen from the real `expo export`, at 320 / 375 / 393 / 430.
 * Row 2: the icon stamped at 1024 / 240 / 120 / 60, plus the Android foreground inside its
 *        66% safe circle and the monochrome variant, because those are separate assets that
 *        can each be wrong on their own.
 *
 * Every figure carries its measured verdict. Roye approves this, then it ships.
 *
 * Usage: xvfb-run -a node tools/icon/approval-sheet.mjs
 */

import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(new URL('../../', import.meta.url).pathname);
const OUT = path.join(ROOT, 'docs/d1-home');
const ASSETS = path.join(ROOT, 'assets');
fs.mkdirSync(OUT, { recursive: true });

const floor = JSON.parse(fs.readFileSync(path.join(OUT, 'floor-chromium.json'), 'utf8'));
const floorWk = JSON.parse(fs.readFileSync(path.join(OUT, 'floor-webkit.json'), 'utf8'));
const b64 = (p) => fs.readFileSync(p).toString('base64');

const browser = await chromium.launch({ headless: false, executablePath: process.env.CAPS_BROWSER_PATH });

// ── stamp the icon at the four sizes that matter ────────────────────────────────────────────
const SIZES = [1024, 240, 120, 60];
const stamps = {};
for (const S of SIZES) {
  const html = `<!doctype html><meta charset="utf-8"><style>
    *{margin:0;padding:0}html,body{width:${S}px;height:${S}px;overflow:hidden}
    img{width:${S}px;height:${S}px;display:block}
  </style><img src="data:image/png;base64,${b64(path.join(ASSETS, 'icon.png'))}">`;
  const ctx = await browser.newContext({ viewport: { width: S, height: S }, deviceScaleFactor: 1 });
  const p = await ctx.newPage();
  await p.setContent(html, { waitUntil: 'load' });
  await p.waitForTimeout(150);
  const f = path.join(OUT, `_icon-CAPS-${S}.png`);
  await p.screenshot({ path: f });
  stamps[S] = f;
  await ctx.close();
}

const WIDTHS = [320, 375, 393, 430];
const homeFig = (W) => {
  const c = floor.widths[String(W)], k = floorWk.widths[String(W)];
  const wm = c.wordmark;
  return `<figure>
    <img class="phone" src="data:image/png;base64,${b64(path.join(OUT, c.shot))}" alt="home at ${W}">
    <figcaption><b>${W}pt</b>
      <span class="m">wordmark ${wm.fontSize}pt · ${wm.renderedW}/${W} (${(wm.fractionOfFrame * 100).toFixed(0)}%)
        ${wm.overflowsFrame ? '<b class="bad">OVERFLOWS</b>' : ''}${wm.clipped ? '<b class="bad">CLIPPED</b>' : ''}</span>
      <span class="${c.floor.pass ? 'ok' : 'bad'}">chromium floor ${c.floor.pass ? 'ok' : 'FAIL'} · canary ${c.canary.ok ? 'ok' : 'VOID'}</span>
      <span class="${k.floor.pass ? 'ok' : 'bad'}">webkit ${(k.wordmark.fractionOfFrame * 100).toFixed(0)}% · floor ${k.floor.pass ? 'ok' : 'FAIL'} · canary ${k.canary.ok ? 'ok' : 'VOID'}</span>
    </figcaption></figure>`;
};

const iconFig = (S) => `<figure>
  <img class="icn" style="width:${Math.min(S, 200)}px;height:${Math.min(S, 200)}px"
    src="data:image/png;base64,${b64(stamps[S])}" alt="icon at ${S}">
  <figcaption><b>${S}px</b><span class="m">${
    S === 120 ? 'App Store' : S === 60 ? 'home screen — the size that decides it' : S === 1024 ? 'source' : ''}</span></figcaption></figure>`;

const extraFig = (file, label, note, circle) => `<figure>
  <div class="wrap${circle ? ' circ' : ''}"><img class="icn alpha" style="width:200px;height:200px"
    src="data:image/png;base64,${b64(path.join(ASSETS, file))}" alt="${label}"></div>
  <figcaption><b>${label}</b><span class="m">${note}</span></figcaption></figure>`;

const html = `<!doctype html><meta charset="utf-8"><title>D1 + C1 — built</title><style>
  body{margin:0;background:#111318;color:#e8e6e0;font:13px/1.45 system-ui,sans-serif;padding:24px}
  h1{font:700 24px system-ui;margin:0 0 4px}
  .sub{color:#8b93a1;margin-bottom:20px;max-width:1040px;line-height:1.55}
  h2{font:700 12px system-ui;letter-spacing:.08em;text-transform:uppercase;color:#7ee0bb;margin:28px 0 12px}
  h2 span{color:#8b93a1;text-transform:none;letter-spacing:0;font-weight:400}
  .row{display:flex;gap:18px;flex-wrap:wrap;align-items:flex-start}
  figure{margin:0}
  img.phone{width:190px;display:block;border-radius:8px;border:1px solid #2a2f3a}
  img.icn{display:block;border-radius:22%;border:1px solid #2a2f3a;image-rendering:auto}
  img.alpha{border-radius:0;border:0}
  .wrap{width:200px;height:200px;background:repeating-conic-gradient(#20242c 0 25%, #171a20 0 50%) 0/20px 20px;
    border-radius:8px;border:1px solid #2a2f3a;overflow:hidden;position:relative}
  .wrap.circ::after{content:'';position:absolute;left:17%;top:17%;width:66%;height:66%;
    border:2px dashed #7ee0bb;border-radius:50%;pointer-events:none}
  figcaption{font-size:11px;color:#aeb6c2;margin-top:7px;max-width:200px;line-height:1.4}
  figcaption b{color:#e8e6e0}
  .m{display:block;color:#8b93a1}.ok{display:block;color:#5ec49a}.bad{color:#e0885e}
</style>
<h1>CAPS · D1 home + C1 icon · the BUILT thing</h1>
<div class="sub">Not concept renders — these come from a real <code>expo export</code> of the branch, audited
  at four widths on two engines, with a planted canary proving the instrument could still fail. The icon is
  <b>redrawn for the square</b>, not the hero cropped: upright, larger, and sized separately for iOS and for
  Android's 66% safe circle.</div>

<h2>D1 — the home screen <span>— the fifteen blank rectangles are gone; the teaching sentence and the whole C2 control set are unchanged.</span></h2>
<div class="row">${WIDTHS.map(homeFig).join('')}</div>

<h2>C1 — the icon <span>— one shape, no corner rank glyph: at 60px a corner "A" is three pixels of mud, and C1's measured strength was being one clean shape.</span></h2>
<div class="row">${SIZES.map(iconFig).join('')}</div>

<h2>The Android assets <span>— separate files, each able to be wrong on its own. Dashed ring = the 66% circle a launcher may mask to.</span></h2>
<div class="row">
  ${extraFig('android-icon-foreground.png', 'foreground', 'card only, drawn smaller so the whole card clears the mask', true)}
  ${extraFig('android-icon-background.png', 'background', 'the ground, opaque', false)}
  ${extraFig('android-icon-monochrome.png', 'monochrome', 'silhouette for themed icons; the launcher recolours it', true)}
</div>`;

const ctx = await browser.newContext({ viewport: { width: 1200, height: 1400 }, deviceScaleFactor: 1 });
const p = await ctx.newPage();
await p.setContent(html, { waitUntil: 'load' });
await p.waitForTimeout(600);
await p.screenshot({ path: path.join(OUT, '_approval-sheet.png'), fullPage: true });
await ctx.close();
for (const S of SIZES) if (S !== 60 && S !== 120) fs.unlinkSync(stamps[S]);
await browser.close();
console.log('-> docs/d1-home/_approval-sheet.png');
