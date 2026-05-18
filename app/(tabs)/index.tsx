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
  Share,
  Modal,
  TextInput,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { setCurrentScreen, trackAction } from '../../utils/crash-evidence';
import { SafeAreaView } from 'react-native-safe-area-context';
import { KILL_index } from '../../utils/animationKill';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  withSequence,
  withDelay,
  cancelAnimation,
} from 'react-native-reanimated';
import CardComponent from '../../components/Card';
import ChipsDisplay from '../../components/ChipsDisplay';
import SideMenu from '../../components/SideMenu';
import { useGameStore } from '../../store/gameStore';
import { COLORS, getBoardCount, Card } from '../../constants/gameConfig';
import { ECONOMY_FLAGS } from '../../constants/economyConfig';
import {
  getMatchCost,
  canAffordMatch,
  canClaimDailyReward,
  getNextStreak,
  calculateDailyReward,
  canUseFreeRefill,
  getFreeRefillAmount,
} from '../../utils/economy';
import { CapsHooks } from '../../utils/learning';
import { useAuthUser, signInWithGoogle, signOut } from '../../utils/auth';
import { FriendsBg } from '../../components/FriendsBg';
import Tutorial, { TUTORIAL_SEEN_KEY } from '../../components/Tutorial';
import InteractiveTutorial, { INTERACTIVE_TUTORIAL_KEY } from '../../components/InteractiveTutorial';
import { rf, rs, rv } from '../../utils/responsive';
import Constants from 'expo-constants';
import { t, getLanguage } from '../../utils/i18n';
import { HOME_THEMES, DEFAULT_HOME_THEME } from '../../constants/homeThemes';
import { todaysQuote } from '../../constants/proQuotes';
import { migrateGuestToUser } from '../../utils/guestMigration';
import { earnChips, fetchCardDisplayConfig } from '../../utils/supabaseEconomy';
import { getDeviceId } from '../../utils/leaderboard';
import { trackEvent } from '../../utils/heatmap';
import { getSupabase } from '../../utils/supabase';
// isOnlineMultiplayerAvailable — moved to Settings screen (Task 4)
import { scheduleLocal, cancelReengagement } from '../../utils/notifications';
// @ts-ignore — parallel agent file, exists at deploy time
import { useBattlePassStore } from '../../stores/battlePassStore';
// @ts-ignore — parallel agent file, exists at deploy time
import { getProgressToNextTier } from '../../utils/battlePass';
// @ts-ignore — parallel agent file, exists at deploy time
import XPBar from '../../components/XPBar';
// @ts-ignore — parallel agent file, exists at deploy time
import { useLevelStore } from '../../stores/levelStore';
// @ts-ignore — parallel agent file, exists at deploy time  
import LevelBadge from '../../components/LevelBadge';
// @ts-ignore — parallel agent file, exists at deploy time
import LevelUpModal from '../../components/LevelUpModal';
// @ts-ignore — parallel agent file, exists at deploy time
import { WeeklyRecapModal } from '../../components/WeeklyRecapModal';
import { StarterOfferModal } from '../../components/StarterOfferModal';
import { StreakPopup } from '../../components/StreakPopup';
import { OnboardingOverlay, ONBOARDING_SEEN_KEY } from '../../components/OnboardingOverlay';
import { getHandHistory, HandRecord } from '../../utils/handHistory';
import { ACHIEVEMENTS } from '../../utils/achievements';
import { track } from '../../utils/analytics';

export const GAMES_PLAYED_KEY = 'caps_games_played';
export const GUIDED_FORCED_KEY = 'guidedModeForced';
const NUDGE_AT_GAMES = [3, 8, 20];
const NUDGE_DISMISSED_KEY = 'nudgeDismissedAt';
const DAILY_REWARD_POPUP_SESSION_KEY = 'caps_daily_reward_popup_shown';
const STREAK_POPUP_SESSION_KEY = 'caps_streak_popup_shown';

const isWeb = Platform.OS === 'web';

// ─── Web landing page — shown on first web visit before game ─────────────────
function WebLandingHero({ onPlay }: { onPlay: () => void }) {
  return (
    <View style={webLandingStyles.overlay}>
      <View style={webLandingStyles.hero}>
        <Text style={webLandingStyles.suitRow}>♠ ♥ ♦ ♣</Text>
        <Text style={webLandingStyles.title}>CAPS POKER</Text>
        <Text style={webLandingStyles.tagline}>5 Boards. 4 Cards. Your Strategy.</Text>

        <View style={webLandingStyles.howToPlay}>
          <Text style={webLandingStyles.step}>♠ Place your cards across multiple poker boards</Text>
          <Text style={webLandingStyles.step}>♥ Each board is a separate hand — yours vs the dealer</Text>
          <Text style={webLandingStyles.step}>♦ Win the majority of boards to earn chips</Text>
        </View>

        <Pressable
          style={webLandingStyles.playButton}
          onPress={onPlay}
          accessibilityRole="button"
          accessibilityLabel="Play now"
        >
          <Text style={webLandingStyles.playButtonText}>PLAY NOW</Text>
        </Pressable>

        <Text style={webLandingStyles.mobileNote}>
          📱 Best experience on mobile — available on TestFlight
        </Text>
      </View>
    </View>
  );
}

const webLandingStyles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject as object,
    zIndex: 1000,
    backgroundColor: '#1C0508',
    alignItems: 'center',
    justifyContent: 'center',
  },
  hero: {
    alignItems: 'center',
    paddingHorizontal: 32,
    maxWidth: 480,
    width: '100%',
  },
  suitRow: {
    color: 'rgba(201,168,76,0.35)',
    fontSize: 22,
    letterSpacing: 10,
    marginBottom: 12,
  },
  title: {
    fontSize: 42,
    fontWeight: '800' as const,
    color: '#8B6914',
    letterSpacing: 6,
    marginBottom: 8,
    ...Platform.select({ web: { fontFamily: 'Playfair Display, Georgia, serif' } as any, default: {} }),
  },
  tagline: {
    fontSize: 18,
    color: '#c9a84c',
    marginBottom: 36,
    textAlign: 'center' as const,
    letterSpacing: 0.5,
  },
  howToPlay: {
    marginBottom: 36,
    gap: 14,
    width: '100%',
  },
  step: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.55)',
    textAlign: 'center' as const,
    lineHeight: 22,
  },
  playButton: {
    backgroundColor: '#6B1520',
    paddingHorizontal: 52,
    paddingVertical: 18,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#8B6914',
    marginBottom: 24,
  },
  playButtonText: {
    fontSize: 20,
    fontWeight: '900' as const,
    color: '#ffffff',
    letterSpacing: 3,
  },
  mobileNote: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.3)',
    textAlign: 'center' as const,
  },
});

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
    // FIX 5: gate with KILL_index — 8 concurrent Reanimated animations on launch
    // compete with splash worklet thread and can cause OOM kill (dirty-shutdown at Splash)
    if (!KILL_index) {
      translateY.value = withDelay(delay, withRepeat(withTiming(-80, { duration: dur }), 50, false));
    }
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
    // FIX 5c: gate with KILL_index — hero card fan breathe runs concurrently with splash
    if (!KILL_index) {
      breatheScale.value = withRepeat(
        withSequence(withTiming(1.025, { duration: 2200 }), withTiming(1.0, { duration: 2200 })),
        100, false,
      );
    }
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
  "Place your cards. Own every board.",
  "Every card counts. Every board matters.",
  "Split your hand. Win the table.",
  "Four cards. Four boards. One winner.",
  "Omaha, multiplied.",
  "Think deeper. Play smarter.",
  "Stack the boards. Take the chips.",
  "Deal. Place. Dominate.",
  "The poker game that never sleeps.",
  "Where every board is a battle.",
];
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
            accessibilityRole="button"
            accessibilityLabel={isHE ? 'כניסה עם Google' : 'Sign in with Google'}
            style={nudgeStyles.signInBtn}
          >
            <Text style={nudgeStyles.signInBtnText}>
              {isHE ? '🔵 כניסה עם Google' : '🔵 Sign in with Google'}
            </Text>
          </Pressable>
          <Pressable
            onPress={() => dismiss(onLater)}
            accessibilityRole="button"
            accessibilityLabel={isHE ? 'אחר כך' : 'Later'}
            hitSlop={8}
            style={nudgeStyles.laterBtn}
          >
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
    <AnimatedRN.View
      style={[toastStyles.toast, { opacity }]}
      pointerEvents="none"
      accessibilityLiveRegion="polite"
      accessibilityRole="alert"
    >
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

