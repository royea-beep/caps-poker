// Does /chip-store stay put on a FRESH device, or does something navigate away from it?
// Scenario B tapped nothing and still ended on '/', so this samples the path rather than guessing.
import { webkit } from 'playwright';
const SITE = process.env.CAPS_URL || 'https://caps.ftable.co.il';
const b = await webkit.launch({ headless: false });
const p = await (await b.newContext({ viewport: { width: 393, height: 900 } })).newPage();
p.on('dialog', async (d) => { await d.dismiss(); });
await p.goto(SITE + '/chip-store', { waitUntil: 'domcontentloaded' });
for (let t = 2; t <= 26; t += 2) {
  await p.waitForTimeout(2000);
  console.log(`   t=${String(t).padStart(2)}s  path=${await p.evaluate(() => location.pathname)}`);
}
await b.close();
