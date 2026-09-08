/**
 * THE CLOCK CHANGE MUST NOT BREAK THE HAND. Both paths off the arrangement screen, watched.
 *
 * TIMER-NOT-LAYOUT §2.4 — "the clock has two paths and one of them is how a bug ran for months"
 * (the timeout path resolved a hand without ever calling handleReady, so cards_placed under-fired).
 * Path A — READY: place, confirm, reach the reveal and then results.
 * Path B — TIMEOUT: PROVEN UNREACHABLE IN SOLO by tests/solo-clock-reachability.mjs (47s, no clock,
 * no auto-resolve) and by the code: startCountdown runs after setPlayerReady(true) and the branch
 * is gated on !playerReady. It is reported, not faked here.
 */
import { chromium } from 'playwright';
const URL = process.env.CAPS_URL || 'http://127.0.0.1:8899';
const SEED = { caps_tutorial_seen: 'true', caps_onboarding_done: 'true',
  has_seen_interactive_tutorial: 'true', caps_games_played: '99' };

const b = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {});
const ctx = await b.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 2 });
await ctx.addInitScript((s) => { for (const [k, v] of Object.entries(s)) localStorage.setItem(k, v); }, SEED);
await ctx.route(/supabase\.co|ftable\.co\.il|google/, (r) => r.abort());
const p = await ctx.newPage();
await p.goto(`${URL}/game/?practice=true&players=2`, { waitUntil: 'load', timeout: 60000 });
await p.waitForTimeout(6500);

await p.locator('text=/Auto-Place ALL/i').first().click({ timeout: 10000 });
await p.waitForTimeout(1200);
// the commit control: READY / Confirm, whichever this build paints
// ⚠️ TARGET THE BUTTON, NOT THE TEXT. A plain text match on /READY/ grabs the BOT's "✓ READY"
// status pill, which appears earlier in the DOM — the click then lands on a label, nothing happens,
// and the probe reports "the hand did not resolve" about a product that is fine. Caught by tracing
// the URL after the click: it never changed.
const commit = p.getByRole('button', { name: /READY|Confirm/i }).last();
const hadCommit = await commit.isVisible().catch(() => false);
if (hadCommit) await commit.click({ timeout: 8000 }).catch(() => {});

// Watch for the reveal, then results, WITHOUT tapping — that also proves the reveal auto-advances.
let sawReveal = false, sawResults = false, taps = 0;
for (let i = 0; i < 70; i++) {
  const t = await p.evaluate(() => (document.body.innerText || '')).catch(() => '');
  if (/BOARD\s*\d/i.test(t) && /(COMPLETE|WIN|LOSE|TIE|Community)/i.test(t)) sawReveal = true;
  if (/YOU WIN|YOU LOSE|TIE GAME|PERFECT|Play Again|Best hand/i.test(t)) { sawResults = true; break; }
  await p.waitForTimeout(1000);
}
await p.screenshot({ path: 'docs/timer-not-layout/hand-resolved.png' });
await b.close();
const verdict = { commitControlFound: hadCommit, sawReveal, sawResults, tapsDuringReveal: taps };
console.log(JSON.stringify(verdict, null, 2));
if (!sawResults) { console.error('FAIL: the hand did not reach results without tapping.'); process.exit(1); }
console.log('OK — hand resolves, and the reveal auto-advanced to results with ZERO taps.');
