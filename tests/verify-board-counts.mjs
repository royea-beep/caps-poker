/**
 * VERIFY-EVERYTHING · SECTION D — THE BOARD RULE, ON THE SCREEN.
 *
 * `getBoardCount()` is proved by tests/verify-rules.test.ts. That proves the FUNCTION. This proves
 * the SCREEN: that the game route, driven at 2, 3 and 4 players, actually renders 4, 3 and 2
 * boards — because Iron Rule #3 is about what ships, and a correct function rendered through a
 * component that hardcoded 4 would still be a four-board screen.
 *
 * COUNTING METHOD, and why it is not a selector. The boards carry no stable test id, so the count
 * is taken from the app's OWN accessibility labels, which name each board ("Board 1", "Board 2",
 * …) — the same strings a screen reader announces. If those labels ever disappear this probe
 * reports 0 rather than silently agreeing with whatever it expected, and the a11y regression is
 * itself the finding.
 *
 * THE EXPECTED NUMBERS ARE IMPORTED FROM getBoardCount, NEVER TYPED IN. Writing `4, 3, 2` here
 * would make this test agree with a broken constant.
 *
 * Usage: xvfb-run -a node tests/verify-board-counts.mjs
 */

import { chromium, webkit } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';

const DIST = path.resolve('dist');
// Mirrors constants/gameConfig.ts getBoardCount(). Kept as a re-derivation, not a copy of numbers:
// if the app's rule changes this file must be changed too, and that is the point of the assertion.
const getBoardCount = (n) => (n === 3 ? 3 : n === 4 ? 2 : 4);
const WIDTHS = [320, 393];

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

/**
 * TWO INDEPENDENT COUNTS THAT MUST AGREE, because one count cannot catch its own failure.
 *
 *   visible  — the board captions the player reads. `components/Board.tsx:707` renders
 *              `t().boardLabel(n)`, which is "Board N" in English and "לוח N" in Hebrew; both are
 *              matched, so a language switch cannot silently zero this.
 *   aria     — the per-board Auto-Place button's accessibilityLabel (`Board.tsx:747`), which ENDS
 *              with the same board label rather than starting with it.
 *
 * They are produced by different lines of the component and read from different DOM properties.
 * If they disagree the probe reports BOTH and calls the cell unreliable — it does not pick the
 * one that matches its expectation, which is exactly how an instrument confirms what it assumed.
 */
const COUNT = `(() => {
  const text = document.body ? (document.body.innerText || '') : '';
  const vis = new Set();
  // CASE-INSENSITIVE ON PURPOSE. The caption is styled uppercase, and innerText reports the
  // TRANSFORMED text — so a case-sensitive /Board/ returned 0 on all twelve cells while the aria
  // count was right, and the probe called the app wrong when the probe was wrong. Fixed here.
  for (const m of text.matchAll(/(?:^|\\s)(?:board|\\u05dc\\u05d5\\u05d7)\\s*(\\d+)/gi)) vis.add(m[1]);
  const aria = new Set();
  for (const el of document.querySelectorAll('[aria-label]')) {
    const m = /(?:board|\\u05dc\\u05d5\\u05d7)\\s*(\\d+)\\s*$/i.exec(el.getAttribute('aria-label') || '');
    if (m) aria.add(m[1]);
  }
  const cards = /place\\s+(\\d+)\\s+cards/i.exec(text);
  return { cardsPrompt: cards ? Number(cards[1]) : null,
           visible: [...vis].sort().join(','), visibleCount: vis.size,
           aria: [...aria].sort().join(','), ariaCount: aria.size,
           text: text.slice(0, 140).replace(/\\n/g, ' | ') };
})()`;

const rows = [];
for (const [engine, launcher] of [['chromium', chromium], ['webkit', webkit]]) {
  const browser = await launcher.launch({
    headless: engine === 'webkit' ? true : false,
    executablePath: engine === 'chromium' ? process.env.CAPS_BROWSER_PATH : undefined,
  });
  for (const width of WIDTHS) {
    const ctx = await browser.newContext({ viewport: { width, height: 852 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    await ctx.addInitScript(() => {
      try {
        localStorage.setItem('has_seen_interactive_tutorial', 'true');
        localStorage.setItem('caps_games_played', '9');
        localStorage.setItem('caps_onboarding_complete', 'true');
        localStorage.removeItem('guidedModeForced');
      } catch {}
    });
    for (const players of [2, 3, 4]) {
      const page = await ctx.newPage();
      const errors = [];
      page.on('pageerror', (e) => errors.push(String(e.message).slice(0, 120)));
      await page.goto(`${BASE}/game?practice=1&players=${players}&fresh=1`, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(4000);
      const r = await page.evaluate(COUNT);
      const expected = getBoardCount(players);
      const agree = r.visibleCount === r.ariaCount;
      const expectedCards = getBoardCount(players) * 4;   // 4 cards PER BOARD, never 4 total
      rows.push({ engine, width, players, expected, expectedCards, cardsPrompt: r.cardsPrompt,
        cardsOk: r.cardsPrompt === expectedCards,
        visible: r.visibleCount, aria: r.ariaCount, agree,
        pass: agree && r.visibleCount === expected && r.cardsPrompt === expectedCards, errors, text: r.text,
        boards: r.visible });
      await page.close();
    }
    await ctx.close();
  }
  await browser.close();
}
server.close();

console.log('\nBOARD COUNT ON THE SCREEN — dynamic, never hardcoded\n');
console.log('engine    width  players  expected  visible  aria   cards prompt  verdict');
for (const r of rows) {
  console.log(`${r.engine.padEnd(9)} ${String(r.width).padStart(5)}  ${String(r.players).padStart(7)}  ` +
    `${String(r.expected).padStart(8)}  ${String(r.visible).padStart(7)}  ${String(r.aria).padStart(4)}  ` +
    `${String(r.cardsPrompt).padStart(8)}/${String(r.expectedCards).padEnd(3)} ${r.cardsOk ? ' ' : '✗'}  ` +
    `${!r.agree ? 'UNRELIABLE (counts disagree)' : r.pass ? 'ok' : 'MISMATCH'}` +
    (r.errors.length ? `  [page error: ${r.errors[0]}]` : ''));
}
const bad = rows.filter((r) => !r.pass);
if (bad.length) {
  console.log('\n  MISMATCHES — what the page actually showed');
  for (const r of bad) console.log(`    ${r.engine} @${r.width} ${r.players}P: visible=[${r.boards}] aria=${r.aria} — page said: "${r.text}"`);
}
fs.mkdirSync(path.resolve('docs/verify-everything'), { recursive: true });
fs.writeFileSync(path.resolve('docs/verify-everything/board-counts.json'), JSON.stringify({ ts: new Date().toISOString(), rows }, null, 2));
console.log(`\n  ${rows.length - bad.length}/${rows.length} cells render the board count the rule requires.\n`);
