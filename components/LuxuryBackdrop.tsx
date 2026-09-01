import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

/**
 * LuxuryBackdrop — the Luxury Dark home art, behind everything (LUXURY-HOME 2026-09-01).
 *
 * Three layers, painted in this order under the scroll content:
 *   1. FELT — a deep radial-green vignette. Real on native (expo-linear-gradient, top→bottom) and
 *      web (a true CSS radial-gradient). Lighter green around the wordmark band (~32% down) so the
 *      gilded CAPS gets a subtle lift, DARKER at the edges/bottom — it lifts the wordmark, never
 *      fights it.
 *   2. BEAM — a diagonal light beam from the top corner, very low opacity (web layer; on native it
 *      is a faint linear wash). A device-tap for its true look.
 *   3. WEAVE — a faint felt texture (web SVG data-URI, same idiom as index.tsx's grainOverlay). A
 *      device-tap: the real weave only renders truly on a device.
 *
 * NO PIXEL LITERALS — every gradient uses PERCENTAGES / relative stops and colour tokens, never a
 * px dimension (Iron Rule #3). Colours are the app's felt family (constants/paintThemes FELT_GRADIENT
 * classic lives in the rgb(14,36,24) range) deepened for the Luxury Dark look.
 */

// felt greens — the classic felt family, deepened for Luxury Dark (percentage stops, no px)
const FELT_TOP = '#0C2C1D';
const FELT_MID = '#071C12';
const FELT_BOTTOM = '#03110B';

/**
 * GAME-UPGRADES step 3 — `muted` dims the vignette + beam so the reveal spotlight and the winner
 * cue still dominate the play surface; `overlayOnly` skips the felt base so a caller that already
 * paints its own theme felt (the game root) gets ONLY the vignette + beam + weave layered on top.
 * Both are pointerEvents:none absolute fills — zero layout impact (the 83px arc is untouched).
 */
export function LuxuryBackdrop({ muted = false, overlayOnly = false }: { muted?: boolean; overlayOnly?: boolean } = {}) {
  // Muted center-glow is much dimmer (0.22 vs 0.55) and the beam is halved, so a bright surface
  // never puts attention back on the non-winning cards the reveal deliberately dims.
  const vignette = muted
    ? 'radial-gradient(120% 82% at 50% 34%, rgba(26,70,44,0.22) 0%, rgba(7,28,18,0.0) 50%, rgba(0,0,0,0.42) 100%)'
    : 'radial-gradient(120% 78% at 50% 30%, rgba(26,70,44,0.55) 0%, rgba(7,28,18,0.0) 46%, rgba(0,0,0,0.55) 100%)';
  const beam = muted
    ? 'linear-gradient(118deg, rgba(255,240,205,0.05) 0%, rgba(255,240,205,0.018) 12%, rgba(255,240,205,0) 27%)'
    : 'linear-gradient(118deg, rgba(255,240,205,0.10) 0%, rgba(255,240,205,0.035) 12%, rgba(255,240,205,0) 27%)';
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {/* 1 — FELT base (native + web) — skipped when overlayOnly (the game root paints its own felt) */}
      {!overlayOnly && (
        <LinearGradient
          colors={[FELT_TOP, FELT_MID, FELT_BOTTOM]}
          locations={[0, 0.5, 1]}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      )}
      {/* 1b — radial vignette: green glow toward the centre, dark at the rim (web) */}
      <View
        style={[
          StyleSheet.absoluteFill,
          Platform.select({ web: { backgroundImage: vignette } as any, default: {} }),
        ]}
      />
      {/* 2 — diagonal light BEAM from the top corner (web-rich; device-tap) */}
      <View
        style={[
          StyleSheet.absoluteFill,
          Platform.select({ web: { backgroundImage: beam } as any, default: {} }),
        ]}
      />
      {/* 3 — faint felt WEAVE (web SVG data-URI, same idiom as grainOverlay; device-tap) */}
      <View
        style={[
          StyleSheet.absoluteFill,
          Platform.select({
            web: {
              backgroundImage:
                'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'6\' height=\'6\'%3E%3Cpath d=\'M0 0h6v6H0z\' fill=\'none\'/%3E%3Cpath d=\'M0 3h6M3 0v6\' stroke=\'%23ffffff\' stroke-opacity=\'0.02\' stroke-width=\'0.5\'/%3E%3C/svg%3E")',
              backgroundRepeat: 'repeat',
            } as any,
            default: {},
          }),
        ]}
      />
    </View>
  );
}

export default LuxuryBackdrop;
