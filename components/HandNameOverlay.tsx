import React, { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from 'react-native-reanimated';
import { rv, rf, rs } from '../utils/responsive';

interface HandNameOverlayProps {
  handName: string;
  isWinner: boolean;
}

export default function HandNameOverlay({ handName, isWinner }: HandNameOverlayProps) {
  const translateX = useSharedValue(40);
  const opacity = useSharedValue(0);

  useEffect(() => {
    translateX.value = withTiming(0, { duration: 220 });
    opacity.value = withTiming(1, { duration: 200 });
  }, [handName]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
    opacity: opacity.value,
  }));

  return (
    <Animated.View style={[styles.pill, animStyle]}>
      <Animated.Text style={[styles.text, isWinner ? styles.win : styles.lose]}>
        {handName}
      </Animated.Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  pill: {
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.65)',
    borderRadius: rv(8),
    paddingHorizontal: rs(10),
    paddingVertical: rs(3),
    marginTop: rs(3),
  },
  text: {
    fontSize: rf(11),
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  win: {
    color: '#FFD700',
    textShadowColor: 'rgba(255,215,0,0.45)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 6,
  },
  lose: {
    color: 'rgba(255,255,255,0.38)',
  },
});
