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
        <Text style={styles.chipIcon}>🪙</Text>
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
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 2,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  chipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  chipIcon: {
    fontSize: 16,
  },
  amount: {
    color: COLORS.gold,
    fontSize: 18,
    fontWeight: '800',
  },
  amountLarge: {
    fontSize: 32,
  },
});
