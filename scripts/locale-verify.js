// Re-screenshot the 5 locale-fixed screens after picking English
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const envPath = path.join(process.cwd(), '.env');
if (fs.existsSync(envPath)) {
  const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq === -1) continue;
    const k = t.slice(0, eq).trim();
    let v = t.slice(eq + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    if (!process.env[k]) process.env[k] = v;
  }
}

const SUPABASE_URL = 'https://gxrpunvhjcrzqnitbqah.supabase.co';
const sb = createClient(SUPABASE_URL, process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY);

const SCREENS = [
  { name: 'profile',      path: '/profile' },
  { name: 'friends',      path: '/friends' },
  { name: 'host',         path: '/lobby/host' },
  { name: 'join',         path: '/lobby/join' },
  { name: 'hand-history', path: '/hand-history' },
];

const DATE_TAG = '2026-05-19-v7';

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

  console.log('Bootstrap: English -> SELECT -> SELECT');
  await page.goto('https://caps.ftable.co.il/', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(2000);
  try { await page.getByText('English').first().click({ timeout: 5000 }); await page.waitForTimeout(3000); } catch {}
  try { await page.getByText('SELECT').first().click({ timeout: 5000 }); await page.waitForTimeout(3000); } catch {}
  try { await page.getByText('SELECT').first().click({ timeout: 5000 }); await page.waitForTimeout(3000); } catch {}

  const results = [];
  for (const s of SCREENS) {
    const url = `https://caps.ftable.co.il${s.path}`;
    console.log('-> ' + url);
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(2500);
    const localPath = path.join(outDir, `${s.name}.png`);
    await page.screenshot({ path: localPath, fullPage: false });

    const bodyText = await page.locator('body').innerText();
    // Hebrew detection — count Hebrew chars
    const hebrewChars = (bodyText.match(/[֐-׿]/g) || []).length;
    const totalChars = bodyText.length;
    const hebrewPct = totalChars > 0 ? (hebrewChars / totalChars * 100).toFixed(1) : 0;

    // Upload to Supabase
    const buf = fs.readFileSync(localPath);
    const storagePath = `caps-${DATE_TAG}/${s.name}.png`;
    const { error } = await sb.storage.from('screenshots').upload(storagePath, buf, { contentType: 'image/png', upsert: true });
    const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/screenshots/${storagePath}`;
    if (error) {
      console.log(`  upload failed: ${error.message}`);
      results.push({ name: s.name, hebrewPct, hebrewChars, totalChars, error: error.message, local: localPath });
    } else {
      console.log(`  OK -> ${publicUrl}  (hebrew=${hebrewChars}/${totalChars}, ${hebrewPct}%)`);
      results.push({ name: s.name, hebrewPct, hebrewChars, totalChars, url: publicUrl });
    }
  }

  await browser.close();
  console.log('\n=== RESULTS ===');
  console.log(JSON.stringify(results, null, 2));
  fs.writeFileSync(path.join(outDir, 'urls.json'), JSON.stringify(results, null, 2));
})();
