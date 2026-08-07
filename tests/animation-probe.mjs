/**
 * ANIMATION PROBE — a VISIBLE browser, with the precondition baked in.
 *
 * WHY THIS EXISTS. The in-app preview pane runs hidden: measured 2026-08-07,
 * `document.hidden === true` and **0 requestAnimationFrame callbacks in 26.9 seconds**. A
 * hidden document does not run rAF by spec, and Reanimated's web driver runs on rAF, so NO
 * animation can progress there regardless of how the app is written. Two sprints produced
 * confident, opposite-sounding conclusions from readings that were the harness all along
 * (MEASUREMENT-PROTOCOL Rules 13 and 14).
 *
 * So this launches Playwright **headed** — a real, visible Chromium window — and refuses to
 * measure anything until it has proven the window is actually live.
 *
 * THE PRECONDITION, checked every run, never skipped:
 *     document.hidden === false   AND   rAF callbacks > 0 over a 2s window
 * If either fails the probe ABORTS and says so. An animation measurement taken without this
 * is measuring the harness, and we have the scar tissue to prove it.
 *
 * Usage:  node tests/animation-probe.mjs [width] [height]
 * Output: JSON on stdout, and written to tests/animation-probe-result.json
 */

import { chromium } from 'playwright';
import fs from 'fs';

const TARGET = 'https://caps.ftable.co.il/'; // NOT `URL` — that shadows the global constructor
const W = Number(process.argv[2] || 393);
const H = Number(process.argv[3] || 852);

/** The reusable precondition. Returns {ok, hidden, rafCount, ...}. Never skip it. */
async function assertAnimatable(page, windowMs = 2000) {
  return page.evaluate(async (ms) => {
    const start = performance.now();
    let raf = 0;
    await new Promise((resolve) => {
      const loop = () => {
        raf++;
        if (performance.now() - start < ms) requestAnimationFrame(loop);
        else resolve();
      };
      requestAnimationFrame(loop);
      // hard stop so a suspended rAF cannot hang the run
      setTimeout(resolve, ms + 500);
    });
    return {
      hidden: document.hidden,
      visibilityState: document.visibilityState,
      rafCount: raf,
      elapsedMs: Math.round(performance.now() - start),
      innerWidth: window.innerWidth,
      innerHeight: window.innerHeight,
      devicePixelRatio: window.devicePixelRatio,
      ok: document.hidden === false && raf > 0,
    };
  }, windowMs);
}

/** Sample opacity+transform of every candidate element over `ms`, report only what CHANGED. */
async function sampleMotion(page, ms = 4000, stepMs = 100) {
  return page.evaluate(async ({ ms, stepMs }) => {
    const els = [...document.querySelectorAll('div,svg,span')].slice(0, 300);
    const series = [];
    const frames = Math.floor(ms / stepMs);
    for (let i = 0; i < frames; i++) {
      series.push(els.map((e) => {
        const s = getComputedStyle(e);
        return parseFloat(s.opacity).toFixed(3) + '|' + (s.transform === 'none' ? '-' : s.transform);
      }));
      await new Promise((r) => setTimeout(r, stepMs));
    }
    const moved = [];
    for (let i = 0; i < els.length; i++) {
      const col = series.map((r) => r[i]);
      const distinct = [...new Set(col)];
      if (distinct.length > 1) {
        const ops = col.map((v) => parseFloat(v.split('|')[0]));
        moved.push({
          idx: i,
          opacityMin: Math.min(...ops),
          opacityMax: Math.max(...ops),
          distinctStates: distinct.length,
          firstOpacities: ops.slice(0, 10),
        });
      }
    }
    return { frames: series.length, elements: els.length, movedCount: moved.length, moved: moved.slice(0, 8) };
  }, { ms, stepMs });
}

/** Longest gap between rAF callbacks = the worst frame in the window. */
async function frameStats(page, ms = 4000) {
  return page.evaluate(async (ms) => {
    const gaps = [];
    let last = performance.now();
    const start = last;
    await new Promise((resolve) => {
      const loop = () => {
        const now = performance.now();
        gaps.push(now - last);
        last = now;
        if (now - start < ms) requestAnimationFrame(loop);
        else resolve();
      };
      requestAnimationFrame(loop);
      setTimeout(resolve, ms + 500);
    });
    const g = gaps.slice(2); // drop warm-up
    if (!g.length) return { frames: 0, note: 'no rAF' };
    return {
      frames: g.length,
      maxMs: +Math.max(...g).toFixed(1),
      over32ms: g.filter((x) => x > 32).length,
      over50ms: g.filter((x) => x > 50).length,
      medianMs: +g.slice().sort((a, b) => a - b)[Math.floor(g.length / 2)].toFixed(1),
    };
  }, ms);
}

const out = { url: TARGET, requestedViewport: { W, H }, ts: new Date().toISOString() };

const browser = await chromium.launch({ headless: false, args: ['--window-size=' + (W + 20) + ',' + (H + 140)] });
try {
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  await page.goto(TARGET, { waitUntil: 'load', timeout: 60000 });
  await page.waitForTimeout(2500); // let the SPA mount

  out.precondition = await assertAnimatable(page);
  if (!out.precondition.ok) {
    out.ABORT = 'PRECONDITION FAILED — hidden=' + out.precondition.hidden +
                ' rAF=' + out.precondition.rafCount + '. Measuring this would measure the harness.';
  } else {
    out.bundle = await page.evaluate(() =>
      [...document.querySelectorAll('script[src]')].map((s) => s.src.split('/').pop()).filter((x) => x.startsWith('index-'))[0]);
    out.motion = await sampleMotion(page, 4000, 100);
    out.frames = await frameStats(page, 4000);
  }
} catch (e) {
  out.error = String(e && e.message || e);
} finally {
  await browser.close();
}

fs.writeFileSync(new URL('./animation-probe-result.json', import.meta.url), JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 2));
