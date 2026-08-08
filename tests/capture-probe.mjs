/**
 * CN-CAPTURE — does the equity/outs the REVEAL computed actually reach /results?
 *
 * The point of this sprint is that /results must not recompute equity (~1s of main thread for
 * numbers the app already had). BoardReveal computes them per board and used to discard them
 * on unmount; it now writes each board's result into the store as it finishes. This plays a
 * REAL hand (no fixture) and reads what the results screen ends up holding.
 *
 * WHY A SIDE CHANNEL AND NOT A SCREENSHOT. No equity UI exists at /results yet — building one
 * is explicitly the next sprint. results.tsx publishes a read-side snapshot through
 * publishProbeSnapshot(), behind the same guard as the fixture override, so this can assert
 * that the value was READ rather than merely typed.
 *
 *   EXPO_PUBLIC_CAPS_FIXTURE=1 npx expo export -p web --output-dir web-fixture-dist
 *   node tests/capture-probe.mjs
 *
 * TWO SCENARIOS, because coverage is PARTIAL by design:
 *   walk      — advance through every board. Expect every board captured.
 *   skip-all  — long-press out of the reveal early. Expect GAPS, and expect them to read as
 *               `undefined`, not as a zero. A wrong equity number is worse than no number.
 *
 * MOUNT ASSERTION IS MANDATORY. A previous probe scored four false passes off a dead page, so
 * nothing is believed until result-headline has rendered.
 */
import { chromium } from 'playwright';
import fs from 'fs';
import http from 'http';
import path from 'path';

const DIR = path.resolve('web-fixture-dist');
const PORT = Number(process.env.PROBE_PORT || 8126);
const W = 375, H = 812;

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.ttf': 'font/ttf', '.woff': 'font/woff',
  '.woff2': 'font/woff2', '.ico': 'image/x-icon', '.mp3': 'audio/mpeg', '.wav': 'audio/wav' };
// A raw `expo export` is NOT runnable: the bundle uses import.meta, so the emitted classic
// <script defer> throws and #root stays empty. scripts/fix-web-html.js is what adds
// type="module" on the deploy path; applied here in memory. (Do NOT run that script against
// this directory — it only looks at dist/ and web-dist/ and will patch the real web-dist.)
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

