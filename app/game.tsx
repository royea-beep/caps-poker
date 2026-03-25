import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, Pressable, StyleSheet, Alert, useWindowDimensions, Platform, Modal, Animated as AnimatedRN } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { setCurrentScreen, trackAction } from '../utils/crash-evidence';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  FadeIn,
  cancelAnimation,
} from 'react-native-reanimated';
import Board from '../components/Board';
import CardComponent from '../components/Card';
import PlayerHand from '../components/PlayerHand';
import { ErrorBoundary } from '../components/ErrorBoundary';
import ChipsDisplay from '../components/ChipsDisplay';
import { useGameStore } from '../store/gameStore';
import { getTheme } from '../constants/visualThemes';
import { COLORS, Card, CARDS_PER_BOARD, getBoardCount, CARD_SCALE, getCardDimensions } from '../constants/gameConfig';
import { ECONOMY_FLAGS } from '../constants/economyConfig';
import { getMatchCost } from '../utils/economy';
import {
  BoardState,
  initializeGameMulti,
  placeSingleBotCards,
  autoFillPlayerCards,
  calculateHandResultsMulti,
} from '../utils/gameLogic';
import { GamePhase, RevealBoardData } from '../types/gameTypes';
import { HandRank, HAND_RANK_NAMES } from '../utils/handEvaluator';
import { playSound } from '../utils/sounds';
import { CapsHooks } from '../utils/learning';
import { FriendsBg } from '../components/FriendsBg';
import ProQuoteBanner from '../components/ProQuoteBanner';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { markGameActive } from '../utils/dirtyShutdown';
import { getSupabase } from '../utils/supabase';
import { debugLog } from '../components/DebugOverlay';
import { onGameStart, onGameEnd } from '../utils/crashDetector';

const GAMES_PLAYED_KEY = 'caps_games_played';

// Log crash steps to Supabase so we know which step ran last before native kill
async function logStep(step: string, extra?: string) {
  console.log(`[STEP] ${step}${extra ? ` — ${extra}` : ''}`);
  try {
    const sb = getSupabase();
    if (!sb) return;
    await sb.from('bug_reports').insert({
      title: `[CRASH-STEP] ${step}`,
      description: extra ?? null,
      url: 'game/navigateToReveal',
      report_type: 'text',
    });
  } catch { /* silent — never block game flow */ }
}
const HINT_TEXTS = [
  '👆 Tap a card from your hand, then tap a board to place it',
  '🎯 Try to win ALL boards for the COMPLETE bonus!',
  '💡 Tip: Tap a placed card to remove it and try a different board',
];
import { rv as rvOld } from '../constants/deviceBreakpoints';
import { rf, rs, rb, rv } from '../utils/responsive';
import { t } from '../utils/i18n';
import { KILL_game } from '../utils/animationKill';
import { OrientationType } from '../store/gameStore';
import BoardReveal from '../components/BoardReveal';

// Lazy-load expo-haptics — not available on web
let Haptics: any = null;
try {
  Haptics = require('expo-haptics');
} catch {
  // expo-haptics not available (web) — haptics disabled
}

const haptic = (style: any) => {
  Haptics?.impactAsync?.(style)?.catch?.(() => {});
};
const hapticNotify = (type: any) => {
  Haptics?.notificationAsync?.(type)?.catch?.(() => {});
};

// Circular timer component — depleting ring on web, pulsing circle on native
function CircularTimer({ timeLeft, size, color, pulsing }: { timeLeft: number; size: number; color: string; pulsing: boolean }) {
  const pulseScale = useSharedValue(1);

  useEffect(() => {
    if (pulsing) {
      if (!KILL_game) {
        pulseScale.value = withRepeat(
          withSequence(
            withTiming(1.12, { duration: 500 }),
            withTiming(1, { duration: 500 }),
          ),
          100, // finite — no withRepeat(-1) ever (iron rule)
        );
      }
    } else {
      cancelAnimation(pulseScale);
      pulseScale.value = withTiming(1, { duration: 200 });
    }
    return () => { cancelAnimation(pulseScale); };
  }, [pulsing]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
  }));

  const s = timeLeft % 60;
  const timeStr = `0:${s.toString().padStart(2, '0')}`;

  if (Platform.OS === 'web') {
    const progress = Math.max(0, Math.min(timeLeft / 60, 1));
    const deg = Math.round(progress * 360);
    return (
      <Animated.View style={[{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }, animStyle]}>
        {/* Depleting ring via conic-gradient */}
        <View style={[{ position: 'absolute', width: size, height: size, borderRadius: size / 2 },
          { background: `conic-gradient(${color} ${deg}deg, rgba(40,40,40,0.85) ${deg}deg)` } as any]} />
        {/* Inner dark mask to create ring */}
        <View style={{ position: 'absolute', width: size - 8, height: size - 8, borderRadius: (size - 8) / 2, backgroundColor: 'rgba(8,8,8,0.9)' }} />
        <Text style={[timerStyles.text, { color, fontSize: size * 0.30, zIndex: 1 }]}>{timeStr}</Text>
      </Animated.View>
    );
  }

  return (
    <Animated.View style={[timerStyles.container, { width: size, height: size, borderRadius: size / 2, borderColor: color }, animStyle]}>
      <Text style={[timerStyles.text, { color, fontSize: size * 0.32 }]}>{timeStr}</Text>
    </Animated.View>
  );
}

