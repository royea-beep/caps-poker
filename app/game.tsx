import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, Pressable, StyleSheet, Alert, useWindowDimensions, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Board from '../components/Board';
import PlayerHand from '../components/PlayerHand';
import ChipsDisplay from '../components/ChipsDisplay';
import { useGameStore } from '../store/gameStore';
import { COLORS, Card, CARDS_PER_BOARD, getBoardCount } from '../constants/gameConfig';
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
import { playSound } from '../utils/sounds';
import { CapsHooks } from '../utils/learning';
import { FriendsBg } from '../components/FriendsBg';
import { rv } from '../constants/deviceBreakpoints';
import { OrientationType } from '../store/gameStore';

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

// Circular timer component
function CircularTimer({ timeLeft, size, color, pulsing }: { timeLeft: number; size: number; color: string; pulsing: boolean }) {
  const pulseScale = useSharedValue(1);

  useEffect(() => {
    if (pulsing) {
      pulseScale.value = withRepeat(
        withSequence(
          withTiming(1.12, { duration: 500 }),
          withTiming(1, { duration: 500 }),
        ),
        -1,
      );
    } else {
      pulseScale.value = withTiming(1, { duration: 200 });
    }
  }, [pulsing]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
  }));

  const s = timeLeft % 60;
  const timeStr = `0:${s.toString().padStart(2, '0')}`;

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
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
});

const COUNTDOWN_SECONDS = 30;

// Layout constants
const TOP_BAR_H = 44;
const BOT_STATUS_H = 24;       // label + paddingVertical ≈ 24px
const FLOATING_ACTIONS_H = 68; // paddingVertical:10×2 + button paddingVertical:12×2 + text ≈ 68px
const HINT_H = 26;             // selectionHint / boardError bar
const BOARD_CHROME = 40;       // per-board: border(4) + pressable pad(8) + header(18) + cardRow gaps(6) + margins

