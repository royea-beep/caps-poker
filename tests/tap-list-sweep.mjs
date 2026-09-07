/**
 * LANDING-AND-AUTOSWEEP §2 — clear Roye's tap list of everything a BROWSER can prove.
 *
 * One rig, one export, every item reported PASS / FAIL / DEVICE-ONLY. Nothing here is asserted
 * from source: each line is read out of the painted DOM of a real export.
 *
 *   DIST=web-las-dist2 node tests/tap-list-sweep.mjs
 */
import { serve } from '../tools/content-lib.mjs';
import { chromium, webkit } from 'playwright';
import fs from 'node:fs';

const DIST = process.env.DIST || 'web-las-dist2';
const PORT = Number(process.env.PORT || 9100);
const OUT = process.env.OUT || 'docs/tap-sweep-2026-09-05';
const WIDTHS = [320, 375, 393, 430];
const EXE = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
fs.mkdirSync(OUT, { recursive: true });

const server = await serve(DIST, PORT);
const R = {};
const fire = `(el)=>{const r=el.getBoundingClientRect();const x=r.left+r.width/2,y=r.top+r.height/2;
const mk=(t,C)=>new C(t,{bubbles:true,cancelable:true,composed:true,clientX:x,clientY:y,pointerId:1,pointerType:'mouse',button:0,buttons:t.includes('up')?0:1,isPrimary:true});
['pointerdown','mousedown','pointerup','mouseup','click'].forEach(t=>el.dispatchEvent(mk(t,t.startsWith('pointer')?PointerEvent:MouseEvent)));}`;

async function ctxFor(browser, width, lang = 'en') {
  const ctx = await browser.newContext({ viewport: { width, height: 860 }, deviceScaleFactor: 1 });
  await ctx.route('**/*', (r) => (/supabase\.co|ftable\.co\.il/i.test(r.request().url()) ? r.abort() : r.continue()));
  await ctx.addInitScript((l) => {
    try {
      localStorage.setItem('caps_language', l);
      localStorage.setItem('has_seen_interactive_tutorial', 'true');
      localStorage.setItem('caps_games_played', '25');
    } catch (_) {}
  }, lang);
  return ctx;
}
async function open(ctx, path, settle = 7000) {
  const page = await ctx.newPage();
  await page.goto(`http://localhost:${PORT}${path}`, { waitUntil: 'load', timeout: 120000 });
  await page.waitForTimeout(settle);
  await page.evaluate(`window.__f=${fire}`);
  return page;
}

const chrome = await chromium.launch({ executablePath: EXE });

// ─────────────────────────────────────────────────────────────────────────────────────────────
// 1 · NAVIGATION — three tabs, Cups inside Profile, Friends in the menu, no duplicate
//     destinations, every destination reachable, no dead route a typed URL can hit.
// ─────────────────────────────────────────────────────────────────────────────────────────────
{
  const ctx = await ctxFor(chrome, 393);
  const home = await open(ctx, '/');
  // The tab bar is the only element carrying tablist semantics in RN-Web.
  R.tabs = await home.evaluate(() => {
    const bar = document.querySelector('[role="tablist"]');
    if (!bar) return { found: false };
    const tabs = [...bar.querySelectorAll('[role="tab"]')].map((t) => (t.innerText || '').trim().split('\n').pop());
    return { found: true, count: tabs.length, labels: tabs };
  });

  // Every destination the HOME screen offers, by its accessible name + where it goes.
  R.homeDestinations = await home.evaluate(() => {
    const seen = [];
    document.querySelectorAll('[role="button"],a').forEach((e) => {
      const label = (e.getAttribute('aria-label') || e.innerText || '').trim().replace(/\s+/g, ' ').slice(0, 40);
      if (label) seen.push(label);
    });
    return seen;
  });
  await ctx.close();
}

