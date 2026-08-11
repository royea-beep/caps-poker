/**
 * LOBBY TINY TEXT — the rf(10, 10) fix, finally verified.
 *
 * Four previous runs reported nothing because the lobby had no table rows on screen, so the
 * strings the fix targets were never rendered. The DB is NOT the problem: 10 public rooms sit
 * at status='waiting' by design. So this ASSERTS rows rendered before reporting anything —
 * if it finds no #CODE row it exits non-zero and calls the run a FAILED MEASUREMENT rather
 * than reporting "no tiny text found" when there was no text to find.
 *
 * Read-only. Joins nothing, consumes no table, deletes nothing.
 *
 *   VIEWPORT=320 node tests/lobby-fontsize.mjs
 */
import { chromium } from 'playwright';
import { measure, HarnessError } from './probe-kit.mjs';

const URL = process.env.CAPS_URL || 'https://caps.ftable.co.il';
const VW = Number(process.env.VIEWPORT || 320);
const SEED = { caps_tutorial_seen: 'true', caps_onboarding_done: 'true',
  has_seen_interactive_tutorial: 'true', caps_games_played: '99' };

const expr = `(() => {
  const vis = (el) => { let n = el, d = 0; while (n && d < 12) { const c = getComputedStyle(n);
    if (c.display === 'none' || c.visibility === 'hidden' || parseFloat(c.opacity) === 0) return false;
    n = n.parentElement; d++; } return true; };
  const all = [], under = [];
  for (const el of document.querySelectorAll('*')) {
    if (el.children.length) continue;
    const t = (el.textContent || '').trim();
    if (!t) continue;
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    if (!vis(el)) continue;
    const fs = Math.round(parseFloat(getComputedStyle(el).fontSize));
    all.push({ t: t.slice(0, 44), fs });
    if (fs < 10) under.push({ t: t.slice(0, 44), fs });
  }
  const body = document.body.innerText || '';
  return { url: location.pathname, rows: (body.match(/#[A-Z0-9]{4}/g) || []).length,
           n: all.length, min: all.length ? Math.min(...all.map(a=>a.fs)) : null, under,
           targets: ['Public tables','player online now','XP only','BOT','A real person joins','boards']
             .map((k) => { const hit = all.find(a => a.t.includes(k)); return { k, found: !!hit, fs: hit ? hit.fs : null }; }) };
})()`;

const browser = await chromium.launch({ headless: false, args: [`--window-size=${VW+20},900`] });
const ctx = await browser.newContext({ viewport: { width: VW, height: 812 }, deviceScaleFactor: 1 });
await ctx.addInitScript((s) => { for (const [k,v] of Object.entries(s)) { try { localStorage.setItem(k,v); } catch {} } }, SEED);
const page = await ctx.newPage();
await page.goto(`${URL}/lobby`, { waitUntil: 'load', timeout: 120000 });
await page.waitForTimeout(14000);   // the table list is a network round-trip; earlier runs measured too early

let r;
try { r = await measure(page, expr, { label: 'lobby' }); }
catch (e) { console.error('HARNESS:', e instanceof HarnessError ? e.message : String(e)); await browser.close(); process.exit(2); }
await page.screenshot({ path: `tests/screenshots/lobby-fs-${VW}.png` });
await browser.close();

console.log(`viewport=${VW}  ${r.n} visible text nodes  |  table rows rendered: ${r.rows}`);
if (r.rows === 0) {
  console.error('\nNO TABLE ROWS ON SCREEN — **FAILED MEASUREMENT, NOT A PASS.**');
  console.error('The strings this fix targets were not rendered, so nothing was verified.');
  process.exit(2);
}
console.log(`smallest fontSize on /lobby: ${r.min}px   (target: none under 10)`);
console.log(`nodes under 10px: ${r.under.length ? r.under.map(u=>`"${u.t}" ${u.fs}px`).join(' | ') : 'NONE'}`);
console.log('\ntarget strings from the fix:');
for (const t of r.targets) console.log(`  ${t.found ? (t.fs >= 10 ? 'OK  ' : 'FAIL') : '-- '} ${String(t.fs ?? 'not rendered').padStart(12)}  ${t.k}`);
console.log(`\nscreenshot -> tests/screenshots/lobby-fs-${VW}.png`);
