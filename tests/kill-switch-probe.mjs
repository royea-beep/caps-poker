/**
 * KILL-SWITCH PROBE — does the Board pulse actually run, and does anything die when it does?
 *
 * ── WHY THE PREVIOUS TWO ATTEMPTS PROVED NOTHING ────────────────────────────────────────────
 * Phase 4 (2026-08-07) flipped KILL_Board on web and sampled the empty slot: it read 0.600 on
 * 23/23 samples. That result is UNINTERPRETABLE, because 0.6 was simultaneously
 *   (a) the `useSharedValue(0.6)` initial — "nothing ever wrote", and
 *   (b) the `else`-branch resting value — "isArrangement was false".
 * Two opposite conclusions, one number. The re-enable was reverted for exactly that reason.
 *
 * ── THE DISCRIMINATOR ───────────────────────────────────────────────────────────────────────
 * This run measures THREE builds that differ in one variable each, with the shared value's
 * initial moved to a number the app can never produce by accident:
 *
 *   dist-control    HEAD as shipped          initial 0.6    KILL_Board true
 *   dist-sentinel   sentinel only            initial 0.137  KILL_Board true
 *   dist-live       sentinel + switch off    initial 0.137  KILL_Board FALSE
 *
 * and every outcome maps to exactly one cause:
 *
 *   reads 0.137 constant   the effect ran, took the `if (isArrangement)` branch, and wrote
 *                          nothing — i.e. the kill switch is what is stopping it
 *   reads 0.600 constant   the `else` branch ran — isArrangement was false, wrong screen
 *   oscillates 0.72..1.0   the pulse is alive
 *
 * sentinel vs live is then a one-variable A/B: same code, same initial, KILL_Board flipped.
 *
 * ── THE PRECONDITION, NEVER SKIPPED ─────────────────────────────────────────────────────────
 * Reanimated's web driver runs on requestAnimationFrame, and a hidden document runs zero rAF
 * callbacks by spec — 0 in 26.9s, measured on this project on 2026-08-07. A headless or hidden
 * browser therefore reports "no animation" for every build, correct or broken. So this runs a
 * REAL window under Xvfb and ABORTS unless `document.hidden === false` and rAF actually ticks.
 *
 * ── AND THE CANARY ──────────────────────────────────────────────────────────────────────────
 * A probe that finds no motion is indistinguishable from a probe that cannot see motion. So
 * each run injects an element driven by the page's own rAF and asserts the sampler observes it
 * changing. If the canary is still, the run is VOID and says so — it does not report "no pulse".
 *
 * Usage:  xvfb-run -a node tests/kill-switch-probe.mjs <distDir> [--players=2] [--width=393]
 *                                                      [--seconds=20] [--engine=chromium|webkit]
 */

import { chromium, webkit } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const args = Object.fromEntries(process.argv.slice(3).map((a) => a.replace(/^--/, '').split('=')));
const DIST = path.resolve(process.argv[2] || '');
const PLAYERS = Number(args.players || 2);
const WIDTH = Number(args.width || 393);
const HEIGHT = Number(args.height || 852);
const SECONDS = Number(args.seconds || 20);
const ENGINE = args.engine || 'chromium';
const PORT = 4300 + Math.floor(Math.random() * 400);

if (![2, 3, 4].includes(PLAYERS)) throw new Error('players must be 2, 3 or 4 — board count is DYNAMIC (2P=4, 3P=3, 4P=2)');
if (!fs.existsSync(path.join(DIST, 'index.html'))) throw new Error(`no export at ${DIST}`);

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.ttf': 'font/ttf', '.woff2': 'font/woff2' };

const server = http.createServer((req, res) => {
  const url = decodeURIComponent((req.url || '/').split('?')[0]);
  let file = path.join(DIST, url);
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(DIST, 'index.html');
  if (path.extname(file) === '.html') {
    const html = fs.readFileSync(file, 'utf8').replace(/<script(?![^>]*type=)/g, '<script type="module"');
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); res.end(html); return;
  }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});
await new Promise((r) => server.listen(PORT, r));

const out = {
  dist: path.basename(DIST), players: PLAYERS, boards: PLAYERS === 2 ? 4 : PLAYERS === 3 ? 3 : 2,
  viewport: { w: WIDTH, h: HEIGHT }, engine: ENGINE, seconds: SECONDS, ts: new Date().toISOString(),
};

