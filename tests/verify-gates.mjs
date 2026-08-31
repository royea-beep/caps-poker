/**
 * VERIFY-EVERYTHING · SECTION D — THE GATED SCREENS, ON A PRODUCTION BUILD.
 *
 * Four surfaces in this app are supposed to be CLOSED right now, each for a different reason. A
 * route sweep that only asks "did it render without errors" passes all four whether they are shut
 * or wide open, so they are checked by what they actually show.
 *
 *   /chip-store   closed by DATA — `iap_enabled` and `web_payments_enabled` are both false in
 *                 app_config, so the buy surface must not appear and the screen must say so.
 *   /simulate     closed by BUILD — `if (!__DEV__) router.replace('/')`.
 *   /debug        closed by BUILD — same guard.
 *   /spectate     closed by STATE — replaces to '/' when there is nothing to spectate.
 *
 * THE GATE IS PROVED BY LOOKING FOR WHAT MUST NOT BE THERE, not by the absence of an error. A
 * blank screen would satisfy "no buy button" while telling us nothing, so each cell also records
 * whether the page rendered anything at all, and a blank one is reported as INCONCLUSIVE rather
 * than as a closed gate.
 *
 * Usage: xvfb-run -a node tests/verify-gates.mjs
 */

import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';

const DIST = path.resolve('dist');
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

const GATES = [
  { route: '/chip-store', why: 'iap_enabled=false AND web_payments_enabled=false',
    mustNotShow: /\bbuy\b|purchase now|\$\s?\d|₪\s?\d/i, shouldSay: /not available|coming soon|בקרוב|לא זמין/i },
  { route: '/simulate', why: '__DEV__ guard — production build', expectHome: true },
  { route: '/debug', why: '__DEV__ guard — production build', expectHome: true },
  { route: '/spectate', why: 'replaces to / when there is nothing to spectate', expectHome: true },
];

const browser = await chromium.launch({ headless: false, executablePath: process.env.CAPS_BROWSER_PATH });
const ctx = await browser.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
await ctx.addInitScript(() => {
  try {
    localStorage.setItem('has_seen_interactive_tutorial', 'true');
    localStorage.setItem('caps_games_played', '9');
    localStorage.setItem('caps_onboarding_complete', 'true');
    localStorage.removeItem('guidedModeForced');
  } catch {}
});

// The home screen's own signature, taken once so "did it land on home" is measured, not guessed.
const homePage = await ctx.newPage();
await homePage.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
await homePage.waitForTimeout(3500);
const homeText = (await homePage.evaluate(() => document.body.innerText || '')).slice(0, 400);
const homeMarker = /Four cards on every board/i.test(homeText) ? /Four cards on every board/i : null;
await homePage.close();
if (!homeMarker) console.log('  ⚠️ home marker not found — "landed on home" cannot be measured this run');

const rows = [];
for (const g of GATES) {
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 120)));
  await page.goto(`${BASE}${g.route}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(4000);
  const text = await page.evaluate(() => (document.body.innerText || '').trim());
  const url = page.url();
  const blank = text.length === 0;
  const landedHome = homeMarker ? homeMarker.test(text) : null;

  let verdict;
  if (blank) verdict = 'INCONCLUSIVE — rendered nothing';
  else if (g.expectHome) verdict = landedHome === true ? 'CLOSED — redirected to home'
    : landedHome === false ? 'OPEN — the screen rendered' : 'UNKNOWN — no home marker';
  else {
    const leaks = g.mustNotShow.test(text);
    const says = g.shouldSay.test(text);
    verdict = leaks ? 'OPEN — buy surface is present' : says ? 'CLOSED — and it says so' : 'CLOSED — but says nothing';
  }
  rows.push({ route: g.route, why: g.why, verdict, url: url.replace(BASE, ''), chars: text.length,
    text: text.slice(0, 180).replace(/\n/g, ' | '), errs });
  await page.close();
}
await ctx.close(); await browser.close(); server.close();

console.log('\nGATED SCREENS — production web build, both payment flags false in app_config\n');
for (const r of rows) {
  console.log(`  ${r.route}`);
  console.log(`     gate     : ${r.why}`);
  console.log(`     verdict  : ${r.verdict}`);
  console.log(`     showed   : ${r.chars} chars — "${r.text}"${r.errs.length ? `  [page error: ${r.errs[0]}]` : ''}\n`);
}
fs.mkdirSync(path.resolve('docs/verify-everything'), { recursive: true });
fs.writeFileSync(path.resolve('docs/verify-everything/gates.json'), JSON.stringify({ ts: new Date().toISOString(), rows }, null, 2));
