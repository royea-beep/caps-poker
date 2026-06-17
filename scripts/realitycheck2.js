// Bootstrap + screenshot all 14 screens with English locale set
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

const DATE_TAG = '2026-05-19-v2';

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

  console.log('Bootstrap: clicking past language picker');
  await page.goto('https://caps.ftable.co.il/', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(2000);
  try {
    await page.getByText('English').first().click({ timeout: 5000 });
    console.log('  clicked English');
    await page.waitForTimeout(3000);
  } catch (e) {
    console.log('  English click failed: ' + e.message);
  }
  await page.screenshot({ path: path.join(outDir, '_after-bootstrap.png'), fullPage: false });

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
