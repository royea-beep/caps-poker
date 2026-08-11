/**
 * Discovery only — what is actually tappable in the pre-placement game state, and what does the
 * DOM call it. The action-bar probe assumed per-board "⚡ Auto-Place" chips exist as buttons
 * matching /auto.?fill|auto.?place/ without /all/; it found ZERO. Before inventing a second
 * guess, enumerate.
 *
 *   VIEWPORT=390 node tests/_discover-placement.mjs
 */
import { chromium } from 'playwright';

const URL = process.env.CAPS_URL || 'https://caps.ftable.co.il';
const VW = Number(process.env.VIEWPORT || 390);
const PLAYERS = process.env.PLAYERS || '3';
const SEED = { caps_tutorial_seen: 'true', caps_onboarding_done: 'true',
  has_seen_interactive_tutorial: 'true', caps_games_played: '99' };

const browser = await chromium.launch({ headless: false, args: [`--window-size=${VW + 20},900`] });
const ctx = await browser.newContext({ viewport: { width: VW, height: 812 }, deviceScaleFactor: 1 });
await ctx.addInitScript((s) => { for (const [k, v] of Object.entries(s)) { try { localStorage.setItem(k, v); } catch {} } }, SEED);
const page = await ctx.newPage();
await page.goto(`${URL}/game?practice=true&players=${PLAYERS}&fresh=1`, { waitUntil: 'load', timeout: 120000 });
await page.waitForTimeout(9000);

const d = await page.evaluate(`(() => {
  const vis = (el) => { let n = el, d = 0; while (n && d < 12) { const c = getComputedStyle(n);
    if (c.display === 'none' || c.visibility === 'hidden' || parseFloat(c.opacity) === 0) return false;
    n = n.parentElement; d++; } return true; };
  const lbl = (x) => ((x.getAttribute('aria-label') || '') + ' | ' + (x.textContent || '')).trim().slice(0, 60);
  const box = (r) => Math.round(r.left) + ',' + Math.round(r.top) + ' ' + Math.round(r.width) + 'x' + Math.round(r.height);
  const controls = [];
  for (const el of document.querySelectorAll('button,[role="button"]')) {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0 || !vis(el)) continue;
    controls.push({ label: lbl(el), box: box(r), tag: el.tagName });
  }
  // anything carrying a lightning bolt or the word place/fill, whatever the element type
  const zaps = [];
  for (const el of document.querySelectorAll('*')) {
    const t = (el.textContent || '');
    if (el.children.length === 0 && /⚡|auto|place|fill|tap/i.test(t)) {
      const r = el.getBoundingClientRect();
      if (r.width && r.height && vis(el)) zaps.push({ text: t.trim().slice(0, 40), box: box(r), tag: el.tagName });
    }
  }
  return { controls, zaps: zaps.slice(0, 25), total: controls.length };
})()`);

console.log(`\n=== ${d.total} visible controls @${VW} ===`);
for (const c of d.controls) console.log(`  ${c.tag.padEnd(6)} ${c.box.padEnd(18)} ${JSON.stringify(c.label)}`);
console.log(`\n=== leaf nodes mentioning auto/place/fill/tap/⚡ ===`);
for (const z of d.zaps) console.log(`  ${z.tag.padEnd(6)} ${z.box.padEnd(18)} ${JSON.stringify(z.text)}`);

await page.screenshot({ path: `tests/screenshots/discover-preplacement-${VW}.png` });
console.log(`\nscreenshot -> tests/screenshots/discover-preplacement-${VW}.png`);
await browser.close();
