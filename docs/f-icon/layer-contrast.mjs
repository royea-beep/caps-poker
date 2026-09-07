/**
 * PER-LAYER CONTRAST — because the thirty-directions instrument mis-reads THIS icon and saying so
 * is more useful than quoting its number.
 *
 * That instrument takes the GROUND to be the median of the four corner pixels and calls anything
 * 1.6x away from it "subject". It was built for icons on a FLAT ground. F's ground is a vertical
 * gradient whose bottom corners are #010805 (near black) and whose centre is lit by a radial
 * highlight, so the corner median is nowhere near the felt the type actually sits on, and the
 * "subject" set sweeps in half-lit antialiased edge pixels and the highlight itself. It returns
 * 1.90:1 for F. The direct WCAG figure for the ink and the felt it sits on — #c9a84c on #003115 —
 * is 6.34:1. Both are true statements about different things and neither is the answer on its own.
 *
 * ⚠️ I QUOTED THE 1.90 AS IF IT WERE THE PAIRING AND IT IS NOT. This file exists because of that.
 *
 * What is measured here instead, on the REAL shipped tile at each size: each of F's three layers
 * is isolated by its own horizontal band (found from the master, scaled), the INK is the brightest
 * decile inside the band and the GROUND is the darkest quartile of the same band's rows, so the
 * comparison is local, and the ratio is WCAG. Then the part that actually decides legibility:
 * INK COVERAGE — what fraction of the band is ink at all. A layer whose letters have dissolved
 * still has colour; what it loses is contiguous stroke.
 *
 * Usage: node docs/f-icon/layer-contrast.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';

const HERE = path.resolve(new URL('.', import.meta.url).pathname);
const STAMPS = path.join(HERE, 'stamps');

const lum = (r, g, b) => {
  const f = (v) => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};
const wcag = (a, b) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
const pct = (arr, q) => { const s = arr.slice().sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.max(0, Math.round(q * (s.length - 1))))]; };

/**
 * The three bands, as fractions of tile height. Read off the 1024 master by finding the rows that
 * contain ink and splitting them at the two largest gaps — the layout is measured, not declared.
 */
function findBands(file) {
  const img = PNG.sync.read(fs.readFileSync(file));
  const { width: W, height: H } = img;
  const rowInk = [];
  for (let y = 0; y < H; y++) {
    let n = 0;
    for (let x = 0; x < W; x++) {
      const o = (y * W + x) << 2;
      // gold ink is warm: red clearly above blue. The felt is green-dominant.
      if (img.data[o] > img.data[o + 2] + 28 && img.data[o] > 90) n++;
    }
    rowInk.push(n);
  }
  const on = rowInk.map((n) => n > W * 0.004);
  const runs = [];
  let s = -1;
  for (let y = 0; y < H; y++) {
    if (on[y] && s < 0) s = y;
    if ((!on[y] || y === H - 1) && s >= 0) { runs.push([s, y]); s = -1; }
  }
  runs.sort((a, b) => (b[1] - b[0]) - (a[1] - a[0]));
  const top3 = runs.slice(0, 3).sort((a, b) => a[0] - b[0]);
  return top3.map(([a, b]) => [a / H, b / H]);
}

function layer(file, band) {
  const img = PNG.sync.read(fs.readFileSync(file));
  const { width: W, height: H } = img;
  const y0 = Math.max(0, Math.floor(band[0] * H)), y1 = Math.min(H, Math.ceil(band[1] * H));
  if (y1 - y0 < 1) return null;
  const L = [], warm = [];
  for (let y = y0; y < y1; y++) for (let x = 0; x < W; x++) {
    const o = (y * W + x) << 2;
    const l = lum(img.data[o], img.data[o + 1], img.data[o + 2]);
    L.push(l);
    if (img.data[o] > img.data[o + 2] + 28 && img.data[o] > 90) warm.push(l);
  }
  if (!warm.length) return { contrast: 1, inkCoverage: 0, inkPx: 0, bandPx: L.length };
  const ink = pct(warm, 0.90);
  const ground = pct(L, 0.25);
  return { contrast: +wcag(ink, ground).toFixed(2),
    inkCoverage: +((warm.length / L.length) * 100).toFixed(2),
    inkPx: warm.length, bandPx: L.length };
}

const bands = findBands(path.join(STAMPS, 'F-1024.png'));
const NAMES = ['suits', 'CAPS', 'POKER'];
const out = { ts: new Date().toISOString(), bands, rows: {} };

console.log('\nPER-LAYER, on the SHIPPED tile (1024 master downscaled)\n');
console.log('size   layer   local contrast   ink coverage of its band   ink px');
for (const S of [1024, 240, 120, 60]) {
  const f = path.join(STAMPS, `F-${S}.png`);
  out.rows[S] = {};
  for (let i = 0; i < bands.length; i++) {
    const r = layer(f, bands[i]);
    out.rows[S][NAMES[i]] = r;
    console.log(`${String(S).padStart(4)}   ${NAMES[i].padEnd(6)}  ${String(r.contrast).padStart(11)}:1   ` +
      `${String(r.inkCoverage).padStart(20)}%   ${String(r.inkPx).padStart(7)}`);
  }
  console.log('');
}
fs.writeFileSync(path.join(HERE, 'f-layer-contrast.json'), JSON.stringify(out, null, 2));
console.log('facts -> docs/f-icon/f-layer-contrast.json');
