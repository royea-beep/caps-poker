/**
 * Post-451 visual verification — captures home/settings/game/leaderboard at
 * iPhone 14 viewport from caps.ftable.co.il (the Vercel-deployed web mirror
 * of the same source 451 was built from), uploads to Supabase Storage bucket
 * `screenshots` under caps-2026-05-22-v451/, prints public URLs.
 *
 * Used to confirm whether the May visual work is present in the deployed code
 * or whether something rolled back.
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

try {
  const envPath = path.join(process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
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
} catch (_) {}

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://gxrpunvhjcrzqnitbqah.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const STATE_PATH   = path.join(__dirname, 'caps-onboarded.json');
const FOLDER       = 'caps-2026-05-22-v451';

const ROUTES = [
  { name: 'home',        path: '/' },
  { name: 'settings',    path: '/settings' },
  { name: 'game',        path: '/game' },
  { name: 'leaderboard', path: '/leaderboard' },
];

(async () => {
  const browser = await chromium.launch({ headless: true });
  const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

  // Capture each route with a FRESH context (no storageState) so we see what a
  // first-time visitor lands on — that's the right comparison for Smart Defaults.
  // Also capture an onboarded context for game/settings.
  const outDir = path.join(process.cwd(), FOLDER);
  fs.mkdirSync(outDir, { recursive: true });
  const results = [];

  for (const onboarded of [false, true]) {
    const ctxOpts = {
      viewport: { width: 393, height: 852 },
      deviceScaleFactor: 3,
      isMobile: true,
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
    };
    if (onboarded && fs.existsSync(STATE_PATH)) ctxOpts.storageState = STATE_PATH;
    const ctx = await browser.newContext(ctxOpts);

    for (const r of ROUTES) {
      // For fresh context, only do home (Smart Defaults check); for onboarded, do all.
      if (!onboarded && r.name !== 'home') continue;
      const tag = onboarded ? r.name : 'home_fresh';
      const url = `https://caps.ftable.co.il${r.path}`;
      const page = await ctx.newPage();
      const consoleErrors = [];
      const pageErrors = [];
      page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text()); });
      page.on('pageerror', e => pageErrors.push(String(e?.message ?? e)));

      try {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await page.waitForTimeout(3500);
        const localPath = path.join(outDir, `${tag}.png`);
        await page.screenshot({ path: localPath, fullPage: false });
        const buf = fs.readFileSync(localPath);
        const storagePath = `${FOLDER}/${tag}.png`;
        const { error } = await sb.storage.from('screenshots').upload(storagePath, buf, { contentType: 'image/png', upsert: true });
        const publicUrl = error ? null : `${SUPABASE_URL}/storage/v1/object/public/screenshots/${storagePath}`;
        const bodyText = (await page.evaluate(() => document.body?.innerText || '')).slice(0, 300);
        results.push({ tag, url, publicUrl, uploadError: error?.message, bodyPreview: bodyText, pageErrors: pageErrors.slice(0, 3), consoleErrors: consoleErrors.slice(0, 3) });
        console.log(`[qa] ${tag.padEnd(14)} ${publicUrl ? '✅' : '❌'}  body=${bodyText.replace(/\s+/g, ' ').slice(0, 80)}`);
      } catch (e) {
        results.push({ tag, url, error: String(e.message) });
        console.log(`[qa] ${tag.padEnd(14)} ❌ ${e.message}`);
      } finally {
        await page.close();
      }
    }
    await ctx.close();
  }

  await browser.close();
  fs.writeFileSync(path.join(outDir, 'urls.json'), JSON.stringify(results, null, 2));
  console.log('\n=== RESULTS JSON ===');
  console.log(JSON.stringify(results.map(r => ({ tag: r.tag, url: r.publicUrl, bodyPreview: r.bodyPreview })), null, 2));
})();
