import { test, expect } from '@playwright/test';

/**
 * Home post-onboarding must be STERILE of the popups removed in UNIFY-FINAL.
 * The inline new-player welcome card stays (signature: "Welcome to CAPS Poker!").
 * Auto-popups removed in 0780f9f must NOT surface a banner, modal, or toast.
 *
 * Asserts the popup-killing diff didn't regress.
 */

const POPUP_SIGNATURES_REMOVED = [
  // index.tsx auto-popups
  'Claim your daily reward',          // DailyRewardPopup auto-fire
  'Day streak claimed',                // StreakPopup auto-fire
  'Level Up!',                         // LevelUpModal auto-fire
  'Your Weekly Recap',                 // WeeklyRecapModal Sunday auto-fire
  '🏆 Share your COMPLETE',            // CompleteBanner on-return-home auto-fire
  'Welcome back, ',                    // WelcomeToast post-sign-in
  'Save your stats',                   // NudgeBanner sign-in nag (substring)
  // results.tsx auto-popups
  'Sign in to save your wins',         // LoginPromptModal nag
  'Ready for the full challenge',      // showUpgradeNudge "Try 4 boards"
];

// These SHOULD remain — they're either inline content or user-initiated.
const KEEP_SIGNATURES = [
  'Welcome to CAPS Poker!',            // inline new-player welcome card (stage==='new')
];

test('home is sterile of removed popups', async ({ page }) => {
  const url = process.env.PREVIEW_URL_A || 'https://caps.ftable.co.il';
  const consoleErrors: string[] = [];
  page.on('pageerror', (e) => consoleErrors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error') consoleErrors.push(`console.error: ${m.text()}`);
  });

  await page.goto(url, { waitUntil: 'domcontentloaded' });
  // Wait for the SPA to mount + onboarding to either show or be skipped.
  await page.waitForFunction(() => (document.getElementById('root')?.children.length ?? 0) > 0);
  await page.waitForTimeout(8_000);

  const body = await page.evaluate(() => document.body.innerText);

  // 0 popup signatures appear
  for (const sig of POPUP_SIGNATURES_REMOVED) {
    expect(body, `popup signature '${sig}' must not appear on home`).not.toContain(sig);
  }

  // The intentional inline content is preserved
  for (const sig of KEEP_SIGNATURES) {
    expect(body, `inline content '${sig}' must remain on home`).toContain(sig);
  }

  // No app console errors (benign: any autoplay reject is filtered upstream)
  const realErrors = consoleErrors.filter(
    (e) => !/autoplay|user-gesture|user activation|play\(\) failed/i.test(e),
  );
  expect(realErrors, `unexpected console errors: ${realErrors.join('\n')}`).toEqual([]);
});
