/**
 * VERIFY-EVERYTHING · SECTION D — THE WHOLE APP, ONCE, ON TWO ENGINES.
 *
 * Every route the router can reach, at four widths, in Chromium AND WebKit, from a build of the
 * source as it stands on `main`. WebKit is the second engine on purpose: it is Safari's engine,
 * so it is the closest thing a web harness has to the iOS binary Roye actually taps.
 *
 * WHAT IS CHECKED ON EVERY (route × width × engine):
 *   · console errors and page errors — any, at all
 *   · failed network requests from the page
 *   · horizontal overflow — scrollWidth wider than the viewport
 *   · touch targets under 44pt that are actually interactive and actually visible
 *   · interactive elements with no accessible name
 *   · whether the route rendered ANYTHING (a blank screen is a pass to a checker that only
 *     looks for errors, and that is how a dead route survives a sweep)
 *
 * THE SELF-TEST IS NOT OPTIONAL AND RUNS FIRST. Six defects are planted into a blank page — a
 * console error, a page error, a 20px button, an unlabelled button, a 3000px-wide element, and an
 * empty body — and the run ABORTS unless every one is caught. Across this series more filed
 * defects turned out to be measurement error than real, and the single cause every time was a
 * checker nobody had proved could fail. So it is proved here before any number is reported.
 *
 * TWO THINGS IT DELIBERATELY DOES NOT CLAIM:
 *   · It is the WEB build. iOS renders Georgia where this renders Playfair, and
 *     `adjustsFontSizeToFit` is a no-op here and real there. Nothing here is evidence about the
 *     phone.
 *   · A route that renders is not a route that WORKS. This proves reachability and the floor,
 *     not correctness of behaviour.
 *
 * Usage: xvfb-run -a node tests/verify-full-loop.mjs
 */

import { chromium, webkit } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';

const DIST = path.resolve('dist');
const WIDTHS = [320, 375, 393, 430];
const OUT = path.resolve('docs/verify-everything');
fs.mkdirSync(OUT, { recursive: true });

/** Every route file under app/, plus the params the dynamic ones need to render at all. */
const ROUTES = [
  '/', '/play', '/friends', '/cups', '/profile',
  '/achievements', '/battle-pass', '/chip-store', '/coaching', '/debug', '/game', '/gameover',
  '/hand-history', '/heatmap', '/leaderboard', '/lobby', '/lobby/private', '/lobby/table',
  '/missions', '/multiplayer-game', '/orientation-pick', '/rank', '/referral', '/replay',
  '/results', '/settings', '/shop', '/simulate', '/spectate', '/stats', '/theme-pick',
  '/club/AUDIT', '/invite/AUDIT',
];

/** The onboarding seed BackstopJS uses, so routes render their real content, not the tutorial. */
const SEED = {
  has_seen_interactive_tutorial: 'true',
  caps_games_played: '9',
  caps_onboarding_complete: 'true',
  caps_device_id: 'VERIFY-LOOP-LOCAL-ONLY',
};

// ── the checks, as ONE implementation used by both the self-test and the real sweep ───────────
const CHECKS = `(() => {
  const out = { tinyTargets: [], unnamed: [], overflow: null, textLen: 0, elements: 0 };
  const vw = window.innerWidth;
  out.overflow = document.documentElement.scrollWidth > vw + 1
    ? { scrollWidth: document.documentElement.scrollWidth, viewport: vw } : null;
  out.textLen = (document.body?.innerText || '').trim().length;
  out.elements = document.querySelectorAll('*').length;
  const interactive = [...document.querySelectorAll(
    'button,a[href],input,select,textarea,[role=button],[role=link],[role=tab],[role=switch],[tabindex]:not([tabindex="-1"])')];
  for (const el of interactive) {
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    const visible = r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none'
      && cs.opacity !== '0' && el.getAttribute('aria-hidden') !== 'true';
    if (!visible) continue;
    const label = (el.getAttribute('aria-label') || el.getAttribute('title')
      || el.innerText || el.getAttribute('alt') || el.value || '').trim();
    const desc = (el.tagName.toLowerCase() + (el.className && typeof el.className === 'string'
      ? '.' + el.className.split(/\\s+/).filter(Boolean).slice(0, 2).join('.') : '')).slice(0, 60);
    if (r.width < 44 || r.height < 44) {
      out.tinyTargets.push({ el: desc, w: Math.round(r.width), h: Math.round(r.height), label: label.slice(0, 30) });
    }
    if (!label) out.unnamed.push({ el: desc, w: Math.round(r.width), h: Math.round(r.height) });
  }
  return out;
})()`;

