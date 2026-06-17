const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const envPath = 'C:/Projects/POKER/Caps/.env';
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

const SUPABASE_URL = 'https://gxrpunvhjcrzqnitbqah.supabase.co';
const KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
if (!KEY) { console.error('Missing EXPO_PUBLIC_SUPABASE_ANON_KEY'); process.exit(1); }
const sb = createClient(SUPABASE_URL, KEY);

(async () => {
  const local = 'C:/Projects/POKER/Caps/caps-ux-audit/2026-06-08/spacing/2p.png';
  const buf = fs.readFileSync(local);
  const storagePath = `caps-ux-audit/2026-06-08/spacing/2p.png`;
  const { error } = await sb.storage.from('screenshots').upload(storagePath, buf, {
    contentType: 'image/png',
    upsert: true,
  });
  const url = `${SUPABASE_URL}/storage/v1/object/public/screenshots/${storagePath}`;
  if (error) { console.log(`FAIL: ${error.message}`); process.exit(1); }
  console.log(`OK -> ${url} (${buf.length}b)`);
})().catch(e => { console.error(e); process.exit(1); });
