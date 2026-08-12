/**
 * Does the dealt board count obey the rule? 2 players = 4 boards, 3 = 3, 4 = 2.
 *
 * Prompted by a report that `players=3` dealt 4 boards on the non-practice route. The suspicion
 * to test is not "is the game broken" but "was the game ever a 3-player game" — game.tsx:122
 * parses the `players` parameter ONLY when isPractice is true, so a non-practice URL carrying
 * players=3 falls through to config.numberOfPlayers (default 2), and 4 boards is then correct.
 *
 * Counts the rendered "BOARD n" labels, so it measures what was actually dealt rather than what
 * the URL asked for.
 *
 *   node tests/board-count-rule.mjs
 */
import { chromium } from 'playwright';
import { measure, HarnessError } from './probe-kit.mjs';

const URL = process.env.CAPS_URL || 'https://caps.ftable.co.il';
const SEED = { caps_tutorial_seen: 'true', caps_onboarding_done: 'true',
  has_seen_interactive_tutorial: 'true', caps_games_played: '99' };

// The rule, re-derived here rather than copied from a brief — it has been stated inverted before.
const expected = (players) => (players === 3 ? 3 : players === 4 ? 2 : 4);

const countBoards = `(() => {
  const txt = document.body.innerText || '';
  const labels = [...new Set((txt.match(/BOARD\\s+\\d+/gi) || []).map((s) => s.toUpperCase().replace(/\\s+/g, ' ')))];
  let stored = null;
  try { stored = JSON.parse(localStorage.getItem('caps-poker-storage')).state.config.numberOfPlayers; } catch {}
  return { boards: labels.length, labels: labels.slice(0, 6), storedPlayers: stored,
           url: location.pathname + location.search };
})()`;

const CASES = [
  { label: 'practice players=2',     path: '/game?practice=true&players=2', players: 2 },
  { label: 'practice players=3',     path: '/game?practice=true&players=3', players: 3 },
  { label: 'practice players=4',     path: '/game?practice=true&players=4', players: 4 },
  // The reported case. `players` is practice-only, so this should deal by the STORED config.
  { label: 'NON-practice players=3', path: '/game?players=3',               players: null },
];

const browser = await chromium.launch({ headless: false });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
await ctx.addInitScript((s) => { for (const [k, v] of Object.entries(s)) { try { localStorage.setItem(k, v); } catch {} } }, SEED);
const page = await ctx.newPage();

const rows = [];
for (const c of CASES) {
  await page.goto(URL + c.path, { waitUntil: 'load', timeout: 120000 });
  await page.waitForTimeout(9000);
  let r;
  try { r = await measure(page, countBoards, { label: c.label }); }
  catch (e) { console.log(`${c.label.padEnd(22)} HARNESS ${e instanceof HarnessError ? 'not mounted' : String(e).slice(0, 40)}`); continue; }
  // For the non-practice case the governing count is the STORED config, not the URL.
  const governing = c.players ?? r.storedPlayers;
  const want = expected(governing);
  const ok = r.boards === want;
  rows.push({ ...c, governing, want, got: r.boards, ok });
  console.log(`${c.label.padEnd(22)} governing players ${governing} -> expect ${want} boards | dealt ${r.boards} | ${ok ? 'OK' : 'MISMATCH'}   ${JSON.stringify(r.labels)}`);
}
await browser.close();

console.log('\n=== verdict ===');
const bad = rows.filter((r) => !r.ok);
if (!rows.length) { console.error('NO CASES MEASURED — failed run, not a clean one.'); process.exit(2); }
console.log(bad.length
  ? `  RULE VIOLATED in ${bad.length} case(s): ${JSON.stringify(bad.map((b) => b.label))}`
  : '  Every case obeys 2=4 / 3=3 / 4=2, including the reported non-practice one.');
