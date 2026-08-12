/**
 * BATCH 1 edge states — offline scope, and where a brand-new user's chip balance comes from.
 *
 * Every audit so far has driven the happy path. These are the failure paths.
 *
 * TASK 3 first, because "a new user shows 2,530 chips" has two very different explanations: a
 * composed starting balance, or a device_id leak from someone else's account. The probe uses a
 * genuinely fresh context with NO seed, records every credit-shaped network call, and reads the
 * persisted store — so the answer comes from what actually happened, not from arithmetic that
 * happens to add up.
 *
 * TASK 1 then maps which routes survive with the network disabled.
 *
 *   node tests/edge-states.mjs
 */
import { chromium } from 'playwright';
import { measure, HarnessError } from './probe-kit.mjs';

const URL = process.env.CAPS_URL || 'https://caps.ftable.co.il';

const browser = await chromium.launch({ headless: false, args: ['--window-size=410,900'] });

// ── TASK 3 — brand-new user, NO seed at all ───────────────────────────────────────────────
const fresh = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
const p1 = await fresh.newPage();
const credits = [];
p1.on('response', async (r) => {
  const u = r.url();
  if (!/supabase|rpc\//.test(u)) return;
  if (!/claim|reward|streak|bonus|chips|score|battle|tier/i.test(u)) return;
  let body = null;
  try { body = (await r.text()).slice(0, 200); } catch {}
  credits.push({ status: r.status(), rpc: u.split('/').pop().split('?')[0], body });
});
await p1.goto(URL, { waitUntil: 'load', timeout: 120000 });
await p1.waitForTimeout(13000);

const t3 = await measure(p1, `(() => {
  const leaves = [...document.querySelectorAll('*')].filter((e) => !e.children.length);
  const chipNode = leaves.find((e) => /^🪙/.test((e.textContent || '').trim()));
  let store = null, deviceId = null;
  try {
    const raw = localStorage.getItem('caps-poker-storage');
    const j = raw ? JSON.parse(raw) : null;
    store = j?.state ? { chips: j.state.chips, handsPlayed: j.state.handsPlayed } : null;
  } catch {}
  // Concatenation, not a nested template literal: an inner \${...} inside this outer template
  // string gets interpolated by Node before the page ever sees it, which is a syntax error.
  for (const k of Object.keys(localStorage)) if (/device/i.test(k)) deviceId = k + '=' + localStorage.getItem(k);
  return { chipText: chipNode ? (chipNode.textContent || '').trim() : null, store, deviceId,
           lsKeys: Object.keys(localStorage).length };
})()`, { label: 't3' });
await fresh.close();

console.log('=== TASK 3 — brand-new context, NO seed ===');
console.log(`  chip display : ${JSON.stringify(t3.chipText)}`);
console.log(`  persisted    : ${JSON.stringify(t3.store)}`);
console.log(`  device key   : ${t3.deviceId ?? '(none found)'}`);
console.log(`  localStorage keys: ${t3.lsKeys}`);
console.log(`  credit-shaped calls: ${credits.length}`);
for (const c of credits.slice(0, 8)) console.log(`    [${c.status}] ${c.rpc}  ${String(c.body).slice(0, 120)}`);
if (!credits.length && t3.chipText == null) {
  console.error('  COLLECTED NOTHING — failed measurement, not a clean result.');
}

// ── TASK 1 — offline scope, per route ─────────────────────────────────────────────────────
console.log('\n=== TASK 1 — offline, per route ===');
const warm = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
const p2 = await warm.newPage();
// Warm the cache first: a cold-start offline is a different (and less realistic) test than a
// user who already has the app open and then loses signal.
await p2.goto(URL, { waitUntil: 'load', timeout: 120000 });
await p2.waitForTimeout(11000);
const warmBody = await measure(p2, `(() => (document.body.innerText || '').trim().length)()`, { label: 'warm' });
console.log(`  warm home body length (online): ${warmBody}`);

await warm.setOffline(true);

// IN-APP navigation, not page.goto. A hard navigation while offline fails at the NETWORK layer
// with ERR_INTERNET_DISCONNECTED — that is Chrome's error page, not our app, and it is what any
// web app without a service worker does. The realistic case is the one a tester on a train
// actually hits: the app is already open, signal drops, and they tap a tab.
// Re-home between taps so each route is reached from the tab bar rather than from wherever the
// previous tap landed — a modal route hides the tab bar, which is how one tap can masquerade
// as four.
const tapTab = (name) => `(() => {
  const els = [...document.querySelectorAll('a,button,[role="button"],[role="tab"]')];
  // Exact label match. My first version built a regex by string-replacing a placeholder, which
  // matched the wrong control entirely (it landed on /shop and every later tap re-hit the same
  // element, so four "route tests" were really one). Twelfth selector mismatch in this project.
  const want = ${JSON.stringify(name)}.toLowerCase();
  const t = els.find((e) => {
    const label = ((e.getAttribute('aria-label') || '') + ' ' + (e.textContent || '')).trim().toLowerCase();
    return label === want || label.split(/\\s+/).includes(want);
  });
  if (!t) return null;
  const r = t.getBoundingClientRect();
  const x = r.left + r.width / 2, y = r.top + r.height / 2;
  const mk = (ty, C) => new C(ty, { bubbles: true, cancelable: true, composed: true, clientX: x, clientY: y, pointerId: 1, pointerType: 'mouse', button: 0, buttons: ty.includes('up') ? 0 : 1, isPrimary: true });
  ['pointerdown','mousedown','pointerup','mouseup','click'].forEach((ty) => t.dispatchEvent(mk(ty, ty.startsWith('pointer') ? PointerEvent : MouseEvent)));
  return (t.textContent || '').trim().slice(0, 20);
})()`;

for (const tab of ['Play', 'Friends', 'Profile', 'Home']) {
  const hit = await p2.evaluate(tapTab(tab));
  await p2.waitForTimeout(4500);
  const out = await p2.evaluate(`(() => ({ len: (document.body.innerText || '').trim().length,
    kids: document.getElementById('root') ? document.getElementById('root').children.length : 0,
    url: location.pathname,
    sample: (document.body.innerText || '').trim().slice(0, 70) }))()`);
  console.log(`  tap ${String(tab).padEnd(8)} -> ${String(out.url).padEnd(10)} bodyLen ${String(out.len).padStart(5)} | kids ${out.kids} | ${out.len === 0 ? '*** BLANK ***' : JSON.stringify(out.sample)}`);
}

// And a HARD reload while offline, reported separately and honestly: this is the no-service-
// worker case, which is browser behaviour rather than an app defect.
try {
  await p2.reload({ waitUntil: 'load', timeout: 30000 });
  await p2.waitForTimeout(4000);
  const r = await p2.evaluate(`(() => (document.body.innerText || '').trim().length)()`);
  console.log(`  hard reload offline -> bodyLen ${r}`);
} catch (e) {
  console.log(`  hard reload offline -> NAVIGATION FAILED (${String(e).slice(0, 46)}...) — browser-level, no service worker`);
}

// Does it recover on its own when the network returns?
await warm.setOffline(false);
await p2.waitForTimeout(8000);
// Deliberately page.evaluate, not measure(): measure() asserts the page is MOUNTED and throws
// if it is not — correct everywhere else, but here an unmounted page is exactly the result we
// are trying to record, so the assertion would hide the finding.
const recovered = await p2.evaluate(`(() => ({ len: (document.body.innerText || '').trim().length }))()`);
console.log(`  after reconnect, WITHOUT reload: bodyLen ${recovered.len} ${recovered.len === 0 ? '(still blank — needs a reload)' : '(recovered on its own)'}`);
await p2.screenshot({ path: 'tests/screenshots/offline-after-reconnect.png' });
await browser.close();
