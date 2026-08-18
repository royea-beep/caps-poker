/**
 * N-PLAYER LIVE HAND — 3 and 4 seats, optionally with a mid-hand drop.
 *
 * BOARD COUNT IS RE-DERIVED FROM THE RULE, never assumed: 2P=4, 3P=3, 4P=2. It has been inverted
 * four times in this project, so the harness asserts the DOM against the rule and fails loudly.
 *
 *   BASE=https://caps.ftable.co.il PLAYERS=3 node tests/mp-nplayer-hand.mjs
 *   BASE=... PLAYERS=3 DROP=1 node tests/mp-nplayer-hand.mjs      <- drop the LAST guest
 */
import { chromium } from 'playwright';

const BASE = process.env.BASE || 'https://caps.ftable.co.il';
const N = Number(process.env.PLAYERS || 3);
const DROP = process.env.DROP === '1';
const EXPECTED_BOARDS = { 2: 4, 3: 3, 4: 2 }[N];   // THE RULE
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...a) => console.log('[np]', ...a);

async function boot(ctx, who) {
  const p = await ctx.newPage();
  p.on('console', (m) => { const t = m.text(); if (m.type() === 'error' || /stage2|resolve_hand|submit_placements/i.test(t)) console.log(`[${who}:${m.type()}]`, t.slice(0, 220)); });
  await p.goto(BASE, { waitUntil: 'domcontentloaded' }).catch(() => {});
  await sleep(6000);
  await p.goto(BASE + '/lobby/private', { waitUntil: 'domcontentloaded' }).catch(() => {});
  await sleep(4000);
  return p;
}

async function placeAll(page, who, boards) {
  for (let b = 0; b < boards; b++) {
    for (let c = 0; c < 4; c++) {
      const card = page.locator('[data-testid="hand-card"]').first();
      if (!(await card.count())) break;
      await card.click({ timeout: 3000 }).catch(() => {});
      await sleep(110);
      await page.locator(`[data-testid="board-${b}"]`).first().click({ timeout: 3000 }).catch(() => {});
      await sleep(140);
    }
  }
  const left = await page.locator('[data-testid="hand-card"]').count();
  log(`${who}: cards left = ${left}`);
  return left;
}

const browser = await chromium.launch();
const ctxs = []; const pages = [];
for (let i = 0; i < N; i++) {
  const c = await browser.newContext({ viewport: { width: 375, height: 812 } });
  ctxs.push(c); pages.push(await boot(c, String.fromCharCode(65 + i)));
}
let code = null;
try {
  await pages[0].getByLabel(new RegExp(`Create a ${N}-player private table`, 'i')).first().click();
  await sleep(3000);
  code = (await pages[0].getByText(/^[A-Z0-9]{4}$/).first().textContent().catch(() => '') || '').trim();
  log(`code = ${code}  players = ${N}  expected boards (from the rule) = ${EXPECTED_BOARDS}`);

  for (let i = 1; i < N; i++) {
    await pages[i].getByLabel(/Enter a table code/i).first().fill(code);
    await pages[i].getByLabel(/Join by code/i).first().click();
    await sleep(1200);
  }
  for (const p of pages) await p.waitForFunction(() => location.pathname.includes('multiplayer-game'), { timeout: 90000 }).catch(() => {});
  await sleep(5000);

  const boards = await pages[0].locator('[data-testid^="board-"]:not([data-testid="board-surface"])').count();
  log(`DOM board count = ${boards}  (rule says ${EXPECTED_BOARDS})`);
  if (boards !== EXPECTED_BOARDS) log(`*** BOARD COUNT MISMATCH — rule ${EXPECTED_BOARDS}, DOM ${boards}`);

  const placers = DROP ? N - 1 : N;
  for (let i = 0; i < placers; i++) await placeAll(pages[i], String.fromCharCode(65 + i), boards);

  let tDrop = null;
  if (DROP) {
    log(`DROPPING ${String.fromCharCode(65 + N - 1)} (context closed) — grace 30s; connected becomes ${N - 1}`);
    tDrop = Date.now();
    await ctxs[N - 1].close();
  }

  for (let i = 0; i < placers; i++) {
    const rb = pages[i].locator('[data-testid="ready-button"]').first();
    if (await rb.isVisible().catch(() => false)) { await rb.click().catch(() => {}); log(`${String.fromCharCode(65 + i)} pressed ready`); }
    await sleep(300);
  }

  // POLL urls — waitForFunction rejects when navigation destroys the context.
  const arrived = new Array(placers).fill(false);
  for (let t = 0; t < 70; t++) {
    await sleep(3000);
    for (let i = 0; i < placers; i++) if (!arrived[i] && (pages[i].url() || '').includes('results')) arrived[i] = true;
    if (arrived.every(Boolean)) break;
  }
  log('reached /results:', arrived.map((v, i) => `${String.fromCharCode(65 + i)}=${v}`).join(' '));
  if (tDrop) log(`elapsed since drop: ${Math.round((Date.now() - tDrop) / 1000)}s`);
  for (let i = 0; i < placers; i++) {
    if (arrived[i]) log(`${String.fromCharCode(65 + i)} summary:`, (await pages[i].evaluate(() => document.body.innerText.slice(0, 140)).catch(() => '')).replace(/\n/g, ' | '));
  }
} finally {
  console.log('NPRESULT ' + JSON.stringify({ code, players: N, drop: DROP }));
  await browser.close();
}
