import React, { useRef } from 'react';
import { Animated, Pressable, View, Platform, StyleSheet, ViewStyle } from 'react-native';
import { rs, rv } from '../utils/responsive';

/**
 * ChipButton — the E identity, built for real.
 *
 * Roye ranked treatment E (the beveled poker-chip) #1 in the button sweep, then chose the
 * ELONGATED stadium shape over the true circle: the round chip clips "Play Online" — Hebrew
 * "שחק אונליין · מול שחקנים אמיתיים" overflows a circle by +17px at BOTH 320 and 393 (measured,
 * ROUND-CHIP-2026-09-01). The stadium holds the full label in EN and HE at both widths while
 * keeping every part of the poker-chip look: a mint fill, a brass DASHED rim (the chip edge),
 * a bevel (top highlight + bottom shadow), and a pressed state that sinks.
 *
 * COLOURS — the app's own, restated as literals (index.tsx already hardcodes '#4FD6A8'):
 *   MINT  #4FD6A8 — the action / the primary fill.
 *   BRASS #C9A84C — the chip EDGE only (the dashed rim). A different colour from the winner cue.
 *   winner gold #FFD700 (the WON cue, Card.tsx, 3px) appears NOWHERE on this button.
 *
 * DIMENSIONS — every one via rf/rs/rv (Iron Rule #3). No pixel literals: the corner radius,
 * padding, gap, the dashed edge width and its inset, the bevel heights and the drop shadow all
 * scale with the screen. Colours and opacities are not dimensions.
 *
 * LAYERING — two layers on purpose: the OUTER (sinking) view carries the fill + radius + drop
 * shadow (iOS casts a shadow only from an un-clipped, backed, rounded view); the INNER Pressable
 * carries `overflow:'hidden'` so the bevel bars are clipped to the stadium. Putting the shadow and
 * overflow on one view would make the shadow vanish on iOS (overflow:hidden ⇒ masksToBounds).
 */

const MINT = '#4FD6A8'; // action / primary fill
const BRASS = '#C9A84C'; // the chip edge (dashed rim) — NOT the winner cue
const CHIP_DARK = '#12211B'; // secondary chip fill (dark felt), mint rim

// Platform-aware outer drop shadow — mirrors the platformShadow helper in components/Button.tsx.
// Spatial args (offsetY, radius) arrive already scaled through rs() so this stays literal-free.
function dropShadow(offsetY: number, radius: number, opacity: number, elevation: number): ViewStyle {
  if (Platform.OS === 'web') {
    return { boxShadow: `0px ${offsetY}px ${radius}px rgba(0,0,0,${opacity})` } as ViewStyle;
  }
  if (Platform.OS === 'android') {
    return { elevation };
  }
  return {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: offsetY },
    shadowOpacity: opacity,
    shadowRadius: radius,
  };
}

type Variant = 'primary' | 'secondary';

interface ChipButtonProps {
  variant?: Variant;
  onPress: () => void;
  accessibilityLabel: string;
  children: React.ReactNode;
  /** Applied to the outer (sinking) wrapper — use for margins / width, not for the chip skin. */
  style?: ViewStyle;
}

export function ChipButton({
  variant = 'primary',
  onPress,
  accessibilityLabel,
  children,
  style,
}: ChipButtonProps) {
  // Pressed state — the chip SINKS (translateY), the poker-chip "press". POLISH-1 (2): the
  // onPressIn/onPressOut pair is also what keeps Play Online's very first tap from being dropped
  // by react-native-web's press recognizer, so every ChipButton carries it.
  const sink = useRef(new Animated.Value(0)).current;
  const isPrimary = variant === 'primary';

  const fill = isPrimary ? MINT : CHIP_DARK;
  const edgeColor = isPrimary ? BRASS : MINT;

  // ── Every dimension responsive — no pixel literals ─────────────────────────
  const radius = rv(60); // clamps to a stadium (half-height) at these button heights
  const minHeight = isPrimary ? rv(72) : rv(52); // primary dominant, secondary quiet — NOT equal
  const padV = isPrimary ? rs(14) : rs(10);
  const padH = isPrimary ? rs(24) : rs(20);
  const gap = isPrimary ? rs(12) : rs(8);
  const edgeInset = rs(6); // the dashed rim sits this far in from the fill edge
  const edgeWidth = rv(3); // the dashed rim stroke
  const bevelTop = rs(3); // inner top highlight — the chip catches light
  const bevelBottom = rs(8); // inner bottom shadow — the chip has depth
  const sinkTo = rs(4);

  const onIn = () =>
    Animated.timing(sink, { toValue: sinkTo, duration: 80, useNativeDriver: true }).start();
  const onOut = () =>
    Animated.timing(sink, { toValue: 0, duration: 150, useNativeDriver: true }).start();

  return (
    <Animated.View
      style={[
        { transform: [{ translateY: sink }], backgroundColor: fill, borderRadius: radius },
        dropShadow(rs(10), rs(22), 0.5, isPrimary ? 10 : 6),
        style,
      ]}
    >
      <Pressable
        onPress={onPress}
        onPressIn={onIn}
        onPressOut={onOut}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        style={[
          styles.chip,
          {
            backgroundColor: fill,
            borderRadius: radius,
            minHeight,
            paddingVertical: padV,
            // keep the content clear of the dashed rim (padH + the rim's own inset)
            paddingHorizontal: padH + edgeInset,
            gap,
          },
        ]}
      >
        {/* BEVEL — inner top highlight */}
        <View
          pointerEvents="none"
          style={[
            styles.bevel,
            {
              top: 0,
              height: bevelTop,
              borderTopLeftRadius: radius,
              borderTopRightRadius: radius,
              backgroundColor: 'rgba(255,255,255,0.45)',
            },
          ]}
        />
        {/* BEVEL — inner bottom shadow */}
        <View
          pointerEvents="none"
          style={[
            styles.bevel,
            {
              bottom: 0,
              height: bevelBottom,
              borderBottomLeftRadius: radius,
              borderBottomRightRadius: radius,
              backgroundColor: 'rgba(0,0,0,0.20)',
            },
          ]}
        />
        {/* THE CHIP EDGE — the dashed rim (brass on primary, mint on secondary).
            NOTE (device fidelity): borderStyle:'dashed' + borderRadius renders the dashes cleanly
            on react-native-web; on iOS a dashed rounded border can render solid or with uneven
            dashes — a device-only tap, like the Georgia masthead. */}
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: edgeInset,
            left: edgeInset,
            right: edgeInset,
            bottom: edgeInset,
            borderRadius: radius,
            borderWidth: edgeWidth,
            borderColor: edgeColor,
            borderStyle: 'dashed',
            opacity: 0.85,
          }}
        />
        {children}
      </Pressable>
    </Animated.View>
  );
}

export default ChipButton;

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden', // clip the bevel bars to the stadium
  },
  bevel: {
    position: 'absolute',
    left: 0,
    right: 0,
  },
});
