/**
 * "עדיין יש פס מעצבן מעל הקלפים" — Roye, still seeing a line ABOVE the cards in the browser.
 *
 * I previously called this fixed after sampling ONE row (y=115) and getting delta 4 from the
 * card face. He still sees it. A single row is not a scan — the same class of mistake as
 * verifying a random hand name on one deal.
 *
 * Note the wording: ABOVE the cards, not on them. My earlier fix targeted the 1px highlight
 * INSIDE the card (Card.tsx:531-547). If the bright row he sees sits OUTSIDE the card's box —
 * a container border, a separator, a shadow — I fixed the wrong element and the measurement
 * that "confirmed" it only ever looked where I had already decided to look.
 *
 * So: scan every pixel row from well above a card to well inside it, print the RGB ladder, and
 * let the numbers say where the bright row actually is relative to the card's top edge.
 *
 *   VIEWPORT=390 node tests/card-line-scan.mjs
 */
import { chromium } from 'playwright';
import { measure, HarnessError } from './probe-kit.mjs';

const URL = process.env.CAPS_URL || 'https://caps.ftable.co.il';
const VW = Number(process.env.VIEWPORT || 390);
const PLAYERS = process.env.PLAYERS || '3';
const SEED = { caps_tutorial_seen: 'true', caps_onboarding_done: 'true',
  has_seen_interactive_tutorial: 'true', caps_games_played: '99' };

// Find a card by its rank/suit glyph's nearest sizeable ancestor — the card face box.
const findCards = `(() => {
  const out = [];
  for (const el of document.querySelectorAll('*')) {
    if (el.children.length) continue;
    const t = (el.textContent || '').trim();
    if (!/^(10|[2-9AKQJ])$/.test(t)) continue;
    let n = el, d = 0;
    while (n && d < 4) {
      const r = n.getBoundingClientRect();
      if (r.width >= 28 && r.width <= 90 && r.height >= 40 && r.height <= 130) {
        out.push({ x: Math.round(r.left + r.width / 2), top: Math.round(r.top),
                   w: Math.round(r.width), h: Math.round(r.height) });
        break;
      }
      n = n.parentElement; d++;
    }
    if (out.length >= 8) break;
  }
  return out;
})()`;

const browser = await chromium.launch({ headless: false, args: [`--window-size=${VW+20},900`] });
const ctx = await browser.newContext({ viewport: { width: VW, height: 812 }, deviceScaleFactor: 1 });
await ctx.addInitScript((s) => { for (const [k,v] of Object.entries(s)) { try { localStorage.setItem(k,v); } catch {} } }, SEED);
const page = await ctx.newPage();
await page.goto(`${URL}/game?practice=true&players=${PLAYERS}&fresh=1`, { waitUntil: 'load', timeout: 120000 });
await page.waitForTimeout(9000);

// RESULTS=1 scans the /results screen instead of placement. That is where StaticCard renders
// (BoardResultCard is its only consumer), and where the white bar survived after Card.tsx was
// fixed — so scanning placement alone could never have caught it.
// REVEAL=1 stops mid-reveal — the surface Roye actually screenshotted (bot rows + community
// row, both Card.tsx). Verifying only placement and /results would again be checking where I
// chose to look rather than where the defect was reported.
if (process.env.REVEAL === '1') {
  const fire2 = `(el)=>{const r=el.getBoundingClientRect();const x=r.left+r.width/2,y=r.top+r.height/2;
const mk=(t,C)=>new C(t,{bubbles:true,cancelable:true,composed:true,clientX:x,clientY:y,pointerId:1,pointerType:'mouse',button:0,buttons:t.includes('up')?0:1,isPrimary:true});
['pointerdown','mousedown','pointerup','mouseup','click'].forEach(t=>el.dispatchEvent(mk(t,t.startsWith('pointer')?PointerEvent:MouseEvent)));}`;
  await page.evaluate(`window.__f=${fire2}`);
  await page.evaluate(`(()=>{const b=[...document.querySelectorAll('button,[role="button"]')].find(x=>/auto-place all/i.test(x.getAttribute('aria-label')||x.textContent||''));if(b)window.__f(b);})()`);
  await page.waitForTimeout(1300);
  await page.evaluate(`(()=>{const r=document.querySelector('[data-testid="ready-button"]');if(r)window.__f(r);})()`);
  await page.waitForTimeout(8000);
  const u = await measure(page, `(()=>location.pathname)()`, { label: 'u' });
  if (/results/.test(u)) { console.error('OVERSHOT INTO /results — reveal NOT captured. FAILED MEASUREMENT.'); await browser.close(); process.exit(2); }
}

