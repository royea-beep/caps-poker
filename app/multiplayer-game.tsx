import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, Pressable, StyleSheet, Alert, useWindowDimensions } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import Board from '../components/Board';
import PlayerHand from '../components/PlayerHand';
import ChipsDisplay from '../components/ChipsDisplay';
import { Button } from '../components/Button';
import { useGameStore } from '../store/gameStore';
import { COLORS, Card, CARDS_PER_BOARD } from '../constants/gameConfig';
import { useGameTimer } from '../hooks/useGameTimer';
import { BoardRevealPayload, HandCompletePayload, CardsDealtPayload } from '../constants/networkConfig';
import { RevealBoardData } from '../types/gameTypes';
import { playSound } from '../utils/sounds';

const haptic = (style: Haptics.ImpactFeedbackStyle) => {
  Haptics.impactAsync(style).catch(() => {});
};
const hapticNotify = (type: Haptics.NotificationFeedbackType) => {
  Haptics.notificationAsync(type).catch(() => {});
};

// Layout constants
const TOP_BAR_H = 44;
const MODE_BADGE_H = 24;
const PLAYER_HAND_H = 130;
const READY_BTN_H = 48;

interface BoardDisplay {
  openCards: Card[];
  closedCards: Card[];
  playerCards: Card[];
  revealed: boolean;
}

