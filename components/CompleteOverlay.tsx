import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withDelay,
  withSequence,
  withRepeat,
  cancelAnimation,
} from 'react-native-reanimated';
import { COLORS } from '../constants/gameConfig';
import { playSound } from '../utils/sounds';
import ProQuoteBanner from './ProQuoteBanner';
import { rv, rf, rs } from '../utils/responsive';
import { KILL_CompleteOverlay } from '../utils/animationKill';

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

// SAFE_MODE: disable particles + pulse
// Root cause: 40 particles × 4 shared values = 160 simultaneous Reanimated worklets
// → Hermes watchdog kills the app. Static display until a safe particle approach is built.
const SAFE_MODE = true;

const NUM_PARTICLES = 40;

const PARTICLE_COLORS = [
  COLORS.gold,
  COLORS.goldLight,
  COLORS.goldBright,
  '#FFFFFF',
  '#E5C56A',
  COLORS.neonGreen,
];

function Particle({ index }: { index: number }) {
  const angle = (index / NUM_PARTICLES) * 2 * Math.PI + (Math.random() * 0.4 - 0.2);
  const radius = 80 + (index % 5) * 28;
  const targetX = Math.cos(angle) * radius;
  const targetY = Math.sin(angle) * radius;
  const particleSize = 5 + (index % 4) * 3;
  const color = PARTICLE_COLORS[index % PARTICLE_COLORS.length];
  const delay = 60 + (index % 6) * 40;

  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const opacity = useSharedValue(1);
  const scale = useSharedValue(0.3);

  useEffect(() => {
    translateX.value = withDelay(delay, withSpring(targetX, { damping: 10, stiffness: 50 }));
    translateY.value = withDelay(delay, withSpring(targetY, { damping: 10, stiffness: 50 }));
    scale.value = withDelay(delay, withSpring(1, { damping: 8, stiffness: 80 }));
    opacity.value = withDelay(300 + delay, withTiming(0, { duration: 700 }));
  }, []);

  const animStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      style={[
        styles.particle,
        {
          width: particleSize,
          height: particleSize,
          borderRadius: particleSize / 2,
          backgroundColor: color,
        },
        animStyle,
      ]}
    />
  );
}

// Static safe version — no animations
function SafeCompleteOverlay({ winner, bonusAmount, duration, onDone }: CompleteOverlayProps) {
  useEffect(() => {
    playSound('complete');
    if (Haptics) {
      Haptics.impactAsync?.(Haptics.ImpactFeedbackStyle?.Heavy)?.catch?.(() => {});
    }
    const timer = setTimeout(() => { onDone(); }, duration * 1000);
    return () => clearTimeout(timer);
  }, [duration, onDone]);

  return (
    <View style={styles.overlay}>
      <View style={styles.content}>
        <Text style={styles.trophyText}>{winner === 'player' ? '🏆' : '🤖'}</Text>
        <Text style={styles.completeText}>{winner === 'player' ? 'COMPLETE!' : 'SWEPT!'}</Text>
        <Text style={styles.subText}>{winner === 'player' ? 'You swept all boards!' : 'Bot swept all boards!'}</Text>
        <View style={styles.bonusRow}>
          <Text style={styles.bonusLabel}>BONUS</Text>
          <Text style={styles.bonusSeparator}>+</Text>
          <Text style={styles.bonusAmount}>{bonusAmount}</Text>
          <View style={styles.bonusChip} />
        </View>
      </View>
    </View>
  );
}