// ─── Daily Reward Modal — shown on app open if reward is claimable ────────────
function DailyRewardModal({
  reward,
  streak,
  onClaim,
  onDismiss,
}: {
  reward: number;
  streak: number;
  onClaim: () => void;
  onDismiss: () => void;
}) {
  const isHE = getLanguage() === 'he';
  const opacity = useRef(new AnimatedRN.Value(0)).current;
  const scale = useRef(new AnimatedRN.Value(0.88)).current;
  useEffect(() => {
    AnimatedRN.parallel([
      AnimatedRN.timing(opacity, { toValue: 1, duration: 250, useNativeDriver: true }),
      AnimatedRN.spring(scale, { toValue: 1, useNativeDriver: true, friction: 7, tension: 80 }),
    ]).start();
  }, []);
  const dismiss = (cb: () => void) => {
    AnimatedRN.parallel([
      AnimatedRN.timing(opacity, { toValue: 0, duration: 180, useNativeDriver: true }),
      AnimatedRN.timing(scale, { toValue: 0.92, duration: 180, useNativeDriver: true }),
    ]).start(cb);
  };
  return (
    <AnimatedRN.View style={[dailyRewardModalStyles.overlay, { opacity }]}>
      <Pressable
        style={StyleSheet.absoluteFillObject}
        onPress={() => dismiss(onDismiss)}
        accessibilityRole="button"
        accessibilityLabel="Close dialog"
      />
      <AnimatedRN.View style={[dailyRewardModalStyles.card, { transform: [{ scale }] }]}>
        <Text style={dailyRewardModalStyles.emoji}>🎁</Text>
        <Text style={dailyRewardModalStyles.title}>
          {isHE ? 'פרס יומי!' : 'Daily Reward!'}
        </Text>
        <Text style={dailyRewardModalStyles.chips}>
          {`+${(reward ?? 0).toLocaleString()} chips`}
        </Text>
        {streak > 1 && (
          <Text style={dailyRewardModalStyles.streak}>
            {isHE ? `🔥 ${streak} ימים ברצף` : `🔥 ${streak}-day streak!`}
          </Text>
        )}
        <Pressable
          style={dailyRewardModalStyles.claimBtn}
          onPress={() => dismiss(onClaim)}
          accessibilityRole="button"
          accessibilityLabel={isHE ? 'קחו את הפרס' : 'Claim Reward'}
        >
          <Text style={dailyRewardModalStyles.claimBtnText}>
            {isHE ? '✅ קחו את הפרס' : '✅ Claim Reward'}
          </Text>
        </Pressable>
        <Pressable
          onPress={() => dismiss(onDismiss)}
          accessibilityRole="button"
          accessibilityLabel={isHE ? 'אחר כך' : 'Later'}
          hitSlop={8}
          style={dailyRewardModalStyles.laterBtn}
        >
          <Text style={dailyRewardModalStyles.laterText}>
            {isHE ? 'אחר כך' : 'Later'}
          </Text>
        </Pressable>
      </AnimatedRN.View>
    </AnimatedRN.View>
  );
}

const dailyRewardModalStyles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject as any,
    backgroundColor: 'rgba(0,0,0,0.75)',
    zIndex: 400,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: rs(24),
  },
  card: {
    backgroundColor: '#1C0508',
    borderRadius: rv(20),
    borderWidth: 1.5,
    borderColor: 'rgba(201,168,76,0.5)',
    padding: rs(28),
    alignItems: 'center',
    gap: rs(8),
    maxWidth: 340,
    width: '100%',
    ...Platform.select({
      ios: { shadowColor: '#c9a84c', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.35, shadowRadius: 24 },
      android: { elevation: 16 },
      web: { boxShadow: '0 8px 40px rgba(201,168,76,0.3)' } as any,
    }),
  },
  emoji: {
    fontSize: rf(52),
    lineHeight: rf(60),
  },
  title: {
    color: '#c9a84c',
    fontSize: rf(22),
    fontWeight: '800',
    letterSpacing: 1,
    textAlign: 'center',
  },
  chips: {
    color: '#ffffff',
    fontSize: rf(32),
    fontWeight: '900',
    letterSpacing: 1,
    textAlign: 'center',
  },
  streak: {
    color: '#FFA500',
    fontSize: rf(15),
    fontWeight: '700',
    textAlign: 'center',
  },
  claimBtn: {
    backgroundColor: '#22C55E',
    borderRadius: rv(14),
    paddingVertical: rs(14),
    paddingHorizontal: rs(36),
    marginTop: rs(8),
    width: '100%',
    alignItems: 'center',
    ...Platform.select({
      ios: { shadowColor: '#22C55E', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 12 },
      android: { elevation: 8 },
      web: { boxShadow: '0 4px 16px rgba(34,197,94,0.4)' } as any,
    }),
  },
  claimBtnText: {
    color: '#ffffff',
    fontSize: rf(17),
    fontWeight: '900',
    letterSpacing: 1,
  },
  laterBtn: {
    marginTop: rs(4),
    paddingVertical: rs(6),
    paddingHorizontal: rs(16),
  },
  laterText: {
    color: 'rgba(255,255,255,0.35)',
    fontSize: rf(13),
    fontWeight: '400',
    textDecorationLine: 'underline',
  },
});

// ─── Omaha Tutorial Modal — 3-slide, shown on first launch only ──────────────
const TUTORIAL_SLIDES_HE = [
  { icon: '🃏', title: 'CAPS Poker', text: 'משחק Omaha חדש — משחקים כמה בורדים במקביל' },
  { icon: '🏆', title: 'איך זה עובד?', text: 'כל בורד = פוט נפרד.\nניצחת בורד = לקחת chips.\nניצחת הכל = COMPLETE bonus!' },
  { icon: '♠️', title: 'חוקי Omaha', text: 'לכל שחקן 4 קלפים לכל בורד.\nחייבים להשתמש ב-2 מהקלפים שלך\n+ 3 מהקהילה.' },
];
const TUTORIAL_SLIDES_EN = [
  { icon: '🃏', title: 'CAPS Poker', text: 'A new kind of Omaha poker —\nplay multiple boards at once' },
  { icon: '🏆', title: 'How it works?', text: 'Each board = separate pot.\nWin a board = take chips.\nWin ALL boards = COMPLETE bonus!' },
  { icon: '♠️', title: 'Omaha Rules', text: 'Each player gets 4 cards per board.\nYou must use exactly 2 of your cards\n+ 3 community cards.' },
];

function WelcomeModal({ onStart, onSkip }: { onStart: () => void; onSkip: () => void }) {
  const isHE = getLanguage() === 'he';
  const slides = isHE ? TUTORIAL_SLIDES_HE : TUTORIAL_SLIDES_EN;
  const [slide, setSlide] = useState(0);
  const opacity = useRef(new AnimatedRN.Value(0)).current;
  const slideOpacity = useRef(new AnimatedRN.Value(1)).current;

  useEffect(() => {
    AnimatedRN.timing(opacity, { toValue: 1, duration: 250, useNativeDriver: true }).start();
  }, []);

  const goToSlide = (next: number) => {
    AnimatedRN.sequence([
      AnimatedRN.timing(slideOpacity, { toValue: 0, duration: 120, useNativeDriver: true }),
      AnimatedRN.timing(slideOpacity, { toValue: 1, duration: 120, useNativeDriver: true }),
    ]).start();
    setSlide(next);
  };

  const isLast = slide === slides.length - 1;
  const current = slides[slide];

  return (
    <AnimatedRN.View style={[welcomeStyles.overlay, { opacity }]}>
      <Pressable
        style={StyleSheet.absoluteFillObject}
        onPress={onSkip}
        accessibilityRole="button"
        accessibilityLabel="Close dialog"
      />
      <View style={welcomeStyles.card}>
        {/* Dots */}
        <View style={welcomeStyles.dots}>
          {slides.map((_, i) => (
            <View key={i} style={[welcomeStyles.dot, i === slide && welcomeStyles.dotActive]} />
          ))}
        </View>

        <AnimatedRN.View style={[{ alignItems: 'center', gap: rs(8), width: '100%' }, { opacity: slideOpacity }]}>
          <Text style={welcomeStyles.slideIcon}>{current.icon}</Text>
          <Text style={welcomeStyles.title}>{current.title}</Text>
          <Text style={welcomeStyles.slideText}>{current.text}</Text>
        </AnimatedRN.View>

        {isLast ? (
          <Pressable
            onPress={() => { track('tutorial_completed', {}, 'home'); onStart(); }}
            accessibilityRole="button"
            accessibilityLabel={isHE ? 'יאללה!' : "Let's play"}
            style={welcomeStyles.startBtn}
          >
            <Text style={welcomeStyles.startBtnText}>{isHE ? 'יאללה!' : "LET'S PLAY!"}</Text>
          </Pressable>
        ) : (
          <Pressable
            onPress={() => goToSlide(slide + 1)}
            accessibilityRole="button"
            accessibilityLabel={isHE ? 'הבא' : 'Next'}
            style={welcomeStyles.startBtn}
          >
            <Text style={welcomeStyles.startBtnText}>{isHE ? 'הבא ›' : 'Next ›'}</Text>
          </Pressable>
        )}

        <Pressable
          onPress={() => { track('tutorial_skipped', { slide_index: slide }, 'home'); onSkip(); }}
          accessibilityRole="button"
          accessibilityLabel={isHE ? 'דלג על ההדרכה' : 'Skip tutorial'}
          hitSlop={8}
        >
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
  dots: {
    flexDirection: 'row',
    gap: rs(6),
    marginBottom: rs(16),
  },
  dot: {
    width: rs(7),
    height: rs(7),
    borderRadius: rs(4),
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  dotActive: {
    backgroundColor: '#c9a84c',
  },
  slideIcon: {
    fontSize: rf(36),
    marginBottom: rs(4),
  },
  slideText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: rf(14),
    fontWeight: '400',
    textAlign: 'center',
    lineHeight: rf(21),
  },
});

const isBeta = Constants.expoConfig?.extra?.isBeta === true;

