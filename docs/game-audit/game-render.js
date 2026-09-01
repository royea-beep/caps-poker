/* MERGE-HOME-THEN-GAME-AUDIT — mirrored-bytes render of the LIVE game screen.
 * Serves the deployed bytes (index-758a1973 bundle, type=module) from localhost and drives the app
 * into a practice game at several widths and board counts, screenshotting the PLACING phase (where
 * felt / boards / empty slots / cards / chrome all show). This is the LIVE built game screen (the
 * merge didn't touch it) — real Chromium pixels of the shipped bytes, NOT a mockup, NOT a device.
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = '/tmp/claude-0/-home-user-caps-poker/29632af8-42ab-5a2c-a794-9f3ca7c63779/scratchpad/gmirror';
const OUT = '/tmp/claude-0/-home-user-caps-poker/29632af8-42ab-5a2c-a794-9f3ca7c63779/scratchpad';
const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const MIME = { '.js': 'text/javascript', '.html': 'text/html', '.ico': 'image/x-icon', '.css': 'text/css', '.json': 'application/json' };

const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  let fp = path.join(ROOT, p);
  if (p === '/' || !fs.existsSync(fp) || fs.statSync(fp).isDirectory()) fp = path.join(ROOT, 'index.html');
  const ext = path.extname(fp);
  fs.readFile(fp, (err, buf) => {
    if (err) { res.writeHead(404); res.end('nf'); return; }
    res.writeHead(200, { 'content-type': MIME[ext] || 'application/octet-stream' });
    res.end(buf);
  });
});

(async () => {
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const port = server.address().port;
  const base = `http://127.0.0.1:${port}`;
  const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
  const combos = [
    { w: 393, players: 3, tag: '393-3P' },
    { w: 320, players: 4, tag: '320-4P' },
    { w: 430, players: 2, tag: '430-2P' },
    { w: 375, players: 3, tag: '375-3P' },
  ];
  const results = [];
  for (const c of combos) {
    const page = await browser.newPage({ viewport: { width: c.w, height: 850 }, deviceScaleFactor: 2 });
    const errors = [];
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text().slice(0, 140)); });
    page.on('pageerror', e => errors.push('PAGEERR ' + String(e).slice(0, 140)));
    try {
      await page.goto(`${base}/game?practice=true&players=${c.players}&fresh=1`, { waitUntil: 'domcontentloaded', timeout: 45000 });
      // wait for the app to mount + deal — poll for board-surface or any card pip
      await page.waitForFunction(() => {
        const t = document.body.innerText || '';
        return document.querySelector('[data-testid="board-surface"], [testid="board-surface"]') ||
          /BOARD|Auto|Ready|Place/i.test(t);
      }, { timeout: 40000 }).catch(() => {});
      await page.waitForTimeout(3500);
      const info = await page.evaluate(() => ({
        text: (document.body.innerText || '').slice(0, 200).replace(/\n+/g, ' | '),
        pips: document.querySelectorAll('[testID="card-pip"],[data-testid="card-pip"]').length,
        h: document.body.scrollHeight,
      }));
      await page.screenshot({ path: `${OUT}/game-${c.tag}.png`, fullPage: false });
      results.push({ tag: c.tag, ...info, errors: errors.slice(0, 3) });
    } catch (e) {
      results.push({ tag: c.tag, error: String(e).slice(0, 160), errors: errors.slice(0, 3) });
    }
    await page.close();
  }
  await browser.close();
  server.close();
  console.log(JSON.stringify(results, null, 2));
})();
