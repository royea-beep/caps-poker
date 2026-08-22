/**
 * The game screen reports 27-40 elements that are focusable (tabindex=0) but carry no role and
 * no accessible name. A count alone cannot tell anyone whether that is 40 unlabelled cards or 40
 * broken buttons, so this names them.
 */
import { webkit } from 'playwright';
import { installFire, where } from './harness/play.mjs';
const SITE = process.env.CAPS_URL || 'https://caps.ftable.co.il';
const b = await webkit.launch({ headless: false });
const p = await (await b.newContext({ viewport: { width: 393, height: 900 } })).newPage();
p.on('dialog', async (d) => { await d.dismiss(); });
const BARE = () => {
  const vis = (e) => { const r = e.getBoundingClientRect(); return r.width > 2 && r.height > 2; };
  const bare = [...document.querySelectorAll('[tabindex="0"]')].filter(vis)
    .filter((e) => !e.getAttribute('role') && e.tagName !== 'BUTTON' && e.tagName !== 'A');
  const tally = {};
  for (const e of bare) {
    const label = e.getAttribute('aria-label');
    const txt = (e.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 22);
    const key = label ? `labelled:"${label.slice(0, 22)}"` : (txt ? `text:"${txt}"` : 'NO NAME AT ALL');
    tally[key] = (tally[key] || 0) + 1;
  }
  return { total: bare.length, tally };
};
await p.goto(`${SITE}/game?practice=true&players=3&fresh=1`, { waitUntil: 'domcontentloaded' });
await p.waitForTimeout(13000);
console.log('\n── PLACEMENT'); console.log('  ', JSON.stringify(await p.evaluate(BARE), null, 1));
await installFire(p);
await p.evaluate(`(()=>{const x=[...document.querySelectorAll('button,[role="button"]')]
  .find(e=>/auto-place all/i.test((e.getAttribute('aria-label')||'')+' '+(e.textContent||''))); if(x) window.__f(x);})()`);
await p.waitForTimeout(3000);
await installFire(p);
await p.evaluate(`(()=>{const r=document.querySelector('[data-testid="ready-button"]'); if(r) window.__f(r);})()`);
let ok = false;
for (let i = 0; i < 40 && !ok; i++) { await p.waitForTimeout(700); ok = (await where(p)).inReveal; }
if (ok) { console.log('\n── REVEAL'); console.log('  ', JSON.stringify(await p.evaluate(BARE), null, 1)); }
else console.log('\n── REVEAL not reached');
await b.close();
