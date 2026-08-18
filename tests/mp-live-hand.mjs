/**
 * THE STAGE-2 ASSERTION — one complete two-client hand, server-adjudicated.
 *
 * Locators come from the DOM dump (tests/mp-ready-dump.mjs), not from guesses:
 *   ready-button   is a TESTID; no element has the exact text "READY" — three text-locator
 *                  theories died on that.
 *   board-N        4 of them; the harness's old [data-testid^="board-"] also matched
 *                  `board-surface`, which is the entire off-by-one (5 at a 4-board table).
 *   hand-card      16 at a 4-board table.
 * Placement is SELECT-THEN-PLACE: tapping a board with nothing selected is a no-op, which is why
 * the old harness placed zero cards and then waited 40s for a READY that never enabled.
 *
 *   BASE=https://caps.ftable.co.il node tests/mp-live-hand.mjs
 */
import { chromium } from 'playwright';

const BASE = process.env.BASE || 'https://caps.ftable.co.il';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...a) => console.log('[live]', ...a);

function wire(p, who) {
  // THE CAPTURE. Three failure modes look identical from the outside — never called, called and
  // failed, or succeeded with the broadcast lost. serverAdjudication.ts throws loudly rather than
  // falling back, so if it was tried and failed the console says why.
  p.on('console', (m) => {
    const t = m.text();
    if (m.type() === 'error' || /stage2|resolve_hand|submit_placements|RT |READY|ALL_READY/i.test(t)) {
      console.log(`[${who}:${m.type()}]`, t.slice(0, 300));
    }
  });
  p.on('pageerror', (e) => console.log(`[${who}:pageerror]`, String(e).slice(0, 300)));
  p.on('response', (r) => { if (r.status() >= 400) console.log(`[${who}:HTTP ${r.status()}]`, r.url().slice(0, 160)); });
}

async function boot(ctx) {
  const p = await ctx.newPage();
  await p.goto(BASE, { waitUntil: 'domcontentloaded' }).catch(() => {});
  await sleep(6000);
  await p.goto(BASE + '/lobby/private', { waitUntil: 'domcontentloaded' }).catch(() => {});
  await sleep(4000);
  return p;
}

async function placeAll(page, who) {
  const boards = await page.locator('[data-testid^="board-"]:not([data-testid="board-surface"])').count();
  log(`${who}: boards =`, boards);
  for (let b = 0; b < boards; b++) {
    for (let c = 0; c < 4; c++) {
      const card = page.locator('[data-testid="hand-card"]').first();
      if (!(await card.count())) break;
      await card.click({ timeout: 3000 }).catch(() => {});
      await sleep(120);
      await page.locator(`[data-testid="board-${b}"]`).first().click({ timeout: 3000 }).catch(() => {});
      await sleep(160);
    }
  }
  const left = await page.locator('[data-testid="hand-card"]').count();
  log(`${who}: hand cards left =`, left);
  return left;
}

const browser = await chromium.launch();
const A = await boot(await browser.newContext({ viewport: { width: 375, height: 812 } }));
const B = await boot(await browser.newContext({ viewport: { width: 375, height: 812 } }));
wire(A, 'A'); wire(B, 'B');
const out = { code: null, aResults: false, bResults: false, aSummary: '', bSummary: '' };
try {
  await A.getByLabel(/Create a 2-player private table/i).first().click();
  await sleep(3000);
  out.code = (await A.getByText(/^[A-Z0-9]{4}$/).first().textContent().catch(() => '') || '').trim();
  log('code =', out.code);
  const inp = B.getByLabel(/Enter a table code/i).first();
  await inp.fill(out.code);
  await B.getByLabel(/Join by code/i).first().click();
  for (const p of [A, B]) {
    await p.waitForFunction(() => location.pathname.includes('multiplayer-game'), { timeout: 60000 }).catch(() => {});
  }
  await sleep(5000);

  await placeAll(A, 'A');
  await placeAll(B, 'B');

  for (const [p, who] of [[A, 'A'], [B, 'B']]) {
    const rb = p.locator('[data-testid="ready-button"]').first();
    const vis = await rb.isVisible().catch(() => false);
    log(`${who}: ready-button visible =`, vis);
    if (vis) { await rb.click({ timeout: 5000 }).catch(() => {}); log(`${who}: pressed ready`); }
  }

  const t0 = Date.now();
  for (const [p, k] of [[A, 'aResults'], [B, 'bResults']]) {
    out[k] = await p.waitForFunction(() => location.pathname.includes('results'), { timeout: 150000 })
      .then(() => true).catch(() => false);
    log(`${k} after ${Math.round((Date.now() - t0) / 1000)}s`);
  }
  log('final URLs', A.url().split('?')[0], '|', B.url().split('?')[0]);
  log('A results =', out.aResults, ' B results =', out.bResults);
  if (out.aResults) out.aSummary = (await A.evaluate(() => document.body.innerText.slice(0, 300)).catch(() => ''));
  if (out.bResults) out.bSummary = (await B.evaluate(() => document.body.innerText.slice(0, 300)).catch(() => ''));
  console.log('--- A /results ---\n' + out.aSummary);
  console.log('--- B /results ---\n' + out.bSummary);
} finally {
  console.log('RESULT ' + JSON.stringify({ code: out.code, aResults: out.aResults, bResults: out.bResults }));
  await browser.close();
}
