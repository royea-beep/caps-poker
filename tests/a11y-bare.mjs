// Dumps focusable-but-roleless controls using the loop's own definition, so the count it prints
// can be judged instead of scrolled past.
import { webkit } from 'playwright';
const b = await webkit.launch({ headless: false });
const p = await (await b.newContext({ viewport: { width: 393, height: 852 }, ignoreHTTPSErrors: true })).newPage();
for (const route of ['/hand-history', '/battle-pass']) {
  await p.goto('https://caps.ftable.co.il' + route, { waitUntil: 'load', timeout: 120000 });
  await p.waitForTimeout(9000);
  const r = await p.evaluate(() => Array.from(document.querySelectorAll('[tabindex="0"]'))
    .filter((e) => { const q = e.getBoundingClientRect(); return q.width > 2 && q.height > 2; })
    .filter((e) => !e.getAttribute('role') && e.tagName !== 'BUTTON' && e.tagName !== 'A')
    .map((e) => ({ raw: e.textContent, box: Math.round(e.getBoundingClientRect().width) + 'x' + Math.round(e.getBoundingClientRect().height) })));
  console.log('\n== ' + route + '  (' + r.length + ')');
  console.log(JSON.stringify(r, null, 1));
}
await b.close();
