/**
 * TASK 3 — MAKE THE REFUSAL PATH RENDER ONCE.
 *
 * The `not_seated` refusal itself is already proven against the live RPC:
 *   select submit_placements('JER9', 1, 'device-not-at-this-table', …) -> {"ok":false,"reason":"not_seated"}
 * What has NEVER been observed is the CLIENT's reaction to it. A refusal path nobody has watched is
 * a refusal path that might not exist.
 *
 * Reaching it naturally needs a seat to be removed from room_players mid-hand, and deleting those
 * rows is forbidden. So the exact server response shape is returned to the client by intercepting
 * the RPC. The refusal is real and measured elsewhere; this measures what the app does with it.
 *
 *   BASE=https://caps.ftable.co.il node tests/mp-notseated-banner.mjs
 */
import { chromium } from 'playwright';

const BASE = process.env.BASE || 'https://caps.ftable.co.il';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...a) => console.log('[ns]', ...a);
const seen = { err: null, banner: null };

async function boot(ctx, who) {
  const p = await ctx.newPage();
  p.on('console', (m) => {
    const t = m.text();
    if (t.includes('submit_placements')) { log(`${who} console.${m.type()}:`, t.slice(0, 200)); if (m.type() === 'error') seen.err = t.slice(0, 200); }
  });
  await p.goto(BASE, { waitUntil: 'domcontentloaded' }).catch(() => {});
  await sleep(6000);
  await p.goto(BASE + '/lobby/private', { waitUntil: 'domcontentloaded' }).catch(() => {});
  await sleep(4000);
  return p;
}

const browser = await chromium.launch();
const A = await boot(await browser.newContext({ viewport: { width: 375, height: 812 } }), 'A');
const B = await boot(await browser.newContext({ viewport: { width: 375, height: 812 } }), 'B');
try {
  // B's submit_placements is answered with the SERVER'S OWN refusal shape.
  await B.route('**/rest/v1/rpc/submit_placements', async (route) => {
    log('intercepted submit_placements from B -> returning the real not_seated shape');
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: false, reason: 'not_seated' }) });
  });

  await A.getByLabel(/Create a 2-player private table/i).first().click();
  await sleep(3000);
  const code = (await A.getByText(/^[A-Z0-9]{4}$/).first().textContent().catch(() => '') || '').trim();
  log('code =', code);
  await B.getByLabel(/Enter a table code/i).first().fill(code);
  await B.getByLabel(/Join by code/i).first().click();
  for (const p of [A, B]) await p.waitForFunction(() => location.pathname.includes('multiplayer-game'), { timeout: 60000 }).catch(() => {});
  await sleep(5000);

  const boards = await B.locator('[data-testid^="board-"]:not([data-testid="board-surface"])').count();
  for (let b = 0; b < boards; b++) {
    for (let c = 0; c < 4; c++) {
      const card = B.locator('[data-testid="hand-card"]').first();
      if (!(await card.count())) break;
      await card.click({ timeout: 3000 }).catch(() => {});
      await sleep(110);
      await B.locator(`[data-testid="board-${b}"]`).first().click({ timeout: 3000 }).catch(() => {});
      await sleep(140);
    }
  }
  const rb = B.locator('[data-testid="ready-button"]').first();
  if (await rb.isVisible().catch(() => false)) { await rb.click().catch(() => {}); log('B pressed ready -> submit is refused'); }

  for (let t = 0; t < 20; t++) {
    await sleep(1000);
    const hit = await B.evaluate(() => {
      const L = document.body.innerText.split(String.fromCharCode(10)).find((x) => x.indexOf('Could not submit your cards') >= 0);
      return L || null;
    }).catch(() => null);
    if (hit) { seen.banner = hit; break; }
  }
  log('console.error seen :', seen.err ?? 'NONE');
  log('BANNER seen        :', seen.banner ?? 'NONE');
} finally {
  console.log('NSRESULT ' + JSON.stringify(seen));
  await browser.close();
}
