/**
 * Two questions the sweep raised that a guess would answer badly.
 *
 * 1. IDLE PAGE — the only pageerrors left are one AbortError (webkit) and one autoplay
 *    NotAllowedError (chromium). Both LOOK harness-induced: the harness walks 22 routes fast,
 *    aborting in-flight requests, and never taps before audio. So sit still on one page and
 *    count. If an idle page is clean, they are the instrument and the browser's autoplay policy,
 *    not the product.
 *
 * 2. FRAME SPREAD needs a CONTROL. A p50 of 31ms during the reveal means nothing on its own:
 *    this machine has been crashing compilers all day and the browser is headed. So measure the
 *    same way on a STATIC screen. If the static screen is also ~31ms, the number is the
 *    environment; if it is ~16ms, the reveal is genuinely heavy.
 */
import { webkit, chromium } from 'playwright';

const SITE = process.env.CAPS_URL || 'https://caps.ftable.co.il';
const FRAMES = () => new Promise((res) => {
  const d = []; let last = performance.now(); const t0 = last;
  const tick = (now) => { d.push(now - last); last = now;
    if (now - t0 < 5000) requestAnimationFrame(tick); else res(d.slice(1)); };
  requestAnimationFrame(tick);
});
const report = (label, arr) => {
  if (!arr || arr.length < 20) return console.log(`   ${label.padEnd(22)} COULD NOT BE MEASURED`);
  const s = [...arr].sort((a, b) => a - b);
  const q = (p) => s[Math.min(s.length - 1, Math.floor(s.length * p))].toFixed(1);
  console.log(`   ${label.padEnd(22)} n=${String(arr.length).padStart(3)}  p50=${q(0.5)}ms  p95=${q(0.95)}ms  worst=${s[s.length-1].toFixed(1)}ms`);
};

for (const [name, engine] of [['webkit', webkit], ['chromium', chromium]]) {
  const b = await engine.launch({ headless: false });
  const p = await (await b.newContext({ viewport: { width: 320, height: 900 } })).newPage();
  p.on('dialog', async (d) => { await d.dismiss(); });
  const errs = []; p.on('pageerror', (e) => errs.push(String(e).slice(0, 100)));
  const cerr = []; p.on('console', (m) => { if (m.type() === 'error') cerr.push(m.text().slice(0, 100)); });

  await p.goto(SITE + '/', { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(25000);   // sit still. no navigation, no interaction.
  console.log(`\n══ ${name} — IDLE HOME for 25s, no navigation`);
  console.log(`   pageerrors  : ${errs.length} ${JSON.stringify([...new Set(errs)])}`);
  console.log(`   console.error: ${cerr.length} ${JSON.stringify([...new Set(cerr)].slice(0, 3))}`);

  console.log(`\n══ ${name} — FRAME SPREAD at 320px`);
  report('control: idle home', await p.evaluate(FRAMES));
  await b.close();
}
