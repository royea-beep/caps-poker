/**
 * GuidedTooltip — S84 Guided First Game
 * Floating pill tooltip for contextual guidance during gameplay.
 * ZERO Reanimated — RN Animated only. Does NOT block gameplay.
 */
import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { rf, rs, rv } from '../utils/responsive';

interface GuidedTooltipProps {
  text: string;
  visible: boolean;
  onDismiss: () => void;
  position?: 'top' | 'bottom' | 'center';
  autoDismissMs?: number;
  /**
   * Distance from the bottom edge, for `position: 'bottom'` only.
   *
   * MEASURED DEFECT 2026-08-13, live, both engines: the fixed `bottom: rs(110)` below put
   * this pill ON TOP of the player's hand at every width — covering 6 of 12 cards at 57% each
   * at 1706x960, 71% at 1706x820, and **78% at 393**. Roye reported it from desktop; it is
   * worst on the phone, which is the product.
   *
   * No constant can fix it: the hand occupies the bottom 194px at 393 and 302px at 1706x960,
   * so a value that clears one end floats mid-board or off-screen at the other. The caller
   * knows the hand's height and this component does not, which is the whole bug — the same
   * defect class as the board-stack/hand-row collision (see MEASUREMENT-PROTOCOL Rule 18).
   *
   * Defaults to the historical rs(110) so every tip that does NOT pass it is byte-identical.
   */
  bottomOffset?: number;
}

export default function GuidedTooltip({
  text,
  visible,
  onDismiss,
  position = 'bottom',
  autoDismissMs = 5000,
  bottomOffset,
}: GuidedTooltipProps) {
  const opacity = useRef(new Animated.Value(0)).current;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (visible) {
      Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }).start();
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(onDismiss, autoDismissMs);
    } else {
      Animated.timing(opacity, { toValue: 0, duration: 150, useNativeDriver: true }).start();
      if (timer.current) {
        clearTimeout(timer.current);
        timer.current = null;
      }
    }
    return () => {
      if (timer.current) {
        clearTimeout(timer.current);
        timer.current = null;
      }
    };
  }, [visible, autoDismissMs]);

  if (!text) return null;

  const posStyle =
    position === 'top' ? styles.posTop :
    position === 'center' ? styles.posCenter :
    styles.posBottom;

  // Only 'bottom' honours the override; 'top' and 'center' are unaffected by definition.
  const offsetStyle =
    position === 'bottom' && typeof bottomOffset === 'number' ? { bottom: bottomOffset } : null;

  return (
    <Animated.View
      style={[styles.container, posStyle, offsetStyle, { opacity }]}
      pointerEvents={visible ? 'box-only' : 'none'}
    >
      {/* A11Y 2026-08-13 — this Pressable had NO accessibilityRole. RN-web renders it as a bare
          div, so a control with a 5-second lifetime was announced to no screen reader at all.
          It was also invisible to our own sweeps, which anchor on role=button — which is why
          an earlier probe reported "no dismiss control found" and turned a position bug into a
          suspected behaviour bug for a sprint. */}
      <Pressable
        onPress={onDismiss}
        style={styles.pill}
        accessibilityRole="button"
        accessibilityLabel="Dismiss tip"
        accessibilityHint="Closes this hint"
      >
        <Text style={styles.text}>{text}</Text>
        <Text style={styles.dismiss}>✕</Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: rs(16),
    right: rs(16),
    zIndex: 100,
    alignItems: 'center',
  },
  posTop: {
    top: rs(90),
  },
  posCenter: {
    top: '38%' as any,
  },
  posBottom: {
    bottom: rs(110),
  },
  pill: {
    backgroundColor: 'rgba(0,0,0,0.9)',
    borderRadius: rv(12),
    paddingVertical: rs(12),
    paddingHorizontal: rs(16),
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: rs(10),
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    maxWidth: '100%',
  },
  text: {
    color: '#ffffff',
    fontSize: rf(14),
    fontWeight: '500',
    lineHeight: rf(21),
    flex: 1,
  },
  dismiss: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: rf(11),
    fontWeight: '600',
    marginTop: rs(2),
  },
});
