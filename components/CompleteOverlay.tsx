import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Platform, Animated, useWindowDimensions } from 'react-native';
import { debugLog } from './DebugOverlay';
import { COLORS } from '../constants/gameConfig';
import { playSound } from '../utils/sounds';
import ProQuoteBanner from './ProQuoteBanner';
import { rv, rf, rs } from '../utils/responsive';

// Lazy-load expo-haptics
let Haptics: any = null;
try {
  Haptics = require('expo-haptics');
} catch {
  // not available on web
}

interface CompleteOverlayProps {
  winner: 'player' | 'bot';
  bonusAmount: number;
  duration: number;
  onDone: () => void;
}

const NUM_PARTICLES = 15;
const PARTICLE_COLORS = [
  COLORS.gold,
  COLORS.goldLight,
  COLORS.goldBright,
  '#FFFFFF',
  '#E5C56A',
  '#FF9800',
];

export default function CompleteOverlay({ winner, bonusAmount, duration, onDone }: CompleteOverlayProps) {
  const { width: screenW } = useWindowDimensions();
  debugLog('C1 CompleteOverlay mounted');

  // Title: scale 0 → 1.2 → 1.0
  const titleScale = useRef(new Animated.Value(0)).current;
  // Subtitle: opacity 0 → 1
  const subOpacity = useRef(new Animated.Value(0)).current;
  // Bonus row: opacity 0 → 1
  const bonusOpacity = useRef(new Animated.Value(0)).current;
  // Gold pulse ring: scale 1 → 2.5, opacity 1 → 0
  const ringScale = useRef(new Animated.Value(1)).current;
  const ringOpacity = useRef(new Animated.Value(1)).current;

  // 15 particles — translateY and opacity each
  const particleAnims = useRef(
    Array.from({ length: NUM_PARTICLES }, () => ({
      translateY: new Animated.Value(0),
      opacity: new Animated.Value(1),
    }))
  ).current;

  // Store composite animations for cleanup
  const particleAnimRef = useRef<Animated.CompositeAnimation | null>(null);
  const ringAnimRef = useRef<Animated.CompositeAnimation | null>(null);
  const titleAnimRef = useRef<Animated.CompositeAnimation | null>(null);

  // Particle layout: random position per particle (computed once at init, not animated)
  const particleLayout = useRef(
    Array.from({ length: NUM_PARTICLES }, (_, i) => ({
      left: (i / NUM_PARTICLES) * screenW * 0.85 + screenW * 0.05, // spread across width
      bottom: 100 + (i % 5) * 60, // stagger starting heights
      size: 4 + (i % 4) * (8 / 4), // 4 to 8pt
      color: PARTICLE_COLORS[i % PARTICLE_COLORS.length],
      duration: 1200 + (i % 4) * 150, // 1200–1800ms
    }))
  ).current;

  useEffect(() => {
    debugLog(`C2 winner=${winner} bonus=${bonusAmount} duration=${duration}`);
    debugLog('C3 playSound(complete)');
    playSound('complete');

    if (Haptics) {
      Haptics.impactAsync?.(Haptics.ImpactFeedbackStyle?.Heavy)?.catch?.(() => {});
      const t1 = setTimeout(() => {
        Haptics.impactAsync?.(Haptics.ImpactFeedbackStyle?.Medium)?.catch?.(() => {});
      }, 300);
      const t2 = setTimeout(() => {
        Haptics.impactAsync?.(Haptics.ImpactFeedbackStyle?.Light)?.catch?.(() => {});
      }, 600);
      const done = setTimeout(() => { debugLog('C6 onDone called'); onDone(); }, duration * 1000);
      return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(done); };
    }

    const done = setTimeout(() => { debugLog('C6 onDone called'); onDone(); }, duration * 1000);
    return () => clearTimeout(done);
  }, [duration, onDone]);

  useEffect(() => {
    // Title scale-in: 0 → 1.2 → 1.0
    titleAnimRef.current = Animated.sequence([
      Animated.timing(titleScale, { toValue: 1.2, duration: 300, useNativeDriver: true }),
      Animated.timing(titleScale, { toValue: 1.0, duration: 200, useNativeDriver: true }),
    ]);
    titleAnimRef.current.start();

    // Subtitle fade at 300ms
    Animated.timing(subOpacity, { toValue: 1, duration: 400, delay: 300, useNativeDriver: true }).start();

    // Bonus fade at 500ms
    Animated.timing(bonusOpacity, { toValue: 1, duration: 400, delay: 500, useNativeDriver: true }).start();

    // Gold pulse ring — once only
    ringAnimRef.current = Animated.parallel([
      Animated.timing(ringScale, { toValue: 2.5, duration: 800, useNativeDriver: true }),
      Animated.timing(ringOpacity, { toValue: 0, duration: 800, useNativeDriver: true }),
    ]);
    ringAnimRef.current.start();

    // 15 particles — all at once via Animated.parallel
    particleAnimRef.current = Animated.parallel(
      particleAnims.map((anim, i) =>
        Animated.parallel([
          Animated.timing(anim.translateY, {
            toValue: -(80 + (i % 5) * 20),
            duration: particleLayout[i].duration,
            useNativeDriver: true,
          }),
          Animated.sequence([
            Animated.delay(200),
            Animated.timing(anim.opacity, {
              toValue: 0,
              duration: particleLayout[i].duration - 200,
              useNativeDriver: true,
            }),
          ]),
        ])
      )
    );
    particleAnimRef.current.start();

    return () => {
      titleAnimRef.current?.stop();
      ringAnimRef.current?.stop();
      particleAnimRef.current?.stop();
      titleScale.stopAnimation();
      subOpacity.stopAnimation();
      bonusOpacity.stopAnimation();
      ringScale.stopAnimation();
      ringOpacity.stopAnimation();
      particleAnims.forEach((a) => { a.translateY.stopAnimation(); a.opacity.stopAnimation(); });
    };
  }, []);

  return (
    <View style={styles.overlay}>
      {/* 15 particles — RN Animated, translateY + opacity */}
      {particleAnims.map((anim, i) => (
        <Animated.View
          key={i}
          pointerEvents="none"
          style={[
            styles.particle,
            {
              left: particleLayout[i].left,
              bottom: particleLayout[i].bottom,
              width: particleLayout[i].size,
              height: particleLayout[i].size,
              borderRadius: particleLayout[i].size / 2,
              backgroundColor: particleLayout[i].color,
              opacity: anim.opacity,
              transform: [{ translateY: anim.translateY }],
            },
          ]}
        />
      ))}

      {/* Gold pulse ring */}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.pulseRing,
          {
            opacity: ringOpacity,
            transform: [{ scale: ringScale }],
          },
        ]}
      />

      <View style={styles.content}>
        {/* Trophy + COMPLETE! title */}
        <Animated.View style={{ transform: [{ scale: titleScale }], alignItems: 'center' }}>
          <Text style={styles.trophyText}>{winner === 'player' ? '🏆' : '🤖'}</Text>
          <Text style={styles.completeText}>{winner === 'player' ? 'COMPLETE!' : 'SWEPT!'}</Text>
        </Animated.View>

        {/* Subtitle */}
        <Animated.Text style={[styles.subText, { opacity: subOpacity }]}>
          {winner === 'player' ? 'You swept all boards!' : 'Bot swept all boards!'}
        </Animated.Text>

        {/* Bonus row */}
        <Animated.View style={[styles.bonusRow, { opacity: bonusOpacity }]}>
          <Text style={styles.bonusLabel}>BONUS</Text>
          <Text style={styles.bonusSeparator}>+</Text>
          <Text style={styles.bonusAmount}>{bonusAmount}</Text>
          <View style={styles.bonusChip} />
        </Animated.View>

        {/* Pro quote */}
        {winner === 'player' && (
          <Animated.View style={[{ marginTop: rs(16), width: '100%' }, { opacity: bonusOpacity }]}>
            <ProQuoteBanner context="complete" />
          </Animated.View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.88)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
  },
  particle: {
    position: 'absolute',
  },
  pulseRing: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 2,
    borderColor: COLORS.gold,
  },
  content: {
    alignItems: 'center',
    padding: rs(40),
    zIndex: 1,
  },
  trophyText: {
    fontSize: rf(48),
    marginBottom: rs(8),
  },
  completeText: {
    fontSize: rf(48),
    fontWeight: '900',
    color: COLORS.goldLight,
    letterSpacing: 3,
    textShadowColor: COLORS.gold,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 24,
    marginBottom: rs(12),
    textAlign: 'center',
  },
  subText: {
    fontSize: rf(17),
    color: COLORS.textPrimary,
    marginBottom: rs(28),
    fontWeight: '500',
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  bonusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: rs(8),
    backgroundColor: 'rgba(201,168,76,0.18)',
    paddingHorizontal: rs(28),
    paddingVertical: rs(14),
    borderRadius: rv(14),
    borderWidth: 1.5,
    borderColor: COLORS.gold,
    ...Platform.select({
      ios: {
        shadowColor: COLORS.gold,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.4,
        shadowRadius: 12,
      },
      android: { elevation: 6 },
      default: {},
    }),
  },
  bonusLabel: {
    color: COLORS.gold,
    fontSize: rf(13),
    fontWeight: '800',
    letterSpacing: 2,
  },
  bonusSeparator: {
    color: COLORS.goldLight,
    fontSize: rf(24),
    fontWeight: '900',
  },
  bonusAmount: {
    color: COLORS.goldBright,
    fontSize: rf(30),
    fontWeight: '900',
  },
  bonusChip: {
    width: rv(14),
    height: rv(14),
    borderRadius: rv(7),
    backgroundColor: COLORS.gold,
    borderWidth: 2,
    borderColor: COLORS.background,
  },
});
