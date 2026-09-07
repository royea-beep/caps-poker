/**
 * THE SHEET ROYE APPROVES FROM. Pixels, with the numbers beside them and nothing hidden.
 *
 * Usage: xvfb-run -a node docs/f-icon/sheet.mjs
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const HERE = path.resolve(new URL('.', import.meta.url).pathname);
const ROOT = path.resolve(HERE, '../..');
const STAMPS = path.join(HERE, 'stamps');
const BUILT = path.join(HERE, 'built');
const b64 = (p) => fs.readFileSync(p).toString('base64');
const img = (p) => `data:image/png;base64,${b64(p)}`;

const build = JSON.parse(fs.readFileSync(path.join(HERE, 'f-icon-build.json'), 'utf8'));
const leg = JSON.parse(fs.readFileSync(path.join(HERE, 'f-icon-legibility.json'), 'utf8'));
const lay = JSON.parse(fs.readFileSync(path.join(HERE, 'f-layer-contrast.json'), 'utf8'));
const hist = JSON.parse(fs.readFileSync(path.join(ROOT, 'docs/icon-history/icon-compare.json'), 'utf8'));

const SIZES = [1024, 240, 120, 60];
const browser = await chromium.launch({ executablePath: process.env.CAPS_BROWSER_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });

const row = (S) => leg.rows.find((r) => r.size === S);
const stripSq = SIZES.map((S) => `<div class="st"><img src="${img(path.join(STAMPS, `F-${S}.png`))}" style="width:${Math.min(S, 200)}px;height:${Math.min(S, 200)}px"><em>${S}</em></div>`).join('');
const stripCi = SIZES.map((S) => `<div class="st"><img src="${img(path.join(STAMPS, `F-${S}-circle.png`))}" style="width:${Math.min(S, 200)}px;height:${Math.min(S, 200)}px"><em>${S}</em></div>`).join('');

const layerTable = SIZES.map((S) => {
  const r = lay.rows[S];
  const l = row(S).layers;
  const bad = (v) => v < 2 ? 'bad' : v < 6 ? 'warn' : 'ok';
  return `<tr><td><b>${S}</b></td>
    <td>${l.suits}px</td><td>${r.suits.contrast}:1</td><td class="${bad(r.suits.inkCoverage)}">${r.suits.inkPx} px</td>
    <td>${l.caps}px</td><td>${r.CAPS.contrast}:1</td><td class="${bad(r.CAPS.inkCoverage)}">${r.CAPS.inkPx} px</td>
    <td>${l.poker}px</td><td>${r.POKER.contrast}:1</td><td class="${bad(r.POKER.inkCoverage)}">${r.POKER.inkPx} px</td></tr>`;
}).join('');

const histRows = hist.rows.filter((r) => ['CP', 'C-GREEN', 'C-BLACK', 'C1'].includes(r.id))
  .map((r) => `<tr><td>${r.id}</td><td>${r.at60.subjectArea}%</td><td>${r.at60.contrast}:1</td><td>${r.at60.crispness}</td><td class="mut">${r.depicts.split('—')[0]}</td></tr>`).join('');

const a = build.adaptive;

const html = `<!doctype html><meta charset="utf-8"><style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{width:1600px;background:#f2f2f0;font:14px/1.55 -apple-system,'DejaVu Sans',sans-serif;color:#15130f;padding:34px}
  h1{font-size:30px;letter-spacing:-.4px}
  .lede{max-width:1180px;margin:12px 0 26px;font-size:15px;color:#3a352d}
  section{background:#fff;border:1px solid #d8d5cd;border-radius:10px;padding:22px;margin-bottom:18px}
  section.alarm{border-color:#b8442e;box-shadow:0 0 0 2px #f6ded8 inset}
  h2{font-size:20px;margin-bottom:4px}
  .sub{color:#5b554a;font-size:13px;margin-bottom:16px}
  .strip{display:flex;gap:18px;align-items:flex-end;background:#e9e7e1;padding:14px;border-radius:8px}
  .strip.circle{background:#cfcdc6}
  .st{text-align:center}.st img{display:block;border:1px solid rgba(0,0,0,.18)}
  .strip.circle .st img{border:none}
  .st em{display:block;font-style:normal;font-size:11px;color:#5b554a;margin-top:5px}
  .lab{font-size:12px;color:#5b554a;margin:14px 0 6px}
  table{border-collapse:collapse;font-size:13px;margin-top:6px}
  th{text-align:left;background:#15130f;color:#fff;padding:6px 10px;font-size:11px;letter-spacing:.5px;font-weight:600}
  td{padding:6px 10px;border-bottom:1px solid #e6e3dc;font-variant-numeric:tabular-nums}
  .ok{color:#0b5e2e;font-weight:700}.warn{color:#9a6b00;font-weight:700}.bad{color:#a11;font-weight:700}
  .mut{color:#6b6559;font-variant-numeric:normal}
  .mag{display:flex;gap:26px;align-items:flex-start;margin-top:10px}
  .mag img{border:1px solid rgba(0,0,0,.3);image-rendering:pixelated;display:block}
  .mag figcaption{font-size:12px;color:#5b554a;margin-top:6px;max-width:380px}
  p{max-width:1180px;margin-bottom:10px}
  code{background:#efece3;padding:1px 5px;border-radius:3px;font-size:12px}
  .note{background:#fdf6e6;border-left:3px solid #c9a84c;padding:12px 14px;margin-top:14px;font-size:13px}
  .note.red{background:#fdecec;border-left-color:#b8442e}
</style>

<h1>F — built in the app's real typeface</h1>
<p class="lede">Three stacked elements as chosen: <b>♠ ♥ ♦ ♣</b> in gold, <b>CAPS</b> gilded, <b>POKER</b> letterspaced,
on the felt gradient. Set in <b>Playfair Display</b> from a real font file pinned at
<code>tools/icon/fonts/PlayfairDisplay.ttf</code>, not a substitute serif and not a system fallback.
Composed from the same proportions as <code>tools/brand-assets.mjs</code>'s <code>wordmark()</code>, which is what
paints the splash and the cover images — so icon → splash → home is one identity by construction.
<b>Nothing has been swapped into <code>assets/</code>.</b> Three refinements were rejected, so this is F as chosen,
with no simplification.</p>

<section>
  <h2>1024 · 240 · 120 · 60</h2>
  <p class="sub">Stamped by downscaling the 1024 master, which is the path iOS and Expo actually take.</p>
  <div class="strip">${stripSq}</div>
  <div class="lab">masked to a circle — iOS 26 clips to a squircle, Android to a circle</div>
  <div class="strip circle">${stripCi}</div>
</section>

<section class="alarm">
  <h2>⚠️ At 60px, POKER is one pixel and the suits are ten</h2>
  <p class="sub">Reported, not fixed. Roye rejected three simplifications, so this is his call, not mine.</p>
  <div class="mag">
    <figure><img src="${img(path.join(STAMPS, 'F-60.png'))}" style="width:60px;height:60px">
      <figcaption><b>60px, 1:1</b> — what a home screen shows.</figcaption></figure>
    <figure><img src="${img(path.join(STAMPS, 'F-60.png'))}" style="width:420px;height:420px">
      <figcaption><b>the same tile, 7× nearest-neighbour</b> — every pixel. CAPS holds its shape.
      POKER is a broken dotted line. The four suits are four indistinct blobs; you cannot tell the
      spade from the club.</figcaption></figure>
    <figure><img src="${img(path.join(STAMPS, 'F-120.png'))}" style="width:360px;height:360px">
      <figcaption><b>120px, 3× nearest</b> — POKER is readable here and the suits separate. The
      failure is specific to 60, not general.</figcaption></figure>
  </div>
  <div class="lab">Each layer measured separately on the shipped tile — ink is the warm decile, ground is the
  local dark quartile, contrast is WCAG.</div>
  <table>
    <tr><th></th><th colspan="3">♠ ♥ ♦ ♣</th><th colspan="3">CAPS</th><th colspan="3">POKER</th></tr>
    <tr><th>tile</th><th>size</th><th>contrast</th><th>ink</th><th>size</th><th>contrast</th><th>ink</th><th>size</th><th>contrast</th><th>ink</th></tr>
    ${layerTable}
  </table>
  <div class="note red"><b>The arithmetic under the judgement.</b> F's own proportions put POKER at
  0.20 of the CAPS size and the suits at 0.22. On a 60px tile CAPS renders at 18.1px, which is fine —
  but that makes POKER <b>3.6px</b> and the suits <b>4.0px</b>. A serif face has no stem left below
  about 5px, and the measurement agrees: POKER's band retains <b>1 ink pixel</b> of the 2,990 it has at
  1024. This is not a rendering problem and a different downscaler will not fix it. It is a
  consequence of stacking three layers in a square that is 60 pixels wide.</div>
</section>

<section>
  <h2>The numbers, and why two of them are not a fair fight</h2>
  <p>Measured with the maths copied verbatim from <code>tools/thirty-directions/icon-legibility.mjs</code>,
  the instrument the seven candidates were scored on:</p>
  <table>
    <tr><th>icon</th><th>subject share</th><th>contrast</th><th>crispness</th><th>what it is</th></tr>
    <tr><td><b>F (this one)</b></td><td>${row(60).shipped.subjectArea}%</td><td>${row(60).shipped.contrast}:1</td><td>${row(60).shipped.crispness}</td><td class="mut">wordmark, three layers</td></tr>
    ${histRows}
  </table>
  <div class="note"><b>Read those two middle columns with care — I got one of them wrong first time.</b>
  The instrument takes the GROUND to be the median of the four corner pixels. F's ground is a vertical
  gradient whose bottom corners are <code>#010805</code>, nearly black, while the type sits on lit felt in
  the middle. So its 1.90:1 is not the contrast of the ink against the felt. <b>The real pairing,
  <code>#c9a84c</code> on <code>#003115</code>, is 6.34:1</b> — which is why the per-layer table above exists and is
  the honest measurement. Subject share and crispness are also structurally unkind to a wordmark:
  the instrument rewards one big solid block, and C1 is one big solid block. <b>What survives that
  correction, and still matters, is the ink count.</b></div>
</section>

<section>
  <h2>Every size, and the Android mask</h2>
  <p class="sub">iOS 20–1024, Android mipmaps 48–512, adaptive foreground, background and monochrome, favicon.
  Every size is laid out by measuring the block and solving for the fit — no font-size is hardcoded.</p>
  <div class="strip">
    <div class="st"><img src="${img(path.join(BUILT, 'android-icon-foreground.png'))}" style="width:200px;height:200px;background:#111"><em>adaptive foreground 432</em></div>
    <div class="st"><img src="${img(path.join(BUILT, 'android-icon-background.png'))}" style="width:200px;height:200px"><em>adaptive background</em></div>
    <div class="st"><img src="${img(path.join(BUILT, 'android-icon-monochrome.png'))}" style="width:200px;height:200px;background:#111"><em>monochrome</em></div>
    <div class="st"><img src="${img(path.join(BUILT, 'favicon.png'))}" style="width:64px;height:64px"><em>favicon 64</em></div>
  </div>
  <div class="note"><b>Nothing is clipped by the mask.</b> Only the central 72 of the adaptive icon's
  108dp survives every OEM shape — a ${a.safeDiameter}px circle on the ${a.canvas}px canvas. F is wider
  than it is tall, so fitting its WIDTH to that circle would still push its corners outside; the fit
  solves for the block's <b>diagonal</b> instead, from its measured aspect ratio. Worst corner reaches
  <b>${a.worstCornerRadius}px of the ${a.safeRadius}px safe radius</b> — ${a.clearancePct}% clearance,
  fits: <b class="ok">${a.fitsSafeCircle ? 'YES' : 'NO'}</b>.</div>
  <div class="note"><b>No <code>#FFD700</code> anywhere.</b> That value is the winner cue
  (<code>constants/gameConfig.ts:111</code>) and must not appear in brand furniture. All
  ${build.forbiddenGold.filesScanned} generated files were re-read pixel by pixel after rendering:
  <b class="ok">${build.forbiddenGold.pixelHits} hits</b>. The golds used are
  <code>#c9a84c</code>, <code>#e8d9a0</code> and <code>#8d6f24</code> — the theme's gold and the two stops
  <code>brand-assets.mjs</code> already gilds the cover wordmark with.</div>
</section>`;

const ctx = await browser.newContext({ viewport: { width: 1600, height: 1200 }, deviceScaleFactor: 1 });
const page = await ctx.newPage();
await page.setContent(html, { waitUntil: 'load' });
await page.waitForTimeout(400);
await page.screenshot({ path: path.join(HERE, 'F-ICON-SHEET.png'), fullPage: true });
await ctx.close();

// ── the first second, same shape as docs/icon-history/FIRST-SECOND.png ──────────────────────
const SPLASH = path.join(ROOT, 'docs/splash-proof/splash-393x852.png');
const HOME = path.join(ROOT, 'docs/product-map/shots/en/home.png');
const CANDIDATES = [
  { id: 'F (proposed)', file: path.join(STAMPS, 'F-240.png'), cur: true, note: 'gilded wordmark on felt' },
  { id: 'C1 (shipped today)', file: path.join(ROOT, 'docs/icon-history/stamps/C1-240.png'), cur: false, note: 'cream card, navy spade, black ground' },
  { id: 'C-BLACK', file: path.join(ROOT, 'docs/icon-history/stamps/C-BLACK-240.png'), cur: false, note: 'gold C on near-black' },
];
const fs2 = `<!doctype html><meta charset="utf-8"><style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{width:1240px;background:#f2f2f0;font:14px/1.5 -apple-system,'DejaVu Sans',sans-serif;color:#15130f;padding:30px}
  h1{font-size:26px}p.l{max-width:1020px;margin:10px 0 22px;color:#3a352d}
  .row{display:flex;gap:20px;align-items:center;background:#fff;border:1px solid #d8d5cd;border-radius:10px;padding:18px;margin-bottom:16px}
  .row.cur{border-color:#c9a84c;box-shadow:0 0 0 2px #f0e3bd inset}
  .who{width:180px}.who b{font-size:16px;display:block}.who span{font-size:12px;color:#5b554a}
  .step{text-align:center}.step img{display:block;border:1px solid rgba(0,0,0,.2);border-radius:4px}
  .step em{display:block;font-style:normal;font-size:11px;color:#5b554a;margin-top:5px}
  .arrow{font-size:24px;color:#8a857a}
  .tap{width:120px;height:120px;background:#111;border-radius:26px;padding:12px;display:flex;align-items:center;justify-content:center}
  .tap img{width:96px;height:96px;border-radius:21px;border:none}
</style>
<h1>The first second — icon → splash → home</h1>
<p class="l">The splash and the home screen are the current ones and identical in every row; only the icon
changes. The splash is green felt with a gilded serif wordmark, so the question is which icon hands off
into it without a jolt. <b>F is the same drawing as the splash, one step earlier.</b></p>
${CANDIDATES.map((c) => `<div class="row ${c.cur ? 'cur' : ''}">
  <div class="who"><b>${c.id}</b><span>${c.note}</span></div>
  <div class="step"><div class="tap"><img src="${img(c.file)}"></div><em>on the home screen</em></div>
  <div class="arrow">→</div>
  <div class="step"><img src="${img(SPLASH)}" style="width:150px"><em>splash</em></div>
  <div class="arrow">→</div>
  <div class="step"><img src="${img(HOME)}" style="width:150px"><em>home</em></div>
</div>`).join('')}`;

const ctx2 = await browser.newContext({ viewport: { width: 1240, height: 1000 }, deviceScaleFactor: 1 });
const p2 = await ctx2.newPage();
await p2.setContent(fs2, { waitUntil: 'load' });
await p2.waitForTimeout(400);
await p2.screenshot({ path: path.join(HERE, 'F-FIRST-SECOND.png'), fullPage: true });
await ctx2.close();

await browser.close();
console.log('sheet -> docs/f-icon/F-ICON-SHEET.png');
console.log('strip -> docs/f-icon/F-FIRST-SECOND.png');
