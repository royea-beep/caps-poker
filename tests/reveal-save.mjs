/**
 * REVEAL-SAVE — a player who leaves mid-reveal keeps the hand, and nothing is counted twice.
 *
 * Four cases, each on its OWN fresh device so the row count is unambiguous:
 *
 *   1 NORMAL           play through to /results          -> expect 1 row, 1 client_hand_id
 *   2 LEFT MID-REVEAL  leave the instant the reveal runs -> expect 1 row (was 0 before the fix)
 *   3 LEFT + RELAUNCH  same, then reload the app         -> expect 1 row, NOT 2
 *   4 LEFT IN PLACEMENT leave before pressing Ready      -> expect 0 rows, and that is correct:
 *                                                          no outcome was ever reached
 *
 * Case 3 is the one that matters most. The hand is queued at the reveal AND again at /results, and
 * the app-start flush re-sends anything pending — three chances to write. They all carry the same
 * client_hand_id, so uq_hand_history_client_ref collapses them to one row.
 *
 * Rows and achievement counts are asserted in SQL against the device ids this prints; the client is
 * not trusted to report on its own persistence.
 *
 *   ENGINE=webkit node tests/reveal-save.mjs
 */
import { webkit, chromium } from 'playwright';
import { installFire, readyIsArmed, where } from './harness/play.mjs';

const SITE = process.env.CAPS_URL || 'https://caps.ftable.co.il';
const ENGINE = process.env.ENGINE || 'webkit';
const VW = Number(process.env.VIEWPORT || 430);
const engine = ENGINE === 'chromium' ? chromium : webkit;

const browser = await engine.launch({ headless: false });
const out = {};

const fresh = async () => {
  const ctx = await browser.newContext({ viewport: { width: VW, height: 900 } });
  const p = await ctx.newPage();
  p.on('dialog', async (d) => { await d.dismiss(); });
  p.__errs = []; p.on('pageerror', (e) => p.__errs.push(String(e).slice(0, 70)));
  await p.goto(`${SITE}/game?practice=true&players=3&fresh=1`, { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(11000);
  return p;
};
const dev = (p) => p.evaluate(`localStorage.getItem('caps-device-id')`);

/** Place every board and press Ready. */
const placeAndReady = async (p) => {
  await installFire(p);
  await p.evaluate(`(()=>{const b=[...document.querySelectorAll('button,[role="button"]')]
    .find(x=>/auto-place all/i.test((x.getAttribute('aria-label')||'')+' '+(x.textContent||''))); if(b) window.__f(b);})()`);
  for (let i = 0; i < 20; i++) { if (await readyIsArmed(p)) break; await p.waitForTimeout(500); }
  await installFire(p);
  await p.evaluate(`(()=>{const r=document.querySelector('[data-testid="ready-button"]'); if(r) window.__f(r);})()`);
};

const leaveGame = (p) => p.evaluate(`(()=>{const b=[...document.querySelectorAll('button,[role="button"]')]
  .find(x=>/leave game/i.test((x.getAttribute('aria-label')||'')+' '+(x.textContent||'')));
  if(!b) return false; window.__f(b); return true;})()`);

// ── 1 NORMAL ──────────────────────────────────────────────────────────────────
{
  const p = await fresh();
  out.normal = await dev(p);
  await placeAndReady(p);
  for (let i = 0; i < 45; i++) { await p.waitForTimeout(1200); if ((await where(p)).path === '/results') break; }
  await p.waitForTimeout(9000);
  console.log(`1 NORMAL            device=${out.normal} landed=${(await where(p)).path}`);
  await p.context().close();
}

// ── 2 LEFT MID-REVEAL ─────────────────────────────────────────────────────────
{
  const p = await fresh();
  out.leftReveal = await dev(p);
  await placeAndReady(p);
  let inReveal = false;
  for (let i = 0; i < 30 && !inReveal; i++) { await p.waitForTimeout(800); inReveal = (await where(p)).inReveal; }
  await installFire(p);
  const tapped = await leaveGame(p);
  await p.waitForTimeout(8000);
  console.log(`2 LEFT MID-REVEAL   device=${out.leftReveal} reachedReveal=${inReveal} leftTapped=${tapped} landed=${(await where(p)).path}`);
  await p.context().close();
}

// ── 3 LEFT MID-REVEAL, THEN RELAUNCH ──────────────────────────────────────────
{
  const p = await fresh();
  out.leftRelaunch = await dev(p);
  await placeAndReady(p);
  let inReveal = false;
  for (let i = 0; i < 30 && !inReveal; i++) { await p.waitForTimeout(800); inReveal = (await where(p)).inReveal; }
  await installFire(p);
  await leaveGame(p);
  await p.waitForTimeout(4000);
  await p.goto(SITE + '/', { waitUntil: 'domcontentloaded' });   // relaunch -> app-start flush
  await p.waitForTimeout(12000);
  const pending = await p.evaluate(`(()=>{try{return (JSON.parse(localStorage.getItem('caps_hand_outbox')||'[]')).length;}catch{return -1;}})()`);
  console.log(`3 LEFT + RELAUNCH   device=${out.leftRelaunch} reachedReveal=${inReveal} stillQueued=${pending}`);
  await p.context().close();
}

// ── 4 LEFT DURING PLACEMENT ───────────────────────────────────────────────────
{
  const p = await fresh();
  out.leftPlacement = await dev(p);
  await installFire(p);
  const tapped = await leaveGame(p);              // never placed, never readied
  await p.waitForTimeout(8000);
  console.log(`4 LEFT IN PLACEMENT device=${out.leftPlacement} leftTapped=${tapped} landed=${(await where(p)).path}`);
  await p.context().close();
}

console.log(`\n══ ${ENGINE}/${VW} — ASSERT IN SQL`);
console.log(JSON.stringify(out, null, 2));
await browser.close();
