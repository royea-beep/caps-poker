import React, { useEffect, useCallback, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { View, Text, Image, StyleSheet, Platform, Alert, Pressable, ViewStyle, useWindowDimensions, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import Constants from 'expo-constants';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from 'react-native-reanimated';
import ChipsDisplay from '../components/ChipsDisplay';
import { Button } from '../components/Button';
import { useGameStore } from '../store/gameStore';
import { COLORS, getBoardCount } from '../constants/gameConfig';
import { ECONOMY_FLAGS } from '../constants/economyConfig';
import { HOME_THEMES, HomeTheme, ButtonStyle } from '../constants/homeThemes';
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
import { FriendsBg } from '../components/FriendsBg';
import Tutorial, { TUTORIAL_SEEN_KEY } from '../components/Tutorial';
import ProQuoteBanner from '../components/ProQuoteBanner';

const isWeb = Platform.OS === 'web';

const TAGLINES = [
  "4 Boards. One Winner. No Excuses.",
  "Every Card Counts. Every Board Matters.",
  "Omaha Like You've Never Played It.",
  "Stack the Boards. Take the Chips.",
  "Play All 4. Win the Night.",
  "Think Ahead. Play All Boards.",
  "The Poker Game That Never Sleeps.",
  "More Boards. More Action. More Fun.",
  "Deal. Place. Dominate.",
  "Where Every Board Is a Battle.",
];
let taglineMountCount = 0;

const DISPLAY_FONT = Platform.select({
  web: 'Playfair Display, Georgia, serif',
  default: undefined,
});

// ─── Floating shadow helpers ──────────────────────────────────────────────────
function primShadow(accent: string): ViewStyle {
  if (Platform.OS === 'web') {
    return { boxShadow: `0 10px 40px ${accent}60, 0 2px 8px rgba(0,0,0,0.4)` } as ViewStyle;
  }
  if (Platform.OS === 'android') return { elevation: 16 };
  return {
    shadowColor: accent,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
  };
}

function secShadow(): ViewStyle {
  if (Platform.OS === 'web') {
    return { boxShadow: '0 4px 16px rgba(0,0,0,0.3)' } as ViewStyle;
  }
  if (Platform.OS === 'android') return { elevation: 6 };
  return {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
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
  btnHeight?: number;
  btnFontSize?: number;
}

function getHomeBtnColors(
  isPrimary: boolean,
  t: HomeTheme,
  btnStyle: ButtonStyle,
): { bg: string; borderColor: string; borderWidth: number; textColor: string } {
  switch (btnStyle) {
    case 'glass':
      return {
        bg: isPrimary ? t.accent + '30' : t.accent + '14',
        borderColor: t.accent,
        borderWidth: 1.5,
        textColor: t.accent,
      };
    case 'outline':
      return {
        bg: 'transparent',
        borderColor: t.accent,
        borderWidth: 1.5,
        textColor: t.accent,
      };
    case 'solid':
    default:
      return {
        bg: isPrimary ? t.buttonPrimary : 'rgba(255,255,255,0.05)',
        borderColor: isPrimary ? t.buttonPrimary : t.accent + '60',
        borderWidth: isPrimary ? 0 : 1,
        textColor: isPrimary ? t.buttonPrimaryText : t.buttonSecondaryText,
      };
  }
}

function HomeBtn({ title, onPress, isPrimary = false, disabled = false, style, theme: t, btnHeight, btnFontSize }: HomeBtnProps) {
  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));
  const btnStyle = useGameStore((s) => s.buttonStyle);
  const colors = getHomeBtnColors(isPrimary, t, btnStyle);
  const h = btnHeight ?? 50;
  const fs = btnFontSize ?? (isPrimary ? 16 : 15);
  const paddingV = isPrimary ? 16 : Math.max(8, (h - fs * 1.4) / 2);
  const borderR = isPrimary ? 18 : 14;
  const webGlass = isWeb && btnStyle === 'glass'
    ? ({ backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' } as any)
    : {};
  const shadow = isPrimary ? primShadow(t.accent) : secShadow();

  return (
    <Animated.View style={[{ width: '100%' }, animStyle, style]}>
      <Pressable
        onPress={onPress}
        disabled={disabled}
        onPressIn={() => {
          scale.value = withTiming(0.96, { duration: 80 });
          opacity.value = withTiming(0.9, { duration: 80 });
        }}
        onPressOut={() => {
          scale.value = withTiming(1.0, { duration: 150 });
          opacity.value = withTiming(1.0, { duration: 150 });
        }}
        style={[
          homeBtnBase,
          {
            backgroundColor: colors.bg,
            borderColor: colors.borderColor,
            borderWidth: colors.borderWidth,
            borderRadius: borderR,
            minHeight: h,
            paddingVertical: paddingV,
          },
          webGlass,
          shadow,
          disabled && { opacity: 0.5 },
        ]}
        accessibilityRole="button"
        accessibilityLabel={title}
      >
        {isPrimary && (
          <View style={styles.btnHighlight} pointerEvents="none" />
        )}
        <Text
          style={{
            color: colors.textColor,
            fontSize: fs,
            fontWeight: '800',
            letterSpacing: 2,
          }}
        >
          {title}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

const homeBtnBase: ViewStyle = {
  width: '100%',
  alignItems: 'center',
  justifyContent: 'center',
  paddingHorizontal: 24,
  borderRadius: 16,
  overflow: 'hidden',
};

// ─── Home screen ─────────────────────────────────────────────────────────────
export default function HomeScreen() {
  const router = useRouter();
  const { height: screenH, width: screenW } = useWindowDimensions();
  const isMobileWeb = Platform.OS === 'web' && screenW < 500;
  const titleFontSize = isMobileWeb
    ? Math.min(36, Math.floor(screenW * 0.09))
    : Math.min(42, Math.floor(screenW * 0.105));
  const btnHeight = isMobileWeb
    ? Math.min(42, screenH * 0.055)
    : Math.min(46, screenH * 0.06);
  const btnFontSize = isMobileWeb
    ? Math.min(13, screenH * 0.017)
    : Math.min(14, screenH * 0.019);
  const btnGap = Math.min(8, screenH * 0.011);
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
  const [showTutorial, setShowTutorial] = useState(false);
  const sessionNet = chips - sessionStartChips;

  // Rotating tagline — different one each mount, cycles through all 10
  const [tagline] = useState<string>(() => {
    const idx = taglineMountCount % TAGLINES.length;
    taglineMountCount++;
    return TAGLINES[idx];
  });
  const taglineOpacity = useSharedValue(0);
  useEffect(() => {
    taglineOpacity.value = withTiming(1, { duration: 800 });
  }, []);
  const taglineAnimStyle = useAnimatedStyle(() => ({ opacity: taglineOpacity.value }));

  useEffect(() => {
    CapsHooks.screenViewed('home');
    AsyncStorage.getItem(TUTORIAL_SEEN_KEY).then(val => {
      if (!val) setShowTutorial(true);
    }).catch(() => {});
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
      <FriendsBg />
      {isWeb && <View style={styles.grainOverlay} />}
      {showTutorial && <Tutorial onDone={() => setShowTutorial(false)} />}

      <ScrollView
        style={styles.contentScroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >

        {/* ── Title section ── */}
        <View style={styles.titleSection}>
          <Text style={[styles.suitSymbols, { color: theme.accent }]}>
            {'\u2660'} {'\u2665'} {'\u2666'} {'\u2663'}
          </Text>
          <Text
            style={[
              styles.title,
              { color: theme.titleColor, fontSize: titleFontSize },
              DISPLAY_FONT ? { fontFamily: DISPLAY_FONT } : {},
              webTitleGradient,
            ]}
            numberOfLines={1}
            adjustsFontSizeToFit
          >
            CAPS POKER
          </Text>
          <Animated.Text
            style={[styles.titleSub, { color: theme.subtitleColor }, taglineAnimStyle]}
            numberOfLines={1}
            adjustsFontSizeToFit
          >
            {tagline}
          </Animated.Text>
          <View style={[styles.titleDivider, { backgroundColor: theme.accent }]} />
        </View>

        {/* ── Balance ── */}
        <ChipsDisplay amount={chips} label="Your Balance" size="large" />

        {/* ── Stats ── */}
        <View style={styles.statsSection}>
          <View style={[styles.statsGrid, isMobileWeb && { paddingVertical: 6 }]}>
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: theme.accent }, isMobileWeb && { fontSize: 15 }]}>{handsPlayed}</Text>
              <Text style={styles.statLabel}>Played</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: theme.accent }, isMobileWeb && { fontSize: 15 }]}>{handsWon}</Text>
              <Text style={styles.statLabel}>Won</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: theme.accent }, isMobileWeb && { fontSize: 15 }]}>
                {handsPlayed > 0 ? Math.round((handsWon / handsPlayed) * 100) : 0}%
              </Text>
              <Text style={styles.statLabel}>Win Rate</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: theme.accent }, isMobileWeb && { fontSize: 15 }]}>{biggestWin}</Text>
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

        {/* ── Pro quote ── */}
        <ProQuoteBanner context="home" rotating rotateInterval={8000} />

        {/* ── Action buttons ── */}
        <View style={[styles.buttonSection, { gap: btnGap }]}>
          <HomeBtn title="NEW HAND (vs Bot)" theme={theme} isPrimary onPress={handleNewHand} btnHeight={btnHeight} btnFontSize={btnFontSize} />

          {/* ── Google sign-in / signed-in row ── */}
          {!user ? (
            <View>
              <Pressable
                style={[styles.googleBtn, signingIn && styles.googleBtnLoading, { minHeight: btnHeight }]}
                onPress={handleGoogleSignIn}
                disabled={signingIn}
              >
                <Text style={[styles.googleBtnText, { fontSize: btnFontSize }]}>
                  {signingIn ? 'Signing in...' : '🔵  Continue with Google'}
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

          <HomeBtn title="TOURNAMENT" theme={theme} onPress={() => router.push('/tournament' as any)} btnHeight={btnHeight} btnFontSize={btnFontSize} />
          <HomeBtn title="PLAY ONLINE" theme={theme} onPress={() => router.push('/lobby/internet-host' as any)} btnHeight={btnHeight} btnFontSize={btnFontSize} />
          <View style={[styles.rowPair, { gap: btnGap }]}>
            <HomeBtn title="HOST GAME" theme={theme} style={{ flex: 1, width: undefined }} onPress={() => router.push('/lobby/host' as any)} btnHeight={btnHeight} btnFontSize={Math.min(14, btnFontSize ?? 14)} />
            <HomeBtn title="JOIN GAME" theme={theme} style={{ flex: 1, width: undefined }} onPress={() => router.push('/lobby/join' as any)} btnHeight={btnHeight} btnFontSize={Math.min(14, btnFontSize ?? 14)} />
          </View>
          <View style={styles.linkRow}>
            <Pressable onPress={() => router.push('/leaderboard' as any)} hitSlop={8} style={styles.linkItem}>
              <Text style={[styles.linkText, { color: theme.accent + '80' }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>LEADERBOARD</Text>
            </Pressable>
            <Text style={[styles.linkDot, { color: theme.accent + '40' }]}>·</Text>
            <Pressable onPress={() => router.push('/hand-history' as any)} hitSlop={8} style={styles.linkItem}>
              <Text style={[styles.linkText, { color: theme.accent + '80' }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>HISTORY</Text>
            </Pressable>
            <Text style={[styles.linkDot, { color: theme.accent + '40' }]}>·</Text>
            <Pressable onPress={() => setShowTutorial(true)} hitSlop={8} style={styles.linkItem}>
              <Text style={[styles.linkText, { color: theme.accent + '80' }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>📖 HOW TO PLAY</Text>
            </Pressable>
            <Text style={[styles.linkDot, { color: theme.accent + '40' }]}>·</Text>
            <Pressable onPress={() => router.push('/settings' as any)} hitSlop={8} style={styles.linkItem}>
              <Text style={[styles.linkText, { color: theme.accent + '80' }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>SETTINGS</Text>
            </Pressable>
          </View>
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

        {__DEV__ && (
          <Text style={styles.debugInfo}>
            theme: {homeThemeId} · btn: {useGameStore.getState().buttonStyle} · {Math.round(screenW)}×{Math.round(screenH)}
          </Text>
        )}
      </ScrollView>

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
  contentScroll: {
    flex: 1,
    zIndex: 1,
  },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
    gap: 10,
  },

  // Title
  titleSection: {
    alignItems: 'center',
    gap: 4,
  },
  suitSymbols: {
    fontSize: 14,
    letterSpacing: 8,
    opacity: 0.7,
    marginBottom: 2,
  },
  title: {
    fontWeight: '900',
    letterSpacing: 2,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 20,
  },
  titleSub: {
    fontSize: 11,
    fontWeight: '400',
    letterSpacing: 1.5,
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
    paddingVertical: 8,
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
    fontSize: 18,
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
  rowPair: {
    flexDirection: 'row',
    width: '100%',
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 4,
  },
  linkItem: {
    flex: 1,
    alignItems: 'center',
  },
  linkText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    textAlign: 'center',
  },
  linkDot: {
    fontSize: 14,
    fontWeight: '400',
  },
  btnHighlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '50%' as any,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
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
    color: '#1f1f1f',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.3,
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
  debugInfo: {
    color: 'rgba(255,255,255,0.2)',
    fontSize: 10,
    fontWeight: '400',
    textAlign: 'center',
    letterSpacing: 0.5,
    marginTop: 4,
  },

});
