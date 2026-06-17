// Bootstrap with loose text matchers + onboarding loop
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

const DATE_TAG = '2026-05-19-v5';

async function clickIfPresent(page, text, label) {
  try {
    const loc = page.getByText(text).first();
    await loc.waitFor({ state: 'visible', timeout: 4000 });
    await loc.click({ timeout: 4000 });
    console.log(`  clicked "${label || text}"`);
    await page.waitForTimeout(3000);
    return true;
  } catch (e) {
    console.log(`  "${label || text}" not present: ${e.message.split('\n')[0]}`);
    return false;
  }
}

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

  // Onboarding gate loop — try various forward-progression buttons
  const buttonsToTry = [
    'English',         // language gate
    'SELECT',          // generic select button (style + play style + future gates)
    'SELECT',
    'SELECT',
    'Continue',
    'Get Started',
    'Start',
    'Done',
    'Skip',
    'Skip tutorial',
  ];

  for (let i = 0; i < buttonsToTry.length; i++) {
    const text = buttonsToTry[i];
    console.log(`Gate ${i + 1}: try "${text}"`);
    const clicked = await clickIfPresent(page, text, `${text} (gate ${i + 1})`);
    if (clicked) {
      await page.screenshot({
        path: path.join(outDir, `_gate${i + 1}-after-${text.replace(/\s/g, '_')}.png`),
        fullPage: false,
      });
    }
  }

  // Final post-onboarding state probe
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