// ─── Home screen ─────────────────────────────────────────────────────────────
export default function HomeScreen() {
  const router = useRouter();
  const { height: screenH, width: screenW } = useWindowDimensions();
  const chips = useGameStore((s) => s.chips);
  const config = useGameStore((s) => s.config);
  const updateConfig = useGameStore((s) => s.updateConfig);
  const lastDailyRewardClaim = useGameStore((s) => s.lastDailyRewardClaim);
  const dailyRewardStreak = useGameStore((s) => s.dailyRewardStreak);
  const currentWinStreak = useGameStore((s) => s.currentWinStreak);
  const bestWinStreak = useGameStore((s) => s.bestWinStreak);
  const lastFreeRefill = useGameStore((s) => s.lastFreeRefill);
  const homeThemeId = useGameStore((s) => s.homeTheme);
  const theme = HOME_THEMES[homeThemeId as import("../../constants/homeThemes").HomeThemeId] ?? HOME_THEMES[DEFAULT_HOME_THEME];
  const playerAvatar = useGameStore((s) => s.playerAvatar) || '👤';

  const user = useAuthUser();
  const prevUserRef = useRef<typeof user>(undefined);
  const playerName = useGameStore((s) => s.playerName) || 'Player';
  const [hasStartedGame, setHasStartedGame] = useState(!isWeb); // web shows landing page first
  const [signingIn, setSigningIn] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);
  const [showInteractiveTutorial, setShowInteractiveTutorial] = useState(false);
  const [showWelcome, setShowWelcome] = useState(false);
  const [gamesPlayed, setGamesPlayed] = useState(99); // default 99 = not first game until loaded
  const [showNudge, setShowNudge] = useState(false);
  // mpMode moved to Settings (PLAY ONLINE section consolidated)
  const [showWelcomeToast, setShowWelcomeToast] = useState(false);
  const [welcomeToastName, setWelcomeToastName] = useState('');
  // Daily reward popup — shown once per session on mount if claimable
  const [showDailyRewardPopup, setShowDailyRewardPopup] = useState(false);
  const [pendingDailyReward, setPendingDailyReward] = useState(0);
  const [pendingDailyStreak, setPendingDailyStreak] = useState(1);
  // Supabase streak popup + onboarding
  const [showStreakPopup, setShowStreakPopup] = useState(false);
  const [streakData, setStreakData] = useState<{ current_streak: number; reward: number; next_reward: number; milestones?: unknown } | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const pendingStreakRef = useRef(false);

  // Home data cards — missions + leaderboard
  const [missionData, setMissionData] = useState<{ title: string; progress: number; total: number; reward: number } | null>(null);
  const [leaderboardData, setLeaderboardData] = useState<{ rank: number; total: number } | null>(null);
  const [recentHands, setRecentHands] = useState<HandRecord[]>([]);
  const [totalHandCount, setTotalHandCount] = useState(0);
  const handsPlayed = useGameStore((s) => s.handsPlayed);
  const handsWon = useGameStore((s) => s.handsWon);

  // Progressive disclosure stage — derived locally from handsPlayed
  const stage = handsPlayed === 0 ? 'new'
    : handsPlayed <= 10 ? 'beginner'
    : handsPlayed <= 50 ? 'active'
    : 'veteran';
  const show_streak = stage !== 'new';
  const show_friend_challenge = stage !== 'new';
  const show_cups = stage === 'active' || stage === 'veteran';
  const show_sng = stage === 'active' || stage === 'veteran';
  const show_stats = stage === 'active' || stage === 'veteran';
  const show_veteran = stage === 'veteran';
  const unlockedAchievements = useGameStore((s) => s.unlockedAchievements);

  // Referral system (D6)
  const [showReferralModal, setShowReferralModal] = useState(false);
  const [referralCodeInput, setReferralCodeInput] = useState('');
  const [referralSubmitting, setReferralSubmitting] = useState(false);
  const [referralToast, setReferralToast] = useState<string | null>(null);
  const [myReferralCode, setMyReferralCode] = useState<string | null>(null);

  // Friend Activity Feed — recent Sit&Go sessions
  type FeedItem = { player_id: string; winner_id: string | null; chips_won: number | null; ended_at: string };
  const [activityFeed, setActivityFeed] = useState<FeedItem[]>([]);

  type CupItem = { id: string; name_he: string; tier: string; color: string; earned: boolean; progress: number };
  const [cupData, setCupData] = useState<{ cups: CupItem[]; total: number; earned: number } | null>(null);

  useEffect(() => {
    const sb = getSupabase();
    if (!sb) return;
    getDeviceId().then(async (deviceId) => {
      const { data } = await sb
        .from('sit_n_go_sessions')
        .select('player_id, winner_id, chips_won, ended_at')
        .eq('player_id', deviceId)
        .order('ended_at', { ascending: false })
        .limit(5);
      if (data) setActivityFeed(data as FeedItem[]);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    const sb = getSupabase();
    if (!sb) return;
    getDeviceId().then(async (deviceId) => {
      const { data } = await sb.rpc('get_cup_collection', { p_device_id: deviceId });
      if (data) setCupData(data as { cups: CupItem[]; total: number; earned: number });
    }).catch(() => {});
  }, []);

  // Battle Pass XP bar
  const bpCurrentXP = useBattlePassStore((s) => s.currentXP);
  const levelXP = useLevelStore((s: any) => s.xp);
  const playerLevel = useLevelStore((s: any) => s.level);
  const [showLevelUp, setShowLevelUp] = React.useState(false);
  const [levelUpTo, setLevelUpTo] = React.useState(1);
  const [showWeeklyRecap, setShowWeeklyRecap] = useState(false);
  // A3: Share COMPLETE banner after returning from a COMPLETE game
  const [showCompleteBanner, setShowCompleteBanner] = useState(false);
  const bpCurrentTier = useBattlePassStore((s) => s.currentTier);
  const { progress: bpProgress, xpInTier: bpXpInTier, xpNeeded: bpXpNeeded } = getProgressToNextTier(bpCurrentXP);

  // Play of the Day (D10)
  type PotdData = { available: boolean; player?: string; data?: { cards?: string[]; pot_won?: number; hand_name?: string }; views?: number } | null;
  const [potd, setPotd] = useState<PotdData>(null);

  // Rotating tagline — cycles through all 10
  const [tagline] = useState<string>(() => {
    const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000);
    return TAGLINES[dayOfYear % TAGLINES.length];
  });
  const taglineOpacity = useSharedValue(0);
  useEffect(() => { taglineOpacity.value = withTiming(1, { duration: 800 }); }, []);
  const taglineAnimStyle = useAnimatedStyle(() => ({ opacity: taglineOpacity.value }));

  // Load own referral code on mount (Task C) + cancel any re-engagement notification
  useEffect(() => {
    void cancelReengagement();
    getDeviceId().then(async (deviceId) => {
      const sb = getSupabase();
      if (!sb) return;
      const { data } = await sb.rpc('create_referral_code', { p_device_id: deviceId });
      if (data?.code) setMyReferralCode(data.code);
    }).catch(() => {});
  }, []);

  // PLAY button scale — RN Animated (not Reanimated)
  const playScale = useRef(new AnimatedRN.Value(1)).current;

  // A2: Daily Reward pulse animation
  const dailyPulseAnim = useRef(new AnimatedRN.Value(1)).current;

  // Chip float-up animation (+N when chips earned)
  const chipFloatY = useRef(new AnimatedRN.Value(0)).current;
  const chipFloatOpacity = useRef(new AnimatedRN.Value(0)).current;
  const [chipFloatText, setChipFloatText] = useState('');
  const prevChipsRef = useRef<number | null>(null);

  useEffect(() => {
    if (prevChipsRef.current !== null && chips > prevChipsRef.current) {
      const delta = chips - prevChipsRef.current;
      setChipFloatText(`+${delta}`);
      chipFloatY.setValue(0);
      chipFloatOpacity.setValue(1);
      AnimatedRN.parallel([
        AnimatedRN.timing(chipFloatY, { toValue: -rs(32), duration: 900, useNativeDriver: true }),
        AnimatedRN.sequence([
          AnimatedRN.delay(400),
          AnimatedRN.timing(chipFloatOpacity, { toValue: 0, duration: 500, useNativeDriver: true }),
        ]),
      ]).start();
    }
    prevChipsRef.current = chips;
  }, [chips]);

  useEffect(() => {
    setCurrentScreen('Home');
    CapsHooks.screenViewed('home');
    track('app_opened', {}, 'home');
    track('home_screen_loaded', {
      build: Constants.expoConfig?.version ?? 'unknown',
      platform: Platform.OS,
    }, 'home');

    // Economy: daily_login earn_chips (idempotent — safe every open)
    void (async () => {
      try {
        const deviceId = await getDeviceId();
        const result = await earnChips(deviceId, 'daily_login');
        if (result?.chips_earned) {
          const store = useGameStore.getState();
          store.addChips(result.chips_earned);
          store.trackChipsEarned(result.chips_earned);
        }
      } catch {}
    })();

    // Fetch card display config from Supabase (once per session)
    void (async () => {
      try {
        const cfg = await fetchCardDisplayConfig();
        useGameStore.getState().setCardConfig(cfg);
      } catch {}
    })();

    // Fetch Play of the Day (D10) — fire and forget
    void (async () => {
      try {
        const sb = getSupabase();
        if (!sb) return;
        const { data } = await sb.rpc('get_play_of_the_day');
        if (data?.available) setPotd(data);
      } catch {}
    })();

    // Interactive tutorial (S98) — shown if not yet seen (independent of old tutorial key)
    AsyncStorage.getItem(INTERACTIVE_TUTORIAL_KEY).then(val => {
      if (!val) setShowInteractiveTutorial(true);
    }).catch(() => {});
    // Old static tutorial — kept for Settings "replay tutorial" flow
    AsyncStorage.getItem(TUTORIAL_SEEN_KEY).then(val => {
      if (!val) setShowTutorial(false); // superseded by interactive tutorial
    }).catch(() => {});
    Promise.all([
      AsyncStorage.getItem(GAMES_PLAYED_KEY),
      AsyncStorage.getItem(NUDGE_DISMISSED_KEY),
      AsyncStorage.getItem(DAILY_REWARD_POPUP_SESSION_KEY),
    ]).then(([gamesVal, dismissedVal, popupShownVal]) => {
      const played = gamesVal ? parseInt(gamesVal, 10) || 0 : 0;
      setGamesPlayed(played);
      // Show nudge if: guest + nudge point + not recently dismissed
      const dismissedAt = dismissedVal ? parseInt(dismissedVal, 10) || 0 : 0;
      if (!user && NUDGE_AT_GAMES.includes(played) && played > dismissedAt) {
        setShowNudge(true);
      }
      // Show daily reward popup if claimable, not yet shown this session, and past first game
      if (ECONOMY_FLAGS.dailyRewardEnabled && !popupShownVal && played > 0) {
        const store = useGameStore.getState();
        const now = new Date();
        if (canClaimDailyReward(store.lastDailyRewardClaim, now)) {
          const nextStreak = getNextStreak(store.lastDailyRewardClaim, store.dailyRewardStreak, now);
          const reward = calculateDailyReward(nextStreak);
          setPendingDailyReward(reward);
          setPendingDailyStreak(nextStreak);
          setShowDailyRewardPopup(true);
          // Mark as shown for this session
          AsyncStorage.setItem(DAILY_REWARD_POPUP_SESSION_KEY, '1').catch(() => {});
        }
      }
    }).catch(() => { setGamesPlayed(0); });

    // Onboarding — show once for first-time users
    void AsyncStorage.getItem(ONBOARDING_SEEN_KEY).then(seen => {
      if (!seen) setShowOnboarding(true);
    }).catch(() => {});

    // Supabase daily streak — claim_daily_streak RPC
    void (async () => {
      try {
        const shownThisSession = await AsyncStorage.getItem(STREAK_POPUP_SESSION_KEY);
        if (shownThisSession) return;
        const deviceId = await getDeviceId();
        const sb = getSupabase();
        if (!sb) return;
        const { data } = await sb.rpc('claim_daily_streak', { p_device_id: deviceId });
        if (!data) return;
        if (data.claimed) {
          const store = useGameStore.getState();
          store.addChips(data.reward);
          store.trackChipsEarned(data.reward);
          track('streak_claimed', { day: data.current_streak }, 'home');
          setStreakData(data);
          await AsyncStorage.setItem(STREAK_POPUP_SESSION_KEY, '1').catch(() => {});
          const seenOnboarding = await AsyncStorage.getItem(ONBOARDING_SEEN_KEY);
          if (seenOnboarding) {
            setShowStreakPopup(true);
          } else {
            pendingStreakRef.current = true;
          }
        } else if (data.already_claimed) {
          setStreakData(data);
        }
      } catch {}
    })();

    // Weekly Recap — show on Sunday
    const today = new Date();
    if (today.getDay() === 0) { // Sunday = 0
      const weekKey = `recap_${today.getFullYear()}_${Math.ceil(today.getDate() / 7)}`;
      AsyncStorage.getItem('recap_week').then(stored => {
        if (stored !== weekKey) setShowWeeklyRecap(true);
      });
    }

    // Home data cards — missions + leaderboard
    void (async () => {
      try {
        const deviceId = await getDeviceId();
        const sb = getSupabase();
        if (!sb) return;
        try { await sb.rpc('assign_daily_missions', { p_device_id: deviceId }); } catch {}
        const { data: missions } = await sb.rpc('get_daily_missions', { p_device_id: deviceId });
        if (Array.isArray(missions) && missions.length > 0) {
          const m = missions[0] as any;
          setMissionData({ title: m.title ?? m.name ?? 'Mission', progress: m.progress ?? 0, total: m.target ?? m.required ?? 1, reward: m.reward_chips ?? m.reward ?? 0 });
        }
      } catch {}
    })();
    void (async () => {
      try {
        const deviceId = await getDeviceId();
        const sb = getSupabase();
        if (!sb) return;
        const { data: lb } = await sb.rpc('get_leaderboard', { p_device_id: deviceId });
        if (lb) {
          const entries = Array.isArray(lb) ? lb : (lb.entries ?? []);
          const myEntry = entries.find((e: any) => e.is_me || e.device_id === deviceId);
          const rank = myEntry?.rank ?? myEntry?.position ?? null;
          const total = entries.length || (lb.total ?? 0);
          if (rank) setLeaderboardData({ rank: Number(rank), total: Number(total) });
        }
      } catch {}
    })();
  }, []);

  // Load recent hands from local history
  useEffect(() => {
    getHandHistory().then(history => { setRecentHands(history.slice(0, 5)); setTotalHandCount(history.length); }).catch(() => {});
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
    track('play_button_tapped', { mode: 'single_player', player_count: config.numberOfPlayers }, 'home');
    track('game_started', { player_count: config.numberOfPlayers }, 'home');
    // Heatmap (D7)
    getDeviceId().then(id => trackEvent('home', 'play_button', id)).catch(() => {});
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
    void scheduleLocal('Daily Reward Ready 🎁', 'Your daily reward is waiting! Open CAPS to claim.', 24 * 60 * 60, 'daily_reward');
  }, [lastDailyRewardClaim, dailyRewardStreak]);

  // Handler for claiming from the auto-popup (uses pre-computed reward values)
  const handlePopupClaim = useCallback(() => {
    setShowDailyRewardPopup(false);
    const now = new Date();
    const store = useGameStore.getState();
    store.addChips(pendingDailyReward);
    store.trackChipsEarned(pendingDailyReward);
    store.setLastDailyRewardClaim(now.toISOString());
    store.setDailyRewardStreak(pendingDailyStreak);
    CapsHooks.dailyRewardClaimed(pendingDailyStreak, pendingDailyReward);
    void scheduleLocal('Daily Reward Ready 🎁', 'Your daily reward is waiting! Open CAPS to claim.', 24 * 60 * 60, 'daily_reward');
  }, [pendingDailyReward, pendingDailyStreak]);

  const handleOnboardingDone = useCallback(() => {
    setShowOnboarding(false);
    if (pendingStreakRef.current && streakData) {
      pendingStreakRef.current = false;
      setShowStreakPopup(true);
    }
  }, [streakData]);

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

  // Referral: show toast helper
  const showReferralToast = useCallback((msg: string) => {
    setReferralToast(msg);
    setTimeout(() => setReferralToast(null), 2800);
  }, []);

  // Referral: Invite Friends — use cached code or create on demand (D6+)
  const handleInviteFriends = useCallback(async () => {
    try {
      let code = myReferralCode;
      if (!code) {
        const deviceId = await getDeviceId();
        const sb = getSupabase();
        if (!sb) return;
        const { data, error } = await sb.rpc('create_referral_code', { p_device_id: deviceId });
        if (error || !data?.code) {
          showReferralToast('Could not create invite link. Try again.');
          return;
        }
        code = data.code as string;
        setMyReferralCode(code);
      }
      const message = `🃏 Come play CAPS with me! Enter code ${code} and get 100 💰 bonus! https://caps.app/invite/${code}`;
      await Share.share({ message });
    } catch {
      // silent — share cancelled or unavailable
    }
  }, [myReferralCode, showReferralToast]);

  // Copy own code via share sheet
  const handleCopyCode = useCallback(async () => {
    if (!myReferralCode) return;
    try { await Share.share({ message: myReferralCode }); } catch { /* silent */ }
  }, [myReferralCode]);

  // Referral: redeem code (D6)
  const handleRedeemCode = useCallback(async () => {
    const code = referralCodeInput.trim().toUpperCase();
    if (code.length !== 6) {
      showReferralToast('Enter a 6-character code.');
      return;
    }
    setReferralSubmitting(true);
    try {
      const deviceId = await getDeviceId();
      const sb = getSupabase();
      if (!sb) return;
      const { data, error } = await sb.rpc('redeem_referral', { p_device_id: deviceId, p_code: code });
      if (error || !data?.success) {
        showReferralToast(data?.message ?? 'Invalid or already used code.');
      } else {
        useGameStore.getState().addChips(100);
        useGameStore.getState().trackChipsEarned(100);
        showReferralToast('+100 💰 Welcome bonus!');
        setReferralCodeInput('');
        setShowReferralModal(false);
      }
    } catch {
      showReferralToast('Something went wrong. Try again.');
    } finally {
      setReferralSubmitting(false);
    }
  }, [referralCodeInput, showReferralToast]);

  const handleFriendChallenge = useCallback(async () => {
    try {
      const sb = getSupabase();
      if (!sb) return;
      const { data, error } = await sb.rpc('create_friend_challenge', { p_user_id: user?.id ?? '' });
      if (error || !data?.code) {
        Alert.alert(
          getLanguage() === 'he' ? 'שגיאה' : 'Error',
          getLanguage() === 'he' ? 'לא ניתן ליצור אתגר. נסה שוב.' : 'Could not create challenge. Try again.',
        );
        return;
      }
      await Share.share({
        message: getLanguage() === 'he'
          ? `🃏 אני מאתגר אותך ב-CAPS Poker!\nקוד: ${data.code}`
          : `🃏 I challenge you to CAPS Poker!\nCode: ${data.code}`,
      });
    } catch {}
  }, [user?.id]);

  const canClaim = ECONOMY_FLAGS.dailyRewardEnabled && canClaimDailyReward(lastDailyRewardClaim);

  // A3: Show share banner if last game was COMPLETE
  useFocusEffect(useCallback(() => {
    AsyncStorage.getItem('last_was_complete').then(val => {
      if (val === 'true') {
        AsyncStorage.removeItem('last_was_complete').catch(() => {});
        setShowCompleteBanner(true);
        setTimeout(() => setShowCompleteBanner(false), 8000);
      }
    }).catch(() => {});
  }, []));

  // A2: Start/stop pulse when claimable
  useEffect(() => {
    if (!canClaim) { dailyPulseAnim.setValue(1); return; }
    const anim = AnimatedRN.loop(AnimatedRN.sequence([
      AnimatedRN.timing(dailyPulseAnim, { toValue: 1.05, duration: 800, useNativeDriver: true }),
      AnimatedRN.timing(dailyPulseAnim, { toValue: 1.0, duration: 800, useNativeDriver: true }),
    ]));
    anim.start();
    return () => anim.stop();
  }, [canClaim]);

  const titleFontSize = Math.min(42, Math.floor(screenW * 0.105));

  // Web title gradient for dark_gold theme
  const webTitleGradient = isWeb && homeThemeId === 'dark_gold'
    ? ({ background: 'linear-gradient(135deg, #e8c96a 0%, #c9a84c 50%, #9a7a2e 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' } as any)
    : {};

  // Cap play button width at effective web content width (WEB_MAX_WIDTH=430) to avoid overflow
  const _effectiveW = (Platform.OS === 'web' && screenW > 430) ? 430 : screenW;
  const playBtnWidth = Math.round(_effectiveW * 0.75);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]}>
      {/* Web landing page — shown on first web visit (native: never shown) */}
      {isWeb && !hasStartedGame && <WebLandingHero onPlay={() => setHasStartedGame(true)} />}

      <FriendsBg />

      {/* Floating suit particles — decorative background */}
      <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
        {PARTICLE_CONFIG.map((p, i) => (
          <FloatingParticle key={i} {...p} screenW={screenW} screenH={screenH} />
        ))}
      </View>
      {isWeb && <View style={styles.gradientOverlay} />}
      {isWeb && <View style={styles.grainOverlay} />}

      {/* Interactive Tutorial (S98) — 3 steps with real cards, first-launch */}
      {showInteractiveTutorial && (
        <InteractiveTutorial onDone={() => { setShowInteractiveTutorial(false); router.push('/game' as any); }} />
      )}

      {/* Tutorial overlay — 5-slide static tutorial (Settings replay only) */}
      {showTutorial && !showInteractiveTutorial && <Tutorial onDone={() => setShowTutorial(false)} />}

      {/* Welcome modal — shown before first game or tutorial replay */}
      {showWelcome && <WelcomeModal onStart={handleWelcomeStart} onSkip={handleWelcomeSkip} />}

      {/* Daily reward popup — auto-shown on app open if claimable, once per session */}
      {showDailyRewardPopup && (
        <DailyRewardModal
          reward={pendingDailyReward}
          streak={pendingDailyStreak}
          onClaim={handlePopupClaim}
          onDismiss={() => setShowDailyRewardPopup(false)}
        />
      )}

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

      {/* Top bar — avatar + chips (S112: hamburger removed) */}
      <View style={[styles.topBar, { justifyContent: 'flex-end' }]}>
        <View style={styles.topBarRight}>
          {/* Chip balance — tap to shop */}
          <View style={styles.topChipWrap}>
            {chips === 0 ? (
              <Pressable
                onPress={() => router.push('/shop' as any)}
                accessibilityRole="button"
                accessibilityLabel="Get chips"
                hitSlop={8}
                style={styles.topChipGetBtn}
              >
                <Text style={styles.topChipGetText}>GET CHIPS</Text>
              </Pressable>
            ) : (
              <Pressable
                onPress={() => router.push('/shop' as any)}
                accessibilityRole="button"
                accessibilityLabel="Open chip shop"
                hitSlop={8}
                style={styles.topChipBtn}
              >
                <Text style={[
                  styles.topChipText,
                  (chips ?? 0) < 100 ? { color: '#F59E0B' } : { color: '#FFFFFF' },
                ]}>🪙 {(chips ?? 0).toLocaleString()}</Text>
              </Pressable>
            )}
            <AnimatedRN.Text style={[
              styles.chipFloatText,
              { opacity: chipFloatOpacity, transform: [{ translateY: chipFloatY }] },
            ]}>{chipFloatText}</AnimatedRN.Text>
          </View>
          {streakData && streakData.current_streak > 1 && (
            <View style={styles.streakBadgePill}>
              <Text style={styles.streakBadgePillText}>🔥 {streakData.current_streak}</Text>
            </View>
          )}
          {user?.user_metadata?.avatar_url ? (
            <Pressable
              onPress={() => setMenuOpen(true)}
              accessibilityRole="button"
              accessibilityLabel="Open menu"
              hitSlop={8}
            >
              <Image
                source={{ uri: String(user.user_metadata.avatar_url) }}
                style={styles.topAvatar}
              />
            </Pressable>
          ) : (
            <Pressable
              onPress={() => setMenuOpen(true)}
              accessibilityRole="button"
              accessibilityLabel="Open menu"
              hitSlop={8}
            >
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
            accessibilityRole="header"
          >
            CAPS
          </Text>
          <Text style={styles.titlePoker}>POKER</Text>
          <HeroCardFan />
          <Animated.Text
            style={[styles.titleSub, { color: theme.subtitleColor }, taglineAnimStyle]}
            numberOfLines={1}
            adjustsFontSizeToFit
          >
            {tagline}
          </Animated.Text>
          <View style={[styles.titleDivider, { backgroundColor: theme.accent }]} />
          <Text style={{ color: theme.subtitleColor, fontSize: rf(10.5), opacity: 0.6, textAlign: "center", fontStyle: "italic", marginTop: 6, paddingHorizontal: 16, lineHeight: rf(14) }} numberOfLines={3} ellipsizeMode="tail">"{todaysQuote.text}"</Text>
          <Text style={{ color: theme.subtitleColor, fontSize: rf(9.5), opacity: 0.4, textAlign: "center", fontStyle: "italic", marginTop: 2, paddingHorizontal: 16 }}>— {todaysQuote.author}</Text>
        </View>

        {/* CAPS brand wordmark — above player selector (Task 1) */}
        <View style={{ alignItems: 'center', paddingVertical: rs(8) }}>
          <Text style={{ fontSize: rf(22), fontWeight: '800', color: '#FFD700', letterSpacing: 6 }}>CAPS</Text>
          <Text style={{ fontSize: rf(9), color: '#A5D6A7', letterSpacing: 2 }}>FOUR CARDS. FOUR BOARDS. ONE WINNER.</Text>
        </View>

        {/* Player count selector — 2P / 3P / 4P */}
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 2 }}>
          {([2, 3, 4] as const).map(n => (
            <Pressable
              key={n}
              onPress={() => updateConfig({ numberOfPlayers: n })}
              accessibilityRole="radio"
              accessibilityLabel={`${n} players`}
              style={{
                paddingHorizontal: 16, paddingVertical: 8,
                borderRadius: 20,
                backgroundColor: config.numberOfPlayers === n ? '#6B1520' : 'transparent',
                borderWidth: 1,
                borderColor: config.numberOfPlayers === n ? '#8B6914' : 'rgba(255,255,255,0.18)',
              }}
            >
              <Text style={{ color: config.numberOfPlayers === n ? '#fff' : 'rgba(255,255,255,0.45)', fontSize: rs(14), fontWeight: '700' }}>
                {n}P
              </Text>
            </Pressable>
          ))}
        </View>
        {/* A1: Omaha hint under selector */}
        <Text style={{ fontSize: rf(11), color: 'rgba(201,168,76,0.7)', textAlign: 'center', marginBottom: 4 }}>
          {config.numberOfPlayers === 2
            ? '4 boards · Omaha · Best hand wins each'
            : config.numberOfPlayers === 3
            ? '3 boards · Omaha · Best hand wins each'
            : '2 boards · Omaha · Best hand wins each'}
        </Text>

        {/* Online player count — hidden in beta until real data available */}
        {!isBeta && (
          <Text style={{ textAlign: 'center', fontSize: rf(11), color: '#81C784', marginBottom: rs(4) }}>
            32 שחקנים אונליין
          </Text>
        )}

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
              <Text style={styles.playBtnText}>שחק!</Text>
            </Pressable>
          </AnimatedRN.View>

          {/* Board config hint — English only (S112) */}
          <Text style={[styles.playSubtext, { color: theme.subtitleColor }]}>
            {getBoardCount(config.numberOfPlayers)} boards · {config.numberOfPlayers} players
            {config.potPerBoard > 0 ? ` · ${config.potPerBoard <= 25 ? 'Low' : config.potPerBoard <= 100 ? 'Mid' : 'High'} Stakes · ${config.potPerBoard}/board` : ' · Free'}
          </Text>
        </View>

        {/* New player welcome message */}
        {stage === 'new' && (
          <View style={{ backgroundColor: 'rgba(201,168,76,0.1)', borderWidth: 1, borderColor: 'rgba(201,168,76,0.3)', borderRadius: rv(12), paddingVertical: rs(12), paddingHorizontal: rs(16), marginHorizontal: rs(16), marginTop: rs(8), alignItems: 'center' }}>
            <Text style={{ color: '#c9a84c', fontSize: rf(15), fontWeight: '700', textAlign: 'center' }}>ברוך הבא ל-CAPS Poker! 🃏</Text>
            <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: rf(12), marginTop: rs(4), textAlign: 'center' }}>לחץ שחק כדי להתחיל את המשחק הראשון שלך</Text>
          </View>
        )}

        {/* Challenge a Friend — beginner+ only */}
        {show_friend_challenge && (
          <Pressable
            style={{
              borderWidth: 1, borderColor: '#FFD700', borderRadius: rv(12),
              paddingVertical: rs(14), marginHorizontal: rs(16), marginTop: rs(8),
              alignItems: 'center', backgroundColor: 'rgba(255,215,0,0.08)',
            }}
            onPress={handleFriendChallenge}
            accessibilityRole="button"
            accessibilityLabel="אתגר חבר"
          >
            <Text style={{ color: '#FFD700', fontSize: rf(15), fontWeight: '600' }}>אתגר חבר</Text>
            <Text style={{ color: '#A5D6A7', fontSize: rf(11), marginTop: rs(2) }}>שלח אתגר פוקר לחבר</Text>
          </Pressable>
        )}

        {/* Cup collection — active+ only */}
        {show_cups && cupData && (
          <>
            <View style={{ flexDirection: 'row', justifyContent: 'center', gap: rs(8), marginVertical: rs(8) }}>
              {cupData.cups.map(cup => (
                <View key={cup.id} style={{
                  width: rs(36), height: rs(36), borderRadius: rv(8),
                  backgroundColor: cup.earned ? cup.color : 'rgba(255,255,255,0.1)',
                  alignItems: 'center', justifyContent: 'center',
                  opacity: cup.earned ? 1 : 0.4,
                }}>
                  <Text style={{ fontSize: rf(16) }}>🏆</Text>
                </View>
              ))}
            </View>
            <Text style={{ textAlign: 'center', fontSize: rf(11), color: '#A5D6A7' }}>
              {cupData.earned}/{cupData.total} כוסות
            </Text>
          </>
        )}

        {/* A3: Share COMPLETE banner */}
        {showCompleteBanner && (
          <Pressable
            onPress={async () => {
              try {
                await Share.share({ message: 'I got COMPLETE in CAPS Poker! Won all boards! 🏆\nPlay: testflight.apple.com/join/hD3KvZeC', title: 'CAPS Poker - COMPLETE!' });
              } catch {}
              setShowCompleteBanner(false);
            }}
            accessibilityRole="button"
            accessibilityLabel="Share your COMPLETE win"
            style={{ backgroundColor: 'rgba(201,168,76,0.15)', borderWidth: 1.5, borderColor: '#c9a84c', borderRadius: 12, paddingVertical: 10, paddingHorizontal: 16, marginBottom: 4, alignItems: 'center' }}
          >
            <Text style={{ color: '#c9a84c', fontWeight: '900', fontSize: rf(13) }}>🏆 You got COMPLETE! Share it?</Text>
          </Pressable>
        )}

        {/* Daily reward — prominent pill when claimable, streak info otherwise */}
        {canClaim ? (
          <AnimatedRN.View style={{ transform: [{ scale: dailyPulseAnim }] }}>
            <Pressable
              onPress={handleClaimDailyReward}
              accessibilityRole="button"
              accessibilityLabel="תבע בונוס יומי"
              style={[styles.dailyPill, styles.dailyPillClaim]}
            >
              {dailyRewardStreak >= 6 ? (
                <Text style={styles.dailyPillText}>🔥 יום {dailyRewardStreak + 1} ברצף! +500 צ׳יפים!</Text>
              ) : (
                <Text style={styles.dailyPillText}>🎁 תבע בונוס יומי · יום {dailyRewardStreak + 1}</Text>
              )}
            </Pressable>
          </AnimatedRN.View>
        ) : dailyRewardStreak >= 1 ? (
          <View style={styles.dailyStreakInfo}>
            {(() => {
              const nextStreak = dailyRewardStreak + 1;
              const nextReward = calculateDailyReward(nextStreak);
              const isMilestone = nextStreak === 7 || nextStreak === 30;
              const milestoneLabel = nextStreak === 30 ? ' (בונוס חודשי!)' : nextStreak === 7 ? ' (בונוס שבועי!)' : '';
              return (
                <Text style={styles.dailyStreakInfoText}>
                  {`🔥 יום ${dailyRewardStreak} ברצף! מחר: +${nextReward} צ׳יפים${milestoneLabel}`}
                </Text>
              );
            })()}
          </View>
        ) : null}

        {/* Win streak — beginner+ only */}
        {show_streak && currentWinStreak >= 2 && (
          <View style={styles.homeStreakRow}>
            <Text style={styles.homeStreakText}>🔥 {currentWinStreak} ניצחונות ברצף</Text>
            {bestWinStreak > currentWinStreak && (
              <Text style={styles.homeStreakBest}> · שיא: {bestWinStreak}</Text>
            )}
          </View>
        )}

        {/* Play of the Day card (D10) — only shown when player name is known */}
        {potd?.available && potd.data && potd.player && potd.player !== 'Anonymous' && (
          <View style={styles.potdCard}>
            <Text style={styles.potdTitle}>🏆 מהלך היום</Text>
            <Text style={styles.potdPlayer} numberOfLines={1}>
              {potd.player} · {potd.data.hand_name ?? 'יד מנצחת'}
            </Text>
            {(potd.data.pot_won ?? 0) > 0 && <Text style={styles.potdPot}>סיר: {(potd.data.pot_won ?? 0).toLocaleString()} 💰</Text>}
          </View>
        )}

        {/* Mode buttons — active+ only */}
        {show_sng && (
          <View style={styles.modeButtonRow}>
            <Pressable
              style={[styles.modeBtn, styles.modeBtnBlue]}
              onPress={() => {
                getDeviceId().then(id => trackEvent('home', 'sit_n_go_button', id)).catch(() => {});
                router.push('/sit-and-go' as any);
              }}
              accessibilityRole="button"
              accessibilityLabel="סיט אנד גו, 100 צ׳יפים"
            >
              <Text style={[styles.modeBtnIcon]}>🎯</Text>
              <Text style={[styles.modeBtnLabel, styles.modeBtnLabelBlue]}>סיט אנד גו (100 💰)</Text>
            </Pressable>
            <Pressable
              style={[styles.modeBtn, { backgroundColor: '#3d1a0e' }]}
              onPress={() => router.push('/quick-poker' as any)}
              accessibilityRole="button"
              accessibilityLabel="פוקר מהיר, 200 צ׳יפים"
            >
              <Text style={styles.modeBtnIcon}>⚡</Text>
              <Text style={[styles.modeBtnLabel, { color: '#c96a1a' }]}>פוקר מהיר (200 💰)</Text>
            </Pressable>
          </View>
        )}

        {/* 📊 Stats — active+ only */}
        {show_stats && totalHandCount > 0 && (
          <Pressable
            onPress={() => router.push('/hand-history' as any)}
            accessibilityRole="button"
            accessibilityLabel={`היסטוריית ידיים, ${totalHandCount} ידות שוחקו`}
            style={styles.statsBtn}
          >
            <Text style={styles.statsBtnText}>📊 {totalHandCount} ידות שוחקו</Text>
          </Pressable>
        )}

        {/* Online/WiFi multiplayer moved to Settings screen (Task 4) */}

        {/* Data cards — active+ only */}
        {show_stats && (
          <View style={{ flexDirection: 'row', gap: 8, width: '100%', marginTop: 4 }}>
            <Pressable
              onPress={() => router.push('/achievements' as any)}
              accessibilityRole="button"
              accessibilityLabel="ההתקדמות שלי"
              style={homeDataCardStyles.card}
            >
              <Text style={homeDataCardStyles.label}>ההתקדמות שלי</Text>
              <Text style={homeDataCardStyles.value}>{unlockedAchievements.length}/{ACHIEVEMENTS.length}</Text>
              <Text style={homeDataCardStyles.sub}>הישגים · {handsPlayed > 0 ? `${Math.round(handsWon / handsPlayed * 100)}%` : '—'} ניצחונות</Text>
            </Pressable>
            <Pressable
              onPress={() => router.push('/missions' as any)}
              accessibilityRole="button"
              accessibilityLabel="תחרות"
              style={homeDataCardStyles.card}
            >
              <Text style={homeDataCardStyles.label}>תחרות</Text>
              <Text style={homeDataCardStyles.value}>{missionData ? `${missionData.progress}/${missionData.total}` : '—'}</Text>
              <Text style={homeDataCardStyles.sub}>משימות · {leaderboardData && leaderboardData.rank > 0 ? `#${leaderboardData.rank} דירוג` : 'שחק כדי לדרג'}</Text>
            </Pressable>
          </View>
        )}

        {/* Activity Feed + Recent Hands — veteran only */}
        {show_veteran && (
          <View style={styles.feedSection}>
            <Text style={styles.feedTitle}>🏆 ניצחונות אחרונים</Text>
            {activityFeed.length === 0 ? (
              <Text style={styles.feedEmpty}>שחק סיט אנד גו כדי לראות את ההיסטוריה שלך</Text>
            ) : (
              activityFeed.map((item, i) => {
                const won = item.winner_id === item.player_id;
                return (
                  <View key={i} style={styles.feedItem}>
                    <Text style={styles.feedItemText}>
                      {won
                        ? `✅ ניצחת סיט אנד גו — +${item.chips_won ?? 0} 💰`
                        : `❌ סיט אנד גו — בפעם הבאה`}
                    </Text>
                    <Text style={styles.feedItemTime}>
                      {item.ended_at ? new Date(item.ended_at).toLocaleDateString() : ''}
                    </Text>
                  </View>
                );
              })
            )}
          </View>
        )}

        {/* Recent Hands — veteran only */}
        {show_veteran && recentHands.length > 0 && (
          <View style={{ width: '100%', marginTop: 4 }}>
            <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: rs(11), fontWeight: '700', letterSpacing: 1, marginBottom: 6, textTransform: 'uppercase' }}>ידיים אחרונות</Text>
            {recentHands.map((hand, i) => {
              const boardsWon = hand.boards.filter(b => b.winner === 'player').length;
              const effPct = Math.round(boardsWon / hand.boardCount * 100);
              const minsAgo = Math.round((Date.now() - hand.timestamp) / 60000);
              const timeStr = minsAgo < 60 ? `${minsAgo}m ago` : minsAgo < 1440 ? `${Math.round(minsAgo / 60)}h ago` : `${Math.round(minsAgo / 1440)}d ago`;
              return (
                <Pressable
                  key={hand.id}
                  onPress={() => router.push(`/hand-history?handId=${hand.id}` as any)}
                  accessibilityRole="button"
                  accessibilityLabel="צפה בהיסטוריית היד"
                  style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 7, borderBottomWidth: i < recentHands.length - 1 ? 1 : 0, borderBottomColor: 'rgba(255,255,255,0.07)' }}
                >
                  <Text style={{ color: boardsWon > hand.boardCount / 2 ? '#4CAF50' : '#EF5350', fontSize: rs(13), fontWeight: '700' }}>
                    {boardsWon}/{hand.boardCount} לוחות
                  </Text>
                  <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: rs(12) }}>{effPct}% eff</Text>
                  <Text style={{ color: 'rgba(255,255,255,0.3)', fontSize: rs(11) }}>{timeStr}</Text>
                </Pressable>
              );
            })}
          </View>
        )}

        {/* Referral — Persistent Code Card (S104) */}
        <View style={styles.referralRow}>
          {myReferralCode ? (
            <View style={styles.referralCard}>
              <Text style={styles.referralCardLabel}>YOUR CODE</Text>
              <Text style={styles.referralCardCode}>{myReferralCode}</Text>
              <View style={styles.referralCardButtons}>
                <Pressable
                  onPress={handleCopyCode}
                  accessibilityRole="button"
                  accessibilityLabel="Copy referral code"
                  style={styles.referralActionBtn}
                >
                  <Text style={styles.referralActionBtnText}>📋 Copy</Text>
                </Pressable>
                <Pressable
                  onPress={handleInviteFriends}
                  accessibilityRole="button"
                  accessibilityLabel="Share referral code"
                  style={styles.referralActionBtn}
                >
                  <Text style={styles.referralActionBtnText}>📤 Share</Text>
                </Pressable>
              </View>
            </View>
          ) : (
            <Pressable
              onPress={handleInviteFriends}
              accessibilityRole="button"
              accessibilityLabel="הזמן חברים"
              style={styles.inviteBtn}
            >
              <Text style={styles.inviteBtnText}>הזמן חברים 🎁</Text>
            </Pressable>
          )}
          {gamesPlayed < 3 && (
            <Pressable
              onPress={() => setShowReferralModal(true)}
              accessibilityRole="button"
              accessibilityLabel="Got an invite code?"
              hitSlop={8}
            >
              <Text style={styles.gotCodeLink}>Got an invite code?</Text>
            </Pressable>
          )}
        </View>

        <Text style={{
          color: '#444',
          fontSize: 10,
          textAlign: 'center',
          marginTop: 24,
          marginBottom: 8,
        }}>
          {"משחק חינמי | צ'יפים וירטואליים בלבד | גילאי 12+"}
        </Text>

      </View>

      {/* Referral toast (D6) */}
      {referralToast && (
        <AnimatedRN.View
          style={styles.referralToast}
          pointerEvents="none"
          accessibilityLiveRegion="polite"
          accessibilityRole="alert"
        >
          <Text style={styles.referralToastText}>{referralToast}</Text>
        </AnimatedRN.View>
      )}

      {/* Redeem code modal (D6) */}
      <Modal
        visible={showReferralModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowReferralModal(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setShowReferralModal(false)}
          accessibilityRole="button"
          accessibilityLabel="Close dialog"
        >
          <Pressable
            style={styles.modalCard}
            onPress={() => {}}
            accessibilityRole="button"
            accessibilityLabel="Invite code dialog"
          >
            <Text style={styles.modalTitle}>🎁 Enter Invite Code</Text>
            <Text style={styles.modalSub}>6-character code from a friend</Text>
            <TextInput
              style={styles.codeInput}
              value={referralCodeInput}
              onChangeText={v => setReferralCodeInput(v.toUpperCase().slice(0, 6))}
              placeholder="A3F2B1"
              placeholderTextColor="rgba(255,255,255,0.25)"
              autoCapitalize="characters"
              maxLength={6}
              returnKeyType="done"
              onSubmitEditing={handleRedeemCode}
            />
            {/* S89: 6-char counter clarifies what the 6 means */}
            <Text style={{ color: 'rgba(255,255,255,0.35)', fontSize: 11, alignSelf: 'flex-end', marginTop: -4 }}>
              {referralCodeInput.length}/6 תווים
            </Text>
            <Pressable
              style={[styles.redeemBtn, referralSubmitting && { opacity: 0.6 }]}
              onPress={handleRedeemCode}
              accessibilityRole="button"
              accessibilityLabel="Redeem invite code for 100 chips"
              disabled={referralSubmitting}
            >
              <Text style={styles.redeemBtnText}>{referralSubmitting ? 'Checking...' : 'Redeem +100 💰'}</Text>
            </Pressable>
            <Pressable
              onPress={() => setShowReferralModal(false)}
              accessibilityRole="button"
              accessibilityLabel="Cancel"
              hitSlop={8}
              style={{ marginTop: rs(8) }}
            >
              <Text style={styles.modalCancelText}>Cancel</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

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

      {showOnboarding && <OnboardingOverlay onDone={handleOnboardingDone} />}
      {showStreakPopup && streakData && (
        <StreakPopup
          streak={streakData.current_streak}
          reward={streakData.reward}
          nextReward={streakData.next_reward}
          milestones={streakData.milestones as any}
          onCollect={() => setShowStreakPopup(false)}
        />
      )}
      <LevelUpModal visible={showLevelUp} newLevel={levelUpTo} onClose={() => setShowLevelUp(false)} />
      <WeeklyRecapModal visible={showWeeklyRecap} onDismiss={() => setShowWeeklyRecap(false)} />
      <StarterOfferModal />
      </SafeAreaView>
  );
}

