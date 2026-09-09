/**
 * READ WHAT THE PLUGIN ACTUALLY EMITTED — from the pixels, not from the filenames.
 *
 * ⚠️ A FILE WITH A CORRECT NAME AND WRONG CONTENT IS THE EXACT SHAPE THAT COST THIS PROJECT THE
 * LANDING PAGE AND THE C ICON. So nothing here trusts a path. Every emitted PNG is opened and its
 * variant is DERIVED: the rows containing gold ink are found, and the number of separate ink rows
 * is the answer — the full lockup has THREE (suits, CAPS, POKER), the compact lockup has TWO. The
 * old C1 card icon has neither, which is the control: if the plugin had silently done nothing,
 * every one of these would still be a cream playing card, because assets/icon.png was deliberately
 * left as C1 for this run.
 *
 * Only after the variant is read from pixels is it compared against what the measured table says
 * that size should be. A disagreement is a failure, and it is printed rather than summarised.
 *
 * Usage: node tools/icon/verify-emitted.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { PNG } from 'pngjs';

const ROOT = path.resolve(new URL('../..', import.meta.url).pathname);
const facts = JSON.parse(fs.readFileSync(path.join(ROOT, 'docs/f-icon/f-icon-build.json'), 'utf8'));
const T = facts.threshold.px;
const expectedFor = (px) => facts.responsive[String(px)] ?? (px >= T ? 'full' : 'compact');

/**
 * Gold ink is warm — red clearly above blue. The felt is green-dominant, so this isolates the mark.
 *
 * ⚠️ IT DOES NOT WORK ON THE MONOCHROME LAYER AND THE FIRST RUN OF THIS FILE PROVED IT. Android's
 * monochrome asset is a WHITE silhouette on transparent, deliberately, so the system can tint it —
 * white has red equal to blue, no pixel is "warm", and all five monochrome files came back as
 * "0 ink bands" and were marked MISMATCH. The files were right; the instrument was wrong. Opening
 * mipmap-xxxhdpi/ic_launcher_monochrome.png directly showed exactly the two bright-opaque bands
 * the compact lockup should have. So monochrome is read with a brightness-and-alpha test instead,
 * and the warm test is kept for everything else rather than loosened for all of them — a test that
 * passes everything is not a test.
 */
const isInk = (d, o) => d[o] > d[o + 2] + 28 && d[o] > 90;
const isMono = (d, o) => d[o + 3] > 40 && d[o] > 150;

/**
 * The variant, read from the image. Counts the horizontal bands that contain gold ink and are
 * thick enough not to be a stray antialiased row. Also reports whether the tile looks like a
 * playing card at all — a large light rectangle — so the C1 control is recognisable rather than
 * merely "not full and not compact".
 */
function readVariant(file, mono = false) {
  const img = PNG.sync.read(fs.readFileSync(file));
  const { width: W, height: H } = img;
  let inkTotal = 0, lightTotal = 0;
  const rows = [];
  for (let y = 0; y < H; y++) {
    let n = 0;
    for (let x = 0; x < W; x++) {
      const o = (y * W + x) << 2;
      if (img.data[o + 3] === 0) continue;
      if (mono ? isMono(img.data, o) : isInk(img.data, o)) { n++; inkTotal++; }
      if (img.data[o] > 220 && img.data[o + 1] > 215 && img.data[o + 2] > 200) lightTotal++;
    }
    rows.push(n > Math.max(1, W * 0.004));
  }
  const bands = [];
  let s = -1;
  for (let y = 0; y < H; y++) {
    if (rows[y] && s < 0) s = y;
    if ((!rows[y] || y === H - 1) && s >= 0) { if (y - s >= 1) bands.push([s, y]); s = -1; }
  }
  const lightShare = lightTotal / (W * H);
  let variant;
  if (!mono && lightShare > 0.15) variant = 'CARD (C1 — the plugin did nothing)';
  else if (bands.length >= 3) variant = 'full';
  else if (bands.length === 2) variant = 'compact';
  else variant = `unrecognised (${bands.length} ink bands)`;
  return { variant, bands: bands.length, inkTotal, lightShare: +(lightShare * 100).toFixed(1), W, H };
}

