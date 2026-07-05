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
import ReportBugButton from '../../components/ReportBugButton';
import { KILL_HeroParticles, KILL_HeroFan, KILL_HeroGlow } from '../../utils/animationKill';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  withSequence,
  withDelay,
  cancelAnimation,
  interpolate,
  type SharedValue,
} from 'react-native-reanimated';
import CardComponent from '../../components/Card';
import ChipsDisplay from '../../components/ChipsDisplay';
import SideMenu from '../../components/SideMenu';
import { useGameStore } from '../../store/gameStore';
import { COLORS, getBoardCount, Card } from '../../constants/gameConfig';
import { ECONOMY_FLAGS } from '../../constants/economyConfig';
import {
  canClaimDailyReward,
  getNextStreak,
  calculateDailyReward,
  canUseFreeRefill,
  getFreeRefillAmount,
} from '../../utils/economy';
import { CapsHooks } from '../../utils/learning';
import { useAuthUser, signInWithGoogle, signOut } from '../../utils/auth';
import { FriendsBg } from '../../components/FriendsBg';
import InteractiveTutorial, { INTERACTIVE_TUTORIAL_KEY } from '../../components/InteractiveTutorial';
import { rf, rs, rv } from '../../utils/responsive';
import Constants from 'expo-constants';
import { t, getLanguage } from '../../utils/i18n';
import { HOME_THEMES, DEFAULT_HOME_THEME } from '../../constants/homeThemes';
import { migrateGuestToUser } from '../../utils/guestMigration';
import { earnChips, fetchCardDisplayConfig, fetchPokerShop } from '../../utils/supabaseEconomy';
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
import { debugLog } from '../../components/DebugOverlay';
import { StreakPopup } from '../../components/StreakPopup';
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

// ─── Floating suit particles ──────────────────────────────────────────────────
// PR-C: phases are delay/PARTICLE_DRIVER_PERIOD_MS, precomputed once.
const PARTICLE_DRIVER_PERIOD_MS = 14000;
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

