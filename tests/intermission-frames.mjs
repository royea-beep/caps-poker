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

// Window MEASURED in iteration 33, not guessed: the intermission text exists at ms
// 6752, 7015, 7252, 7506, 7752, 8006. Iteration 32 captured 4400-6100 and stopped 650ms
// before it began. 6500-8300 brackets it with margin either side.
while (Date.now() - t0 < 6500) await page.waitForTimeout(50);

const rows = [];
while (Date.now() - t0 < 8300) {
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
  const buf = await page.screenshot({ path: file });

  // THE ACTUAL SIGNAL. The DOM cannot tell us whether the 75% wash PAINTED — so read the
  // painted pixels: send the PNG back into the page, draw it to a canvas, and sample a point
  // on a community card. If that point does not darken while the text is on screen, the wash
  // never painted for that frame. No new dependencies, no PNG decoder needed.
  let px = null;
  if (dom.commTop !== null) {
    const sx = dom.commLeft + Math.round(dom.commW / 2);
    const sy = dom.commTop + Math.round(dom.commH / 2);
    px = await page.evaluate(async ({ b64, x, y }) => {
      const img = await createImageBitmap(await (await fetch('data:image/png;base64,' + b64)).blob());
      const c = document.createElement('canvas');
      c.width = img.width; c.height = img.height;
      c.getContext('2d').drawImage(img, 0, 0);
      const d = c.getContext('2d').getImageData(x, y, 1, 1).data;
      return { r: d[0], g: d[1], b: d[2], lum: Math.round(0.2126 * d[0] + 0.7152 * d[1] + 0.0722 * d[2]) };
    }, { b64: buf.toString('base64'), x: sx, y: sy });
  }
  // NOTE: field is `ms`, never `t` — a { t: s.t, ...n } collision overwrote a timestamp with a
  // box coordinate in iteration 32 and cost a full iteration.
  rows.push({ ms: t, text: dom.text, commTop: dom.commTop, commLeft: dom.commLeft,
              commW: dom.commW, commH: dom.commH, px, file });
  await page.waitForTimeout(20);
}
await browser.close();

console.log(`viewport=${VW}  frames=${rows.length}  window=6500-8300ms  dir=${OUT}`);
console.log('ms | text? | card pixel rgb (luminance) | file');
for (const r of rows) console.log(`${String(r.ms).padStart(5)} | ${r.text ? 'TEXT' : ' -- '} | ${r.px ? `${r.px.r},${r.px.g},${r.px.b} (lum ${r.px.lum})` : 'n/a'} | ${r.file.split('/').pop()}`);

const withText = rows.filter((r) => r.text && r.px);
const without = rows.filter((r) => !r.text && r.px);
console.log(`\nframes WITH the intermission text: ${withText.length}` +
  (withText.length ? ` (ms ${withText[0].ms}..${withText[withText.length - 1].ms})` : ' — NONE: FAILED MEASUREMENT, not a negative'));
if (withText.length && without.length) {
  const avg = (a) => Math.round(a.reduce((s, r) => s + r.px.lum, 0) / a.length);
  const lumWith = avg(withText), lumWithout = avg(without);
  console.log(`card luminance WITHOUT text: ${lumWithout}   WITH text: ${lumWith}   delta: ${lumWith - lumWithout}`);
  // A 75% black wash over the card must drop luminance hard. Little/no drop = it never painted.
  console.log(lumWith < lumWithout * 0.5
    ? 'WASH PAINTED — card darkened as expected. The photograph came from some other state.'
    : 'WASH DID NOT PAINT — card stayed bright while the text was on screen. THIS IS THE BUG.');
}
