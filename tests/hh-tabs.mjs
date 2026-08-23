// NO string processing. The previous read applied a replace() whose escaping was uncertain, and
// "Wins" reading as "Win " is exactly what a mangled /s+/g would produce. Codepoints only.
import { webkit, chromium } from 'playwright';
for (const [n, eng] of [['webkit', webkit], ['chromium', chromium]]) {
  const b = await eng.launch({ headless: false });
  const p = await (await b.newContext({ viewport: { width: 393, height: 852 }, ignoreHTTPSErrors: true })).newPage();
  await p.goto('https://caps.ftable.co.il/hand-history', { waitUntil: 'load', timeout: 120000 });
  await p.waitForTimeout(9000);
  const r = await p.evaluate(() => {
    const els = Array.from(document.querySelectorAll('[tabindex="0"]'));
    return els.map((e) => {
      const t = e.textContent || '';
      return { raw: t, len: t.length, cp: Array.from(t).map((ch) => ch.codePointAt(0).toString(16)).join(' ') };
    }).filter((x) => x.len > 0 && x.len < 40);
  });
  console.log('\n== ' + n);
  console.log(JSON.stringify(r, null, 1));
  await b.close();
}
