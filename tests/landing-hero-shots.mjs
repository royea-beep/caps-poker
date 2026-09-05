/**
 * LANDING HERO STILLS — both languages, from the CURRENT build.
 *
 * LANDING-AND-AUTOSWEEP 2026-09-05. The shipped public/shots/*.webp were captured on 2026-09-03
 * BEFORE FULL-I18N landed (+159 keys, game/reveal wired to t()), so the Hebrew pair in particular
 * shows an app that no longer exists. These are re-shot from a fresh export of this branch.
 *
 * Supersedes tests/landing-shots.mjs, which hard-codes the ENGLISH "Auto-Place ALL" label and so
 * silently produces an un-placed board on a Hebrew run — the label is now t().autoPlaceAll
 * ('מלא הכל' in Hebrew).
 *
 * GEOMETRY. 440x954 CSS at deviceScaleFactor 1.5 = 660x1431 device px, byte-for-byte the
 * dimensions public/landing.html already declares on each <img>, so no layout shift. The numbers
 * are read back from the written file and asserted, not assumed (Iron Rule #3: never hardcode a
 * dimension without proving it).
 *
 *   DIST=web-las-dist node tests/landing-hero-shots.mjs
 */
import { serve, openGame } from '../tools/content-lib.mjs';
import { chromium } from 'playwright';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';

const PORT = Number(process.env.PORT || 8996);
const DIST = process.env.DIST || 'web-las-dist';
const TMP = '/tmp/landing-hero';
const OUT = 'public/shots';
const CSS = { width: 440, height: 954 };
const DSF = 1.5;
fs.mkdirSync(TMP, { recursive: true });
fs.mkdirSync(OUT, { recursive: true });

const server = await serve(DIST, PORT);
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const report = {};

