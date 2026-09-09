/**
 * DISMISS-THE-TIPS §1 — establish WHY the explanations are seen on repeat, before building
 * anything. Drives the app as a RETURNING player and reports what actually happens.
 *
 * The three explanation surfaces, from the code:
 *   T  InteractiveTutorial      home overlay, first run   key: has_seen_interactive_tutorial
 *   G  Guided tooltips (6)      game screen, first hand   key: caps_games_played (=== 0)
 *   H  First-time board hint    game screen, first hand   key: caps_games_played (< 1)
 * G and H hinge on the SAME counter, and that counter has exactly ONE writer in the whole
 * codebase: app/game.tsx, in the reveal-done handler. If that write does not land, both come
 * back for ever — which is what "sometimes it's really annoying" would feel like.
 *
 *   npx expo export -p web --output-dir web-tips-dist --clear
 *   node tests/tips-persistence.mjs
 */
import { chromium, webkit } from 'playwright';
import fs from 'fs';
import http from 'http';
import path from 'path';

const DIR = path.resolve(process.env.PROBE_DIR || 'web-tips-dist');
const PORT = Number(process.env.PROBE_PORT || 8291);
const OUT = path.resolve('docs/dismiss-tips');
fs.mkdirSync(OUT, { recursive: true });

const MIME = { '.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json',
  '.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml','.ttf':'font/ttf',
  '.woff':'font/woff','.woff2':'font/woff2','.ico':'image/x-icon','.mp3':'audio/mpeg','.wav':'audio/wav' };
const toModule = (h) => h.replace(
  /<script src="(\/_expo\/static\/js\/web\/[^"]+)" defer><\/script>/,
  '<script type="module" src="$1"></script>');