// ── a static server for dist, with SPA fallback so client-side routes resolve ─────────────────
/**
 * ⚠️ THE BUILD MUST BE THE ONE THAT SHIPS, AND THIS REFUSES TO RUN OTHERWISE.
 *
 * `npx expo export -p web` alone does NOT produce a bootable app. The bundle uses `import.meta`,
 * and the exported `<script>` tag has no `type="module"` — so every route renders the empty shell
 * and throws "Cannot use 'import.meta' outside a module". `scripts/fix-web-html.js` is the step
 * that patches it (and writes vercel.json), and CI runs it between export and deploy
 * (.github/workflows/web-deploy.yml:183).
 *
 * THE FIRST RUN OF THIS HARNESS SKIPPED IT and returned 264 blank routes and 264 page errors — a
 * clean sweep of findings, every one of them mine rather than the app's. That is precisely the
 * failure this series keeps hitting, so it is now a hard stop rather than a note: if index.html
 * has not been patched, the run aborts instead of reporting an app-shaped result.
 */
function requireShippableBuild() {
  const html = fs.readFileSync(path.join(DIST, 'index.html'), 'utf8');
  if (!/<script type="module"/.test(html)) {
    console.error('ABORT — dist/index.html is unpatched. Run:\n' +
      '  npx expo export -p web && node scripts/fix-web-html.js\n' +
      'Without the patch every route renders the empty shell and the whole run is meaningless.');
    process.exit(2);
  }
}
requireShippableBuild();

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
  '.ttf': 'font/ttf', '.woff': 'font/woff', '.woff2': 'font/woff2', '.mp3': 'audio/mpeg' };
const server = http.createServer((req, res) => {
  const p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  let f = path.join(DIST, p);
  if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) f = path.join(DIST, 'index.html');
  res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});
await new Promise((r) => server.listen(0, r));
const BASE = `http://127.0.0.1:${server.address().port}`;

// ── 0 · THE SELF-TEST. Plant six defects; abort if any is missed. ─────────────────────────────
async function selfTest(browser, engine) {
  const ctx = await browser.newContext({ viewport: { width: 393, height: 852 } });
  const page = await ctx.newPage();
  const consoleErrors = [], pageErrors = [];
  page.on('console', (m) => m.type() === 'error' && consoleErrors.push(m.text()));
  page.on('pageerror', (e) => pageErrors.push(e.message));

  await page.setContent(`<!doctype html><body>
    <button style="width:20px;height:20px" aria-label="tiny">x</button>
    <button style="width:60px;height:60px"></button>
    <div style="width:3000px;height:10px"></div>
    <script>console.error('PLANTED console error'); setTimeout(()=>{throw new Error('PLANTED page error')},0);</script>
  </body>`);
  await page.waitForTimeout(400);
  const r = await page.evaluate(CHECKS);

  const blank = await ctx.newPage();
  await blank.setContent('<!doctype html><body></body>');
  const rb = await blank.evaluate(CHECKS);

  const caught = {
    'console error': consoleErrors.some((t) => t.includes('PLANTED console error')),
    'page error': pageErrors.some((t) => t.includes('PLANTED page error')),
    'under-44 target': r.tinyTargets.some((t) => t.w === 20 && t.h === 20),
    'unnamed control': r.unnamed.length > 0,
    'horizontal overflow': r.overflow !== null,
    'blank page': rb.textLen === 0,
  };
  await ctx.close();
  const missed = Object.entries(caught).filter(([, ok]) => !ok).map(([k]) => k);
  console.log(`  self-test [${engine}]: ${Object.keys(caught).length - missed.length}/${Object.keys(caught).length} planted defects caught` +
    (missed.length ? `  ✗ MISSED: ${missed.join(', ')}` : '  ✓'));
  return missed;
}

