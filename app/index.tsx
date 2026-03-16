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

  // Daily reward availability (for button state)
  const canClaim = ECONOMY_FLAGS.dailyRewardEnabled && canClaimDailyReward(lastDailyRewardClaim);
  const canRefill = ECONOMY_FLAGS.freeRefillEnabled && canUseFreeRefill(lastFreeRefill);

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

  // Steam animation for coffee cups
  const steamOpacity = useSharedValue(0.3);

  useEffect(() => {
    steamOpacity.value = withRepeat(
      withSequence(
        withTiming(0.7, { duration: 2000 }),
        withTiming(0.2, { duration: 2000 }),
      ),
      -1,
    );
  }, []);

  const steamStyle = useAnimatedStyle(() => ({
    opacity: steamOpacity.value,
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

          {/* Couch scene — decorative background */}
          <View style={styles.couchScene}>
            <View style={styles.couchContainer}>
              <View style={styles.couchArm} />
              <View style={styles.cushion} />
              <View style={styles.cushion} />
              <View style={styles.cushion} />
              <View style={styles.couchArm} />
            </View>
            <View style={styles.coffeeTable}>
              <View style={styles.coffeeCupContainer}>
                <View style={styles.coffeeCup} />
                {!isWeb ? (
                  <Animated.View style={[styles.steam, steamStyle]} />
                ) : (
                  <View style={[styles.steam, { opacity: 0.4 }]} />
                )}
              </View>
              <View style={styles.coffeeCupContainer}>
                <View style={styles.coffeeCup} />
                {!isWeb ? (
                  <Animated.View style={[styles.steam, steamStyle]} />
                ) : (
                  <View style={[styles.steam, { opacity: 0.4 }]} />
                )}
              </View>
            </View>
          </View>

          <Text style={styles.titleSmall}>{'\u2660'} {'\u2665'} {'\u2666'} {'\u2663'}</Text>
          <Text style={styles.title}>CAPS</Text>
          <Text style={styles.titleSub}>The One Where You Play Poker</Text>
          <View style={styles.titleLine} />
        </View>

        <ChipsDisplay amount={chips} label="Your Balance" size="large" />

        <View style={styles.statsRow}>
          <View style={styles.statsGrid}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{handsPlayed}</Text>
              <Text style={styles.statLabel}>Played</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{handsWon}</Text>
              <Text style={styles.statLabel}>Won</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: COLORS.gold }]}>
                {handsPlayed > 0 ? Math.round((handsWon / handsPlayed) * 100) : 0}%
              </Text>
              <Text style={styles.statLabel}>Win Rate</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: COLORS.gold }]}>{biggestWin}</Text>
              <Text style={styles.statLabel}>Best Win</Text>
            </View>
          </View>
          <Text style={[styles.statText, { color: sessionNet >= 0 ? COLORS.success : COLORS.danger }]}>
            Session: {sessionNet >= 0 ? '+' : ''}{sessionNet}
          </Text>
        </View>

        {ECONOMY_FLAGS.dailyRewardEnabled && (
          <Button
            title={canClaim ? 'CLAIM DAILY REWARD' : 'REWARD CLAIMED'}
            variant={canClaim ? 'gold' : 'ghost'}
            disabled={!canClaim}
            onPress={handleClaimDailyReward}
            style={{ width: '100%' }}
          />
        )}

        <View style={styles.buttonSection}>
          <Button title="NEW HAND (vs Bot)" variant="gold" onPress={handleNewHand} />
          <Button title="PLAY ONLINE" variant="secondary" onPress={() => router.push('/lobby/internet-host' as any)} />
          <Button title="HOST GAME (WiFi)" variant="secondary" onPress={() => router.push('/lobby/host' as any)} />
          <Button title="JOIN GAME" variant="secondary" onPress={() => router.push('/lobby/join' as any)} />
          <Button title="LEADERBOARD" variant="ghost" onPress={() => router.push('/leaderboard' as any)} />
          <Button title="SETTINGS" variant="ghost" onPress={() => router.push('/settings' as any)} />
        </View>

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

      <Text style={styles.versionLabel}>v1.3.0</Text>
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
  // Couch scene styles
  couchScene: {
    position: 'absolute',
    top: 10,
    alignSelf: 'center',
    alignItems: 'center',
    opacity: 0.35,
    zIndex: -1,
  },
  couchContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 3,
  },
  couchArm: {
    width: 18,
    height: 50,
    backgroundColor: '#c06020',
    borderRadius: 10,
  },
  cushion: {
    width: 70,
    height: 60,
    backgroundColor: '#e8762b',
    borderRadius: 20,
  },
  coffeeTable: {
    width: 160,
    height: 8,
    backgroundColor: '#2d1f14',
    borderRadius: 3,
    marginTop: 8,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'flex-start',
  },
  coffeeCupContainer: {
    alignItems: 'center',
    marginTop: -16,
  },
  coffeeCup: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#c4a882',
    borderWidth: 1.5,
    borderColor: '#2d1f14',
  },
  steam: {
    width: 2,
    height: 10,
    backgroundColor: '#c4a882',
    borderRadius: 1,
    marginTop: -12,
  },
  titleSmall: {
    color: '#c4a882',
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
    fontSize: 16,
    fontWeight: '300',
    color: COLORS.textMuted,
    letterSpacing: 4,
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
    gap: 8,
    width: '100%',
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    width: '100%',
    backgroundColor: COLORS.feltLight,
    borderRadius: 10,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: COLORS.boardBorder,
  },
  statItem: {
    alignItems: 'center',
    gap: 2,
  },
  statValue: {
    color: COLORS.textPrimary,
    fontSize: 18,
    fontWeight: '800',
  },
  statLabel: {
    color: COLORS.textMuted,
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  statText: {
    color: COLORS.textSecondary,
    fontSize: 14,
    fontWeight: '600',
  },
  buttonSection: {
    width: '100%',
    gap: 12,
  },
  versionLabel: {
    position: 'absolute',
    bottom: 12,
    right: 16,
    color: COLORS.textDim,
    fontSize: 11,
    fontWeight: '500',
  },
});