for (const LANG of ['en', 'he']) {
  // openGame owns the practice guard and the offline guard. Its context is fixed at the video
  // viewport, so a second context is opened at the hero geometry with the same guards re-applied.
  const ctx = await browser.newContext({ viewport: CSS, deviceScaleFactor: DSF });
  await ctx.route('**/*', (r) => (/supabase\.co|ftable\.co\.il/i.test(r.request().url()) ? r.abort() : r.continue()));
  await ctx.addInitScript((l) => {
    try {
      localStorage.setItem('caps_language', l);
      localStorage.setItem('has_seen_interactive_tutorial', 'true');
      localStorage.setItem('caps_games_played', '25');
    } catch (_) {}
  }, LANG);
  const page = await ctx.newPage();
  const url = `http://localhost:${PORT}/game?practice=true&players=3&fresh=1`;
  if (!/[?&]practice=true(&|$)/.test(url)) throw new Error('PRACTICE GUARD');
  await page.goto(url, { waitUntil: 'load', timeout: 120000 });
  await page.waitForTimeout(9000);

  // Language-agnostic: match EITHER label rather than assuming the English one is on screen.
  const auto = page.locator('text=/Auto-Place ALL|מלא הכל/').first();
  const sawAuto = await auto.count() > 0;
  if (sawAuto) { await auto.click({ force: true }); await page.waitForTimeout(3000); }
  await page.screenshot({ path: `${TMP}/boards-${LANG}.png` });

  // RTL OVERLAP PROBE. The practice pill is position:absolute and was anchored with a hard
  // `left`, which is direction-blind: in RTL the ✕ it was placed to clear moves to the other
  // edge and the pill lands on the allPlaced / "PLACE N CARDS" pill instead. Measured as painted
  // boxes (not glyphs, not inner Text) because MEASUREMENT-PROTOCOL Rule 23 exists for that
  // reason, and WITHOUT the layer test that previously suppressed this pair.
  report[`${LANG}-headerOverlap`] = await page.evaluate((practiceTxt) => {
    // HEADER ONLY. `allPlaced` is rendered twice — the header pill AND the hand-zone line at the
    // bottom of the screen — so an unscoped match takes the wrong one and reports a clean 0.
    const all = [...document.querySelectorAll('div,span')]
      .filter((e) => e.getBoundingClientRect().top < 60 && e.children.length <= 2);
    const find = (re) => all.filter((e) => re.test(e.textContent || '')).pop();
    const a = find(new RegExp(practiceTxt));
    const b = find(/All cards placed!|כל הקלפים הונחו!|PLACE \d|מקם \d/);
    if (!a || !b) return { found: false, sawPractice: !!a, sawStatus: !!b };
    const r1 = a.getBoundingClientRect(), r2 = b.getBoundingClientRect();
    const ox = Math.max(0, Math.min(r1.right, r2.right) - Math.max(r1.left, r2.left));
    const oy = Math.max(0, Math.min(r1.bottom, r2.bottom) - Math.max(r1.top, r2.top));
    const R = (r) => ({ x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) });
    return { found: true, practice: R(r1), status: R(r2), overlapX: Math.round(ox), overlapY: Math.round(oy),
             overlapping: ox > 0 && oy > 0 };
  }, LANG === 'he' ? 'תרגול' : 'Practice');

  // THE SHIPPED PAIR WAS A DUPLICATE. public/shots/game-reveal-{en,he}.webp were byte-identical in
  // content to the boards shot — the page captioned a PLACING screen "live win odds and outs".
  // Cause: a text locator for /READY/ matches the "✓ READY" STATUS PILL at the top of the screen
  // before it matches the button at the bottom, and .first() takes the pill, which does nothing.
  // The button carries a testid; use it, and assert the phase actually changed.
  const ready = page.locator('[data-testid="ready-button"]').first();
  report[`${LANG}-readyButton`] = await ready.count() > 0;
  if (await ready.count()) { await ready.click({ force: true }); await page.waitForTimeout(5000); }
  for (let i = 0; i < 6; i++) {
    if (/results/.test(page.url())) break;
    const tap = page.locator('text=/Tap to reveal|הקש/').first();
    if (!(await tap.count())) break;
    await tap.click({ force: true });
    await page.waitForTimeout(1800);
    // Stop as soon as the equity read-out is on screen — that is what the caption promises.
    const equity = await page.evaluate(() => /%/.test(document.body.innerText || ''));
    if (equity) break;
  }
  await page.waitForTimeout(1200);
  report[`${LANG}-revealText`] = await page.evaluate(() => (document.body.innerText || '').slice(0, 160));
  await page.screenshot({ path: `${TMP}/reveal-${LANG}.png` });

  // Prove the shot is the screen we meant, not a stuck splash / empty board.
  report[LANG] = await page.evaluate(() => ({
    textLen: (document.body.innerText || '').length,
    hasCanvasOrCards: document.querySelectorAll('[data-testid], img, svg').length,
  }));

  // ⚠️ LANDING-LANG-BUG 2026-09-05 — GUARD THE LANGUAGE AT THE MOMENT OF CAPTURE.
  // The live English landing page shipped a fully Hebrew screenshot and every sweep passed it,
  // because a word baked into a PNG is not a text node. Checking here is the cheapest possible
  // place: the image IS this DOM, so the DOM's script settles the image's script with no OCR and
  // no recognition error. A `-en` shot that can see Hebrew must never be written to disk.
  const script = await page.evaluate(() => {
    const t = document.body.innerText || '';
    return { hebrew: (t.match(/[֐-׿]/g) || []).length, latin: (t.match(/[A-Za-z]/g) || []).length };
  });
  report[`${LANG}-script`] = script;
  if (LANG === 'en' && script.hebrew > 0) {
    throw new Error(`REFUSING TO WRITE THE ENGLISH HERO: ${script.hebrew} Hebrew characters on screen`);
  }
  if (LANG === 'he' && script.hebrew === 0) {
    throw new Error('REFUSING TO WRITE THE HEBREW HERO: no Hebrew on screen — caps_language did not take');
  }
  report[LANG].sawAutoPlace = sawAuto;
  await ctx.close();
}

await browser.close();
await new Promise((r) => server.close(r));

// ffmpeg, not sharp-cli — the previous script shelled out to `sharp-cli --help` and never
// converted anything, so its .webp files came from somewhere else and could not be reproduced.
for (const LANG of ['en', 'he']) {
  for (const kind of ['boards', 'reveal']) {
    const src = `${TMP}/${kind}-${LANG}.png`;
    const dst = `${OUT}/game-${kind}-${LANG}.webp`;
    execFileSync('ffmpeg', ['-y', '-i', src, '-c:v', 'libwebp', '-quality', '86', '-compression_level', '6', dst],
      { stdio: 'ignore' });
    // Iron Rule #3 — read the dimension back rather than trusting the viewport maths.
    const probe = execFileSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0',
      '-show_entries', 'stream=width,height', '-of', 'csv=p=0', dst]).toString().trim();
    report[`${kind}-${LANG}`] = { webp: probe, bytes: fs.statSync(dst).size };
  }
}
const declared = `${Math.round(CSS.width * DSF)},${Math.round(CSS.height * DSF)}`;
report.declaredInHtml = declared;
report.allMatchDeclared = Object.keys(report)
  .filter((k) => k.includes('-') && report[k].webp)
  .every((k) => report[k].webp === declared);
console.log(JSON.stringify(report, null, 1));
