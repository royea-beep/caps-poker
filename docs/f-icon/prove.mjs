/**
 * PROVING F AT THE SIZE THAT DECIDES.
 *
 * F is a THREE-LAYER icon — suits, CAPS, POKER — and a three-layer icon is exactly the kind that
 * dies at 60px. This does not assume it survives and it does not assume it fails. It stamps it,
 * measures it with the same instrument the seven candidates were measured with, magnifies it so
 * every pixel is visible, and says plainly which layers are still there.
 *
 * ⚠️ THE TILE THAT MATTERS IS THE DOWNSCALED ONE, NOT THE NATIVELY-RENDERED ONE, and the
 * difference is not academic. build-f-icon.mjs lays F out fresh at every size, so its 60px tile is
 * type SET at 60px. But iOS and Expo do not do that: they take the 1024 master and resample it
 * down. So the 60px tile a phone actually shows is a DOWNSCALE of the master, and a 3.6px serif
 * that was drawn crisply at 60 is not the same as one crushed out of 308px type. Both are measured
 * here and both are shown. If they disagree, the downscale is the truth.
 *
 * ⚠️ POINT SIZE IS THE WHOLE ARGUMENT. F's proportions put POKER at 0.20 of the CAPS size and the
 * suits at 0.22. Whatever CAPS is, those two layers are a fifth of it. This prints the real
 * rendered point size of each layer at each tile size, because "is it legible" has an arithmetic
 * floor underneath it that no amount of looking can argue with.
 *
 * Usage: xvfb-run -a node docs/f-icon/prove.mjs
 */

import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';

const HERE = path.resolve(new URL('.', import.meta.url).pathname);
const ROOT = path.resolve(HERE, '../..');
const BUILT = path.join(HERE, 'built');
const OUT = path.join(HERE, 'stamps');
fs.mkdirSync(OUT, { recursive: true });
const b64 = (p) => fs.readFileSync(p).toString('base64');
const build = JSON.parse(fs.readFileSync(path.join(HERE, 'f-icon-build.json'), 'utf8'));

const SIZES = [1024, 240, 120, 60];
const browser = await chromium.launch({ executablePath: process.env.CAPS_BROWSER_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });

/** Same stamping technique as docs/icon-history/compare.mjs, so the numbers stay comparable. */
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

const MASTER = path.join(BUILT, 'icon-1024.png');
for (const S of SIZES) {
  await stamp(MASTER, path.join(OUT, `F-${S}.png`), S, false);          // the shipping path: downscale
  await stamp(MASTER, path.join(OUT, `F-${S}-circle.png`), S, true);
  const native = path.join(BUILT, `icon-${S}.png`);
  if (fs.existsSync(native)) await stamp(native, path.join(OUT, `Fnative-${S}.png`), S, false);
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
  const ground = median([0, W - 1, (H - 1) * W, H * W - 1].map((i) => L[i]));
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
    crispness: +crispness.toFixed(3), unreliable: unreliable || undefined };
}

/**
 * THE POINT SIZE OF EACH LAYER, at each tile size. F's own proportions: POKER is 0.20 of CAPS and
 * the suits are 0.22. Below roughly 5px a serif face has no stem left to render — this is the
 * arithmetic under the judgement.
 */
const layerSizes = {};
for (const S of SIZES) {
  const caps = build.sizes[S] ? build.sizes[S].fontPx : (build.sizes[1024].fontPx * S) / 1024;
  layerSizes[S] = { caps: +caps.toFixed(2), poker: +(caps * 0.20).toFixed(2), suits: +(caps * 0.22).toFixed(2) };
}

const rows = SIZES.map((S) => ({
  size: S,
  shipped: measure(path.join(OUT, `F-${S}.png`)),
  native: fs.existsSync(path.join(OUT, `Fnative-${S}.png`)) ? measure(path.join(OUT, `Fnative-${S}.png`)) : null,
  layers: layerSizes[S],
}));

fs.writeFileSync(path.join(HERE, 'f-icon-legibility.json'), JSON.stringify({
  ts: new Date().toISOString(),
  method: 'chromium stamps of the 1024 master (the shipping path), maths verbatim from tools/thirty-directions/icon-legibility.mjs',
  rows,
}, null, 2));

console.log('\nF at each size — SHIPPED path (1024 master downscaled)\n');
console.log('size   subject%  contrast  regions  crisp    CAPS px  POKER px  suits px');
for (const r of rows) {
  console.log(`${String(r.size).padStart(4)}   ${String(r.shipped.subjectArea).padStart(7)}  ${String(r.shipped.contrast).padStart(7)}  ` +
    `${String(r.shipped.bigRegions).padStart(7)}  ${String(r.shipped.crispness).padStart(6)}   ` +
    `${String(r.layers.caps).padStart(6)}  ${String(r.layers.poker).padStart(8)}  ${String(r.layers.suits).padStart(7)}`);
}
console.log('\nsame sizes, NATIVELY LAID OUT (not what ships — best case)\n');
console.log('size   subject%  contrast  regions  crisp');
for (const r of rows) if (r.native) {
  console.log(`${String(r.size).padStart(4)}   ${String(r.native.subjectArea).padStart(7)}  ${String(r.native.contrast).padStart(7)}  ` +
    `${String(r.native.bigRegions).padStart(7)}  ${String(r.native.crispness).padStart(6)}`);
}

await browser.close();
console.log('\nfacts -> docs/f-icon/f-icon-legibility.json');
