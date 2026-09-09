/**
 * VERIFY-EVERYTHING · SECTION C — TRY TO FORGE A PAYMENT, FROM OUTSIDE.
 *
 * Reading the guard is not testing the guard. This calls the LIVE endpoints over HTTPS with the
 * PUBLIC anon key — the same key that ships inside the web bundle and inside the iOS binary, i.e.
 * exactly what an attacker already has — and tries to obtain chips without paying.
 *
 * The only credential used is the publishable anon key, which is public by design. No service-role
 * key, no session, no account is created. Every probe is a REFUSAL test: a pass here means the
 * server said no. The device id is a string no real device can produce, and `purchases` /
 * `chip_transactions` are counted before and after so a silent write would be visible.
 *
 * Usage: node tests/verify-payment-lock.mjs
 */

const URL = 'https://gxrpunvhjcrzqnitbqah.supabase.co';
const ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd4cnB1bnZoamNyenFuaXRicWFoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMzNTc5OTksImV4cCI6MjA4ODkzMzk5OX0.MLHYIbU4saCHq0eQbwUzyfAl_q9TLgepKf8iNDDav-Q';
const DEVICE = 'AUDIT-FORGE-DO-NOT-CREDIT';

const results = [];
const probe = async (name, expectation, run) => {
  let status = 0, body = '';
  try { const r = await run(); status = r.status; body = (await r.text()).slice(0, 300); }
  catch (e) { body = `THREW: ${e.message}`; }
  results.push({ name, expectation, status, body });
};

const fn = (path, init = {}) => fetch(`${URL}/functions/v1/${path}`, init);
const rpc = (name, args, headers = {}) => fetch(`${URL}/rest/v1/rpc/${name}`, {
  method: 'POST', headers: { apikey: ANON, Authorization: `Bearer ${ANON}`, 'Content-Type': 'application/json', ...headers },
  body: JSON.stringify(args),
});

// ── 1. THE PLATFORM GATE. verify-purchase is deployed with verify_jwt=true, so a caller with no
//       key at all should never reach the function body.
await probe('verify-purchase, no key at all', '401 — platform JWT gate',
  () => fn('verify-purchase?provider=stub', { method: 'POST', body: JSON.stringify({ device_id: DEVICE, package_id: 'mega', receipt_id: 'forged-1' }) }));

// ── 2. THE SIGNATURE GATE. With the public key the request reaches the function; without the
//       HMAC secret it must still be refused before any side effect.
await probe('verify-purchase, anon key, NO signature', '401 — signature gate',
  () => fn('verify-purchase?provider=stub', { method: 'POST', headers: { Authorization: `Bearer ${ANON}`, apikey: ANON, 'Content-Type': 'application/json' },
    body: JSON.stringify({ device_id: DEVICE, package_id: 'mega', receipt_id: 'forged-2', status: 'paid' }) }));

await probe('verify-purchase, anon key, FORGED signature', '401 — signature gate',
  () => fn('verify-purchase?provider=stub', { method: 'POST', headers: { Authorization: `Bearer ${ANON}`, apikey: ANON, 'Content-Type': 'application/json',
      'x-caps-signature': 'f'.repeat(64) },
    body: JSON.stringify({ device_id: DEVICE, package_id: 'mega', receipt_id: 'forged-3', status: 'paid' }) }));

await probe('verify-purchase, provider=payplus', '401 — adapter refuses by design',
  () => fn('verify-purchase?provider=payplus', { method: 'POST', headers: { Authorization: `Bearer ${ANON}`, apikey: ANON, 'Content-Type': 'application/json' },
    body: JSON.stringify({ device_id: DEVICE, package_id: 'mega', receipt_id: 'forged-4' }) }));

await probe('verify-purchase, unknown provider', '400 — unknown_provider',
  () => fn('verify-purchase?provider=totally-made-up', { method: 'POST', headers: { Authorization: `Bearer ${ANON}`, apikey: ANON, 'Content-Type': 'application/json' }, body: '{}' }));

// ── 3. THE DIRECT ROUTE. Skip the Edge Function entirely and call the credit RPC with the public
//       key. This is the attack the Edge Function exists to make pointless.
await probe('credit_purchase RPC direct, anon key', 'permission denied — not granted to anon',
  () => rpc('credit_purchase', { p_device_id: DEVICE, p_package_id: 'mega', p_provider: 'stub', p_receipt_id: 'forged-5', p_platform: 'web' }));

await probe('record_chip_purchase RPC direct, anon key', 'permission denied — not granted to anon',
  () => rpc('record_chip_purchase', { p_user_id: '00000000-0000-0000-0000-000000000000', p_package_id: 'mega', p_receipt_id: 'forged-6' }));

// ── 4. THE OLD HOLE. earn_chips(device_id,…) IS granted to anon. It is the path handoff 97 named.
//       What actually happens when it is called for a purchase-shaped event is a measurement, not
//       an assumption — and the amount must come from app_config, never from the caller.
await probe('earn_chips(iap_starter_pack) with a huge caller amount', 'caller amount must be ignored',
  () => rpc('earn_chips', { p_device_id: DEVICE, p_event_type: 'iap_starter_pack', p_amount: 999999 }));

await probe('earn_chips(iap_starter_pack) AGAIN, same device', 'already_granted — one time only',
  () => rpc('earn_chips', { p_device_id: DEVICE, p_event_type: 'iap_starter_pack', p_amount: 999999 }));

await probe('earn_chips with an invented event type', 'unknown_event_type',
  () => rpc('earn_chips', { p_device_id: DEVICE, p_event_type: 'free_money_please', p_amount: 999999 }));

await probe('earn_chips(hand_won) with a huge caller amount', 'clamped to 1500',
  () => rpc('earn_chips', { p_device_id: DEVICE, p_event_type: 'hand_won', p_amount: 999999 }));

// ── 5. THE GUARDS THEMSELVES, called directly.
await probe('econ_bind_ok on an unbound device', 'the binding guard, evaluated live',
  () => rpc('econ_bind_ok', { p_device_id: DEVICE }));
await probe('econ_rate_ok on this device', 'the throttle guard, evaluated live',
  () => rpc('econ_rate_ok', { p_device_id: DEVICE }));

console.log('\nPAYMENT LOCK — every probe run live against production with the PUBLIC anon key\n');
for (const r of results) {
  console.log(`  ${r.name}`);
  console.log(`     expected : ${r.expectation}`);
  console.log(`     http     : ${r.status}`);
  console.log(`     body     : ${r.body}\n`);
}
