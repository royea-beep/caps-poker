/**
 * WHERE DOES POKER STOP SURVIVING? — measured, not picked.
 *
 * Roye chose a responsive lockup: full F where POKER is legible, suits + CAPS where it is not.
 * That needs a boundary, and a round number would be a guess dressed as a decision. This sweeps
 * every tile size from 40 to 200, downscales the 1024 master to each one exactly the way iOS and
 * Expo do, isolates POKER's band, and asks a question with a yes/no answer:
 *
 *   IS EVERY ONE OF THE FIVE LETTERS STILL PRESENT?
 *
 * ⚠️ THE FIRST RULE I WROTE FOR THIS WAS WRONG AND THE SWEEP CAUGHT IT. I counted connected ink
 * regions in the band and expected five — P, O, K, E, R — falling as letters vanish. The data
 * says otherwise: at 180 the band yields TWELVE regions, at 144 eleven, at 96 four. A serif at
 * these sizes FRAGMENTS — a bowl separates from a stem, a leg from its serif, and antialiasing
 * strews single stray pixels that each count as a region. The component count is noise in both
 * directions, and "at least five regions" would have declared 64px a pass and 96px a failure.
 *
 * So the band is instead divided into FIVE EQUAL LETTER CELLS across POKER's own horizontal
 * extent, and the question becomes whether each cell still holds ink. A letter that has dissolved
 * leaves its cell empty no matter how the survivors fragment. Requiring a couple of pixels per
 * cell rather than one keeps a single antialiased speck from passing as a letter. This is immune
 * to fragmentation and it answers the question actually being asked.
 *
 * The warm-pixel ink test is the same one used for the previous sprint's ink counts, so the two
 * sets of numbers are comparable.
 *
 * A second, independent check runs alongside it: the rendered POINT SIZE of the POKER row. A serif
 * face has no stem left below roughly 5px. If the component count and the point size disagree
 * about where the boundary is, that disagreement is a finding and gets reported rather than
 * resolved by preference.
 *
 * Usage: xvfb-run -a node docs/f-icon/threshold.mjs
 */

import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';

const HERE = path.resolve(new URL('.', import.meta.url).pathname);
const MASTER = path.join(HERE, 'built/icon-1024.png');
const TMP = path.join(HERE, 'stamps/_sweep');
fs.mkdirSync(TMP, { recursive: true });

const build = JSON.parse(fs.readFileSync(path.join(HERE, 'f-icon-build.json'), 'utf8'));
const bands = JSON.parse(fs.readFileSync(path.join(HERE, 'f-layer-contrast.json'), 'utf8')).bands;
const POKER_BAND = bands[2];
const SUITS_BAND = bands[0];

const browser = await chromium.launch({ executablePath: process.env.CAPS_BROWSER_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const b64 = fs.readFileSync(MASTER).toString('base64');

async function downscale(S) {
  const f = path.join(TMP, `s-${S}.png`);
  if (fs.existsSync(f)) return f;
  const html = `<!doctype html><meta charset="utf-8"><style>*{margin:0;padding:0}
    html,body{width:${S}px;height:${S}px;overflow:hidden}
    img{width:${S}px;height:${S}px;display:block}</style><img src="data:image/png;base64,${b64}">`;
  const ctx = await browser.newContext({ viewport: { width: S, height: S }, deviceScaleFactor: 1 });
  const p = await ctx.newPage();
  await p.setContent(html, { waitUntil: 'load' });
  await p.waitForTimeout(60);
  await p.screenshot({ path: f });
  await ctx.close();
  return f;
}

/** Warm pixels — red clearly above blue — are gold ink. Same test as the previous sprint's. */
const isInk = (d, o) => d[o] > d[o + 2] + 28 && d[o] > 90;

/** Connected ink regions inside a horizontal band, 8-neighbour so a diagonal serif stays whole. */
function regions(file, band) {
  const img = PNG.sync.read(fs.readFileSync(file));
  const { width: W, height: H } = img;
  const y0 = Math.max(0, Math.floor(band[0] * H)), y1 = Math.min(H, Math.ceil(band[1] * H));
  const bw = W, bh = y1 - y0;
  if (bh < 1) return { count: 0, sizes: [], ink: 0 };
  const ink = new Uint8Array(bw * bh);
  let total = 0;
  for (let y = y0; y < y1; y++) for (let x = 0; x < W; x++) {
    if (isInk(img.data, (y * W + x) << 2)) { ink[(y - y0) * bw + x] = 1; total++; }
  }
  const seen = new Uint8Array(bw * bh);
  const sizes = [];
  for (let i = 0; i < bw * bh; i++) {
    if (!ink[i] || seen[i]) continue;
    let n = 0; const st = [i]; seen[i] = 1;
    while (st.length) {
      const j = st.pop(); n++;
      const x = j % bw, y = (j / bw) | 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= bw || ny >= bh) continue;
        const k = ny * bw + nx;
        if (ink[k] && !seen[k]) { seen[k] = 1; st.push(k); }
      }
    }
    sizes.push(n);
  }
  sizes.sort((a, b) => b - a);
  return { count: sizes.length, sizes, ink: total };
}

