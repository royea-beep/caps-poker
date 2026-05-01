import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, Pressable, StyleSheet, Alert, useWindowDimensions, Platform, Animated as AnimatedRN } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { setCurrentScreen, trackAction } from '../utils/crash-evidence';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSequence,
  withTiming,
  FadeIn,
  cancelAnimation,
} from 'react-native-reanimated';
import Board from '../components/Board';
import PlayerHand from '../components/PlayerHand';
import { ErrorBoundary } from '../components/ErrorBoundary';
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
import { playSound, startAmbient, stopAmbient } from '../utils/sounds';
import { track } from '../utils/analytics';
import { sortHand } from '../utils/sortHand';
import { CapsHooks } from '../utils/learning';
import { FriendsBg } from '../components/FriendsBg';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { markAppActive as markGameActive } from '@caps/debugger';
import { getSupabase } from '../utils/supabase';
import { debugLog } from '../components/DebugOverlay';
import { onGameStart, onGameEnd } from '../utils/crashDetector';
import { scheduleReengagement } from '../utils/notifications';

import { drumRoll, commitArrangement, winSweep, winBoard } from '../lib/haptics';
import { rv as rvOld } from '../constants/deviceBreakpoints';
import { rf, rs, rv } from '../utils/responsive';
import { t, getLanguage } from '../utils/i18n';
import BoardReveal from '../components/BoardReveal';
import GuidedTooltip from '../components/GuidedTooltip';
import { TimerController, TimerBar } from '../components/TimerController';
import { BoardArrangement } from '../components/BoardArrangement';
import { useLevelStore } from '../stores/levelStore';

const GAMES_PLAYED_KEY = 'caps_games_played';
const GUIDED_FORCED_KEY = 'guidedModeForced';

// Tooltip text — inline EN/HE
const TIP = (en: string, he: string) => getLanguage() === 'he' ? he : en;
const TIPS = [
  () => TIP('These are your cards. Place 4 on each board.', 'ÃÂÃÂÃÂ ÃÂÃÂ§ÃÂÃÂ¤ÃÂÃÂ ÃÂ©ÃÂÃÂ. ÃÂªÃÂ©ÃÂÃÂ 4 ÃÂ¢ÃÂ ÃÂÃÂ ÃÂÃÂÃÂ¨ÃÂ.'),
  () => TIP('Tap a card, then tap an empty slot.', 'ÃÂÃÂÃÂ¥ ÃÂ¢ÃÂ ÃÂ§ÃÂÃÂ£, ÃÂÃÂÃÂ ÃÂ¢ÃÂ ÃÂÃÂ§ÃÂÃÂ ÃÂ¨ÃÂÃÂ§.'),
  () => TIP('Nice! 3 more cards on this board.', 'ÃÂÃÂ¢ÃÂÃÂÃÂ! ÃÂ¢ÃÂÃÂ 3 ÃÂ§ÃÂÃÂ¤ÃÂÃÂ ÃÂ¢ÃÂ ÃÂÃÂÃÂÃÂ¨ÃÂ ÃÂÃÂÃÂ.'),
  () => TIP('Hand strength shown here. Better hands win more!', 'ÃÂÃÂ ÃÂÃÂ¨ÃÂÃÂ ÃÂÃÂÃÂ ÃÂÃÂÃÂ§ÃÂ ÃÂÃÂÃÂ ÃÂ©ÃÂÃÂ.'),
  // Tip 5 (index 4) — 2-of-4 rule explainer. autoDismissMs=6000 in JSX.
  () => TIP(
    'The game picks your BEST 2 cards + 3 from the board automatically. You don\'t choose — the strongest combination wins!',
    'ÃÂÃÂÃÂ©ÃÂÃÂ§ ÃÂÃÂÃÂÃÂ¨ ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂª 2 ÃÂÃÂ§ÃÂÃÂ¤ÃÂÃÂ ÃÂÃÂÃÂÃÂÃÂÃÂ ÃÂ©ÃÂÃÂ + 3 ÃÂÃÂÃÂ©ÃÂÃÂÃÂÃÂ. ÃÂÃÂ ÃÂ¦ÃÂ¨ÃÂÃÂ ÃÂÃÂÃÂÃÂÃÂ¨ — ÃÂÃÂ©ÃÂÃÂÃÂÃÂ ÃÂÃÂÃÂÃÂ§ ÃÂÃÂÃÂÃÂªÃÂ¨ ÃÂÃÂ ÃÂ¦ÃÂ!'
  ),
  () => TIP('All set! Tap READY to reveal.', 'ÃÂÃÂÃÂÃÂ! ÃÂÃÂÃÂ¥ READY ÃÂÃÂÃÂ©ÃÂÃÂ¤ÃÂ.'),
];

