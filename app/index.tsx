/**
 * HomeScreen — Clean Lobby (S83)
 * Single PLAY button center stage. Everything else in SideMenu (hamburger).
 * Design principle: a 10-year-old knows what to do — press the big green button.
 */
import React, { useEffect, useCallback, useState, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  Animated as AnimatedRN,
  Image,
  View,
  Text,
  StyleSheet,
  Platform,
  Alert,
  Pressable,
  useWindowDimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { setCurrentScreen, trackAction } from '../utils/crash-evidence';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  withSequence,
  withDelay,
  cancelAnimation,
} from 'react-native-reanimated';
import CardComponent from '../components/Card';
import ChipsDisplay from '../components/ChipsDisplay';
import SideMenu from '../components/SideMenu';
import { useGameStore } from '../store/gameStore';
import { COLORS, getBoardCount, Card } from '../constants/gameConfig';
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
import { useAuthUser, signInWithGoogle, signOut } from '../utils/auth';
import { FriendsBg } from '../components/FriendsBg';
import Tutorial, { TUTORIAL_SEEN_KEY } from '../components/Tutorial';
import { rf, rs, rv } from '../utils/responsive';
import { t, getLanguage } from '../utils/i18n';
import { HOME_THEMES } from '../constants/homeThemes';
import { migrateGuestToUser } from '../utils/guestMigration';
// @ts-ignore — parallel agent file, exists at deploy time
import { useBattlePassStore } from '../stores/battlePassStore';
// @ts-ignore — parallel agent file, exists at deploy time
import { getProgressToNextTier } from '../utils/battlePass';
// @ts-ignore — parallel agent file, exists at deploy time
import XPBar from '../components/XPBar';

export const GAMES_PLAYED_KEY = 'caps_games_played';
export const GUIDED_FORCED_KEY = 'guidedModeForced';
const NUDGE_AT_GAMES = [3, 8, 20];
const NUDGE_DISMISSED_KEY = 'nudgeDismissedAt';

const isWeb = Platform.OS === 'web';

// ─── Floating suit particles ──────────────────────────────────────────────────
const PARTICLE_CONFIG = [
  { x: 0.05, suit: '♠', size: 22, opacity: 0.045, dur: 14000, delay: 0 },
  { x: 0.12, suit: '♦', size: 18, opacity: 0.035, dur: 11000, delay: 2500 },
  { x: 0.22, suit: '♣', size: 28, opacity: 0.05,  dur: 13000, delay: 1000 },
  { x: 0.30, suit: '♥', size: 20, opacity: 0.04,  dur: 10000, delay: 4000 },
  { x: 0.42, suit: '♠', size: 16, opacity: 0.03,  dur: 15000, delay: 700 },
  { x: 0.55, suit: '♦', size: 24, opacity: 0.055, dur: 12000, delay: 3200 },
  { x: 0.65, suit: '♥', size: 32, opacity: 0.04,  dur: 16000, delay: 1800 },
  { x: 0.73, suit: '♣', size: 19, opacity: 0.035, dur: 11500, delay: 5000 },
  { x: 0.82, suit: '♠', size: 26, opacity: 0.05,  dur: 13500, delay: 400 },
  { x: 0.88, suit: '♦', size: 21, opacity: 0.04,  dur: 10500, delay: 2100 },
  { x: 0.95, suit: '♥', size: 18, opacity: 0.03,  dur: 14500, delay: 6000 },
  { x: 0.38, suit: '♣', size: 15, opacity: 0.025, dur: 12500, delay: 3700 },
  { x: 0.60, suit: '♠', size: 30, opacity: 0.045, dur: 15500, delay: 900 },
  { x: 0.18, suit: '♥', size: 23, opacity: 0.035, dur: 11200, delay: 4500 },
  { x: 0.78, suit: '♦', size: 17, opacity: 0.03,  dur: 13200, delay: 2800 },
];

function FloatingParticle({ x, suit, size, opacity, dur, delay, screenW, screenH }: {
  x: number; suit: string; size: number; opacity: number; dur: number; delay: number;
  screenW: number; screenH: number;
}) {
  const translateY = useSharedValue(screenH + 50);
  useEffect(() => {
    translateY.value = withDelay(delay, withRepeat(withTiming(-80, { duration: dur }), 50, false));
    return () => { cancelAnimation(translateY); };
  }, []);
  const animStyle = useAnimatedStyle(() => ({ transform: [{ translateY: translateY.value }] }));
  return (
    <Animated.Text
      style={[{ position: 'absolute', left: Math.floor(x * screenW), fontSize: size, color: '#c9a84c', opacity }, animStyle]}
      pointerEvents="none"
    >
      {suit}
    </Animated.Text>
  );
}

