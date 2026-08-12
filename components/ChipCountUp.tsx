/**
 * Chip count-up text for the board reveal.
 *
 * WHY THIS EXISTS. The reveal used to render the counter with RN's string interpolation:
 *
 *   chipCounterAnim.interpolate({
 *     inputRange:  [0, board.potAmount],
 *     outputRange: [`${sign}0 🪙`, `${sign}${board.potAmount} 🪙`],
 *   })
 *
 * RN matches the numeric substring in those two patterns and interpolates it linearly, then
 * formats the result with no rounding. So every intermediate frame showed full float noise —
 * two live clients were caught rendering "15.342293749999996 🪙" and "-11.539762011718746 🪙"
 * beside the verdict — and it only landed on a clean number at t=1. `potAmount` can also be
 * fractional in its own right (see S68), so even the final frame was not safe.
 *
 * The value was never wrong, only its presentation. So animate the NUMBER and format on
 * render, rounding exactly as S68 did for the other counter (`Math.round` at the display,
 * hooks/useResultsAnimations.ts). No economy value is touched.
 *
 * Kept as its own leaf component on purpose: the listener updates state on every animation
 * frame, and BoardReveal is a heavy tree. Re-rendering one <Text> is cheap; re-rendering the
 * reveal 48 times over an 800ms count-up is not.
 */
import React, { useEffect, useState } from 'react';
import { Animated, StyleProp, Text, TextStyle } from 'react-native';

interface ChipCountUpProps {
  /** Drives the count. Animates 0 → potAmount; must be a JS-driven value (useNativeDriver:false). */
  anim: Animated.Value;
  /** '+' for a win, '-' for a loss, '±' for a tie — matches the reveal's existing sign logic. */
  sign: string;
  style?: StyleProp<TextStyle>;
}

export default function ChipCountUp({ anim, sign, style }: ChipCountUpProps) {
  // Seed from the animation's current value so a component that mounts mid-count (or straight
  // after the skip-all path calls setValue(potAmount)) does not flash a 0 first. __getValue is
  // RN-internal, hence the guarded call and the 0 fallback.
  const [shown, setShown] = useState<number>(() => {
    const current = (anim as unknown as { __getValue?: () => number }).__getValue?.();
    return typeof current === 'number' ? Math.round(current) : 0;
  });

  useEffect(() => {
    const id = anim.addListener(({ value }) => setShown(Math.round(value)));
    return () => anim.removeListener(id);
  }, [anim]);

  return <Text style={style}>{`${sign}${shown} 🪙`}</Text>;
}
