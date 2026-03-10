import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withDelay,
  withSequence,
  runOnJS,
} from 'react-native-reanimated';
import { COLORS } from '../constants/gameConfig';

interface CompleteOverlayProps {
  winner: 'player' | 'bot';
  bonusAmount: number;
  duration: number;
  onDone: () => void;
}

const { width, height } = Dimensions.get('window');
const NUM_PARTICLES = 12;

function Particle({ index }: { index: number }) {
  const angle = (index / NUM_PARTICLES) * 2 * Math.PI;
  const targetX = Math.cos(angle) * 120;
  const targetY = Math.sin(angle) * 120;

  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const opacity = useSharedValue(1);

  useEffect(() => {
    translateX.value = withDelay(100, withSpring(targetX, { damping: 12, stiffness: 60 }));
    translateY.value = withDelay(100, withSpring(targetY, { damping: 12, stiffness: 60 }));
    opacity.value = withDelay(200, withTiming(0, { duration: 800 }));
  }, []);

  const animStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
    ],
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      style={[
        styles.particle,
        animStyle,
      ]}
    />
  );
}

export default function CompleteOverlay({ winner, bonusAmount, duration, onDone }: CompleteOverlayProps) {
  // Timer-based auto-dismiss
  useEffect(() => {
    const timer = setTimeout(() => {
      onDone();
    }, duration * 1000);
    return () => clearTimeout(timer);
  }, [duration, onDone]);

  // "COMPLETE!" text entrance: scale from 0 -> 1.15 -> 1.0
  const titleScale = useSharedValue(0);
  // Sub text fade in
  const subOpacity = useSharedValue(0);
  // Bonus row slide up
  const bonusTranslateY = useSharedValue(30);
  const bonusOpacity = useSharedValue(0);

  useEffect(() => {
    titleScale.value = withSpring(1, { damping: 8, stiffness: 100 });
    subOpacity.value = withDelay(300, withTiming(1, { duration: 400 }));
    bonusTranslateY.value = withDelay(500, withSpring(0, { damping: 10, stiffness: 100 }));
    bonusOpacity.value = withDelay(500, withTiming(1, { duration: 400 }));
  }, []);

  const titleStyle = useAnimatedStyle(() => ({
    transform: [{ scale: titleScale.value }],
  }));

  const subStyle = useAnimatedStyle(() => ({
    opacity: subOpacity.value,
  }));

  const bonusStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: bonusTranslateY.value }],
    opacity: bonusOpacity.value,
  }));

  return (
    <View style={styles.overlay}>
      {/* Particles */}
      <View style={styles.particleContainer}>
        {Array.from({ length: NUM_PARTICLES }).map((_, i) => (
          <Particle key={i} index={i} />
        ))}
      </View>

      <View style={styles.content}>
        <Animated.Text style={[styles.completeText, titleStyle]}>
          COMPLETE!
        </Animated.Text>
        <Animated.Text style={[styles.subText, subStyle]}>
          {winner === 'player' ? 'You swept' : 'Bot swept'} all boards!
        </Animated.Text>
        <Animated.View style={[styles.bonusRow, bonusStyle]}>
          <Text style={styles.bonusLabel}>BONUS</Text>
          <Text style={styles.bonusAmount}>+{bonusAmount} 🪙</Text>
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
  },
  content: {
    alignItems: 'center',
    padding: 40,
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
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.goldBright,
  },
  completeText: {
    fontSize: 52,
    fontWeight: '900',
    color: COLORS.goldBright,
    letterSpacing: 8,
    textShadowColor: COLORS.gold,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 30,
    marginBottom: 16,
  },
  subText: {
    fontSize: 18,
    color: COLORS.textPrimary,
    marginBottom: 24,
  },
  bonusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(212, 168, 67, 0.2)',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.gold,
  },
  bonusLabel: {
    color: COLORS.gold,
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 2,
  },
  bonusAmount: {
    color: COLORS.goldBright,
    fontSize: 28,
    fontWeight: '900',
  },
});
