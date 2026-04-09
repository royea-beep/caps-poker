import React, { useEffect, useState } from 'react';
import { View, Text, Platform, StyleSheet, TouchableOpacity } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  cancelAnimation,
} from 'react-native-reanimated';
import { rf } from '../utils/responsive';
import { KILL_game } from '../utils/animationKill';

// Circular timer component — depleting ring on web, pulsing circle on native
function CircularTimer({ timeLeft, size, color, pulsing }: { timeLeft: number; size: number; color: string; pulsing: boolean }) {
  const pulseScale = useSharedValue(1);

  useEffect(() => {
    if (pulsing) {
      if (!KILL_game) {
        pulseScale.value = withRepeat(
          withSequence(
            withTiming(1.12, { duration: 500 }),
            withTiming(1, { duration: 500 }),
          ),
          100, // finite — no withRepeat(-1) ever (iron rule)
        );
      }
    } else {
      cancelAnimation(pulseScale);
      pulseScale.value = withTiming(1, { duration: 200 });
    }
    return () => { cancelAnimation(pulseScale); };
  }, [pulsing]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
  }));

  const s = timeLeft % 60;
  const timeStr = `0:${s.toString().padStart(2, '0')}`;

  if (Platform.OS === 'web') {
    const progress = Math.max(0, Math.min(timeLeft / 60, 1));
    const deg = Math.round(progress * 360);
    return (
      <Animated.View style={[{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }, animStyle]}>
        {/* Depleting ring via conic-gradient */}
        <View style={[{ position: 'absolute', width: size, height: size, borderRadius: size / 2 },
          { background: `conic-gradient(${color} ${deg}deg, rgba(40,40,40,0.85) ${deg}deg)` } as any]} />
        {/* Inner dark mask to create ring */}
        <View style={{ position: 'absolute', width: size - 8, height: size - 8, borderRadius: (size - 8) / 2, backgroundColor: 'rgba(8,8,8,0.9)' }} />
        <Text style={[timerStyles.text, { color, fontSize: size * 0.30, zIndex: 1 }]}>{timeStr}</Text>
      </Animated.View>
    );
  }

  return (
    <Animated.View style={[timerStyles.container, { width: size, height: size, borderRadius: size / 2, borderColor: color }, animStyle]}>
      <Text style={[timerStyles.text, { color, fontSize: size * 0.32 }]}>{timeStr}</Text>
    </Animated.View>
  );
}

const timerStyles = StyleSheet.create({
  container: {
    borderWidth: 3,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  text: {
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
});

// Horizontal progress bar — shrinks left-to-right as time passes
function TimerBar({ countdown, total, color }: { countdown: number; total: number; color: string }) {
  const progress = useSharedValue(countdown / total);
  const pulseOpacity = useSharedValue(1);

  useEffect(() => {
    progress.value = withTiming(Math.max(0, countdown / total), { duration: 850 });
    return () => { cancelAnimation(progress); };
  }, [countdown]);

  useEffect(() => {
    if (countdown <= 3 && countdown > 0) {
      if (!KILL_game) {
        pulseOpacity.value = withRepeat(
          withSequence(withTiming(0.4, { duration: 250 }), withTiming(1, { duration: 250 })),
          20, false, // finite — countdown only runs 3s max so 20 cycles is plenty
        );
      }
    } else {
      cancelAnimation(pulseOpacity);
      pulseOpacity.value = withTiming(1, { duration: 100 });
    }
    return () => { cancelAnimation(pulseOpacity); };
  }, [countdown <= 3]);

  const barStyle = useAnimatedStyle(() => ({
    width: `${Math.max(0, progress.value * 100)}%` as any,
    opacity: pulseOpacity.value,
  }));

  return (
    <View style={timerBarStyles.track}>
      <Animated.View style={[timerBarStyles.fill, { backgroundColor: color }, barStyle]} />
    </View>
  );
}

const timerBarStyles = StyleSheet.create({
  track: {
    width: '100%',
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },
  fill: {
    height: 3,
    borderRadius: 1.5,
  },
});

export interface TimerControllerProps {
  countdown: number;
  total: number;
  isActive: boolean;
  firstFinisher: string | null;
  timerSize: number;
  timerColor: string;
  timerPulsing: boolean;
}

export function TimerController({ countdown, total: _total, isActive, firstFinisher: _firstFinisher, timerSize, timerColor, timerPulsing }: TimerControllerProps) {
  const [tooltipVisible, setTooltipVisible] = useState(false);
  if (!isActive) return null;
  return (
    <View style={tcStyles.wrapper}>
      <TouchableOpacity
        onPress={() => {
          setTooltipVisible(true);
          setTimeout(() => setTooltipVisible(false), 2000);
        }}
        activeOpacity={0.8}
      >
        <CircularTimer timeLeft={countdown} size={timerSize} color={timerColor} pulsing={timerPulsing} />
      </TouchableOpacity>
      {tooltipVisible && (
        <View style={tcStyles.tooltip}>
          <Text style={tcStyles.tooltipText}>Time out = cards placed randomly</Text>
        </View>
      )}
    </View>
  );
}

// Export TimerBar for use at the correct layout position (below bot status bar)
export { TimerBar };

const tcStyles = StyleSheet.create({
  wrapper: { alignItems: 'center' },
  tooltip: {
    position: 'absolute',
    top: '100%',
    marginTop: 6,
    backgroundColor: 'rgba(0,0,0,0.85)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    zIndex: 100,
    minWidth: 180,
    alignItems: 'center',
  },
  tooltipText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
});
