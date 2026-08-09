/**
 * ITERATION 16 / TASK 4 — one real measurement, to prove the kit works end to end.
 *
 * MEASUREMENT ONLY. No fix. Reports whether the reveal header block actually overlaps the
 * community card row (a box-intersection fact), and the per-opponent allBotCards lengths.
 *
 *   PLAYERS=3 node tests/reveal-geometry.mjs
 */
import { chromium } from 'playwright';
import { measure, show, MEASUREMENT_FAILED, HarnessError } from './probe-kit.mjs';

const URL = process.env.CAPS_URL || 'https://caps.ftable.co.il';
const PLAYERS = process.env.PLAYERS || '3';
const W = 375, H = 812;
const SEED = { caps_tutorial_seen: 'true', caps_onboarding_done: 'true',
  has_seen_interactive_tutorial: 'true', caps_games_played: '99' };

const browser = await chromium.launch({ headless: false, args: [`--window-size=${W + 20},${H + 140}`] });
const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
await ctx.addInitScript((s) => { for (const [k, v] of Object.entries(s)) { try { localStorage.setItem(k, v); } catch {} } }, SEED);
const page = await ctx.newPage();

const fire = `(el)=>{const r=el.getBoundingClientRect();const x=r.left+r.width/2,y=r.top+r.height/2;
const mk=(t,C)=>new C(t,{bubbles:true,cancelable:true,composed:true,clientX:x,clientY:y,pointerId:1,pointerType:'mouse',button:0,buttons:t.includes('up')?0:1,isPrimary:true});
['pointerdown','mousedown','pointerup','mouseup','click'].forEach(t=>el.dispatchEvent(mk(t,t.startsWith('pointer')?PointerEvent:MouseEvent)));}`;

await page.goto(`${URL}/game?practice=true&players=${PLAYERS}&fresh=1`, { waitUntil: 'load', timeout: 120000 });
await page.waitForTimeout(9000);
await page.evaluate(`window.__f=${fire}`);
await page.evaluate(`(()=>{const b=[...document.querySelectorAll('button,[role="button"]')].find(x=>/auto-place all/i.test(x.getAttribute('aria-label')||x.textContent||''));if(b)window.__f(b);})()`);
await page.waitForTimeout(1200);
await page.evaluate(`(()=>{const rb=document.querySelector('[data-testid="ready-button"]');if(rb)window.__f(rb);})()`);
await page.waitForTimeout(9000);

// Geometry: the header text nodes vs every row of card glyphs.
const geom = `(() => {
  const leaf = [...document.querySelectorAll('*')].filter(e => !e.children.length);
  const box = (e) => { const r = e.getBoundingClientRect();
    return { top: Math.round(r.top), bottom: Math.round(r.bottom), left: Math.round(r.left), right: Math.round(r.right) }; };
  const byRe = (re) => { const e = leaf.find(x => re.test((x.textContent || '').trim()));
    return e ? Object.assign({ text: (e.textContent || '').trim() }, box(e)) : null; };

  const boardNum = byRe(/^Board [0-9]+$/);
  const score    = byRe(/(Leading|Trailing|Tied|left)/);
  const banner   = byRe(/(YOU WIN|YOU LOSE|TIE)/i);

  // Card glyph rows: cluster suit glyphs into horizontal bands.
  const glyphs = leaf.filter(e => /^[♠♥♦♣]$/.test((e.textContent || '').trim())).map(box);
  const bands = [];
  for (const g of glyphs) {
    let b = bands.find(x => Math.abs(x.top - g.top) < 14);
    if (!b) { b = { top: g.top, bottom: g.bottom, left: g.left, right: g.right, n: 0 }; bands.push(b); }
    b.n++; b.top = Math.min(b.top, g.top); b.bottom = Math.max(b.bottom, g.bottom);
    b.left = Math.min(b.left, g.left); b.right = Math.max(b.right, g.right);
  }
  bands.sort((a, b) => a.top - b.top);
  const hit = (a, b) => (a && b) ? !(a.bottom <= b.top || b.bottom <= a.top) : null;
  return {
    boardNum, score, banner,
    cardBands: bands.map(b => ({ top: b.top, bottom: b.bottom, glyphs: b.n })),
    boardNumOverlapsAnyCardBand: boardNum ? bands.some(b => hit(boardNum, b)) : null,
    bannerOverlapsAnyCardBand:  banner  ? bands.some(b => hit(banner,  b)) : null,
    scoreOverlapsAnyCardBand:   score   ? bands.some(b => hit(score,   b)) : null,
  };
})()`;

// Per-section card counts — how many card glyphs sit under each reveal-section-label.
const sections = `(() => {
  const labels = [...document.querySelectorAll('[data-testid="reveal-section-label"]')]
    .map(e => ({ t: (e.textContent || '').trim(), y: e.getBoundingClientRect().top }))
    .sort((a, b) => a.y - b.y);
  const glyphs = [...document.querySelectorAll('*')].filter(e => !e.children.length &&
    /^[♠♥♦♣]$/.test((e.textContent || '').trim()))
    .map(e => e.getBoundingClientRect().top);
  return labels.map((l, i) => {
    const next = labels[i + 1] ? labels[i + 1].y : Infinity;
    return { label: l.t, cardGlyphs: glyphs.filter(y => y >= l.y - 4 && y < next).length };
  });
})()`;

const out = { url: URL, players: PLAYERS, ts: new Date().toISOString() };
try {
  out.geometry = await measure(page, geom, { label: 'reveal-geometry' });
  out.sections = await measure(page, sections, { label: 'reveal-sections' });
} catch (e) {
  out.harnessError = e instanceof HarnessError ? e.message : String(e);
}
console.log(JSON.stringify(out, null, 1));
console.log('\nsections:', show(out.sections));
await browser.close();
