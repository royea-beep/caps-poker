/**
 * Home says 2,530. Shop says 2,000. Are they the same number?
 *
 * Read in ONE session, because the last time two numbers disagreed across runs it was two
 * different devices, not a sync bug — and only a same-run read settled it.
 *
 * Also plays a hand in the middle: if the shop figure is the wallet it should track any change;
 * if it is a config constant it will sit still regardless. 2000 is exactly
 * DEFAULT_CONFIG.startingChips, which makes "config default, not wallet" the leading suspicion.
 *
 *   node tests/balance-same-run.mjs
 */
import { chromium } from 'playwright';
import { measure, HarnessError } from './probe-kit.mjs';

const URL = process.env.CAPS_URL || 'https://caps.ftable.co.il';
const SEED = { caps_tutorial_seen: 'true', caps_onboarding_done: 'true',
  has_seen_interactive_tutorial: 'true', caps_games_played: '99' };

const fire = `(el)=>{const r=el.getBoundingClientRect();const x=r.left+r.width/2,y=r.top+r.height/2;
const mk=(t,C)=>new C(t,{bubbles:true,cancelable:true,composed:true,clientX:x,clientY:y,pointerId:1,pointerType:'mouse',button:0,buttons:t.includes('up')?0:1,isPrimary:true});
['pointerdown','mousedown','pointerup','mouseup','click'].forEach(t=>el.dispatchEvent(mk(t,t.startsWith('pointer')?PointerEvent:MouseEvent)));}`;

// Every money-shaped number on screen, plus the persisted wallet, at one instant.
const money = `(() => {
  const vis = (el) => { let n = el, d = 0; while (n && d < 12) { const c = getComputedStyle(n);
    if (c.display === 'none' || c.visibility === 'hidden' || parseFloat(c.opacity) === 0) return false;
    if (c.transform && /matrix\\(1, 0, 0, 1, [1-9]/.test(c.transform)) return false;
    n = n.parentElement; d++; } return true; };
  const leaves = [...document.querySelectorAll('*')].filter((e) => !e.children.length && vis(e));
  const nums = [];
  for (const e of leaves) {
    const t = (e.textContent || '').trim();
    if (!/[🪙💰🎰]/.test(t) && !/^[\\d,]+$/.test(t)) continue;
    const m = /([\\d,]{3,})/.exec(t);
    if (!m) continue;
    nums.push({ text: t.slice(0, 26), value: Number(m[1].replace(/,/g, '')) });
  }
  let stored = null;
  try { stored = JSON.parse(localStorage.getItem('caps-poker-storage')).state.chips; } catch {}
  return { url: location.pathname, stored, nums,
           device: localStorage.getItem('caps-device-id') };
})()`;

const browser = await chromium.launch({ headless: false, args: ['--window-size=410,900'] });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
await ctx.addInitScript((s) => { for (const [k, v] of Object.entries(s)) { try { localStorage.setItem(k, v); } catch {} } }, SEED);
const page = await ctx.newPage();

const read = async (label, path) => {
  await page.goto(URL + path, { waitUntil: 'load', timeout: 120000 });
  await page.waitForTimeout(path === '/' ? 12000 : 8000);
  let d;
  try { d = await measure(page, money, { label }); }
  catch (e) { console.log(`  ${label.padEnd(22)} HARNESS: ${e instanceof HarnessError ? 'not mounted' : String(e).slice(0, 40)}`); return null; }
  console.log(`  ${label.padEnd(22)} stored ${String(d.stored).padStart(6)} | on screen: ${JSON.stringify(d.nums)}`);
  return d;
};

console.log('SAME SESSION — home then shop:\n');
const home1 = await read('home (before)', '/');
const shop1 = await read('shop (before)', '/shop');
console.log(`\n  device: ${home1?.device}`);

// Play one hand, then read both again. A wallet tracks; a constant does not.
console.log('\nplaying one practice hand...');
await page.goto(`${URL}/game?practice=true&players=3`, { waitUntil: 'load', timeout: 120000 });
await page.waitForTimeout(9000);
await page.evaluate(`window.__f=${fire}`);
await page.evaluate(`(()=>{const b=[...document.querySelectorAll('button,[role="button"]')].find(x=>/auto-place all/i.test(x.getAttribute('aria-label')||x.textContent||''));if(b)window.__f(b);})()`);
await page.waitForTimeout(1500);
await page.evaluate(`(()=>{const r=document.querySelector('[data-testid="ready-button"]');if(r)window.__f(r);})()`);
let reached = false;
for (let i = 0; i < 18; i++) { await page.waitForTimeout(2500); if (/results/.test(page.url())) { reached = true; break; } }
console.log(`  reached /results: ${reached}`);
await page.waitForTimeout(5000);

console.log('\nSAME SESSION — home then shop, AFTER the hand:\n');
const home2 = await read('home (after)', '/');
const shop2 = await read('shop (after)', '/shop');
await browser.close();

if (!home1 || !shop1) { console.error('\nDID NOT COLLECT BOTH SIDES — failed run, not a clean one.'); process.exit(2); }
const pick = (d) => d && d.nums.length ? d.nums.map((n) => n.value) : [];
console.log('\n=== verdict inputs ===');
console.log(`  home  before ${JSON.stringify(pick(home1))}  after ${JSON.stringify(pick(home2))}`);
console.log(`  shop  before ${JSON.stringify(pick(shop1))}  after ${JSON.stringify(pick(shop2))}`);
console.log(`  stored wallet before ${home1.stored} after ${home2 ? home2.stored : '?'}`);
const shopHasWallet = pick(shop1).includes(home1.stored);
console.log(`  does the shop show the SAME number as the stored wallet? ${shopHasWallet}`);
console.log(shopHasWallet
  ? '  => shop renders the wallet; any earlier mismatch was cross-run, not a sync bug.'
  : '  => shop shows a DIFFERENT number from the wallet — identify its source before judging.');
