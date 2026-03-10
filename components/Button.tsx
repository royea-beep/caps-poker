import React, { useCallback } from 'react';
import { Text, StyleSheet, ActivityIndicator, Pressable, ViewStyle } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import { COLORS } from '../constants/gameConfig';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'gold' | 'secondary' | 'ghost';
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
}

export function Button({
  title,
  onPress,
  variant = 'gold',
  disabled = false,
  loading = false,
  style,
}: ButtonProps) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = useCallback(() => {
    if (disabled) return;
    scale.value = withSpring(0.95, { damping: 15, stiffness: 300 });
  }, [disabled, scale]);

  const handlePressOut = useCallback(() => {
    if (disabled) return;
    scale.value = withSpring(1.0, { damping: 12, stiffness: 200 });
  }, [disabled, scale]);

  const variantStyle =
    variant === 'gold'
      ? styles.variantGold
      : variant === 'secondary'
      ? styles.variantSecondary
      : styles.variantGhost;

  const textStyle =
    variant === 'gold'
      ? styles.textGold
      : variant === 'secondary'
      ? styles.textSecondary
      : styles.textGhost;

  return (
    <Animated.View style={animatedStyle}>
      <Pressable
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={disabled || loading}
        style={[
          styles.base,
          variantStyle,
          (disabled || loading) && styles.disabled,
          style,
        ]}
        accessibilityRole="button"
        accessibilityLabel={title}
        accessibilityState={{ disabled: disabled || loading }}
      >
        {loading ? (
          <ActivityIndicator
            color={variant === 'gold' ? COLORS.background : COLORS.textSecondary}
            size="small"
          />
        ) : (
          <Text style={[styles.text, textStyle]}>{title}</Text>
        )}
      </Pressable>
    </Animated.View>
  );
}

export default Button;

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    minHeight: 48,
  },
  variantGold: {
    backgroundColor: COLORS.gold,
    shadowColor: COLORS.gold,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  variantSecondary: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: COLORS.boardBorder,
  },
  variantGhost: {
    backgroundColor: 'transparent',
  },
  disabled: {
    opacity: 0.5,
  },
  text: {
    fontWeight: '900',
    letterSpacing: 3,
  },
  textGold: {
    color: COLORS.background,
    fontSize: 18,
  },
  textSecondary: {
    color: COLORS.textSecondary,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 2,
  },
  textGhost: {
    color: COLORS.textSecondary,
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0,
  },
});
