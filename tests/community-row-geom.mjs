/**
 * COMMUNITY ROW — are the five cards the same width and evenly pitched?
 *
 * Measured from Roye's reveal screenshot: after card 3 there is a ~12px cream sliver with its
 * own gold edge, and the face-down back is ~73% the width of a face-up card and starts ~18px
 * late. That is consistent with the face-down card failing to cover the slot beneath it.
 *
 * This measures the DIRECT CHILDREN of [data-testid="community-row"] — the proven anchor —
 * reporting each child's left/right/width and the gap between consecutive children. A negative
 * gap is an overlap; a gap wider than its neighbours is a hole. Diagnosis before any change.
 *
 *   PLAYERS=3 VIEWPORT=390 node tests/community-row-geom.mjs
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
  const row = document.querySelector('[data-testid="community-row"]');
  if (!row) return { found: false };
  const rr = row.getBoundingClientRect();
  const cs = getComputedStyle(row);
  const kids = [...row.children].map((c) => {
    const r = c.getBoundingClientRect();
    // Face-down backs render the CAPS "C" logo; face-up cards render a rank glyph.
    const txt = (c.textContent || '').trim();
    return { l: Math.round(r.left), r: Math.round(r.right), w: Math.round(r.width),
             h: Math.round(r.height), kind: /^[C]+$/.test(txt) ? 'back' : (txt ? 'face:' + txt.slice(0,4) : '?') };
  });
  const gaps = [];
  for (let i = 1; i < kids.length; i++) gaps.push(kids[i].l - kids[i-1].r);
  return { found: true, rowL: Math.round(rr.left), rowW: Math.round(rr.width),
           justify: cs.justifyContent, gapStyle: cs.gap, kids, gaps };
})()`;

const browser = await chromium.launch({ headless: false, args: [`--window-size=${VW+20},900`] });
const ctx = await browser.newContext({ viewport: { width: VW, height: 812 }, deviceScaleFactor: 1 });
await ctx.addInitScript((s) => { for (const [k,v] of Object.entries(s)) { try { localStorage.setItem(k,v); } catch {} } }, SEED);
const page = await ctx.newPage();
await page.goto(`${URL}/game?practice=true&players=${PLAYERS}&fresh=1`, { waitUntil: 'load', timeout: 120000 });
await page.waitForTimeout(9000);
await page.evaluate(`window.__f=${fire}`);
await page.evaluate(`(()=>{const b=[...document.querySelectorAll('button,[role="button"]')].find(x=>/auto-place all/i.test(x.getAttribute('aria-label')||x.textContent||''));if(b)window.__f(b);})()`);
await page.waitForTimeout(1300);
await page.evaluate(`(()=>{const r=document.querySelector('[data-testid="ready-button"]');if(r)window.__f(r);})()`);
// WAIT_MS controls WHICH reveal state gets measured, and it matters: at ~8s the turn and river
// are already open and all five cards are face-up, which is NOT the state Roye screenshotted
// (flop only — three face-up, two face-down backs). The face-down backs are the whole question,
// so a late sample cannot answer it.
await page.waitForTimeout(Number(process.env.WAIT_MS || 8000));

let d;
try { d = await measure(page, expr, { label: 'row' }); }
catch (e) { console.error('HARNESS:', e instanceof HarnessError ? e.message : String(e)); await browser.close(); process.exit(2); }
if (!d.found) { console.error('community-row NOT FOUND — the reveal was not reached. FAILED MEASUREMENT, not a pass.'); await browser.close(); process.exit(2); }
// PIXEL SCAN — geometry says the gap is +4, but only paint proves nothing cream or gold sits
// in it. Sample every pixel column of each inter-card gap at the row's mid-height.
const rowMidY = await page.evaluate(`(()=>{const r=document.querySelector('[data-testid="community-row"]').getBoundingClientRect();return Math.round(r.top + r.height/2)})()`);
const buf = await page.screenshot();
const scan = await page.evaluate(async ({ b64, kids, midY }) => {
  const img = await createImageBitmap(await (await fetch('data:image/png;base64,' + b64)).blob());
  const c = document.createElement('canvas');
  c.width = img.width; c.height = img.height;
  const g = c.getContext('2d');
  g.drawImage(img, 0, 0);
  const at = (x, y) => { const d = g.getImageData(x, y, 1, 1).data; return [d[0], d[1], d[2]]; };
  const out = [];
  for (let i = 1; i < kids.length; i++) {
    const cols = [];
    for (let x = kids[i-1].r; x < kids[i].l; x++) cols.push({ x, rgb: at(x, midY) });
    out.push({ between: `${i}-${i+1}`, cols });
  }
  return out;
}, { b64: buf.toString('base64'), kids: d.kids, midY: rowMidY });

// A gap column is CLEAN if it is dark (card faces are ~250 lum, gold border ~168, board ~45).
const lum = (c) => 0.2126*c[0] + 0.7152*c[1] + 0.0722*c[2];
let dirty = 0;
for (const gp of scan) {
  const bad = gp.cols.filter((c) => lum(c.rgb) > 120);
  if (bad.length) { dirty++; console.log(`  gap ${gp.between}: ${bad.length}/${gp.cols.length} NON-BOARD cols e.g. (${bad[0].rgb.join(',')})`); }
}
console.log(`  PIXEL SCAN: ${dirty === 0 ? 'CLEAN — only dark board between adjacent cards' : `${dirty} gap(s) contain cream/gold`}`);

await page.screenshot({ path: `tests/screenshots/commrow-${PLAYERS}p-${VW}.png`, clip: { x: 0, y: 0, width: VW, height: 400 } });
await browser.close();

console.log(`${PLAYERS}P @${VW} — community-row x${d.rowL} w${d.rowW}  justify=${d.justify} gap=${d.gapStyle}`);
console.log('  #  kind        left  right  width');
d.kids.forEach((k, i) => console.log(`  ${i+1}  ${String(k.kind).padEnd(10)} ${String(k.l).padStart(5)} ${String(k.r).padStart(6)} ${String(k.w).padStart(6)}`));
console.log(`  gaps between children: ${d.gaps.join(', ')}`);
const ws = d.kids.map((k) => k.w);
const uniform = ws.length > 0 && Math.max(...ws) - Math.min(...ws) <= 1;
console.log(`  widths ${uniform ? 'UNIFORM' : 'MISMATCHED'} (min ${Math.min(...ws)}, max ${Math.max(...ws)})`);
const neg = d.gaps.filter((g) => g < 0);
console.log(`  ${neg.length ? `OVERLAP: ${neg.length} negative gap(s)` : 'no negative gaps'}`);
console.log(`  screenshot -> tests/screenshots/commrow-${PLAYERS}p-${VW}.png`);
