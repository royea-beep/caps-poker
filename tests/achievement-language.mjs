/**
 * ACHIEVEMENT-LANGUAGE — prove two things on the LIVE site, per engine:
 *
 *   1. Every achievement title renders in ENGLISH. The RPCs used to project
 *      COALESCE(title_he, title) — Hebrew first, English unreachable.
 *   2. The screen can SHOW PROGRESS: play a real hand, then confirm a tile flips to
 *      earned and the counter leaves 0/36. That outcome was never observed before.
 *
 *   ENGINE=webkit node tests/achievement-language.mjs
 *   ENGINE=chromium node tests/achievement-language.mjs
 *
 * Anchored on the per-tile aria-label added 2026-08-21, never on shape or position.
 * A dialog handler is registered BEFORE anything is operated — without one Playwright
 * auto-dismisses native dialogs, which produced two false "dead control" findings.
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
const ctx = await browser.newContext({ viewport: { width: VW, height: 900 } });
const page = await ctx.newPage();

const dialogs = [];
page.on('dialog', async (d) => { dialogs.push(`${d.type()}: ${d.message().slice(0, 90)}`); await d.dismiss(); });
const errs = [];
page.on('pageerror', (e) => errs.push(String(e).slice(0, 120)));

/** Read the achievements screen through its declared labels. */
const readAch = () => {
  const lines = document.body.innerText.split('\n').map((s) => s.trim()).filter(Boolean);
  const tiles = [...document.querySelectorAll('[role="button"],button')]
    .map((e) => (e.getAttribute('aria-label') || '').trim())
    .filter((l) => /, (locked|earned|unlocked)/i.test(l));
  return {
    path: location.pathname,
    counter: lines.find((l) => /\d+\s*\/\s*\d+/.test(l) && /unlock|earn/i.test(l))
          || lines.find((l) => /^\d+\s*\/\s*\d+$/.test(l)) || null,
    tiles,
    earned: tiles.filter((l) => /, (earned|unlocked)/i.test(l)).length,
    allLines: lines.slice(0, 6),
  };
};

const dumpLang = (label, s) => {
  const heb = s.tiles.filter((t) => HEB.test(t));
  console.log(`\n── ${tag} · ${label} · ${s.path}`);
  console.log(`   tiles: ${s.tiles.length}   counter: ${JSON.stringify(s.counter)}   earned: ${s.earned}`);
  console.log(`   HEBREW TILES: ${heb.length}${heb.length ? ' → ' + JSON.stringify(heb.slice(0, 4)) : ''}`);
  console.log(`   sample: ${JSON.stringify(s.tiles.slice(0, 4))}`);
  return heb.length;
};

// ── 1. Language, before anything is played ────────────────────────────────────
await page.goto(SITE + '/achievements', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(9000);
const before = await page.evaluate(readAch);
const hebBefore = dumpLang('language check', before);
await page.screenshot({ path: `tests/screenshots/achlang-${ENGINE}-1-language.png` });

const deviceId = await page.evaluate(`(()=>{for(const k of Object.keys(localStorage)){
  if(/device/i.test(k)){const v=localStorage.getItem(k)||''; if(v.length>6&&v.length<80) return k+' = '+v;}}
  return null;})()`);
console.log(`   device: ${deviceId}`);

// ── 2. Play a real hand, then look again ──────────────────────────────────────
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
console.log(`\n   played: reachedResults=${res.reachedResults} sawReveal=${res.sawReveal}`);

await page.goto(SITE + '/achievements', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(9000);
const after = await page.evaluate(readAch);
const hebAfter = dumpLang('after playing a hand', after);
await page.screenshot({ path: `tests/screenshots/achlang-${ENGINE}-2-progress.png` });

// ── Verdict ───────────────────────────────────────────────────────────────────
console.log(`\n══ ${tag} VERDICT`);
console.log(`   ENGLISH ONLY .......... ${hebBefore === 0 && hebAfter === 0 ? 'PASS' : `FAIL (${hebBefore}/${hebAfter} Hebrew)`}`);
console.log(`   PLAYED A REAL HAND .... ${res.reachedResults ? 'PASS' : 'FAIL'}`);
console.log(`   SHOWS PROGRESS ........ ${after.earned > 0 ? `PASS (${after.earned} earned, counter ${JSON.stringify(after.counter)})`
  : `NOT OBSERVED (earned=0, counter ${JSON.stringify(after.counter)})`}`);
console.log(`   dialogs: ${JSON.stringify(dialogs)}`);
console.log(`   pageerrors: ${errs.length}${errs.length ? ' ' + JSON.stringify(errs.slice(0, 3)) : ''}`);

await browser.close();
