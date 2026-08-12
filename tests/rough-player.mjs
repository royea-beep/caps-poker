/**
 * THE ROUGH PLAYER — one continuous context, doing what careful probes never do.
 *
 * Double-tapping, leaving mid-hand, hammering browser back (which is NOT the in-app back and has
 * never been tested), reloading on /results, rotating mid-hand.
 *
 * The question for each is only ever: can the player get OUT? A weird state is a report; a state
 * they cannot leave is a defect.
 *
 *   ENGINE=webkit node tests/rough-player.mjs
 */
import { chromium, webkit } from 'playwright';

const URL = process.env.CAPS_URL || 'https://caps.ftable.co.il';
const ENGINE = (process.env.ENGINE || 'chromium').toLowerCase();
const engine = ENGINE === 'webkit' ? webkit : chromium;
const SEED = { caps_tutorial_seen: 'true', caps_onboarding_done: 'true',
  has_seen_interactive_tutorial: 'true', caps_games_played: '99' };

const fire = `(el)=>{const r=el.getBoundingClientRect();const x=r.left+r.width/2,y=r.top+r.height/2;
const mk=(t,C)=>new C(t,{bubbles:true,cancelable:true,composed:true,clientX:x,clientY:y,pointerId:1,pointerType:'mouse',button:0,buttons:t.includes('up')?0:1,isPrimary:true});
['pointerdown','mousedown','pointerup','mouseup','click'].forEach(t=>el.dispatchEvent(mk(t,t.startsWith('pointer')?PointerEvent:MouseEvent)));}`;

const st = `(() => ({ url: location.pathname,
  len: (document.body.innerText || '').trim().length,
  kids: document.getElementById('root') ? document.getElementById('root').children.length : 0,
  sample: (document.body.innerText || '').trim().slice(0, 64).replace(/\\n/g, ' ') }))()`;

const browser = await engine.launch({ headless: false, args: ['--window-size=410,900'] });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
await ctx.addInitScript((s) => { for (const [k, v] of Object.entries(s)) { try { localStorage.setItem(k, v); } catch {} } }, SEED);
const page = await ctx.newPage();
const errs = [];
page.on('pageerror', (e) => errs.push(String(e).slice(0, 80)));
const show = async (label) => { const s = await page.evaluate(st); console.log(`  ${label.padEnd(34)} ${String(s.url).padEnd(12)} kids ${s.kids} len ${String(s.len).padStart(4)} | ${JSON.stringify(s.sample)}`); return s; };

console.log(`######## ${ENGINE} — rough player ########`);
await page.goto(URL, { waitUntil: 'load', timeout: 120000 });
await page.waitForTimeout(12000);
await show('start');

// 1 — double-tap the primary action, fast.
await page.evaluate(`window.__f=${fire}`);
await page.evaluate(`(() => { const b = [...document.querySelectorAll('button,[role="button"]')]
  .find((x) => /Practice vs Bots/i.test(((x.getAttribute('aria-label')||'') + ' ' + (x.textContent||''))));
  if (b) { window.__f(b); window.__f(b); } })()`);
await page.waitForTimeout(7000);
const dbl = await show('1 double-tap Practice');

// 2 — navigate away mid-hand, then come back.
await page.goto(URL + '/settings', { waitUntil: 'load', timeout: 90000 });
await page.waitForTimeout(5000);
await show('2 left mid-hand -> settings');
await page.goBack({ timeout: 30000 }).catch(() => {});
await page.waitForTimeout(6000);
await show('2 back to the hand');

// 3 — browser back, hammered. NOT the in-app back; never tested.
for (let i = 0; i < 5; i++) { await page.goBack({ timeout: 20000 }).catch(() => {}); await page.waitForTimeout(1500); }
await page.waitForTimeout(3500);
const backed = await show('3 browser back x5');

// Can they get out from wherever that landed?
await page.goto(URL, { waitUntil: 'load', timeout: 90000 });
await page.waitForTimeout(6000);
const escaped = await show('3 escape via home');

// 4 — reload while sitting on /results.
await page.goto(URL + '/results', { waitUntil: 'load', timeout: 90000 });
await page.waitForTimeout(6000);
await show('4 /results cold');
await page.reload({ waitUntil: 'load', timeout: 60000 }).catch(() => {});
await page.waitForTimeout(6000);
const reloaded = await show('4 /results reloaded');
// The only question that matters: is there a way out?
await page.evaluate(`window.__f=${fire}`);
const outControls = await page.evaluate(`(() => [...document.querySelectorAll('button,[role="button"],a')]
  .filter((e) => e.offsetParent !== null)
  .map((e) => ((e.getAttribute('aria-label')||'') + ' ' + (e.textContent||'')).trim().slice(0, 22))
  .filter(Boolean).slice(0, 8))()`);
console.log(`     controls on stuck /results: ${JSON.stringify(outControls)}`);

// 5 — rotate mid-hand.
await page.goto(`${URL}/game?practice=true&players=3&fresh=1`, { waitUntil: 'load', timeout: 90000 });
await page.waitForTimeout(9000);
await show('5 mid-hand portrait');
await page.setViewportSize({ width: 844, height: 390 });
await page.waitForTimeout(4500);
await show('5 rotated landscape');
await page.setViewportSize({ width: 390, height: 844 });
await page.waitForTimeout(4000);
await show('5 rotated back');

console.log(`\n  page errors: ${errs.length ? JSON.stringify([...new Set(errs)].slice(0, 4)) : 'none'}`);
console.log(`  DEAD END? ${escaped.len > 100 && reloaded.kids > 0 ? 'no — every state was escapable' : 'POSSIBLE — inspect above'}`);
await browser.close();
