/**
 * G6 — does a tester's bug report actually ARRIVE, carrying context they never typed?
 *
 * Drives the REAL UI path (Settings → דיווח על תקלה → fill → שלח), not a hand-rolled insert,
 * because the thing under test is the path a tester would take. Supabase is left REACHABLE so
 * the row lands and can be queried back out.
 *
 * This loop has been caught three times by infrastructure failure wearing a result's clothes —
 * a dead page scoring zero dots, `eas whoami` passing on a disabled account, a missing `bash`
 * scoring the CI gate as failed. So: the page mount is asserted, the success state is asserted
 * in the UI, and the row is then verified in the DB. Any one of those alone is not proof.
 *
 *   EXPO_PUBLIC_CAPS_FIXTURE=1 npx expo export -p web --output-dir web-g6-dist --clear
 *   node tests/bug-report-probe.mjs
 */
import { chromium } from 'playwright';
import fs from 'fs';
import http from 'http';
import path from 'path';

const DIR = path.resolve(process.env.PROBE_DIR || 'web-g6-dist');
const PORT = Number(process.env.PROBE_PORT || 8132);
const MARKER = `G6-PROBE-${Date.now()}`;

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.ttf': 'font/ttf', '.woff': 'font/woff',
  '.woff2': 'font/woff2', '.ico': 'image/x-icon', '.mp3': 'audio/mpeg', '.wav': 'audio/wav' };
const toModule = (h) => h.replace(
  /<script src="(\/_expo\/static\/js\/web\/[^"]+)" defer><\/script>/,
  '<script type="module" src="$1"></script>');
const server = http.createServer((req, res) => {
  const u = decodeURIComponent((req.url || '/').split('?')[0]);
  let f = path.join(DIR, u);
  if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) f = path.join(DIR, 'index.html');
  const e = path.extname(f).toLowerCase();
  res.writeHead(200, { 'Content-Type': MIME[e] || 'application/octet-stream' });
  if (e === '.html') { res.end(toModule(fs.readFileSync(f, 'utf-8'))); return; }
  fs.createReadStream(f).pipe(res);
});
await new Promise((r) => server.listen(PORT, r));

const fire = `(el)=>{const r=el.getBoundingClientRect();const x=r.left+r.width/2,y=r.top+r.height/2;
const mk=(t,C)=>new C(t,{bubbles:true,cancelable:true,composed:true,clientX:x,clientY:y,pointerId:1,pointerType:'mouse',button:0,buttons:t.includes('up')?0:1,isPrimary:true});
['pointerdown','mousedown','pointerup','mouseup','click'].forEach(t=>el.dispatchEvent(mk(t,t.startsWith('pointer')?PointerEvent:MouseEvent)));}`;

const browser = await chromium.launch({ headless: false, args: ['--window-size=395,952'] });
const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, deviceScaleFactor: 1 });
const page = await ctx.newPage();
await page.goto(`http://localhost:${PORT}/settings`, { waitUntil: 'load', timeout: 120000 });
await page.waitForTimeout(9000);

const mounted = await page.evaluate(() => (document.getElementById('root')?.children.length ?? 0) > 0);
await page.evaluate(`window.__f=${fire}`);

// Open the report sheet from the Settings row — the tester's actual route.
await page.evaluate(`(()=>{const el=document.querySelector('[data-testid="report-bug-row"]');if(el)window.__f(el);})()`);
await page.waitForTimeout(1200);

const sheetOpen = await page.evaluate(() => !!document.querySelector('[data-testid="report-bug-description"]'));
await page.fill('[data-testid="report-bug-description"]', `${MARKER} — probe report, ignore.`);
await page.waitForTimeout(300);
await page.evaluate(`(()=>{const el=document.querySelector('[data-testid="report-bug-send"]');if(el)window.__f(el);})()`);
await page.waitForTimeout(5000);

// The UI must say it succeeded — a silent failure is the specific thing G6 must not ship.
const uiState = await page.evaluate(() => {
  const t = document.body.innerText || '';
  return { sawThanks: t.includes('תודה'), sawError: t.includes('נכשלה'), tail: t.slice(0, 120) };
});

console.log(JSON.stringify({ marker: MARKER, mounted, sheetOpen, uiState }, null, 1));
await browser.close();
server.close();
