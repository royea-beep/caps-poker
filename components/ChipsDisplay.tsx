import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS } from '../constants/gameConfig';

interface ChipsDisplayProps {
  amount: number;
  label?: string;
  size?: 'small' | 'large';
}

export default function ChipsDisplay({ amount, label, size = 'small' }: ChipsDisplayProps) {
  const isLarge = size === 'large';
  return (
    <View style={styles.container}>
      {label && <Text style={styles.label}>{label}</Text>}
      <View style={styles.chipRow}>
        <Text style={[styles.chipIcon, isLarge && styles.chipIconLarge]}>{'\ud83e\ude99'}</Text>
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
  chipIcon: {
    fontSize: 20,
  },
  chipIconLarge: {
    fontSize: 28,
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
