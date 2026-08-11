/**
 * The placement action bar AFTER cards are placed — where `Cancel` is clipped to `ancel` and
 * `Auto-Place ALL` sits on top of the Cancel/Confirm row.
 *
 * This state only exists post-placement, which is exactly why every single-sample probe missed
 * it. Auto-Place is one click away, so unlike the win banner this is cheap to reach.
 *
 * Reports every control's box, flags anything crossing the viewport edge, and reports vertical
 * overlap between Auto-Place and the action row.
 *
 *   VIEWPORT=320 node tests/action-bar.mjs
 */
import { chromium } from 'playwright';
import { measure, HarnessError } from './probe-kit.mjs';

const URL = process.env.CAPS_URL || 'https://caps.ftable.co.il';
const VW = Number(process.env.VIEWPORT || 390);
const PLAYERS = process.env.PLAYERS || '3';
const SEED = { caps_tutorial_seen: 'true', caps_onboarding_done: 'true',
  has_seen_interactive_tutorial: 'true', caps_games_played: '99' };

const fire = `(el)=>{const r=el.getBoundingClientRect();const x=r.left+r.width/2,y=r.top+r.height/2;
const mk=(t,C)=>new C(t,{bubbles:true,cancelable:true,composed:true,clientX:x,clientY:y,pointerId:1,pointerType:'mouse',button:0,buttons:t.includes('up')?0:1,isPrimary:true});
['pointerdown','mousedown','pointerup','mouseup','click'].forEach(t=>el.dispatchEvent(mk(t,t.startsWith('pointer')?PointerEvent:MouseEvent)));}`;

const expr = `(() => {
  const VW = ${VW};
  const vis = (el) => { let n = el, d = 0; while (n && d < 12) { const c = getComputedStyle(n);
    if (c.display === 'none' || c.visibility === 'hidden' || parseFloat(c.opacity) === 0) return false;
    n = n.parentElement; d++; } return true; };
  const out = [];
  for (const el of document.querySelectorAll('button,[role="button"]')) {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0 || !vis(el)) continue;
    const t = ((el.getAttribute('aria-label') || '') + ' ' + (el.textContent || '')).trim().slice(0, 34);
    out.push({ t, l: Math.round(r.left), r: Math.round(r.right), tp: Math.round(r.top),
               b: Math.round(r.bottom), w: Math.round(r.width), h: Math.round(r.height),
               clipped: r.left < -0.5 || r.right > VW + 0.5 });
  }
  return { url: location.pathname, vw: VW, controls: out };
})()`;

const browser = await chromium.launch({ headless: false, args: [`--window-size=${VW + 20},900`] });
const ctx = await browser.newContext({ viewport: { width: VW, height: 812 }, deviceScaleFactor: 1 });
await ctx.addInitScript((s) => { for (const [k, v] of Object.entries(s)) { try { localStorage.setItem(k, v); } catch {} } }, SEED);
const page = await ctx.newPage();
await page.goto(`${URL}/game?practice=true&players=${PLAYERS}&fresh=1`, { waitUntil: 'load', timeout: 120000 });
await page.waitForTimeout(9000);
await page.evaluate(`window.__f=${fire}`);

// PARTIAL PLACEMENT — deliberately NOT "Auto-Place ALL". That shortcut places every card, which
// HIDES Auto-Place ALL, landing in the one state where the collision cannot exist. That is how
// the previous run produced a false all-clear. The per-board ⚡ chips fill ONE board and leave
// the rest, so Cancel/Confirm appears while Auto-Place ALL is still on screen — both layers
// coexisting, which is the state Roye photographed.
const chips = await measure(page, `(() => {
  const all = [...document.querySelectorAll('button,[role="button"]')];
  const perBoard = all.filter((x) => {
    const t = (x.getAttribute('aria-label') || '') + ' ' + (x.textContent || '');
    return /auto.?fill|auto.?place/i.test(t) && !/all/i.test(t);
  });
  const n = Math.min(${Number(process.env.CHIPS || 1)}, perBoard.length);
  for (let i = 0; i < n; i++) window.__f(perBoard[i]);
  return { found: perBoard.length, clicked: n,
           labels: perBoard.slice(0, 3).map((x) => ((x.getAttribute('aria-label') || x.textContent || '').trim().slice(0, 30))) };
})()`, { label: 'chips' });
console.log(`per-board fill chips found: ${chips.found}, clicked: ${chips.clicked} ${JSON.stringify(chips.labels)}`);
await page.waitForTimeout(2500);

// ASSERT THE STATE before measuring anything. A clean reading from the wrong screen is worse
// than no reading — it is exactly what produced the false all-clear last round.
const state = await measure(page, `(() => {
  const all = [...document.querySelectorAll('button,[role="button"]')];
  const lbl = (x) => ((x.getAttribute('aria-label') || '') + ' ' + (x.textContent || '')).trim();
  return { autoPlaceAll: all.some((x) => /auto-place all/i.test(lbl(x))),
           actionRow: all.some((x) => /^cancel|confirm|ready/i.test(lbl(x))) };
})()`, { label: 'state' });
console.log(`state check — Auto-Place ALL present: ${state.autoPlaceAll} | Cancel/Confirm row present: ${state.actionRow}`);
if (!state.autoPlaceAll || !state.actionRow) {
  console.error('\nNOT IN THE TARGET STATE — both must be present. This is a FAILED MEASUREMENT,');
  console.error('not a clean result. Adjust CHIPS= or the placement route and re-run.');
  await page.screenshot({ path: `tests/screenshots/actionbar-WRONGSTATE-${VW}.png` });
  await browser.close();
  process.exit(2);
}

let d;
try { d = await measure(page, expr, { label: 'bar' }); }
catch (e) { console.error('HARNESS:', e instanceof HarnessError ? e.message : String(e)); await browser.close(); process.exit(2); }
await page.screenshot({ path: `tests/screenshots/actionbar-${VW}.png`, clip: { x: 0, y: 812 - 260, width: VW, height: 260 } });
await browser.close();

console.log(`${PLAYERS}P @${VW} — post-placement controls, sorted by y\n`);
console.log('  y range   | x range   | w x h   | clipped | label');
for (const c of d.controls.sort((a, b) => a.tp - b.tp)) {
  console.log(`  ${String(c.tp).padStart(4)}-${String(c.b).padStart(4)} | ${String(c.l).padStart(4)}-${String(c.r).padStart(4)} | ${String(c.w).padStart(3)}x${String(c.h).padStart(3)} | ${c.clipped ? 'CLIPPED' : '   -   '} | ${JSON.stringify(c.t)}`);
}
const clipped = d.controls.filter((c) => c.clipped);
console.log(`\nclipped controls: ${clipped.length ? clipped.map((c) => `${JSON.stringify(c.t)} x${c.l}..${c.r}`).join(' | ') : 'NONE'}`);
const ap = d.controls.find((c) => /auto-place/i.test(c.t));
const row = d.controls.filter((c) => /cancel|confirm|ready/i.test(c.t));
if (ap && row.length) {
  for (const r of row) {
    const ov = Math.min(ap.b, r.b) - Math.max(ap.tp, r.tp);
    console.log(`Auto-Place (${ap.tp}-${ap.b}) vs ${JSON.stringify(r.t)} (${r.tp}-${r.b}): vertical overlap ${ov > 0 ? ov + 'px OVERLAP' : 'none, gap ' + (-ov) + 'px'}`);
  }
} else console.log(`Auto-Place found: ${!!ap} | action-row controls found: ${row.length}`);
console.log(`screenshot -> tests/screenshots/actionbar-${VW}.png`);