function ffd700(file) {
  const img = PNG.sync.read(fs.readFileSync(file));
  let n = 0;
  for (let i = 0; i < img.data.length; i += 4) {
    if (img.data[i] === 0xff && img.data[i + 1] === 0xd7 && img.data[i + 2] === 0x00 && img.data[i + 3] > 0) n++;
  }
  return n;
}
const sha = (f) => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex').slice(0, 12);

// ── the iOS catalogue ────────────────────────────────────────────────────────────────────────
const setDir = path.join(ROOT, 'ios/CapsPoker/Images.xcassets/AppIcon.appiconset');
const contents = JSON.parse(fs.readFileSync(path.join(setDir, 'Contents.json'), 'utf8'));
console.log(`\niOS AppIcon.appiconset — ${contents.images.length} slots, read from pixels\n`);
console.log('slot                 file                        px      READ FROM PIXELS   expected   bands  sha');
let fails = 0, gold = 0;
for (const im of contents.images) {
  const f = path.join(setDir, im.filename);
  const r = readVariant(f);
  const px = r.W;
  const exp = expectedFor(px);
  const ok = r.variant === exp;
  if (!ok) fails++;
  gold += ffd700(f);
  console.log(`${(im.idiom + ' ' + im.size + ' @' + im.scale).padEnd(20)} ${im.filename.padEnd(27)} ` +
    `${String(px).padStart(4)}    ${r.variant.padEnd(18)} ${exp.padEnd(10)} ${String(r.bands).padStart(5)}  ${sha(f)}` +
    (ok ? '' : '   <-- MISMATCH'));
}

// ── the Android mipmaps ──────────────────────────────────────────────────────────────────────
const res = path.join(ROOT, 'android/app/src/main/res');
console.log(`\nAndroid mipmaps — read from pixels\n`);
console.log('bucket      asset                        px      READ FROM PIXELS   expected   sha');
for (const dpi of ['mdpi', 'hdpi', 'xhdpi', 'xxhdpi', 'xxxhdpi']) {
  const dir = path.join(res, `mipmap-${dpi}`);
  if (!fs.existsSync(dir)) { console.log(`  mipmap-${dpi} MISSING`); fails++; continue; }
  for (const name of fs.readdirSync(dir).filter((f) => f.endsWith('.png')).sort()) {
    const f = path.join(dir, name);
    const isMonoFile = name.includes('monochrome');
    const r = readVariant(f, isMonoFile);
    gold += ffd700(f);
    // the launcher squares carry a variant; the adaptive layers are compact by measurement
    const exp = name.startsWith('ic_launcher.') || name.startsWith('ic_launcher_round')
      ? expectedFor(r.W) : 'compact';
    const isBg = name.includes('background');
    const ok = isBg ? true : r.variant === exp;
    if (!ok) fails++;
    console.log(`mipmap-${dpi.padEnd(8)} ${name.padEnd(28)} ${String(r.W).padStart(4)}    ` +
      `${(isBg ? 'felt ground (no mark)' : r.variant + (isMonoFile ? ' (white)' : '')).padEnd(20)} ${exp.padEnd(10)} ${sha(f)}` +
      (ok ? '' : '   <-- MISMATCH'));
  }
}

console.log(`\n#FFD700 across every emitted file: ${gold}`);
console.log(`variant mismatches: ${fails}`);
console.log(fails === 0 && gold === 0
  ? '\nPASS — every emitted icon carries the variant the measured table calls for, read from its pixels.'
  : '\nFAIL — see the marked rows above.');
process.exit(fails === 0 && gold === 0 ? 0 : 1);
