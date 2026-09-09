/**
 * Bootstrap tests/caps-onboarded.json — the storageState used by the WCAG
 * audit and BackstopJS so every audited route starts post-onboarding.
 *
 * Post-Smart-Defaults this is mostly a no-op: a fresh context lands directly
 * on home with caps_language + caps-poker-storage seeded. We still touch each
 * gate fallback as a defensive paint pass so the saved state is fully populated
 * for any future audit that needs it.
 *
 * Idempotent: re-running produces an equivalent state file.
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const URL = process.env.CAPS_URL ?? 'https://caps.ftable.co.il';
const STATE_PATH = path.join(__dirname, 'caps-onboarded.json');

async function pickIfVisible(page, candidates, timeoutMs = 800) {
  for (const text of candidates) {
    const loc = page.getByText(text, { exact: false }).first();
    if (await loc.isVisible({ timeout: timeoutMs }).catch(() => false)) {
      await loc.click().catch(() => {});
      return text;
    }
  }
  return null;
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ locale: 'en-US', extraHTTPHeaders: { 'Accept-Language': 'en-US,en;q=0.9' } });
  const page = await ctx.newPage();
  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(2000);

  // Defensive: walk any leftover gates if smart-defaults didn't fire.
  const lang = await pickIfVisible(page, ['English', 'ENGLISH']);
  if (lang) await page.waitForTimeout(800);
  const theme = await pickIfVisible(page, ['CLASSIC']);
  if (theme) await page.waitForTimeout(800);
  const orient = await pickIfVisible(page, ['PORTRAIT']);
  if (orient) await page.waitForTimeout(800);

  // Settle on home (or wherever we landed).
  await page.waitForTimeout(2500);

  // ── MAKE THE FILE MEAN ITS NAME ─────────────────────────────────────────────────────────────
  // Everything above visits the site as a BRAND-NEW VISITOR, so what it captured was a FIRST RUN,
  // saved under the name "onboarded". Two first-run markers rode along in it:
  //
  //   guidedModeForced='true'   written by home's own first-run effect while this script was
  //                             standing on the home screen (index.tsx sets it when gamesPlayed
  //                             is 0). game.tsx then computes
  //                             `guided = played === 0 || guidedVal === 'true'`, so this flag
  //                             OVERRIDES any games-played count and turns on the first-hand
  //                             coaching tips — which render a toast AND dim the whole screen to
  //                             ~0.6. Every consumer of this file inherited that.
  //   caps_games_played absent  same effect by the other half of the OR.
  //
  // It was caught because two BackstopJS baseline sets came back as photographs of a coached,
  // dimmed /game screen. Backstop's onBefore hook now strips the flag defensively, but stripping
  // downstream leaves the file itself lying to its other twelve consumers — the WCAG audit among
  // them, which would have been auditing contrast on a screen at 0.6 opacity.
  //
  // So the state is made genuinely onboarded HERE, before capture. Set, settle, then clear the
  // flag once more in case the app's own effect re-armed it in between, and only then save.
  await page.evaluate(() => {
    try {
      localStorage.setItem('has_seen_interactive_tutorial', 'true');
      localStorage.setItem('caps_games_played', '25');
      localStorage.removeItem('guidedModeForced');
    } catch (_) { /* localStorage may be unavailable */ }
  });
  await page.waitForTimeout(500);
  const firstRunLeft = await page.evaluate(() => {
    try {
      localStorage.removeItem('guidedModeForced');
      return { guided: localStorage.getItem('guidedModeForced'),
               played: localStorage.getItem('caps_games_played') };
    } catch (_) { return null; }
  });

  await ctx.storageState({ path: STATE_PATH });

  // Assert it, rather than trusting the writes above — this file is a fixture other suites build
  // on, and a silent regression here is invisible until a baseline or an audit is already wrong.
  const saved = JSON.parse(fs.readFileSync(STATE_PATH, 'utf8'));
  const ls = saved?.origins?.[0]?.localStorage ?? [];
  const get = (k) => ls.find((e) => e.name === k)?.value;
  const problems = [];
  if (get('guidedModeForced')) problems.push('guidedModeForced is still set');
  if (get('caps_games_played') !== '25') problems.push(`caps_games_played is ${get('caps_games_played')}`);
  if (get('has_seen_interactive_tutorial') !== 'true') problems.push('has_seen_interactive_tutorial is not set');
  if (problems.length) {
    console.error(`[bootstrap] NOT ONBOARDED — ${problems.join('; ')}`);
    process.exit(1);
  }
  console.log(`[bootstrap] onboarded state verified: guidedModeForced=${firstRunLeft?.guided ?? 'absent'} ` +
    `caps_games_played=${firstRunLeft?.played}`);
  const stat = fs.statSync(STATE_PATH);
  console.log(`[bootstrap] saved storageState (${stat.size}B) → ${STATE_PATH}`);
  console.log(`[bootstrap] gates triggered: lang=${lang ?? 'none'} theme=${theme ?? 'none'} orient=${orient ?? 'none'}`);
  await browser.close();
})().catch((e) => { console.error('[bootstrap] FATAL', e); process.exit(1); });
