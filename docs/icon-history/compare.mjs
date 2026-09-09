/**
 * THE ICON THAT WAS NEVER ENTERED — a side-by-side of every icon CAPS has ever shipped.
 *
 * Roye remembers a nicer icon with the letter C. He is right that it existed and right that
 * nobody decided to replace it. The thirty-directions sprint tested seven candidates (C1, I1,
 * J2, K3, K7, K6, K5 — see docs/thirty-directions/icon-legibility.json) and every one of them
 * was drawn from scratch. The icon the product ALREADY HAD was never a row in that table. So
 * this is not a re-litigation of a choice; it is the comparison that was skipped.
 *
 * WHY THE STAMPS ARE MADE IN CHROMIUM AND NOT IN A RESIZE LIBRARY: the published C1 numbers in
 * docs/thirty-directions/icon-legibility.json were measured on chromium-rendered 60px tiles by
 * tools/icon/approval-sheet.mjs. A different resampler produces different edges and therefore a
 * different crispness figure, and a number that cannot be compared to the number it is meant to
 * be compared with is worse than no number. Same renderer, same sizes, same maths.
 *
 * THE MEASUREMENT MATHS BELOW IS COPIED VERBATIM from tools/thirty-directions/icon-legibility.mjs
 * — deliberately, not lazily. Its own header says what it does not measure, and that caveat
 * carries over unchanged: these numbers say how BIG, how SEPARATED and how CRISP a shape is.
 * They do not say whether it is RECOGNISABLE. A blank rectangle scores like a playing card.
 * That part is decided by looking, which is why the pictures are the deliverable and the numbers
 * sit beside them rather than on top of them.
 *
 * Usage: xvfb-run -a node docs/icon-history/compare.mjs
 */

import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';

const HERE = path.resolve(new URL('.', import.meta.url).pathname);
const ROOT = path.resolve(HERE, '../..');
const OUT = path.join(HERE, 'stamps');
fs.mkdirSync(OUT, { recursive: true });

const b64 = (p) => fs.readFileSync(p).toString('base64');

/**
 * Every icon that has ever been app.json's `icon`, oldest first. `shipped` is the window during
 * which that blob was the icon on main, derived from the commit dates of the icon-touching
 * commits — 91f0f6a, 20c853d, adee655, 582e93c, 64cef22, fe1b60c.
 */
const ICONS = [
  { id: 'EXPO',    file: '00-expo-placeholder-2026-03-11-91f0f6a.png', commit: '91f0f6a', date: '2026-03-11',
    shipped: '11 Mar, hours',  depicts: 'Expo template chevron on pale blue, construction guides visible' },
  { id: 'FLAT',    file: '01-flat-green-2026-03-11-20c853d.png',       commit: '20c853d', date: '2026-03-11',
    shipped: '11 Mar, hours',  depicts: 'flat dark green square, no mark at all (declared a placeholder in its own commit)' },
  { id: 'CP',      file: '02-CP-2026-03-11-adee655.png',               commit: 'adee655', date: '2026-03-11',
    shipped: '11–12 Mar, 1 day', depicts: 'gold "CP" on dark green, small gold spade in the lower-right corner — rounded, with TRANSPARENT corners' },
  { id: 'C-GREEN', file: '03-C-GREEN-2026-03-12-582e93c.png',          commit: '582e93c', date: '2026-03-12',
    shipped: '12–18 Mar, 6 days', depicts: 'ivory letter C on a poker-green gradient, gold double ring, four suit pips at the corners' },
  { id: 'C-BLACK', file: '04-C-BLACK-2026-03-18-64cef22.png',          commit: '64cef22', date: '2026-03-18',
    shipped: '18 Mar – 30 Aug, 165 days', depicts: 'gold letter C on near-black, thin gold ring, four suit pips (gold club, red heart, red diamond, gold spade)' },
  { id: 'C1',      file: '05-C1-CARD-2026-08-30-fe1b60c.png',          commit: 'fe1b60c', date: '2026-08-30',
    shipped: '30 Aug – today', depicts: 'cream playing card, gold border, navy spade, near-black ground — THE CURRENT ICON' },
];

const SIZES = [1024, 240, 120, 60];

