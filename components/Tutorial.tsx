import React, { useState, useEffect } from 'react';
import { View, Text, Pressable, StyleSheet, Platform } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from 'react-native-reanimated';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { COLORS } from '../constants/gameConfig';

export const TUTORIAL_SEEN_KEY = 'caps_tutorial_seen';

const STEPS = [
  {
    icon: '🃏',
    title: 'Welcome to CAPS Poker',
    body: 'You get cards. You decide where they go.',
    visual: '♠ ♥ ♦ ♣',
  },
  {
    icon: '👆',
    title: 'Place Cards on Boards',
    body: 'Tap a card, then tap a board to place it. 4 cards per board.',
    visual: 'Card → Board',
  },
  {
    icon: '💰',
    title: 'Win Boards, Win Chips',
    body: 'Each board is a separate Omaha hand. Win the board = win the pot.',
    visual: '✅ ✅ ✅',
  },
  {
    icon: '🏆',
    title: 'COMPLETE = MEGA BONUS',
    body: 'Win ALL boards? 50% bonus chips from your opponent!',
    visual: '🥇🥇🥇🥇',
  },
] as const;

interface TutorialProps {
  onDone: () => void;
}

export default function Tutorial({ onDone }: TutorialProps) {
  const [step, setStep] = useState(0);
  const opacity = useSharedValue(1);
  const fadeStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  const advance = () => {
    if (step < STEPS.length - 1) {
      opacity.value = withTiming(0, { duration: 150 }, () => {
        opacity.value = withTiming(1, { duration: 200 });
      });
      setStep(s => s + 1);
    } else {
      AsyncStorage.setItem(TUTORIAL_SEEN_KEY, 'true').catch(() => {});
      onDone();
    }
  };

  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;

  return (
    <View style={styles.overlay}>
      <Animated.View style={[styles.card, fadeStyle]}>
        <Text style={styles.icon}>{current.icon}</Text>
        <Text style={styles.visual}>{current.visual}</Text>
        <Text style={styles.title}>{current.title}</Text>
        <Text style={styles.body}>{current.body}</Text>

        <View style={styles.dots}>
          {STEPS.map((_, i) => (
            <View key={i} style={[styles.dot, i === step && styles.dotActive]} />
          ))}
        </View>

        <Pressable style={[styles.btn, isLast && styles.btnLast]} onPress={advance}>
          <Text style={styles.btnText}>{isLast ? "Let's Play! 🎯" : 'Next →'}</Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.88)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 500,
    padding: 24,
  },
  card: {
    backgroundColor: '#1a1a2e',
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: COLORS.gold,
    padding: 28,
    alignItems: 'center',
    width: '100%',
    maxWidth: 360,
    gap: 12,
    ...Platform.select({
      ios: { shadowColor: COLORS.gold, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.4, shadowRadius: 20 },
      android: { elevation: 12 },
      default: { boxShadow: `0 0 30px rgba(201,168,76,0.35)` } as any,
    }),
  },
  icon: {
    fontSize: 48,
  },
  visual: {
    fontSize: 28,
    letterSpacing: 8,
    color: COLORS.gold,
    fontWeight: '900',
  },
  title: {
    color: COLORS.goldBright,
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  body: {
    color: COLORS.textPrimary,
    fontSize: 15,
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: 22,
    opacity: 0.9,
  },
  dots: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.boardBorder,
  },
  dotActive: {
    backgroundColor: COLORS.gold,
    width: 20,
    borderRadius: 4,
  },
  btn: {
    backgroundColor: COLORS.gold,
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 14,
    marginTop: 8,
    width: '100%',
    alignItems: 'center',
  },
  btnLast: {
    backgroundColor: COLORS.neonGreen,
  },
  btnText: {
    color: '#0a0a0a',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 1,
  },
});
