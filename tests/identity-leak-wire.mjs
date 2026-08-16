/**
 * Are the four identity columns actually gone FROM THE WIRE?
 *
 * information_schema is a necessary check, not a sufficient one — grants and RLS can disagree
 * with what the payload contains. So this makes real anon HTTPS requests to PostgREST and reads
 * the response body.
 *
 * Every table queried here HAS ROWS (game_rooms 11, clubs 1, club_members 2,
 * sit_and_go_players 36). A query against an empty table returns [] and looks identical to a
 * successful block — it would prove nothing.
 *
 * Also calls the RPCs the screens actually use, because a revoke that silences a leak by
 * breaking the lobby is not a fix.
 *
 *   node tests/identity-leak-wire.mjs
 */
const URL = 'https://gxrpunvhjcrzqnitbqah.supabase.co';
const ANON = process.env.CAPS_ANON_KEY;
if (!ANON) { console.error('Set CAPS_ANON_KEY (the public anon key) in the environment.'); process.exit(2); }
const H = { apikey: ANON, Authorization: `Bearer ${ANON}` };

const IDENTITY = {
  game_rooms: ['host_id'],
  clubs: ['owner_device_id', 'owner_user_id'],
  club_members: ['device_id'],
  sit_and_go_players: ['device_id'],
};

const get = async (path) => {
  const res = await fetch(`${URL}/rest/v1/${path}`, { headers: H });
  let body;
  try { body = await res.json(); } catch { body = null; }
  return { status: res.status, body };
};

console.log('=== anon reads of the four tables (rows exist in every one) ===\n');
let leaks = 0;
for (const [table, cols] of Object.entries(IDENTITY)) {
  // 1. Whole-row read: the broadest thing an attacker would try.
  const all = await get(`${table}?select=*&limit=2`);
  const rows = Array.isArray(all.body) ? all.body : [];
  const keys = rows.length ? Object.keys(rows[0]) : [];
  const exposed = keys.filter((k) => cols.includes(k));
  console.log(`${table}`);
  console.log(`  select=*      status ${all.status} | rows ${rows.length} | keys ${JSON.stringify(keys)}`);
  if (!rows.length) console.log(`                 body ${JSON.stringify(all.body).slice(0, 120)}`);
  if (exposed.length) { leaks++; console.log(`  ** LEAK: ${JSON.stringify(exposed)} present in the payload`); }

  // 2. Ask for the identity column BY NAME — a whole-row block could still leave a targeted
  //    read working if the grant were column-scoped rather than removed.
  for (const c of cols) {
    const one = await get(`${table}?select=${c}&limit=2`);
    const got = Array.isArray(one.body) && one.body.length ? Object.keys(one.body[0]) : [];
    const bad = got.includes(c);
    if (bad) leaks++;
    console.log(`  select=${c.padEnd(16)} status ${one.status} | ${bad ? '** LEAK — value returned' : 'blocked/absent'}`);
  }
  console.log('');
}

console.log('=== the screens must still work ===\n');
const rpc = async (fn, args) => {
  const res = await fetch(`${URL}/rest/v1/rpc/${fn}`, {
    method: 'POST', headers: { ...H, 'Content-Type': 'application/json' }, body: JSON.stringify(args ?? {}),
  });
  let body; try { body = await res.json(); } catch { body = null; }
  return { status: res.status, body };
};

const checks = [
  ['list_public_tables', {}, 'lobby table list'],
  ['list_open_tables', {}, 'open tables'],
  ['get_sng_activity_feed', { p_device_id: 'wire-probe-none', p_limit: 5 }, 'home activity feed'],
  ['my_clubs', { p_device_id: 'wire-probe-none', p_user_id: null }, 'my clubs'],
];
let broken = 0;
for (const [fn, args, label] of checks) {
  const r = await rpc(fn, args);
  const n = Array.isArray(r.body) ? r.body.length : (r.body == null ? 0 : 1);
  const ok = r.status === 200;
  if (!ok) broken++;
  const flat = JSON.stringify(r.body);
  // An RPC that returns rows must not smuggle the identity column either.
  const smuggled = ['host_id', 'owner_device_id', 'device_id'].filter((c) => new RegExp(`"${c}"`).test(flat || ''));
  if (smuggled.length) { leaks++; }
  console.log(`${fn.padEnd(22)} ${label.padEnd(20)} status ${r.status} | items ${n} | ${ok ? 'OK' : '** BROKEN'}${smuggled.length ? ` | ** RPC LEAKS ${JSON.stringify(smuggled)}` : ''}`);
  if (!ok) console.log(`   ${flat?.slice(0, 160)}`);
}

console.log(`\n=== ${leaks === 0 && broken === 0 ? 'PASS — no identity column on the wire, no RPC broken'
  : `FAIL — leaks ${leaks}, broken RPCs ${broken}`} ===`);
process.exit(leaks === 0 && broken === 0 ? 0 : 1);
