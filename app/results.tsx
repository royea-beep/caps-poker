import React, { useEffect, useState, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, Platform, useWindowDimensions, Alert, Pressable, Animated, TouchableOpacity, Share } from 'react-native';
// ZERO Reanimated on results screen — game.tsx has 7 active shared values during transition
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../components/Button';
import { DealMeInButton } from '../components/DealMeInButton';
import { BoardResultCard } from '../components/BoardResultCard';
import { CompleteBanner } from '../components/CompleteBanner';
import CompleteOverlay from '../components/CompleteOverlay';
import { ShareSection } from '../components/ShareSection';
import { EfficiencyCard } from '../components/EfficiencyCard';
import { evaluateOmahaHand } from '../utils/handEvaluator';
import ChipsDisplay from '../components/ChipsDisplay';
import { FriendsBg } from '../components/FriendsBg';
import { useResultsAnimations } from '../hooks/useResultsAnimations';
import { useGameStore } from '../store/gameStore';
import { COLORS } from '../constants/gameConfig';
import { getTheme } from '../constants/visualThemes';
import { CardsDealtPayload } from '../constants/networkConfig';
import { submitScore } from '../utils/leaderboard';
import { WEB_MAX_WIDTH } from '../components/WebContainer';
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
import { debugLog } from '../components/DebugOverlay';
import { earnChips } from '../utils/supabaseEconomy';
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

const SUIT_SYM: Record<string, string> = { hearts: '♥', diamonds: '♦', clubs: '♣', spades: '♠' };

function getEfficiencyHint(boards: Array<{ playerCards: any[]; openCards: any[]; closedCards: any[] }>): string {
  let bestImprovement = 0;
  let bestHint = '';
  for (let i = 0; i < boards.length; i++) {
    for (let j = i + 1; j < boards.length; j++) {
      const communityI = [...(boards[i].openCards ?? []), ...(boards[i].closedCards ?? [])];
      const communityJ = [...(boards[j].openCards ?? []), ...(boards[j].closedCards ?? [])];
      const cardsI: any[] = boards[i].playerCards ?? [];
      const cardsJ: any[] = boards[j].playerCards ?? [];
      if (cardsI.length === 0 || cardsJ.length === 0) continue;
      const baseI = evaluateOmahaHand(cardsI, communityI).rank;
      const baseJ = evaluateOmahaHand(cardsJ, communityJ).rank;
      for (const cardI of cardsI) {
        for (const cardJ of cardsJ) {
          const newCardsI = cardsI.map((c: any) => c.id === cardI.id ? cardJ : c);
          const newCardsJ = cardsJ.map((c: any) => c.id === cardJ.id ? cardI : c);
          const newI = evaluateOmahaHand(newCardsI, communityI).rank;
          const newJ = evaluateOmahaHand(newCardsJ, communityJ).rank;
          const improvement = (newI + newJ) - (baseI + baseJ);
          if (improvement > bestImprovement) {
            bestImprovement = improvement;
            const sym = SUIT_SYM[cardI.suit] ?? cardI.suit;
            const pct = Math.min(99, Math.round(improvement * 11));
            bestHint = `Moving ${cardI.rank}${sym} from Board ${i + 1} to Board ${j + 1} would improve by ${pct}%`;
          }
        }
      }
    }
  }
  return bestImprovement > 0 ? bestHint : '';
}

async function logResultsStep(step: string, extra?: string) {
  debugLog(`[RESULTS-STEP] ${step}${extra ? ` — ${extra}` : ''}`);
  try {
    const sb = getSupabase();
    if (!sb) return;
    await sb.from('bug_reports').insert({ title: `[CRASH-STEP] results/${step}`, description: extra ?? null, url: 'results/mount', report_type: 'text' });
  } catch {}
}

let Haptics: any = null;
try { Haptics = require('expo-haptics'); } catch {}

