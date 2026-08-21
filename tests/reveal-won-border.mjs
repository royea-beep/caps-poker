/**
 * THE MEASUREMENT OWED THREE TIMES — the 3px #FFD700 WON border, captured live, with a non-winner
 * in the SAME FRAME as the control.
 *
 * The colour matters and is the reason two earlier attempts found nothing: the cue was changed FROM
 * #c9a84c TO #FFD700 on 2026-08-16 (VAMOS-ONE-GOLD, Card.tsx:469). Scans hunting rgb(201,168,76)
 * were looking for a colour that no longer exists.
 *
 *   ENGINE=webkit VIEWPORT=430 PLAYERS=4 node tests/reveal-won-border.mjs
 */
import { webkit, chromium } from 'playwright';
import { playHandToResults, where } from './harness/play.mjs';

const URL = process.env.CAPS_URL || 'https://caps.ftable.co.il';
const VW = Number(process.env.VIEWPORT || 430);
const ENGINE = process.env.ENGINE || 'webkit';
const PLAYERS = Number(process.env.PLAYERS || 4);          // 4P = 2 boards = the shortest hand
const engine = ENGINE === 'chromium' ? chromium : webkit;

const SEED = { caps_tutorial_seen: 'true', caps_onboarding_done: 'true',
  has_seen_interactive_tutorial: 'true', caps_games_played: '99' };

// Every card-sized bordered element, grouped by colour+width. One call = one frame = same-frame
// control by construction: the winner and its neighbours are in the same returned object.
const SCAN = `(() => {
  const groups = {};
  for (const el of document.querySelectorAll('div')) {
    const cs = getComputedStyle(el);
    const w = parseFloat(cs.borderTopWidth) || 0;
    if (w <= 0) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 20 || r.width > 140 || r.height < 25) continue;
    const k = cs.borderTopColor + ' @ ' + w.toFixed(1) + 'px';
    groups[k] = (groups[k] || 0) + 1;
  }
  return groups;
})()`;

const browser = await engine.launch({ headless: false });
const ctx = await browser.newContext({ viewport: { width: VW, height: 900 } });
await ctx.addInitScript((s) => { for (const [k, v] of Object.entries(s)) { try { localStorage.setItem(k, v); } catch {} } }, SEED);
const page = await ctx.newPage();

await page.goto(URL + '/', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(7000);
await page.evaluate((n) => {
  const k = 'caps-poker-storage';
  try { const s = JSON.parse(localStorage.getItem(k));
    s.state.config = { ...(s.state.config || {}), numberOfPlayers: n };
    s.state.skipBoardReveal = false;                       // the reveal is the whole point
    localStorage.setItem(k, JSON.stringify(s)); } catch {}
}, PLAYERS);

await page.goto(`${URL}/game?practice=true`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(11000);
console.log(`[${ENGINE}/${VW}] dealt:`, JSON.stringify(await where(page)));

let best = null;              // the richest frame that contained the gold border
const frames = [];
const res = await playHandToResults(page, {
  onFrame: async (p, w) => {
    const g = await p.evaluate(SCAN);
    const keys = Object.keys(g);
    const gold = keys.filter((k) => /255, 215, 0/.test(k));
    if (gold.length) {
      const shot = { path: w.path, gold, controls: keys.filter((k) => !/255, 215, 0/.test(k)), all: g };
      frames.push(shot);
      if (!best) { best = shot; await p.screenshot({ path: `tests/screenshots/won-border-${ENGINE}-${VW}.png` }); }
    }
  },
});

console.log(`[${ENGINE}/${VW}] reachedResults=${res.reachedResults} sawReveal=${res.sawReveal}`);
for (const l of res.log) console.log('   stage:', JSON.stringify(l));

if (best) {
  console.log(`\n[${ENGINE}/${VW}] WON BORDER CAPTURED — same frame, path ${best.path}`);
  for (const g of best.gold) console.log('   WINNER :', g, 'x' + best.all[g]);
  if (best.controls.length) for (const c of best.controls) console.log('   control:', c, 'x' + best.all[c]);
  else console.log('   control: (none in frame)');
  console.log(`   frames containing gold: ${frames.length}`);
} else {
  console.log(`\n[${ENGINE}/${VW}] WON BORDER NOT CAPTURED`);
}
await browser.close();
