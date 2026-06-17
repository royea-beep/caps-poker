// Bootstrap past all onboarding gates by repeatedly clicking SELECT until none remain,
// then capture all 14 screens
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const SCREENS = [
  { name: 'home', path: '/' },
  { name: 'game', path: '/game' },
  { name: 'settings', path: '/settings' },
  { name: 'leaderboard', path: '/leaderboard' },
  { name: 'profile', path: '/profile' },
  { name: 'play', path: '/play' },
  { name: 'friends', path: '/friends' },
  { name: 'cups', path: '/cups' },
  { name: 'shop', path: '/shop' },
  { name: 'chip-store', path: '/chip-store' },
  { name: 'host', path: '/lobby/host' },
  { name: 'join', path: '/lobby/join' },
  { name: 'rank', path: '/rank' },
  { name: 'hand-history', path: '/hand-history' },
];

const DATE_TAG = '2026-05-19-v4';

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({
    viewport: { width: 393, height: 852 },
    deviceScaleFactor: 3,
    isMobile: true,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
  });
  const page = await ctx.newPage();

  const outDir = path.join(process.cwd(), `reality-check-${DATE_TAG}`);
  fs.mkdirSync(outDir, { recursive: true });

  console.log('Bootstrap: navigate to root');
  await page.goto('https://caps.ftable.co.il/', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(2000);

  // Step 1: language picker (button text "English")
  console.log('Step 1: click English');
  try {
    await page.getByText('English', { exact: true }).first().click({ timeout: 5000 });
    console.log('  clicked English');
    await page.waitForTimeout(3000);
  } catch (e) {
    console.log('  English not found: ' + e.message);
  }
  await page.screenshot({ path: path.join(outDir, '_step1-after-english.png'), fullPage: false });

  // Steps 2..N: repeatedly click SELECT buttons (style picker, play style, etc.)
  for (let step = 2; step <= 8; step++) {
    console.log(`Step ${step}: probe for SELECT button`);
    let clicked = false;
    try {
      const selectBtns = await page.getByText('SELECT', { exact: true }).all();
      if (selectBtns.length === 0) {
        console.log(`  no SELECT buttons found — onboarding may be complete`);
        break;
      }
      // Click the LAST SELECT (typically the highlighted/recommended option)
      await selectBtns[selectBtns.length - 1].click({ timeout: 5000 });
      console.log(`  clicked SELECT button #${selectBtns.length} (rightmost/recommended)`);
      clicked = true;
      await page.waitForTimeout(3000);
      await page.screenshot({ path: path.join(outDir, `_step${step}-after-select.png`), fullPage: false });
    } catch (e) {
      console.log(`  SELECT click failed: ${e.message}`);
      break;
    }
    if (!clicked) break;
  }

  // Final probe state
  await page.screenshot({ path: path.join(outDir, '_final-onboarding-state.png'), fullPage: false });

  const results = [];
  for (const s of SCREENS) {
    const url = `https://caps.ftable.co.il${s.path}`;
    console.log('-> ' + url);
    try {
      await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
      await page.waitForTimeout(2500);
      const localPath = path.join(outDir, `${s.name}.png`);
      await page.screenshot({ path: localPath, fullPage: false });
      const size = fs.statSync(localPath).size;
      console.log(`   saved ${s.name}.png (${size} bytes)`);
      results.push({ name: s.name, local: localPath, size });
    } catch (e) {
      console.error('   FAILED: ' + e.message);
      results.push({ name: s.name, error: e.message });
    }
  }

  await browser.close();
  console.log('\nDONE.');
  fs.writeFileSync(path.join(outDir, 'results.json'), JSON.stringify(results, null, 2));
})();
