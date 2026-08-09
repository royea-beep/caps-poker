/**
 * TEXT-OVER-TEXT overlap scan — VISIBILITY-AWARE.
 *
 * WHY THIS EXISTS IN THIS FORM. The scan that reported "all five tab icons render twice,
 * stacked at 100% overlap" compared bounding boxes only. Measuring the DOM ancestry showed
 * both nodes DO exist but exactly one of each pair sits under an ancestor at `opacity: 0` —
 * react-navigation's focused/unfocused cross-fade. Five reported overlaps, zero visible. A box
 * comparison that ignores ancestor opacity manufactures defects.
 *
 * So this walks up from every text node and drops it if any ancestor has opacity 0, visibility
 * hidden, or display none. What survives is what a person can actually see.
 *
 *   node tests/overlap-scan.mjs                 # reveal + /results (plays a hand)
 *   ROUTES=/,/play,/profile node tests/overlap-scan.mjs   # static screens
 */
import { chromium } from 'playwright';
import { measure, HarnessError } from './probe-kit.mjs';

const URL = process.env.CAPS_URL || 'https://caps.ftable.co.il';
const ROUTES = process.env.ROUTES ? process.env.ROUTES.split(',') : null;
const MIN_FRAC = 0.35;
const SEED = { caps_tutorial_seen: 'true', caps_onboarding_done: 'true',
  has_seen_interactive_tutorial: 'true', caps_games_played: '99' };

const fire = `(el)=>{const r=el.getBoundingClientRect();const x=r.left+r.width/2,y=r.top+r.height/2;
const mk=(t,C)=>new C(t,{bubbles:true,cancelable:true,composed:true,clientX:x,clientY:y,pointerId:1,pointerType:'mouse',button:0,buttons:t.includes('up')?0:1,isPrimary:true});
['pointerdown','mousedown','pointerup','mouseup','click'].forEach(t=>el.dispatchEvent(mk(t,t.startsWith('pointer')?PointerEvent:MouseEvent)));}`;

const scan = `(() => {
  const visible = (el) => {
    let n = el, d = 0;
    while (n && d < 12) {
      const cs = getComputedStyle(n);
      if (cs.display === 'none' || cs.visibility === 'hidden') return false;
      if (parseFloat(cs.opacity) === 0) return false;   // <- the tab-icon lesson
      n = n.parentElement; d++;
    }
    return true;
  };
  const nodes = [];
  for (const el of document.querySelectorAll('*')) {
    if (el.children.length) continue;
    const t = (el.textContent || '').trim();
    if (!t) continue;
    const r = el.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) continue;
    if (r.bottom < 0 || r.top > innerHeight) continue;
    if (!visible(el)) continue;
    nodes.push({ t: t.slice(0, 40), l: r.left, r: r.right, tp: r.top, b: r.bottom,
                 a: r.width * r.height, fs: getComputedStyle(el).fontSize });
  }
  const pairs = [];
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const A = nodes[i], B = nodes[j];
      const ow = Math.min(A.r, B.r) - Math.max(A.l, B.l);
      const oh = Math.min(A.b, B.b) - Math.max(A.tp, B.tp);
      if (ow <= 0 || oh <= 0) continue;
      const frac = (ow * oh) / Math.min(A.a, B.a);
      if (frac < ${MIN_FRAC}) continue;
      pairs.push({ a: A.t, b: B.t, pct: Math.round(frac * 100), fsA: A.fs, fsB: B.fs,
                   boxA: [Math.round(A.l), Math.round(A.tp)], boxB: [Math.round(B.l), Math.round(B.tp)] });
    }
  }
  return { count: nodes.length, pairs, url: location.pathname };
})()`;

const browser = await chromium.launch({ headless: false, args: ['--window-size=410,900'] });
const ctx = await browser.newContext({ viewport: { width: 390, height: 812 }, deviceScaleFactor: 1 });
await ctx.addInitScript((s) => { for (const [k, v] of Object.entries(s)) { try { localStorage.setItem(k, v); } catch {} } }, SEED);
const page = await ctx.newPage();

const report = (label, r) => {
  console.log(`\n=== ${label}  (${r.url}, ${r.count} visible text nodes) ===`);
  if (!r.pairs.length) { console.log('  0 overlapping pairs above 35%'); return 0; }
  const seen = new Set();
  for (const p of r.pairs) {
    const k = p.a + '|' + p.b;
    if (seen.has(k)) continue;
    seen.add(k);
    console.log(`  ${String(p.pct).padStart(3)}%  ${JSON.stringify(p.a)} [${p.fsA}] @${p.boxA} OVER ${JSON.stringify(p.b)} [${p.fsB}] @${p.boxB}`);
  }
  return r.pairs.length;
};

if (ROUTES) {
  for (const route of ROUTES) {
    await page.goto(URL + route, { waitUntil: 'load', timeout: 90000 });
    await page.waitForTimeout(7000);
    report(route, await measure(page, scan, { label: 'scan' + route }));
  }
} else {
  await page.goto(`${URL}/game?practice=true&players=3&fresh=1`, { waitUntil: 'load', timeout: 120000 });
  await page.waitForTimeout(9000);
  await page.evaluate(`window.__f=${fire}`);
  await page.evaluate(`(()=>{const b=[...document.querySelectorAll('button,[role="button"]')].find(x=>/auto-place all/i.test(x.getAttribute('aria-label')||x.textContent||''));if(b)window.__f(b);})()`);
  await page.waitForTimeout(1500);
  await page.evaluate(`(()=>{const r=document.querySelector('[data-testid="ready-button"]');if(r)window.__f(r);})()`);

  // The reveal is animated: sample across it, not at one instant.
  let worstReveal = null, worstN = -1;
  for (let i = 0; i < 10; i++) {
    await page.waitForTimeout(2200);
    const r = await measure(page, scan, { label: 'reveal' + i });
    if (/results/.test(r.url)) break;
    if (r.pairs.length > worstN) { worstN = r.pairs.length; worstReveal = r; }
  }
  if (worstReveal) report(`REVEAL (worst of the samples)`, worstReveal);
  else console.log('\nREVEAL NEVER SAMPLED — failed measurement, not a negative.');

  await page.waitForTimeout(9000);
  const res = await measure(page, scan, { label: 'results' });
  report(/results/.test(res.url) ? 'RESULTS' : `RESULTS (NOT REACHED — on ${res.url})`, res);
}
await browser.close();
