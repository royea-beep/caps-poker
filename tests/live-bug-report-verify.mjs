/**
 * ITERATION 7 — the end-to-end tester-loop proof, on the LIVE production site.
 *
 * Sends one bug report through the deployed UI and leaves a row behind to query. This is the
 * whole point of G2 (a build identifier that exists on the delivery channel) and G6 (a report
 * that arrives carrying context the tester never typed) — and until now neither was proven on
 * web, which is where testers actually are.
 */
import { chromium } from 'playwright';

const URL = process.env.CAPS_URL || 'https://caps.ftable.co.il';
const MARK = `LIVE-REL-${Date.now()}`;

const fire = `(el)=>{const r=el.getBoundingClientRect();const x=r.left+r.width/2,y=r.top+r.height/2;
const mk=(t,C)=>new C(t,{bubbles:true,cancelable:true,composed:true,clientX:x,clientY:y,pointerId:1,pointerType:'mouse',button:0,buttons:t.includes('up')?0:1,isPrimary:true});
['pointerdown','mousedown','pointerup','mouseup','click'].forEach(t=>el.dispatchEvent(mk(t,t.startsWith('pointer')?PointerEvent:MouseEvent)));}`;

const browser = await chromium.launch({ headless: false });
const ctx = await browser.newContext({ viewport: { width: 375, height: 812 } });
const page = await ctx.newPage();
await page.goto(`${URL}/settings`, { waitUntil: 'load', timeout: 120000 });
await page.waitForTimeout(9000);

const mounted = await page.evaluate(() => (document.getElementById('root')?.children.length ?? 0) > 0);
await page.evaluate(`window.__f=${fire}`);
await page.evaluate(`(()=>{const el=document.querySelector('[data-testid="report-bug-row"]');if(el)window.__f(el);})()`);
await page.waitForTimeout(1500);

const sheet = await page.evaluate(() => !!document.querySelector('[data-testid="report-bug-description"]'));
if (sheet) {
  await page.fill('[data-testid="report-bug-description"]', `${MARK} — live release verification, ignore.`);
  await page.waitForTimeout(300);
  await page.evaluate(`(()=>{const el=document.querySelector('[data-testid="report-bug-send"]');if(el)window.__f(el);})()`);
  await page.waitForTimeout(6000);
}
const ui = await page.evaluate(() => {
  const t = document.body.innerText || '';
  return { thanks: t.includes('תודה'), error: t.includes('נכשלה') };
});
console.log(JSON.stringify({ MARK, mounted, sheetOpened: sheet, ui }, null, 1));
await browser.close();
