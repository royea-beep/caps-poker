/**
 * ONE-WIN-COUNTER — proven by playing real hands, then reading both counters.
 *
 * The claim: leaderboard.games_played / wins are now a PROJECTION of hand_history, so after any
 * number of hands they agree exactly, with the only gap being the deliberately-excluded practice
 * hands. And a tie must be countable as neither.
 *
 * Plays solo NON-PRACTICE hands (practice is excluded by design), records the headline each time,
 * and prints the device id so the DB side can be read back. Also plays one PRACTICE hand at the
 * end, which must move hand_history and NOT the leaderboard.
 */
import { webkit } from 'playwright';
import { installFire, where } from './harness/play.mjs';

const SITE = process.env.CAPS_URL || 'https://caps.ftable.co.il';
const HANDS = Number(process.env.HANDS || 6);

const b = await webkit.launch({ headless: false });
const ctx = await b.newContext({ viewport: { width: 393, height: 900 } });
const page = await ctx.newPage();
page.on('dialog', async (d) => { await d.dismiss(); });

const playHand = async (practice, seed) => {
  const url = practice
    ? `${SITE}/game?practice=true&players=2&fresh=${seed}`
    : `${SITE}/game?players=2&fresh=${seed}`;
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(11000);
  await installFire(page);
  await page.evaluate(`(()=>{const x=[...document.querySelectorAll('button,[role="button"]')]
    .find(e=>/auto-place all/i.test((e.getAttribute('aria-label')||'')+' '+(e.textContent||''))); if(x) window.__f(x);})()`);
  await page.waitForTimeout(2600);
  await installFire(page);
  await page.evaluate(`(()=>{const r=document.querySelector('[data-testid="ready-button"]'); if(r) window.__f(r);})()`);
  for (let i = 0; i < 55; i++) {
    await page.waitForTimeout(1000);
    let w; try { w = await where(page); } catch { break; }
    if (w.path === '/results') break;
  }
  await page.waitForTimeout(6500);
  return page.evaluate(() => ({
    headline: document.querySelector('[data-testid="result-headline"]')?.textContent?.trim() ?? '?',
    score: document.querySelector('[data-testid="score-numerals"]')?.textContent?.replace(/\s+/g, ' ').trim() ?? '?',
    elo: (document.body.innerText.match(/[▲▼]\s*\d+\s*ELO/) || ['(none)'])[0],
  }));
};

const tally = { win: 0, loss: 0, tie: 0 };
for (let i = 1; i <= HANDS; i++) {
  const r = await playHand(false, i);
  const kind = /TIE/i.test(r.headline) ? 'tie' : /WIN|PERFECT/i.test(r.headline) ? 'win' : 'loss';
  tally[kind]++;
  console.log(`  hand ${String(i).padStart(2)}  ${r.headline.padEnd(10)} ${r.score.padEnd(9)} elo=${r.elo}`);
}
const p = await playHand(true, 99);
console.log(`  PRACTICE   ${p.headline.padEnd(10)} ${p.score.padEnd(9)} elo=${p.elo}   <- must NOT move the ladder`);

console.log(`\n  non-practice played: ${HANDS}  (win ${tally.win} / loss ${tally.loss} / tie ${tally.tie})`);
console.log(`  practice played    : 1`);
console.log(`  DEVICE: ${await page.evaluate(`localStorage.getItem('caps-device-id')`)}`);
await b.close();
