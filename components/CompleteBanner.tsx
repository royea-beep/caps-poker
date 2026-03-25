import React from 'react';
import { Text, StyleSheet, Platform, Animated } from 'react-native';
import { rf, rs, rv } from '../utils/responsive';
import { t } from '../utils/i18n';

interface CompleteBannerProps {
  visible: boolean;
  bonusChips: number;
  scale: Animated.Value;
}

export function CompleteBanner({ visible, bonusChips, scale }: CompleteBannerProps) {
  if (!visible || bonusChips <= 0) return null;
  return (
    <Animated.View style={[styles.completeRow, { transform: [{ scale }] }]}>
      <Text style={styles.completeLabel}>{t().complete} {t().completeBonus}</Text>
      <Text style={styles.completeAmount}>+{bonusChips} bonus chips!</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  completeRow: {
    width: '100%',
    alignItems: 'center',
    backgroundColor: 'rgba(255,215,0,0.08)',
    padding: rs(16),
    borderRadius: rv(12),
    borderWidth: 2,
    borderColor: '#FFD700',
    gap: rs(4),
    ...Platform.select({
      ios: { shadowColor: '#FFD700', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.3, shadowRadius: 12 },
      android: { elevation: 6 },
      default: { boxShadow: '0px 0px 16px rgba(255,215,0,0.3)' } as any,
    }),
  },
  completeLabel: {
    color: '#FFD700',
    fontSize: rf(20),
    fontWeight: '900',
    letterSpacing: 2,
    textAlign: 'center' as any,
  },
  completeAmount: {
    color: '#FFD700',
    fontSize: rf(16),
    fontWeight: '700',
    textAlign: 'center' as any,
  },
});
