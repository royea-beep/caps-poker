import React, { useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, Platform, Alert } from 'react-native';
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
import { COLORS, getBoardCount } from '../constants/gameConfig';
import { ECONOMY_FLAGS } from '../constants/economyConfig';
import {
  getMatchCost,
  canAffordMatch,
  canClaimDailyReward,
  getNextStreak,
  calculateDailyReward,
  canUseFreeRefill,
  getFreeRefillAmount,
} from '../utils/economy';
import { CapsHooks } from '../utils/learning';

const isWeb = Platform.OS === 'web';

// Playfair Display font family — loaded via Google Fonts on web, falls back to serif on native
const DISPLAY_FONT = Platform.select({
  web: 'Playfair Display, Georgia, serif',
  default: undefined,
});

export default function HomeScreen() {
  const router = useRouter();
  const chips = useGameStore((s) => s.chips);
  const config = useGameStore((s) => s.config);
  const handsPlayed = useGameStore((s) => s.handsPlayed);
  const handsWon = useGameStore((s) => s.handsWon);
  const bestChips = useGameStore((s) => s.bestChips);
  const biggestWin = useGameStore((s) => s.biggestWin);
  const sessionStartChips = useGameStore((s) => s.sessionStartChips);
  const lastDailyRewardClaim = useGameStore((s) => s.lastDailyRewardClaim);
  const dailyRewardStreak = useGameStore((s) => s.dailyRewardStreak);
  const lastFreeRefill = useGameStore((s) => s.lastFreeRefill);

  const sessionNet = chips - sessionStartChips;

  useEffect(() => {
    CapsHooks.screenViewed('home');
  }, []);

  const handleNewHand = useCallback(() => {
    if (ECONOMY_FLAGS.matchCostEnabled) {
      const cost = getMatchCost(config.potPerBoard, getBoardCount(config.numberOfPlayers));
      if (!canAffordMatch(chips, cost)) {
        Alert.alert('Not Enough Chips', `You need ${cost} chips to play. Reset your chips or wait for a daily reward.`);
        return;
      }
    }
    router.push('/game' as any);
  }, [chips, config, router]);

  const handleClaimDailyReward = useCallback(() => {
    const now = new Date();
    if (!canClaimDailyReward(lastDailyRewardClaim, now)) {
      Alert.alert('Already Claimed', 'Come back tomorrow for your next reward!');
      return;
    }
    const nextStreak = getNextStreak(lastDailyRewardClaim, dailyRewardStreak, now);
    const reward = calculateDailyReward(nextStreak);
    const store = useGameStore.getState();
    store.addChips(reward);
    store.trackChipsEarned(reward);
    store.setLastDailyRewardClaim(now.toISOString());
    store.setDailyRewardStreak(nextStreak);
    CapsHooks.dailyRewardClaimed(nextStreak, reward);
    Alert.alert('Daily Reward!', `+${reward} chips${nextStreak > 1 ? ` (${nextStreak}-day streak!)` : ''}`);
  }, [lastDailyRewardClaim, dailyRewardStreak]);

  const handleFreeRefill = useCallback(() => {
    const now = new Date();
    if (!canUseFreeRefill(lastFreeRefill, now)) {
      Alert.alert('Refill Cooldown', 'You can refill again later.');
      return;
    }
    const amount = getFreeRefillAmount();
    const store = useGameStore.getState();
    store.addChips(amount);
    store.trackChipsEarned(amount);
    store.setLastFreeRefill(now.toISOString());
    Alert.alert('Free Refill!', `+${amount} chips added to your balance.`);
  }, [lastFreeRefill]);

  // Daily reward availability
  const canClaim = ECONOMY_FLAGS.dailyRewardEnabled && canClaimDailyReward(lastDailyRewardClaim);
  const canRefill = ECONOMY_FLAGS.freeRefillEnabled && canUseFreeRefill(lastFreeRefill);

  // Pulsing gold glow behind title
  const glowOpacity = useSharedValue(0.2);

  useEffect(() => {
    glowOpacity.value = withRepeat(
      withSequence(
        withTiming(0.5, { duration: 2000 }),
        withTiming(0.2, { duration: 2000 }),
      ),
      -1,
    );
  }, []);

  const glowStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value,
  }));

  return (
    <SafeAreaView style={styles.container}>
      {/* Grain texture overlay (web only) */}
      {isWeb && <View style={styles.grainOverlay} pointerEvents="none" />}

      <View style={styles.content}>
        {/* Title section */}
        <View style={styles.titleSection}>
          <Animated.View pointerEvents="none" style={[styles.titleGlow, glowStyle]} />

          {/* Suit symbols */}
          <Text style={styles.suitSymbols}>{'\u2660'} {'\u2665'} {'\u2666'} {'\u2663'}</Text>

          {/* Main title */}
          <Text style={[styles.title, DISPLAY_FONT ? { fontFamily: DISPLAY_FONT } : {}]}>
            CAPS
          </Text>

          <Text style={styles.titleSub}>The Game Where Every Board Counts</Text>

          {/* Gold divider */}
          <View style={styles.titleDivider} />
        </View>

        {/* Balance */}
        <ChipsDisplay amount={chips} label="Your Balance" size="large" />

        {/* Stats */}
        <View style={styles.statsSection}>
          <View style={styles.statsGrid}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{handsPlayed}</Text>
              <Text style={styles.statLabel}>Played</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{handsWon}</Text>
              <Text style={styles.statLabel}>Won</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: COLORS.gold }]}>
                {handsPlayed > 0 ? Math.round((handsWon / handsPlayed) * 100) : 0}%
              </Text>
              <Text style={styles.statLabel}>Win Rate</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: COLORS.gold }]}>{biggestWin}</Text>
              <Text style={styles.statLabel}>Best Win</Text>
            </View>
          </View>
          <Text style={[
            styles.sessionText,
            { color: sessionNet >= 0 ? COLORS.neonGreen : COLORS.neonRed },
          ]}>
            Session: {sessionNet >= 0 ? '+' : ''}{sessionNet}
          </Text>
        </View>

        {/* Daily reward */}
        {ECONOMY_FLAGS.dailyRewardEnabled && (
          <Button
            title={canClaim ? 'CLAIM DAILY REWARD' : 'REWARD CLAIMED'}
            variant={canClaim ? 'gold' : 'ghost'}
            disabled={!canClaim}
            onPress={handleClaimDailyReward}
            style={{ width: '100%' }}
          />
        )}

        {/* Action buttons */}
        <View style={styles.buttonSection}>
          <Button title="NEW HAND (vs Bot)" variant="gold" onPress={handleNewHand} />
          <View style={styles.modeRow}>
            <Button title="SIT & GO" variant="secondary" onPress={() => router.push('/sit-and-go' as any)} style={styles.modeButton} />
            <Button title="TOURNAMENT" variant="secondary" onPress={() => router.push('/tournament' as any)} style={styles.modeButton} />
          </View>
          <Button title="PLAY ONLINE" variant="secondary" onPress={() => router.push('/lobby/internet-host' as any)} />
          <Button title="HOST GAME (WiFi)" variant="secondary" onPress={() => router.push('/lobby/host' as any)} />
          <Button title="JOIN GAME" variant="secondary" onPress={() => router.push('/lobby/join' as any)} />
          <Button title="LEADERBOARD" variant="ghost" onPress={() => router.push('/leaderboard' as any)} />
          <Button title="HAND HISTORY" variant="ghost" onPress={() => router.push('/hand-history' as any)} />
          <Button title="SETTINGS" variant="ghost" onPress={() => router.push('/settings' as any)} />
        </View>

        {/* Refill / Reset */}
        {ECONOMY_FLAGS.freeRefillEnabled ? (
          <Button
            title={canRefill ? 'FREE REFILL' : 'REFILL USED'}
            variant={canRefill ? 'secondary' : 'ghost'}
            disabled={!canRefill}
            onPress={handleFreeRefill}
          />
        ) : (
          <Button
            title="Reset Chips"
            variant="ghost"
            onPress={() => useGameStore.getState().setChips(useGameStore.getState().config.startingChips)}
          />
        )}

        {__DEV__ && (
          <Button
            title="SIMULATE"
            variant="ghost"
            onPress={() => router.push('/simulate' as any)}
          />
        )}
      </View>

      {/* Version badge — bottom-right, gold */}
      <Text style={styles.versionLabel}>v1.9.1</Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  // Subtle grain texture overlay — web only
  grainOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 0,
    pointerEvents: 'none',
    ...Platform.select({
      web: {
        backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'300\' height=\'300\'%3E%3Cfilter id=\'n\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.75\' numOctaves=\'4\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'300\' height=\'300\' filter=\'url(%23n)\' opacity=\'0.035\'/%3E%3C/svg%3E")',
        backgroundRepeat: 'repeat',
      } as any,
      default: {},
    }),
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    gap: 24,
    zIndex: 1,
  },

  // Title section
  titleSection: {
    alignItems: 'center',
    position: 'relative',
    gap: 4,
  },
  titleGlow: {
    position: 'absolute',
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: COLORS.gold,
    top: -60,
    alignSelf: 'center',
    zIndex: -1,
    ...Platform.select({
      web: {
        background: `radial-gradient(circle, rgba(201,168,76,0.35) 0%, rgba(10,10,10,0) 70%)`,
      } as any,
      default: {},
    }),
  },
  suitSymbols: {
    color: COLORS.gold,
    fontSize: 18,
    letterSpacing: 12,
    opacity: 0.7,
    marginBottom: 4,
  },
  title: {
    fontSize: 80,
    fontWeight: '900',
    color: COLORS.gold,
    letterSpacing: 20,
    textShadowColor: COLORS.goldGlow,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 40,
    ...Platform.select({
      web: {
        background: 'linear-gradient(135deg, #e8c96a 0%, #c9a84c 50%, #9a7a2e 100%)',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        backgroundClip: 'text',
      } as any,
      default: {},
    }),
  },
  titleSub: {
    fontSize: 13,
    fontWeight: '400',
    color: COLORS.textMuted,
    letterSpacing: 3,
    marginTop: 2,
    textTransform: 'uppercase',
  },
  titleDivider: {
    width: 120,
    height: 1,
    backgroundColor: COLORS.gold,
    marginTop: 14,
    opacity: 0.5,
  },

  // Stats section
  statsSection: {
    alignItems: 'center',
    gap: 8,
    width: '100%',
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    alignItems: 'center',
    width: '100%',
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...Platform.select({
      web: {
        boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
      } as any,
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.6,
        shadowRadius: 12,
      },
      android: { elevation: 8 },
    }),
  },
  statItem: {
    alignItems: 'center',
    gap: 4,
    flex: 1,
  },
  statDivider: {
    width: 1,
    height: 32,
    backgroundColor: COLORS.border,
  },
  statValue: {
    color: COLORS.text,
    fontSize: 20,
    fontWeight: '800',
  },
  statLabel: {
    color: COLORS.textMuted,
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  sessionText: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.5,
  },

  // Buttons
  buttonSection: {
    width: '100%',
    gap: 10,
  },
  modeRow: {
    flexDirection: 'row',
    gap: 10,
  },
  modeButton: {
    flex: 1,
  },

  // Version
  versionLabel: {
    position: 'absolute',
    bottom: 14,
    right: 18,
    color: COLORS.gold,
    fontSize: 11,
    fontWeight: '600',
    opacity: 0.7,
    letterSpacing: 0.5,
  },
});
