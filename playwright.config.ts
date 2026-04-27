import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/visual',
  timeout: 30 * 1000,
  expect: {
    toHaveScreenshot: { maxDiffPixels: 100 },
  },
  fullyParallel: false,
  retries: 0,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:8081',
    viewport: { width: 414, height: 896 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  },
  webServer: {
    command: 'npm run web',
    url: 'http://localhost:8081',
    reuseExistingServer: true,
    timeout: 120 * 1000,
  },
});
