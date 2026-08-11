/**
 * BLIND SPOT #4 — read both sides of a value in ONE run.
 *
 * `Starting Chips` read 2000 in one enumeration and 1000 in a later screenshot, hours apart.
 * Neither reading was wrong; they were never compared. This reads the PERSISTED config and the
 * RENDERED value in the same session, so a disagreement is a finding rather than a rumour.
 *
 * Also reports the practice-mode economy surface: what settings promises in chips versus what
 * /results actually awards, which is XP-only.
 *
 *   node tests/economy-crosscheck.mjs
 */
import { chromium } from 'playwright';
import { measure, HarnessError } from './probe-kit.mjs';

const URL = process.env.CAPS_URL || 'https://caps.ftable.co.il';
const SEED = { caps_tutorial_seen: 'true', caps_onboarding_done: 'true',
  has_seen_interactive_tutorial: 'true', caps_games_played: '99' };

const browser = await chromium.launch({ headless: false, args: ['--window-size=410,900'] });
const ctx = await browser.newContext({ viewport: { width: 390, height: 812 }, deviceScaleFactor: 1 });
await ctx.addInitScript((s) => { for (const [k, v] of Object.entries(s)) { try { localStorage.setItem(k, v); } catch {} } }, SEED);
const page = await ctx.newPage();

await page.goto(URL + '/settings', { waitUntil: 'load', timeout: 120000 });
await page.waitForTimeout(9000);

let d;
try {
  d = await measure(page, `(() => {
    // STORED: the zustand persist blob.
    let stored = null, raw = null;
    try {
      raw = localStorage.getItem('caps-poker-storage');
      const j = raw ? JSON.parse(raw) : null;
      const cfg = j?.state?.config ?? null;
      stored = cfg ? { startingChips: cfg.startingChips, potPerBoard: cfg.potPerBoard,
                       completeBonusPercent: cfg.completeBonusPercent, numberOfPlayers: cfg.numberOfPlayers } : null;
    } catch (e) { stored = { error: String(e).slice(0, 80) }; }

    // RENDERED: the value in the input next to each label, same instant.
    const leaves = [...document.querySelectorAll('*')].filter((e) => !e.children.length);
    const rowValue = (label) => {
      const lab = leaves.find((e) => (e.textContent || '').trim() === label);
      if (!lab) return null;
      // Walk up to the row, then find the input inside it.
      let n = lab, d = 0;
      while (n && d < 5) {
        const inp = n.querySelector && n.querySelector('input');
        if (inp) return inp.value;
        n = n.parentElement; d++;
      }
      return null;
    };
    const texts = leaves.map((e) => (e.textContent || '').trim()).filter(Boolean);
    return { stored, hasBlob: !!raw,
             renderedStartingChips: rowValue('Starting Chips'),
             renderedPotPerBoard: rowValue('Pot Per Board'),
             renderedBonusPct: rowValue('Complete Bonus %'),
             suffixes: texts.filter((t) => /boards =|% of buy-in/.test(t)) };
  })()`, { label: 'econ' });
} catch (e) { console.error('HARNESS:', e instanceof HarnessError ? e.message : String(e)); await browser.close(); process.exit(2); }
await browser.close();

console.log('SAME RUN — stored config vs rendered value\n');
console.log(`  persist blob present: ${d.hasBlob}`);
console.log(`  stored config       : ${JSON.stringify(d.stored)}`);
console.log(`  rendered Starting Chips : ${JSON.stringify(d.renderedStartingChips)}`);
console.log(`  rendered Pot Per Board  : ${JSON.stringify(d.renderedPotPerBoard)}`);
console.log(`  rendered Complete Bonus : ${JSON.stringify(d.renderedBonusPct)}`);
console.log(`  suffix lines            : ${JSON.stringify(d.suffixes)}`);

const s = d.stored?.startingChips, r = d.renderedStartingChips;
if (s != null && r != null) {
  console.log(`\n  Starting Chips: stored ${s} vs rendered ${r} -> ${String(s) === String(r) ? 'AGREE' : '*** DISAGREE ***'}`);
} else {
  console.log('\n  Could not read one side — that is an incomplete measurement, not agreement.');
}
