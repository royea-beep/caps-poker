/**
 * ITERATION 7 — verify the LIVE deploy, because a green workflow is not a mounted page.
 *
 * Iteration 6 established that both the export patch and the post-deploy axe-core audit can
 * pass on a blank page: a page with no content has no accessibility violations. So this
 * asserts rendered DOM at every step, on the real production URL.
 *
 *   node tests/live-release-verify.mjs
 */
import { chromium } from 'playwright';
import fs from 'fs';

const URL = process.env.CAPS_URL || 'https://caps.ftable.co.il';
const W = 375, H = 812;
const out = { url: URL, ts: new Date().toISOString(), steps: {} };

const fire = `(el)=>{const r=el.getBoundingClientRect();const x=r.left+r.width/2,y=r.top+r.height/2;
const mk=(t,C)=>new C(t,{bubbles:true,cancelable:true,composed:true,clientX:x,clientY:y,pointerId:1,pointerType:'mouse',button:0,buttons:t.includes('up')?0:1,isPrimary:true});
['pointerdown','mousedown','pointerup','mouseup','click'].forEach(t=>el.dispatchEvent(mk(t,t.startsWith('pointer')?PointerEvent:MouseEvent)));}`;

const browser = await chromium.launch({ headless: false, args: [`--window-size=${W + 20},${H + 140}`] });
const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
const page = await ctx.newPage();
const errs = [];
page.on('pageerror', (e) => errs.push(String(e).slice(0, 200)));

await page.goto(URL, { waitUntil: 'load', timeout: 120000 });
await page.waitForTimeout(9000);

// 1 — THE BLANK-PAGE TEST. #root must hold real rendered content.
out.steps.mount = await page.evaluate(() => ({
  rootKids: document.getElementById('root')?.children.length ?? 0,
  textLen: (document.body.innerText || '').length,
  sample: (document.body.innerText || '').replace(/\s+/g, ' ').slice(0, 120),
  scriptType: document.querySelector('script[src*="/_expo/static/js/web/"]')?.getAttribute('type') ?? '(none)',
  bundle: (document.querySelector('script[src*="/_expo/static/js/web/"]')?.getAttribute('src') || '').split('/').pop(),
}));

// 5 — Hebrew strings that were tsc-clean but never rendered.
out.steps.hebrew = await page.evaluate(() => {
  const t = document.body.innerText || '';
  return { homeCta: t.includes('משחק אונליין'), anyHebrew: /[֐-׿]/.test(t) };
});

// 3 — walk one hand: 2P (=4 boards) -> play -> auto-place -> ready -> reveal -> results.
await page.evaluate(`window.__f=${fire}`);
await page.evaluate(`(()=>{const p=[...document.querySelectorAll('*')].find(e=>e.children.length===0&&/^(✓ )?2P$/.test((e.textContent||'').trim()));
  if(p){let n=p;for(let i=0;i<3&&n;i++){window.__f(n);n=n.parentElement;}}})()`);
await page.waitForTimeout(700);
await page.evaluate(`(()=>{const p=[...document.querySelectorAll('button,[role="button"]')].find(x=>/^Play$|^שחק$/.test((x.getAttribute('aria-label')||x.textContent||'').trim()));if(p)window.__f(p);})()`);
await page.waitForTimeout(3500);
out.steps.game = await page.evaluate(() => ({ rootKids: document.getElementById('root')?.children.length ?? 0,
  sample: (document.body.innerText || '').replace(/\s+/g, ' ').slice(0, 90) }));

await page.evaluate(`(()=>{const b=[...document.querySelectorAll('button,[role="button"]')].find(x=>/auto-place all|מיקום אוטומטי/i.test(x.getAttribute('aria-label')||x.textContent||''));if(b)window.__f(b);})()`);
await page.waitForTimeout(1000);
const tReady = Date.now();
await page.evaluate(`(()=>{const rb=document.querySelector('[data-testid="ready-button"]');if(rb)window.__f(rb);})()`);
await page.waitForTimeout(4000);

// 4 — equity + outs during reveal. These ship to testers and have never been seen live.
out.steps.reveal = await page.evaluate(() => ({
  equityBar: !!document.querySelector('[data-testid="equity-bar"]'),
  outsRow: !!document.querySelector('[data-testid="outs-row"]'),
  outsCount: document.querySelector('[data-testid="outs-count"]')?.textContent?.trim() ?? null,
  anyEquityValue: !!document.querySelector('[data-testid^="equity-value"]'),
  rootKids: document.getElementById('root')?.children.length ?? 0,
}));

// tap through to results, timing it (7 — the 9.9s dead wait edca656 removes)
for (let i = 0; i < 40; i++) {
  if (await page.evaluate(() => !!document.querySelector('[data-testid="result-headline"]'))) break;
  await page.evaluate(`(()=>{const el=document.elementFromPoint(${Math.floor(W / 2)},${Math.floor(H / 2)});if(el)window.__f(el);})()`);
  await page.waitForTimeout(700);
}
out.steps.placementToResultsSec = +(((Date.now() - tReady) / 1000).toFixed(1));
out.steps.results = await page.evaluate(() => ({
  headline: document.querySelector('[data-testid="result-headline"]')?.textContent?.trim() ?? null,
  rootKids: document.getElementById('root')?.children.length ?? 0,
}));

out.pageErrors = errs.slice(0, 5);
console.log(JSON.stringify(out, null, 1));
fs.writeFileSync('tests/live-release-verify-result.json', JSON.stringify(out, null, 1));
await browser.close();
