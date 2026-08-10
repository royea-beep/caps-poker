/**
 * Where does the placement header actually END, and what is directly below it?
 *
 * The practice pill is position:absolute, top:rs(6), alignSelf:'center' — it floats over the
 * header row and collides with the centred "PLACE N CARDS" pill. Moving it needs a y that is
 * clear of BOTH the header row and whatever the board area starts with. Guessing that y is how
 * you trade one collision for another, so measure it.
 *
 *   PLAYERS=3 node tests/header-layout.mjs
 */
import { chromium } from 'playwright';
import { measure, HarnessError } from './probe-kit.mjs';

const URL = process.env.CAPS_URL || 'https://caps.ftable.co.il';
const PLAYERS = process.env.PLAYERS || '3';
const SEED = { caps_tutorial_seen: 'true', caps_onboarding_done: 'true',
  has_seen_interactive_tutorial: 'true', caps_games_played: '99' };

const expr = `(() => {
  const out = [];
  for (const el of document.querySelectorAll('*')) {
    const r = el.getBoundingClientRect();
    if (r.top > 170 || r.height === 0 || r.width === 0) continue;
    const txt = (el.textContent || '').trim();
    if (!txt || el.children.length) continue;         // leaf text only
    out.push({ t: txt.slice(0, 30), top: Math.round(r.top), bot: Math.round(r.bottom),
               l: Math.round(r.left), r: Math.round(r.right) });
  }
  out.sort((a, b) => a.top - b.top);
  return out;
})()`;

const browser = await chromium.launch({ headless: false, args: ['--window-size=410,900'] });
const ctx = await browser.newContext({ viewport: { width: 390, height: 812 }, deviceScaleFactor: 1 });
await ctx.addInitScript((s) => { for (const [k, v] of Object.entries(s)) { try { localStorage.setItem(k, v); } catch {} } }, SEED);
const page = await ctx.newPage();
await page.goto(`${URL}/game?practice=true&players=${PLAYERS}&fresh=1`, { waitUntil: 'load', timeout: 120000 });
await page.waitForTimeout(9000);

let rows;
try { rows = await measure(page, expr, { label: 'layout' }); }
catch (e) { console.error('HARNESS:', e instanceof HarnessError ? e.message : String(e)); await browser.close(); process.exit(2); }
await browser.close();

console.log(`${PLAYERS}P — every leaf text node in the top 170px, by y:\n`);
console.log(' top- bot | x range   | text');
for (const r of rows) console.log(`${String(r.top).padStart(4)}-${String(r.bot).padStart(4)} | ${String(r.l).padStart(3)}-${String(r.r).padStart(3)}   | ${JSON.stringify(r.t)}`);
