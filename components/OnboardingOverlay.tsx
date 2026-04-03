/**
 * OnboardingOverlay — 3-screen intro for first-time users.
 * Shown when AsyncStorage 'hasSeenOnboarding' is not set.
 * Uses RN Animated only — zero Reanimated.
 */
import React, { useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { rs, rf, rv } from '../utils/responsive';
import { track } from '../utils/analytics';

export const ONBOARDING_SEEN_KEY = 'hasSeenOnboarding';

const SCREENS = [
  {
    emoji: '🃏',
    subtitle: 'What is CAPS?',
    title: 'MULTIPLE BOARDS.\nONE DECK.',
    body: 'Each board has 5 community cards. You get 4 cards per board. More players = fewer boards — it all fits in one 52-card deck.',
  },
  {
    emoji: '✅',
    subtitle: 'How to Win',
    title: 'WIN MORE BOARDS\nTHAN THE DEALER',
    body: 'Each board is a separate poker hand — your cards vs the dealer. Win the majority of boards to earn chips!',
  },
  {
    emoji: '🔥',
    subtitle: 'Ready?',
    title: 'PLAY DAILY.\nBUILD YOUR STREAK.',
    body: 'Come back every day for bonus chips\nand climb the leaderboard.',
  },
] as const;

interface OnboardingOverlayProps {
  onDone: () => void;
}

export function OnboardingOverlay({ onDone }: OnboardingOverlayProps) {
  const [screen, setScreen] = useState(0);
  const overlayOpacity = useRef(new Animated.Value(0)).current;
  const contentOpacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.timing(overlayOpacity, { toValue: 1, duration: 300, useNativeDriver: true }).start();
  }, []);

  const dismiss = (skipped = false) => {
    AsyncStorage.setItem(ONBOARDING_SEEN_KEY, 'true').catch(() => {});
    if (skipped) {
      track('onboarding_skipped', { at_screen: screen + 1 }, 'onboarding');
    } else {
      track('onboarding_completed', {}, 'onboarding');
    }
    Animated.timing(overlayOpacity, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => onDone());
  };

  const goToScreen = (next: number) => {
    track('onboarding_screen', { screen: next + 1 }, 'onboarding');
    Animated.timing(contentOpacity, { toValue: 0, duration: 150, useNativeDriver: true }).start(() => {
      setScreen(next);
      Animated.timing(contentOpacity, { toValue: 1, duration: 200, useNativeDriver: true }).start();
    });
  };

  const handleNext = () => {
    if (screen < SCREENS.length - 1) {
      goToScreen(screen + 1);
    } else {
      dismiss();
    }
  };

  const current = SCREENS[screen];
  const isLast = screen === SCREENS.length - 1;

  return (
    <Animated.View style={[styles.overlay, { opacity: overlayOpacity }]}>
      {/* Skip */}
      <Pressable onPress={() => dismiss(true)} style={styles.skipBtn} hitSlop={12}>
        <Text style={styles.skipText}>Skip</Text>
      </Pressable>

      {/* Screen content */}
      <Animated.View style={[styles.content, { opacity: contentOpacity }]}>
        <Text style={styles.emoji}>{current.emoji}</Text>
        <Text style={styles.subtitle}>{current.subtitle}</Text>
        <Text style={styles.title}>{current.title}</Text>
        <Text style={styles.body}>{current.body}</Text>
      </Animated.View>

      {/* Dots indicator */}
      <View style={styles.dotsRow}>
        {SCREENS.map((_, i) => (
          <Pressable key={i} onPress={() => goToScreen(i)} hitSlop={8}>
            <Text style={[styles.dot, i === screen ? styles.dotActive : styles.dotInactive]}>●</Text>
          </Pressable>
        ))}
      </View>

      {/* CTA */}
      {isLast ? (
        <Pressable onPress={() => dismiss(false)} style={styles.ctaBtn}>
          <Text style={styles.ctaBtnText}>DEAL ME IN</Text>
        </Pressable>
      ) : (
        <Pressable onPress={handleNext} style={styles.nextBtn}>
          <Text style={styles.nextBtnText}>Next →</Text>
        </Pressable>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject as object,
    backgroundColor: 'rgba(28,5,8,0.97)',
    zIndex: 600,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: rs(32),
  },
  skipBtn: {
    position: 'absolute',
    top: rs(52),
    right: rs(20),
  },
  skipText: {
    color: 'rgba(255,255,255,0.35)',
    fontSize: rf(14),
  },
  content: {
    alignItems: 'center',
    marginBottom: rs(48),
  },
  emoji: {
    fontSize: 80,
    marginBottom: rs(16),
    textAlign: 'center',
  },
  subtitle: {
    color: 'rgba(201,168,76,0.7)',
    fontSize: rf(12),
    fontWeight: '700',
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: rs(8),
  },
  title: {
    color: '#ffffff',
    fontSize: rf(22),
    fontWeight: '900',
    letterSpacing: 1,
    textAlign: 'center',
    lineHeight: rf(30),
    marginBottom: rs(12),
  },
  body: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: rf(15),
    textAlign: 'center',
    lineHeight: rf(23),
  },
  dotsRow: {
    flexDirection: 'row',
    gap: rs(12),
    marginBottom: rs(28),
  },
  dot: {
    fontSize: rf(14),
  },
  dotActive: {
    color: '#c9a84c',
  },
  dotInactive: {
    color: 'rgba(255,255,255,0.18)',
  },
  ctaBtn: {
    backgroundColor: '#22C55E',
    borderRadius: rv(14),
    paddingVertical: rs(16),
    paddingHorizontal: rs(48),
    alignItems: 'center',
  },
  ctaBtnText: {
    color: '#ffffff',
    fontSize: rf(20),
    fontWeight: '900',
    letterSpacing: 3,
  },
  nextBtn: {
    paddingVertical: rs(12),
    paddingHorizontal: rs(36),
    borderWidth: 1,
    borderColor: 'rgba(201,168,76,0.4)',
    borderRadius: rv(10),
    alignItems: 'center',
  },
  nextBtnText: {
    color: '#c9a84c',
    fontSize: rf(16),
    fontWeight: '600',
  },
});