export default function GameScreen() {
  const router = useRouter();
  const { height: SCREEN_H, width: screenW } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const config = useGameStore((s) => s.config);
  const chips = useGameStore((s) => s.chips);
  const storeOrientation = useGameStore((s) => s.orientation);
  const isLandscape = storeOrientation === 'landscape' || (Platform.OS === 'web' && screenW > SCREEN_H);
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
  const BOARD_CARD_H = rv(
    screenW,
    56,   // mobile web (iPhone Safari)
    72,   // tablet web
    100,  // desktop web
    Math.max(32, Math.min(92, Math.floor(boardSpace / 2))),  // native – min 32, max raised to 92
  );
  const isWeb = Platform.OS === 'web';

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
  const precalculatedResultsRef = useRef<ReturnType<typeof calculateHandResultsMulti> | null>(null);

  useEffect(() => { playerHandRef.current = playerHand; }, [playerHand]);
  useEffect(() => { boardsRef.current = boards; }, [boards]);

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
  useEffect(() => {
    if (!countdownActive) return;
    const t = setTimeout(() => {
      if (!mountedRef.current) return;
      try {
        precalculatedResultsRef.current = calculateHandResultsMulti(boardsRef.current, numberOfPlayers, config);
        console.log('[GAME] pre-calculation done during countdown');
      } catch (e) {
        console.warn('[GAME] pre-calculation failed — will recalculate on navigate:', e);
        precalculatedResultsRef.current = null;
      }
    }, 0);
    return () => clearTimeout(t);
  }, [countdownActive]);

  // When countdown hits 0 — auto-place remaining cards randomly
  useEffect(() => {
    if (countdownActive && countdown === 0 && !playerReady) {
      // Shuffle remaining hand and auto-fill
      setBoards((currentBoards) => {
        const shuffled = [...playerHandRef.current].sort(() => Math.random() - 0.5);
        const { boards: filledBoards, remainingHand } = autoFillPlayerCards(shuffled, currentBoards);
        setPlayerHand(remainingHand);
        return filledBoards;
      });
      setSelectedCardIds([]);
      setPlayerReady(true);
      setPhase({ type: 'waiting_for_bot' });
    }
  }, [countdownActive, countdown, playerReady]);

  // Cleanup
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
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

  // Initialize game
  useEffect(() => {
    const { boards: initialBoards, playerHand: pHand, botHands } = initializeGameMulti(numberOfPlayers);
    setBoards(initialBoards);
    setPlayerHand(pHand);
    setBotsReady(new Array(numberOfBots).fill(false));
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
          // Check if this is the first finisher
          const anyPrevReady = prev.some(Boolean);
          if (!anyPrevReady) {
            startCountdown(`Bot ${botIdx + 1}`);
          }
          return updated;
        });
      }, delay);
      timeoutsRef.current.push(botTimer);
    }
  }, []);

  // Navigate to reveal when all ready (player + bots)
  const navigateToReveal = useCallback((currentBoards: BoardState[]) => {
    console.log('[navigateToReveal] called — mountedRef:', mountedRef.current, 'boards:', currentBoards.length);
    if (!mountedRef.current) {
      console.warn('[navigateToReveal] aborted — component unmounted');
      return;
    }
    let results;
    try {
      if (precalculatedResultsRef.current) {
        console.log('[navigateToReveal] using pre-calculated results');
        results = precalculatedResultsRef.current;
        precalculatedResultsRef.current = null;
      } else {
        console.log('[navigateToReveal] calculating results now (no pre-calc available)...');
        results = calculateHandResultsMulti(currentBoards, numberOfPlayers, config);
      }
      console.log('[navigateToReveal] results ready — playerChipsWon:', results.playerChipsWon);
    } catch (e) {
      console.error('[navigateToReveal] calculateHandResultsMulti threw:', e);
      router.replace('/');
      return;
    }

    const revealBoards: RevealBoardData[] = currentBoards.map((board, i) => {
      const result = results.boardResults[i];
      const playerHighlightIds = result ? result.playerResult.playerCardsUsed.map((c) => c.id) : [];
      const botHighlightIds = result ? result.botResult.playerCardsUsed.map((c) => c.id) : [];
      const boardHighlightIds = result ? [
        ...result.playerResult.boardCardsUsed.map((c) => c.id),
        ...result.botResult.boardCardsUsed.map((c) => c.id),
      ] : [];
      const allBotHandNames = results.allBotResults[i]?.map((br) => br.name) || [];

      return {
        openCards: board.openCards,
        closedCards: board.closedCards,
        playerCards: board.playerCards,
        allBotCards: board.allBotCards,
        winner: result ? result.winner : ('tie' as const),
        playerHandName: result?.playerResult.name || '',
        botHandName: result?.botResult.name || '',
        allBotHandNames,
        playerHighlightIds,
        botHighlightIds,
        boardHighlightIds,
        potAmount: config.potPerBoard * numberOfPlayers,
      };
    });

    addChips(results.playerChipsWon);

    console.log('[navigateToReveal] calling setRevealData...');
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
    console.log('[navigateToReveal] setRevealData done — calling router.replace /results...');

    CapsHooks.gameCompleted(results.playerChipsWon, results.playerChipsWon > 0, 0);
    try {
      router.replace('/results' as any);
      console.log('[navigateToReveal] router.replace /results called OK');
    } catch (e) {
      console.error('[navigateToReveal] router.replace /results threw:', e);
      try {
        console.log('[navigateToReveal] trying router.push /results...');
        router.push('/results' as any);
        console.log('[navigateToReveal] router.push /results called OK');
      } catch (e2) {
        console.error('[navigateToReveal] router.push also failed:', e2);
      }
    }
  }, [config, numberOfPlayers, boardCount, setRevealData, addChips, router]);

  // Keep navigateToReveal in a ref so the trigger effect has no stale-closure risk.
  // Without this, Zustand config rehydration creates a new navigateToReveal reference,
  // which re-runs the effect mid-navigation and can double-fire or miss the call entirely.
  const navigateToRevealRef = useRef(navigateToReveal);
  useEffect(() => { navigateToRevealRef.current = navigateToReveal; }, [navigateToReveal]);

  const allBotsReady = botsReady.length > 0 && botsReady.every(Boolean);

  // Log state changes for debugging
  useEffect(() => {
    console.log('[GAME] playerReady changed:', playerReady);
  }, [playerReady]);
  useEffect(() => {
    console.log('[GAME] allBotsReady changed:', allBotsReady, '| botsReady:', JSON.stringify(botsReady));
  }, [allBotsReady]);

  useEffect(() => {
    console.log('[GAME] ready effect fired — playerReady:', playerReady, 'allBotsReady:', allBotsReady);
    if (!playerReady || !allBotsReady) return;
    console.log('[GAME] both ready — starting navigation to reveal');
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }
    // Show fallback button after 3s in case auto-navigation fails
    const fallbackTimer = setTimeout(() => {
      if (mountedRef.current) {
        console.log('[GAME] fallback button showing — auto-nav may have failed');
        setShowContinueButton(true);
      }
    }, 3000);
    navigateToRevealRef.current(boardsRef.current);
    return () => clearTimeout(fallbackTimer);
  }, [playerReady, allBotsReady]);

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

  // Tap board → place all selectedCardIds (or first hand card if none selected)
  const handleBoardPress = useCallback(
    (boardIndex: number) => {
      if (!isArranging) return;
      const currentHand = playerHandRef.current;
      if (currentHand.length === 0) return;

      setBoards((prev) => {
        const board = prev[boardIndex];
        if (!board) return prev;

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
          return prev;
        }

        // Determine which cards to place
        const cardsToPlace: Card[] = selectedCardIds.length > 0
          ? selectedCardIds
              .map((id) => currentHand.find((c) => c.id === id))
              .filter((c): c is Card => c !== undefined)
              .slice(0, emptySlots)
          : currentHand.slice(0, 1); // fallback: place first card

        if (cardsToPlace.length === 0) return prev;

        haptic(Haptics?.ImpactFeedbackStyle?.Medium);
        playSound('cardPlace');
        const placedIds = new Set(cardsToPlace.map((c) => c.id));
        const updated = [...prev];
        updated[boardIndex] = {
          ...board,
          playerCards: [...board.playerCards, ...cardsToPlace],
        };
        setPlayerHand((hand) => hand.filter((c) => !placedIds.has(c.id)));
        setSelectedCardIds([]);
        return updated;
      });
    },
    [isArranging, selectedCardIds]
  );

  // Tap placed card → remove from board
  const handleRemoveCardFromBoard = useCallback(
    (boardIndex: number, card: Card) => {
      if (!isArranging) return;
      haptic(Haptics?.ImpactFeedbackStyle?.Light);
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
  const handleAutoFill = useCallback(
    (boardIndex: number) => {
      if (!isArranging) return;
      const currentHand = playerHandRef.current;
      if (currentHand.length === 0) return;
      setBoards((prev) => {
        const board = prev[boardIndex];
        if (!board || board.playerCards.length > 0) return prev;
        const slots = CARDS_PER_BOARD - board.playerCards.length;
        const cardsToPlace = currentHand.slice(0, slots);
        if (cardsToPlace.length === 0) return prev;
        haptic(Haptics?.ImpactFeedbackStyle?.Medium);
        playSound('cardPlace');
        const placedIds = new Set(cardsToPlace.map((c) => c.id));
        const updated = [...prev];
        updated[boardIndex] = { ...board, playerCards: [...board.playerCards, ...cardsToPlace] };
        setPlayerHand((hand) => hand.filter((c) => !placedIds.has(c.id)));
        setSelectedCardIds([]);
        return updated;
      });
    },
    [isArranging]
  );

  const allBoardsFull = boards.every((b) => b.playerCards.length === CARDS_PER_BOARD);

  const handleReady = useCallback(() => {
    if (!allBoardsFull) return;
    hapticNotify(Haptics?.NotificationFeedbackType?.Success);
    setSelectedCardIds([]);
    setPlayerReady(true);
    setPhase({ type: 'waiting_for_bot' });

    // If no countdown started yet, player is the first finisher — start countdown for bots
    if (!countdownActive) {
      startCountdown('You');
    }
  }, [allBoardsFull, countdownActive, startCountdown]);

  const handleBack = useCallback(() => {
    const leave = () => {
      if (router.canGoBack()) {
        router.back();
      } else {
        router.replace('/');
      }
    };

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
  const TIMER_SIZE = 52;

  // ── Landscape / widescreen layout ──────────────────────────────────────────
  if (isLandscape) {
    return (
      <SafeAreaView style={[styles.container, landscapeStyles.root]}>
        <FriendsBg />

        {/* LEFT — Your hand */}
        <View style={landscapeStyles.leftPanel}>
          <Text style={landscapeStyles.panelTitle}>YOUR HAND</Text>
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
              <Text style={[styles.floatingBtnText, boards.every((b) => b.playerCards.length === 0) && styles.floatingBtnDisabled]}>UNDO</Text>
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
                />
              </Animated.View>
            ))}
          </View>
        </View>

        {/* RIGHT — bot + ready */}
        <View style={landscapeStyles.rightPanel}>
          <Text style={landscapeStyles.panelTitle}>
            {numberOfBots === 1 ? 'BOT' : `BOTS ${readyBotCount}/${numberOfBots}`}
          </Text>
          <Text style={[styles.botLabel, { textAlign: 'center' }]}>
            {allBotsReady ? '✓ READY' : '...'}
          </Text>
          {isArranging && (
            <Pressable
              style={[styles.floatingBtn, styles.placeBtn, !allBoardsFull && styles.placeBtnDisabled, landscapeStyles.readyBtn]}
              onPress={handleReady}
              disabled={!allBoardsFull}
            >
              <Text style={[styles.floatingBtnText, styles.placeBtnText]}>
                {allBoardsFull ? 'READY' : `${boards.reduce((sum, b) => sum + (CARDS_PER_BOARD - b.playerCards.length), 0)} left`}
              </Text>
            </Pressable>
          )}
          {playerReady && allBotsReady && showContinueButton && (
            <Pressable style={[styles.continueBtn, { position: 'relative', bottom: 0 }]} onPress={() => navigateToRevealRef.current(boardsRef.current)}>
              <Text style={styles.continueBtnText}>CONTINUE →</Text>
            </Pressable>
          )}
        </View>
      </SafeAreaView>
    );
  }
  // ── End landscape layout ────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.container}>
      <FriendsBg />
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
              <Text style={styles.countdownLabel}>{firstFinisher} finished!</Text>
            </View>
          )}
          {!countdownActive && isArranging && (
            <Text style={styles.freePlayLabel}>Arrange freely</Text>
          )}
          {playerReady && !allBotsReady && (
            <Text style={styles.waitingText}>
              Waiting for bot{numberOfBots > 1 ? 's' : ''}...
            </Text>
          )}
          {playerReady && allBotsReady && !showContinueButton && (
            <Text style={styles.calculatingText}>Calculating results...</Text>
          )}
        </View>
        <ChipsDisplay amount={chips} />
      </View>

      {/* Bot status */}
      <View style={styles.botSection}>
        {numberOfBots === 1 ? (
          <Text style={styles.botLabel}>
            BOT {allBotsReady ? '\u2713 READY' : ''}
          </Text>
        ) : (
          <Text style={styles.botLabel}>
            BOTS {readyBotCount}/{numberOfBots} READY
          </Text>
        )}
      </View>

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
            />
          </Animated.View>
        ))}
      </View>

      {/* Fallback continue button — shows 3s after both ready if auto-nav failed */}
      {playerReady && allBotsReady && showContinueButton && (
        <Pressable
          style={styles.continueBtn}
          onPress={() => {
            console.log('[GAME] fallback button pressed — calling navigateToReveal manually');
            navigateToRevealRef.current(boardsRef.current);
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
            style={[styles.floatingBtn, styles.placeBtn, !allBoardsFull && styles.placeBtnDisabled]}
            onPress={handleReady}
            disabled={!allBoardsFull}
          >
            <Text style={[styles.floatingBtnText, styles.placeBtnText]}>
              {allBoardsFull ? 'READY' : `${boards.reduce((sum, b) => sum + (CARDS_PER_BOARD - b.playerCards.length), 0)} left`}
            </Text>
          </Pressable>
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
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  backButton: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 18,
  },
  backText: {
    color: COLORS.textSecondary,
    fontSize: 16,
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
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
  },
  freePlayLabel: {
    color: COLORS.textMuted,
    fontSize: 13,
    fontWeight: '600',
    fontStyle: 'italic',
  },
  botSection: {
    alignItems: 'center',
    paddingVertical: 2,
  },
  botLabel: {
    color: COLORS.textSecondary,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
  },
  boardsColumn: {
    flex: 1,
    flexDirection: 'column',
    paddingHorizontal: 16,
    gap: 4,
  },
  boardsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-start',
    paddingHorizontal: 8,
    width: '100%',
  },
  boardCellFull: {
    flex: 1,
  },
  boardCellHalf: {
    width: '50%',
    paddingHorizontal: 4,
    paddingVertical: 4,
  },
  boardCellThird: {
    width: '33.33%',
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  waitingText: {
    color: COLORS.textSecondary,
    fontSize: 14,
    fontWeight: '600',
  },
  calculatingText: {
    color: COLORS.gold,
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 1,
  },
  selectionHint: {
    textAlign: 'center',
    color: COLORS.gold,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
    paddingVertical: 4,
  },
  boardErrorText: {
    textAlign: 'center',
    color: COLORS.neonRed,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
    paddingVertical: 4,
  },
  floatingActions: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  floatingBtn: {
    paddingVertical: 12,
    paddingHorizontal: 28,
    borderRadius: 24,
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
  floatingBtnText: {
    color: COLORS.textPrimary,
    fontSize: 14,
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
    bottom: 100,
    alignSelf: 'center',
    backgroundColor: COLORS.gold,
    paddingVertical: 14,
    paddingHorizontal: 40,
    borderRadius: 24,
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
    fontSize: 16,
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
    paddingHorizontal: 8,
    paddingVertical: 8,
    alignItems: 'center',
    borderRightWidth: 1,
    borderRightColor: COLORS.boardBorder,
    gap: 6,
  },
  centerPanel: {
    flex: 1,
    flexDirection: 'column',
  },
  boardsGrid: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 6,
    gap: 4,
  },
  boardCell: {
    width: '49%',
    flex: undefined,
    minHeight: 120,
  },
  rightPanel: {
    width: '18%',
    paddingHorizontal: 8,
    paddingVertical: 8,
    alignItems: 'center',
    borderLeftWidth: 1,
    borderLeftColor: COLORS.boardBorder,
    gap: 8,
  },
  panelTitle: {
    color: COLORS.gold,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 2,
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  readyBtn: {
    marginTop: 'auto' as any,
    width: '100%',
    paddingHorizontal: 8,
    alignItems: 'center',
  },
});