// Log crash steps to Supabase so we know which step ran last before native kill
async function logStep(step: string, extra?: string) {
  debugLog(`[STEP] ${step}${extra ? ` — ${extra}` : ''}`);
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
  const playerLevel = useLevelStore((s: any) => s.level) ?? 1;
  const storeOrientation = useGameStore((s) => s.orientation);
  const handSortMethod = useGameStore((s) => s.handSortMethod);
  const visualTheme = useGameStore((s) => s.visualTheme);
  const theme = getTheme(visualTheme);
  const isLandscape = false; // S86: portrait-only — Iron Rule 2
  const addChips = useGameStore((s) => s.addChips);
  const trackChipsSpent = useGameStore((s) => s.trackChipsSpent);
  const setRevealData = useGameStore((s) => s.setRevealData);

  const numberOfPlayers = config.numberOfPlayers as 2 | 3 | 4;
  const numberOfBots = numberOfPlayers - 1;
  const boardCount = getBoardCount(numberOfPlayers);

  // Player hand: 2 rows of cards + label. Card height ≈ round(min(36,max(28,availW/8)) * 1.4)
  // Approximate by screen height bracket: smaller phones Ã¢ÂÂ smaller cards Ã¢ÂÂ shorter hand section
  const PLAYER_HAND_H = SCREEN_H < 700 ? 100 : SCREEN_H < 800 ? 112 : 124;

  const safeH = SCREEN_H - insets.top - insets.bottom;
  const BOARD_GAPS = (boardCount - 1) * 4;
  const boardSpace = (safeH - TOP_BAR_H - BOT_STATUS_H - PLAYER_HAND_H - FLOATING_ACTIONS_H - HINT_H - BOARD_GAPS) / boardCount - BOARD_CHROME;
  // Mobile web card height scales with board count — more boards = tighter = needs clarity boost
  // Mobile web card height: width-aware so 5 community cards fit in 2-column board grid.
  // Board column overhead (reduced padding in BoardArrangement + Board) approx 26px.
  // cardRow: 5 cards + 4 gaps(6) + separator(7) = 31px overhead inside card row.
  const _boardColW = Math.max(80, Math.floor(screenW / 2) - 26);
  const _maxMobileWebCw = Math.max(18, Math.floor((_boardColW - 31) / 5));
  const _maxMobileWebCh = Math.round(_maxMobileWebCw / 0.72);
  const mobileWebCardH = Math.min(CARD_SCALE[numberOfPlayers]?.cardHeight ?? 60, _maxMobileWebCh);
  const nativeCardDims = getCardDimensions(screenW, numberOfPlayers);
  const communityScale = nativeCardDims.communityScale;
  // Cap native card height so both card rows (community + player/slots) fit in boardSpace.
  // During arrangement: commH = ch*communityScale, slotH = ch*0.7, plus 4pt cardRow padding.
  // ch*(communityScale + 0.7) + 4 <= boardSpace Ã¢ÂÂ maxCh = floor((boardSpace-4)/(communityScale+0.7))
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
  const [isFirstGame, setIsFirstGame] = useState(false);
  const [tooltipStep, setTooltipStep] = useState(0); // 0 = none shown yet, 1-5 = current tip index
  const [tooltipVisible, setTooltipVisible] = useState(false);
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
  // D1: auto-place trail — flash when cards are auto-placed on timeout
  const autoPlaceFlashAnim = useRef(new AnimatedRN.Value(0)).current;
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
  const [autoPlaceToastVisible, setAutoPlaceToastVisible] = useState(false);
  const [showSafeReveal, setShowSafeReveal] = useState(false);
  const [boardsWonCount, setBoardsWonCount] = useState(0);
  const [celebrateActive, setCelebrateActive] = useState(false);
  const [pendingRevealBoards, setPendingRevealBoards] = useState<Array<{
    winner: 'player'|'bot'|'tie';
    playerHandName: string;
    botHandName: string;
    allBotHandNames: string[];
    openCards: Card[];
    closedCards: Card[];
    playerCards: Card[];
    botCards: Card[];
    allBotCards: Card[][];
    potAmount: number;
    playerHighlightIds: string[];
    botHighlightIds: string[];
    boardHighlightIds: string[];
  }>>([]);
  const precalculatedResultsRef = useRef<ReturnType<typeof calculateHandResultsMulti> | null>(null);
  const hasNavigatedRef = useRef(false);
  const playerReadyRef = useRef(false);
  // FIX 4: double-tap guard on deal button — prevents two handleReady calls before setState re-renders
  const isDealingRef = useRef(false);
  const botsReadyCountRef = useRef(0);
  const adaptiveDifficultyRef = useRef<string>(config.botDifficulty ?? 'easy');

  useEffect(() => { playerHandRef.current = playerHand; }, [playerHand]); // no cleanup needed — sync ref update
  useEffect(() => { boardsRef.current = boards; }, [boards]); // no cleanup needed — sync ref update

  const isArranging = phase.type === 'arranging' && !playerReady;

  // Ã¢ÂÂÃ¢ÂÂ Guided first game tooltips Ã¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂ
  const advanceTooltip = useCallback(() => {
    setTooltipVisible(false);
    // Tip 2 auto-shows 300ms after tip 1 dismissed — handled by step watcher below
  }, []);

  // Tip 1 — cards dealt (step 0 Ã¢ÂÂ 1)
  useEffect(() => {
    if (!isFirstGame || tooltipStep !== 0 || playerHand.length === 0) return;
    const id = setTimeout(() => { setTooltipStep(1); setTooltipVisible(true); }, 500);
    return () => clearTimeout(id);
  }, [isFirstGame, tooltipStep, playerHand.length]);

  // Tip 2 — auto after tip 1 dismissed (step 1 Ã¢ÂÂ 2, tooltipVisible just became false)
  useEffect(() => {
    if (!isFirstGame || tooltipStep !== 1 || tooltipVisible) return;
    const id = setTimeout(() => { setTooltipStep(2); setTooltipVisible(true); }, 300);
    return () => clearTimeout(id);
  }, [isFirstGame, tooltipStep, tooltipVisible]);

  // Tip 3 — first card placed (step 2 Ã¢ÂÂ 3)
  useEffect(() => {
    if (!isFirstGame || tooltipStep !== 2) return;
    const anyCardPlaced = boards.some((b) => b.playerCards.length >= 1);
    if (!anyCardPlaced) return;
    const id = setTimeout(() => { setTooltipStep(3); setTooltipVisible(true); }, 200);
    return () => clearTimeout(id);
  }, [isFirstGame, tooltipStep, boards]);

  // Tip 4 — first board full (step 3 Ã¢ÂÂ 4)
  useEffect(() => {
    if (!isFirstGame || tooltipStep !== 3) return;
    const hasFullBoard = boards.some((b) => b.playerCards.length === CARDS_PER_BOARD);
    if (!hasFullBoard) return;
    const id = setTimeout(() => { setTooltipStep(4); setTooltipVisible(true); }, 500);
    return () => clearTimeout(id);
  }, [isFirstGame, tooltipStep, boards]);

  // Tip 5 — auto after tip 4 dismissed (step 4 Ã¢ÂÂ 5): 2-of-4 rule explainer
  useEffect(() => {
    if (!isFirstGame || tooltipStep !== 4 || tooltipVisible) return;
    const id = setTimeout(() => { setTooltipStep(5); setTooltipVisible(true); }, 400);
    return () => clearTimeout(id);
  }, [isFirstGame, tooltipStep, tooltipVisible]);

  // Tip 6 — all boards full (step 5 Ã¢ÂÂ 6): ready to submit
  useEffect(() => {
    if (!isFirstGame || tooltipStep !== 5) return;
    const allFull = boards.every((b) => b.playerCards.length === CARDS_PER_BOARD);
    if (!allFull) return;
    const id = setTimeout(() => { setTooltipStep(6); setTooltipVisible(true); }, 500);
    return () => clearTimeout(id);
  }, [isFirstGame, tooltipStep, boards]);
  // Ã¢ÂÂÃ¢ÂÂ End guided tooltips Ã¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂ

  // Start 30s countdown
  const startCountdown = useCallback((finisherName: string) => {
    if (countdownRef.current) return; // already running
    setFirstFinisher(finisherName);
    setCountdownActive(true);
    setCountdown(COUNTDOWN_SECONDS);
    playSound('timerLow');
    track('cards_placed', {}, 'game');

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
  // By the time both are ready, results are already computed Ã¢ÂÂ zero-wait navigation
  // IMPORTANT: must guard BOTH bot cards AND player cards — pre-calc fires when the first
  // finisher triggers the countdown. If bot finishes first, playerCards is still empty Ã¢ÂÂ
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
          debugLog('[GAME] pre-calc skipped — cards not fully placed yet, will calc fresh on navigate');
          return;
        }
        precalculatedResultsRef.current = calculateHandResultsMulti(boardsRef.current, numberOfPlayers, config);
        debugLog('[GAME] pre-calculation done during countdown');
      } catch (e) {
        debugLog(`[GAME] pre-calculation failed — will recalculate on navigate: ${e}`, 'warn');
        precalculatedResultsRef.current = null;
      }
    }, 0);
    return () => clearTimeout(t);
  }, [countdownActive]);

  // Countdown sound escalation: timerLow at 10s (from startCountdown), per-second at 5Ã¢ÂÂ1, timerLow at 0
  // no cleanup needed — fire-and-forget sound/haptic calls, no subscriptions
  useEffect(() => {
    if (!countdownActive) return;
    // Per-second ticks from 5s down to 1s (escalating urgency)
    if (countdown === 10 || countdown === 3) playSound('timerLow'); // Only 2 beeps, not 5
    // Time up: play buzzer sound
    if (countdown === 0) {
      playSound('buzzer');
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
      // D1: auto-place trail flash
      AnimatedRN.sequence([
        AnimatedRN.timing(autoPlaceFlashAnim, { toValue: 1, duration: 80, useNativeDriver: true }),
        AnimatedRN.timing(autoPlaceFlashAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
      ]).start();
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
    void startAmbient();
    return () => {
      mountedRef.current = false;
      debugLog('game.tsx unmounting');
      onGameEnd().catch(() => {});
      void stopAmbient();
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

  // Load games-played counter + guided mode flag
  // no cleanup needed — one-time AsyncStorage read, promise resolves after unmount harmlessly
  useEffect(() => {
    Promise.all([
      AsyncStorage.getItem(GAMES_PLAYED_KEY),
      AsyncStorage.getItem(GUIDED_FORCED_KEY),
    ]).then(([gamesVal, guidedVal]) => {
      const played = parseInt(gamesVal ?? '0', 10);
      setGamesPlayed(played);
      const guided = played === 0 || guidedVal === 'true';
      setIsFirstGame(guided);
      if (guided && guidedVal === 'true') {
        // Clear forced flag — won't fire again unless Tutorial replayed
        AsyncStorage.removeItem(GUIDED_FORCED_KEY).catch(() => {});
      }
    }).catch(() => {});
  }, []);

  // Initialize game
  // no cleanup needed — bot timers are pushed to timeoutsRef.current, cleared by the central cleanup effect above
  useEffect(() => {
    // Fetch adaptive bot difficulty (fire-and-forget — ref is read by bot timers below)
    void (async () => {
      try {
        const { getDeviceId: gdi } = await import('../utils/leaderboard');
        const deviceId = await gdi();
        const sb = getSupabase();
        if (!sb) return;
        const { data } = await sb.rpc('get_bot_difficulty', { p_device_id: deviceId });
        if (data) adaptiveDifficultyRef.current = data as string;
      } catch {}
    })();

    const { boards: initialBoards, playerHand: pHand, botHands } = initializeGameMulti(numberOfPlayers);
    setBoards(initialBoards);
    setPlayerHand(sortHand(pHand, handSortMethod));
    setBotsReady(new Array(numberOfBots).fill(false));
    botsReadyCountRef.current = 0;
    playerReadyRef.current = false;
    isDealingRef.current = false;
    hasNavigatedRef.current = false;
    CapsHooks.gameStarted('solo');
    track('hand_dealt', { player_count: numberOfPlayers, board_count: boardCount }, 'game');

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
        setBoards((prev) => placeSingleBotCards(botCards, prev, botIdx, adaptiveDifficultyRef.current as import('../utils/botStrategy').BotDifficulty));
        setBotsReady((prev) => {
          const updated = [...prev];
          updated[botIdx] = true;
          const anyPrevReady = prev.some(Boolean);
          // Solo: bots never start countdown â player has free thinking time
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
    void scheduleReengagement(); // re-engagement notification after each game
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

    // A3: track last COMPLETE for home screen share banner
    if (results.isComplete) {
      AsyncStorage.setItem('last_was_complete', 'true').catch(() => {});
    }
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
        allBotHandNames: b.allBotHandNames ?? [],
        openCards: b.openCards,
        closedCards: b.closedCards,
        playerCards: b.playerCards,
        botCards: (b.allBotCards?.[0]) ?? [],
        allBotCards: b.allBotCards ?? [],
        potAmount: b.potAmount,
        playerHighlightIds: b.playerHighlightIds ?? [],
        botHighlightIds: b.botHighlightIds ?? [],
        boardHighlightIds: b.boardHighlightIds ?? [],
      }));
      setPendingRevealBoards(revealSummary);
      setShowSafeReveal(true);
      // Calculate boards won and trigger celebration after reveal animation finishes
      const wonCount = revealSummary.filter((b) => b.winner === 'player').length;
      setBoardsWonCount(wonCount);
      drumRoll();
      // Activate confetti after reveal sequence (timed with revealSpeed)
      const celebrationDelay = (revealSummary.length * 600) + 800;
      setTimeout(() => {
        if (wonCount > 0) {
          setCelebrateActive(true);
          if (wonCount === 4) winSweep(); else winBoard();
        }
      }, celebrationDelay);
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
    debugLog('15 onRevealDone called - clearing overlay');
    setShowSafeReveal(false);
    setPendingRevealBoards([]);
    debugLog('16 navigating to results');
    void logStep('F:before_router_replace');
    // S111 bug#477: always navigate immediately — never block with Alert
    // daily reward is surfaced on results screen (streak badge) and index on next visit
    try {
      router.replace('/results' as any);
    } catch (e) {
      try { router.push('/results' as any); } catch {}
    }
  }, [router]);

  const allBotsReady = botsReady.length > 0 && botsReady.every(Boolean);

  // Tap card in hand Ã¢ÂÂ toggle in selectedCardIds (up to 4)
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

  // Tap board Ã¢ÂÂ place all selectedCardIds (or first hand card if none selected)
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

  // Tap placed card Ã¢ÂÂ remove from board
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
    // FIX 4: debounce — prevent double-tap crash (two rapid presses before state update)
    if (isDealingRef.current) { debugLog('H0 handleReady DEBOUNCED - already dealing'); return; }
    isDealingRef.current = true;
    trackAction('deal_pressed');
    // Heatmap (D7)
    import('../utils/heatmap').then(({ trackEvent }) => {
      import('../utils/leaderboard').then(({ getDeviceId }) => {
        getDeviceId().then(id => trackEvent('game', 'deal_pressed', id)).catch(() => {});
      }).catch(() => {});
    }).catch(() => {});
    debugLog('H1 handleReady called');
    if (!allBoardsFull) { isDealingRef.current = false; debugLog('H1.1 NOT allBoardsFull — abort'); return; }
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
      if (boardsRef.current && boardsRef.current.length > 0) {
        doNavigateRef.current(boardsRef.current);
      } else {
        debugLog('H10.1E boardsRef is empty — aborting doNavigate', 'error');
        isDealingRef.current = false;
      }
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
      router.replace('/');
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
  const TIMER_SIZE = timerPulsing ? rv(64) : rv(52);

  // Ã¢ÂÂÃ¢ÂÂ Landscape / widescreen layout Ã¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂ
  if (isLandscape) {
    return (
      <SafeAreaView style={[styles.container, landscapeStyles.root, { backgroundColor: theme.background }, Platform.OS === 'web' && visualTheme === 'fiveo' && { background: 'radial-gradient(ellipse at 50% 40%, #5A1520 0%, #1C0508 70%)' } as any]}>
        <FriendsBg />
        {/* watermark removed from game screen */}
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
                <TimerController countdown={countdown} total={COUNTDOWN_SECONDS} isActive={countdownActive && isArranging} firstFinisher={firstFinisher} timerSize={timerPulsing ? 54 : 44} timerColor={timerColor} timerPulsing={timerPulsing} />
              )}
              {!countdownActive && isArranging && (
                <Text style={styles.freePlayLabel}>Arrange freely</Text>
              )}
              {playerReady && !allBotsReady && (
                <Text style={styles.waitingText}>Waiting for bots...</Text>
              )}
            </View>
            <View style={styles.headerChips}>
              <Text style={styles.headerChipsEmoji}>💰</Text>
              <Text style={styles.headerChipsAmount}>{(chips ?? 0).toLocaleString()}</Text>
            </View>
          </View>

          {/* Boards — 2 columns */}
          <View style={[landscapeStyles.boardsGrid]}>
            {(boards ?? []).map((board, i) => (
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
            {numberOfBots === 1 ? '🤖 בוט' : `🤖 בוטים ${readyBotCount}/${numberOfBots}`}
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
              <Text style={styles.continueBtnText}>המשך →</Text>
            </Pressable>
          )}
        </View>
      {showSafeReveal && (
        <BoardReveal boards={pendingRevealBoards} onDone={onRevealDone} revealSpeed={config.revealSpeed} />
      )}

      </SafeAreaView>
    );
  }
  // Ã¢ÂÂÃ¢ÂÂ End landscape layout Ã¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂ

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }, Platform.OS === 'web' && visualTheme === 'fiveo' && { background: 'radial-gradient(ellipse at 50% 40%, #5A1520 0%, #1C0508 70%)' } as any]}>
      <FriendsBg />
      {/* watermark removed from game screen */}
      {/* D1: auto-place trail flash overlay */}
      <AnimatedRN.View
        pointerEvents="none"
        style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(201,168,76,0.18)', opacity: autoPlaceFlashAnim, zIndex: 99 }]}
      />
      <Animated.View entering={FadeIn.duration(300)} style={{ flex: 1 }}>
      {/* Header bar */}
      <View style={styles.topBar}>
        <Pressable onPress={handleBack} style={styles.backButton}>
          <Text style={styles.backText}>{'\u2715'}</Text>
        </Pressable>
        <View style={styles.topCenter}>
          {countdownActive && isArranging && (
            <View style={styles.countdownSection}>
              <TimerController
                countdown={countdown}
                total={COUNTDOWN_SECONDS}
                isActive={true}
                firstFinisher={firstFinisher}
                timerSize={TIMER_SIZE}
                timerColor={timerColor}
                timerPulsing={timerPulsing}
              />
              <Text style={styles.countdownLabel}>{firstFinisher ? t().botFinished : ''}</Text>
            </View>
          )}
          {!countdownActive && isArranging && (
            <Text style={styles.freePlayLabel}>
              {cardsRemaining === 0 ? t().allPlaced : `סדר ${cardsRemaining} קלפים`}
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
        <View style={styles.headerChips}>
          <Text style={styles.headerChipsEmoji}>💰</Text>
          <Text style={styles.headerChipsAmount}>{chips.toLocaleString()}</Text>
        </View>
      </View>

      {/* Bot status bar */}
      <View style={[styles.botSection, { backgroundColor: theme.surface, borderTopWidth: 1, borderBottomWidth: 1, borderColor: theme.boardBorder }]}>
        <View style={styles.botStatusRow}>
          <Text style={styles.botEmoji}>🤖</Text>
          <Text style={styles.botNameLabel}>
            {numberOfBots === 1 ? 'בוט 1' : `בוטים ${readyBotCount}/${numberOfBots}`}
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

      <BoardArrangement
        boards={boards}
        boardShakeStyles={boardShakeStyles}
        playerHand={playerHand}
        selectedCardIds={selectedCardIds}
        isArranging={isArranging}
        allBoardsFull={allBoardsFull}
        cardsRemaining={cardsRemaining}
        boardError={boardError}
        boardCount={boardCount}
        numberOfPlayers={numberOfPlayers}
        communityScale={communityScale}
        BOARD_CARD_H={BOARD_CARD_H}
        screenW={screenW}
        isWeb={isWeb}
        countdownActive={countdownActive}
        countdown={countdown}
        timeBankUsed={timeBankUsed}
        gamesPlayed={gamesPlayed}
        playerReady={playerReady}
        allBotsReady={allBotsReady}
        showContinueButton={showContinueButton}
        onBoardPress={handleBoardPress}
        onRemoveCard={handleRemoveCardFromBoard}
        onAutoFill={handleAutoFill}
        onSelectCard={handleSelectCard}
        onUndo={() => {
          for (let i = boards.length - 1; i >= 0; i--) {
            if (boards[i].playerCards.length > 0) {
              const lastCard = boards[i].playerCards[boards[i].playerCards.length - 1];
              handleRemoveCardFromBoard(i, lastCard);
              break;
            }
          }
        }}
        onReady={handleReady}
        onTimeBank={() => {
          setTimeBankUsed(true);
          setCountdown((prev) => prev + 15);
        }}
        onContinue={() => {
          debugLog('[GAME] fallback button pressed — calling doNavigate manually');
          doNavigateRef.current(boardsRef.current);
        }}
        potPerBoard={config.potPerBoard}
      />
      </Animated.View>
      {showSafeReveal && (
        <BoardReveal
          boards={pendingRevealBoards}
          onDone={onRevealDone}
          revealSpeed={config.revealSpeed}
          isFirstGame={isFirstGame}
        />
      )}


      {/* Guided first-game tooltips (tips 1Ã¢ÂÂ6) — non-blocking */}
      {/* Tutorial dim overlay — steps 1-2 only, focuses attention, non-blocking */}
      {isFirstGame && tooltipVisible && (tooltipStep === 1 || tooltipStep === 2) && (
        <View
          style={{ ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.38)', zIndex: 40, alignItems: 'center', justifyContent: tooltipStep === 1 ? 'flex-end' : 'flex-start', paddingBottom: tooltipStep === 1 ? rs(200) : 0, paddingTop: tooltipStep === 2 ? rs(80) : 0 }}
          pointerEvents="none"
        >
          <Text style={{ color: '#c9a84c', fontSize: rs(32), opacity: 0.9 }}>
            {tooltipStep === 1 ? '↓' : '↑'}
          </Text>
        </View>
      )}

      {/* Guided first-game tooltips (tips 1–6) — non-blocking */}
      {isFirstGame && tooltipVisible && tooltipStep >= 1 && tooltipStep <= 6 && (
        <GuidedTooltip
          text={TIPS[tooltipStep - 1]?.() ?? ''}
          visible={tooltipVisible}
          onDismiss={advanceTooltip}
          position={tooltipStep <= 2 ? 'bottom' : tooltipStep === 5 ? 'center' : tooltipStep === 6 ? 'top' : 'bottom'}
          autoDismissMs={tooltipStep === 5 ? 6000 : 5000}
        />
      )}

      {/* S113: Auto-place toast */}
      {autoPlaceToastVisible && (
        <View style={styles.autoPlaceToast} pointerEvents="none">
          <Text style={styles.autoPlaceToastText}>⏱ הזמן נגמר — קלפים הונחו אוטומטית</Text>
        </View>
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
    width: rs(36),
    height: rs(36),
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
  headerChips: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: rs(4),
    backgroundColor: 'rgba(201,168,76,0.12)',
    borderRadius: rv(12),
    paddingVertical: rs(4),
    paddingHorizontal: rs(10),
    borderWidth: 1,
    borderColor: 'rgba(201,168,76,0.25)',
  },
  headerChipsEmoji: {
    fontSize: rf(14),
    lineHeight: rf(18),
  },
  headerChipsAmount: {
    color: COLORS.gold,
    fontSize: rf(14),
    fontWeight: '800',
    letterSpacing: 0.5,
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
  boardErrorText: {
    textAlign: 'center',
    color: COLORS.neonRed,
    fontSize: rf(12),
    fontWeight: '700',
    letterSpacing: 0.5,
    paddingVertical: rs(4),
  },
  floatingBtn: {
    paddingVertical: 0,
    paddingHorizontal: rs(16),
    height: 48,
    minHeight: 48,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 12,
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
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#C5A028',
  },
  placeBtn: {
    backgroundColor: '#C5A028',
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
    color: '#0A0A12',
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
  autoPlaceToast: {
    position: 'absolute',
    bottom: rs(60),
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.78)',
    paddingHorizontal: rs(16),
    paddingVertical: rs(8),
    borderRadius: rs(16),
    zIndex: 999,
  },
  autoPlaceToastText: {
    fontSize: rf(12),
    color: '#fff',
    fontWeight: '500',
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
  panelLvl: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: rf(9),
    fontWeight: '500',
  },
  readyBtn: {
    marginTop: 'auto' as any,
    width: '100%',
    paddingHorizontal: rs(8),
    alignItems: 'center',
  },
});


export default function GameScreen() {
  return (
    <ErrorBoundary>
      <GameScreenInner />
    </ErrorBoundary>
  );
}
