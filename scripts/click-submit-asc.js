const { chromium } = require('playwright');
const fs = require('fs');

const APPLE_ID = 'royearguan@gmail.com';
const APP_ID = '6760429619';
const TEMP = 'C:/Users/royea/AppData/Local/Temp';
const SESSION_FILE = TEMP + '/apple_asc_session.json';

// Load Apple password from env files
let password = null;
const envFiles = [
  'C:/Projects/caps/.env',
  'C:/Projects/caps/.env.local',
  'C:/Projects/_KEYS/.env',
  'C:/Users/royea/.env',
];
for (const f of envFiles) {
  try {
    const c = fs.readFileSync(f, 'utf8');
    const m = c.match(/APPLE_(?:ID_)?PASSWORD[=:\s]+["']?([^"'\n]+)["']?/i);
    if (m) { password = m[1].trim(); console.log('Found password in:', f); break; }
  } catch {}
}

(async () => {
  const browser = await chromium.launch({
    headless: false,
    slowMo: 400,
  });

  const ctx = await browser.newContext({
    storageState: fs.existsSync(SESSION_FILE) ? SESSION_FILE : undefined,
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 900 },
  });

  const page = await ctx.newPage();

  const TARGET = `https://appstoreconnect.apple.com/apps/${APP_ID}/distribution/ios/version/deliverable`;
  console.log('Navigating to:', TARGET);
  await page.goto(TARGET, { timeout: 30000 }).catch(e => console.log('Nav warning:', e.message));
  await page.waitForTimeout(4000);

  // Handle login if needed — ASC can redirect to login, idmsa, appleid.apple.com, or signin
  const url = page.url();
  const needsLogin = url.includes('idmsa') || url.includes('appleid') || url.includes('signin') || url.includes('/login');
  if (needsLogin) {
    console.log('Login required — URL:', url);
    console.log('👉 Please log in manually in the browser window that just opened.');
    console.log('   1. Enter password when prompted');
    console.log('   2. Approve 2FA on your iPhone');
    console.log('   Waiting up to 5 minutes...');

    // Try to pre-fill Apple ID if the field is present
    try {
      const emailInput = await page.waitForSelector(
        '#account_name, input[name="account_name"], input[type="email"], input[autocomplete="username"]',
        { timeout: 8000 }
      );
      const currentVal = await emailInput.inputValue().catch(() => '');
      if (!currentVal) {
        await emailInput.fill(APPLE_ID);
        console.log('Pre-filled Apple ID:', APPLE_ID);
      }
    } catch {}

    // Poll until URL changes away from login page (up to 5 minutes)
    const loginDeadline = Date.now() + 300000;
    let loggedIn = false;
    while (Date.now() < loginDeadline) {
      const currentUrl = page.url();
      if (!currentUrl.includes('/login') && !currentUrl.includes('authResult=FAILED') && !currentUrl.includes('idmsa') && !currentUrl.includes('appleid.apple.com')) {
        loggedIn = true;
        console.log('✅ Logged in! URL:', currentUrl);
        break;
      }
      await page.waitForTimeout(3000);
    }
    if (!loggedIn) {
      console.log('⚠️  Login timeout — still on:', page.url());
    }

    // Save session for next time
    try {
      await ctx.storageState({ path: SESSION_FILE });
      console.log('Session saved to', SESSION_FILE);
    } catch {}

    // Navigate to target after login
    await page.goto(TARGET, { timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(5000);
  }

  await page.screenshot({ path: TEMP + '/asc-before-submit.png' });
  console.log('Screenshot saved: asc-before-submit.png');
  console.log('Current URL:', page.url());

  // Find and click Submit for Review
  console.log('Looking for Submit for Review button...');

  const submitSelectors = [
    'button:has-text("Submit for Review")',
    '[data-test-id="submit-for-review"]',
    'button:has-text("Submit")',
    'text=Submit for Review',
  ];

  let clicked = false;
  for (const sel of submitSelectors) {
    try {
      const btn = await page.waitForSelector(sel, { timeout: 4000 });
      if (btn) {
        const isVisible = await btn.isVisible();
        const isEnabled = await btn.isEnabled();
        console.log(`Found: "${sel}" — visible=${isVisible} enabled=${isEnabled}`);
        if (isVisible && isEnabled) {
          await btn.scrollIntoViewIfNeeded();
          await page.waitForTimeout(500);
          await btn.click();
          console.log('✅ Clicked Submit for Review!');
          clicked = true;
          await page.waitForTimeout(3000);
          break;
        }
      }
    } catch {}
  }

  if (!clicked) {
    console.log('Button not found. Taking full-page screenshot...');
    await page.screenshot({ path: TEMP + '/asc-debug.png', fullPage: true });
    const allButtons = await page.$$eval('button', btns => btns.map(b => b.textContent?.trim()).filter(t => t && t.length < 60));
    console.log('Buttons found:', allButtons.join(' | '));
    console.log('Keeping browser open — please click Submit for Review manually (3 minutes).');
    await page.waitForTimeout(180000);
  }

  // Handle confirmation dialog
  try {
    const confirmBtn = await page.waitForSelector(
      'button:has-text("Submit"), button:has-text("Confirm"), button:has-text("OK")',
      { timeout: 5000 }
    );
    if (confirmBtn) {
      await confirmBtn.click();
      console.log('✅ Confirmed!');
      await page.waitForTimeout(3000);
    }
  } catch {}

  await page.screenshot({ path: TEMP + '/asc-after-submit.png' });
  console.log('Final screenshot: asc-after-submit.png');
  console.log('Final URL:', page.url());

  await browser.close();
  console.log('Done.');
})().catch(e => {
  console.error('Fatal:', e.message);
  process.exit(1);
});
