/**
 * THE SHEET ROYE APPROVES FROM — the responsive lockup, both variants, with the threshold shown
 * as the measurement it is.
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
const leg = JSON.parse(fs.readFileSync(path.join(HERE, 'f-responsive-legibility.json'), 'utf8'));
const thr = JSON.parse(fs.readFileSync(path.join(HERE, 'f-threshold.json'), 'utf8'));
const T = build.threshold.px;
const SIZES = [1024, 240, 120, 60];
const browser = await chromium.launch({ executablePath: process.env.CAPS_BROWSER_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });

const strip = (v, circle) => SIZES.map((S) => {
  const px = Math.min(S, 200);
  const use = S >= T ? 'full' : 'compact';
  const tag = v === 'responsive' ? use : v;
  return `<div class="st"><img src="${img(path.join(STAMPS, `${tag}-${S}${circle ? '-circle' : ''}.png`))}"
    style="width:${px}px;height:${px}px"><em>${S}${v === 'responsive' ? `<br><b class="${use}">${use}</b>` : ''}</em></div>`;
}).join('');

const inkTable = (v) => {
  const names = v === 'full' ? ['suits', 'CAPS', 'POKER'] : ['suits', 'CAPS'];
  const cls = (n) => n < 20 ? 'bad' : n < 100 ? 'warn' : 'ok';
  return `<table><tr><th>tile</th>${names.map((n) => `<th>${n} ink</th><th>contrast</th>`).join('')}</tr>
    ${SIZES.map((S) => { const r = leg.rows[v].sizes[S];
      return `<tr><td><b>${S}</b></td>${names.map((n) =>
        `<td class="${cls(r[n].inkPx)}">${r[n].inkPx} px</td><td>${r[n].contrast}:1</td>`).join('')}</tr>`; }).join('')}
  </table>`;
};

// the sweep, as a picture of where the boundary is
const sweep = thr.rows.filter((r) => r.size >= 56 && r.size <= 160);
const sweepBars = sweep.map((r) => {
  const h = Math.min(60, r.pokerWeakestCell * 8);
  const on = r.pokerWeakestCell >= 2;
  return `<div class="bar ${r.size === T ? 'thr' : ''}" title="${r.size}px: weakest letter cell ${r.pokerWeakestCell}px">
    <i style="height:${Math.max(1, h)}px;background:${on ? '#0b5e2e' : '#b8442e'}"></i></div>`;
}).join('');

const a = build.adaptive;
const rb = build.rebalance;
const respFull = Object.entries(build.responsive).filter(([, v]) => v === 'full').map(([k]) => k);
const respComp = Object.entries(build.responsive).filter(([, v]) => v === 'compact').map(([k]) => k);

const html = `<!doctype html><meta charset="utf-8"><style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{width:1600px;background:#f2f2f0;font:14px/1.55 -apple-system,'DejaVu Sans',sans-serif;color:#15130f;padding:34px}
  h1{font-size:30px;letter-spacing:-.4px}
  .lede{max-width:1180px;margin:12px 0 26px;font-size:15px;color:#3a352d}
  section{background:#fff;border:1px solid #d8d5cd;border-radius:10px;padding:22px;margin-bottom:18px}
  section.key{border-color:#c9a84c;box-shadow:0 0 0 2px #f6eed4 inset}
  h2{font-size:20px;margin-bottom:4px}
  .sub{color:#5b554a;font-size:13px;margin-bottom:16px}
  .strip{display:flex;gap:18px;align-items:flex-end;background:#e9e7e1;padding:14px;border-radius:8px}
  .strip.circle{background:#cfcdc6}
  .st{text-align:center}.st img{display:block;border:1px solid rgba(0,0,0,.18)}
  .strip.circle .st img{border:none}
  .st em{display:block;font-style:normal;font-size:11px;color:#5b554a;margin-top:5px;line-height:1.4}
  .full{color:#0b5e2e}.compact{color:#8a5a00}
  .lab{font-size:12px;color:#5b554a;margin:14px 0 6px}
  .two{display:flex;gap:22px}.two>div{flex:1}
  table{border-collapse:collapse;font-size:13px;margin-top:6px;width:100%}
  th{text-align:left;background:#15130f;color:#fff;padding:6px 10px;font-size:11px;letter-spacing:.5px;font-weight:600}
  td{padding:6px 10px;border-bottom:1px solid #e6e3dc;font-variant-numeric:tabular-nums}
  .ok{color:#0b5e2e;font-weight:700}.warn{color:#9a6b00;font-weight:700}.bad{color:#a11;font-weight:700}
  .mag{display:flex;gap:24px;align-items:flex-start;margin-top:10px;flex-wrap:wrap}
  .mag img{border:1px solid rgba(0,0,0,.3);image-rendering:pixelated;display:block}
  .mag figcaption{font-size:12px;color:#5b554a;margin-top:6px;max-width:330px}
  p{max-width:1180px;margin-bottom:10px}
  code{background:#efece3;padding:1px 5px;border-radius:3px;font-size:12px}
  .note{background:#fdf6e6;border-left:3px solid #c9a84c;padding:12px 14px;margin-top:14px;font-size:13px}
  .note.red{background:#fdecec;border-left-color:#b8442e}
  .sweep{display:flex;gap:2px;align-items:flex-end;height:72px;background:#f6f5f1;padding:6px;border-radius:6px;margin-top:8px}
  .bar{width:14px;display:flex;align-items:flex-end;height:100%}
  .bar i{display:block;width:100%}
  .bar.thr{outline:2px solid #15130f;outline-offset:1px}
  .sx{display:flex;justify-content:space-between;font-size:11px;color:#5b554a;margin-top:4px;max-width:${sweep.length * 16}px}
</style>

<h1>F, responsive — full lockup where POKER lives, compact where it does not</h1>
<p class="lede">Roye chose option B. <b>This is not the fourth simplification he rejected</b> — those changed F
everywhere. Nothing changes at any size where F is legible: the full lockup runs at and above the
threshold, and below it POKER, which by then is a broken dotted line, is dropped. Suits and CAPS stay.
Same drawing, same proportions, same gilding, same felt, same Playfair Display from the pinned font file.
<b>Nothing has been swapped into <code>assets/</code>.</b></p>

<section class="key">
  <h2>The threshold is ${T}px, and it was measured</h2>
  <p class="sub">Not picked, and not a round number. <code>docs/f-icon/threshold.mjs</code> sweeps every tile size
  from 40 to 200, downscaling the master exactly the way iOS does.</p>
  <p><b>The rule.</b> POKER's band is divided into its five letter cells across the word's own measured
  ink extent, and the question is whether every cell still holds ink. A letter that has dissolved leaves
  its cell empty however the survivors fragment. The threshold is the smallest size where all five hold
  at least 2 ink pixels <b>and keep holding at every larger size</b> — a lone size that resolves while its
  neighbours do not is resampling luck, not a boundary.</p>
  <div class="sweep">${sweepBars}</div>
  <div class="sx"><span>56px</span><span>↑ ${T}px — the threshold</span><span>160px</span></div>
  <p class="lab">Each bar is the weakest of POKER's five letter cells at that tile size. Red = a letter has
  gone. Green = all five present.</p>
  <div class="note red"><b>The rule I tried first was wrong, and the sweep caught it.</b> I counted connected
  ink regions and expected five — P, O, K, E, R — falling as letters vanish. The data says a serif
  <b>fragments</b> at these sizes: twelve regions at 180, eleven at 144, four at 96. A bowl separates from a
  stem, a leg from its serif, and antialiasing strews single stray pixels that each count as a region. That
  rule would have passed 64px and failed 96px. The count is noise in both directions; per-letter occupancy
  is not.</div>
  <p style="margin-top:12px"><b>At ${T}px POKER renders at ${thr.pokerPxAtThreshold}px.</b> The first size that
  resolves all five letters at all is ${thr.firstResolving}px, but it does not hold — which is the whole
  reason the rule requires persistence.</p>
</section>

<section>
  <h2>Which variant ships at which size</h2>
  <p class="sub">A comparison against the measured number, not a list someone typed.</p>
  <table>
    <tr><th>variant</th><th>sizes</th></tr>
    <tr><td><b class="full">full</b></td><td>${respFull.join(' · ')}</td></tr>
    <tr><td><b class="compact">compact</b></td><td>${respComp.join(' · ')}</td></tr>
    <tr><td><b class="compact">compact</b></td><td>Android adaptive foreground, and the 64px favicon</td></tr>
  </table>
  <div class="note"><b>The adaptive foreground is compact because of a measurement, not a preference.</b>
  Its canvas is 432px, far above the threshold — but the canvas is not the mark. Only the central
  ${a.safeDiameter}px circle survives the mask, the block is fitted inside that, and a launcher draws the
  whole thing at roughly 48–108dp. The block's own rendered size works out at
  <b>${a.effectiveTileAt108dp}px</b> at 108dp, below ${T}. POKER would be the same dotted line there that it
  is at 60.</div>
</section>

<section>
  <h2>Full and compact, side by side</h2>
  <div class="two">
    <div><div class="lab"><b>FULL</b> — 1024 · 240 · 120 · 60</div><div class="strip">${strip('full', false)}</div>
      <div class="lab">masked to a circle</div><div class="strip circle">${strip('full', true)}</div></div>
  </div>
  <div class="two" style="margin-top:18px">
    <div><div class="lab"><b>COMPACT</b> — 1024 · 240 · 120 · 60</div><div class="strip">${strip('compact', false)}</div>
      <div class="lab">masked to a circle</div><div class="strip circle">${strip('compact', true)}</div></div>
  </div>
  <div class="lab" style="margin-top:18px"><b>AS IT WOULD SHIP</b> — each size carrying the variant the threshold chose</div>
  <div class="strip">${strip('responsive', false)}</div>
</section>

<section>
  <h2>What the rebalance actually did — and it is less than it sounds</h2>
  <p><b>⚠️ My first attempt did nothing, and the build caught it: compact came out at exactly the same font
  size as full, 0% growth.</b> The reason is a fact I had backwards. POKER is not what makes the block wide —
  <b>CAPS is</b>. Four Playfair capitals at 308px span ${rb.fullBoxAtProbe100.w * 3.083 | 0}px; POKER at 61.7px
  with its 0.30em letterspacing spans about a third of that. Dropping POKER frees only <b>height</b>, width
  still binds in the same place, and a naive re-fit changes nothing at all.</p>
  <p>So compact is grown until its bounding box has the <b>same half-diagonal</b> as the full block — the same
  footprint radius, so both variants sit inside the same circle, which is also exactly what the Android mask
  and every circular profile picture care about. Measured boxes at a probe size of 100:
  full <b>${rb.fullBoxAtProbe100.w}×${rb.fullBoxAtProbe100.h}</b>, compact
  <b>${rb.compactBoxAtProbe100.w}×${rb.compactBoxAtProbe100.h}</b> → compact grows <b>×${rb.growth}</b>.</p>
  <p><b>That is 5%, not a transformation, and pretending otherwise would be overselling it.</b> POKER's row is
  small next to CAPS, so there is only so much space to reclaim. CAPS and the suits do take it rather than
  leaving the tile with more empty felt, and the half-diagonal is identical at every size —
  ${build.sizes.full[1024].halfDiagShare}% of the tile for both. Nothing else moved: the ratio between the
  suits and CAPS, the gap, the gilding stops and the felt are untouched.</p>
</section>

<section>
  <h2>Ink per layer, and the suits question</h2>
  <p class="sub">Measured on the downscaled tile, warm decile against the local dark quartile. Same test as
  the previous sprint, so the numbers are comparable.</p>
  <div class="two">
    <div><div class="lab"><b>FULL</b></div>${inkTable('full')}</div>
    <div><div class="lab"><b>COMPACT</b></div>${inkTable('compact')}</div>
  </div>
  <div class="mag">
    <figure><img src="${img(path.join(STAMPS, 'full-60.png'))}" style="width:330px;height:330px">
      <figcaption><b>FULL at 60, 7× nearest.</b> POKER is a broken dotted line — 1 ink pixel. This is the tile
      that made the decision necessary.</figcaption></figure>
    <figure><img src="${img(path.join(STAMPS, 'compact-60.png'))}" style="width:330px;height:330px">
      <figcaption><b>COMPACT at 60, 7× nearest — what a phone home screen would show.</b> CAPS is cleaner and
      bigger, 88 ink pixels against 78, and there is no broken row beneath it.</figcaption></figure>
    <figure><img src="${img(path.join(STAMPS, 'compact-120.png'))}" style="width:330px;height:330px">
      <figcaption><b>COMPACT at 120, 3× nearest.</b> Here the four suits genuinely resolve — you can tell the
      spade from the club.</figcaption></figure>
  </div>
  <div class="note red"><b>THE SUITS AT 60px ARE NOT SUITS. Roye chose to keep them; he did not choose to keep
  them illegible, so this is reported rather than decided.</b> On the compact 60px tile they are
  <b>${leg.rows.compact.sizes[60].suits.inkPx} ink pixels across four glyphs</b>
  (${leg.rows.compact.sizes[60].suits.cellInk.join(' / ')} each), rendering at about 4px. That is up from
  ${leg.rows.full.sizes[60].suits.inkPx} in the full lockup, and it is still two to four pixels per suit.
  <b>Look at the middle picture: they are four gold dots.</b> They read as an ornamental row, which is not
  ugly and is arguably fine — but nobody will identify a spade. At 120 they resolve properly, and at 240
  they are unambiguous. <b>They are not dropped. This is his call, exactly as POKER was.</b></div>
</section>

<section>
  <h2>Every size, the Android mask, and the gold guard</h2>
  <div class="strip">
    <div class="st"><img src="${img(path.join(BUILT, 'android-icon-foreground.png'))}" style="width:200px;height:200px;background:#111"><em>adaptive foreground 432<br><b class="compact">compact</b></em></div>
    <div class="st"><img src="${img(path.join(BUILT, 'android-icon-background.png'))}" style="width:200px;height:200px"><em>adaptive background</em></div>
    <div class="st"><img src="${img(path.join(BUILT, 'android-icon-monochrome.png'))}" style="width:200px;height:200px;background:#111"><em>monochrome</em></div>
    <div class="st"><img src="${img(path.join(BUILT, 'favicon.png'))}" style="width:64px;height:64px"><em>favicon 64<br><b class="compact">compact</b></em></div>
  </div>
  <div class="note"><b>Nothing is clipped by the mask.</b> Only the central 72 of 108dp survives every OEM
  shape — a ${a.safeDiameter}px circle on the ${a.canvas}px canvas. The block is wider than tall, so fitting
  its width would still push its corners out; the fit solves for the measured <b>diagonal</b>. Worst corner
  reaches <b>${a.worstCornerRadius}px of the ${a.safeRadius}px safe radius</b> — ${a.clearancePct}% clearance,
  fits: <b class="ok">${a.fitsSafeCircle ? 'YES' : 'NO'}</b>.</div>
  <div class="note"><b>No <code>#FFD700</code> anywhere.</b> The winner cue
  (<code>constants/gameConfig.ts:111</code>) must not appear in brand furniture. All
  <b>${build.forbiddenGold.filesScanned}</b> regenerated files — both variants, every size, the responsive set,
  the adaptive layers and the favicon — were re-read pixel by pixel after rendering:
  <b class="ok">${build.forbiddenGold.pixelHits} hits</b>. The guard lives in the build script.</div>
</section>`;

const ctx = await browser.newContext({ viewport: { width: 1600, height: 1200 }, deviceScaleFactor: 1 });
const page = await ctx.newPage();
await page.setContent(html, { waitUntil: 'load' });
await page.waitForTimeout(400);
await page.screenshot({ path: path.join(HERE, 'F-RESPONSIVE-SHEET.png'), fullPage: true });
await ctx.close();

// ── first second, with the COMPACT icon, since that is what a home screen shows ──────────────
const SPLASH = path.join(ROOT, 'docs/splash-proof/splash-393x852.png');
const HOME = path.join(ROOT, 'docs/product-map/shots/en/home.png');
const CANDS = [
  { id: 'F compact', file: path.join(STAMPS, 'compact-240.png'), cur: true, note: 'what a home screen shows' },
  { id: 'F full', file: path.join(STAMPS, 'full-240.png'), cur: false, note: 'the same mark at 144px and above' },
  { id: 'C1 (shipped today)', file: path.join(ROOT, 'docs/icon-history/stamps/C1-240.png'), cur: false, note: 'cream card, navy spade' },
];
const fs2 = `<!doctype html><meta charset="utf-8"><style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{width:1240px;background:#f2f2f0;font:14px/1.5 -apple-system,'DejaVu Sans',sans-serif;color:#15130f;padding:30px}
  h1{font-size:26px}p.l{max-width:1020px;margin:10px 0 22px;color:#3a352d}
  .row{display:flex;gap:20px;align-items:center;background:#fff;border:1px solid #d8d5cd;border-radius:10px;padding:18px;margin-bottom:16px}
  .row.cur{border-color:#c9a84c;box-shadow:0 0 0 2px #f0e3bd inset}
  .who{width:190px}.who b{font-size:16px;display:block}.who span{font-size:12px;color:#5b554a}
  .step{text-align:center}.step img{display:block;border:1px solid rgba(0,0,0,.2);border-radius:4px}
  .step em{display:block;font-style:normal;font-size:11px;color:#5b554a;margin-top:5px}
  .arrow{font-size:24px;color:#8a857a}
  .tap{width:120px;height:120px;background:#111;border-radius:26px;padding:12px;display:flex;align-items:center;justify-content:center}
  .tap img{width:96px;height:96px;border-radius:21px;border:none}
</style>
<h1>The first second — icon → splash → home</h1>
<p class="l">The splash and home are the current ones and identical in every row; only the icon changes.
<b>The top row is the compact lockup, because that is the variant a phone home screen actually receives.</b>
The splash is green felt with a gilded serif wordmark, and CAPS in the icon is the same word in the same
face — the icon is the splash, one step earlier.</p>
${CANDS.map((c) => `<div class="row ${c.cur ? 'cur' : ''}">
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
console.log('sheet -> docs/f-icon/F-RESPONSIVE-SHEET.png');
console.log('strip -> docs/f-icon/F-FIRST-SECOND.png');
