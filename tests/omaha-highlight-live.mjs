/**
 * On the live build, does any board still mark more than three community cards?
 *
 * The unit tests (utils/__tests__/omahaHighlight.test.ts) prove the logic exhaustively; this
 * proves the shipped bundle.
 *
 * COUNTING METHOD, and why it is not row-grouping. The first version of this probe grouped cards
 * into rows by vertical position and asserted "a row of 5 is the board". It found nothing: every
 * card matches TWO nested elements (outer frame + inner face), so a 5-card row measured as 10 and
 * no row ever looked like a board. It reported a FAILED RUN rather than "0 violations", which is
 * the only reason the mistake was visible.
 *
 * The invariant used instead needs no row detection. Per board the reveal marks:
 *
 *     2 (your hand) + 2 (opponent's hand) + 3 (the community selection) = 7
 *
 * so the page total must be exactly boardCount x 7. A union bug inflates the community term and
 * breaks the total immediately. Positions are de-duplicated to collapse the nested pairs.
 *
 * Board count is re-derived from the rule, never copied: 2P = 4 boards, 3P = 3, 4P = 2.
 *
 *   node tests/omaha-highlight-live.mjs
 */
import { chromium, webkit } from 'playwright';
import { measure, HarnessError } from './probe-kit.mjs';

const URL = process.env.CAPS_URL || 'https://caps.ftable.co.il';
const SEED = { caps_tutorial_seen: 'true', caps_onboarding_done: 'true',
  has_seen_interactive_tutorial: 'true', caps_games_played: '99' };
const expectedBoards = (players) => (players === 3 ? 3 : players === 4 ? 2 : 4);
const MARKS_PER_BOARD = 7;   // 2 + 2 + 3

const fire = `(el)=>{const r=el.getBoundingClientRect();const x=r.left+r.width/2,y=r.top+r.height/2;
const mk=(t,C)=>new C(t,{bubbles:true,cancelable:true,composed:true,clientX:x,clientY:y,pointerId:1,pointerType:'mouse',button:0,buttons:t.includes('up')?0:1,isPrimary:true});
['pointerdown','mousedown','pointerup','mouseup','click'].forEach(t=>el.dispatchEvent(mk(t,t.startsWith('pointer')?PointerEvent:MouseEvent)));}`;

// Count DISTINCT marked cards. The winner border is rgb(255,215,0) since the gold unification.
const countMarks = `(() => {
  const pos = new Set();
  for (const el of document.querySelectorAll('*')) {
    const q = el.getBoundingClientRect();
    if (q.width < 20 || q.width > 110) continue;
    const ratio = q.height / q.width;
    if (ratio < 1.15 || ratio > 1.75) continue;
    const cs = getComputedStyle(el);
    if (/rgb\\(255, 215, 0\\)/.test(cs.borderTopColor) && (parseFloat(cs.borderTopWidth) || 0) > 0) {
      pos.add(Math.round(q.top) + '|' + Math.round(q.left));
    }
  }
  return { marked: pos.size, onResults: /results/.test(location.pathname),
           rendered: /BOARD 1/i.test(document.body.innerText || '') };
})()`;

let mismatches = 0, measured = 0;
for (const [name, engine] of [['chromium', chromium], ['webkit', webkit]]) {
  for (const players of [2, 3, 4]) {
    const browser = await engine.launch({ headless: false });
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await ctx.addInitScript((s) => { for (const [k, v] of Object.entries(s)) { try { localStorage.setItem(k, v); } catch {} } }, SEED);
    const page = await ctx.newPage();
    try {
      await page.goto(`${URL}/game?practice=true&players=${players}`, { waitUntil: 'load', timeout: 120000 });
      await page.waitForTimeout(9000);
      await page.evaluate(`window.__f=${fire}`);
      await page.evaluate(`(()=>{const b=[...document.querySelectorAll('button,[role="button"]')].find(x=>/auto-place all/i.test(x.getAttribute('aria-label')||x.textContent||''));if(b)window.__f(b);})()`);
      await page.waitForTimeout(1500);
      await page.evaluate(`(()=>{const r=document.querySelector('[data-testid="ready-button"]');if(r)window.__f(r);})()`);
      for (let i = 0; i < 24; i++) { await page.waitForTimeout(2500); if (/results/.test(page.url())) break; }
      // Wait for the boards to render — an unrendered page marks zero cards very convincingly.
      for (let i = 0; i < 12; i++) {
        const ok = await page.evaluate(`(() => /BOARD 1/i.test(document.body.innerText || ''))()`).catch(() => false);
        if (ok) break;
        await page.waitForTimeout(1500);
      }
      await page.waitForTimeout(3000);

      const r = await measure(page, countMarks, { label: `${name}-${players}p` });
      const want = expectedBoards(players) * MARKS_PER_BOARD;
      if (!r.rendered) { console.log(`${name} ${players}P — boards never rendered, INCONCLUSIVE`); }
      else {
        measured++;
        const ok = r.marked === want;
        if (!ok) mismatches++;
        console.log(`${name} ${players}P | marked ${r.marked} | expected ${want} (${expectedBoards(players)} boards x ${MARKS_PER_BOARD}) | ${ok ? 'OK' : '** MISMATCH'}`);
      }
    } catch (e) {
      console.log(`${name} ${players}P — HARNESS ${e instanceof HarnessError ? 'not mounted' : String(e).slice(0, 50)}`);
    }
    await browser.close();
  }
}

console.log(`\n=== ${measured} configurations measured, ${mismatches} mismatches ===`);
if (!measured) { console.error('NOTHING MEASURED — failed run, not a clean one.'); process.exit(2); }
console.log(mismatches === 0
  ? '  every board marks 2 + 2 + 3; the Omaha invariant holds on the live build'
  : '  FAIL — a board marks more than three community cards');
