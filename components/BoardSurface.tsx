/**
 * CA2 — THE PLAYING SURFACE.
 *
 * Roye's ruling (2026-08-07): the boards should sit on a defined playing surface, not merely
 * be bigger. And on hierarchy: "שניהם אבל ב יותר מא" — both, but the boards more than the hand.
 *
 * WHY A SURFACE IS THE RIGHT PRIMARY LEVER, and why the one we already had did nothing:
 * a surface creates PLACE. Cards on a table are on the table; cards in your hand are not. That
 * one move carries ownership, dominance and grouping without adding a single control. The app
 * already paints `FELT_GRADIENT` — but at the SCREEN ROOT, via `StyleSheet.absoluteFill` in
 * GameView, so it bleeds to every edge. A surface that reaches the edges is a background, and a
 * background is exactly what it reads as today. **The edge is the whole point.**
 *
 * So this is inset on all four sides, and the inset is what turns felt into a table.
 *
 * MATERIAL — felt, with a rail:
 *   - the felt itself is the same two-stop `FELT_GRADIENT` the root uses, so the surface belongs
 *     to the existing obsidian/mint palette rather than fighting it. It is the same cloth,
 *     bounded.
 *   - a RAIL: a 1px light rim on top and a darker outer shadow beneath, so the top edge catches
 *     light and the bottom edge falls away. That is what makes it read as a raised table top
 *     rather than a rectangle of colour.
 *   - an INNER SHADOW along the top edge, so the cloth reads as recessed INTO the rail. Cards
 *     then sit ON it rather than beside it.
 *
 * ONE SURFACE, NOT ONE PER BOARD. A CAPS hand is decided across all boards at once — the
 * COMPLETE bonus requires taking every one of them — so the boards are not separate games and
 * must not read as separate tables. One surface says "this is the table, and everything on it is
 * in play". It also avoids stacking a second frame around boards that already carry a gold
 * border, which would be four frames inside four frames.
 *
 * THE HAND IS DELIBERATELY NOT ON IT. That contrast is the whole mechanism: the hand sits below
 * the surface edge, against the app background, so it reads as HELD rather than PLAYED. Nothing
 * about the hand needs to shout for this to work — it works because the boards have a place and
 * the hand does not.
 *
 * GREYSCALE: the distinction here is a LUMINANCE step plus an edge, never a hue. The surface is
 * darker than the app background, the rail is lighter than the surface, and the shadow is darker
 * than both. Remove all colour and the table is still a table. This is the BP3 rule applied to
 * geometry instead of to a bar.
 *
 * Iron Rule #3: every dimension flows through rs() WITH screenW passed, so it responds to 375 vs
 * 393 instead of freezing at module scope on web.
 */

import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { FELT_GRADIENT } from '../constants/paintThemes';
import { rs } from '../utils/responsive';

interface Props {
  children: React.ReactNode;
  visualTheme?: string | null;
  screenW: number;
  /** Rail accent — passed from the theme so the surface never hardcodes a palette. */
  railColor?: string;
}

/**
 * Lift a hex colour toward white by `amount` (0-1). Used to derive the table top from the
 * ambient felt rather than inventing a second palette.
 */
function lift(hex: string, amount: number): string {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  const mix = (v: number) => Math.round(v + (255 - v) * amount);
  return `rgb(${mix(r)}, ${mix(g)}, ${mix(b)})`;
}

export function BoardSurface({ children, visualTheme, screenW, railColor }: Props) {
  const base = FELT_GRADIENT[(visualTheme ?? 'classic') as 'classic' | 'fiveo' | 'streetStencil']
    ?? FELT_GRADIENT.classic;

  // MEASURED FIX. The first build reused FELT_GRADIENT unchanged — and the root felt behind
  // this surface IS that same gradient, so the table top and its surround came out at identical
  // luminance (0.0170 / 0.0142 on both sides). An inset with no value step is not a table; it
  // is a rectangle you can only find by its 2px rail, and in greyscale it disappears entirely.
  //
  // The table top is now LIFTED off the ambient felt. A real table catches more light than the
  // room around it, so this is the physically honest direction as well as the legible one. The
  // lift is small and derived from the theme's own felt, so no second palette is introduced and
  // every theme stays internally consistent.
  const felt: readonly [string, string] = [lift(base[0], 0.10), lift(base[1], 0.055)];

  // The inset IS the design. At 375 with four boards this is the tightest case in the app, so
  // the margin is deliberately small — enough to show that the surface ends, not enough to cost
  // a card row. 8px reads as an edge; 20px would read as a border and eat the board.
  const inset = rs(8, screenW);
  const radius = rs(18, screenW);

  return (
    <View
      testID="board-surface"
      style={[
        styles.wrap,
        {
          marginHorizontal: inset,
          marginTop: rs(4, screenW),
          marginBottom: rs(6, screenW),
          borderRadius: radius,
          // RAIL — the lit top edge. Kept at low alpha so it reads as a highlight, not a border.
          borderWidth: StyleSheet.hairlineWidth * 2,
          borderColor: railColor ?? 'rgba(255,255,255,0.14)',
        },
      ]}
    >
      <LinearGradient
        colors={[felt[0], felt[1]]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={[StyleSheet.absoluteFill, { borderRadius: radius }]}
        pointerEvents="none"
      />
      {/* INNER SHADOW along the top edge. RN has no inset box-shadow, and react-native-web only
          translates the outer kind, so this is a real gradient strip rather than a shadow
          property that would silently render on one platform and not the other. Platform
          divergence handled by not depending on the divergent thing. */}
      <LinearGradient
        colors={['rgba(0,0,0,0.38)', 'rgba(0,0,0,0)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={[styles.innerTop, { height: rs(14, screenW), borderTopLeftRadius: radius, borderTopRightRadius: radius }]}
        pointerEvents="none"
      />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    alignSelf: 'stretch',
    overflow: 'hidden',
    position: 'relative',
    // The surface sits ABOVE the root felt and BELOW the boards. The drop shadow is what lifts
    // it off the background; without it the inset reads as a hole rather than a table.
    ...Platform.select({
      web: { boxShadow: '0 6px 18px rgba(0,0,0,0.45)' } as any,
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.45,
        shadowRadius: 12,
        elevation: 8,
      },
    }),
  },
  innerTop: { position: 'absolute', left: 0, right: 0, top: 0 },
});

export default BoardSurface;
