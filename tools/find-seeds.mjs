/**
 * FIND THE SEEDS THAT PRODUCE THE MOMENTS.
 *
 * Two of the five gameplay clips are "a win with the gold border landing" and "a tie". Neither is
 * something to hope for on the take: practice deals from Math.random, which the rig pins, so a
 * seed is a REPRODUCIBLE HAND. This walks seeds, plays each one out, and records what the app
 * itself says the result was — so the capture run later can name a seed and get that hand every
 * time rather than re-rolling until something photogenic happens.
 *
 * skipBoardReveal is on here and only here: it takes /game straight to /results, which turns a
 * ~40s play-through into a ~15s one. The capture run leaves it OFF, because the reveal IS one of
 * the clips.
 *
 * The outcome is read from /results in the app's own words, not computed from a re-implementation
 * of the hand evaluator — a second implementation would be a second thing that can be wrong.
 *
 *   node tools/find-seeds.mjs            # default sweep
 *   SEEDS=1..40 PLAYERS=2 node tools/find-seeds.mjs
 */
import fs from 'node:fs';
import { serve, launch, openGame, autoPlaceAll, pressReady, readOutcome } from './content-lib.mjs';

const DIST = process.env.DIST || 'web-slot-dist';
const PORT = Number(process.env.PORT || 8991);
const PLAYERS = Number(process.env.PLAYERS || 2);
const RANGE = (process.env.SEEDS || '1..24').split('..').map(Number);
const OUT = process.env.OUT || 'tools/seeds.json';

const server = await serve(DIST, PORT);
const browser = await launch();
const rows = [];

for (let seed = RANGE[0]; seed <= RANGE[1]; seed++) {
  const { ctx, page, errs } = await openGame(browser, { port: PORT, players: PLAYERS, seed, skipReveal: true, settle: 5000 });
  let row = { seed, players: PLAYERS, ok: false };
  try {
    const placed = await autoPlaceAll(page);
    const ready = placed ? await pressReady(page, { after: 5000 }) : false;
    // give the app a moment to land on /results
    for (let i = 0; i < 8 && !/results/.test(page.url()); i++) await page.waitForTimeout(1200);
    const o = await readOutcome(page);
    // THE SCOREBOARD IS READ, NOT DERIVED. boardsTotal - boardsWon is NOT the opponent's score:
    // an individual board can tie, so seed 4 is 2-1 with one board tied and the app says YOU WIN.
    row = { seed, players: PLAYERS, ok: /results/.test(o.url), placed, ready,
            headline: o.headline, mine: o.mine, theirs: o.theirs,
            boardsWon: o.boardsWon, boardsTotal: o.boardsTotal, swept: o.swept, errs: errs.length };
    row.result = o.result;
    if (o.mine !== null && o.boardsTotal !== null && o.mine === o.boardsTotal) row.result = 'SWEEP';
  } catch (e) {
    row.error = String(e).slice(0, 120);
  }
  rows.push(row);
  console.log(`  seed ${String(seed).padStart(3)}  ${(row.result ?? '—').padEnd(5)} ` +
    `score ${row.mine ?? '?'}-${row.theirs ?? '?'}  app says "${row.headline ?? '?'}"  ` +
    `${row.ok ? '' : '(never reached /results)'}`);
  await ctx.close();
}
await browser.close(); server.close();

const by = (r) => rows.filter((x) => x.result === r).map((x) => x.seed);
const summary = { players: PLAYERS, dist: DIST, WIN: by('WIN'), SWEEP: by('SWEEP'), TIE: by('TIE'), LOSS: by('LOSS'), rows };
fs.writeFileSync(OUT, JSON.stringify(summary, null, 2));
console.log(`\n  WIN   ${summary.WIN.join(', ') || '(none in range)'}`);
console.log(`  SWEEP ${summary.SWEEP.join(', ') || '(none in range)'}`);
console.log(`  TIE   ${summary.TIE.join(', ') || '(none in range)'}`);
console.log(`  LOSS  ${summary.LOSS.length} seeds`);
console.log(`\nwrote ${OUT}\n`);
