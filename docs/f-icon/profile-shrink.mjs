/**
 * HOW FAR CAN A PLATFORM SHRINK THESE BEFORE POKER GOES?
 *
 * Every profile asset came out FULL — POKER's weakest letter cell is 18 ink pixels even on the
 * 200px TikTok square, well clear of the floor. But a platform never shows a profile picture LARGER
 * than it was uploaded, and often much smaller, and I cannot verify any platform's actual CSS size
 * from here. Asserting one would be a claim, not evidence.
 *
 * So this measures the thing that IS verifiable: each shipped profile file is progressively
 * downscaled and POKER's five letter cells are counted at each step, giving the display size at
 * which that asset stops carrying the word. That is a number Roye can hold against whatever the
 * platforms actually do, and it is the honest form of the caveat.
 *
 * Usage: xvfb-run -a node docs/f-icon/profile-shrink.mjs
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';

const HERE = path.resolve(new URL('.', import.meta.url).pathname);
const SOCIAL = path.join(HERE, 'social');
const TMP = path.join(HERE, 'stamps/_shrink');
fs.mkdirSync(TMP, { recursive: true });
const social = JSON.parse(fs.readFileSync(path.join(HERE, 'f-social.json'), 'utf8'));

const browser = await chromium.launch({ executablePath: process.env.CAPS_BROWSER_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
async function down(src, S, out) {
  const b64 = fs.readFileSync(src).toString('base64');
  const html = `<!doctype html><meta charset="utf-8"><style>*{margin:0;padding:0}
    html,body{width:${S}px;height:${S}px;overflow:hidden}img{width:${S}px;height:${S}px;display:block}
  </style><img src="data:image/png;base64,${b64}">`;
  const ctx = await browser.newContext({ viewport: { width: S, height: S }, deviceScaleFactor: 1 });
  const p = await ctx.newPage();
  await p.setContent(html, { waitUntil: 'load' });
  await p.waitForTimeout(50);
  await p.screenshot({ path: out });
  await ctx.close();
}
const ink = (d, o) => d[o] > d[o + 2] + 28 && d[o] > 90;
function weakestPokerCell(file) {
  const img = PNG.sync.read(fs.readFileSync(file));
  const { width: W, height: H } = img;
  const on = [];
  for (let y = 0; y < H; y++) { let n = 0;
    for (let x = 0; x < W; x++) if (ink(img.data, (y * W + x) << 2)) n++;
    on.push(n > W * 0.004); }
  const runs = []; let st = -1;
  for (let y = 0; y < H; y++) { if (on[y] && st < 0) st = y;
    if ((!on[y] || y === H - 1) && st >= 0) { runs.push([st, y]); st = -1; } }
  if (runs.length < 3) return 0;
  const band = runs.sort((a, b) => (b[1] - b[0]) - (a[1] - a[0])).slice(0, 3).sort((a, b) => a[0] - b[0])[2];
  const cols = new Int32Array(W); let lo = W, hi = -1;
  for (let y = band[0]; y < band[1]; y++) for (let x = 0; x < W; x++) {
    const o = (y * W + x) << 2;
    if (ink(img.data, o)) { cols[x]++; if (x < lo) lo = x; if (x > hi) hi = x; } }
  if (hi < lo) return 0;
  const cells = new Array(5).fill(0); const wd = hi - lo + 1;
  for (let x = lo; x <= hi; x++) cells[Math.min(4, Math.floor(((x - lo) / wd) * 5))] += cols[x];
  return Math.min(...cells);
}

const out = {};
console.log('\nDISPLAY SIZE AT WHICH EACH PROFILE ASSET STOPS CARRYING POKER\n');
for (const file of Object.keys(social.profiles)) {
  const src = path.join(SOCIAL, file);
  const native = social.profiles[file].size;
  let breaks = null;
  const trail = [];
  for (let S = native; S >= 40; S -= 4) {
    const f = path.join(TMP, `${file}-${S}.png`);
    await down(src, S, f);
    const w = weakestPokerCell(f);
    trail.push({ display: S, weakestCell: w });
    if (w < 2) { breaks = S; break; }
  }
  const lastOk = trail.filter((t) => t.weakestCell >= 2).slice(-1)[0];
  out[file] = { native, holdsDownTo: lastOk ? lastOk.display : null, breaksAt: breaks, trail };
  console.log(`  ${file.padEnd(34)} uploaded ${String(native).padStart(4)}px  ` +
    `holds POKER down to ${String(lastOk ? lastOk.display : '—').padStart(4)}px display` +
    (breaks ? `, gone by ${breaks}px` : ', still holding at 40px'));
}
await browser.close();
fs.writeFileSync(path.join(HERE, 'f-profile-shrink.json'), JSON.stringify({ ts: new Date().toISOString(),
  note: 'each shipped profile file progressively downscaled; the display size at which POKER loses a letter',
  rows: out }, null, 2));
console.log('\nfacts -> docs/f-icon/f-profile-shrink.json');
