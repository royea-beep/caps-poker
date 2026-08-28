/**
 * PROVE THE NUMBERS ADD UP — on a real hand, not on a fixture.
 *
 * Seed 4 at two players deals a four-board hand that ends 2 boards to the player, 1 to the bot and
 * ONE TIED. Before this change the scoreboard rendered "2 — 1" and the fourth board was nowhere:
 * two plus one is three. That is the shape a player hit and could not read.
 *
 * This drives the real export through the app's own controls to /results and then READS THE
 * PAINTED SCREEN — the numerals, the tally line, and the per-board rows — and asserts
 * won + tied + lost === the board count. It does not ask the store; a store that agrees with
 * itself is exactly the evidence that would not have caught this.
 *
 *   CAPS_ENGINE=chromium node tools/verify-tally.mjs
 *   CAPS_ENGINE=webkit   node tools/verify-tally.mjs
 */
import fs from 'node:fs';
import { serve, launch, openGame, autoPlaceAll, pressReady, tapThroughReveal } from './content-lib.mjs';

const PORT = Number(process.env.PORT || 8993);
const DIST = process.env.DIST || 'web-tie-dist';
const SEED = Number(process.env.SEED || 4);
const OUT = process.env.OUT || `/tmp/tally-${process.env.CAPS_ENGINE || 'chromium'}.png`;

const server = await serve(DIST, PORT);
const browser = await launch();
const { page } = await openGame(browser, { port: PORT, players: 2, seed: SEED, settle: 6500 });
await autoPlaceAll(page);
await pressReady(page);
await tapThroughReveal(page);
await page.waitForTimeout(2500);

const read = await page.evaluate(() => {
  const txt = (sel) => document.querySelector(sel)?.textContent?.trim() ?? null;
  const body = document.body.innerText;
  // The per-board rows carry the app's own verdict per board — an independent count to check the
  // headline tally against, rather than trusting one number twice.
  const rows = [...body.matchAll(/Board\s*\d+\s*[✓✗=]/g)].map((m) => m[0].slice(-1));
  return {
    url: location.pathname,
    headline: txt('[data-testid="result-headline"]') ?? (body.match(/YOU WIN|YOU LOSE|TIE GAME|PERFECT!/) || [null])[0],
    numerals: txt('[data-testid="score-numerals"]'),
    tally: txt('[data-testid="board-tally"]'),
    boardsStat: (body.match(/Boards:\s*[^\n]+/) || [null])[0],
    perBoardIcons: rows,
    text: body.slice(0, 260),
  };
});

await page.screenshot({ path: OUT, fullPage: true });
await browser.close(); server.close();

const engine = process.env.CAPS_ENGINE || 'chromium';
console.log(`\n  engine ${engine}  seed ${SEED}`);
console.log(`  url         ${read.url}`);
console.log(`  headline    ${read.headline}`);
console.log(`  numerals    ${JSON.stringify(read.numerals)}`);
console.log(`  tally line  ${JSON.stringify(read.tally)}`);
console.log(`  boards stat ${JSON.stringify(read.boardsStat)}`);
console.log(`  per-board   ${JSON.stringify(read.perBoardIcons)}  (✓ won, = tied, ✗ lost)`);
console.log(`  screenshot  ${OUT}`);

const fail = (m) => { console.error(`\n  FAIL: ${m}\n`); process.exit(1); };
if (!/results/.test(read.url)) fail(`never reached /results (at ${read.url})`);
const m = (read.tally || '').match(/(\d+)\s*WON.*?(\d+)\s*TIED.*?(\d+)\s*LOST/i);
if (!m) fail(`no tally line rendered — this hand was supposed to contain a tied board. Got ${JSON.stringify(read.tally)}`);
const [won, tied, lost] = m.slice(1).map(Number);
const total = read.perBoardIcons.length;
console.log(`\n  won ${won} + tied ${tied} + lost ${lost} = ${won + tied + lost}   board count ${total}`);
if (tied < 1) fail('no tied board in this hand — pick a seed that produces one');
if (won + tied + lost !== total) fail(`the numbers do not add up to the board count (${won}+${tied}+${lost} != ${total})`);
const iconTied = read.perBoardIcons.filter((c) => c === '=').length;
if (iconTied !== tied) fail(`headline says ${tied} tied but the per-board rows show ${iconTied}`);
console.log(`\n  PASS — every board accounted for, and the headline agrees with the per-board rows.\n`);
