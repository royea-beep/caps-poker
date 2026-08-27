/**
 * ALIGN-THE-CELEBRATION follow-up — THE SHAPE THE SPRINT MISSED, proved in a browser.
 *
 * The sprint closed chips-vs-boards. It left boards-vs-boards: `deriveHandOutcome` compared the
 * player's boards against the opponents' COMBINED total, while `resolve-hand` compares against the
 * HIGHEST SINGLE seat. Enumerating every reachable distribution found exactly one disagreement —
 * THREE PLAYERS, THREE BOARDS, ONE BOARD EACH — where the server records 'tied' for all three
 * seats and the screen said YOU LOSE to every one of them.
 *
 * The dealer will not produce that shape on demand (three sprints failed to deal the restraint
 * case, which is why the fixture harness exists at all), so it is SELECTED, not waited for, by the
 * same documented mechanism celebration-gate-probe.mjs uses: a production export built with
 * EXPO_PUBLIC_CAPS_FIXTURE=1, with revealData substituted one level ABOVE the rule under test.
 * The rule itself is untouched — substituting its INPUT is the whole point.
 *
 *   EXPO_PUBLIC_CAPS_FIXTURE=1 npx expo export -p web --output-dir web-fixture-dist
 *   node tests/parity-3p-probe.mjs
 *
 * Every row is read from the RENDERED headline and the overlay's own DOM nodes. Nothing is read
 * from the source, and the CONTROLS matter as much as the case: two- and four-player hands must
 * come back exactly as they were, because the risk in this fix is over-correcting a rare shape
 * into a common one.
 *
 * SAFETY — Supabase and the live host are aborted at the network layer, so no fixture can reach
 * the real ledger. /results runs real economy writes for a non-practice hand.
 */
import { chromium, webkit } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const DIR = path.resolve('web-fixture-dist');
const PORT = Number(process.env.PORT || 8790);
const ENGINE = process.env.ENGINE || 'chromium';
const W = Number(process.env.W || 393);
const H = Number(process.env.H || 852);

if (!fs.existsSync(DIR)) {
  console.error(`missing ${DIR} — build it first:\n  EXPO_PUBLIC_CAPS_FIXTURE=1 npx expo export -p web --output-dir web-fixture-dist`);
  process.exit(1);
}

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.ttf': 'font/ttf', '.woff2': 'font/woff2' };

const server = http.createServer((req, res) => {
  const url = decodeURIComponent((req.url || '/').split('?')[0]);
  let file = path.join(DIR, url);
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    const asHtml = path.join(DIR, url.replace(/\/$/, '') + '.html');
    file = fs.existsSync(asHtml) ? asHtml : path.join(DIR, 'index.html');
  }
  // SERVE index.html THE WAY PRODUCTION DOES. The bundle contains `import.meta` (in the redux
  // devtools guard), which is a PARSE error in a classic script — the page dies before React
  // mounts and every reading comes back null off a page that is painting happily. caps.ftable.co.il
  // serves `<script type="module" ...>`; the export produced in this container emits
  // `<script ... defer>` instead, so the tag is normalised here to match the deployed one rather
  // than measuring a bundle nobody ships. Verified against the live index.html, not assumed.
  if (path.extname(file) === '.html') {
    const html = fs.readFileSync(file, 'utf8').replace(/<script(?![^>]*type=)/g, '<script type="module"');
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(html);
    return;
  }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});
await new Promise((r) => server.listen(PORT, r));

// ── fixtures ────────────────────────────────────────────────────────────────────────────────
const SUITS = ['hearts', 'diamonds', 'clubs', 'spades'];
const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
let seq = 0;
const card = () => { const i = seq++; return { suit: SUITS[i % 4], rank: RANKS[i % 13], id: `f${i}` }; };
const cards = (n) => Array.from({ length: n }, card);

/**
 * ONE BOARD, described by the SEAT that won it — 0 = the local player, >=1 a specific opponent,
 * -1 the board itself tied. The collapsed `winner` token is derived from the seat here exactly as
 * the four real producers derive it, so the fixture cannot accidentally disagree with itself.
 */
function board(seat, opponents) {
  return {
    winner: seat === 0 ? 'player' : seat === -1 ? 'tie' : 'bot',
    winnerSeat: seat,
    playerHandName: 'Pair of Kings', botHandName: 'Pair of Queens',
    allBotHandNames: Array.from({ length: opponents }, () => 'Pair of Queens'),
    openCards: cards(3), closedCards: cards(2), playerCards: cards(4),
    botCards: cards(4), allBotCards: Array.from({ length: opponents }, () => cards(4)),
    playerHighlightIds: [], botHighlightIds: [], boardHighlightIds: [],
    potAmount: 100,
  };
}

function fixture({ seats, players, netChips }) {
  const boards = seats.map((s) => board(s, players - 1));
  return {
    boards,
    isPractice: false,
    netChips,
    playerChipsWon: Math.max(0, netChips),
    isComplete: false,
    completeBonusAmount: 0,
    completeWinner: null,
    boardRevealDuration: 1000,
    completeBonusDisplay: 0,
    turnRevealDelay: 500,
    potPerBoard: 50,
    numberOfPlayers: players,
    boardCount: boards.length,
    // deliberately NO handId — record_hand_net is blocked at the network layer as well.
  };
}

/**
 * `was` is what the SHIPPED build (main@945cc12) renders for the same fixture — the combined-count
 * rule. Rows where `was` differs from `expect` are the fix; rows where they agree are the controls
 * that must not move. A run in which no row changes has proved nothing.
 */
