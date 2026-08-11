/**
 * /results OVERFLOW — verified across MANY DEALS, because hand names are random.
 *
 * The previous verification claimed "offscreen 1 -> 0" from a SINGLE deal, and a later run on
 * the same build showed 2. Nothing had regressed; one sample from a random distribution is not
 * a verification. This plays N hands, records the longest handName each time, and reports the
 * longest seen across all of them alongside the offscreen count.
 *
 * Worst case derived from source rather than hoped for: RANK_PLURAL (utils/handNames.ts:43-46)
 * tops out at 6 chars — Threes / Sevens / Eights / Queens — so the longest possible string is
 * `Full House, Threes over Queens` (30 chars) from the template at :109. Any name at or near
 * 30 chars that fits is the real proof; a lucky short deal proves nothing.
 *
 *   DEALS=8 VIEWPORT=320 node tests/results-overflow-deals.mjs
 */
import { chromium } from 'playwright';
import { measure, HarnessError } from './probe-kit.mjs';

const URL = process.env.CAPS_URL || 'https://caps.ftable.co.il';
const VW = Number(process.env.VIEWPORT || 320);
const DEALS = Number(process.env.DEALS || 8);
const PLAYERS = process.env.PLAYERS || '3';
const SEED = { caps_tutorial_seen: 'true', caps_onboarding_done: 'true',
  has_seen_interactive_tutorial: 'true', caps_games_played: '99' };

const fire = `(el)=>{const r=el.getBoundingClientRect();const x=r.left+r.width/2,y=r.top+r.height/2;
const mk=(t,C)=>new C(t,{bubbles:true,cancelable:true,composed:true,clientX:x,clientY:y,pointerId:1,pointerType:'mouse',button:0,buttons:t.includes('up')?0:1,isPrimary:true});
['pointerdown','mousedown','pointerup','mouseup','click'].forEach(t=>el.dispatchEvent(mk(t,t.startsWith('pointer')?PointerEvent:MouseEvent)));}`;

// Hand-name-shaped strings only, plus anything crossing the right edge.
const probe = `(() => {
  const VW = ${VW};
  const NAME = /^(Royal Flush|Straight Flush|Four of a Kind|Full House|Flush|Straight|Three of a Kind|Two Pair|One Pair|High Card|Pair of |.*-High )/;
  const names = [], off = [];
  for (const el of document.querySelectorAll('*')) {
    if (el.children.length) continue;
    const t = (el.textContent || '').trim();
    if (!t) continue;
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    if (r.right > VW + 0.5 || r.left < -0.5) off.push({ t: t.slice(0,40), l: Math.round(r.left), r: Math.round(r.right) });
    if (NAME.test(t) && t.length > 6) names.push(t);
  }
  return { url: location.pathname, names, off };
})()`;

const browser = await chromium.launch({ headless: false, args: [`--window-size=${VW+20},900`] });
const ctx = await browser.newContext({ viewport: { width: VW, height: 812 }, deviceScaleFactor: 1 });
await ctx.addInitScript((s) => { for (const [k,v] of Object.entries(s)) { try { localStorage.setItem(k,v); } catch {} } }, SEED);
const page = await ctx.newPage();

let longest = '', totalOff = 0, reached = 0;
const offSamples = [];
for (let d = 0; d < DEALS; d++) {
  await page.goto(`${URL}/game?practice=true&players=${PLAYERS}&fresh=1`, { waitUntil: 'load', timeout: 120000 });
  await page.waitForTimeout(8500);
  await page.evaluate(`window.__f=${fire}`);
  const ap = await measure(page, `(()=>{const b=[...document.querySelectorAll('button,[role="button"]')].find(x=>/auto-place all/i.test(x.getAttribute('aria-label')||x.textContent||''));if(b){window.__f(b);return true;}return false;})()`, { label: 'ap' });
  await page.waitForTimeout(1200);
  await page.evaluate(`(()=>{const r=document.querySelector('[data-testid="ready-button"]');if(r)window.__f(r);})()`);
  if (!ap) { console.log(`deal ${d+1}: auto-place MISS — skipped, NOT counted as a pass`); continue; }
  let r = null;
  for (let i = 0; i < 14; i++) { await page.waitForTimeout(3000);
    r = await measure(page, probe, { label: 'p' }); if (/results/.test(r.url)) break; }
  if (!r || !/results/.test(r.url)) { console.log(`deal ${d+1}: never reached /results — FAILED MEASUREMENT, not a pass`); continue; }
  reached++;
  const longestHere = r.names.reduce((a, b) => (b.length > a.length ? b : a), '');
  if (longestHere.length > longest.length) longest = longestHere;
  totalOff += r.off.length;
  if (r.off.length) offSamples.push(...r.off.slice(0, 2));
  console.log(`deal ${d+1}: longest name "${longestHere}" (${longestHere.length}ch) | offscreen ${r.off.length}`);
}
await browser.close();

console.log(`\n=== ${reached}/${DEALS} deals reached /results at ${VW}px ===`);
console.log(`longest hand name seen : "${longest}" (${longest.length} chars)`);
console.log(`theoretical worst case : "Full House, Threes over Queens" (30 chars)`);
console.log(`total offscreen nodes  : ${totalOff}`);
if (offSamples.length) offSamples.slice(0, 5).forEach((o) => console.log(`   OFF: "${o.t}" x${o.l}..${o.r}`));
console.log(reached === 0 ? 'NO DEALS REACHED /results — this run proves NOTHING.'
  : totalOff === 0 ? `PASS across ${reached} deals.` : `STILL OVERFLOWING in ${reached} deals.`);
