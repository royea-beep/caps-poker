#!/usr/bin/env node
/**
 * scripts/qa-placement.cjs
 *
 * VAMOS-AUTO-QA (2026-06-15) — headless Playwright placement-screen matrix.
 * Drives the DEPLOYED web app at caps.ftable.co.il (NOT the local dev server
 * which hangs on Windows) across:
 *   - Board counts: bc=2 (4P), bc=3 (3P), bc=4 (2P)
 *   - Viewport widths: 320, 390, 440 (each × 956 tall)
 *   = 9 screenshots saved to ./qa/placement-bcN-WIDTH.png
 *
 * Also collects console + page errors and writes ./qa/placement-findings.md.
 *
 * Usage:
 *   npm run qa:placement
 *
 * Prerequisites:
 *   1. `npx playwright install chromium` (one-time browser install)
 *   2. caps.ftable.co.il must reflect the commit you want to QA. The web-deploy
 *      workflow ONLY auto-fires on `main` / `master`; for fix/* branches dispatch
 *      manually: `gh workflow run "Web Deploy (Vercel)" --ref <branch>`
 *
 * NOT YET IMPLEMENTED in this scaffold:
 *   - Driving the app TO the placement screen for each player count. The web
 *     app uses Hebrew RTL UI ("שחק" / "כוסות" / 2/3/4 buttons) and React Native
 *     Web renders custom Pressables — selectors need eyeballing on the live
 *     deploy to confirm. Right now this captures the LANDING screen at each
 *     width × board-count placeholder, with the intent to extend.
 *   - FTP upload — call scripts/qa-ftp-upload.cjs (also scaffolded) once
 *     screenshots are captured. Credentials per the AUTO-QA spec.
 */

const { chromium } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const BASE_URL = process.env.QA_BASE_URL || 'https://caps.ftable.co.il';
const QA_DIR = path.resolve(__dirname, '..', 'qa');
const VIEWPORTS = [
  { name: '320', width: 320, height: 956 },
  { name: '390', width: 390, height: 956 },
  { name: '440', width: 440, height: 956 },
];
// Spec board counts: bc=2 (4 players), bc=3 (3 players), bc=4 (2 players)
// Web app currently only supports 2P per the recent VAMOS work; bc=3/4 entry
// points are admin-gated. The harness records this in findings.
const BOARD_COUNTS = [
  { bc: 2, players: 4, label: 'bc2-4p' },
  { bc: 3, players: 3, label: 'bc3-3p' },
  { bc: 4, players: 2, label: 'bc4-2p' },
];

if (!fs.existsSync(QA_DIR)) fs.mkdirSync(QA_DIR, { recursive: true });

async function captureOne(browser, viewport, boardCount) {
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();
  const errors = [];
  const consoleMsgs = [];
  page.on('pageerror', (e) => errors.push(`PAGEERROR: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error') consoleMsgs.push(`CONSOLE.ERROR: ${m.text()}`);
    if (m.text().startsWith('[hand-grid]') || m.text().startsWith('[board-')) {
      consoleMsgs.push(m.text());
    }
  });
  page.on('requestfailed', (req) => {
    errors.push(`NET_FAILED: ${req.url()} — ${req.failure()?.errorText}`);
  });

  let navResult = 'landing-only';
  try {
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
    // TODO: drive to placement screen here. Selectors below are best-effort —
    // adjust after eyeballing the live deploy:
    //   await page.click('text=שחק');                    // start
    //   await page.click(`text=${boardCount.players}`);  // pick player count
    //   await page.waitForTimeout(2500);                 // wait for arrangement
    //   navResult = 'placement';
  } catch (err) {
    errors.push(`NAV_ERR: ${err.message}`);
  }

  const filename = `placement-${boardCount.label}-w${viewport.name}.png`;
  const filepath = path.join(QA_DIR, filename);
  try {
    await page.screenshot({ path: filepath, fullPage: false });
  } catch (err) {
    errors.push(`SHOT_ERR: ${err.message}`);
  }

  await context.close();
  return { filename, viewport: viewport.name, boardCount: boardCount.label, navResult, errors, consoleMsgs };
}

async function main() {
  console.log(`[qa-placement] base=${BASE_URL} → ${QA_DIR}`);
  const browser = await chromium.launch({ headless: true });
  const results = [];
  for (const vp of VIEWPORTS) {
    for (const bc of BOARD_COUNTS) {
      console.log(`[qa-placement] ${bc.label} @ ${vp.name}`);
      const r = await captureOne(browser, vp, bc);
      results.push(r);
    }
  }
  await browser.close();

  // Findings doc
  const md = [
    '# CAPS Placement-Matrix Auto-QA Findings',
    '',
    `Generated: ${new Date().toISOString()}`,
    `Base URL: ${BASE_URL}`,
    `Local files: \`${QA_DIR}\`/`,
    '',
    '## Matrix',
    '',
    '| File | Viewport | Board Count | Nav result | Errors | Console lines |',
    '|---|---|---|---|---|---|',
    ...results.map(r =>
      `| ${r.filename} | ${r.viewport} | ${r.boardCount} | ${r.navResult} | ${r.errors.length || '0'} | ${r.consoleMsgs.length || '0'} |`
    ),
    '',
    '## Details',
    '',
    ...results.flatMap(r => [
      `### ${r.filename}`,
      r.errors.length ? '**Errors:**' : '',
      ...r.errors.map(e => `- ${e}`),
      r.consoleMsgs.length ? '**Console:**' : '',
      ...r.consoleMsgs.map(c => `- \`${c}\``),
      '',
    ]),
  ].join('\n');
  const findingsPath = path.join(QA_DIR, 'placement-findings.md');
  fs.writeFileSync(findingsPath, md);
  console.log(`[qa-placement] wrote ${findingsPath}`);
  console.log(`[qa-placement] ${results.length} captures, ${results.reduce((n, r) => n + r.errors.length, 0)} errors`);
}

main().catch((err) => {
  console.error('[qa-placement] FATAL:', err);
  process.exit(1);
});
