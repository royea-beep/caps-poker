/**
 * STATE + PERFORMANCE — the five state scenarios, and frame spread at the worst case.
 *
 * STATE: returning · zero chips · mid-hand · backgrounded · cold deep-link.
 * The question at each is not "does it render" but "is there a way forward and a way back".
 *
 * PERFORMANCE: 320px with FOUR boards is the heaviest thing CAPS draws. Measured with rAF
 * deltas inside the page during the reveal — reported as a spread (p50/p95/worst), because a
 * mean hides exactly the stutter a player notices. If it cannot be measured, it says so.
 */
import { webkit, chromium } from 'playwright';
import { installFire, where } from './harness/play.mjs';

const SITE = process.env.CAPS_URL || 'https://caps.ftable.co.il';
const engineName = process.env.ENGINE || 'webkit';
const engine = engineName === 'chromium' ? chromium : webkit;
const VW = Number(process.env.VIEWPORT || 320);

const SEE = () => {
  const vis = (e) => { const r = e.getBoundingClientRect(); return r.width > 2 && r.height > 2; };
  return {
    path: location.pathname,
    controls: [...document.querySelectorAll('button,[role="button"],[role="tab"],a[href]')]
      .filter(vis).map((e) => (e.getAttribute('aria-label') || e.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 38)),
    lines: document.body.innerText.split('\n').map((s) => s.trim()).filter(Boolean).slice(0, 14),
  };
};

const b = await engine.launch({ headless: false });
const ctx = await b.newContext({ viewport: { width: VW, height: 900 } });
const page = await ctx.newPage();
page.on('dialog', async (d) => { await d.dismiss(); });
const errs = []; page.on('pageerror', (e) => errs.push(String(e).slice(0, 90)));
const say = (label, s) => {
  console.log(`\n── ${label}  [${s.path}]  controls=${s.controls.length}`);
  console.log(`   sees    : ${JSON.stringify(s.lines)}`);
  console.log(`   controls: ${JSON.stringify(s.controls)}`);
};

// 1 — COLD DEEP-LINK: a link straight into the game, no prior session at all.
await page.goto(`${SITE}/game?practice=true&players=2&fresh=1`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(13000);
say('1 cold deep-link -> /game (2p, 4 boards)', await page.evaluate(SEE));

// 2 — PERFORMANCE at the worst case: 320px, four boards, during the reveal.
await installFire(page);
await page.evaluate(`(()=>{const b=[...document.querySelectorAll('button,[role="button"]')]
  .find(x=>/auto-place all/i.test((x.getAttribute('aria-label')||'')+' '+(x.textContent||''))); if(b) window.__f(b);})()`);
await page.waitForTimeout(3000);
await installFire(page);
await page.evaluate(`(()=>{const r=document.querySelector('[data-testid="ready-button"]'); if(r) window.__f(r);})()`);
let inReveal = false;
for (let i = 0; i < 40 && !inReveal; i++) { await page.waitForTimeout(800); inReveal = (await where(page)).inReveal; }
let perf = null;
if (inReveal) {
  perf = await page.evaluate(() => new Promise((res) => {
    const d = []; let last = performance.now(); const t0 = last;
    const tick = (now) => { d.push(now - last); last = now;
      if (now - t0 < 6000) requestAnimationFrame(tick); else res(d.slice(1)); };
    requestAnimationFrame(tick);
  }));
}
console.log(`\n── 2 PERFORMANCE  ${VW}px x 4 boards, during reveal`);
if (!perf || perf.length < 30) {
  console.log('   COULD NOT BE MEASURED — the reveal was not reached in this run.');
} else {
  const s = [...perf].sort((a, x) => a - x);
  const q = (p) => s[Math.min(s.length - 1, Math.floor(s.length * p))].toFixed(1);
  const long = perf.filter((x) => x > 33.4).length;
  console.log(`   frames=${perf.length}  p50=${q(0.5)}ms  p95=${q(0.95)}ms  worst=${s[s.length-1].toFixed(1)}ms`);
  console.log(`   frames over 33.4ms (a dropped frame at 30fps): ${long}  (${(100*long/perf.length).toFixed(1)}%)`);
}

// 3 — MID-HAND: leave the table mid-hand, then come back.
await page.goto(`${SITE}/game?practice=true&players=3&fresh=1`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(11000);
await page.goto(SITE + '/', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(6000);
say('3 mid-hand -> left to home', await page.evaluate(SEE));

// 4 — BACKGROUNDED: the tab is hidden and comes back, as on a phone call.
await page.evaluate(() => {
  Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
  document.dispatchEvent(new Event('visibilitychange'));
});
await page.waitForTimeout(4000);
await page.evaluate(() => {
  Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
  document.dispatchEvent(new Event('visibilitychange'));
});
await page.waitForTimeout(4000);
say('4 backgrounded then restored', await page.evaluate(SEE));

// 5 — RETURNING: a full reload with everything persisted.
await page.goto(SITE + '/', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(9000);
say('5 returning (persisted state)', await page.evaluate(SEE));

// 6 — ZERO CHIPS: the state where a player can get stuck with no way to keep playing.
await page.evaluate(() => {
  try {
    const k = 'caps-poker-storage';
    const cur = JSON.parse(localStorage.getItem(k) || '{}');
    cur.state = { ...(cur.state || {}), chips: 0 };
    localStorage.setItem(k, JSON.stringify(cur));
  } catch {}
});
await page.goto(SITE + '/', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(9000);
say('6 zero chips -> home', await page.evaluate(SEE));
await page.goto(SITE + '/gameover', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(7000);
say('6b zero chips -> /gameover (the out-of-chips screen)', await page.evaluate(SEE));

console.log(`\n   pageerrors: ${errs.length} ${JSON.stringify([...new Set(errs)].slice(0, 4))}`);
console.log(`   device    : ${await page.evaluate(`localStorage.getItem('caps-device-id')`)}`);
await b.close();
