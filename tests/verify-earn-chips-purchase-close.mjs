/**
 * CLOSE-THE-SIX · SECTION 2 — the purchase door is shut, the anonymous door is not.
 *
 * The constraint on this fix was explicit: close the purchase grant WITHOUT locking out anonymous
 * players. That is two claims, so it is two sets of probes, both run live against production with
 * the PUBLIC ANON KEY and NO SESSION — the exact caller that got 6,500 chips before.
 *
 *   MUST NOW REFUSE : iap_starter_pack, starter_pack_2x            (real-money grants)
 *   MUST STILL WORK : every gameplay event type in the allowlist   (99.7% of devices are anonymous)
 *
 * The second half is the one that matters. A fix that closed the hole by making the RPC hostile to
 * anonymous callers would pass the first three lines and break the product.
 *
 * Every chip this writes is removed by the caller afterwards and the ledger totals re-read.
 *
 * Usage: node tests/verify-earn-chips-purchase-close.mjs <device_id>
 */

const URL = 'https://gxrpunvhjcrzqnitbqah.supabase.co';
const ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd4cnB1bnZoamNyenFuaXRicWFoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMzNTc5OTksImV4cCI6MjA4ODkzMzk5OX0.MLHYIbU4saCHq0eQbwUzyfAl_q9TLgepKf8iNDDav-Q';
const DEVICE = process.argv[2] || 'CTS-EARN-TEST';

const earn = async (event, amount) => {
  const r = await fetch(`${URL}/rest/v1/rpc/earn_chips`, {
    method: 'POST',
    headers: { apikey: ANON, Authorization: `Bearer ${ANON}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_device_id: DEVICE, p_event_type: event, p_amount: amount }),
  });
  return JSON.parse((await r.text()) || '{}');
};

/** The two that must now be refused — called with an absurd amount, as the original attack was. */
const PURCHASE = ['iap_starter_pack', 'starter_pack_2x'];
/** The gameplay allowlist, verbatim from the function. Small amounts so the daily cap is not hit. */
const GAMEPLAY = ['hand_won', 'first_game', 'share_hand', 'quick_poker_win', 'rebuy_500',
                  'streak_5_wins', 'sit_n_go_win', 'buy_emotes', 'buy_avatar', 'emergency_chips',
                  'low_chip_rescue', 'daily_streak', 'hand_win', 'quick_poker_buyin', 'quick_poker_buy_in'];

console.log(`\nearn_chips AFTER THE FIX — production, public anon key, NO SESSION, device "${DEVICE}"\n`);

let leaked = 0, lockedOut = 0;
console.log('  MUST REFUSE — real-money grants');
for (const e of PURCHASE) {
  const r = await earn(e, 999999);
  const paid = r.ok === true && (r.chips_earned ?? 0) > 0;
  if (paid) leaked++;
  console.log(`    ${e.padEnd(20)} ${paid ? '✗ STILL PAYS' : '✓ refused'}  ${JSON.stringify(r)}`);
}

console.log('\n  MUST STILL WORK — the anonymous gameplay path');
for (const e of GAMEPLAY) {
  const r = await earn(e, 10);
  // A business refusal (earn_cap_daily) still proves the path is open to an anonymous caller;
  // 'unknown_event_type' or a permission error would mean the allowlist was damaged.
  const open = r.ok === true || r.reason === 'earn_cap_daily';
  if (!open) lockedOut++;
  console.log(`    ${e.padEnd(20)} ${open ? '✓ open' : '✗ LOCKED OUT'}  ${JSON.stringify(r)}`);
}

console.log(`\n  real-money grants still paying : ${leaked} (must be 0)`);
console.log(`  gameplay grants locked out     : ${lockedOut} of ${GAMEPLAY.length} (must be 0)\n`);
process.exit(leaked === 0 && lockedOut === 0 ? 0 : 1);
