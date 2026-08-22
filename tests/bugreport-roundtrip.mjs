/**
 * ROUND TRIP — does bug_reports.version now agree with app_version?
 *
 * Verifying by reading code is not enough here: the defect was that two call sites each fell
 * back to their OWN hardcoded literal on web, which only shows up in a real submitted row.
 *
 * Submits ONE report from the live site with an unmistakable marker so the row can be found and
 * deleted afterwards. bug_reports is currently at zero probe rows and must stay that way —
 * the marker is printed so cleanup is unambiguous even if this script dies mid-run.
 *
 *   node tests/bugreport-roundtrip.mjs
 */
import { chromium } from 'playwright';
import { measure, HarnessError } from './probe-kit.mjs';

const URL = process.env.CAPS_URL || 'https://caps.ftable.co.il';
const MARKER = process.env.MARKER || 'PROBE-VERSION-ROUNDTRIP-DELETE-ME';
const SEED = { caps_tutorial_seen: 'true', caps_onboarding_done: 'true',
  has_seen_interactive_tutorial: 'true', caps_games_played: '99' };

const fire = `(el)=>{const r=el.getBoundingClientRect();const x=r.left+r.width/2,y=r.top+r.height/2;
const mk=(t,C)=>new C(t,{bubbles:true,cancelable:true,composed:true,clientX:x,clientY:y,pointerId:1,pointerType:'mouse',button:0,buttons:t.includes('up')?0:1,isPrimary:true});
['pointerdown','mousedown','pointerup','mouseup','click'].forEach(t=>el.dispatchEvent(mk(t,t.startsWith('pointer')?PointerEvent:MouseEvent)));}`;

console.log(`MARKER (delete any row containing this): ${MARKER}\n`);

const browser = await chromium.launch({ headless: false, args: ['--window-size=410,900'] });
const ctx = await browser.newContext({ viewport: { width: 390, height: 812 }, deviceScaleFactor: 1 });
await ctx.addInitScript((s) => { for (const [k, v] of Object.entries(s)) { try { localStorage.setItem(k, v); } catch {} } }, SEED);
const page = await ctx.newPage();
await page.goto(URL, { waitUntil: 'load', timeout: 120000 });
await page.waitForTimeout(11000);
await page.evaluate(`window.__f=${fire}`);

// Open the reporter — Home FAB / any control mentioning a bug report.
const opened = await measure(page, `(() => {
  const els = [...document.querySelectorAll('button,[role="button"],a')];
  const b = els.find((e) => /report a bug|report bug|🐛/i.test((e.getAttribute('aria-label') || '') + ' ' + (e.textContent || '')));
  if (b) { window.__f(b); return (b.getAttribute('aria-label') || b.textContent || '').trim().slice(0, 40); }
  return null;
})()`, { label: 'open' });
console.log(`bug reporter control: ${JSON.stringify(opened)}`);
if (!opened) { console.error('COULD NOT FIND THE REPORTER — FAILED MEASUREMENT, no row submitted.'); await browser.close(); process.exit(2); }
await page.waitForTimeout(2500);

// Type into the first visible textarea/text input, then submit.
const typed = await measure(page, `(() => {
  const ta = [...document.querySelectorAll('textarea,input[type="text"]')].find((e) => e.offsetParent !== null);
  if (!ta) return false;
  const setter = Object.getOwnPropertyDescriptor(ta.constructor.prototype, 'value')?.set;
  setter ? setter.call(ta, ${JSON.stringify(MARKER)}) : (ta.value = ${JSON.stringify(MARKER)});
  ta.dispatchEvent(new Event('input', { bubbles: true }));
  ta.dispatchEvent(new Event('change', { bubbles: true }));
  return true;
})()`, { label: 'type' });
console.log(`typed marker into a field: ${typed}`);
await page.waitForTimeout(1200);

const sent = await measure(page, `(() => {
  const els = [...document.querySelectorAll('button,[role="button"]')];
  const b = els.find((e) => /send|submit/i.test((e.getAttribute('aria-label') || '') + ' ' + (e.textContent || '')) && e.offsetParent !== null);
  if (b) { window.__f(b); return (b.textContent || '').trim().slice(0, 30); }
  return null;
})()`, { label: 'send' });
console.log(`submit control: ${JSON.stringify(sent)}`);
await page.waitForTimeout(8000);
await page.screenshot({ path: 'tests/screenshots/bugreport-roundtrip.png' });
await browser.close();
console.log(`\nNow query:  select version, app_version from bug_reports where description like '%${MARKER}%';`);
console.log(`Then DELETE that row — bug_reports must return to zero probe rows.`);