export default function MultiplayerGameScreen() {
  const router = useRouter();
  const { height: SCREEN_H } = useWindowDimensions();
  const insets = useSafeAreaInsets();

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
  const setRevealData = useGameStore((s) => s.setRevealData);
  const connectedPlayers = useGameStore((s) => s.connectedPlayers);
  const mpServer = useGameStore((s) => s.mpServer);
  const mpClient = useGameStore((s) => s.mpClient);

  const isHost = params.isHost === 'true';
  const playerIndex = parseInt(params.playerIndex || '0', 10);
  const playerCount = parseInt(params.playerCount || '2', 10);

  let yourCards: Card[] = [];
  try { yourCards = JSON.parse(params.yourCards || '[]'); } catch { yourCards = []; }

  let boardsParam: CardsDealtPayload['boards'] = [];
  try { boardsParam = JSON.parse(params.boards || '[]'); } catch { boardsParam = []; }

  const boardCount = boardsParam.length;

  // Dynamic card sizing (same formula as game.tsx)
  const safeH = SCREEN_H - insets.top - insets.bottom;
  const BOARD_GAPS = (boardCount - 1) * 4;
  const BOARD_CHROME = 20;
  const boardSpace = (safeH - TOP_BAR_H - MODE_BADGE_H - PLAYER_HAND_H - READY_BTN_H - BOARD_GAPS) / boardCount - BOARD_CHROME;
  const BOARD_CARD_H = Math.max(28, Math.min(52, Math.floor(boardSpace / 2)));

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
  const playerHandRef = useRef(playerHand);
  useEffect(() => { playerHandRef.current = playerHand; }, [playerHand]);
  const boardsRef = useRef(boards);
  useEffect(() => { boardsRef.current = boards; }, [boards]);

  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [phase, setPhase] = useState<'arranging' | 'waiting' | 'navigating'>('arranging');

  // Collected reveal data for guest
  const boardRevealsRef = useRef<Map<number, BoardRevealPayload>>(new Map());
  const mountedRef = useRef(true);

  useEffect(() => {
    return () => { mountedRef.current = false; };
  }, []);

  // Player names from connected players
  const playerNames = connectedPlayers
    .sort((a, b) => a.seat - b.seat)
    .map((p) => p.name);

  const isArranging = phase === 'arranging';

  // --- Host: wire server callbacks on mount ---
  useEffect(() => {
    if (!isHost || !mpServer) return;

    mpServer.updateCallbacks({
      onAllPlayersReady: () => {
        if (!mountedRef.current) return;

        const { boardResults, handResult } = mpServer.runRevealSequence(config);
        const serverBoards = mpServer.getBoards();
        const clientArray = mpServer.getClients().sort((a: any, b: any) => a.seat - b.seat);

        // Broadcast BOARD_REVEAL to guests
        for (let b = 0; b < boardResults.length; b++) {
          const br = boardResults[b];
          const playerHandsData = br.playerResults.map((pr: any, pi: number) => ({
            playerId: clientArray[pi]?.id || '',
            playerName: clientArray[pi]?.name || '',
            cards: serverBoards[b].playerCards[pi] || [],
            handRank: pr.name,
            score: pr.score,
          }));
          mpServer.sendBoardReveal(
            b,
            serverBoards[b].closedCards,
            playerHandsData,
            br.winnerIndex,
            br.winnerIndex >= 0 ? clientArray[br.winnerIndex]?.name || '' : 'Tie'
          );
        }

        // Broadcast HAND_COMPLETE to guests
        const handCompletePayload: HandCompletePayload = {
          boardResults: boardResults.map((br: any) => ({
            boardIndex: br.boardIndex,
            winnerIndex: br.winnerIndex,
            winnerName: br.winnerIndex >= 0 ? clientArray[br.winnerIndex]?.name || '' : 'Tie',
          })),
          chipDeltas: handResult.chipDeltas,
          playerNames: clientArray.map((c: any) => c.name),
          isComplete: handResult.completeWinner !== null,
          completeWinnerIndex: handResult.completeWinner,
          completeBonusAmount: handResult.completeBonusAmount,
        };
        mpServer.sendHandComplete(handCompletePayload);

        // Build RevealData for host and navigate
        buildRevealDataAndNavigate(boardResults, handResult, serverBoards, clientArray);
      },
    });
  }, [isHost, mpServer, config]);

  // --- Guest: wire client callbacks on mount ---
  useEffect(() => {
    if (isHost || !mpClient) return;

    mpClient.updateCallbacks({
      onBoardReveal: (data: BoardRevealPayload) => {
        if (!mountedRef.current) return;
        boardRevealsRef.current.set(data.boardIndex, data);
      },
      onHandComplete: (result: HandCompletePayload) => {
        if (!mountedRef.current) return;
        buildGuestRevealDataAndNavigate(result);
      },
    });
  }, [isHost, mpClient, playerIndex, playerCount, config, boardCount]);

  // Host: build RevealData from server evaluation results
  const buildRevealDataAndNavigate = useCallback((
    boardResults: any[],
    handResult: any,
    serverBoards: any[],
    clientArray: any[]
  ) => {
    const myIdx = playerIndex;

    const revealBoards: RevealBoardData[] = boardResults.map((br: any, bi: number) => {
      const board = serverBoards[bi];
      const myResult = br.playerResults[myIdx];
      const otherCards: Card[][] = [];
      const otherHandNames: string[] = [];
      for (let p = 0; p < clientArray.length; p++) {
        if (p !== myIdx) {
          otherCards.push(board.playerCards[p] || []);
          otherHandNames.push(br.playerResults[p]?.name || '');
        }
      }

      const winner: 'player' | 'bot' | 'tie' =
        br.winnerIndex === myIdx ? 'player' :
        br.winnerIndex === -1 ? 'tie' : 'bot';

      return {
        openCards: board.openCards,
        closedCards: board.closedCards,
        playerCards: board.playerCards[myIdx] || [],
        allBotCards: otherCards,
        winner,
        playerHandName: myResult?.name || '',
        botHandName: br.winnerIndex >= 0 && br.winnerIndex !== myIdx
          ? br.playerResults[br.winnerIndex]?.name || '' : '',
        allBotHandNames: otherHandNames,
        playerHighlightIds: [],
        botHighlightIds: [],
        boardHighlightIds: [],
        potAmount: config.potPerBoard * clientArray.length,
      };
    });

    const myDelta = handResult.chipDeltas[myIdx];
    addChips(myDelta);

    setRevealData({
      boards: revealBoards,
      netChips: myDelta,
      playerChipsWon: myDelta + config.potPerBoard * boardCount,
      isComplete: handResult.completeWinner !== null,
      completeBonusAmount: handResult.completeBonusAmount,
      completeWinner: handResult.completeWinner !== null
        ? (handResult.completeWinner === myIdx ? 'player' : 'bot')
        : null,
      boardRevealDuration: config.boardRevealDuration,
      completeBonusDisplay: config.completeBonusDisplay,
      turnRevealDelay: config.turnRevealDelay,
      potPerBoard: config.potPerBoard,
      numberOfPlayers: clientArray.length,
      boardCount,
    });

    setPhase('navigating');
    router.replace('/results');
  }, [playerIndex, config, boardCount, addChips, setRevealData, router]);

  // Guest: build RevealData from BOARD_REVEAL + HAND_COMPLETE payloads
  const buildGuestRevealDataAndNavigate = useCallback((result: HandCompletePayload) => {
    const currentBoards = boardsRef.current;
    const reveals = boardRevealsRef.current;

    const revealBoards: RevealBoardData[] = currentBoards.map((board, bi) => {
      const reveal = reveals.get(bi);
      if (!reveal) {
        return {
          openCards: board.openCards,
          closedCards: [],
          playerCards: board.playerCards,
          allBotCards: [],
          winner: 'tie' as const,
          playerHandName: '',
          botHandName: '',
          allBotHandNames: [],
          playerHighlightIds: [],
          botHighlightIds: [],
          boardHighlightIds: [],
          potAmount: config.potPerBoard * playerCount,
        };
      }

      const myHand = reveal.playerHands[playerIndex];
      const otherCards: Card[][] = [];
      const otherHandNames: string[] = [];
      for (let p = 0; p < reveal.playerHands.length; p++) {
        if (p !== playerIndex) {
          otherCards.push(reveal.playerHands[p]?.cards || []);
          otherHandNames.push(reveal.playerHands[p]?.handRank || '');
        }
      }

      const winner: 'player' | 'bot' | 'tie' =
        reveal.winnerIndex === playerIndex ? 'player' :
        reveal.winnerIndex === -1 ? 'tie' : 'bot';

      return {
        openCards: board.openCards,
        closedCards: reveal.closedCards,
        playerCards: myHand?.cards || board.playerCards,
        allBotCards: otherCards,
        winner,
        playerHandName: myHand?.handRank || '',
        botHandName: reveal.winnerIndex >= 0 && reveal.winnerIndex !== playerIndex
          ? reveal.playerHands[reveal.winnerIndex]?.handRank || '' : '',
        allBotHandNames: otherHandNames,
        playerHighlightIds: [],
        botHighlightIds: [],
        boardHighlightIds: [],
        potAmount: config.potPerBoard * playerCount,
      };
    });

    const myDelta = result.chipDeltas[playerIndex] || 0;
    addChips(myDelta);

    const completeWinnerIsMe = result.completeWinnerIndex === playerIndex;

    setRevealData({
      boards: revealBoards,
      netChips: myDelta,
      playerChipsWon: myDelta + config.potPerBoard * boardCount,
      isComplete: result.isComplete,
      completeBonusAmount: result.completeBonusAmount,
      completeWinner: result.isComplete
        ? (completeWinnerIsMe ? 'player' : 'bot')
        : null,
      boardRevealDuration: config.boardRevealDuration,
      completeBonusDisplay: config.completeBonusDisplay,
      turnRevealDelay: config.turnRevealDelay,
      potPerBoard: config.potPerBoard,
      numberOfPlayers: playerCount,
      boardCount,
    });

    setPhase('navigating');
    router.replace('/results');
  }, [playerIndex, playerCount, config, boardCount, addChips, setRevealData, router]);

  // Timer
  const handleTimerExpire = useCallback(() => {
    autoFillAndReady();
  }, []);

  const timer = useGameTimer({
    initialSeconds: config.arrangementTime,
    onExpire: handleTimerExpire,
    autoStart: true,
  });

  // Auto-fill remaining cards and send ready
  const autoFillAndReady = useCallback(() => {
    setBoards((currentBoards) => {
      const remaining = [...playerHandRef.current];
      const updated = currentBoards.map((board) => {
        const needed = CARDS_PER_BOARD - board.playerCards.length;
        if (needed > 0) {
          const toAdd = remaining.splice(0, needed);
          return { ...board, playerCards: [...board.playerCards, ...toAdd] };
        }
        return board;
      });
      setPlayerHand([]);
      setSelectedCardId(null);
      setPhase('waiting');
      timer.stop();

      const assignments = updated.map((b) => b.playerCards);
      if (isHost && mpServer) {
        mpServer.setHostReady(assignments);
      } else if (!isHost && mpClient) {
        mpClient.sendReady(assignments);
      }
      return updated;
    });
  }, [timer, isHost, mpServer, mpClient]);

  // Card selection (same UX as game.tsx)
  const handleSelectCard = useCallback((card: Card) => {
    if (!isArranging) return;
    haptic(Haptics.ImpactFeedbackStyle.Light);
    setSelectedCardId((prev) => (prev === card.id ? null : card.id));
  }, [isArranging]);

  // Place card on board
  const handleBoardPress = useCallback((boardIndex: number) => {
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
      haptic(Haptics.ImpactFeedbackStyle.Medium);
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
  }, [isArranging, selectedCardId]);

  // Remove card from board
  const handleRemoveCardFromBoard = useCallback((boardIndex: number, card: Card) => {
    if (!isArranging) return;
    haptic(Haptics.ImpactFeedbackStyle.Light);
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
  }, [isArranging]);

  const allBoardsFull = boards.every((b) => b.playerCards.length === CARDS_PER_BOARD);

  const handleReady = useCallback(() => {
    if (!allBoardsFull) return;
    hapticNotify(Haptics.NotificationFeedbackType.Success);
    timer.stop();
    setSelectedCardId(null);
    setPhase('waiting');

    const assignments = boards.map((b) => b.playerCards);
    if (isHost && mpServer) {
      mpServer.setHostReady(assignments);
    } else if (!isHost && mpClient) {
      mpClient.sendReady(assignments);
    }
  }, [allBoardsFull, timer, boards, isHost, mpServer, mpClient]);

  const handleBack = useCallback(() => {
    if (phase === 'arranging' || phase === 'waiting') {
      Alert.alert(
        'Leave Game?',
        'You will forfeit this hand if you leave.',
        [
          { text: 'Stay', style: 'cancel' },
          { text: 'Leave', style: 'destructive', onPress: () => router.back() },
        ]
      );
    } else {
      router.back();
    }
  }, [phase, router]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const displayTimeLeft = timer.timeLeft;
  const timerColor = displayTimeLeft > 30
    ? COLORS.success
    : displayTimeLeft > 15
    ? COLORS.gold
    : COLORS.danger;

  const cardsRemaining = playerHand.length;

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
          {phase === 'waiting' && (
            <Text style={styles.statusText}>WAITING...</Text>
          )}
        </View>
        <ChipsDisplay amount={chips} />
      </View>

      {/* Mode badge with player names */}
      <View style={styles.modeBadge}>
        <Text style={styles.modeText}>
          {playerCount}P {isHost ? 'HOST' : 'GUEST'} | {playerNames[playerIndex] || `Seat ${playerIndex + 1}`}
        </Text>
      </View>

      {/* Boards — stacked vertically (same as game.tsx) */}
      <View style={styles.boardsColumn}>
        {boards.map((board, i) => (
          <Board
            key={i}
            index={i}
            openCards={board.openCards}
            closedCards={board.closedCards}
            playerCards={board.playerCards}
            botCards={[]}
            revealed={board.revealed}
            active={false}
            potAmount={config.potPerBoard * playerCount}
            onPress={() => handleBoardPress(i)}
            onRemoveCard={(card) => handleRemoveCardFromBoard(i, card)}
            isArrangement={isArranging}
            selected={isArranging && cardsRemaining > 0 && board.playerCards.length < CARDS_PER_BOARD}
            cardHeight={BOARD_CARD_H}
          />
        ))}
      </View>

      {/* Player hand — face-up at bottom */}
      {isArranging && (
        <PlayerHand
          cards={playerHand}
          selectedCardId={selectedCardId ?? undefined}
          onSelectCard={handleSelectCard}
        />
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

      {/* Waiting overlay */}
      {phase === 'waiting' && (
        <View style={styles.waitingOverlay}>
          <View style={styles.waitingBox}>
            <Text style={styles.waitingText}>Waiting for other players...</Text>
          </View>
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
  statusText: {
    color: COLORS.gold,
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 4,
  },
  modeBadge: {
    alignItems: 'center',
    paddingVertical: 2,
  },
  modeText: {
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
  readySection: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  waitingOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 20,
    alignItems: 'center',
    backgroundColor: COLORS.background + 'CC',
  },
  waitingBox: {
    backgroundColor: COLORS.feltLight,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.boardBorder,
  },
  waitingText: {
    color: COLORS.textSecondary,
    fontSize: 16,
    fontWeight: '600',
  },
});
