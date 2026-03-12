import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, Pressable, StyleSheet, Alert, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import Board from '../components/Board';
import PlayerHand from '../components/PlayerHand';
import ChipsDisplay from '../components/ChipsDisplay';
import CompleteOverlay from '../components/CompleteOverlay';
import { Button } from '../components/Button';
import { useGameStore } from '../store/gameStore';
import { COLORS, Card, CARDS_PER_BOARD, getBoardCount } from '../constants/gameConfig';
import {
  BoardState,
  initializeGameMulti,
  placeSingleBotCards,
  autoFillPlayerCards,
  calculateHandResultsMulti,
  BoardResult,
} from '../utils/gameLogic';
import { GamePhase } from '../types/gameTypes';
import { useGameTimer } from '../hooks/useGameTimer';
import { useRevealSequence } from '../hooks/useRevealSequence';
import { playSound } from '../utils/sounds';
import { HandResult } from '../utils/handEvaluator';

const haptic = (style: Haptics.ImpactFeedbackStyle) => {
  Haptics.impactAsync(style).catch(() => {});
};
const hapticNotify = (type: Haptics.NotificationFeedbackType) => {
  Haptics.notificationAsync(type).catch(() => {});
};

// Layout constants for card size computation
const SAFE_AREA = 84;
const TOP_BAR_H = 44;
const BOT_STATUS_H = 20;
const PLAYER_HAND_H = 120;
const READY_BTN_H = 48;

