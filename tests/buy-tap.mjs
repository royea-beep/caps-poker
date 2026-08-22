/**
 * What does a player actually get when they tap a chip pack?
 * The gate is opened in THIS BROWSER ONLY (one config response rewritten); production is
 * untouched. startCheckout() is expected to report that no provider is configured — the
 * question is whether the player is TOLD that, or just left somewhere.
 */
import { webkit } from 'playwright';
const SITE = process.env.CAPS_URL || 'https://caps.ftable.co.il';
const b = await webkit.launch({ headless: false });
const p = await (await b.newContext({ viewport: { width: 393, height: 900 } })).newPage();
const dialogs = []; p.on('dialog', async (d) => { dialogs.push(`${d.type()}: ${d.message()}`); await d.dismiss(); });
await p.route('**/rest/v1/app_config*', async (r) => r.request().url().includes('web_payments_enabled')
  ? r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ value: true }) })
  : r.continue());
await p.goto(SITE + '/chip-store', { waitUntil: 'domcontentloaded' });
await p.waitForTimeout(9000);
console.log(`   before tap: path=${await p.evaluate(() => location.pathname)}`);
const tapped = await p.evaluate(`(()=>{const x=[...document.querySelectorAll('button,[role="button"]')]
  .find(e=>/Buy 7,000/.test((e.getAttribute('aria-label')||'')+' '+(e.textContent||'')));
  if(!x) return 'NOT FOUND'; x.click(); return 'clicked: '+(x.getAttribute('aria-label')||'');})()`);
console.log(`   tap       : ${tapped}`);
for (const t of [1, 3, 6, 10]) {
  await p.waitForTimeout(t === 1 ? 1000 : 2000);
  const s = await p.evaluate(() => ({ path: location.pathname,
    lines: document.body.innerText.split('\n').map((x) => x.trim()).filter(Boolean).slice(0, 9) }));
  console.log(`   t=${t}s path=${s.path} :: ${JSON.stringify(s.lines)}`);
}
console.log(`   dialogs   : ${JSON.stringify(dialogs)}`);
await b.close();