// ── stamping ────────────────────────────────────────────────────────────────────────────────
const browser = await chromium.launch({ headless: false, executablePath: process.env.CAPS_BROWSER_PATH });

/**
 * ⚠️ EVERY SOURCE IS FLATTENED ONTO BLACK BEFORE IT IS STAMPED, AND THAT IS NOT COSMETIC.
 * iOS does not allow a transparent app icon; it composites one onto black. Two of these six
 * assets are not opaque, and both were lying about their own colour until this step existed:
 *   CP (adee655)      — fully transparent corners, alpha 0 at (0,0). Left on chromium's default
 *                       white, the instrument read CP's own dark-green field as "subject" against
 *                       a white ground and returned 99.7% subject share. That was a fact about
 *                       the backdrop, not about CP.
 *   C-GREEN (582e93c) — 7.9% of its pixels are translucent, and the translucent ones are THE GOLD:
 *                       the ring and the fill of the C are (255,221,102) at alpha 100 with NOTHING
 *                       PAINTED BEHIND THEM. On white that flattens to bright gold, which is what
 *                       the designer saw. On black it flattens to (100,87,40), a muddy brown, and
 *                       black is what the phone does. See the C-GREEN callout on the sheet.
 * Flattening once, here, means the square row and the circle row show the SAME colours and only
 * the corner clipping differs between them. The four fully-opaque icons are untouched by this.
 */
const FLAT_DIR = path.join(OUT, '_flat');
fs.mkdirSync(FLAT_DIR, { recursive: true });
async function flattenOnBlack(srcAbs, outAbs) {
  const html = `<!doctype html><meta charset="utf-8"><style>
    *{margin:0;padding:0}html,body{width:1024px;height:1024px;overflow:hidden;background:#000}
    img{width:1024px;height:1024px;display:block}
  </style><img src="data:image/png;base64,${b64(srcAbs)}">`;
  const ctx = await browser.newContext({ viewport: { width: 1024, height: 1024 }, deviceScaleFactor: 1 });
  const p = await ctx.newPage();
  await p.setContent(html, { waitUntil: 'load' });
  await p.waitForTimeout(120);
  await p.screenshot({ path: outAbs });
  await ctx.close();
}
/** The same tile on WHITE — used only for the C-GREEN callout, to show intent beside reality. */
async function flattenOnWhite(srcAbs, outAbs) {
  const html = `<!doctype html><meta charset="utf-8"><style>
    *{margin:0;padding:0}html,body{width:1024px;height:1024px;overflow:hidden;background:#fff}
    img{width:1024px;height:1024px;display:block}
  </style><img src="data:image/png;base64,${b64(srcAbs)}">`;
  const ctx = await browser.newContext({ viewport: { width: 1024, height: 1024 }, deviceScaleFactor: 1 });
  const p = await ctx.newPage();
  await p.setContent(html, { waitUntil: 'load' });
  await p.waitForTimeout(120);
  await p.screenshot({ path: outAbs });
  await ctx.close();
}

async function stamp(srcAbs, outAbs, S, circle) {
  const html = `<!doctype html><meta charset="utf-8"><style>
    *{margin:0;padding:0}html,body{width:${S}px;height:${S}px;overflow:hidden;background:transparent}
    img{width:${S}px;height:${S}px;display:block;${circle ? 'border-radius:50%;' : ''}}
  </style><img src="data:image/png;base64,${b64(srcAbs)}">`;
  const ctx = await browser.newContext({ viewport: { width: S, height: S }, deviceScaleFactor: 1 });
  const p = await ctx.newPage();
  await p.setContent(html, { waitUntil: 'load' });
  await p.waitForTimeout(120);
  await p.screenshot({ path: outAbs, omitBackground: true });
  await ctx.close();
}

for (const ic of ICONS) {
  const src = path.join(FLAT_DIR, `${ic.id}.png`);
  await flattenOnBlack(path.join(HERE, ic.file), src);
  for (const S of SIZES) {
    await stamp(src, path.join(OUT, `${ic.id}-${S}.png`), S, false);
    await stamp(src, path.join(OUT, `${ic.id}-${S}-circle.png`), S, true);
  }
}

