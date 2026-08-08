import React, { useEffect, useState, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, Platform, useWindowDimensions, Alert, Pressable, Animated, TouchableOpacity, Share } from 'react-native';
// ZERO Reanimated on results screen — game.tsx has 7 active shared values during transition
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '../components/Button';
import { DealMeInButton } from '../components/DealMeInButton';
import { BoardResultCard } from '../components/BoardResultCard';
import { CompleteBanner } from '../components/CompleteBanner';
import CompleteOverlay from '../components/CompleteOverlay';
import { ShareSection } from '../components/ShareSection';
import { EfficiencyCard } from '../components/EfficiencyCard';
import ChipsDisplay from '../components/ChipsDisplay';
import { FriendsBg } from '../components/FriendsBg';
import { useResultsAnimations } from '../hooks/useResultsAnimations';
import { useGameStore } from '../store/gameStore';
import { RevealData } from '../types/gameTypes';
import { isLocalComplete, isOpponentComplete } from '../utils/resultsGating';
import { applyDevRevealFixture } from '../utils/devRevealFixture';
import { getSpecificHandName } from '../utils/handNames';
import { COLORS } from '../constants/gameConfig';
import { getTheme } from '../constants/visualThemes';
import { CardsDealtPayload } from '../constants/networkConfig';
import { submitScore } from '../utils/leaderboard';
import { WEB_MAX_WIDTH } from '../components/WebContainer';
import { useGameColors } from '../utils/useGameColors';
import { WAITING_STATE_TIMEOUT_MS } from '../utils/realtimeMultiplayer';
import { getMatchCost, canAffordMatch } from '../utils/economy';
import { CapsHooks } from '../utils/learning';
import { saveHandToHistory, getHandHistory, HandRecord, HandBoardRecord } from '../utils/handHistory';
import { saveHandForWebReplay, ShareData } from '../utils/shareHand';
import { rf, rs, rb, rv } from '../utils/responsive';
import { t, getLanguage } from '../utils/i18n';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { checkAchievements, getAchievement, Achievement } from '../utils/achievements';
import { playSound } from '../utils/sounds';
import AchievementToast from '../components/AchievementToast';
import { clearGameActive } from '../utils/dirtyShutdown';
import { getSupabase } from '../utils/supabase';
import { shouldPromptLogin } from '../utils/auth';
import LoginPromptModal from '../components/LoginPromptModal';
import { debugLog } from '../components/DebugOverlay';
import { claimShareReward, earnChips, recordHandNet, recordReward } from '../utils/supabaseEconomy';
import { track } from '../utils/analytics';
import { getDeviceId } from '../utils/leaderboard';
import { FloatingChips } from '../components/FloatingChips';
// @ts-ignore — parallel agent file, exists at deploy time
import { useBattlePassStore } from '../stores/battlePassStore';
// @ts-ignore — parallel agent file, exists at deploy time
import { BATTLE_PASS_CONFIG } from '../constants/battlePassConfig';
// @ts-ignore — parallel agent file, exists at deploy time
import { getProgressToNextTier } from '../utils/battlePass';
// @ts-ignore — parallel agent file, exists at deploy time
import XPBar from '../components/XPBar';
import PracticeLiveOverlay from '../components/PracticeLiveOverlay';
import { isPracticeLiveActive } from '../utils/practiceLiveSession';

const SUIT_SYM: Record<string, string> = { hearts: '♥', diamonds: '♦', clubs: '♣', spades: '♠' };

// VAMOS-FIX-RESULTS-FREEZE 2026-06-17 — getEfficiencyHint was a nested 4-loop
// (O(N²M² × evaluateOmahaHand) ≈ 192 hand evals for bc=2) and produced a single
// 1.34s main-thread freeze on device under 6× CPU throttle, after the screen
// painted. The hint itself is non-essential ("Moving X♥ from Board 1 → 2 would
// improve by N%"). Dropped entirely. EfficiencyCard (line ~931) is unrelated
// and stays. Restore the hint only as a chunked / lazy-on-tap computation.

// VAMOS-FIX-RESULTS-TRANSITION 2026-06-17 — removed bug_reports breadcrumb insert
// (was firing 400s per mount; from a past crash investigation, no longer needed).

let Haptics: any = null;
try { Haptics = require('expo-haptics'); } catch {}

// VAMOS-COMPLETE-ON-LOSS / hooks-fix 2026-06-22 — the loading gate lives in this thin
// outer component with NO hooks after the early return. All of ResultsContent's hooks run
// unconditionally because revealData is a guaranteed-non-null prop. This removes the
// pre-existing Rules-of-Hooks violation (early return used to sit before two useMemos),
// a real "Rendered fewer hooks than expected" source when revealData flipped to null.
export default function ResultsScreen() {
  // AUDIT B — DEV/PROBE-ONLY fixture substitution, so the celebration gate can be tested on
  // cases the dealer will not reliably deal. Identity function in the shipped bundle: both of
  // its guards (`__DEV__`, and an EXPO_PUBLIC_ var never set in CI) are false there. This
  // swaps the INPUT the gate reads — it does not touch the gate. See utils/devRevealFixture.ts.
  const revealData = applyDevRevealFixture(useGameStore((s) => s.revealData));
  const visualTheme = useGameStore((s) => s.visualTheme);
  if (!revealData) {
    const theme = getTheme(visualTheme);
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={styles.loadingContainer} accessibilityLiveRegion="polite"><Text style={styles.loadingText}>Loading...</Text></View>
      </SafeAreaView>
    );
  }
  return <ResultsContent revealData={revealData} />;
}

