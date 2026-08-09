/**
 * ITERATION 20 — ONE time series, both bugs.
 *
 * Two single-frame samples at ~9-10s have now contradicted a photograph twice. Both bugs are
 * the same hypothesis: a TRANSIENT PHASE. The reveal flips bot cards through a face-down
 * animation and the banner animates in, so a frame at 10s says nothing about t=0..3s.
 *
 * Samples every 250ms from the moment Ready is pressed, collecting IN-PAGE (one round trip,
 * so the sampling cadence is not distorted by CDP latency).
 *
 *   PLAYERS=3 node tests/reveal-timeseries.mjs
 */
import { chromium } from 'playwright';
import { measure, show, HarnessError } from './probe-kit.mjs';

const URL = process.env.CAPS_URL || 'https://caps.ftable.co.il';
const PLAYERS = process.env.PLAYERS || '3';
const DURATION = Number(process.env.DURATION_MS || 16000);
const W = 375, H = 812;
const SEED = { caps_tutorial_seen: 'true', caps_onboarding_done: 'true',
  has_seen_interactive_tutorial: 'true', caps_games_played: '99' };

const fire = `(el)=>{const r=el.getBoundingClientRect();const x=r.left+r.width/2,y=r.top+r.height/2;
const mk=(t,C)=>new C(t,{bubbles:true,cancelable:true,composed:true,clientX:x,clientY:y,pointerId:1,pointerType:'mouse',button:0,buttons:t.includes('up')?0:1,isPrimary:true});
['pointerdown','mousedown','pointerup','mouseup','click'].forEach(t=>el.dispatchEvent(mk(t,t.startsWith('pointer')?PointerEvent:MouseEvent)));}`;

// Installed BEFORE Ready; collects into window.__series until stopped.
const installSampler = `(() => {
  const box = (e) => { if (!e) return null; const r = e.getBoundingClientRect();
    return { t: Math.round(r.top), b: Math.round(r.bottom), l: Math.round(r.left), r: Math.round(r.right) }; };
  const leaf = () => [...document.querySelectorAll('*')].filter(e => !e.children.length);
  const byRe = (re) => { const e = leaf().find(x => re.test((x.textContent || '').trim()));
    return e ? { text: (e.textContent || '').trim(), box: box(e), sel: e.tagName + '.' + (e.className || '').toString().slice(0, 24) } : null; };

  const sample = () => {
    const counter = byRe(/^Board [0-9]+$/);
    const banner  = byRe(/(YOU WIN|YOU LOSE|TIE)/i);
    // ITERATION 27 — ANCHORED, not inferred from glyph position. The old block filtered suit
    // glyphs to those above the first section label and matched NOTHING, so comm stayed null
    // and the overlap column read null for 64 straight samples — which would have read as
    // "no overlap" and closed a defect Roye photographed. Anchor: BoardReveal.tsx:829.
    const commEl = document.querySelector('[data-testid="community-row"]');
    let comm = null;
    if (commEl) {
      const cr = commEl.getBoundingClientRect();
      comm = { t: Math.round(cr.top), b: Math.round(cr.bottom), l: Math.round(cr.left), r: Math.round(cr.right) };
    }
    const hit = (a, b) => (a && b) ? !(a.b <= b.t || b.b <= a.t) : null;

    const bots = [];
    for (const lab of document.querySelectorAll('[data-testid="reveal-section-label"]')) {
      const p = lab.parentElement; if (!p) continue;
      const lv = [...p.querySelectorAll('*')].filter(e => !e.children.length);
      bots.push({ label: (lab.textContent || '').trim(),
                  suits: lv.filter(e => /^[♠♥♦♣]$/.test((e.textContent || '').trim())).length,
                  ranks: lv.filter(e => /^(10|[2-9AKQJ])$/.test((e.textContent || '').trim())).length });
    }
    return { t: Math.round(performance.now() - window.__t0),
             counter: counter ? counter.box : null, counterSel: counter ? counter.sel : null,
             banner: banner ? banner.box : null, bannerSel: banner ? banner.sel : null,
             comm, counterHit: hit(counter ? counter.box : null, comm), bannerHit: hit(banner ? banner.box : null, comm),
             bots };
  };
  window.__t0 = performance.now();
  window.__series = [];
  window.__iv = setInterval(() => { try { window.__series.push(sample()); } catch (e) { window.__series.push({ err: String(e).slice(0, 80) }); } }, 250);
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
await page.evaluate(installSampler);                       // arm BEFORE Ready
await page.evaluate(`(()=>{const rb=document.querySelector('[data-testid="ready-button"]');if(rb)window.__f(rb);})()`);
await page.waitForTimeout(DURATION);
await page.evaluate(`(() => { clearInterval(window.__iv); return true; })()`);

const out = { players: PLAYERS, duration: DURATION };
try { out.series = await measure(page, `(() => window.__series)()`, { label: 'series' }); }
catch (e) { out.harnessError = e instanceof HarnessError ? e.message : String(e); }

const s = Array.isArray(out.series) ? out.series : [];

// ABORT GUARD — a null community box means the comparison NEVER RAN. Iteration 20 shipped a
// 64-sample series whose overlap column was null throughout and it read as a negative. That
// must never happen again: if the anchor is unmatched on any sample, the run FAILS.
const unmatched = s.filter((x) => !x.err && !x.comm).length;
if (s.length === 0 || unmatched > 0) {
  console.error(`\nRUN FAILED — community row unmatched on ${unmatched}/${s.length} samples.`);
  console.error('A null overlap column is NOT a negative result. Fix the anchor before reading anything below.');
  await browser.close();
  process.exit(2);
}

console.log(`PLAYERS=${PLAYERS}  samples=${s.length}`);
console.log('t(ms) | counter | banner | comm(n) | cHit | bHit | bot cards');
for (const x of s) {
  if (x.err) { console.log(`${x.t}  ERR ${x.err}`); continue; }
  const bots = (x.bots || []).map(b => `${b.label}:${b.suits}s/${b.ranks}r`).join(' ');
  console.log(`${String(x.t).padStart(5)} | ${x.counter ? x.counter.t + '-' + x.counter.b : '--'} | ${x.banner ? x.banner.t + '-' + x.banner.b : '--'} | ${x.comm ? x.comm.t + '-' + x.comm.b + '(' + x.comm.n + ')' : '--'} | ${x.counterHit} | ${x.bannerHit} | ${bots}`);
}
const anyHit = s.some(x => x.counterHit || x.bannerHit);
const anyZero = s.some(x => (x.bots || []).some(b => b.suits === 0));
console.log(`\nOVERLAP AT ANY SAMPLE: ${anyHit}   ZERO-CARD BOT AT ANY SAMPLE: ${anyZero}`);
console.log(`selectors matched -> counter: ${s.find(x => x.counterSel)?.counterSel ?? 'NEVER MATCHED'} | banner: ${s.find(x => x.bannerSel)?.bannerSel ?? 'NEVER MATCHED'}`);
await browser.close();
