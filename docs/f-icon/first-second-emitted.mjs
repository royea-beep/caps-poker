/**
 * THE FIRST SECOND, BUILT FROM WHAT THE PLUGIN ACTUALLY EMITTED.
 *
 * ⚠️ NOT from docs/f-icon/built/. Those are the source renders; this reads the files that landed in
 * ios/CapsPoker/Images.xcassets/AppIcon.appiconset after prebuild. If the plugin had written the
 * wrong variant into a correctly-named slot, a sheet made from the sources would still look right —
 * which is exactly the failure this project keeps paying for.
 *
 * BOTH home-screen rows are shown, because the responsive lockup genuinely differs between phones:
 * a 3x iPhone draws the 60pt icon at 180px and gets the FULL lockup; a 2x iPhone draws it at 120px
 * and gets COMPACT. That is the decision working as designed, and it is worth seeing rather than
 * being told.
 *
 * Usage: xvfb-run -a node docs/f-icon/first-second-emitted.mjs
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const HERE = path.resolve(new URL('.', import.meta.url).pathname);
const ROOT = path.resolve(HERE, '../..');
const SET = path.join(ROOT, 'ios/CapsPoker/Images.xcassets/AppIcon.appiconset');
const AND = path.join(ROOT, 'android/app/src/main/res');
const img = (p) => `data:image/png;base64,${fs.readFileSync(p).toString('base64')}`;

for (const p of [SET, AND]) if (!fs.existsSync(p)) throw new Error(`no emitted output at ${p} — run expo prebuild first`);

const SPLASH = path.join(ROOT, 'docs/splash-proof/splash-393x852.png');
const HOME = path.join(ROOT, 'docs/product-map/shots/en/home.png');

const ROWS = [
  { id: '3× iPhone', note: '60pt @3x = 180px — FULL lockup', file: path.join(SET, 'AppIcon-60x60@3x.png'), cur: true },
  { id: '2× iPhone', note: '60pt @2x = 120px — COMPACT', file: path.join(SET, 'AppIcon-60x60@2x.png'), cur: true },
  { id: 'Android xxxhdpi', note: '192px launcher — FULL', file: path.join(AND, 'mipmap-xxxhdpi/ic_launcher.png'), cur: false },
  { id: 'Android xhdpi', note: '96px launcher — COMPACT', file: path.join(AND, 'mipmap-xhdpi/ic_launcher.png'), cur: false },
];

const html = `<!doctype html><meta charset="utf-8"><style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{width:1240px;background:#f2f2f0;font:14px/1.5 -apple-system,'DejaVu Sans',sans-serif;color:#15130f;padding:30px}
  h1{font-size:26px}p.l{max-width:1030px;margin:10px 0 22px;color:#3a352d}
  .row{display:flex;gap:20px;align-items:center;background:#fff;border:1px solid #d8d5cd;border-radius:10px;padding:18px;margin-bottom:16px}
  .row.cur{border-color:#c9a84c;box-shadow:0 0 0 2px #f0e3bd inset}
  .who{width:210px}.who b{font-size:16px;display:block}.who span{font-size:12px;color:#5b554a}
  .step{text-align:center}.step img{display:block;border:1px solid rgba(0,0,0,.2);border-radius:4px}
  .step em{display:block;font-style:normal;font-size:11px;color:#5b554a;margin-top:5px}
  .arrow{font-size:24px;color:#8a857a}
  .tap{width:120px;height:120px;background:#111;border-radius:26px;padding:12px;display:flex;align-items:center;justify-content:center}
  .tap img{width:96px;height:96px;border-radius:21px;border:none}
</style>
<h1>The first second — from the files the plugin emitted</h1>
<p class="l">Every icon below was read out of <code>ios/CapsPoker/Images.xcassets/AppIcon.appiconset</code> and
<code>android/app/src/main/res</code> after a prebuild — <b>not</b> from the source renders. The splash and home
are the current ones and identical in every row. <b>A 3× iPhone gets the full lockup and a 2× iPhone gets
compact: that is the responsive decision working, not an inconsistency.</b></p>
${ROWS.map((r) => `<div class="row ${r.cur ? 'cur' : ''}">
  <div class="who"><b>${r.id}</b><span>${r.note}</span></div>
  <div class="step"><div class="tap"><img src="${img(r.file)}"></div><em>on the home screen</em></div>
  <div class="arrow">→</div>
  <div class="step"><img src="${img(SPLASH)}" style="width:150px"><em>splash</em></div>
  <div class="arrow">→</div>
  <div class="step"><img src="${img(HOME)}" style="width:150px"><em>home</em></div>
</div>`).join('')}`;

const browser = await chromium.launch({ executablePath: process.env.CAPS_BROWSER_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const ctx = await browser.newContext({ viewport: { width: 1240, height: 1000 }, deviceScaleFactor: 1 });
const p = await ctx.newPage();
await p.setContent(html, { waitUntil: 'load' });
await p.waitForTimeout(400);
await p.screenshot({ path: path.join(HERE, 'F-FIRST-SECOND-EMITTED.png'), fullPage: true });
await ctx.close(); await browser.close();
console.log('strip -> docs/f-icon/F-FIRST-SECOND-EMITTED.png (sources: the emitted native projects)');
