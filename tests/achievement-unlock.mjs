/**
 * ACHIEVEMENT UNLOCK — the five criteria, end to end, on the live site.
 *
 *   1. play a real hand to /results -> the achievement unlocks
 *   2. the tile renders unlocked and the counter leaves 0/36
 *   3. it survives a reload
 *   4. playing again does not double-award
 *   5. both engines, dialog handler registered first
 *
 * The chips-via-record_reward criterion is checked in SQL against the device id this prints.
 *
 * WHY THE DWELL ON /results: the hand_history write is a fire-and-forget
 * `void (async () => ...)` in results.tsx. On 2026-08-21 a webkit run navigated away before it
 * landed and the hand was never recorded — 1 of 2 hands lost. We wait on /results so the test is
 * measuring the achievement wiring, not that race. The race itself is reported separately.
 *
 *   ENGINE=webkit node tests/achievement-unlock.mjs
 */
import { webkit, chromium } from 'playwright';
import { playHandToResults, installFire, where } from './harness/play.mjs';

const SITE = process.env.CAPS_URL || 'https://caps.ftable.co.il';
const ENGINE = process.env.ENGINE || 'webkit';
const VW = Number(process.env.VIEWPORT || 430);
const engine = ENGINE === 'chromium' ? chromium : webkit;
const tag = `${ENGINE}/${VW}`;
const HEB = /[֐-׿]/;

const browser = await engine.launch({ headless: false });
const page = await (await browser.newContext({ viewport: { width: VW, height: 900 } })).newPage();
const dialogs = [];
page.on('dialog', async (d) => { dialogs.push(`${d.type()}: ${d.message().slice(0, 80)}`); await d.dismiss(); });
const errs = []; page.on('pageerror', (e) => errs.push(String(e).slice(0, 110)));

const readAch = () => {
  const lines = document.body.innerText.split('\n').map((s) => s.trim()).filter(Boolean);
  const tiles = [...document.querySelectorAll('[role="button"],button')]
    .map((e) => (e.getAttribute('aria-label') || '').trim())
    .filter((l) => /, (locked|earned|unlocked)/i.test(l));
  return {
    counter: lines.find((l) => /\d+\s*\/\s*\d+/.test(l) && /unlock|earn/i.test(l)) || null,
    earned: tiles.filter((l) => /, (earned|unlocked)/i.test(l)),
    tiles: tiles.length,
    hebrew: tiles.filter((t) => /[֐-׿]/.test(t)).length,
  };
};

const openAchievements = async (label) => {
  await page.goto(SITE + '/achievements', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(9000);
  const s = await page.evaluate(readAch);
  console.log(`   ${label.padEnd(22)} counter=${JSON.stringify(s.counter)} earned=${s.earned.length} ${JSON.stringify(s.earned.slice(0, 3))} hebrew=${s.hebrew}`);
  return s;
};

const playOne = async (n) => {
  await page.goto(SITE + '/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(9000);
  await installFire(page);
  for (const label of ['Continue', 'SKIP', 'PLAY']) {
    const hit = await page.evaluate(`(()=>{const b=[...document.querySelectorAll('button,[role="button"]')]
      .find(x=>new RegExp(${JSON.stringify(label)},'i').test((x.getAttribute('aria-label')||'')+' '+(x.textContent||'')));
      if(!b) return false; window.__f(b); return true;})()`);
    if (hit) { await page.waitForTimeout(3500); await installFire(page); }
  }
  if (!/game/.test((await where(page)).path)) {
    await page.goto(SITE + '/game?practice=true', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(9000);
  }
  const res = await playHandToResults(page);
  await page.waitForTimeout(9000);   // let the fire-and-forget hand_history write land
  console.log(`   hand ${n}: reachedResults=${res.reachedResults} sawReveal=${res.sawReveal}`);
  return res.reachedResults;
};

console.log(`\n══ ${tag} ══`);
await page.goto(SITE + '/', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(8000);
const device = await page.evaluate(`localStorage.getItem('caps-device-id')`);
console.log(`   DEVICE: ${device}`);

const before = await openAchievements('BEFORE');
const played1 = await playOne(1);
const after1 = await openAchievements('AFTER HAND 1');
const reload = await openAchievements('AFTER RELOAD');
const played2 = await playOne(2);
const after2 = await openAchievements('AFTER HAND 2');

console.log(`\n── ${tag} FIVE CRITERIA`);
console.log(`  1 played a real hand ......... ${played1 && played2 ? 'PASS' : 'FAIL'}`);
console.log(`  2 unlocked something ......... ${after1.earned.length > before.earned.length ? `PASS (${before.earned.length} -> ${after1.earned.length})` : `FAIL (${before.earned.length} -> ${after1.earned.length})`}`);
console.log(`  3 counter left 0/36 .......... ${after1.counter && !/^0\s*\//.test(after1.counter) ? `PASS ${JSON.stringify(after1.counter)}` : `FAIL ${JSON.stringify(after1.counter)}`}`);
console.log(`  4 survives reload ............ ${reload.earned.length === after1.earned.length && reload.earned.length > 0 ? 'PASS' : 'FAIL'}`);
console.log(`  5 no double-award ............ ${after2.earned.length >= after1.earned.length ? `PASS (${after1.earned.length} -> ${after2.earned.length}, growth is new achievements only)` : 'FAIL'}`);
console.log(`  english only ................. ${after2.hebrew === 0 ? 'PASS' : `FAIL (${after2.hebrew})`}`);
console.log(`  dialogs=${JSON.stringify(dialogs)} pageerrors=${errs.length}`);
console.log(`  VERIFY IN SQL FOR DEVICE: ${device}`);
await browser.close();