const server = http.createServer((req, res) => {
  const u = decodeURIComponent((req.url || '/').split('?')[0]);
  let f = path.join(DIR, u);
  if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) f = path.join(DIR, 'index.html');
  const e = path.extname(f).toLowerCase();
  if (e === '.html') { res.writeHead(200, { 'Content-Type': 'text/html' });
    return res.end(toModule(fs.readFileSync(f, 'utf8'))); }
  res.writeHead(200, { 'Content-Type': MIME[e] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});
const SITE = `http://127.0.0.1:${PORT}`;

const FIRE = `window.__f = (el) => { const r = el.getBoundingClientRect();
  const o = { bubbles: true, cancelable: true, clientX: r.x + r.width/2, clientY: r.y + r.height/2 };
  for (const t of ['pointerdown','mousedown','pointerup','mouseup','click'])
    el.dispatchEvent(new (t.startsWith('pointer') ? PointerEvent : MouseEvent)(t, o)); };`;

/** The three surfaces, read from the RENDERED page — not from storage, not from source. */
const READ_SURFACES = `(() => {
  const txt = document.body.innerText || '';
  const has = (s) => txt.includes(s);
  return {
    tutorial:  has('SKIP') || has('דלג') || /Welcome to CAPS|ברוכים הבאים/i.test(txt),
    tipCards:  has('These are your cards') || has('אלה הקלפים שלך'),
    tipTapCard:has('Tap a card then a slot') || has('לחץ קלף ואז מקום ריק'),
    tipAny:    has('These are your cards') || has('Tap a card then a slot') ||
               has('Nice! 3 more cards') || has('Hand strength shown here') ||
               has('The game picks your best hand') || has('All set! Tap READY') ||
               has('אלה הקלפים שלך') || has('לחץ קלף ואז מקום ריק') || has('יופי! עוד 3 קלפים') ||
               has('עוצמת היד מוצגת') || has('המשחק בוחר את היד') || has('הכל מוכן'),
    boardHint: has('Tap a card from your hand, then tap a board') ||
               has('Try to win ALL boards') ||
               has('הקש על קלף מהיד') || has('נסה לנצח את כל הבורדים'),
  };
})()`;

const READ_STORE = `(() => { try { return {
  tutorialSeen: localStorage.getItem('has_seen_interactive_tutorial'),
  gamesPlayed:  localStorage.getItem('caps_games_played'),
  tipsOff:      localStorage.getItem('caps_show_tips'),
}; } catch (e) { return { error: String(e && e.message) }; } })()`;

async function settle(page, ms = 6500) { await page.waitForTimeout(ms); }

async function playOneHand(page, log) {
  await page.goto(`${SITE}/game?fresh=1&practice=1`, { waitUntil: 'load', timeout: 120000 });
  await page.addInitScript(FIRE);
  await page.evaluate(FIRE);
  await settle(page, 8000);
  const before = await page.evaluate(READ_SURFACES);
  // Auto-place every board, then READY.
  for (let i = 0; i < 5; i++) {
    await page.evaluate(`(()=>{const els=[...document.querySelectorAll('[role="button"],button,[tabindex]')];
      const b=els.find(x=>/auto-place|מילוי|מלא הכל/i.test(x.getAttribute('aria-label')||x.textContent||''));
      if(b&&window.__f)window.__f(b);})()`);
    await page.waitForTimeout(1400);
  }
  await page.evaluate(`(()=>{const r=document.querySelector('[data-testid="ready-button"]');
    if(r&&window.__f){window.__f(r);return;}
    const els=[...document.querySelectorAll('[role="button"],button')];
    const b=els.find(x=>/ready|מוכן/i.test(x.getAttribute('aria-label')||x.textContent||''));
    if(b&&window.__f)window.__f(b);})()`);
  // Reveal runs board by board; give it room, tapping through any "tap to continue".
  for (let i = 0; i < 14; i++) {
    await page.waitForTimeout(2000);
    await page.evaluate(`(()=>{const els=[...document.querySelectorAll('[role="button"],button')];
      const b=els.find(x=>/tap to continue|המשך|play again|שחק שוב/i.test(x.textContent||''));
      if(b&&window.__f)window.__f(b);})()`);
    const url = page.url();
    if (/results/.test(url)) break;
  }
  await page.waitForTimeout(4000);
  log.push(`      hand driven; ended at ${page.url().replace(SITE,'')}`);
  return before;
}

(async () => {
  await new Promise((r) => server.listen(PORT, r));
  const log = [];
  const facts = {};
  const engines = [
    { name: 'chromium', launcher: chromium, exe: process.env.CAPS_CHROMIUM || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' },
    { name: 'webkit',   launcher: webkit,   exe: undefined },
  ];

  for (const eng of engines) {
    for (const lang of ['en', 'he']) {
      for (const width of [320, 393]) {
        const tag = `${eng.name}-${lang}-${width}`;
        let browser;
        try {
          browser = await eng.launcher.launch(eng.exe ? { executablePath: eng.exe } : {});
        } catch (e) { log.push(`  ${tag}: launch failed — ${String(e.message).slice(0,90)}`); continue; }
        const ctx = await browser.newContext({ viewport: { width, height: 780 } });
        await ctx.addInitScript(FIRE);
        await ctx.addInitScript(`try{localStorage.setItem('caps_language','${lang}');}catch(e){}`);
        const page = await ctx.newPage();
        const F = {};

        // ── A. BRAND-NEW DEVICE ────────────────────────────────────────────────
        await page.goto(`${SITE}/`, { waitUntil: 'load', timeout: 120000 });
        await settle(page, 9000);
        F.newDevice = await page.evaluate(READ_SURFACES);
        F.newDeviceStore = await page.evaluate(READ_STORE);
        if (width === 393 && lang === 'en' && eng.name === 'chromium')
          await page.screenshot({ path: path.join(OUT, 'A-new-device-home.png') });

        // Dismiss the tutorial the way a player does.
        F.skipClicked = await page.evaluate(`(()=>{const els=[...document.querySelectorAll('[role="button"],button,[tabindex],div')];
          const b=els.find(x=>/skip the tutorial|דלג על המדריך/i.test(x.getAttribute('aria-label')||''));
          if(b&&window.__f){window.__f(b);return true;} return false;})()`);
        await page.waitForTimeout(2500);
        F.afterSkipStore = await page.evaluate(READ_STORE);
        F.afterSkipSurfaces = await page.evaluate(READ_SURFACES);

        // ── B. DISMISSAL SURVIVES A RELOAD ─────────────────────────────────────
        await page.goto(`${SITE}/`, { waitUntil: 'load', timeout: 120000 });
        await settle(page, 8000);
        F.afterReload = await page.evaluate(READ_SURFACES);

        // ── C. FIRST HAND — the tips SHOULD appear ─────────────────────────────
        F.firstHand = await playOneHand(page, log);
        F.afterFirstHandStore = await page.evaluate(READ_STORE);

        // ── D. RETURNING PLAYER — a SECOND hand, same device ───────────────────
        F.secondHand = await playOneHand(page, log);
        F.afterSecondHandStore = await page.evaluate(READ_STORE);
        if (width === 393 && lang === 'en' && eng.name === 'chromium')
          await page.screenshot({ path: path.join(OUT, 'D-second-hand.png') });

        // ── E. NEW SESSION (same storage, new context) ─────────────────────────
        const state = await ctx.storageState();
        const ctx2 = await browser.newContext({ viewport: { width, height: 780 }, storageState: state });
        await ctx2.addInitScript(FIRE);
        const page2 = await ctx2.newPage();
        await page2.goto(`${SITE}/`, { waitUntil: 'load', timeout: 120000 });
        await settle(page2, 8000);
        F.newSessionHome = await page2.evaluate(READ_SURFACES);
        await page2.goto(`${SITE}/game?fresh=1&practice=1`, { waitUntil: 'load', timeout: 120000 });
        await settle(page2, 8000);
        F.newSessionGame = await page2.evaluate(READ_SURFACES);
        F.newSessionStore = await page2.evaluate(READ_STORE);
        await ctx2.close();

        // ── F. CLEARED CACHE (a genuinely fresh context) ───────────────────────
        const ctx3 = await browser.newContext({ viewport: { width, height: 780 } });
        await ctx3.addInitScript(FIRE);
        const page3 = await ctx3.newPage();
        await page3.goto(`${SITE}/`, { waitUntil: 'load', timeout: 120000 });
        await settle(page3, 9000);
        F.clearedCache = await page3.evaluate(READ_SURFACES);
        await ctx3.close();

        facts[tag] = F;
        await ctx.close(); await browser.close();
        log.push(`  ${tag}: done`);
      }
    }
  }

  fs.writeFileSync(path.join(OUT, 'tips-persistence.json'), JSON.stringify(facts, null, 2));

  console.log('\n================ DISMISS-THE-TIPS · §1 OBSERVED BEHAVIOUR ================');
  for (const [tag, F] of Object.entries(facts)) {
    console.log(`\n--- ${tag}`);
    console.log(`  A new device   : tutorial=${F.newDevice.tutorial}  store=${JSON.stringify(F.newDeviceStore)}`);
    console.log(`    SKIP clicked : ${F.skipClicked}  -> tutorialStillUp=${F.afterSkipSurfaces?.tutorial}  store=${JSON.stringify(F.afterSkipStore)}`);
    console.log(`  B after reload : tutorial=${F.afterReload.tutorial}   <- must be false`);
    console.log(`  C hand 1       : tipAny=${F.firstHand.tipAny} boardHint=${F.firstHand.boardHint}  <- must be TRUE`);
    console.log(`    counter now  : ${JSON.stringify(F.afterFirstHandStore)}   <- caps_games_played must be >= 1`);
    console.log(`  D hand 2       : tipAny=${F.secondHand.tipAny} boardHint=${F.secondHand.boardHint}  <- must be FALSE`);
    console.log(`    counter now  : ${JSON.stringify(F.afterSecondHandStore)}`);
    console.log(`  E new session  : homeTutorial=${F.newSessionHome.tutorial} gameTip=${F.newSessionGame.tipAny} boardHint=${F.newSessionGame.boardHint}`);
    console.log(`  F cleared cache: tutorial=${F.clearedCache.tutorial}   <- SHOULD be true (a stranger must be taught)`);
  }
  console.log('\n' + log.join('\n'));
  console.log(`\nfacts -> ${path.join(OUT, 'tips-persistence.json')}`);
  server.close();
  process.exit(0);
})().catch((e) => { console.error('PROBE FAILED', e); server.close(); process.exit(1); });