// ── the measuring instrument, verbatim from tools/thirty-directions/icon-legibility.mjs ──────
const lum = (r, g, b) => {
  const f = (v) => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};
const ratio = (a, b) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
const median = (a) => a.slice().sort((x, y) => x - y)[Math.floor(a.length / 2)];

function measure(file) {
  const img = PNG.sync.read(fs.readFileSync(file));
  const { width: W, height: H } = img;
  const L = new Float64Array(W * H);
  for (let i = 0; i < W * H; i++) { const o = i << 2; L[i] = lum(img.data[o], img.data[o + 1], img.data[o + 2]); }
  const corners = [0, W - 1, (H - 1) * W, H * W - 1].map((i) => L[i]);
  const ground = median(corners);
  const ring = [];
  for (let x = 0; x < W; x++) { ring.push(L[x]); ring.push(L[(H - 1) * W + x]); }
  for (let y = 0; y < H; y++) { ring.push(L[y * W]); ring.push(L[y * W + W - 1]); }
  const ringGround = median(ring);
  const isSubject = (i) => ratio(L[i], ground) >= 1.6;
  const subj = [];
  for (let i = 0; i < W * H; i++) if (isSubject(i)) subj.push(i);
  const subjectArea = subj.length / (W * H);
  const contrast = subj.length ? ratio(median(subj.map((i) => L[i])), ground) : 1;
  const seen = new Uint8Array(W * H); const sizes = [];
  for (const start of subj) {
    if (seen[start]) continue;
    let n = 0; const stack = [start]; seen[start] = 1;
    while (stack.length) {
      const i = stack.pop(); n++;
      const x = i % W, y = (i / W) | 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        const j = ny * W + nx;
        if (!seen[j] && isSubject(j)) { seen[j] = 1; stack.push(j); }
      }
    }
    sizes.push(n);
  }
  const bigRegions = sizes.filter((n) => n / (W * H) >= 0.01).length;
  let g = 0;
  for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
    const at = (dx, dy) => L[(y + dy) * W + (x + dx)];
    const gx = -at(-1, -1) - 2 * at(-1, 0) - at(-1, 1) + at(1, -1) + 2 * at(1, 0) + at(1, 1);
    const gy = -at(-1, -1) - 2 * at(0, -1) - at(1, -1) + at(-1, 1) + 2 * at(0, 1) + at(1, 1);
    g += Math.hypot(gx, gy);
  }
  const crispness = g / ((W - 2) * (H - 2));
  const unreliable = subjectArea > 0.85 || subjectArea < 0.03 || ratio(ground, ringGround) > 1.6;
  return { subjectArea: +(subjectArea * 100).toFixed(1), contrast: +contrast.toFixed(2), bigRegions,
    crispness: +crispness.toFixed(3), ground: +ground.toFixed(3), ringGround: +ringGround.toFixed(3),
    unreliable: unreliable || undefined,
    why: unreliable ? 'ground mis-identified (vignette or near-uniform tile) — NOT a finding' : undefined };
}

/**
 * WHAT THE CIRCLE COSTS. iOS 26 clips to a squircle and Android to a circle; a mark that runs to
 * the corners loses those corners. This counts the subject pixels that fall OUTSIDE the inscribed
 * circle of the 1024 stamp, as a fraction of all subject pixels. It is the corner-suit question
 * asked with a number: C-BLACK and C-GREEN both park pips near the corners.
 */
function circleClip(file) {
  const img = PNG.sync.read(fs.readFileSync(file));
  const { width: W, height: H } = img;
  const L = new Float64Array(W * H);
  for (let i = 0; i < W * H; i++) { const o = i << 2; L[i] = lum(img.data[o], img.data[o + 1], img.data[o + 2]); }
  const ground = median([0, W - 1, (H - 1) * W, H * W - 1].map((i) => L[i]));
  const cx = (W - 1) / 2, cy = (H - 1) / 2, r = Math.min(W, H) / 2;
  let subj = 0, outside = 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x;
    if (ratio(L[i], ground) < 1.6) continue;
    subj++;
    if (Math.hypot(x - cx, y - cy) > r) outside++;
  }
  return { subjectPx: subj, outsideCircle: outside, lostPct: subj ? +((outside / subj) * 100).toFixed(2) : 0 };
}

