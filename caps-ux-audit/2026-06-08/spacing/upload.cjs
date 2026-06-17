'use strict';
process.env.NODE_PATH = 'C:/Projects/POKER/Caps/node_modules';
require('module').Module._initPaths();
const { createClient } = require('C:/Projects/POKER/Caps/node_modules/@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const SUPABASE_URL = 'https://gxrpunvhjcrzqnitbqah.supabase.co';
// Load .env
try {
  const envPath = path.join('C:/Projects/POKER/Caps', '.env');
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
} catch (_) {}

const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_KEY) {
  console.error('NEED SUPABASE key (SERVICE_ROLE or ANON)');
  process.exit(1);
}

const supa = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function uploadOne(localPath, storagePath) {
  const buf = fs.readFileSync(localPath);
  const { data, error } = await supa.storage
    .from('screenshots')
    .upload(storagePath, buf, { contentType: 'image/png', upsert: true });
  if (error) throw error;
  return data;
}

async function main() {
  const items = [
    ['caps-ux-audit/2026-06-08/spacing/4board-placement.png', 'caps-ux-audit/2026-06-08/spacing/4board-placement.png'],
    ['caps-ux-audit/2026-06-08/spacing/4board-ready.png', 'caps-ux-audit/2026-06-08/spacing/4board-ready.png'],
  ];
  for (const [local, remote] of items) {
    const full = path.resolve('C:/Projects/POKER/Caps', local);
    const r = await uploadOne(full, remote);
    const { data: pub } = supa.storage.from('screenshots').getPublicUrl(remote);
    console.log('UPLOADED:', remote, 'url=', pub.publicUrl);
  }
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
