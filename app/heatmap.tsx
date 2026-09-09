/**
 * HEATMAP — RETIRED 2026-08-31 (VAMOS-NAV-DEDUPE), redirects to Home.
 *
 * /heatmap had ZERO navigation entry points anywhere (verified: only its Stack.Screen
 * registration and an EmptyState comment referenced it). It was an orphaned screen a typed URL
 * could still land on — exactly the /missions lesson. Since this is a subtraction sprint (no new
 * destination may be added), it is RETIRED rather than linked.
 *
 * Retired the /missions way — a Redirect to Home, not a delete — so the URL always has a way
 * forward and back, and expo-router's unmatched-route fallback is never hit (there is no
 * app/+not-found.tsx). The retired implementation is in git history if the heat-map view is ever
 * wanted back and given a real entry point.
 */
import { Redirect } from 'expo-router';

export default function HeatmapRetired() {
  return <Redirect href="/" />;
}
