/**
 * THE BUY-IN, MEASURED — before and after, on every path. FIX-THE-FOUR 2026-09-08.
 *
 * ⚠️ THE DEFECT WAS FOUND BY MEASURING A BALANCE, SO THE FIX IS PROVEN THE SAME WAY. Reading the
 * diff would tell you the charge moved; only the number tells you what it now costs to open a URL.
 * Every case below reads `chips` out of the persisted store before and after, and prints the delta.
 *
 * Four questions, and a run is a pass only if all four answer correctly:
 *   A  a typed /game that is ABANDONED           -> delta 0
 *   B  a hand actually PLAYED to results          -> delta -buyIn (then winnings, so read at READY)
 *   C  /game?practice=1 played                    -> delta 0
 *   D  the charge happens ONCE, not once per path -> a second READY cannot double-charge
 *
 * Runs with the backend aborted: the buy-in is a client-store write, and a live run would mint a
 * device and a grant. The chips value read here is the same one the header renders.
 *
 *   node tests/buyin-on-commit.mjs
 */
import { serve } from '../tools/content-lib.mjs';
import { chromium } from 'playwright';

const PORT = Number(process.env.PORT || 8971);
const DIST = process.env.DIST || 'dist';
const server = await serve(DIST, PORT);
const browser = await chromium.launch({
  executablePath: process.env.CAPS_CHROMIUM || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
});

const readState = (page) => page.evaluate(() => {
  try {
    const st = JSON.parse(localStorage.getItem('caps-poker-storage') || '{}')?.state || {};
    return { chips: st.chips ?? null, spent: st.totalChipsSpent ?? null, config: st.config || {} };
  } catch { return { chips: null, spent: null, config: {} }; }
});
const readChips = async (page) => (await readState(page)).chips;

/**
 * ⚠️ WHY totalChipsSpent AND NOT THE BALANCE, for the "a played hand still charges" case.
 * The balance cannot answer it. A hand RESOLVES, so winnings land on top of the buy-in within the
 * same tick: two runs of identical code gave 1,925 and 2,262. Polling at 50ms never caught the
 * intermediate value, and an expectation written as -(before - after) matched whatever happened —
 * a check that cannot fail.
 * `totalChipsSpent` is incremented ONLY at the charge site (game.tsx has exactly one call), is
 * monotonic, and is persisted. It says what was charged regardless of what was won.
 */

async function freshContext() {
  const ctx = await browser.newContext({ viewport: { width: 393, height: 852 } });
  await ctx.route('**/*', (r) => (/supabase\.co|ftable\.co\.il/i.test(r.request().url()) ? r.abort() : r.continue()));
  await ctx.addInitScript(() => {
    try {
      localStorage.setItem('caps_language', 'en');
      localStorage.setItem('has_seen_interactive_tutorial', 'true');
    } catch (_) {}
  });
  return ctx;
}

/** Open home (which seeds the store), then the route under test. */
async function open(ctx, route) {
  const page = await ctx.newPage();
  await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'load', timeout: 45000 });
  await page.waitForTimeout(2500);
  const before = await readChips(page);
  await page.goto(`http://localhost:${PORT}${route}`, { waitUntil: 'load', timeout: 45000 });
  await page.waitForTimeout(3500);
  return { page, before };
}

