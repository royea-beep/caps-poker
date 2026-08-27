/**
 * CONTENT ENGINE — shared rig. Serving, the practice-only guard, and the browser.
 *
 * WHAT THIS IS FOR. Ten social videos have to exist before the accounts do. The raw material is
 * the app itself, driven by the same Playwright rig that has been measuring it for a week.
 *
 * ── THE PRACTICE-ONLY RULE, ENFORCED HERE AND NOT IN A BRIEF ────────────────────────────────
 * Nothing published may contain a real player's data. That is not a habit to remember, so it is
 * three independent mechanisms, each of which alone would be sufficient:
 *
 *   1. openGame() REFUSES any route that is not practice mode. It builds the URL itself from a
 *      seat count and will not accept a caller-supplied path at all, so there is no argument that
 *      can point it at a live table.
 *   2. Every context blocks supabase.co and ftable.co.il at the route layer, so even a bug that
 *      reached a live route could not fetch a real row.
 *   3. It serves a LOCAL export from localhost. Production is never contacted, which is also why
 *      the rig creates no devices to clean up — see tools/README.md.
 *
 * Practice mode is dealt entirely client-side (utils/deck.ts), so the cards on screen are the
 * harness's own and belong to nobody.
 *
 * ── DETERMINISM ─────────────────────────────────────────────────────────────────────────────
 * Math.random is pinned to a mulberry32 before any app code runs, exactly as the measurement
 * harnesses do it, so a given seed always deals the same hand. That is what makes "the seed that
 * produces a tie" a reusable fact rather than a lucky take.
 *
 * ── VIDEO GEOMETRY, MEASURED NOT ASSUMED ────────────────────────────────────────────────────
 * Playwright records CSS PIXELS AT 1:1 and pads to `recordVideo.size` with grey; it does NOT
 * scale the page up, and it IGNORES deviceScaleFactor for video. Measured: a 393x852 viewport in
 * a 1080x1920 canvas produced a page in the corner and 83% grey. So the viewport itself has to
 * carry the shape, and recordVideo.size is set equal to it.
 *
 * 486x864 is exactly 9:16 and the largest such box still inside the app's own phone breakpoint
 * (getDevice: isMobileWeb is W < 500). At it the game screen has ZERO overflow, so the vertical
 * frame is filled by the app rather than by bars. tools/cut.mjs scales 486x864 -> 1080x1920.
 */
import { chromium, webkit } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

export const VIEWPORT = { width: 486, height: 864 };   // exactly 9:16, inside the phone breakpoint
export const TARGET = { width: 1080, height: 1920 };   // what cut.mjs scales to
export const FPS = 25;                                 // what Playwright records; verified by ffprobe

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.ttf': 'font/ttf', '.woff2': 'font/woff2' };

/** Serve a local `expo export`. Production is never contacted. */
export async function serve(dir, port) {
  const DIR = path.resolve(dir);
  if (!fs.existsSync(path.join(DIR, 'index.html'))) {
    throw new Error(`no export at ${DIR} — run: npx expo export -p web --output-dir ${dir}`);
  }
  const server = http.createServer((req, res) => {
    const url = decodeURIComponent((req.url || '/').split('?')[0]);
    let file = path.join(DIR, url);
    if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      const asHtml = path.join(DIR, url.replace(/\/$/, '') + '.html');
      file = fs.existsSync(asHtml) ? asHtml : path.join(DIR, 'index.html');
    }
    // The bundle uses `import.meta`; production serves it as type="module" and a local export
    // does not. Without this the app never mounts and the video is of a blank page.
    if (path.extname(file) === '.html') {
      const html = fs.readFileSync(file, 'utf8').replace(/<script(?![^>]*type=)/g, '<script type="module"');
      res.writeHead(200, { 'Content-Type': 'text/html' }); res.end(html); return;
    }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  await new Promise((r) => server.listen(port, r));
  return server;
}

export async function launch() {
  const engine = process.env.CAPS_ENGINE === 'webkit' ? webkit : chromium;
  return engine.launch(process.env.CAPS_ENGINE === 'webkit'
    ? { headless: true }
    : { headless: true, ...(process.env.CAPS_BROWSER_PATH ? { executablePath: process.env.CAPS_BROWSER_PATH } : {}) });
}

const PIN_RANDOM = (seed) => {
  let a = seed >>> 0;
  Math.random = () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

/** The persisted store, onboarded and pinned to the classic palette a default user gets. */
function seedState({ skipReveal = false } = {}) {
  const j = JSON.parse(fs.readFileSync('tests/caps-onboarded.json', 'utf8'));
  const st = JSON.parse(j.origins[0].localStorage.find((e) => e.name === 'caps-poker-storage').value);
  st.state.visualTheme = 'classic';
  st.state.skipBoardReveal = skipReveal;
  return JSON.stringify(st);
}

/**
 * Open PRACTICE MODE. There is deliberately no way to ask this for another route: it takes a seat
 * count, not a path, and asserts the URL it built is practice before navigating. A caller cannot
 * point the rig at a live table because the argument for doing so does not exist.
 */
export async function openGame(browser, {
  port, players = 2, seed = 20260827, record = null, skipReveal = false, settle = 6000,
}) {
  if (![2, 3, 4].includes(players)) throw new Error(`players must be 2, 3 or 4 (board count is dynamic: 2P=4, 3P=3, 4P=2)`);
  const url = `http://localhost:${port}/game?practice=true&players=${players}&fresh=1`;
  if (!/[?&]practice=true(&|$)/.test(url)) throw new Error('PRACTICE GUARD: refusing a non-practice route');
  if (!/^http:\/\/localhost:/.test(url)) throw new Error('PRACTICE GUARD: refusing a non-local origin');

  const ctx = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: 1,   // ignored for video; stated so nobody re-derives it
    ...(record ? { recordVideo: { dir: record, size: VIEWPORT } } : {}),
  });
  // Second guard: no request may leave for production or the database, whatever the app tries.
  await ctx.route('**/*', (r) => (/supabase\.co|ftable\.co\.il/i.test(r.request().url()) ? r.abort() : r.continue()));
  const page = await ctx.newPage();
  await page.addInitScript(PIN_RANDOM, seed);
  await page.addInitScript((blob) => {
    try {
      localStorage.setItem('has_seen_interactive_tutorial', 'true');
      // Suppresses the first-hand coaching tips, which dim the WHOLE screen to ~0.6. A video shot
      // through that veil would publish a washed-out app.
      localStorage.setItem('caps_games_played', '25');
      localStorage.setItem('caps-poker-storage', blob);
    } catch (_) { /* unavailable */ }
  }, seedState({ skipReveal }));

  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e).slice(0, 160)));
  await page.goto(url, { waitUntil: 'load', timeout: 120000 });
  await page.waitForTimeout(settle);
  return { ctx, page, errs };
}