// ── 1 · THE SWEEP ─────────────────────────────────────────────────────────────────────────────
async function sweep(browser, engine) {
  const rows = [];
  for (const width of WIDTHS) {
    const ctx = await browser.newContext({
      viewport: { width, height: 852 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
    });
    await ctx.addInitScript((seed) => {
      try { for (const [k, v] of Object.entries(seed)) localStorage.setItem(k, v); } catch {}
      try { localStorage.removeItem('guidedModeForced'); } catch {}
    }, SEED);

    for (const route of ROUTES) {
      const page = await ctx.newPage();
      const consoleErrors = [], pageErrors = [], netFail = [];
      page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 200)); });
      page.on('pageerror', (e) => pageErrors.push(String(e.message).slice(0, 200)));
      page.on('requestfailed', (r) => netFail.push(`${r.method()} ${r.url().slice(0, 100)}`));

      let checks = null, nav = 'ok';
      try {
        await page.goto(`${BASE}${route}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await page.waitForTimeout(2200);
        checks = await page.evaluate(CHECKS);
      } catch (e) { nav = `NAV FAILED: ${String(e.message).slice(0, 120)}`; }

      rows.push({ engine, width, route, nav,
        consoleErrors, pageErrors, netFail: netFail.filter((u) => !u.includes('supabase.co')),
        blocked: netFail.filter((u) => u.includes('supabase.co')).length,
        ...(checks ?? { tinyTargets: [], unnamed: [], overflow: null, textLen: 0, elements: 0 }) });
      await page.close();
    }
    await ctx.close();
    console.log(`  ${engine} @${width}: ${ROUTES.length} routes swept`);
  }
  return rows;
}

const all = [];
const selfTestMissed = {};
for (const [name, launcher] of [['chromium', chromium], ['webkit', webkit]]) {
  const browser = await launcher.launch({
    headless: name === 'webkit' ? true : false,
    executablePath: name === 'chromium' ? process.env.CAPS_BROWSER_PATH : undefined,
  });
  selfTestMissed[name] = await selfTest(browser, name);
  if (selfTestMissed[name].length) { console.log(`ABORT — the ${name} instrument cannot detect: ${selfTestMissed[name].join(', ')}`); }
  else all.push(...await sweep(browser, name));
  await browser.close();
}
server.close();

// ── 2 · THE REPORT ────────────────────────────────────────────────────────────────────────────
const totalCells = all.length;
const withConsole = all.filter((r) => r.consoleErrors.length);
const withPage = all.filter((r) => r.pageErrors.length);
const withNav = all.filter((r) => r.nav !== 'ok');
const withOverflow = all.filter((r) => r.overflow);
const blank = all.filter((r) => r.nav === 'ok' && r.textLen === 0);
const tiny = all.filter((r) => r.tinyTargets.length);
const unnamed = all.filter((r) => r.unnamed.length);

console.log(`\n\nFULL LOOP — ${totalCells} cells (${ROUTES.length} routes × ${WIDTHS.length} widths × 2 engines)\n`);
const line = (label, rowsIn) => console.log(`  ${label.padEnd(34)} ${String(rowsIn.length).padStart(4)} / ${totalCells}`);
line('navigation failed', withNav);
line('blank (rendered no text)', blank);
line('console errors', withConsole);
line('uncaught page errors', withPage);
line('horizontal overflow', withOverflow);
line('has a target under 44pt', tiny);
line('has an unnamed control', unnamed);

const uniq = (a) => [...new Set(a)];
if (withNav.length) { console.log('\n  ROUTES THAT WOULD NOT LOAD'); for (const r of withNav) console.log(`    ${r.engine} @${r.width} ${r.route} — ${r.nav}`); }
if (blank.length) { console.log('\n  ROUTES THAT RENDERED NOTHING'); for (const r of uniq(blank.map((r) => `${r.route}  (${r.engine} @${r.width}, ${r.elements} elements)`))) console.log(`    ${r}`); }
if (withConsole.length) { console.log('\n  CONSOLE ERRORS (distinct)'); for (const t of uniq(withConsole.flatMap((r) => r.consoleErrors)).slice(0, 25)) console.log(`    ${t}`); }
if (withPage.length) { console.log('\n  UNCAUGHT PAGE ERRORS (distinct)'); for (const t of uniq(withPage.flatMap((r) => r.pageErrors)).slice(0, 25)) console.log(`    ${t}`); }
if (withOverflow.length) { console.log('\n  HORIZONTAL OVERFLOW'); for (const r of withOverflow) console.log(`    ${r.engine} @${r.width} ${r.route} — ${r.overflow.scrollWidth}px in ${r.overflow.viewport}px`); }
if (tiny.length) {
  console.log('\n  TARGETS UNDER 44pt — grouped by route, worst width');
  const byRoute = {};
  for (const r of tiny) for (const t of r.tinyTargets) {
    (byRoute[r.route] ??= []).push(`${t.w}×${t.h} ${t.el}${t.label ? ` "${t.label}"` : ''} [${r.engine} @${r.width}]`);
  }
  for (const [route, list] of Object.entries(byRoute)) console.log(`    ${route}: ${uniq(list).slice(0, 6).join(' · ')}${list.length > 6 ? ` (+${list.length - 6} more)` : ''}`);
}
if (unnamed.length) {
  console.log('\n  UNNAMED INTERACTIVE ELEMENTS — grouped by route');
  const byRoute = {};
  for (const r of unnamed) for (const u of r.unnamed) (byRoute[r.route] ??= []).push(`${u.w}×${u.h} ${u.el}`);
  for (const [route, list] of Object.entries(byRoute)) console.log(`    ${route}: ${uniq(list).slice(0, 5).join(' · ')}`);
}

fs.writeFileSync(path.join(OUT, 'full-loop.json'), JSON.stringify({
  ts: new Date().toISOString(), widths: WIDTHS, routes: ROUTES, selfTestMissed, rows: all }, null, 2));
console.log(`\n-> docs/verify-everything/full-loop.json\n`);
