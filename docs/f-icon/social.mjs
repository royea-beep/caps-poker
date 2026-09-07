/**
 * THE SOCIAL PROFILE IMAGES, REBUILT FROM F.
 *
 * The shipped set in docs/social/ was built from the C1 card mark, so the face on Facebook,
 * Instagram and TikTok is a mark the home screen would no longer show. These are the same sizes
 * with F on them instead.
 *
 * ⚠️ WRITTEN TO docs/f-icon/social/, NOT OVER docs/social/. Roye has not approved F yet, and
 * overwriting art in place is precisely the habit that lost the C icon for five months. When he
 * approves, these copy across in one move and the old ones stay recoverable in git either way.
 *
 * ⚠️ THE CIRCLE IS THE WHOLE PROBLEM FOR A WORDMARK. Every one of these platforms serves a profile
 * picture as a CIRCLE. C1 was a compact card and cleared the inscribed circle by about a quarter of
 * the radius. F is a wide three-layer block, so fitting its WIDTH to the circle would still push
 * its corners outside it — the fit solves for the block's measured DIAGONAL, and then the proof
 * re-reads every rendered PNG and counts mark pixels outside the inscribed circle. Zero is the
 * only acceptable answer and the count is printed rather than asserted.
 *
 * ⚠️ WHICH VARIANT PER PLATFORM IS DECIDED BY MEASURING THE ARTEFACT, NOT BY REMEMBERING WHAT
 * INSTAGRAM DOES. A profile picture is an icon, not a cover, so the same question applies: does
 * POKER still have all five letters? Each profile size is rendered in the FULL lockup, POKER's band
 * is split into its five letter cells, and the cells are counted. Full is used where every letter
 * survives; compact where one has gone. No display-size figure is asserted, because I cannot verify
 * what CSS size any platform serves — but note that a platform only ever shows these SMALLER than
 * uploaded, never larger, so a size that merely scrapes past is reported as scraping past.
 *
 * ⚠️ AND THE MARK IS SMALLER THAN THE TILE HERE. On the app icon the block spans 80% of the tile;
 * on a profile it is fitted to 86% of the circle's DIAMETER along its diagonal, which lands the
 * type well below what the same pixel count would give an icon. So a 320px profile is not a 320px
 * icon, and the measurement is done on the real rendered file rather than inferred from the size.
 *
 * THE COVER IS NOT REBUILT — Roye said keep it, and the full lockup belongs there: it is large.
 * One honest note: the shipped cover is set in Georgia, the substitute serif, because that is what
 * brand-assets.mjs had. A Playfair version is rendered here beside it, labelled optional, so the
 * difference is visible. Nothing is replaced.
 *
 * Usage: xvfb-run -a node docs/f-icon/social.mjs
 */

import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';

const HERE = path.resolve(new URL('.', import.meta.url).pathname);
const ROOT = path.resolve(HERE, '../..');
const OUT = path.join(HERE, 'social');
fs.mkdirSync(OUT, { recursive: true });

const FELT_TOP = '#003115', FELT_BOTTOM = '#062E18';
const GOLD = '#c9a84c', GOLD_HI = '#e8d9a0', GOLD_LO = '#8d6f24';
const FONT_B64 = fs.readFileSync(path.join(ROOT, 'tools/icon/fonts/PlayfairDisplay.ttf')).toString('base64');
const FACE = `@font-face{font-family:'CAPS Masthead';src:url(data:font/ttf;base64,${FONT_B64}) format('truetype');font-weight:400 900;font-display:block}`;

const feltGround = (w, h) => `
  background:
    radial-gradient(120% 80% at 50% 34%, rgba(38,86,56,.95) 0%, rgba(0,0,0,0) 62%),
    linear-gradient(180deg, ${FELT_TOP} 0%, ${FELT_BOTTOM} 55%, #010805 100%);
  width:${w}px;height:${h}px;position:relative;overflow:hidden;`;

