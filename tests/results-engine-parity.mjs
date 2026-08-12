/**
 * Is /results empty on WebKit, and does /game overlap more there?
 *
 * The claim is Chromium 8 elements vs WebKit 0 on /results, and 3 vs 8 overlaps on /game. My own
 * simulation last round measured WebKit /results at 289-307 visible text nodes and 1296-1454
 * chars, five times — so the two readings disagree and one of them is measuring the wrong thing.
 *
 * This counts SEVERAL ways at once — root children, all elements, visible text nodes, body
 * length — so a disagreement points at WHICH metric, not just that there is one. Both engines,
 * both widths, same process.
 *
 *   node tests/results-engine-parity.mjs
 */
import { chromium, webkit } from 'playwright';
import { measure, HarnessError } from './probe-kit.mjs';

const URL = process.env.CAPS_URL || 'https://caps.ftable.co.il';
const SEED = { caps_tutorial_seen: 'true', caps_onboarding_done: 'true',
  has_seen_interactive_tutorial: 'true', caps_games_played: '99' };

const fire = `(el)=>{const r=el.getBoundingClientRect();const x=r.left+r.width/2,y=r.top+r.height/2;
const mk=(t,C)=>new C(t,{bubbles:true,cancelable:true,composed:true,clientX:x,clientY:y,pointerId:1,pointerType:'mouse',button:0,buttons:t.includes('up')?0:1,isPrimary:true});
['pointerdown','mousedown','pointerup','mouseup','click'].forEach(t=>el.dispatchEvent(mk(t,t.startsWith('pointer')?PointerEvent:MouseEvent)));}`;

const count = `(() => {
  const vis = (el) => { let n = el, d = 0; while (n && d < 12) { const c = getComputedStyle(n);
    if (c.display === 'none' || c.visibility === 'hidden' || parseFloat(c.opacity) === 0) return false;
    if (c.transform && /matrix\\(1, 0, 0, 1, [1-9]/.test(c.transform)) return false;
    n = n.parentElement; d++; } return true; };
  const GLYPH = /^([♠♥♦♣]|10|[2-9AKQJC])$/;
  const root = document.getElementById('root');
  const leaves = [...document.querySelectorAll('*')].filter((e) => !e.children.length && vis(e));
  const boxes = [];
  for (const e of leaves) {
    const t = (e.textContent || '').trim(); if (!t || GLYPH.test(t)) continue;
    const r = e.getBoundingClientRect(); if (r.width <= 0 || r.height <= 0) continue;
    boxes.push({ t: t.slice(0, 20), l: r.left, r: r.right, tp: r.top, b: r.bottom, a: r.width * r.height });
  }
  let overlaps = 0; const pairs = [];
  for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
    const A = boxes[i], B = boxes[j];
    const ow = Math.min(A.r, B.r) - Math.max(A.l, B.l), oh = Math.min(A.b, B.b) - Math.max(A.tp, B.tp);
    if (ow <= 0 || oh <= 0) continue;
    if ((ow * oh) / Math.min(A.a, B.a) < 0.35) continue;
    overlaps++; if (pairs.length < 6) pairs.push(A.t + ' / ' + B.t);
  }
  return { url: location.pathname,
           rootKids: root ? root.children.length : -1,
           allElements: document.querySelectorAll('*').length,
           visibleLeaves: leaves.length,
           bodyLen: (document.body.innerText || '').trim().length,
           overlaps, pairs };
})()`;

for (const VW of [390, 320]) {
  for (const [name, engine] of [['chromium', chromium], ['webkit', webkit]]) {
    const browser = await engine.launch({ headless: false });
    const ctx = await browser.newContext({ viewport: { width: VW, height: 844 } });
    await ctx.addInitScript((s) => { for (const [k, v] of Object.entries(s)) { try { localStorage.setItem(k, v); } catch {} } }, SEED);
    const page = await ctx.newPage();
    await page.goto(`${URL}/game?practice=true&players=3&fresh=1`, { waitUntil: 'load', timeout: 120000 });
    await page.waitForTimeout(10000);
    await page.evaluate(`window.__f=${fire}`);

    let g;
    try { g = await measure(page, count, { label: 'game' }); }
    catch (e) { g = { overlaps: -1, pairs: ['GAME NOT MOUNTED'], visibleLeaves: -1, rootKids: -1, allElements: -1, bodyLen: -1 }; }

    await page.evaluate(`(()=>{const b=[...document.querySelectorAll('button,[role="button"]')].find(x=>/auto-place all/i.test(x.getAttribute('aria-label')||x.textContent||''));if(b)window.__f(b);})()`);
    await page.waitForTimeout(1500);
    await page.evaluate(`(()=>{const r=document.querySelector('[data-testid="ready-button"]');if(r)window.__f(r);})()`);
    let reached = false;
    for (let i = 0; i < 18; i++) {
      await page.waitForTimeout(2500);
      const u = await page.evaluate(`(()=>location.pathname)()`);
      if (/results/.test(u)) { reached = true; break; }
    }
    await page.waitForTimeout(4000);
    let r;
    try { r = await measure(page, count, { label: 'results' }); }
    catch (e) { r = { rootKids: -1, allElements: -1, visibleLeaves: -1, bodyLen: -1, overlaps: -1, pairs: ['RESULTS NOT MOUNTED'] }; }

    console.log(`\n### ${name} @${VW}`);
    console.log(`  /game    rootKids ${g.rootKids} | allEls ${g.allElements} | visLeaves ${g.visibleLeaves} | bodyLen ${g.bodyLen} | overlaps ${g.overlaps}`);
    if (g.pairs && g.pairs.length) console.log(`           pairs: ${JSON.stringify(g.pairs)}`);
    console.log(`  reached /results: ${reached}`);
    console.log(`  /results rootKids ${r.rootKids} | allEls ${r.allElements} | visLeaves ${r.visibleLeaves} | bodyLen ${r.bodyLen} | overlaps ${r.overlaps}`);
    if (r.pairs && r.pairs.length) console.log(`           pairs: ${JSON.stringify(r.pairs)}`);
    await browser.close();
  }
}
