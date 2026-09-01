/* PREVIEW-THE-GAME — render the REAL built game screen (local export, real Card.tsx, real bundle)
 * for one state. Frames: 393-3P placing, 320-3P placing, 393-3P reveal.
 * Usage: node previewRender.js <state>   (state = before | shipped | all5)
 * Outputs to docs/game-preview/game-<state>-{393-placing,320-placing,393-reveal}.png */
const http = require('http'); const fs = require('fs'); const path = require('path');
const { chromium } = require('playwright');
const ROOT = '/home/user/caps-poker/dist';
const OUT = '/home/user/caps-poker/docs/game-preview';
const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const STATE = process.argv[2] || 'shipped';
const MIME = { '.js': 'text/javascript', '.html': 'text/html', '.ico': 'image/x-icon', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.ttf': 'font/ttf', '.woff': 'font/woff', '.woff2': 'font/woff2' };
const server = http.createServer((req, res) => { let p = decodeURIComponent(req.url.split('?')[0]); let fp = path.join(ROOT, p); if (p === '/' || !fs.existsSync(fp) || fs.statSync(fp).isDirectory()) fp = path.join(ROOT, 'index.html'); fs.readFile(fp, (e, b) => { if (e) { res.writeHead(404); res.end(); return; } res.writeHead(200, { 'content-type': MIME[path.extname(fp)] || 'application/octet-stream' }); res.end(b); }); });
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
  const log = { state: STATE };
  // placing frames
  for (const w of [393, 320]) {
    const pg = await browser.newPage({ viewport: { width: w, height: 850 }, deviceScaleFactor: 2 });
    await pg.goto(`${base}/game?practice=true&players=3&fresh=1`, { waitUntil: 'domcontentloaded' });
    await pg.waitForFunction(() => /BOARD|Auto/i.test(document.body.innerText || ''), { timeout: 40000 }).catch(() => {});
    await pg.waitForTimeout(3600);
    await pg.screenshot({ path: `${OUT}/game-${STATE}-${w}-placing.png` });
    log[`placing${w}`] = 'ok';
    await pg.close();
  }
  // reveal frame at 393-3P
  const page = await browser.newPage({ viewport: { width: 393, height: 850 }, deviceScaleFactor: 2 });
  try {
    await page.goto(`${base}/game?practice=true&players=3&fresh=1`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => /Auto-Place ALL/i.test(document.body.innerText || ''), { timeout: 40000 }).catch(() => {});
    await page.waitForTimeout(2500);
    await page.getByText('Auto-Place ALL', { exact: false }).first().click({ timeout: 8000 }).catch(() => {});
    await page.waitForTimeout(1500);
    await page.locator('[data-testid="ready-button"], [testID="ready-button"]').first().click({ timeout: 8000 }).catch(async () => { await page.getByText(/READY|Confirm/i).first().click({ timeout: 8000 }).catch(() => {}); });
    await page.waitForTimeout(6000);
    const g = await page.evaluate(() => { let gold = 0; document.querySelectorAll('*').forEach(el => { const cs = getComputedStyle(el); [cs.borderTopColor, cs.borderColor].forEach(c => { if ((c || '').replace(/\s/g, '') === 'rgb(255,215,0)') gold++; }); }); return { gold, results: /WIN|LOSE|TIE|ONE PAIR|KIND/i.test(document.body.innerText || '') }; });
    log.reveal = g;
    await page.screenshot({ path: `${OUT}/game-${STATE}-393-reveal.png`, fullPage: true });
  } catch (e) { log.revealErr = String(e).slice(0, 120); }
  await page.close();
  await browser.close(); server.close();
  console.log(JSON.stringify(log));
})();