// ─── Hero card fan ────────────────────────────────────────────────────────────
const FAN_CARDS: Card[] = [
  { suit: 'spades',   rank: 'A',  id: 'fan-0' },
  { suit: 'hearts',   rank: 'K',  id: 'fan-1' },
  { suit: 'diamonds', rank: 'Q',  id: 'fan-2' },
  { suit: 'clubs',    rank: 'J',  id: 'fan-3' },
  { suit: 'spades',   rank: '10', id: 'fan-4' },
];
const FAN_ROTATIONS = [-16, -8, 0, 8, 16];
const FAN_TRANSLATE_Y = [10, 4, 0, 4, 10];

function HeroCardFan() {
  const breatheScale = useSharedValue(1);
  useEffect(() => {
    breatheScale.value = withRepeat(
      withSequence(withTiming(1.025, { duration: 2200 }), withTiming(1.0, { duration: 2200 })),
      100, false,
    );
    return () => { cancelAnimation(breatheScale); };
  }, []);
  const breatheStyle = useAnimatedStyle(() => ({ transform: [{ scale: breatheScale.value }] }));
  return (
    <Animated.View style={[{ flexDirection: 'row', alignItems: 'flex-end', marginTop: 10, marginBottom: 2 }, breatheStyle]}>
      {FAN_CARDS.map((card, i) => (
        <View
          key={card.id}
          style={{
            marginLeft: i === 0 ? 0 : -16,
            transform: [{ rotate: `${FAN_ROTATIONS[i]}deg` }, { translateY: FAN_TRANSLATE_Y[i] }],
            zIndex: i === 2 ? 5 : i < 2 ? i + 1 : 5 - i,
          }}
        >
          <CardComponent card={card} cardWidth={38} cardHeight={53} />
        </View>
      ))}
    </Animated.View>
  );
}

const TAGLINES = [
  "Place Your Cards. Own Every Board.",
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

const DISPLAY_FONT = Platform.select({ web: 'Playfair Display, Georgia, serif', default: undefined });

// ─── Sign-in nudge banner — slide-up, non-blocking ─────────────────────────────
function NudgeBanner({ onSignIn, onLater }: { onSignIn: () => void; onLater: () => void }) {
  const isHE = getLanguage() === 'he';
  const translateY = useRef(new AnimatedRN.Value(200)).current;
  useEffect(() => {
    AnimatedRN.timing(translateY, { toValue: 0, duration: 300, useNativeDriver: true }).start();
  }, []);
  const dismiss = (cb: () => void) => {
    AnimatedRN.timing(translateY, { toValue: 200, duration: 200, useNativeDriver: true }).start(cb);
  };
  return (
    <AnimatedRN.View style={[nudgeStyles.banner, { transform: [{ translateY }] }]}>
      <View style={nudgeStyles.content}>
        <Text style={nudgeStyles.title}>
          {isHE ? '🔒 התחבר כדי לשמור את הנתונים' : '🔒 Sign in to save your stats'}
        </Text>
        <Text style={nudgeStyles.sub}>
          {isHE
            ? 'הניצחונות, הבנקרול וההיסטוריה ישמרו בין מכשירים.'
            : 'Your wins, bankroll & history will be saved across devices.'}
        </Text>
        <View style={nudgeStyles.btnRow}>
          <Pressable
            onPress={() => dismiss(onSignIn)}
            style={nudgeStyles.signInBtn}
          >
            <Text style={nudgeStyles.signInBtnText}>
              {isHE ? '🔵 כניסה עם Google' : '🔵 Sign in with Google'}
            </Text>
          </Pressable>
          <Pressable onPress={() => dismiss(onLater)} hitSlop={8} style={nudgeStyles.laterBtn}>
            <Text style={nudgeStyles.laterBtnText}>{isHE ? 'אחר כך' : 'Later'}</Text>
          </Pressable>
        </View>
      </View>
    </AnimatedRN.View>
  );
}

const nudgeStyles = StyleSheet.create({
  banner: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 150,
    backgroundColor: 'rgba(14,10,20,0.97)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(201,168,76,0.25)',
    paddingBottom: rs(16),
  },
  content: {
    paddingHorizontal: rs(20),
    paddingTop: rs(16),
    gap: rs(8),
  },
  title: {
    color: '#ffffff',
    fontSize: rf(15),
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  sub: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: rf(13),
    fontWeight: '400',
    lineHeight: rf(19),
  },
  btnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: rs(12),
    marginTop: rs(4),
  },
  signInBtn: {
    backgroundColor: '#4285F4',
    borderRadius: rv(10),
    paddingVertical: rs(10),
    paddingHorizontal: rs(18),
    flex: 1,
    alignItems: 'center',
  },
  signInBtnText: {
    color: '#ffffff',
    fontSize: rf(13),
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  laterBtn: {
    paddingVertical: rs(10),
    paddingHorizontal: rs(12),
  },
  laterBtnText: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: rf(13),
    fontWeight: '500',
  },
});

