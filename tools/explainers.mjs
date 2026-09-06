/**
 * PER-SCREEN EXPLAINERS — short clips that show a person what each screen does.
 *
 * AUDIT-REST-AND-EXPLAINERS 2026-09-05. Capture-and-caption, not invention: the deterministic
 * practice rig already exists (tools/content-lib.mjs) and every caption below is checked against
 * the running build before it is burned in.
 *
 * ── WHAT THIS DELIBERATELY DOES NOT DO ──────────────────────────────────────────────────────
 * It does not film multiplayer. No room has ever finished a hand through the lobby, so there is
 * nothing to capture and staging one would be a claim the product cannot back. The lobby clip
 * shows the lobby AS IT IS — a list of open tables with nobody in them.
 *
 * ── THE LANGUAGE GUARD, RUN BEFORE ANY RECORDING ────────────────────────────────────────────
 * The landing bug was a capture tool that ignored the language parameter and wrote one image
 * under two names — a correct name over wrong content. Two checks run first, and a failure
 * ABORTS before a single frame is recorded:
 *   1. BYTES  — the EN and HE still of the same screen must differ in size. Cheap, and it catches
 *               exactly "the language parameter was ignored, one image written twice".
 *   2. SCRIPT — the EN still's DOM must contain ZERO Hebrew characters. That is the zero-tolerance
 *               direction and the only one that aborts.
 *
 * ⚠️ THE BYTE CHECK ALONE IS NOT ENOUGH, and this run proved it. The lobby's EN and HE stills
 * differ (281,185 vs 280,973 bytes) while BOTH contain zero Hebrew — the difference is an animated
 * spinner, not a language. A byte guard passes that; the DOM check is what actually knows.
 *
 * ⚠️ AND "HE MUST CONTAIN HEBREW" IS NOT A FAILURE. The first version of this guard aborted the
 * whole run because the Chip Shop and the Lobby render no Hebrew at all. Under the language rule
 * that is ACCEPTABLE — English must never show Hebrew, the other way round is fine — so an
 * untranslated screen is REPORTED as a gap and does not stop the capture. The guard encoding an
 * expectation the product does not owe is the guard being wrong, not the product.
 *
 * ── TWO SESSIONS, REAL STATE ────────────────────────────────────────────────────────────────
 * Session A plays one practice hand end to end in a single recording, so hand history and profile
 * show a hand this run actually played rather than a seeded fixture. Session B covers the screens
 * that need no history. Clips are cut from measured elapsed time, not guessed offsets.
 *
 *   DIST=web-are-dist node tools/explainers.mjs
 */
import { serve } from './content-lib.mjs';
import { chromium } from 'playwright';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const DIST = process.env.DIST || 'web-are-dist';
const PORT = Number(process.env.PORT || 8955);
const OUT = process.env.OUT || 'docs/explainers';
const RAW = '/tmp/explainers-raw';
const FONT = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf';
const VIEW = { width: 486, height: 864 };          // exactly 9:16, inside the phone breakpoint
const TARGET = { width: 1080, height: 1920 };      // clean 2.222x upscale, no crop, no pad
const MAX_SECONDS = 30;
fs.mkdirSync(OUT, { recursive: true });
fs.rmSync(RAW, { recursive: true, force: true });
fs.mkdirSync(RAW, { recursive: true });
if (!fs.existsSync(FONT)) throw new Error(`no caption font at ${FONT}`);

const server = await serve(DIST, PORT);
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const report = { guard: {}, clips: [], facts: {} };

async function ctxFor({ lang = 'en', record = null, seeded = true } = {}) {
  const ctx = await browser.newContext({
    viewport: VIEW, deviceScaleFactor: 1,
    ...(record ? { recordVideo: { dir: record, size: VIEW } } : {}),
  });
  // No request may leave for production or the database, whatever the app tries.
  await ctx.route('**/*', (r) => (/supabase\.co|ftable\.co\.il/i.test(r.request().url()) ? r.abort() : r.continue()));
  await ctx.addInitScript(([l, s]) => {
    try {
      localStorage.setItem('caps_language', l);
      if (s) {
        localStorage.setItem('has_seen_interactive_tutorial', 'true');
        localStorage.setItem('caps_games_played', '25');
      }
    } catch (_) {}
  }, [lang, seeded]);
  return ctx;
}
const open = async (ctx, route, settle = 7000) => {
  const p = await ctx.newPage();
  await p.goto(`http://localhost:${PORT}${route}`, { waitUntil: 'load', timeout: 120000 });
  await p.waitForTimeout(settle);
  return p;
};
const script = (p) => p.evaluate(() => {
  const t = document.body.innerText || '';
  return { hebrew: (t.match(/[֐-׿]/g) || []).length, latin: (t.match(/[A-Za-z]/g) || []).length, text: t.replace(/\s+/g, ' ') };
});

