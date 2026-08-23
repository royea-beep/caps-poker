/**
 * ELO ON A TIE — proven from the wire, not from the source.
 *
 * MP ties are random and three runs in a row came up 3-0 / 2-0 / 3-0. So this plays SOLO
 * non-practice hands (practice deliberately never touches ELO) and intercepts the actual
 * update_leaderboard_elo request, recording the body alongside the headline the screen shows.
 *
 * The claim being tested has two halves and both must hold in the SAME hand:
 *   the screen says TIE GAME, and the request carries p_won: null.
 * NULL is what the DB now reads as a tie: delta 0, no win credited, games_played still +1.
 */
import { webkit } from 'playwright';
import { installFire, where } from './harness/play.mjs';

const SITE = process.env.CAPS_URL || 'https://caps.ftable.co.il';
const MAX_HANDS = Number(process.env.HANDS || 12);

const b = await webkit.launch({ headless: false });
const ctx = await b.newContext({ viewport: { width: 393, height: 900 } });
const page = await ctx.newPage();
page.on('dialog', async (d) => { await d.dismiss(); });

const calls = [];
page.on('request', (r) => {
  if (!r.url().includes('update_leaderboard_elo')) return;
  let body = null;
  try { body = r.postData(); } catch {}
  calls.push(body);
});

let sawTie = false;
for (let hand = 1; hand <= MAX_HANDS && !sawTie; hand++) {
  const before = calls.length;
  await page.goto(`${SITE}/game?players=2&fresh=${hand}`, { waitUntil: 'domcontentloaded' });
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

  const headline = await page.evaluate(() => {
    const el = document.querySelector('[data-testid="result-headline"]');
    const score = document.querySelector('[data-testid="score-numerals"]');
    return { headline: el?.textContent?.trim() ?? '?', score: score?.textContent?.replace(/\s+/g, ' ').trim() ?? '?',
             elo: (document.body.innerText.match(/[▲▼]\s*\d+\s*ELO/) || ['(none)'])[0] };
  });
  const body = calls.slice(before).pop() ?? '(no elo call)';
  console.log(`  hand ${String(hand).padStart(2)}  ${headline.headline.padEnd(10)} ${headline.score.padEnd(9)} elo-badge=${headline.elo.padEnd(9)} request=${body}`);
  if (/TIE/i.test(headline.headline)) {
    sawTie = true;
    console.log(`\n  >>> TIE REACHED. screen="${headline.headline} ${headline.score}"  badge=${headline.elo}  body=${body}`);
  }
}
if (!sawTie) console.log(`\n  no tie in ${MAX_HANDS} hands — NOT PROVEN this way`);
console.log(`  device: ${await page.evaluate(`localStorage.getItem('caps-device-id')`)}`);
await b.close();
