/**
 * ITERATION 29 — dump EVERY leaf text node across the reveal, unfiltered.
 *
 * Every filter applied so far is where the measurement went wrong:
 *   iteration 20 — suit-glyph geometry above a label -> matched nothing
 *   iteration 27 — the persistent counter + banner -> matched the WRONG pair
 * So: no selectors, no glyph classes, no position cutoffs. Capture everything, sample across
 * the whole reveal (the elements in question are transient), and answer the three questions
 * in-script so the output stays readable.
 *
 * The real question is #3: does ANY text node intersect the community row, whatever it says.
 */
import { chromium } from 'playwright';
import { measure, show, HarnessError } from './probe-kit.mjs';

const URL = process.env.CAPS_URL || 'https://caps.ftable.co.il';
const PLAYERS = process.env.PLAYERS || '3';
const W = 375, H = 812;
const SEED = { caps_tutorial_seen: 'true', caps_onboarding_done: 'true',
  has_seen_interactive_tutorial: 'true', caps_games_played: '99' };

const fire = `(el)=>{const r=el.getBoundingClientRect();const x=r.left+r.width/2,y=r.top+r.height/2;
const mk=(t,C)=>new C(t,{bubbles:true,cancelable:true,composed:true,clientX:x,clientY:y,pointerId:1,pointerType:'mouse',button:0,buttons:t.includes('up')?0:1,isPrimary:true});
['pointerdown','mousedown','pointerup','mouseup','click'].forEach(t=>el.dispatchEvent(mk(t,t.startsWith('pointer')?PointerEvent:MouseEvent)));}`;

const installSampler = `(() => {
  window.__t0 = performance.now();
  window.__dump = [];
  window.__iv = setInterval(() => {
    try {
      const t = Math.round(performance.now() - window.__t0);
      const nodes = [];
      for (const el of document.querySelectorAll('*')) {
        if (el.children.length) continue;
        const txt = (el.textContent || '').trim();
        if (!txt) continue;
        const r = el.getBoundingClientRect();
        if (r.width === 0 && r.height === 0) continue;
        nodes.push({ x: txt.slice(0, 44), t: Math.round(r.top), b: Math.round(r.bottom),
                     l: Math.round(r.left), r: Math.round(r.right),
                     c: (el.className || '').toString().slice(0, 40) });
      }
      const ce = document.querySelector('[data-testid="community-row"]');
      const comm = ce ? (() => { const q = ce.getBoundingClientRect();
        return { t: Math.round(q.top), b: Math.round(q.bottom), l: Math.round(q.left), r: Math.round(q.right) }; })() : null;
      window.__dump.push({ t, comm, nodes });
    } catch (e) { window.__dump.push({ err: String(e).slice(0, 100) }); }
  }, 250);
  return true;
})()`;

const browser = await chromium.launch({ headless: false, args: [`--window-size=${W + 20},${H + 140}`] });
const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
await ctx.addInitScript((s) => { for (const [k, v] of Object.entries(s)) { try { localStorage.setItem(k, v); } catch {} } }, SEED);
const page = await ctx.newPage();

await page.goto(`${URL}/game?practice=true&players=${PLAYERS}&fresh=1`, { waitUntil: 'load', timeout: 120000 });
await page.waitForTimeout(9000);
await page.evaluate(`window.__f=${fire}`);
await page.evaluate(`(()=>{const b=[...document.querySelectorAll('button,[role="button"]')].find(x=>/auto-place all/i.test(x.getAttribute('aria-label')||x.textContent||''));if(b)window.__f(b);})()`);
await page.waitForTimeout(1200);
await page.evaluate(installSampler);
await page.evaluate(`(()=>{const rb=document.querySelector('[data-testid="ready-button"]');if(rb)window.__f(rb);})()`);
await page.waitForTimeout(16000);
await page.evaluate(`(() => { clearInterval(window.__iv); return true; })()`);

let dump;
try { dump = await measure(page, `(() => window.__dump)()`, { label: 'dump' }); }
catch (e) { console.error('HARNESS:', e instanceof HarnessError ? e.message : String(e)); await browser.close(); process.exit(2); }
await browser.close();

const samples = Array.isArray(dump) ? dump.filter((d) => !d.err) : [];
if (!samples.length) { console.error('CAPTURE RETURNED NOTHING — failed measurement, not a negative.'); process.exit(2); }
const typical = Math.round(samples.reduce((a, s) => a + s.nodes.length, 0) / samples.length);
console.log(`samples=${samples.length} interval=250ms duration=16s unfiltered=YES nodes/sample~${typical}`);

// 1 — BOARD n OF m
const boardOf = [];
for (const s of samples) for (const n of s.nodes) if (/BOARD\s+\d+\s+OF\s+\d+/i.test(n.x)) boardOf.push({ t: s.t, ...n });
console.log(`\n1) /BOARD \\d+ OF \\d+/i -> ${boardOf.length ? 'FOUND' : 'NOT FOUND'}`);
if (boardOf.length) {
  console.log(`   text="${boardOf[0].x}" box ${boardOf[0].t}-${boardOf[0].b} class=${boardOf[0].c}`);
  console.log(`   t range ${boardOf[0].t}..${boardOf[boardOf.length-1].t} (${boardOf.length} samples)`);
} else {
  const near = new Set();
  for (const s of samples) for (const n of s.nodes) if (/board/i.test(n.x)) near.add(n.x);
  console.log(`   closest 'board' texts seen: ${[...near].slice(0, 8).map(v => JSON.stringify(v)).join(', ')}`);
}

// 2 — YOU WIN nodes
const winCounts = samples.map((s) => s.nodes.filter((n) => /YOU WIN/i.test(n.x)).length);
const maxWin = Math.max(...winCounts);
console.log(`\n2) nodes containing "YOU WIN": max ${maxWin} at any single sample`);
const winSample = samples.find((s) => s.nodes.filter((n) => /YOU WIN/i.test(n.x)).length === maxWin && maxWin > 0);
if (winSample) for (const n of winSample.nodes.filter((n) => /YOU WIN/i.test(n.x)))
  console.log(`   t=${winSample.t} "${n.x}" box ${n.t}-${n.b} class=${n.c}`);

// 3 — THE REAL QUESTION: any text node intersecting the community row
const hits = [];
for (const s of samples) {
  if (!s.comm) continue;
  for (const n of s.nodes) {
    if (n.b <= s.comm.t || s.comm.b <= n.t) continue;      // no vertical intersection
    if (n.r <= s.comm.l || s.comm.r <= n.l) continue;      // no horizontal intersection
    if (/^[♠♥♦♣]$/.test(n.x) || /^(10|[2-9AKQJ])$/.test(n.x)) continue; // the cards themselves
    hits.push({ t: s.t, text: n.x, box: `${n.t}-${n.b}`, comm: `${s.comm.t}-${s.comm.b}`, c: n.c });
  }
}
console.log(`\n3) TEXT NODES INTERSECTING community-row: ${hits.length ? 'YES — ' + hits.length + ' hits' : 'NONE'}`);
const seen = new Set();
for (const h of hits) { const k = h.text + h.box; if (seen.has(k)) continue; seen.add(k);
  console.log(`   t=${h.t} "${h.text}" box ${h.box} vs comm ${h.comm} class=${h.c}`); if (seen.size >= 12) break; }
