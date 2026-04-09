/**
 * FloatingChips — S108
 * Animated +/- chip delta that floats up after board reveal.
 * ZERO Reanimated — RN Animated only.
 */
import React, { useEffect, useRef } from 'react';
import { Animated, Text, StyleSheet } from 'react-native';
import { rf, rs } from '../utils/responsive';

interface FloatingChipsProps {
  amount: number;   // positive = win, negative = lose
  visible: boolean;
  onDone?: () => void;
}

export function FloatingChips({ amount, visible, onDone }: FloatingChipsProps) {
  const translateY = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) return;
    translateY.setValue(0);
    opacity.setValue(1);

    Animated.parallel([
      Animated.timing(translateY, {
        toValue: -rs(60),
        duration: 1200,
        useNativeDriver: true,
      }),
      Animated.sequence([
        Animated.delay(800),
        Animated.timing(opacity, {
          toValue: 0,
          duration: 400,
          useNativeDriver: true,
        }),
      ]),
    ]).start(() => onDone?.());
  }, [visible]);

  if (!visible) return null;

  const isPositive = amount >= 0;
  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.container, { transform: [{ translateY }], opacity }]}
    >
      <Text style={[styles.text, isPositive ? styles.positive : styles.negative]}>
        {isPositive ? '+' : ''}{amount} 🪙
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    alignSelf: 'center',
    bottom: rs(40),
    zIndex: 99,
  },
  text: {
    fontSize: rf(22),
    fontWeight: '800',
    letterSpacing: 1,
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  positive: { color: '#c9a84c' },
  negative: { color: '#ef5350' },
});