export default function GameScreen() {
  const router = useRouter();
  const { height: SCREEN_H } = useWindowDimensions();
  const config = useGameStore((s) => s.config);
  const chips = useGameStore((s) => s.chips);
  const addChips = useGameStore((s) => s.addChips);

  const numberOfPlayers = config.numberOfPlayers as 2 | 3 | 4;
  const numberOfBots = numberOfPlayers - 1;
  const boardCount = getBoardCount(numberOfPlayers);

  // Dynamic card height based on board count and number of bot rows during reveal
  const BOARD_GAPS = (boardCount - 1) * 4;
  const BOARD_CHROME = 22;
  const arrangeBoardSpace = (SCREEN_H - SAFE_AREA - TOP_BAR_H - BOT_STATUS_H - PLAYER_HAND_H - READY_BTN_H - BOARD_GAPS) / boardCount - BOARD_CHROME;
  const arrangeCardH = Math.floor(arrangeBoardSpace / 2);
  // Reveal: no player hand, (numberOfBots + 2) card rows per board (N bot rows + community + player)
  const revealRows = numberOfBots + 2;
  const revealBoardSpace = (SCREEN_H - SAFE_AREA - TOP_BAR_H - BOT_STATUS_H - BOARD_GAPS) / boardCount - BOARD_CHROME;
  const revealCardH = Math.floor(revealBoardSpace / revealRows);
  const BOARD_CARD_H = Math.max(28, Math.min(arrangeCardH, revealCardH));

  const [boards, setBoards] = useState<BoardState[]>([]);
  const [playerHand, setPlayerHand] = useState<Card[]>([]);
  const [botsReady, setBotsReady] = useState<boolean[]>([]);
  const [phase, setPhase] = useState<GamePhase>({ type: 'arranging', timeLeft: config.arrangementTime });
  const [selectedCard, setSelectedCard] = useState<Card | null>(null);
  const [selectedBoardIndex, setSelectedBoardIndex] = useState<number | null>(null);
  const [boardResults, setBoardResults] = useState<BoardResult[]>([]);
  const [allBotResults, setAllBotResults] = useState<HandResult[][]>([]);
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

  // Auto-fill and ready handler
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
    playSound('cardFlip');
  }, []);

  const handleAllRevealed = useCallback(() => {
    if (!mountedRef.current) return;
    setBoardResults((currentResults) => currentResults);
  }, []);

  const revealSequence = useRevealSequence({
    boardCount,
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

  const playerChipsWonRef = useRef(0);
  const isCompleteRef = useRef(false);

  // Initialize game
  useEffect(() => {
    const { boards: initialBoards, playerHand: pHand, botHands } = initializeGameMulti(numberOfPlayers);
    setBoards(initialBoards);
    setPlayerHand(pHand);
    setBotsReady(new Array(numberOfBots).fill(false));

    // Deduct buy-in
    const totalPot = config.potPerBoard * boardCount;
    addChips(-totalPot);

    // Bot timers — each bot places cards after independent random delay
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

  // Sync timer timeLeft into phase state
  useEffect(() => {
    if (isArranging) {
      setPhase({ type: 'arranging', timeLeft: timer.timeLeft });
    }
  }, [timer.timeLeft, isArranging]);

  const startRevealPhase = useCallback(() => {
    setPhase({ type: 'revealing', boardIndex: -1 });

    setBoards((currentBoards) => {
      const results = calculateHandResultsMulti(currentBoards, numberOfPlayers, config);
      setBoardResults(results.boardResults);
      setAllBotResults(results.allBotResults);
      setIsComplete(results.isComplete);
      setCompleteBonusAmount(results.completeBonusAmount);

      const totalPaid = config.potPerBoard * boardCount;
      const playerNet = results.playerChipsWon - totalPaid;
      setNetChips(playerNet);

      playerChipsWonRef.current = results.playerChipsWon;
      isCompleteRef.current = results.isComplete;

      if (results.isComplete && results.completeWinner) {
        setCompleteWinner(results.completeWinner);
      }

      Promise.resolve().then(() => {
        revealSequence.startReveal();
      });

      return currentBoards;
    });
  }, [config, revealSequence, numberOfPlayers, boardCount]);

  // When player is waiting and all bots ready -> start reveal
  const allBotsReady = botsReady.length > 0 && botsReady.every(Boolean);
  useEffect(() => {
    if (phase.type === 'waiting_for_bot' && allBotsReady) {
      startRevealPhase();
    }
  }, [phase.type, allBotsReady, startRevealPhase]);

  // When all reveals done
  const wasRevealingRef = useRef(false);
  useEffect(() => {
    if (revealSequence.isRevealing) {
      wasRevealingRef.current = true;
    } else if (wasRevealingRef.current) {
      wasRevealingRef.current = false;
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
          const isUsed = board.playerCards.some(
            (c) => c.suit === selectedCard.suit && c.rank === selectedCard.rank
          ) || board.openCards.some(
            (c) => c.suit === selectedCard.suit && c.rank === selectedCard.rank
          ) || board.closedCards.some(
            (c) => c.suit === selectedCard.suit && c.rank === selectedCard.rank
          );
          if (isUsed) return prev;
          haptic(Haptics.ImpactFeedbackStyle.Medium);
          playSound('cardPlace');
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
    setPhase({ type: 'waiting_for_bot' });
  }, [allBoardsFull, timer]);

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

  // Navigate to summary screen via effect
  useEffect(() => {
    if (phase.type === 'summary') {
      router.replace({
        pathname: '/summary',
        params: {
          results: JSON.stringify(
            boardResults.map((r, i) => ({
              winner: r.winner,
              playerHand: r.playerResult.name,
              botHand: r.botResult.name,
              allBotHands: allBotResults[i]?.map((br) => br.name) || [],
            }))
          ),
          netChips: netChips.toString(),
          isComplete: isComplete.toString(),
          completeBonusAmount: completeBonusAmount.toString(),
          potPerBoard: config.potPerBoard.toString(),
          boardCount: boardCount.toString(),
          numberOfPlayers: numberOfPlayers.toString(),
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

  const showPlayerHand = isArranging;
  const readyBotCount = botsReady.filter(Boolean).length;

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

          // All bot hand names for this board
          const botHandNames = allBotResults[i]?.map((br) => br.name);

          return (
            <Board
              key={i}
              index={i}
              openCards={board.openCards}
              closedCards={board.closedCards}
              playerCards={board.playerCards}
              botCards={board.allBotCards[0] || board.botCards}
              allBotCards={board.allBotCards}
              revealed={board.revealed}
              active={revealSequence.currentBoardIndex === i}
              potAmount={config.potPerBoard * numberOfPlayers}
              winner={board.winner}
              playerHighlightIds={playerHighlightIds}
              botHighlightIds={botHighlightIds}
              boardHighlightIds={boardHighlightIds}
              playerHandName={board.playerResult?.name}
              botHandName={board.botResult?.name}
              allBotHandNames={botHandNames}
              onPress={() => handleBoardPress(i)}
              onRemoveCard={(card) => handleRemoveCardFromBoard(i, card)}
              isArrangement={isArranging}
              selected={isArranging && !!selectedCard && board.playerCards.length < CARDS_PER_BOARD}
              flipDuration={config.turnRevealDelay}
              cardHeight={BOARD_CARD_H}
            />
          );
        })}
      </View>

      {/* Player hand — only during arrangement */}
      {showPlayerHand && (
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
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  backButton: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backText: {
    color: COLORS.textSecondary,
    fontSize: 18,
  },
  topInfo: {
    alignItems: 'center',
  },
  timerContainer: {
    backgroundColor: COLORS.feltLight,
    paddingHorizontal: 14,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.boardBorder,
  },
  timerUrgent: {
    borderColor: COLORS.danger,
    backgroundColor: COLORS.neonRed + '26',
  },
  timerText: {
    fontSize: 20,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  revealText: {
    color: COLORS.gold,
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 4,
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
    paddingHorizontal: 8,
    gap: 4,
  },
  hint: {
    color: COLORS.gold,
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '600',
    paddingVertical: 2,
  },
  readySection: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  waitingText: {
    color: COLORS.textSecondary,
    fontSize: 14,
    fontWeight: '600',
  },
});
