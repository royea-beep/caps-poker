/**
 * VERIFY-PURCHASE — the trust boundary for real-money chip purchases.
 *
 * THE HOLE THIS CLOSES. Today, after a purchase resolves ON THE DEVICE, the CLIENT calls
 * earn_chips('iap_starter_pack'). Nothing proves a payment happened, so anyone who can call that
 * RPC gets chips for free (handoff 97). Every payment provider — PayPlus, RevenueCat, any of them —
 * solves this the same way: the provider calls OUR SERVER directly with a signed message. The
 * browser is never the source of truth.
 *
 * THE ORDER OF OPERATIONS IS THE SECURITY PROPERTY:
 *   1. read the RAW body (never re-serialised — see adapters.ts)
 *   2. pick the adapter
 *   3. VERIFY THE SIGNATURE
 *   4. only then, and only for status 'paid', call credit_purchase
 * An unsigned or badly-signed call returns 401 having touched nothing. There is no path from step 1
 * to step 4 that skips step 3.
 *
 * WHY THE BROWSER CANNOT USE THIS. credit_purchase is REVOKED from anon and authenticated and
 * GRANTED ONLY to service_role, and the service-role key lives in this function's environment. A
 * page can call this URL all day; without the signing secret it gets 401, and it cannot reach the
 * credit function directly at all.
 *
 * WHAT IS NOT HERE: PayPlus's real API. The terminal is approved for a DIFFERENT domain and using
 * it for CAPS before that is updated is exactly what the signed declaration forbids. The payplus
 * adapter refuses by design; see adapters.ts for precisely what lands when approval does.
 *
 * NOTHING IS ENABLED BY DEPLOYING THIS. With no PURCHASE_STUB_SECRET set it refuses every call,
 * and the client has no code path that reaches it while the web-payments flag is off.
 */
import { pickAdapter } from './adapters.ts';

const URL_ = Deno.env.get('SUPABASE_URL')!;
const KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json(405, { ok: false, reason: 'method_not_allowed' });

  // RAW body. Signature is computed over these exact bytes.
  const rawBody = await req.text();

  const url = new URL(req.url);
  const providerName = url.searchParams.get('provider') ?? req.headers.get('x-caps-provider');
  const adapter = pickAdapter(providerName);
  if (!adapter) return json(400, { ok: false, reason: 'unknown_provider' });

  // ── THE GATE. Nothing above this line has a side effect; nothing below runs without it. ──
  const v = await adapter.verify(req, rawBody);
  if (!v.ok) {
    // 401 and no side effect. Deliberately does not say WHICH check failed beyond a coarse reason.
    return json(401, { ok: false, reason: v.reason ?? 'unverified' });
  }

  // A provider reports failures and cancellations through the same callback. Acknowledge them so
  // the provider stops retrying, and credit nothing.
  if (v.status && v.status !== 'paid') {
    return json(200, { ok: true, credited: false, reason: `status_${v.status}` });
  }

  // Verified. Credit via the service role — the only identity permitted to call credit_purchase.
  const r = await fetch(`${URL_}/rest/v1/rpc/credit_purchase`, {
    method: 'POST',
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      p_device_id: v.deviceId,
      p_package_id: v.packageId,
      p_provider: adapter.name,
      p_receipt_id: v.receiptId,
      p_currency: v.currency ?? null,
      p_amount_minor: v.amountMinor ?? null,
      p_platform: 'web',
    }),
  });

  const text = await r.text();
  if (!r.ok) {
    // Do NOT swallow this. A verified payment that failed to credit must be visible and must be
    // retryable — the provider will retry, and credit_purchase is idempotent on the receipt.
    return json(500, { ok: false, reason: 'credit_failed', detail: text.slice(0, 300) });
  }

  // The RPC can refuse a VERIFIED payment for its own reasons — unknown package, rate limit,
  // identity mismatch. Reflect that honestly instead of reporting credited:true over a refusal:
  // the first run of this function returned {credited:true, result:{ok:false}}, which is exactly
  // the kind of envelope that makes a payment look settled when nothing moved.
  const result = text ? JSON.parse(text) : null;
  const credited = result?.ok === true && (result?.granted ?? 0) > 0;
  return json(200, { ok: result?.ok !== false, credited, result });
});
