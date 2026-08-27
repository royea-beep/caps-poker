/**
 * WATCH IT RUN — the shipped felt, in the real app, measured off the real render.
 *
 * The three-felt comparison was a synthetic panel: my own markup, the product's colours. That was
 * the right instrument for choosing between surfaces and the wrong one for verifying a shipped
 * change, because it does not contain BoardSurface — and BoardSurface LIFTS the token toward white
 * (0.10 top / 0.055 bottom at full intensity) before painting it. A token verified only in the
 * panel would be verified against something the app never draws.
 *
 * So this serves a real production export and photographs /game, then reads the felt, the card
 * face and the cue borders out of those pixels.
 *
 *   npx expo export -p web --output-dir web-green-dist
 *   node tests/felt-verify.mjs
 *
 * Supabase is unreachable from the browser in this container, so the capture is PRACTICE mode,
 * which is dealt client-side. That is a real limitation and the report says so rather than
 * implying a networked run.
 */
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const DIR = path.resolve(process.env.DIST || 'web-green-dist');
const OUT = path.resolve(process.env.OUT_DIR || 'felt-verify');
const PORT = Number(process.env.PORT || 8795);
fs.mkdirSync(OUT, { recursive: true });

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.ttf': 'font/ttf', '.woff2': 'font/woff2' };

const server = http.createServer((req, res) => {
  const url = decodeURIComponent((req.url || '/').split('?')[0]);
  let file = path.join(DIR, url);
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    const asHtml = path.join(DIR, url.replace(/\/$/, '') + '.html');
    file = fs.existsSync(asHtml) ? asHtml : path.join(DIR, 'index.html');
  }
  // The bundle contains `import.meta`; production serves it as type="module" and the local export
  // does not. Normalised here for the same reason as the parity probe — measuring a bundle nobody
  // ships is not a measurement.
  if (path.extname(file) === '.html') {
    const html = fs.readFileSync(file, 'utf8').replace(/<script(?![^>]*type=)/g, '<script type="module"');
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(html);
    return;
  }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});
await new Promise((r) => server.listen(PORT, r));

const browser = await chromium.launch({
  headless: true,
  ...(process.env.CAPS_BROWSER_PATH ? { executablePath: process.env.CAPS_BROWSER_PATH } : {}),
});

const results = [];
// Board count is DYNAMIC (2P=4, 3P=3, 4P=2) and is never assumed here — each width is walked at
// every seat count, so a surface that only works at one board count cannot pass unnoticed.
for (const W of [393, 320]) {
  for (const players of [2, 3, 4]) {
    const ctx = await browser.newContext({ viewport: { width: W, height: 852 }, deviceScaleFactor: 2 });
    await ctx.route('**/*', (r) => (/supabase\.co|ftable\.co\.il/i.test(r.request().url()) ? r.abort() : r.continue()));
    const page = await ctx.newPage();
    const errs = [];
    page.on('pageerror', (e) => errs.push(String(e).slice(0, 140)));
    await page.goto(`http://localhost:${PORT}/game?practice=true&players=${players}&fresh=1`,
      { waitUntil: 'load', timeout: 120000 });
    await page.waitForTimeout(4500);

    // Rule 14a — prove the page is painting before believing anything read off it.
    const painted = await page.evaluate(async () => {
      const s = performance.now(); let raf = 0;
      await new Promise((r) => { const l = () => { raf++; performance.now() - s < 900 ? requestAnimationFrame(l) : r(); };
        requestAnimationFrame(l); setTimeout(r, 1400); });
      return { hidden: document.hidden, raf };
    });

    // THE SURFACE, FOUND BY ITS OWN testID rather than by coordinates — BoardSurface sets
    // testID="board-surface", so this asks the component where it is instead of guessing.
    const geom = await page.evaluate(() => {
      const el = document.querySelector('[data-testid="board-surface"]');
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height),
               pageW: document.documentElement.clientWidth };
    });

    const file = path.join(OUT, `game-${W}-${players}p.png`);
    await page.screenshot({ path: file });
    results.push({ W, players, painted, geom, errs, file });
    console.log(`  ${W}px ${players}P  surface=${geom ? `${geom.w}x${geom.h} @${geom.x},${geom.y}` : 'NOT FOUND'}` +
      `  inset=${geom ? geom.x : '?'}  raf=${painted.raf}  errs=${errs.length}`);
    await ctx.close();
  }
}
await browser.close();
server.close();
fs.writeFileSync(path.join(OUT, 'geometry.json'), JSON.stringify(results.map(({ file, ...r }) => r), null, 2));
console.log(`\nwrote ${OUT}`);
