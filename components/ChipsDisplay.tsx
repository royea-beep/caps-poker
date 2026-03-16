import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { COLORS } from '../constants/gameConfig';

interface ChipsDisplayProps {
  amount: number;
  label?: string;
  size?: 'small' | 'large';
}

// Premium poker chip component
function PokerChip({ size }: { size: 'small' | 'large' }) {
  const outer = size === 'large' ? 26 : 18;
  const inner = size === 'large' ? 18 : 12;
  return (
    <View style={[styles.chipOuter, { width: outer, height: outer, borderRadius: outer / 2 }]}>
      <View style={[styles.chipInner, { width: inner, height: inner, borderRadius: inner / 2 }]}>
        <View style={styles.chipCenter} />
      </View>
    </View>
  );
}

export default function ChipsDisplay({ amount, label, size = 'small' }: ChipsDisplayProps) {
  const isLarge = size === 'large';
  return (
    <View style={styles.container}>
      {label && <Text style={styles.label}>{label}</Text>}
      <View style={styles.chipRow}>
        <PokerChip size={size} />
        <Text style={[styles.amount, isLarge && styles.amountLarge]}>
          {amount.toLocaleString()}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
  },
  label: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
  chipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  // Premium chip: gold ring → dark inner → gold center dot
  chipOuter: {
    backgroundColor: COLORS.gold,
    justifyContent: 'center',
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: COLORS.gold,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.5,
        shadowRadius: 4,
      },
      android: { elevation: 4 },
      default: {},
    }),
  },
  chipInner: {
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chipCenter: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.gold,
  },
  amount: {
    color: COLORS.gold,
    fontSize: 22,
    fontWeight: '900',
  },
  amountLarge: {
    fontSize: 36,
  },
});
