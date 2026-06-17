// VAMOS-CAPS-SCREENSHOT-REALITY-CHECK 2026-05-19
// Screenshots all 14 priority screens at iPhone 14 viewport,
// uploads to Supabase Storage (bucket: screenshots), prints public URLs.

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// Load .env manually so EXPO_PUBLIC_SUPABASE_* are available
try {
  const envPath = path.join(process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      if (!process.env[key]) process.env[key] = value;
    }
  }
} catch (_) {
  // env loading failed; rely on existing process.env
}

const SUPABASE_URL =
  process.env.EXPO_PUBLIC_SUPABASE_URL ||
  'https://gxrpunvhjcrzqnitbqah.supabase.co';
const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_KEY) {
  console.error('ERROR: no SUPABASE key available in env. Set SUPABASE_SERVICE_ROLE_KEY or EXPO_PUBLIC_SUPABASE_ANON_KEY.');
  process.exit(1);
}

const SCREENS = [
  { name: 'home',         path: '/' },
  { name: 'game',         path: '/game' },
  { name: 'settings',     path: '/settings' },
  { name: 'leaderboard',  path: '/leaderboard' },
  { name: 'profile',      path: '/profile' },
  { name: 'play',         path: '/play' },
  { name: 'friends',      path: '/friends' },
  { name: 'cups',         path: '/cups' },
  { name: 'shop',         path: '/shop' },
  { name: 'chip-store',   path: '/chip-store' },
  { name: 'host',         path: '/lobby/host' },
  { name: 'join',         path: '/lobby/join' },
  { name: 'rank',         path: '/rank' },
  { name: 'hand-history', path: '/hand-history' },
];

const DATE_TAG = '2026-05-19';

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({
    viewport: { width: 393, height: 852 },
    deviceScaleFactor: 3,
    isMobile: true,
    userAgent:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
  });
  const page = await ctx.newPage();

  const sb = createClient(SUPABASE_URL, SUPABASE_KEY);
  const outDir = path.join(process.cwd(), `reality-check-${DATE_TAG}`);
  fs.mkdirSync(outDir, { recursive: true });

  const results = [];

  for (const s of SCREENS) {
    const url = `https://caps.ftable.co.il${s.path}`;
    console.log(`Loading: ${url}`);
    try {
      await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
      await page.waitForTimeout(2500);
      const localPath = path.join(outDir, `${s.name}.png`);
      await page.screenshot({ path: localPath, fullPage: false });

      const fileBuf = fs.readFileSync(localPath);
      const storagePath = `caps-${DATE_TAG}/${s.name}.png`;
      const { error: upErr } = await sb.storage
        .from('screenshots')
        .upload(storagePath, fileBuf, {
          contentType: 'image/png',
          upsert: true,
        });

      if (upErr) {
        console.error(`Upload failed for ${s.name}: ${upErr.message}`);
        results.push({ name: s.name, error: upErr.message });
        continue;
      }

      const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/screenshots/${storagePath}`;
      console.log(`OK ${s.name} -> ${publicUrl}`);
      results.push({ name: s.name, url: publicUrl });
    } catch (e) {
      console.error(`Failed ${s.name}: ${e.message}`);
      results.push({ name: s.name, error: e.message });
    }
  }

  await browser.close();

  console.log('\n=== RESULTS ===');
  console.log(JSON.stringify(results, null, 2));
  fs.writeFileSync(path.join(outDir, 'urls.json'), JSON.stringify(results, null, 2));
})();
