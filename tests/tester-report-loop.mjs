/**
 * TESTER-READINESS §1 — file a bug the way a tester would, and record exactly what the tester
 * SEES on submit.
 *
 * Not an insert. The section is about the PATH: find the entry, open the form, type, press Send,
 * look at the screen. A row landing in the table is only half the pipeline — a tester who gets no
 * confirmation assumes it failed and stops reporting.
 *
 * Replaces tests/live-bug-report-verify.mjs's stale success assertions ('תודה' / 'נכשלה'):
 * English is the default language since FULL-I18N, so a Hebrew-only check now reads a WORKING
 * confirmation as a failure. Both languages are asserted here.
 *
 * Serves a local export (the container browser cannot open caps.ftable.co.il — the agent proxy
 * resets the tunnel — while shell curl gets 200; the Supabase REST call from inside the page is
 * the same origin the live app uses, so the insert half is real).
 *
 *   npx expo export -p web --output-dir web-tr-dist --clear
 *   node tests/tester-report-loop.mjs
 */
import { chromium } from 'playwright';
import fs from 'fs';
import http from 'http';
import path from 'path';

const DIR = path.resolve(process.env.PROBE_DIR || 'web-tr-dist');
const PORT = Number(process.env.PROBE_PORT || 8188);
const EXE = process.env.CAPS_CHROMIUM || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const MARK = `TESTER-READINESS-UI-${Date.now()}`;

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.ttf': 'font/ttf',
  '.woff': 'font/woff', '.woff2': 'font/woff2', '.ico': 'image/x-icon', '.mp3': 'audio/mpeg', '.wav': 'audio/wav' };
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

// RN-Web swallows a plain .click() on Pressable; dispatch the full pointer sequence.
const fire = `(el)=>{const r=el.getBoundingClientRect();const x=r.left+r.width/2,y=r.top+r.height/2;
const mk=(t,C)=>new C(t,{bubbles:true,cancelable:true,composed:true,clientX:x,clientY:y,pointerId:1,pointerType:'mouse',button:0,buttons:t.includes('up')?0:1,isPrimary:true});
['pointerdown','mousedown','pointerup','mouseup','click'].forEach(t=>el.dispatchEvent(mk(t,t.startsWith('pointer')?PointerEvent:MouseEvent)));}`;

const out = { MARK, served: DIR };
const browser = await chromium.launch({ executablePath: EXE });
const ctx = await browser.newContext({ viewport: { width: 393, height: 852 } });
const page = await ctx.newPage();
out.net = { requests: [], failed: [], responses: [] };
page.on('request', (r) => { if (r.url().includes('supabase.co')) out.net.requests.push(r.method() + ' ' + r.url().split('supabase.co')[1].slice(0, 60)); });
page.on('requestfailed', (r) => { if (r.url().includes('supabase.co')) out.net.failed.push((r.failure()?.errorText || '?') + ' :: ' + r.url().split('supabase.co')[1].slice(0, 60)); });
page.on('response', (r) => { if (r.url().includes('supabase.co')) out.net.responses.push(r.status() + ' ' + r.url().split('supabase.co')[1].slice(0, 60)); if (r.url().includes('/rest/v1/bug_reports')) out.insertStatus = r.status(); });

// The container's agent proxy resets every tunnel to supabase.co, so the REAL insert cannot
// complete from inside this browser (proved: every Supabase call below fails ERR_CONNECTION_RESET
// while shell curl to the same REST endpoint returns 201). STUB=1 fulfils just the bug_reports
// POST with the 201 production really returns, so the SUCCESS state can be seen rendering; STUB
// unset leaves the network alone and shows what a tester sees when the send genuinely fails.
if (process.env.PROBE_STUB === '1') {
  out.stubbed = true;
  await page.route('**/rest/v1/bug_reports*', (route) =>
    route.fulfill({ status: 201, contentType: 'application/json', body: '[]' }));
}
await page.goto(`http://localhost:${PORT}/settings`, { waitUntil: 'load', timeout: 120000 });
await page.waitForTimeout(11000);
out.mounted = await page.evaluate(() => (document.getElementById('root')?.children.length ?? 0) > 0);
await page.evaluate(`window.__f=${fire}`);

// 1. Is the entry reachable at all, and how far down the page is it?
out.entry = await page.evaluate(() => {
  const el = document.querySelector('[data-testid="report-bug-row"]');
  if (!el) return { found: false };
  const r = el.getBoundingClientRect();
  const doc = document.scrollingElement || document.documentElement;
  return { found: true, label: (el.innerText || '').trim().slice(0, 60),
    yFromPageTop: Math.round(r.top + (doc.scrollTop || 0)), viewportH: window.innerHeight };
});
if (out.entry.found) out.screensDeep = +(out.entry.yFromPageTop / out.entry.viewportH).toFixed(1);

if (out.entry.found) {
  await page.evaluate(`(()=>{const el=document.querySelector('[data-testid="report-bug-row"]');window.__f(el);})()`);
  await page.waitForTimeout(1800);
  out.formOpened = await page.evaluate(() => !!document.querySelector('[data-testid="report-bug-description"]'));
  await page.screenshot({ path: 'docs/tester-readiness/report-form.png' });

  if (out.formOpened) {
    await page.fill('[data-testid="report-bug-description"]', `${MARK} — TESTER-READINESS pipeline proof, ignore and delete.`);
    await page.waitForTimeout(400);
    await page.evaluate(`(()=>{const el=document.querySelector('[data-testid="report-bug-send"]');window.__f(el);})()`);
    await page.waitForTimeout(25000);
    // 2. What does the tester SEE after pressing Send?
    out.afterSend = await page.evaluate(() => {
      const t = document.body.innerText || '';
      return {
        sawThanks: t.includes('Thanks') || t.includes('תודה'),
        sawSentBody: t.includes('sent to the team') || t.includes('נשלח לצוות'),
        sawError: t.includes("Couldn't send") || t.includes('נכשלה'),
        sawRateLimit: t.includes('a lot of reports') || t.includes('הרבה דיווחים'),
        formStillOpen: !!document.querySelector('[data-testid="report-bug-description"]'),
        tail: t.slice(-300),
      };
    });
    await page.screenshot({ path: 'docs/tester-readiness/report-after-send.png' });
  }
}
console.log(JSON.stringify(out, null, 1));
await browser.close();
server.close();
