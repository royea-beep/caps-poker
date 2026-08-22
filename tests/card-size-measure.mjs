/**
 * ITERATION 38 / TASK 1 — measure card FRAMES, not inner glyph nodes.
 *
 * Iteration 37 measured "parent of a suit glyph" and got 23px at 2P, then correctly refused to
 * call the 50pt floor violated because that selector likely picks an INNER element. This uses
 * the proven structural anchor instead: [data-testid="community-row"]'s DIRECT CHILDREN are
 * the cards.
 *
 * Board count dominates the scale ladder: 2P = 4 boards (SMALLEST cards), 4P = 2 boards
 * (largest). Re-derived from the rule, not from a brief — that has been inverted twice.
 *
 *   node tests/card-size-measure.mjs
 */
import { chromium } from 'playwright';
import { measure, show, HarnessError } from './probe-kit.mjs';

const URL = process.env.CAPS_URL || 'https://caps.ftable.co.il';
const W = 375, H = 812;
const SEED = { caps_tutorial_seen: 'true', caps_onboarding_done: 'true',
  has_seen_interactive_tutorial: 'true', caps_games_played: '99' };

const fire = `(el)=>{const r=el.getBoundingClientRect();const x=r.left+r.width/2,y=r.top+r.height/2;
const mk=(t,C)=>new C(t,{bubbles:true,cancelable:true,composed:true,clientX:x,clientY:y,pointerId:1,pointerType:'mouse',button:0,buttons:t.includes('up')?0:1,isPrimary:true});
['pointerdown','mousedown','pointerup','mouseup','click'].forEach(t=>el.dispatchEvent(mk(t,t.startsWith('pointer')?PointerEvent:MouseEvent)));}`;

// Community cards = DIRECT CHILDREN of the anchored row. That is the frame.
// Rank glyph font size read from computed style, for the legibility criterion.
const measureExpr = `(() => {
  const row = document.querySelector('[data-testid="community-row"]');
  const comm = row ? [...row.children].map(c => { const r = c.getBoundingClientRect();
    return { w: Math.round(r.width), h: Math.round(r.height) }; }) : null;
  const glyph = [...document.querySelectorAll('*')].find(e => !e.children.length &&
    /^(10|[2-9AKQJ])$/.test((e.textContent || '').trim()));
  const font = glyph ? Math.round(parseFloat(getComputedStyle(glyph).fontSize)) : null;
  return { comm, font, rowFound: !!row };
})()`;

const browser = await chromium.launch({ headless: false, args: [`--window-size=${W + 20},${H + 140}`] });
const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
await ctx.addInitScript((s) => { for (const [k, v] of Object.entries(s)) { try { localStorage.setItem(k, v); } catch {} } }, SEED);
const page = await ctx.newPage();

const rows = [];
for (const players of ['2', '3', '4']) {
  const boards = players === '2' ? 4 : players === '3' ? 3 : 2;   // re-derived from the rule
  await page.goto(`${URL}/game?practice=true&players=${players}&fresh=1`, { waitUntil: 'load', timeout: 90000 });
  await page.waitForTimeout(8000);
  await page.evaluate(`window.__f=${fire}`);
  await page.evaluate(`(()=>{const b=[...document.querySelectorAll('button,[role="button"]')].find(x=>/auto-place all/i.test(x.getAttribute('aria-label')||x.textContent||''));if(b)window.__f(b);})()`);
  await page.waitForTimeout(1200);
  await page.evaluate(`(()=>{const r=document.querySelector('[data-testid="ready-button"]');if(r)window.__f(r);})()`);
  await page.waitForTimeout(9000);   // into the reveal, where community-row lives
  let m;
  try { m = await measure(page, measureExpr, { label: 'cards' + players }); }
  catch (e) { m = { error: e instanceof HarnessError ? e.message.slice(0, 80) : String(e).slice(0, 80) }; }
  rows.push({ players, boards, ...m });
}
await browser.close();

console.log('cfg | boards | community card WxH (frames)                | rank font px');
for (const r of rows) {
  if (r.error) { console.log(`${r.players}P  | ${r.boards}      | ERROR ${r.error}`); continue; }
  const c = r.comm && r.comm.length ? r.comm.map(x => `${x.w}x${x.h}`).join(' ') : 'ROW NOT FOUND';
  console.log(`${r.players}P  | ${r.boards}      | ${c.padEnd(42)} | ${r.font}`);
}
console.log('\nCRITERIA (375px):');
for (const r of rows) {
  if (r.error || !r.comm || !r.comm.length) { console.log(`  ${r.players}P: NOT MEASURED`); continue; }
  const minH = Math.min(...r.comm.map(c => c.h));
  const minDim = Math.min(...r.comm.map(c => Math.min(c.w, c.h)));
  console.log(`  ${r.players}P (${r.boards} boards): minH ${minH} vs 50pt floor -> ${minH < 50 ? 'BELOW FLOOR' : 'ok'}` +
    ` | smallest dim ${minDim} vs 44px touch -> ${minDim < 44 ? 'BELOW' : 'ok'}` +
    ` | rank font ${r.font} vs ~10px -> ${r.font && r.font < 10 ? 'BELOW' : 'ok'}`);
}
