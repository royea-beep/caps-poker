import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, Pressable, StyleSheet, Alert, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import Board from '../components/Board';
import PlayerHand from '../components/PlayerHand';
import ChipsDisplay from '../components/ChipsDisplay';
import CompleteOverlay from '../components/CompleteOverlay';
import { Button } from '../components/Button';
import { useGameStore } from '../store/gameStore';
import { COLORS, Card, NUM_BOARDS, CARDS_PER_BOARD } from '../constants/gameConfig';
import {
  BoardState,
  initializeGame,
  placeBotCards,
  autoFillPlayerCards,
  calculateHandResults,
  BoardResult,
} from '../utils/gameLogic';
import { GamePhase } from '../types/gameTypes';
import { useGameTimer } from '../hooks/useGameTimer';
import { useRevealSequence } from '../hooks/useRevealSequence';

const haptic = (style: Haptics.ImpactFeedbackStyle) => {
  Haptics.impactAsync(style).catch(() => {});
};
const hapticNotify = (type: Haptics.NotificationFeedbackType) => {
  Haptics.notificationAsync(type).catch(() => {});
};

export default function GameScreen() {
  const router = useRouter();
  const config = useGameStore((s) => s.config);
  const chips = useGameStore((s) => s.chips);
  const addChips = useGameStore((s) => s.addChips);

  const [boards, setBoards] = useState<BoardState[]>([]);
  const [playerHand, setPlayerHand] = useState<Card[]>([]);
  const [botHand, setBotHand] = useState<Card[]>([]);
  const [phase, setPhase] = useState<GamePhase>({ type: 'arranging', timeLeft: config.arrangementTime });
  const [selectedCard, setSelectedCard] = useState<Card | null>(null);
  const [selectedBoardIndex, setSelectedBoardIndex] = useState<number | null>(null);
  const [botReady, setBotReady] = useState(false);
  const [boardResults, setBoardResults] = useState<BoardResult[]>([]);
  const [showComplete, setShowComplete] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [completeBonusAmount, setCompleteBonusAmount] = useState(0);
  const [completeWinner, setCompleteWinner] = useState<'player' | 'bot'>('player');
  const [netChips, setNetChips] = useState(0);

  const mountedRef = useRef(true);
  const timeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const playerHandRef = useRef(playerHand);

  useEffect(() => {
    playerHandRef.current = playerHand;
  }, [playerHand]);

  const isArranging = phase.type === 'arranging';
  const isRevealing = phase.type === 'revealing';

  // Auto-fill and ready handler (defined early so hooks can reference it)
  const handleAutoFillAndReady = useCallback(() => {
    setBoards((currentBoards) => {
      const { boards: filledBoards, remainingHand } = autoFillPlayerCards(playerHandRef.current, currentBoards);
      setPlayerHand(remainingHand);
      return filledBoards;
    });
    setPhase({ type: 'waiting_for_bot' });
  }, []);

  // Game timer hook
  const timer = useGameTimer({
    initialSeconds: config.arrangementTime,
    onExpire: handleAutoFillAndReady,
    autoStart: true,
  });

  // Reveal sequence callbacks
  const handleBoardRevealed = useCallback((index: number) => {
    if (!mountedRef.current) return;
    setPhase({ type: 'revealing', boardIndex: index });
    setBoardResults((currentResults) => {
      setBoards((prev) => {
        const result = currentResults[index];
        if (!result) return prev;
        const updated = [...prev];
        updated[index] = {
          ...updated[index],
          revealed: true,
          playerResult: result.playerResult,
          botResult: result.botResult,
          winner: result.winner,
        };
        return updated;
      });
      return currentResults;
    });
    haptic(Haptics.ImpactFeedbackStyle.Heavy);
  }, []);

  const handleAllRevealed = useCallback(() => {
    if (!mountedRef.current) return;
    // addChips and check complete are handled here
    // We need boardResults and isComplete — read from refs
    setBoardResults((currentResults) => {
      // Re-derive isComplete / playerChipsWon from currentResults
      // But we already stored these in state, so just trigger the final step
      return currentResults;
    });
  }, []);

  const revealSequence = useRevealSequence({
    boardCount: NUM_BOARDS,
    revealDuration: config.boardRevealDuration,
    onBoardRevealed: handleBoardRevealed,
    onAllRevealed: handleAllRevealed,
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

  // We need refs for the calculated results so handleAllRevealed can access them
  const playerChipsWonRef = useRef(0);
  const isCompleteRef = useRef(false);

  // Initialize game
  useEffect(() => {
    const { gameState } = initializeGame();
    setBoards(gameState.boards);
    setPlayerHand(gameState.playerHand);
    setBotHand(gameState.botHand);

    // Deduct pot from player chips
    const totalPot = config.potPerBoard * NUM_BOARDS;
    addChips(-totalPot);

    // Bot places cards after random delay
    const botDelay = config.botSpeedMin + Math.random() * (config.botSpeedMax - config.botSpeedMin);
    const botTimer = setTimeout(() => {
      if (!mountedRef.current) return;
      setBoards((prev) => placeBotCards(gameState.botHand, prev));
      setBotReady(true);
    }, botDelay);
    timeoutsRef.current.push(botTimer);

    return () => clearTimeout(botTimer);
  }, []);

  // Sync timer timeLeft into phase state (for display)
  useEffect(() => {
    if (isArranging) {
      setPhase({ type: 'arranging', timeLeft: timer.timeLeft });
    }
  }, [timer.timeLeft, isArranging]);

  const startRevealPhase = useCallback(() => {
    setPhase({ type: 'revealing', boardIndex: -1 });

    // Calculate results using functional state read for boards
    setBoards((currentBoards) => {
      const results = calculateHandResults(currentBoards, config.potPerBoard, config.completeBonusPercent);
      setBoardResults(results.boardResults);
      setIsComplete(results.isComplete);
      setCompleteBonusAmount(results.completeBonusAmount);

      const totalPaid = config.potPerBoard * NUM_BOARDS;
      const playerNet = results.playerChipsWon - totalPaid;
      setNetChips(playerNet);

      playerChipsWonRef.current = results.playerChipsWon;
      isCompleteRef.current = results.isComplete;

      if (results.isComplete) {
        setCompleteWinner(results.boardResults.every((r) => r.winner === 'player') ? 'player' : 'bot');
      }

      // Start reveal sequence after a microtask so boardResults state is set
      Promise.resolve().then(() => {
        revealSequence.startReveal();
      });

      return currentBoards;
    });
  }, [config, revealSequence]);

  // When player is waiting and bot becomes ready -> start reveal
  useEffect(() => {
    if (phase.type === 'waiting_for_bot' && botReady) {
      startRevealPhase();
    }
  }, [phase.type, botReady, startRevealPhase]);

  // When all reveals are done (revealSequence.isRevealing goes false after being true)
  const wasRevealingRef = useRef(false);
  useEffect(() => {
    if (revealSequence.isRevealing) {
      wasRevealingRef.current = true;
    } else if (wasRevealingRef.current) {
      wasRevealingRef.current = false;
      // All reveals done
      addChips(playerChipsWonRef.current);
      if (isCompleteRef.current) {
        setShowComplete(true);
      } else {
        setPhase({ type: 'summary' });
      }
    }
  }, [revealSequence.isRevealing, addChips]);

  const handleCardSelect = useCallback((card: Card) => {
    haptic(Haptics.ImpactFeedbackStyle.Light);
    setSelectedCard((prev) => (prev?.id === card.id ? null : card));
  }, []);

  const handleBoardPress = useCallback(
    (boardIndex: number) => {
      if (!isArranging) return;

      if (selectedCard) {
        setBoards((prev) => {
          if (!prev[boardIndex]) return prev;
          const board = prev[boardIndex];
          if (board.playerCards.length >= CARDS_PER_BOARD) {
            Alert.alert('Board Full', 'This board already has 4 cards.');
            return prev;
          }
          // Check if card is already placed on this board
          const isUsed = board.playerCards.some(
            (c) => c.suit === selectedCard.suit && c.rank === selectedCard.rank
          ) || board.openCards.some(
            (c) => c.suit === selectedCard.suit && c.rank === selectedCard.rank
          ) || board.closedCards.some(
            (c) => c.suit === selectedCard.suit && c.rank === selectedCard.rank
          );
          if (isUsed) return prev;
          haptic(Haptics.ImpactFeedbackStyle.Medium);
          const updated = [...prev];
          updated[boardIndex] = {
            ...board,
            playerCards: [...board.playerCards, selectedCard],
          };
          return updated;
        });
        setPlayerHand((prev) => prev.filter((c) => c.id !== selectedCard.id));
        setSelectedCard(null);
      } else {
        setSelectedBoardIndex((prev) => (prev === boardIndex ? null : boardIndex));
      }
    },
    [selectedCard, isArranging]
  );

  const handleRemoveCardFromBoard = useCallback(
    (boardIndex: number, card: Card) => {
      if (!isArranging) return;
      haptic(Haptics.ImpactFeedbackStyle.Light);
      setBoards((prev) => {
        if (!prev[boardIndex]) return prev;
        const updated = [...prev];
        const board = updated[boardIndex];
        updated[boardIndex] = {
          ...board,
          playerCards: board.playerCards.filter((c) => c.id !== card.id),
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
    hapticNotify(Haptics.NotificationFeedbackType.Success);
    timer.stop();
    if (botReady) {
      // Bot already ready, go straight to reveal
      setPhase({ type: 'waiting_for_bot' });
      // The useEffect watching waiting_for_bot + botReady will trigger startRevealPhase
    } else {
      setPhase({ type: 'waiting_for_bot' });
    }
  }, [allBoardsFull, timer, botReady]);

  const handleCompleteDone = useCallback(() => {
    setShowComplete(false);
    setPhase({ type: 'summary' });
  }, []);

  const handleBack = useCallback(() => {
    if (isArranging || isRevealing || phase.type === 'waiting_for_bot') {
      Alert.alert(
        'Leave Game?',
        'You will lose your pot for this hand.',
        [
          { text: 'Stay', style: 'cancel' },
          { text: 'Leave', style: 'destructive', onPress: () => router.back() },
        ]
      );
    } else {
      router.back();
    }
  }, [isArranging, isRevealing, phase.type, router]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  // Navigate to summary screen via effect (not during render)
  useEffect(() => {
    if (phase.type === 'summary') {
      router.replace({
        pathname: '/summary',
        params: {
          results: JSON.stringify(
            boardResults.map((r) => ({
              winner: r.winner,
              playerHand: r.playerResult.name,
              botHand: r.botResult.name,
            }))
          ),
          netChips: netChips.toString(),
          isComplete: isComplete.toString(),
          completeBonusAmount: completeBonusAmount.toString(),
          potPerBoard: config.potPerBoard.toString(),
        },
      });
    }
  }, [phase.type]);

  if (phase.type === 'summary') return null;

  const displayTimeLeft = phase.type === 'arranging' ? phase.timeLeft : 0;
  const timerColor = displayTimeLeft > 30
    ? COLORS.success
    : displayTimeLeft > 15
    ? COLORS.gold
    : COLORS.danger;

  return (
    <SafeAreaView style={styles.container}>
      {/* Top bar */}
      <View style={styles.topBar}>
        <Pressable onPress={handleBack} style={styles.backButton}>
          <Text style={styles.backText}>{'\u2715'}</Text>
        </Pressable>
        <View style={styles.topInfo}>
          {isArranging && (
            <View style={[
              styles.timerContainer,
              { borderColor: timerColor },
              displayTimeLeft <= 15 && styles.timerUrgent,
            ]}>
              <Text style={[styles.timerText, { color: timerColor }]}>
                {formatTime(displayTimeLeft)}
              </Text>
            </View>
          )}
          {isRevealing && (
            <Text style={styles.revealText}>REVEALING...</Text>
          )}
        </View>
        <ChipsDisplay amount={chips} />
      </View>

      {/* Bot status */}
      <View style={styles.botSection}>
        <Text style={styles.botLabel}>
          BOT {botReady ? '\u2713 READY' : `(${botHand.length} cards)`}
        </Text>
      </View>

      {/* Scrollable middle section: boards + remove cards */}
      <ScrollView
        style={styles.middleScroll}
        contentContainerStyle={styles.middleScrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Boards 2x2 */}
        <View style={styles.boardsGrid}>
          {boards.map((board, i) => {
            const result = boardResults[i];
            const playerHighlightIds = board.revealed && result
              ? result.playerResult.playerCardsUsed.map((c) => c.id)
              : [];
            const botHighlightIds = board.revealed && result
              ? result.botResult.playerCardsUsed.map((c) => c.id)
              : [];
            const boardHighlightIds = board.revealed && result
              ? [
                  ...result.playerResult.boardCardsUsed.map((c) => c.id),
                  ...result.botResult.boardCardsUsed.map((c) => c.id),
                ]
              : [];

            return (
              <Board
                key={i}
                index={i}
                openCards={board.openCards}
                closedCards={board.closedCards}
                playerCards={board.playerCards}
                botCards={board.botCards}
                revealed={board.revealed}
                active={revealSequence.currentBoardIndex === i}
                potAmount={config.potPerBoard}
                winner={board.winner}
                playerHighlightIds={playerHighlightIds}
                botHighlightIds={botHighlightIds}
                boardHighlightIds={boardHighlightIds}
                playerHandName={board.playerResult?.name}
                botHandName={board.botResult?.name}
                onPress={() => handleBoardPress(i)}
                onRemoveCard={(card) => handleRemoveCardFromBoard(i, card)}
                isArrangement={isArranging}
                selected={isArranging && !!selectedCard && board.playerCards.length < CARDS_PER_BOARD}
                flipDuration={config.turnRevealDelay}
              />
            );
          })}
        </View>

        {/* Tap cards on boards directly to remove them */}
      </ScrollView>

      {/* Player hand */}
      {isArranging && (
        <>
          <PlayerHand
            cards={playerHand}
            selectedCardId={selectedCard?.id}
            onSelectCard={handleCardSelect}
          />
          {selectedCard && (
            <Text style={styles.hint}>Tap a board to place {selectedCard.rank}{selectedCard.suit === 'hearts' ? '\u2665' : selectedCard.suit === 'diamonds' ? '\u2666' : selectedCard.suit === 'clubs' ? '\u2663' : '\u2660'}</Text>
          )}
        </>
      )}

      {/* Ready button */}
      {isArranging && (
        <View style={styles.readySection}>
          <Button
            title={allBoardsFull ? 'READY' : `Place ${boards.reduce((sum, b) => sum + (CARDS_PER_BOARD - b.playerCards.length), 0)} more cards`}
            variant="gold"
            disabled={!allBoardsFull}
            onPress={handleReady}
          />
        </View>
      )}

      {phase.type === 'waiting_for_bot' && (
        <View style={styles.waitingSection}>
          <Text style={styles.waitingText}>Waiting for bot...</Text>
        </View>
      )}

      {/* Complete overlay */}
      {showComplete && (
        <CompleteOverlay
          winner={completeWinner}
          bonusAmount={completeBonusAmount}
          duration={config.completeBonusDisplay}
          onDone={handleCompleteDone}
        />
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
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  backButton: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backText: {
    color: COLORS.textSecondary,
    fontSize: 20,
  },
  topInfo: {
    alignItems: 'center',
  },
  timerContainer: {
    backgroundColor: COLORS.feltLight,
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.boardBorder,
  },
  timerUrgent: {
    borderColor: COLORS.danger,
    backgroundColor: 'rgba(231, 76, 60, 0.15)',
  },
  timerText: {
    fontSize: 24,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  revealText: {
    color: COLORS.gold,
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 4,
  },
  botSection: {
    alignItems: 'center',
    paddingVertical: 4,
  },
  botLabel: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
  },
  middleScroll: {
    flex: 1,
  },
  middleScrollContent: {
    paddingBottom: 4,
  },
  boardsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    gap: 4,
  },
  hint: {
    color: COLORS.gold,
    textAlign: 'center',
    fontSize: 13,
    fontWeight: '600',
    paddingVertical: 4,
  },
  readySection: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  waitingSection: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  waitingText: {
    color: COLORS.textSecondary,
    fontSize: 16,
    fontWeight: '600',
  },
});
