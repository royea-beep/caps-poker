import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, Pressable, StyleSheet, Alert, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import Board from '../components/Board';
import PlayerHand from '../components/PlayerHand';
import ChipsDisplay from '../components/ChipsDisplay';
import CompleteOverlay from '../components/CompleteOverlay';
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

type Phase = 'arrangement' | 'reveal' | 'summary';

export default function GameScreen() {
  const router = useRouter();
  const config = useGameStore((s) => s.config);
  const chips = useGameStore((s) => s.chips);
  const addChips = useGameStore((s) => s.addChips);

  const [boards, setBoards] = useState<BoardState[]>([]);
  const [playerHand, setPlayerHand] = useState<Card[]>([]);
  const [botHand, setBotHand] = useState<Card[]>([]);
  const [phase, setPhase] = useState<Phase>('arrangement');
  const [timeRemaining, setTimeRemaining] = useState(config.arrangementTime);
  const [selectedCard, setSelectedCard] = useState<Card | null>(null);
  const [selectedBoardIndex, setSelectedBoardIndex] = useState<number | null>(null);
  const [playerReady, setPlayerReady] = useState(false);
  const [botReady, setBotReady] = useState(false);
  const [currentRevealBoard, setCurrentRevealBoard] = useState(-1);
  const [boardResults, setBoardResults] = useState<BoardResult[]>([]);
  const [showComplete, setShowComplete] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [completeBonusAmount, setCompleteBonusAmount] = useState(0);
  const [completeWinner, setCompleteWinner] = useState<'player' | 'bot'>('player');
  const [netChips, setNetChips] = useState(0);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mountedRef = useRef(true);
  const timeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const bothReady = playerReady && botReady;

  // Cleanup all timers on unmount
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (timerRef.current) clearInterval(timerRef.current);
      timeoutsRef.current.forEach((t) => clearTimeout(t));
      timeoutsRef.current = [];
    };
  }, []);

  // Initialize game
  useEffect(() => {
    const { gameState } = initializeGame();
    setBoards(gameState.boards);
    setPlayerHand(gameState.playerHand);
    setBotHand(gameState.botHand);
    setTimeRemaining(config.arrangementTime);

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

  // Timer countdown
  useEffect(() => {
    if (phase !== 'arrangement' || playerReady) return;

    timerRef.current = setInterval(() => {
      if (!mountedRef.current) return;
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          // Auto-fill and force ready
          handleAutoFillAndReady();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [phase, playerReady]);

  // Both ready -> start reveal
  useEffect(() => {
    if (bothReady && phase === 'arrangement') {
      if (timerRef.current) clearInterval(timerRef.current);
      startRevealPhase();
    }
  }, [bothReady, phase]);

  const handleAutoFillAndReady = useCallback(() => {
    // Use functional updaters to read latest state without nesting setters.
    // We read boards inside setBoards, compute the fill, then schedule
    // setPlayerHand via a microtask to avoid the dangerous nested-setter pattern.
    setBoards((currentBoards) => {
      // Read the current playerHand via a ref-like trick: capture it in closure
      // by scheduling the paired update on the next microtask.
      setPlayerHand((currentHand) => {
        const { boards: filledBoards, remainingHand } = autoFillPlayerCards(currentHand, currentBoards);
        // Update boards outside the nested setter via microtask
        Promise.resolve().then(() => {
          if (mountedRef.current) {
            setBoards(filledBoards);
          }
        });
        return remainingHand;
      });
      // Return current boards unchanged; the microtask will set the filled version
      return currentBoards;
    });
    setPlayerReady(true);
  }, []);

  const handleCardSelect = useCallback((card: Card) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedCard((prev) => (prev?.id === card.id ? null : card));
  }, []);

  const handleBoardPress = useCallback(
    (boardIndex: number) => {
      if (phase !== 'arrangement' || playerReady) return;

      if (selectedCard) {
        // Place card on board
        setBoards((prev) => {
          const board = prev[boardIndex];
          if (board.playerCards.length >= CARDS_PER_BOARD) {
            Alert.alert('Board Full', 'This board already has 4 cards.');
            return prev;
          }
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
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
        // Toggle selected board (for removing cards)
        setSelectedBoardIndex((prev) => (prev === boardIndex ? null : boardIndex));
      }
    },
    [selectedCard, phase, playerReady]
  );

  const handleRemoveCardFromBoard = useCallback(
    (boardIndex: number, card: Card) => {
      if (phase !== 'arrangement' || playerReady) return;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setBoards((prev) => {
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
    [phase, playerReady]
  );

  const allBoardsFull = boards.every((b) => b.playerCards.length === CARDS_PER_BOARD);

  const handleReady = useCallback(() => {
    if (!allBoardsFull) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setPlayerReady(true);
  }, [allBoardsFull]);

  const startRevealPhase = useCallback(() => {
    setPhase('reveal');

    // Calculate results
    const results = calculateHandResults(boards, config.potPerBoard, config.completeBonusPercent);
    setBoardResults(results.boardResults);
    setIsComplete(results.isComplete);
    setCompleteBonusAmount(results.completeBonusAmount);

    // Net chips = winnings minus what was paid in (potPerBoard * NUM_BOARDS)
    const totalPaid = config.potPerBoard * NUM_BOARDS;
    const playerNet = results.playerChipsWon - totalPaid;
    setNetChips(playerNet);

    if (results.isComplete) {
      setCompleteWinner(results.boardResults.every((r) => r.winner === 'player') ? 'player' : 'bot');
    }

    // Reveal boards one at a time
    let delay = 500;
    for (let i = 0; i < NUM_BOARDS; i++) {
      const revealTimer = setTimeout(() => {
        if (!mountedRef.current) return;
        setCurrentRevealBoard(i);
        setBoards((prev) => {
          const updated = [...prev];
          updated[i] = {
            ...updated[i],
            revealed: true,
            playerResult: results.boardResults[i].playerResult,
            botResult: results.boardResults[i].botResult,
            winner: results.boardResults[i].winner,
          };
          return updated;
        });
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      }, delay);
      timeoutsRef.current.push(revealTimer);
      delay += config.boardRevealDuration * 1000;
    }

    // After all reveals
    const finalTimer = setTimeout(() => {
      if (!mountedRef.current) return;
      // Apply chips
      addChips(results.playerChipsWon);

      if (results.isComplete) {
        setShowComplete(true);
      } else {
        setPhase('summary');
      }
    }, delay);
    timeoutsRef.current.push(finalTimer);
  }, [boards, config]);

  const handleCompleteDone = useCallback(() => {
    setShowComplete(false);
    setPhase('summary');
  }, []);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  if (phase === 'summary') {
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
    return null;
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Top bar */}
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backText}>✕</Text>
        </Pressable>
        <View style={styles.topInfo}>
          {phase === 'arrangement' && (
            <View style={[styles.timerContainer, timeRemaining <= 10 && styles.timerUrgent]}>
              <Text style={[styles.timerText, timeRemaining <= 10 && styles.timerTextUrgent]}>
                {formatTime(timeRemaining)}
              </Text>
            </View>
          )}
          {phase === 'reveal' && (
            <Text style={styles.revealText}>REVEALING...</Text>
          )}
        </View>
        <ChipsDisplay amount={chips} />
      </View>

      {/* Bot status */}
      <View style={styles.botSection}>
        <Text style={styles.botLabel}>
          BOT {botReady ? '✓ READY' : `(${botHand.length} cards)`}
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
                active={currentRevealBoard === i}
                potAmount={config.potPerBoard}
                winner={board.winner}
                playerHighlightIds={playerHighlightIds}
                botHighlightIds={botHighlightIds}
                boardHighlightIds={boardHighlightIds}
                playerHandName={board.playerResult?.name}
                botHandName={board.botResult?.name}
                onPress={() => handleBoardPress(i)}
                isArrangement={phase === 'arrangement' && !playerReady}
              />
            );
          })}
        </View>

        {/* Remove cards from board */}
        {phase === 'arrangement' && !playerReady && (
          <View style={styles.removeSection}>
            {boards.map((board, bi) =>
              board.playerCards.length > 0 ? (
                <View key={bi} style={styles.removeRow}>
                  <Text style={styles.removeLabel}>B{bi + 1}:</Text>
                  {board.playerCards.map((card) => (
                    <Pressable
                      key={card.id}
                      onPress={() => handleRemoveCardFromBoard(bi, card)}
                      style={styles.removeCardBtn}
                    >
                      <Text style={styles.removeCardText}>
                        {card.rank}{card.suit === 'hearts' ? '♥' : card.suit === 'diamonds' ? '♦' : card.suit === 'clubs' ? '♣' : '♠'}
                      </Text>
                      <Text style={styles.removeX}>✕</Text>
                    </Pressable>
                  ))}
                </View>
              ) : null
            )}
          </View>
        )}
      </ScrollView>

      {/* Player hand */}
      {phase === 'arrangement' && !playerReady && (
        <>
          <PlayerHand
            cards={playerHand}
            selectedCardId={selectedCard?.id}
            onSelectCard={handleCardSelect}
          />
          {selectedCard && (
            <Text style={styles.hint}>Tap a board to place {selectedCard.rank}{selectedCard.suit === 'hearts' ? '♥' : selectedCard.suit === 'diamonds' ? '♦' : selectedCard.suit === 'clubs' ? '♣' : '♠'}</Text>
          )}
        </>
      )}

      {/* Ready button */}
      {phase === 'arrangement' && !playerReady && (
        <View style={styles.readySection}>
          <Pressable
            style={[styles.readyButton, !allBoardsFull && styles.readyButtonDisabled]}
            onPress={handleReady}
            disabled={!allBoardsFull}
          >
            <Text style={[styles.readyText, !allBoardsFull && styles.readyTextDisabled]}>
              {allBoardsFull ? 'READY' : `Place ${boards.reduce((sum, b) => sum + (CARDS_PER_BOARD - b.playerCards.length), 0)} more cards`}
            </Text>
          </Pressable>
        </View>
      )}

      {phase === 'arrangement' && playerReady && !botReady && (
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
    color: COLORS.textPrimary,
    fontSize: 24,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  timerTextUrgent: {
    color: COLORS.danger,
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
  removeSection: {
    paddingHorizontal: 12,
    paddingTop: 4,
  },
  removeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 2,
  },
  removeLabel: {
    color: COLORS.textSecondary,
    fontSize: 10,
    fontWeight: '700',
    width: 24,
  },
  removeCardBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.feltLight,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    gap: 2,
  },
  removeCardText: {
    color: COLORS.textPrimary,
    fontSize: 11,
    fontWeight: '600',
  },
  removeX: {
    color: COLORS.danger,
    fontSize: 10,
    fontWeight: '800',
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
  readyButton: {
    backgroundColor: COLORS.gold,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  readyButtonDisabled: {
    backgroundColor: COLORS.feltLight,
    borderWidth: 1,
    borderColor: COLORS.boardBorder,
  },
  readyText: {
    color: COLORS.background,
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 3,
  },
  readyTextDisabled: {
    color: COLORS.textSecondary,
    letterSpacing: 0,
    fontWeight: '600',
    fontSize: 14,
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
