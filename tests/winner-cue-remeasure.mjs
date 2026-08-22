/**
 * WINNER CUE RE-MEASUREMENT — required after the tie change.
 *
 * The verified cue is: gold 3px = won · mint 2px = the field · black-22% 1px = neutral, and in
 * GREYSCALE the WIDTH carries it, not the colour. The tie fix touched only a text header in
 * results.tsx and never Card.tsx, but "it should not have changed" is not a measurement.
 *
 * This reads the PAINTED border of every card on the reveal/results surface via
 * getComputedStyle, buckets by width, and reports the colour found at each width. Three distinct
 * widths surviving is the greyscale proof: strip colour and 3 / 2 / 1 still separate.
 */
import { webkit, chromium } from 'playwright';
import { installFire, where } from './harness/play.mjs';

const SITE = process.env.CAPS_URL || 'https://caps.ftable.co.il';

const MEASURE = () => {
  const seen = new Map();
  for (const e of document.querySelectorAll('div,span')) {
    const r = e.getBoundingClientRect();
    if (r.width < 14 || r.height < 20) continue;          // card-sized only
    const cs = getComputedStyle(e);
    const w = Math.round(parseFloat(cs.borderTopWidth) || 0);
    if (w < 1) continue;
    const key = `${w}px ${cs.borderTopColor}`;
    seen.set(key, (seen.get(key) || 0) + 1);
  }
  return [...seen.entries()].map(([k, n]) => ({ cue: k, count: n })).sort((a, b) => b.count - a.count);
};

const ONLY = process.env.ENGINE;   // re-run one engine after a browser crash
for (const [name, engine] of [['webkit', webkit], ['chromium', chromium]].filter(([n]) => !ONLY || n === ONLY)) {
  const b = await engine.launch({ headless: false });
  const p = await (await b.newContext({ viewport: { width: 393, height: 900 }, deviceScaleFactor: 3 })).newPage();
  p.on('dialog', async (d) => { await d.dismiss(); });

  await p.goto(`${SITE}/game?practice=true&players=2&fresh=1`, { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(13000);
  await installFire(p);
  await p.evaluate(`(()=>{const x=[...document.querySelectorAll('button,[role="button"]')]
    .find(e=>/auto-place all/i.test((e.getAttribute('aria-label')||'')+' '+(e.textContent||''))); if(x) window.__f(x);})()`);
  await p.waitForTimeout(3000);
  await installFire(p);
  await p.evaluate(`(()=>{const r=document.querySelector('[data-testid="ready-button"]'); if(r) window.__f(r);})()`);

  let sawReveal = false, revealCues = null;
  for (let i = 0; i < 60; i++) {
    await p.waitForTimeout(900);
    let w; try { w = await where(p); } catch { break; }
    // Sample THROUGHOUT the reveal and union the buckets. A single sample 2.5s in caught only a
    // container border: the gold won-card cue does not exist until a board actually resolves, so
    // an early snapshot reports [3,2,1] made of the WRONG 3px and looks like a pass.
    if (w.inReveal) {
      sawReveal = true;
      // The reveal ends by NAVIGATING to /results, so a sample can land mid-navigation and throw
      // "Execution context was destroyed". That is the harness racing the app, not a defect.
      let snap = null;
      try { snap = await p.evaluate(MEASURE); } catch { break; }
      if (!snap) break;
      const acc = revealCues ? new Map(revealCues.map((c) => [c.cue, c.count])) : new Map();
      for (const c of snap) acc.set(c.cue, Math.max(acc.get(c.cue) || 0, c.count));
      revealCues = [...acc.entries()].map(([cue, count]) => ({ cue, count })).sort((a, z) => z.count - a.count);
    }
    if (w.path === '/results') break;
  }
  await p.waitForTimeout(5000);
  await p.evaluate(() => window.scrollTo(0, 0));
  await p.waitForTimeout(1200);
  const resultCues = await p.evaluate(MEASURE);

  const show = (label, cues) => {
    console.log(`\n   ${label}`);
    if (!cues) return console.log('      NOT MEASURED');
    // Print by WIDTH, not by frequency: the won-card cue is the RAREST bucket on the screen
    // (a handful of winning cards against dozens of neutrals), so a top-N by count hides
    // exactly the one the cue depends on.
    for (const w of [3, 2, 1]) {
      const at = cues.filter((c) => parseInt(c.cue, 10) === w);
      for (const c of at.slice(0, 3)) console.log(`      ${String(c.count).padStart(3)} x  ${c.cue}`);
    }
    const widths = [...new Set(cues.map((c) => parseInt(c.cue, 10)))].sort((a, z) => z - a);
    console.log(`      distinct border widths present: ${JSON.stringify(widths)}  <- greyscale cue`);
  };
  console.log(`\n══ ${name} @ DPR 3`);
  show('during REVEAL', revealCues);
  show('on /results', resultCues);
  console.log(`   device: ${await p.evaluate(`localStorage.getItem('caps-device-id')`)}`);
  await b.close();
}