const timerStyles = StyleSheet.create({
  container: {
    borderWidth: 3,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  text: {
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
});

// Horizontal progress bar — shrinks left-to-right as time passes
function TimerBar({ countdown, total, color }: { countdown: number; total: number; color: string }) {
  const progress = useSharedValue(countdown / total);
  const pulseOpacity = useSharedValue(1);

  useEffect(() => {
    progress.value = withTiming(Math.max(0, countdown / total), { duration: 850 });
    return () => { cancelAnimation(progress); };
  }, [countdown]);

  useEffect(() => {
    if (countdown <= 3 && countdown > 0) {
      if (!KILL_game) {
        pulseOpacity.value = withRepeat(
          withSequence(withTiming(0.4, { duration: 250 }), withTiming(1, { duration: 250 })),
          20, false, // finite — countdown only runs 3s max so 20 cycles is plenty
        );
      }
    } else {
      cancelAnimation(pulseOpacity);
      pulseOpacity.value = withTiming(1, { duration: 100 });
    }
    return () => { cancelAnimation(pulseOpacity); };
  }, [countdown <= 3]);

  const barStyle = useAnimatedStyle(() => ({
    width: `${Math.max(0, progress.value * 100)}%` as any,
    opacity: pulseOpacity.value,
  }));

  return (
    <View style={timerBarStyles.track}>
      <Animated.View style={[timerBarStyles.fill, { backgroundColor: color }, barStyle]} />
    </View>
  );
}

const timerBarStyles = StyleSheet.create({
  track: {
    width: '100%',
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },
  fill: {
    height: 3,
    borderRadius: 1.5,
  },
});

const COUNTDOWN_SECONDS = 30;

// Layout constants
const TOP_BAR_H = 44;
const BOT_STATUS_H = 24;       // label + paddingVertical ≈ 24px
const FLOATING_ACTIONS_H = 68; // paddingVertical:10×2 + button paddingVertical:12×2 + text ≈ 68px
const HINT_H = 26;             // selectionHint / boardError bar
const BOARD_CHROME = 40;       // per-board: border(4) + pressable pad(8) + header(18) + cardRow gaps(6) + margins

function GameScreenInner() {
  const router = useRouter();
  const { autoSim, autoSimCount, currentSimHand } = useLocalSearchParams<{ autoSim?: string; autoSimCount?: string; currentSimHand?: string }>();
  const { height: SCREEN_H, width: screenW } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const config = useGameStore((s) => s.config);
  const chips = useGameStore((s) => s.chips);
  const playerAvatar = useGameStore((s) => s.playerAvatar) || '🎰';
  const playerDisplayName = useGameStore((s) => s.playerName) || 'Player 1';
  const storeOrientation = useGameStore((s) => s.orientation);
  const visualTheme = useGameStore((s) => s.visualTheme);
  const theme = getTheme(visualTheme);
  const isLandscape = storeOrientation === 'landscape' && Platform.OS !== 'web';
  const addChips = useGameStore((s) => s.addChips);
  const trackChipsSpent = useGameStore((s) => s.trackChipsSpent);
  const setRevealData = useGameStore((s) => s.setRevealData);

  const numberOfPlayers = config.numberOfPlayers as 2 | 3 | 4;
  const numberOfBots = numberOfPlayers - 1;
  const boardCount = getBoardCount(numberOfPlayers);

  // Player hand: 2 rows of cards + label. Card height ≈ round(min(36,max(28,availW/8)) * 1.4)
  // Approximate by screen height bracket: smaller phones → smaller cards → shorter hand section
  const PLAYER_HAND_H = SCREEN_H < 700 ? 100 : SCREEN_H < 800 ? 112 : 124;

  const safeH = SCREEN_H - insets.top - insets.bottom;
  const BOARD_GAPS = (boardCount - 1) * 4;
  const boardSpace = (safeH - TOP_BAR_H - BOT_STATUS_H - PLAYER_HAND_H - FLOATING_ACTIONS_H - HINT_H - BOARD_GAPS) / boardCount - BOARD_CHROME;
  // Mobile web card height scales with board count — more boards = tighter = needs clarity boost
  const mobileWebCardH = CARD_SCALE[numberOfPlayers]?.cardHeight ?? 60;
  const nativeCardDims = getCardDimensions(screenW, numberOfPlayers);
  const communityScale = nativeCardDims.communityScale;
  // Cap native card height so both card rows (community + player/slots) fit in boardSpace.
  // During arrangement: commH = ch*communityScale, slotH = ch*0.7, plus 4pt cardRow padding.
  // ch*(communityScale + 0.7) + 4 <= boardSpace → maxCh = floor((boardSpace-4)/(communityScale+0.7))
  // Landscape uses a 2-column grid with more height per row — no cap needed there.
  const CARD_ROW_PAD = 4;
  const maxNativeCardH = Math.max(28, Math.floor((boardSpace - CARD_ROW_PAD) / (communityScale + 0.7)));
  const nativeCardH = isLandscape
    ? nativeCardDims.cardHeight
    : Math.min(nativeCardDims.cardHeight, maxNativeCardH);
  const BOARD_CARD_H = rvOld(
    screenW,
    mobileWebCardH,              // mobile web (iPhone Safari) — board-count aware
    72,                          // tablet web
    100,                         // desktop web
    nativeCardH,                 // native — height-capped so AUTO button is always visible
  );
  const isWeb = Platform.OS === 'web';

  const [gamesPlayed, setGamesPlayed] = useState(99); // default high so hint is hidden until loaded
  const [boards, setBoards] = useState<BoardState[]>([]);
  const [playerHand, setPlayerHand] = useState<Card[]>([]);
  const [selectedCardIds, setSelectedCardIds] = useState<string[]>([]);
  const [botsReady, setBotsReady] = useState<boolean[]>([]);
  const [boardError, setBoardError] = useState<string | null>(null);
  const boardErrorTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Per-board shake animations (max 4 boards)
  const shake0 = useSharedValue(0);
  const shake1 = useSharedValue(0);
  const shake2 = useSharedValue(0);
  const shake3 = useSharedValue(0);
  const shakeStyle0 = useAnimatedStyle(() => ({ transform: [{ translateX: shake0.value }] }));
  const shakeStyle1 = useAnimatedStyle(() => ({ transform: [{ translateX: shake1.value }] }));
  const shakeStyle2 = useAnimatedStyle(() => ({ transform: [{ translateX: shake2.value }] }));
  const shakeStyle3 = useAnimatedStyle(() => ({ transform: [{ translateX: shake3.value }] }));
  const boardShakes = [shake0, shake1, shake2, shake3];
  const boardShakeStyles = [shakeStyle0, shakeStyle1, shakeStyle2, shakeStyle3];
  const [phase, setPhase] = useState<GamePhase>({ type: 'arranging', timeLeft: 0 });
  const [playerReady, setPlayerReady] = useState(false);
  const [timeBankUsed, setTimeBankUsed] = useState(false);

  // New timer logic: no timer at start, 30s countdown when first player finishes
  const [countdownActive, setCountdownActive] = useState(false);
  const [countdown, setCountdown] = useState(COUNTDOWN_SECONDS);
  const [firstFinisher, setFirstFinisher] = useState<string | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const mountedRef = useRef(true);
  const timeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const playerHandRef = useRef(playerHand);
  const boardsRef = useRef(boards);
  const [showContinueButton, setShowContinueButton] = useState(false);
  const [showSafeReveal, setShowSafeReveal] = useState(false);
  const [pendingRevealBoards, setPendingRevealBoards] = useState<Array<{
    winner: 'player'|'bot'|'tie';
    playerHandName: string;
    botHandName: string;
    openCards: Card[];
    closedCards: Card[];
    playerCards: Card[];
    botCards: Card[];
    potAmount: number;
  }>>([]);
  const precalculatedResultsRef = useRef<ReturnType<typeof calculateHandResultsMulti> | null>(null);
  const hasNavigatedRef = useRef(false);
  const playerReadyRef = useRef(false);
  const botsReadyCountRef = useRef(0);

  useEffect(() => { playerHandRef.current = playerHand; }, [playerHand]); // no cleanup needed — sync ref update
  useEffect(() => { boardsRef.current = boards; }, [boards]); // no cleanup needed — sync ref update

  const isArranging = phase.type === 'arranging' && !playerReady;

  // Start 30s countdown
  const startCountdown = useCallback((finisherName: string) => {
    if (countdownRef.current) return; // already running
    setFirstFinisher(finisherName);
    setCountdownActive(true);
    setCountdown(COUNTDOWN_SECONDS);
    playSound('timerLow');

    countdownRef.current = setInterval(() => {
      // Guard: component may have unmounted between ticks (iOS New Architecture)
      if (!mountedRef.current) {
        if (countdownRef.current) {
          clearInterval(countdownRef.current);
          countdownRef.current = null;
        }
        return;
      }
      setCountdown((prev) => {
        if (prev <= 1) {
          if (countdownRef.current) {
            clearInterval(countdownRef.current);
            countdownRef.current = null;
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  // Pre-calculate results in background as soon as countdown starts (first finisher done)
  // By the time both are ready, results are already computed → zero-wait navigation
  // IMPORTANT: must guard BOTH bot cards AND player cards — pre-calc fires when the first
  // finisher triggers the countdown. If bot finishes first, playerCards is still empty →
  // evaluator returns "High Card" for every player hand (the S48 stale result bug).
  useEffect(() => {
    if (!countdownActive) return;
    const t = setTimeout(() => {
      if (!mountedRef.current) return;
      try {
        const botsDone = boardsRef.current.every((b) =>
          b.allBotCards.every((bc) => bc.length >= CARDS_PER_BOARD)
        );
        const playerDone = boardsRef.current.every((b) =>
          b.playerCards.length >= CARDS_PER_BOARD
        );
        if (!botsDone || !playerDone) {
          console.log('[GAME] pre-calc skipped — cards not fully placed yet, will calc fresh on navigate');
          return;
        }
        precalculatedResultsRef.current = calculateHandResultsMulti(boardsRef.current, numberOfPlayers, config);
        console.log('[GAME] pre-calculation done during countdown');
      } catch (e) {
        console.warn('[GAME] pre-calculation failed — will recalculate on navigate:', e);
        precalculatedResultsRef.current = null;
      }
    }, 0);
    return () => clearTimeout(t);
  }, [countdownActive]);

  // Countdown sound escalation: timerLow at 10s (from startCountdown), per-second at 5–1, timerLow at 0
  // no cleanup needed — fire-and-forget sound/haptic calls, no subscriptions
  useEffect(() => {
    if (!countdownActive) return;
    // Per-second ticks from 5s down to 1s (escalating urgency)
    if (countdown <= 5 && countdown >= 1) playSound('timerLow');
    // Time up: timerLow as buzzer placeholder (TODO: add dedicated buzzer.wav)
    if (countdown === 0) {
      playSound('timerLow');
      haptic(Haptics?.ImpactFeedbackStyle?.Heavy);
    }
  }, [countdownActive, countdown]);

  // When countdown hits 0 — auto-place remaining cards and navigate directly
  // no cleanup needed — one-time state transition, no subscriptions or timers
  useEffect(() => {
    if (countdownActive && countdown === 0 && !playerReady) {
      const shuffled = [...playerHandRef.current].sort(() => Math.random() - 0.5);
      const { boards: filledBoards, remainingHand } = autoFillPlayerCards(shuffled, boardsRef.current);
      setBoards(filledBoards);
      setPlayerHand(remainingHand);
      setSelectedCardIds([]);
      setPlayerReady(true);
      setPhase({ type: 'waiting_for_bot' });
      playerReadyRef.current = true;
      // Navigate directly with the filled boards
      doNavigateRef.current(filledBoards);
    }
  }, [countdownActive, countdown, playerReady]);

  // Cleanup
  useEffect(() => {
    mountedRef.current = true;
    debugLog(`game.tsx mounted — ${numberOfPlayers}p ${boardCount} boards`);
    setCurrentScreen('Game')
    onGameStart().catch(() => {});
    return () => {
      mountedRef.current = false;
      debugLog('game.tsx unmounting');
      onGameEnd().catch(() => {});
      timeoutsRef.current.forEach((t) => clearTimeout(t));
      timeoutsRef.current = [];
      if (countdownRef.current) {
        clearInterval(countdownRef.current);
        countdownRef.current = null;
      }
      if (boardErrorTimer.current) {
        clearTimeout(boardErrorTimer.current);
        boardErrorTimer.current = null;
      }
    };
  }, []);

  // Load games-played counter for first-time hints
  // no cleanup needed — one-time AsyncStorage read, promise resolves after unmount harmlessly
  useEffect(() => {
    AsyncStorage.getItem(GAMES_PLAYED_KEY).then(val => {
      setGamesPlayed(parseInt(val ?? '0', 10));
    }).catch(() => {});
  }, []);

  // Initialize game
  // no cleanup needed — bot timers are pushed to timeoutsRef.current, cleared by the central cleanup effect above
  useEffect(() => {
    const { boards: initialBoards, playerHand: pHand, botHands } = initializeGameMulti(numberOfPlayers);
    setBoards(initialBoards);
    setPlayerHand(pHand);
    setBotsReady(new Array(numberOfBots).fill(false));
    botsReadyCountRef.current = 0;
    playerReadyRef.current = false;
    hasNavigatedRef.current = false;
    CapsHooks.gameStarted('solo');

    // Deduct buy-in
    const buyIn = getMatchCost(config.potPerBoard, boardCount);
    addChips(-buyIn);
    if (ECONOMY_FLAGS.matchCostEnabled) {
      trackChipsSpent(buyIn);
    }

    // Bot timers — when first bot finishes, it triggers the countdown
    for (let botIdx = 0; botIdx < numberOfBots; botIdx++) {
      const delay = config.botSpeedMin + Math.random() * (config.botSpeedMax - config.botSpeedMin);
      const botCards = botHands[botIdx];
      const botTimer = setTimeout(() => {
        if (!mountedRef.current) return;
        setBoards((prev) => placeSingleBotCards(botCards, prev, botIdx));
        setBotsReady((prev) => {
          const updated = [...prev];
          updated[botIdx] = true;
          const anyPrevReady = prev.some(Boolean);
          if (!anyPrevReady) startCountdown(`Bot ${botIdx + 1}`);
          return updated;
        });
        // If player already pressed READY and all bots are now done — navigate directly
        botsReadyCountRef.current++;
        if (playerReadyRef.current && botsReadyCountRef.current >= numberOfBots) {
          doNavigateRef.current(boardsRef.current);
        }
      }, delay);
      timeoutsRef.current.push(botTimer);
    }
  }, []);

  // Navigate to reveal — DIRECT (no InteractionManager, no async chain)
  // Called as soon as both player and all bots are ready.
  const doNavigate = useCallback((currentBoards: BoardState[]) => {
    debugLog('1 doNavigate called');
    if (hasNavigatedRef.current || !mountedRef.current) { debugLog('1.1 already navigated or unmounted — abort'); return; }
    debugLog('2 hasNavigatedRef=true');
    hasNavigatedRef.current = true;

    void logStep('doNavigate_start');

    debugLog('3 clearing countdown interval');
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }

    debugLog('4 calculateHandResultsMulti START');
    void logStep('A:start_calculate');

    let results;
    try {
      if (precalculatedResultsRef.current) {
        debugLog('4.1 using pre-calculated results');
        results = precalculatedResultsRef.current;
        precalculatedResultsRef.current = null;
      } else {
        debugLog('4.2 calculating fresh');
        results = calculateHandResultsMulti(currentBoards, numberOfPlayers, config);
      }
    } catch (e) {
      debugLog(`4E calculateHandResultsMulti CRASHED: ${String(e)}`, 'error');
      void logStep('CRASH:A', String(e));
      router.replace('/');
      return;
    }

    debugLog(`5 calculate DONE: won=${results.playerChipsWon} isComplete=${results.isComplete}`);
    void logStep('B:calculate_done', `boards=${currentBoards.length} won=${results.playerChipsWon}`);

    debugLog('6 building revealBoards');
    const revealBoards: RevealBoardData[] = currentBoards.map((board, i) => {
      debugLog(`6.${i + 1} board ${i}: ${results.boardResults[i]?.winner ?? 'tie'}`);
      const result = results.boardResults[i];
      return {
        openCards: board.openCards,
        closedCards: board.closedCards,
        playerCards: board.playerCards,
        allBotCards: board.allBotCards,
        winner: result ? result.winner : ('tie' as const),
        playerHandName: result?.playerResult.name || '',
        botHandName: result?.botResult.name || '',
        allBotHandNames: results.allBotResults[i]?.map((br) => br.name) || [],
        playerHighlightIds: result ? result.playerResult.playerCardsUsed.map((c) => c.id) : [],
        botHighlightIds: result ? result.botResult.playerCardsUsed.map((c) => c.id) : [],
        boardHighlightIds: result ? [
          ...result.playerResult.boardCardsUsed.map((c) => c.id),
          ...result.botResult.boardCardsUsed.map((c) => c.id),
        ] : [],
        potAmount: config.potPerBoard * numberOfPlayers,
      };
    });

    debugLog(`7 revealBoards done: ${revealBoards.length} boards`);
    void logStep('C:revealBoards_built');

    debugLog(`8 addChips: ${results.playerChipsWon}`);
    addChips(results.playerChipsWon);
    debugLog('9 addChips done');
    void logStep('D:addChips_done');

    debugLog('10 setRevealData START');
    setRevealData({
      boards: revealBoards,
      netChips: results.playerChipsWon - config.potPerBoard * boardCount,
      playerChipsWon: results.playerChipsWon,
      isComplete: results.isComplete,
      completeBonusAmount: results.completeBonusAmount,
      completeWinner: results.completeWinner,
      boardRevealDuration: config.boardRevealDuration,
      completeBonusDisplay: config.completeBonusDisplay,
      turnRevealDelay: config.turnRevealDelay,
      potPerBoard: config.potPerBoard,
      numberOfPlayers,
      boardCount,
    });
    debugLog('11 setRevealData DONE');
    void logStep('E:setRevealData_done');

    debugLog('12 CapsHooks.gameCompleted');
    CapsHooks.gameCompleted(results.playerChipsWon, results.playerChipsWon > 0, 0);
    debugLog('13 AsyncStorage update');
    AsyncStorage.getItem(GAMES_PLAYED_KEY).then(val => {
      const count = parseInt(val ?? '0', 10);
      AsyncStorage.setItem(GAMES_PLAYED_KEY, String(count + 1)).catch(() => {});
    }).catch(() => {});

    // Cancel all shake animations before navigation — prevents worklet overlap during transition
    cancelAnimation(shake0); shake0.value = 0;
    cancelAnimation(shake1); shake1.value = 0;
    cancelAnimation(shake2); shake2.value = 0;
    cancelAnimation(shake3); shake3.value = 0;

    // Mark game active before navigating to results — dirty shutdown detector
    debugLog('🎮 setting game active flag (dirty shutdown detector)');
    void markGameActive();

    // Show safe reveal overlay before navigating (skip in auto-sim to avoid delays)
    debugLog('14 showSafeReveal path — setting overlay');
    if (autoSim !== 'true') {
      const revealSummary = revealBoards.map((b) => ({
        winner: b.winner ?? 'tie' as const,
        playerHandName: b.playerHandName ?? '',
        botHandName: b.botHandName ?? '',
        openCards: b.openCards,
        closedCards: b.closedCards,
        playerCards: b.playerCards,
        botCards: (b.allBotCards?.[0]) ?? [],
        potAmount: b.potAmount,
      }));
      setPendingRevealBoards(revealSummary);
      setShowSafeReveal(true);
      return; // navigation happens from onRevealDone
    }

    debugLog('14 router.replace /results START');
    void logStep('F:before_router_replace');
    try {
      router.replace('/results' as any);
      debugLog('15 router.replace DONE');
      void logStep('G:router_replace_called');
    } catch (e) {
      debugLog(`14E router.replace CRASHED: ${String(e)}`, 'error');
      try { router.push('/results' as any); } catch { /* ignore */ }
    }
  }, [config, numberOfPlayers, boardCount, setRevealData, addChips, router, autoSim]);

  // Keep doNavigate in a ref so bot timers always call the latest version
  const doNavigateRef = useRef(doNavigate);
  useEffect(() => { doNavigateRef.current = doNavigate; }, [doNavigate]); // no cleanup needed — sync ref update

  const onRevealDone = useCallback(() => {
    debugLog('15 onRevealDone called — clearing overlay');
    setShowSafeReveal(false);
    setPendingRevealBoards([]);
    debugLog('16 navigating to results');
    void logStep('F:before_router_replace');
    try {
      router.replace('/results' as any);
    } catch (e) {
      try { router.push('/results' as any); } catch {}
    }
  }, [router]);

  const allBotsReady = botsReady.length > 0 && botsReady.every(Boolean);

  // Tap card in hand → toggle in selectedCardIds (up to 4)
  const handleSelectCard = useCallback(
    (card: Card) => {
      if (!isArranging) return;
      haptic(Haptics?.ImpactFeedbackStyle?.Light);
      playSound('cardSelect');
      setSelectedCardIds((prev) => {
        if (prev.includes(card.id)) {
          // Deselect
          return prev.filter((id) => id !== card.id);
        }
        if (prev.length < 4) {
          return [...prev, card.id];
        }
        // At max (4) — replace the last selected with new card
        return [...prev.slice(0, 3), card.id];
      });
    },
    [isArranging]
  );

  // Returns true if card is already placed on ANY board — cross-board duplicate guard
  const isCardOnAnyBoard = useCallback(
    (cardId: string, currentBoards: BoardState[]) =>
      currentBoards.some((b) => b.playerCards.some((pc) => pc.id === cardId)),
    []
  );

  // Tap board → place all selectedCardIds (or first hand card if none selected)
  // FIX: compute cardsToPlace outside setBoards updater; call setPlayerHand separately
  // in same event handler so React batches all three setState calls together, eliminating
  // the intermediate render where a card appears in both the board and the hand.
  const handleBoardPress = useCallback(
    (boardIndex: number) => {
      if (!isArranging) return;
      const currentHand = playerHandRef.current;
      if (currentHand.length === 0) return;

      // Read board from current closure — safe since boards is a dep of this callback
      const board = boards[boardIndex];
      if (!board) return;

      const emptySlots = CARDS_PER_BOARD - board.playerCards.length;
      if (emptySlots <= 0) {
        // Board full — shake + error
        const sv = boardShakes[boardIndex];
        if (sv) {
          sv.value = withSequence(
            withTiming(-6, { duration: 55 }),
            withTiming(6, { duration: 55 }),
            withTiming(-4, { duration: 55 }),
            withTiming(0, { duration: 55 }),
          );
        }
        if (boardErrorTimer.current) clearTimeout(boardErrorTimer.current);
        setBoardError('Board is full');
        boardErrorTimer.current = setTimeout(() => setBoardError(null), 1500);
        return;
      }

      // Determine which cards to place, excluding any already on any board
      const candidateCards: Card[] = selectedCardIds.length > 0
        ? selectedCardIds
            .map((id) => currentHand.find((c) => c.id === id))
            .filter((c): c is Card => c !== undefined)
        : currentHand.slice(0, 1);

      const cardsToPlace = candidateCards
        .filter((c) => !isCardOnAnyBoard(c.id, boards))
        .slice(0, emptySlots);

      if (cardsToPlace.length === 0) return;

      haptic(Haptics?.ImpactFeedbackStyle?.Medium);
      playSound('cardPlace');
      const placedIds = new Set(cardsToPlace.map((c) => c.id));

      // All three setState calls are in the same synchronous event handler —
      // React 18 batches them into one render, preventing duplicate-card flicker
      setBoards((prev) => {
        const prevBoard = prev[boardIndex];
        if (!prevBoard) return prev;
        // Re-validate in updater: guard against stale closure AND cross-board duplicates
        const slots = CARDS_PER_BOARD - prevBoard.playerCards.length;
        const validCards = cardsToPlace.filter((c) =>
          !prev.some((b) => b.playerCards.some((pc) => pc.id === c.id))
        ).slice(0, slots);
        if (validCards.length === 0) return prev;
        const updated = [...prev];
        updated[boardIndex] = {
          ...prevBoard,
          playerCards: [...prevBoard.playerCards, ...validCards],
        };
        return updated;
      });
      setPlayerHand((hand) => hand.filter((c) => !placedIds.has(c.id)));
      setSelectedCardIds([]);
    },
    [isArranging, selectedCardIds, boards, isCardOnAnyBoard]
  );

  // Tap placed card → remove from board
  const handleRemoveCardFromBoard = useCallback(
    (boardIndex: number, card: Card) => {
      if (!isArranging) return;
      haptic(Haptics?.ImpactFeedbackStyle?.Light);
      playSound('cardSelect');
      setBoards((prev) => {
        if (!prev[boardIndex]) return prev;
        const updated = [...prev];
        updated[boardIndex] = {
          ...prev[boardIndex],
          playerCards: prev[boardIndex].playerCards.filter((c) => c.id !== card.id),
        };
        return updated;
      });
      setPlayerHand((prev) => [...prev, card]);
    },
    [isArranging]
  );

  // AUTO fill — place first N available hand cards into an empty board
  // FIX: same batched setState approach as handleBoardPress + cross-board duplicate guard
  const handleAutoFill = useCallback(
    (boardIndex: number) => {
      if (!isArranging) return;
      const currentHand = playerHandRef.current;
      if (currentHand.length === 0) return;
      const board = boards[boardIndex];
      if (!board || board.playerCards.length > 0) return;
      const slots = CARDS_PER_BOARD - board.playerCards.length;
      // Only place cards not already on any board
      const cardsToPlace = currentHand
        .filter((c) => !isCardOnAnyBoard(c.id, boards))
        .slice(0, slots);
      if (cardsToPlace.length === 0) return;
      haptic(Haptics?.ImpactFeedbackStyle?.Medium);
      playSound('cardPlace');
      const placedIds = new Set(cardsToPlace.map((c) => c.id));
      setBoards((prev) => {
        const prevBoard = prev[boardIndex];
        if (!prevBoard || prevBoard.playerCards.length > 0) return prev;
        // Re-validate cross-board in updater
        const validCards = cardsToPlace.filter((c) =>
          !prev.some((b) => b.playerCards.some((pc) => pc.id === c.id))
        );
        if (validCards.length === 0) return prev;
        const updated = [...prev];
        updated[boardIndex] = { ...prevBoard, playerCards: [...prevBoard.playerCards, ...validCards] };
        return updated;
      });
      setPlayerHand((hand) => hand.filter((c) => !placedIds.has(c.id)));
      setSelectedCardIds([]);
    },
    [isArranging, boards, isCardOnAnyBoard]
  );

  const allBoardsFull = boards.every((b) => b.playerCards.length === CARDS_PER_BOARD);

  const handleReady = useCallback(() => {
    trackAction('deal_pressed')
    debugLog('H1 handleReady called');
    if (!allBoardsFull) { debugLog('H1.1 NOT allBoardsFull — abort'); return; }
    debugLog(`H2 boards: ${boards.map(b => `${b.playerCards.length}/4`).join(' ')}`);
    void logStep('handleReady_pressed');
    debugLog('H3 hapticNotify');
    hapticNotify(Haptics?.NotificationFeedbackType?.Success);
    debugLog('H4 playSound');
    playSound('cardSelect');
    debugLog('H5 setSelectedCardIds([])');
    setSelectedCardIds([]);
    debugLog('H6 setPlayerReady(true)');
    setPlayerReady(true);
    debugLog('H7 setPhase(waiting_for_bot)');
    setPhase({ type: 'waiting_for_bot' });
    debugLog('H8 playerReadyRef=true');
    playerReadyRef.current = true;
    debugLog(`H9 countdownActive=${countdownActive}`);
    if (!countdownActive) { debugLog('H9.1 startCountdown'); startCountdown('You'); }
    debugLog(`H10 botsReady=${botsReadyCountRef.current}/${numberOfBots}`);
    if (botsReadyCountRef.current >= numberOfBots) {
      debugLog('H10.1 all bots done — calling doNavigate');
      doNavigateRef.current(boardsRef.current);
    } else {
      debugLog('H10.2 bots still running — waiting');
    }
  }, [allBoardsFull, boards, countdownActive, startCountdown, numberOfBots]);

  // Auto-sim: auto-fill all boards + press Ready (debug marathon mode)
  useEffect(() => {
    if (autoSim !== 'true') return;
    const simCount = parseInt(autoSimCount ?? '1', 10);
    const currentHand = parseInt(currentSimHand ?? '1', 10);
    debugLog(`🤖 AUTO-SIM: hand ${currentHand}/${simCount} — auto-fill in 1.5s`);
    const t1 = setTimeout(() => {
      debugLog('🤖 AUTO-SIM: filling all boards');
      for (let i = 0; i < boardCount; i++) handleAutoFill(i);
    }, 1500);
    const t2 = setTimeout(() => {
      debugLog('🤖 AUTO-SIM: pressing READY');
      handleReady();
    }, 3000);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [autoSim]);

  const handleBack = useCallback(() => {
    const leave = () => {
      if (router.canGoBack()) {
        router.back();
      } else {
        router.replace('/');
      }
    };

    // On web, Alert.alert uses window.confirm which is unreliable — navigate directly
    if (Platform.OS === 'web') {
      leave();
      return;
    }

    if (isArranging || phase.type === 'waiting_for_bot') {
      Alert.alert(
        'Leave Game?',
        'You will lose your pot for this hand.',
        [
          { text: 'Stay', style: 'cancel' },
          { text: 'Leave', style: 'destructive', onPress: leave },
        ]
      );
    } else {
      leave();
    }
  }, [isArranging, phase.type, router]);

  // Timer display
  const timerColor = countdown > 20
    ? '#4CAF50'
    : countdown > 10
    ? '#FFC107'
    : '#e74c3c';
  const timerPulsing = countdown <= 10 && countdown > 0;

  const readyBotCount = botsReady.filter(Boolean).length;
  const cardsRemaining = playerHand.length;
  const TIMER_SIZE = rv(52);

  // ── Landscape / widescreen layout ──────────────────────────────────────────
  if (isLandscape) {
    return (
      <SafeAreaView style={[styles.container, landscapeStyles.root, { backgroundColor: theme.background }, Platform.OS === 'web' && visualTheme === 'fiveo' && { background: 'radial-gradient(ellipse at 50% 40%, #5A1520 0%, #1C0508 70%)' } as any]}>
        <FriendsBg />
        {visualTheme === 'fiveo' && (
          <View pointerEvents="none" style={styles.fiveoWatermark}>
            <Text style={styles.fiveoWatermarkText}>CAPS POKER</Text>
          </View>
        )}
        {/* LEFT — Your hand */}
        <View style={[landscapeStyles.leftPanel, visualTheme === 'fiveo' && { backgroundColor: theme.surface }]}>
          <View style={landscapeStyles.panelTitleRow}>
            <Text style={landscapeStyles.panelAvatarText}>{playerAvatar}</Text>
            <Text style={landscapeStyles.panelTitle}>{playerDisplayName.toUpperCase()}</Text>
          </View>
          {isArranging && (
            <PlayerHand
              cards={playerHand}
              selectedCardIds={selectedCardIds}
              onSelectCard={handleSelectCard}
            />
          )}
          {isArranging && (boardError || selectedCardIds.length > 0) && (
            <Text style={boardError ? styles.boardErrorText : styles.selectionHint}>
              {boardError
                ? boardError
                : `${selectedCardIds.length} selected`}
            </Text>
          )}
          {isArranging && (
            <Pressable
              style={[styles.floatingBtn, styles.undoBtn, { marginTop: 8 }]}
              onPress={() => {
                for (let i = boards.length - 1; i >= 0; i--) {
                  if (boards[i].playerCards.length > 0) {
                    const last = boards[i].playerCards[boards[i].playerCards.length - 1];
                    handleRemoveCardFromBoard(i, last);
                    break;
                  }
                }
              }}
              disabled={boards.every((b) => b.playerCards.length === 0)}
            >
              <Text style={[styles.floatingBtnText, boards.every((b) => b.playerCards.length === 0) && styles.floatingBtnDisabled]}>{t().undo}</Text>
            </Pressable>
          )}
        </View>

        {/* CENTER — boards grid */}
        <View style={landscapeStyles.centerPanel}>
          {/* Mini top bar */}
          <View style={styles.topBar}>
            <Pressable onPress={handleBack} style={styles.backButton}>
              <Text style={styles.backText}>{'\u2715'}</Text>
            </Pressable>
            <View style={styles.topCenter}>
              {countdownActive && isArranging && (
                <CircularTimer timeLeft={countdown} size={44} color={timerColor} pulsing={timerPulsing} />
              )}
              {!countdownActive && isArranging && (
                <Text style={styles.freePlayLabel}>Arrange freely</Text>
              )}
              {playerReady && !allBotsReady && (
                <Text style={styles.waitingText}>Waiting for bots...</Text>
              )}
            </View>
            <ChipsDisplay amount={chips} />
          </View>

          {/* Boards — 2 columns */}
          <View style={[landscapeStyles.boardsGrid]}>
            {boards.map((board, i) => (
              <Animated.View key={i} style={[landscapeStyles.boardCell, boardShakeStyles[i]]}>
                <Board
                  index={i}
                  openCards={board.openCards}
                  closedCards={board.closedCards}
                  playerCards={board.playerCards}
                  botCards={board.allBotCards[0] || board.botCards}
                  allBotCards={board.allBotCards}
                  revealed={false}
                  active={false}
                  potAmount={config.potPerBoard * numberOfPlayers}
                  onPress={() => handleBoardPress(i)}
                  onRemoveCard={(card) => handleRemoveCardFromBoard(i, card)}
                  onAutoFill={() => handleAutoFill(i)}
                  isArrangement={isArranging}
                  selected={isArranging && cardsRemaining > 0 && board.playerCards.length < CARDS_PER_BOARD}
                  cardHeight={BOARD_CARD_H}
                  communityScale={communityScale}
                />
              </Animated.View>
            ))}
          </View>
        </View>

        {/* RIGHT — bot + ready */}
        <View style={[landscapeStyles.rightPanel, visualTheme === 'fiveo' && { backgroundColor: theme.surface }]}>
          <Text style={landscapeStyles.panelTitle}>
            {numberOfBots === 1 ? 'BOT' : `BOTS ${readyBotCount}/${numberOfBots}`}
          </Text>
          <View style={[styles.botStatusPill, allBotsReady ? styles.botReadyPill : styles.botThinkingPill, { marginTop: 4 }]}>
            <Text style={[styles.botStatusText, allBotsReady ? styles.botReadyText : styles.botThinkingText, { textAlign: 'center' }]}>
              {allBotsReady ? `✓ ${t().ready}` : '…'}
            </Text>
          </View>
          {isArranging && (
            <Pressable
              style={[styles.floatingBtn, styles.placeBtn, !allBoardsFull && styles.placeBtnDisabled, allBoardsFull && styles.placeBtnReady, landscapeStyles.readyBtn]}
              onPress={handleReady}
              disabled={!allBoardsFull}
            >
              <Text style={[styles.floatingBtnText, styles.placeBtnText]}>
                {allBoardsFull ? t().ready : t().placeN(cardsRemaining)}
              </Text>
            </Pressable>
          )}
          {playerReady && allBotsReady && showContinueButton && (
            <Pressable style={[styles.continueBtn, { position: 'relative', bottom: 0 }]} onPress={() => doNavigateRef.current(boardsRef.current)}>
              <Text style={styles.continueBtnText}>CONTINUE →</Text>
            </Pressable>
          )}
        </View>
      {showSafeReveal && (
        <BoardReveal boards={pendingRevealBoards} onDone={onRevealDone} />
      )}
      </SafeAreaView>
    );
  }
  // ── End landscape layout ────────────────────────────────────────────────────

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }, Platform.OS === 'web' && visualTheme === 'fiveo' && { background: 'radial-gradient(ellipse at 50% 40%, #5A1520 0%, #1C0508 70%)' } as any]}>
      <FriendsBg />
      {visualTheme === 'fiveo' && (
        <View pointerEvents="none" style={styles.fiveoWatermark}>
          <Text style={styles.fiveoWatermarkText}>CAPS POKER</Text>
        </View>
      )}
      <Animated.View entering={FadeIn.duration(300)} style={{ flex: 1 }}>
      {/* Header bar */}
      <View style={styles.topBar}>
        <Pressable onPress={handleBack} style={styles.backButton}>
          <Text style={styles.backText}>{'\u2715'}</Text>
        </Pressable>
        <View style={styles.topCenter}>
          {countdownActive && isArranging && (
            <View style={styles.countdownSection}>
              <CircularTimer
                timeLeft={countdown}
                size={TIMER_SIZE}
                color={timerColor}
                pulsing={timerPulsing}
              />
              <Text style={styles.countdownLabel}>{firstFinisher ? t().botFinished : ''}</Text>
            </View>
          )}
          {!countdownActive && isArranging && (
            <Text style={styles.freePlayLabel}>
              {cardsRemaining === 0 ? t().allPlaced : `ARRANGE ${cardsRemaining} CARDS`}
            </Text>
          )}
          {playerReady && !allBotsReady && (
            <Text style={styles.waitingText}>
              Waiting for bot{numberOfBots > 1 ? 's' : ''}...
            </Text>
          )}
          {playerReady && allBotsReady && !showContinueButton && !showSafeReveal && (
            <Text style={styles.calculatingText}>Calculating results...</Text>
          )}
        </View>
        <ChipsDisplay amount={chips} />
      </View>

      {/* Bot status bar */}
      <View style={[styles.botSection, { backgroundColor: theme.surface, borderTopWidth: 1, borderBottomWidth: 1, borderColor: theme.boardBorder }]}>
        <View style={styles.botStatusRow}>
          <Text style={styles.botEmoji}>🤖</Text>
          <Text style={styles.botNameLabel}>
            {numberOfBots === 1 ? 'BOT' : `BOTS ${readyBotCount}/${numberOfBots}`}
          </Text>
          <View style={[styles.botStatusPill, allBotsReady ? styles.botReadyPill : styles.botThinkingPill]}>
            <Text style={[styles.botStatusText, allBotsReady ? styles.botReadyText : styles.botThinkingText]}>
              {allBotsReady ? `✓ ${t().ready}` : '…'}
            </Text>
          </View>
        </View>
      </View>

      {/* Timer progress bar — thin bar below bot section, only during countdown */}
      {countdownActive && isArranging && (
        <TimerBar countdown={countdown} total={COUNTDOWN_SECONDS} color={timerColor} />
      )}

      {/* Boards */}
      <View style={isWeb ? styles.boardsGrid : styles.boardsColumn}>
        {boards.map((board, i) => (
          <Animated.View
            key={i}
            style={[
              isWeb ? (boardCount === 3 ? styles.boardCellThird : styles.boardCellHalf) : styles.boardCellFull,
              isWeb && screenW < 500 && { paddingHorizontal: 2, paddingVertical: 2 },
              boardShakeStyles[i],
            ]}
          >
            <Board
              index={i}
              openCards={board.openCards}
              closedCards={board.closedCards}
              playerCards={board.playerCards}
              botCards={board.allBotCards[0] || board.botCards}
              allBotCards={board.allBotCards}
              revealed={false}
              active={false}
              potAmount={config.potPerBoard * numberOfPlayers}
              onPress={() => handleBoardPress(i)}
              onRemoveCard={(card) => handleRemoveCardFromBoard(i, card)}
              onAutoFill={() => handleAutoFill(i)}
              isArrangement={isArranging}
              selected={isArranging && cardsRemaining > 0 && board.playerCards.length < CARDS_PER_BOARD}
              cardHeight={BOARD_CARD_H}
              communityScale={communityScale}
            />
          </Animated.View>
        ))}
      </View>

      {/* Fallback continue button — shows 3s after both ready if auto-nav failed */}
      {playerReady && allBotsReady && showContinueButton && (
        <Pressable
          style={styles.continueBtn}
          onPress={() => {
            console.log('[GAME] fallback button pressed — calling doNavigate manually');
            doNavigateRef.current(boardsRef.current);
          }}
        >
          <Text style={styles.continueBtnText}>TAP TO CONTINUE →</Text>
        </Pressable>
      )}

      {/* Player hand */}
      {isArranging && (
        <PlayerHand
          cards={playerHand}
          selectedCardIds={selectedCardIds}
          onSelectCard={handleSelectCard}
        />
      )}

      {/* Selection hint / board error */}
      {isArranging && (boardError || selectedCardIds.length > 0) && (
        <Text style={boardError ? styles.boardErrorText : styles.selectionHint}>
          {boardError
            ? boardError
            : `${selectedCardIds.length} card${selectedCardIds.length !== 1 ? 's' : ''} selected — tap a board`}
        </Text>
      )}

      {/* First-time hint bar (first 3 games only) */}
      {isArranging && !boardError && gamesPlayed < 3 && (
        <View style={styles.firstTimeHint}>
          <Text style={styles.firstTimeHintText}>{HINT_TEXTS[Math.min(gamesPlayed, 2)]}</Text>
        </View>
      )}

      {/* Pro quote tip during arrangement — shown after 3 games */}
      {isArranging && !boardError && selectedCardIds.length === 0 && gamesPlayed >= 3 && (
        <ProQuoteBanner context="tutorial" />
      )}

      {/* Time bank button — visible when countdown < 20s and not yet used */}
      {isArranging && countdownActive && countdown < 20 && !timeBankUsed && (
        <Pressable
          style={styles.timeBankBtn}
          onPress={() => {
            setTimeBankUsed(true);
            setCountdown((prev) => prev + 15);
          }}
        >
          <Text style={styles.timeBankText}>⏱ {t().timeBank}</Text>
        </Pressable>
      )}

      {/* WIN ALL bonus hint */}
      {isArranging && allBoardsFull && (
        <Text style={styles.winAllHint}>
          {t().winAll(config.potPerBoard * boardCount * numberOfPlayers + Math.round(config.potPerBoard * boardCount * 0.5))}
        </Text>
      )}

      {/* Floating action buttons */}
      {isArranging && (
        <View style={styles.floatingActions}>
          <Pressable
            style={[styles.floatingBtn, styles.undoBtn]}
            onPress={() => {
              for (let i = boards.length - 1; i >= 0; i--) {
                if (boards[i].playerCards.length > 0) {
                  const lastCard = boards[i].playerCards[boards[i].playerCards.length - 1];
                  handleRemoveCardFromBoard(i, lastCard);
                  break;
                }
              }
            }}
            disabled={boards.every((b) => b.playerCards.length === 0)}
          >
            <Text style={[styles.floatingBtnText, boards.every((b) => b.playerCards.length === 0) && styles.floatingBtnDisabled]}>UNDO</Text>
          </Pressable>
          <Pressable
            style={[styles.floatingBtn, styles.placeBtn, !allBoardsFull && styles.placeBtnDisabled, allBoardsFull && styles.placeBtnReady]}
            onPress={handleReady}
            disabled={!allBoardsFull}
          >
            <Text style={[styles.floatingBtnText, styles.placeBtnText]}>
              {allBoardsFull ? '✓ READY' : `PLACE ${cardsRemaining}`}
            </Text>
          </Pressable>
        </View>
      )}
      </Animated.View>
      {showSafeReveal && (
        <BoardReveal boards={pendingRevealBoards} onDone={onRevealDone} />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  fiveoWatermark: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
    ...Platform.select({
      default: { userSelect: 'none' } as any,
    }),
  },
  fiveoWatermarkText: {
    fontSize: rf(52),
    fontWeight: '900',
    letterSpacing: 8,
    color: 'rgba(255,120,120,0.10)',
    textTransform: 'uppercase' as any,
    textAlign: 'center' as any,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: rs(12),
    paddingVertical: rs(4),
    zIndex: 10,
  },
  backButton: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 18,
    ...Platform.select({ web: { cursor: 'pointer' } as any }),
  },
  backText: {
    color: COLORS.textSecondary,
    fontSize: rf(16),
    fontWeight: '600',
  },
  topCenter: {
    alignItems: 'center',
  },
  countdownSection: {
    alignItems: 'center',
    gap: 2,
  },
  countdownLabel: {
    color: '#FFC107',
    fontSize: rf(10),
    fontWeight: '700',
    letterSpacing: 1,
  },
  freePlayLabel: {
    color: COLORS.textMuted,
    fontSize: rf(12),
    fontWeight: '700',
    letterSpacing: 1.5,
    paddingHorizontal: rs(12),
    paddingVertical: rs(4),
    borderRadius: rv(12),
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    overflow: 'hidden',
    textTransform: 'uppercase' as any,
  },
  botSection: {
    paddingVertical: rs(4),
    paddingHorizontal: rs(12),
    zIndex: 10,
  },
  botStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: rs(8),
  },
  botEmoji: {
    fontSize: rf(14),
  },
  botNameLabel: {
    color: COLORS.textSecondary,
    fontSize: rf(11),
    fontWeight: '800',
    letterSpacing: 1.5,
    textTransform: 'uppercase' as any,
  },
  botStatusPill: {
    paddingHorizontal: rs(8),
    paddingVertical: 2,
    borderRadius: rv(10),
  },
  botReadyPill: {
    backgroundColor: 'rgba(40,167,69,0.2)',
    borderWidth: 1,
    borderColor: 'rgba(40,167,69,0.5)',
  },
  botThinkingPill: {
    backgroundColor: 'rgba(255,193,7,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255,193,7,0.4)',
  },
  botStatusText: {
    fontSize: rf(10),
    fontWeight: '800',
    letterSpacing: 1,
  },
  botReadyText: {
    color: '#28A745',
  },
  botThinkingText: {
    color: '#FFC107',
  },
  botLabel: {
    color: COLORS.textSecondary,
    fontSize: rf(11),
    fontWeight: '700',
    letterSpacing: 1,
  },
  boardsColumn: {
    flex: 1,
    flexDirection: 'column',
    paddingHorizontal: rs(16),
    gap: rs(4),
  },
  boardsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'stretch',
    alignContent: 'stretch',
    paddingHorizontal: Platform.OS === 'web' ? 12 : 8,
    paddingVertical: Platform.OS === 'web' ? 8 : 0,
    width: '100%',
    flex: 1,
  },
  boardCellFull: {
    flex: 1,
  },
  boardCellHalf: {
    width: '50%',
    minHeight: Platform.OS === 'web' ? 200 : undefined,
    paddingHorizontal: Platform.OS === 'web' ? 6 : 4,
    paddingVertical: Platform.OS === 'web' ? 4 : 4,
  },
  boardCellThird: {
    width: '33.33%',
    paddingHorizontal: rs(4),
    paddingVertical: 2,
  },
  waitingText: {
    color: COLORS.textSecondary,
    fontSize: rf(14),
    fontWeight: '600',
  },
  calculatingText: {
    color: COLORS.gold,
    fontSize: rf(14),
    fontWeight: '700',
    letterSpacing: 1,
  },
  selectionHint: {
    textAlign: 'center',
    color: COLORS.gold,
    fontSize: rf(12),
    fontWeight: '700',
    letterSpacing: 0.5,
    paddingVertical: rs(4),
  },
  firstTimeHint: {
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingVertical: rs(4),
    paddingHorizontal: rs(12),
    alignItems: 'center',
    marginHorizontal: rs(4),
    borderRadius: rv(8),
  },
  firstTimeHintText: {
    color: '#FFFFFF',
    fontSize: rf(12),
    fontWeight: '500',
    textAlign: 'center',
  },
  boardErrorText: {
    textAlign: 'center',
    color: COLORS.neonRed,
    fontSize: rf(12),
    fontWeight: '700',
    letterSpacing: 0.5,
    paddingVertical: rs(4),
  },
  timeBankBtn: {
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderWidth: 1,
    borderColor: COLORS.gold,
    borderRadius: rv(16),
    paddingHorizontal: rs(16),
    paddingVertical: rs(5),
    marginBottom: rs(2),
  },
  timeBankText: {
    color: COLORS.gold,
    fontSize: rf(12),
    fontWeight: '800',
    letterSpacing: 1,
  },
  winAllHint: {
    textAlign: 'center',
    color: COLORS.goldBright,
    fontSize: rf(11),
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: rs(2),
    opacity: 0.85,
  },
  floatingActions: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: rs(12),
    paddingHorizontal: rs(20),
    paddingVertical: rs(10),
    zIndex: 10,
  },
  floatingBtn: {
    paddingVertical: rs(12),
    paddingHorizontal: rs(28),
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: rv(24),
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 6,
      },
      android: { elevation: 6 },
      default: {},
    }),
  },
  undoBtn: {
    backgroundColor: COLORS.surfaceRaised,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  placeBtn: {
    backgroundColor: COLORS.gold,
    flex: 1,
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: COLORS.gold,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.5,
        shadowRadius: 8,
      },
      android: { elevation: 8 },
      default: {},
    }),
  },
  placeBtnDisabled: {
    backgroundColor: COLORS.goldDim,
    opacity: 0.6,
  },
  placeBtnReady: {
    backgroundColor: '#28A745',
    ...Platform.select({
      ios: {
        shadowColor: '#28A745',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.6,
        shadowRadius: 10,
      },
      android: { elevation: 10 },
      default: {
        boxShadow: '0 4px 16px rgba(40,167,69,0.55)',
      } as any,
    }),
  },
  floatingBtnText: {
    color: COLORS.textPrimary,
    fontSize: rf(14),
    fontWeight: '800',
    letterSpacing: 2,
    textAlign: 'center',
  },
  floatingBtnDisabled: {
    opacity: 0.4,
  },
  placeBtnText: {
    color: COLORS.background,
  },
  continueBtn: {
    position: 'absolute',
    bottom: rs(100),
    alignSelf: 'center',
    backgroundColor: COLORS.gold,
    paddingVertical: rs(14),
    paddingHorizontal: rs(40),
    borderRadius: rv(24),
    ...Platform.select({
      ios: {
        shadowColor: COLORS.gold,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.5,
        shadowRadius: 8,
      },
      android: { elevation: 8 },
      default: {},
    }),
  },
  continueBtnText: {
    color: COLORS.background,
    fontSize: rf(16),
    fontWeight: '900',
    letterSpacing: 2,
  },
});