async function runScenario(browser, mode) {
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  // Never let a probe hand touch the live backend.
  await ctx.route('**/*', (r) => (/supabase|ftable\.co\.il/i.test(r.request().url()) ? r.abort() : r.continue()));
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push('PAGEERROR: ' + String(e).slice(0, 200)));

  await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'load', timeout: 120000 });
  await page.waitForTimeout(3500);

  // Rule 14a preamble — prove the browser is rendering before believing anything.
  const pre = await page.evaluate(async () => {
    const s = performance.now(); let raf = 0;
    await new Promise((r) => { const l = () => { raf++; performance.now() - s < 1500 ? requestAnimationFrame(l) : r(); };
      requestAnimationFrame(l); setTimeout(r, 2000); });
    return { hidden: document.hidden, rafCount: raf, ok: document.hidden === false && raf > 0 };
  });

  await page.evaluate(`window.__f=${fire}`);
  // 2P → four boards, the widest coverage case.
  await page.evaluate(`(()=>{const p=[...document.querySelectorAll('*')].find(e=>e.children.length===0&&/^(✓ )?2P$/.test((e.textContent||'').trim()));
    if(p){let n=p;for(let i=0;i<3&&n;i++){window.__f(n);n=n.parentElement;}}})()`);
  await page.waitForTimeout(700);
  await page.evaluate(`(()=>{const p=[...document.querySelectorAll('button,[role="button"]')].find(x=>/^Play$/.test((x.getAttribute('aria-label')||x.textContent||'').trim()));if(p)window.__f(p);})()`);
  await page.waitForTimeout(3000);
  await page.evaluate(`(()=>{const b=[...document.querySelectorAll('button,[role="button"]')].find(x=>/auto-place all/i.test(x.getAttribute('aria-label')||x.textContent||''));if(b)window.__f(b);})()`);
  await page.waitForTimeout(900);
  await page.evaluate(`(()=>{const rb=document.querySelector('[data-testid="ready-button"]');if(rb)window.__f(rb);})()`);
  await page.waitForTimeout(3000);

  if (mode === 'skip-all') {
    // BZ3 long-press exit. Leaves the reveal before the later boards are ever computed.
    await page.evaluate(`(()=>{const el=document.elementFromPoint(${Math.floor(W / 2)},${Math.floor(H / 2)});if(!el)return;
      const r=el.getBoundingClientRect(),x=r.left+r.width/2,y=r.top+r.height/2;
      el.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,cancelable:true,composed:true,clientX:x,clientY:y,pointerId:1,pointerType:'mouse',button:0,buttons:1,isPrimary:true}));
      el.dispatchEvent(new MouseEvent('mousedown',{bubbles:true,cancelable:true,clientX:x,clientY:y,button:0,buttons:1}));
      window.__lp=el;})()`);
    await page.waitForTimeout(900);
    await page.evaluate(`(()=>{const el=window.__lp;if(!el)return;const r=el.getBoundingClientRect(),x=r.left+r.width/2,y=r.top+r.height/2;
      el.dispatchEvent(new PointerEvent('pointerup',{bubbles:true,cancelable:true,composed:true,clientX:x,clientY:y,pointerId:1,pointerType:'mouse',button:0,buttons:0,isPrimary:true}));
      el.dispatchEvent(new MouseEvent('mouseup',{bubbles:true,cancelable:true,clientX:x,clientY:y,button:0,buttons:0}));})()`);
    await page.waitForTimeout(2500);
  }

  // Tap through whatever reveal remains until /results is up (each board needs skip-then-advance).
  for (let i = 0; i < 26; i++) {
    const done = await page.evaluate(() => !!document.querySelector('[data-testid="result-headline"]'));
    if (done) break;
    await page.evaluate(`(()=>{const el=document.elementFromPoint(${Math.floor(W / 2)},${Math.floor(H / 2)});if(el)window.__f(el);})()`);
    await page.waitForTimeout(1100);
  }
  await page.waitForTimeout(1500);

  const r = await page.evaluate(() => ({
    headline: document.querySelector('[data-testid="result-headline"]')?.textContent?.trim() ?? null,
    rootKids: document.getElementById('root')?.children.length ?? 0,
    boards: (globalThis.__CAPS_PROBE__ || {}).resultsBoards ?? null,
  }));

  // A ZERO FROM A DEAD PAGE IS NOT A RESULT.
  const mounted = r.rootKids > 0 && r.headline !== null;
  const captured = mounted && Array.isArray(r.boards) ? r.boards.filter((b) => b.hasEquity && b.hasOuts).length : 0;
  const total = Array.isArray(r.boards) ? r.boards.length : 0;
  await ctx.close();
  return { mode, precondition: pre, mounted, headline: r.headline, total, captured, boards: r.boards, errs: errs.slice(0, 4) };
}

const out = { ts: new Date().toISOString(), viewport: { W, H }, scenarios: [] };
const browser = await chromium.launch({ headless: false, args: [`--window-size=${W + 20},${H + 140}`] });
try {
  for (const mode of ['walk', 'skip-all']) {
    const s = await runScenario(browser, mode);
    out.scenarios.push(s);
    console.log(`${mode.padEnd(9)} mounted=${s.mounted} headline=${JSON.stringify(s.headline)} captured=${s.captured}/${s.total} raf=${s.precondition.rafCount}`);
    if (s.boards) for (const b of s.boards) console.log(`   board ${b.i}: equity=${b.hasEquity} outs=${b.hasOuts} selfFlop=${b.selfFlopPct} selfTurn=${b.selfTurnPct} outsFlop=${b.outsFlopCount} outsTurn=${b.outsTurnCount}`);
  }
} finally {
  await browser.close();
  server.close();
  fs.writeFileSync('tests/capture-probe-result.json', JSON.stringify(out, null, 1));
}
