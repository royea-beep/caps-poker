import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, Pressable, StyleSheet, Alert, ScrollView } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import Board from '../components/Board';
import PlayerHand from '../components/PlayerHand';
import ChipsDisplay from '../components/ChipsDisplay';
import CompleteOverlay from '../components/CompleteOverlay';
import { Button } from '../components/Button';
import { useGameStore } from '../store/gameStore';
import { COLORS, Card, CARDS_PER_BOARD } from '../constants/gameConfig';
import { useGameTimer } from '../hooks/useGameTimer';
import { BoardRevealPayload, HandCompletePayload, CardsDealtPayload } from '../constants/networkConfig';

interface BoardDisplay {
  openCards: Card[];
  closedCards: Card[];
  playerCards: Card[];
  revealed: boolean;
  revealData?: BoardRevealPayload;
}

export default function MultiplayerGameScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    isHost: string;
    playerIndex: string;
    playerCount: string;
    yourCards: string;
    boards: string;
  }>();

  const config = useGameStore((s) => s.config);
  const chips = useGameStore((s) => s.chips);
  const addChips = useGameStore((s) => s.addChips);
  const connectedPlayers = useGameStore((s) => s.connectedPlayers);
  const onSendReady = useGameStore((s) => s.onSendReady);

  const isHost = params.isHost === 'true';
  const playerIndex = parseInt(params.playerIndex || '0', 10);
  const playerCount = parseInt(params.playerCount || '2', 10);

  let yourCards: Card[] = [];
  try {
    yourCards = JSON.parse(params.yourCards || '[]');
  } catch {
    yourCards = [];
  }

  let boardsParam: CardsDealtPayload['boards'] = [];
  try {
    boardsParam = JSON.parse(params.boards || '[]');
  } catch {
    boardsParam = [];
  }

  const boardCount = boardsParam.length;

  // State
  const [boards, setBoards] = useState<BoardDisplay[]>(() =>
    boardsParam.map((b) => ({
      openCards: b.openCards,
      closedCards: [],
      playerCards: [],
      revealed: false,
    }))
  );
  const [playerHand, setPlayerHand] = useState<Card[]>(yourCards);
  const [selectedCard, setSelectedCard] = useState<Card | null>(null);
  const [phase, setPhase] = useState<'arranging' | 'waiting' | 'revealing' | 'summary'>('arranging');
  const [isReady, setIsReady] = useState(false);
  const [showComplete, setShowComplete] = useState(false);
  const [handResult, setHandResult] = useState<HandCompletePayload | null>(null);
  const [revealIndex, setRevealIndex] = useState(-1);

  const mountedRef = useRef(true);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Timer
  const handleTimerExpire = useCallback(() => {
    if (!isReady) {
      autoFillAndReady();
    }
  }, [isReady]);

  const timer = useGameTimer({
    initialSeconds: config.arrangementTime,
    onExpire: handleTimerExpire,
    autoStart: true,
  });

  // Auto-fill remaining cards
  const autoFillAndReady = useCallback(() => {
    setBoards((currentBoards) => {
      const remaining = [...playerHand];
      const updated = currentBoards.map((board) => {
        const needed = CARDS_PER_BOARD - board.playerCards.length;
        if (needed > 0) {
          const toAdd = remaining.splice(0, needed);
          return { ...board, playerCards: [...board.playerCards, ...toAdd] };
        }
        return board;
      });
      setPlayerHand([]);
      setIsReady(true);
      setPhase('waiting');
      timer.stop();
      // Send PLAYER_READY with board assignments
      const assignments = updated.map((b) => b.playerCards);
      if (onSendReady) onSendReady(assignments);
      return updated;
    });
  }, [playerHand, timer]);

  // Card placement
  const handleCardSelect = useCallback((card: Card) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedCard((prev) => (prev?.id === card.id ? null : card));
  }, []);

  const handleBoardPress = useCallback(
    (boardIndex: number) => {
      if (phase !== 'arranging' || !selectedCard) return;

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
    },
    [selectedCard, phase]
  );

  const handleRemoveCard = useCallback(
    (boardIndex: number, card: Card) => {
      if (phase !== 'arranging') return;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setBoards((prev) => {
        const updated = [...prev];
        updated[boardIndex] = {
          ...prev[boardIndex],
          playerCards: prev[boardIndex].playerCards.filter((c) => c.id !== card.id),
        };
        return updated;
      });
      setPlayerHand((prev) => [...prev, card]);
    },
    [phase]
  );

  const allBoardsFull = boards.every((b) => b.playerCards.length === CARDS_PER_BOARD);

  const handleReady = useCallback(() => {
    if (!allBoardsFull) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    timer.stop();
    setIsReady(true);
    setPhase('waiting');
    // Send PLAYER_READY with board assignments
    const assignments = boards.map((b) => b.playerCards);
    if (onSendReady) onSendReady(assignments);
  }, [allBoardsFull, timer, boards, onSendReady]);

  // Handle board reveal (called by networking layer)
  const handleBoardReveal = useCallback((data: BoardRevealPayload) => {
    if (!mountedRef.current) return;
    setPhase('revealing');
    setRevealIndex(data.boardIndex);
    setBoards((prev) => {
      const updated = [...prev];
      updated[data.boardIndex] = {
        ...prev[data.boardIndex],
        closedCards: data.closedCards,
        revealed: true,
        revealData: data,
      };
      return updated;
    });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
  }, []);

  // Handle hand complete
  const handleHandComplete = useCallback((result: HandCompletePayload) => {
    if (!mountedRef.current) return;
    setHandResult(result);

    if (result.isComplete) {
      setShowComplete(true);
    } else {
      setPhase('summary');
    }
  }, []);

  const handleCompleteDone = useCallback(() => {
    setShowComplete(false);
    setPhase('summary');
  }, []);

  // Navigate to summary when phase changes to summary
  useEffect(() => {
    if (phase === 'summary' && handResult) {
      const myDelta = handResult.chipDeltas[playerIndex] || 0;
      addChips(myDelta);

      router.replace({
        pathname: '/summary',
        params: {
          results: JSON.stringify(
            handResult.boardResults.map((br) => ({
              winner: br.winnerIndex === playerIndex ? 'player' : br.winnerName || 'opponent',
              playerHand: 'N/A',
              botHand: 'N/A',
            }))
          ),
          netChips: myDelta.toString(),
          isComplete: handResult.isComplete.toString(),
          completeBonusAmount: handResult.completeBonusAmount.toString(),
          potPerBoard: config.potPerBoard.toString(),
        },
      });
    }
  }, [phase, handResult]);

  const isArranging = phase === 'arranging';
  const displayTimeLeft = timer.timeLeft;

  return (
    <SafeAreaView style={styles.container}>
      {/* Top bar */}
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backText}>{'\u2715'}</Text>
        </Pressable>
        <View style={styles.topInfo}>
          {isArranging && (
            <View style={[styles.timerContainer, displayTimeLeft <= 10 && styles.timerUrgent]}>
              <Text style={[styles.timerText, displayTimeLeft <= 10 && styles.timerTextUrgent]}>
                {Math.floor(displayTimeLeft / 60)}:{(displayTimeLeft % 60).toString().padStart(2, '0')}
              </Text>
            </View>
          )}
          {phase === 'waiting' && <Text style={styles.statusText}>WAITING...</Text>}
          {phase === 'revealing' && <Text style={styles.statusText}>REVEALING...</Text>}
        </View>
        <ChipsDisplay amount={chips} />
      </View>

      {/* Mode badge */}
      <View style={styles.modeBadge}>
        <Text style={styles.modeText}>
          {playerCount}P {isHost ? 'HOST' : 'GUEST'} | Seat {playerIndex + 1}
        </Text>
      </View>

      {/* Boards */}
      <ScrollView
        style={styles.middleScroll}
        contentContainerStyle={styles.middleScrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.boardsGrid}>
          {boards.map((board, i) => {
            const revealData = board.revealData;
            return (
              <Board
                key={i}
                index={i}
                openCards={board.openCards}
                closedCards={board.closedCards}
                playerCards={board.playerCards}
                botCards={[]} // Other players' cards not shown during arrangement
                revealed={board.revealed}
                active={revealIndex === i}
                potAmount={config.potPerBoard}
                winner={
                  revealData
                    ? revealData.winnerIndex === playerIndex
                      ? 'player'
                      : revealData.winnerIndex === -1
                      ? 'tie'
                      : 'bot'
                    : undefined
                }
                playerHighlightIds={[]}
                botHighlightIds={[]}
                boardHighlightIds={[]}
                playerHandName={revealData?.playerHands[playerIndex]?.handRank}
                botHandName={
                  revealData && revealData.winnerIndex >= 0 && revealData.winnerIndex !== playerIndex
                    ? revealData.playerHands[revealData.winnerIndex]?.handRank
                    : undefined
                }
                onPress={() => handleBoardPress(i)}
                isArrangement={isArranging}
              />
            );
          })}
        </View>

        {/* Remove cards */}
        {isArranging && (
          <View style={styles.removeSection}>
            {boards.map((board, bi) =>
              board.playerCards.length > 0 ? (
                <View key={bi} style={styles.removeRow}>
                  <Text style={styles.removeLabel}>B{bi + 1}:</Text>
                  {board.playerCards.map((card) => (
                    <Pressable
                      key={card.id}
                      onPress={() => handleRemoveCard(bi, card)}
                      style={styles.removeCardBtn}
                    >
                      <Text style={styles.removeCardText}>
                        {card.rank}
                        {card.suit === 'hearts' ? '\u2665' : card.suit === 'diamonds' ? '\u2666' : card.suit === 'clubs' ? '\u2663' : '\u2660'}
                      </Text>
                      <Text style={styles.removeX}>{'\u2715'}</Text>
                    </Pressable>
                  ))}
                </View>
              ) : null
            )}
          </View>
        )}
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
            <Text style={styles.hint}>
              Tap a board to place {selectedCard.rank}
              {selectedCard.suit === 'hearts' ? '\u2665' : selectedCard.suit === 'diamonds' ? '\u2666' : selectedCard.suit === 'clubs' ? '\u2663' : '\u2660'}
            </Text>
          )}
        </>
      )}

      {/* Ready button */}
      {isArranging && (
        <View style={styles.readySection}>
          <Button
            title={
              allBoardsFull
                ? 'READY'
                : `Place ${boards.reduce((sum, b) => sum + (CARDS_PER_BOARD - b.playerCards.length), 0)} more cards`
            }
            variant="gold"
            disabled={!allBoardsFull}
            onPress={handleReady}
          />
        </View>
      )}

      {phase === 'waiting' && (
        <View style={styles.waitingSection}>
          <Text style={styles.waitingText}>Waiting for other players...</Text>
        </View>
      )}

      {/* Complete overlay */}
      {showComplete && handResult && (
        <CompleteOverlay
          winner={
            handResult.completeWinnerIndex === playerIndex ? 'player' : 'bot'
          }
          bonusAmount={handResult.completeBonusAmount}
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
  statusText: {
    color: COLORS.gold,
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 4,
  },
  modeBadge: {
    alignItems: 'center',
    paddingVertical: 4,
  },
  modeText: {
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
  waitingSection: {
    padding: 20,
    alignItems: 'center',
  },
  waitingText: {
    color: COLORS.textSecondary,
    fontSize: 16,
    fontWeight: '600',
  },
});
