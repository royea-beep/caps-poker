/**
 * Sample the chip count-up MID-ANIMATION, because the end was never the broken part.
 *
 * The old code interpolated a STRING, so RN formatted the numeric substring unrounded and every
 * intermediate frame showed ~16 decimals, landing on a clean number only at t=1. Reading the
 * final frame would therefore have reported "fixed" against the unfixed build — the classic
 * check that returns clean without examining the thing it claims to.
 *
 * So this installs an in-page requestAnimationFrame sampler and records EVERY distinct value the
 * counter renders, with timestamps. Sampling from Node instead would add round-trip latency and
 * miss frames of an 800ms animation.
 *
 * The counter only renders for NON-practice hands (BoardReveal returns null when isPractice), so
 * this plays a real-chip solo hand.
 *
 *   node tests/chip-countup-frames.mjs
 */
import { chromium, webkit } from 'playwright';
import { measure, HarnessError } from './probe-kit.mjs';

const URL = process.env.CAPS_URL || 'https://caps.ftable.co.il';
const SEED = { caps_tutorial_seen: 'true', caps_onboarding_done: 'true',
  has_seen_interactive_tutorial: 'true', caps_games_played: '99' };

const fire = `(el)=>{const r=el.getBoundingClientRect();const x=r.left+r.width/2,y=r.top+r.height/2;
const mk=(t,C)=>new C(t,{bubbles:true,cancelable:true,composed:true,clientX:x,clientY:y,pointerId:1,pointerType:'mouse',button:0,buttons:t.includes('up')?0:1,isPrimary:true});
['pointerdown','mousedown','pointerup','mouseup','click'].forEach(t=>el.dispatchEvent(mk(t,t.startsWith('pointer')?PointerEvent:MouseEvent)));}`;

// Record every distinct counter value the DOM shows, on every animation frame.
const installSampler = `(() => {
  window.__chipSamples = [];
  // REQUIRE the space. ChipCountUp emits \`\${sign}\${n} 🪙\`; the /results per-board figure
  // (results.tsx:1337) emits \`\${sign}\${n}🪙\` with no space. Without this the two streams
  // interleave, the "changed since last sample" dedupe fires on every alternation, and the
  // quartile frames end up reporting the wrong element entirely.
  const CHIP = /^([+\\-\\u00b1])([\\d.,]+) \\u{1FA99}$/u;
  const t0 = performance.now();
  const tick = () => {
    for (const el of document.querySelectorAll('*')) {
      if (el.children.length) continue;
      const txt = (el.textContent || '').trim();
      const m = CHIP.exec(txt);
      if (!m) continue;
      const last = window.__chipSamples[window.__chipSamples.length - 1];
      if (!last || last.text !== txt) {
        window.__chipSamples.push({ t: Math.round(performance.now() - t0), text: txt });
      }
    }
    if (window.__chipSampling) requestAnimationFrame(tick);
  };
  window.__chipSampling = true;
  requestAnimationFrame(tick);
  return true;
})()`;

const run = async (name, engine) => {
  const browser = await engine.launch({ headless: false });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.addInitScript((s) => { for (const [k, v] of Object.entries(s)) { try { localStorage.setItem(k, v); } catch {} } }, SEED);
  const page = await ctx.newPage();

  // NON-practice: no practice=true. Practice hides the counter entirely.
  await page.goto(`${URL}/game?players=3`, { waitUntil: 'load', timeout: 120000 });
  await page.waitForTimeout(10000);
  await page.evaluate(`window.__f=${fire}`);
  await page.evaluate(installSampler);
  await page.evaluate(`(()=>{const b=[...document.querySelectorAll('button,[role="button"]')].find(x=>/auto-place all/i.test(x.getAttribute('aria-label')||x.textContent||''));if(b)window.__f(b);})()`);
  await page.waitForTimeout(1500);
  await page.evaluate(`(()=>{const r=document.querySelector('[data-testid="ready-button"]');if(r)window.__f(r);})()`);

  // Let the whole reveal play out; the sampler is collecting throughout.
  for (let i = 0; i < 24; i++) {
    await page.waitForTimeout(2500);
    if (/results/.test(page.url())) break;
  }
  await page.waitForTimeout(3000);

  let samples = [];
  try { samples = await measure(page, `(() => { window.__chipSampling = false; return window.__chipSamples || []; })()`, { label: name }); }
  catch (e) { console.log(`  ${name}: HARNESS ${e instanceof HarnessError ? 'not mounted' : String(e).slice(0, 50)}`); }
  await browser.close();

  console.log(`\n### ${name} — ${samples.length} distinct counter frames`);
  if (!samples.length) {
    console.log('  NO FRAMES CAPTURED — the counter never rendered. Not evidence of a fix.');
    return { name, frames: 0, fractional: null, ramp: 0 };
  }
  const frac = samples.filter((s) => /\d[.,]\d/.test(s.text));

  // Quartiles BY INDEX are useless here: the counter rests at 0 between boards, so most frames
  // are "+0" and the ramp is a thin slice. Find the actual count-up — the longest run of
  // strictly rising values — and quote 25/50/75% THROUGH THAT.
  const num = (s) => Math.abs(Number(String(s.text).replace(/[^\d.]/g, '')));
  let best = [], cur = [];
  for (const s of samples) {
    if (!cur.length || num(s) > num(cur[cur.length - 1])) cur.push(s);
    else { if (cur.length > best.length) best = cur; cur = [s]; }
  }
  if (cur.length > best.length) best = cur;

  if (best.length < 3) {
    console.log(`  NO RAMP FOUND — longest rising run was ${best.length} frame(s). The count-up`);
    console.log('  was not observed, so this run does not test the fix.');
  } else {
    console.log(`  ramp: ${best.length} rising frames, ${num(best[0])} -> ${num(best[best.length - 1])} over ${best[best.length - 1].t - best[0].t}ms`);
    for (const pct of [25, 50, 75]) {
      const s = best[Math.min(best.length - 1, Math.floor(best.length * pct / 100))];
      console.log(`  ~${pct}% of count-up  t=+${String(s.t - best[0].t).padStart(4)}ms  ${JSON.stringify(s.text)}`);
    }
  }
  console.log(`  distinct values seen: ${JSON.stringify([...new Set(samples.map((s) => s.text))].slice(0, 14))}`);
  console.log(`  frames containing a decimal point: ${frac.length}`);
  if (frac.length) console.log(`  OFFENDERS: ${JSON.stringify(frac.slice(0, 4).map((s) => s.text))}`);
  return { name, frames: samples.length, fractional: frac.length, ramp: best.length };
};

const out = [];
for (const [name, engine] of [['chromium', chromium], ['webkit', webkit]]) out.push(await run(name, engine));
console.log('\n=== verdict ===');
for (const r of out) {
  console.log(`  ${r.name.padEnd(9)} frames ${String(r.frames).padStart(3)} | ramp ${String(r.ramp).padStart(3)} | fractional ${r.fractional === null ? 'n/a' : r.fractional}`);
}
// A run that captured no ramp proves nothing — it must not be allowed to read as a pass.
const bad = out.filter((r) => r.fractional === null || r.fractional > 0 || r.ramp < 3);
console.log(bad.length ? `  FAIL/INCONCLUSIVE — ${JSON.stringify(bad.map((b) => b.name))} (decimals, or no count-up observed).`
                       : '  PASS — the count-up was observed on both engines and no frame showed a decimal.');
