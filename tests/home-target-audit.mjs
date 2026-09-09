/**
 * THE 44pt FLOOR ON THE SHIPPED HOME SCREEN, AT 320.
 *
 * WHY THIS EXISTS. The thirty-directions harness reproduces the C2 control set by scaling every
 * size by `W / 393`, and at 320 that put two targets under 44pt on all thirty renders. Before
 * reporting that as a property of the harness, it is worth knowing whether it is a property of
 * the APP — because `utils/responsive.ts` ships `rb()`, "always at least 44pt (Apple Human
 * Interface Guidelines)", and `grep` finds it used in FOUR places app-wide and NOT ONCE on the
 * home screen. So the shipped home screen scales its targets linearly, with no floor.
 *
 * That is a plausible claim, and a claim is not evidence. This measures the real export.
 *
 * Usage: xvfb-run -a node tests/home-target-audit.mjs <distDir>
 */

import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const DIST = path.resolve(process.argv[2] || '');
const PORT = 4610 + Math.floor(Math.random() * 200);
if (!fs.existsSync(path.join(DIST, 'index.html'))) throw new Error(`no export at ${DIST}`);

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.ttf': 'font/ttf', '.woff2': 'font/woff2' };
const server = http.createServer((req, res) => {
  const url = decodeURIComponent((req.url || '/').split('?')[0]);
  let file = path.join(DIST, url);
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(DIST, 'index.html');
  if (path.extname(file) === '.html') {
    const html = fs.readFileSync(file, 'utf8').replace(/<script(?![^>]*type=)/g, '<script type="module"');
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); res.end(html); return;
  }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});
await new Promise((r) => server.listen(PORT, r));

const browser = await chromium.launch({ headless: false, executablePath: process.env.CAPS_BROWSER_PATH });
const out = { dist: path.basename(DIST), ts: new Date().toISOString(), widths: {} };

for (const W of [393, 375, 320]) {
  const ctx = await browser.newContext({ viewport: { width: W, height: Math.round(W * 852 / 393) }, deviceScaleFactor: 1 });
  // Nothing may reach production or the database.
  await ctx.route('**/*', (r) => (/supabase\.co|ftable\.co\.il/i.test(r.request().url()) ? r.abort() : r.continue()));
  const p = await ctx.newPage();
  const seed = JSON.parse(fs.readFileSync(new URL('./caps-onboarded.json', import.meta.url), 'utf8'));
  const store = seed.origins[0].localStorage.find((e) => e.name === 'caps-poker-storage').value;
  await p.addInitScript((blob) => {
    try {
      localStorage.setItem('has_seen_interactive_tutorial', 'true');
      localStorage.setItem('caps_games_played', '25');
      localStorage.setItem('caps-poker-storage', blob);
    } catch (_) { /* unavailable */ }
  }, store);
  await p.goto(`http://localhost:${PORT}/`, { waitUntil: 'load', timeout: 120000 });
  await p.waitForTimeout(7000);

  out.widths[W] = await p.evaluate(() => {
    const seen = [];
    for (const el of document.querySelectorAll('[role="button"],button,[tabindex="0"]')) {
      const r = el.getBoundingClientRect();
      if (r.width < 1 || r.height < 1) continue;
      // A parent wrapper and its inner pressable both match; keep the smallest box per label so
      // the report is about the target a thumb actually gets, not the largest ancestor.
      const name = (el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 40);
      seen.push({ name, w: Math.round(r.width), h: Math.round(r.height) });
    }
    const best = new Map();
    for (const s of seen) {
      const k = s.name || `(unnamed@${s.w}x${s.h})`;
      const prev = best.get(k);
      if (!prev || s.w * s.h > prev.w * prev.h) best.set(k, s);  // the outermost pressable
    }
    const all = [...best.values()];
    return {
      controls: all.length,
      under44: all.filter((c) => c.w < 44 || c.h < 44),
      unnamed: all.filter((c) => !c.name).length,
    };
  });
  console.log(`${W}px  controls=${out.widths[W].controls}  under44=${out.widths[W].under44.length}  ` +
    `unnamed=${out.widths[W].unnamed}` +
    (out.widths[W].under44.length ? `\n     ${out.widths[W].under44.map((c) => `${c.name || '(unnamed)'} ${c.w}x${c.h}`).join('\n     ')}` : ''));
  await ctx.close();
}

await browser.close();
server.close();
fs.writeFileSync(new URL('./home-target-audit-result.json', import.meta.url), JSON.stringify(out, null, 2));
