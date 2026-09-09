/**
 * HOW SOFT IS THE UPSCALE — a number, not an adjective.
 *
 * The videos are captured at 486x864 (CSS pixels, because Playwright video ignores
 * deviceScaleFactor) and scaled 2.222x to 1080x1920. SCREENSHOTS, unlike video, DO honour
 * deviceScaleFactor — so a native 1080x1920 raster of the same screen is obtainable, and the two
 * can be compared directly.
 *
 * THE SCENE IS `felt`, DELIBERATELY: it is a static table with no animation, so a screenshot and a
 * video frame show the same thing and any difference is resolution rather than timing.
 *
 * THE MEASURE. The first version of this used mean gradient magnitude (Sobel acutance) and
 * reported 120% RETAINED — the upscale supposedly SHARPER than the native raster. That is not a
 * surprising result, it is a broken metric: lanczos ringing puts overshoot on every edge and H.264
 * puts blocking on every flat area, and a gradient sum counts both as detail. A number that says
 * an upscale beat its own source is a number to throw away, not to report.
 *
 * What is measured instead is DETAIL ABOVE THE CAPTURE'S NYQUIST. The take is 486 wide and is
 * scaled 2.222x, so the shipped frame CANNOT contain real structure finer than 2.222 output
 * pixels. Downsampling an image by that factor and re-upsampling it therefore destroys nothing
 * that the upscale ever had, and the residual (I - upsample(downsample(I))) isolates exactly the
 * detail a true 1080 raster has and the upscale does not.
 *
 *   retained = rms(residual of shipped) / rms(residual of native)
 *
 * Ringing and blocking still land in the shipped residual, and they inflate it. So the figure is
 * an UPPER BOUND: the real detail retained is AT MOST this, and the loss is AT LEAST 100 minus it.
 *
 * The board area only — the caption band is excluded, because ffmpeg draws it at the full 1080 and
 * it is pixel-identical in both, which would flatter the upscale.
 *
 *   node tools/measure-sharpness.mjs
 *   SKIP_CAPTURE=1 node tools/measure-sharpness.mjs   # re-analyse the PNGs already in OUT_DIR
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { serve, launch, openGame, VIEWPORT, TARGET } from './content-lib.mjs';

const DIST = process.env.DIST || 'web-slot-dist';
const PORT = Number(process.env.PORT || 8995);
const OUT = path.resolve(process.env.OUT_DIR || '/tmp/sharpness');
const CONTENT = path.resolve(process.env.CONTENT_DIR || '../caps-content');
fs.mkdirSync(OUT, { recursive: true });

// ── 1. a NATIVE 1080x1920 raster, via a screenshot at the matching device scale ──────────────
const native = path.join(OUT, 'native-1080.png');
const shipped = path.join(OUT, 'shipped-1080.png');
if (!process.env.SKIP_CAPTURE) {
const server = await serve(DIST, PORT);
const browser = await launch();
const scale = TARGET.width / VIEWPORT.width;      // 1080 / 486 = 2.2222…
const ctx = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: scale });
await ctx.route('**/*', (r) => (/supabase\.co|ftable\.co\.il/i.test(r.request().url()) ? r.abort() : r.continue()));
const { page } = await (async () => {
  await ctx.close();
  // reuse the rig's own opener so the seeding, the pinned deal and the practice guard all apply
  return openGame(browser, { port: PORT, players: 2, seed: 3, settle: 7000 });
})();
// openGame builds its own context at deviceScaleFactor 1, so take the native shot from a second
// context that differs ONLY in device scale.
const ctx2 = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: scale });
await ctx2.route('**/*', (r) => (/supabase\.co|ftable\.co\.il/i.test(r.request().url()) ? r.abort() : r.continue()));
const p2 = await ctx2.newPage();
await p2.addInitScript((seed) => {
  let a = seed >>> 0;
  Math.random = () => { a = (a + 0x6D2B79F5) >>> 0; let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}, 3);
await p2.addInitScript((blob) => {
  try {
    localStorage.setItem('has_seen_interactive_tutorial', 'true');
    localStorage.setItem('caps_games_played', '25');
    localStorage.setItem('caps-poker-storage', blob);
  } catch (_) { /* unavailable */ }
}, JSON.stringify((() => {
  const j = JSON.parse(fs.readFileSync('tests/caps-onboarded.json', 'utf8'));
  const st = JSON.parse(j.origins[0].localStorage.find((e) => e.name === 'caps-poker-storage').value);
  st.state.visualTheme = 'classic';
  return st;
})()));
await p2.goto(`http://localhost:${PORT}/game?practice=true&players=2&fresh=1`, { waitUntil: 'load', timeout: 120000 });
await p2.waitForTimeout(7000);
await p2.screenshot({ path: native });
await ctx2.close();
await browser.close(); server.close();
}

// ── 2. the same screen as it ships: the upscaled video frame ────────────────────────────────
if (!process.env.SKIP_CAPTURE) execFileSync('ffmpeg', ['-v', 'error', '-ss', '4', '-i', path.join(CONTENT, 'out', 'play-felt.mp4'),
  '-frames:v', '1', shipped, '-y']);

// ── 3. detail above the capture's Nyquist, board area only ─────────────────────────────────
const PY = `
import sys, json
from PIL import Image
SCALE = 1080.0/486.0          # the exact upscale the cut applies

def hf_rms(f, box):
    im = Image.open(f).convert("L").crop(box)
    w, h = im.size
    # destroy everything finer than the capture could carry, then put it back the same way
    small = im.resize((max(1,int(w/SCALE)), max(1,int(h/SCALE))), Image.LANCZOS)
    back  = small.resize((w, h), Image.LANCZOS)
    a, b = im.load(), back.load()
    tot = 0.0
    for y in range(h):
        for x in range(w):
            d = a[x,y] - b[x,y]
            tot += d*d
    return (tot/(w*h)) ** 0.5

a, b = sys.argv[1], sys.argv[2]
W, H = Image.open(a).size
box = (0, int(H*0.12), W, int(H*0.60))     # the boards; caption band excluded
na, sa = hf_rms(a, box), hf_rms(b, box)
print(json.dumps({"size":[W,H], "box":list(box), "scale": round(SCALE,4),
                  "nativeHfRms": round(na,4), "shippedHfRms": round(sa,4),
                  "retained": round(100*sa/na, 1)}))
`;
const r = JSON.parse(execFileSync('python3', ['-c', PY, native, shipped], { encoding: 'utf8' }));
console.log(`\n  native screenshot   ${native}   ${r.size[0]}x${r.size[1]}`);
console.log(`  shipped video frame ${shipped}`);
console.log(`\n  RMS of detail finer than the capture could carry (board area, caption excluded):`);
console.log(`    native  (true 1080 raster)  ${r.nativeHfRms}`);
console.log(`    shipped (486 -> 1080)       ${r.shippedHfRms}`);
console.log(`\n  FINE DETAIL RETAINED: at most ${r.retained}%  — the upscale loses AT LEAST ` +
  `${(100 - r.retained).toFixed(1)}%`);
console.log(`  (an upper bound: lanczos ringing and H.264 blocking both land in the shipped residual)\n`);
fs.writeFileSync(path.join(OUT, 'sharpness.json'), JSON.stringify(r, null, 2));
