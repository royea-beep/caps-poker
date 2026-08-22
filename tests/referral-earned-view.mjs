/**
 * Device 59a1-268a-4858 now has exactly ONE conversion (proven by calling redeem_referral
 * server-side and reading its verdict). The screen used to compute earned chips as
 * conversions x 500 from a config key that does not exist. It must now read 300 -- the amount
 * redeem_referral actually paid.
 */
import { webkit, chromium } from 'playwright';
const SITE = process.env.CAPS_URL || 'https://caps.ftable.co.il';
const DEV = '59a1-268a-4858';
for (const [name, engine] of [['webkit', webkit], ['chromium', chromium]]) {
  const b = await engine.launch({ headless: false });
  const ctx = await b.newContext({ viewport: { width: 393, height: 900 } });
  await ctx.addInitScript((d) => { try { localStorage.setItem('caps-device-id', d); } catch {} }, DEV);
  const p = await ctx.newPage();
  p.on('dialog', async (d) => { await d.dismiss(); });
  await p.goto(SITE + '/referral', { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(11000);
  const lines = await p.evaluate(() => document.body.innerText.split('\n').map((s) => s.trim()).filter(Boolean));
  const i = lines.indexOf('Chips earned');
  const j = lines.indexOf('Friends joined');
  console.log(`\n── ${name}  device=${await p.evaluate(`localStorage.getItem('caps-device-id')`)}`);
  console.log(`   friends joined shown: ${j > 0 ? lines[j - 1] : '?'}`);
  console.log(`   chips earned shown  : ${i > 0 ? lines[i - 1] : '?'}   <- must be 300, not 500`);
  await b.close();
}
