/**
 * THE ARRANGEMENT CLOCK, READ OFF THE RUNNING APP — longer only where the boards actually scroll.
 *
 * TIMER-NOT-LAYOUT 2026-09-08, Roye's option 3. The clock is derived in
 * constants/gameConfig.ts::getArrangeSeconds from useGameLayout's own boardsScroll +
 * boardsContentH/boardsAvailH — the SAME numbers that already decide whether the zone scrolls.
 * This reads what the SCREEN shows, so the derivation is checked against the product rather than
 * against itself.
 *
 * EXPECTED, from the measured cells (both engines agreed to 1px):
 *     320 2P  content 477 / avail 206  -> ceil(30 * 2.316) = 70s
 *     320 3P  content 367 / avail 254  -> ceil(30 * 1.445) = 44s
 *     393 2P  content 556 / avail 512  -> ceil(30 * 1.086) = 33s
 *     320 4P · 393 3P · 393 4P                                30s  (base, unchanged)
 *
 * CANARY: the run fails unless at least one cell shows base AND at least one shows more. A clock
 * that is uniformly long, or uniformly 30, would satisfy a naive "is there a number" check while
 * proving nothing.
 *
 *   CAPS_URL=http://127.0.0.1:8899 CAPS_GAME_PATH=/game/ CHROME_PATH=/opt/pw-browsers/chromium \
 *     node tests/arrange-clock-probe.mjs
 */
import { chromium, webkit } from 'playwright';
import fs from 'fs';

const URL = process.env.CAPS_URL || 'http://127.0.0.1:8899';
const GAME = process.env.CAPS_GAME_PATH || '/game/';
const SEED = { caps_tutorial_seen: 'true', caps_onboarding_done: 'true',
  has_seen_interactive_tutorial: 'true', caps_games_played: '99' };
const BASE = 30;
const EXPECT = { '320-2P': 70, '320-3P': 44, '393-2P': 33, '320-4P': BASE, '393-3P': BASE, '393-4P': BASE };

// The countdown pill renders a bare integer. Take the LARGEST plausible clock value on screen —
// the first tick after it starts — ignoring chip counts and card ranks by bounding the range.
const READ_CLOCK = `(() => {
  const nums = [];
  for (const el of document.querySelectorAll('*')) {
    if (el.children.length) continue;
    const t = (el.textContent || '').trim();
    if (!/^\\d{1,3}$/.test(t)) continue;
    const n = parseInt(t, 10);
    if (n >= 20 && n <= 200) nums.push(n);
  }
  return nums;
})()`;

async function run(engine, name, w, h, players) {
  const b = await engine.launch(process.env.CHROME_PATH && name === 'chromium' ? { executablePath: process.env.CHROME_PATH } : {});
  const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2 });
  await ctx.addInitScript((s) => { for (const [k, v] of Object.entries(s)) localStorage.setItem(k, v); }, SEED);
  await ctx.route(/supabase\.co|ftable\.co\.il|google/, (r) => r.abort());
  const p = await ctx.newPage();
  await p.goto(`${URL}${GAME}?practice=true&players=${players}`, { waitUntil: 'load', timeout: 60000 });
  await p.waitForTimeout(6500);

  // Commit fast, before the bots finish, so the clock is on screen rather than skipped.
  await p.locator('text=/Auto-Place ALL/i').first().click({ timeout: 10000 }).catch(() => {});
  await p.waitForTimeout(700);
  await p.locator('text=/^Confirm$/i').first().click({ timeout: 10000 }).catch(() => {});

  // Poll for the first second the clock is painted; keep the max seen.
  let seen = 0;
  for (let i = 0; i < 24; i++) {
    const nums = await p.evaluate(READ_CLOCK).catch(() => []);
    for (const n of nums) if (n > seen) seen = n;
    if (seen) break;
    await p.waitForTimeout(250);
  }
  await p.screenshot({ path: `docs/timer-not-layout/clock-${name}-${w}-${players}p.png` });
  await b.close();
  return seen;
}

fs.mkdirSync('docs/timer-not-layout', { recursive: true });
const out = {};
for (const [name, engine] of [['chromium', chromium], ['webkit', webkit]]) {
  for (const [w, h] of [[320, 568], [393, 852]]) {
    for (const players of [2, 3, 4]) {
      const key = `${w}-${players}P`;
      const got = await run(engine, name, w, h, players);
      out[`${name}-${key}`] = { seen: got, expected: EXPECT[key] };
    }
  }
}
fs.writeFileSync('docs/timer-not-layout/arrange-clock.json', JSON.stringify(out, null, 2));

const vals = Object.values(out).map((v) => v.seen).filter(Boolean);
if (!vals.length) { console.error('CANARY: no clock was read in ANY cell — the probe cannot answer.'); process.exit(3); }
if (!vals.some((v) => v === BASE)) { console.error('CANARY: no cell showed the BASE clock — a uniformly long timer proves nothing.'); process.exit(3); }
if (!vals.some((v) => v > BASE)) { console.error('CANARY: no cell showed MORE than base — the change is not live.'); process.exit(3); }

let bad = [];
for (const [k, v] of Object.entries(out)) {
  const ok = v.seen === v.expected;
  if (!ok) bad.push(`${k}: expected ${v.expected}s, screen showed ${v.seen || 'nothing'}`);
  console.log(k.padEnd(20), 'clock=' + String(v.seen).padStart(3) + 's', 'expected=' + String(v.expected).padStart(3) + 's', ok ? 'OK' : '<-- MISMATCH');
}
if (bad.length) { console.error('\nFAIL:\n' + bad.join('\n')); process.exit(1); }
console.log('\nOK — longer in exactly the three overflowing cells, base in the three that fit, both engines.');
