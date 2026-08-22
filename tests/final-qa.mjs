/**
 * FINAL-QA — one continuous run of the whole product, all angles at once.
 *
 * Everything has been enumerated once before, screen by screen, in separate sprints. What had never
 * been done is a SINGLE CONTINUOUS RUN with every check applied together, which is the only way to
 * catch a fix that breaks something two screens away.
 *
 * Per invocation (ENGINE × VIEWPORT × PLAYERS) it walks:
 *   first session -> tutorial -> practice hand (all phases) -> results
 *   -> all five tabs -> every side-menu destination -> shop -> chip-store -> lobby
 * and applies, at every stop:
 *   A11Y     exposed controls vs focusable-but-unexposed
 *   LAYOUT   horizontal overflow, elements past the viewport, clipped text
 *   COPY     scanned against a list of known-stale promises
 *   CONSOLE  console.error AND pageerror, collected continuously
 *
 * ANCHORING: everything keys off declared roles and accessible names. Never shape, never position,
 * never "things that look like a button" — five of the last seven filed defects in this project
 * were the measurement, and every one of them came from guessing at a subset.
 *
 *   ENGINE=webkit VIEWPORT=393 PLAYERS=3 node tests/final-qa.mjs
 */
import { webkit, chromium } from 'playwright';
import { installFire, readyIsArmed, where } from './harness/play.mjs';

const SITE = process.env.CAPS_URL || 'https://caps.ftable.co.il';
const ENGINE = process.env.ENGINE || 'webkit';
const VW = Number(process.env.VIEWPORT || 393);
const PLAYERS = process.env.PLAYERS || '3';
const engine = ENGINE === 'chromium' ? chromium : webkit;
const TAG = `${ENGINE}/${VW}/${PLAYERS}p`;

/** Copy that would be a lie if it appeared. Each entry cost a sprint to find. */
const STALE_COPY = [
  'players bought today',      // fabricated social proof — removed in FINAL-QA
  'VIP Monthly',               // subscription removed; it paid nothing
  'chips/day unlocked',        // the promise nothing delivered
  '1,000 chips/day',           // hardcoded figure that drifted from config
  'Coming Soon',               // superseded by honest per-reason copy
  'Not enough chips to continue', // only legitimate on /gameover
];

const findings = [];
const add = (where_, kind, detail) => findings.push({ where: where_, kind, detail });

const PROBE = () => {
  const vis = (e) => { const r = e.getBoundingClientRect(); return r.width > 2 && r.height > 2; };
  const name = (e) => (e.getAttribute('aria-label') || e.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 44);
  const exposed = [...document.querySelectorAll('button,[role="button"],[role="tab"],[role="switch"],[role="link"],a[href]')]
    .filter(vis).map(name);
  const bare = [...document.querySelectorAll('[tabindex="0"]')].filter(vis)
    .filter((e) => !e.getAttribute('role') && e.tagName !== 'BUTTON' && e.tagName !== 'A').map(name);

  // LAYOUT — clip-aware. Plain containers included, not just controls.
  const vwNow = window.innerWidth;
  const past = [];
  const clipped = [];
  for (const e of document.querySelectorAll('div,span,p,button,[role="button"],h1,h2,h3')) {
    const r = e.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) continue;
    if (r.right > vwNow + 1 || r.left < -1) {
      const cs = getComputedStyle(e);
      // An overlay deliberately positioned off-screen is not a defect; classify, do not suppress.
      const deliberate = cs.position === 'fixed' || cs.position === 'absolute';
      past.push({ n: name(e).slice(0, 30), right: Math.round(r.right), deliberate });
    }
    if (e.children.length === 0 && e.scrollWidth > e.clientWidth + 1 && e.clientWidth > 0) {
      clipped.push({ n: name(e).slice(0, 30), sw: e.scrollWidth, cw: e.clientWidth });
    }
  }
  const body = document.body.innerText;
  return {
    path: location.pathname,
    lineCount: body.split('\n').map((s) => s.trim()).filter(Boolean).length,
    head: body.split('\n').map((s) => s.trim()).filter(Boolean).slice(0, 4),
    exposedN: exposed.length, exposed,
    bareN: bare.length, bare: bare.slice(0, 6),
    overflowX: document.documentElement.scrollWidth > vwNow + 1,
    scrollW: document.documentElement.scrollWidth,
    past: past.filter((x) => !x.deliberate).slice(0, 5),
    pastDeliberate: past.filter((x) => x.deliberate).length,
    clipped: clipped.slice(0, 5),
    text: body,
  };
};

const browser = await engine.launch({ headless: false });
const ctx = await browser.newContext({ viewport: { width: VW, height: VW >= 1000 ? 800 : 900 } });
const page = await ctx.newPage();
const consoleErrs = [];
const pageErrs = [];
page.on('console', (m) => { if (m.type() === 'error') consoleErrs.push(m.text().slice(0, 130)); });
page.on('pageerror', (e) => pageErrs.push(String(e).slice(0, 130)));
page.on('dialog', async (d) => { await d.dismiss(); });