/**
 * FIVE LETTER CELLS. POKER's ink extent is found first (its own left and right edge in this
 * tile, not an assumed one — Iron Rule #3), then split into five equal columns, and the ink in
 * each is counted. `text-indent` shifts the row right by one letterspace, so measuring the real
 * extent rather than centring on the tile matters.
 */
function letterCells(file, band, n) {
  const img = PNG.sync.read(fs.readFileSync(file));
  const { width: W, height: H } = img;
  const y0 = Math.max(0, Math.floor(band[0] * H)), y1 = Math.min(H, Math.ceil(band[1] * H));
  let lo = W, hi = -1;
  const cols = new Int32Array(W);
  for (let y = y0; y < y1; y++) for (let x = 0; x < W; x++) {
    if (isInk(img.data, (y * W + x) << 2)) { cols[x]++; if (x < lo) lo = x; if (x > hi) hi = x; }
  }
  if (hi < lo) return { cells: new Array(n).fill(0), extent: 0 };
  const wdt = hi - lo + 1;
  const cells = new Array(n).fill(0);
  for (let x = lo; x <= hi; x++) {
    const c = Math.min(n - 1, Math.floor(((x - lo) / wdt) * n));
    cells[c] += cols[x];
  }
  return { cells, extent: wdt };
}

const CAPS_AT_1024 = build.sizes['1024'].fontPx;
const rows = [];
for (let S = 40; S <= 200; S++) {
  const f = await downscale(S);
  const pk = regions(f, POKER_BAND);
  const su = regions(f, SUITS_BAND);
  const pkc = letterCells(f, POKER_BAND, 5);
  const suc = letterCells(f, SUITS_BAND, 4);
  const capsPx = (CAPS_AT_1024 * S) / 1024;
  rows.push({
    size: S,
    pokerPx: +(capsPx * 0.20).toFixed(2), suitsPx: +(capsPx * 0.22).toFixed(2),
    pokerRegions: pk.count, pokerInk: pk.ink,
    pokerCells: pkc.cells, pokerWeakestCell: Math.min(...pkc.cells),
    suitsRegions: su.count, suitsInk: su.ink,
    suitCells: suc.cells, suitsWeakestCell: Math.min(...suc.cells),
  });
}
await browser.close();

/**
 * THE RULE: all five of POKER's letter cells hold at least MIN_CELL ink pixels. Two is the floor
 * that separates a letter from a speck. The threshold is the smallest size at which that holds
 * AND KEEPS HOLDING at every larger size — a lone size that happens to resolve while its
 * neighbours do not is resampling luck, not a boundary.
 */
const MIN_CELL = 2;
const ok = (r) => r.pokerWeakestCell >= MIN_CELL;
let threshold = null;
for (let i = 0; i < rows.length; i++) {
  if (rows.slice(i).every(ok)) { threshold = rows[i].size; break; }
}
const firstOk = rows.find(ok);

console.log('\nPOKER, swept 40 → 200 on the downscaled master (the shipping path)\n');
console.log('size  POKER px  ink px   P  O  K  E  R  (ink per letter cell)   |  suits px  per-suit ink');
for (const r of rows) {
  if (r.size % 4 !== 0 && Math.abs(r.size - (threshold ?? -99)) > 2) continue;
  console.log(`${String(r.size).padStart(4)}  ${String(r.pokerPx).padStart(8)}  ${String(r.pokerInk).padStart(6)}   ` +
    r.pokerCells.map((c) => String(c).padStart(2)).join(' ') + '                        |  ' +
    `${String(r.suitsPx).padStart(8)}  ` + r.suitCells.map((c) => String(c).padStart(3)).join(' ') +
    (r.size === threshold ? '   <-- THRESHOLD' : ''));
}
console.log(`\nFIRST size where all five letter cells hold >=${MIN_CELL}px: ${firstOk ? firstOk.size : 'none'}`);
console.log(`THRESHOLD (holds there and at every larger size): ${threshold ?? 'NONE FOUND IN RANGE'}`);
if (threshold) {
  const t = rows.find((r) => r.size === threshold);
  console.log(`At the threshold POKER renders at ${t.pokerPx}px and the suits at ${t.suitsPx}px.`);
  console.log(`Below ${threshold} the full lockup is not used; the compact lockup (suits + CAPS) is.`);
}
const sw = rows.find((r) => r.size === 60);
console.log(`\nTHE SUITS, which Roye chose to KEEP: at 60 they are ${sw.suitsInk} ink px across four glyphs ` +
  `(${sw.suitCells.join('/')}), rendering at ${sw.suitsPx}px each.`);

fs.writeFileSync(path.join(HERE, 'f-threshold.json'), JSON.stringify({
  ts: new Date().toISOString(),
  rule: `all five of POKER's letter cells hold >=${MIN_CELL} ink px, and that holds at every larger size`,
  rejectedRule: 'connected-component count — a serif FRAGMENTS at these sizes (12 regions at 180, 4 at 96), so the count is noise in both directions',
  threshold, firstResolving: firstOk ? firstOk.size : null,
  pokerPxAtThreshold: threshold ? rows.find((r) => r.size === threshold).pokerPx : null,
  rows,
}, null, 2));
console.log('\nfacts -> docs/f-icon/f-threshold.json');