// ── 1 · THE LANGUAGE GUARD ───────────────────────────────────────────────────────────────────
{
  const SCREENS = { home: '/', play: '/play', profile: '/profile', shop: '/shop', lobby: '/lobby', history: '/hand-history' };
  for (const [name, route] of Object.entries(SCREENS)) {
    const row = {};
    for (const lang of ['en', 'he']) {
      const ctx = await ctxFor({ lang });
      const p = await open(ctx, route, 6000);
      const f = `${RAW}/guard-${name}-${lang}.png`;
      await p.screenshot({ path: f });
      row[lang] = { bytes: fs.statSync(f).size, ...(await script(p)) };
      delete row[lang].text;
      await ctx.close();
    }
    row.bytesDiffer = row.en.bytes !== row.he.bytes;
    row.enHasNoHebrew = row.en.hebrew === 0;              // BLOCKING — zero tolerance
    row.heHasHebrew = row.he.hebrew > 0;                  // reported only — an untranslated screen is allowed
    row.pass = row.bytesDiffer && row.enHasNoHebrew;
    report.guard[name] = row;
  }
  report.untranslatedInHebrew = Object.entries(report.guard)
    .filter(([, r]) => !r.heHasHebrew).map(([n]) => n);
  const bad = Object.entries(report.guard).filter(([, r]) => !r.pass);
  if (bad.length) {
    console.log(JSON.stringify({ LANGUAGE_GUARD_FAILED: Object.fromEntries(bad) }, null, 1));
    await browser.close(); server.close();
    process.exit(2);
  }
  console.log('language guard: PASS on all', Object.keys(report.guard).length, 'screens');
  if (report.untranslatedInHebrew.length)
    console.log('  gap (allowed): no Hebrew rendered on —', report.untranslatedInHebrew.join(', '));
}

// ── 2 · SESSION A — one practice hand, end to end, in one recording ──────────────────────────
const marks = {};
{
  const dir = `${RAW}/A`;
  const ctx = await ctxFor({ record: dir });
  const t0 = Date.now();
  const at = (k) => { marks[k] = (Date.now() - t0) / 1000; };
  const page = await ctx.newPage();

  await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'load', timeout: 120000 });
  await page.waitForTimeout(7000);
  at('homeStart');
  report.facts.home = (await script(page)).text.slice(0, 200);
  await page.waitForTimeout(6000);

  // PRACTICE GUARD: the rig can only ask for practice; there is no argument for a live table.
  const url = `/game?practice=true&players=3&fresh=1`;
  if (!/[?&]practice=true(&|$)/.test(url)) throw new Error('PRACTICE GUARD');
  await page.goto(`http://localhost:${PORT}${url}`, { waitUntil: 'load', timeout: 120000 });
  await page.waitForTimeout(8000);
  at('placeStart');
  report.facts.place = (await script(page)).text.slice(0, 200);
  await page.waitForTimeout(4000);
  const auto = page.locator('text=/Auto-Place ALL/').first();
  if (await auto.count()) { await auto.click({ force: true }); await page.waitForTimeout(3500); }
  const ready = page.locator('[data-testid="ready-button"]').first();
  at('placeEnd');
  if (await ready.count()) { await ready.click({ force: true }); await page.waitForTimeout(5000); }

  at('revealStart');
  for (let i = 0; i < 12; i++) {
    if (/results/.test(page.url())) break;
    const tap = page.locator('text=/Tap to reveal/').first();
    if (await tap.count()) await tap.click({ force: true });
    await page.waitForTimeout(1600);
  }
  report.facts.reveal = (await script(page)).text.slice(0, 200);
  await page.waitForTimeout(2500);

  at('resultsStart');
  await page.waitForTimeout(9000);
  report.facts.results = (await script(page)).text.slice(0, 240);

  await page.goto(`http://localhost:${PORT}/hand-history`, { waitUntil: 'load', timeout: 120000 });
  await page.waitForTimeout(7000);
  at('historyStart');
  report.facts.history = (await script(page)).text.slice(0, 200);
  await page.waitForTimeout(7000);

  await page.goto(`http://localhost:${PORT}/profile`, { waitUntil: 'load', timeout: 120000 });
  await page.waitForTimeout(7000);
  at('profileStart');
  report.facts.profile = (await script(page)).text.slice(0, 200);
  await page.waitForTimeout(7000);
  at('end');
  await ctx.close();
  marks.file = path.join(dir, fs.readdirSync(dir).find((f) => f.endsWith('.webm')));
}

// ── 3 · SESSION B — the screens that need no history ─────────────────────────────────────────
const marksB = {};
{
  const dir = `${RAW}/B`;
  const ctx = await ctxFor({ record: dir });
  const t0 = Date.now();
  const at = (k) => { marksB[k] = (Date.now() - t0) / 1000; };
  const page = await ctx.newPage();
  await page.goto(`http://localhost:${PORT}/lobby`, { waitUntil: 'load', timeout: 120000 });
  await page.waitForTimeout(8000);
  at('lobbyStart');
  report.facts.lobby = (await script(page)).text.slice(0, 240);
  await page.waitForTimeout(8000);
  await page.goto(`http://localhost:${PORT}/shop`, { waitUntil: 'load', timeout: 120000 });
  await page.waitForTimeout(7000);
  at('shopStart');
  report.facts.shop = (await script(page)).text.slice(0, 200);
  await page.waitForTimeout(7000);
  at('end');
  await ctx.close();
  marksB.file = path.join(dir, fs.readdirSync(dir).find((f) => f.endsWith('.webm')));
}

await browser.close();
server.close();
fs.writeFileSync(`${RAW}/marks.json`, JSON.stringify({ marks, marksB, facts: report.facts }, null, 1));
fs.writeFileSync(`${OUT}/explainers-report.json`, JSON.stringify(report, null, 1));
console.log(JSON.stringify({ marks, marksB }, null, 1));
console.log('\nFACTS READ OFF THE RUNNING BUILD (captions must agree with these):');
for (const [k, v] of Object.entries(report.facts)) console.log(`  ${k}: ${v.slice(0, 150)}`);
