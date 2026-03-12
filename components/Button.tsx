import React, { useRef, useCallback } from 'react';
import { Text, StyleSheet, ActivityIndicator, TouchableOpacity, Animated, Pressable, ViewStyle, Platform } from 'react-native';

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);
import { COLORS } from '../constants/gameConfig';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'gold' | 'secondary' | 'ghost';
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
}

// Platform-aware shadow helper — returns iOS shadow, Android elevation, or web boxShadow
function platformShadow(color: string, offsetY: number, opacity: number, radius: number, elevation: number): ViewStyle {
  if (Platform.OS === 'web') {
    const r = parseInt(color.slice(1, 3), 16);
    const g = parseInt(color.slice(3, 5), 16);
    const b = parseInt(color.slice(5, 7), 16);
    return { boxShadow: `0px ${offsetY}px ${radius}px rgba(${r},${g},${b},${opacity})` } as ViewStyle;
  }
  if (Platform.OS === 'android') {
    return { elevation };
  }
  return {
    shadowColor: color,
    shadowOffset: { width: 0, height: offsetY },
    shadowOpacity: opacity,
    shadowRadius: radius,
  };
}

export function Button({
  title,
  onPress,
  variant = 'gold',
  disabled = false,
  loading = false,
  style,
}: ButtonProps) {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = useCallback(() => {
    if (disabled) return;
    Animated.timing(scaleAnim, { toValue: 0.95, duration: 80, useNativeDriver: true }).start();
  }, [disabled, scaleAnim]);

  const handlePressOut = useCallback(() => {
    if (disabled) return;
    Animated.timing(scaleAnim, { toValue: 1.0, duration: 80, useNativeDriver: true }).start();
  }, [disabled, scaleAnim]);

  const variantStyle =
    variant === 'gold'
      ? [styles.variantGold, platformShadow(COLORS.gold, 4, 0.5, 8, 8)]
      : variant === 'secondary'
      ? [styles.variantSecondary, platformShadow(COLORS.neonBlue, 0, 0.2, 6, 4)]
      : styles.variantGhost;

  const textStyle =
    variant === 'gold'
      ? styles.textGold
      : variant === 'secondary'
      ? styles.textSecondary
      : styles.textGhost;

  const content = loading ? (
    <ActivityIndicator
      color={variant === 'gold' ? COLORS.background : COLORS.neonBlue}
      size="small"
    />
  ) : (
    <Text style={[styles.text, textStyle]}>{title}</Text>
  );

  // Web: use Pressable (renders as <div> with onClick — no AnimatedTouchable issues)
  if (Platform.OS === 'web') {
    return (
      <Pressable
        onPress={disabled || loading ? undefined : onPress}
        style={({ pressed }) => [
          styles.base,
          variantStyle,
          (disabled || loading) && styles.disabled,
          pressed && { opacity: 0.8, transform: [{ scale: 0.95 }] },
          { cursor: disabled ? 'not-allowed' : 'pointer' } as ViewStyle,
          style,
        ]}
        accessibilityRole="button"
        accessibilityLabel={title}
      >
        {content}
      </Pressable>
    );
  }

  // iOS/Android: AnimatedTouchable with scale animation
  return (
    <AnimatedTouchable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={disabled || loading}
      activeOpacity={0.8}
      style={[
        styles.base,
        variantStyle,
        (disabled || loading) && styles.disabled,
        { transform: [{ scale: scaleAnim }] },
        style,
      ]}
      accessibilityRole="button"
      accessibilityLabel={title}
    >
      {content}
    </AnimatedTouchable>
  );
}

export default Button;

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 8,
    minHeight: 48,
  },
  variantGold: {
    backgroundColor: COLORS.gold,
  },
  variantSecondary: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: COLORS.neonBlue,
  },
  variantGhost: {
    backgroundColor: 'transparent',
  },
  disabled: {
    opacity: 0.5,
  },
  text: {
    fontWeight: '700',
    letterSpacing: 2,
  },
  textGold: {
    color: COLORS.background,
    fontSize: 16,
    fontWeight: '900',
  },
  textSecondary: {
    color: COLORS.neonBlue,
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