function ResultsContent({ revealData }: { revealData: RevealData }) {
  const router = useRouter();
  const { autoSim, autoSimCount, currentSimHand } = useLocalSearchParams<{ autoSim?: string; autoSimCount?: string; currentSimHand?: string }>();
  const { width: rawW } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const SCREEN_W = Platform.OS === 'web' ? Math.min(rawW, WEB_MAX_WIDTH) : rawW;
  const visualTheme = useGameStore((s) => s.visualTheme);
  const theme = getTheme(visualTheme);
  // A5 AUDIT — colorblind mode had only THREE consumers (Board, BoardReveal, HandNameOverlay) and
  // this screen — the one that actually announces the outcome — was not among them. The headline,
  // the score pair and the per-board marks were hardcoded green/red, so a player who switched the
  // mode on still met green/red at the moment the result is delivered. The palette swap reaches
  // here now.
  const gameColors = useGameColors();
  const chips = useGameStore((s) => s.chips);
  const practiceSessionNet = useGameStore((s) => s.practiceSessionNet);
  const config = useGameStore((s) => s.config);
  const clearRevealData = useGameStore((s) => s.clearRevealData);
  const incrementHandsPlayed = useGameStore((s) => s.incrementHandsPlayed);
  const incrementHandsWon = useGameStore((s) => s.incrementHandsWon);
  const updateBestChips = useGameStore((s) => s.updateBestChips);
  const updateBiggestWin = useGameStore((s) => s.updateBiggestWin);
  const mpServer = useGameStore((s) => s.mpServer);
  const mpClient = useGameStore((s) => s.mpClient);
  const connectedPlayers = useGameStore((s) => s.connectedPlayers);
  const storeRoomCode = useGameStore((s) => s.roomCode);
  const storeOpponentName = useGameStore((s) => s.opponentName);
  const multiplayerMode = useGameStore((s) => s.multiplayerMode);
  const isMultiplayer = mpServer !== null || mpClient !== null;
  const isMpHost = multiplayerMode === 'host';

  const updateConfig = useGameStore((s) => s.updateConfig);
  const handsPlayed = useGameStore((s) => s.handsPlayed);
  const handsWon = useGameStore((s) => s.handsWon);
  const currentWinStreak = useGameStore((s) => s.currentWinStreak);
  const bestWinStreak = useGameStore((s) => s.bestWinStreak);
  const dailyRewardStreak = useGameStore((s) => s.dailyRewardStreak);
  const unlockedAchievements = useGameStore((s) => s.unlockedAchievements);
  const [showLoginPrompt, setShowLoginPrompt] = useState(false);
  const [savedHandId, setSavedHandId] = useState<string | null>(null);
  const [xpGained, setXpGained] = useState(0);
  const [pendingAchievements, setPendingAchievements] = useState<Achievement[]>([]);
  const [autoShareUrl, setAutoShareUrl] = useState<string | null>(null);
  const [autoShareId, setAutoShareId] = useState<string | null>(null);
  const [waitingForNextHand, setWaitingForNextHand] = useState(false);
  const [disconnectMessage, setDisconnectMessage] = useState<string | null>(null);
  const [showUpgradeNudge, setShowUpgradeNudge] = useState(false);
  const scrollRef = useRef<any>(null);
  const waitingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // VAMOS-FIX-REVEAL-TIMING-FULL 2026-06-17 — auto-continue countdown removed.
  // The results screen must NOT auto-dismiss; it stays until the user taps
  // DEAL ME IN or HOME. (Was: 20s → 5s → now gone entirely.)

  // Win celebration overlay (FIX 3)
  const [showWinOverlay, setShowWinOverlay] = useState(false);


  // S108: Floating chip delta animation
  const [showFloatingChips, setShowFloatingChips] = useState(false);

  // S115: session stats (last 3h)
  const [sessionHistory, setSessionHistory] = useState<HandRecord[]>([]);

  // Economy earn-chips floating toast
  const [earnToast, setEarnToast] = useState<string | null>(null);
  const [eloChange, setEloChange] = useState(0);
  const earnToastOpacity = useRef(new Animated.Value(0)).current;
  const showEarnToast = (msg: string) => {
    setEarnToast(msg);
    earnToastOpacity.setValue(0);
    Animated.sequence([
      Animated.timing(earnToastOpacity, { toValue: 1, duration: 250, useNativeDriver: true }),
      Animated.delay(1400),
      Animated.timing(earnToastOpacity, { toValue: 0, duration: 350, useNativeDriver: true }),
    ]).start(() => setEarnToast(null));
  };
  const winOverlayOpacity = useRef(new Animated.Value(0)).current;
  const winOverlayScale = useRef(new Animated.Value(0.7)).current;
  // ECON-SW-P1 (S59) — idempotency guard: record_hand_net is a DELTA, so it must fire
  // EXACTLY ONCE per hand. The persistence effect below has [] deps (single run per mount)
  // and results mounts once per hand, but this ref makes a double-fire (StrictMode / any
  // future effect re-run) structurally impossible.
  const handNetPersistedRef = useRef(false);
  // Colored dots for win animation (RN Animated only — no confetti library, Hermes-safe)
  const WIN_DOT_COLORS = ['#FFD700', '#4CAF50', '#00BFFF', '#FF6B6B', '#c9a84c', '#39FF14', '#FF69B4', '#FFD700'];
  // CK2 / E1 — Roye: "קונפטי/חלקיקים כבר יורים... אבל עדינים מדי. להגביר." Measured baseline:
  // 8 dots, 12x12px, 80-140px across a full 360 degrees, 600ms. Eight dots over 360 degrees is
  // ONE PER 45 DEGREES - a scatter, not a burst - and 600ms is gone before the eye settles. So
  // the deficient dimensions are COUNT and DURATION. Size (12px) and opacity were already fine
  // and are left alone; raising everything at once is how you get a stutter and learn nothing.
  //
  // DELIBERATELY NOT MAXIMISED, and this is the E1<->E2 interaction: the loss moment (E2) is
  // still a flat static red. Every notch added here widens the gap between winning and losing
  // on the same screen, which IS the E3 contradiction. 20 reads as a real celebration; 60 would
  // read as a slot machine and would make the untouched loss feel worse by contrast.
  const WIN_DOT_COUNT = 20;
  const winDotAnims = useRef<{ x: Animated.Value; y: Animated.Value; opacity: Animated.Value }[]>(
    Array.from({ length: WIN_DOT_COUNT }, () => ({
      x: new Animated.Value(0),
      y: new Animated.Value(0),
      opacity: new Animated.Value(0),
    }))
  ).current;

  const {
    screenOpacity, glowAnim, completeScale, dealBtnOpacity, dealBtnScale,
    winBadgeAnim, chipsFlashAnim, boardTranslates, visibleBoardCount, displayChips,
    completeFlashOpacity, completeTitleScale, chipTranslates, showCompleteOverlay,
  } = useResultsAnimations(revealData);

  // CompleteOverlay particle burst (S81)
  const [completeOverlayDone, setCompleteOverlayDone] = useState(false);
  const CARD_W = Math.min(Platform.OS === 'web' ? 56 : 36, Math.max(24, Math.floor((SCREEN_W - 56) / 6.5)));
  const CARD_H = Math.round(CARD_W * 1.4);
  // S115: community cards 15% bigger, bot cards 10% smaller
  const COMM_CARD_W = Math.round(CARD_W * 1.15);
  const COMM_CARD_H = Math.round(CARD_H * 1.15);
  const BOT_CARD_W = Math.round(CARD_W * 0.9);
  const BOT_CARD_H = Math.round(CARD_H * 0.9);

  // Mount: debug logging + dirty shutdown cleanup
  useEffect(() => {
    debugLog('R1 results.tsx mounted');
    debugLog(`R2 revealData: ${revealData ? `boards=${revealData.boards.length} isComplete=${revealData.isComplete}` : 'NULL'}`);
    return () => { void clearGameActive(); };
  }, []);

  // Auto-sim marathon
  useEffect(() => {
    if (autoSim !== 'true') return;
    const total = parseInt(autoSimCount ?? '1', 10);
    const current = parseInt(currentSimHand ?? '1', 10);
    if (current < total) {
      const t = setTimeout(() => {
        router.replace(`/game?autoSim=true&autoSimCount=${total}&currentSimHand=${current + 1}` as any);
      }, 2000);
      return () => clearTimeout(t);
    }
  }, [autoSim]);

  // Guard: no data → go home
  useEffect(() => {
    if (!revealData) router.replace('/');
  }, [revealData, router]);

  // S108: Floating chip delta — show after 1.5s
  useEffect(() => {
    if (!revealData || revealData.netChips === 0) return;
    const timer = setTimeout(() => setShowFloatingChips(true), 1500);
    return () => clearTimeout(timer);
  }, [revealData]);

  // S115: Load hand history for session stats
  useEffect(() => {
    getHandHistory().then((h) => {
      const sessionStart = Date.now() - 3 * 60 * 60 * 1000;
      setSessionHistory(h.filter((r) => r.timestamp > sessionStart));
    }).catch(() => {});
  }, []);

  // Stats tracking + auto-save
  useEffect(() => {
    if (!revealData) return;
    incrementHandsPlayed();
    updateBestChips();
    if (revealData.netChips > 0) {
      incrementHandsWon();
      updateBiggestWin(revealData.netChips);
      // Win sound — delayed slightly so it plays after screen fade-in
      setTimeout(() => { void playSound('chipsWin'); }, 500);
    } else if (revealData.netChips < 0) {
      setTimeout(() => { void playSound('lose'); }, 500);
    }
    // Complete sound — VAMOS-COMPLETE-ON-LOSS 2026-06-21: only when the LOCAL player
    // swept every board (isComplete is true for EITHER player's sweep). Previously the
    // celebratory 'complete' sound + bonus hook fired even when the opponent swept (a loss).
    // LOBBY-BOT-PRACTICE — practice games are chip-neutral: EVERY credit path below
    // (submitScore, earn_chips, streak, achievement chips, history, share) is skipped.
    // XP/battle-pass stays. leaderboard.total_chips must be byte-identical after a
    // practice game (the economy is 300:1 faucet-to-sink — no new faucets).
    const isPracticeGame = revealData.isPractice === true;
    const localSwept = isLocalComplete(
      revealData.isComplete,
      revealData.boards.filter((b) => b.winner === 'player').length,
      revealData.boards.length,
    );
    if (localSwept && revealData.completeBonusAmount > 0) {
      setTimeout(() => { void playSound('complete'); }, 800);
    }

    // [BANKROLL] sync verification — logs gated to __DEV__ to keep financial state out of production logs.
    AsyncStorage.getItem('caps-poker-storage').then(stored => {
      if (stored) {
        // (verbose persistence check removed — was logging chip state to production console)
      }
    }).catch(() => {});

    revealData.boards.forEach((board, i) => CapsHooks.boardCompleted(i, board.playerHandName, board.winner === 'player'));
    if (localSwept && revealData.completeBonusAmount > 0) CapsHooks.bonusAchieved('complete', revealData.completeBonusAmount);

    // ECON-SW-P1 + ECON-ACHIEVEMENT-LEDGER — the per-hand net, achievement grants, and the
    // submit_score stats write are persisted TOGETHER in ONE sequenced block further below
    // (after achievements are computed). They cannot be separate async flows: submit_score
    // does an ABSOLUTE read-back write, so any ledgered delta (record_hand_net / record_reward)
    // that lands after submit_score captured its balance would be CLOBBERED. See the
    // consolidated block right after the achievement-unlock section.

    const historyBoards: HandBoardRecord[] = revealData.boards.map((b, i) => ({
      boardIndex: i,
      winner: b.winner,
      playerHandName: b.playerHandName,
      botHandName: b.botHandName,
      playerCards: b.playerCards.map((c) => ({ rank: c.rank, suit: c.suit })),
      botCards: ((b.allBotCards ?? [])[0] ?? []).map((c) => ({ rank: c.rank, suit: c.suit })),
      communityCards: [...(b.openCards ?? []), ...(b.closedCards ?? [])].map((c) => ({ rank: c.rank, suit: c.suit })),
    }));
    const handRecord: HandRecord = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      timestamp: Date.now(),
      boards: historyBoards,
      netChips: revealData.netChips,
      potPerBoard: revealData.potPerBoard,
      numberOfPlayers: revealData.numberOfPlayers,
      boardCount: revealData.boardCount,
      isComplete: revealData.isComplete,
      completeBonusAmount: revealData.completeBonusAmount,
    };
    if (!isPracticeGame) {
      saveHandToHistory(handRecord).catch(() => {});
      setSavedHandId(handRecord.id);
    }

    // Supabase hand_history sync — non-blocking backup (AsyncStorage is primary)
    void (async () => {
      try {
        if (isPracticeGame) return; // practice games never touch server stats
        const deviceId = await getDeviceId();
        const sb = getSupabase();
        if (!sb) return;
        const bWon = revealData.boards.filter((b) => b.winner === 'player').length;
        const effPct = Math.round(bWon / revealData.boards.length * 100);
        await sb.from('hand_history').insert({
          device_id: deviceId,
          boards_data: revealData.boards.map((b) => ({
            community: [...(b.openCards ?? []), ...(b.closedCards ?? [])].map((c) => ({ rank: c.rank, suit: c.suit })),
            player: (b.playerCards ?? []).map((c) => ({ rank: c.rank, suit: c.suit })),
            won: b.winner === 'player',
            hand_name: b.playerHandName,
          })),
          boards_won: bWon,
          boards_total: revealData.boards.length,
          efficiency_pct: effPct,
          bot_difficulty: config.botDifficulty ?? 'easy',
          player_count: revealData.numberOfPlayers,
        });
      } catch {} // Non-blocking — AsyncStorage is the primary store
    })();

    // Auto-save to shared_hands (ensures rows exist even if user never taps share)
    const autoShareData: ShareData = {
      boards: revealData.boards,
      netChips: revealData.netChips,
      // VAMOS-COMPLETE-ON-LOSS 2026-06-21 — share text must not claim COMPLETE on a
      // loss; localSwept is true only when the LOCAL player won every board.
      isComplete: localSwept,
      completeBonusAmount: revealData.completeBonusAmount,
      boardsWon: revealData.boards.filter((b) => b.winner === 'player').length,
      totalBoards: revealData.boards.length,
      potPerBoard: revealData.potPerBoard,
      numberOfPlayers: revealData.numberOfPlayers,
    };
    if (!isPracticeGame) {
      saveHandForWebReplay(autoShareData).then((res) => { if (res) { setAutoShareUrl(res.url); setAutoShareId(res.id); } }).catch(() => {});
    }

    // VAMOS-UNIFY-FINAL 2026-06-28 — "Try 4 boards" upgrade nudge + login prompt
    // removed. We still increment the total-games counter so other code reading
    // it (analytics, future gating) keeps working.
    void (async () => {
      try {
        const prev = parseInt((await AsyncStorage.getItem('caps_total_games')) ?? '0', 10);
        await AsyncStorage.setItem('caps_total_games', String(prev + 1));
      } catch {}
    })();

    // Achievement checks — run after stats are incremented
    const gs = useGameStore.getState();
    const newWin = revealData.netChips > 0;
    if (!isPracticeGame) {
      if (newWin) gs.incrementWinStreak(); else gs.resetWinStreak();
    }

    const newlyUnlocked = isPracticeGame ? [] : checkAchievements({
      revealData,
      config,
      handsPlayed: gs.handsPlayed,
      handsWon: gs.handsWon,
      currentWinStreak: newWin ? gs.currentWinStreak : 0,
      isMultiplayer,
      alreadyUnlocked: gs.unlockedAchievements,
    });

    // ECON-ACHIEVEMENT-LEDGER (S60) — set local unlock state immediately (prevents re-fire);
    // players see unlocks on the Achievements screen (the in-app toast is gone). The durable
    // CHIP grant per unlock is a ledgered server delta (record_reward, event_type 'ach_'+id,
    // once=true → server dedupes per achievement FOREVER), applied in the consolidated
    // persistence block below so its credit isn't clobbered by submit_score's read-back.
    // isPractice yields [] via the checkAchievements guard, so nothing is granted in practice.
    const unlockedAchievements = newlyUnlocked
      .map((id) => getAchievement(id))
      .filter((a): a is Achievement => a !== undefined);
    unlockedAchievements.forEach((a) => gs.unlockAchievement(a.id));

    // ECON-SW-P1 + ECON-ACHIEVEMENT-LEDGER — CONSOLIDATED, SEQUENCED economy persistence.
    // submit_score does an ABSOLUTE read-back write, so every ledgered delta must land BEFORE
    // it or be clobbered. Strict order: record_hand_net (per-hand net, sole per-hand mover) →
    // record_reward(each unlocked achievement) → submit_score(FINAL new_balance = stats + a
    // no-op echo of the true post-delta total). Fires exactly ONCE per hand (handNetPersistedRef
    // + the []-deps effect). Practice writes NOTHING.
    if (!isPracticeGame && !handNetPersistedRef.current) {
      handNetPersistedRef.current = true;
      void (async () => {
        try {
          const deviceId = await getDeviceId();
          let latest: number | null = null;
          // ECON-SW P1.1 (S62) — pass the STABLE per-hand id (set once at hand end in
          // revealData) as p_hand_id so the server dedups a results double-mount. NOT
          // handRecord.id — that's regenerated per mount and would defeat the dedup.
          const netRes = await recordHandNet(deviceId, revealData.netChips, revealData.handId);
          if (netRes && typeof netRes.new_balance === 'number') latest = netRes.new_balance;
          for (const a of unlockedAchievements) {
            const r = await recordReward(deviceId, a.reward, 'ach_' + a.id, true);
            if (r && r.granted > 0 && typeof r.new_balance === 'number') {
              latest = r.new_balance;
              gs.trackChipsEarned(r.granted);
            }
          }
          if (latest !== null) gs.setChips(latest);
          await submitScore(gs.playerName || 'Player', latest ?? gs.chips, gs.handsPlayed, gs.handsWon, gs.biggestWin);
        } catch { /* economy RPCs never crash the game */ }
      })();
    }

    // ECON-SW-P1 (S59) — the old per-hand earn_chips('hand_won' +50 / 'streak_5_wins' +100)
    // credits were REMOVED from the per-hand path. Before, submit_score's absolute overwrite
    // clobbered them so they were effectively cosmetic; keeping them now would STACK on top of
    // the real net (record_hand_net), breaking the "total_chips moves by EXACTLY the net once"
    // invariant. The per-hand net (record_hand_net above) is now the SOLE per-hand chip movement.
    // Daily faucets (daily_streak/login/reward) and the share_hand reward are untouched; XP /
    // battle-pass / mission tracking below is unaffected.

    // Battle Pass XP + mission tracking
    try {
      const boardsWonByPlayer = revealData.boards.filter((b) => b.winner === 'player').length;
      const isWinner = revealData.netChips > 0;
      // VAMOS-COMPLETE-ON-LOSS 2026-06-21 — complete XP/mission credit only when the
      // LOCAL player swept every board. revealData.isComplete is true for EITHER
      // player's sweep, which previously awarded the player complete-XP for LOSING.
      const localComplete = isLocalComplete(revealData.isComplete, boardsWonByPlayer, revealData.boards.length);
      const earned = BATTLE_PASS_CONFIG.xpPerGame
        + (boardsWonByPlayer * BATTLE_PASS_CONFIG.xpPerBoardWin)
        + (isWinner ? BATTLE_PASS_CONFIG.xpPerGameWin : 0)
        + (localComplete ? BATTLE_PASS_CONFIG.xpPerComplete : 0);
      const bpStore = useBattlePassStore.getState();
      bpStore.addXP(earned);
      bpStore.trackMissionProgress('games_played', 1);
      bpStore.trackMissionProgress('boards_won', boardsWonByPlayer);
      if (isWinner) bpStore.trackMissionProgress('games_won', 1);
      if (localComplete) bpStore.trackMissionProgress('complete', 1);
      setXpGained(earned);
    } catch {}

    // Daily mission progress — update Supabase (text device_id, fire-and-forget)
    void (async () => {
      try {
        const deviceId = await getDeviceId();
        const sb = getSupabase();
        if (!sb) return;
        const boardsWon = revealData.boards.filter((b) => b.winner === 'player').length;
        const isWin = revealData.netChips > 0;
        await Promise.all([
          sb.rpc('update_mission_progress', { p_device_id: deviceId, p_type: 'games_played', p_amount: 1 }),
          ...(isWin ? [sb.rpc('update_mission_progress', { p_device_id: deviceId, p_type: 'games_won', p_amount: 1 })] : []),
          ...(boardsWon > 0 ? [sb.rpc('update_mission_progress', { p_device_id: deviceId, p_type: 'boards_won', p_amount: boardsWon })] : []),
        ]);
      } catch {} // Silent — never crash the game
    })();

    // Update ELO in leaderboard table.
    // PRACTICE = XP-only, zero chips → it must NOT touch the leaderboard. update_leaderboard_elo
    // is the path that writes leaderboard.games_played (strategist-confirmed), so a practice
    // hand was bumping games_played (and ELO) even though nothing real happened — a tester who
    // only practices would climb the game count. Guard it out for practice.
    void (async () => {
      try {
        if (isPracticeGame) return; // practice never touches ELO / leaderboard.games_played
        const deviceId = await getDeviceId();
        const sb = getSupabase();
        if (!sb) return;
        const won = revealData.netChips > 0;
        const res = await sb.rpc('update_leaderboard_elo', { p_device_id: deviceId, p_won: won });
        if (res.data) setEloChange(res.data as number);
      } catch {}
    })();

    // Record hand result for adaptive bot difficulty
    void (async () => {
      try {
        const boardsWon = revealData.boards.filter((b) => b.winner === 'player').length;
        const deviceId = await getDeviceId();
        const sb = getSupabase();
        if (!sb) return;
        await sb.rpc('record_hand_result', {
          p_device_id: deviceId,
          p_won: revealData.netChips > 0,
          p_boards_won: boardsWon,
          p_boards_total: revealData.boards.length,
        });
      } catch {}
    })();

    // Task 7: check_cups — award cups after each hand
    void (async () => {
      try {
        const deviceId = await getDeviceId();
        const sb = getSupabase();
        if (!sb) return;
        const { data: cupResult } = await sb.rpc('check_cups', { p_device_id: deviceId });
        if (cupResult?.awarded?.length > 0) {
          // VAMOS-PRE-FRIENDS telemetry: record each newly-earned cup.
          for (const cup of cupResult.awarded) track('cup_earned', { cup }, 'results');
          Alert.alert('🏆 New Cup!', `Unlocked: ${cupResult.awarded[0]}`, [{ text: 'Nice!' }]);
        }
      } catch {}
    })();

    // Analytics — hand completed
    const bWonCount = revealData.boards.filter((b) => b.winner === 'player').length;
    track('hand_completed', {
      boards_won: bWonCount,
      boards_total: revealData.boards.length,
      efficiency_pct: Math.round(bWonCount / revealData.boards.length * 100),
      won: bWonCount > revealData.boards.length - bWonCount,
    }, 'results');
    track('game_ended', {
      boards_won: bWonCount,
      boards_total: revealData.boards.length,
      won: bWonCount > revealData.boards.length - bWonCount,
      net_chips: revealData.netChips,
    }, 'results');

  }, []);

  // B3: result_viewed_duration — track how long player spends on results screen
  const viewStartRef = useRef(Date.now());
  useEffect(() => {
    viewStartRef.current = Date.now();
    return () => {
      if (!revealData) return;
      const duration = Math.round((Date.now() - viewStartRef.current) / 1000);
      const bWon = revealData.boards.filter((b) => b.winner === 'player').length;
      track('result_viewed_duration', {
        seconds: duration,
        result: revealData.netChips > 0 ? 'win' : 'lose',
        boards_won: bWon,
        is_complete: revealData.isComplete,
      }, 'results');
    };
  }, []);

  // Win celebration overlay (FIX 3) — shown for 3s when the player wins.
  //
  // CN1 — THE SECOND GATE. Changing only the render condition below was HALF A FIX: this
  // effect is what sets showWinOverlay, and it carried the same practice exclusion, so the
  // state was never true and the burst still never rendered. Measured, not assumed - four
  // full-reveal runs with the render gate already open still counted zero dots.
  //
  // AND THE REASON PRACTICE WAS EXCLUDED IN THE FIRST PLACE, which is a trap worth naming:
  // PRACTICE-CHIP-GATE-SWEEP (2026-07-09) noted that netChips is real pot arithmetic and looks
  // nonzero in practice even though XP-only means no chips move — and this overlay QUOTES IT:
  // "You won N chips!". Opening the gate without touching that sentence would re-introduce the
  // exact false claim that sweep removed. So the copy is now practice-aware below.
  useEffect(() => {
    if (!revealData) return;
    const wonHand = revealData.isPractice
      ? revealData.boards.filter((b) => b.winner === 'player').length >
        revealData.boards.filter((b) => b.winner === 'bot').length
      : revealData.netChips > 0;
    if (!wonHand) return;
    // Delay slightly so the results screen fade-in finishes first
    const showTimer = setTimeout(() => {
      setShowWinOverlay(true);
      // Animate overlay in
      Animated.parallel([
        Animated.timing(winOverlayOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.spring(winOverlayScale, { toValue: 1, friction: 5, tension: 80, useNativeDriver: true }),
      ]).start();
      // Launch colored dots burst
      winDotAnims.forEach((dot, i) => {
        dot.x.setValue(0);
        dot.y.setValue(0);
        dot.opacity.setValue(1);
        // Jitter the angle so 20 dots do not read as a clock face; keep the upward bias so the
        // burst rises rather than spilling sideways.
        const angle = ((i + Math.random() * 0.6) / WIN_DOT_COUNT) * 2 * Math.PI;
        const dist = 90 + Math.random() * 90;
        const tx = Math.cos(angle) * dist;
        const ty = Math.sin(angle) * dist - 50;
        // 600ms -> 950ms. The dots now travel further and linger long enough to be READ, which
        // was the other half of "too subtle". Still under a second: this fires on every win.
        const travel = 950;
        Animated.parallel([
          Animated.timing(dot.x, { toValue: tx, duration: travel, useNativeDriver: true }),
          Animated.timing(dot.y, { toValue: ty, duration: travel, useNativeDriver: true }),
          Animated.sequence([
            Animated.timing(dot.opacity, { toValue: 1, duration: 100, useNativeDriver: true }),
            Animated.timing(dot.opacity, { toValue: 0, duration: travel - 250, delay: 150, useNativeDriver: true }),
          ]),
        ]).start();
      });
      // Auto-hide overlay after 3s
      const hideTimer = setTimeout(() => {
        Animated.timing(winOverlayOpacity, { toValue: 0, duration: 300, useNativeDriver: true }).start(() => {
          setShowWinOverlay(false);
        });
      }, 3000);
      return () => clearTimeout(hideTimer);
    }, 700);
    return () => clearTimeout(showTimer);
  }, []);

  const handleNextHand = useCallback(() => {
    if (!revealData) return;
    // Heatmap (D7)
    import('../utils/heatmap').then(({ trackEvent }) => {
      import('../utils/leaderboard').then(({ getDeviceId: gdi }) => {
        gdi().then(id => trackEvent('results', 'play_again', id)).catch(() => {});
      }).catch(() => {});
    }).catch(() => {});
    const boardCount = revealData.boardCount;

    if (isMultiplayer) {
      setWaitingForNextHand(true);
      waitingTimeoutRef.current = setTimeout(() => {
        Alert.alert('Waiting Timed Out', 'No response from other players.', [
          { text: 'Keep Waiting', style: 'cancel' },
          { text: 'Leave', style: 'destructive', onPress: () => { useGameStore.getState().resetMultiplayer(); clearRevealData(); router.replace('/'); } },
        ]);
      }, WAITING_STATE_TIMEOUT_MS);

      const navigateToMpGame = (isHost: boolean, pIndex: number, pCount: number, yourCards: any[], boards: any[]) => {
        clearRevealData();
        router.replace({ pathname: '/multiplayer-game', params: { isHost: isHost ? 'true' : 'false', playerIndex: String(pIndex), playerCount: String(pCount), yourCards: JSON.stringify(yourCards), boards: JSON.stringify(boards) } } as any);
      };

      if (mpServer) {
        mpServer.updateCallbacks({
          onNewHandDealt: () => {
            if (waitingTimeoutRef.current) clearTimeout(waitingTimeoutRef.current);
            const { boards: newBoards, playerHands } = mpServer.getDealtCards();
            const boardsData = newBoards.map((b: any, i: number) => ({ boardIndex: i, openCards: b.openCards, closedCardCount: b.closedCards.length }));
            navigateToMpGame(true, 0, mpServer.getClients().filter((c: any) => c.connected).length, playerHands[0], boardsData);
          },
        });
        mpServer.requestNextHand(config);
      } else if (mpClient) {
        const myId = mpClient.getPlayerId();
        const mySeat = connectedPlayers.find((p) => p.id === myId)?.seat ?? 1;
        mpClient.updateCallbacks({
          onCardsDealt: (data: CardsDealtPayload) => {
            if (waitingTimeoutRef.current) clearTimeout(waitingTimeoutRef.current);
            navigateToMpGame(false, mySeat, data.playerCount, data.yourCards, data.boards);
          },
          onHostLost: () => {
            if (waitingTimeoutRef.current) clearTimeout(waitingTimeoutRef.current);
            setDisconnectMessage('Host disconnected');
            Alert.alert('Host Disconnected', 'The host has left the game.', [{ text: 'Leave', onPress: () => { useGameStore.getState().resetMultiplayer(); clearRevealData(); router.replace('/'); } }]);
          },
          onDisconnected: () => {
            if (waitingTimeoutRef.current) clearTimeout(waitingTimeoutRef.current);
            setDisconnectMessage('Connection lost');
            const code = storeRoomCode;
            Alert.alert('Connection Lost', 'Lost connection to the game room. You can try to rejoin.', [
              { text: 'Leave', style: 'cancel', onPress: () => { useGameStore.getState().resetMultiplayer(); clearRevealData(); router.replace('/'); } },
              { text: 'Rejoin', onPress: () => { useGameStore.getState().resetMultiplayer(); clearRevealData(); router.replace('/lobby' as any); } },
            ]);
          },
        });
        mpClient.sendNextHandRequest();
      }
      return;
    }

    clearRevealData();
    // PRACTICE-TO-LIVE — "Deal me in" after a practice hand re-enters PRACTICE (no real
    // buy-in, demo counter keeps accumulating — no ?fresh so it isn't reset). Previously
    // it dropped into a real chip game. If a live seat-hold is active (a human could drop
    // in), carry live=1 so the next practice hand keeps the countdown/jump wiring.
    if (revealData.isPractice) {
      const liveSuffix = isPracticeLiveActive() ? '&live=1' : '';
      router.replace(`/game?practice=true&players=${revealData.numberOfPlayers}${liveSuffix}` as any);
      return;
    }
    if (canAffordMatch(chips, getMatchCost(config.potPerBoard, boardCount))) {
      router.replace('/game');
    } else {
      router.replace('/gameover');
    }
  }, [revealData, chips, config, clearRevealData, router, isMultiplayer, mpServer, mpClient, connectedPlayers]);

  const handleHome = useCallback(() => {
    // MP-STABILITY 2026-07-06 (Problem 2) — same eviction bug as game.tsx's back button:
    // tapping HOME must not silently give up a held realtime seat. Route to the lobby
    // (the held table stays visible/discoverable there) instead of tearing the seat down;
    // the coordinator keeps heartbeating regardless of which screen is mounted. The seat is
    // only freed by an explicit leave-table action.
    if (isPracticeLiveActive()) { clearRevealData(); router.replace('/lobby' as any); return; }
    clearRevealData();
    router.replace('/');
  }, [clearRevealData, router]);
  const handleRematch = useCallback(() => {
    clearRevealData();
    router.replace('/game');
  }, [clearRevealData, router]);

  const handleShareHand = useCallback(async () => {
    if (!revealData) return;
    track('share_pressed', {}, 'results');
    const boardsWon = revealData.boards.filter((b) => b.winner === 'player').length;
    const totalBoards = revealData.boards.length;
    const effPct = Math.round(boardsWon / totalBoards * 100);
    const link = autoShareUrl ?? 'https://caps.ftable.co.il';
    const text = `🃏 CAPS Poker — I won ${boardsWon}/${totalBoards} boards!\nEfficiency: ${effPct}%\nPlay: ${link}`;
    try {
      if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(text);
        Alert.alert('Copied!', 'Hand summary copied to clipboard.');
      } else {
        await Share.share({ message: text });
      }
    } catch {}
  }, [revealData, autoShareUrl]);

  const { boards, netChips, isComplete, completeBonusAmount, numberOfPlayers, boardCount } = revealData;
  const playerWins = boards.filter((b) => b.winner === 'player').length;
  const botWins = boards.filter((b) => b.winner === 'bot').length;
  const isPerfectGame = playerWins === boards.length && boards.length > 0;
  // VAMOS-COMPLETE-ON-LOSS 2026-06-21 — the COMPLETE celebration must gate on the
  // LOCAL player completing (won every board), NOT on isComplete. isComplete is
  // true whenever EITHER player sweeps (gameLogic computes completeWinner but
  // RevealBoardData drops it), so an opponent sweep used to wrongly show the
  // winner celebration + "+bonus chips" + "Share COMPLETE!" on the losing screen.
  const localComplete = isLocalComplete(isComplete, playerWins, boards.length);
  const opponentComplete = isOpponentComplete(isComplete, playerWins, boards.length);
  const potPerBoardTotal = revealData.potPerBoard * numberOfPlayers;

  // VAMOS-FIX-RESULTS-RENDER 2026-06-17 — useMemo so BoardResultCard React.memo
  // can bail on parent re-renders (chip roll-up, achievement toasts, login prompt).
  // Without these, every parent state change would trash the memo cache.
  const shareData = React.useMemo<ShareData>(() => ({
    // VAMOS-COMPLETE-ON-LOSS 2026-06-21 — ShareData.isComplete means "the LOCAL player
    // completed" for share text/cards; localComplete, not the either-player isComplete.
    boards, netChips, isComplete: localComplete, completeBonusAmount,
    boardsWon: playerWins, totalBoards: boards.length,
    potPerBoard: revealData.potPerBoard, numberOfPlayers,
  }), [boards, netChips, localComplete, completeBonusAmount, playerWins, revealData.potPerBoard, numberOfPlayers]);

  const winBorderColor = React.useMemo(
    () => glowAnim.interpolate({ inputRange: [0, 1], outputRange: ['rgba(76,175,80,0.3)', 'rgba(76,175,80,0.9)'] }),
    [glowAnim],
  );

  const HAND_ORDER = ['Royal Flush', 'Straight Flush', 'Four of a Kind', 'Full House', 'Flush', 'Straight', 'Three of a Kind', 'Two Pair', 'One Pair', 'High Card'];
  let bestRank = 99; let bestName = ''; let bestBoard = 0;
  boards.forEach((b, i) => { const r = HAND_ORDER.indexOf(b.playerHandName); if (r >= 0 && r < bestRank) { bestRank = r; bestName = b.playerHandName; bestBoard = i + 1; } });

  // S115: session stats
  const sessionWins = sessionHistory.filter((h) => h.netChips > 0).length;
  const sessionLosses = sessionHistory.filter((h) => h.netChips < 0).length;
  const sessionChips = sessionHistory.reduce((sum, h) => sum + h.netChips, 0);

  // Chip x-positions (left %) for shower
  const CHIP_X_POSITIONS = ['10%', '22%', '35%', '50%', '65%', '80%'] as const;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <FriendsBg />

      {/* PRACTICE-TO-LIVE — between hands: if a real opponent triggers the countdown, jump
          immediately (no bot hand in flight to finish). Renders nothing unless a countdown fires. */}
      <PracticeLiveOverlay jumpImmediately />

      {/* S108: Floating chip delta animation — PRACTICE-CHIP-GATE-SWEEP: hidden in practice,
          same rationale as the win overlay above (netChips is real pot arithmetic). */}
      {revealData && !revealData.isPractice && (
        <FloatingChips
          amount={revealData.netChips}
          visible={showFloatingChips}
          onDone={() => setShowFloatingChips(false)}
        />
      )}

      {/* COMPLETE celebration overlay — screen flash + chip shower (LOCAL complete only) */}
      {showCompleteOverlay && localComplete && !completeOverlayDone && (
        <CompleteOverlay
          winner="player"
          bonusAmount={completeBonusAmount}
          duration={3}
          onDone={() => setCompleteOverlayDone(true)}
          isPractice={revealData.isPractice}
        />
      )}
      {showCompleteOverlay && localComplete && (
        <>
          {/* Gold screen flash */}
          <Animated.View
            pointerEvents="none"
            style={[styles.completeFlash, { opacity: completeFlashOpacity }]}
          />
          {/* Chip shower — 6 chips fall from top */}
          {chipTranslates.map((chipY, idx) => (
            <Animated.Text
              key={`chip-${idx}`}
              pointerEvents="none"
              accessibilityElementsHidden={true}
              importantForAccessibility="no-hide-descendants"
              style={[
                styles.chipShower,
                { left: CHIP_X_POSITIONS[idx] as any, transform: [{ translateY: chipY }] },
              ]}
            >
              🪙
            </Animated.Text>
          ))}
        </>
      )}

      {/* VAMOS-UNIFY-FINAL 2026-06-28 — LoginPromptModal + AchievementToast
          removed per "no in-app popups". Sign-in moved to a settings-only
          flow; achievement unlocks are visible on the Achievements screen. */}

      {/* Economy earn-chips floating toast */}
      {earnToast && (
        <Animated.View
          pointerEvents="none"
          accessibilityLiveRegion="polite"
          style={{
            position: 'absolute',
            bottom: 140,
            alignSelf: 'center',
            backgroundColor: 'rgba(20,20,20,0.88)',
            borderRadius: 24,
            paddingHorizontal: 22,
            paddingVertical: 10,
            opacity: earnToastOpacity,
            zIndex: 200,
          }}
        >
          <Text style={{ color: '#FFD700', fontSize: 22, fontWeight: '900' }}>{earnToast}</Text>
        </Animated.View>
      )}

      {/* Win celebration overlay (FIX 3) — "You won X chips!" for 3s */}
      {/* CN1 — THE CELEBRATION GATE. Roye's ruling, 2026-08-08: option A, RESTRAINED.
          Practice was excluded outright, and practice is XP-only so `netChips > 0` failed there
          too - which meant a new player winning their FIRST hand saw nothing at all, because
          the Home Play button opens practice. Three sprints of "why can't I measure the dots"
          ended here.

          WHY IT IS RESTRAINED RATHER THAN "any win": at 4 players you take a board in roughly
          half of all hands, so celebrating every BOARD would fire every other hand and stop
          being an event by the tenth. Winning a single board is already shown by that board's
          own win state. So practice celebrates winning the HAND - playerWins > botWins, the
          exact rule the headline at the top of this screen already uses for "YOU WIN".

          Real-chip hands are UNCHANGED: `netChips > 0` still gates them and is doing real work
          there (it also excludes a net-zero hand, which a board count would not). */}
      {showWinOverlay && revealData && (revealData.isPractice ? playerWins > botWins : revealData.netChips > 0) && (
        <Animated.View
          pointerEvents="none"
          accessibilityLiveRegion="assertive"
          style={[
            styles.winOverlay,
            { opacity: winOverlayOpacity, transform: [{ scale: winOverlayScale }] },
          ]}
        >
          {/* Colored dot burst */}
          {winDotAnims.map((dot, i) => (
            <Animated.View
              key={`dot-${i}`}
              // CL1 — ANCHOR, not geometry. Last sprint's probe selected these by
              // position/size/border-radius and matched ZERO of them on a winning hand, so E1
              // shipped unverified. Selecting an element by what it looks like is the mistake
              // this project has paid for six times; every measured element gets a testID.
              testID="win-dot"
              style={[
                styles.winDot,
                {
                  backgroundColor: WIN_DOT_COLORS[i % WIN_DOT_COLORS.length],
                  transform: [{ translateX: dot.x }, { translateY: dot.y }],
                  opacity: dot.opacity,
                },
              ]}
            />
          ))}
          <Text
            style={styles.winOverlayText}
            accessibilityLabel={revealData.isPractice ? 'Hand won!' : `You won ${revealData.netChips} chips!`}
          >
            {/* Practice is XP-only — never quote a chip figure here. See the effect above. */}
            {revealData.isPractice ? 'Hand won! 🎉' : `You won ${revealData.netChips} chips! 🎉`}
          </Text>
        </Animated.View>
      )}

      <Animated.View style={{ flex: 1, opacity: screenOpacity }}>
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          scrollEventThrottle={200}
        >

          {/* Title + score */}
          <View style={styles.titleSection}>
            <Text testID="result-headline" accessibilityRole="header" style={[styles.title, { color: isPerfectGame ? COLORS.mint : playerWins > botWins ? gameColors.win : playerWins < botWins ? gameColors.lose : COLORS.mint }]}>
              {isPerfectGame ? 'PERFECT!' : playerWins > botWins ? 'YOU WIN' : playerWins < botWins ? 'YOU LOSE' : 'TIE GAME'}
            </Text>
            {revealData.isPractice && (
              <View style={{ backgroundColor: 'rgba(245,181,70,0.14)', borderWidth: 1, borderColor: 'rgba(245,181,70,0.5)', borderRadius: 10, paddingVertical: 6, paddingHorizontal: 14, marginTop: 6, alignSelf: 'center' }} accessibilityRole="text" testID="practice-banner">
                <Text style={{ color: '#F5B546', fontWeight: '800', fontSize: 13 }}>🤖 Practice vs bot — XP only, no chips</Text>
                {/* PRACTICE-TO-LIVE — demo session counter (separate from real bankroll) */}
                <Text style={{ color: '#F5B546', fontWeight: '900', fontSize: 14, textAlign: 'center', marginTop: 3 }} testID="practice-session-net">
                  This session: {practiceSessionNet >= 0 ? '+' : ''}{practiceSessionNet}
                </Text>
              </View>
            )}
            <Text testID="score-numerals" style={[styles.scoreDisplay, { fontSize: Math.min(42, Math.floor(SCREEN_W * 0.105)) }]}>
              <Text style={{ color: gameColors.win }}>{playerWins}</Text>
              <Text style={[styles.scoreSep, { fontSize: Math.min(32, Math.floor(SCREEN_W * 0.08)) }]}> — </Text>
              <Text style={{ color: gameColors.lose }}>{botWins}</Text>
            </Text>
            {playerWins === botWins && netChips > 0 && !revealData.isPractice && (
              <Text style={styles.tieBonusText}>
                {`Tie bonus: +${netChips} chips`}
              </Text>
            )}
          </View>

          {/* Win streak badge */}
          {currentWinStreak >= 2 && (
            <View style={styles.streakBadge} accessibilityLiveRegion="assertive">
              <Text style={styles.streakBadgeText} accessibilityLabel={`${currentWinStreak} win streak!`}>🔥 {currentWinStreak} WIN STREAK!</Text>
              {bestWinStreak >= 2 && currentWinStreak < bestWinStreak && (
                <Text style={styles.streakBestText}>Best: {bestWinStreak}</Text>
              )}
            </View>
          )}

          {/* Chips earned + shop CTA — hidden in practice (no chips actually moved) */}
          {netChips > 0 && !revealData.isPractice && (
            <Pressable accessibilityRole="button" accessibilityLabel="Visit Shop" onPress={() => router.push('/shop' as any)} style={styles.shopCta} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={styles.shopCtaText} accessibilityElementsHidden={true} importantForAccessibility="no-hide-descendants">💰 +{netChips} chips earned | <Text style={styles.shopCtaLink}>Visit Shop</Text></Text>
            </Pressable>
          )}

          {/* Battle Pass XP banner */}
          {xpGained > 0 && (() => {
            let bpCurrentXP = 0;
            let bpCurrentTier = 1;
            let bpProgress = 0;
            let bpXpInTier = 0;
            let bpXpNeeded = 100;
            try {
              const bpSnap = useBattlePassStore.getState();
              bpCurrentXP = bpSnap.currentXP;
              bpCurrentTier = bpSnap.currentTier;
              const prog = getProgressToNextTier(bpCurrentXP);
              bpProgress = prog.progress;
              bpXpInTier = prog.xpInTier;
              bpXpNeeded = prog.xpNeeded;
            } catch {}
            const boardsWonForBanner = boards.filter((b) => b.winner === 'player').length;
            const isWinnerForBanner = netChips > 0;
            return (
              <View style={styles.xpBanner}>
                <Text style={styles.xpBannerTitle} accessibilityLabel={`+${xpGained} XP`}>⭐ +{xpGained} XP</Text>
                <Text style={styles.xpBannerBreakdown}>
                  {'Game: ' + BATTLE_PASS_CONFIG.xpPerGame}
                  {boardsWonForBanner > 0 ? (' | Boards: +' + boardsWonForBanner * BATTLE_PASS_CONFIG.xpPerBoardWin) : ''}
                  {isWinnerForBanner ? (' | Win: +' + BATTLE_PASS_CONFIG.xpPerGameWin) : ''}
                  {localComplete ? (' | Complete: +' + BATTLE_PASS_CONFIG.xpPerComplete) : ''}
                </Text>
                <XPBar
                  currentXP={bpCurrentXP}
                  currentTier={bpCurrentTier}
                  progress={bpProgress}
                  xpInTier={bpXpInTier}
                  xpNeeded={bpXpNeeded}
                  compact={false}
                />
              </View>
            );
          })()}

          {/* Board result cards — staggered fade-in */}
          {boards.map((board, i) => {
            if (i >= visibleBoardCount) return null;
            if (!boardTranslates.current[i]) boardTranslates.current[i] = new Animated.Value(30);
            return (
              <BoardResultCard
                key={i}
                board={board as any}
                boardIndex={i}
                pot={potPerBoardTotal}
                cardW={CARD_W}
                cardH={CARD_H}
                commCardW={COMM_CARD_W}
                commCardH={COMM_CARD_H}
                botCardW={BOT_CARD_W}
                botCardH={BOT_CARD_H}
                translateY={boardTranslates.current[i]}
                winBorderColor={winBorderColor}
                winBadgeAnim={winBadgeAnim}
                shareData={shareData}
                autoShareUrl={autoShareUrl}
                isComplete={localComplete}
                completeBonusAmount={completeBonusAmount}
                isPractice={revealData.isPractice}
              />
            );
          })}

          {/* Game share section */}
          {/* Practice games: no share (share earns +50 real chips — practice is chip-neutral) */}
          {!revealData.isPractice && <ShareSection
            shareData={shareData}
            autoShareUrl={autoShareUrl}
            boards={boards}
            netChips={netChips}
            isComplete={localComplete}
            completeBonusAmount={completeBonusAmount}
            potPerBoard={revealData.potPerBoard}
            numberOfPlayers={numberOfPlayers}
            // VAMOS UX-BATCH-2 (Item 2) — prominent CTA on big moments: COMPLETE,
            // 3+ board sweep, or a big chip win; quiet row otherwise.
            bigMoment={localComplete || playerWins >= 3 || netChips >= 150}
            onShareComplete={async () => {
              try {
                const deviceId = await getDeviceId();
                // Heatmap (D7)
                import('../utils/heatmap').then(({ trackEvent }) => {
                  trackEvent('results', 'share_whatsapp', deviceId);
                }).catch(() => {});
                // Guarded path when the shared_hands id is present; legacy earn_chips fallback
                // (tagged distinctly for the C2 adoption metric) when the auto-save hadn't
                // produced an id yet. Never silently drop the reward.
                let earned = 0;
                if (autoShareId) {
                  const res = await claimShareReward(deviceId, autoShareId);
                  earned = res?.granted ?? 0;
                } else {
                  const res = await earnChips(deviceId, 'share_hand');
                  earned = res?.chips_earned ?? 0;
                  track('share_reward_fallback', { reason: 'no_share_id' }, 'results');
                }
                if (earned > 0) {
                  useGameStore.getState().addChips(earned);
                  useGameStore.getState().trackChipsEarned(earned);
                  showEarnToast(`+${earned} 💰`);
                }
              } catch {}
            }}
          />}

          {/* Placement efficiency */}
          <EfficiencyCard boards={boards as any} screenW={SCREEN_W} />

          {/* Best hand highlight */}
          {bestName ? (
            <View style={styles.bestHandRow}>
              <Text style={styles.bestHandText} accessibilityLabel={`Best hand: ${bestName} on Board ${bestBoard}`}>⭐ Best hand: {bestName} on Board {bestBoard}</Text>
            </View>
          ) : null}

          {/* Stats row */}
          <View style={styles.statsRow}>
            <Text style={styles.statItem}>Boards: {playerWins}/{boards.length}</Text>
            <Text style={styles.statSep}>|</Text>
            <Text style={[styles.statItem, { color: revealData.isPractice ? '#F5B546' : netChips >= 0 ? COLORS.neonGreen : COLORS.neonRed }]}>
              {revealData.isPractice ? 'Net: XP only' : `Net: ${netChips >= 0 ? '+' : ''}${netChips}`}
            </Text>
            <Text style={styles.statSep}>|</Text>
            <Text style={styles.statItem}>Games: {useGameStore.getState().handsPlayed}</Text>
          </View>

          {/* COMPLETE celebration title — scale pop (LOCAL complete only) */}
          {localComplete && (
            <Animated.Text
              accessibilityLiveRegion="assertive"
              style={[styles.completeCelebTitle, { transform: [{ scale: completeTitleScale }] }]}
            >
              COMPLETE! ALL BOARDS!
            </Animated.Text>
          )}

          {/* Opponent swept all boards — loss framing, never a celebration */}
          {opponentComplete && (
            <Text accessibilityLiveRegion="assertive" style={styles.opponentSweptText}>
              Opponent swept all boards
            </Text>
          )}

          {/* Complete bonus banner (LOCAL complete only) */}
          <CompleteBanner visible={localComplete} bonusChips={completeBonusAmount} scale={completeScale} isPractice={revealData.isPractice} />

          {/* Net result — hidden in practice; same rationale as the per-board deltas and
              Current Balance above (revealData.netChips is a real, nonzero-looking number
              here even in practice, since it's the pot arithmetic, not the real balance
              delta — the practice stats-row below already reframes it as "XP only" instead
              of hiding it, but this large standalone amount had no such reframing). */}
          {!revealData.isPractice && (
            <View style={styles.netSection}>
              <View style={styles.netRow}>
                <Text style={styles.netLabel} accessibilityRole="header">Net Result</Text>
                {netChips > 0 ? (
                  <Animated.Text style={[styles.netAmount, { color: chipsFlashAnim.interpolate({ inputRange: [0, 0.4, 1], outputRange: ['#FFD700', '#FFD700', '#4CAF50'] }) }]}>
                    +{netChips}
                  </Animated.Text>
                ) : (
                  <Text style={[styles.netAmount, { color: netChips === 0 ? COLORS.textDim : COLORS.neonRed }]}>{netChips === 0 ? '±0' : netChips}</Text>
                )}
              </View>
            </View>
          )}

          {/* B2: Daily streak bonus display */}
          {dailyRewardStreak >= 2 && (() => {
            const streakBonusAmount = dailyRewardStreak >= 30 ? 500 : dailyRewardStreak >= 7 ? 100 : dailyRewardStreak >= 3 ? 20 : 10;
            return (
              <View style={styles.streakBonusRow}>
                <Text style={styles.streakBonusText} accessibilityLabel={`Day ${dailyRewardStreak} streak! +${streakBonusAmount} bonus chips tomorrow`}>🔥 Day {dailyRewardStreak} streak! +{streakBonusAmount} bonus chips tomorrow</Text>
              </View>
            );
          })()}

          {/* F1: Share COMPLETE button (LOCAL complete only) */}
          {localComplete && (
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Share COMPLETE"
              style={styles.shareCompleteBtn}
              onPress={async () => {
                try {
                  await Share.share({
                    message: 'I got COMPLETE in CAPS Poker! Won all boards! 🏆\nPlay: testflight.apple.com/join/hD3KvZeC',
                    title: 'CAPS Poker - COMPLETE!',
                  });
                  track('complete_shared', {}, 'results');
                } catch {}
              }}
            >
              <Text style={styles.shareCompleteBtnText} accessibilityElementsHidden={true} importantForAccessibility="no-hide-descendants">🏆 Share COMPLETE!</Text>
            </TouchableOpacity>
          )}

          {/* Current balance — hidden in practice (XP-only, no chips actually moved,
              so showing a real-money-looking balance here is misleading, not just noise) */}
          {!revealData.isPractice && (
            <ChipsDisplay amount={displayChips} label="Current Balance" size="large" />
          )}

          {/* VAMOS-UNIFY-FINAL 2026-06-28 — "Try 4 boards" upgrade nudge removed. */}

          {/* S118: Multiplayer result header */}
          {isMultiplayer && storeOpponentName ? (
            <Text style={[styles.mpResultHeader, { color: netChips > 0 ? '#c9a84c' : '#ef5350' }]} accessibilityLabel={netChips > 0 ? `You beat ${storeOpponentName}!` : `Defeated by ${storeOpponentName}`}>
              {netChips > 0 ? `🏆 You beat ${storeOpponentName}!` : `Defeated by ${storeOpponentName}`}
            </Text>
          ) : null}

          {/* S117: ELO change badge */}
          {eloChange !== 0 && (
            <View style={styles.eloChangeBadge}>
              <Text style={[styles.eloChangeText, { color: eloChange > 0 ? '#4CAF50' : '#ef5350' }]} accessibilityLabel={eloChange > 0 ? 'Rank up' : 'Rank down'}>
                {eloChange > 0 ? '▲' : '▼'} {Math.abs(eloChange)} ELO
              </Text>
            </View>
          )}

          {/* S115: Session stats — shows when 2+ games in session */}
          {sessionHistory.length >= 2 && (
            <View style={styles.sessionRow}>
              <Text style={styles.sessionLabel}>This session</Text>
              <Text style={styles.sessionStats} accessibilityLabel={`${sessionWins} wins, ${sessionLosses} losses, ${sessionChips >= 0 ? '+' : ''}${sessionChips} chips`}>
                {sessionWins}W / {sessionLosses}L
                <Text style={{ color: sessionChips >= 0 ? '#c9a84c' : '#ef5350' }}>
                  {' · '}{sessionChips >= 0 ? '+' : ''}{sessionChips}🪙
                </Text>
              </Text>
            </View>
          )}

          {/* S115: Board breakdown — compact one-row-per-board summary */}
          {boards.length > 0 && (
            <View style={styles.breakdownSection}>
              <Text style={styles.breakdownTitle} accessibilityRole="header">Board by board</Text>
              {boards.map((board, i) => {
                const playerWon = board.winner === 'player';
                const chipChange = playerWon ? potPerBoardTotal : -potPerBoardTotal;
                // VAMOS-BESTCARDS-RENDER 2026-06-22 — the board-by-board breakdown is the
                // surface the user actually reads. Show the SPECIFIC hand (e.g. "Pair of
                // Kings", "Ace High") for BOTH sides on EVERY outcome, via the shared
                // getSpecificHandName helper (same source of truth as BoardReveal), so the
                // user can see which hand each side held and why a board was won/lost/tied.
                // Was: generic type ("One Pair") + "vs {type}" only on a loss.
                const pHand = getSpecificHandName(board.playerHandName, board.playerBestCards) || '—';
                const bHand = board.botHandName ? getSpecificHandName(board.botHandName, board.botBestCards) : '';
                return (
                  <View key={i} style={styles.breakdownRow} accessible={true} accessibilityLabel={`Board ${i + 1}, ${playerWon ? 'won' : board.winner === 'tie' ? 'tied' : 'lost'}, ${pHand}${bHand ? ` vs ${bHand}` : ''}${revealData.isPractice ? '' : `, ${board.winner === 'tie' ? '0 chips' : `${playerWon ? '+' : ''}${chipChange} chips`}`}`}>
                    <View style={styles.breakdownLeft}>
                      <Text style={styles.breakdownNum}>Board {i + 1}</Text>
                      <Text style={[styles.breakdownIcon, { color: playerWon ? gameColors.win : board.winner === 'tie' ? '#aaa' : gameColors.lose }]} accessibilityLabel={playerWon ? 'Won' : board.winner === 'tie' ? 'Tied' : 'Lost'}>
                        {playerWon ? '✓' : board.winner === 'tie' ? '=' : '✗'}
                      </Text>
                    </View>
                    <View style={styles.breakdownMid}>
                      <Text testID="breakdown-hand" style={styles.breakdownHand}>{pHand}</Text>
                      {bHand ? (
                        <Text testID="breakdown-vs" style={styles.breakdownVs}>vs {bHand}</Text>
                      ) : null}
                    </View>
                    {/* OTA-COSMETIC-FIXES 2026-07-09 — this compact list, not BoardResultCard's
                        big-card view, is what actually renders here by default; practice never
                        moves real chips, so the ± delta was misleading, not just noise. */}
                    {!revealData.isPractice && (
                      <Text style={[styles.breakdownChips, { color: playerWon ? '#c9a84c' : board.winner === 'tie' ? '#aaa' : gameColors.lose }]} accessibilityLabel={board.winner === 'tie' ? '0 chips' : `${playerWon ? '+' : ''}${chipChange} chips`}>
                        {board.winner === 'tie' ? '±0🪙' : `${playerWon ? '+' : ''}${chipChange}🪙`}
                      </Text>
                    )}
                  </View>
                );
              })}
            </View>
          )}

          {/* S115: Hand history link */}
          {!isMultiplayer && (
            <TouchableOpacity
              accessibilityRole="link"
              accessibilityLabel="View hand history"
              onPress={() => router.push('/hand-history' as any)}
              style={styles.historyLink}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={styles.historyLinkText}>View hand history →</Text>
            </TouchableOpacity>
          )}

          {/* Action buttons (without DealMeIn — moved to sticky bottom) */}
          <View style={styles.buttons}>
            {waitingForNextHand ? (
              <View style={styles.waitingNextHand} accessibilityLiveRegion={disconnectMessage ? 'assertive' : 'polite'}>
                <Text style={styles.waitingNextHandText}>{disconnectMessage || 'Waiting for other players...'}</Text>
                {disconnectMessage && (
                  <Button title="LEAVE" variant="secondary" onPress={() => { useGameStore.getState().resetMultiplayer(); clearRevealData(); router.replace('/'); }} style={{ marginTop: 8, width: '100%' }} />
                )}
              </View>
            ) : (
              <>
                {savedHandId && !isMultiplayer && (
                  <Animated.View style={{ opacity: dealBtnOpacity, alignItems: 'center', marginTop: rs(8) }}>
                    <Pressable accessibilityRole="button" accessibilityLabel="Coaching" style={styles.coachingBtn} onPress={() => router.push(`/coaching?handId=${savedHandId}`)}>
                      <Text style={styles.coachingBtnText} accessibilityElementsHidden={true} importantForAccessibility="no-hide-descendants">💡 COACHING</Text>
                    </Pressable>
                  </Animated.View>
                )}
                {!isMultiplayer && (
                  <View style={styles.shareRow}>
                    <Pressable accessibilityRole="button" accessibilityLabel="Share Hand" style={styles.shareBtn} onPress={handleShareHand}>
                      <Text style={styles.shareBtnText} accessibilityElementsHidden={true} importantForAccessibility="no-hide-descendants">📤 Share Hand</Text>
                    </Pressable>
                  </View>
                )}
                <View style={styles.rematchRow}>
                  {!isMultiplayer && <Button title="REMATCH" variant="secondary" onPress={() => { handleRematch(); }} style={{ flex: 1 }} />}
                  {isMultiplayer && isMpHost && (
                    <Button
                      title="⚡ REMATCH"
                      variant="secondary"
                      onPress={() => {
                        // Unified: rematch returns to the Multiplayer Lobby to start a fresh table.
                        useGameStore.getState().resetMultiplayer();
                        clearRevealData();
                        router.replace('/lobby' as any);
                      }}
                      style={{ flex: 1 }}
                    />
                  )}
                  <Button title="HOME" variant="secondary" onPress={() => { handleHome(); }} style={!isMultiplayer ? { flex: 1 } : {}} />
                </View>
              </>
            )}
          </View>

        </ScrollView>
      </Animated.View>

      {/* S115: Sticky Play Again button — always visible at bottom */}
      {!waitingForNextHand && !isMultiplayer && (
        <View style={[styles.stickyBottom, { paddingBottom: Math.max(insets.bottom, rs(16)) }]}>
          <Animated.View style={{ opacity: dealBtnOpacity, transform: [{ scale: dealBtnScale }], width: '75%' }}>
            <DealMeInButton
              label={chips >= config.potPerBoard * revealData.boardCount ? t().dealMeIn : 'GAME OVER'}
              onPress={() => { handleNextHand(); }}
            />
          </Animated.View>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  scrollContent: { padding: rs(16), paddingBottom: rs(110), gap: rs(12), alignItems: 'center' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { color: COLORS.mint, fontSize: rf(20), fontWeight: '800' },
  titleSection: { alignItems: 'center', gap: rs(8) },
  title: { fontSize: rf(24), fontWeight: '900', color: COLORS.mint, letterSpacing: 6 },
  scoreDisplay: { fontSize: rf(42), fontWeight: '900' },
  scoreSep: { color: COLORS.textDim, fontSize: rf(32), fontWeight: '300' },
  tieBonusText: { color: COLORS.mint, fontSize: rf(13), fontWeight: '600', opacity: 0.75, marginTop: rs(2) },
  netSection: { width: '100%' },
  netRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: rs(4) },
  netLabel: { color: COLORS.textMuted, fontSize: rf(16), fontWeight: '600' },
  netAmount: { fontSize: rf(28), fontWeight: '900' },
  buttons: { width: '100%', gap: rs(10), marginTop: rs(4) },
  rematchRow: { flexDirection: 'row', gap: rs(10) },
  shareRow: { width: '100%', alignItems: 'center' },
  shareBtn: { paddingVertical: rs(10), paddingHorizontal: rs(28), borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', borderRadius: rv(16), backgroundColor: 'rgba(255,255,255,0.06)' },
  shareBtnText: { color: 'rgba(255,255,255,0.7)', fontSize: rf(14), fontWeight: '700', letterSpacing: 0.5 },
  coachingBtn: { paddingVertical: rs(10), paddingHorizontal: rs(28), borderWidth: 1, borderColor: COLORS.mint, borderRadius: rv(16), backgroundColor: 'rgba(255,215,0,0.08)' },
  coachingBtnText: { color: COLORS.mint, fontSize: rf(14), fontWeight: '800', letterSpacing: 1.5 },
  waitingNextHand: { backgroundColor: COLORS.feltLight, paddingVertical: rs(14), borderRadius: rv(10), borderWidth: 1, borderColor: COLORS.boardBorder, alignItems: 'center' },
  waitingNextHandText: { color: COLORS.textSecondary, fontSize: rf(16), fontWeight: '600' },
  bestHandRow: { width: '100%', paddingHorizontal: rs(4), paddingVertical: rs(6) },
  bestHandText: { color: '#FFD700', fontSize: rf(13), fontStyle: 'italic', textAlign: 'center' },
  hintRow: { width: '100%', paddingHorizontal: rs(4), paddingVertical: rs(4) },
  hintText: { color: 'rgba(255,255,255,0.85)', fontSize: rf(12), textAlign: 'center', lineHeight: rf(17) },
  statsRow: { width: '100%', flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: rs(8), paddingVertical: rs(6) },
  statItem: { color: 'rgba(255,255,255,0.85)', fontSize: rf(12) },
  statSep: { color: 'rgba(255,255,255,0.6)', fontSize: rf(12) },
  upgradeNudge: { width: '100%', backgroundColor: 'rgba(201,168,76,0.12)', borderWidth: 1, borderColor: 'rgba(201,168,76,0.4)', borderRadius: rv(10), padding: rs(14), gap: rs(10) },
  upgradeNudgeText: { color: COLORS.mint, fontSize: rf(14), fontWeight: '700', textAlign: 'center' },
  upgradeNudgeRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: rs(16) },
  upgradeNudgeBtn: { paddingVertical: rs(8), paddingHorizontal: rs(20), backgroundColor: COLORS.mint, borderRadius: rv(8) },
  upgradeNudgeBtnText: { color: '#161922', fontSize: rf(13), fontWeight: '900', letterSpacing: 1 },
  upgradeNudgeDismiss: { color: COLORS.textMuted, fontSize: rf(12) },
  xpBanner: { width: '100%', backgroundColor: 'rgba(201,168,76,0.10)', borderWidth: 1, borderColor: 'rgba(201,168,76,0.35)', borderRadius: rv(10), padding: rs(14), gap: rs(6) },
  xpBannerTitle: { color: '#FFD700', fontSize: rf(16), fontWeight: '800', letterSpacing: 1 },
  xpBannerBreakdown: { color: 'rgba(255,255,255,0.85)', fontSize: rf(12), fontWeight: '500' },
  // COMPLETE celebration
  completeFlash: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: '#FFD700',
    zIndex: 50,
  },
  chipShower: {
    position: 'absolute',
    top: -50,
    fontSize: 28,
    zIndex: 60,
  },
  completeCelebTitle: {
    color: '#FFD700',
    fontSize: rf(32),
    fontWeight: '900',
    letterSpacing: 3,
    textAlign: 'center',
    textShadowColor: 'rgba(255,215,0,0.5)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 20,
  },
  // VAMOS-COMPLETE-ON-LOSS 2026-06-21 — opponent swept all boards (loss framing)
  opponentSweptText: {
    color: COLORS.neonRed,
    fontSize: rf(18),
    fontWeight: '800',
    letterSpacing: 1,
    textAlign: 'center',
    opacity: 0.9,
  },
  // Auto-continue countdown (FIX 2)
  autoContinueBar: {
    width: '100%',
    backgroundColor: 'rgba(201,168,76,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(201,168,76,0.35)',
    borderRadius: rv(8),
    paddingVertical: rs(8),
    paddingHorizontal: rs(12),
    alignItems: 'center',
    marginBottom: rs(4),
  },
  autoContinueText: {
    color: COLORS.mint,
    fontSize: rf(13),
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  // Win celebration overlay (FIX 3)
  winOverlay: {
    position: 'absolute',
    top: '30%',
    left: '10%',
    right: '10%',
    backgroundColor: 'rgba(28,5,8,0.92)',
    borderWidth: 2,
    borderColor: COLORS.mint,
    borderRadius: rv(16),
    paddingVertical: rs(20),
    paddingHorizontal: rs(24),
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 80,
  },
  winOverlayText: {
    color: '#FFD700',
    fontSize: rf(20),
    fontWeight: '900',
    letterSpacing: 1,
    textAlign: 'center',
  },
  winDot: {
    position: 'absolute',
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  shopCta: {
    paddingVertical: rs(6),
    paddingHorizontal: rs(14),
  },
  shopCtaText: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: rf(12),
    textAlign: 'center',
  },
  shopCtaLink: {
    color: '#c9a84c',
    fontWeight: '700',
  },
  streakBadge: {
    alignSelf: 'center',
    paddingVertical: rs(6),
    paddingHorizontal: rs(16),
    borderRadius: rs(20),
    backgroundColor: 'rgba(255, 149, 0, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255, 149, 0, 0.4)',
    alignItems: 'center',
    gap: rs(2),
  },
  streakBadgeText: {
    fontSize: rf(16),
    fontWeight: '800',
    color: '#FF9500',
    letterSpacing: 0.5,
  },
  streakBestText: {
    fontSize: rf(11),
    color: 'rgba(255,179,71,1)',
    fontWeight: '600',
  },
  streakBonusRow: {
    alignSelf: 'stretch',
    paddingVertical: rs(8),
    paddingHorizontal: rs(16),
    borderRadius: rs(12),
    backgroundColor: 'rgba(255,149,0,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,149,0,0.25)',
    alignItems: 'center',
    marginVertical: rs(4),
  },
  streakBonusText: {
    fontSize: rf(13),
    fontWeight: '700',
    color: '#FF9500',
    textAlign: 'center',
  },
  shareCompleteBtn: {
    alignSelf: 'stretch',
    paddingVertical: rs(13),
    borderRadius: rs(14),
    backgroundColor: 'rgba(201,168,76,0.15)',
    borderWidth: 1.5,
    borderColor: '#c9a84c',
    alignItems: 'center',
    marginVertical: rs(6),
  },
  shareCompleteBtnText: {
    fontSize: rf(15),
    fontWeight: '900',
    color: '#c9a84c',
    letterSpacing: 0.5,
  },
  // S115: sticky Play Again
  stickyBottom: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    backgroundColor: 'rgba(10,10,10,0.95)',
    paddingHorizontal: rs(20),
    paddingBottom: rs(28),
    paddingTop: rs(12),
    borderTopWidth: 0.5,
    borderTopColor: 'rgba(201,168,76,0.25)',
    alignItems: 'center',
  },
  // S118: MP result header
  mpResultHeader: {
    fontSize: rf(20),
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: rs(8),
    letterSpacing: 0.5,
  },
  // S117: ELO change
  eloChangeBadge: {
    alignSelf: 'center',
    paddingHorizontal: rs(14),
    paddingVertical: rs(4),
    borderRadius: rv(20),
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  eloChangeText: {
    fontSize: rf(13),
    fontWeight: '800',
    letterSpacing: 1,
  },
  // S115: session stats row
  sessionRow: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: rs(4),
    paddingVertical: rs(8),
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: rv(8),
  },
  sessionLabel: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: rf(11),
    fontWeight: '600',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  sessionStats: {
    color: '#fff',
    fontSize: rf(13),
    fontWeight: '700',
  },
  // S115: board breakdown
  breakdownSection: {
    width: '100%',
    marginVertical: rs(4),
    paddingHorizontal: rs(4),
  },
  breakdownTitle: {
    fontSize: rf(11),
    color: 'rgba(255,255,255,0.85)',
    letterSpacing: 1.5,
    marginBottom: rs(8),
    textTransform: 'uppercase',
  },
  breakdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: rs(8),
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(255,255,255,0.07)',
  },
  breakdownLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: rs(6),
    width: rs(80),
  },
  breakdownNum: {
    fontSize: rf(12),
    color: 'rgba(255,255,255,0.85)',
  },
  breakdownIcon: {
    fontSize: rf(14),
    fontWeight: '800',
  },
  breakdownMid: {
    flex: 1,
  },
  breakdownHand: {
    // BT2 — your own hand name, raised 13 -> 16 (primary information). breakdownMid is flex:1
    // with no fixed width, so this has room to render at full size.
    fontSize: rf(16),
    fontWeight: '600',
    color: '#fff',
  },
  breakdownVs: {
    // BT2 — the opponent's hand, raised 10 -> 13. Deliberately NOT 16: it stays one step below
    // your own hand name above it, so lifting both off the floor does not invert whose result
    // the screen is about.
    fontSize: rf(13),
    color: 'rgba(255,255,255,0.8)',
    marginTop: rs(1),
  },
  breakdownChips: {
    fontSize: rf(13),
    fontWeight: '700',
    minWidth: rs(55),
    textAlign: 'left',
  },
  // S115: hand history link
  historyLink: {
    alignSelf: 'center',
    paddingVertical: rs(8),
    marginTop: rs(4),
    marginBottom: rs(8),
  },
  historyLinkText: {
    fontSize: rf(12),
    color: 'rgba(201,168,76,1)',
    fontWeight: '600',
  },
});
