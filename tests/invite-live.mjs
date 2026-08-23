// Walks the real tester path: tap an invite link on a device that has never played.
// The redemption RPC has never once succeeded in production (0 rows in referral_redemptions
// across 3,140 minted codes), so the UI path had never been proven end to end.
import { chromium, webkit } from 'playwright';
const URL = 'https://caps.ftable.co.il';
const CODE = process.argv[2];
for (const [name, engine] of [['chromium', chromium], ['webkit', webkit]]) {
  const b = await engine.launch({ headless: false });
  const c = await b.newContext({ viewport: { width: 393, height: 852 }, ignoreHTTPSErrors: true });
  const p = await c.newPage();
  const errs = [];
  p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text().slice(0, 120)); });
  await p.goto(`${URL}/invite/${CODE}`, { waitUntil: 'load', timeout: 120000 });
  await p.waitForTimeout(12000);
  const txt = (await p.evaluate(`document.body.innerText`)).replace(/\n+/g, ' | ').slice(0, 300);
  const dev = await p.evaluate(`localStorage.getItem('caps-device-id')`);
  console.log(`\n── ${name}\n   device: ${dev}\n   screen: ${txt}\n   console errors: ${errs.length ? errs.slice(0,2).join(' ;; ') : 'none'}`);
  await b.close();
}
