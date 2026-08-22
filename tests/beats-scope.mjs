/**
 * The MP results screen shows "Straight beats " on boards the player WON -- the opponent's hand
 * name is blank. On boards they LOST it reads correctly. Is that multiplayer-only, or does the
 * solo results screen do it too? Scope decides who the report is for.
 */
import { webkit } from 'playwright';
import { installFire, where } from './harness/play.mjs';
const SITE = process.env.CAPS_URL || 'https://caps.ftable.co.il';
const b = await webkit.launch({ headless: false });
const p = await (await b.newContext({ viewport: { width: 393, height: 900 } })).newPage();
p.on('dialog', async (d) => { await d.dismiss(); });
await p.goto(`${SITE}/game?practice=true&players=2&fresh=1`, { waitUntil: 'domcontentloaded' });
await p.waitForTimeout(13000);
await installFire(p);
await p.evaluate(`(()=>{const x=[...document.querySelectorAll('button,[role="button"]')]
  .find(e=>/auto-place all/i.test((e.getAttribute('aria-label')||'')+' '+(e.textContent||''))); if(x) window.__f(x);})()`);
await p.waitForTimeout(3000);
await installFire(p);
await p.evaluate(`(()=>{const r=document.querySelector('[data-testid="ready-button"]'); if(r) window.__f(r);})()`);
for (let i = 0; i < 60; i++) {
  await p.waitForTimeout(1100);
  if ((await where(p)).path === '/results') break;
}
await p.waitForTimeout(6000);
const beats = await p.evaluate(() => (document.body.innerText.match(/[^\n]*beats[^\n]*/g) || []));
console.log(`\n── SOLO /results, lines containing "beats":`);
for (const l of beats) console.log(`   ${JSON.stringify(l.trim())}${/beats\s*$/.test(l.trim()) ? '   <-- BLANK OPPONENT' : ''}`);
console.log(`   device: ${await p.evaluate(`localStorage.getItem('caps-device-id')`)}`);
await b.close();