// ─── Welcome toast after sign-in ──────────────────────────────────────────────
function WelcomeToast({ name }: { name: string }) {
  const isHE = getLanguage() === 'he';
  const opacity = useRef(new AnimatedRN.Value(0)).current;
  useEffect(() => {
    AnimatedRN.sequence([
      AnimatedRN.timing(opacity, { toValue: 1, duration: 250, useNativeDriver: true }),
      AnimatedRN.delay(2500),
      AnimatedRN.timing(opacity, { toValue: 0, duration: 400, useNativeDriver: true }),
    ]).start();
  }, []);
  return (
    <AnimatedRN.View style={[toastStyles.toast, { opacity }]} pointerEvents="none">
      <Text style={toastStyles.text}>
        {isHE ? `ברוך הבא, ${name}! הנתונים שלך נשמרים.` : `Welcome, ${name}! Your data is now saved.`}
      </Text>
    </AnimatedRN.View>
  );
}

const toastStyles = StyleSheet.create({
  toast: {
    position: 'absolute',
    top: rs(80),
    alignSelf: 'center',
    backgroundColor: 'rgba(34,197,94,0.92)',
    borderRadius: rv(24),
    paddingVertical: rs(10),
    paddingHorizontal: rs(20),
    zIndex: 300,
    maxWidth: '85%' as any,
  },
  text: {
    color: '#ffffff',
    fontSize: rf(13),
    fontWeight: '600',
    textAlign: 'center',
  },
});

// ─── Welcome modal — shown before first game / tutorial replay ─────────────────
function WelcomeModal({ onStart, onSkip }: { onStart: () => void; onSkip: () => void }) {
  const isHE = getLanguage() === 'he';
  const opacity = useRef(new AnimatedRN.Value(0)).current;
  useEffect(() => {
    AnimatedRN.timing(opacity, { toValue: 1, duration: 250, useNativeDriver: true }).start();
  }, []);
  return (
    <AnimatedRN.View style={[welcomeStyles.overlay, { opacity }]}>
      <Pressable style={StyleSheet.absoluteFillObject} onPress={onSkip} />
      <View style={welcomeStyles.card}>
        <Text style={welcomeStyles.title}>🃏 CAPS POKER</Text>
        {isHE ? (
          <>
            <Text style={welcomeStyles.line}>פוקר מסוג חדש.</Text>
            <Text style={welcomeStyles.line}>אתה מקבל קלפים.</Text>
            <Text style={welcomeStyles.line}>שים אותם על הבורדים.</Text>
            <Text style={welcomeStyles.line}>היד הכי טובה מנצחת.</Text>
            <Text style={welcomeStyles.sub}>אל תדאג — נלווה אותך במשחק הראשון!</Text>
          </>
        ) : (
          <>
            <Text style={welcomeStyles.line}>A new kind of poker.</Text>
            <Text style={welcomeStyles.line}>You get cards.</Text>
            <Text style={welcomeStyles.line}>Place them on boards.</Text>
            <Text style={welcomeStyles.line}>Best hand wins each board.</Text>
            <Text style={welcomeStyles.sub}>{"Don't worry — we'll guide you through your first game!"}</Text>
          </>
        )}
        <Pressable onPress={onStart} style={welcomeStyles.startBtn}>
          <Text style={welcomeStyles.startBtnText}>{isHE ? 'יאללה!' : "LET'S GO!"}</Text>
        </Pressable>
        <Pressable onPress={onSkip} hitSlop={8}>
          <Text style={welcomeStyles.skipText}>{isHE ? 'דלג על ההדרכה' : 'Skip tutorial'}</Text>
        </Pressable>
      </View>
    </AnimatedRN.View>
  );
}

