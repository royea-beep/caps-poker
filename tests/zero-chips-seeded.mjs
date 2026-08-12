/**
 * The ACTUAL zero-chip state — seeded server-side.
 *
 * The previous attempt rewrote the persisted wallet locally and reloaded, and the value came
 * back as 2530: the balance is server-backed and restored on load, so local tampering is
 * corrected. That run never reached zero, so nothing it said about "what a player sees at 0"
 * would have been true.
 *
 * This seeds a THROWAWAY probe device's device_id into localStorage — one this probe created
 * minutes ago, never a real user's — whose leaderboard row has been set to 0, then loads the app
 * as that device.
 *
 *   DEVICE=bcdd-8b24-89cb node tests/zero-chips-seeded.mjs
 */
import { chromium } from 'playwright';
import { measure, HarnessError } from './probe-kit.mjs';

const URL = process.env.CAPS_URL || 'https://caps.ftable.co.il';
const DEVICE = process.env.DEVICE || 'bcdd-8b24-89cb';

const browser = await chromium.launch({ headless: false, args: ['--window-size=410,900'] });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
await ctx.addInitScript((id) => { try { localStorage.setItem('caps-device-id', id); } catch {} }, DEVICE);
const page = await ctx.newPage();
await page.goto(URL, { waitUntil: 'load', timeout: 120000 });
await page.waitForTimeout(14000);

const d = await measure(page, `(() => {
  const hiddenBy = (el) => { let n = el, d = 0; while (n && d < 12) { const cs = getComputedStyle(n);
    if (cs.display === 'none' || cs.visibility === 'hidden' || parseFloat(cs.opacity) === 0) return true;
    if (cs.transform && /matrix\\(1, 0, 0, 1, [1-9]/.test(cs.transform)) return true;
    n = n.parentElement; d++; } return false; };
  const leaves = [...document.querySelectorAll('*')].filter((e) => !e.children.length && !hiddenBy(e));
  const texts = leaves.map((e) => (e.textContent || '').trim()).filter(Boolean);
  let chips = null;
  try { chips = JSON.parse(localStorage.getItem('caps-poker-storage')).state.chips; } catch {}
  return { device: localStorage.getItem('caps-device-id'),
           storedChips: chips,
           chipDisplay: texts.find((t) => /^🪙/.test(t)) ?? null,
           practiceVisible: texts.some((t) => /Practice vs Bots/i.test(t)),
           playOnlineVisible: texts.some((t) => /Play Online/i.test(t)),
           rescueWords: texts.filter((t) => /rescue|emergency|out of chips|free chips|top up|refill|no chips/i.test(t)),
           bodyLen: (document.body.innerText || '').trim().length };
})()`, { label: 'zero' });

console.log(`device seeded      : ${d.device}`);
console.log(`stored chips       : ${d.storedChips}`);
console.log(`chip display       : ${JSON.stringify(d.chipDisplay)}`);
console.log(`Practice visible   : ${d.practiceVisible}`);
console.log(`Play Online visible: ${d.playOnlineVisible}`);
console.log(`rescue offered     : ${d.rescueWords.length ? JSON.stringify(d.rescueWords) : 'NONE'}`);
console.log(`body length        : ${d.bodyLen}`);
await page.screenshot({ path: 'tests/screenshots/zero-chips-real.png' });

// Can a practice hand still be dealt at 0?
await page.goto(`${URL}/game?practice=true&players=3`, { waitUntil: 'load', timeout: 90000 });
await page.waitForTimeout(10000);
const play = await measure(page, `(() => ({ url: location.pathname,
  dealt: /BOARD 1|PLACE \\d+ CARDS/i.test(document.body.innerText || ''),
  sample: (document.body.innerText || '').trim().slice(0, 60) }))()`, { label: 'play' });
console.log(`\npractice at 0: url ${play.url} | dealt? ${play.dealt} | ${JSON.stringify(play.sample)}`);
await browser.close();