await flattenOnWhite(path.join(HERE, '03-C-GREEN-2026-03-12-582e93c.png'), path.join(FLAT_DIR, 'C-GREEN-on-white.png'));

const rows = [];
for (const ic of ICONS) {
  const at60 = measure(path.join(OUT, `${ic.id}-60.png`));
  const at1024 = measure(path.join(OUT, `${ic.id}-1024.png`));
  const clip = circleClip(path.join(OUT, `${ic.id}-1024.png`));
  rows.push({ ...ic, at60, at1024, clip, regionsLost: at1024.bigRegions - at60.bigRegions });
}
fs.writeFileSync(path.join(HERE, 'icon-compare.json'),
  JSON.stringify({ ts: new Date().toISOString(), method: 'chromium stamps, maths verbatim from tools/thirty-directions/icon-legibility.mjs', rows }, null, 2));

console.log('\n60px legibility — measured on the real 60px chromium stamp\n');
console.log('id        subject%   contrast   regions>=1%   crispness   corners lost to circle');
for (const r of rows) {
  console.log(`${r.id.padEnd(9)} ${String(r.at60.subjectArea).padStart(7)}   ${String(r.at60.contrast).padStart(8)}   ` +
    `${String(r.at60.bigRegions).padStart(11)}   ${String(r.at60.crispness).padStart(9)}   ${String(r.clip.lostPct).padStart(6)}%` +
    (r.at60.unreliable ? `   ⚠️ UNRELIABLE — ${r.at60.why}` : ''));
}

// ── the sheet ────────────────────────────────────────────────────────────────────────────────
/**
 * The instrument flags a tile UNRELIABLE when its subject share is implausible. Two tiles trip it
 * and the reasons are different, so the generic message is replaced with the specific one.
 */
const NOTE = {
  FLAT: 'subject share is 0% because there is genuinely NO MARK on this tile — a flat green square. The flag is correct and so is the zero; this one is not a mis-read.',
  CP:  'subject share 99% — the instrument takes the corners as the ground, and after flattening on black CP\'s transparent corners ARE black while its whole green field is not. A fact about the asset\'s rounded transparent corners, not a legibility score. Judge CP by looking.',
};