// Reachability + dead-route check: type each route as a URL and see whether the app paints
// something other than a blank shell.
{
  const ROUTES = ['/', '/play', '/profile', '/friends', '/cups', '/settings', '/leaderboard', '/shop',
    '/chip-store', '/achievements', '/missions', '/referral', '/stats', '/rank', '/hand-history',
    '/theme-pick', '/lobby', '/lobby/private', '/coaching', '/heatmap', '/replay', '/spectate',
    '/battle-pass', '/gameover', '/orientation-pick', '/simulate', '/debug', '/club'];
  const ctx = await ctxFor(chrome, 393);
  R.routes = {};
  for (const path of ROUTES) {
    const page = await ctx.newPage();
    const errs = [];
    page.on('pageerror', (e) => errs.push(String(e).slice(0, 90)));
    try {
      await page.goto(`http://localhost:${PORT}${path}`, { waitUntil: 'load', timeout: 90000 });
      await page.waitForTimeout(4500);
      const m = await page.evaluate(() => {
        const t = (document.body.innerText || '').replace(/\s+/g, ' ').trim();
        return { chars: t.length, head: t.slice(0, 46), nodes: document.querySelectorAll('*').length };
      });
      R.routes[path] = { ...m, pageErrors: errs.length, sample: errs[0] ?? null };
    } catch (e) { R.routes[path] = { error: String(e).slice(0, 80) }; }
    await page.close();
  }
  await ctx.close();
}

// ─────────────────────────────────────────────────────────────────────────────────────────────
// 2 · RESULTS HIERARCHY — hero outcome, details COLLAPSED, one mint CTA, no shop prompt,
//     and the tie tally summing to the board count. Practice route only.
// ─────────────────────────────────────────────────────────────────────────────────────────────
{
  const ctx = await ctxFor(chrome, 393);
  const page = await open(ctx, '/game?practice=true&players=3&fresh=1', 9000);
  const auto = page.locator('text=/Auto-Place ALL|מלא הכל/').first();
  if (await auto.count()) { await auto.click({ force: true }); await page.waitForTimeout(2500); }
  const ready = page.locator('[data-testid="ready-button"]').first();
  if (await ready.count()) { await ready.click({ force: true }); await page.waitForTimeout(4500); }
  for (let i = 0; i < 14; i++) {
    if (/results/.test(page.url())) break;
    const tap = page.locator('text=/Tap to reveal|הקש/').first();
    if (await tap.count()) { await tap.click({ force: true }); }
    await page.waitForTimeout(1500);
  }
  await page.waitForTimeout(3000);
  R.results = await page.evaluate(() => {
    const txt = (document.body.innerText || '');
    const q = (id) => document.querySelector(`[data-testid="${id}"]`);
    const headline = q('result-headline');
    const tally = q('board-tally');
    const numerals = q('score-numerals');
    const cta = q('results-play-again');
    const rect = (e) => (e ? (() => { const r = e.getBoundingClientRect(); return { y: Math.round(r.top), h: Math.round(r.height) }; })() : null);
    const css = (e, p) => (e ? getComputedStyle(e)[p] : null);
    return {
      url: location.pathname,
      headline: headline ? headline.innerText.trim() : null,
      headlineBox: rect(headline),
      numerals: numerals ? numerals.innerText.trim() : null,
      tallyText: tally ? tally.innerText.trim() : null,
      ctaText: cta ? cta.innerText.trim().replace(/\s+/g, ' ') : null,
      ctaBox: rect(cta),
      // "Hand details" must be present AND collapsed: the toggle shows, the breakdown does not.
      detailsToggle: /Hand details|פרטי היד/.test(txt),
      breakdownVisible: !!q('breakdown-hand'),
      // no shop prompt anywhere in the post-hand flow
      shopWords: (txt.match(/Buy|Get chips|Store|Shop|חנות|קנה/g) || []),
      bodyLen: txt.length,
    };
  });
  await page.screenshot({ path: `${OUT}/results-393-en.png`, fullPage: true });
  await ctx.close();
}

