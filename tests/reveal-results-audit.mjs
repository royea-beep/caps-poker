/**
 * THE SIX CHECKS on the two screens that have never been audited: REVEAL and /RESULTS.
 *
 * Two earlier attempts failed here — "Auto-Place ALL" returned MISS and all five sampled
 * states came back identical, meaning the game never advanced. That was a FAILED MEASUREMENT
 * reported as a result. This uses the click sequence proven by overlap-scan.mjs and the
 * celebration probe (both reached /results), and it ASSERTS it got there: if the URL never
 * becomes /results, or the reveal never renders, it says so instead of reporting placement.
 *
 * Checks: overlaps (visibility-aware) · clipped · off-screen · <10px text · <44px targets ·
 * empty bands >70px.
 *
 * Card-internal overlaps are EXCLUDED: a rank over a suit inside one card face, or the "C"
 * back logo, is composition. Only pairs between independent components are reported.
 *
 *   PLAYERS=3 VIEWPORT=390 node tests/reveal-results-audit.mjs
 */
import { chromium } from 'playwright';
import { measure, HarnessError } from './probe-kit.mjs';

const URL = process.env.CAPS_URL || 'https://caps.ftable.co.il';
const PLAYERS = process.env.PLAYERS || '3';
const VW = Number(process.env.VIEWPORT || 390);
const SEED = { caps_tutorial_seen: 'true', caps_onboarding_done: 'true',
  has_seen_interactive_tutorial: 'true', caps_games_played: '99' };

const fire = `(el)=>{const r=el.getBoundingClientRect();const x=r.left+r.width/2,y=r.top+r.height/2;
const mk=(t,C)=>new C(t,{bubbles:true,cancelable:true,composed:true,clientX:x,clientY:y,pointerId:1,pointerType:'mouse',button:0,buttons:t.includes('up')?0:1,isPrimary:true});
['pointerdown','mousedown','pointerup','mouseup','click'].forEach(t=>el.dispatchEvent(mk(t,t.startsWith('pointer')?PointerEvent:MouseEvent)));}`;

const audit = `(() => {
  const VW = ${VW};
  const GLYPH = /^([♠♥♦♣]|10|[2-9AKQJC])$/;          // card composition, not copy
  const vis = (el) => { let n = el, d = 0; while (n && d < 12) { const c = getComputedStyle(n);
    if (c.display === 'none' || c.visibility === 'hidden' || parseFloat(c.opacity) === 0) return false;
    n = n.parentElement; d++; } return true; };

  const texts = [], targets = [], clipped = [], offscreen = [], tiny = [];
  for (const el of document.querySelectorAll('*')) {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    if (!vis(el)) continue;
    const role = el.getAttribute('role');
    const tag = el.tagName.toLowerCase();
    if (role === 'button' || tag === 'button' || tag === 'a') {
      if (r.width < 44 || r.height < 44) targets.push({ t: (el.textContent||'').trim().slice(0,26),
        w: Math.round(r.width), h: Math.round(r.height) });
    }
    if (el.children.length) continue;
    const t = (el.textContent || '').trim();
    if (!t) continue;
    const fs = Math.round(parseFloat(getComputedStyle(el).fontSize));
    if (r.bottom < 0 || r.top > innerHeight) continue;
    if (el.scrollWidth > el.clientWidth + 1 && el.clientWidth > 0) clipped.push({ t: t.slice(0,30), sw: el.scrollWidth, cw: el.clientWidth });
    if (r.right > VW + 0.5 || r.left < -0.5) offscreen.push({ t: t.slice(0,30), l: Math.round(r.left), r: Math.round(r.right) });
    if (fs < 10 && !GLYPH.test(t)) tiny.push({ t: t.slice(0,30), fs });
    texts.push({ t, l: r.left, r: r.right, tp: r.top, b: r.bottom, a: r.width*r.height, fs });
  }

  const overlaps = [];
  for (let i = 0; i < texts.length; i++) for (let j = i+1; j < texts.length; j++) {
    const A = texts[i], B = texts[j];
    if (GLYPH.test(A.t) && GLYPH.test(B.t)) continue;      // card-internal composition
    if (GLYPH.test(A.t) || GLYPH.test(B.t)) continue;      // glyph over its own card face
    const ow = Math.min(A.r,B.r) - Math.max(A.l,B.l), oh = Math.min(A.b,B.b) - Math.max(A.tp,B.tp);
    if (ow <= 0 || oh <= 0) continue;
    const frac = (ow*oh) / Math.min(A.a, B.a);
    if (frac < 0.35) continue;
    overlaps.push({ a: A.t.slice(0,28), b: B.t.slice(0,28), pct: Math.round(frac*100) });
  }

  // Empty vertical bands: gaps between occupied rows, over 70px.
  const rows = texts.map(t => [Math.round(t.tp), Math.round(t.b)]).sort((a,b)=>a[0]-b[0]);
  const gaps = []; let cur = 0;
  for (const [tp, b] of rows) { if (tp - cur > 70) gaps.push({ from: cur, to: tp, px: tp - cur }); cur = Math.max(cur, b); }
  return { url: location.pathname, n: texts.length, overlaps, clipped, offscreen, tiny, targets, gaps };
})()`;