const welcomeStyles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject as any,
    backgroundColor: 'rgba(0,0,0,0.82)',
    zIndex: 200,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: rs(24),
  },
  card: {
    backgroundColor: '#1C0508',
    borderRadius: rv(16),
    borderWidth: 1,
    borderColor: 'rgba(201,168,76,0.35)',
    padding: rs(28),
    alignItems: 'center',
    gap: rs(6),
    maxWidth: 360,
    width: '100%',
  },
  title: {
    color: '#c9a84c',
    fontSize: rf(22),
    fontWeight: '800',
    letterSpacing: 2,
    marginBottom: rs(8),
    textAlign: 'center',
  },
  line: {
    color: '#ffffff',
    fontSize: rf(15),
    fontWeight: '400',
    textAlign: 'center',
    lineHeight: rf(22),
  },
  sub: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: rf(13),
    fontWeight: '400',
    textAlign: 'center',
    lineHeight: rf(19),
    marginTop: rs(4),
    marginBottom: rs(4),
  },
  startBtn: {
    backgroundColor: '#22C55E',
    borderRadius: rv(12),
    paddingVertical: rs(14),
    paddingHorizontal: rs(40),
    marginTop: rs(12),
    width: '100%',
    alignItems: 'center',
  },
  startBtnText: {
    color: '#ffffff',
    fontSize: rf(18),
    fontWeight: '900',
    letterSpacing: 3,
  },
  skipText: {
    color: 'rgba(255,255,255,0.3)',
    fontSize: rf(12),
    fontWeight: '400',
    marginTop: rs(10),
    textDecorationLine: 'underline',
  },
});

