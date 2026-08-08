/**
 * AUDIT B — the celebration gate, measured DETERMINISTICALLY.
 *
 * Three sprints tried to reach the restraint case (won a board, LOST the hand) by dealing
 * hands. Eight dealt hands never produced it. Outcomes are dealt, not chosen — so this stops
 * dealing and injects the seven revealData shapes the rule can see.
 *
 * WHAT IT DRIVES. `utils/devRevealFixture.ts` — a `__DEV__`-only pass-through that swaps the
 * value the results screen pulls out of the store. The GATE IS NOT TOUCHED; only its input is.
 * `__DEV__` is unreachable on every web surface that mounts (see utils/devRevealFixture.ts for
 * the three measurements), so the probe bundle is a PRODUCTION export with the fixture guard
 * compiled in. The real release build never sets this variable, so its branch is dead there.
 *
 *   EXPO_PUBLIC_CAPS_FIXTURE=1 npx expo export -p web --output-dir web-fixture-dist
 *   node tests/celebration-gate-probe.mjs
 *
 * SAFETY. /results performs real economy writes (record_hand_net) on non-practice hands, and
 * rows 5-7 are non-practice. Every Supabase request is aborted at the network layer so a
 * fixture can never reach the live ledger.
 *
 * MEASUREMENT RULES (carried from the previous sprints, they were bought expensively):
 *  - Rule 14a preamble: headed browser, document.hidden === false, rAF actually ticking.
 *    "I could not observe it" is not "it did not happen".
 *  - Elements are selected by testID ANCHOR, never by geometry. Selecting the win dots by
 *    size/border-radius is what made E1 ship unverified.
 *  - Dot count is the MAX over the sampling window, polled from arrival — the overlay lives
 *    ~3s, so a single late sample catches its tail at best.
 */
import { chromium } from 'playwright';
import fs from 'fs';
import http from 'http';
import path from 'path';

const DIR = path.resolve('web-fixture-dist');
const PORT = Number(process.env.PROBE_PORT || 8123);
const W = 375, H = 812;

// ── static server with SPA fallback (web.output = 'single': one index.html, client routing) ──
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.ttf': 'font/ttf', '.woff': 'font/woff', '.woff2': 'font/woff2' };
// A RAW `expo export` IS NOT RUNNABLE. The bundle uses `import.meta`, so the classic
// <script ... defer> the exporter emits dies with `SyntaxError: Cannot use 'import.meta'
// outside a module` and #root stays empty — which reads as "0 dots" on every row and would
// have produced four silent false passes. scripts/fix-web-html.js is what adds type="module"
// on the deploy path; this applies the same transform IN MEMORY so nothing on disk is touched.
// (Do not run scripts/fix-web-html.js against this directory: it only looks at dist/ and
// web-dist/, and will silently patch the real web-dist instead.)
const toModule = (html) => html.replace(
  /<script src="(\/_expo\/static\/js\/web\/[^"]+)" defer><\/script>/,
  '<script type="module" src="$1"></script>',
);
const server = http.createServer((req, res) => {
  const url = decodeURIComponent((req.url || '/').split('?')[0]);
  let file = path.join(DIR, url);
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(DIR, 'index.html');
  const ext = path.extname(file).toLowerCase();
  res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
  if (ext === '.html') { res.end(toModule(fs.readFileSync(file, 'utf-8'))); return; }
  fs.createReadStream(file).pipe(res);
});
await new Promise((r) => server.listen(PORT, r));

// ── fixtures ────────────────────────────────────────────────────────────────────────────────
const SUITS = ['hearts', 'diamonds', 'clubs', 'spades'];
const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
let seq = 0;
const card = () => { const i = seq++; return { suit: SUITS[i % 4], rank: RANKS[i % 13], id: `f${i}` }; };
const cards = (n) => Array.from({ length: n }, card);

function board(winner) {
  return {
    winner,
    playerHandName: 'Pair of Kings', botHandName: 'Pair of Queens', allBotHandNames: ['Pair of Queens'],
    openCards: cards(3), closedCards: cards(2), playerCards: cards(4),
    botCards: cards(4), allBotCards: [cards(4)],
    playerHighlightIds: [], botHighlightIds: [], boardHighlightIds: [],
    potAmount: 100,
  };
}

/** Build a RevealData whose board winners give exactly playerWins / botWins. */
function fixture({ isPractice, playerWins, botWins, netChips }) {
  const boards = [
    ...Array.from({ length: playerWins }, () => board('player')),
    ...Array.from({ length: botWins }, () => board('bot')),
  ];
  return {
    boards,
    isPractice,
    netChips,
    playerChipsWon: Math.max(0, netChips),
    isComplete: false,
    completeBonusAmount: 0,
    completeWinner: null,
    boardRevealDuration: 1000,
    completeBonusDisplay: 0,
    turnRevealDelay: 500,
    potPerBoard: 50,
    numberOfPlayers: 2,
    boardCount: boards.length,
    // deliberately NO handId — record_hand_net is also blocked at the network layer.
  };
}

const ROWS = [
  { n: 1, isPractice: true,  playerWins: 3, botWins: 1, netChips: 100, expectDots: 20, expectCopy: 'Hand won! 🎉' },
  { n: 2, isPractice: true,  playerWins: 1, botWins: 3, netChips: 100, expectDots: 0,  expectCopy: null },
  { n: 3, isPractice: true,  playerWins: 2, botWins: 2, netChips: 100, expectDots: 0,  expectCopy: null },
  { n: 4, isPractice: true,  playerWins: 4, botWins: 0, netChips: 100, expectDots: 20, expectCopy: 'Hand won! 🎉' },
  { n: 5, isPractice: false, playerWins: 1, botWins: 3, netChips: 150, expectDots: 20, expectCopy: 'You won 150 chips! 🎉' },
  { n: 6, isPractice: false, playerWins: 3, botWins: 1, netChips: 0,   expectDots: 0,  expectCopy: null },
  { n: 7, isPractice: false, playerWins: 3, botWins: 1, netChips: -80, expectDots: 0,  expectCopy: null },
];