const browser = await chromium.launch({ headless: false, args: [`--window-size=${VW+20},900`] });
const ctx = await browser.newContext({ viewport: { width: VW, height: 812 }, deviceScaleFactor: 1 });
await ctx.addInitScript((s) => { for (const [k,v] of Object.entries(s)) { try { localStorage.setItem(k,v); } catch {} } }, SEED);
const page = await ctx.newPage();
await page.goto(`${URL}/game?practice=true&players=${PLAYERS}&fresh=1`, { waitUntil: 'load', timeout: 120000 });
await page.waitForTimeout(9000);
await page.evaluate(`window.__f=${fire}`);
const placed = await measure(page, `(()=>{const b=[...document.querySelectorAll('button,[role="button"]')].find(x=>/auto-place all/i.test(x.getAttribute('aria-label')||x.textContent||''));if(b){window.__f(b);return true;}return false;})()`, { label: 'ap' });
await page.waitForTimeout(1500);
const ready = await measure(page, `(()=>{const r=document.querySelector('[data-testid="ready-button"]');if(r){window.__f(r);return true;}return false;})()`, { label: 'rb' });
if (!placed || !ready) { console.error(`ADVANCE FAILED (autoPlace=${placed} ready=${ready}) — FAILED MEASUREMENT, not a clean result.`); await browser.close(); process.exit(2); }

const show = (label, r) => {
  console.log(`\n### ${label}  (${r.url}, ${r.n} visible text nodes)`);
  const one = (k, arr, fmt) => console.log(`  ${k.padEnd(10)} ${arr.length === 0 ? '0' : arr.length + '  ' + arr.slice(0,4).map(fmt).join(' | ')}`);
  one('overlaps', r.overlaps, (o)=>`"${o.a}"/"${o.b}" ${o.pct}%`);
  one('clipped',  r.clipped,  (c)=>`"${c.t}" ${c.sw}>${c.cw}`);
  one('offscreen',r.offscreen,(o)=>`"${o.t}" x${o.l}..${o.r}`);
  one('tiny<10',  r.tiny,     (t)=>`"${t.t}" ${t.fs}px`);
  one('tap<44',   r.targets,  (t)=>`"${t.t}" ${t.w}x${t.h}`);
  one('gaps>70',  r.gaps,     (g)=>`${g.px}px @${g.from}-${g.to}`);
};

// Sample mid-reveal (worst case), then /results.
await page.waitForTimeout(8000);
const rev = await measure(page, audit, { label: 'reveal' });
// Overlap pairs that mix placement chrome with reveal text are the OCCLUSION case, not a
// collision — BoardReveal is a full-screen overlay drawn over game.tsx's chrome, and neither
// geometry nor ancestor opacity can see that. Capture the paint so the call is made on pixels.
await page.screenshot({ path: `tests/screenshots/reveal-${PLAYERS}p-${VW}.png`, clip: { x: 0, y: 0, width: VW, height: 130 } });
console.log(`reveal crop -> tests/screenshots/reveal-${PLAYERS}p-${VW}.png`);
if (/results/.test(rev.url)) console.log('NOTE: already on /results at the reveal sample — reveal NOT captured.');
else show(`REVEAL ${PLAYERS}P @${VW}`, rev);

for (let i = 0; i < 12; i++) { await page.waitForTimeout(3000);
  const u = await measure(page, `(()=>location.pathname)()`, { label: 'u' }); if (/results/.test(u)) break; }
const res = await measure(page, audit, { label: 'results' });
if (!/results/.test(res.url)) console.error(`NEVER REACHED /results (stuck on ${res.url}) — FAILED MEASUREMENT.`);
else show(`RESULTS ${PLAYERS}P @${VW}`, res);
await browser.close();