const engine = ENGINE === 'webkit' ? webkit : chromium;
// The repo's playwright pins a newer browser revision than this machine has installed, so the
// bundled path 404s. CAPS_BROWSER_PATH points at the Chromium that IS here. Stated rather than
// silently falling back to headless, which would fail the precondition for the wrong reason.
const exe = process.env.CAPS_BROWSER_PATH;
// headless:false — see THE PRECONDITION above. Under xvfb-run this is a real, visible window.
const browser = await engine.launch({ headless: false, ...(exe && ENGINE === 'chromium' ? { executablePath: exe } : {}) });
try {
  const ctx = await browser.newContext({ viewport: { width: WIDTH, height: HEIGHT }, deviceScaleFactor: 1 });
  // PRACTICE GUARD, second layer: nothing may reach production or the database whatever the app tries.
  await ctx.route('**/*', (r) => (/supabase\.co|ftable\.co\.il/i.test(r.request().url()) ? r.abort() : r.continue()));
  const page = await ctx.newPage();

  const pageErrors = [], consoleErrors = [];
  page.on('pageerror', (e) => pageErrors.push(String(e).slice(0, 200)));
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 200)); });
  page.on('crash', () => pageErrors.push('*** PAGE CRASHED (renderer gone) ***'));

  const seed = JSON.parse(fs.readFileSync(path.join(path.dirname(new URL(import.meta.url).pathname), 'caps-onboarded.json'), 'utf8'));
  const store = seed.origins[0].localStorage.find((e) => e.name === 'caps-poker-storage').value;
  await page.addInitScript((blob) => {
    try {
      localStorage.setItem('has_seen_interactive_tutorial', 'true');
      localStorage.setItem('caps_games_played', '25');
      localStorage.setItem('caps-poker-storage', blob);
    } catch (_) { /* unavailable */ }
  }, store);

  const url = `http://localhost:${PORT}/game?practice=true&players=${PLAYERS}&fresh=1`;
  if (!/[?&]practice=true(&|$)/.test(url)) throw new Error('PRACTICE GUARD: refusing a non-practice route');
  await page.goto(url, { waitUntil: 'load', timeout: 120000 });
  await page.waitForTimeout(6000);

  // ── PRECONDITION ──────────────────────────────────────────────────────────────────────────
  out.precondition = await page.evaluate(async () => {
    const t0 = performance.now(); let raf = 0;
    await new Promise((res) => {
      const loop = () => { raf++; if (performance.now() - t0 < 2000) requestAnimationFrame(loop); else res(); };
      requestAnimationFrame(loop); setTimeout(res, 2500);
    });
    return { hidden: document.hidden, rafCount: raf, ok: document.hidden === false && raf > 0 };
  });
  if (!out.precondition.ok) {
    out.VOID = `PRECONDITION FAILED — hidden=${out.precondition.hidden} rAF=${out.precondition.rafCount}. ` +
               `Reanimated's web driver is rAF; measuring here would measure the harness.`;
  } else {
    // ── CANARY + SAMPLE ─────────────────────────────────────────────────────────────────────
    out.sample = await page.evaluate(async ({ ms }) => {
      // A control the sampler MUST see moving. If it does not, the sampler is blind and any
      // "no pulse" reading from the same pass is meaningless.
      const canary = document.createElement('div');
      canary.id = '__canary';
      canary.style.cssText = 'position:fixed;left:-9999px;width:1px;height:1px;opacity:0.2';
      document.body.appendChild(canary);
      let up = true;
      const tick = () => {
        const v = parseFloat(canary.style.opacity);
        if (v >= 0.9) up = false; if (v <= 0.15) up = true;
        canary.style.opacity = String(+(v + (up ? 0.05 : -0.05)).toFixed(2));
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);

      const isSlot = (e) => {
        const s = getComputedStyle(e);
        return s.borderTopStyle === 'dashed' && parseFloat(s.width) > 15 && parseFloat(s.height) > 20;
      };
      const slots = [...document.querySelectorAll('div')].filter(isSlot);

      // Frame gaps, collected across the same window, so the cost of the motion is measured
      // rather than asserted.
      const gaps = []; let last = performance.now();
      const fr = () => { const n = performance.now(); gaps.push(n - last); last = n; requestAnimationFrame(fr); };
      requestAnimationFrame(fr);

      const series = [], canarySeries = [];
      const t0 = performance.now();
      while (performance.now() - t0 < ms) {
        series.push(slots.map((e) => +parseFloat(getComputedStyle(e).opacity).toFixed(3)));
        canarySeries.push(+parseFloat(getComputedStyle(canary).opacity).toFixed(3));
        await new Promise((r) => setTimeout(r, 60));
      }
      const col = (i) => series.map((r) => r[i]);
      const g = gaps.slice(3).sort((a, b) => a - b);
      return {
        slotCount: slots.length,
        samples: series.length,
        canaryDistinct: new Set(canarySeries).size,
        slotInlineOpacity: slots.slice(0, 4).map((e) => e.style.opacity || '(none)'),
        frames: g.length ? { median: +g[Math.floor(g.length / 2)].toFixed(1), p95: +g[Math.floor(g.length * 0.95)].toFixed(1),
          max: +g[g.length - 1].toFixed(1), over32ms: g.filter((x) => x > 32).length, count: g.length } : null,
        // Does the FINITE repeat actually stop? withRepeat(200) over a 2s sequence bounds the
        // pulse at ~400s. A run longer than that must go still in its last quarter, and a run
        // shorter than that must not — either way this says which, instead of leaving "finite"
        // as a claim in a comment.
        // Measured over the LAST 30 SECONDS, not the last quarter. A first pass used the last
        // quarter and, on a 440s run, that window opened at 330s — BEFORE the ~400s bound it was
        // meant to test. It reported "still moving" and proved nothing.
        tail30s: (() => {
          const n = Math.min(series.length, Math.ceil(30000 / 60));
          const from = series.length - n;
          const moved = slots.map((_, i) => new Set(col(i).slice(from)).size).filter((c) => c > 1).length;
          return { windowSeconds: 30, fromApproxSecond: Math.round(from * 0.06), slotsStillMoving: moved, of: slots.length };
        })(),
        perSlot: slots.map((_, i) => {
          const c = col(i);
          return { min: Math.min(...c), max: Math.max(...c), distinct: new Set(c).size, first8: c.slice(0, 8) };
        }),
        // Whatever else on the screen moved, so "the app is frozen" and "this one value is
        // frozen" can be told apart.
        otherMotion: (() => {
          const els = [...document.querySelectorAll('div,span,svg')].slice(0, 250);
          return els.filter((e) => e.style.transform || e.style.opacity).length;
        })(),
      };
    }, { ms: SECONDS * 1000 });

    if (out.sample.canaryDistinct <= 1) {
      out.VOID = `CANARY STILL (${out.sample.canaryDistinct} distinct value in ${out.sample.samples} samples). ` +
                 `The sampler cannot see motion, so "no pulse" from this pass is not a result.`;
    }
    out.alive = await page.evaluate(() => document.querySelectorAll('div').length > 10);
  }
  out.pageErrors = pageErrors;
  out.consoleErrors = consoleErrors.slice(0, 10);
  out.consoleErrorCount = consoleErrors.length;
} catch (e) {
  out.error = String((e && e.message) || e);
} finally {
  await browser.close().catch(() => {});
  server.close();
}

// ── VERDICT, derived from the discriminator table in the header ───────────────────────────────
if (!out.VOID && !out.error && out.sample) {
  const moving = out.sample.perSlot.filter((s) => s.distinct > 1);
  const rest = [...new Set(out.sample.perSlot.map((s) => s.min))];
  out.verdict = moving.length > 0
    ? `PULSING — ${moving.length}/${out.sample.slotCount} slots changed opacity (range ${Math.min(...moving.map((m) => m.min))}..${Math.max(...moving.map((m) => m.max))})`
    : rest.every((v) => Math.abs(v - 0.137) < 0.005) ? 'STILL AT SENTINEL 0.137 — the effect ran, took the isArrangement branch, and wrote nothing'
    : rest.every((v) => Math.abs(v - 0.6) < 0.005)   ? 'STILL AT 0.600 — the else branch ran (isArrangement false) OR the shipped initial'
    : `STILL, at ${rest.join('/')} — unexpected resting value`;
}

const dest = path.join(path.dirname(new URL(import.meta.url).pathname),
  `kill-switch-probe-${out.dist}-${PLAYERS}p-${WIDTH}-${ENGINE}.json`);
fs.writeFileSync(dest, JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 2));
