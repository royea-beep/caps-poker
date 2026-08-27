/**
 * THE FELT UNDER THE BOARDS — five real builds of the app, one hand, photographed identically.
 *
 * This is NOT the synthetic panel that chose the felt. The questions this sprint asks — what the
 * panel does to the felt behind it, to the empty slot outlines drawn on it, and to the card backs
 * sitting inside it — have no answer outside the real component tree. So each variant is a genuine
 * `expo export` with the panel tokens changed (tests/panel-variants.sh), served from localhost and
 * photographed. Nothing ships: the tokens are patched, exported, and reverted.
 *
 * TWO STATES, BECAUSE ONE STATE CANNOT SHOW EVERYTHING:
 *   A  arrangement   the empty slot outlines exist ONLY before cards are placed
 *   B  placed        every slot filled, so the card face and the cues cover the panel densely
 * The mint cue (community cards — `isCommunityCard`) and the neutral cue (the player's own cards)
 * are on the panel in both. The GOLD cue is not in either, and cannot be: it needs `revealed`, and
 * once a hand is revealed the app either plays the full-screen BoardReveal (cards on bare felt, no
 * panel) or lands on /results, whose BoardResultCard paints COLORS.surface rather than the panel
 * tokens. Verified by driving it, not assumed — see the handoff.
 *
 * TWO THINGS THAT SILENTLY RUIN A CAPTURE, both found by looking at the picture:
 *   - the first-hand coaching tips dim the entire screen. The card face measured rgb(156,155,150)
 *     instead of #FCFAF3 = every colour behind a ~0.61 veil. `caps_games_played` suppresses them.
 *   - `has_seen_interactive_tutorial` alone is NOT enough; it gates a different overlay.
 *
 * SAME HAND, BY CONSTRUCTION AND THEN BY PROOF. Practice mode deals through utils/deck.ts, whose
 * shuffle is Math.random, and no seed parameter exists anywhere in the app. So the harness pins
 * Math.random to a mulberry32 before any app code runs. tests/panel-measure.mjs then proves the
 * deal is identical by share-of-pixels — construction without the proof is only a claim, and a
 * share of 0.00 matching another 0.00 proves nothing at all.
 *
 * RULE 3 — the only fixed numbers are the viewport widths under test, which are the thing being
 * varied. The board count is never assumed: every seat count is walked, because 2P=4, 3P=3, 4P=2.
 *
 *   DIST=web-p0-dist LABEL=P0 node tests/panel-compare.mjs
 */
import { chromium, webkit } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

// SHIP-V1 2026-08-27 — SECOND ENGINE. Handoffs 108-113 all said WebKit was unavailable because
// "its download host closes the connection". That was WRONG: the download always succeeded and it
// was the host DEPENDENCY check that failed. `npx playwright install-deps webkit` fixes it and
// WebKit 26.4 launches. CAPS_ENGINE=webkit selects it; Chromium stays the default so every earlier
// number remains comparable. executablePath is Chromium-specific, so it is only passed to Chromium.
const ENGINE = process.env.CAPS_ENGINE === 'webkit' ? webkit : chromium;
const LAUNCH = process.env.CAPS_ENGINE === 'webkit'
  ? { headless: true }
  : { headless: true, ...(process.env.CAPS_BROWSER_PATH ? { executablePath: process.env.CAPS_BROWSER_PATH } : {}) };


const DIR = path.resolve(process.env.DIST || 'web-p0-dist');
const LABEL = process.env.LABEL || 'P0';
const OUT = path.resolve(process.env.OUT_DIR || 'panel-compare', LABEL);
const PORT = Number(process.env.PORT || 8801);
const SEED = Number(process.env.SEED || 20260827);
const CARD_BACK = process.env.CARD_BACK || 'classic';
fs.mkdirSync(OUT, { recursive: true });

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.ttf': 'font/ttf', '.woff2': 'font/woff2' };

