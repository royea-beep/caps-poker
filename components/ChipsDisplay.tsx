import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { COLORS } from '../constants/gameConfig';
import { rf, rs } from '../utils/responsive';

interface ChipsDisplayProps {
  amount: number;
  label?: string;
  size?: 'small' | 'large';
}

// Denomination-based chip color — matches real poker chip standards
function getChipColor(amount: number): string {
  if (amount < 5) return COLORS.chip1;    // white
  if (amount < 25) return COLORS.chip5;   // red
  if (amount < 100) return COLORS.chip25; // green
  if (amount < 500) return COLORS.chip100; // black/dark
  return COLORS.chip500;                  // purple
}

// Premium poker chip component with denomination color
function PokerChip({ size, amount }: { size: 'small' | 'large'; amount: number }) {
  const outer = size === 'large' ? 26 : 18;
  const inner = size === 'large' ? 18 : 12;
  const chipColor = getChipColor(amount);
  return (
    <View
      style={[
        styles.chipOuter,
        { width: outer, height: outer, borderRadius: outer / 2, backgroundColor: chipColor },
      ]}
    >
      <View style={[styles.chipInner, { width: inner, height: inner, borderRadius: inner / 2 }]}>
        <View style={[styles.chipCenter, { backgroundColor: chipColor }]} />
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
        <PokerChip size={size} amount={amount} />
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
    fontSize: rf(12),
    fontWeight: '600',
    marginBottom: rs(4),
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
  chipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: rs(6),
  },
  // Premium chip: denomination-colored ring → dark inner → matching center dot
  chipOuter: {
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
    // backgroundColor set dynamically via chipColor
  },
  amount: {
    color: COLORS.gold,
    fontSize: rf(22),
    fontWeight: '900',
  },
  amountLarge: {
    fontSize: rf(36, 24, 42),
  },
});
