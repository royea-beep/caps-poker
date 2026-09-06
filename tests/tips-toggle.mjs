/**
 * SHOW-TIPS-TOGGLE §3 — drive the switch, do not read the code.
 *
 * EVERY control here is matched by its ACCESSIBILITY LABEL, never by visible text. That is the
 * trap that cost a false finding last sprint: the probe matched the exact string "SKIP", the
 * button renders "Skip ✕", the click never landed, and the report said the tutorial came back
 * after every reload when in truth it had never been dismissed. A failed click looks exactly like
 * a failed feature.
 *
 *   npx expo export -p web --output-dir web-tips-dist --clear
 *   node tests/tips-toggle.mjs
 */
import { chromium, webkit } from 'playwright';
import fs from 'fs';
import http from 'http';
import path from 'path';

const DIR = path.resolve(process.env.PROBE_DIR || 'web-tips-dist');
const PORT = Number(process.env.PROBE_PORT || 8293);
const OUT = path.resolve('docs/dismiss-tips');
fs.mkdirSync(OUT, { recursive: true });
const MIME = { '.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json',
  '.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml','.ttf':'font/ttf',
  '.woff':'font/woff','.woff2':'font/woff2','.ico':'image/x-icon','.mp3':'audio/mpeg','.wav':'audio/wav' };
const toModule = (h) => h.replace(/<script src="(\/_expo\/static\/js\/web\/[^"]+)" defer><\/script>/,
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
    el.dispatchEvent(new (t.startsWith('pointer') ? PointerEvent : MouseEvent)(t, o)); };
