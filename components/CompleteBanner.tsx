import React, { useEffect, useRef } from 'react';
import { Text, StyleSheet, Platform, Animated, View } from 'react-native';
import { rf, rs, rv } from '../utils/responsive';
import { t } from '../utils/i18n';

interface CompleteBannerProps {
  visible: boolean;
  bonusChips: number;
  scale: Animated.Value;
  /** OTA-CHIP-UI-PARITY — practice is XP-only, no chips actually move; hide the bonus-chips line. */
  isPractice?: boolean;
}

const BALLOONS = ['🎈', '🌟', '🎊'];

function Balloon({ emoji, delay }: { emoji: string; delay: number }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.parallel([
          Animated.timing(opacity, { toValue: 1, duration: 300, useNativeDriver: true }),
          Animated.timing(translateY, { toValue: -90, duration: 1800, useNativeDriver: true }),
        ]),
        Animated.timing(opacity, { toValue: 0, duration: 400, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: 0, duration: 0, useNativeDriver: true }),
      ]),
      { iterations: 4 }
    );
    anim.start();
    return () => { anim.stop(); opacity.setValue(0); translateY.setValue(0); };
  }, []);

  return (
    <Animated.Text style={{ fontSize: 24, opacity, transform: [{ translateY }], position: 'absolute' }}>
      {emoji}
    </Animated.Text>
  );
}

export function CompleteBanner({ visible, bonusChips, scale, isPractice = false }: CompleteBannerProps) {
  // OTA-CHIP-UI-PARITY 2026-07-09 — bonusChips is real pot arithmetic (totalPot * bonus%)
  // even in practice, so it's never actually 0 there; the celebration itself should still
  // show on a practice sweep (COMPLETE is a real, board-count-driven achievement), just
  // without the chip amount. Non-practice keeps its original "no bonus configured" bail-out.
  if (!visible) return null;
  if (!isPractice && bonusChips <= 0) return null;
  return (
    <Animated.View style={[styles.completeRow, { transform: [{ scale }] }]}>
      <View style={styles.balloonRow} pointerEvents="none">
        {BALLOONS.map((emoji, i) => (
          <Balloon key={emoji} emoji={emoji} delay={i * 300} />
        ))}
      </View>
      <Text style={styles.completeLabel}>{t().complete} {t().completeBonus}</Text>
      {!isPractice && <Text style={styles.completeAmount}>+{bonusChips} bonus chips!</Text>}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  completeRow: {
    width: '100%',
    alignItems: 'center',
    backgroundColor: 'rgba(255,215,0,0.08)',
    padding: rs(16),
    borderRadius: rv(12),
    borderWidth: 2,
    borderColor: '#FFD700',
    gap: rs(4),
    overflow: 'hidden',
    ...Platform.select({
      ios: { shadowColor: '#FFD700', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.3, shadowRadius: 12 },
      android: { elevation: 6 },
      default: { boxShadow: '0px 0px 16px rgba(255,215,0,0.3)' } as any,
    }),
  },
  balloonRow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '100%',
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'flex-end',
    paddingHorizontal: rs(20),
  },
  completeLabel: {
    color: '#FFD700',
    fontSize: rf(20),
    fontWeight: '900',
    letterSpacing: 2,
    textAlign: 'center' as any,
    zIndex: 1,
  },
  completeAmount: {
    color: '#FFD700',
    fontSize: rf(16),
    fontWeight: '700',
    textAlign: 'center' as any,
    zIndex: 1,
  },
});
