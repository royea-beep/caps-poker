/**
 * LevelBadge — displays a player's level as a small circular badge.
 * Sizes: sm=18px, md=24px (default), lg=32px
 * Poker dark aesthetic: gold (#c96a1a) border + text, dark (#1a0e06) background.
 * Uses RN Animated — ZERO Reanimated.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { rf } from '../utils/responsive';

const GOLD = '#c96a1a';
const SURFACE = '#1a0e06';

export interface LevelBadgeProps {
  level: number;
  size?: 'sm' | 'md' | 'lg';
}

const SIZE_MAP = {
  sm: { diameter: 18, fontSize: rf(8), borderWidth: 1.5 },
  md: { diameter: 24, fontSize: rf(11), borderWidth: 2 },
  lg: { diameter: 32, fontSize: rf(15), borderWidth: 2.5 },
};

export default function LevelBadge({ level, size = 'md' }: LevelBadgeProps) {
  const { diameter, fontSize, borderWidth } = SIZE_MAP[size];
  const radius = diameter / 2;

  return (
    <View
      style={[
        styles.badge,
        {
          width: diameter,
          height: diameter,
          borderRadius: radius,
          borderWidth,
        },
      ]}
    >
      <Text style={[styles.label, { fontSize }]}>{level}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    borderColor: GOLD,
    backgroundColor: SURFACE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    color: GOLD,
    fontWeight: '800',
    includeFontPadding: false,
  },
});