const homeDataCardStyles = StyleSheet.create({
  card: {
    flex: 1,
    minWidth: '45%' as any,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: rv(12),
    padding: rs(12),
    gap: rs(3),
  },
  label: {
    color: 'rgba(255,255,255,0.35)',
    fontSize: rs(10),
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase' as const,
  },
  value: {
    color: '#c9a84c',
    fontSize: rs(20),
    fontWeight: '900',
  },
  sub: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: rs(11),
    fontWeight: '500',
  },
});

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
  topChipWrap: {
    position: 'relative',
    alignItems: 'flex-end',
  },
  topChipBtn: {
    paddingVertical: rs(4),
    paddingHorizontal: rs(8),
    borderRadius: rs(12),
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  topChipText: {
    fontSize: rf(14),
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  topChipGetBtn: {
    paddingVertical: rs(4),
    paddingHorizontal: rs(10),
    borderRadius: rs(12),
    backgroundColor: '#DC2626',
  },
  topChipGetText: {
    fontSize: rf(12),
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  homeStreakRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: rs(4),
    paddingHorizontal: rs(14),
    borderRadius: rs(14),
    backgroundColor: 'rgba(255,149,0,0.12)',
  },
  homeStreakText: {
    fontSize: rf(13),
    fontWeight: '700',
    color: '#FF9500',
  },
  homeStreakBest: {
    fontSize: rf(12),
    color: 'rgba(255,149,0,0.65)',
    fontWeight: '500',
  },
  chipFloatText: {
    position: 'absolute',
    top: -rs(4),
    right: 0,
    fontSize: rf(13),
    fontWeight: '700',
    color: '#2ecc71',
    pointerEvents: 'none',
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
    zIndex: 2,
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
    textShadowColor: 'rgba(0,0,0,0.85)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 24,
  },
  titlePoker: {
    fontSize: rf(18),
    fontWeight: '600',
    letterSpacing: 3,
    textTransform: 'uppercase',
    color: '#c9a84c',
    opacity: 1.0,
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
    minHeight: rv(72),
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
  stakesLabel: {
    fontSize: rf(11),
    fontWeight: '500',
    color: '#78716C',
    letterSpacing: 0.3,
    textAlign: 'center',
    marginTop: -rs(4),
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
  dailyPillClaim: {
    alignItems: 'center',
    gap: rs(2),
  },
  dailyPillStreak: {
    color: 'rgba(232,201,106,0.7)',
    fontSize: rf(11),
    fontWeight: '600',
  },
  dailyStreakInfo: {
    paddingVertical: rs(4),
    paddingHorizontal: rs(14),
  },
  dailyStreakInfoText: {
    color: 'rgba(255,149,0,0.75)',
    fontSize: rf(12),
    fontWeight: '600',
    textAlign: 'center',
  },

  debugInfo: {
    position: 'absolute',
    bottom: rs(8),
    alignSelf: 'center',
    color: 'rgba(255,255,255,0.15)',
    fontSize: rf(10),
  },

  versionBadge: {
    position: 'absolute',
    bottom: 8,
    right: 12,
    fontSize: 10,
    color: 'rgba(255,255,255,0.35)',
    zIndex: 0,
  },

  streakBadgePill: {
    backgroundColor: 'rgba(201,106,26,0.2)',
    borderRadius: rv(10),
    paddingVertical: rs(3),
    paddingHorizontal: rs(7),
    borderWidth: 1,
    borderColor: 'rgba(201,106,26,0.35)',
  },
  streakBadgePillText: {
    color: '#c96a1a',
    fontSize: rf(11),
    fontWeight: '700',
  },

  // Battle Pass XP bar touchable wrapper
  xpBarTouchable: {
    width: '100%',
  },

  // Mode buttons row (Sit & Go, Battle Pass)
  modeButtonRow: {
    flexDirection: 'row',
    gap: rs(10),
    width: '100%',
    justifyContent: 'center',
  },
  friendsRow: {
    flexDirection: 'row',
    gap: rs(10),
    width: '100%',
    marginTop: rs(-4),
  },
  modeBtn: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    borderRadius: rv(14),
    paddingVertical: rs(12),
    paddingHorizontal: rs(8),
    gap: rs(2),
  },
  modeBtnDisabled: {
    opacity: 0.4,
  },
  modeBtnBlue: {
    borderColor: 'rgba(0,191,255,0.5)',
    backgroundColor: 'rgba(0,191,255,0.1)',
  },
  modeBtnLabelBlue: {
    color: '#00BFFF',
  },
  modeBtnIcon: {
    fontSize: rf(22),
    lineHeight: rf(28),
  },
  modeBtnLabel: {
    color: '#ffffff',
    fontSize: rf(12),
    fontWeight: '700',
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  // S107: Play Online + Stats buttons
  onlineBtn: {
    borderWidth: 1,
    borderColor: '#c9a84c',
    borderRadius: rs(12),
    paddingVertical: rs(10),
    paddingHorizontal: rs(16),
    alignItems: 'center',
    width: '100%',
    marginTop: rs(4),
  },
  onlineBtnText: {
    fontSize: rf(15),
    fontWeight: '700',
    color: '#c9a84c',
  },
  onlineBtnSub: {
    fontSize: rf(10),
    color: 'rgba(255,255,255,0.4)',
    marginTop: rs(2),
  },
  statsBtn: {
    alignSelf: 'center',
    paddingVertical: rs(4),
    paddingHorizontal: rs(12),
  },
  statsBtnText: {
    fontSize: rf(11),
    color: 'rgba(255,255,255,0.35)',
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  sectionLabel: {
    color: 'rgba(255,255,255,0.35)',
    fontSize: rf(10),
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase' as any,
    alignSelf: 'flex-start',
    marginBottom: rs(4),
    marginTop: rs(4),
  },
  modeBtnLabelDisabled: {
    color: 'rgba(255,255,255,0.6)',
  },
  // S116: MP mode tabs
  mpTabsRow: {
    flexDirection: 'row',
    gap: rs(8),
    width: '100%',
    marginBottom: rs(6),
  },
  mpTab: {
    flex: 1,
    paddingVertical: rs(8),
    borderRadius: rv(8),
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
  },
  mpTabActive: {
    backgroundColor: 'rgba(201,168,76,0.15)',
    borderColor: '#c9a84c',
  },
  mpTabText: {
    fontSize: rf(13),
    fontWeight: '600',
    color: 'rgba(255,255,255,0.5)',
  },
  mpTabTextActive: {
    color: '#c9a84c',
    fontWeight: '700',
  },
  comingSoonLabel: {
    color: 'rgba(201,168,76,0.7)',
    fontSize: rf(9),
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase' as any,
    textAlign: 'center',
  },

  // Friend Activity Feed
  feedSection: {
    width: '100%',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: rv(12),
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    padding: rs(10),
    gap: rs(6),
  },
  feedTitle: {
    color: COLORS.gold,
    fontSize: rf(11),
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase' as const,
    marginBottom: rs(2),
  },
  feedEmpty: {
    color: 'rgba(255,255,255,0.35)',
    fontSize: rf(12),
    textAlign: 'center',
    paddingVertical: rs(4),
  },
  feedItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  feedItemText: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: rf(12),
    flex: 1,
  },
  feedItemTime: {
    color: 'rgba(255,255,255,0.3)',
    fontSize: rf(10),
    marginLeft: rs(6),
  },

  // Play of the Day (D10)
  potdCard: {
    width: '100%',
    backgroundColor: 'rgba(201,168,76,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(201,168,76,0.22)',
    borderRadius: rv(12),
    paddingVertical: rs(8),
    paddingHorizontal: rs(14),
    flexDirection: 'column',
    gap: rs(2),
    maxHeight: 80,
  },
  potdTitle: {
    color: '#c9a84c',
    fontSize: rf(11),
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  potdPlayer: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: rf(12),
    fontWeight: '600',
  },
  potdPot: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: rf(11),
    fontWeight: '400',
  },

  // Referral row (D6)
  referralRow: {
    alignItems: 'center',
    gap: rs(6),
  },
  referralCard: {
    backgroundColor: 'rgba(201,168,76,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(201,168,76,0.25)',
    borderRadius: rv(12),
    paddingVertical: rs(8),
    paddingHorizontal: rs(16),
    alignItems: 'center',
    gap: rs(3),
  },
  referralCardLabel: {
    color: 'rgba(255,255,255,0.35)',
    fontSize: rf(9),
    fontWeight: '600' as const,
    letterSpacing: 1.2,
  },
  referralCardCode: {
    color: '#c9a84c',
    fontSize: rf(22),
    fontWeight: '700' as const,
    letterSpacing: 4,
  },
  referralCardButtons: {
    flexDirection: 'row' as const,
    gap: rs(8),
    marginTop: rs(3),
  },
  referralActionBtn: {
    backgroundColor: 'rgba(201,168,76,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(201,168,76,0.3)',
    borderRadius: rv(16),
    paddingVertical: rs(4),
    paddingHorizontal: rs(14),
  },
  referralActionBtnText: {
    color: '#c9a84c',
    fontSize: rf(12),
    fontWeight: '600' as const,
  },
  inviteBtn: {
    backgroundColor: 'rgba(201,168,76,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(201,168,76,0.3)',
    borderRadius: rv(20),
    paddingVertical: rs(8),
    paddingHorizontal: rs(20),
  },
  inviteBtnText: {
    color: '#c9a84c',
    fontSize: rf(13),
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  gotCodeLink: {
    color: 'rgba(255,255,255,0.35)',
    fontSize: rf(11),
    fontWeight: '400',
    textDecorationLine: 'underline',
  },

  // Referral toast (D6)
  referralToast: {
    position: 'absolute',
    bottom: rs(90),
    alignSelf: 'center',
    backgroundColor: 'rgba(34,197,94,0.92)',
    borderRadius: rv(24),
    paddingVertical: rs(10),
    paddingHorizontal: rs(20),
    zIndex: 350,
    maxWidth: '85%' as any,
  },
  referralToastText: {
    color: '#ffffff',
    fontSize: rf(13),
    fontWeight: '600',
    textAlign: 'center',
  },

  // Referral modal (D6)
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.78)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: rs(24),
  },
  modalCard: {
    backgroundColor: '#1C0508',
    borderRadius: rv(18),
    borderWidth: 1,
    borderColor: 'rgba(201,168,76,0.4)',
    padding: rs(26),
    alignItems: 'center',
    gap: rs(10),
    maxWidth: 340,
    width: '100%',
    ...Platform.select({
      ios: { shadowColor: '#c9a84c', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 20 },
      android: { elevation: 12 },
      web: { boxShadow: '0 8px 32px rgba(201,168,76,0.25)' } as any,
    }),
  },
  modalTitle: {
    color: '#c9a84c',
    fontSize: rf(19),
    fontWeight: '800',
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  modalSub: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: rf(13),
    fontWeight: '400',
    textAlign: 'center',
    marginTop: -rs(4),
  },
  codeInput: {
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    borderRadius: rv(12),
    color: '#ffffff',
    fontSize: rf(22),
    fontWeight: '700',
    letterSpacing: 8,
    textAlign: 'center',
    paddingVertical: rs(12),
    paddingHorizontal: rs(16),
    width: '100%',
  },
  redeemBtn: {
    backgroundColor: '#22C55E',
    borderRadius: rv(12),
    paddingVertical: rs(13),
    paddingHorizontal: rs(32),
    alignItems: 'center',
    width: '100%',
    ...Platform.select({
      ios: { shadowColor: '#22C55E', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 12 },
      android: { elevation: 8 },
      web: { boxShadow: '0 4px 16px rgba(34,197,94,0.4)' } as any,
    }),
  },
  redeemBtnText: {
    color: '#ffffff',
    fontSize: rf(15),
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  modalCancelText: {
    color: 'rgba(255,255,255,0.3)',
    fontSize: rf(13),
    fontWeight: '400',
    textDecorationLine: 'underline',
  },
});