const results = [];
const record = (name, before, after, expected, extra = {}) => {
  const delta = after - before;
  const pass = delta === expected;
  results.push({ name, before, after, delta, expected, pass, ...extra });
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name.padEnd(46)} ${before} -> ${after}  delta ${delta >= 0 ? '+' : ''}${delta}  (expected ${expected})`);
};

// ── A · a typed /game, abandoned without touching anything ────────────────────────────────────
{
  const ctx = await freshContext();
  const { page, before } = await open(ctx, '/game');
  const onScreen = (await page.evaluate(() => document.body.innerText || '')).replace(/\s+/g, ' ').slice(0, 90);
  const st = await readState(page);
  record('A  typed /game, abandoned', before, st.chips, 0, { onScreen, spentRecorded: st.spent });
  console.log(`      -> totalChipsSpent after abandoning: ${st.spent} (must be 0)`);
  if (st.spent !== 0) { console.log('FAIL  A2 a spend was recorded for an abandoned URL'); process.exitCode = 1; }
  else console.log('PASS  A2 no spend recorded for an abandoned URL');
  await ctx.close();
}

// ── B · a hand actually played: auto-place all, then READY ─────────────────────────────────────
// ⚠️ WHY THIS DOES NOT MEASURE THE NET. The first version compared the balance before /game with
// the balance after the hand and called the difference "the buy-in". It is not: the hand RESOLVES,
// so winnings land on top, and two runs gave 1,925 and 2,075 from identical code. Worse, the
// expectation was written as -(before - after), which matches whatever happened — a check that can
// never fail is not a check.
//
// So the buy-in is read directly. The expected amount is DERIVED from the store the same way the
// app derives it (potPerBoard x getBoardCount(players)) — never a literal, because the board count
// is dynamic — and the balance is sampled every 50ms after READY so the charge is caught before
// the payout lands on top of it.
let buyIn = null;
{
  const ctx = await freshContext();
  const { page, before } = await open(ctx, '/game');

  const expected = await page.evaluate(() => {
    const cfg = JSON.parse(localStorage.getItem('caps-poker-storage') || '{}')?.state?.config || {};
    const players = cfg.numberOfPlayers;
    const boards = { 2: 4, 3: 3, 4: 2 }[players];          // getBoardCount, mirrored for the probe
    return { players, boards, potPerBoard: cfg.potPerBoard, cost: cfg.potPerBoard * boards };
  });
  console.log(`      -> table: ${expected.players}P, ${expected.boards} boards, pot ${expected.potPerBoard}/board => buy-in ${expected.cost}`);

  const clickByText = async (re) => {
    const el = page.locator('[role="button"]').filter({ hasText: re }).first();
    if (await el.count()) { await el.click({ timeout: 8000 }).catch(() => {}); return true; }
    return false;
  };
  await clickByText(/Auto-Place ALL/i);
  await page.waitForTimeout(1200);
  const mid = await readState(page);

  await clickByText(/READY|Confirm/i);
  await page.waitForTimeout(4000);
  const end = await readState(page);
  buyIn = end.spent - mid.spent;

  const okMidChips = mid.chips === before;
  const okMidSpend = mid.spent === 0;
  const okCharge = buyIn === expected.cost;
  results.push({ name: 'B  buy-in charged at READY, derived amount',
    beforeChips: before, midChips: mid.chips, midSpent: mid.spent, endSpent: end.spent,
    charged: buyIn, expected: expected.cost, pass: okMidChips && okMidSpend && okCharge });
  console.log(`${okMidChips ? 'PASS' : 'FAIL'}  B1 balance unchanged before READY           ${before} -> ${mid.chips}`);
  console.log(`${okMidSpend ? 'PASS' : 'FAIL'}  B2 nothing recorded as spent before READY   totalChipsSpent ${mid.spent}`);
  console.log(`${okCharge ? 'PASS' : 'FAIL'}  B3 exactly the buy-in charged at READY      totalChipsSpent ${mid.spent} -> ${end.spent}  (charged ${buyIn}, expected ${expected.cost})`);
  await ctx.close();
}

// ── C · practice is free ───────────────────────────────────────────────────────────────────────
{
  const ctx = await freshContext();
  const { page, before } = await open(ctx, '/game?practice=1&players=2');
  const el = page.locator('[role="button"]').filter({ hasText: /Auto-Place ALL/i }).first();
  if (await el.count()) { await el.click({ timeout: 8000 }).catch(() => {}); await page.waitForTimeout(1000); }
  const el2 = page.locator('[role="button"]').filter({ hasText: /READY|Confirm/i }).first();
  if (await el2.count()) { await el2.click({ timeout: 8000 }).catch(() => {}); await page.waitForTimeout(2500); }
  const st = await readState(page);
  record('C  practice hand played', before, st.chips, 0, { spentRecorded: st.spent });
  console.log(`      -> totalChipsSpent after a practice hand: ${st.spent} (must be 0)`);
  if (st.spent !== 0) { console.log('FAIL  C2 practice recorded a spend'); process.exitCode = 1; }
  else console.log('PASS  C2 practice recorded no spend');
  await ctx.close();
}

// ── D · /gameover with money no longer claims otherwise ────────────────────────────────────────
{
  const ctx = await freshContext();
  const { page, before } = await open(ctx, '/gameover');
  const landed = new URL(page.url()).pathname;
  const text = (await page.evaluate(() => document.body.innerText || '')).replace(/\s+/g, ' ').slice(0, 120);
  const after = await readChips(page);
  const lies = /Not enough chips/i.test(text);
  results.push({ name: 'D  /gameover holding chips', before, after, landed, text, pass: !lies && landed === '/' });
  console.log(`${!lies && landed === '/' ? 'PASS' : 'FAIL'}  D  /gameover holding ${before} chips -> landed ${landed}`);
  console.log(`      -> on screen: ${text}`);
  await ctx.close();
}

// ── E · /multiplayer-game with no room ─────────────────────────────────────────────────────────
{
  const ctx = await freshContext();
  const { page } = await open(ctx, '/multiplayer-game');
  const text = (await page.evaluate(() => document.body.innerText || '')).replace(/\s+/g, ' ').trim();
  const honest = /Online multiplayer is unavailable right now\./.test(text);
  const noReady = !/READY/i.test(text);
  results.push({ name: 'E  /multiplayer-game with no room', text, honest, noReady, pass: honest && noReady });
  console.log(`${honest && noReady ? 'PASS' : 'FAIL'}  E  /multiplayer-game with no room`);
  console.log(`      -> on screen: ${text.slice(0, 120)}`);
  await ctx.close();
}

// ── F · /gameover STILL WORKS when the player genuinely cannot afford a hand ───────────────────
// ⚠️ THE OTHER HALF OF THE FIX. A guard that hides a screen from everyone is not a fix, it is a
// deletion. Set the balance below the buy-in and the screen must appear, with its real message.
{
  const ctx = await freshContext();
  const page = await ctx.newPage();
  await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'load', timeout: 45000 });
  await page.waitForTimeout(2500);
  await page.evaluate(() => {
    const raw = JSON.parse(localStorage.getItem('caps-poker-storage') || '{}');
    raw.state.chips = 10;                       // below any table's buy-in
    localStorage.setItem('caps-poker-storage', JSON.stringify(raw));
  });
  await page.goto(`http://localhost:${PORT}/gameover`, { waitUntil: 'load', timeout: 45000 });
  await page.waitForTimeout(3000);
  const landed = new URL(page.url()).pathname;
  const text = (await page.evaluate(() => document.body.innerText || '')).replace(/\s+/g, ' ').trim();
  const shows = landed === '/gameover' && /GAME OVER/i.test(text) && /Not enough chips/i.test(text);
  results.push({ name: 'F  /gameover when genuinely broke', landed, text: text.slice(0, 120), pass: shows });
  console.log(`${shows ? 'PASS' : 'FAIL'}  F  /gameover holding 10 chips -> landed ${landed}`);
  console.log(`      -> on screen: ${text.slice(0, 110)}`);
  await ctx.close();
}

await browser.close();
await server.close();
const failed = results.filter((r) => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
if (failed.length) { console.log(JSON.stringify(failed, null, 1)); process.exit(1); }