// ─── Home screen ─────────────────────────────────────────────────────────────
export default function HomeScreen() {
  const router = useRouter();
  const { height: screenH, width: screenW } = useWindowDimensions();
  const chips = useGameStore((s) => s.chips);
  const config = useGameStore((s) => s.config);
  const updateConfig = useGameStore((s) => s.updateConfig);
  const lastDailyRewardClaim = useGameStore((s) => s.lastDailyRewardClaim);
  const dailyRewardStreak = useGameStore((s) => s.dailyRewardStreak);
  const lastFreeRefill = useGameStore((s) => s.lastFreeRefill);
  const homeThemeId = useGameStore((s) => s.homeTheme);
  const theme = HOME_THEMES[homeThemeId];
  const playerAvatar = useGameStore((s) => s.playerAvatar) || '🎰';

  const user = useAuthUser();
  const prevUserRef = useRef<typeof user>(undefined);
  const playerName = useGameStore((s) => s.playerName) || 'Player';
  const [signingIn, setSigningIn] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);
  const [showWelcome, setShowWelcome] = useState(false);
  const [gamesPlayed, setGamesPlayed] = useState(99); // default 99 = not first game until loaded
  const [showNudge, setShowNudge] = useState(false);
  const [showWelcomeToast, setShowWelcomeToast] = useState(false);
  const [welcomeToastName, setWelcomeToastName] = useState('');

  // Rotating tagline — cycles through all 10
  const [tagline] = useState<string>(() => {
    const idx = taglineMountCount % TAGLINES.length;
    taglineMountCount++;
    return TAGLINES[idx];
  });
  const taglineOpacity = useSharedValue(0);
  useEffect(() => { taglineOpacity.value = withTiming(1, { duration: 800 }); }, []);
  const taglineAnimStyle = useAnimatedStyle(() => ({ opacity: taglineOpacity.value }));

  // PLAY button scale — RN Animated (not Reanimated)
  const playScale = useRef(new AnimatedRN.Value(1)).current;

  useEffect(() => {
    setCurrentScreen('Home');
    CapsHooks.screenViewed('home');
    AsyncStorage.getItem(TUTORIAL_SEEN_KEY).then(val => {
      if (!val) setShowTutorial(true);
    }).catch(() => {});
    Promise.all([
      AsyncStorage.getItem(GAMES_PLAYED_KEY),
      AsyncStorage.getItem(NUDGE_DISMISSED_KEY),
    ]).then(([gamesVal, dismissedVal]) => {
      const played = gamesVal ? parseInt(gamesVal, 10) || 0 : 0;
      setGamesPlayed(played);
      // Show nudge if: guest + nudge point + not recently dismissed
      const dismissedAt = dismissedVal ? parseInt(dismissedVal, 10) || 0 : 0;
      if (!user && NUDGE_AT_GAMES.includes(played) && played > dismissedAt) {
        setShowNudge(true);
      }
    }).catch(() => { setGamesPlayed(0); });
  }, []);

  // Migrate guest data when user signs in for the first time
  useEffect(() => {
    const prev = prevUserRef.current;
    prevUserRef.current = user;
    if (!prev && user) {
      // Just signed in — migrate and show toast
      const displayName = String(user.user_metadata?.full_name ?? playerName).slice(0, 30);
      useGameStore.getState().setPlayerName(displayName);
      migrateGuestToUser(user.id, displayName).then((migrated) => {
        if (migrated) {
          setWelcomeToastName(displayName.split(' ')[0]);
          setShowWelcomeToast(true);
          setTimeout(() => setShowWelcomeToast(false), 3500);
        }
      }).catch(() => {});
    } else if (user?.user_metadata?.full_name && !prev) {
      // Already signed in on mount — just update name
      useGameStore.getState().setPlayerName(String(user.user_metadata.full_name).slice(0, 20));
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
    trackAction('play_pressed');
    if (gamesPlayed === 0) {
      setShowWelcome(true);
      return;
    }
    router.push('/game' as any);
  }, [chips, config, router, gamesPlayed]);

  const handleWelcomeStart = useCallback(async () => {
    setShowWelcome(false);
    // First game: default to 3 players (3 boards, 12 cards) — easier for beginners
    updateConfig({ numberOfPlayers: 3 });
    await AsyncStorage.setItem(GUIDED_FORCED_KEY, 'true').catch(() => {});
    router.push('/game' as any);
  }, [router, updateConfig]);

  const handleWelcomeSkip = useCallback(() => {
    setShowWelcome(false);
    router.push('/game' as any);
  }, [router]);

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

  const handleGoogleSignIn = useCallback(async () => {
    setShowNudge(false);
    setSigningIn(true);
    const { error } = await signInWithGoogle();
    setSigningIn(false);
    if (error) Alert.alert('Sign In Failed', error.message);
  }, []);

  const handleNudgeLater = useCallback(() => {
    setShowNudge(false);
    AsyncStorage.setItem(NUDGE_DISMISSED_KEY, String(gamesPlayed)).catch(() => {});
  }, [gamesPlayed]);

  const canClaim = ECONOMY_FLAGS.dailyRewardEnabled && canClaimDailyReward(lastDailyRewardClaim);

  const titleFontSize = Math.min(42, Math.floor(screenW * 0.105));

  // Web title gradient for dark_gold theme
  const webTitleGradient = isWeb && homeThemeId === 'dark_gold'
    ? ({ background: 'linear-gradient(135deg, #e8c96a 0%, #c9a84c 50%, #9a7a2e 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' } as any)
    : {};

  const playBtnWidth = Math.round(screenW * 0.70);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]}>
      <FriendsBg />

      {/* Floating suit particles — decorative background */}
      <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
        {PARTICLE_CONFIG.map((p, i) => (
          <FloatingParticle key={i} {...p} screenW={screenW} screenH={screenH} />
        ))}
      </View>
      {isWeb && <View style={styles.gradientOverlay} />}
      {isWeb && <View style={styles.grainOverlay} />}

      {/* Tutorial overlay — 5-slide static tutorial */}
      {showTutorial && <Tutorial onDone={() => setShowTutorial(false)} />}

      {/* Welcome modal — shown before first game or tutorial replay */}
      {showWelcome && <WelcomeModal onStart={handleWelcomeStart} onSkip={handleWelcomeSkip} />}

      {/* Side menu — always rendered, pointer-events controlled by visible */}
      <SideMenu
        visible={menuOpen}
        onClose={() => setMenuOpen(false)}
        onShowTutorial={() => {
          setMenuOpen(false);
          setTimeout(() => setShowWelcome(true), 60);
        }}
        chips={chips}
        user={user}
        onSignIn={handleGoogleSignIn}
        onSignOut={signOut}
      />

      {/* Top bar — hamburger + avatar */}
      <View style={styles.topBar}>
        <Pressable onPress={() => setMenuOpen(true)} style={styles.hamburgerBtn} hitSlop={12}>
          <Text style={[styles.hamburgerText, { color: theme.accent }]}>☰</Text>
        </Pressable>
        <View style={styles.topBarRight}>
          {user?.user_metadata?.avatar_url ? (
            <Pressable onPress={() => setMenuOpen(true)} hitSlop={8}>
              <Image
                source={{ uri: String(user.user_metadata.avatar_url) }}
                style={styles.topAvatar}
              />
            </Pressable>
          ) : (
            <Pressable onPress={() => setMenuOpen(true)} hitSlop={8}>
              <Text style={[styles.topAvatarEmoji, { color: theme.accent }]}>{playerAvatar}</Text>
            </Pressable>
          )}
        </View>
      </View>

      {/* Center content */}
      <View style={styles.content}>

        {/* Title section */}
        <View style={styles.titleSection}>
          <Text style={[styles.suitSymbols, { color: theme.accent }]}>
            {'\u2660'} {'\u2665'} {'\u2666'} {'\u2663'}
          </Text>
          <Text
            style={[
              styles.titleCaps,
              { color: theme.titleColor, fontSize: titleFontSize },
              DISPLAY_FONT ? { fontFamily: DISPLAY_FONT } : {},
              webTitleGradient,
            ]}
            numberOfLines={1}
            adjustsFontSizeToFit
          >
            CAPS
          </Text>
          <Text style={[styles.titlePoker, { color: theme.subtitleColor }]}>POKER</Text>
          <HeroCardFan />
          <Animated.Text
            style={[styles.titleSub, { color: theme.subtitleColor }, taglineAnimStyle]}
            numberOfLines={1}
            adjustsFontSizeToFit
          >
            {tagline}
          </Animated.Text>
          <View style={[styles.titleDivider, { backgroundColor: theme.accent }]} />
        </View>

        {/* PLAY button — always green, center stage */}
        <View style={styles.playSection}>
          <AnimatedRN.View style={{ transform: [{ scale: playScale }] }}>
            <Pressable
              onPress={handleNewHand}
              onPressIn={() =>
                AnimatedRN.timing(playScale, { toValue: 0.96, duration: 80, useNativeDriver: true }).start()
              }
              onPressOut={() =>
                AnimatedRN.timing(playScale, { toValue: 1.0, duration: 150, useNativeDriver: true }).start()
              }
              style={[styles.playBtn, { width: playBtnWidth }]}
              accessibilityRole="button"
              accessibilityLabel="Play"
            >
              <View style={styles.playBtnHighlight} pointerEvents="none" />
              <Text style={styles.playBtnText}>PLAY</Text>
            </Pressable>
          </AnimatedRN.View>

          {/* Board config hint — small, below button */}
          <Text style={[styles.playSubtext, { color: theme.subtitleColor }]}>
            {t().boardsPlayers(getBoardCount(config.numberOfPlayers), config.numberOfPlayers)}
          </Text>
        </View>

        {/* Balance */}
        <ChipsDisplay amount={chips} label="Balance" size="large" />

        {/* Battle Pass XP bar — compact, tappable */}
        {(() => {
          let bpCurrentXP = 0;
          let bpCurrentTier = 1;
          let bpProgress = 0;
          let bpXpInTier = 0;
          let bpXpNeeded = 100;
          try {
            const bpSnap = useBattlePassStore();
            bpCurrentXP = bpSnap.currentXP;
            bpCurrentTier = bpSnap.currentTier;
            const prog = getProgressToNextTier(bpCurrentXP);
            bpProgress = prog.progress;
            bpXpInTier = prog.xpInTier;
            bpXpNeeded = prog.xpNeeded;
          } catch { return null; }
          return (
            <Pressable onPress={() => router.push('/battle-pass' as any)} style={styles.xpBarTouchable}>
              <XPBar
                currentXP={bpCurrentXP}
                currentTier={bpCurrentTier}
                progress={bpProgress}
                xpInTier={bpXpInTier}
                xpNeeded={bpXpNeeded}
                compact
              />
            </Pressable>
          );
        })()}

        {/* Daily reward — one motivational element at bottom */}
        {canClaim && (
          <Pressable onPress={handleClaimDailyReward} style={styles.dailyPill}>
            <Text style={styles.dailyPillText}>🎁 Claim Daily Reward</Text>
          </Pressable>
        )}

      </View>

      {__DEV__ && (
        <Text style={styles.debugInfo}>
          {homeThemeId} · {Math.round(screenW)}×{Math.round(screenH)}
        </Text>
      )}

      {/* Sign-in nudge banner — non-blocking, slides up from bottom */}
      {showNudge && !user && (
        <NudgeBanner onSignIn={handleGoogleSignIn} onLater={handleNudgeLater} />
      )}

      {/* Welcome toast after sign-in */}
      {showWelcomeToast && <WelcomeToast name={welcomeToastName} />}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  gradientOverlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    zIndex: 0,
    pointerEvents: 'none',
    ...Platform.select({
      web: { backgroundImage: 'linear-gradient(180deg, rgba(0,0,0,0.35) 0%, rgba(0,0,0,0) 40%, rgba(0,0,0,0.25) 100%)' } as any,
      default: {},
    }),
  },
  grainOverlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
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

  // Top bar
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: rs(16),
    paddingTop: rs(8),
    paddingBottom: rs(4),
    zIndex: 10,
  },
  hamburgerBtn: {
    padding: rs(4),
  },
  hamburgerText: {
    fontSize: rf(26),
    fontWeight: '400',
    lineHeight: rf(30),
  },
  topBarRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: rs(8),
  },
  topAvatar: {
    width: rv(34),
    height: rv(34),
    borderRadius: rv(17),
    borderWidth: 1.5,
    borderColor: 'rgba(201,168,76,0.4)',
  },
  topAvatarEmoji: {
    fontSize: rf(24),
    lineHeight: rf(30),
  },

  // Main content — centered vertically
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: rs(20),
    gap: rs(16),
    zIndex: 1,
  },

  // Title
  titleSection: {
    alignItems: 'center',
    gap: 2,
  },
  suitSymbols: {
    fontSize: rf(16),
    letterSpacing: 10,
    opacity: 0.6,
    marginBottom: rs(4),
  },
  titleCaps: {
    fontWeight: '900',
    letterSpacing: 8,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 24,
  },
  titlePoker: {
    fontSize: rf(13),
    fontWeight: '400',
    letterSpacing: 16,
    textTransform: 'uppercase',
    opacity: 0.55,
    marginTop: -2,
    marginBottom: 2,
  },
  titleSub: {
    fontSize: rf(11),
    fontWeight: '400',
    letterSpacing: 1.5,
    marginTop: rs(6),
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  titleDivider: {
    width: 80,
    height: 1,
    marginTop: rs(10),
    opacity: 0.4,
  },

  // PLAY button
  playSection: {
    alignItems: 'center',
    gap: rs(8),
  },
  playBtn: {
    minHeight: rv(70),
    backgroundColor: '#22C55E',
    borderRadius: rv(16),
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: rs(18),
    paddingHorizontal: rs(32),
    overflow: 'hidden',
    ...Platform.select({
      web: { boxShadow: '0 8px 32px rgba(34,197,94,0.4), 0 2px 8px rgba(0,0,0,0.3)' } as any,
      ios: { shadowColor: '#22C55E', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.4, shadowRadius: 20 },
      android: { elevation: 12 },
    }),
  },
  playBtnHighlight: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    height: '50%' as any,
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderTopLeftRadius: rv(16),
    borderTopRightRadius: rv(16),
  },
  playBtnText: {
    color: '#ffffff',
    fontSize: rf(28),
    fontWeight: '900',
    letterSpacing: 6,
  },
  playSubtext: {
    fontSize: rf(12),
    fontWeight: '500',
    letterSpacing: 0.5,
    opacity: 0.55,
    textAlign: 'center',
  },

  // Daily reward pill
  dailyPill: {
    backgroundColor: 'rgba(255,215,0,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,215,0,0.3)',
    borderRadius: rv(24),
    paddingVertical: rs(10),
    paddingHorizontal: rs(22),
  },
  dailyPillText: {
    color: '#e8c96a',
    fontSize: rf(14),
    fontWeight: '700',
    letterSpacing: 0.5,
    textAlign: 'center',
  },

  debugInfo: {
    position: 'absolute',
    bottom: rs(8),
    alignSelf: 'center',
    color: 'rgba(255,255,255,0.15)',
    fontSize: rf(10),
  },

  // Battle Pass XP bar touchable wrapper
  xpBarTouchable: {
    width: '100%',
  },
});
