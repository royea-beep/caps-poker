import React, { useEffect } from 'react';
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

const isWeb = Platform.OS === 'web';

export default function HomeScreen() {
  const router = useRouter();
  const chips = useGameStore((s) => s.chips);
  const handsPlayed = useGameStore((s) => s.handsPlayed);
  const bestChips = useGameStore((s) => s.bestChips);
  const sessionStartChips = useGameStore((s) => s.sessionStartChips);

  const sessionNet = chips - sessionStartChips;

  // Pulsing glow behind title (native only)
  const glowOpacity = useSharedValue(0.3);

  useEffect(() => {
    if (isWeb) return;
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

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.titleSection}>
          {isWeb ? (
            <View style={[styles.titleGlow, styles.titleGlowWeb]} />
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
          <Button title="NEW HAND (vs Bot)" variant="gold" onPress={() => router.push('/game' as any)} />
          <Button title="HOST GAME" variant="secondary" onPress={() => router.push('/lobby/host' as any)} />
          <Button title="JOIN GAME" variant="secondary" onPress={() => router.push('/lobby/join' as any)} />
          <Button title="SETTINGS" variant="ghost" onPress={() => router.push('/settings' as any)} />
        </View>

        <Button
          title="Reset Chips"
          variant="ghost"
          onPress={() => useGameStore.getState().setChips(useGameStore.getState().config.startingChips)}
        />

        {__DEV__ && (
          <Button
            title="SIMULATE"
            variant="ghost"
            onPress={() => router.push('/simulate' as any)}
          />
        )}
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
    gap: 28,
    ...Platform.select({
      web: { maxWidth: 540, alignSelf: 'center' as const, width: '100%' },
      default: {},
    }),
  },
  titleSection: {
    alignItems: 'center',
    position: 'relative',
  },
  titleGlow: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: COLORS.gold,
    top: -40,
    alignSelf: 'center',
    zIndex: -1,
  },
  titleGlowWeb: {
    opacity: 0.25,
    ...Platform.select({
      web: {
        background: `radial-gradient(circle, ${COLORS.gold}66 0%, ${COLORS.background}00 70%)`,
        width: 280,
        height: 280,
        top: -60,
      } as any,
      default: {},
    }),
  },
  titleSmall: {
    color: COLORS.gold,
    fontSize: 22,
    letterSpacing: 14,
    marginBottom: 8,
  },
  title: {
    fontSize: 80,
    fontWeight: '900',
    color: COLORS.gold,
    letterSpacing: 20,
    textShadowColor: COLORS.goldGlow,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 40,
  },
  titleSub: {
    fontSize: 26,
    fontWeight: '300',
    color: COLORS.textMuted,
    letterSpacing: 14,
    marginTop: -4,
  },
  titleLine: {
    width: '60%',
    height: 1,
    backgroundColor: COLORS.gold,
    marginTop: 16,
    borderRadius: 1,
    opacity: 0.4,
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
    ...Platform.select({
      web: { maxWidth: 480, alignSelf: 'center' as const },
      default: {},
    }),
  },
});