// Full animated version (disabled while SAFE_MODE = true)
function AnimatedCompleteOverlay({ winner, bonusAmount, duration, onDone }: CompleteOverlayProps) {
  const flashOpacity = useSharedValue(0);
  const flashStyle = useAnimatedStyle(() => ({ opacity: flashOpacity.value }));

  useEffect(() => {
    playSound('complete');
    flashOpacity.value = withSequence(
      withTiming(0.7, { duration: 80 }),
      withTiming(0, { duration: 220 }),
    );

    if (Haptics) {
      Haptics.impactAsync?.(Haptics.ImpactFeedbackStyle?.Heavy)?.catch?.(() => {});
      const t1 = setTimeout(() => {
        Haptics.impactAsync?.(Haptics.ImpactFeedbackStyle?.Medium)?.catch?.(() => {});
      }, 300);
      const t2 = setTimeout(() => {
        Haptics.impactAsync?.(Haptics.ImpactFeedbackStyle?.Light)?.catch?.(() => {});
      }, 600);
      const done = setTimeout(() => { onDone(); }, duration * 1000);
      return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(done); };
    }

    const timer = setTimeout(() => { onDone(); }, duration * 1000);
    return () => clearTimeout(timer);
  }, [duration, onDone]);

  const titleScale = useSharedValue(0);
  const titlePulse = useSharedValue(1);
  const subOpacity = useSharedValue(0);
  const bonusTranslateY = useSharedValue(30);
  const bonusOpacity = useSharedValue(0);

  useEffect(() => {
    titleScale.value = withSpring(1, { damping: 6, stiffness: 90 });
    if (!KILL_CompleteOverlay) {
      titlePulse.value = withDelay(
        600,
        withRepeat(
          withSequence(
            withTiming(1.04, { duration: 800 }),
            withTiming(1.0, { duration: 800 }),
          ),
          -1,
        ),
      );
    }
    subOpacity.value = withDelay(300, withTiming(1, { duration: 400 }));
    bonusTranslateY.value = withDelay(500, withSpring(0, { damping: 10, stiffness: 100 }));
    bonusOpacity.value = withDelay(500, withTiming(1, { duration: 400 }));
    return () => { cancelAnimation(titlePulse); };
  }, []);

  const titleStyle = useAnimatedStyle(() => ({
    transform: [{ scale: titleScale.value * titlePulse.value }],
  }));
  const subStyle = useAnimatedStyle(() => ({ opacity: subOpacity.value }));
  const bonusStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: bonusTranslateY.value }],
    opacity: bonusOpacity.value,
  }));

  return (
    <View style={styles.overlay}>
      <Animated.View style={[StyleSheet.absoluteFillObject, styles.flashLayer, flashStyle]} pointerEvents="none" />
      <View style={styles.particleContainer}>
        {Array.from({ length: NUM_PARTICLES }).map((_, i) => (
          <Particle key={i} index={i} />
        ))}
      </View>
      <View style={styles.content}>
        <Animated.Text style={[styles.trophyText, titleStyle]}>
          {winner === 'player' ? '\uD83C\uDFC6' : '\uD83E\uDD16'}
        </Animated.Text>
        <Animated.Text style={[styles.completeText, titleStyle]}>
          {winner === 'player' ? 'COMPLETE!' : 'SWEPT!'}
        </Animated.Text>
        <Animated.Text style={[styles.subText, subStyle]}>
          {winner === 'player' ? 'You swept all boards!' : 'Bot swept all boards!'}
        </Animated.Text>
        <Animated.View style={[styles.bonusRow, bonusStyle]}>
          <Text style={styles.bonusLabel}>BONUS</Text>
          <Text style={styles.bonusSeparator}>+</Text>
          <Text style={styles.bonusAmount}>{bonusAmount}</Text>
          <View style={styles.bonusChip} />
        </Animated.View>
        {winner === 'player' && (
          <Animated.View style={[{ marginTop: rs(16), width: '100%' }, bonusStyle]}>
            <ProQuoteBanner context="complete" />
          </Animated.View>
        )}
      </View>
    </View>
  );
}

export default function CompleteOverlay(props: CompleteOverlayProps) {
  return SAFE_MODE ? <SafeCompleteOverlay {...props} /> : <AnimatedCompleteOverlay {...props} />;
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.88)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
  },
  content: {
    alignItems: 'center',
    padding: rs(40),
  },
  particleContainer: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    width: 0,
    height: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  particle: {
    position: 'absolute',
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
  },
  subText: {
    fontSize: rf(17),
    color: COLORS.textPrimary,
    marginBottom: rs(28),
    fontWeight: '500',
    letterSpacing: 0.5,
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
  flashLayer: {
    backgroundColor: '#FFFFFF',
    zIndex: 200,
  },
});