const fig = (r) => {
  const sq = SIZES.map((S) => `<div class="st"><img src="data:image/png;base64,${b64(path.join(OUT, `${r.id}-${S}.png`))}" style="width:${Math.min(S, 200)}px;height:${Math.min(S, 200)}px"><em>${S}</em></div>`).join('');
  const ci = SIZES.map((S) => `<div class="st"><img src="data:image/png;base64,${b64(path.join(OUT, `${r.id}-${S}-circle.png`))}" style="width:${Math.min(S, 200)}px;height:${Math.min(S, 200)}px"><em>${S}</em></div>`).join('');
  const cur = r.id === 'C1';
  return `<section class="${cur ? 'cur' : ''}">
    <h2>${r.id}${cur ? ' <span class="tag">CURRENT</span>' : ''}${/^C-/.test(r.id) ? ' <span class="tag c">HAS THE LETTER C</span>' : ''}</h2>
    <p class="meta">${r.commit} · ${r.date} · icon for ${r.shipped}<br><b>${r.depicts}</b></p>
    <div class="cols">
      <div class="pics">
        <div class="strip">${sq}</div>
        <div class="lab">masked to a circle — iOS 26 clips to a squircle, Android to a circle</div>
        <div class="strip circle">${ci}</div>
      </div>
      <table class="nums">
        <tr><th colspan="2">at 60px — the home screen</th></tr>
        <tr><td>subject share</td><td>${r.at60.subjectArea}%</td></tr>
        <tr><td>contrast (WCAG)</td><td>${r.at60.contrast}:1</td></tr>
        <tr><td>regions ≥1%</td><td>${r.at60.bigRegions}</td></tr>
        <tr><td>crispness</td><td>${r.at60.crispness}</td></tr>
        <tr><th colspan="2">detail loss 1024 → 60</th></tr>
        <tr><td>regions ≥1% at 1024</td><td>${r.at1024.bigRegions}</td></tr>
        <tr><td>regions lost</td><td class="${r.regionsLost > 0 ? 'bad' : 'ok'}">${r.regionsLost}</td></tr>
        <tr><th colspan="2">the circle</th></tr>
        <tr><td>mark outside it</td><td class="${r.clip.lostPct > 1 ? 'bad' : 'ok'}">${r.clip.lostPct}%</td></tr>
        ${r.at60.unreliable ? `<tr><td colspan="2" class="bad">⚠️ ${NOTE[r.id] || r.at60.why}</td></tr>` : ''}
      </table>
    </div>
    ${r.id === 'C-GREEN' ? `<div class="callout">
      <div>
        <h3>⚠️ C-GREEN's gold has nothing behind it</h3>
        <p>The ring and the fill of the C are <code>rgb(255,221,102)</code> at <b>alpha 100</b> — 39% opaque — with
        no opaque layer painted underneath. 7.9% of the tile is translucent and it is all the gold.
        On white that flattens to the bright gold on the left, which is what the 2026-03-12 generator
        showed its author. iOS composites an icon onto <b>black</b>, which gives the right-hand tile:
        <code>rgb(100,87,40)</code>, a muddy brown. <b>The right-hand one is what a phone shows.</b>
        This is a defect in the asset, not in the design — the shape is fine and a repaint would fix it
        in an afternoon. It is stated here so the picture is not mistaken for a rendering bug.</p>
      </div>
      <div class="pair">
        <div class="st"><img src="data:image/png;base64,${b64(path.join(FLAT_DIR, 'C-GREEN-on-white.png'))}" style="width:150px;height:150px"><em>on white — intent</em></div>
        <div class="st"><img src="data:image/png;base64,${b64(path.join(FLAT_DIR, 'C-GREEN.png'))}" style="width:150px;height:150px"><em>on black — what iOS shows</em></div>
      </div>
    </div>` : ''}
  </section>`;
};

