/**
 * Does /referral now show what the player was actually PAID?
 *
 * It used to compute "Chips earned" as conversions x 500, from a config key that does not
 * exist. redeem_referral pays the referrer 300. Production has ZERO redemptions ever, so the
 * difference cannot be seen without making one — this makes exactly one, with two throwaway
 * devices, and prints the ids so both are cleaned afterwards.
 *
 * The number to watch: after ONE conversion the screen must read 300, not 500.
 */
import { webkit } from 'playwright';
const SITE = process.env.CAPS_URL || 'https://caps.ftable.co.il';
const b = await webkit.launch({ headless: false });

const open = async () => {
  const p = await (await b.newContext({ viewport: { width: 393, height: 900 } })).newPage();
  p.on('dialog', async (d) => { await d.dismiss(); });
  return p;
};
const read = (p) => p.evaluate(() => ({
  lines: document.body.innerText.split('\n').map((s) => s.trim()).filter(Boolean),
}));

// A — the sharer. Load /referral so a code is minted.
const A = await open();
await A.goto(SITE + '/referral', { waitUntil: 'domcontentloaded' });
await A.waitForTimeout(11000);
const aBefore = await read(A);
const devA = await A.evaluate(`localStorage.getItem('caps-device-id')`);
// The code is whatever the DB issues -- 8 chars today. Do NOT re-derive the format here;
// assuming 6 is the exact bug this test exists to catch.
const iCode = aBefore.lines.indexOf('Your code');
const code = (iCode >= 0 ? (aBefore.lines[iCode + 1] || '') : '').trim();
console.log(`   A device=${devA}  code=${code}`);
console.log(`   A before: ${JSON.stringify(aBefore.lines)}`);

if (!code) { console.log('   NO CODE MINTED — cannot test'); await b.close(); process.exit(0); }

// B — the redeemer. Types A's code.
const B = await open();
await B.goto(SITE + '/referral', { waitUntil: 'domcontentloaded' });
await B.waitForTimeout(11000);
const devB = await B.evaluate(`localStorage.getItem('caps-device-id')`);
await B.evaluate((c) => {
  const inp = document.querySelector('input');
  if (!inp) return;
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  setter.call(inp, c);
  inp.dispatchEvent(new Event('input', { bubbles: true }));
}, code);
await B.waitForTimeout(1200);
await B.evaluate(`(()=>{const x=[...document.querySelectorAll('button,[role="button"]')]
  .find(e=>/redeem|apply|submit/i.test((e.getAttribute('aria-label')||'')+' '+(e.textContent||'')));
  if(x) x.click();})()`);
await B.waitForTimeout(6000);
console.log(`   B device=${devB}`);
console.log(`   B after redeem: ${JSON.stringify((await read(B)).lines.slice(0, 12))}`);

// A reloads — the earned figure must now reflect ONE conversion at the real payout.
await A.goto(SITE + '/referral', { waitUntil: 'domcontentloaded' });
await A.waitForTimeout(11000);
const aAfter = await read(A);
console.log(`   A after : ${JSON.stringify(aAfter.lines)}`);
const has300 = aAfter.lines.includes('300');
const has500 = aAfter.lines.includes('500');
console.log(`\n   shows 300 (the real payout): ${has300}    shows 500 (the old fiction): ${has500}`);
console.log(`   CLEAN UP THESE DEVICES: ${devA} , ${devB}`);
await b.close();
