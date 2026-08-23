/**
 * /stats rendered "undefinedW", "NaN%" and "+undefined" because the component asked for four
 * field names get_player_stats has never emitted. The QA loop could not see it: the POKER IQ
 * block renders only for a device WITH stats, and every harness device is new.
 *
 * So this pins the device id to one that HAS played (6ce9-dab8-6540 — the ELO proof device,
 * 3 games, 1 win) and reads the block back on both engines.
 */
import { webkit, chromium } from 'playwright';
import { installFire, where } from './harness/play.mjs';
const SITE = process.env.CAPS_URL || 'https://caps.ftable.co.il';
const DEV = process.env.DEV_ID || '6ce9-dab8-6540';
for (const [name, engine] of [['webkit', webkit], ['chromium', chromium]]) {
  const b = await engine.launch({ headless: false });
  const ctx = await b.newContext({ viewport: { width: 393, height: 900 } });
  await ctx.addInitScript((d) => { try { localStorage.setItem('caps-device-id', d); } catch {} }, DEV);
  const p = await ctx.newPage();
  p.on('dialog', async (d) => { await d.dismiss(); });
  // The POKER IQ block is gated on LOCAL hand history as well as the DB stats, so pinning a
  // device id is not enough -- play one real hand in this browser first.
  await p.goto(`${SITE}/game?players=2&fresh=1`, { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(11000);
  await installFire(p);
  await p.evaluate(`(()=>{const x=[...document.querySelectorAll('button,[role="button"]')]
    .find(e=>/auto-place all/i.test((e.getAttribute('aria-label')||'')+' '+(e.textContent||''))); if(x) window.__f(x);})()`);
  await p.waitForTimeout(2600);
  await installFire(p);
  await p.evaluate(`(()=>{const r=document.querySelector('[data-testid="ready-button"]'); if(r) window.__f(r);})()`);
  for (let i = 0; i < 55; i++) {
    await p.waitForTimeout(1000);
    let w; try { w = await where(p); } catch { break; }
    if (w.path === '/results') break;
  }
  await p.waitForTimeout(7000);

  await p.goto(SITE + '/stats', { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(11000);
  const s = await p.evaluate(() => {
    const t = document.body.innerText;
    const i = t.indexOf('POKER IQ');
    return {
      hasBlock: i >= 0,
      block: i >= 0 ? t.slice(i, i + 170).split('\n').map((x) => x.trim()).filter(Boolean) : [],
      undefinedCount: (t.match(/undefined/g) || []).length,
      nanCount: (t.match(/NaN/g) || []).length,
    };
  });
  console.log(`\n── ${name}  device=${DEV}`);
  console.log(`   POKER IQ present: ${s.hasBlock}`);
  console.log(`   block           : ${JSON.stringify(s.block)}`);
  console.log(`   "undefined" on page: ${s.undefinedCount}   "NaN" on page: ${s.nanCount}   <- both must be 0`);
  await b.close();
}
