const fs = require('fs');
const path = require('path');
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

const LOCAL_DIR = 'C:/Projects/POKER/Caps/caps-ux-audit/2026-06-08/native-verify';
const REMOTE_PREFIX = 'caps-ux-audit/2026-06-08/native-verify';

(async () => {
  const files = fs.readdirSync(LOCAL_DIR).filter((f) => f.endsWith('.png')).sort();
  const out = [];
  for (const f of files) {
    const buf = fs.readFileSync(path.join(LOCAL_DIR, f));
    const remote = `${REMOTE_PREFIX}/${f}`;
    const { error } = await sb.storage.from('screenshots').upload(remote, buf, { contentType: 'image/png', upsert: true });
    const url = `${SUPABASE_URL}/storage/v1/object/public/screenshots/${remote}`;
    if (error) { console.log(`FAIL ${f}: ${error.message}`); continue; }
    console.log(`OK ${f} ${buf.length}b -> ${url}`);
    out.push({ f, url, bytes: buf.length });
  }
  console.log(`\nUploaded ${out.length}/${files.length}`);
})().catch(e => { console.error(e); process.exit(1); });
