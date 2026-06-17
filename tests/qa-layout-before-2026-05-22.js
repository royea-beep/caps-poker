/**
 * BEFORE screenshots for the layout-stability investigation.
 * Captures key card-laden screens at multiple viewport widths so we can see
 * (a) static layout state per width
 * (b) whether responsive sizing produces obvious overflow at edge widths
 *
 * Routes: /game (4 boards + player hand), /results (card grid), /quick-poker
 * Widths: 320 (smallest iPhone), 393 (iPhone 14), 480 (max per Iron Rule), 768 (tablet, to see breakpoint behavior)
 *
 * Uploads to Supabase `screenshots/caps-2026-05-22-layout-before/`.
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
const FOLDER       = 'caps-2026-05-22-layout-before';
const SITE         = 'https://caps.ftable.co.il';

const ROUTES = [
  { name: 'game',        path: '/game' },
  { name: 'results',     path: '/results' },
  { name: 'quick_poker', path: '/quick-poker' },
];

// Iron Rule: 320–480pt — capture each end + iPhone 14 baseline + a tablet width to see breakpoint break
const WIDTHS = [
  { w: 320, h: 568, label: 'iphone_se_320' },
  { w: 393, h: 852, label: 'iphone_14_393' },
  { w: 480, h: 800, label: 'edge_480' },
  { w: 768, h: 1024, label: 'tablet_768' },
];

(async () => {
  const browser = await chromium.launch({ headless: true });
  const sb = createClient(SUPABASE_URL, SUPABASE_KEY);
  const outDir = path.join(process.cwd(), FOLDER);
  fs.mkdirSync(outDir, { recursive: true });

  const results = [];
  for (const wv of WIDTHS) {
    const opts = {
      viewport: { width: wv.w, height: wv.h },
      deviceScaleFactor: 2,
      isMobile: wv.w <= 480,
      userAgent: wv.w <= 480
        ? 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15'
        : 'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X)',
    };
    if (fs.existsSync(STATE_PATH)) opts.storageState = STATE_PATH;
    const ctx = await browser.newContext(opts);
    for (const r of ROUTES) {
      const page = await ctx.newPage();
      const url = SITE + r.path;
      const tag = `${r.name}__${wv.label}`;
      try {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await page.waitForTimeout(2800);
        const local = path.join(outDir, tag + '.png');
        await page.screenshot({ path: local, fullPage: false });
        const buf = fs.readFileSync(local);
        const storage = `${FOLDER}/${tag}.png`;
        const { error } = await sb.storage.from('screenshots').upload(storage, buf, { contentType: 'image/png', upsert: true });
        const publicUrl = error ? null : `${SUPABASE_URL}/storage/v1/object/public/screenshots/${storage}`;
        results.push({ tag, url, publicUrl, error: error?.message });
        console.log(`[before] ${tag.padEnd(34)} ${publicUrl ? '✅' : '❌'}`);
      } catch (e) {
        results.push({ tag, error: e.message });
        console.log(`[before] ${tag.padEnd(34)} ❌ ${e.message}`);
      } finally { await page.close(); }
    }
    await ctx.close();
  }
  await browser.close();
  fs.writeFileSync(path.join(outDir, 'urls.json'), JSON.stringify(results, null, 2));
  console.log('\n=== URLs ===');
  for (const r of results) console.log(`  ${r.tag.padEnd(34)} ${r.publicUrl || 'ERR'}`);
})();
