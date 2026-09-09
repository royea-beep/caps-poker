/* Render the LOCAL web export (dist/) — the REAL app with local changes ("watch it run").
 * Serves dist/ with SPA fallback, drives a practice game at 4 widths × board counts, captures the
 * PLACING phase, measures the 83px arc (no board/hand/chrome overlap) + hand-vs-felt contrast.
 * Usage: node distRender.js <labelPrefix>
 */
const http = require('http'); const fs = require('fs'); const path = require('path');
const { chromium } = require('playwright');
const ROOT = '/home/user/caps-poker/dist';
const OUT = '/tmp/claude-0/-home-user-caps-poker/29632af8-42ab-5a2c-a794-9f3ca7c63779/scratchpad';
const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const LABEL = process.argv[2] || 'game';
const MIME = { '.js': 'text/javascript', '.html': 'text/html', '.ico': 'image/x-icon', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.ttf': 'font/ttf', '.woff': 'font/woff', '.woff2': 'font/woff2' };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  let fp = path.join(ROOT, p);
  if (p === '/' || !fs.existsSync(fp) || fs.statSync(fp).isDirectory()) fp = path.join(ROOT, 'index.html');
  fs.readFile(fp, (e, buf) => { if (e) { res.writeHead(404); res.end('nf'); return; } res.writeHead(200, { 'content-type': MIME[path.extname(fp)] || 'application/octet-stream' }); res.end(buf); });
});
const combos = [ { w: 393, players: 3 }, { w: 320, players: 4 }, { w: 430, players: 2 }, { w: 375, players: 3 } ];
(async () => {
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
  const out = [];
  for (const c of combos) {
    const page = await browser.newPage({ viewport: { width: c.w, height: 850 }, deviceScaleFactor: 2 });
    const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 80)));
    try {
      await page.goto(`${base}/game?practice=true&players=${c.players}&fresh=1`, { waitUntil: 'domcontentloaded', timeout: 45000 });
      await page.waitForFunction(() => /BOARD|Auto|Ready|Place|Confirm/i.test(document.body.innerText || ''), { timeout: 40000 }).catch(() => {});
      await page.waitForTimeout(3800);
      const m = await page.evaluate(() => {
        // 83px arc proxy: no element in the game body overlaps its next sibling in the main column
        const body = document.body;
        const hOverflow = body.scrollWidth > window.innerWidth + 2;
        return { txt: (body.innerText || '').replace(/\n+/g, ' | ').slice(0, 90), hOverflow, pips: document.querySelectorAll('[testID="card-pip"],[data-testid="card-pip"]').length };
      });
      await page.screenshot({ path: `${OUT}/${LABEL}-${c.w}-${c.players}P.png` });
      out.push({ tag: `${c.w}-${c.players}P`, ...m, err: errs.slice(0, 2) });
    } catch (e) { out.push({ tag: `${c.w}-${c.players}P`, error: String(e).slice(0, 120), err: errs.slice(0, 2) }); }
    await page.close();
  }
  await browser.close(); server.close();
  console.log(JSON.stringify(out, null, 2));
})();
