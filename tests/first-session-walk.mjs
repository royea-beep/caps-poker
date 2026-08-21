/**
 * FIRST-SESSION WALK — what a stranger actually experiences, open to play-again.
 * Not a pass/fail table: it records what is ON SCREEN at each step, in the order a tester meets it.
 *
 *   ENGINE=webkit VIEWPORT=430 node tests/first-session-walk.mjs
 */
import { webkit, chromium } from 'playwright';
import { playHandToResults, installFire, where } from './harness/play.mjs';

const SITE = process.env.CAPS_URL || 'https://caps.ftable.co.il';
const VW = Number(process.env.VIEWPORT || 430);
const ENGINE = process.env.ENGINE || 'webkit';
const engine = ENGINE === 'chromium' ? chromium : webkit;
const tag = `${ENGINE}/${VW}`;

// A FRESH device: no tutorial seed. This is the point — a stranger has seen nothing.
const read = () => {
  const t = document.body.innerText;
  const lines = t.split('\n').map((s) => s.trim()).filter(Boolean);
  return {
    path: location.pathname,
    lines: lines.slice(0, 14),
    lineCount: lines.length,
    buttons: [...document.querySelectorAll('button,[role="button"]')]
      .filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; })
      .map((e) => (e.getAttribute('aria-label') || e.textContent || '').trim().slice(0, 34))
      .filter(Boolean).slice(0, 12),
  };
};

const browser = await engine.launch({ headless: false });
const page = await (await browser.newContext({ viewport: { width: VW, height: 900 } })).newPage();
const errs = []; page.on('pageerror', (e) => errs.push(String(e).slice(0, 120)));
const step = async (name, ms = 9000) => {
  await page.waitForTimeout(ms);
  const s = await page.evaluate(read);
  console.log(`\n── ${tag} · ${name} · ${s.path} · ${s.lineCount} lines`);
  console.log('   sees   :', JSON.stringify(s.lines));
  console.log('   can tap:', JSON.stringify(s.buttons));
  await page.screenshot({ path: `tests/screenshots/walk-${ENGINE}-${VW}-${name}.png` });
  return s;
};

await page.goto(SITE + '/', { waitUntil: 'domcontentloaded' });
await step('1-first-open', 11000);

// whatever the first-run flow offers, take the obvious way forward
await installFire(page);
for (const label of ['Continue', 'SKIP', 'PLAY']) {
  const hit = await page.evaluate(`(()=>{const b=[...document.querySelectorAll('button,[role="button"]')]
    .find(x=>new RegExp(${JSON.stringify(label)},'i').test((x.getAttribute('aria-label')||'')+' '+(x.textContent||'')));
    if(!b) return false; window.__f(b); return true;})()`);
  if (hit) { console.log(`   [tapped ${label}]`); await page.waitForTimeout(3500); await installFire(page); }
}
await step('2-after-first-run', 4000);

const dealt = await where(page);
if (!/game/.test(dealt.path)) {
  await page.goto(SITE + '/game?practice=true', { waitUntil: 'domcontentloaded' });
  console.log('   [had to navigate to /game manually — the first-run flow did not land there]');
}
await step('3-dealt', 10000);

const res = await playHandToResults(page, {
  onFrame: async (p, w) => { if (w.inReveal && !globalThis.__shot) { globalThis.__shot = 1;
    await p.screenshot({ path: `tests/screenshots/walk-${ENGINE}-${VW}-4-reveal.png` }); } },
});
console.log(`\n   playHandToResults: reachedResults=${res.reachedResults} sawReveal=${res.sawReveal}`);
for (const l of res.log) console.log('     ', JSON.stringify(l));

await step('5-results', 3000);
await installFire(page);
const again = await page.evaluate(`(()=>{const b=[...document.querySelectorAll('button,[role="button"]')]
  .find(x=>/play again|again|next hand|home/i.test((x.getAttribute('aria-label')||'')+' '+(x.textContent||'')));
  if(!b) return null; const n=(b.getAttribute('aria-label')||b.textContent||'').trim(); window.__f(b); return n;})()`);
console.log(`\n   [tapped "${again}" to play again]`);
await step('6-play-again', 11000);

console.log(`\n${tag} page errors:`, errs.length ? errs.slice(0, 3) : 'none');
console.log(`${tag} DEVICE=` + (await page.evaluate(`localStorage.getItem('caps-device-id')`)));
await browser.close();
