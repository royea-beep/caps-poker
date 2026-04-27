import { test, expect } from '@playwright/test';

// Visual regression tests for CAPS Poker key screens.
// Run locally before push: npx playwright test
// First run creates baselines. Future runs compare against baselines.

test.describe('CAPS Poker key screens', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:8081');
    await page.waitForLoadState('networkidle');
  });

  test('home screen renders without unexpected changes', async ({ page }) => {
    await expect(page).toHaveScreenshot('home.png', {
      maxDiffPixels: 100,
      fullPage: true,
    });
  });

  test('game screen 2P (4 boards, 16 cards)', async ({ page }) => {
    await page.click('text=שחק');
    await page.click('text=2');
    await page.waitForTimeout(2000);

    await expect(page).toHaveScreenshot('game-2p.png', {
      maxDiffPixels: 200,
      fullPage: true,
    });
  });

  test('settings screen', async ({ page }) => {
    await page.click('text=פרופיל');
    await page.click('text=הגדרות');
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveScreenshot('settings.png', {
      maxDiffPixels: 100,
      fullPage: true,
    });
  });
});
