/**
 * Read the equity bar's RENDERED aria-label off the live page — not from source.
 *
 * The delta only exists on streets after the flop and only when |delta| >= 1, so this samples
 * repeatedly through the reveal and reports BOTH cases: a bar whose chip is showing (label must
 * contain the delta) and one where it is suppressed (label must not).
 *
 * Asserts it collected labels before reporting anything. A run that measures nothing looks
 * exactly like a clean one — a 0-sample jest run nearly passed as "nothing to report" and was
 * caught only by an explicit assertion.
 *
 *   node tests/equity-a11y.mjs
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

// Pair each equity bar's label with whether its delta chip is actually on screen.
const sample = `(() => {
  const bars = [...document.querySelectorAll('[data-testid="equity-bar"]')];
  const chips = [...document.querySelectorAll('[data-testid="delta-chip"]')];
  return bars.map((b) => {
    const chip = chips.find((c) => b.contains(c));
    const cs = chip ? getComputedStyle(chip) : null;
    return { label: b.getAttribute('aria-label'),
             chipPresent: !!chip,
             chipOpacity: cs ? cs.opacity : null,
             chipText: chip ? (chip.textContent || '').trim() : null };
  });
})()`;

const browser = await chromium.launch({ headless: false, args: ['--window-size=410,900'] });
const ctx = await browser.newContext({ viewport: { width: 390, height: 812 }, deviceScaleFactor: 1 });
await ctx.addInitScript((s) => { for (const [k, v] of Object.entries(s)) { try { localStorage.setItem(k, v); } catch {} } }, SEED);
const page = await ctx.newPage();
await page.goto(`${URL}/game?practice=true&players=${PLAYERS}&fresh=1`, { waitUntil: 'load', timeout: 120000 });
await page.waitForTimeout(9000);
await page.evaluate(`window.__f=${fire}`);
await page.evaluate(`(()=>{const b=[...document.querySelectorAll('button,[role="button"]')].find(x=>/auto-place all/i.test(x.getAttribute('aria-label')||x.textContent||''));if(b)window.__f(b);})()`);
await page.waitForTimeout(1300);
await page.evaluate(`(()=>{const r=document.querySelector('[data-testid="ready-button"]');if(r)window.__f(r);})()`);

const withDelta = [], withoutDelta = [];
for (let i = 0; i < 34; i++) {
  await page.waitForTimeout(900);
  let rows;
  try { rows = await measure(page, sample, { label: 's' + i }); } catch { continue; }
  if (!Array.isArray(rows)) continue;
  for (const r of rows) {
    if (!r.label) continue;
    // Classify on DOM PRESENCE, not animated opacity. The chip is mounted exactly when
    // `hasDelta && !pending` (EquityBar.tsx:100) — the same condition the label is gated on —
    // and then FADES IN via chipOpacity. An opacity threshold therefore reports a mid-fade chip
    // as "absent" while the label correctly states the delta, which looks like a disagreement
    // and is not. The label describes state; opacity describes animation.
    if (r.chipPresent) withDelta.push(r);
    else withoutDelta.push(r);
  }
}
await browser.close();

const total = withDelta.length + withoutDelta.length;
if (total === 0) {
  console.error('NO EQUITY-BAR LABELS COLLECTED — this measured nothing. FAILED MEASUREMENT,');
  console.error('not a clean result.');
  process.exit(2);
}
console.log(`collected ${total} label samples (${withDelta.length} with a visible chip, ${withoutDelta.length} without)\n`);

const uniq = (a) => [...new Map(a.map((r) => [r.label, r])).values()];
console.log('--- WITH a delta chip showing ---');
if (!withDelta.length) console.log('  none captured this run (the chip is transient)');
uniq(withDelta).slice(0, 3).forEach((r) => console.log(`  chip ${JSON.stringify(r.chipText)}\n  aria-label: ${JSON.stringify(r.label)}`));
console.log('\n--- WITHOUT a delta chip ---');
uniq(withoutDelta).slice(0, 3).forEach((r) => console.log(`  aria-label: ${JSON.stringify(r.label)}`));

const RE = /your odds (up|down) \d+ percent since the last street/;
const badWith = withDelta.filter((r) => !RE.test(r.label || ''));
const badWithout = withoutDelta.filter((r) => RE.test(r.label || ''));
console.log(`\nlabels WITH a chip that omit the delta   : ${badWith.length} (want 0)`);
console.log(`labels WITHOUT a chip that state a delta : ${badWithout.length} (want 0)`);
console.log(badWith.length === 0 && badWithout.length === 0
  ? 'PASS — spoken and visual states agree in every sample.'
  : 'FAIL — the label and the chip disagree somewhere.');
