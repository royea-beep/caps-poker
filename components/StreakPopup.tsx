/**
 * StreakPopup — shown on app open when claim_daily_streak RPC returns { claimed: true }.
 * Shows streak count, chip reward (count-up animation), 7-day milestone dots, COLLECT button.
 * Auto-dismisses after 5 seconds.
 * Uses RN Animated only — zero Reanimated.
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
  Platform,
} from 'react-native';
import { rs, rf, rv } from '../utils/responsive';

interface StreakPopupProps {
  streak: number;
  reward: number;
  nextReward: number;
  milestones?: Array<{ day: number; reward: number }> | null;
  onCollect: () => void;
}

const MILESTONE_DAYS = 7;
const AUTO_DISMISS_MS = 5000;

export function StreakPopup({
  streak,
  reward,
  nextReward,
  onCollect,
}: StreakPopupProps) {
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.88)).current;
  const [displayChips, setDisplayChips] = useState(0);
  const dismissed = useRef(false);

  useEffect(() => {
    // Fade + scale in
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 250, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, useNativeDriver: true, friction: 7, tension: 80 }),
    ]).start();

    // Count up chips over ~1.1s
    const steps = 20;
    const stepAmount = Math.max(1, Math.ceil(reward / steps));
    let current = 0;
    const iv = setInterval(() => {
      current = Math.min(current + stepAmount, reward);
      setDisplayChips(current);
      if (current >= reward) clearInterval(iv);
    }, 55);

    // Auto-dismiss
    const timer = setTimeout(dismiss, AUTO_DISMISS_MS);

    return () => {
      clearInterval(iv);
      clearTimeout(timer);
    };
  }, []);

  const dismiss = () => {
    if (dismissed.current) return;
    dismissed.current = true;
    Animated.parallel([
      Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }),
      Animated.timing(scale, { toValue: 0.92, duration: 200, useNativeDriver: true }),
    ]).start(() => onCollect());
  };

  // Fire emoji grows with streak (capped at 72)
  const fireSize = Math.min(72, 40 + (streak - 1) * 4);
  // Which dot in the 7-day cycle is "current" (1-indexed)
  const cycleDot = ((streak - 1) % MILESTONE_DAYS) + 1;

  return (
    <Animated.View style={[styles.overlay, { opacity }]}>
      <Pressable style={StyleSheet.absoluteFillObject} onPress={dismiss} />
      <Animated.View style={[styles.card, { transform: [{ scale }] }]}>
        <Text style={[styles.fire, { fontSize: fireSize }]}>🔥</Text>
        <Text style={styles.title}>DAY {streak} STREAK!</Text>
        <Text style={styles.chips}>+{displayChips.toLocaleString()} CHIPS</Text>

        {/* 7-day milestone dots */}
        <View style={styles.dotsRow}>
          {Array.from({ length: MILESTONE_DAYS }, (_, i) => {
            const day = i + 1;
            const filled = day <= cycleDot;
            return (
              <View key={day} style={styles.dotItem}>
                <Text style={[styles.dot, filled ? styles.dotFilled : styles.dotEmpty]}>
                  {filled ? '●' : '○'}
                </Text>
                <Text style={styles.dotLabel}>{day}</Text>
              </View>
            );
          })}
        </View>
        <Text style={styles.milestoneHint}>Day 7: 1,000 chips</Text>

        <Pressable style={styles.collectBtn} onPress={dismiss}>
          <Text style={styles.collectBtnText}>COLLECT</Text>
        </Pressable>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject as object,
    backgroundColor: 'rgba(0,0,0,0.8)',
    zIndex: 500,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: rs(24),
  },
  card: {
    backgroundColor: '#1C0508',
    borderRadius: rv(20),
    borderWidth: 1.5,
    borderColor: 'rgba(201,168,76,0.5)',
    padding: rs(28),
    alignItems: 'center',
    gap: rs(6),
    maxWidth: 340,
    width: '100%',
    ...Platform.select({
      ios: { shadowColor: '#c9a84c', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.35, shadowRadius: 24 },
      android: { elevation: 12 },
      default: {},
    }),
  },
  fire: {
    lineHeight: 1.1 as any,
    marginBottom: rs(4),
  },
  title: {
    color: '#c9a84c',
    fontSize: rf(22),
    fontWeight: '900',
    letterSpacing: 2,
    textAlign: 'center',
  },
  chips: {
    color: '#39FF14',
    fontSize: rf(32),
    fontWeight: '900',
    letterSpacing: 1,
    textAlign: 'center',
    marginVertical: rs(4),
  },
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: rs(8),
    marginTop: rs(8),
    marginBottom: rs(2),
  },
  dotItem: {
    alignItems: 'center',
    minWidth: rs(20),
  },
  dot: {
    fontSize: rf(16),
  },
  dotFilled: {
    color: '#c9a84c',
  },
  dotEmpty: {
    color: 'rgba(255,255,255,0.2)',
  },
  dotLabel: {
    color: 'rgba(255,255,255,0.35)',
    fontSize: rf(9),
    marginTop: rs(2),
  },
  milestoneHint: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: rf(12),
    marginTop: rs(2),
    marginBottom: rs(4),
  },
  collectBtn: {
    backgroundColor: '#c9a84c',
    borderRadius: rv(12),
    paddingVertical: rs(14),
    paddingHorizontal: rs(40),
    marginTop: rs(10),
    width: '100%',
    alignItems: 'center',
  },
  collectBtnText: {
    color: '#1C0508',
    fontSize: rf(18),
    fontWeight: '900',
    letterSpacing: 3,
  },
});
