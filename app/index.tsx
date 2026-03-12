import React, { useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
} from 'react-native-reanimated';
import ChipsDisplay from '../components/ChipsDisplay';
import { Button } from '../components/Button';
import { useGameStore } from '../store/gameStore';
import { COLORS } from '../constants/gameConfig';

export default function HomeScreen() {
  const router = useRouter();
  const chips = useGameStore((s) => s.chips);
  const handsPlayed = useGameStore((s) => s.handsPlayed);
  const bestChips = useGameStore((s) => s.bestChips);
  const sessionStartChips = useGameStore((s) => s.sessionStartChips);

  const sessionNet = chips - sessionStartChips;

  // Pulsing glow behind title (native only — skip on web to avoid hydration issues)
  const glowOpacity = useSharedValue(0.3);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    glowOpacity.value = withRepeat(
      withSequence(
        withTiming(0.6, { duration: 1500 }),
        withTiming(0.3, { duration: 1500 }),
      ),
      -1,
    );
  }, []);

  const glowStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value,
  }));

  // Web-safe navigation: use window.location as fallback if router.push fails
  const navigateTo = useCallback((path: string) => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.location.href = path;
    } else {
      router.push(path as any);
    }
  }, [router]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.titleSection}>
          {/* Pulsing glow — static on web, animated on native */}
          {Platform.OS === 'web' ? (
            <View style={[styles.titleGlow, { opacity: 0.4 }]} />
          ) : (
            <Animated.View pointerEvents="none" style={[styles.titleGlow, glowStyle]} />
          )}
          <Text style={styles.titleSmall}>{'\u2660'} {'\u2665'} {'\u2666'} {'\u2663'}</Text>
          <Text style={styles.title}>CAPS</Text>
          <Text style={styles.titleSub}>POKER</Text>
          <View style={styles.titleLine} />
        </View>

        <ChipsDisplay amount={chips} label="Your Balance" size="large" />

        <View style={styles.statsRow}>
          <Text style={styles.statText}>Hands Played: {handsPlayed}</Text>
          <Text style={[styles.statText, { color: sessionNet >= 0 ? COLORS.success : COLORS.danger }]}>
            Session: {sessionNet >= 0 ? '+' : ''}{sessionNet}
          </Text>
          <Text style={[styles.statBest, { color: COLORS.gold }]}>
            {'\u2605'} Best: {bestChips} chips
          </Text>
        </View>

        <View style={styles.buttonSection}>
          <Button title="NEW HAND (vs Bot)" variant="gold" onPress={() => navigateTo('/game')} />
          <Button title="HOST GAME" variant="secondary" onPress={() => navigateTo('/lobby/host')} />
          <Button title="JOIN GAME" variant="secondary" onPress={() => navigateTo('/lobby/join')} />
          <Button title="SETTINGS" variant="ghost" onPress={() => navigateTo('/settings')} />
        </View>

        <Button
          title="Reset Chips"
          variant="ghost"
          onPress={() => useGameStore.getState().setChips(useGameStore.getState().config.startingChips)}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    gap: 40,
  },
  titleSection: {
    alignItems: 'center',
    position: 'relative',
  },
  titleGlow: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: COLORS.neonBlue,
    top: -40,
    alignSelf: 'center',
    zIndex: -1,
  },
  titleSmall: {
    color: COLORS.gold,
    fontSize: 20,
    letterSpacing: 12,
    marginBottom: 8,
  },
  title: {
    fontSize: 72,
    fontWeight: '900',
    color: COLORS.gold,
    letterSpacing: 16,
    textShadowColor: COLORS.goldGlow,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 30,
  },
  titleSub: {
    fontSize: 24,
    fontWeight: '300',
    color: COLORS.neonBlue,
    letterSpacing: 12,
    marginTop: -4,
  },
  titleLine: {
    width: '60%',
    height: 2,
    backgroundColor: COLORS.neonBlue,
    marginTop: 12,
    borderRadius: 1,
  },
  statsRow: {
    alignItems: 'center',
    gap: 6,
  },
  statText: {
    color: COLORS.textSecondary,
    fontSize: 15,
    fontWeight: '600',
  },
  statBest: {
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: 1,
  },
  buttonSection: {
    width: '100%',
    gap: 12,
  },
});