window.__byLabel = (re) => [...document.querySelectorAll('[aria-label]')]
    .find(x => re.test(x.getAttribute('aria-label') || ''));`;

/** Every explanation, read from the rendered page. */
const SURFACES = `(() => { const t = document.body.innerText || '';
  const has = (s) => t.includes(s);
  return {
    tutorial: !!window.__byLabel(/getting started tutorial|מדריך פתיחה/i),
    tips: has('These are your cards') || has('Tap a card then a slot') || has('Nice! 3 more cards')
       || has('Hand strength shown here') || has('The game picks your best hand') || has('All set! Tap READY')
       || has('אלה הקלפים שלך') || has('לחץ קלף ואז מקום ריק') || has('יופי! עוד 3 קלפים')
       || has('עוצמת היד מוצגת') || has('המשחק בוחר את היד') || has('הכל מוכן'),
    boardHint: has('Tap a card from your hand, then tap a board') || has('הקש על קלף מהיד'),
  }; })()`;
const STORE = `(() => { try { return {
  showTips: localStorage.getItem('caps_show_tips'),
  dismissed: localStorage.getItem('caps_tips_dismissed'),
  tutorialSeen: localStorage.getItem('has_seen_interactive_tutorial'),
}; } catch (e) { return { error: String(e) }; } })()`;

/** Flip the switch in Settings, BY LABEL, and confirm the control reports its new state. */
async function setSwitch(page, wantOn) {
  await page.goto(`${SITE}/settings`, { waitUntil: 'load', timeout: 120000 });
  await page.waitForTimeout(6000);
  const before = await page.evaluate(`(()=>{const el=window.__byLabel(/^(Show tips|הצגת טיפים)$/i);
    return el ? el.getAttribute('aria-checked') : 'NOT-FOUND';})()`);
  if (before === 'NOT-FOUND') return { found: false, before, after: null };
  if (String(before === 'true') !== String(wantOn)) {
    await page.evaluate(`(()=>{const el=window.__byLabel(/^(Show tips|הצגת טיפים)$/i); if(el)window.__f(el);})()`);
    await page.waitForTimeout(1800);
  }
  const after = await page.evaluate(`(()=>{const el=window.__byLabel(/^(Show tips|הצגת טיפים)$/i);
    return el ? el.getAttribute('aria-checked') : 'NOT-FOUND';})()`);
  return { found: true, before, after };
}

async function openHand(page) {
  await page.goto(`${SITE}/game?fresh=1&practice=1`, { waitUntil: 'load', timeout: 120000 });
  await page.waitForTimeout(8000);
  return page.evaluate(SURFACES);
}

(async () => {
  await new Promise((r) => server.listen(PORT, r));
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
        try { browser = await eng.launcher.launch(eng.exe ? { executablePath: eng.exe } : {}); }
        catch (e) { facts[tag] = { launchError: String(e.message).slice(0, 80) }; continue; }
        const ctx = await browser.newContext({ viewport: { width, height: 780 } });
        await ctx.addInitScript(FIRE);
        await ctx.addInitScript(`try{localStorage.setItem('caps_language','${lang}');}catch(e){}`);
        const page = await ctx.newPage();
        const F = {};

        // 1 — NEW DEVICE, SWITCH ON (never touched): tutorial + tips
        await page.goto(`${SITE}/`, { waitUntil: 'load', timeout: 120000 });
        await page.waitForTimeout(9000);
        F.newDeviceHome = await page.evaluate(SURFACES);
        F.newDeviceStore = await page.evaluate(STORE);
        // dismiss the overlay BY LABEL so the game screen is reachable
        await page.evaluate(`(()=>{const el=window.__byLabel(/skip the tutorial|דלג על המדריך/i); if(el)window.__f(el);})()`);
        await page.waitForTimeout(2500);
        F.newDeviceGame = await openHand(page);

        // 2 — SWITCH OFF: nothing appears anywhere
        F.flipOff = await setSwitch(page, false);
        F.offGame = await openHand(page);
        await page.goto(`${SITE}/`, { waitUntil: 'load', timeout: 120000 });
        await page.waitForTimeout(8000);
        F.offHome = await page.evaluate(SURFACES);
        F.offStore = await page.evaluate(STORE);
        if (tag === 'chromium-en-393') await page.screenshot({ path: path.join(OUT, 'toggle-off-home.png') });

        // 3 — SWITCH BACK ON: they come back, even though everything was already seen
        F.flipOn = await setSwitch(page, true);
        await page.goto(`${SITE}/`, { waitUntil: 'load', timeout: 120000 });
        await page.waitForTimeout(9000);
        F.onAgainHome = await page.evaluate(SURFACES);
        if (tag === 'chromium-en-393') await page.screenshot({ path: path.join(OUT, 'toggle-on-again-home.png') });
        await page.evaluate(`(()=>{const el=window.__byLabel(/skip the tutorial|דלג על המדריך/i); if(el)window.__f(el);})()`);
        await page.waitForTimeout(2500);
        F.onAgainGame = await openHand(page);

        // 4 — OFF AGAIN, then RELOAD + NEW SESSION: the choice sticks
        await setSwitch(page, false);
        await page.goto(`${SITE}/`, { waitUntil: 'load', timeout: 120000 });
        await page.waitForTimeout(8000);
        F.afterReloadHome = await page.evaluate(SURFACES);
        const state = await ctx.storageState();
        const ctx2 = await browser.newContext({ viewport: { width, height: 780 }, storageState: state });
        await ctx2.addInitScript(FIRE);
        const page2 = await ctx2.newPage();
        await page2.goto(`${SITE}/`, { waitUntil: 'load', timeout: 120000 });
        await page2.waitForTimeout(8000);
        F.newSessionHome = await page2.evaluate(SURFACES);
        F.newSessionGame = await openHand(page2);
        F.newSessionStore = await page2.evaluate(STORE);
        await ctx2.close();

        facts[tag] = F;
        await ctx.close(); await browser.close();
      }
    }
  }

  fs.writeFileSync(path.join(OUT, 'tips-toggle.json'), JSON.stringify(facts, null, 2));
  console.log('\n=============== SHOW-TIPS-TOGGLE · DRIVEN ===============');
  for (const [tag, F] of Object.entries(facts)) {
    if (F.launchError) { console.log(`\n--- ${tag}: launch failed — ${F.launchError}`); continue; }
    console.log(`\n--- ${tag}`);
    console.log(`  1 new device, ON   : tutorial=${F.newDeviceHome.tutorial}  tips=${F.newDeviceGame.tips} hint=${F.newDeviceGame.boardHint}   <- all true`);
    console.log(`      store          : ${JSON.stringify(F.newDeviceStore)}   <- caps_show_tips null = ON by default`);
    console.log(`  2 switch OFF       : found=${F.flipOff.found} ${F.flipOff.before}->${F.flipOff.after}`);
    console.log(`      game           : tips=${F.offGame.tips} hint=${F.offGame.boardHint}   <- both false`);
    console.log(`      home           : tutorial=${F.offHome.tutorial}   <- false`);
    console.log(`  3 switch back ON   : ${F.flipOn.before}->${F.flipOn.after}`);
    console.log(`      home           : tutorial=${F.onAgainHome.tutorial}   <- true again`);
    console.log(`      game           : tips=${F.onAgainGame.tips} hint=${F.onAgainGame.boardHint}   <- true again`);
    console.log(`  4 off, reload      : tutorial=${F.afterReloadHome.tutorial}   <- false`);
    console.log(`    new session      : tutorial=${F.newSessionHome.tutorial} tips=${F.newSessionGame.tips} hint=${F.newSessionGame.boardHint}   <- all false`);
    console.log(`      store          : ${JSON.stringify(F.newSessionStore)}`);
  }
  server.close(); process.exit(0);
})().catch((e) => { console.error('PROBE FAILED', e); server.close(); process.exit(1); });
