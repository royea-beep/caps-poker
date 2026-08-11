/**
 * TOUCH TARGETS — every control under 44px, per screen, per viewport.
 *
 * Real box only. hitSlop is deliberately NOT counted: react-native-web does not implement it,
 * so counting it would report a fix that does not exist on the channel testers use. That was
 * the whole reason the lobby Join "fix" had to be redone.
 *
 *   VIEWPORT=320 node tests/touch-targets.mjs
 */
import { chromium } from 'playwright';
import { measure, HarnessError } from './probe-kit.mjs';

const URL = process.env.CAPS_URL || 'https://caps.ftable.co.il';
const VW = Number(process.env.VIEWPORT || 390);
const ROUTES = (process.env.ROUTES || '/,/friends,/settings,/lobby').split(',');
const SEED = { caps_tutorial_seen: 'true', caps_onboarding_done: 'true',
  has_seen_interactive_tutorial: 'true', caps_games_played: '99' };

const expr = `(() => {
  const vis = (el) => { let n = el, d = 0; while (n && d < 12) { const c = getComputedStyle(n);
    if (c.display === 'none' || c.visibility === 'hidden' || parseFloat(c.opacity) === 0) return false;
    n = n.parentElement; d++; } return true; };
  const out = [];
  for (const el of document.querySelectorAll('button,[role="button"],a')) {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    if (!vis(el)) continue;
    if (r.width >= 44 && r.height >= 44) continue;
    out.push({ t: (el.textContent || '').trim().slice(0, 28) || el.getAttribute('aria-label') || '?',
               w: Math.round(r.width), h: Math.round(r.height) });
  }
  return { url: location.pathname, small: out };
})()`;

const browser = await chromium.launch({ headless: false, args: [`--window-size=${VW+20},900`] });
const ctx = await browser.newContext({ viewport: { width: VW, height: 812 }, deviceScaleFactor: 1 });
await ctx.addInitScript((s) => { for (const [k,v] of Object.entries(s)) { try { localStorage.setItem(k,v); } catch {} } }, SEED);
const page = await ctx.newPage();

console.log(`viewport=${VW} — controls under 44x44 (real box; hitSlop NOT counted)\n`);
for (const route of ROUTES) {
  await page.goto(URL + route, { waitUntil: 'load', timeout: 90000 });
  await page.waitForTimeout(7000);
  let r;
  try { r = await measure(page, expr, { label: 'tt' + route }); }
  catch (e) { console.log(`${route.padEnd(10)} HARNESS FAIL: ${e instanceof HarnessError ? e.message : String(e).slice(0,60)}`); continue; }
  console.log(`${route.padEnd(10)} ${r.small.length === 0 ? 'all controls >= 44' : r.small.map(s=>`"${s.t}" ${s.w}x${s.h}`).join(' | ')}`);
}
await page.goto(URL + '/lobby', { waitUntil: 'load', timeout: 90000 });
await page.waitForTimeout(7000);
await page.screenshot({ path: `tests/screenshots/lobby-${VW}.png` });
console.log(`\nlobby screenshot -> tests/screenshots/lobby-${VW}.png`);
await browser.close();