export default function ResultsScreen() {
  const router = useRouter();
  const { autoSim, autoSimCount, currentSimHand } = useLocalSearchParams<{ autoSim?: string; autoSimCount?: string; currentSimHand?: string }>();
  const { width: rawW } = useWindowDimensions();
  const SCREEN_W = Platform.OS === 'web' ? Math.min(rawW, WEB_MAX_WIDTH) : rawW;
  const visualTheme = useGameStore((s) => s.visualTheme);
  const theme = getTheme(visualTheme);
  const chips = useGameStore((s) => s.chips);
  const config = useGameStore((s) => s.config);
  const revealData = useGameStore((s) => s.revealData);
  const clearRevealData = useGameStore((s) => s.clearRevealData);
  const incrementHandsPlayed = useGameStore((s) => s.incrementHandsPlayed);
  const incrementHandsWon = useGameStore((s) => s.incrementHandsWon);
  const updateBestChips = useGameStore((s) => s.updateBestChips);
  const updateBiggestWin = useGameStore((s) => s.updateBiggestWin);
  const mpServer = useGameStore((s) => s.mpServer);
  const mpClient = useGameStore((s) => s.mpClient);
  const connectedPlayers = useGameStore((s) => s.connectedPlayers);
  const storeRoomCode = useGameStore((s) => s.roomCode);
  const isMultiplayer = mpServer !== null || mpClient !== null;

  const updateConfig = useGameStore((s) => s.updateConfig);
  const handsPlayed = useGameStore((s) => s.handsPlayed);
  const handsWon = useGameStore((s) => s.handsWon);
  const currentWinStreak = useGameStore((s) => s.currentWinStreak);
  const bestWinStreak = useGameStore((s) => s.bestWinStreak);
  const dailyRewardStreak = useGameStore((s) => s.dailyRewardStreak);
  const unlockedAchievements = useGameStore((s) => s.unlockedAchievements);
  const [savedHandId, setSavedHandId] = useState<string | null>(null);
  const [xpGained, setXpGained] = useState(0);
  const [pendingAchievements, setPendingAchievements] = useState<Achievement[]>([]);
  const [autoShareUrl, setAutoShareUrl] = useState<string | null>(null);
  const [waitingForNextHand, setWaitingForNextHand] = useState(false);
  const [disconnectMessage, setDisconnectMessage] = useState<string | null>(null);
  const [showUpgradeNudge, setShowUpgradeNudge] = useState(false);
  const scrollRef = useRef<any>(null);
  const waitingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-continue timer (FIX 2)
  const AUTO_CONTINUE_SECS = 20;
  const [autoContinueCountdown, setAutoContinueCountdown] = useState(AUTO_CONTINUE_SECS);
  const [autoContinueActive, setAutoContinueActive] = useState(false);
  const autoContinueRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoContinueMountedRef = useRef(true);

  // Win celebration overlay (FIX 3)
  const [showWinOverlay, setShowWinOverlay] = useState(false);

  const [efficiencyHint, setEfficiencyHint] = useState<string | null>(null);

  // S108: Floating chip delta animation
  const [showFloatingChips, setShowFloatingChips] = useState(false);

  // S115: session stats (last 3h)
  const [sessionHistory, setSessionHistory] = useState<HandRecord[]>([]);

  // Economy earn-chips floating toast
  const [earnToast, setEarnToast] = useState<string | null>(null);
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
  // Colored dots for win animation (RN Animated only — no confetti library, Hermes-safe)
  const WIN_DOT_COLORS = ['#FFD700', '#4CAF50', '#00BFFF', '#FF6B6B', '#c9a84c', '#39FF14', '#FF69B4', '#FFD700'];
  const WIN_DOT_COUNT = 8;
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
    void logResultsStep('H:results_mounted', revealData ? `boards=${revealData.boards.length}` : 'NULL');
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
    // Complete sound
    if (revealData.isComplete && revealData.completeBonusAmount > 0) {
      setTimeout(() => { void playSound('complete'); }, 800);
    }

    // [BANKROLL] Verify bankroll sync — logs in-memory vs persisted value
    console.log('[BANKROLL] chips in store:', chips, 'netChips:', revealData.netChips);
    AsyncStorage.getItem('caps-poker-storage').then(stored => {
      if (stored) {
        try { const p = JSON.parse(stored); console.log('[BANKROLL] persisted chips:', p?.state?.chips); } catch {}
      }
    }).catch(() => {});

    revealData.boards.forEach((board, i) => CapsHooks.boardCompleted(i, board.playerHandName, board.winner === 'player'));
    if (revealData.isComplete && revealData.completeBonusAmount > 0) CapsHooks.bonusAchieved('complete', revealData.completeBonusAmount);

    const store = useGameStore.getState();
    submitScore(store.playerName || 'Player', store.chips, store.handsPlayed, store.handsWon, store.biggestWin).catch(() => {});

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
    saveHandToHistory(handRecord).catch(() => {});
    setSavedHandId(handRecord.id);

    // Supabase hand_history sync — non-blocking backup (AsyncStorage is primary)
    void (async () => {
      try {
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
      isComplete: revealData.isComplete,
      completeBonusAmount: revealData.completeBonusAmount,
      boardsWon: revealData.boards.filter((b) => b.winner === 'player').length,
      totalBoards: revealData.boards.length,
      potPerBoard: revealData.potPerBoard,
      numberOfPlayers: revealData.numberOfPlayers,
    };
    saveHandForWebReplay(autoShareData).then((url) => { if (url) setAutoShareUrl(url); }).catch(() => {});

    // "Try 4 boards" nudge — shown after first game (3-board intro)
    AsyncStorage.getItem('caps_games_played').then((val) => {
      const played = parseInt(val ?? '0', 10);
      if (played === 1 && revealData.boardCount === 3) setShowUpgradeNudge(true);
    }).catch(() => {});

    // Achievement checks — run after stats are incremented
    const gs = useGameStore.getState();
    const newWin = revealData.netChips > 0;
    if (newWin) gs.incrementWinStreak(); else gs.resetWinStreak();

    const newlyUnlocked = checkAchievements({
      revealData,
      config,
      handsPlayed: gs.handsPlayed,
      handsWon: gs.handsWon,
      currentWinStreak: newWin ? gs.currentWinStreak : 0,
      isMultiplayer,
      alreadyUnlocked: gs.unlockedAchievements,
    });

    if (newlyUnlocked.length > 0) {
      const toasts = newlyUnlocked
        .map((id) => getAchievement(id))
        .filter((a): a is Achievement => a !== undefined);
      toasts.forEach((a) => {
        gs.unlockAchievement(a.id);
        gs.addChips(a.reward);
        gs.trackChipsEarned(a.reward);
      });
      setPendingAchievements(toasts);
    }

    // Economy: earn_chips via Supabase RPC — fire-and-forget, never block UI
    void (async () => {
      try {
        const deviceId = await getDeviceId();
        if (revealData.netChips > 0) {
          // hand_won: +25 chips
          const wonResult = await earnChips(deviceId, 'hand_won');
          if (wonResult?.chips_earned) {
            gs.addChips(wonResult.chips_earned);
            gs.trackChipsEarned(wonResult.chips_earned);
            showEarnToast(`+${wonResult.chips_earned} 💰`);
            // streak_5_wins: +100 chips if player just hit 5 win streak
            if (gs.currentWinStreak === 5) {
              const streakResult = await earnChips(deviceId, 'streak_5_wins');
              if (streakResult?.chips_earned) {
                gs.addChips(streakResult.chips_earned);
                gs.trackChipsEarned(streakResult.chips_earned);
                setTimeout(() => showEarnToast(`+${streakResult.chips_earned} 💰 5 Win Streak!`), 1800);
              }
            }
          }
        }
      } catch {
        // silent — economy RPCs never crash the game
      }
    })();

    // Battle Pass XP + mission tracking
    try {
      const boardsWonByPlayer = revealData.boards.filter((b) => b.winner === 'player').length;
      const isWinner = revealData.netChips > 0;
      const isComplete = revealData.isComplete;
      const earned = BATTLE_PASS_CONFIG.xpPerGame
        + (boardsWonByPlayer * BATTLE_PASS_CONFIG.xpPerBoardWin)
        + (isWinner ? BATTLE_PASS_CONFIG.xpPerGameWin : 0)
        + (isComplete ? BATTLE_PASS_CONFIG.xpPerComplete : 0);
      const bpStore = useBattlePassStore.getState();
      bpStore.addXP(earned);
      bpStore.trackMissionProgress('games_played', 1);
      bpStore.trackMissionProgress('boards_won', boardsWonByPlayer);
      if (isWinner) bpStore.trackMissionProgress('games_won', 1);
      if (isComplete) bpStore.trackMissionProgress('complete', 1);
      setXpGained(earned);
    } catch {}

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

    // Post-game efficiency hint — find best card swap across boards
    try {
      setEfficiencyHint(getEfficiencyHint(revealData.boards));
    } catch {}

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

  // Auto-continue countdown (FIX 2) — starts 1.5s after mount to let animations settle
  useEffect(() => {
    if (!revealData || isMultiplayer || autoSim === 'true') return;
    autoContinueMountedRef.current = true;
    const startDelay = setTimeout(() => {
      if (!autoContinueMountedRef.current) return;
      setAutoContinueActive(true);
      setAutoContinueCountdown(AUTO_CONTINUE_SECS);
      autoContinueRef.current = setInterval(() => {
        if (!autoContinueMountedRef.current) {
          if (autoContinueRef.current) { clearInterval(autoContinueRef.current); autoContinueRef.current = null; }
          return;
        }
        setAutoContinueCountdown((prev) => {
          if (prev <= 1) {
            if (autoContinueRef.current) { clearInterval(autoContinueRef.current); autoContinueRef.current = null; }
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }, 1500);
    return () => {
      autoContinueMountedRef.current = false;
      clearTimeout(startDelay);
      if (autoContinueRef.current) { clearInterval(autoContinueRef.current); autoContinueRef.current = null; }
    };
  }, []);

  // When countdown hits 0 — auto-advance
  useEffect(() => {
    if (autoContinueActive && autoContinueCountdown === 0) {
      // Re-use the same navigation logic as handleNextHand (defined below) via ref
      autoContinueTriggerRef.current?.();
    }
  }, [autoContinueActive, autoContinueCountdown]);

  // Ref so the countdown effect can call handleNextHand without capturing stale closure
  const autoContinueTriggerRef = useRef<(() => void) | null>(null);

  // Win celebration overlay (FIX 3) — shown for 3s when player wins chips
  useEffect(() => {
    if (!revealData || revealData.netChips <= 0) return;
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
        const angle = (i / WIN_DOT_COUNT) * 2 * Math.PI;
        const dist = 80 + Math.random() * 60;
        const tx = Math.cos(angle) * dist;
        const ty = Math.sin(angle) * dist - 40;
        Animated.parallel([
          Animated.timing(dot.x, { toValue: tx, duration: 600, useNativeDriver: true }),
          Animated.timing(dot.y, { toValue: ty, duration: 600, useNativeDriver: true }),
          Animated.sequence([
            Animated.timing(dot.opacity, { toValue: 1, duration: 100, useNativeDriver: true }),
            Animated.timing(dot.opacity, { toValue: 0, duration: 500, delay: 100, useNativeDriver: true }),
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
              { text: 'Rejoin', onPress: () => { useGameStore.getState().resetMultiplayer(); clearRevealData(); router.replace({ pathname: '/lobby/internet-join', params: code ? { prefillCode: code } : {} } as any); } },
            ]);
          },
        });
        mpClient.sendNextHandRequest();
      }
      return;
    }

    clearRevealData();
    if (canAffordMatch(chips, getMatchCost(config.potPerBoard, boardCount))) {
      router.replace('/game');
    } else {
      router.replace('/gameover');
    }
  }, [revealData, chips, config, clearRevealData, router, isMultiplayer, mpServer, mpClient, connectedPlayers]);

  const handleHome = useCallback(() => { clearRevealData(); router.replace('/'); }, [clearRevealData, router]);
  const handleRematch = useCallback(() => { clearRevealData(); router.replace('/game'); }, [clearRevealData, router]);

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

  // Wire auto-continue trigger to handleNextHand (must be after handleNextHand is defined)
  autoContinueTriggerRef.current = handleNextHand;

  // Cancel auto-continue when user taps any action manually
  const cancelAutoContinue = useCallback(() => {
    if (autoContinueRef.current) { clearInterval(autoContinueRef.current); autoContinueRef.current = null; }
    setAutoContinueActive(false);
  }, []);

  if (!revealData) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={styles.loadingContainer}><Text style={styles.loadingText}>Loading...</Text></View>
      </SafeAreaView>
    );
  }

  const { boards, netChips, isComplete, completeBonusAmount, numberOfPlayers, boardCount } = revealData;
  const playerWins = boards.filter((b) => b.winner === 'player').length;
  const botWins = boards.filter((b) => b.winner === 'bot').length;
  const isPerfectGame = playerWins === boards.length && boards.length > 0;
  const potPerBoardTotal = revealData.potPerBoard * numberOfPlayers;

  const shareData: ShareData = {
    boards, netChips, isComplete, completeBonusAmount,
    boardsWon: playerWins, totalBoards: boards.length,
    potPerBoard: revealData.potPerBoard, numberOfPlayers,
  };

  const winBorderColor = glowAnim.interpolate({ inputRange: [0, 1], outputRange: ['rgba(76,175,80,0.3)', 'rgba(76,175,80,0.9)'] });

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

      {/* S108: Floating chip delta animation */}
      {revealData && (
        <FloatingChips
          amount={revealData.netChips}
          visible={showFloatingChips}
          onDone={() => setShowFloatingChips(false)}
        />
      )}

      {/* COMPLETE celebration overlay — screen flash + chip shower */}
      {showCompleteOverlay && isComplete && !completeOverlayDone && (
        <CompleteOverlay
          winner="player"
          bonusAmount={completeBonusAmount}
          duration={3}
          onDone={() => setCompleteOverlayDone(true)}
        />
      )}
      {showCompleteOverlay && isComplete && (
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

      {/* Achievement toasts — shown one at a time */}
      {pendingAchievements.length > 0 && (
        <AchievementToast
          achievement={pendingAchievements[0]}
          onDone={() => setPendingAchievements((prev) => prev.slice(1))}
        />
      )}

      {/* Economy earn-chips floating toast */}
      {earnToast && (
        <Animated.View
          pointerEvents="none"
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
      {showWinOverlay && revealData && revealData.netChips > 0 && (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.winOverlay,
            { opacity: winOverlayOpacity, transform: [{ scale: winOverlayScale }] },
          ]}
        >
          {/* Colored dot burst */}
          {winDotAnims.map((dot, i) => (
            <Animated.View
              key={`dot-${i}`}
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
          <Text style={styles.winOverlayText}>You won {revealData.netChips} chips! 🎉</Text>
        </Animated.View>
      )}

      <Animated.View style={{ flex: 1, opacity: screenOpacity }}>
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          onScroll={() => { if (autoContinueActive) cancelAutoContinue(); }}
          scrollEventThrottle={200}
        >

          {/* Title + score */}
          <View style={styles.titleSection}>
            <Text style={[styles.title, { color: isPerfectGame ? COLORS.gold : playerWins > botWins ? COLORS.neonGreen : playerWins < botWins ? COLORS.neonRed : COLORS.gold }]}>
              {isPerfectGame ? 'PERFECT!' : playerWins > botWins ? 'YOU WIN' : playerWins < botWins ? 'YOU LOSE' : 'TIE GAME'}
            </Text>
            <Text style={[styles.scoreDisplay, { fontSize: Math.min(42, Math.floor(SCREEN_W * 0.105)) }]}>
              <Text style={{ color: COLORS.neonGreen }}>{playerWins}</Text>
              <Text style={[styles.scoreSep, { fontSize: Math.min(32, Math.floor(SCREEN_W * 0.08)) }]}> — </Text>
              <Text style={{ color: COLORS.neonRed }}>{botWins}</Text>
            </Text>
            {playerWins === botWins && netChips > 0 && (
              <Text style={styles.tieBonusText}>
                {getLanguage() === 'he' ? `בונוס תיקו: +${netChips} ג'טונים` : `Tie bonus: +${netChips} chips`}
              </Text>
            )}
          </View>

          {/* Win streak badge */}
          {currentWinStreak >= 2 && (
            <View style={styles.streakBadge}>
              <Text style={styles.streakBadgeText}>🔥 {currentWinStreak} WIN STREAK!</Text>
              {bestWinStreak >= 2 && currentWinStreak < bestWinStreak && (
                <Text style={styles.streakBestText}>Best: {bestWinStreak}</Text>
              )}
            </View>
          )}

          {/* Chips earned + shop CTA */}
          {netChips > 0 && (
            <Pressable onPress={() => router.push('/shop' as any)} style={styles.shopCta}>
              <Text style={styles.shopCtaText}>💰 +{netChips} chips earned | <Text style={styles.shopCtaLink}>Visit Shop</Text></Text>
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
                <Text style={styles.xpBannerTitle}>⭐ +{xpGained} XP</Text>
                <Text style={styles.xpBannerBreakdown}>
                  {'Game: ' + BATTLE_PASS_CONFIG.xpPerGame}
                  {boardsWonForBanner > 0 ? (' | Boards: +' + boardsWonForBanner * BATTLE_PASS_CONFIG.xpPerBoardWin) : ''}
                  {isWinnerForBanner ? (' | Win: +' + BATTLE_PASS_CONFIG.xpPerGameWin) : ''}
                  {isComplete ? (' | Complete: +' + BATTLE_PASS_CONFIG.xpPerComplete) : ''}
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
                isComplete={isComplete}
                completeBonusAmount={completeBonusAmount}
              />
            );
          })}

          {/* Game share section */}
          <ShareSection
            shareData={shareData}
            autoShareUrl={autoShareUrl}
            boards={boards}
            netChips={netChips}
            isComplete={isComplete}
            completeBonusAmount={completeBonusAmount}
            potPerBoard={revealData.potPerBoard}
            numberOfPlayers={numberOfPlayers}
            onShareComplete={async () => {
              try {
                const deviceId = await getDeviceId();
                // Heatmap (D7)
                import('../utils/heatmap').then(({ trackEvent }) => {
                  trackEvent('results', 'share_whatsapp', deviceId);
                }).catch(() => {});
                const shareResult = await earnChips(deviceId, 'share_hand');
                if (shareResult?.chips_earned) {
                  useGameStore.getState().addChips(shareResult.chips_earned);
                  useGameStore.getState().trackChipsEarned(shareResult.chips_earned);
                  showEarnToast(`+${shareResult.chips_earned} 💰`);
                }
              } catch {}
            }}
          />

          {/* Placement efficiency */}
          <EfficiencyCard boards={boards as any} screenW={SCREEN_W} />

          {/* Efficiency hint — simple 1-liner swap suggestion */}
          {efficiencyHint !== null && (
            <View style={styles.hintRow}>
              <Text style={styles.hintText}>
                {efficiencyHint ? `💡 Tip: ${efficiencyHint}` : '⭐ Perfect placement! No improvement possible.'}
              </Text>
            </View>
          )}

          {/* Best hand highlight */}
          {bestName ? (
            <View style={styles.bestHandRow}>
              <Text style={styles.bestHandText}>⭐ Best hand: {bestName} on Board {bestBoard}</Text>
            </View>
          ) : null}

          {/* Stats row */}
          <View style={styles.statsRow}>
            <Text style={styles.statItem}>Boards: {playerWins}/{boards.length}</Text>
            <Text style={styles.statSep}>|</Text>
            <Text style={[styles.statItem, { color: netChips >= 0 ? COLORS.neonGreen : COLORS.neonRed }]}>Net: {netChips >= 0 ? '+' : ''}{netChips}</Text>
            <Text style={styles.statSep}>|</Text>
            <Text style={styles.statItem}>Games: {useGameStore.getState().handsPlayed}</Text>
          </View>

          {/* COMPLETE celebration title — scale pop */}
          {isComplete && (
            <Animated.Text
              style={[styles.completeCelebTitle, { transform: [{ scale: completeTitleScale }] }]}
            >
              COMPLETE! ALL BOARDS!
            </Animated.Text>
          )}

          {/* Complete bonus banner */}
          <CompleteBanner visible={isComplete} bonusChips={completeBonusAmount} scale={completeScale} />

          {/* Net result */}
          <View style={styles.netSection}>
            <View style={styles.netRow}>
              <Text style={styles.netLabel}>Net Result</Text>
              {netChips > 0 ? (
                <Animated.Text style={[styles.netAmount, { color: chipsFlashAnim.interpolate({ inputRange: [0, 0.4, 1], outputRange: ['#FFD700', '#FFD700', '#4CAF50'] }) }]}>
                  +{netChips}
                </Animated.Text>
              ) : (
                <Text style={[styles.netAmount, { color: netChips === 0 ? COLORS.textDim : COLORS.neonRed }]}>{netChips === 0 ? '±0' : netChips}</Text>
              )}
            </View>
          </View>

          {/* B2: Daily streak bonus display */}
          {dailyRewardStreak >= 2 && (() => {
            const streakBonusAmount = dailyRewardStreak >= 30 ? 500 : dailyRewardStreak >= 7 ? 100 : dailyRewardStreak >= 3 ? 20 : 10;
            return (
              <View style={styles.streakBonusRow}>
                <Text style={styles.streakBonusText}>🔥 Day {dailyRewardStreak} streak! +{streakBonusAmount} bonus chips tomorrow</Text>
              </View>
            );
          })()}

          {/* F1: Share COMPLETE button */}
          {isComplete && (
            <TouchableOpacity
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
              <Text style={styles.shareCompleteBtnText}>🏆 Share COMPLETE!</Text>
            </TouchableOpacity>
          )}

          {/* Current balance */}
          <ChipsDisplay amount={displayChips} label="Current Balance" size="large" />

          {/* First game: upgrade nudge — "Try 4 boards next!" */}
          {showUpgradeNudge && (
            <View style={styles.upgradeNudge}>
              <Text style={styles.upgradeNudgeText}>
                {getLanguage() === 'he'
                  ? 'מוכן לאתגר המלא? נסה 4 בורדים!'
                  : 'Ready for the full challenge? Try 4 boards next!'}
              </Text>
              <View style={styles.upgradeNudgeRow}>
                <Pressable
                  style={styles.upgradeNudgeBtn}
                  onPress={() => { updateConfig({ numberOfPlayers: 2 }); setShowUpgradeNudge(false); }}
                >
                  <Text style={styles.upgradeNudgeBtnText}>4 BOARDS →</Text>
                </Pressable>
                <Pressable onPress={() => setShowUpgradeNudge(false)}>
                  <Text style={styles.upgradeNudgeDismiss}>Later</Text>
                </Pressable>
              </View>
            </View>
          )}

          {/* S115: Session stats — shows when 2+ games in session */}
          {sessionHistory.length >= 2 && (
            <View style={styles.sessionRow}>
              <Text style={styles.sessionLabel}>This session</Text>
              <Text style={styles.sessionStats}>
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
              <Text style={styles.breakdownTitle}>Board by board</Text>
              {boards.map((board, i) => {
                const playerWon = board.winner === 'player';
                const chipChange = playerWon ? potPerBoardTotal : -potPerBoardTotal;
                return (
                  <View key={i} style={styles.breakdownRow}>
                    <View style={styles.breakdownLeft}>
                      <Text style={styles.breakdownNum}>Board {i + 1}</Text>
                      <Text style={[styles.breakdownIcon, { color: playerWon ? '#4CAF50' : board.winner === 'tie' ? '#aaa' : '#ef5350' }]}>
                        {playerWon ? '✓' : board.winner === 'tie' ? '=' : '✗'}
                      </Text>
                    </View>
                    <View style={styles.breakdownMid}>
                      <Text style={styles.breakdownHand}>{board.playerHandName || '—'}</Text>
                      {!playerWon && board.botHandName ? (
                        <Text style={styles.breakdownVs}>vs {board.botHandName}</Text>
                      ) : null}
                    </View>
                    <Text style={[styles.breakdownChips, { color: playerWon ? '#c9a84c' : board.winner === 'tie' ? '#aaa' : '#ef5350' }]}>
                      {board.winner === 'tie' ? '±0🪙' : `${playerWon ? '+' : ''}${chipChange}🪙`}
                    </Text>
                  </View>
                );
              })}
            </View>
          )}

          {/* S115: Hand history link */}
          {!isMultiplayer && (
            <TouchableOpacity
              onPress={() => router.push('/hand-history' as any)}
              style={styles.historyLink}
            >
              <Text style={styles.historyLinkText}>View hand history →</Text>
            </TouchableOpacity>
          )}

          {/* Auto-continue countdown (FIX 2) */}
          {autoContinueActive && !isMultiplayer && (
            <TouchableOpacity
              style={styles.autoContinueBar}
              onPress={cancelAutoContinue}
              activeOpacity={0.7}
            >
              <Text style={styles.autoContinueText}>
                Auto-continuing in {autoContinueCountdown}s · tap to stay
              </Text>
            </TouchableOpacity>
          )}

          {/* Action buttons (without DealMeIn — moved to sticky bottom) */}
          <View style={styles.buttons}>
            {waitingForNextHand ? (
              <View style={styles.waitingNextHand}>
                <Text style={styles.waitingNextHandText}>{disconnectMessage || 'Waiting for other players...'}</Text>
                {disconnectMessage && (
                  <Button title="LEAVE" variant="secondary" onPress={() => { useGameStore.getState().resetMultiplayer(); clearRevealData(); router.replace('/'); }} style={{ marginTop: 8, width: '100%' }} />
                )}
              </View>
            ) : (
              <>
                {savedHandId && !isMultiplayer && (
                  <Animated.View style={{ opacity: dealBtnOpacity, alignItems: 'center', marginTop: rs(8) }}>
                    <Pressable style={styles.coachingBtn} onPress={() => router.push(`/coaching?handId=${savedHandId}`)}>
                      <Text style={styles.coachingBtnText}>💡 COACHING</Text>
                    </Pressable>
                  </Animated.View>
                )}
                {!isMultiplayer && (
                  <View style={styles.shareRow}>
                    <Pressable style={styles.shareBtn} onPress={handleShareHand}>
                      <Text style={styles.shareBtnText}>📤 Share Hand</Text>
                    </Pressable>
                  </View>
                )}
                <View style={styles.rematchRow}>
                  {!isMultiplayer && <Button title="REMATCH" variant="secondary" onPress={() => { cancelAutoContinue(); handleRematch(); }} style={{ flex: 1 }} />}
                  <Button title="HOME" variant="secondary" onPress={() => { cancelAutoContinue(); handleHome(); }} style={!isMultiplayer ? { flex: 1 } : {}} />
                </View>
              </>
            )}
          </View>

        </ScrollView>
      </Animated.View>

      {/* S115: Sticky Play Again button — always visible at bottom */}
      {!waitingForNextHand && !isMultiplayer && (
        <View style={styles.stickyBottom}>
          <Animated.View style={{ opacity: dealBtnOpacity, transform: [{ scale: dealBtnScale }], width: '75%' }}>
            <DealMeInButton
              label={chips >= config.potPerBoard * revealData.boardCount ? t().dealMeIn : 'GAME OVER'}
              onPress={() => { cancelAutoContinue(); handleNextHand(); }}
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
  loadingText: { color: COLORS.gold, fontSize: rf(20), fontWeight: '800' },
  titleSection: { alignItems: 'center', gap: rs(8) },
  title: { fontSize: rf(24), fontWeight: '900', color: COLORS.gold, letterSpacing: 6 },
  scoreDisplay: { fontSize: rf(42), fontWeight: '900' },
  scoreSep: { color: COLORS.textDim, fontSize: rf(32), fontWeight: '300' },
  tieBonusText: { color: COLORS.gold, fontSize: rf(13), fontWeight: '600', opacity: 0.75, marginTop: rs(2) },
  netSection: { width: '100%' },
  netRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: rs(4) },
  netLabel: { color: COLORS.textMuted, fontSize: rf(16), fontWeight: '600' },
  netAmount: { fontSize: rf(28), fontWeight: '900' },
  buttons: { width: '100%', gap: rs(10), marginTop: rs(4) },
  rematchRow: { flexDirection: 'row', gap: rs(10) },
  shareRow: { width: '100%', alignItems: 'center' },
  shareBtn: { paddingVertical: rs(10), paddingHorizontal: rs(28), borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', borderRadius: rv(16), backgroundColor: 'rgba(255,255,255,0.06)' },
  shareBtnText: { color: 'rgba(255,255,255,0.7)', fontSize: rf(14), fontWeight: '700', letterSpacing: 0.5 },
  coachingBtn: { paddingVertical: rs(10), paddingHorizontal: rs(28), borderWidth: 1, borderColor: COLORS.gold, borderRadius: rv(16), backgroundColor: 'rgba(255,215,0,0.08)' },
  coachingBtnText: { color: COLORS.gold, fontSize: rf(14), fontWeight: '800', letterSpacing: 1.5 },
  waitingNextHand: { backgroundColor: COLORS.feltLight, paddingVertical: rs(14), borderRadius: rv(10), borderWidth: 1, borderColor: COLORS.boardBorder, alignItems: 'center' },
  waitingNextHandText: { color: COLORS.textSecondary, fontSize: rf(16), fontWeight: '600' },
  bestHandRow: { width: '100%', paddingHorizontal: rs(4), paddingVertical: rs(6) },
  bestHandText: { color: '#FFD700', fontSize: rf(13), fontStyle: 'italic', textAlign: 'center' },
  hintRow: { width: '100%', paddingHorizontal: rs(4), paddingVertical: rs(4) },
  hintText: { color: 'rgba(255,255,255,0.45)', fontSize: rf(12), textAlign: 'center', lineHeight: rf(17) },
  statsRow: { width: '100%', flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: rs(8), paddingVertical: rs(6) },
  statItem: { color: 'rgba(255,255,255,0.5)', fontSize: rf(12) },
  statSep: { color: 'rgba(255,255,255,0.2)', fontSize: rf(12) },
  upgradeNudge: { width: '100%', backgroundColor: 'rgba(201,168,76,0.12)', borderWidth: 1, borderColor: 'rgba(201,168,76,0.4)', borderRadius: rv(10), padding: rs(14), gap: rs(10) },
  upgradeNudgeText: { color: COLORS.gold, fontSize: rf(14), fontWeight: '700', textAlign: 'center' },
  upgradeNudgeRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: rs(16) },
  upgradeNudgeBtn: { paddingVertical: rs(8), paddingHorizontal: rs(20), backgroundColor: COLORS.gold, borderRadius: rv(8) },
  upgradeNudgeBtnText: { color: '#1C0508', fontSize: rf(13), fontWeight: '900', letterSpacing: 1 },
  upgradeNudgeDismiss: { color: COLORS.textMuted, fontSize: rf(12) },
  xpBanner: { width: '100%', backgroundColor: 'rgba(201,168,76,0.10)', borderWidth: 1, borderColor: 'rgba(201,168,76,0.35)', borderRadius: rv(10), padding: rs(14), gap: rs(6) },
  xpBannerTitle: { color: '#FFD700', fontSize: rf(16), fontWeight: '800', letterSpacing: 1 },
  xpBannerBreakdown: { color: 'rgba(255,255,255,0.55)', fontSize: rf(12), fontWeight: '500' },
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
    color: COLORS.gold,
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
    borderColor: COLORS.gold,
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
    color: 'rgba(255,255,255,0.55)',
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
    color: 'rgba(255,149,0,0.7)',
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
    color: 'rgba(255,255,255,0.4)',
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
    color: 'rgba(255,255,255,0.4)',
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
    color: 'rgba(255,255,255,0.45)',
  },
  breakdownIcon: {
    fontSize: rf(14),
    fontWeight: '800',
  },
  breakdownMid: {
    flex: 1,
  },
  breakdownHand: {
    fontSize: rf(13),
    fontWeight: '600',
    color: '#fff',
  },
  breakdownVs: {
    fontSize: rf(10),
    color: 'rgba(255,255,255,0.35)',
    marginTop: rs(1),
  },
  breakdownChips: {
    fontSize: rf(13),
    fontWeight: '700',
    minWidth: rs(55),
    textAlign: 'right',
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
    color: 'rgba(201,168,76,0.55)',
    fontWeight: '600',
  },
});