const stop = async (label, { quiet = false } = {}) => {
  const s = await page.evaluate(PROBE);
  if (s.overflowX) add(label, 'LAYOUT', `horizontal overflow: scrollWidth ${s.scrollW} > ${VW}`);
  if (s.past.length) add(label, 'LAYOUT', `in-flow elements past the viewport: ${JSON.stringify(s.past)}`);
  if (s.clipped.length) add(label, 'LAYOUT', `clipped text: ${JSON.stringify(s.clipped)}`);
  for (const phrase of STALE_COPY) {
    if (s.text.includes(phrase)) {
      if (phrase === 'Not enough chips to continue' && s.path === '/gameover') continue;
      add(label, 'COPY', `stale//undelivered phrase present: "${phrase}"`);
    }
  }
  if (!quiet) {
    console.log(`  ${label.padEnd(30)} ${String(s.path).padEnd(20)} exp=${String(s.exposedN).padStart(3)} unexp=${String(s.bareN).padStart(3)} lines=${String(s.lineCount).padStart(3)}${s.overflowX ? '  ⚠OVERFLOW' : ''}`);
  }
  return s;
};

console.log(`\n══════════ ${TAG} ══════════`);

// ── FIRST SESSION ────────────────────────────────────────────────────────────
await page.goto(SITE + '/', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(11000);
await stop('first-run overlay');

await installFire(page);
for (const label of ['Continue', 'SKIP', 'PLAY']) {
  const hit = await page.evaluate(`(()=>{const b=[...document.querySelectorAll('button,[role="button"],[tabindex="0"]')]
    .find(x=>new RegExp(${JSON.stringify(label)},'i').test((x.getAttribute('aria-label')||'')+' '+(x.textContent||'')));
    if(!b) return false; window.__f(b); return true;})()`);
  if (hit) { await page.waitForTimeout(3200); await installFire(page); }
}

// ── THE GAME, PHASE BY PHASE ─────────────────────────────────────────────────
if (!/game/.test((await where(page)).path)) {
  await page.goto(`${SITE}/game?practice=true&players=${PLAYERS}&fresh=1`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(10000);
}
const p1 = await stop(`game P1 dealt (boards=${PLAYERS === '2' ? 4 : PLAYERS === '3' ? 3 : 2})`);
if (!p1.exposed.some((x) => /auto-place all/i.test(x))) add('game P1', 'A11Y', 'no exposed "Auto-place all boards"');

await installFire(page);
await page.evaluate(`(()=>{const b=[...document.querySelectorAll('button,[role="button"]')]
  .find(x=>{const t=(x.getAttribute('aria-label')||'')+' '+(x.textContent||'');
            return /auto.?place/i.test(t) && !/all/i.test(t);}); if(b) window.__f(b);})()`);
await page.waitForTimeout(2200);
await stop('game P2 partly placed');

await installFire(page);
await page.evaluate(`(()=>{const b=[...document.querySelectorAll('button,[role="button"]')]
  .find(x=>/auto-place all/i.test((x.getAttribute('aria-label')||'')+' '+(x.textContent||''))); if(b) window.__f(b);})()`);
await page.waitForTimeout(2600);
let armed = false;
for (let i = 0; i < 20 && !armed; i++) { armed = await readyIsArmed(page); if (!armed) await page.waitForTimeout(500); }
const p4 = await stop(`game P4 ready armed=${armed}`);
if (!p4.exposed.some((x) => /READY|Confirm/i.test(x))) add('game P4', 'A11Y', 'READY not exposed when armed');

await installFire(page);
await page.evaluate(`(()=>{const r=document.querySelector('[data-testid="ready-button"]'); if(r) window.__f(r);})()`);
let sawReveal = false;
for (let i = 0; i < 45; i++) {
  await page.waitForTimeout(1100);
  const w = await where(page);
  if (w.inReveal && !sawReveal) { sawReveal = true; await stop('game P5 reveal'); }
  if (w.path === '/results') break;
}
if (!sawReveal) add('game', 'PHASE', 'reveal phase never observed');
await page.waitForTimeout(6000);
await stop('results');

// ── EVERY TAB, EVERY MENU DESTINATION, EVERY STORE ───────────────────────────
const ROUTES = [
  '/', '/play', '/friends', '/cups', '/profile',
  '/lobby', '/battle-pass', '/stats', '/hand-history', '/coaching', '/settings',
  '/achievements', '/leaderboard', '/missions', '/referral', '/shop', '/chip-store',
  '/rank', '/replay', '/heatmap', '/theme-pick', '/gameover',
];
for (const r of ROUTES) {
  await page.goto(SITE + r, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(6500);
  const s = await stop(`route ${r}`);
  if (s.exposedN === 0) add(`route ${r}`, 'A11Y', 'zero exposed controls — no way forward or back');
}

// ── STATE: zero chips, cold deep-link, returning ─────────────────────────────
await page.evaluate(() => { try { localStorage.setItem('caps-poker-storage', JSON.stringify({ state: { chips: 0 }, version: 2 })); } catch {} });
await page.goto(SITE + '/', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(8000);
await stop('state: after zero-chip write');

console.log(`\n── ${TAG} CONSOLE`);
console.log(`   console.error: ${consoleErrs.length}`);
for (const e of [...new Set(consoleErrs)].slice(0, 6)) console.log(`     · ${e}`);
console.log(`   pageerror    : ${pageErrs.length}`);
for (const e of [...new Set(pageErrs)].slice(0, 6)) console.log(`     · ${e}`);

console.log(`\n── ${TAG} FINDINGS: ${findings.length}`);
for (const f of findings) console.log(`   [${f.kind}] ${f.where} — ${f.detail}`);
console.log(`   DEVICE: ${await page.evaluate(`localStorage.getItem('caps-device-id')`)}`);
await browser.close();
