/**
 * LANDING-AND-AUTOSWEEP §2.3(a) — what the UI SENDS when a code is TYPED.
 *
 * The bug being re-checked truncated an 8-character code to 6 (`.slice(0,6)`), which still passed
 * the plausibility check and sent a WRONG code to the server. A deep link never exercised that
 * path, so this types the code one character at a time through the real input and reads the
 * request body the app actually emits.
 *
 * The Supabase POST is INTERCEPTED, not allowed out: this half of the proof is about the payload,
 * and the server half is proved separately against production.
 *
 *   DIST=web-las-dist2 node tests/referral-typed-payload.mjs
 */
import { serve } from '../tools/content-lib.mjs';
import { chromium } from 'playwright';

const PORT = Number(process.env.PORT || 9600);
const DIST = process.env.DIST || 'web-las-dist2';
const TYPED = process.env.CODE || 'A3F2B1C7';           // eight characters, as the DB issues them
const server = await serve(DIST, PORT);
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const ctx = await b.newContext({ viewport: { width: 393, height: 860 } });

const sent = [];
await ctx.route('**/*', async (route) => {
  const url = route.request().url();
  if (/\/rest\/v1\/rpc\/redeem_referral/.test(url)) {
    sent.push(route.request().postData());
    return route.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify({ success: false, error: 'intercepted by probe' }) });
  }
  return /supabase\.co|ftable\.co\.il/i.test(url) ? route.abort() : route.continue();
});
await ctx.addInitScript(() => { try { localStorage.setItem('caps_language','en'); localStorage.setItem('has_seen_interactive_tutorial','true'); localStorage.setItem('caps_games_played','25'); } catch(_){} });

const p = await ctx.newPage();
await p.goto(`http://localhost:${PORT}/referral`, { waitUntil: 'load', timeout: 120000 });
await p.waitForTimeout(7000);

const input = p.locator('input').first();
const found = await input.count() > 0;
if (found) {
  await input.click({ force: true });
  for (const ch of TYPED) { await p.keyboard.type(ch); await p.waitForTimeout(90); }
}
const inputValue = found ? await input.inputValue() : null;

// Press the redeem control (the button beside the field).
const btn = p.locator('[role="button"]').filter({ hasText: /Redeem|Apply|Go|Use/i }).first();
const btnCount = await btn.count();
if (btnCount) { await btn.click({ force: true }); await p.waitForTimeout(2500); }

const body = sent[0] ? JSON.parse(sent[0]) : null;
console.log(JSON.stringify({
  typed: TYPED,
  typedLength: TYPED.length,
  inputValueAfterTyping: inputValue,
  inputKeptAllCharacters: inputValue === TYPED,
  redeemButtonFound: btnCount > 0,
  requestsCaptured: sent.length,
  p_code: body ? body.p_code : null,
  p_codeMatchesTyped: body ? body.p_code === TYPED : null,
}, null, 1));
await b.close(); server.close();