const wordmark = (px, family, withPoker = true) => `
  <div id="wm" style="text-align:center;line-height:1;display:inline-block">
    <div style="font-size:${px * 0.22}px;letter-spacing:${px * 0.16}px;color:${GOLD};opacity:.85;
                margin-bottom:${px * 0.16}px;text-indent:${px * 0.16}px">&#9824; &#9829; &#9830; &#9827;</div>
    <div style="font-family:${family};font-variation-settings:'wght' 700;font-weight:700;font-size:${px}px;
                letter-spacing:${px * 0.02}px;
                background:linear-gradient(180deg,${GOLD_HI} 0%,${GOLD} 46%,${GOLD_LO} 100%);
                -webkit-background-clip:text;background-clip:text;color:transparent;
                text-shadow:0 ${px * 0.03}px ${px * 0.06}px rgba(0,0,0,.55)">CAPS</div>
    ${withPoker ? `<div style="font-family:${family};font-variation-settings:'wght' 500;font-size:${px * 0.20}px;
                letter-spacing:${px * 0.30}px;color:${GOLD};margin-top:${px * 0.10}px;
                text-indent:${px * 0.30}px">POKER</div>` : ''}
  </div>`;

const PLAYFAIR = `'CAPS Masthead'`;
const browser = await chromium.launch({ executablePath: process.env.CAPS_BROWSER_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });

/** Measure the block once, so every fit below is solved from a real box. Iron Rule #3. */
async function probe(family, withPoker = true) {
  const ctx = await browser.newContext({ viewport: { width: 3000, height: 900 } });
  const p = await ctx.newPage();
  await p.setContent(`<!doctype html><meta charset="utf-8"><style>${FACE}*{margin:0;padding:0}body{background:#000}</style>${wordmark(100, family, withPoker)}`, { waitUntil: 'load' });
  await p.evaluate(() => document.fonts.ready);
  await p.waitForTimeout(120);
  const b = await p.evaluate(() => { const r = document.getElementById('wm').getBoundingClientRect(); return { w: r.width, h: r.height }; });
  await ctx.close();
  return b;
}
const BOX = await probe(PLAYFAIR, true);
const BOX_C = await probe(PLAYFAIR, false);
const AR = BOX.w / BOX.h;
const DIAG_OVER_W = Math.sqrt(1 + 1 / (AR * AR));   // the block's diagonal, per unit of its width
/** compact matches full's footprint radius, exactly as the icon build does */
const COMPACT_GROWTH = Math.hypot(BOX.w, BOX.h) / Math.hypot(BOX_C.w, BOX_C.h);
const AR_C = BOX_C.w / BOX_C.h;
const DIAG_OVER_W_C = Math.sqrt(1 + 1 / (AR_C * AR_C));

async function render(file, w, h, px, family, withPoker = true) {
  const html = `<!doctype html><meta charset="utf-8"><style>${FACE}
    *{box-sizing:border-box;margin:0;padding:0}html,body{width:${w}px;height:${h}px;overflow:hidden}</style>
    <div style="${feltGround(w, h)}">
      <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center">
        ${wordmark(px, family, withPoker)}</div></div>`;
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  const p = await ctx.newPage();
  await p.setContent(html, { waitUntil: 'load' });
  await p.evaluate(() => document.fonts.ready);
  await p.waitForTimeout(200);
  await p.screenshot({ path: file });
  await ctx.close();
}

/**
 * THE PROOF. Re-reads the rendered PNG, calls any warm pixel (red clearly above blue) part of the
 * mark, and counts how many fall outside the inscribed circle. Also reports how close the nearest
 * mark pixel gets to the edge, as a share of the radius — the same figure quoted for C1.
 */
function circleProof(file) {
  const img = PNG.sync.read(fs.readFileSync(file));
  const { width: W, height: H } = img;
  const cx = (W - 1) / 2, cy = (H - 1) / 2, r = Math.min(W, H) / 2;
  let mark = 0, outside = 0, closest = r;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const o = (y * W + x) << 2;
    if (!(img.data[o] > img.data[o + 2] + 28 && img.data[o] > 90)) continue;
    mark++;
    const d = Math.hypot(x - cx, y - cy);
    if (d > r) outside++;
    if (r - d < closest) closest = r - d;
  }
  return { markPx: mark, outsideCircle: outside, clearancePctOfRadius: +((closest / r) * 100).toFixed(1) };
}

const PROFILES = [
  { file: 'caps-profile-1024.png', s: 1024, note: 'master square' },
  { file: 'caps-profile-facebook-360.png', s: 360, note: 'Facebook page profile' },
  { file: 'caps-profile-instagram-320.png', s: 320, note: 'Instagram profile' },
  { file: 'caps-profile-tiktok-200.png', s: 200, note: 'TikTok profile' },
];

/**
 * 0.86 of the safe DIAMETER, not of the tile — the circle's diameter is the tile's width, so a
 * block filling 0.80 of the square would have its corners well outside the circle. The proof below
 * confirms it rather than trusting it.
 */
const CIRCLE_FILL = 0.86;