const server = http.createServer((req, res) => {
  const url = decodeURIComponent((req.url || '/').split('?')[0]);
  let file = path.join(DIR, url);
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    const asHtml = path.join(DIR, url.replace(/\/$/, '') + '.html');
    file = fs.existsSync(asHtml) ? asHtml : path.join(DIR, 'index.html');
  }
  // The bundle uses `import.meta`; production serves it as type="module" and a local export does
  // not. Normalised for the same reason as the parity probe — a bundle that never mounts is not a
  // measurement, and this exact mistake once read as "the fix is not deployed".
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

/** The persisted store, with the card back under test. visualTheme is pinned to `classic`
 *  explicitly: that is what a default user gets (gameStore seeds `visualTheme: null`, and
 *  getTheme(null) resolves to classic), and pinning it stops a stale blob from silently
 *  selecting a different palette. */
const seedState = (() => {
  const j = JSON.parse(fs.readFileSync('tests/caps-onboarded.json', 'utf8'));
  const blob = j.origins[0].localStorage.find((e) => e.name === 'caps-poker-storage');
  const st = JSON.parse(blob.value);
  st.state.visualTheme = 'classic';
  st.state.cardBack = CARD_BACK;
  return JSON.stringify(st);
})();

const browser = await ENGINE.launch(LAUNCH);

const results = [];
for (const W of [393, 320]) {
  for (const players of [2, 3, 4]) {
    const ctx = await browser.newContext({ viewport: { width: W, height: 852 }, deviceScaleFactor: 2 });
    await ctx.route('**/*', (r) => (/supabase\.co|ftable\.co\.il/i.test(r.request().url()) ? r.abort() : r.continue()));
    const page = await ctx.newPage();
    // Pinned deal, registered before any app script runs so createDeck/shuffleDeck see it.
    await page.addInitScript((seed) => {
      let a = seed >>> 0;
      Math.random = () => {
        a = (a + 0x6D2B79F5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
    }, SEED);
    await page.addInitScript((blob) => {
      try {
        localStorage.setItem('has_seen_interactive_tutorial', 'true');
        localStorage.setItem('caps_games_played', '25');   // suppresses the screen-dimming tips
        localStorage.setItem('caps-poker-storage', blob);
      } catch (_) { /* localStorage may be unavailable */ }
    }, seedState);

    const errs = [];
    page.on('pageerror', (e) => errs.push(String(e).slice(0, 140)));
    await page.goto(`http://localhost:${PORT}/game?practice=true&players=${players}&fresh=1`,
      { waitUntil: 'load', timeout: 120000 });
    await page.waitForTimeout(4500);

    // Rule 14a — prove the page is painting before believing a single pixel read off it.
    const painted = await page.evaluate(async () => {
      const s = performance.now(); let raf = 0;
      await new Promise((r) => {
        const l = () => { raf++; performance.now() - s < 900 ? requestAnimationFrame(l) : r(); };
        requestAnimationFrame(l); setTimeout(r, 1400);
      });
      return { hidden: document.hidden, raf };
    });

    // Geometry and the ACTUAL painted layers, asked of the components by testID rather than
    // guessed at by coordinate. `panelLayers` is load-bearing: on web the panel is painted by the
    // container's CSS gradient AND by an absolute-fill LinearGradient child, so counting them is
    // how the doubled alpha is proven rather than asserted.
    const dom = await page.evaluate(() => {
      const surf = document.querySelector('[data-testid="board-surface"]');
      const boards = [...document.querySelectorAll('[data-testid^="board-"]')]
        .filter((e) => /^board-\d+$/.test(e.dataset.testid));
      const b0 = boards[0];
      const box = (el) => (({ x, y, width, height }) => ({ x: Math.round(x), y: Math.round(y),
        w: Math.round(width), h: Math.round(height) }))(el.getBoundingClientRect());
      const grad = (s) => (s && s !== 'none' ? s.slice(0, 150) : null);
      return {
        surface: surf ? box(surf) : null,
        boardCount: boards.length,
        board0: b0 ? box(b0) : null,
        panelLayers: b0 ? [grad(getComputedStyle(b0).backgroundImage),
          ...[...b0.children].map((k) => grad(getComputedStyle(k).backgroundImage))].filter(Boolean) : [],
        // A tip toast dims the whole screen; if one is present the capture is behind a veil and
        // every colour read off it is wrong. Recorded so it can never pass unnoticed again.
        tipVisible: /Place 4 on each board|Tap a card then a slot/.test(document.body.innerText),
        pageW: document.documentElement.clientWidth,
      };
    });

    const shot = async (state) => {
      const file = path.join(OUT, `game-${W}-${players}p-${state}.png`);
      await page.screenshot({ path: file });
      return path.basename(file);
    };
    const fileA = await shot('A');

    // STATE B — every slot filled. Auto-Place ALL is the app's own control, so this is the app
    // placing the cards, not the harness reaching into its state.
    let placed = false;
    const ap = page.locator('text=Auto-Place ALL').first();
    if (await ap.count()) { await ap.click({ force: true }); await page.waitForTimeout(3000); placed = true; }
    const fileB = await shot('B');

    results.push({ label: LABEL, W, players, painted, dom, placed, errs, cardBack: CARD_BACK,
      files: { A: fileA, B: fileB } });
    console.log(`  ${LABEL} ${W}px ${players}P  boards=${dom.boardCount}` +
      `  panelLayers=${dom.panelLayers.length}  tip=${dom.tipVisible ? 'VISIBLE — capture is veiled' : 'none'}` +
      `  placed=${placed}  raf=${painted.raf}  errs=${errs.length}`);
    await ctx.close();
  }
}
await browser.close();
server.close();
fs.writeFileSync(path.join(OUT, 'geometry.json'), JSON.stringify(results, null, 2));
console.log(`wrote ${OUT}`);
