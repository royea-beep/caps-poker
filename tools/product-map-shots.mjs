/**
 * PRODUCT MAP — one still per route, from the build-515 code.
 *
 * ⚠️ THE ROUTE LIST IS DERIVED FROM app/, NOT TYPED. A map that lists a screen the app no longer
 * has, or misses one it gained, is exactly the staleness this map exists to prevent — and a
 * hand-written list is how that happens. Anything under app/ that is a route becomes a row here,
 * so a new screen appears in the map the first time this runs.
 *
 * ⚠️ AND WHAT DOES NOT RENDER IS RECORDED, NOT HIDDEN. Several routes need state a cold visit does
 * not have: /results without a finished hand, /replay without a stored one, /multiplayer-game
 * without a room. Those are captured as they actually appear and labelled, because "this screen
 * cannot be reached cold" is a true and useful fact about the product.
 *
 *   DIST=dist node tools/product-map-shots.mjs
 */
import { serve } from './content-lib.mjs';
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const DIST = process.env.DIST || 'dist';
const PORT = Number(process.env.PORT || 8956);
const OUT = process.env.OUT || 'docs/product-map/screens-515';
const VIEW = { width: 393, height: 852 };
fs.mkdirSync(OUT, { recursive: true });

/** Derive every route from the app/ directory rather than trusting a list. */
function routes(dir = 'app', prefix = '') {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name.startsWith('_') || e.name.startsWith('+')) continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      const group = /^\(.+\)$/.test(e.name);           // (tabs) is a layout group, not a path segment
      out.push(...routes(full, group ? prefix : `${prefix}/${e.name}`));
    } else if (/\.tsx?$/.test(e.name)) {
      const base = e.name.replace(/\.tsx?$/, '');
      if (base === 'index') out.push(prefix || '/');
      else if (base.startsWith('[')) out.push(`${prefix}/DEMO`);   // a dynamic segment needs a value
      else out.push(`${prefix}/${base}`);
    }
  }
  return out;
}
const ROUTES = [...new Set(routes())].sort();
console.log(`${ROUTES.length} routes derived from app/`);

const server = await serve(DIST, PORT);
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const ctx = await browser.newContext({ viewport: VIEW, deviceScaleFactor: 2 });
await ctx.route('**/*', (r) => (/supabase\.co|ftable\.co\.il/i.test(r.request().url()) ? r.abort() : r.continue()));
await ctx.addInitScript(() => {
  try {
    localStorage.setItem('caps_language', 'en');
    localStorage.setItem('has_seen_interactive_tutorial', 'true');
    localStorage.setItem('caps_games_played', '25');
  } catch (_) {}
});

const report = [];
for (const route of ROUTES) {
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e).slice(0, 120)));
  const file = `${route === '/' ? 'home' : route.slice(1).replace(/\//g, '-')}.png`;
  let text = '';
  try {
    await page.goto(`http://localhost:${PORT}${route}`, { waitUntil: 'load', timeout: 60000 });
    await page.waitForTimeout(6000);
    await page.screenshot({ path: path.join(OUT, file) });
    text = (await page.evaluate(() => (document.body.innerText || '').replace(/\s+/g, ' '))).slice(0, 160);
  } catch (e) {
    errors.push(String(e).slice(0, 120));
  }
  const hebrew = (text.match(/[֐-׿]/g) || []).length;
  report.push({ route, file, textStart: text, hebrewChars: hebrew, errors });
  console.log(`${route.padEnd(22)} ${String(hebrew).padStart(2)} heb  ${text.slice(0, 70)}`);
  await page.close();
}
await browser.close();
server.close();
fs.writeFileSync(path.join(OUT, 'routes-report.json'), JSON.stringify(report, null, 1));
console.log(`\n${report.length} stills in ${OUT}`);
const withHebrew = report.filter((r) => r.hebrewChars > 0);
console.log(withHebrew.length ? `⚠️ Hebrew in an English capture on: ${withHebrew.map((r) => r.route).join(', ')}` : 'no Hebrew in any English capture');