/** POKER's five letter cells, on a rendered file. Same test as docs/f-icon/threshold.mjs. */
function pokerCells(file) {
  const img = PNG.sync.read(fs.readFileSync(file));
  const { width: W, height: H } = img;
  const rows = [];
  for (let y = 0; y < H; y++) {
    let n = 0;
    for (let x = 0; x < W; x++) { const o = (y * W + x) << 2;
      if (img.data[o] > img.data[o + 2] + 28 && img.data[o] > 90) n++; }
    rows.push(n);
  }
  const on = rows.map((n) => n > W * 0.004);
  const runs = []; let st = -1;
  for (let y = 0; y < H; y++) {
    if (on[y] && st < 0) st = y;
    if ((!on[y] || y === H - 1) && st >= 0) { runs.push([st, y]); st = -1; }
  }
  if (runs.length < 3) return { cells: [0, 0, 0, 0, 0], weakest: 0 };
  const band = runs.sort((a, b) => (b[1] - b[0]) - (a[1] - a[0])).slice(0, 3).sort((a, b) => a[0] - b[0])[2];
  const cols = new Int32Array(W); let lo = W, hi = -1;
  for (let y = band[0]; y < band[1]; y++) for (let x = 0; x < W; x++) {
    const o = (y * W + x) << 2;
    if (img.data[o] > img.data[o + 2] + 28 && img.data[o] > 90) { cols[x]++; if (x < lo) lo = x; if (x > hi) hi = x; }
  }
  const cells = new Array(5).fill(0);
  if (hi >= lo) { const wd = hi - lo + 1;
    for (let x = lo; x <= hi; x++) cells[Math.min(4, Math.floor(((x - lo) / wd) * 5))] += cols[x]; }
  return { cells, weakest: Math.min(...cells) };
}

const out = { ts: new Date().toISOString(), aspectRatioFull: +AR.toFixed(3),
  compactGrowth: +COMPACT_GROWTH.toFixed(4),
  variantRule: "each profile size is rendered FULL and POKER's five letter cells counted; full is kept where every letter holds >=2 ink px, compact used where one has gone",
  profiles: {}, cover: {} };

const TRIAL = path.join(OUT, '_variant-trial');
fs.mkdirSync(TRIAL, { recursive: true });

console.log('\nCHOOSING THE VARIANT, per platform, by measuring the rendered file\n');
for (const pr of PROFILES) {
  const pxFull = (pr.s * (CIRCLE_FILL / DIAG_OVER_W)) / (BOX.w / 100);
  const trial = path.join(TRIAL, pr.file);
  await render(trial, pr.s, pr.s, pxFull, PLAYFAIR, true);
  const pc = pokerCells(trial);
  const useFull = pc.weakest >= 2;
  console.log(`  ${pr.file.padEnd(34)} ${String(pr.s).padStart(4)}px  POKER cells ${pc.cells.join('/')}  ` +
    `weakest ${pc.weakest}  ->  ${useFull ? 'FULL' : 'COMPACT'}`);

  const px = useFull ? pxFull : (pr.s * (CIRCLE_FILL / DIAG_OVER_W_C)) / (BOX_C.w / 100);
  const f = path.join(OUT, pr.file);
  await render(f, pr.s, pr.s, px, PLAYFAIR, useFull);
  const proof = circleProof(f);
  out.profiles[pr.file] = { size: pr.s, variant: useFull ? 'full' : 'compact', fontPx: +px.toFixed(2),
    pokerCellsIfFull: pc.cells, pokerWeakestIfFull: pc.weakest, ...proof };
}

console.log('\nCIRCULAR CROP, on the file that would ship\n');
for (const pr of PROFILES) {
  const r = out.profiles[pr.file];
  console.log(`  ${pr.file.padEnd(34)} ${r.variant.padEnd(7)} mark ${String(r.markPx).padStart(6)}px · ` +
    `OUTSIDE THE CIRCLE ${r.outsideCircle} · clearance ${r.clearancePctOfRadius}% of the radius`);
}

// the optional Playfair cover — FULL lockup, it is large. Not a replacement.
for (const c of [{ file: 'OPTIONAL-cover-facebook-1640x664.png', w: 1640, h: 664 },
                 { file: 'OPTIONAL-cover-wide-1920x1080.png', w: 1920, h: 1080 }]) {
  const px = Math.round(c.h * 0.20);
  await render(path.join(OUT, c.file), c.w, c.h, px, PLAYFAIR, true);
  out.cover[c.file] = { w: c.w, h: c.h, fontPx: px, variant: 'full',
    note: 'OPTIONAL — the shipped cover in docs/social/ is kept as instructed; this is the same drawing in the real face' };
}
console.log(`\n  cover: kept as instructed. Optional Playfair versions rendered beside it, FULL lockup, replacing nothing.`);

fs.writeFileSync(path.join(HERE, 'f-social.json'), JSON.stringify(out, null, 2));
await browser.close();
const bad = Object.values(out.profiles).filter((p) => p.outsideCircle > 0).length;
console.log(`\nVERDICT: ${bad === 0 ? 'ALL CLEAR — 0 mark pixels outside the circle at every size' : `${bad} SIZE(S) CLIP`}`);
console.log('files -> docs/f-icon/social/   facts -> docs/f-icon/f-social.json');
