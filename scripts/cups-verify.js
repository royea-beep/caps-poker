// Verify /cups loads on caps.ftable.co.il (now serving bd7db6f via Vercel auto-deploy)
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({
    viewport: { width: 393, height: 852 },
    deviceScaleFactor: 3,
    isMobile: true,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
  });
  const page = await ctx.newPage();

  const outDir = path.join(process.cwd(), 'reality-check-2026-05-19-v6');
  fs.mkdirSync(outDir, { recursive: true });

  // Bootstrap past 3 onboarding gates (same as v5)
  console.log('Bootstrap: English -> SELECT -> SELECT');
  await page.goto('https://caps.ftable.co.il/', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(2000);
  try { await page.getByText('English').first().click({ timeout: 5000 }); await page.waitForTimeout(3000); } catch {}
  try { await page.getByText('SELECT').first().click({ timeout: 5000 }); await page.waitForTimeout(3000); } catch {}
  try { await page.getByText('SELECT').first().click({ timeout: 5000 }); await page.waitForTimeout(3000); } catch {}

  console.log('Navigating to /cups');
  await page.goto('https://caps.ftable.co.il/cups', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(3000);

  const bodyText = await page.locator('body').innerText();
  const crashed = bodyText.includes('Crash Detected') || bodyText.includes('toUpperCase');

  const localPath = path.join(outDir, 'cups-post-hotfix.png');
  await page.screenshot({ path: localPath, fullPage: false });
  const size = fs.statSync(localPath).size;

  console.log('--- VERIFICATION RESULT ---');
  console.log('Crash detected:', crashed);
  console.log('File size:', size, 'bytes');
  console.log('First 300 chars of body:', bodyText.slice(0, 300));
  console.log('Local:', localPath);

  await browser.close();
  process.exit(crashed ? 1 : 0);
})();
