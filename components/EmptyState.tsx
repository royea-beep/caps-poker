// VAMOS-VISUAL-PASS-1 2026-06-19 — shared empty-state component for the
// secondary screens (rank/stats/heatmap/coaching/hand-history). Replaces
// the per-screen bare "no data" text. Themed via COLORS tokens; sized via
// responsive helpers; ONE shared value drives a fade+rise mount entrance.
//
// Reanimated safety: 1 shared value/screen, NO withRepeat, NO loops.
import React, { useEffect } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, Easing } from 'react-native-reanimated';
import { COLORS } from '../constants/gameConfig';
import { rf, rs, rv } from '../utils/responsive';

interface EmptyStateProps {
  icon: string;                    // emoji or single-glyph icon
  title: string;
  subtitle?: string;
  ctaLabel?: string;
  onCta?: () => void;
  preview?: React.ReactNode;       // optional grayed payoff preview
}

export function EmptyState({ icon, title, subtitle, ctaLabel, onCta, preview }: EmptyStateProps) {
  const enter = useSharedValue(0);

  useEffect(() => {
    enter.value = withTiming(1, { duration: 360, easing: Easing.out(Easing.cubic) });
  }, [enter]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: enter.value,
    transform: [{ translateY: (1 - enter.value) * rs(12) }],
  }));

  return (
    <Animated.View style={[styles.container, animatedStyle]} accessibilityRole="summary">
      <View style={styles.badge}>
        <Text style={styles.badgeIcon} accessibilityElementsHidden importantForAccessibility="no">
          {icon}
        </Text>
      </View>
      <Text style={styles.title} accessibilityRole="header">{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      {preview ? (
        <View style={styles.previewWrap} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no">
          {preview}
        </View>
      ) : null}
      {ctaLabel && onCta ? (
        <Pressable
          onPress={onCta}
          accessibilityRole="button"
          accessibilityLabel={ctaLabel}
          style={({ pressed }) => [styles.cta, pressed && styles.ctaPressed]}
          hitSlop={8}
        >
          <Text style={styles.ctaText}>{ctaLabel}</Text>
        </Pressable>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: rs(24),
    paddingVertical: rs(32),
    gap: rs(12),
  },
  badge: {
    width: rs(72),
    height: rs(72),
    borderRadius: rs(36),
    backgroundColor: 'rgba(79,214,168,0.12)',  // mint @12%
    borderWidth: 1,
    borderColor: 'rgba(79,214,168,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: rs(6),
  },
  badgeIcon: {
    fontSize: rf(32),
  },
  title: {
    color: COLORS.textPrimary,
    fontSize: rf(20),
    fontWeight: '800',
    textAlign: 'center',
  },
  subtitle: {
    color: COLORS.textMuted,
    fontSize: rf(14),
    fontWeight: '500',
    lineHeight: rf(20),
    textAlign: 'center',
    maxWidth: rs(280),
  },
  previewWrap: {
    opacity: 0.25,
    marginTop: rs(8),
    marginBottom: rs(8),
    alignItems: 'center',
    justifyContent: 'center',
  },
  cta: {
    marginTop: rs(12),
    backgroundColor: COLORS.mint,
    paddingHorizontal: rs(28),
    paddingVertical: rs(12),
    borderRadius: rv(10),
    minWidth: rs(140),
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
  ctaText: {
    color: COLORS.background,
    fontSize: rf(15),
    fontWeight: '800',
    letterSpacing: 0.5,
  },
});
