import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, Pressable, StyleSheet, Alert, Platform, Animated as AnimatedRN, AppState, useWindowDimensions } from 'react-native';
import { SCREEN_W as MODULE_SCREEN_W, SCREEN_H as MODULE_SCREEN_H } from '../utils/responsive';
import { PRD } from '../utils/prdTokens';
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
import { rv as rvOld } from '../constants/deviceBreakpoints';
import { rf, rh, rs, rv, rb } from '../utils/responsive';
import { t, getLanguage } from '../utils/i18n';
import BoardReveal from '../components/BoardReveal';
import GuidedTooltip from '../components/GuidedTooltip';
import { TimerController, TimerBar } from '../components/TimerController';
import { BoardArrangement } from '../components/BoardArrangement';
import { useLevelStore } from '../stores/levelStore';
import { useGameLayout } from '../hooks/useGameLayout';
import { GameView } from '../components/GameView';
import PracticeLiveOverlay from '../components/PracticeLiveOverlay';
import { getPracticeLiveState, requestPracticeLiveJumpNow } from '../utils/practiceLiveSession';

const GAMES_PLAYED_KEY = 'caps_games_played';
const GUIDED_FORCED_KEY = 'guidedModeForced';

// Tooltip text — inline EN/HE
const TIP = (en: string, he: string) => getLanguage() === 'he' ? he : en;
// VAMOS-UNIFY-FINAL 2026-06-28 — first-game tooltips tightened. The longest one
// (the 2+3 Omaha-rule explainer) collapsed from a wall of text to one sentence;
// the rest are already short.
const TIPS = [
  () => TIP('These are your cards. Place 4 on each board.', 'אלה הקלפים שלך. תשים 4 על כל לוח.'),
  () => TIP('Tap a card, then tap an empty slot.', 'לחץ על קלף, ואז על מקום ריק.'),
  () => TIP('Nice! 3 more cards on this board.', 'יופי! עוד 3 קלפים על הלוח הזה.'),
  () => TIP('Hand strength shown here. Better hands win more!', 'עוצמת היד מוצגת כאן. ידיים טובות יותר מנצחות יותר!'),
  // Tip 5 (index 4): Omaha hand selection — the game picks the best 2+3 automatically.
  () => TIP(
    'The game picks your best hand automatically. Just place 4 cards.',
    'המשחק בוחר את היד הטובה אוטומטית. רק תניח 4 קלפים.'
  ),
  () => TIP('All set! Tap READY to reveal.', 'הכל מוכן! לחץ READY כדי להציג.'),
];

// VAMOS-FIX-RESULTS-TRANSITION 2026-06-17 — removed bug_reports breadcrumb
// logger ('logStep'). It was firing ~9 inserts per game (all 400s due to
// schema/RLS), originally added for a past native-crash investigation that
// no longer requires per-step tracking.

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

// Layout constants — PR-M aggressive vertical budget (2026-05-29).
// Top chrome (header + bot bar) collapsed to rh(56); FLOATING_ACTIONS to rs(56).
// Boards consume everything else so 3p vertical-stack stops clipping board 3.
const TOP_CHROME_H = PRD.zone.topChromeH;          // rh(56) — PR-M
const TOP_BAR_H = Math.round(TOP_CHROME_H * 36 / 56);  // ~36/56 = top button row
const BOT_STATUS_H = Math.round(TOP_CHROME_H * 20 / 56);// ~20/56 = bot pill row
const FLOATING_ACTIONS_H = PRD.zone.actionBarH;    // rs(56) — PR-M
const HINT_H = 22;                                  // selectionHint / boardError bar
const BOARD_CHROME = 28;                            // per-board chrome budget (was 40)

