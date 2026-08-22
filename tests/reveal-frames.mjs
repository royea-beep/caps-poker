/**
 * FRAME SPREAD at the worst case CAPS draws: 320px, FOUR boards, during the reveal.
 * Webkit only — the chromium control idles at 33.3ms here (rAF capped at 30fps in this headed
 * environment), so chromium cannot resolve anything finer and would only produce a number that
 * measures the browser. Webkit idles at 15.0ms on the same machine, so it can.
 *
 * Three windows per run, each against the same idle control, and TWO runs — one measurement of
 * a 15-second frame is a fault report, two is a pattern, and neither is worth reporting from a
 * single sample.
 */
import { webkit } from 'playwright';
import { installFire, where } from './harness/play.mjs';

const SITE = process.env.CAPS_URL || 'https://caps.ftable.co.il';
const FRAMES = (ms) => new Promise((res) => {
  const d = []; let last = performance.now(); const t0 = last;
  const tick = (now) => { d.push(now - last); last = now;
    if (now - t0 < ms) requestAnimationFrame(tick); else res(d.slice(1)); };
  requestAnimationFrame(tick);
});
const report = (label, arr) => {
  if (!arr || arr.length < 20) return console.log(`   ${label.padEnd(26)} COULD NOT BE MEASURED (n=${arr?.length ?? 0})`);
  const s = [...arr].sort((a, b) => a - b);
  const q = (p) => s[Math.min(s.length - 1, Math.floor(s.length * p))].toFixed(1);
  const stalls = arr.filter((x) => x > 200).length;
  console.log(`   ${label.padEnd(26)} n=${String(arr.length).padStart(3)}  p50=${q(0.5)}  p95=${q(0.95)}  worst=${s[s.length-1].toFixed(1)}ms  stalls>200ms=${stalls}`);
};

for (const run of [1, 2]) {
  const b = await webkit.launch({ headless: false });
  const p = await (await b.newContext({ viewport: { width: 320, height: 900 } })).newPage();
  p.on('dialog', async (d) => { await d.dismiss(); });
  console.log(`\n══ RUN ${run} — webkit 320px, 2 players = 4 boards`);

  await p.goto(`${SITE}/game?practice=true&players=2&fresh=1`, { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(13000);
  report('control: idle placement', await p.evaluate(FRAMES, 5000));

  await installFire(p);
  await p.evaluate(`(()=>{const x=[...document.querySelectorAll('button,[role="button"]')]
    .find(e=>/auto-place all/i.test((e.getAttribute('aria-label')||'')+' '+(e.textContent||''))); if(x) window.__f(x);})()`);
  await p.waitForTimeout(3000);
  await installFire(p);
  await p.evaluate(`(()=>{const r=document.querySelector('[data-testid="ready-button"]'); if(r) window.__f(r);})()`);

  let ok = false;
  for (let i = 0; i < 40 && !ok; i++) { await p.waitForTimeout(700); ok = (await where(p)).inReveal; }
  if (!ok) { console.log('   reveal not reached — NOT MEASURED'); await b.close(); continue; }
  report('reveal window 1', await p.evaluate(FRAMES, 6000));
  report('reveal window 2', await p.evaluate(FRAMES, 6000));
  await b.close();
}
