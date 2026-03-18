import React, { useEffect, useCallback, useState } from 'react';
import { View, Text, Image, StyleSheet, Platform, Alert, Pressable, ViewStyle } from 'react-native';
import { useRouter } from 'expo-router';
import Constants from 'expo-constants';
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
import { HOME_THEMES, HOME_THEME_NAMES, HomeTheme } from '../constants/homeThemes';
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
import { useAuthUser, signInWithGoogle, signOut } from '../utils/auth';

const isWeb = Platform.OS === 'web';

const DISPLAY_FONT = Platform.select({
  web: 'Playfair Display, Georgia, serif',
  default: undefined,
});

// Platform-aware floating shadow driven by accent color
function accentShadow(accent: string, opacity = 0.4): ViewStyle {
  if (Platform.OS === 'web') {
    const r = parseInt(accent.slice(1, 3), 16);
    const g = parseInt(accent.slice(3, 5), 16);
    const b = parseInt(accent.slice(5, 7), 16);
    return { boxShadow: `0 4px 20px rgba(${r},${g},${b},${opacity})` } as ViewStyle;
  }
  if (Platform.OS === 'android') return { elevation: 8 };
  return {
    shadowColor: accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: opacity,
    shadowRadius: 12,
  };
}

// ─── Themed button — used for primary + secondary CTAs on home screen ────────
interface HomeBtnProps {
  title: string;
  onPress: () => void;
  isPrimary?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
  theme: HomeTheme;
}

function HomeBtn({ title, onPress, isPrimary = false, disabled = false, style, theme: t }: HomeBtnProps) {
  const [pressed, setPressed] = useState(false);
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      style={[
        homeBtnBase,
        {
          backgroundColor: isPrimary ? t.buttonPrimary : t.buttonSecondaryBg,
          borderColor: isPrimary ? t.buttonPrimary : t.buttonSecondaryBorder,
          borderWidth: isPrimary ? 0 : 1.5,
        },
        accentShadow(t.accent, isPrimary ? 0.5 : 0.2),
        disabled && { opacity: 0.5 },
        pressed && { opacity: 0.82 },
        style,
      ]}
      accessibilityRole="button"
      accessibilityLabel={title}
    >
      <Text
        style={{
          color: isPrimary ? t.buttonPrimaryText : t.buttonSecondaryText,
          fontSize: isPrimary ? 16 : 15,
          fontWeight: '800',
          letterSpacing: 2,
        }}
      >
        {title}
      </Text>
    </Pressable>
  );
}

const homeBtnBase: ViewStyle = {
  width: '100%',
  alignItems: 'center',
  justifyContent: 'center',
  paddingVertical: 16,
  paddingHorizontal: 24,
  borderRadius: 16,
  minHeight: 52,
};

