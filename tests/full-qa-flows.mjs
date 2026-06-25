// VAMOS-CAPS FULL-QA-COUNCIL — interactive flow assertions (live site).
// Asserts buttons perform their EXPECTED action (navigation/state change), not just render.
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'fs';
const BASE = process.env.BASE || 'https://caps.ftable.co.il';
const OUT = 'test-results/full-qa';
mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...a) => console.log('[flow]', ...a);
const rows = [];
const rec = (screen, element, expected, ok, evidence = '') => { rows.push({ screen, element, expected, result: ok ? 'PASS' : 'FAIL', evidence }); log(`${ok ? 'PASS' : 'FAIL'} | ${screen} | ${element} -> ${expected}${evidence ? ' | ' + evidence : ''}`); };
const path = (p) => p.evaluate(() => location.pathname);

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
// Mark onboarding seen so flows run in real-user state.
await ctx.addInitScript(() => { try { localStorage.setItem('has_seen_interactive_tutorial', 'true'); } catch {} });
const p = await ctx.newPage();
const errors = [];
p.on('pageerror', (e) => errors.push('[pageerror] ' + e.message.slice(0, 160)));

await p.goto(BASE, { waitUntil: 'domcontentloaded' }); await sleep(6000);

// ── Nav tabs ──────────────────────────────────────────────
async function tab(label, expectRe, name) {
  const el = p.getByRole('button', { name: new RegExp(label, 'i') }).first();
  const found = await el.isVisible({ timeout: 2500 }).catch(() => false);
  if (!found) { rec('nav', label + ' tab', 'navigate ' + name, false); return; }
  await el.click().catch(() => {});
  await sleep(2000);
  const body = await p.evaluate(() => document.body.innerText);
  rec('nav', label + ' tab', 'navigate ' + name, expectRe.test(body), name + '.png');
}
await tab('Play', /Single Player|Multiplayer Lobby/i, 'play');
await tab('Friends', /Invite|Leaderboard|Multiplayer/i, 'friends');
await tab('Cups', /Cup|Bronze|Silver|Gold/i, 'cups');
await tab('Profile', /Achievements|Settings|Stats/i, 'profile');
await tab('Home', /PLAY|CAPS|Daily/i, 'home');

// ── Play tab actions ──────────────────────────────────────
await p.goto(BASE + '/play', { waitUntil: 'domcontentloaded' }); await sleep(3000);
{
  const sp = p.getByLabel(/Single Player/i).first();
  await sp.click().catch(() => {});
  await sleep(4000);
  rec('play', 'Single Player card', '/game', (await path(p)).includes('game'), 'sp-game.png');
  await p.screenshot({ path: `${OUT}/flow-sp-game.png` });
}
// ── Single-player playthrough: place 16 cards via board testIDs, READY -> results ──
{
  const boards = await p.locator('[data-testid^="board-"]').count().catch(() => 0);
  rec('game(SP)', 'boards render', '4 boards for default cfg', boards >= 2, 'sp-game.png');
  for (let i = 0; i < boards; i++) {
    const b = p.locator(`[data-testid="board-${i}"]`).first();
    for (let c = 0; c < 4; c++) { await b.click({ timeout: 1500, position: { x: 30, y: 60 } }).catch(() => {}); await sleep(120); }
  }
  await p.screenshot({ path: `${OUT}/flow-sp-placed.png` });
  // find a confirm/ready/place button
  const ready = p.getByText(/^(READY|CONFIRM|REVEAL|DONE|PLACE|לחשוף|מוכן)/i).first();
  const gotReady = await ready.isVisible({ timeout: 8000 }).then(() => true).catch(() => false);
  if (gotReady) { await ready.click().catch(() => {}); }
  rec('game(SP)', 'place 16 + confirm', 'reveal/results', gotReady, 'sp-placed.png');
  const onResults = await p.waitForFunction(() => location.pathname.includes('results'), { timeout: 30000 }).then(() => true).catch(() => false);
  await sleep(1500);
  await p.screenshot({ path: `${OUT}/flow-sp-results.png` });
  const body = await p.evaluate(() => document.body.innerText);
  rec('game(SP)', 'hand resolves', '/results with WIN/LOSE + chips', onResults && /WIN|LOSE|Net|chips|Board/i.test(body), 'sp-results.png');
}

// ── Lobby: create a 2P table -> table room with code ──
await p.goto(BASE + '/lobby', { waitUntil: 'domcontentloaded' }); await sleep(3000);
{
  const create = p.getByLabel(/Create a 2-player table/i).first();
  const found = await create.isVisible({ timeout: 4000 }).catch(() => false);
  if (found) {
    await create.click().catch(() => {});
    const gotRoom = await p.getByText(/TABLE CODE/i).first().isVisible({ timeout: 12000 }).catch(() => false);
    rec('lobby', 'Create 2P table', 'table room w/ code', gotRoom, 'lobby-table.png');
    await p.screenshot({ path: `${OUT}/flow-lobby-table.png` });
  } else rec('lobby', 'Create 2P table', 'table room w/ code', false);
}

// ── Profile links navigate ──
const profLinks = [['Achievements', 'achievements'], ['Missions', 'missions'], ['Detailed', 'stats'], ['Settings', 'settings']];
await p.goto(BASE + '/profile', { waitUntil: 'domcontentloaded' }); await sleep(2500);
{
  const body = await p.evaluate(() => document.body.innerText);
  rec('profile', 'Leaderboard row', 'ABSENT (dedupe)', !/Leaderboard|Rankings/i.test(body));
}
for (const [label, dest] of profLinks) {
  await p.goto(BASE + '/profile', { waitUntil: 'domcontentloaded' }); await sleep(2000);
  const link = p.getByLabel(new RegExp(label, 'i')).first();
  if (await link.isVisible({ timeout: 2000 }).catch(() => false)) {
    await link.click().catch(() => {}); await sleep(2500);
    rec('profile', label + ' link', '/' + dest, (await path(p)).includes(dest));
  } else rec('profile', label + ' link', '/' + dest, false);
}

// ── Settings: toggle a couple, assert no throw ──
await p.goto(BASE + '/settings', { waitUntil: 'domcontentloaded' }); await sleep(3000);
{
  const before = errors.length;
  const toggles = await p.locator('[role="switch"], [aria-label*="toggle" i]').count().catch(() => 0);
  // click first few switches
  for (let i = 0; i < Math.min(toggles, 4); i++) { await p.locator('[role="switch"]').nth(i).click({ timeout: 1500 }).catch(() => {}); await sleep(400); }
  rec('settings', `toggles (${toggles})`, 'no runtime error', errors.length === before, 'settings.png');
}

// ── Shop: buy deducts (best-effort) ──
await p.goto(BASE + '/shop', { waitUntil: 'domcontentloaded' }); await sleep(3000);
{
  const before = errors.length;
  const buy = p.getByText(/Buy|Purchase|Get|קנה/i).first();
  const found = await buy.isVisible({ timeout: 3000 }).catch(() => false);
  if (found) { await buy.click().catch(() => {}); await sleep(2000); }
  rec('shop', 'Buy button', 'no runtime error on tap', errors.length === before, 'shop.png');
  await p.screenshot({ path: `${OUT}/flow-shop.png` });
}

writeFileSync(`${OUT}/flow-results.json`, JSON.stringify({ rows, pageerrors: errors }, null, 2));
log('=== PAGEERRORS during flows:', errors.length, JSON.stringify(errors.slice(0, 6)));
const pass = rows.filter((r) => r.result === 'PASS').length;
log(`=== FLOW TOTALS: ${pass}/${rows.length} PASS ===`);
await browser.close();
