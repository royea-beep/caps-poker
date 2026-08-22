/**
 * PAYMENT VERIFICATION ADAPTERS — one interface, one adapter per provider.
 *
 * The point of this file is that the credit path never learns which provider paid. Every provider
 * works the same way: it calls our server directly with a signed message, we verify the signature
 * against a secret only the two of us hold, and the browser is never the source of truth. Swapping
 * PayPlus for RevenueCat, or adding a second, must not require touching credit_purchase.
 *
 * THE CONTRACT EVERY ADAPTER OBEYS:
 *   - verify() is given the RAW body bytes. Never re-serialise before verifying: JSON.stringify
 *     reorders keys and a signature computed over reordered bytes will not match, which is the
 *     classic way a webhook ends up "verifying" nothing.
 *   - It returns ok:false for anything it cannot prove. Refusing is always safe; a false positive
 *     is a free chip grant.
 *   - It NEVER returns an amount of chips. The package id is a lookup key; the chips come from
 *     app_config inside credit_purchase. An adapter that could name a chip amount would put the
 *     provider — and anyone who can forge to it — in charge of the economy.
 */

export type VerifiedPayment = {
  ok: boolean;
  reason?: string;
  /** Provider's own transaction id. Becomes the idempotency key. */
  receiptId?: string;
  /** Which package was bought. Looked up in app_config; never a chip amount. */
  packageId?: string;
  deviceId?: string;
  currency?: string;
  /** Real-money amount in MINOR units (agorot/cents), for the record only — not for pricing. */
  amountMinor?: number;
  /** Only 'paid' credits anything. Anything else is acknowledged and ignored. */
  status?: 'paid' | 'failed' | 'pending' | 'cancelled';
};

export interface PaymentAdapter {
  readonly name: string;
  /** Verify signature and shape. MUST NOT have side effects. */
  verify(req: Request, rawBody: string): Promise<VerifiedPayment>;
}

/** Constant-time compare so a wrong signature cannot be discovered byte by byte. */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * STUB ADAPTER — the one this sprint can actually prove.
 *
 * It is a REAL signature check (HMAC-SHA256 over the raw body, constant-time compared) against
 * PURCHASE_STUB_SECRET. It is called a stub because the PROVIDER is simulated, not because the
 * verification is: the same code path, the same refusal on a bad signature. That is what lets the
 * whole boundary be tested end to end while PayPlus approval for this domain is still pending.
 *
 * If PURCHASE_STUB_SECRET is unset, every call is refused. A verifier with no secret must fail
 * closed — an unconfigured deployment that accepted everything would be worse than no deployment.
 */
export const stubAdapter: PaymentAdapter = {
  name: 'stub',
  async verify(req, rawBody) {
    const secret = Deno.env.get('PURCHASE_STUB_SECRET') ?? '';
    if (!secret) return { ok: false, reason: 'stub_secret_not_configured' };

    const given = req.headers.get('x-caps-signature') ?? '';
    if (!given) return { ok: false, reason: 'missing_signature' };

    const expected = await hmacSha256Hex(secret, rawBody);
    if (!timingSafeEqual(given.toLowerCase(), expected)) {
      return { ok: false, reason: 'bad_signature' };
    }

    let body: any;
    try { body = JSON.parse(rawBody); } catch { return { ok: false, reason: 'bad_json' }; }

    if (!body?.receipt_id || !body?.package_id || !body?.device_id) {
      return { ok: false, reason: 'missing_fields' };
    }
    return {
      ok: true,
      receiptId: String(body.receipt_id),
      packageId: String(body.package_id),
      deviceId: String(body.device_id),
      currency: body.currency ? String(body.currency) : undefined,
      amountMinor: Number.isFinite(body.amount_minor) ? Number(body.amount_minor) : undefined,
      status: (body.status ?? 'paid') as VerifiedPayment['status'],
    };
  },
};

/**
 * PAYPLUS — DELIBERATELY NOT IMPLEMENTED.
 *
 * Roye holds a live, approved PayPlus/Isracard terminal, but that approval names a DIFFERENT
 * domain, and using it for CAPS before they update it is exactly what the signed declaration
 * forbids. So the shape exists and the wiring point is named, and the adapter refuses.
 *
 * WHAT IS STUBBED, precisely: the signature scheme and the callback field names. When approval
 * lands, this function needs (1) PayPlus's documented HMAC scheme and header name, (2) the secret
 * in PAYPLUS_WEBHOOK_SECRET, and (3) a mapping from their callback body to VerifiedPayment.
 * NOTHING ELSE IN THE SYSTEM CHANGES — not the Edge Function, not credit_purchase, not the client.
 * That is the whole reason for the interface.
 */
export const payplusAdapter: PaymentAdapter = {
  name: 'payplus',
  async verify() {
    return { ok: false, reason: 'payplus_adapter_not_implemented' };
  },
};

export function pickAdapter(name: string | null): PaymentAdapter | null {
  switch ((name ?? '').toLowerCase()) {
    case 'stub': return stubAdapter;
    case 'payplus': return payplusAdapter;
    default: return null;
  }
}
