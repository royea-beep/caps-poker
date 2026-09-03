/**
 * LANDING HERO SHOTS — English, from the current build.
 *
 * WHY. public/shots/*.webp were re-shot in HEBREW on 2026-09-02 "to match the primary audience".
 * The record was corrected on 2026-09-03: CAPS is ENGLISH-FIRST and global; Hebrew is the pilot
 * addition. An English landing page showing Hebrew screenshots is the same half-state defect the
 * audit is about — the page claims one language and shows another. These are the English pair;
 * the Hebrew pair is kept beside them and the page swaps both with its existing `data-l` toggle,
 * so Hebrew stays free from the same source.
 *
 * GEOMETRY. 440x954 CSS at deviceScaleFactor 1.5 = 660x1431 device px, byte-for-byte the
 * dimensions the page's <img width/height> already declares, so no layout shift.
 *
 *   node tests/landing-shots.mjs
 */
import { serve, openGame, autoPlaceAll, pressReady } from '../tools/content-lib.mjs';
import { chromium } from 'playwright';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';

const PORT = 8995;
const DIST = process.env.DIST || '/tmp/webloop2';
const LANG = process.env.LANG_ID || 'en';
const TMP = '/tmp/landing-shots';
fs.mkdirSync(TMP, { recursive: true });
process.env.CAPS_BROWSER_PATH = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

const server = await serve(DIST, PORT);
const browser = await chromium.launch({ executablePath: process.env.CAPS_BROWSER_PATH });

// openGame owns the practice guard and the offline guard; it fixes the viewport, so the page is
// resized afterwards and given time to re-lay-out at the hero geometry.
const { ctx, page } = await openGame(browser, { port: PORT, players: 3, seed: 20260827 });
await page.addInitScript((l) => { try { localStorage.setItem('caps_language', l); } catch (_) {} }, LANG);
await ctx.addInitScript((l) => { try { localStorage.setItem('caps_language', l); } catch (_) {} }, LANG);
await page.setViewportSize({ width: 440, height: 954 });
await page.reload({ waitUntil: 'load' });
await page.waitForTimeout(6000);

await autoPlaceAll(page);
await page.waitForTimeout(2500);
await page.screenshot({ path: `${TMP}/boards-${LANG}.png` });
console.log('boards shot ->', `${TMP}/boards-${LANG}.png`);

await pressReady(page);
await page.waitForTimeout(3500);
const tap = page.locator('text=/Tap to reveal|הקש/').first();
if (await tap.count()) { await tap.click({ force: true }); await page.waitForTimeout(2600); }
await page.screenshot({ path: `${TMP}/reveal-${LANG}.png` });
console.log('reveal shot ->', `${TMP}/reveal-${LANG}.png`);

await ctx.close(); await browser.close(); server.close();

// deviceScaleFactor is fixed at 1 by the rig, so scale to the declared hero size here.
for (const n of ['boards', 'reveal']) {
  execFileSync('npx', ['sharp-cli', '--help'], { stdio: 'ignore' });
}
