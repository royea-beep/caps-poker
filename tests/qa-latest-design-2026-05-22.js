/**
 * Renders the LATEST shipped home design (Apr-23 `16cc825` Card Bible + home footer,
 * which IS an ancestor of HEAD 3b70560 — the commit that build 451 was compiled from).
 *
 * Captures the home in BOTH states (fresh vs onboarded) PLUS key screens, since the
 * 2650-line home tsx has conditional early-returns that produce different surface
 * areas depending on AsyncStorage state. Also captures fullPage to expose anything
 * below the fold on home.
 *
 * Uploads to Supabase `screenshots/caps-2026-05-22-latest-design/`.
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

try {
  const envPath = path.join(process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
      const t = line.trim(); if (!t || t.startsWith('#')) continue;
      const eq = t.indexOf('='); if (eq === -1) continue;
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
const FOLDER       = 'caps-2026-05-22-latest-design';
const SITE         = 'https://caps.ftable.co.il';

const TARGETS = [
  // (state, route, label, fullPage)
  { onboarded: false, route: '/',            tag: 'home_fresh_viewport',     full: false },
  { onboarded: false, route: '/',            tag: 'home_fresh_fullpage',     full: true },
  { onboarded: true,  route: '/',            tag: 'home_onboarded_viewport', full: false },
  { onboarded: true,  route: '/',            tag: 'home_onboarded_fullpage', full: true },
  { onboarded: true,  route: '/play',        tag: 'play_tab',                full: false },
  { onboarded: true,  route: '/cups',        tag: 'cups_tab',                full: false },
  { onboarded: true,  route: '/profile',     tag: 'profile_tab',             full: false },
  { onboarded: true,  route: '/friends',     tag: 'friends_tab',             full: false },
  { onboarded: true,  route: '/game',        tag: 'game_screen',             full: false },
  { onboarded: true,  route: '/settings',    tag: 'settings_full',           full: true },
  { onboarded: true,  route: '/leaderboard', tag: 'leaderboard_full',        full: true },
];

(async () => {
  const browser = await chromium.launch({ headless: true });
  const sb = createClient(SUPABASE_URL, SUPABASE_KEY);
  const outDir = path.join(process.cwd(), FOLDER);
  fs.mkdirSync(outDir, { recursive: true });

  const results = [];
  for (const t of TARGETS) {
    const opts = {
      viewport: { width: 393, height: 852 },
      deviceScaleFactor: 3,
      isMobile: true,
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
    };
    if (t.onboarded && fs.existsSync(STATE_PATH)) opts.storageState = STATE_PATH;
    const ctx = await browser.newContext(opts);
    const page = await ctx.newPage();
    try {
      await page.goto(SITE + t.route, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(3000);
      const local = path.join(outDir, t.tag + '.png');
      await page.screenshot({ path: local, fullPage: t.full });
      const buf = fs.readFileSync(local);
      const storagePath = FOLDER + '/' + t.tag + '.png';
      const { error } = await sb.storage.from('screenshots').upload(storagePath, buf, { contentType: 'image/png', upsert: true });
      const url = error ? null : SUPABASE_URL + '/storage/v1/object/public/screenshots/' + storagePath;
      // Body preview to flag what surface area actually rendered
      const bodyText = (await page.evaluate(() => (document.body?.innerText || ''))).replace(/\s+/g, ' ').slice(0, 200);
      results.push({ tag: t.tag, route: t.route, onboarded: t.onboarded, full: t.full, url, bodyPreview: bodyText });
      console.log('[design] ' + t.tag.padEnd(28) + (url ? '✅' : '❌ ' + (error?.message || '')) + '  body=' + bodyText.slice(0, 80));
    } catch (e) {
      results.push({ tag: t.tag, error: e.message });
      console.log('[design] ' + t.tag.padEnd(28) + '❌ ' + e.message);
    } finally {
      await page.close();
      await ctx.close();
    }
  }
  await browser.close();
  fs.writeFileSync(path.join(outDir, 'urls.json'), JSON.stringify(results, null, 2));
  console.log('\n=== URL LIST ===');
  for (const r of results) console.log('  ' + r.tag.padEnd(28) + ' ' + (r.url || 'ERROR'));
})();