// ── run ─────────────────────────────────────────────────────────────────────────────────────
const out = { viewport: { W, H }, ts: new Date().toISOString(), rows: [] };
const browser = await chromium.launch({ headless: false, args: [`--window-size=${W + 20},${H + 140}`] });

try {
  for (const row of ROWS) {
    const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
    // SAFETY — no fixture may reach the live economy.
    await ctx.route('**/*', (r) => (/supabase|ftable\.co\.il/i.test(r.request().url()) ? r.abort() : r.continue()));

    const fx = fixture(row);
    const page = await ctx.newPage();
    const errs = [];
    page.on('pageerror', (e) => errs.push('PAGEERROR: ' + String(e).slice(0, 200)));
    page.on('console', (m) => { if (m.type() === 'error') errs.push('CONSOLE: ' + m.text().slice(0, 160)); });
    await page.addInitScript((f) => { globalThis.__CAPS_REVEAL_FIXTURE__ = f; }, fx);
    await page.goto(`http://localhost:${PORT}/results`, { waitUntil: 'load', timeout: 120000 });

    // Rule 14a preamble — prove the browser is actually rendering before believing a zero.
    const pre = await page.evaluate(async () => {
      const s = performance.now(); let raf = 0;
      await new Promise((r) => { const l = () => { raf++; performance.now() - s < 1500 ? requestAnimationFrame(l) : r(); };
        requestAnimationFrame(l); setTimeout(r, 2000); });
      return { hidden: document.hidden, rafCount: raf, ok: document.hidden === false && raf > 0 };
    });

    // Poll from arrival for 5s: the overlay opens ~after the fade-in and lives ~3s.
    const sample = await page.evaluate(async () => {
      const q = () => document.querySelectorAll('[data-testid="win-dot"]');
      let maxDots = 0; const mats = new Set(); let firstSeenMs = null, lastSeenMs = null;
      // THE OVERLAY IS TRANSIENT (~2.6s measured). Reading the copy AFTER the sampling window
      // returned null on every winning row and looked like missing copy — it was a dead read of
      // a closed overlay. Capture it inside the loop, while it is up.
      let overlayCopy = null, overlayLabel = null;
      const t0 = performance.now();
      await new Promise((res) => {
        const loop = () => {
          const dots = q();
          if (dots.length) {
            if (firstSeenMs === null) firstSeenMs = Math.round(performance.now() - t0);
            lastSeenMs = Math.round(performance.now() - t0);
            if (dots.length > maxDots) maxDots = dots.length;
            for (const d of dots) {
              const t = getComputedStyle(d).transform;
              if (t && t !== 'none') mats.add(t);
            }
            if (overlayCopy === null) {
              const el = [...document.querySelectorAll('[aria-label]')]
                .find((e) => /^(Hand won!|You won .* chips!)$/.test(e.getAttribute('aria-label') || ''));
              if (el) { overlayCopy = (el.textContent || '').trim(); overlayLabel = el.getAttribute('aria-label'); }
            }
          }
          performance.now() - t0 < 5000 ? requestAnimationFrame(loop) : res();
        };
        requestAnimationFrame(loop);
        setTimeout(res, 5500);
      });
      const headline = document.querySelector('[data-testid="result-headline"]');
      return {
        maxDots, distinctMatrices: mats.size, firstSeenMs, lastSeenMs,
        headline: headline ? headline.textContent.trim() : null,
        overlayCopy, overlayLabel,
        bodyMounted: document.getElementById('root')?.children.length > 0,
      };
    });

    // A ZERO FROM A DEAD PAGE IS NOT RESTRAINT. Rows 2/3/6/7 expect zero dots, so an app that
    // never mounted "passes" them silently — that happened on the first run of this probe.
    // The screen must be proven up (headline present) before any count is believed.
    const mounted = sample.bodyMounted && sample.headline !== null;
    const pass = mounted
      && sample.maxDots === row.expectDots
      && (row.expectCopy === null ? sample.overlayCopy === null : sample.overlayCopy === row.expectCopy);
    const verdict = !mounted ? 'INVALID(not mounted)' : pass ? 'PASS' : 'FAIL';
    out.rows.push({ ...row, precondition: pre, ...sample, mountedOk: mounted, errs: errs.slice(0, 5), PASS: pass, verdict });
    console.log(`ROW ${row.n} ${verdict} dots=${sample.maxDots}/${row.expectDots} copy=${JSON.stringify(sample.overlayCopy)} label=${JSON.stringify(sample.overlayLabel)} matrices=${sample.distinctMatrices} span=${sample.firstSeenMs}-${sample.lastSeenMs}ms headline=${JSON.stringify(sample.headline)} raf=${pre.rafCount}${errs.length ? ' ERR=' + JSON.stringify(errs[0]) : ''}`);
    await ctx.close();
  }
} finally {
  await browser.close();
  server.close();
  fs.writeFileSync('tests/celebration-gate-probe-result.json', JSON.stringify(out, null, 1));
  const fails = out.rows.filter((r) => !r.PASS).length;
  console.log(`\n=== ${out.rows.length - fails}/${out.rows.length} PASS ===`);
}
