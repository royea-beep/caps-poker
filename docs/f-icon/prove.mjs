/**
 * PROVING THE RESPONSIVE LOCKUP — both variants, at the sizes that decide.
 *
 * ⚠️ THE TILE THAT MATTERS IS THE DOWNSCALED ONE. iOS and Expo take one master and resample it
 * down; they do not lay type out fresh at 60px. So every tile measured here is a chromium
 * downscale of that variant's own 1024 master, which is the shipping path.
 *
 * Roye kept the suits. He did not choose to keep them illegible, so they are measured at the
 * compact size and reported either way — the same warm-pixel ink test as the previous sprint, so
 * the numbers are comparable across both.
 *
 * Usage: xvfb-run -a node docs/f-icon/prove.mjs
 */

import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';

const HERE = path.resolve(new URL('.', import.meta.url).pathname);
const BUILT = path.join(HERE, 'built');
const OUT = path.join(HERE, 'stamps');
fs.mkdirSync(OUT, { recursive: true });
const b64 = (p) => fs.readFileSync(p).toString('base64');
const build = JSON.parse(fs.readFileSync(path.join(HERE, 'f-icon-build.json'), 'utf8'));
const THRESHOLD = build.threshold.px;

const SIZES = [1024, 240, 120, 60];
const VARIANTS = ['full', 'compact'];
const browser = await chromium.launch({ executablePath: process.env.CAPS_BROWSER_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });

async function stamp(srcAbs, outAbs, S, circle) {
  const html = `<!doctype html><meta charset="utf-8"><style>
    *{margin:0;padding:0}html,body{width:${S}px;height:${S}px;overflow:hidden;background:transparent}
    img{width:${S}px;height:${S}px;display:block;${circle ? 'border-radius:50%;' : ''}}
  </style><img src="data:image/png;base64,${b64(srcAbs)}">`;
  const ctx = await browser.newContext({ viewport: { width: S, height: S }, deviceScaleFactor: 1 });
  const p = await ctx.newPage();
  await p.setContent(html, { waitUntil: 'load' });
  await p.waitForTimeout(110);
  await p.screenshot({ path: outAbs, omitBackground: true });
  await ctx.close();
}

for (const v of VARIANTS) {
  const master = path.join(BUILT, v, 'icon-1024.png');
  for (const S of SIZES) {
    await stamp(master, path.join(OUT, `${v}-${S}.png`), S, false);
    await stamp(master, path.join(OUT, `${v}-${S}-circle.png`), S, true);
  }
}
await browser.close();

// ── ink, per layer, per variant ──────────────────────────────────────────────────────────────
const isInk = (d, o) => d[o] > d[o + 2] + 28 && d[o] > 90;
const lum = (r, g, b) => { const f = (v) => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
const wcag = (a, b) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
const pct = (a, q) => { const s = a.slice().sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.max(0, Math.round(q * (s.length - 1))))]; };

/**
 * Bands are re-derived PER VARIANT from that variant's own master — compact has two rows, full has
 * three, and their vertical positions differ because the block is re-fitted. Reusing full's band
 * fractions on compact would measure felt and call it a layer.
 */
function findBands(file, expect) {
  const img = PNG.sync.read(fs.readFileSync(file));
  const { width: W, height: H } = img;
  const on = [];
  for (let y = 0; y < H; y++) {
    let n = 0;
    for (let x = 0; x < W; x++) if (isInk(img.data, (y * W + x) << 2)) n++;
    on.push(n > W * 0.004);
  }
  const runs = []; let s = -1;
  for (let y = 0; y < H; y++) {
    if (on[y] && s < 0) s = y;
    if ((!on[y] || y === H - 1) && s >= 0) { runs.push([s, y]); s = -1; }
  }
  runs.sort((a, b) => (b[1] - b[0]) - (a[1] - a[0]));
  return runs.slice(0, expect).sort((a, b) => a[0] - b[0]).map(([a, b]) => [a / H, b / H]);
}

function layer(file, band, cells) {
  const img = PNG.sync.read(fs.readFileSync(file));
  const { width: W, height: H } = img;
  const y0 = Math.max(0, Math.floor(band[0] * H)), y1 = Math.min(H, Math.ceil(band[1] * H));
  const L = [], warm = []; const cols = new Int32Array(W);
  let lo = W, hi = -1;
  for (let y = y0; y < y1; y++) for (let x = 0; x < W; x++) {
    const o = (y * W + x) << 2;
    L.push(lum(img.data[o], img.data[o + 1], img.data[o + 2]));
    if (isInk(img.data, o)) { warm.push(L[L.length - 1]); cols[x]++; if (x < lo) lo = x; if (x > hi) hi = x; }
  }
  const cellInk = new Array(cells).fill(0);
  if (hi >= lo) { const wdt = hi - lo + 1;
    for (let x = lo; x <= hi; x++) cellInk[Math.min(cells - 1, Math.floor(((x - lo) / wdt) * cells))] += cols[x]; }
  return { inkPx: warm.length,
    contrast: warm.length ? +wcag(pct(warm, 0.90), pct(L, 0.25)).toFixed(2) : 1,
    cellInk, weakestCell: Math.min(...cellInk) };
}

const LAYERS = { full: [['suits', 4], ['CAPS', 4], ['POKER', 5]], compact: [['suits', 4], ['CAPS', 4]] };
const out = { ts: new Date().toISOString(), threshold: THRESHOLD,
  method: 'chromium downscale of each variant\'s own 1024 master — the shipping path; bands re-derived per variant',
  rows: {} };

for (const v of VARIANTS) {
  const bands = findBands(path.join(OUT, `${v}-1024.png`), LAYERS[v].length);
  out.rows[v] = { bands, sizes: {} };
  for (const S of SIZES) {
    const f = path.join(OUT, `${v}-${S}.png`);
    out.rows[v].sizes[S] = {};
    LAYERS[v].forEach(([name, cells], i) => { out.rows[v].sizes[S][name] = layer(f, bands[i], cells); });
  }
}
fs.writeFileSync(path.join(HERE, 'f-responsive-legibility.json'), JSON.stringify(out, null, 2));

for (const v of VARIANTS) {
  console.log(`\n${v.toUpperCase()} — ink per layer on the downscaled tile\n`);
  console.log('tile   ' + LAYERS[v].map(([n]) => `${n} ink   ${n} contrast`.padEnd(26)).join(''));
  for (const S of SIZES) {
    const r = out.rows[v].sizes[S];
    console.log(String(S).padStart(4) + '   ' + LAYERS[v].map(([n]) =>
      `${String(r[n].inkPx).padStart(6)} px   ${String(r[n].contrast).padStart(6)}:1`.padEnd(26)).join(''));
  }
}

const s60 = out.rows.compact.sizes[60].suits;
const c60 = out.rows.compact.sizes[60].CAPS;
console.log(`\nTHE SUITS AT THE COMPACT 60px TILE — Roye kept them, so here is what they are:`);
console.log(`  ${s60.inkPx} ink px across four glyphs (${s60.cellInk.join(' / ')}), local contrast ${s60.contrast}:1`);
console.log(`  CAPS on the same tile: ${c60.inkPx} ink px at ${c60.contrast}:1`);
console.log(`\nfacts -> docs/f-icon/f-responsive-legibility.json`);
