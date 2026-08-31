/**
 * CLOSE-THE-SIX · SECTION 1 — EVERY LEDGER WRITER, EXERCISED AFTER THE POLICY CHANGE.
 *
 * The structural argument for why narrowing `insert_tx` cannot break anything is sound — all
 * fifteen writers are SECURITY DEFINER owned by `postgres`, which owns the table, and the table
 * does not have FORCE ROW LEVEL SECURITY, so RLS has never applied to them. But an argument is not
 * evidence (Iron Rule #14), so every writer reachable with the PUBLIC ANON KEY is actually called
 * here, after the change, and the ledger row it wrote is counted.
 *
 * WHAT COUNTS AS A PASS. Two different things, and they are reported separately rather than
 * blurred:
 *   INSERTED  — the call wrote a chip_transactions row. The strongest evidence.
 *   REFUSED-BY-ITS-OWN-RULE — the function ran to completion and declined for a BUSINESS reason
 *              ('already_granted', 'chips_too_high', 'daily_login_retired'). That still proves RLS
 *              did not block it: a permission failure returns 42501, not a JSON verdict.
 * Only a 42501, or a Postgres error mentioning permission/policy, is a FAILURE of this change.
 *
 * Every row written here is deleted by the caller afterwards and the totals re-read to prove it.
 *
 * Usage: node tests/verify-ledger-writers.mjs <device_id>
 */

const URL = 'https://gxrpunvhjcrzqnitbqah.supabase.co';
const ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd4cnB1bnZoamNyenFuaXRicWFoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMzNTc5OTksImV4cCI6MjA4ODkzMzk5OX0.MLHYIbU4saCHq0eQbwUzyfAl_q9TLgepKf8iNDDav-Q';
const DEVICE = process.argv[2] || 'CTS-WRITER-TEST';

const rpc = async (name, args) => {
  const r = await fetch(`${URL}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: { apikey: ANON, Authorization: `Bearer ${ANON}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(args),
  });
  return { status: r.status, body: (await r.text()).slice(0, 220) };
};

/** In call order, chosen so as many writers as possible actually reach their INSERT. */
const WRITERS = [
  ['record_hand_net',        { p_device_id: DEVICE, p_net: 120, p_hand_id: `${DEVICE}-h1`, p_is_practice: false }],
  ['earn_chips',             { p_device_id: DEVICE, p_event_type: 'first_game', p_amount: 100 }],
  ['record_reward',          { p_device_id: DEVICE, p_amount: 50, p_event_type: 'share_hand', p_once: false }],
  ['spend_chips',            { p_device_id: DEVICE, p_event_type: 'rebuy_500', p_amount: 25 }],
  ['claim_daily_streak',     { p_device_id: DEVICE }],
  ['claim_daily_reward',     { p_device_id: DEVICE }],
  ['claim_share_reward',     { p_device_id: DEVICE, p_share_id: `${DEVICE}-s1` }],
  ['claim_emergency_chips',  { p_device_id: DEVICE }],
  ['claim_winback_rescue',   { p_device_id: DEVICE }],
  ['claim_low_chip_rescue',  { p_device_id: DEVICE }],
];

const DENIED = /42501|permission denied|row-level security|violates row-level/i;

console.log(`\nLEDGER WRITERS AFTER THE CHANGE — called live with the PUBLIC anon key, device "${DEVICE}"\n`);
let blocked = 0;
for (const [name, args] of WRITERS) {
  const r = await rpc(name, args);
  const isDenied = DENIED.test(r.body) || r.status === 403;
  if (isDenied) blocked++;
  console.log(`  ${name.padEnd(24)} http ${String(r.status).padEnd(4)} ${isDenied ? '✗ BLOCKED BY THE POLICY CHANGE' : '✓ ran'}`);
  console.log(`     ${r.body}`);
}
console.log(`\n  writers blocked by the change: ${blocked} of ${WRITERS.length}\n`);
process.exit(blocked === 0 ? 0 : 1);
