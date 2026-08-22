/**
 * The FINAL-QA sweep showed five screens with almost nothing on them:
 *   /rank exp=1 · /replay 4 lines · /heatmap 7 · /stats 7 · /coaching 7
 * A control count alone does not say whether that is a placeholder a tester will hit or a
 * screen nothing links to. This reads the ACTUAL TEXT, and — separately — whether anything
 * in the shipped app navigates there.
 */
import { webkit } from 'playwright';
const SITE = process.env.CAPS_URL || 'https://caps.ftable.co.il';
const b = await webkit.launch({ headless: false });
const p = await (await b.newContext({ viewport: { width: 393, height: 900 } })).newPage();
p.on('dialog', async (d) => { await d.dismiss(); });
for (const r of ['/rank', '/replay', '/heatmap', '/stats', '/coaching', '/hand-history', '/missions']) {
  await p.goto(SITE + r, { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(7000);
  const s = await p.evaluate(() => {
    const vis = (e) => { const q = e.getBoundingClientRect(); return q.width > 2 && q.height > 2; };
    return {
      lines: document.body.innerText.split('\n').map((x) => x.trim()).filter(Boolean),
      controls: [...document.querySelectorAll('button,[role="button"],[role="tab"],a[href]')]
        .filter(vis).map((e) => (e.getAttribute('aria-label') || e.textContent || '').trim().slice(0, 40)),
    };
  });
  console.log(`\n── ${r}`);
  console.log(`   text    : ${JSON.stringify(s.lines)}`);
  console.log(`   controls: ${JSON.stringify(s.controls)}`);
}
console.log(`\n   device: ${await p.evaluate(`localStorage.getItem('caps-device-id')`)}`);
await b.close();
