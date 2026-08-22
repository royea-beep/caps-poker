/**
 * HAND RACE — does a played hand survive being navigated away from instantly?
 *
 * THE BUG: results.tsx recorded the hand fire-and-forget. Leaving /results before the request
 * settled cancelled it and the hand was never written (measured 2026-08-21: 1 of 2 lost).
 *
 * THIS TEST DELIBERATELY LOSES THE RACE. It plays a hand and navigates away with ZERO dwell —
 * the exact behaviour that used to drop rows — N times on one device, then reloads once so the
 * outbox flush at app start can drain. It then prints the device id; the row count is asserted in
 * SQL, because the client cannot be trusted to report on its own persistence.
 *
 * A single pass proves nothing against a race, so N defaults to 5 per engine.
 *
 *   ENGINE=webkit TRIALS=5 node tests/hand-race.mjs
 */
import { webkit, chromium } from 'playwright';
import { playHandToResults, installFire, where } from './harness/play.mjs';

const SITE = process.env.CAPS_URL || 'https://caps.ftable.co.il';
const ENGINE = process.env.ENGINE || 'webkit';
const VW = Number(process.env.VIEWPORT || 430);
const TRIALS = Number(process.env.TRIALS || 5);
const engine = ENGINE === 'chromium' ? chromium : webkit;
const tag = `${ENGINE}/${VW}`;

const browser = await engine.launch({ headless: false });
const page = await (await browser.newContext({ viewport: { width: VW, height: 900 } })).newPage();
page.on('dialog', async (d) => { await d.dismiss(); });
const errs = []; page.on('pageerror', (e) => errs.push(String(e).slice(0, 90)));

await page.goto(SITE + '/', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(10000);
const device = await page.evaluate(`localStorage.getItem('caps-device-id')`);
console.log(`\n══ ${tag} · device ${device} · ${TRIALS} trials, ZERO dwell after results`);

let reached = 0;
for (let i = 1; i <= TRIALS; i++) {
  await installFire(page);
  for (const label of ['Continue', 'SKIP', 'PLAY']) {
    const hit = await page.evaluate(`(()=>{const b=[...document.querySelectorAll('button,[role="button"],[tabindex="0"]')]
      .find(x=>new RegExp(${JSON.stringify(label)},'i').test((x.getAttribute('aria-label')||'')+' '+(x.textContent||'')));
      if(!b) return false; window.__f(b); return true;})()`);
    if (hit) { await page.waitForTimeout(3000); await installFire(page); }
  }
  if (!/game/.test((await where(page)).path)) {
    await page.goto(SITE + '/game?practice=true', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(8000);
  }
  const res = await playHandToResults(page);
  if (res.reachedResults) reached++;
  // THE RACE: leave immediately. No dwell, no wait — cancel the write mid-flight.
  await page.goto(SITE + '/', { waitUntil: 'domcontentloaded' });
  console.log(`   trial ${i}: reachedResults=${res.reachedResults} — navigated away with 0ms dwell`);
  await page.waitForTimeout(6000);
}

// One final load so the app-start flush has a clean run at anything still queued.
await page.goto(SITE + '/', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(12000);
const pending = await page.evaluate(`(()=>{try{return (JSON.parse(localStorage.getItem('caps_hand_outbox')||'[]')).length;}catch{return -1;}})()`);

console.log(`\n   hands actually played : ${reached}/${TRIALS}`);
console.log(`   still queued locally  : ${pending}   (0 = everything reached the server)`);
console.log(`   pageerrors            : ${errs.length}`);
console.log(`   ASSERT IN SQL: select count(*) from hand_history where device_id='${device}';  -- expect ${reached}`);
await browser.close();