const landscapeStyles = StyleSheet.create({
  root: {
    flexDirection: 'row',
  },
  leftPanel: {
    width: '22%',
    paddingHorizontal: rs(8),
    paddingVertical: rs(8),
    alignItems: 'center',
    borderRightWidth: 1,
    borderRightColor: COLORS.boardBorder,
    gap: rs(6),
  },
  centerPanel: {
    flex: 1,
    flexDirection: 'column',
  },
  boardsGrid: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: rs(6),
    gap: rs(4),
  },
  boardCell: {
    width: '49%',
    flex: undefined,
    minHeight: 120,
  },
  rightPanel: {
    width: '18%',
    paddingHorizontal: rs(8),
    paddingVertical: rs(8),
    alignItems: 'center',
    borderLeftWidth: 1,
    borderLeftColor: COLORS.boardBorder,
    gap: rs(8),
  },
  panelTitle: {
    color: COLORS.gold,
    fontSize: rf(10),
    fontWeight: '900',
    letterSpacing: 2,
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  panelTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: rs(4),
  },
  panelAvatarText: {
    fontSize: rf(14),
  },
  readyBtn: {
    marginTop: 'auto' as any,
    width: '100%',
    paddingHorizontal: rs(8),
    alignItems: 'center',
  },
});

function SafeRevealOverlay({
  boards,
  onDone,
}: {
  boards: Array<{
    winner: 'player'|'bot'|'tie';
    playerHandName: string;
    botHandName: string;
    openCards: Card[];
    closedCards: Card[];
    playerCards: Card[];
    botCards: Card[];
    potAmount: number;
  }>;
  onDone: () => void;
}) {
  const [currentIdx, setCurrentIdx] = useState(0);
  const { width: screenW } = useWindowDimensions();
  const playerAvatar = useGameStore((s) => s.playerAvatar) || '🎰';
  const playerDisplayName = useGameStore((s) => s.playerName) || 'Player 1';
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  // Flip state — pure React state, ZERO new Reanimated shared values here.
  // Card.tsx handles rotateY internally when faceDown prop changes true→false.
  const [commFaceDown, setCommFaceDown] = useState([true, true, true, true, true]);
  const [botFaceDown, setBotFaceDown] = useState([true, true, true, true]);
  const [playerFaceDown, setPlayerFaceDown] = useState([true, true, true, true]);
  const [showResult, setShowResult] = useState(false);
  const flipTimers = useRef<ReturnType<typeof setTimeout>[]>([]);
  // S52: "Tap to reveal" hint — fades out after 1500ms via RN Animated
  const hintOpacity = useRef(new AnimatedRN.Value(1)).current;

  // S52: tap-to-skip — clear all timers, instantly reveal, show result
  const handleSkip = useCallback(() => {
    flipTimers.current.forEach(clearTimeout);
    flipTimers.current = [];
    setCommFaceDown([false, false, false, false, false]);
    setBotFaceDown([false, false, false, false]);
    setPlayerFaceDown([false, false, false, false]);
    setShowResult(true);
    Haptics?.impactAsync?.(Haptics?.ImpactFeedbackStyle?.Light)?.catch?.(() => {});
  }, []);

  // S52: strong hand haptic — fires when showResult becomes true for a player win
  // no cleanup needed — fire-and-forget haptic call, no subscriptions
  useEffect(() => {
    if (!showResult || !board || board.winner !== 'player') return;
    const nameToRank: Record<string, number> = Object.fromEntries(
      (Object.entries(HAND_RANK_NAMES) as [string, string][]).map(([r, n]) => [n, parseInt(r, 10)])
    );
    const rank = nameToRank[board.playerHandName] ?? -1;
    if (rank >= HandRank.Straight) {
      Haptics?.notificationAsync?.(Haptics?.NotificationFeedbackType?.Success)?.catch?.(() => {});
    } else if (rank >= HandRank.TwoPair) {
      Haptics?.impactAsync?.(Haptics?.ImpactFeedbackStyle?.Medium)?.catch?.(() => {});
    }
  }, [showResult]);

  // Reset + start flip stagger whenever the board index changes
  useEffect(() => {
    flipTimers.current.forEach(clearTimeout);
    flipTimers.current = [];
    setCommFaceDown([true, true, true, true, true]);
    setBotFaceDown([true, true, true, true]);
    setPlayerFaceDown([true, true, true, true]);
    setShowResult(false);
    // Reset and fade out "Tap to reveal" hint
    hintOpacity.setValue(1);
    flipTimers.current.push(
      setTimeout(() => {
        AnimatedRN.timing(hintOpacity, { toValue: 0, duration: 400, useNativeDriver: true }).start();
      }, 1500)
    );

    // Sequence: flop 3 cards (150ms apart) → 400ms pause → turn → 300ms pause → river
    //           → bot cards (150ms apart) → player cards (150ms apart) → show result
    const seq: [number, () => void][] = [
      [100,  () => setCommFaceDown(p => { const n=[...p]; n[0]=false; return n; })],
      [250,  () => setCommFaceDown(p => { const n=[...p]; n[1]=false; return n; })],
      [400,  () => setCommFaceDown(p => { const n=[...p]; n[2]=false; return n; })],
      [800,  () => setCommFaceDown(p => { const n=[...p]; n[3]=false; return n; })], // turn
      [1100, () => setCommFaceDown(p => { const n=[...p]; n[4]=false; return n; })], // river
      [1300, () => setBotFaceDown(p => { const n=[...p]; n[0]=false; return n; })],
      [1450, () => setBotFaceDown(p => { const n=[...p]; n[1]=false; return n; })],
      [1600, () => setBotFaceDown(p => { const n=[...p]; n[2]=false; return n; })],
      [1750, () => setBotFaceDown(p => { const n=[...p]; n[3]=false; return n; })],
      [1900, () => setPlayerFaceDown(p => { const n=[...p]; n[0]=false; return n; })],
      [2050, () => setPlayerFaceDown(p => { const n=[...p]; n[1]=false; return n; })],
      [2200, () => setPlayerFaceDown(p => { const n=[...p]; n[2]=false; return n; })],
      [2350, () => setPlayerFaceDown(p => { const n=[...p]; n[3]=false; return n; })],
      [2650, () => setShowResult(true)], // after last card's 300ms flip completes
    ];

    for (const [delay, action] of seq) {
      flipTimers.current.push(setTimeout(action, delay));
    }

    return () => {
      flipTimers.current.forEach(clearTimeout);
      flipTimers.current = [];
    };
  }, [currentIdx]);

  // Auto-advance: 3.5s per board (gives full flip sequence + reading time)
  useEffect(() => {
    const timer = setTimeout(() => {
      if (currentIdx + 1 >= boards.length) {
        onDoneRef.current();
      } else {
        setCurrentIdx(i => i + 1);
      }
    }, 3500);
    return () => clearTimeout(timer);
  }, [currentIdx, boards.length]);

  const advance = () => {
    if (currentIdx + 1 >= boards.length) {
      onDoneRef.current();
    } else {
      setCurrentIdx(i => i + 1);
    }
  };

  const board = boards[currentIdx];
  if (!board) return null;

  const allCommunity = [...board.openCards, ...board.closedCards];
  const resultColor = board.winner === 'player' ? '#4CAF50' : board.winner === 'bot' ? '#F44336' : '#ffffff';
  const resultText = board.winner === 'player' ? '✅ YOU WIN' : board.winner === 'bot' ? '❌ YOU LOSE' : '🤝 TIE';
  const chipDelta = board.winner === 'player'
    ? `+${board.potAmount}`
    : board.winner === 'bot'
    ? `-${board.potAmount}`
    : '±0';
  const chipDeltaColor = board.winner === 'player' ? '#4CAF50' : board.winner === 'bot' ? '#F44336' : '#aaa';

  // Card sizes: fit 5 community cards and 4 player/bot cards in available width
  const pad = 48;
  const commCardW = Math.min(52, Math.floor((screenW - pad - 4 * 6) / 5));
  const commCardH = Math.round(commCardW * 1.4);
  const handCardW = Math.min(58, Math.floor((screenW - pad - 3 * 6) / 4));
  const handCardH = Math.round(handCardW * 1.4);

  return (
    <Modal visible animationType="fade" transparent={false} statusBarTranslucent>
      <SafeAreaView style={safeRevealStyles.container}>
        {/* Header */}
        <View style={safeRevealStyles.header}>
          <Text style={safeRevealStyles.boardCounter}>
            BOARD {currentIdx + 1} / {boards.length}
          </Text>
          <Pressable onPress={() => onDoneRef.current()} hitSlop={16}>
            <Text style={safeRevealStyles.skipText}>SKIP</Text>
          </Pressable>
        </View>

        {/* Tappable main area — skip flip if not yet revealed, advance if revealed */}
        <Pressable style={safeRevealStyles.main} onPress={() => showResult ? advance() : handleSkip()}>
          {/* Community cards — flop then turn then river, staggered */}
          <Text style={safeRevealStyles.rowLabel}>COMMUNITY</Text>
          <View style={safeRevealStyles.cardRow}>
            {allCommunity.map((c, i) => (
              <CardComponent
                key={c.id}
                card={c}
                faceDown={commFaceDown[i] ?? false}
                flipDuration={300}
                cardWidth={commCardW}
                cardHeight={commCardH}
              />
            ))}
          </View>

          {/* Bot hand — flips after community */}
          <Text style={[safeRevealStyles.rowLabel, { marginTop: 14 }]}>BOT HAND</Text>
          <View style={safeRevealStyles.cardRow}>
            {board.botCards.length > 0
              ? board.botCards.map((c, i) => (
                  <CardComponent
                    key={c.id}
                    card={c}
                    faceDown={botFaceDown[i] ?? false}
                    flipDuration={300}
                    cardWidth={handCardW}
                    cardHeight={handCardH}
                  />
                ))
              : <Text style={safeRevealStyles.noCardsText}>—</Text>
            }
          </View>
          {showResult && board.botHandName ? (
            <Text style={safeRevealStyles.handNameSub}>{board.botHandName}</Text>
          ) : null}

          {/* Player hand — flips last */}
          <Text style={[safeRevealStyles.rowLabel, { marginTop: 14 }]}>{playerAvatar} {playerDisplayName.toUpperCase()}</Text>
          <View style={safeRevealStyles.cardRow}>
            {board.playerCards.map((c, i) => (
              <CardComponent
                key={c.id}
                card={c}
                faceDown={playerFaceDown[i] ?? false}
                flipDuration={300}
                cardWidth={handCardW}
                cardHeight={handCardH}
              />
            ))}
          </View>
          {showResult && board.playerHandName ? (
            <Text style={safeRevealStyles.handName}>{board.playerHandName}</Text>
          ) : null}

          {/* Result — appears after all cards revealed */}
          {showResult && (
            <>
              <Text style={[safeRevealStyles.result, { color: resultColor }]}>{resultText}</Text>
              <Text style={[safeRevealStyles.chipDelta, { color: chipDeltaColor }]}>{chipDelta}</Text>
            </>
          )}

          {/* S52: "Tap to reveal" hint — fades out after 1500ms, shows while cards are flipping */}
          {!showResult && (
            <AnimatedRN.Text style={[safeRevealStyles.tapRevealHint, { opacity: hintOpacity }]}>
              Tap to reveal
            </AnimatedRN.Text>
          )}
          {/* Tap hint — shown after result is visible */}
          {showResult && (
            <Text style={safeRevealStyles.tapHint}>
              {currentIdx + 1 < boards.length ? '▶ TAP TO CONTINUE' : '▶ TAP FOR RESULTS'}
            </Text>
          )}
        </Pressable>
      </SafeAreaView>
    </Modal>
  );
}

const safeRevealStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#080d16',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(201,168,76,0.2)',
  },
  boardCounter: {
    color: '#c9a84c',
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 3,
  },
  skipText: {
    color: 'rgba(255,255,255,0.35)',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 2,
  },
  main: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    gap: 4,
  },
  rowLabel: {
    color: 'rgba(255,255,255,0.35)',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 2.5,
    marginBottom: 6,
  },
  cardRow: {
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'center',
  },
  handName: {
    color: '#c9a84c',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 1.5,
    marginTop: 6,
  },
  handNameSub: {
    color: 'rgba(201,168,76,0.6)',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 1,
    marginTop: 4,
  },
  noCardsText: {
    color: 'rgba(255,255,255,0.2)',
    fontSize: 16,
  },
  result: {
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: 1,
    marginTop: 14,
  },
  chipDelta: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: 1,
    marginTop: 4,
  },
  tapHint: {
    color: 'rgba(255,255,255,0.25)',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 2,
    marginTop: 20,
  },
  tapRevealHint: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 11,
    fontWeight: '500',
    letterSpacing: 1,
    marginTop: 16,
  },
});

export default function GameScreen() {
  return (
    <ErrorBoundary>
      <GameScreenInner />
    </ErrorBoundary>
  );
}
