/**
 * PR-B BEFORE captures — VAMOS-CAPS-B153 polish, 2026-05-24
 * Captures /game (placement) + /results at iPhone 14 width (393×852),
 * uploads to Supabase `screenshots/caps-2026-05-24-prb-before/`.
 *
 * Mid-placement (12/4 cards) + ready + reveal require interactive driving;
 * this captures the deterministic initial states first.
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

const URL_BASE = 'https://caps.ftable.co.il';
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://gxrpunvhjcrzqnitbqah.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const STATE = path.join(__dirname, 'caps-onboarded.json');
const FOLDER = 'caps-2026-05-24-prb-before';

if (!SUPABASE_KEY) { console.error('NO SUPABASE KEY'); process.exit(1); }

(async () => {
  const browser = await chromium.launch({ headless: true });
  const sb = createClient(SUPABASE_URL, SUPABASE_KEY);
  const outDir = path.join(process.cwd(), FOLDER);
  fs.mkdirSync(outDir, { recursive: true });

  const ctx = await browser.newContext({
    viewport: { width: 393, height: 852 },
    deviceScaleFactor: 2,
    isMobile: true,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
    storageState: fs.existsSync(STATE) ? STATE : undefined,
  });

  const results = [];

  const snap = async (tag, urlPath, opts = {}) => {
    const page = await ctx.newPage();
    try {
      await page.goto(URL_BASE + urlPath, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(opts.wait || 4500);
      if (opts.before) await opts.before(page);
      const local = path.join(outDir, tag + '.png');
      await page.screenshot({ path: local, fullPage: false });
      const buf = fs.readFileSync(local);
      const { error } = await sb.storage.from('screenshots').upload(`${FOLDER}/${tag}.png`, buf, { contentType: 'image/png', upsert: true });
      const url = error ? null : `${SUPABASE_URL}/storage/v1/object/public/screenshots/${FOLDER}/${tag}.png`;
      results.push({ tag, url, err: error?.message });
      console.log(`[before] ${tag.padEnd(28)} ${url ? 'OK' : 'FAIL ' + (error?.message || '')}`);
    } catch (e) {
      console.log(`[before] ${tag.padEnd(28)} ERR  ${e.message}`);
      results.push({ tag, url: null, err: e.message });
    } finally {
      await page.close();
    }
  };

  // 1. Initial placement view (16 cards in hand, 0 placed; boards empty)
  await snap('game_placement_initial_393', '/game');

  // 2. Try mid-placement by tapping the auto-place button if present
  await snap('game_after_autoplace_393', '/game', {
    wait: 3500,
    before: async (page) => {
      // try to click auto-place button (labels: 'Auto-Place' or '⚡ מיקום אוטומטי' or 'אוטומטי')
      const candidates = [
        'text=/auto[- ]place/i',
        'text=/אוטומטי/',
        '[aria-label*="auto"i]',
        '[aria-label*="אוטומטי"]',
      ];
      for (const sel of candidates) {
        try {
          const el = await page.$(sel);
          if (el) { await el.click({ timeout: 1500 }); await page.waitForTimeout(2000); return; }
        } catch (_) {}
      }
    },
  });

  // 3. Results route
  await snap('results_393', '/results');

  await ctx.close();
  await browser.close();

  console.log('\n=== URLs ===');
  results.forEach(r => console.log(`  ${r.tag.padEnd(28)} ${r.url || '(' + (r.err || 'no url') + ')'}`));
})();
