/**
 * AchievementToast — brief popup shown when an achievement is unlocked.
 * Uses RN Animated only (ZERO Reanimated — complies with results.tsx rule).
 */
import React, { useEffect, useRef } from 'react';
import { Animated, Text, View, StyleSheet } from 'react-native';
import { rf, rs, rv } from '../utils/responsive';
import { COLORS } from '../constants/gameConfig';
import { Achievement } from '../utils/achievements';

interface Props {
  achievement: Achievement;
  onDone: () => void;
}

export default function AchievementToast({ achievement, onDone }: Props) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(40)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: 0, duration: 300, useNativeDriver: true }),
      ]),
      Animated.delay(2500),
      Animated.parallel([
        Animated.timing(opacity, { toValue: 0, duration: 300, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: -20, duration: 300, useNativeDriver: true }),
      ]),
    ]).start(() => onDone());
  }, []);

  return (
    <Animated.View style={[styles.toast, { opacity, transform: [{ translateY }] }]} pointerEvents="none">
      <View style={styles.inner}>
        <Text style={styles.trophy}>🏆</Text>
        <View style={styles.textCol}>
          <Text style={styles.label}>ACHIEVEMENT UNLOCKED</Text>
          <Text style={styles.name}>{achievement.name}</Text>
          <Text style={styles.reward}>+{achievement.reward} chips</Text>
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  toast: {
    position: 'absolute',
    bottom: rs(100),
    left: rs(16),
    right: rs(16),
    zIndex: 500,
    alignItems: 'center',
  },
  inner: {
    backgroundColor: 'rgba(20,12,6,0.97)',
    borderRadius: rv(12),
    borderWidth: 1.5,
    borderColor: COLORS.goldBright,
    paddingVertical: rs(12),
    paddingHorizontal: rs(16),
    flexDirection: 'row',
    alignItems: 'center',
    gap: rs(12),
    maxWidth: 360,
  },
  trophy: {
    fontSize: rf(28),
  },
  textCol: {
    flex: 1,
    gap: rs(2),
  },
  label: {
    color: COLORS.goldBright,
    fontSize: rf(10),
    fontWeight: '700',
    letterSpacing: 2,
  },
  name: {
    color: '#ffffff',
    fontSize: rf(16),
    fontWeight: '800',
  },
  reward: {
    color: '#22C55E',
    fontSize: rf(13),
    fontWeight: '600',
  },
});
