/**
 * TASK 2 — duplicate text nodes in the WIN OVERLAY and on /results.
 *
 * Never scanned before: the probe's auto-place click failed with the screen in a `✓ READY`
 * state, so every previous "duplicate scan" only ever covered the placement screen.
 *
 * DESIGN. It does NOT guess when the celebration appears. The reveal runs ~10s/board (37.8s at
 * 4 boards, measured), so a fixed wait is a coin flip. Instead it samples every 500ms for the
 * whole hand and classifies each sample by what is actually on screen — placement / reveal /
 * celebration / results — then reports duplicates per VIEW. A view that never appeared is
 * reported as never-appeared, not as "no duplicates" (a null measurement is not a negative).
 *
 * Legitimate repeats, carried so a real duplicate is distinguishable:
 *   - Bot 1 / Bot 2 / Board 2   section labels, BoardReveal.tsx:791, one per section
 *   - Auto-Place x3             one per board at 3 players
 *   - Board {n} of {m}          intermission, BoardReveal.tsx:1063
 *
 *   node tests/celebration-duplicates.mjs
 */
import { chromium } from 'playwright';
import { measure, HarnessError } from './probe-kit.mjs';

const URL = process.env.CAPS_URL || 'https://caps.ftable.co.il';
const PLAYERS = process.env.PLAYERS || '3';
const SEED = { caps_tutorial_seen: 'true', caps_onboarding_done: 'true',
  has_seen_interactive_tutorial: 'true', caps_games_played: '99' };

const fire = `(el)=>{const r=el.getBoundingClientRect();const x=r.left+r.width/2,y=r.top+r.height/2;
const mk=(t,C)=>new C(t,{bubbles:true,cancelable:true,composed:true,clientX:x,clientY:y,pointerId:1,pointerType:'mouse',button:0,buttons:t.includes('up')?0:1,isPrimary:true});
['pointerdown','mousedown','pointerup','mouseup','click'].forEach(t=>el.dispatchEvent(mk(t,t.startsWith('pointer')?PointerEvent:MouseEvent)));}`;

// In-page sampler: every 500ms capture every visible leaf text node with its box.
const installSampler = `(() => {
  window.__t0 = performance.now();
  window.__d = [];
  window.__iv = setInterval(() => {
    try {
      const nodes = [];
      for (const el of document.querySelectorAll('*')) {
        if (el.children.length) continue;
        const t = (el.textContent || '').trim();
        if (!t) continue;
        const r = el.getBoundingClientRect();
        if (r.width === 0 && r.height === 0) continue;
        if (r.bottom < 0 || r.top > innerHeight) continue;
        nodes.push({ x: t.slice(0, 46), top: Math.round(r.top), bot: Math.round(r.bottom) });
      }
      window.__d.push({ ms: Math.round(performance.now() - window.__t0), url: location.pathname, nodes });
    } catch (e) { /* keep sampling */ }
  }, 500);
  return true;
})()`;

const browser = await chromium.launch({ headless: false, args: ['--window-size=395,960'] });
const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, deviceScaleFactor: 1 });
await ctx.addInitScript((s) => { for (const [k, v] of Object.entries(s)) { try { localStorage.setItem(k, v); } catch {} } }, SEED);
const page = await ctx.newPage();
const errs = [];
page.on('pageerror', (e) => errs.push(String(e).slice(0, 90)));

await page.goto(`${URL}/game?practice=true&players=${PLAYERS}&fresh=1`, { waitUntil: 'load', timeout: 120000 });
await page.waitForTimeout(9000);
await page.evaluate(`window.__f=${fire}`);

// Auto-place, then Ready. Both are REPORTED — the previous run died here silently.
const placed = await measure(page, `(()=>{const b=[...document.querySelectorAll('button,[role="button"]')]
  .find(x=>/auto-place all/i.test(x.getAttribute('aria-label')||x.textContent||''));
  if(b){window.__f(b);return true;} return false;})()`, { label: 'autoplace' });
await page.waitForTimeout(1500);
await page.evaluate(installSampler);
const ready = await measure(page, `(()=>{const r=document.querySelector('[data-testid="ready-button"]');
  if(r){window.__f(r);return (r.textContent||'').trim().slice(0,24);} return null;})()`, { label: 'ready' });
console.log(`auto-place clicked: ${placed} | ready button: ${JSON.stringify(ready)}`);
if (!placed) console.log('  ⚠ AUTO-PLACE DID NOT CLICK — the reveal will not start. Reporting it, not hiding it.');

// The reveal is ~10s/board; 3 boards ≈ 28-38s. Sample well past it, into the celebration.
await page.waitForTimeout(60000);
await page.evaluate(`(()=>{clearInterval(window.__iv);return true})()`);

let dump;
try { dump = await measure(page, `(()=>window.__d)()`, { label: 'dump' }); }
catch (e) { console.error('HARNESS:', e instanceof HarnessError ? e.message : String(e)); await browser.close(); process.exit(2); }
const samples = Array.isArray(dump) ? dump : [];
if (!samples.length) { console.error('SAMPLER RETURNED NOTHING — failed measurement, not a negative.'); await browser.close(); process.exit(2); }

// Classify each sample by what is on screen.
const has = (s, re) => s.nodes.some((n) => re.test(n.x));
const view = (s) => /results/.test(s.url) ? 'results'
  : has(s, /YOU WIN|YOU LOSE|YOU TIE|TIE GAME/i) ? 'celebration'
  : has(s, /Board \d+ of \d+/i) || has(s, /^Bot \d$/) ? 'reveal'
  : has(s, /auto-place/i) ? 'placement' : 'other';
for (const s of samples) s.view = view(s);

const seen = {};
for (const s of samples) seen[s.view] = (seen[s.view] || 0) + 1;
console.log(`\nsamples=${samples.length} @500ms  views seen: ${JSON.stringify(seen)}`);
console.log(`urls: ${JSON.stringify([...new Set(samples.map((s) => s.url))])}`);

// Duplicates per view: the sample with the MOST duplication is the honest worst case.
for (const v of ['celebration', 'results', 'reveal']) {
  const inView = samples.filter((s) => s.view === v);
  console.log(`\n=== ${v.toUpperCase()} ===`);
  if (!inView.length) { console.log('  NEVER APPEARED — not a negative result; nothing was scanned here.'); continue; }
  let worst = null, worstN = -1;
  for (const s of inView) {
    const c = {};
    for (const n of s.nodes) c[n.x] = (c[n.x] || 0) + 1;
    const dupes = Object.entries(c).filter(([, k]) => k > 1);
    const n = dupes.reduce((a, [, k]) => a + k, 0);
    if (n > worstN) { worstN = n; worst = { s, dupes }; }
  }
  console.log(`  ${inView.length} samples (ms ${inView[0].ms}..${inView[inView.length - 1].ms}); worst at ms ${worst.s.ms}`);
  if (!worst.dupes.length) { console.log('  no text node appears more than once.'); continue; }
  for (const [txt, n] of worst.dupes.sort((a, b) => b[1] - a[1])) {
    const boxes = worst.s.nodes.filter((q) => q.x === txt).map((q) => `${q.top}-${q.bot}`).join(' , ');
    console.log(`  x${n}  ${JSON.stringify(txt)}   at y ${boxes}`);
  }
}

console.log('\npage errors: ' + (errs.length ? JSON.stringify([...new Set(errs)].slice(0, 4)) : 'none'));
await browser.close();
