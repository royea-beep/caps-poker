/**
 * AFTER captures (PR #6 + #7 merged, Vercel deployed a243e7e).
 * Uploads to Supabase `screenshots/caps-2026-05-23-card-visual-after/`.
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
const URL = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://gxrpunvhjcrzqnitbqah.supabase.co';
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const STATE = path.join(__dirname, 'caps-onboarded.json');
const FOLDER = 'caps-2026-05-23-card-visual-after';
const WIDTHS = [{w:320,h:568,l:'320'},{w:393,h:852,l:'393'},{w:430,h:932,l:'430'}];
const ROUTES = [{name:'game',path:'/game'},{name:'results',path:'/results'}];
(async () => {
  const browser = await chromium.launch({ headless: true });
  const sb = createClient(URL, KEY);
  const outDir = path.join(process.cwd(), FOLDER);
  fs.mkdirSync(outDir, { recursive: true });
  const results = [];
  for (const w of WIDTHS) {
    const ctx = await browser.newContext({
      viewport: { width: w.w, height: w.h }, deviceScaleFactor: 2, isMobile: true,
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
      storageState: fs.existsSync(STATE) ? STATE : undefined,
    });
    for (const r of ROUTES) {
      const page = await ctx.newPage();
      const tag = `${r.name}_${w.l}`;
      try {
        await page.goto('https://caps.ftable.co.il' + r.path, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await page.waitForTimeout(3500);
        const local = path.join(outDir, tag + '.png');
        await page.screenshot({ path: local, fullPage: false });
        const buf = fs.readFileSync(local);
        const { error } = await sb.storage.from('screenshots').upload(`${FOLDER}/${tag}.png`, buf, { contentType:'image/png', upsert:true });
        const url = error ? null : `${URL}/storage/v1/object/public/screenshots/${FOLDER}/${tag}.png`;
        results.push({ tag, url });
        console.log(`[after] ${tag.padEnd(14)} ${url ? '✅' : '❌'}`);
      } catch(e) { console.log(`[after] ${tag} ❌ ${e.message}`); }
      finally { await page.close(); }
    }
    await ctx.close();
  }
  await browser.close();
  console.log('\n=== URLs ===');
  results.forEach(r => console.log(`  ${r.tag.padEnd(14)} ${r.url}`));
})();
