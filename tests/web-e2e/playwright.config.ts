import { defineConfig, devices } from '@playwright/test';

/**
 * Layer 2 Playwright config — separate from the project's existing
 * tests/visual/* BackstopJS pipeline. Single web-e2e project here so the
 * BackstopJS reference-shots stay isolated from these MP/realtime smokes.
 */
export default defineConfig({
  testDir: __dirname,
  testMatch: '*.spec.ts',
  fullyParallel: false, // 2-context realtime tests can't safely parallelize
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    headless: !!process.env.CI,
    viewport: { width: 390, height: 900 },
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'iphone-13',
      use: { ...devices['iPhone 13'], viewport: { width: 390, height: 900 } },
    },
    {
      name: 'iphone-se',
      use: { ...devices['iPhone SE'], viewport: { width: 320, height: 800 } },
    },
  ],
});