// ─────────────────────────────────────────────────────────────────────────────────────────────
// 5 · GILDED SHOP / LOBBY / PROFILE at every width, both engines — plus
// 6 · zero gold on any CTA, and no new overlap between painted chrome boxes.
//     GOLD = #FFD700, the WINNER CUE from Card.tsx. Any control wearing it is the finding.
// ─────────────────────────────────────────────────────────────────────────────────────────────
const GOLD_PROBE = () => {
  const cue = ['rgb(255, 215, 0)', '#FFD700'];
  const hits = [];
  document.querySelectorAll('[role="button"],a,button').forEach((e) => {
    const cs = getComputedStyle(e);
    const r = e.getBoundingClientRect();
    if (r.width < 8 || r.height < 8) return;
    const wears = cue.some((c) => cs.backgroundColor === c || cs.color === c || cs.borderColor === c);
    if (wears) hits.push({ label: (e.getAttribute('aria-label') || e.innerText || '').trim().slice(0, 34),
      bg: cs.backgroundColor, fg: cs.color, bc: cs.borderColor });
  });
  return hits;
};
const OVERLAP_PROBE = () => {
  // Painted boxes of INTERACTIVE chrome only. Two controls a finger must hit separately are not
  // allowed to intersect; a decorative absolute layer over content is not what this is about.
  const els = [...document.querySelectorAll('[role="button"],button,a')]
    .map((e) => ({ e, r: e.getBoundingClientRect() }))
    .filter(({ r }) => r.width > 12 && r.height > 12 && r.top >= 0 && r.bottom <= window.innerHeight * 3);
  const bad = [];
  for (let i = 0; i < els.length; i++) for (let j = i + 1; j < els.length; j++) {
    const a = els[i], b = els[j];
    if (a.e.contains(b.e) || b.e.contains(a.e)) continue;
    const ox = Math.min(a.r.right, b.r.right) - Math.max(a.r.left, b.r.left);
    const oy = Math.min(a.r.bottom, b.r.bottom) - Math.max(a.r.top, b.r.top);
    if (ox > 2 && oy > 2) bad.push({
      a: (a.e.getAttribute('aria-label') || a.e.innerText || '').trim().slice(0, 26),
      b: (b.e.getAttribute('aria-label') || b.e.innerText || '').trim().slice(0, 26),
      ox: Math.round(ox), oy: Math.round(oy) });
  }
  return bad;
};

R.screens = {};
for (const [engine, launcher] of [['chromium', chromium], ['webkit', webkit]]) {
  const b = await launcher.launch(engine === 'chromium' ? { executablePath: EXE } : {});
  for (const path of ['/shop', '/lobby', '/profile', '/play', '/']) {
    for (const w of WIDTHS) {
      const ctx = await ctxFor(b, w);
      const page = await open(ctx, path, 6500);
      const key = `${path}|${w}|${engine}`;
      R.screens[key] = {
        overflowX: await page.evaluate(() => document.scrollingElement.scrollWidth - document.scrollingElement.clientWidth),
        goldCtas: await page.evaluate(GOLD_PROBE),
        overlaps: await page.evaluate(OVERLAP_PROBE),
        painted: await page.evaluate(() => (document.body.innerText || '').trim().length),
      };
      if (engine === 'chromium' && (w === 393 || w === 320)) {
        await page.screenshot({ path: `${OUT}/${path.replace(/\W+/g, '') || 'home'}-${w}-${engine}.png`, fullPage: true });
      }
      await ctx.close();
    }
  }
  await b.close();
}

// ─────────────────────────────────────────────────────────────────────────────────────────────
// 4 · LOBBY practice row + REMATCH — what a browser can actually see.
// ─────────────────────────────────────────────────────────────────────────────────────────────
{
  const ctx = await ctxFor(chrome, 393);
  const page = await open(ctx, '/lobby', 7000);
  R.lobby = await page.evaluate(() => {
    const txt = (document.body.innerText || '').replace(/\s+/g, ' ');
    return {
      practiceRow: /Practice|תרגול/.test(txt),
      rematch: /REMATCH|רימאץ|ריאמץ/i.test(txt),
      body: txt.slice(0, 220),
    };
  });
  await ctx.close();
}

await chrome.close();
await new Promise((r) => server.close(r));
fs.writeFileSync(`${OUT}/sweep.json`, JSON.stringify(R, null, 1));
console.log(JSON.stringify({ tabs: R.tabs, results: R.results, lobby: R.lobby }, null, 1));
