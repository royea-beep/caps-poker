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

  await ctx.storageState({ path: STATE_PATH });
  const stat = fs.statSync(STATE_PATH);
  console.log(`[bootstrap] saved storageState (${stat.size}B) → ${STATE_PATH}`);
  console.log(`[bootstrap] gates triggered: lang=${lang ?? 'none'} theme=${theme ?? 'none'} orient=${orient ?? 'none'}`);
  await browser.close();
})().catch((e) => { console.error('[bootstrap] FATAL', e); process.exit(1); });