function GameScreenInner() {
  const router = useRouter();
  const { autoSim, autoSimCount, currentSimHand, demo, practice, players, fresh, live } = useLocalSearchParams<{ autoSim?: string; autoSimCount?: string; currentSimHand?: string; demo?: string; practice?: string; players?: string; fresh?: string; live?: string }>();
  // PRACTICE-TO-LIVE — this practice session is holding a real realtime seat; a human can
  // drop in and trigger the jump to live MP. The seat-hold + countdown live in the
  // practiceLiveSession singleton (survives game ⇄ results); this screen shows the overlay.
  const liveMode = live === '1';
  // LOBBY-BOT-PRACTICE — practice mode (lobby bot tables): local SOLO vs the heuristic
  // bot, XP only, ZERO real chips (no buy-in, no settle, results skips all credits).
  const isPractice = practice === '1' || practice === 'true';
  const practicePlayers = isPractice ? (parseInt(players ?? '', 10) as 2 | 3 | 4) : null;
  // VAMOS-LAYOUT-MEASURE-V1 2026-06-21 — live window dimensions instead of the
  // module-snapshot SCREEN_H/W. The snapshot was captured at module load with a
  // hardcoded fallback of 852dp, so on phones whose real chrome differed from
  // the assumed estimates the chrome-subtraction math under-allocated the
  // boards zone (boards 2-4 unreachable + dead band above the action bar).
  // The boards region is now flex-measured anyway, so live dimensions are the
  // safer choice and remove a class of per-device drift.
  const { height: SCREEN_H, width: SCREEN_W } = useWindowDimensions();
  const screenW = SCREEN_W;
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
  // PRACTICE-TO-LIVE — session demo counter (separate from real chips).
  const practiceSessionNet = useGameStore((s) => s.practiceSessionNet);
  const addPracticeSessionNet = useGameStore((s) => s.addPracticeSessionNet);
  const resetPracticeSessionNet = useGameStore((s) => s.resetPracticeSessionNet);
  // Reset the demo counter ONLY when a fresh practice session starts from the lobby
  // (?fresh=1). "Deal me in" re-enters practice WITHOUT fresh → the counter accumulates.
  useEffect(() => {
    if (isPractice && (fresh === '1' || fresh === 'true')) resetPracticeSessionNet();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const trackChipsSpent = useGameStore((s) => s.trackChipsSpent);
  const setRevealData = useGameStore((s) => s.setRevealData);

  // Practice override is LOCAL only — never persisted, so the player's selector is untouched.
  const numberOfPlayers = (practicePlayers && [2, 3, 4].includes(practicePlayers) ? practicePlayers : config.numberOfPlayers) as 2 | 3 | 4;
  const numberOfBots = numberOfPlayers - 1;
  const boardCount = getBoardCount(numberOfPlayers);

  // VAMOS-UNIFY-GAMEVIEW 2026-06-29 — the SOLO placement-screen "fit-search" sizing
  // math (formerly inline here, lines 136-443) now lives in useGameLayout so MP can
  // share the EXACT same math. The locals below are re-aliased verbatim so the rest
  // of this file (render + layout-debug readout) is unchanged.
  const _L = useGameLayout({ screenW, screenH: SCREEN_H, insets, boardCount, numberOfPlayers });
  const UNIVERSAL_CARD_W = _L.UNIVERSAL_CARD_W;
  const PLAYER_HAND_H = _L.PLAYER_HAND_H;
  const _cellW = _L.cellW;
  const _cellH = _L.cellH;
  const _boardsZoneH = _L.boardsZoneH;
  const _use2x2 = _L.use2x2;
  const _handZoneActualH = _L.handZoneH;
  const _handCardCap = _L.handCardCap;
  const communityScale = _L.communityScale;
  const BOARD_CARD_H = _L.BOARD_CARD_H;
  const isWeb = _L.isWeb;
  const _gridRows = _L.gridRows;
  const _gridCols = _L.gridCols;
  const _boardCardH = _L.boardCardH;
  const boardCardCapDp = _L.boardCardCapDp;

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
  // BUILD467-VERIFY / FIT-ALL-BOARDS / BC4-STACK-REBALANCE / VISUAL-POLISH:
  // layout debug readout. Build 470 confirmed the readout RENDERS when forced on;
  // re-gated here so the overlay is OFF by default and only appears when the
  // Settings â "Debug overlay" toggle (-> AsyncStorage `debug_overlay_enabled`)
  // is true. The AppState 'change' listener + 3 staggered re-checks below pick up
  // toggle changes without requiring the user to back out + re-enter the game.
  const LAYOUT_DEBUG_FORCE_ON_FOR_DIAGNOSTIC = false;
  const [layoutDebugVisible, setLayoutDebugVisible] = useState<boolean>(LAYOUT_DEBUG_FORCE_ON_FOR_DIAGNOSTIC);
  useEffect(() => {
    if (LAYOUT_DEBUG_FORCE_ON_FOR_DIAGNOSTIC) return; // unconditional
    let alive = true;
    const recheck = () => {
      AsyncStorage.getItem('debug_overlay_enabled')
        .then((v) => { if (alive) setLayoutDebugVisible(v === 'true'); })
        .catch(() => {});
    };
    recheck();
    const sub = AppState.addEventListener('change', recheck);
    const t1 = setTimeout(recheck, 1500);
    const t2 = setTimeout(recheck, 3500);
    const t3 = setTimeout(recheck, 6000);
    return () => { alive = false; sub.remove(); clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [LAYOUT_DEBUG_FORCE_ON_FOR_DIAGNOSTIC]);

  const precalculatedResultsRef = useRef<ReturnType<typeof calculateHandResultsMulti> | null>(null);
  const hasNavigatedRef = useRef(false);
  const playerReadyRef = useRef(false);
  // FIX 4: double-tap guard on deal button — prevents two handleReady calls before setState re-renders
  const isDealingRef = useRef(false);
  // VAMOS-FIX-SCROLLREVEAL 2026-06-17 — fail-safe to release the isDealingRef
  // lock if a navigate silently fails to occur. Without this, a successful
  // handleReady that hits the `doNavigateRef.current(...)` happy path never
  // resets isDealingRef; if navigation throws/no-ops, subsequent presses are
  // silently DEBOUNCED forever. This timeout flips the LOCK only — it does NOT
  // navigate itself, so it can't cause double-navigate (the screen has already
  // transitioned if doNavigate worked).
  const dealLockResetRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // VAMOS-FIX-SCROLLREVEAL 2026-06-17 — fail-safe for the waiting_for_bot stall.
  const waitingForBotResetRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    return () => {
      if (dealLockResetRef.current) clearTimeout(dealLockResetRef.current);
      if (waitingForBotResetRef.current) clearTimeout(waitingForBotResetRef.current);
    };
  }, []);
  // VAMOS-FIX-SCROLLREVEAL 2026-06-17 — auto-clear the waiting_for_bot fail-safe
  // timeout the moment phase transitions out of waiting_for_bot (normal advance,
  // navigation). Prevents the 8s timer from firing doNavigate after a normal
  // advance has already occurred (double-navigate guard).
  useEffect(() => {
    if (phase.type !== 'waiting_for_bot' && waitingForBotResetRef.current) {
      clearTimeout(waitingForBotResetRef.current);
      waitingForBotResetRef.current = null;
    }
  }, [phase.type]);
  const botsReadyCountRef = useRef(0);
  // Practice bots use the heuristic (Iron Rule 5 unlocked 2026-07-02) — non-boring practice.
  const adaptiveDifficultyRef = useRef<string>(isPractice ? 'hard' : (config.botDifficulty ?? 'easy'));

  useEffect(() => { playerHandRef.current = playerHand; }, [playerHand]); // no cleanup needed — sync ref update
  useEffect(() => { boardsRef.current = boards; }, [boards]); // no cleanup needed — sync ref update

  const isArranging = phase.type === 'arranging' && !playerReady;

  // ÂÂ Guided first game tooltips ÂÂÂÂÂÂÂÂÂÂÂÂÂÂÂÂÂÂÂÂÂÂÂÂÂÂÂÂÂÂÂÂÂÂÂÂÂÂÂÂÂÂÂÂÂ
  const advanceTooltip = useCallback(() => {
    setTooltipVisible(false);
    // Tip 2 auto-shows 300ms after tip 1 dismissed — handled by step watcher below
  }, []);

  // Tip 1 — cards dealt (step 0 Â 1)
  useEffect(() => {
    if (!isFirstGame || tooltipStep !== 0 || playerHand.length === 0) return;
    const id = setTimeout(() => { setTooltipStep(1); setTooltipVisible(true); }, 500);
    return () => clearTimeout(id);
  }, [isFirstGame, tooltipStep, playerHand.length]);

  // Tip 2 — auto after tip 1 dismissed (step 1 Â 2, tooltipVisible just became false)
  useEffect(() => {
    if (!isFirstGame || tooltipStep !== 1 || tooltipVisible) return;
    const id = setTimeout(() => { setTooltipStep(2); setTooltipVisible(true); }, 300);
    return () => clearTimeout(id);
  }, [isFirstGame, tooltipStep, tooltipVisible]);

  // Tip 3 — first card placed (step 2 Â 3)
  useEffect(() => {
    if (!isFirstGame || tooltipStep !== 2) return;
    const anyCardPlaced = boards.some((b) => b.playerCards.length >= 1);
    if (!anyCardPlaced) return;
    const id = setTimeout(() => { setTooltipStep(3); setTooltipVisible(true); }, 200);
    return () => clearTimeout(id);
  }, [isFirstGame, tooltipStep, boards]);

  // Tip 4 — first board full (step 3 Â 4)
  useEffect(() => {
    if (!isFirstGame || tooltipStep !== 3) return;
    const hasFullBoard = boards.some((b) => b.playerCards.length === CARDS_PER_BOARD);
    if (!hasFullBoard) return;
    const id = setTimeout(() => { setTooltipStep(4); setTooltipVisible(true); }, 500);
    return () => clearTimeout(id);
  }, [isFirstGame, tooltipStep, boards]);

  // Tip 5 — auto after tip 4 dismissed (step 4 Â 5): 2-of-4 rule explainer
  useEffect(() => {
    if (!isFirstGame || tooltipStep !== 4 || tooltipVisible) return;
    const id = setTimeout(() => { setTooltipStep(5); setTooltipVisible(true); }, 400);
    return () => clearTimeout(id);
  }, [isFirstGame, tooltipStep, tooltipVisible]);

  // Tip 6 — all boards full (step 5 Â 6): ready to submit
  useEffect(() => {
    if (!isFirstGame || tooltipStep !== 5) return;
    const allFull = boards.every((b) => b.playerCards.length === CARDS_PER_BOARD);
    if (!allFull) return;
    const id = setTimeout(() => { setTooltipStep(6); setTooltipVisible(true); }, 500);
    return () => clearTimeout(id);
  }, [isFirstGame, tooltipStep, boards]);
  // ÂÂ End guided tooltips ÂÂÂÂÂÂÂÂÂÂÂÂÂÂÂÂÂÂÂÂÂÂÂÂÂÂÂÂÂÂÂÂÂÂÂÂÂÂÂÂÂÂÂÂÂÂÂÂÂÂÂÂ

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
  // By the time both are ready, results are already computed Â zero-wait navigation
  // IMPORTANT: must guard BOTH bot cards AND player cards — pre-calc fires when the first
  // finisher triggers the countdown. If bot finishes first, playerCards is still empty Â
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

  // Countdown sound escalation: timerLow at 10s (from startCountdown), per-second at 5Â1, timerLow at 0
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
      track('arrangement_timeout', {
        player_count: numberOfPlayers,
        board_count: boardCount,
        cards_remaining: playerHandRef.current.length,
      }, 'game');
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

    // Deduct buy-in — NOT in practice (bot-table games are chip-neutral by design)
    const buyIn = getMatchCost(config.potPerBoard, boardCount);
    if (!isPractice) {
      addChips(-buyIn);
      if (ECONOMY_FLAGS.matchCostEnabled) {
        trackChipsSpent(buyIn);
      }
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

    // PRACTICE-TO-LIVE — if a real opponent is mid-countdown, this bot hand just reached its
    // natural end: cut here and jump to the live game rather than waiting the full 30s. The
    // host starts the live game (its phase flips to 'jumping' synchronously) and the overlay
    // performs the navigation; the guest can't start, so it falls through to results and
    // jumps when the host's deal arrives.
    if (liveMode && getPracticeLiveState().phase === 'countdown') {
      requestPracticeLiveJumpNow();
      if (getPracticeLiveState().phase === 'jumping') { debugLog('2.1 practice-live host jump — cutting hand'); return; }
    }


    debugLog('3 clearing countdown interval');
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }

    debugLog('4 calculateHandResultsMulti START');

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
      router.replace('/');
      return;
    }

    debugLog(`5 calculate DONE: won=${results.playerChipsWon} isComplete=${results.isComplete}`);

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
        // VAMOS-HAND-LABELS-ENGLISH 2026-06-17 — precomputed best-5 for both
        // sides so reveal/results can render rank-specific labels with no
        // re-evaluation. Captured here where evaluation already happened.
        playerBestCards: result
          ? [...result.playerResult.playerCardsUsed, ...result.playerResult.boardCardsUsed]
          : undefined,
        botBestCards: result
          ? [...result.botResult.playerCardsUsed, ...result.botResult.boardCardsUsed]
          : undefined,
        potAmount: config.potPerBoard * numberOfPlayers,
      };
    });

    debugLog(`7 revealBoards done: ${revealBoards.length} boards`);

    debugLog(`8 addChips: ${results.playerChipsWon}${isPractice ? ' SKIPPED (practice)' : ''}`);
    if (!isPractice) addChips(results.playerChipsWon);
    else addPracticeSessionNet(results.playerChipsWon - config.potPerBoard * boardCount); // demo counter only
    void scheduleReengagement(); // re-engagement notification after each game
    debugLog('9 addChips done');

    debugLog('10 setRevealData START');
    setRevealData({
      boards: revealBoards,
      isPractice,
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
      // ECON-SW P1.1 (S62) — stable per-hand id for record_hand_net server-side dedup.
      // doNavigate is guarded (hasNavigatedRef) so this runs once per hand → stable across
      // any results re-mount that reads this same revealData.
      handId: `h-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
    });
    debugLog('11 setRevealData DONE');

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

    // Show safe reveal overlay before navigating (skip in auto-sim to avoid delays).
    // VAMOS S-BATCH — also skipped when the player enabled "Skip board-by-board reveal"
    // (Settings, unlocked after 3 games): straight to the one-screen results summary.
    debugLog('14 showSafeReveal path — setting overlay');
    if (autoSim !== 'true' && !useGameStore.getState().skipBoardReveal) {
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
      return; // navigation happens from onRevealDone
    }

    debugLog('14 router.replace /results START');
    try {
      router.replace('/results' as any);
      debugLog('15 router.replace DONE');
    } catch (e) {
      debugLog(`14E router.replace CRASHED: ${String(e)}`, 'error');
      try { router.push('/results' as any); } catch { /* ignore */ }
    }
  }, [config, numberOfPlayers, boardCount, setRevealData, addChips, router, autoSim, liveMode]);

  // Keep doNavigate in a ref so bot timers always call the latest version
  const doNavigateRef = useRef(doNavigate);
  useEffect(() => { doNavigateRef.current = doNavigate; }, [doNavigate]); // no cleanup needed — sync ref update

  const onRevealDone = useCallback(() => {
    debugLog('15 onRevealDone called - clearing overlay');
    setShowSafeReveal(false);
    setPendingRevealBoards([]);
    debugLog('16 navigating to results');
    // S111 bug#477: always navigate immediately — never block with Alert
    // daily reward is surfaced on results screen (streak badge) and index on next visit
    try {
      router.replace('/results' as any);
    } catch (e) {
      try { router.push('/results' as any); } catch {}
    }
  }, [router]);

  const allBotsReady = botsReady.length > 0 && botsReady.every(Boolean);

  // Tap card in hand Â toggle in selectedCardIds (up to 4)
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

  // Tap board Â place all selectedCardIds (or first hand card if none selected)
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
        setBoardError(t().boardFull);
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

  // Tap placed card Â remove from board
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

  // VAMOS-BESTCARDS-RENDER 2026-06-22 — fill ALL boards in ONE batched update for
  // autoSim/demo. The previous `for (i) handleAutoFill(i)` loop read the stale closure
  // `boards` on every iteration (React state can't update mid-loop), so only board 0 was
  // filled; boards 1+ stayed empty → evaluateOmahaHand returned DEFAULT_HAND_RESULT
  // (High Card, EMPTY bestCards) → headless QA saw "Tie — High Card" on every board with
  // null bestCards (and a fake ~92% tie rate). Uses refs (current, not stale) and
  // distributes the hand deterministically across boards. Real play is unaffected (users
  // tap auto-fill per board with re-renders between calls).
  const autoFillAllBoards = useCallback(() => {
    const hand = [...playerHandRef.current];
    const cur = boardsRef.current;
    let idx = 0;
    const placed = new Set<string>();
    const updated = cur.map((b) => {
      if (b.playerCards.length >= CARDS_PER_BOARD) return b;
      const need = CARDS_PER_BOARD - b.playerCards.length;
      const take = hand.slice(idx, idx + need);
      idx += need;
      take.forEach((c) => placed.add(c.id));
      return take.length ? { ...b, playerCards: [...b.playerCards, ...take] } : b;
    });
    setBoards(updated);
    setPlayerHand((h) => h.filter((c) => !placed.has(c.id)));
  }, []);

  const allBoardsFull = boards.every((b) => b.playerCards.length === CARDS_PER_BOARD);

  const handleReady = useCallback(() => {
    // FIX 4: debounce — prevent double-tap crash (two rapid presses before state update)
    if (isDealingRef.current) { debugLog('H0 handleReady DEBOUNCED - already dealing'); return; }
    isDealingRef.current = true;
    // VAMOS-FIX-SCROLLREVEAL 2026-06-17 — fail-safe lock release. If navigation
    // didn't happen within 2.5s, release the lock so the user can press again.
    // Does NOT navigate — only flips isDealingRef. Cleared on unmount or on
    // subsequent press (replaced by a fresh timeout).
    if (dealLockResetRef.current) clearTimeout(dealLockResetRef.current);
    dealLockResetRef.current = setTimeout(() => {
      if (isDealingRef.current) {
        debugLog('H-failsafe: isDealingRef stuck for 2.5s — releasing lock');
        isDealingRef.current = false;
      }
    }, 2500);
    trackAction('deal_pressed');
    // Heatmap (D7)
    import('../utils/heatmap').then(({ trackEvent }) => {
      import('../utils/leaderboard').then(({ getDeviceId }) => {
        getDeviceId().then(id => trackEvent('game', 'deal_pressed', id)).catch(() => {});
      }).catch(() => {});
    }).catch(() => {});
    debugLog('H1 handleReady called');
    if (!allBoardsFull) { isDealingRef.current = false; debugLog('H1.1 NOT allBoardsFull — abort'); return; }
    // AUTO-LEARN 2026-07-06 — was only tracked inside startCountdown(), which is gated
    // behind `!countdownActive` (only the FIRST hand-ready call in a game starts the
    // shared countdown). A player confirming placement after that gate had already
    // flipped never got counted, so cards_placed under-fired relative to hands
    // completed (11 vs 13, an impossible ratio). Track unconditionally, right where a
    // placement is confirmed — guaranteed once per hand via the guards above.
    track('cards_placed', { mode: isPractice ? 'practice' : 'solo', numberOfPlayers, boardCount }, 'game');
    debugLog(`H2 boards: ${boards.map(b => `${b.playerCards.length}/4`).join(' ')}`);
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
      // VAMOS-FIX-SCROLLREVEAL 2026-06-17 — PRODUCTION fail-safe for the
      // waiting_for_bot stall. If a bot-complete handler silently no-ops, the
      // game would stall forever in this phase. After 8s, force doNavigate via
      // the SAME entry point a normal bot-complete uses. Cleared automatically
      // when phase transitions out of waiting_for_bot (useEffect below).
      if (waitingForBotResetRef.current) clearTimeout(waitingForBotResetRef.current);
      waitingForBotResetRef.current = setTimeout(() => {
        if (playerReadyRef.current && boardsRef.current && boardsRef.current.length > 0) {
          debugLog('H-failsafe: waiting_for_bot stalled 8s — forcing doNavigate');
          doNavigateRef.current(boardsRef.current);
        }
      }, 8000);
    }
  }, [allBoardsFull, boards, countdownActive, startCountdown, numberOfBots]);

  // Demo deep-link (caps-poker://game?demo=1): auto-fill all 4 boards + auto-ready,
  // so the iOS simulator auto-tour (ios-simulator-smoke.yml) can capture the full
  // game flow without an XCUITest target. Same shape as autoSim, simpler params.
  useEffect(() => {
    if (demo !== '1') return;
    debugLog('demo deep-link: auto-fill in 2s, ready in 4s');
    const t1 = setTimeout(() => {
      autoFillAllBoards();
    }, 2000);
    const t2 = setTimeout(() => { handleReady(); }, 4000);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [demo]);

  // Auto-sim: auto-fill all boards + press Ready (debug marathon mode)
  useEffect(() => {
    if (autoSim !== 'true') return;
    const simCount = parseInt(autoSimCount ?? '1', 10);
    const currentHand = parseInt(currentSimHand ?? '1', 10);
    debugLog(`🤖 AUTO-SIM: hand ${currentHand}/${simCount} — auto-fill in 1.5s`);
    const t1 = setTimeout(() => {
      debugLog('🤖 AUTO-SIM: filling all boards');
      autoFillAllBoards();
    }, 1500);
    const t2 = setTimeout(() => {
      debugLog('🤖 AUTO-SIM: pressing READY');
      handleReady();
    }, 3000);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [autoSim]);

  const handleBack = useCallback(() => {
    const leave = () => {
      // MP-STABILITY 2026-07-06 (Problem 2) — a simple back-tap must NOT evict the held
      // realtime seat. This used to call endPracticeLive() unconditionally, tearing down
      // the seat-hold + heartbeat on ANY exit from the practice screen — including on WEB,
      // where the branch below skips confirmation entirely and calls leave() straight away.
      // The whole point of "practice while holding my spot" is that idle navigation can't
      // cost the seat: the coordinator is a module-level singleton (utils/practiceLiveSession)
      // that keeps heartbeating regardless of which screen is mounted, so routing to the
      // lobby (where the held table is still visible) is enough — the seat is only ever
      // freed by an explicit leave-table action, not a back-tap.
      if (liveMode) { router.replace('/lobby' as any); return; }
      router.replace('/');
    };

    // On web, Alert.alert uses window.confirm which is unreliable — navigate directly
    if (Platform.OS === 'web') {
      leave();
      return;
    }

    if (isArranging || phase.type === 'waiting_for_bot') {
      Alert.alert(
        t().leaveGame.title,
        t().leaveGame.body,
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

  // ÂÂ Landscape / widescreen layout ÂÂÂÂÂÂÂÂÂÂÂÂÂÂÂÂÂÂÂÂÂÂÂÂÂÂÂÂÂÂÂÂÂÂÂÂÂÂÂÂÂÂ
  if (isLandscape) {
    return (
      <SafeAreaView style={[styles.container, landscapeStyles.root, { backgroundColor: theme.background }, Platform.OS === 'web' && visualTheme === 'fiveo' && { background: 'radial-gradient(ellipse at 50% 40%, #5A1520 0%, #161922 70%)' } as any]}>
        <FriendsBg />
        {/* watermark removed from game screen */}
        {/* LEFT — Your hand */}
        <View style={[landscapeStyles.leftPanel, visualTheme === 'fiveo' && { backgroundColor: theme.surface }]}>
          <View style={landscapeStyles.panelTitleRow}>
            <Text style={landscapeStyles.panelAvatarText} accessibilityElementsHidden={true} importantForAccessibility="no-hide-descendants">{playerAvatar}</Text>
            <Text style={landscapeStyles.panelTitle} accessibilityRole="header">{playerDisplayName.toUpperCase()}</Text>
          </View>
          {isArranging && (
            <PlayerHand
              cards={playerHand}
              selectedCardIds={selectedCardIds}
              onSelectCard={handleSelectCard}
            />
          )}
          {isArranging && (boardError || selectedCardIds.length > 0) && (
            <Text style={boardError ? styles.boardErrorText : styles.selectionHint} accessibilityLiveRegion={boardError ? 'assertive' : 'polite'}>
              {boardError
                ? boardError
                : `${selectedCardIds.length} selected`}
            </Text>
          )}
          {isArranging && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Undo last card placement"
              accessibilityState={{ disabled: boards.every((b) => b.playerCards.length === 0) }}
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
            <Pressable accessibilityRole="button" accessibilityLabel="Leave game" onPress={handleBack} style={[styles.backButton, { minHeight: 44, minWidth: 44 }]} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={styles.backText} accessibilityElementsHidden={true} importantForAccessibility="no-hide-descendants">{'\u2715'}</Text>
            </Pressable>
            <View style={styles.topCenter}>
              {countdownActive && isArranging && (
                <TimerController countdown={countdown} total={COUNTDOWN_SECONDS} isActive={countdownActive && isArranging} firstFinisher={firstFinisher} timerSize={timerPulsing ? 54 : 44} timerColor={timerColor} timerPulsing={timerPulsing} />
              )}
              {!countdownActive && isArranging && (
                <Text style={styles.freePlayLabel}>Arrange freely</Text>
              )}
              {playerReady && !allBotsReady && (
                <Text style={styles.waitingText} accessibilityLiveRegion="polite">{t().waitingForBots(numberOfBots)}</Text>
              )}
            </View>
            <View style={styles.headerChips}>
              <Text style={styles.headerChipsEmoji} accessibilityElementsHidden={true} importantForAccessibility="no-hide-descendants">💰</Text>
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
          <Text
            style={landscapeStyles.panelTitle}
            accessibilityRole="header"
            accessibilityLanguage="he"
            accessibilityLabel={numberOfBots === 1 ? t().botSingular : t().botPlural(readyBotCount, numberOfBots)}
          >
            {numberOfBots === 1 ? `🤖 ${t().botSingular}` : t().botEmojiPlural(readyBotCount, numberOfBots)}
          </Text>
          <View style={[styles.botStatusPill, allBotsReady ? styles.botReadyPill : styles.botThinkingPill, { marginTop: 4 }]} accessibilityLiveRegion="polite">
            <Text
              style={[styles.botStatusText, allBotsReady ? styles.botReadyText : styles.botThinkingText, { textAlign: 'center' }]}
              accessibilityLabel={allBotsReady ? t().ready : `Bots thinking, ${readyBotCount} of ${numberOfBots} ready`}
              accessibilityElementsHidden={false}
              importantForAccessibility="auto"
            >
              {allBotsReady ? `✓ ${t().ready}` : '…'}
            </Text>
          </View>
          {isArranging && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={allBoardsFull ? t().a11yReadyReveal : t().a11yPlaceRemaining}
              accessibilityState={{ disabled: !allBoardsFull }}
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
            <Pressable accessibilityRole="button" accessibilityLabel="Continue to results" style={[styles.continueBtn, { position: 'relative', bottom: 0 }]} onPress={() => doNavigateRef.current(boardsRef.current)}>
              <Text style={styles.continueBtnText} accessibilityLanguage={getLanguage() === "he" ? "he" : undefined} accessibilityLabel={t().continueArrow.replace(" →", "")}>{t().continueArrow}</Text>
            </Pressable>
          )}
        </View>
      {showSafeReveal && (
        <BoardReveal boards={pendingRevealBoards} onDone={onRevealDone} revealSpeed={config.revealSpeed} />
      )}
      </SafeAreaView>
    );
  }
  // ÂÂ End landscape layout ÂÂÂÂÂÂÂÂÂÂÂÂÂÂÂÂÂÂÂÂÂÂÂÂÂÂÂÂÂÂÂÂÂÂÂÂÂÂÂÂÂÂÂÂÂÂÂÂÂÂÂÂ

  return (
    <GameView
      theme={theme}
      visualTheme={visualTheme}
      onBack={handleBack}
      chips={chips}
      screenW={screenW}
      layout={_L}
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
      isPractice={isPractice}
      potPerBoard={config.potPerBoard}
      countdownActive={countdownActive}
      countdown={countdown}
      timeBankUsed={timeBankUsed}
      gamesPlayed={gamesPlayed}
      playerReady={playerReady}
      allBotsReady={allBotsReady}
      showContinueButton={showContinueButton}
      showTimerBar={countdownActive && isArranging}
      timerBarCountdown={countdown}
      timerBarTotal={COUNTDOWN_SECONDS}
      timerBarColor={timerColor}
      onSelectCard={handleSelectCard}
      onBoardPress={handleBoardPress}
      onRemoveCard={handleRemoveCardFromBoard}
      onAutoFill={handleAutoFill}
      onAutoFillAll={autoFillAllBoards}
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
      reveal={showSafeReveal ? { boards: pendingRevealBoards, onDone: onRevealDone, revealSpeed: config.revealSpeed, isFirstGame, isPractice } : null}
      preChrome={
        <>
          {/* BUILD467-VERIFY layout debug readout -- gated by AsyncStorage debug_overlay_enabled */}
          {layoutDebugVisible && (
            <View
              pointerEvents="none"
              style={{
                position: 'absolute',
                top: insets.top + 4,
                right: 4,
                zIndex: 99998,
                backgroundColor: 'rgba(0,0,0,0.78)',
                borderColor: 'rgba(0,255,0,0.45)',
                borderWidth: 1,
                borderRadius: 6,
                paddingHorizontal: 6,
                paddingVertical: 4,
                maxWidth: 180,
              }}
            >
              <Text style={{ color: '#00ff00', fontSize: 9, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' }}>
                {`B471 dim ${screenW}x${SCREEN_H}`}{'\n'}
                {`bc=${boardCount} hand=${_handZoneActualH}/${PLAYER_HAND_H}`}{'\n'}
                {`cell=${_cellW}x${_cellH} grid=${_gridCols}x${_gridRows}`}{'\n'}
                {`bCardH=${_boardCardH} cap=${boardCardCapDp}`}
              </Text>
            </View>
          )}
          {/* D1: auto-place trail flash overlay */}
          <AnimatedRN.View
            pointerEvents="none"
            style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(201,168,76,0.18)', opacity: autoPlaceFlashAnim, zIndex: 99 }]}
          />
        </>
      }
      topCenter={
        <>
          {countdownActive && isArranging && (
            <View style={styles.countdownSection} accessibilityLiveRegion="polite">
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
              {cardsRemaining === 0 ? t().allPlaced : t().arrangeCards(cardsRemaining)}
            </Text>
          )}
          {playerReady && !allBotsReady && (
            <Text style={styles.waitingText} accessibilityLiveRegion="polite">
              {t().waitingForBots(numberOfBots)}
            </Text>
          )}
          {playerReady && allBotsReady && !showContinueButton && !showSafeReveal && (
            <Text style={styles.calculatingText} accessibilityLiveRegion="polite">Calculating results...</Text>
          )}
        </>
      }
      header={
        <View style={styles.botStatusRow}>
          <Text style={styles.botEmoji} accessibilityElementsHidden={true} importantForAccessibility="no-hide-descendants">🤖</Text>
          <Text style={styles.botNameLabel} accessibilityLanguage="he">
            {numberOfBots === 1 ? `${t().botSingular} 1` : t().botPlural(readyBotCount, numberOfBots)}
          </Text>
          <View style={[styles.botStatusPill, allBotsReady ? styles.botReadyPill : styles.botThinkingPill]}>
            <Text
              style={[styles.botStatusText, allBotsReady ? styles.botReadyText : styles.botThinkingText]}
              accessibilityLabel={allBotsReady ? t().ready : `Bots thinking, ${readyBotCount} of ${numberOfBots} ready`}
              accessibilityElementsHidden={false}
              importantForAccessibility="auto"
            >
              {allBotsReady ? `✓ ${t().ready}` : '…'}
            </Text>
          </View>
        </View>
      }
      chrome={
        <>
          {/* PRACTICE-TO-LIVE — on-screen demo session counter (separate from real chips) */}
          {isPractice && (
            <View style={styles.practiceSessionPill} pointerEvents="none" accessibilityRole="text" accessibilityLabel={practiceSessionNet === 0 ? 'Practice, no chips at stake' : `Practice, this session ${practiceSessionNet > 0 ? 'plus' : 'minus'} ${Math.abs(practiceSessionNet)} chips`}>
              {/* "Session +0" is dev jargon — until the player has actually won/lost, just say
                  what matters (no real chips). Show the running tally only once it's non-zero. */}
              <Text style={styles.practiceSessionText}>
                {practiceSessionNet === 0
                  ? '🤖 Practice · no chips'
                  : `🤖 Practice · ${practiceSessionNet > 0 ? '+' : ''}${practiceSessionNet} chips`}
              </Text>
            </View>
          )}
          {/* PRACTICE-TO-LIVE — synced countdown when a real opponent joins; jumps at hand-end or deadline */}
          {liveMode && <PracticeLiveOverlay />}
          {/* Guided first-game tooltips (tips 1-6) -- non-blocking */}
          {/* Tutorial dim overlay -- steps 1-2 only, focuses attention, non-blocking */}
          {isFirstGame && tooltipVisible && (tooltipStep === 1 || tooltipStep === 2) && (
            <View
              style={{ ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.38)', zIndex: 40, alignItems: 'center', justifyContent: tooltipStep === 1 ? 'flex-end' : 'flex-start', paddingBottom: tooltipStep === 1 ? rs(200) : 0, paddingTop: tooltipStep === 2 ? rs(80) : 0 }}
              pointerEvents="none"
            >
              <Text
                style={{ color: '#c9a84c', fontSize: rs(32), opacity: 0.9 }}
                accessibilityElementsHidden={true}
                importantForAccessibility="no-hide-descendants"
              >
                {tooltipStep === 1 ? '↓' : '↑'}
              </Text>
            </View>
          )}

          {/* Guided first-game tooltips (tips 1-6) -- non-blocking */}
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
            <View style={styles.autoPlaceToast} pointerEvents="none" accessibilityLiveRegion="polite">
              <Text style={styles.autoPlaceToastText} accessibilityLanguage={getLanguage() === "he" ? "he" : undefined} accessibilityLabel={t().timeUpAutoplaced.replace("⏱ ", "")}>{t().timeUpAutoplaced}</Text>
            </View>
          )}
        </>
      }
    />
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
    // VAMOS-PLACEMENT-POLISH D4 (#9) — amber #FFC107 → mint
    color: COLORS.mint,
    fontSize: rf(10),
    fontWeight: '700',
    letterSpacing: 1,
  },
  freePlayLabel: {
    // VAMOS-BOARD-FILL 2026-06-15 — the "PLACE N CARDS" / "מקם N קלפים" header status
    // pill. Was the gray pill Roye flagged ("prior pass restyled placeBtn by mistake"
    // — that was the Confirm button, not THIS pill). Now mint to match top chrome.
    color: COLORS.mint,
    fontSize: rf(12),
    fontWeight: '700',
    letterSpacing: 1.5,
    paddingHorizontal: rs(12),
    paddingVertical: rs(4),
    borderRadius: rv(12),
    backgroundColor: 'rgba(79,214,168,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(79,214,168,0.30)',
    overflow: 'hidden',
    textTransform: 'uppercase' as any,
  },
  headerChips: {
    // VAMOS-PLACEMENT-POLISH-2 FIX 3 — money/balance pill: gold rgba bg/border → mint
    flexDirection: 'row',
    alignItems: 'center',
    gap: rs(4),
    backgroundColor: 'rgba(79,214,168,0.12)',
    borderRadius: rv(12),
    paddingVertical: rs(4),
    paddingHorizontal: rs(10),
    borderWidth: 1,
    borderColor: 'rgba(79,214,168,0.25)',
  },
  headerChipsEmoji: {
    fontSize: rf(14),
    lineHeight: rf(18),
  },
  headerChipsAmount: {
    // VAMOS-PLACEMENT-POLISH-2 FIX 3 — amount text gold → mint
    color: COLORS.mint,
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
  // PRACTICE-TO-LIVE — on-screen demo session counter pill (top center, non-blocking)
  practiceSessionPill: {
    position: 'absolute',
    top: rs(6),
    alignSelf: 'center',
    backgroundColor: 'rgba(245,181,70,0.16)',
    borderWidth: 1,
    borderColor: 'rgba(245,181,70,0.5)',
    borderRadius: rv(14),
    paddingVertical: rs(4),
    paddingHorizontal: rs(12),
    zIndex: 45,
  },
  practiceSessionText: {
    color: '#F5B546',
    fontSize: rf(12),
    fontWeight: '800',
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
    // VAMOS-PLACEMENT-POLISH D4 (#9) — amber → mint ghost
    backgroundColor: 'rgba(79,214,168,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(79,214,168,0.4)',
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
    // VAMOS-PLACEMENT-POLISH D4 (#9) — amber → mint
    color: COLORS.mint,
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
    // RESPONSIVE-FIX 2026-07-06 — was a plain hardcoded 48. Switched to rb() (floors at
    // 44pt, the HIG minimum touch target) rather than rv()/rs() — a naive linear scale
    // would shrink this below 44pt on narrow screens (rv(48) at 320pt ≈ 39pt).
    height: rb(48),
    minHeight: rb(48),
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: rv(12),
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
    // VAMOS-PLACEMENT-POLISH B2 (#2) — Cancel/Undo restyled as a SECONDARY in-theme
    // action: mint-outline on transparent. Matches mint primary, no clashing gold.
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: COLORS.mint,
  },
  placeBtn: {
    // VAMOS-PLACEMENT-POLISH B2 (#2) — primary CTA is now MINT solid (was '#C5A028'
    // gold literal). Disabled state cascades via placeBtnDisabled opacity.
    backgroundColor: COLORS.mint,
    flex: 1,
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: COLORS.mint,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.45,
        shadowRadius: 8,
      },
      android: { elevation: 8 },
      default: {},
    }),
  },
  placeBtnDisabled: {
    // VAMOS-PLACEMENT-POLISH B2 (#2) — solid muted mint instead of opacity over gold.
    backgroundColor: 'rgba(79,214,168,0.35)',
    opacity: 1,
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
    color: 'rgba(255,255,255,0.75)',
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
