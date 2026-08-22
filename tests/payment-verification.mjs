/**
 * PAYMENT VERIFICATION — prove the trust boundary with the stub provider.
 *
 * Positive control FIRST, then the negatives:
 *   1 SIGNED       correctly-signed callback -> chips credited exactly once, purchases row written
 *   2 REPLAY       the identical callback again -> credits nothing
 *   3 FORGED       no signature, and a wrong signature -> 401, no side effect
 *   4 FAILED       a signed callback with status 'failed' -> acknowledged, credits nothing
 *   5 UNKNOWN PKG  a signed callback naming a package that does not exist -> refused
 *   6 PAYPLUS      the un-implemented adapter -> refused, by design
 *
 * The BROWSER-CANNOT-ASSERT-PAYMENT proof is separate and stronger: credit_purchase is revoked
 * from anon and authenticated, so a page cannot reach the credit path at all. That is asserted in
 * SQL, not here.
 *
 * The signing secret is read from the scratchpad file the sprint generated; it is a throwaway HMAC
 * test secret for the stub adapter, never a provider credential, and it is unset afterwards.
 *
 *   node tests/payment-verification.mjs
 */
import { createHmac } from 'node:crypto';
import { readFileSync } from 'node:fs';

const PROJECT = 'gxrpunvhjcrzqnitbqah';
const FN = `https://${PROJECT}.supabase.co/functions/v1/verify-purchase`;
const SECRET = readFileSync(process.env.STUB_SECRET_FILE, 'utf8').trim();
const ANON = process.env.CAPS_ANON_KEY;
if (!ANON) { console.error('CAPS_ANON_KEY not set'); process.exit(1); }

const DEVICE = process.env.TEST_DEVICE || 'test-pay-probe';

const sign = (raw) => createHmac('sha256', SECRET).update(raw).digest('hex');

async function call({ provider = 'stub', body, signature, omitSig = false }) {
  const raw = typeof body === 'string' ? body : JSON.stringify(body);
  const headers = {
    'Content-Type': 'application/json',
    // verify_jwt is ON for this deployment, so a Supabase key is still required to REACH the
    // function. That is an extra lock on top of the signature, not a substitute for it.
    apikey: ANON,
    Authorization: `Bearer ${ANON}`,
  };
  if (!omitSig) headers['x-caps-signature'] = signature ?? sign(raw);
  const r = await fetch(`${FN}?provider=${provider}`, { method: 'POST', headers, body: raw });
  let json = null;
  const text = await r.text();
  try { json = JSON.parse(text); } catch { json = text.slice(0, 120); }
  return { status: r.status, json };
}

const paid = (receipt, pkg = 'small') => ({
  receipt_id: receipt, package_id: pkg, device_id: DEVICE,
  currency: 'ILS', amount_minor: 399, status: 'paid',
});

console.log(`\n══ PAYMENT VERIFICATION · device ${DEVICE}\n`);

const RECEIPT = `stub-${Date.now()}`;

// 1 — POSITIVE CONTROL, FIRST.
const r1 = await call({ body: paid(RECEIPT) });
console.log(`1 SIGNED (positive control) : ${r1.status} ${JSON.stringify(r1.json)}`);

// 2 — REPLAY the identical callback.
const r2 = await call({ body: paid(RECEIPT) });
console.log(`2 REPLAY same receipt       : ${r2.status} ${JSON.stringify(r2.json)}`);

// 3 — FORGED.
const r3a = await call({ body: paid(`forged-${Date.now()}`), omitSig: true });
console.log(`3a NO SIGNATURE             : ${r3a.status} ${JSON.stringify(r3a.json)}`);
const r3b = await call({ body: paid(`forged2-${Date.now()}`), signature: 'deadbeef'.repeat(8) });
console.log(`3b WRONG SIGNATURE          : ${r3b.status} ${JSON.stringify(r3b.json)}`);
// Signature computed over a DIFFERENT body than the one sent — the tamper case.
const honest = JSON.stringify(paid(`tamper-a-${Date.now()}`));
const tampered = JSON.stringify(paid(`tamper-b-${Date.now()}`, 'mega'));
const r3c = await call({ body: tampered, signature: sign(honest) });
console.log(`3c TAMPERED BODY            : ${r3c.status} ${JSON.stringify(r3c.json)}`);

// 4 — FAILED / ABANDONED payment, correctly signed.
const r4 = await call({ body: { ...paid(`failed-${Date.now()}`), status: 'failed' } });
console.log(`4 SIGNED but status=failed  : ${r4.status} ${JSON.stringify(r4.json)}`);
const r4b = await call({ body: { ...paid(`cancel-${Date.now()}`), status: 'cancelled' } });
console.log(`4b SIGNED but cancelled     : ${r4b.status} ${JSON.stringify(r4b.json)}`);

// 5 — a package that does not exist in app_config.
const r5 = await call({ body: paid(`nopkg-${Date.now()}`, 'not_a_real_package') });
console.log(`5 UNKNOWN PACKAGE           : ${r5.status} ${JSON.stringify(r5.json)}`);

// 6 — the un-implemented provider.
const r6 = await call({ provider: 'payplus', body: paid(`pp-${Date.now()}`) });
console.log(`6 PAYPLUS adapter           : ${r6.status} ${JSON.stringify(r6.json)}`);

console.log(`\n   RECEIPT USED: ${RECEIPT}`);
console.log(`   ASSERT IN SQL for device ${DEVICE}`);