const html = `<!doctype html><meta charset="utf-8"><style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{width:1600px;background:#f2f2f0;font:14px/1.5 -apple-system,'DejaVu Sans',sans-serif;color:#15130f;padding:34px}
  h1{font-size:30px;letter-spacing:-.4px}
  .lede{max-width:1100px;margin:12px 0 26px;font-size:15px;color:#3a352d}
  .lede b{color:#15130f}
  section{background:#fff;border:1px solid #d8d5cd;border-radius:10px;padding:20px;margin-bottom:18px}
  section.cur{border-color:#c9a84c;box-shadow:0 0 0 2px #f0e3bd inset}
  h2{font-size:20px}
  .tag{font-size:11px;letter-spacing:1px;background:#15130f;color:#fff;padding:3px 8px;border-radius:4px;vertical-align:3px}
  .tag.c{background:#0b5e2e}
  .meta{color:#5b554a;font-size:13px;margin:6px 0 14px}
  .cols{display:flex;gap:26px;align-items:flex-start}
  .pics{flex:1}
  .strip{display:flex;gap:18px;align-items:flex-end;background:#e9e7e1;padding:14px;border-radius:8px}
  .strip.circle{background:#cfcdc6}
  .st{text-align:center}
  .st img{display:block;border:1px solid rgba(0,0,0,.18)}
  .strip.circle .st img{border:none}
  .st em{display:block;font-style:normal;font-size:11px;color:#5b554a;margin-top:5px}
  .lab{font-size:12px;color:#5b554a;margin:12px 0 6px}
  .nums{width:280px;border-collapse:collapse;font-size:13px}
  .nums th{text-align:left;background:#15130f;color:#fff;padding:6px 9px;font-size:11px;letter-spacing:.6px}
  .nums td{padding:6px 9px;border-bottom:1px solid #e6e3dc}
  .nums td:last-child{text-align:right;font-variant-numeric:tabular-nums;font-weight:700}
  .ok{color:#0b5e2e}.bad{color:#a11}
  .foot{max-width:1100px;font-size:13px;color:#3a352d;margin-top:8px}
  .verdict{border-color:#15130f;border-width:2px}
  .verdict p{max-width:1200px;margin-bottom:10px;font-size:14px}
  .verdict h2{margin-bottom:12px}
  .verdict .corr{background:#f4f1e8;border-left:3px solid #c9a84c;padding:10px 12px;margin-top:14px}
  .callout{display:flex;gap:22px;align-items:center;margin-top:16px;background:#fdf6e6;
           border:1px solid #e0cf9a;border-radius:8px;padding:16px}
  .callout h3{font-size:15px;margin-bottom:6px}
  .callout p{font-size:13px;color:#3a352d;max-width:760px}
  .callout code{background:#efe6cd;padding:1px 4px;border-radius:3px;font-size:12px}
  .pair{display:flex;gap:14px}
  .pair .st img{border:1px solid rgba(0,0,0,.25)}
</style>
<h1>Every icon CAPS has ever shipped</h1>
<p class="lede">Roye remembers a nicer icon with the letter <b>C</b>. It exists, and there are two of them.
<b>C-BLACK was the app's icon for 165 days</b> — longer than every other icon in this list put together.
It was replaced on 30 August by C1. <b>Nobody compared them.</b> The thirty-directions sprint measured
seven candidates (C1, I1, J2, K3, K7, K6, K5, in <code>docs/thirty-directions/icon-legibility.json</code>)
and all seven were drawn from scratch. The incumbent was never a row in that table, so this was an
omission, not a decision.<br><br>
The numbers sit beside the pictures, not above them. They are measured on the real chromium stamp with
the maths copied verbatim from the thirty-directions instrument, so C1's figures here are comparable to
the ones it was chosen on. They say how big, how separated and how crisp a shape is. They do not say
whether it is recognisable — that part is decided by looking, and it is Roye's to decide.</p>
${rows.map(fig).join('')}
<section class="verdict">
  <h2>The opinion you asked for — and it is only an opinion</h2>
  <p><b>C-BLACK is the better mark. C1 is the better 60px tile. Those are two different questions and the
  numbers only answer the second one.</b></p>
  <p><b>Why C-BLACK.</b> It says the product's name. A gold <b>C</b> for CAPS is a mark; a playing card is
  the stock photo of every card game on the store, and at 60px C1 is a white rectangle with a dot on it.
  C-BLACK is also the only icon in this list whose colour already belongs to the app — the splash wordmark
  is a gilded serif on green, and a gold C is one step from it, while C1's cream card and navy spade are
  the FIVE-O palette the product moved away from. <code>CLAUDE.md</code> already records the icon as the last
  thing in the first second still standing on the old black-and-navy ground. And it was the icon for
  <b>165 days</b>, which is longer than every other icon here put together, and the person who looked at it
  every one of those days asked for it back.</p>
  <p><b>Where C1 genuinely wins, and it is not close.</b> At 60px C1 measures 18.96:1 contrast against
  C-BLACK's 4.25:1, fills 41.4% of the tile against 13.8%, and is three times crisper (0.47 vs 0.156).
  C-BLACK also loses a region between 1024 and 60: <b>the four corner suit pips dissolve</b> — look at its
  60px tile, they are gone. On a bright home screen a thin gold C on black is a dark smudge and a cream
  card is not.</p>
  <p><b>So the honest answer is that neither is finished.</b> Every one of C-BLACK's numbers is a
  consequence of one decision — the C is small in a big empty frame with four ornaments that do not
  survive. Draw the C at roughly the share of the tile C1's card occupies, drop the corner pips, and put
  the gold at the app's own <code>#c9a84c</code> weight, and it beats C1 on contrast, on size and on crispness
  while keeping the thing C1 never had, which is the name. <b>That is a repaint, not a restore, and this
  sprint deliberately did not do it</b> — the brief said show it as it was, and a redraw would have been
  me deciding again. If Roye wants it, it is an afternoon.</p>
  <p class="corr"><b>One correction to the record while it is open.</b>
  <code>docs/thirty-directions/icon-legibility.json</code> records C1 at subject share <b>48.8%</b> and crispness
  <b>0.557</b>. The icon that actually shipped measures <b>41.4%</b> and <b>0.470</b> — same renderer, same
  maths, and this sheet's number is byte-identical to <code>docs/d1-home/_icon-CAPS-60.png</code>, which the
  approval tool itself made from <code>assets/icon.png</code>. So that row was measured on the concept
  direction, not on the built asset. Contrast is essentially unchanged (18.73 vs 18.96), so it changes no
  conclusion — but the file says it was measured on the shipped icon and it was not.</p>
</section>
<p class="foot">Sizes are 1024 (App Store), 240, 120 and 60 (the home screen — the size that promoted C1 in the
first place). The circle row is the same stamp with a 50% radius, which is what iOS 26 and Android
actually do to it.</p>`;

