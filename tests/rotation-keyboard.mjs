/**
 * Landscape, and the on-screen keyboard.
 *
 * Two things nothing has tested. Memory records "web always portrait layout" — this checks
 * whether that is ENFORCED or merely never exercised, which are very different.
 *
 * The keyboard is simulated by shrinking the viewport height to ~420 while a field is focused,
 * which is what an on-screen keyboard does to the visual viewport. The question is whether the
 * focused field and its submit control stay reachable.
 *
 *   node tests/rotation-keyboard.mjs
 */
import { chromium } from 'playwright';
import { measure, HarnessError } from './probe-kit.mjs';

const URL = process.env.CAPS_URL || 'https://caps.ftable.co.il';
const SEED = { caps_tutorial_seen: 'true', caps_onboarding_done: 'true',
  has_seen_interactive_tutorial: 'true', caps_games_played: '99' };

const state = `(() => {
  const hiddenBy = (el) => { let n = el, d = 0; while (n && d < 12) { const cs = getComputedStyle(n);
    if (cs.display === 'none' || cs.visibility === 'hidden' || parseFloat(cs.opacity) === 0) return true;
    if (cs.transform && /matrix\\(1, 0, 0, 1, [1-9]/.test(cs.transform)) return true;
    n = n.parentElement; d++; } return false; };
  const vw = innerWidth, vh = innerHeight;
  const leaves = [...document.querySelectorAll('*')].filter((e) => !e.children.length && !hiddenBy(e));
  let off = 0, below = 0;
  for (const e of leaves) {
    const t = (e.textContent || '').trim();
    if (!t) continue;
    const r = e.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    if (r.right > vw + 0.5 || r.left < -0.5) off++;
    if (r.top > vh) below++;
  }
  const doc = document.documentElement;
  return { vw, vh, nodes: leaves.length,
           bodyLen: (document.body.innerText || '').trim().length,
           offRight: off, belowFold: below,
           scrollH: doc.scrollHeight, clientH: doc.clientHeight,
           canScroll: doc.scrollHeight > doc.clientHeight + 2 };
})()`;

const browser = await chromium.launch({ headless: false, args: ['--window-size=880,900'] });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
await ctx.addInitScript((s) => { for (const [k, v] of Object.entries(s)) { try { localStorage.setItem(k, v); } catch {} } }, SEED);
const page = await ctx.newPage();

console.log('=== LANDSCAPE 844x390 ===');
for (const route of ['/', '/settings']) {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(URL + route, { waitUntil: 'load', timeout: 120000 });
  await page.waitForTimeout(9000);
  const p = await measure(page, state, { label: 'port' + route });
  await page.setViewportSize({ width: 844, height: 390 });
  await page.waitForTimeout(4000);
  const l = await measure(page, state, { label: 'land' + route });
  console.log(`  ${route.padEnd(10)} portrait : ${p.nodes} nodes, bodyLen ${p.bodyLen}, offRight ${p.offRight}, scrollable ${p.canScroll}`);
  console.log(`  ${''.padEnd(10)} landscape: ${l.nodes} nodes, bodyLen ${l.bodyLen}, offRight ${l.offRight}, belowFold ${l.belowFold}, scrollable ${l.canScroll} (${l.clientH} -> ${l.scrollH})`);
  await page.screenshot({ path: `tests/screenshots/landscape-${route.replace(/\//g, '') || 'home'}.png` });
}

// Placement in landscape — the densest screen.
await page.setViewportSize({ width: 390, height: 844 });
await page.goto(`${URL}/game?practice=true&players=3&fresh=1`, { waitUntil: 'load', timeout: 120000 });
await page.waitForTimeout(10000);
await page.setViewportSize({ width: 844, height: 390 });
await page.waitForTimeout(4500);
const gl = await measure(page, state, { label: 'landGame' });
console.log(`  /game      landscape: ${gl.nodes} nodes, bodyLen ${gl.bodyLen}, offRight ${gl.offRight}, belowFold ${gl.belowFold}, scrollable ${gl.canScroll} (${gl.clientH} -> ${gl.scrollH})`);
await page.screenshot({ path: 'tests/screenshots/landscape-game.png' });

console.log('\n=== ON-SCREEN KEYBOARD (viewport height 420 with a field focused) ===');
await page.setViewportSize({ width: 390, height: 844 });
await page.goto(URL + '/friends', { waitUntil: 'load', timeout: 90000 });
await page.waitForTimeout(8000);

const inputs = await measure(page, `(() => [...document.querySelectorAll('input')]
  .filter((i) => i.offsetParent !== null)
  .map((i, n) => ({ n, ph: i.placeholder || i.getAttribute('aria-label') || '(no placeholder)' })))()`, { label: 'inputs' });
console.log(`  visible inputs on /friends: ${inputs.length} ${JSON.stringify(inputs.map((i) => i.ph))}`);
if (!inputs.length) console.log('  NO INPUTS FOUND — nothing measured here, not a clean result.');

for (const inp of inputs) {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(1200);
  await page.evaluate(`(() => { const i = [...document.querySelectorAll('input')].filter((x) => x.offsetParent !== null)[${inp.n}]; if (i) i.focus(); })()`);
  await page.setViewportSize({ width: 390, height: 420 });   // keyboard takes ~half the screen
  await page.waitForTimeout(2500);
  const r = await measure(page, `(() => {
    const i = [...document.querySelectorAll('input')].filter((x) => x.offsetParent !== null)[${inp.n}];
    if (!i) return { gone: true };
    const b = i.getBoundingClientRect();
    const btns = [...document.querySelectorAll('button,[role="button"]')].filter((e) => e.offsetParent !== null)
      .map((e) => { const q = e.getBoundingClientRect();
        return { t: ((e.getAttribute('aria-label') || '') + ' ' + (e.textContent || '')).trim().slice(0, 18),
                 top: Math.round(q.top), visible: q.top >= 0 && q.bottom <= innerHeight }; })
      .filter((e) => /create|join|save|submit|ok/i.test(e.t));
    return { focused: document.activeElement === i,
             top: Math.round(b.top), bottom: Math.round(b.bottom), vh: innerHeight,
             inView: b.top >= 0 && b.bottom <= innerHeight, submits: btns };
  })()`, { label: 'kb' + inp.n });
  console.log(`  ${JSON.stringify(inp.ph).padEnd(26)} focused ${r.focused} | field y ${r.top}..${r.bottom} of ${r.vh} | in view: ${r.inView ? 'YES' : '*** NO — behind the keyboard ***'}`);
  for (const b of r.submits || []) console.log(`      submit ${JSON.stringify(b.t)} top ${b.top} visible ${b.visible}`);
}
await page.screenshot({ path: 'tests/screenshots/keyboard-friends.png' });
await browser.close();
