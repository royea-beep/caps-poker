/**
 * CHIP-STORE — RETIRED 2026-08-31 (VAMOS-NAV-DEDUPE), redirects to /shop.
 *
 * /chip-store had ZERO navigation entry points anywhere in app/ components/ hooks/ store/
 * (verified: only its Stack.Screen registration referenced it) AND it duplicated the purpose
 * of the reachable /shop (both are the IAP "buy chips" surface, both gated on the same payment
 * flags). The benchmark named it an orphaned duplicate.
 *
 * Retired the /missions way — a Redirect, not a delete — so a tester who types the URL lands on
 * the canonical store instead of expo-router's unmatched-route fallback (there is no
 * app/+not-found.tsx). /shop is the survivor because it is the one with entry points
 * (home shop buttons, results shop CTA) and it already shows the honest "coming soon / chips
 * come from playing" state when payments are off.
 *
 * The retired implementation is in git history if the packages UI is ever wanted back.
 */
import { Redirect } from 'expo-router';

export default function ChipStoreRetired() {
  return <Redirect href="/shop" />;
}
