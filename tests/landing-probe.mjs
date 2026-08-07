/**
 * CJ2 — measure the LANDING in a visible browser.
 *
 * Uses the Rule 14a preamble: refuses to measure until `document.hidden === false` AND rAF > 0.
 *
 * Samples TRANSFORM, not just opacity. That was the second of two stacked faults found last
 * sprint — the Home particles animate via transform at a constant 0.045 opacity, so an
 * opacity-only probe calls a moving element static. The landing animates BOTH, and this reads
 * both.
 *
 * Usage: node tests/landing-probe.mjs [width] [height]
 */
import { chromium } from 'playwright';
import fs from 'fs';

const TARGET = 'https://caps.ftable.co.il/';
const W = Number(process.argv[2] || 375);
const H = Number(process.argv[3] || 812);

const fire = `(el)=>{const r=el.getBoundingClientRect();const x=r.left+r.width/2,y=r.top+r.height/2;
const mk=(t,C)=>new C(t,{bubbles:true,cancelable:true,composed:true,clientX:x,clientY:y,pointerId:1,pointerType:'mouse',button:0,buttons:t.includes('up')?0:1,isPrimary:true});
['pointerdown','mousedown','pointerup','mouseup','click'].forEach(t=>el.dispatchEvent(mk(t,t.startsWith('pointer')?PointerEvent:MouseEvent)));}`;

async function preamble(page) {
  return page.evaluate(async () => {
    const start = performance.now(); let raf = 0;
    await new Promise((res) => {
      const loop = () => { raf++; performance.now() - start < 2000 ? requestAnimationFrame(loop) : res(); };
      requestAnimationFrame(loop); setTimeout(res, 2500);
    });
    return { hidden: document.hidden, rafCount: raf, innerWidth, innerHeight, devicePixelRatio,
             ok: document.hidden === false && raf > 0 };
  });
}

/** rAF gap distribution — report spread, never a hardcoded 32ms budget (see Rule 14a). */
async function frames(page, ms) {
  return page.evaluate(async (ms) => {
    const gaps = []; let last = performance.now(); const s = last;
    await new Promise((res) => {
      const loop = () => { const n = performance.now(); gaps.push(n - last); last = n;
        n - s < ms ? requestAnimationFrame(loop) : res(); };
      requestAnimationFrame(loop); setTimeout(res, ms + 500);
    });
    const g = gaps.slice(2); if (!g.length) return { frames: 0 };
    const sorted = g.slice().sort((a, b) => a - b);
    const med = sorted[Math.floor(g.length / 2)];
    return { frames: g.length, medianMs: +med.toFixed(1), maxMs: +Math.max(...g).toFixed(1),
             spreadMs: +(Math.max(...g) - med).toFixed(1) };
  }, ms);
}

const out = { viewport: { W, H }, ts: new Date().toISOString() };
const browser = await chromium.launch({ headless: false, args: [`--window-size=${W + 20},${H + 140}`] });
try {
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  await page.goto(TARGET, { waitUntil: 'load', timeout: 60000 });
  await page.waitForTimeout(2500);

  out.precondition = await preamble(page);
  if (!out.precondition.ok) { out.ABORT = 'preamble failed'; throw new Error('preamble failed'); }

  out.bundle = await page.evaluate(() =>
    [...document.querySelectorAll('script[src]')].map(s => s.src.split('/').pop()).filter(x => x.startsWith('index-'))[0]);

  // BASELINE frames on the placement screen, before any landing fires
  await page.evaluate(`(()=>{window.__f=${fire};
    const p=[...document.querySelectorAll('button,[role="button"]')].find(x=>/^Play$/.test((x.getAttribute('aria-label')||x.textContent||'').trim()));
    if(p)window.__f(p);})()`);
  await page.waitForTimeout(2500);
  out.boards = await page.evaluate(() => document.querySelectorAll('[data-testid^="community-row-"]').length);
  out.framesBaseline = await frames(page, 2500);

  // ── SINGLE CARD LANDING: tap a hand card, tap slot row 0, sample transform+opacity fast ──
  out.singleLanding = await page.evaluate(async () => {
    const hc = document.querySelector('[data-testid="hand-card"]');
    if (!hc) return { err: 'no hand card' };
    window.__f(hc);
    await new Promise(r => setTimeout(r, 350));
    const row = document.querySelector('[data-testid="slot-row-0"]');
    const before = row ? row.children.length : 0;
    const t0 = performance.now();
    window.__f(row);
    const series = [];
    // sample every rAF for 500ms — captures a 120ms animation with room to spare
    await new Promise((res) => {
      const loop = () => {
        const r2 = document.querySelector('[data-testid="slot-row-0"]');
        const card = r2 && r2.children[0];
        const inner = card && card.firstElementChild;
        if (inner) {
          const s = getComputedStyle(inner);
          series.push({ t: +(performance.now() - t0).toFixed(1), op: +parseFloat(s.opacity).toFixed(3), tf: s.transform });
        }
        performance.now() - t0 < 500 ? requestAnimationFrame(loop) : res();
      };
      requestAnimationFrame(loop);
      setTimeout(res, 900);
    });
    const moving = series.filter(s => s.op < 0.999);
    return {
      slotsBefore: before,
      samples: series.length,
      firstOpacity: series.length ? series[0].op : null,
      lastOpacity: series.length ? series[series.length - 1].op : null,
      distinctTransforms: [...new Set(series.map(s => s.tf))].length,
      animatedFrames: moving.length,
      settledAtMs: moving.length ? +(moving[moving.length - 1].t).toFixed(1) : 0,
      head: series.slice(0, 8),
    };
  });

  // ── AUTO-PLACE ALL: measure total until every card is at rest, and READY gate timing ──
  out.autoPlaceAll = await page.evaluate(async () => {
    const btn = [...document.querySelectorAll('button,[role="button"]')]
      .find(x => /auto-place all/i.test(x.getAttribute('aria-label') || x.textContent || ''));
    if (!btn) return { err: 'no auto-place all' };
    const t0 = performance.now();
    let readyAt = null, settledAt = null;
    window.__f(btn);
    await new Promise((res) => {
      const loop = () => {
        const rb = document.querySelector('[data-testid="ready-button"]');
        if (readyAt === null && rb && rb.getAttribute('aria-disabled') !== 'true') readyAt = +(performance.now() - t0).toFixed(1);
        const rows = [...document.querySelectorAll('[data-testid^="slot-row-"]')];
        const cards = rows.flatMap(r => [...r.children].map(c => c.firstElementChild).filter(Boolean));
        const allRest = cards.length > 0 && cards.every(c => parseFloat(getComputedStyle(c).opacity) > 0.999);
        if (settledAt === null && allRest) settledAt = +(performance.now() - t0).toFixed(1);
        (settledAt !== null && readyAt !== null) || performance.now() - t0 > 1500
          ? res() : requestAnimationFrame(loop);
      };
      requestAnimationFrame(loop);
      setTimeout(res, 2000);
    });
    return { readyEnabledAtMs: readyAt, allCardsSettledAtMs: settledAt };
  });

  out.framesDuringLanding = await frames(page, 2000);
} catch (e) {
  out.error = String(e && e.message || e);
} finally { await browser.close(); }

fs.writeFileSync(new URL('./landing-probe-result.json', import.meta.url), JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 2));