if (process.env.RESULTS === '1') {
  const fire = `(el)=>{const r=el.getBoundingClientRect();const x=r.left+r.width/2,y=r.top+r.height/2;
const mk=(t,C)=>new C(t,{bubbles:true,cancelable:true,composed:true,clientX:x,clientY:y,pointerId:1,pointerType:'mouse',button:0,buttons:t.includes('up')?0:1,isPrimary:true});
['pointerdown','mousedown','pointerup','mouseup','click'].forEach(t=>el.dispatchEvent(mk(t,t.startsWith('pointer')?PointerEvent:MouseEvent)));}`;
  await page.evaluate(`window.__f=${fire}`);
  await page.evaluate(`(()=>{const b=[...document.querySelectorAll('button,[role="button"]')].find(x=>/auto-place all/i.test(x.getAttribute('aria-label')||x.textContent||''));if(b)window.__f(b);})()`);
  await page.waitForTimeout(1300);
  await page.evaluate(`(()=>{const r=document.querySelector('[data-testid="ready-button"]');if(r)window.__f(r);})()`);
  let ok = false;
  for (let i = 0; i < 14; i++) { await page.waitForTimeout(3000);
    const u = await measure(page, `(()=>location.pathname)()`, { label: 'u' }); if (/results/.test(u)) { ok = true; break; } }
  if (!ok) { console.error('NEVER REACHED /results — FAILED MEASUREMENT, not a pass.'); await browser.close(); process.exit(2); }
  await page.waitForTimeout(2500);
}

let cards;
try { cards = await measure(page, findCards, { label: 'cards' }); }
catch (e) { console.error('HARNESS:', e instanceof HarnessError ? e.message : String(e)); await browser.close(); process.exit(2); }
if (!Array.isArray(cards) || !cards.length) { console.error('NO CARDS FOUND — failed measurement, not a negative.'); await browser.close(); process.exit(2); }

const buf = await page.screenshot();
const rows = await page.evaluate(async ({ b64, pts }) => {
  const img = await createImageBitmap(await (await fetch('data:image/png;base64,' + b64)).blob());
  const c = document.createElement('canvas');
  c.width = img.width; c.height = img.height;
  const g = c.getContext('2d');
  g.drawImage(img, 0, 0);
  const at = (x, y) => { const d = g.getImageData(x, y, 1, 1).data; return [d[0], d[1], d[2]]; };
  return pts.map((p) => {
    const ladder = [];
    for (let dy = -8; dy <= 10; dy++) ladder.push({ dy, y: p.top + dy, rgb: at(p.x, p.top + dy) });
    return { x: p.x, top: p.top, w: p.w, h: p.h, ladder };
  });
}, { b64: buf.toString('base64'), pts: cards.slice(0, 8) });

// A card mid-animation paints as board colour, and its ladder would read "no bright row" while
// proving nothing. Only cards whose FACE is actually light count as measured.
const painted = rows.filter((r) => {
  const f = r.ladder.find((s) => s.dy === 6);
  return f && (0.2126*f.rgb[0] + 0.7152*f.rgb[1] + 0.0722*f.rgb[2]) > 200;
});
if (!painted.length) {
  console.error(`NO PAINTED CARD FACES among ${rows.length} candidates — cards were still`);
  console.error('animating or had not rendered. FAILED MEASUREMENT, not a clean result.');
  process.exit(2);
}
rows.length = 0; rows.push(...painted.slice(0, 2));
await page.screenshot({ path: `tests/screenshots/cardline-${VW}.png`, clip: { x: 0, y: Math.max(0, cards[0].top - 24), width: VW, height: 90 } });
await browser.close();

const lum = (c) => Math.round(0.2126*c[0] + 0.7152*c[1] + 0.0722*c[2]);
for (const r of rows) {
  console.log(`\n=== card ${r.w}x${r.h} at x=${r.x}, top y=${r.top} ===`);
  console.log('  dy |    y | rgb              | lum | where');
  for (const s of r.ladder) {
    const where = s.dy < 0 ? 'ABOVE the card' : s.dy === 0 ? '<<< card top edge' : 'inside the card';
    console.log(`  ${String(s.dy).padStart(3)} | ${String(s.y).padStart(4)} | ${String(s.rgb.join(',')).padEnd(16)} | ${String(lum(s.rgb)).padStart(3)} | ${where}`);
  }
  const peak = r.ladder.reduce((a, b) => (lum(b.rgb) > lum(a.rgb) ? b : a));
  const face = r.ladder.find((s) => s.dy === 6);
  console.log(`  brightest row: dy=${peak.dy} (${peak.rgb.join(',')} lum ${lum(peak.rgb)}) vs card face at dy=6 (${face.rgb.join(',')} lum ${lum(face.rgb)})`);
  console.log(`  => ${peak.dy < 0 ? 'THE BRIGHT ROW IS OUTSIDE THE CARD — not the Card.tsx highlight.' : peak.dy === 0 || peak.dy === 1 ? 'bright row is the card top edge.' : 'no distinct bright row above the face.'}`);
}
console.log(`\nscreenshot -> tests/screenshots/cardline-${VW}.png`);
