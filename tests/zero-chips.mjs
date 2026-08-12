/**
 * What does a player with ZERO chips see, and can they still do anything?
 *
 * Three rescue RPCs exist in the schema — claim_low_chip_rescue, claim_emergency_chips,
 * claim_winback_rescue — and a codebase grep finds ZERO client call sites for any of them. So
 * the question is not "does the rescue work" but "is one ever offered".
 *
 * The wallet is gameStore.chips, persisted to localStorage, so this sets the balance locally and
 * touches NO real device and NO database row. Nothing to restore afterwards.
 *
 * Also answers Task 4: whether a fresh (incognito-equivalent) context gets its own device_id and
 * whether progress survives, since Playwright contexts are isolated exactly like private windows.
 *
 *   node tests/zero-chips.mjs
 */
import { chromium } from 'playwright';
import { measure, HarnessError } from './probe-kit.mjs';

const URL = process.env.CAPS_URL || 'https://caps.ftable.co.il';
const browser = await chromium.launch({ headless: false, args: ['--window-size=410,900'] });

// ── TASK 1 — zero balance ─────────────────────────────────────────────────────────────────
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
const page = await ctx.newPage();
await page.goto(URL, { waitUntil: 'load', timeout: 120000 });
await page.waitForTimeout(12000);

// Rewrite the persisted wallet to 0, then reload so the store rehydrates from it.
const set = await measure(page, `(() => {
  const raw = localStorage.getItem('caps-poker-storage');
  if (!raw) return { ok: false, why: 'no persist blob' };
  const j = JSON.parse(raw);
  const before = j.state.chips;
  j.state.chips = 0;
  localStorage.setItem('caps-poker-storage', JSON.stringify(j));
  return { ok: true, before, after: 0 };
})()`, { label: 'set0' });
console.log(`wallet rewritten locally: ${JSON.stringify(set)}`);
if (!set.ok) { console.error('could not reach the persist blob — FAILED MEASUREMENT.'); await browser.close(); process.exit(2); }

await page.reload({ waitUntil: 'load', timeout: 90000 });
await page.waitForTimeout(12000);

const atZero = await measure(page, `(() => {
  const hiddenBy = (el) => { let n = el, d = 0; while (n && d < 12) { const cs = getComputedStyle(n);
    if (cs.display === 'none' || cs.visibility === 'hidden' || parseFloat(cs.opacity) === 0) return true;
    if (cs.transform && /matrix\\(1, 0, 0, 1, [1-9]/.test(cs.transform)) return true;
    n = n.parentElement; d++; } return false; };
  const leaves = [...document.querySelectorAll('*')].filter((e) => !e.children.length && !hiddenBy(e));
  const texts = leaves.map((e) => (e.textContent || '').trim()).filter(Boolean);
  let chips = null;
  try { chips = JSON.parse(localStorage.getItem('caps-poker-storage')).state.chips; } catch {}
  const practice = leaves.find((e) => /Practice vs Bots/i.test((e.textContent || '').trim()));
  return { storedChips: chips,
           chipDisplay: texts.find((t) => /^🪙/.test(t)) ?? null,
           practiceVisible: !!practice,
           rescueWords: texts.filter((t) => /rescue|emergency|out of chips|free chips|top up|refill/i.test(t)),
           bodyLen: (document.body.innerText || '').trim().length,
           sample: texts.slice(0, 14) };
})()`, { label: 'zero' });

console.log('\n=== TASK 1 — wallet at 0 ===');
console.log(`  stored chips     : ${atZero.storedChips}`);
console.log(`  chip display     : ${JSON.stringify(atZero.chipDisplay)}`);
console.log(`  Practice visible : ${atZero.practiceVisible}`);
console.log(`  rescue offered   : ${atZero.rescueWords.length ? JSON.stringify(atZero.rescueWords) : 'NONE — no rescue wording anywhere on screen'}`);
console.log(`  body length      : ${atZero.bodyLen}`);
console.log(`  on screen        : ${JSON.stringify(atZero.sample)}`);

// Can they actually start a practice hand at 0?
await page.goto(`${URL}/game?practice=true&players=3`, { waitUntil: 'load', timeout: 90000 });
await page.waitForTimeout(10000);
const canPlay = await measure(page, `(() => ({
  url: location.pathname,
  bodyLen: (document.body.innerText || '').trim().length,
  hasBoards: /BOARD 1|PLACE \\d+ CARDS/i.test(document.body.innerText || ''),
  sample: (document.body.innerText || '').trim().slice(0, 70) }))()`, { label: 'play0' });
console.log(`\n  practice at 0 chips: url ${canPlay.url} | dealt? ${canPlay.hasBoards} | ${JSON.stringify(canPlay.sample)}`);
await page.screenshot({ path: 'tests/screenshots/zero-chips-home.png' });
const deviceA = await page.evaluate(`(() => localStorage.getItem('caps-device-id'))()`);
await ctx.close();

// ── TASK 4 — private browsing / isolated context ──────────────────────────────────────────
const priv = await browser.newContext({ viewport: { width: 390, height: 844 } });
const p2 = await priv.newPage();
await p2.goto(URL, { waitUntil: 'load', timeout: 120000 });
await p2.waitForTimeout(12000);
const deviceB = await p2.evaluate(`(() => localStorage.getItem('caps-device-id'))()`);
const chipsB = await p2.evaluate(`(() => { try { return JSON.parse(localStorage.getItem('caps-poker-storage')).state.chips; } catch { return null; } })()`);
await priv.close();

// A second isolated context = "close and reopen private browsing".
const priv2 = await browser.newContext({ viewport: { width: 390, height: 844 } });
const p3 = await priv2.newPage();
await p3.goto(URL, { waitUntil: 'load', timeout: 120000 });
await p3.waitForTimeout(12000);
const deviceC = await p3.evaluate(`(() => localStorage.getItem('caps-device-id'))()`);
await priv2.close();
await browser.close();

console.log('\n=== TASK 4 — isolated contexts (private-browsing equivalent) ===');
console.log(`  context A device_id : ${deviceA}`);
console.log(`  context B device_id : ${deviceB}  (chips ${chipsB})`);
console.log(`  context C device_id : ${deviceC}`);
console.log(`  B differs from A? ${deviceA !== deviceB} | C differs from B? ${deviceB !== deviceC}`);
console.log(deviceA && deviceB && deviceC && deviceA !== deviceB && deviceB !== deviceC
  ? '  => every isolated context gets a NEW device_id; progress does NOT carry across.'
  : '  => device_id was shared or unreadable — inspect before concluding.');
