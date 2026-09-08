/**
 * IS THERE A CLOCK ON THE SOLO ARRANGEMENT PHASE AT ALL?
 *
 * TIMER-NOT-LAYOUT 2026-09-08. Roye chose "more time where it scrolls" because the problem is
 * scrolling UNDER A CLOCK. Before shipping more seconds, this asks whether the seconds exist.
 *
 * Reading the code first: startCountdown has exactly ONE call site (app/game.tsx:1275) and it sits
 * INSIDE the player's READY handler, after setPlayerReady(true). The bot-ready handler says in its
 * own words (app/game.tsx:713) "Solo: bots never start countdown — player has free thinking time".
 * And the timeout branch is gated on `!playerReady`, which cannot hold once the player has pressed
 * READY. So on paper the solo clock never runs and its timeout is unreachable.
 *
 * A claim is not evidence, so this WATCHES IT: sit on the placement screen well past the 30s base
 * clock without committing, and record whether any countdown is ever painted and whether the hand
 * auto-resolves. If a clock exists, one of those two must happen.
 */
import { chromium } from 'playwright';
import fs from 'fs';

const URL = process.env.CAPS_URL || 'http://127.0.0.1:8899';
const GAME = process.env.CAPS_GAME_PATH || '/game/';
const SEED = { caps_tutorial_seen: 'true', caps_onboarding_done: 'true',
  has_seen_interactive_tutorial: 'true', caps_games_played: '99' };
const WATCH_MS = 46000;   // well past the 30s base clock and past 33s/44s, under the 70s worst case

const b = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {});
const ctx = await b.newContext({ viewport: { width: 320, height: 568 }, deviceScaleFactor: 2 });
await ctx.addInitScript((s) => { for (const [k, v] of Object.entries(s)) localStorage.setItem(k, v); }, SEED);
await ctx.route(/supabase\.co|ftable\.co\.il|google/, (r) => r.abort());
const p = await ctx.newPage();
await p.goto(`${URL}${GAME}?practice=true&players=2`, { waitUntil: 'load', timeout: 60000 });
await p.waitForTimeout(6000);

const start = Date.now();
let sawCountdown = false, leftScreen = false, samples = 0;
while (Date.now() - start < WATCH_MS) {
  const s = await p.evaluate(() => {
    const txt = document.body.innerText || '';
    const nums = [];
    for (const el of document.querySelectorAll('*')) {
      if (el.children.length) continue;
      const t = (el.textContent || '').trim();
      if (/^\d{1,3}$/.test(t)) { const n = +t; if (n >= 1 && n <= 200) nums.push(n); }
    }
    return { placing: /PLACE \d+ CARDS|ALL CARDS PLACED/i.test(txt), nums, path: location.pathname + location.search };
  }).catch(() => null);
  if (!s) break;
  samples++;
  if (!s.placing) { leftScreen = true; break; }
  // a live clock ticks: the same number would have to fall each second. Look for the pill's range.
  if (s.nums.some((n) => n >= 25 && n <= 80)) sawCountdown = true;
  await p.waitForTimeout(1500);
}
const elapsed = Math.round((Date.now() - start) / 1000);
await p.screenshot({ path: 'docs/timer-not-layout/solo-no-clock-after-46s.png' });
await b.close();

const verdict = { watchedSeconds: elapsed, samples, sawCountdown, autoResolved: leftScreen,
  conclusion: (!sawCountdown && !leftScreen)
    ? 'NO CLOCK on the solo arrangement phase — nothing counted down and the hand did not resolve itself'
    : 'a clock or auto-resolve WAS observed' };
fs.mkdirSync('docs/timer-not-layout', { recursive: true });
fs.writeFileSync('docs/timer-not-layout/solo-clock-reachability.json', JSON.stringify(verdict, null, 2));
console.log(JSON.stringify(verdict, null, 2));
