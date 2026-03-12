import React, { useEffect } from 'react';
import { Text, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import { COLORS } from '../constants/gameConfig';

interface BadgeProps {
  label: string;
  variant?: 'win' | 'lose' | 'tie' | 'rank';
  small?: boolean;
}

const BADGE_COLORS = {
  win: { bg: COLORS.gold, text: COLORS.background },
  lose: { bg: COLORS.neonRed, text: COLORS.white },
  tie: { bg: COLORS.textDim, text: COLORS.white },
  rank: { bg: 'transparent', text: COLORS.gold },
};

export function Badge({ label, variant = 'win', small }: BadgeProps) {
  const scale = useSharedValue(0);

  useEffect(() => {
    scale.value = withSpring(1, { damping: 12, stiffness: 200 });
  }, [scale]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const colors = BADGE_COLORS[variant];

  return (
    <Animated.View
      style={[
        styles.badge,
        { backgroundColor: colors.bg },
        variant === 'rank' && styles.rankBorder,
        small && styles.badgeSmall,
        animatedStyle,
      ]}
    >
      <Text style={[styles.text, { color: colors.text }, small && styles.textSmall]}>{label}</Text>
    </Animated.View>
  );
}

export default Badge;

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 999,
    alignSelf: 'flex-start',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeSmall: {
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  rankBorder: {
    borderWidth: 1.5,
    borderColor: COLORS.gold,
  },
  text: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
  },
  textSmall: {
    fontSize: 9,
    letterSpacing: 0,
  },
});