/** Fill every board through the app's own control, not by reaching into its state. */
export async function autoPlaceAll(page, { after = 2500 } = {}) {
  const b = page.locator('text=Auto-Place ALL').first();
  if (!(await b.count())) return false;
  await b.click({ force: true });
  await page.waitForTimeout(after);
  return true;
}

export async function pressReady(page, { after = 2000 } = {}) {
  const b = page.locator('[data-testid="ready-button"]').first();
  if (!(await b.count())) return false;
  await b.click({ force: true });
  await page.waitForTimeout(after);
  return true;
}

/** Tap through the per-board reveal until it stops offering one, or the app navigates away. */
export async function tapThroughReveal(page, { maxTaps = 14, gap = 1400 } = {}) {
  let taps = 0;
  for (let i = 0; i < maxTaps; i++) {
    if (/results|hand-history/.test(page.url())) break;
    const tap = page.locator('text=Tap to reveal').first();
    if (!(await tap.count())) { await page.waitForTimeout(gap); continue; }
    await tap.click({ force: true });
    taps++;
    await page.waitForTimeout(gap);
  }
  return taps;
}

/**
 * Read the hand's outcome off /results, in the APP'S OWN WORDS.
 *
 * ⚠️ THE OBVIOUS DERIVATION IS WRONG. The first version of this inferred the opponent's score as
 * `boardsTotal - boardsWon`, which silently assumes every board the player did not win was won by
 * the bot. AN INDIVIDUAL BOARD CAN TIE. Seed 4 is 2 boards to the player, 1 to the bot and 1
 * tied — the app says "YOU WIN 2 — 1" — and the bad arithmetic classified it as a hand-level TIE.
 * That very nearly published a video captioned "Nobody wins" over a screen reading YOU WIN.
 *
 * So the scoreboard is READ, not computed: the two numbers the app prints, and its own headline.
 */
export async function readOutcome(page) {
  return page.evaluate(() => {
    const t = document.body.innerText;
    // The app prints the score as "2 — 1" (em dash) under the headline.
    const score = t.match(/(\d+)\s*[—\-–]\s*(\d+)/);
    const mine = score ? Number(score[1]) : null;
    const theirs = score ? Number(score[2]) : null;
    // \b matters: an unanchored /TIE/i matches the "Tie" inside "Tier 2" in the XP block, which
    // made a 4-0 sweep report its headline as "Tie".
    const headline = (t.match(/YOU WIN|YOU LOSE|IT.S A TIE|\bTIE\b|\bDRAW\b/i) || [null])[0];
    const boards = (t.match(/Boards:\s*(\d+)\s*\/\s*(\d+)/) || []).slice(1).map(Number);
    return {
      url: location.pathname,
      headline,                       // what the player is actually told
      mine, theirs,                   // the printed scoreboard, not a derivation
      result: mine === null ? null : mine > theirs ? 'WIN' : mine < theirs ? 'LOSS' : 'TIE',
      boardsWon: boards[0] ?? null,
      boardsTotal: boards[1] ?? null,
      swept: /swept all boards/i.test(t),
      text: t.slice(0, 400),
    };
  });
}
