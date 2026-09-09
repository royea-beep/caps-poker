/**
 * PURGE-AND-CLOSE · SECTION 2 — every closure tested from outside, and the app tested with it.
 *
 * Run live against production with the PUBLIC ANON KEY — the key that ships inside the web bundle
 * and the iOS binary, i.e. exactly what an attacker holds. No service-role key, no session, no
 * account.
 *
 * THREE THINGS ARE CHECKED, AND THE SECOND IS THE ONE THAT MATTERS:
 *
 *   1. MUST NOW REFUSE — a direct anon INSERT into each closed table.
 *   2. MUST STILL WORK — the app's real path to those same tables. Closing a table by breaking the
 *      product is not closing it. `track_event` writes analytics_events, `record_hand_result_d`
 *      drives the achievements trigger, `claim_daily_reward` writes daily_rewards, and every
 *      economy RPC writes chip_transactions. All are SECURITY DEFINER owned by postgres, so RLS
 *      does not apply to them — but that is an argument, and Iron Rule #14 says an argument is not
 *      evidence.
 *   3. DELIBERATELY STILL OPEN — deploy_log and prompt_execution_log, each with a named anon
 *      dependency. They are probed too, so the report states what IS open rather than implying
 *      everything closed.
 *
 * Rows written by part 2 are removed by the caller afterwards and the ledger totals re-read.
 *
 * Usage: node tests/verify-permissive-tables-closed.mjs [device_id]
 */

const URL = 'https://gxrpunvhjcrzqnitbqah.supabase.co';
const ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd4cnB1bnZoamNyenFuaXRicWFoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMzNTc5OTksImV4cCI6MjA4ODkzMzk5OX0.MLHYIbU4saCHq0eQbwUzyfAl_q9TLgepKf8iNDDav-Q';
const DEVICE = process.argv[2] || 'PAC-CLOSE-TEST';
const H = { apikey: ANON, Authorization: `Bearer ${ANON}`, 'Content-Type': 'application/json' };

const insert = async (table, body) => {
  const r = await fetch(`${URL}/rest/v1/${table}`, { method: 'POST', headers: H, body: JSON.stringify(body) });
  return { status: r.status, body: (await r.text()).slice(0, 130) };
};
const read = async (table) => {
  const r = await fetch(`${URL}/rest/v1/${table}?select=*&limit=1`, { headers: H });
  return { status: r.status, body: (await r.text()).slice(0, 130) };
};
const rpc = async (name, args) => {
  const r = await fetch(`${URL}/rest/v1/rpc/${name}`, { method: 'POST', headers: H, body: JSON.stringify(args) });
  return { status: r.status, body: (await r.text()).slice(0, 180) };
};

/** A permission refusal, as opposed to a schema complaint. Only this counts as closed. */
const DENIED = (r) => /42501|permission denied|violates row-level security/i.test(r.body);

const CLOSED = [
  ['analytics_events',        { device_id: DEVICE, event_name: 'pac_probe' }],
  ['chip_transactions',       { device_id: DEVICE, amount: 1000000, action: 'credit', event_type: 'pac_probe' }],
  ['achievements',            { device_id: DEVICE, achievement_id: 'pac_probe' }],
  ['daily_rewards',           { device_id: DEVICE, day_number: 1 }],
  ['device_cups',             { device_id: DEVICE, cup_id: 'diamond' }],
  ['economy_log',             { device_id: DEVICE, event_type: 'pac_probe', amount: 999999 }],
  // ⚠️ CORRECTLY SHAPED ON PURPOSE. The first run sent {session_name} — a column that does not
  // exist — and got a 400 schema error, which proves nothing about permissions. That is the same
  // "a 400 is not a closed door" rule this project wrote last sprint, turned back on my own probe.
  // These are the real NOT NULL columns, so the request reaches the policy.
  ['debug_sessions',          { project: 'caps', session_id: 'pac_probe', step_number: 1, step_type: 'probe', description: 'pac probe' }],
  ['learning_events',         { project: 'caps', event: 'pac_probe', version: '1' }],
  ['starter_pack_redemptions',{ device_id: DEVICE, chips_received: 999999 }],
];
const STILL_OPEN = [
  ['deploy_log',           { type: 'pac_probe', version: '0', message: 'pac probe' }, 'scripts/deploy-ota.sh:20 posts here with the anon key'],
  ['prompt_execution_log', { project_slug: 'caps', prompt_id: 'pac_probe' },           'log_prompt_invocation is SECURITY INVOKER and anon-callable'],
];

