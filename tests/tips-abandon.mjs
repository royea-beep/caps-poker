/**
 * DISMISS-THE-TIPS §1b — the abandonment hypothesis.
 *
 * §1a proved every explanation stays dismissed once you FINISH a hand: tutorial survives a
 * reload and a new session, tips stop after hand 1, in both engines, both languages, 320 and 393.
 * So "sometimes it's really annoying" is not a persistence failure on the happy path.
 *
 * What is left is the gate itself. The tips are gated on `caps_games_played === 0`, and that
 * counter has exactly one writer: app/game.tsx's reveal-done handler. It counts HANDS FINISHED.
 * The tips are asking a different question — "have you been shown this before?" A player who
 * starts a hand and leaves has been shown them, and the counter has not moved.
 *
 * This drives that: open a hand, see the tips, LEAVE without finishing, open another hand.
 *
 *   node tests/tips-abandon.mjs
 */
import { chromium } from 'playwright';
import fs from 'fs';
import http from 'http';
import path from 'path';

const DIR = path.resolve(process.env.PROBE_DIR || 'web-tips-dist');
const PORT = Number(process.env.PROBE_PORT || 8292);
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
    el.dispatchEvent(new (t.startsWith('pointer') ? PointerEvent : MouseEvent)(t, o)); };`;
const TIPS = `(() => { const t = document.body.innerText || '';
  return { tipAny: /These are your cards|Tap a card then a slot|Nice! 3 more cards|Hand strength shown here|The game picks your best hand|All set! Tap READY/.test(t),
           boardHint: /Tap a card from your hand, then tap a board/.test(t),
           counter: (()=>{try{return localStorage.getItem('caps_games_played');}catch(e){return 'ERR';}})() }; })()`;

(async () => {
  await new Promise((r) => server.listen(PORT, r));
  const exe = process.env.CAPS_CHROMIUM || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
  const browser = await chromium.launch({ executablePath: exe });
  const ctx = await browser.newContext({ viewport: { width: 393, height: 780 } });
  await ctx.addInitScript(FIRE);
  const page = await ctx.newPage();
  const rows = [];

  // Fresh device: get past the tutorial the way a player does, so only the GAME tips are in play.
  await page.goto(`${SITE}/`, { waitUntil: 'load', timeout: 120000 });
  await page.waitForTimeout(9000);
  await page.evaluate(`(()=>{const els=[...document.querySelectorAll('[role="button"],button,[tabindex],div')];
    const b=els.find(x=>/skip the tutorial/i.test(x.getAttribute('aria-label')||''));
    if(b&&window.__f)window.__f(b);})()`);
  await page.waitForTimeout(2500);

  // Four hands in a row, EVERY ONE ABANDONED — opened, tips seen, then walk away home.
  for (let i = 1; i <= 4; i++) {
    await page.goto(`${SITE}/game?fresh=1&practice=1`, { waitUntil: 'load', timeout: 120000 });
    await page.waitForTimeout(8000);
    const seen = await page.evaluate(TIPS);
    rows.push({ hand: i, ...seen });
    if (i === 1) await page.screenshot({ path: path.join(OUT, 'abandon-hand-1.png') });
    if (i === 4) await page.screenshot({ path: path.join(OUT, 'abandon-hand-4.png') });
    // Leave without finishing — exactly what a developer poking at the app does all day.
    await page.goto(`${SITE}/`, { waitUntil: 'load', timeout: 120000 });
    await page.waitForTimeout(3500);
  }

  // The board hint reads "Tap a card from your hand, then tap a board to place it". It retires
  // when the player DOES that — so hands 1-4, which never placed a card, correctly still show it.
  // Hand 5 places cards and walks away; hand 6 checks the hint is gone for good.
  await page.goto(`${SITE}/game?fresh=1&practice=1`, { waitUntil: 'load', timeout: 120000 });
  await page.waitForTimeout(8000);
  await page.evaluate(`(()=>{const els=[...document.querySelectorAll('[role="button"],button,[tabindex]')];
    const b=els.find(x=>/auto-place|מילוי|מלא הכל/i.test(x.getAttribute('aria-label')||x.textContent||''));
    if(b&&window.__f)window.__f(b);})()`);
  await page.waitForTimeout(2500);
  await page.goto(`${SITE}/`, { waitUntil: 'load', timeout: 120000 });
  await page.waitForTimeout(3000);
  await page.goto(`${SITE}/game?fresh=1&practice=1`, { waitUntil: 'load', timeout: 120000 });
  await page.waitForTimeout(8000);
  const afterPlacing = await page.evaluate(TIPS);
  await page.screenshot({ path: path.join(OUT, 'abandon-after-placing.png') });

  console.log('\n=========== §1b · FOUR HANDS, EVERY ONE ABANDONED ===========');
  console.log('  (the tutorial was dismissed once, before hand 1)\n');
  for (const r of rows) {
    console.log(`  hand ${r.hand}: tips=${String(r.tipAny).padEnd(5)} boardHint=${String(r.boardHint).padEnd(5)} caps_games_played=${r.counter}`);
  }
  const everyHandShowsTips = rows.every((r) => r.tipAny);
  console.log(`\n  tips shown on EVERY abandoned hand: ${everyHandShowsTips}`);
  console.log(`  counter after 4 opened hands       : ${rows[rows.length-1].counter}`);
  console.log(`\n  hand 6, after ONE hand where cards were placed and abandoned:`);
  console.log(`    tips=${afterPlacing.tipAny}  boardHint=${afterPlacing.boardHint}  counter=${afterPlacing.counter}`);
  console.log(`    -> board hint retires on the action it teaches: ${afterPlacing.boardHint === false}`);
  rows.push({ hand: 6, note: 'after placing cards then abandoning', ...afterPlacing });
  fs.writeFileSync(path.join(OUT, 'tips-abandon.json'), JSON.stringify(rows, null, 2));
  await ctx.close(); await browser.close(); server.close(); process.exit(0);
})().catch((e) => { console.error('PROBE FAILED', e); server.close(); process.exit(1); });
