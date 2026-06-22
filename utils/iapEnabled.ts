/**
 * VAMOS-HIDE-IAP-506 2026-06-22 — remote IAP kill-switch.
 *
 * For the 506 launch every in-app-purchase entry point is HIDDEN because the products
 * (`starter_pack_2x`, subscription, chip packs) are not confirmed configured in App Store
 * Connect / RevenueCat, and Apple rejects apps with non-functional IAP buttons.
 *
 * Reversible WITHOUT a build: flip the `iap_enabled` row in app_config to 'true'.
 * DEFAULTS TO FALSE (hidden) — so IAP stays hidden even before/if the config fetch fails,
 * which is the safe direction for 506.
 */
import { getSupabase } from './supabase';

let _iapEnabled = false; // safe default: hidden until proven enabled

/** Synchronous cached read — use in render gates. Defaults to false (hidden). */
export function isIapEnabled(): boolean {
  return _iapEnabled;
}

/** Fetch the remote flag once (call at app start). Never throws. */
export async function loadIapEnabled(): Promise<void> {
  try {
    const sb = getSupabase();
    if (!sb) return;
    const { data } = await sb.from('app_config').select('value').eq('key', 'iap_enabled').maybeSingle();
    // app_config.value is text/jsonb; treat only an explicit truthy as enabled.
    const v = data?.value;
    _iapEnabled = v === true || v === 'true';
  } catch {
    _iapEnabled = false;
  }
}
