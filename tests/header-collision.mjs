/**
 * HEADER COLLISION — is "🤖 Practice · N chips" actually painted on top of
 * "Trailing 0-1 · 2 left", or is one of them hidden?
 *
 * TWO WAYS TO BE INVISIBLE, and the scanner only catches one:
 *   1. ancestor opacity 0 / visibility hidden  -> overlap-scan.mjs already filters this
 *   2. OCCLUSION by an opaque sibling drawn later -> it does NOT, and BoardReveal is a
 *      full-screen overlay drawn over game.tsx's chrome, so this is the live risk here.
 * Ancestor opacity alone therefore cannot settle it. This crops the header region of a real
 * screenshot during the reveal so the answer comes from paint, not from the DOM — the lesson
 * from the 36-iteration text-over-cards investigation and from the tab-icon artifact.
 *
 *   node tests/header-collision.mjs
 * Writes tests/screenshots/header-<phase>.png
 */
import { chromium } from 'playwright';
import { measure, HarnessError } from './probe-kit.mjs';
import fs from 'fs';

const URL = process.env.CAPS_URL || 'https://caps.ftable.co.il';
const OUT = 'tests/screenshots';
const SEED = { caps_tutorial_seen: 'true', caps_onboarding_done: 'true',
  has_seen_interactive_tutorial: 'true', caps_games_played: '99' };

const fire = `(el)=>{const r=el.getBoundingClientRect();const x=r.left+r.width/2,y=r.top+r.height/2;
const mk=(t,C)=>new C(t,{bubbles:true,cancelable:true,composed:true,clientX:x,clientY:y,pointerId:1,pointerType:'mouse',button:0,buttons:t.includes('up')?0:1,isPrimary:true});
['pointerdown','mousedown','pointerup','mouseup','click'].forEach(t=>el.dispatchEvent(mk(t,t.startsWith('pointer')?PointerEvent:MouseEvent)));}`;

const probe = `(() => {
  const eff = (el) => {           // effective opacity down the ancestor chain
    let n = el, o = 1, d = 0;
    while (n && d < 12) {
      const cs = getComputedStyle(n);
      if (cs.display === 'none' || cs.visibility === 'hidden') return 0;
      o *= parseFloat(cs.opacity);
      n = n.parentElement; d++;
    }
    return o;
  };
  const leaf = [...document.querySelectorAll('*')].filter((e) => !e.children.length);
  const find = (re) => {
    const el = leaf.find((e) => re.test((e.textContent || '').trim()));
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const mid = [Math.round(r.left + r.width / 2), Math.round(r.top + r.height / 2)];
    // What does the browser say is ON TOP at this point? Caveat: elementFromPoint skips
    // pointer-events:none nodes, and the practice pill IS pointerEvents="none" — so this is
    // corroboration only, never the verdict. The pixels are the verdict.
    const top = document.elementFromPoint(mid[0], mid[1]);
    return { text: (el.textContent || '').trim().slice(0, 42),
             box: [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)],
             effOpacity: Number(eff(el).toFixed(3)),
             topAtCentre: top ? (top.textContent || '').trim().slice(0, 42) : null };
  };
  return { practice: find(/Practice ·/), score: find(/Trailing|Leading|Level|Won |Board \\d/), url: location.pathname };
})()`;

fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ headless: false, args: ['--window-size=410,900'] });
const ctx = await browser.newContext({ viewport: { width: 390, height: 812 }, deviceScaleFactor: 2 });
await ctx.addInitScript((s) => { for (const [k, v] of Object.entries(s)) { try { localStorage.setItem(k, v); } catch {} } }, SEED);
const page = await ctx.newPage();

await page.goto(`${URL}/game?practice=true&players=3&fresh=1`, { waitUntil: 'load', timeout: 120000 });
await page.waitForTimeout(9000);

const shot = async (phase) => {
  const r = await measure(page, probe, { label: phase });
  console.log(`\n--- ${phase} (${r.url}) ---`);
  for (const k of ['practice', 'score']) {
    const v = r[k];
    if (!v) { console.log(`  ${k.padEnd(9)} NOT PRESENT`); continue; }
    console.log(`  ${k.padEnd(9)} ${JSON.stringify(v.text)} box=${v.box.join(',')} effOpacity=${v.effOpacity}`);
    console.log(`  ${''.padEnd(9)}   elementFromPoint at its centre -> ${JSON.stringify(v.topAtCentre)}`);
  }
  const f = `${OUT}/header-${phase}.png`;
  await page.screenshot({ path: f, clip: { x: 0, y: 0, width: 390, height: 60 } });
  console.log(`  header crop -> ${f}`);
  return r;
};

await shot('placement');
await page.evaluate(`window.__f=${fire}`);
await page.evaluate(`(()=>{const b=[...document.querySelectorAll('button,[role="button"]')].find(x=>/auto-place all/i.test(x.getAttribute('aria-label')||x.textContent||''));if(b)window.__f(b);})()`);
await page.waitForTimeout(1500);
await page.evaluate(`(()=>{const r=document.querySelector('[data-testid="ready-button"]');if(r)window.__f(r);})()`);
await page.waitForTimeout(7000);
await shot('reveal');
// Deeper in: once a board has resolved, getScoreText(:84-87) switches from "N boards" to
// "Trailing X-Y · N left" — the exact string the overlap scan flagged. Same :756 element, so
// the occlusion question is the same, but this tests the flagged pair directly, not by analogy.
await page.waitForTimeout(13000);
await shot('reveal-late');
await browser.close();
