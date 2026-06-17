// Upload existing screenshots (from v5 bootstrap run) to Supabase Storage
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
const KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const sb = createClient(SUPABASE_URL, KEY);

// Use v5 dir (real screens after onboarding bootstrap), not v1 (all splash screens)
const dir = path.join(process.cwd(), 'reality-check-2026-05-19-v5');
const files = fs.readdirSync(dir)
  .filter(f => f.endsWith('.png'))
  .filter(f => !f.startsWith('_')); // skip bootstrap/probe shots, only upload the 14 named screens

(async () => {
  const results = [];
  for (const f of files) {
    const buf = fs.readFileSync(path.join(dir, f));
    const storagePath = `caps-2026-05-19/${f}`;
    const { error } = await sb.storage.from('screenshots').upload(storagePath, buf, {
      contentType: 'image/png',
      upsert: true,
    });
    const url = `${SUPABASE_URL}/storage/v1/object/public/screenshots/${storagePath}`;
    if (error) {
      results.push({ file: f, error: error.message });
      console.log(`FAIL ${f}: ${error.message}`);
    } else {
      results.push({ file: f, url, size: buf.length });
      console.log(`OK ${f} -> ${url} (${buf.length}b)`);
    }
  }
  console.log('\n=== JSON ===');
  console.log(JSON.stringify(results, null, 2));
})();
