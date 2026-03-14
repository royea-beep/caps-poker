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
import { Button } from '../components/Button';
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
import { useGameTimer } from '../hooks/useGameTimer';
import { playSound } from '../utils/sounds';
import { CapsHooks } from '../utils/learning';

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
function CircularTimer({ timeLeft, totalTime, size, color, pulsing }: { timeLeft: number; totalTime: number; size: number; color: string; pulsing: boolean }) {
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

  const m = Math.floor(timeLeft / 60);
  const s = timeLeft % 60;
  const timeStr = `${m}:${s.toString().padStart(2, '0')}`;

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

// Layout constants (heights that don't depend on safe area)
const TOP_BAR_H = 44;
const BOT_STATUS_H = 20;
const PLAYER_HAND_H = 130;
const READY_BTN_H = 48;

export default function GameScreen() {
  const router = useRouter();
  const { height: SCREEN_H } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const config = useGameStore((s) => s.config);
  const chips = useGameStore((s) => s.chips);
  const addChips = useGameStore((s) => s.addChips);
  const trackChipsSpent = useGameStore((s) => s.trackChipsSpent);
  const setRevealData = useGameStore((s) => s.setRevealData);

  const numberOfPlayers = config.numberOfPlayers as 2 | 3 | 4;
  const numberOfBots = numberOfPlayers - 1;
  const boardCount = getBoardCount(numberOfPlayers);

  // Layout: boards share space above PlayerHand — use actual safe area insets
  const safeH = SCREEN_H - insets.top - insets.bottom;
  const BOARD_GAPS = (boardCount - 1) * 4;
  const BOARD_CHROME = 20;
  const boardSpace = (safeH - TOP_BAR_H - BOT_STATUS_H - PLAYER_HAND_H - READY_BTN_H - BOARD_GAPS) / boardCount - BOARD_CHROME;
  // During arrangement: community row + player row = 2 rows per board
  const BOARD_CARD_H = Math.max(28, Math.min(52, Math.floor(boardSpace / 2)));

  const [boards, setBoards] = useState<BoardState[]>([]);
  const [playerHand, setPlayerHand] = useState<Card[]>([]);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [botsReady, setBotsReady] = useState<boolean[]>([]);
  const [phase, setPhase] = useState<GamePhase>({ type: 'arranging', timeLeft: config.arrangementTime });

  const mountedRef = useRef(true);
  const timeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const playerHandRef = useRef(playerHand);
  const boardsRef = useRef(boards);

  useEffect(() => { playerHandRef.current = playerHand; }, [playerHand]);
  useEffect(() => { boardsRef.current = boards; }, [boards]);

  const isArranging = phase.type === 'arranging';

  // Auto-fill and ready handler (timer expired)
  const handleAutoFillAndReady = useCallback(() => {
    setBoards((currentBoards) => {
      const { boards: filledBoards, remainingHand } = autoFillPlayerCards(playerHandRef.current, currentBoards);
      setPlayerHand(remainingHand);
      return filledBoards;
    });
    setSelectedCardId(null);
    setPhase({ type: 'waiting_for_bot' });
  }, []);

  const timer = useGameTimer({
    initialSeconds: config.arrangementTime,
    onExpire: handleAutoFillAndReady,
    autoStart: true,
  });

  // Cleanup on unmount
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      timeoutsRef.current.forEach((t) => clearTimeout(t));
      timeoutsRef.current = [];
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

    // Bot timers
    for (let botIdx = 0; botIdx < numberOfBots; botIdx++) {
      const delay = config.botSpeedMin + Math.random() * (config.botSpeedMax - config.botSpeedMin);
      const botCards = botHands[botIdx];
      const botTimer = setTimeout(() => {
        if (!mountedRef.current) return;
        setBoards((prev) => placeSingleBotCards(botCards, prev, botIdx));
        setBotsReady((prev) => {
          const updated = [...prev];
          updated[botIdx] = true;
          return updated;
        });
      }, delay);
      timeoutsRef.current.push(botTimer);
    }
  }, []);

  // Sync timer into phase state + warning beep at 10s
  const timerWarnedRef = useRef(false);
  useEffect(() => {
    if (isArranging) {
      setPhase({ type: 'arranging', timeLeft: timer.timeLeft });
      if (timer.timeLeft === 10 && !timerWarnedRef.current) {
        timerWarnedRef.current = true;
        playSound('timerLow');
      }
    }
  }, [timer.timeLeft, isArranging]);

  // Navigate to reveal when bots ready
  const navigateToReveal = useCallback((currentBoards: BoardState[]) => {
    if (!mountedRef.current) return;
    const results = calculateHandResultsMulti(currentBoards, numberOfPlayers, config);

    // Build reveal board data
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

    // Credit chips won
    addChips(results.playerChipsWon);

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

    CapsHooks.gameCompleted(results.playerChipsWon, results.playerChipsWon > 0, 0);
    router.replace('/results');
  }, [config, numberOfPlayers, boardCount, setRevealData, addChips, router]);

  const allBotsReady = botsReady.length > 0 && botsReady.every(Boolean);
  useEffect(() => {
    if (phase.type === 'waiting_for_bot' && allBotsReady) {
      navigateToReveal(boardsRef.current);
    }
  }, [phase.type, allBotsReady, navigateToReveal]);

  // Tap card in hand → select it
  const handleSelectCard = useCallback(
    (card: Card) => {
      if (!isArranging) return;
      haptic(Haptics?.ImpactFeedbackStyle?.Light);
      playSound('cardSelect');
      setSelectedCardId((prev) => (prev === card.id ? null : card.id));
    },
    [isArranging]
  );

  // Tap board slot → place selected card there
  const handleBoardPress = useCallback(
    (boardIndex: number) => {
      if (!isArranging) return;
      const currentHand = playerHandRef.current;
      if (currentHand.length === 0) return;

      // Find the selected card, or use first card if none selected
      const cardToPlace = selectedCardId
        ? currentHand.find((c) => c.id === selectedCardId)
        : currentHand[0];
      if (!cardToPlace) return;

      setBoards((prev) => {
        const board = prev[boardIndex];
        if (!board || board.playerCards.length >= CARDS_PER_BOARD) return prev;
        haptic(Haptics?.ImpactFeedbackStyle?.Medium);
        playSound('cardPlace');
        const updated = [...prev];
        updated[boardIndex] = {
          ...board,
          playerCards: [...board.playerCards, cardToPlace],
        };
        setPlayerHand((hand) => hand.filter((c) => c.id !== cardToPlace.id));
        setSelectedCardId(null);
        return updated;
      });
    },
    [isArranging, selectedCardId]
  );

  // Tap placed card → remove from board, return to hand
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

  const allBoardsFull = boards.every((b) => b.playerCards.length === CARDS_PER_BOARD);

  const handleReady = useCallback(() => {
    if (!allBoardsFull) return;
    hapticNotify(Haptics?.NotificationFeedbackType?.Success);
    timer.stop();
    setSelectedCardId(null);
    setPhase({ type: 'waiting_for_bot' });
  }, [allBoardsFull, timer]);

  const handleBack = useCallback(() => {
    const leave = () => {
      // Always navigate to home — router.back() may fail if navigated via replace
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

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const displayTimeLeft = phase.type === 'arranging' ? phase.timeLeft : 0;
  const timerColor = displayTimeLeft > 30
    ? '#4CAF50'
    : displayTimeLeft > 15
    ? '#FFC107'
    : '#e74c3c';
  const timerPulsing = displayTimeLeft <= 10 && displayTimeLeft > 0;

  const readyBotCount = botsReady.filter(Boolean).length;
  const cardsRemaining = playerHand.length;

  // Circular timer dimensions
  const TIMER_SIZE = 52;

  return (
    <SafeAreaView style={styles.container}>
      {/* Header bar */}
      <View style={styles.topBar}>
        <Pressable onPress={handleBack} style={styles.backButton}>
          <Text style={styles.backText}>{'\u2715'}</Text>
        </Pressable>
        <View style={styles.topCenter}>
          {isArranging && (
            <CircularTimer
              timeLeft={displayTimeLeft}
              totalTime={config.arrangementTime}
              size={TIMER_SIZE}
              color={timerColor}
              pulsing={timerPulsing}
            />
          )}
          {phase.type === 'waiting_for_bot' && (
            <Text style={styles.waitingText}>
              Waiting for bot{numberOfBots > 1 ? 's' : ''}...
            </Text>
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

      {/* Boards — stacked vertically */}
      <View style={styles.boardsColumn}>
        {boards.map((board, i) => (
          <Board
            key={i}
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
            isArrangement={isArranging}
            selected={isArranging && cardsRemaining > 0 && board.playerCards.length < CARDS_PER_BOARD}
            cardHeight={BOARD_CARD_H}
          />
        ))}
      </View>

      {/* Player hand — face-up cards at bottom */}
      {isArranging && (
        <PlayerHand
          cards={playerHand}
          selectedCardId={selectedCardId ?? undefined}
          onSelectCard={handleSelectCard}
        />
      )}

      {/* Floating action buttons */}
      {isArranging && (
        <View style={styles.floatingActions}>
          <Pressable
            style={[styles.floatingBtn, styles.undoBtn]}
            onPress={() => {
              // Remove last placed card from any board
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
  waitingText: {
    color: COLORS.textSecondary,
    fontSize: 14,
    fontWeight: '600',
  },
  // Floating action buttons
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
    backgroundColor: '#3d2a1a',
    borderWidth: 1,
    borderColor: '#5a3d25',
  },
  placeBtn: {
    backgroundColor: '#c8a84b',
    flex: 1,
    alignItems: 'center',
  },
  placeBtnDisabled: {
    backgroundColor: '#5a4520',
    opacity: 0.6,
  },
  floatingBtnText: {
    color: '#f0dfc0',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 2,
    textAlign: 'center',
  },
  floatingBtnDisabled: {
    opacity: 0.4,
  },
  placeBtnText: {
    color: '#0d0600',
  },
});
