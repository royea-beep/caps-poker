/**
 * HOLLOW-ROUTE SWEEP — the second look. THE-LAST-GAPS 2026-09-08.
 *
 * ⚠️ WHY A SECOND LOOK AT ALL. The product map walked these routes ONCE and found the battle pass:
 * a screen nothing linked to, gated by nothing, rendering a live countdown and a 5,000-chip button
 * in a game whose richest player holds 3,250. One pass found one. One pass is not a search.
 *
 * WHAT COUNTS AS HOLLOW, stated before looking so the answer is not fitted to what turns up:
 *   a COUNTDOWN   — a clock in a product with nothing on the other side of zero
 *   a PRICE       — a number the product asks for that no real balance could pay, or that no
 *                   payment path can take
 *   a CLAIM       — a button that says it grants something and credits nothing
 *   a DEAD END    — a promise with no path to it, or a path to nothing
 *
 * ⚠️ THE ROUTE LIST IS DERIVED FROM app/, NEVER TYPED. A hand-written list is how a route gets
 * missed, and a missed route is exactly the failure this sweep exists to catch.
 *
 * ⚠️ BOUNDARY, STATED NOT HIDDEN — THIS RUNS WITH THE BACKEND UNREACHABLE, ON PURPOSE.
 * Every request to supabase.co / ftable.co.il is aborted. Two reasons:
 *   1. A hollow promise is rendered by the CLIENT. The battle pass's countdown and its 5,000-chip
 *      button needed no server at all; that is how it was found the first time.
 *   2. Visiting the real backend mints a brand-new device and a 2,000-chip grant, days after a
 *      purge whose whole point was clean numbers for the tester round.
 * So the states captured here are NO-NETWORK states, and this file calls them that. Where a cold
 * ONLINE state would differ, the difference is settled from the database and from the source, and
 * said out loud in the report rather than implied by a screenshot.
 *
 *   node tools/hollow-sweep.mjs
 */
import { serve } from './content-lib.mjs';
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const DIST = process.env.DIST || 'dist';
const PORT = Number(process.env.PORT || 8961);
const OUT  = process.env.OUT || 'docs/hollow-sweep-2026-09-08';
const VIEW = { width: 393, height: 852 };
fs.mkdirSync(OUT, { recursive: true });

function routes(dir = 'app', prefix = '') {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name.startsWith('_') || e.name.startsWith('+')) continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      const group = /^\(.+\)$/.test(e.name);
      out.push(...routes(full, group ? prefix : `${prefix}/${e.name}`));
    } else if (/\.tsx?$/.test(e.name)) {
      const base = e.name.replace(/\.tsx?$/, '');
      if (base === 'index') out.push(prefix || '/');
      else if (base.startsWith('[')) out.push(`${prefix}/DEMO`);
      else out.push(`${prefix}/${base}`);
    }
  }
  return out;
}
const ROUTES = [...new Set(routes())].sort();
console.log(`${ROUTES.length} routes derived from app/`);

// ── the four shapes, as regexes over the text a visitor can actually read ──────────────────────
const PROBES = {
  countdown: /(\b\d+\s*d\s*\d+\s*h\b)|(\b\d{1,2}:\d{2}(:\d{2})?\b)|\b(remaining|time left|ends in|expires?|days? left|hours? left)\b|נותרו|מסתיים/i,
  price:     /\b\d{1,3}(,\d{3})+\s*(chips?|צ'יפים)\b|[$₪€]\s?\d|\b\d+\.\d{2}\s*(usd|usd\b)?\b/i,
  claim:     /\b(claim|unlock|redeem|upgrade|buy|purchase|get it now)\b|קבל|פתח|שדרג|קנה/i,
  deadend:   /\b(coming soon|not available|unavailable|no .* yet|empty right now)\b|בקרוב|אין עדיין/i,
};

const server = await serve(DIST, PORT);
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const ctx = await browser.newContext({ viewport: VIEW, deviceScaleFactor: 2 });
await ctx.route('**/*', (r) => (/supabase\.co|ftable\.co\.il/i.test(r.request().url()) ? r.abort() : r.continue()));
await ctx.addInitScript(() => {
  try {
    localStorage.setItem('caps_language', 'en');
    localStorage.setItem('has_seen_interactive_tutorial', 'true');
  } catch (_) {}
});

const rows = [];
for (const route of ROUTES) {
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e).slice(0, 160)));
  let landed = route, text = '', buttons = [];
  try {
    await page.goto(`http://localhost:${PORT}${route === '/' ? '/' : route}`, { waitUntil: 'load', timeout: 45000 });
    await page.waitForTimeout(3000);
    landed = new URL(page.url()).pathname;
    text = (await page.evaluate(() => document.body.innerText || '')).replace(/\s+/g, ' ').trim();
    buttons = await page.evaluate(() =>
      [...document.querySelectorAll('[role="button"],button')]
        .filter((b) => { const r = b.getBoundingClientRect(); return r.width > 4 && r.height > 4; })
        .map((b) => (b.innerText || '').replace(/\s+/g, ' ').trim())
        .filter(Boolean).slice(0, 24));
    await page.screenshot({ path: `${OUT}/${route.replace(/^\//, '').replace(/\//g, '-') || 'home'}.png` });
  } catch (e) {
    errors.push(`NAV: ${String(e).slice(0, 160)}`);
  }
  const hits = {};
  for (const [k, re] of Object.entries(PROBES)) {
    const m = text.match(new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g'));
    if (m) hits[k] = [...new Set(m)].slice(0, 8);
  }
  rows.push({
    route, landed, redirected: landed !== route && !(route === '/' && landed === '/'),
    chars: text.length, buttons, hits, pageErrors: errors.slice(0, 3),
    text: text.slice(0, 420),
  });
  console.log(`${route.padEnd(22)} -> ${landed.padEnd(22)} ${String(text.length).padStart(5)} chars  ${Object.keys(hits).join(',') || '-'}`);
  await page.close();
}

await browser.close();
await server.close();
fs.writeFileSync(`${OUT}/sweep.json`, JSON.stringify({ routes: ROUTES.length, mode: 'backend unreachable (aborted)', rows }, null, 1));
console.log(`\n${ROUTES.length} routes walked. ${OUT}/sweep.json`);
