/**
 * ICON LEGIBILITY AT 60px — four measurements, and an explicit line where they stop.
 *
 * The panel says C1 survives the square better than I1. That is a claim with measurable parts
 * and an unmeasurable part, and this separates them.
 *
 * WHAT IS MEASURED, on the real 60px render:
 *   subjectArea   fraction of pixels that are not the background tone. A subject that fills more
 *                 of the square is bigger on a home screen, and bigger survives.
 *   contrast      WCAG ratio between the subject's median luminance and the ground's. Small
 *                 sizes destroy low-contrast shapes first.
 *   regions       connected components of subject pixels covering >=1% of the square. FEWER,
 *                 LARGER regions read at 60px; many small ones turn to mush.
 *   crispness     mean Sobel gradient magnitude, normalised. A soft or dithered edge at 60px is
 *                 an edge the eye has to work for.
 *
 * WHAT IS NOT MEASURED, and must not be inferred from these numbers: whether the shape is
 * RECOGNISABLE as its subject. A white rectangle scores identically to a playing card. Four good
 * numbers cannot tell you that C1's rank glyphs have vanished and left a blank card. That part is
 * a judgement made by looking, and the report says so rather than dressing it as arithmetic.
 *
 * Usage: node tools/thirty-directions/icon-legibility.mjs C1 I1 J2 K3
 */

import fs from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';

const OUT = path.resolve(process.argv[1], '../../../docs/thirty-directions');
const IDS = process.argv.slice(2);
if (!IDS.length) throw new Error('give at least one direction id');

const lum = (r, g, b) => {
  const f = (v) => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};
const ratio = (a, b) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
const median = (a) => a.slice().sort((x, y) => x - y)[Math.floor(a.length / 2)];

const rows = [];
for (const id of IDS) {
  const file = path.join(OUT, `_icon-${id}-60.png`);
  if (!fs.existsSync(file)) { console.log(`skip ${id} — no _icon-${id}-60.png (run icons.mjs first)`); continue; }
  const img = PNG.sync.read(fs.readFileSync(file));
  const { width: W, height: H } = img;
  const L = new Float64Array(W * H);
  for (let i = 0; i < W * H; i++) {
    const o = i << 2;
    L[i] = lum(img.data[o], img.data[o + 1], img.data[o + 2]);
  }

  /**
   * GROUND = what the tile's corners are. Subject = anything far enough from it to read as a
   * different thing.
   *
   * ⚠️ THIS HEURISTIC HAS A KNOWN FAILURE AND IT IS GUARDED RATHER THAN HIDDEN. A design with a
   * strong INSET VIGNETTE has dark corners and a bright middle, so the corners are not the
   * ground — they are the vignette. J2 came back at 96.7% "subject" on the first run, i.e. the
   * whole cream field counted as subject against its own darkened edge. That number is not a
   * finding about J2, it is the instrument mis-reading a vignette.
   *
   * So the corner ground is compared against the median of the full border ring, and any tile
   * whose subject area is implausible (>85% or <3%) is flagged UNRELIABLE instead of scored.
   */
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

  // Connected components (4-neighbour) over subject pixels.
  const seen = new Uint8Array(W * H);
  const sizes = [];
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

  // Sobel magnitude, mean over the whole tile.
  let g = 0;
  for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
    const at = (dx, dy) => L[(y + dy) * W + (x + dx)];
    const gx = -at(-1, -1) - 2 * at(-1, 0) - at(-1, 1) + at(1, -1) + 2 * at(1, 0) + at(1, 1);
    const gy = -at(-1, -1) - 2 * at(0, -1) - at(1, -1) + at(-1, 1) + 2 * at(0, 1) + at(1, 1);
    g += Math.hypot(gx, gy);
  }
  const crispness = g / ((W - 2) * (H - 2));

  const unreliable = subjectArea > 0.85 || subjectArea < 0.03 || ratio(ground, ringGround) > 1.6;
  rows.push({ id, subjectArea: +(subjectArea * 100).toFixed(1), contrast: +contrast.toFixed(2),
    bigRegions, crispness: +crispness.toFixed(3),
    ground: +ground.toFixed(3), ringGround: +ringGround.toFixed(3),
    unreliable: unreliable || undefined,
    why: unreliable ? 'ground mis-identified (vignette or near-uniform tile) — NOT a finding' : undefined });
}

console.log('\n60px legibility — measured on the real 60px render\n');
console.log('id   subject%   contrast   regions>=1%   crispness   ground');
for (const r of rows) {
  console.log(`${r.id.padEnd(4)} ${String(r.subjectArea).padStart(7)}   ${String(r.contrast).padStart(8)}   ` +
    `${String(r.bigRegions).padStart(11)}   ${String(r.crispness).padStart(9)}   ${String(r.ground).padStart(6)}` +
    (r.unreliable ? `   ⚠️ UNRELIABLE — ${r.why}` : ''));
}
console.log('\nThese four numbers say how BIG, how SEPARATED and how CRISP the shape is at 60px.');
console.log('They do NOT say whether it is recognisable as its subject — a blank white rectangle');
console.log('scores the same as a playing card. That part is decided by looking.\n');
fs.writeFileSync(path.join(OUT, 'icon-legibility.json'), JSON.stringify({ ts: new Date().toISOString(), rows }, null, 2));