console.log(`\nPURGE-AND-CLOSE — every closure probed live with the PUBLIC anon key\n`);

console.log('  1 · MUST REFUSE — direct anon INSERT');
let leaked = [];
for (const [t, body] of CLOSED) {
  const r = await insert(t, body);
  const ok = DENIED(r);
  if (!ok) leaked.push(t);
  console.log(`     ${t.padEnd(26)} http ${String(r.status).padEnd(4)} ${ok ? '✓ refused' : '✗ STILL ACCEPTS'}  ${ok ? '' : r.body}`);
}

console.log('\n  1b · MUST REFUSE — anon SELECT on the two tables whose read side also closed');
for (const t of ['analytics_events', 'chip_transactions']) {
  const r = await read(t);
  const ok = DENIED(r) || r.status === 401 || r.status === 403;
  if (!ok) leaked.push(`${t} (read)`);
  console.log(`     ${t.padEnd(26)} http ${String(r.status).padEnd(4)} ${ok ? '✓ refused' : '✗ STILL READABLE'}  ${ok ? '' : r.body}`);
}

console.log('\n  2 · MUST STILL WORK — the app\'s own paths to the same tables');
let broken = [];
const APP = [
  ['track_event',            { p_event: 'pac_probe', p_user_id: null, p_device_id: DEVICE, p_data: {}, p_screen: 'test' }, 'writes analytics_events'],
  ['record_hand_net',        { p_device_id: DEVICE, p_net: 10, p_hand_id: `${DEVICE}-h1`, p_is_practice: true },           'writes chip_transactions'],
  ['earn_chips',             { p_device_id: DEVICE, p_event_type: 'hand_won', p_amount: 10 },                              'writes chip_transactions'],
  ['claim_daily_reward',     { p_device_id: DEVICE },                                                                     'writes daily_rewards'],
  ['claim_daily_streak',     { p_device_id: DEVICE },                                                                     'writes chip_transactions'],
  ['record_hand_result_d',   { p_device_id: DEVICE, p_won: true, p_boards_won: 3, p_boards_total: 4, p_session_type: 'practice', p_client_hand_id: `${DEVICE}-r1` }, 'fires the achievements trigger'],
  ['claim_low_chip_rescue',  { p_device_id: DEVICE },                                                                     'newly guarded faucet'],
  ['claim_winback_rescue',   { p_device_id: DEVICE },                                                                     'newly guarded faucet'],
];
for (const [name, args, what] of APP) {
  const r = await rpc(name, args);
  const ok = r.status === 200 && !DENIED(r);
  if (!ok) broken.push(name);
  console.log(`     ${name.padEnd(26)} http ${String(r.status).padEnd(4)} ${ok ? '✓ ran' : '✗ BROKEN'}  (${what})`);
  console.log(`        ${r.body}`);
}

console.log('\n  3 · DELIBERATELY STILL OPEN — each with a named dependency');
for (const [t, body, why] of STILL_OPEN) {
  const r = await insert(t, body);
  console.log(`     ${t.padEnd(26)} http ${String(r.status).padEnd(4)} ${DENIED(r) ? 'refused' : 'open'} — ${why}`);
}

console.log(`\n  tables still accepting anon writes/reads that should not : ${leaked.length ? leaked.join(', ') : 'none'}`);
console.log(`  app paths broken by the closures                         : ${broken.length ? broken.join(', ') : 'none'}\n`);
process.exit(leaked.length === 0 && broken.length === 0 ? 0 : 1);
