/**
 * What does result_viewed_duration actually put on the wire?
 *
 * The alignment harness read null for the analytics value on every hand, and null is ambiguous:
 * it means "the event did not fire", "it fired with no result field", or "I am reading the wrong
 * key". This prints EVERY track_event that leaves the page during one hand, with its event name
 * and its full payload keys, so the ambiguity is resolved by observation rather than by guessing
 * at another key name.
 */
import { chromium } from 'playwright';

const SITE = 'https://caps.ftable.co.il';
const fire = `(el) => { for (const t of ['pointerdown','mousedown','pointerup','mouseup','click']) {
  el.dispatchEvent(new MouseEvent(t, { bubbles: true, cancelable: true, view: window })); } }`;

const b = await chromium.launch({ headless: false });
const ctx = await b.newContext({ viewport: { width: 393, height: 852 }, ignoreHTTPSErrors: true });
await ctx.addInitScript(() => {
  try {
    const k = 'caps-poker-storage';
    const cur = JSON.parse(localStorage.getItem(k) || '{}');
    cur.state = { ...(cur.state || {}), config: { ...((cur.state || {}).config || {}), numberOfPlayers: 4 } };
    localStorage.setItem(k, JSON.stringify(cur));
  } catch {}
});
const p = await ctx.newPage();
p.on('dialog', async (d) => { await d.dismiss(); });

const seen = [];
p.on('request', (req) => {
  if (!/rpc\/track_event/.test(req.url())) return;
  try {
    const body = JSON.parse(req.postData() || '{}');
    seen.push({ topKeys: Object.keys(body), event: body.p_event ?? body.event ?? null, data: body.p_data ?? body.p_properties ?? null });
  } catch (e) { seen.push({ parseError: String(e).slice(0, 60), raw: (req.postData() || '').slice(0, 120) }); }
});

await p.goto(`${SITE}/game?fresh=1`, { waitUntil: 'load', timeout: 120000 });
await p.waitForTimeout(7000);
await p.evaluate(`window.__f=${fire}`);
await p.evaluate(`(()=>{const x=[...document.querySelectorAll('button,[role="button"]')]
  .find(e=>/auto-place all/i.test(e.getAttribute('aria-label')||e.textContent||''));if(x)window.__f(x);})()`);
await p.waitForTimeout(2500);
await p.evaluate(`(()=>{const r=document.querySelector('[data-testid="ready-button"]');if(r){window.__f(r);return}
  const x=[...document.querySelectorAll('button,[role="button"]')]
    .find(e=>/^\\s*(ready|confirm)\\b/i.test((e.getAttribute('aria-label')||e.textContent||'').trim()));if(x)window.__f(x);})()`);
for (let i = 0; i < 60; i++) {
  await p.waitForTimeout(1500);
  if (/results/.test(p.url())) break;
  await p.evaluate(`(()=>{const e=[...document.querySelectorAll('*')]
    .filter(x=>/tap to reveal/i.test((x.textContent||'').trim())&&x.children.length<3);
    const el=e[e.length-1]; if(el) window.__f(el.closest('[role="button"],button')||el);})()`).catch(() => {});
}
console.log('reached results:', /results/.test(p.url()));
await p.waitForTimeout(9000);

const before = seen.length;
console.log(`\n--- ${before} track_event calls while ON /results`);

// Unmount by navigating away - this is what fires result_viewed_duration.
await p.goto(`${SITE}/`, { waitUntil: 'load', timeout: 120000 });
await p.waitForTimeout(6000);

console.log(`--- ${seen.length - before} more AFTER leaving /results\n`);
for (const s of seen) console.log('   ' + JSON.stringify(s).slice(0, 260));
const rv = seen.find((s) => s.event === 'result_viewed_duration');
console.log('\nresult_viewed_duration seen:', !!rv);
if (rv) console.log('   payload:', JSON.stringify(rv.data));
await b.close();