const ctx = await browser.newContext({ viewport: { width: 1600, height: 1200 }, deviceScaleFactor: 1 });
const page = await ctx.newPage();
await page.setContent(html, { waitUntil: 'load' });
await page.waitForTimeout(400);
await page.screenshot({ path: path.join(HERE, 'ICON-COMPARISON.png'), fullPage: true });
await ctx.close();

// ── the first second: icon → splash → home, one row per icon ────────────────────────────────
const SPLASH = path.join(ROOT, 'docs/splash-proof/splash-393x852.png');
const HOME = path.join(ROOT, 'docs/product-map/shots/en/home.png');
const firstSecond = `<!doctype html><meta charset="utf-8"><style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{width:1240px;background:#f2f2f0;font:14px/1.5 -apple-system,'DejaVu Sans',sans-serif;color:#15130f;padding:30px}
  h1{font-size:26px}
  p.l{max-width:1000px;margin:10px 0 22px;color:#3a352d}
  .row{display:flex;gap:20px;align-items:center;background:#fff;border:1px solid #d8d5cd;
       border-radius:10px;padding:18px;margin-bottom:16px}
  .row.cur{border-color:#c9a84c;box-shadow:0 0 0 2px #f0e3bd inset}
  .who{width:150px}
  .who b{font-size:16px;display:block}
  .who span{font-size:12px;color:#5b554a}
  .step{text-align:center}
  .step img{display:block;border:1px solid rgba(0,0,0,.2);border-radius:4px}
  .step em{display:block;font-style:normal;font-size:11px;color:#5b554a;margin-top:5px}
  .arrow{font-size:24px;color:#8a857a}
  .tap{width:120px;height:120px;background:#111;border-radius:26px;padding:12px;display:flex;
       align-items:center;justify-content:center}
  .tap img{width:96px;height:96px;border-radius:21px;border:none}
</style>
<h1>The first second — icon → splash → home</h1>
<p class="l">The splash and the home screen are the CURRENT ones and are identical in every row; only the
icon changes. That is the whole point of the strip: the splash is green felt with a gilded serif wordmark,
so the question is which icon hands off into it without a jolt.</p>
${rows.filter((r) => ['CP', 'C-GREEN', 'C-BLACK', 'C1'].includes(r.id)).map((r) => `<div class="row ${r.id === 'C1' ? 'cur' : ''}">
  <div class="who"><b>${r.id}</b><span>${r.commit} · ${r.date}</span></div>
  <div class="step"><div class="tap"><img src="data:image/png;base64,${b64(path.join(OUT, `${r.id}-240.png`))}"></div><em>on the home screen</em></div>
  <div class="arrow">→</div>
  <div class="step"><img src="data:image/png;base64,${b64(SPLASH)}" style="width:150px"><em>splash</em></div>
  <div class="arrow">→</div>
  <div class="step"><img src="data:image/png;base64,${b64(HOME)}" style="width:150px"><em>home</em></div>
</div>`).join('')}`;

const ctx2 = await browser.newContext({ viewport: { width: 1240, height: 1200 }, deviceScaleFactor: 1 });
const p2 = await ctx2.newPage();
await p2.setContent(firstSecond, { waitUntil: 'load' });
await p2.waitForTimeout(400);
await p2.screenshot({ path: path.join(HERE, 'FIRST-SECOND.png'), fullPage: true });
await ctx2.close();

await browser.close();
console.log('\nsheet  -> docs/icon-history/ICON-COMPARISON.png');
console.log('strip  -> docs/icon-history/FIRST-SECOND.png');
console.log('facts  -> docs/icon-history/icon-compare.json\n');
