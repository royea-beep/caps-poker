/**
 * The placement action bar, measured by CONTAINER — blind spots #1 and #7.
 *
 * A text-node scan reported Cancel 73..137 and Confirm 248..324 comfortably inside a 390px
 * viewport, and Auto-Place ALL "NOT FOUND" — while a screenshot plainly shows the pill sitting
 * on top of both buttons and their rounded containers running past the screen edges.
 *
 * The text node is not the button. What paints is an ancestor with a background and a border
 * radius, and that box is much wider. So this walks UP from each label to the nearest painting
 * ancestor and measures that.
 *
 * No clicks. The state exists on load, with cards still in hand — clicking Auto-Place ALL is
 * what removed the element the previous probe was meant to measure.
 *
 *   VIEWPORT=390 node tests/actionbar-containers.mjs
 */
import { chromium } from 'playwright';
import { measure, HarnessError } from './probe-kit.mjs';

const URL = process.env.CAPS_URL || 'https://caps.ftable.co.il';
const VW = Number(process.env.VIEWPORT || 390);
const PLAYERS = process.env.PLAYERS || '3';
const SEED = { caps_tutorial_seen: 'true', caps_onboarding_done: 'true',
  has_seen_interactive_tutorial: 'true', caps_games_played: '99' };

const expr = `(() => {
  const VW = ${VW};
  const paints = (el) => {
    const cs = getComputedStyle(el);
    const bg = cs.backgroundColor;
    const hasBg = bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent';
    const hasBorder = parseFloat(cs.borderTopWidth) > 0;
    const hasRadius = parseFloat(cs.borderTopLeftRadius) > 0;
    return (hasBg || hasBorder) && hasRadius;
  };
  // Walk up to the nearest ancestor that actually paints a pill.
  const container = (el) => {
    let n = el, d = 0;
    while (n && d < 6) { if (paints(n)) return n; n = n.parentElement; d++; }
    return el;
  };
  const box = (el) => { const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    return { l: Math.round(r.left), r: Math.round(r.right), t: Math.round(r.top),
             b: Math.round(r.bottom), w: Math.round(r.width), h: Math.round(r.height),
             bg: cs.backgroundColor, radius: cs.borderTopLeftRadius }; };

  const leaves = [...document.querySelectorAll('*')].filter((e) => !e.children.length);
  const find = (re) => {
    const el = leaves.find((e) => re.test((e.textContent || '').trim()));
    if (!el) return null;
    const c = container(el);
    return { text: (el.textContent || '').trim().slice(0, 26), textBox: box(el), containerBox: box(c),
             sameNode: c === el };
  };
  return { url: location.pathname, vw: VW,
           autoAll: find(/Auto-Place ALL/i), cancel: find(/^Cancel$/i), confirm: find(/^(Confirm|✓ ?READY|READY)$/i) };
})()`;

const browser = await chromium.launch({ headless: false, args: [`--window-size=${VW + 20},900`] });
const ctx = await browser.newContext({ viewport: { width: VW, height: 812 }, deviceScaleFactor: 1 });
await ctx.addInitScript((s) => { for (const [k, v] of Object.entries(s)) { try { localStorage.setItem(k, v); } catch {} } }, SEED);
const page = await ctx.newPage();
await page.goto(`${URL}/game?practice=true&players=${PLAYERS}&fresh=1`, { waitUntil: 'load', timeout: 120000 });
await page.waitForTimeout(10000);

let d;
try { d = await measure(page, expr, { label: 'containers' }); }
catch (e) { console.error('HARNESS:', e instanceof HarnessError ? e.message : String(e)); await browser.close(); process.exit(2); }
await page.screenshot({ path: `tests/screenshots/actionbar-cont-${VW}.png`, clip: { x: 0, y: 812 - 220, width: VW, height: 220 } });
await browser.close();

console.log(`${PLAYERS}P @${VW} — placement screen, NOTHING clicked\n`);
for (const k of ['autoAll', 'cancel', 'confirm']) {
  const v = d[k];
  if (!v) { console.log(`  ${k.padEnd(8)} NOT FOUND in the DOM`); continue; }
  console.log(`  ${k.padEnd(8)} ${JSON.stringify(v.text)}`);
  console.log(`           text      x ${v.textBox.l}..${v.textBox.r}  y ${v.textBox.t}..${v.textBox.b}`);
  console.log(`           CONTAINER x ${v.containerBox.l}..${v.containerBox.r}  y ${v.containerBox.t}..${v.containerBox.b}  ${v.containerBox.w}x${v.containerBox.h}  bg=${v.containerBox.bg}${v.sameNode ? '  (NO painting ancestor found — same node)' : ''}`);
}
const A = d.autoAll?.containerBox, C = d.cancel?.containerBox, F = d.confirm?.containerBox;
console.log('');
if (A && C) { const ov = Math.min(A.b, C.b) - Math.max(A.t, C.t);
  console.log(`  AutoAll vs Cancel vertical: ${ov > 0 ? ov + 'px OVERLAP' : 'clear by ' + (-ov) + 'px'}`); }
if (A && F) { const ov = Math.min(A.b, F.b) - Math.max(A.t, F.t);
  console.log(`  AutoAll vs Confirm vertical: ${ov > 0 ? ov + 'px OVERLAP' : 'clear by ' + (-ov) + 'px'}`); }
if (C) console.log(`  Cancel left ${C.l} ${C.l < 0 ? '<< OFF-SCREEN LEFT' : 'inside'}`);
if (F) console.log(`  Confirm right ${F.r} vs viewport ${VW} ${F.r > VW ? '>> OFF-SCREEN RIGHT' : 'inside'}`);
console.log(`\n  screenshot -> tests/screenshots/actionbar-cont-${VW}.png`);
