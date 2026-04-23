/**
 * XPBar — displays Battle Pass XP progress.
 * compact=false: full bar with tier label + XP count
 * compact=true:  tiny lobby bar (height ~24px)
 * Uses RN Animated only — ZERO Reanimated.
 */
import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { rf, rs, rv } from '../utils/responsive';

const GOLD = '#c96a1a';
const SURFACE = '#1a0e06';
const BORDER = '#3d2a1a';
const TEXT_PRIMARY = '#f5e6d3';
const TEXT_SECONDARY = '#78716C';

export interface XPBarProps {
  currentXP: number;
  currentTier: number;
  progress: number;   // 0–1
  xpInTier: number;
  xpNeeded: number;
  compact?: boolean;
}

export default function XPBar({
  currentXP,
  currentTier,
  progress,
  xpInTier,
  xpNeeded,
  compact = false,
}: XPBarProps) {
  const animatedWidth = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(animatedWidth, {
      toValue: Math.min(1, Math.max(0, progress)),
      duration: 500,
      useNativeDriver: false,
    }).start();
  }, [progress]);

  if (compact) {
    return (
      <View style={styles.compactContainer}>
        {/* Tier badge */}
        <View style={styles.compactBadge}>
          <Text style={styles.compactBadgeText}>{currentTier}</Text>
        </View>

        {/* Thin bar */}
        <View style={styles.compactBarTrack}>
          <Animated.View
            style={[
              styles.compactBarFill,
              {
                width: animatedWidth.interpolate({
                  inputRange: [0, 1],
                  outputRange: ['0%', '100%'],
                }),
              },
            ]}
          />
        </View>
      </View>
    );
  }

  // Full variant
  return (
    <View style={styles.fullContainer}>
      {/* Labels row */}
      <View style={styles.labelsRow}>
        <View style={styles.tierLabelRow}>
          <View style={styles.tierBadge}>
            <Text style={styles.tierBadgeText}>{currentTier}</Text>
          </View>
          <Text style={styles.tierLabel}>Tier {currentTier}</Text>
        </View>
        <Text style={styles.xpCount}>
          {(xpInTier ?? 0).toLocaleString()} / {((xpInTier ?? 0) + (xpNeeded ?? 0)).toLocaleString()} XP
        </Text>
      </View>

      {/* Progress bar */}
      <View style={styles.barTrack}>
        <Animated.View
          style={[
            styles.barFill,
            {
              width: animatedWidth.interpolate({
                inputRange: [0, 1],
                outputRange: ['0%', '100%'],
              }),
            },
          ]}
        />
        {/* Shimmer line at tip */}
        <Animated.View
          style={[
            styles.barTip,
            {
              left: animatedWidth.interpolate({
                inputRange: [0, 1],
                outputRange: ['0%', '100%'],
              }),
            },
          ]}
        />
      </View>

      {/* Total XP hint */}
      <Text style={styles.totalXP}>Total XP: {(currentXP ?? 0).toLocaleString()}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  // ── Compact ──────────────────────────────────────────────────────────────
  compactContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 24,
    gap: rs(6),
  },
  compactBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: GOLD,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: SURFACE,
  },
  compactBadgeText: {
    color: GOLD,
    fontSize: rf(9),
    fontWeight: '700',
  },
  compactBarTrack: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    backgroundColor: BORDER,
    overflow: 'hidden',
  },
  compactBarFill: {
    height: '100%',
    borderRadius: 3,
    backgroundColor: GOLD,
  },

  // ── Full ─────────────────────────────────────────────────────────────────
  fullContainer: {
    gap: rs(6),
    paddingHorizontal: rs(2),
  },
  labelsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  tierLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: rs(6),
  },
  tierBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    borderColor: GOLD,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: SURFACE,
  },
  tierBadgeText: {
    color: GOLD,
    fontSize: rf(11),
    fontWeight: '800',
  },
  tierLabel: {
    color: TEXT_PRIMARY,
    fontSize: rf(13),
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  xpCount: {
    color: TEXT_SECONDARY,
    fontSize: rf(12),
    fontWeight: '500',
  },
  barTrack: {
    height: 10,
    borderRadius: 5,
    backgroundColor: BORDER,
    overflow: 'visible',
  },
  barFill: {
    height: '100%',
    borderRadius: 5,
    backgroundColor: GOLD,
  },
  barTip: {
    position: 'absolute',
    top: -2,
    width: 2,
    height: 14,
    borderRadius: 1,
    backgroundColor: '#ffb347',
    marginLeft: -1,
  },
  totalXP: {
    color: TEXT_SECONDARY,
    fontSize: rf(10),
    textAlign: 'right',
    letterSpacing: 0.3,
  },
});