// ─── Home screen ─────────────────────────────────────────────────────────────
export default function HomeScreen() {
  const router = useRouter();
  const chips = useGameStore((s) => s.chips);
  const config = useGameStore((s) => s.config);
  const handsPlayed = useGameStore((s) => s.handsPlayed);
  const handsWon = useGameStore((s) => s.handsWon);
  const biggestWin = useGameStore((s) => s.biggestWin);
  const sessionStartChips = useGameStore((s) => s.sessionStartChips);
  const lastDailyRewardClaim = useGameStore((s) => s.lastDailyRewardClaim);
  const dailyRewardStreak = useGameStore((s) => s.dailyRewardStreak);
  const lastFreeRefill = useGameStore((s) => s.lastFreeRefill);
  const homeThemeId = useGameStore((s) => s.homeTheme);
  const theme = HOME_THEMES[homeThemeId];

  const user = useAuthUser();
  const [signingIn, setSigningIn] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const sessionNet = chips - sessionStartChips;

  useEffect(() => {
    CapsHooks.screenViewed('home');
  }, []);

  // Auto-save display name to store when user signs in
  useEffect(() => {
    if (user?.user_metadata?.full_name) {
      useGameStore.getState().setPlayerName(
        String(user.user_metadata.full_name).slice(0, 20)
      );
    }
  }, [user?.id]);

  const handleNewHand = useCallback(() => {
    if (ECONOMY_FLAGS.matchCostEnabled) {
      const cost = getMatchCost(config.potPerBoard, getBoardCount(config.numberOfPlayers));
      if (!canAffordMatch(chips, cost)) {
        Alert.alert('Not Enough Chips', `You need ${cost} chips to play.`);
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
    Alert.alert('Free Refill!', `+${amount} chips added.`);
  }, [lastFreeRefill]);

  const handleGoogleSignIn = useCallback(async () => {
    setSigningIn(true);
    setAuthError(null);
    const { error } = await signInWithGoogle();
    setSigningIn(false);
    if (error) {
      setAuthError(error.message);
    }
  }, []);

  const canClaim = ECONOMY_FLAGS.dailyRewardEnabled && canClaimDailyReward(lastDailyRewardClaim);
  const canRefill = ECONOMY_FLAGS.freeRefillEnabled && canUseFreeRefill(lastFreeRefill);

  // Pulsing glow behind title
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
  const glowStyle = useAnimatedStyle(() => ({ opacity: glowOpacity.value }));

  // Web title gradient only for dark_gold
  const webTitleGradient =
    isWeb && homeThemeId === 'dark_gold'
      ? ({
          background: 'linear-gradient(135deg, #e8c96a 0%, #c9a84c 50%, #9a7a2e 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
        } as any)
      : {};

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]}>
      {isWeb && <View style={styles.grainOverlay} />}

      <View style={styles.content}>

        {/* ── Title section ── */}
        <View style={styles.titleSection}>
          <Animated.View
            style={[
              styles.titleGlow,
              glowStyle,
              { backgroundColor: theme.accent },
              { pointerEvents: 'none' } as any,
            ]}
          />
          <Text style={[styles.suitSymbols, { color: theme.accent }]}>
            {'\u2660'} {'\u2665'} {'\u2666'} {'\u2663'}
          </Text>
          <Text
            style={[
              styles.title,
              { color: theme.titleColor },
              DISPLAY_FONT ? { fontFamily: DISPLAY_FONT } : {},
              webTitleGradient,
            ]}
          >
            CAPS
          </Text>
          <Text style={[styles.titleSub, { color: theme.subtitleColor }]}>
            Outsmart the Board. Win Every Round.
          </Text>
          <View style={[styles.titleDivider, { backgroundColor: theme.accent }]} />
        </View>

        {/* ── Balance ── */}
        <ChipsDisplay amount={chips} label="Your Balance" size="large" />

        {/* ── Stats ── */}
        <View style={styles.statsSection}>
          <View style={styles.statsGrid}>
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: theme.accent }]}>{handsPlayed}</Text>
              <Text style={styles.statLabel}>Played</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: theme.accent }]}>{handsWon}</Text>
              <Text style={styles.statLabel}>Won</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: theme.accent }]}>
                {handsPlayed > 0 ? Math.round((handsWon / handsPlayed) * 100) : 0}%
              </Text>
              <Text style={styles.statLabel}>Win Rate</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: theme.accent }]}>{biggestWin}</Text>
              <Text style={styles.statLabel}>Best Win</Text>
            </View>
          </View>
          <Text style={[styles.sessionText, { color: sessionNet >= 0 ? COLORS.neonGreen : COLORS.neonRed }]}>
            Session: {sessionNet >= 0 ? '+' : ''}{sessionNet}
          </Text>
        </View>

        {/* ── Daily reward ── */}
        {ECONOMY_FLAGS.dailyRewardEnabled && (
          <HomeBtn
            title={canClaim ? 'CLAIM DAILY REWARD' : 'REWARD CLAIMED'}
            theme={theme}
            isPrimary={canClaim}
            disabled={!canClaim}
            onPress={handleClaimDailyReward}
          />
        )}

        {/* ── Action buttons ── */}
        <View style={styles.buttonSection}>
          <HomeBtn title="NEW HAND (vs Bot)" theme={theme} isPrimary onPress={handleNewHand} />

          {/* ── Google sign-in / signed-in row ── */}
          {!user ? (
            <View>
              <Pressable
                style={[styles.googleBtn, signingIn && styles.googleBtnLoading]}
                onPress={handleGoogleSignIn}
                disabled={signingIn}
              >
                <Text style={styles.googleBtnText}>
                  {signingIn ? 'Signing in...' : '🔵  Sign in with Google'}
                </Text>
              </Pressable>
              {authError !== null && (
                <Text style={styles.authError}>{authError}</Text>
              )}
            </View>
          ) : (
            <View style={styles.signedInRow}>
              {user.user_metadata?.avatar_url ? (
                <Image
                  source={{ uri: String(user.user_metadata.avatar_url) }}
                  style={styles.avatar}
                />
              ) : (
                <View style={[styles.avatarPlaceholder, { backgroundColor: theme.accent }]}>
                  <Text style={styles.avatarInitial}>
                    {String(user.user_metadata?.full_name ?? user.email ?? '?').charAt(0).toUpperCase()}
                  </Text>
                </View>
              )}
              <Text style={[styles.signedInName, { color: theme.subtitleColor }]} numberOfLines={1}>
                {String(user.user_metadata?.full_name ?? user.email ?? 'Signed in')}
              </Text>
              <Pressable onPress={signOut} hitSlop={8}>
                <Text style={[styles.signOutText, { color: theme.accent }]}>Sign out</Text>
              </Pressable>
            </View>
          )}

          <View style={styles.modeRow}>
            <HomeBtn title="SIT & GO" theme={theme} onPress={() => router.push('/sit-and-go' as any)} style={styles.modeButton} />
            <HomeBtn title="TOURNAMENT" theme={theme} onPress={() => router.push('/tournament' as any)} style={styles.modeButton} />
          </View>
          <HomeBtn title="PLAY ONLINE" theme={theme} onPress={() => router.push('/lobby/internet-host' as any)} />
          <HomeBtn title="HOST GAME (WiFi)" theme={theme} onPress={() => router.push('/lobby/host' as any)} />
          <HomeBtn title="JOIN GAME" theme={theme} onPress={() => router.push('/lobby/join' as any)} />
          <Button title="LEADERBOARD" variant="ghost" onPress={() => router.push('/leaderboard' as any)} />
          <Button title="HAND HISTORY" variant="ghost" onPress={() => router.push('/hand-history' as any)} />
          <Button title="SETTINGS" variant="ghost" onPress={() => router.push('/settings' as any)} />
        </View>

        {/* ── Refill / Reset ── */}
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
          <Button title="SIMULATE" variant="ghost" onPress={() => router.push('/simulate' as any)} />
        )}
      </View>

      <Text style={[styles.versionLabel, { color: theme.accent }]}>
        v{Constants.expoConfig?.version ?? '1.9.2'}
      </Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
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
    gap: 16,
    zIndex: 1,
  },

  // Title
  titleSection: {
    alignItems: 'center',
    position: 'relative',
    gap: 4,
  },
  titleGlow: {
    position: 'absolute',
    width: 240,
    height: 240,
    borderRadius: 120,
    top: -50,
    alignSelf: 'center',
    zIndex: -1,
    opacity: 0.15,
  },
  suitSymbols: {
    fontSize: 18,
    letterSpacing: 12,
    opacity: 0.7,
    marginBottom: 4,
  },
  title: {
    fontSize: 64,
    fontWeight: '900',
    letterSpacing: 20,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 30,
  },
  titleSub: {
    fontSize: 12,
    fontWeight: '400',
    letterSpacing: 2,
    marginTop: 2,
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  titleDivider: {
    width: 120,
    height: 1,
    marginTop: 12,
    opacity: 0.5,
  },

  // Stats
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
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    ...Platform.select({
      web: { boxShadow: '0 8px 32px rgba(0,0,0,0.6)' } as any,
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.6, shadowRadius: 12 },
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
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  statValue: {
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
    gap: 8,
  },
  modeRow: {
    flexDirection: 'row',
    gap: 8,
  },
  modeButton: {
    flex: 1,
  },

  // Google sign-in button
  googleBtn: {
    width: '100%',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
    ...Platform.select({
      web: { boxShadow: '0 2px 12px rgba(0,0,0,0.25)' } as any,
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 6 },
      android: { elevation: 4 },
    }),
  },
  googleBtnLoading: {
    opacity: 0.6,
  },
  googleBtnText: {
    color: '#1a1a1a',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  authError: {
    color: COLORS.neonRed,
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 4,
  },

  // Signed-in row
  signedInRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    width: '100%',
  },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  avatarPlaceholder: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    color: '#000',
    fontSize: 13,
    fontWeight: '800',
  },
  signedInName: {
    flex: 1,
    fontSize: 12,
    fontWeight: '500',
  },
  signOutText: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
  },

  // Version
  versionLabel: {
    position: 'absolute',
    bottom: 14,
    right: 18,
    fontSize: 11,
    fontWeight: '600',
    opacity: 0.7,
    letterSpacing: 0.5,
  },
});