const ROWS = [
  { n: 1, name: 'THE CASE — 3P, one board each',      players: 3, seats: [0, 1, 2],    netChips: 0,   expect: 'TIE GAME', was: 'YOU LOSE' },
  { n: 2, name: '3P — one opponent takes two',        players: 3, seats: [0, 1, 1],    netChips: -50, expect: 'YOU LOSE', was: 'YOU LOSE' },
  { n: 3, name: '3P — player takes two',              players: 3, seats: [0, 0, 1],    netChips: 100, expect: 'YOU WIN',  was: 'YOU WIN'  },
  { n: 4, name: '3P — every board tied',              players: 3, seats: [-1, -1, -1], netChips: 0,   expect: 'TIE GAME', was: 'TIE GAME' },
  { n: 5, name: 'CONTROL 2P — clean win',             players: 2, seats: [0, 0, 0, 1], netChips: 150, expect: 'YOU WIN',  was: 'YOU WIN'  },
  { n: 6, name: 'CONTROL 2P — clean loss',            players: 2, seats: [1, 1, 1, 0], netChips: -150, expect: 'YOU LOSE', was: 'YOU LOSE' },
  { n: 7, name: 'CONTROL 4P — the sprint\'s own case', players: 4, seats: [0, 1],      netChips: 50,  expect: 'TIE GAME', was: 'TIE GAME' },
];

// ── run ─────────────────────────────────────────────────────────────────────────────────────
const engine = ENGINE === 'webkit' ? webkit : chromium;
const out = { engine: ENGINE, viewport: { W, H }, ts: new Date().toISOString(), rows: [] };
// The container ships a Playwright browser build that does not match this project's pinned
// version, so the binary is named explicitly rather than downloaded. CAPS_BROWSER_PATH overrides.
const executablePath = process.env.CAPS_BROWSER_PATH || undefined;
const browser = await engine.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });

try {
  for (const row of ROWS) {
    const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
    await ctx.route('**/*', (r) => (/supabase|ftable\.co\.il/i.test(r.request().url()) ? r.abort() : r.continue()));

    const fx = fixture(row);
    const page = await ctx.newPage();
    const errs = [];
    page.on('pageerror', (e) => errs.push('PAGEERROR: ' + String(e).slice(0, 200)));
    page.on('console', (m) => { if (m.type() === 'error') errs.push('CONSOLE: ' + m.text().slice(0, 160)); });
    await page.addInitScript((f) => { globalThis.__CAPS_REVEAL_FIXTURE__ = f; }, fx);
    await page.goto(`http://localhost:${PORT}/results`, { waitUntil: 'load', timeout: 120000 });

    // Rule 14a — prove the browser is actually painting before believing an absence. A headline
    // that never rendered and a headline that says TIE GAME are different findings, and a zero
    // read off a dead page has been mistaken for a measurement in this project before.
    const pre = await page.evaluate(async () => {
      const s = performance.now(); let raf = 0;
      await new Promise((r) => { const l = () => { raf++; performance.now() - s < 1200 ? requestAnimationFrame(l) : r(); };
        requestAnimationFrame(l); setTimeout(r, 1800); });
      return { hidden: document.hidden, rafCount: raf, ok: document.hidden === false && raf > 0 };
    });

    // The overlay is TRANSIENT (~2.6s measured last sprint), so it is sampled while it is up
    // rather than read after the fact — a dead read of a closed overlay looks exactly like
    // restraint, and that mistake is on the record.
    const sample = await page.evaluate(async () => {
      const headlineNow = () => document.querySelector('[data-testid="result-headline"]')?.textContent?.trim() ?? null;
      let maxDots = 0, overlayCopy = null, headline = null;
      const t0 = performance.now();
      await new Promise((res) => {
        const tick = () => {
          headline = headlineNow() ?? headline;
          const dots = document.querySelectorAll('[data-testid="win-dot"]').length;
          if (dots > maxDots) maxDots = dots;
          const node = [...document.querySelectorAll('div,span')]
            .find((el) => /🎉/.test(el.textContent || '') && el.children.length === 0);
          if (node && !overlayCopy) overlayCopy = node.textContent.trim();
          if (performance.now() - t0 < 6000) requestAnimationFrame(tick); else res();
        };
        requestAnimationFrame(tick);
      });
      return { headline, maxDots, overlayCopy };
    });

    const verdict = sample.headline === row.expect ? 'PASS' : 'FAIL';
    const changed = row.expect !== row.was;
    out.rows.push({ ...row, ...sample, painted: pre.ok, rafCount: pre.rafCount, errs, verdict, changed });
    console.log(
      `${String(row.n).padStart(2)} ${verdict}  ${row.name.padEnd(34)} ` +
      `headline=${String(sample.headline).padEnd(9)} overlayDots=${String(sample.maxDots).padEnd(3)} ` +
      `copy=${sample.overlayCopy ?? '—'} ${changed ? '  <-- CHANGED BY THE FIX (was ' + row.was + ')' : ''}` +
      `${errs.length ? '  ERRS:' + errs.length : ''}`,
    );
    await ctx.close();
  }
} finally {
  await browser.close();
  server.close();
}

const failed = out.rows.filter((r) => r.verdict === 'FAIL');
const changedRows = out.rows.filter((r) => r.changed);
const unpainted = out.rows.filter((r) => !r.painted);
console.log(`\n${out.rows.length - failed.length}/${out.rows.length} rows as expected · ` +
  `${changedRows.length} changed by the fix · ${unpainted.length} unpainted`);
fs.writeFileSync('test-results/parity-3p-probe.json', JSON.stringify(out, null, 2));
// A run where nothing changed is a run that proved nothing — the fix must be visible.
process.exit(failed.length === 0 && changedRows.length > 0 && unpainted.length === 0 ? 0 : 1);
