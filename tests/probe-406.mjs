/**
 * Identify the single 406 seen in the FINAL-QA run. A 406 from PostgREST is what
 * `.single()` returns when the query matched zero rows — so the URL names the table,
 * the filter names the row that is missing. Guessing which of the five `.single()`
 * call sites it is would be a guess; this reads it off the wire.
 */
import { webkit } from 'playwright';
const SITE = process.env.CAPS_URL || 'https://caps.ftable.co.il';
const b = await webkit.launch({ headless: false });
const p = await (await b.newContext({ viewport: { width: 393, height: 900 } })).newPage();
const bad = [];
p.on('response', (r) => { if (r.status() >= 400) bad.push(`${r.status()} ${r.request().method()} ${r.url().slice(0, 190)}`); });
for (const route of ['/', '/chip-store', '/shop', '/referral', '/profile']) {
  await p.goto(SITE + route, { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(8000);
  console.log(`${route.padEnd(14)} failures so far: ${bad.length}`);
}
console.log('\n── NON-2xx RESPONSES');
for (const x of [...new Set(bad)]) console.log('   ' + x);
console.log(`   device: ${await p.evaluate(`localStorage.getItem('caps-device-id')`)}`);
await b.close();
