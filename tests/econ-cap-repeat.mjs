/**
 * Which economy RPCs are actually capped? Tested by REPEATING THE SAME device_id.
 *
 * This is the whole point: an earlier audit called claim_daily_reward "uncapped" after ten calls
 * with ten DIFFERENT device ids — which is ten legitimate first-time claims, not a cap failure.
 * A cap only shows up when the same key is used twice.
 *
 * Runs as anon on the wire against a probe device that HAS a leaderboard row (a call against a
 * device with no row can return "success" without ever crediting anything).
 *
 *   CAPS_ANON_KEY=... PROBE_DEVICE=probe-cap-9y node tests/econ-cap-repeat.mjs
 */
const URL = 'https://gxrpunvhjcrzqnitbqah.supabase.co';
const ANON = process.env.CAPS_ANON_KEY;
const DEV = process.env.PROBE_DEVICE || 'probe-cap-9y';
if (!ANON) { console.error('Set CAPS_ANON_KEY.'); process.exit(2); }
const H = { apikey: ANON, Authorization: `Bearer ${ANON}`, 'Content-Type': 'application/json' };

const rpc = async (fn, args) => {
  const r = await fetch(`${URL}/rest/v1/rpc/${fn}`, { method: 'POST', headers: H, body: JSON.stringify(args) });
  let b; try { b = await r.json(); } catch { b = null; }
  return { status: r.status, body: b };
};

// Same arguments every time — including the same mission/share/referral key — so a second call
// is a genuine repeat, not a new claim.
const CASES = [
  ['claim_daily_reward',   { p_device_id: DEV }],
  ['claim_daily_streak',   { p_device_id: DEV }],
  ['claim_low_chip_rescue',{ p_device_id: DEV }],
  ['claim_winback_rescue', { p_device_id: DEV }],
  ['claim_mission_d',      { p_device_id: DEV, p_mission_id: 'probe_mission_1' }],
  ['claim_share_reward',   { p_device_id: DEV, p_share_id: 'probe_share_1' }],
  ['record_reward',        { p_device_id: DEV, p_amount: 100, p_event_type: 'probe_reward', p_once: true }],
  ['earn_chips',           { p_device_id: DEV, p_event_type: 'hand_won', p_amount: 100 }],
  ['submit_score',         { p_device_id: DEV, p_player_name: 'Probe', p_total_chips: 999999,
                             p_hands_played: 1, p_hands_won: 1, p_biggest_win: 1 }],
];

const bal = async () => {
  const r = await fetch(`${URL}/rest/v1/rpc/get_poker_shop`, {
    method: 'POST', headers: H, body: JSON.stringify({ p_device_id: DEV }) });
  const b = await r.json().catch(() => null);
  return b && typeof b.balance === 'number' ? b.balance : null;
};

console.log(`probe device ${DEV} — every call repeated with the SAME arguments\n`);
for (const [fn, args] of CASES) {
  const before = await bal();
  const a = await rpc(fn, args);
  const mid = await bal();
  const b = await rpc(fn, args);
  const after = await bal();
  const d1 = before != null && mid != null ? mid - before : null;
  const d2 = mid != null && after != null ? after - mid : null;
  // A cap means the SECOND identical call credits nothing.
  const capped = d2 === 0;
  console.log(`${fn.padEnd(23)} call1 ${String(a.status)} Δ${String(d1).padStart(6)} | call2 ${String(b.status)} Δ${String(d2).padStart(6)} | ${capped ? 'CAPPED on repeat' : '** NO CAP — repeat credited again'}`);
  console.log(`   call1 ${JSON.stringify(a.body).slice(0, 130)}`);
  console.log(`   call2 ${JSON.stringify(b.body).slice(0, 130)}`);
}
console.log('\nΔ is the change in get_poker_shop balance. A capped RPC shows Δ0 on the second call.');
