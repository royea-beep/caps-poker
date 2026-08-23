/**
 * Every surface that shows "wins" or "games" must show the SAME number now that they all come
 * from one counter. Pins a device that has played and reads /rank, /stats and /hand-history.
 */
import { webkit } from 'playwright';
const SITE = process.env.CAPS_URL || 'https://caps.ftable.co.il';
const DEV = process.env.DEV_ID;
const b = await webkit.launch({ headless: false });
const ctx = await b.newContext({ viewport: { width: 393, height: 900 } });
await ctx.addInitScript((d) => { try { localStorage.setItem('caps-device-id', d); } catch {} }, DEV);
const p = await ctx.newPage();
p.on('dialog', async (d) => { await d.dismiss(); });
for (const route of ['/rank', '/stats', '/hand-history', '/leaderboard']) {
  await p.goto(SITE + route, { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(10000);
  const lines = await p.evaluate(() => document.body.innerText.split('\n').map((s) => s.trim()).filter(Boolean));
  console.log(`\n── ${route}`);
  console.log(`   ${JSON.stringify(lines.slice(0, 26))}`);
  const bad = (await p.evaluate(() => document.body.innerText)).match(/undefined|NaN/g) || [];
  if (bad.length) console.log(`   ⚠️ ${bad.length} undefined/NaN on page`);
}
await b.close();