// PR-C 2026-05-24: 1 shared value at the screen drives all 15 particles via
// interpolation + phase offset (was 15 per-particle SVs). Same visual drift,
// fits the ≤5-SV/screen safety budget. Phase derived once at module level.
function FloatingParticle({ x, suit, size, opacity, phase, driverT, screenW, screenH }: {
  x: number; suit: string; size: number; opacity: number; phase: number;
  driverT: SharedValue<number>;
  screenW: number; screenH: number;
}) {
  const startY = screenH + 50;
  const endY = -80;
  const animStyle = useAnimatedStyle(() => {
    "worklet";
    const t = (driverT.value + phase) % 1;
    return { transform: [{ translateY: interpolate(t, [0, 1], [startY, endY]) }] };
  });
  return (
    <Animated.Text
      style={[{ position: 'absolute', left: Math.floor(x * screenW), fontSize: size, color: '#c9a84c', opacity }, animStyle]}
      pointerEvents="none"
      accessibilityElementsHidden={true}
      importantForAccessibility="no-hide-descendants"
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

// PR-C 2026-05-24: hero card fan is STATIC per spec. No per-card loop, no
// breathe — the layout itself is the visual. KILL_HeroFan gate kept for
// completeness; setting it to false would be a no-op here (no animations to kill).
function HeroCardFan() {
  if (KILL_HeroFan && false) { /* KILL_HeroFan reserved; static fan has no animations to kill */ }
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', marginTop: 10, marginBottom: 2 }}>
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
    </View>
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
        <Text style={nudgeStyles.title} accessibilityLanguage="he" accessibilityLabel={isHE ? 'התחבר כדי לשמור את הנתונים' : 'Sign in to save your stats'}>
          {isHE ? '🔒 התחבר כדי לשמור את הנתונים' : '🔒 Sign in to save your stats'}
        </Text>
        <Text style={nudgeStyles.sub} accessibilityLanguage="he">
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
            <Text style={nudgeStyles.signInBtnText} accessibilityLanguage="he">
              {isHE ? '🔵 כניסה עם Google' : '🔵 Sign in with Google'}
            </Text>
          </Pressable>
          <Pressable
            onPress={() => dismiss(onLater)}
            accessibilityRole="button"
            accessibilityLabel={isHE ? 'אחר כך' : 'Later'}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={nudgeStyles.laterBtn}
          >
            <Text style={nudgeStyles.laterBtnText} accessibilityLanguage="he">{isHE ? 'אחר כך' : 'Later'}</Text>
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
    color: 'rgba(255,255,255,0.75)',
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
    color: 'rgba(255,255,255,0.7)',
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
    >
      <Text style={toastStyles.text} accessibilityLanguage="he">
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
    <AnimatedRN.View
      style={[dailyRewardModalStyles.overlay, { opacity }]}
      accessibilityViewIsModal={true}
      accessibilityRole="alert"
    >
      <Pressable
        style={StyleSheet.absoluteFillObject}
        onPress={() => dismiss(onDismiss)}
        accessibilityRole="button"
        accessibilityLabel="Close dialog"
      />
      <AnimatedRN.View style={[dailyRewardModalStyles.card, { transform: [{ scale }] }]}>
        <Text style={dailyRewardModalStyles.emoji} accessibilityElementsHidden={true} importantForAccessibility="no-hide-descendants">🎁</Text>
        <Text style={dailyRewardModalStyles.title} accessibilityLanguage="he">
          {isHE ? 'פרס יומי!' : 'Daily Reward!'}
        </Text>
        <Text style={dailyRewardModalStyles.chips}>
          {`+${(reward ?? 0).toLocaleString()} chips`}
        </Text>
        {streak > 1 && (
          <Text style={dailyRewardModalStyles.streak} accessibilityLanguage="he" accessibilityLabel={isHE ? `${streak} ימים ברצף` : `${streak}-day streak!`}>
            {isHE ? `🔥 ${streak} ימים ברצף` : `🔥 ${streak}-day streak!`}
          </Text>
        )}
        <Pressable
          style={dailyRewardModalStyles.claimBtn}
          onPress={() => dismiss(onClaim)}
          accessibilityRole="button"
          accessibilityLabel={isHE ? 'קחו את הפרס' : 'Claim Reward'}
        >
          <Text style={dailyRewardModalStyles.claimBtnText} accessibilityLanguage="he">
            {isHE ? '✅ קחו את הפרס' : '✅ Claim Reward'}
          </Text>
        </Pressable>
        <Pressable
          onPress={() => dismiss(onDismiss)}
          accessibilityRole="button"
          accessibilityLabel={isHE ? 'אחר כך' : 'Later'}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={dailyRewardModalStyles.laterBtn}
        >
          <Text style={dailyRewardModalStyles.laterText} accessibilityLanguage="he">
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
    backgroundColor: '#161922',
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
    color: 'rgba(255,255,255,0.7)',
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
  // (DEDUPE-QA) hasStartedGame + WebLandingHero removed — web lands straight in the app.
  const [signingIn, setSigningIn] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [showInteractiveTutorial, setShowInteractiveTutorial] = useState(false);
  // Bug 3 (PR-G): offer modal must resolve before tutorial can show.
  // StarterOfferModal calls onResolved() when its check completes
  // (eligible+dismissed, or ineligible). Tutorial waits.
  // VAMOS-UNIFY-FINAL — StarterOfferModal removed; the tutorial gate that used
  // to wait for the offer to resolve now opens immediately.
  const [offerResolved, _setOfferResolved] = useState(true); void _setOfferResolved;
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
      // Derive feed from real schema (no phantom columns).
      // 1) My participation rows on finished sessions (finish_position != null = SnG resolved).
      const { data: myRows } = await sb
        .from('sit_and_go_players')
        .select('session_id, finish_position, chips, sit_and_go_sessions(started_at, prize_pool)')
        .eq('device_id', deviceId)
        .not('finish_position', 'is', null)
        .order('joined_at', { ascending: false })
        .limit(5);
      if (!myRows?.length) { setActivityFeed([]); return; }
      // 2) Resolve winner (finish_position=1) per session in one round-trip.
      const sessionIds = myRows.map((r: any) => r.session_id);
      const { data: winners } = await sb
        .from('sit_and_go_players')
        .select('session_id, device_id, chips')
        .in('session_id', sessionIds)
        .eq('finish_position', 1);
      const wmap = new Map((winners ?? []).map((w: any) => [w.session_id, w]));
      setActivityFeed(myRows.map((r: any) => {
        const w = wmap.get(r.session_id) as { device_id: string; chips: number } | undefined;
        const sess = r.sit_and_go_sessions;
        return {
          player_id: deviceId,
          winner_id: w?.device_id ?? null,
          chips_won: r.finish_position === 1 ? (w?.chips ?? sess?.prize_pool ?? null) : null,
          ended_at: sess?.started_at ?? '',
        };
      }) as FeedItem[]);
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

  // PR-C 2026-05-24 b153 restore. 2 shared values for the new layers:
  //   particleDriverT drives all 15 particles via interpolation+phase
  //   glowOpacity drives the PLAY-button halo opacity
  // Both finite (withRepeat(50)). Plus taglineOpacity (1, one-shot above) = 3 SVs total on this screen.
  const particleDriverT = useSharedValue(0);
  const glowOpacity = useSharedValue(0);
  useEffect(() => {
    if (!KILL_HeroParticles) {
      particleDriverT.value = withRepeat(
        withTiming(1, { duration: PARTICLE_DRIVER_PERIOD_MS }),
        50,
        false,
      );
    }
    return () => { cancelAnimation(particleDriverT); };
  }, []);
  useEffect(() => {
    if (!KILL_HeroGlow) {
      glowOpacity.value = withDelay(
        800,
        withRepeat(
          withSequence(
            withTiming(0.7, { duration: 1400 }),
            withTiming(0.15, { duration: 1400 }),
          ),
          50,
          false,
        ),
      );
    }
    return () => { cancelAnimation(glowOpacity); };
  }, []);
  const playGlowStyle = useAnimatedStyle(() => ({ opacity: glowOpacity.value }));

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

  // VAMOS UX-BATCH-2 (Item 3) — QUIET daily bonus state: inline strip acknowledgment
  // (one-shot glow, no overlay). The claim itself runs inside the sequenced wallet
  // bootstrap below (adopt server balance → claim → push), never against the
  // pre-hydration local default.
  const [justClaimed, setJustClaimed] = useState<{ reward: number; streak: number } | null>(null);
  const ackAnim = useRef(new AnimatedRN.Value(0)).current;
  const autoClaimedRef = useRef(false);

  // HOTFIX 2026-07-02 (economy leak) — the ONLY daily-bonus claim path, shared by the
  // bootstrap auto-claim and the manual pill. claim_daily_reward is the single
  // authority: DB once-per-day gate + daily_rewards ledger row as proof of claim.
  // On success the server-computed amount is credited server-side via the ledgered
  // earn_chips (claim_daily_reward gates/ledgers but does not credit leaderboard
  // itself), then the authoritative balance is RE-ADOPTED — no local reward math,
  // no client-wins submitScore push, no earn_chips fallback on already_claimed.
  // The previous cut computed the reward locally and pushed it via submitScore:
  // no ledger row, re-armable by clearing storage, and it clobbered server credits.
  const performServerClaim = useCallback(async (source: 'auto' | 'manual'): Promise<'claimed' | 'already' | 'error' | 'skipped'> => {
    if (!ECONOMY_FLAGS.dailyRewardEnabled) return 'skipped';
    if (source === 'auto' && autoClaimedRef.current) return 'skipped';
    try {
      const deviceId = await getDeviceId();
      const sb = getSupabase();
      if (!sb) return 'error';
      const { data: claim } = await sb.rpc('claim_daily_reward', { p_device_id: deviceId });
      const store = useGameStore.getState();
      const now = new Date();
      if (claim?.success) {
        autoClaimedRef.current = true;
        const reward = Number(claim.chips_earned) || 0;
        const streak = Number(claim.streak) || 1;
        if (reward > 0) await earnChips(deviceId, 'daily_reward', reward);
        try {
          const shop = await fetchPokerShop(deviceId);
          if (shop && typeof shop.balance === 'number') store.setChips(shop.balance);
          else store.addChips(reward);
        } catch { store.addChips(reward); /* offline echo — server already ledgered */ }
        store.trackChipsEarned(reward);
        store.setLastDailyRewardClaim(now.toISOString());
        store.setDailyRewardStreak(streak);
        CapsHooks.dailyRewardClaimed(streak, reward);
        track('daily_bonus_auto_claimed', { reward, streak, source, server_gated: true }, 'home');
        setJustClaimed({ reward, streak });
        AnimatedRN.sequence([
          AnimatedRN.timing(ackAnim, { toValue: 1, duration: 350, useNativeDriver: true }),
          AnimatedRN.timing(ackAnim, { toValue: 0.85, duration: 900, useNativeDriver: true }),
          AnimatedRN.timing(ackAnim, { toValue: 1, duration: 900, useNativeDriver: true }),
        ]).start();
        void scheduleLocal('Daily Reward Ready 🎁', 'Your daily reward is waiting! Open CAPS to claim.', 24 * 60 * 60, 'daily_reward');
        return 'claimed';
      }
      if (claim?.error === 'already_claimed') {
        autoClaimedRef.current = true;
        // Sync local claim state so the fallback pill can't offer a claim the server
        // would refuse (reinstall / cleared storage) — NOTHING is credited or shown.
        if (canClaimDailyReward(store.lastDailyRewardClaim, now)) {
          store.setLastDailyRewardClaim(now.toISOString());
        }
        return 'already';
      }
      return 'error';
    } catch {
      return 'error'; // offline — nothing credited; the pill fallback remains available
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ackAnim]);

  useEffect(() => {
    setCurrentScreen('Home');
    CapsHooks.screenViewed('home');
    track('app_opened', {}, 'home');
    track('home_screen_loaded', {
      build: Constants.expoConfig?.version ?? 'unknown',
      platform: Platform.OS,
    }, 'home');

    // PR-G Bug 2 + VAMOS UX-BATCH-2b — ONE sequenced wallet bootstrap. Order matters:
    // (1) ADOPT the server-authoritative balance. get_poker_shop reads/creates the
    //     leaderboard row (column default 2000 for fresh devices), so the FIRST sync
    //     is server-wins by construction — the local default is never pushed over it.
    // (2) After zustand persist hydration (claim eligibility lives in persisted state),
    //     auto-claim the daily bonus ON TOP of the adopted balance (quiet, inline ack).
    // (3) Claim server-side (claim_daily_reward gate + ledger, credited via the
    //     ledgered earn_chips), then RE-ADOPT — wallet, header, and
    //     leaderboard.total_chips agree on ONE number with no client-wins push.
    // The first UX-BATCH-2 cut ran the claim as its own hydration-gated effect, which
    // raced AHEAD of adoption and pushed localDefault+50 (e.g. 1050) over the server
    // 2000 baseline via submit_score's client-wins upsert.
    void (async () => {
      try {
        const deviceId = await getDeviceId();
        const shop = await fetchPokerShop(deviceId);
        if (shop && typeof shop.balance === 'number') {
          useGameStore.getState().setChips(shop.balance);
        }
      } catch { /* non-blocking — worst case we claim on top of the local wallet */ }

      // (2) wait for persisted state before deciding claim eligibility
      try {
        const persistApi: any = (useGameStore as any).persist;
        if (!persistApi?.hasHydrated?.()) {
          await new Promise<void>((resolve) => {
            const unsub = persistApi?.onFinishHydration?.(() => { try { (unsub as any)?.(); } catch { /* noop */ } resolve(); });
            if (!unsub) resolve();
          });
        }
      } catch { /* best-effort */ }

      // (3) HOTFIX 2026-07-02 — server-gated claim (claim_daily_reward RPC + ledger).
      // Replaces the local reward math + client-wins submitScore push of the first cut.
      await performServerClaim('auto');
    })();

    // HOTFIX 2026-07-02 (economy leak) — the daily_login earn_chips call REMOVED.
    // Its old comment claimed "idempotent — safe every open", but earn_chips has NO
    // dedup (it ledgers + credits leaderboard unconditionally, p_amount DEFAULT 50),
    // so this was +50 per app open for every user. The daily bonus is now the ONLY
    // daily login credit, server-gated via claim_daily_reward in the bootstrap above.

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

    // Interactive tutorial (S98) — THE single first-run onboarding, shown if not yet seen.
    // CI guard: when EXPO_PUBLIC_CAPS_CI=1 (sim auto-tour build), never show the tutorial.
    if (process.env.EXPO_PUBLIC_CAPS_CI !== '1') {
      AsyncStorage.getItem(INTERACTIVE_TUTORIAL_KEY).then(val => {
        if (!val) setShowInteractiveTutorial(true);
      }).catch(() => {});
    }
    Promise.all([
      AsyncStorage.getItem(GAMES_PLAYED_KEY),
      AsyncStorage.getItem(NUDGE_DISMISSED_KEY),
      AsyncStorage.getItem(DAILY_REWARD_POPUP_SESSION_KEY),
    ]).then(([gamesVal, dismissedVal, popupShownVal]) => {
      const played = gamesVal ? parseInt(gamesVal, 10) || 0 : 0;
      setGamesPlayed(played);
      // VAMOS-UNIFY-FINAL 2026-06-28 — sign-in nudge banner + daily-reward popup
      // removed. Reading dismissedVal / popupShownVal preserved so AsyncStorage
      // keys are quiet; the actual surfacing is gone. Daily-reward chips can
      // still be claimed via the explicit handler (handleClaimDailyReward).
      void dismissedVal; void popupShownVal;
    }).catch(() => { setGamesPlayed(0); });

    // (DEDUPE-QA) OnboardingOverlay removed — the InteractiveTutorial above is the single onboarding.

    // VAMOS-UNIFY-FINAL 2026-06-28 — streak popup + Weekly Recap modal removed.
    // The daily-streak chips are still awarded by the RPC; we just don't surface
    // a modal anymore. The RPC call is kept so the streak counter advances on
    // first visit each day (and to populate streakData for non-popup UI like
    // the home-row badge).
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
        } else if (data.already_claimed) {
          setStreakData(data);
        }
      } catch {}
    })();

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
          const raw = Array.isArray(lb) ? lb : (lb.entries ?? []);
          // VAMOS-CAPS-LEADERBOARD-HIDE-BOTS: drop seed bot rows so the home rank
          // widget counts real players only. Recompute position from the filtered,
          // chip-sorted order (the server rank includes bots until the DB cleanup runs).
          const entries = raw.filter((e: any) => !String(e.device_id ?? '').startsWith('bot_'));
          const myEntry = entries.find((e: any) => e.is_me || e.device_id === deviceId);
          if (myEntry) {
            const sorted = [...entries].sort((a: any, b: any) => (b.total_chips ?? 0) - (a.total_chips ?? 0));
            const idx = sorted.findIndex((e: any) => e.is_me || e.device_id === deviceId);
            const rank = idx >= 0 ? idx + 1 : (myEntry.rank ?? myEntry.position ?? null);
            const total = entries.length || (lb.total ?? 0);
            if (rank) setLeaderboardData({ rank: Number(rank), total: Number(total) });
          }
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
      // VAMOS-UNIFY-FINAL — welcome toast removed. The migration still runs;
      // we just don't surface a transient banner after sign-in.
      const displayName = String(user.user_metadata?.full_name ?? playerName).slice(0, 30);
      useGameStore.getState().setPlayerName(displayName);
      migrateGuestToUser(user.id, displayName).catch(() => {});
    } else if (user?.user_metadata?.full_name && !prev) {
      // Already signed in on mount — just update name
      useGameStore.getState().setPlayerName(String(user.user_metadata.full_name).slice(0, 20));
    }
  }, [user?.id]);

  // VAMOS QA-BATCH (Issue B) — apply the first-run beginner default (3P / 3 boards / 12 cards)
  // ONCE on mount, not at Play-tap. Previously handleNewHand force-set 3P when gamesPlayed===0,
  // silently overriding the 2P the player still saw selected (the selector reads config directly,
  // so it showed ✓2P while the dealt game used 3P). Setting it here lets the selector show ✓3P up
  // front and keeps the Play-tap from changing the dealt config underfoot. The GUIDED_FORCED_KEY
  // guard keeps it to the very first run (game.tsx consumes the key to force guided mode).
  useEffect(() => {
    if (gamesPlayed !== 0) return;
    let cancelled = false;
    AsyncStorage.getItem(GUIDED_FORCED_KEY).then((forced) => {
      if (cancelled || forced) return;
      updateConfig({ numberOfPlayers: 3 });
      AsyncStorage.setItem(GUIDED_FORCED_KEY, 'true').catch(() => {});
    }).catch(() => {});
    return () => { cancelled = true; };
    // gamesPlayed starts at the sentinel 99 ("not loaded") and resolves to 0 on first run via
    // the async AsyncStorage load below — depend on it so this fires once it actually resolves
    // to 0, not on the pre-load sentinel (empty deps would capture 99 and skip the default).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gamesPlayed]);

  const handleNewHand = useCallback(() => {
    // The primary Home button is labelled "Practice vs Bots" — so it MUST be practice:
    // zero real chips, no buy-in gate. (Previously it ran the real-chip economy path, which
    // charged a match cost / drained the bankroll on a button that says "practice" — deceptive.)
    // Practice is economy-neutral via the isPractice guard in game.tsx + results.tsx; fresh=1
    // resets the per-session demo counter so each Home-tap starts a clean "this session".
    trackAction('play_pressed');
    track('play_button_tapped', { mode: 'practice', player_count: config.numberOfPlayers }, 'home');
    track('mode_start', { mode: 'practice', player_count: config.numberOfPlayers }, 'home');
    track('game_started', { mode: 'practice', player_count: config.numberOfPlayers }, 'home');
    // Heatmap (D7)
    getDeviceId().then(id => trackEvent('home', 'play_button', id)).catch(() => {});
    // First-run beginner default (3P / guided) is applied ONCE on mount via the GUIDED_FORCED_KEY
    // effect above — not here — so the selector reflects it up front and this tap doesn't change
    // the dealt config underfoot (VAMOS QA-BATCH Issue B).
    router.push(`/game?practice=true&players=${config.numberOfPlayers}&fresh=1` as any);
  }, [config, router]);

  // HOTFIX 2026-07-02 — manual pill fallback routes through the SAME server-gated
  // claim (no local reward math). The strip's inline ack is the success feedback;
  // Alert only covers the native already-claimed edge (it's a no-op on web, where
  // the pill disappears via the synced claim state anyway).
  const handleClaimDailyReward = useCallback(() => {
    void (async () => {
      const outcome = await performServerClaim('manual');
      if (outcome === 'already') {
        Alert.alert('Already Claimed', 'Come back tomorrow for your next reward!');
      }
    })();
  }, [performServerClaim]);

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
    // VAMOS-UNIFY-FINAL — share-COMPLETE banner removed. The 'last_was_complete'
    // flag is still cleared so it doesn't pile up in AsyncStorage.
    AsyncStorage.getItem('last_was_complete').then(val => {
      if (val === 'true') AsyncStorage.removeItem('last_was_complete').catch(() => {});
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
      {/* WebLandingHero removed (DEDUPE-QA) — web users land straight in the app + the one onboarding. */}
      <FriendsBg />

      {/* Floating suit particles — decorative background (PR-C: 1 driver SV + phase) */}
      <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
        {PARTICLE_CONFIG.map((p, i) => (
          <FloatingParticle
            key={i}
            x={p.x}
            suit={p.suit}
            size={p.size}
            opacity={p.opacity}
            phase={(p.delay / PARTICLE_DRIVER_PERIOD_MS) % 1}
            driverT={particleDriverT}
            screenW={screenW}
            screenH={screenH}
          />
        ))}
      </View>
      {isWeb && <View style={styles.gradientOverlay} />}
      {isWeb && <View style={styles.grainOverlay} />}

      {/* Interactive Tutorial (S98) — THE single first-run onboarding (DEDUPE-QA: OnboardingOverlay,
          WelcomeModal and the static Tutorial were removed). 3 steps with real cards; waits for the
          StarterOfferModal (or proceeds immediately for new users at gamesPlayed < 5). On native it
          pushes into /game when done; on web it stays on the home/lobby. */}
      {showInteractiveTutorial && (offerResolved || gamesPlayed < 5) && (
        <InteractiveTutorial onDone={() => {
          setShowInteractiveTutorial(false);
          // Chain the deferred daily-streak popup (previously fired from OnboardingOverlay's onDone).
          if (pendingStreakRef.current && streakData) {
            pendingStreakRef.current = false;
            setShowStreakPopup(true);
          }
          if (!isWeb) router.push('/game' as any);
        }} />
      )}

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
          // Replay the single onboarding (InteractiveTutorial).
          setMenuOpen(false);
          AsyncStorage.removeItem(INTERACTIVE_TUTORIAL_KEY).catch(() => {});
          setTimeout(() => setShowInteractiveTutorial(true), 60);
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
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                style={styles.topChipGetBtn}
              >
                <Text style={styles.topChipGetText}>GET CHIPS</Text>
              </Pressable>
            ) : (
              <Pressable
                onPress={() => router.push('/shop' as any)}
                accessibilityRole="button"
                accessibilityLabel="Open chip shop"
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                style={styles.topChipBtn}
              >
                <Text style={[
                  styles.topChipText,
                  (chips ?? 0) < 100 ? { color: '#F59E0B' } : { color: '#FFFFFF' },
                ]}>🪙 {(chips ?? 0).toLocaleString()}</Text>
              </Pressable>
            )}
            {/* VAMOS-PRE-FRIENDS-QA: decorative floating "+chips" text is absolutely
                positioned OVER the chip-shop button; without pointerEvents:none it
                intercepts taps (even at opacity 0) and the shop button is dead on web. */}
            <AnimatedRN.Text pointerEvents="none" style={[
              styles.chipFloatText,
              { opacity: chipFloatOpacity, transform: [{ translateY: chipFloatY }] },
            ]}>{chipFloatText}</AnimatedRN.Text>
          </View>
          {streakData && streakData.current_streak > 1 && (
            <View style={styles.streakBadgePill}>
              <Text style={styles.streakBadgePillText} accessibilityLabel={`${streakData.current_streak} day streak`}>🔥 {streakData.current_streak}</Text>
            </View>
          )}
          {user?.user_metadata?.avatar_url ? (
            <Pressable
              onPress={() => setMenuOpen(true)}
              accessibilityRole="button"
              accessibilityLabel="Open menu"
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={{ minHeight: 44, minWidth: 44, alignItems: 'center', justifyContent: 'center' }}
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
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={{ minHeight: 44, minWidth: 44, alignItems: 'center', justifyContent: 'center' }}
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
          <Text style={[styles.suitSymbols, { color: theme.accent }]} accessibilityElementsHidden={true} importantForAccessibility="no-hide-descendants">
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
        </View>
        {/* HOME-DECLUTTER 2026-07-05 — removed the daily-quote block + divider, and the
            redundant/false secondary "CAPS · FOUR CARDS. FOUR BOARDS. ONE WINNER." wordmark
            (duplicated the title AND was wrong: only 2P has 4 boards; 3P=3, 4P=2). Kept:
            title, ONE tagline, selector. */}

        {/* Player count selector — 2P / 3P / 4P */}
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 2 }} accessibilityRole="radiogroup" accessibilityLabel="Number of players">
          {([2, 3, 4] as const).map(n => (
            <Pressable
              key={n}
              onPress={() => updateConfig({ numberOfPlayers: n })}
              accessibilityRole="radio"
              accessibilityState={{ checked: config.numberOfPlayers === n }}
              aria-checked={config.numberOfPlayers === n}
              accessibilityLabel={`${n} players`}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={{
                paddingHorizontal: 16, paddingVertical: 8,
                borderRadius: 20,
                backgroundColor: config.numberOfPlayers === n ? '#161922' : 'transparent',
                borderWidth: 1,
                borderColor: config.numberOfPlayers === n ? '#8B6914' : 'rgba(255,255,255,0.18)',
              }}
            >
              <Text style={{ color: config.numberOfPlayers === n ? '#fff' : 'rgba(255,255,255,0.75)', fontSize: rs(14), fontWeight: '700' }}>
                {config.numberOfPlayers === n ? '✓ ' : ''}{n}P
              </Text>
            </Pressable>
          ))}
        </View>
        {/* HOME-DECLUTTER — removed the "N boards · Omaha · Best hand wins each" line under
            the selector; it near-duplicates the dynamic meta line under Play (kept). */}

        {/* HOME-DECLUTTER 2026-07-05 — removed the hardcoded "32 players online" line.
            It was fake (real presence ~2 now / 9 today) and deceptive: "32 online" → empty
            lobby destroys trust in every number in the app. Restore a REAL presence count
            when there's actual concurrency (do not surface a live "2 online" — reads dead). */}

        {/* PLAY button — always green, center stage. PR-C glow halo behind it. */}
        <View style={styles.playSection}>
          <View style={{ position: 'relative', alignSelf: 'center' }}>
            <Animated.View
              pointerEvents="none"
              style={[
                styles.playGlowHalo,
                { width: playBtnWidth + rs(28) },
                playGlowStyle,
              ]}
            />
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
                {/* SHIP-BATCH-1 — label rename only (behavior unchanged): the primary
                    button is a solo game vs bots, so name it honestly. */}
                <Text style={styles.playBtnText} numberOfLines={1} adjustsFontSizeToFit>🤖 Practice vs Bots</Text>
              </Pressable>
            </AnimatedRN.View>
          </View>

          {/* Board config hint — English only (S112) */}
          <Text style={[styles.playSubtext, { color: theme.subtitleColor }]}>
            {getBoardCount(config.numberOfPlayers)} boards · {config.numberOfPlayers} players
            {config.potPerBoard > 0 ? ` · ${config.potPerBoard <= 25 ? 'Low' : config.potPerBoard <= 100 ? 'Mid' : 'High'} Blinds · ${config.potPerBoard}/board` : ' · Free'}
          </Text>
        </View>

        {/* HOME-MP-LINK — prominent multiplayer entry (owner asked twice). The lobby was
            only reachable via the bottom tab; make MP discoverable from the first screen. */}
        <Pressable
          style={styles.playOnlineBtn}
          onPress={() => { track('home_play_online_tapped', {}, 'home'); router.push('/lobby' as any); }}
          accessibilityRole="button"
          accessibilityLabel="Play online, open the multiplayer lobby"
        >
          <Text style={styles.playOnlineEmoji}>🎮</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.playOnlineTitle}>Play Online</Text>
            <Text style={styles.playOnlineSub}>Multiplayer lobby · real players & instant bot tables</Text>
          </View>
          <Text style={styles.playOnlineGo}>›</Text>
        </Pressable>

        {/* HOME-DECLUTTER — "Welcome to CAPS Poker! Tap Play to start" card removed:
            redundant now that onboarding + the clear Play button + Play Online CTA exist. */}

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
            accessibilityLabel="Challenge a Friend"
          >
            <Text style={{ color: '#FFD700', fontSize: rf(15), fontWeight: '600' }}>Challenge a Friend</Text>
            <Text style={{ color: '#A5D6A7', fontSize: rf(11), marginTop: rs(2) }}>Send a poker challenge to a friend</Text>
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
                  <Text style={{ fontSize: rf(16) }} accessibilityElementsHidden={true} importantForAccessibility="no-hide-descendants">🏆</Text>
                </View>
              ))}
            </View>
            <Text style={{ textAlign: 'center', fontSize: rf(11), color: '#A5D6A7' }}>
              {cupData.earned}/{cupData.total} cups
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

        {/* Daily reward — quiet auto-claim acknowledgment (Item 3), else prominent
            pill when claimable (fallback if auto-claim was gated), streak info otherwise */}
        {justClaimed ? (
          <AnimatedRN.View style={{ opacity: ackAnim }} accessibilityLiveRegion="polite" testID="daily-claimed-ack">
            <View style={[styles.dailyPill, styles.dailyPillClaim]}>
              <Text style={styles.dailyPillText}>✅ +{justClaimed.reward} claimed · Day {justClaimed.streak} streak</Text>
            </View>
          </AnimatedRN.View>
        ) : canClaim ? (
          <AnimatedRN.View style={{ transform: [{ scale: dailyPulseAnim }] }}>
            <Pressable
              onPress={handleClaimDailyReward}
              accessibilityRole="button"
              accessibilityLabel="Claim daily bonus"
              style={[styles.dailyPill, styles.dailyPillClaim]}
            >
              {dailyRewardStreak >= 6 ? (
                <Text style={styles.dailyPillText}>🔥 Day {dailyRewardStreak + 1} streak! +500 chips!</Text>
              ) : (
                <Text style={styles.dailyPillText}>🎁 Claim daily bonus · Day {dailyRewardStreak + 1}</Text>
              )}
            </Pressable>
          </AnimatedRN.View>
        ) : dailyRewardStreak >= 1 ? (
          <View style={styles.dailyStreakInfo}>
            {(() => {
              const nextStreak = dailyRewardStreak + 1;
              const nextReward = calculateDailyReward(nextStreak);
              const isMilestone = nextStreak === 7 || nextStreak === 30;
              const milestoneLabel = nextStreak === 30 ? ' (Monthly bonus!)' : nextStreak === 7 ? ' (Weekly bonus!)' : '';
              return (
                <Text style={styles.dailyStreakInfoText} accessibilityLabel={`Day ${dailyRewardStreak} streak! Tomorrow: +${nextReward} chips${milestoneLabel}`}>
                  {`🔥 Day ${dailyRewardStreak} streak! Tomorrow: +${nextReward} chips${milestoneLabel}`}
                </Text>
              );
            })()}
          </View>
        ) : null}

        {/* Win streak — beginner+ only */}
        {show_streak && currentWinStreak >= 2 && (
          <View style={styles.homeStreakRow}>
            <Text style={styles.homeStreakText} accessibilityLabel={`${currentWinStreak} wins in a row`}>🔥 {currentWinStreak} win streak</Text>
            {bestWinStreak > currentWinStreak && (
              <Text style={styles.homeStreakBest}> · Best: {bestWinStreak}</Text>
            )}
          </View>
        )}

        {/* Play of the Day card (D10) — only shown when player name is known */}
        {potd?.available && potd.data && potd.player && potd.player !== 'Anonymous' && (
          <View style={styles.potdCard}>
            <Text style={styles.potdTitle} accessibilityRole="header" accessibilityLabel="Play of the Day">🏆 Play of the Day</Text>
            <Text style={styles.potdPlayer} numberOfLines={1}>
              {potd.player} · {potd.data.hand_name ?? 'Winning hand'}
            </Text>
            {(potd.data.pot_won ?? 0) > 0 && <Text style={styles.potdPot} accessibilityLabel={`Pot: ${(potd.data.pot_won ?? 0).toLocaleString()} chips`}>Pot: {(potd.data.pot_won ?? 0).toLocaleString()} 💰</Text>}
          </View>
        )}

        {/* Quick Poker / Sit&Go mode row removed — Phase 3 (Play = Single Player + Multiplayer Lobby) */}

        {/* 📊 Stats — active+ only */}
        {show_stats && totalHandCount > 0 && (
          <Pressable
            onPress={() => router.push('/hand-history' as any)}
            accessibilityRole="button"
            accessibilityLabel={`Hand history, ${totalHandCount} hands played`}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={styles.statsBtn}
          >
            <Text style={styles.statsBtnText}>📊 {totalHandCount} hands played</Text>
          </Pressable>
        )}

        {/* Online/WiFi multiplayer moved to Settings screen (Task 4) */}

        {/* Data cards — active+ only */}
        {show_stats && (
          <View style={{ flexDirection: 'row', gap: 8, width: '100%', marginTop: 4 }}>
            <Pressable
              onPress={() => router.push('/achievements' as any)}
              accessibilityRole="button"
              accessibilityLabel="My Progress"
              style={homeDataCardStyles.card}
            >
              <Text style={homeDataCardStyles.label}>My Progress</Text>
              <Text style={homeDataCardStyles.value}>{unlockedAchievements.length}/{ACHIEVEMENTS.length}</Text>
              <Text style={homeDataCardStyles.sub}>Achievements · {handsPlayed > 0 ? `${Math.round(handsWon / handsPlayed * 100)}%` : '—'} win rate</Text>
            </Pressable>
            <Pressable
              onPress={() => router.push('/missions' as any)}
              accessibilityRole="button"
              accessibilityLabel="Competition"
              style={homeDataCardStyles.card}
            >
              <Text style={homeDataCardStyles.label}>Competition</Text>
              <Text style={homeDataCardStyles.value}>{missionData ? `${missionData.progress}/${missionData.total}` : '—'}</Text>
              <Text style={homeDataCardStyles.sub}>Missions · {leaderboardData && leaderboardData.rank > 0 ? `#${leaderboardData.rank} Rank` : 'Play to be ranked'}</Text>
            </Pressable>
          </View>
        )}

        {/* Activity Feed + Recent Hands — veteran only */}
        {show_veteran && (
          <View style={styles.feedSection}>
            <Text style={styles.feedTitle} accessibilityRole="header" accessibilityLabel="Recent wins">🏆 Recent Wins</Text>
            {activityFeed.length === 0 ? (
              <Text style={styles.feedEmpty}>Play Sit and Go to see your history</Text>
            ) : (
              activityFeed.map((item, i) => {
                const won = item.winner_id === item.player_id;
                return (
                  <View key={i} style={styles.feedItem}>
                    <Text style={styles.feedItemText} accessibilityLabel={won ? `You won Sit and Go — +${item.chips_won ?? 0} chips` : `Sit and Go — next time`}>
                      {won
                        ? `✅ Won Sit and Go — +${item.chips_won ?? 0} 💰`
                        : `❌ Sit and Go — next time`}
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
            <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: rs(11), fontWeight: '700', letterSpacing: 1, marginBottom: 6, textTransform: 'uppercase' }}>Recent Hands</Text>
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
                  accessibilityLabel="View hand history"
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 7, borderBottomWidth: i < recentHands.length - 1 ? 1 : 0, borderBottomColor: 'rgba(255,255,255,0.07)' }}
                >
                  <Text style={{ color: boardsWon > hand.boardCount / 2 ? '#4CAF50' : '#EF5350', fontSize: rs(13), fontWeight: '700' }}>
                    {boardsWon}/{hand.boardCount} boards
                  </Text>
                  <Text style={{ color: 'rgba(255,255,255,0.75)', fontSize: rs(12) }}>{effPct}% eff</Text>
                  <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: rs(11) }}>{timeStr}</Text>
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
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  style={styles.referralActionBtn}
                >
                  <Text style={styles.referralActionBtnText}>📋 Copy</Text>
                </Pressable>
                <Pressable
                  onPress={handleInviteFriends}
                  accessibilityRole="button"
                  accessibilityLabel="Share referral code"
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
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
              accessibilityLabel="Invite friends"
              style={styles.inviteBtn}
            >
              <Text style={styles.inviteBtnText}>Invite Friends 🎁</Text>
            </Pressable>
          )}
          {/* HOME-DECLUTTER — "Got an invite code?" removed so Home has ONE invite affordance
              ("Invite Friends 🎁"). Full invite + redeem lives on /referral (Play tab). */}
        </View>

        <Text style={{
          color: '#aaa',
          fontSize: 10,
          textAlign: 'center',
          marginTop: 24,
          marginBottom: 8,
        }}>
          {"Free play | Virtual chips only | No real-money gambling | 17+"}
        </Text>

      </View>

      {/* Referral toast (D6) */}
      {referralToast && (
        <AnimatedRN.View
          style={styles.referralToast}
          pointerEvents="none"
          accessibilityLiveRegion="polite"
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
            accessibilityRole="none"
            accessibilityLabel="Invite code dialog"
          >
            <Text style={styles.modalTitle} accessibilityRole="header" accessibilityLabel="Enter Invite Code">🎁 Enter Invite Code</Text>
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
            <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 11, alignSelf: 'flex-end', marginTop: -4 }}>
              {referralCodeInput.length}/6 characters
            </Text>
            <Pressable
              style={[styles.redeemBtn, referralSubmitting && { opacity: 0.6 }]}
              onPress={handleRedeemCode}
              accessibilityRole="button"
              accessibilityLabel="Redeem invite code for 100 chips"
              accessibilityState={{ disabled: referralSubmitting, busy: referralSubmitting }}
              disabled={referralSubmitting}
            >
              <Text style={styles.redeemBtnText}>{referralSubmitting ? 'Checking...' : 'Redeem +100 💰'}</Text>
            </Pressable>
            <Pressable
              onPress={() => setShowReferralModal(false)}
              accessibilityRole="button"
              accessibilityLabel="Cancel"
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
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

      {/* OnboardingOverlay removed (DEDUPE-QA) — InteractiveTutorial is the single onboarding. */}
      {showStreakPopup && streakData && (
        <StreakPopup
          streak={streakData.current_streak}
          reward={streakData.reward}
          nextReward={streakData.next_reward}
          milestones={streakData.milestones as any}
          onCollect={() => setShowStreakPopup(false)}
        />
      )}
      {/* VAMOS-UNIFY-FINAL 2026-06-28 — LevelUpModal, WeeklyRecapModal, and the
          StarterOfferModal removed per "no in-app popups". Tutorial gate now
          resolves immediately so a new user heads straight into onboarding. */}
      {/* PRE-TESTER — discoverable floating "Report a bug" affordance (Settings has a row too). */}
      <ReportBugButton variant="fab" />
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
    color: 'rgba(255,255,255,0.7)',
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
    color: 'rgba(255,255,255,0.75)',
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

  // VAMOS-LOBBY-MENU-CARDS-V1 2026-06-21 — removed zIndex:10 (was masking an
  // overlap, not preventing it) and gave topBar an explicit minHeight + a real
  // bottom margin so the promo header below it sits cleanly inside its own
  // box. The flex column under SafeAreaView is what actually keeps the two
  // sections separate; the zIndex was a band-aid.
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: rs(16),
    paddingTop: rs(8),
    paddingBottom: rs(4),
    minHeight: rs(52),
    marginBottom: rs(4),
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
    color: 'rgba(255,149,0,0.9)',
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
  // VAMOS-LOBBY-MENU-CARDS-V1 2026-06-21 — justifyContent flex-start so the
  // promo header sits BELOW the top bar instead of being vertically centered
  // (which on tall screens crept upward into the top bar area). Light
  // de-clutter: extra paddingTop reads as breathing room without changing
  // the spacing between sections (gap already controls that).
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingHorizontal: rs(20),
    paddingTop: rs(8),
    gap: rs(16),
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
  // PR-C: green glow halo behind the PLAY button. Sized via inline width prop
  // so it tracks the button. Stays under the press-scale wrapper (zIndex -1
  // would be unreliable on RN-Web; sibling-before render order does the trick).
  playGlowHalo: {
    position: 'absolute',
    alignSelf: 'center',
    top: rs(-8),
    left: rs(-14),
    bottom: rs(-8),
    borderRadius: rv(28),
    backgroundColor: '#22C55E',
    opacity: 0,
    ...Platform.select({
      web: { filter: 'blur(18px)' } as any,
      ios: { shadowColor: '#22C55E', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 1, shadowRadius: 24 },
      android: { elevation: 0 },
    }),
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
    fontSize: rf(22),
    fontWeight: '900',
    letterSpacing: 1.5,
    textAlign: 'center',
  },
  playSubtext: {
    fontSize: rf(12),
    fontWeight: '500',
    letterSpacing: 0.5,
    opacity: 0.9,
    textAlign: 'center',
  },
  // HOME-MP-LINK — mint accent so it reads as a distinct primary path next to the green Play
  playOnlineBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: rs(12),
    marginHorizontal: rs(16),
    marginTop: rs(10),
    paddingVertical: rs(13),
    paddingHorizontal: rs(16),
    borderRadius: rv(14),
    borderWidth: 1.5,
    borderColor: '#4FD6A8',
    backgroundColor: 'rgba(79,214,168,0.12)',
  },
  playOnlineEmoji: { fontSize: rf(24) },
  playOnlineTitle: { color: '#4FD6A8', fontSize: rf(16), fontWeight: '900', letterSpacing: 0.5 },
  playOnlineSub: { color: 'rgba(255,255,255,0.7)', fontSize: rf(11), marginTop: rs(1) },
  playOnlineGo: { color: '#4FD6A8', fontSize: rf(24), fontWeight: '900' },
  stakesLabel: {
    fontSize: rf(11),
    fontWeight: '500',
    color: '#bbb',
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
    color: 'rgba(232,201,106,0.9)',
    fontSize: rf(11),
    fontWeight: '600',
  },
  dailyStreakInfo: {
    paddingVertical: rs(4),
    paddingHorizontal: rs(14),
  },
  dailyStreakInfoText: {
    color: 'rgba(255,149,0,0.9)',
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
    color: 'rgba(255,255,255,0.7)',
    marginTop: rs(2),
  },
  statsBtn: {
    alignSelf: 'center',
    paddingVertical: rs(4),
    paddingHorizontal: rs(12),
  },
  statsBtnText: {
    fontSize: rf(11),
    color: 'rgba(255,255,255,0.7)',
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  sectionLabel: {
    color: 'rgba(255,255,255,0.7)',
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
    color: 'rgba(255,255,255,0.75)',
  },
  mpTabTextActive: {
    color: '#c9a84c',
    fontWeight: '700',
  },
  comingSoonLabel: {
    color: 'rgba(201,168,76,0.9)',
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
    color: 'rgba(255,255,255,0.7)',
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
    color: 'rgba(255,255,255,0.7)',
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
    color: 'rgba(255,255,255,0.75)',
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
    color: 'rgba(255,255,255,0.7)',
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
    color: 'rgba(255,255,255,0.7)',
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
    backgroundColor: '#161922',
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
    color: 'rgba(255,255,255,0.75)',
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
    color: 'rgba(255,255,255,0.7)',
    fontSize: rf(13),
    fontWeight: '400',
    textDecorationLine: 'underline',
  },
});
