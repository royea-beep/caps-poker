/**
 * TASK 2 — THE DROP PATH, the defect stage 2 exists for.
 *
 * The guest places nothing and its context is CLOSED mid-hand. Under the old design nobody was left
 * to write the absent player's row. The server must still adjudicate: auto-fill the missing seat
 * from its DEALT hand in dealt order, and write BOTH rows.
 *
 *   BASE=https://caps.ftable.co.il node tests/mp-drop-hand.mjs
 */
import { chromium } from 'playwright';

const BASE = process.env.BASE || 'https://caps.ftable.co.il';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...a) => console.log('[drop]', ...a);

async function boot(ctx) {
  const p = await ctx.newPage();
  p.on('console', (m) => { const t = m.text(); if (m.type() === 'error' || /stage2|RT |grace|away/i.test(t)) console.log('[c]', t.slice(0, 200)); });
  await p.goto(BASE, { waitUntil: 'domcontentloaded' }).catch(() => {});
  await sleep(6000);
  await p.goto(BASE + '/lobby/private', { waitUntil: 'domcontentloaded' }).catch(() => {});
  await sleep(4000);
  return p;
}

const browser = await chromium.launch();
const ctxA = await browser.newContext({ viewport: { width: 375, height: 812 } });
const ctxB = await browser.newContext({ viewport: { width: 375, height: 812 } });
const A = await boot(ctxA); const B = await boot(ctxB);
let code = null;
try {
  await A.getByLabel(/Create a 2-player private table/i).first().click();
  await sleep(3000);
  code = (await A.getByText(/^[A-Z0-9]{4}$/).first().textContent().catch(() => '') || '').trim();
  log('code =', code);
  await B.getByLabel(/Enter a table code/i).first().fill(code);
  await B.getByLabel(/Join by code/i).first().click();
  for (const p of [A, B]) await p.waitForFunction(() => location.pathname.includes('multiplayer-game'), { timeout: 60000 }).catch(() => {});
  await sleep(5000);

  // A places all 16; B places NOTHING and is then killed outright.
  const boards = await A.locator('[data-testid^="board-"]:not([data-testid="board-surface"])').count();
  for (let b = 0; b < boards; b++) {
    for (let c = 0; c < 4; c++) {
      const card = A.locator('[data-testid="hand-card"]').first();
      if (!(await card.count())) break;
      await card.click({ timeout: 3000 }).catch(() => {});
      await sleep(120);
      await A.locator(`[data-testid="board-${b}"]`).first().click({ timeout: 3000 }).catch(() => {});
      await sleep(150);
    }
  }
  log('A placed; hand cards left =', await A.locator('[data-testid="hand-card"]').count());

  log('DROPPING the guest now (context closed) — grace is 30s');
  const tDrop = Date.now();
  await ctxB.close();

  const rb = A.locator('[data-testid="ready-button"]').first();
  if (await rb.isVisible().catch(() => false)) { await rb.click().catch(() => {}); log('A pressed ready'); }

  // POLL THE URL, do not use waitForFunction: a navigation destroys the execution context and
  // waitForFunction rejects immediately, which reads as "false after 30s" when the page in fact
  // arrives later. That artefact has now cost two runs.
  let ok = false;
  for (let i = 0; i < 60; i++) {           // 60 x 3s = 180s; grace is 30s and the reveal ~38s
    await sleep(3000);
    if ((A.url() || '').includes('results')) { ok = true; break; }
  }
  log(`A reached /results = ${ok} after ${Math.round((Date.now() - tDrop) / 1000)}s from the drop`);
  if (ok) log('A summary:', (await A.evaluate(() => document.body.innerText.slice(0, 220)).catch(() => '')));
} finally {
  console.log('DROPRESULT ' + JSON.stringify({ code }));
  await browser.close();
}
