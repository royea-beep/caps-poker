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

  const safeH = SCREEN_H - insets.top - insets.bottom;
  const BOARD_GAPS = (boardCount - 1) * 4;
  const BOARD_CHROME = 20;
  const boardSpace = (safeH - TOP_BAR_H - BOT_STATUS_H - PLAYER_HAND_H - READY_BTN_H - BOARD_GAPS) / boardCount - BOARD_CHROME;
  const BOARD_CARD_H = Platform.OS === 'web'
    ? 110
    : Math.max(56, Math.min(82, Math.floor(boardSpace / 2)));
  const isWeb = Platform.OS === 'web';

  const [boards, setBoards] = useState<BoardState[]>([]);
  const [playerHand, setPlayerHand] = useState<Card[]>([]);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [botsReady, setBotsReady] = useState<boolean[]>([]);
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
      setSelectedCardId(null);
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
    if (!mountedRef.current) return;
    let results;
    try {
      results = calculateHandResultsMulti(currentBoards, numberOfPlayers, config);
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
    if (playerReady && allBotsReady) {
      // Stop countdown if still running
      if (countdownRef.current) {
        clearInterval(countdownRef.current);
        countdownRef.current = null;
      }
      navigateToReveal(boardsRef.current);
    }
  }, [playerReady, allBotsReady, navigateToReveal]);

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

  const allBoardsFull = boards.every((b) => b.playerCards.length === CARDS_PER_BOARD);

  const handleReady = useCallback(() => {
    if (!allBoardsFull) return;
    hapticNotify(Haptics?.NotificationFeedbackType?.Success);
    setSelectedCardId(null);
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

  return (
    <SafeAreaView style={styles.container}>
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
      <View style={[styles.boardsColumn, isWeb && styles.boardsGrid]}>
        {boards.map((board, i) => (
          <View
            key={i}
            style={isWeb ? (boardCount >= 4 ? styles.boardCellHalf : styles.boardCellThird) : styles.boardCellFull}
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
              isArrangement={isArranging}
              selected={isArranging && cardsRemaining > 0 && board.playerCards.length < CARDS_PER_BOARD}
              cardHeight={BOARD_CARD_H}
            />
          </View>
        ))}
      </View>

      {/* Player hand */}
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
  },
  boardCellFull: {
    flex: 1,
  },
  boardCellHalf: {
    width: '50%',
    paddingHorizontal: 4,
    paddingVertical: 2,
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
});
