/**
 * EVERY response >= 400, with URL, method and request payload, across the whole run.
 *
 * BLIND SPOT #2 of four: the main audit never listened to the network. A 409 Conflict has been
 * repeating on /game, /results and /settings and no probe heard it, because the audit only ever
 * compared text nodes. A 4xx is a finding, not background noise.
 *
 * Captures the REQUEST BODY too — the console line is truncated and does not say which table or
 * RPC is being written, which is the only thing that makes a 409 actionable.
 *
 *   node tests/network-4xx.mjs
 */
import { chromium } from 'playwright';

const URL = process.env.CAPS_URL || 'https://caps.ftable.co.il';
const SEED = { caps_tutorial_seen: 'true', caps_onboarding_done: 'true',
  has_seen_interactive_tutorial: 'true', caps_games_played: '99' };

const browser = await chromium.launch({ headless: false, args: ['--window-size=410,900'] });
const ctx = await browser.newContext({ viewport: { width: 390, height: 812 }, deviceScaleFactor: 1 });
await ctx.addInitScript((s) => { for (const [k, v] of Object.entries(s)) { try { localStorage.setItem(k, v); } catch {} } }, SEED);
const page = await ctx.newPage();

const bad = [];
page.on('response', async (r) => {
  if (r.status() < 400) return;
  const req = r.request();
  let body = null, resBody = null;
  try { body = req.postData(); } catch {}
  try { resBody = (await r.text()).slice(0, 300); } catch {}
  bad.push({ status: r.status(), method: req.method(), url: r.url(),
             payload: body ? body.slice(0, 400) : null, response: resBody, screen: page.url() });
});

const visit = async (path, waitMs = 9000) => {
  console.log(`\n--- visiting ${path} ---`);
  const before = bad.length;
  await page.goto(URL + path, { waitUntil: 'load', timeout: 120000 });
  await page.waitForTimeout(waitMs);
  console.log(`    ${bad.length - before} response(s) >= 400 during this visit`);
};

const fire = `(el)=>{const r=el.getBoundingClientRect();const x=r.left+r.width/2,y=r.top+r.height/2;
const mk=(t,C)=>new C(t,{bubbles:true,cancelable:true,composed:true,clientX:x,clientY:y,pointerId:1,pointerType:'mouse',button:0,buttons:t.includes('up')?0:1,isPrimary:true});
['pointerdown','mousedown','pointerup','mouseup','click'].forEach(t=>el.dispatchEvent(mk(t,t.startsWith('pointer')?PointerEvent:MouseEvent)));}`;

await visit('/');
await visit('/settings');

// PLAY A REAL HAND. Visiting /results cold renders "Loading…" and writes nothing — the
// end-of-hand writes (record_hand_net, submit_score, battle-pass, achievements) are where a
// 409 would come from, and they only fire when a hand actually completes. A cold visit was
// never going to reproduce it.
console.log('\n--- playing a full hand to /results ---');
const before = bad.length;
await page.goto(`${URL}/game?practice=true&players=3&fresh=1`, { waitUntil: 'load', timeout: 120000 });
await page.waitForTimeout(9000);
await page.evaluate(`window.__f=${fire}`);
await page.evaluate(`(()=>{const b=[...document.querySelectorAll('button,[role="button"]')].find(x=>/auto-place all/i.test(x.getAttribute('aria-label')||x.textContent||''));if(b)window.__f(b);})()`);
await page.waitForTimeout(1300);
await page.evaluate(`(()=>{const r=document.querySelector('[data-testid="ready-button"]');if(r)window.__f(r);})()`);
let reached = false;
for (let i = 0; i < 16; i++) {
  await page.waitForTimeout(3000);
  const u = await page.evaluate(`(()=>location.pathname)()`);
  if (/results/.test(u)) { reached = true; break; }
}
await page.waitForTimeout(9000);   // let the end-of-hand write burst finish
console.log(reached ? `    reached /results; ${bad.length - before} response(s) >= 400 during the hand`
                    : `    NEVER REACHED /results — FAILED MEASUREMENT, writes may not have fired`);

// Replay the same hand's results screen and revisit settings, now that a device has history.
await visit('/settings');
await browser.close();

console.log(`\n=== ${bad.length} response(s) >= 400 total ===`);
const seen = new Set();
for (const b of bad) {
  const key = b.status + b.method + b.url.split('?')[0];
  if (seen.has(key)) continue;
  seen.add(key);
  console.log(`\n[${b.status}] ${b.method} ${b.url}`);
  console.log(`   seen on : ${b.screen}`);
  console.log(`   payload : ${b.payload ?? '(none)'}`);
  console.log(`   response: ${b.response ?? '(empty)'}`);
}
const counts = {};
for (const b of bad) counts[b.status] = (counts[b.status] || 0) + 1;
console.log(`\nby status: ${JSON.stringify(counts)}`);
if (!bad.length) console.log('none — but confirm the pages actually loaded before reading this as a pass.');
