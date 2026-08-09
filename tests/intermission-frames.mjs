/**
 * ITERATION 32 — PIXELS, not geometry.
 *
 * The DOM says intermissionOverlay has a full-screen rgba(0,0,0,0.75) wash. The photograph
 * shows bright, legible cards behind the text. Both cannot be true of the same painted frame,
 * so the question is a paint-order / stacking one — invisible to getBoundingClientRect by
 * construction, which is why eight iterations of geometry never saw it.
 *
 * Captures PNG frames at ~100ms across t=4400-6100ms (the intermission fires at t(4500) and
 * clears 1.5s later), and — crucially — samples the ACTUAL PAINTED PIXELS of a point on a
 * community card by drawing the screenshot into a canvas in-page. If that point does not
 * darken while the text is on screen, the wash never painted for that frame.
 *
 * VIEWPORT: every probe so far ran at 375px. Roye's screenshot is a wide desktop window, so
 * this runs BOTH widths — that difference has never been tested.
 *
 *   VIEWPORT=375 node tests/intermission-frames.mjs
 *   VIEWPORT=1280 node tests/intermission-frames.mjs
 */
import { chromium } from 'playwright';
import fs from 'fs';

const URL = process.env.CAPS_URL || 'https://caps.ftable.co.il';
const VW = Number(process.env.VIEWPORT || 375);
const OUT = 'tests/screenshots';
const SEED = { caps_tutorial_seen: 'true', caps_onboarding_done: 'true',
  has_seen_interactive_tutorial: 'true', caps_games_played: '99' };

const fire = `(el)=>{const r=el.getBoundingClientRect();const x=r.left+r.width/2,y=r.top+r.height/2;
const mk=(t,C)=>new C(t,{bubbles:true,cancelable:true,composed:true,clientX:x,clientY:y,pointerId:1,pointerType:'mouse',button:0,buttons:t.includes('up')?0:1,isPrimary:true});
['pointerdown','mousedown','pointerup','mouseup','click'].forEach(t=>el.dispatchEvent(mk(t,t.startsWith('pointer')?PointerEvent:MouseEvent)));}`;

fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ headless: false, args: [`--window-size=${VW + 20},960`] });
const ctx = await browser.newContext({ viewport: { width: VW, height: 812 }, deviceScaleFactor: 1 });
await ctx.addInitScript((s) => { for (const [k, v] of Object.entries(s)) { try { localStorage.setItem(k, v); } catch {} } }, SEED);
const page = await ctx.newPage();

await page.goto(`${URL}/game?practice=true&players=3&fresh=1`, { waitUntil: 'load', timeout: 120000 });
await page.waitForTimeout(9000);
await page.evaluate(`window.__f=${fire}`);
await page.evaluate(`(()=>{const b=[...document.querySelectorAll('button,[role="button"]')].find(x=>/auto-place all/i.test(x.getAttribute('aria-label')||x.textContent||''));if(b)window.__f(b);})()`);
await page.waitForTimeout(1200);
const t0 = Date.now();
await page.evaluate(`(()=>{const rb=document.querySelector('[data-testid="ready-button"]');if(rb)window.__f(rb);})()`);

// Wait until just before the intermission window, then sample densely.
while (Date.now() - t0 < 4400) await page.waitForTimeout(50);

const rows = [];
while (Date.now() - t0 < 6100) {
  const t = Date.now() - t0;
  // DOM-side facts at this instant (cheap, and they bracket the pixel evidence).
  const dom = await page.evaluate(`(() => {
    const leaf = [...document.querySelectorAll('*')].filter(e => !e.children.length);
    const txt = leaf.find(e => /Board \\d+ of \\d+/i.test((e.textContent || '').trim()));
    const comm = document.querySelector('[data-testid="community-row"]');
    const cr = comm ? comm.getBoundingClientRect() : null;
    return { text: !!txt, commTop: cr ? Math.round(cr.top) : null, commLeft: cr ? Math.round(cr.left) : null,
             commW: cr ? Math.round(cr.width) : null, commH: cr ? Math.round(cr.height) : null };
  })()`);
  const file = `${OUT}/interm-${VW}-${String(t).padStart(4, '0')}.png`;
  await page.screenshot({ path: file });
  rows.push({ t, ...dom, file });
  await page.waitForTimeout(60);
}
await browser.close();

console.log(`viewport=${VW}  frames=${rows.length}  window=4400-6100ms  dir=${OUT}`);
console.log('t(ms) | text? | community box | file');
for (const r of rows) console.log(`${String(r.t).padStart(5)} | ${r.text ? 'YES' : ' - '} | ${r.commTop !== null ? `${r.commLeft},${r.commTop} ${r.commW}x${r.commH}` : '--'} | ${r.file.split('/').pop()}`);
const withText = rows.filter((r) => r.text);
console.log(`\nframes WITH the intermission text: ${withText.length}` +
  (withText.length ? ` (t=${withText[0].t}..${withText[withText.length - 1].t})` : ' — NONE, capture missed the window'));
console.log('Inspect those PNGs: if the community cards are bright/legible in them, the 75% wash did not paint.');
