/**
 * WEB PAYMENTS — the client half of the purchase flow. SHAPE ONLY; nothing is live.
 *
 * Follows utils/iapEnabled.ts exactly: a remote flag fetched once at start, cached for synchronous
 * render gates, DEFAULTING TO FALSE so an unreachable config leaves payments hidden. That default
 * direction is the whole point — the failure mode of a payment flag must be "off".
 *
 * WHY THIS IS SEPARATE FROM iap_enabled. They are different rails with different rules: in-app
 * purchases go through the store and pay the platform fee; web purchases go through a card
 * processor and do not. Handoff 97 recorded that web and in-app are different builds and different
 * code paths, so they get different flags. Flipping one must never flip the other.
 *
 * WHAT IS DELIBERATELY ABSENT: any provider SDK, any key, any redirect URL. Roye's PayPlus terminal
 * is approved for a DIFFERENT domain and using it for CAPS before that is updated is what the
 * signed declaration forbids. startCheckout() therefore reports that no provider is configured
 * rather than pretending to open one.
 *
 * THE CLIENT NEVER NAMES A PRICE OR A CHIP AMOUNT. It sends a package id. Chips come from
 * app_config inside credit_purchase, and the credit only ever happens from a verified webhook
 * (supabase/functions/verify-purchase). A 500-chip theme was once bought for 1 chip in this
 * codebase because an amount arrived from the client; that shape does not exist here.
 */
import { getSupabase } from './supabase';

let _enabled = false; // safe default: hidden until proven enabled

/** Synchronous cached read — use in render gates. Defaults to false (hidden). */
export function isWebPaymentsEnabled(): boolean {
  return _enabled;
}

/** Fetch the remote flag once (call at app start). Never throws. */
export async function loadWebPaymentsEnabled(): Promise<void> {
  try {
    const sb = getSupabase();
    if (!sb) return;
    const { data } = await sb.from('app_config').select('value')
      .eq('key', 'web_payments_enabled').maybeSingle();
    const v = data?.value;
    _enabled = v === true || v === 'true';
  } catch {
    _enabled = false;
  }
}

export type CheckoutResult =
  | { ok: false; reason: 'disabled' | 'no_provider' | 'unknown_package' | 'error' }
  | { ok: true; redirectUrl: string };

/**
 * Begin a purchase. Provider-agnostic by construction: the caller passes a package id and nothing
 * else, and this decides which provider (if any) can serve it.
 *
 * Returns 'no_provider' today, on purpose. When the PayPlus terminal is approved for this domain,
 * the only change here is creating a payment page and returning its URL — the verification,
 * crediting and idempotency all already exist server-side and do not move.
 */
export async function startCheckout(packageId: string): Promise<CheckoutResult> {
  if (!isWebPaymentsEnabled()) return { ok: false, reason: 'disabled' };
  if (!packageId) return { ok: false, reason: 'unknown_package' };
  // No provider is configured for this domain yet. See the header — this is a pending approval,
  // not a missing implementation on our side.
  return { ok: false, reason: 'no_provider' };
}
