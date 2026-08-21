/**
 * DELETE ACCOUNT, END TO END — on a test- device ONLY, never a real one.
 *
 * Also the standing lesson: Playwright AUTO-DISMISSES native dialogs when nothing listens, which is
 * why an earlier probe reported this control dead. Here the dialog handler is the instrument.
 */
import { webkit } from 'playwright';
const SITE = 'https://caps.ftable.co.il';
const DEV = 'test-del-probe';

const run = async (accept) => {
  const b = await webkit.launch({ headless: false });
  const ctx = await b.newContext({ viewport: { width: 430, height: 900 } });
  await ctx.addInitScript((d) => { try { localStorage.setItem('caps-device-id', d);
    localStorage.setItem('has_seen_interactive_tutorial', 'true'); } catch {} }, DEV);
  const p = await ctx.newPage();
  const seen = [];
  p.on('dialog', async (dlg) => { seen.push(dlg.message().slice(0, 70)); accept ? await dlg.accept() : await dlg.dismiss(); });
  await p.goto(SITE + '/settings', { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(10000);
  await p.evaluate(`window.__f=(el)=>{const r=el.getBoundingClientRect();const x=r.left+r.width/2,y=r.top+r.height/2;
const mk=(t,C)=>new C(t,{bubbles:true,cancelable:true,composed:true,clientX:x,clientY:y,pointerId:1,pointerType:'mouse',button:0,buttons:t.includes('up')?0:1,isPrimary:true});
['pointerdown','mousedown','pointerup','mouseup','click'].forEach(t=>el.dispatchEvent(mk(t,t.startsWith('pointer')?PointerEvent:MouseEvent)));}`);
  await p.evaluate(`(()=>{const b=[...document.querySelectorAll('button,[role="button"]')]
    .find(x=>/^Delete account$/.test(x.getAttribute('aria-label')||'')); if(b) window.__f(b);})()`);
  await p.waitForTimeout(9000);
  console.log(`  ${accept ? 'ACCEPT' : 'CANCEL'} — dialogs seen: ${seen.length}`);
  seen.forEach((m, i) => console.log(`    ${i + 1}. ${m}`));
  await b.close();
};

console.log('--- run 1: CANCEL (must change nothing) ---');
await run(false);
console.log('--- run 2: ACCEPT both (must delete) ---');
await run(true);
