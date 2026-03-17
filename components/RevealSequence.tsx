import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Modal, View, Text, Pressable, StyleSheet, Platform } from 'react-native';
import Animated, { FadeIn, ZoomIn } from 'react-native-reanimated';
import CardComponent from './Card';
import { COLORS } from '../constants/gameConfig';
import { RevealBoardData } from '../types/gameTypes';
import { playSound } from '../utils/sounds';

// Lazy haptics — never crash on web
let Haptics: typeof import('expo-haptics') | null = null;
if (Platform.OS !== 'web') {
  try {
    Haptics = require('expo-haptics');
  } catch {}
}

function haptic() {
  if (!Haptics) return;
  try {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
  } catch {}
}

// Timing constants
const FLIP_DELAY = 600;       // ms before turn flips
const BETWEEN_FLIPS = 1500;   // ms between turn and river flip (suspense)
const WINNER_DELAY = 500;     // ms after river before winner shows
const ADVANCE_DELAY = 10000;  // ms after winner before auto-advance

// Card sizes — larger on web for readability
const commCardW = Platform.OS === 'web' ? 72 : 52;
const commCardH = Platform.OS === 'web' ? 102 : 74;
const handCardW = Platform.OS === 'web' ? 60 : 44;
const handCardH = Platform.OS === 'web' ? 86 : 62;

interface RevealSequenceProps {
  boards: RevealBoardData[];
  visible: boolean;
  onDone: () => void;
}

export default function RevealSequence({ boards, visible, onDone }: RevealSequenceProps) {
  const [boardIdx, setBoardIdx] = useState(0);
  const [turnRevealed, setTurnRevealed] = useState(false);
  const [riverRevealed, setRiverRevealed] = useState(false);
  const [showWinner, setShowWinner] = useState(false);
  const [showNextButton, setShowNextButton] = useState(false);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clearTimers = useCallback(() => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
  }, []);

  const addTimer = useCallback((fn: () => void, delay: number) => {
    const t = setTimeout(fn, delay);
    timersRef.current.push(t);
  }, []);

  const advanceBoard = useCallback(
    (nextIdx: number) => {
      if (nextIdx >= boards.length) {
        onDone();
        return;
      }
      setTurnRevealed(false);
      setRiverRevealed(false);
      setShowWinner(false);
      setShowNextButton(false);
      setBoardIdx(nextIdx);
    },
    [boards.length, onDone],
  );

  const handleNextBoard = useCallback(() => {
    clearTimers();
    advanceBoard(boardIdx + 1);
  }, [clearTimers, advanceBoard, boardIdx]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      timersRef.current.forEach((t) => clearTimeout(t));
      timersRef.current = [];
    };
  }, []);

  // Run per-board reveal sequence whenever boardIdx changes
  useEffect(() => {
    if (!visible) return;
    clearTimers();

    const board = boards[boardIdx];
    if (!board) {
      onDone();
      return;
    }

    const hasTurn = board.closedCards.length >= 1;
    const hasRiver = board.closedCards.length >= 2;

    if (!hasTurn) {
      // No closed cards — skip straight to winner
      addTimer(() => {
        setShowWinner(true);
        setShowNextButton(true);
        addTimer(() => advanceBoard(boardIdx + 1), ADVANCE_DELAY);
      }, 400);
      return;
    }

    // Flip turn
    addTimer(() => {
      setTurnRevealed(true);
      haptic();
      try {
        playSound('cardFlip');
      } catch {}

      if (!hasRiver) {
        addTimer(() => {
          setShowWinner(true);
          setShowNextButton(true);
          addTimer(() => advanceBoard(boardIdx + 1), ADVANCE_DELAY);
        }, WINNER_DELAY);
        return;
      }

      // 1.5s suspense pause, then flip river
      addTimer(() => {
        setRiverRevealed(true);
        haptic();
        try {
          playSound('cardFlip');
        } catch {}
        addTimer(() => {
          setShowWinner(true);
          setShowNextButton(true);
          addTimer(() => advanceBoard(boardIdx + 1), ADVANCE_DELAY);
        }, WINNER_DELAY);
      }, BETWEEN_FLIPS);
    }, FLIP_DELAY);

    return clearTimers;
  }, [boardIdx, visible]);

  // Reset when modal closes
  useEffect(() => {
    if (!visible) {
      clearTimers();
      setBoardIdx(0);
      setTurnRevealed(false);
      setRiverRevealed(false);
      setShowWinner(false);
      setShowNextButton(false);
    }
  }, [visible]);

  const handleSkip = useCallback(() => {
    clearTimers();
    onDone();
  }, [clearTimers, onDone]);

  if (!visible || boards.length === 0) return null;

  const board = boards[boardIdx];
  if (!board) return null;

  const turnCard = board.closedCards[0];
  const riverCard = board.closedCards[1];

  // Cards are fully revealed once river is shown (or turn if no river)
  const allRevealed = riverRevealed || (turnRevealed && !riverCard);

  const winnerColor =
    board.winner === 'player'
      ? COLORS.neonGreen
      : board.winner === 'bot'
        ? COLORS.neonRed
        : COLORS.textSecondary;

  const winnerLabel =
    board.winner === 'player' ? 'YOU WIN' : board.winner === 'bot' ? 'BOT WINS' : 'TIE';

  const multiBot = board.allBotCards.length > 1;

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent>
      <View style={styles.overlay}>
        <Animated.View entering={FadeIn.duration(250)} style={styles.card}>
          {/* Board header */}
          <Text style={styles.boardTitle}>BOARD {boardIdx + 1}</Text>
          <Text style={styles.boardSub}>
            {boardIdx + 1} of {boards.length}
          </Text>

          {/* Community cards: flop (face up) | separator | turn/river (flip) */}
          <View style={styles.communityRow}>
            {board.openCards.map((c) => (
              <CardComponent
                key={c.id}
                card={c}
                faceDown={false}
                cardWidth={commCardW}
                cardHeight={commCardH}
                highlighted={allRevealed && board.boardHighlightIds.includes(c.id)}
                dimmed={allRevealed && !board.boardHighlightIds.includes(c.id) && board.boardHighlightIds.length > 0}
              />
            ))}
            {board.openCards.length > 0 && board.closedCards.length > 0 && (
              <View style={[styles.sep, { height: commCardH * 0.8 }]} />
            )}
            {turnCard && (
              <CardComponent
                card={turnCard}
                faceDown={!turnRevealed}
                cardWidth={commCardW}
                cardHeight={commCardH}
                flipDuration={350}
                highlighted={allRevealed && board.boardHighlightIds.includes(turnCard.id)}
                dimmed={allRevealed && !board.boardHighlightIds.includes(turnCard.id) && board.boardHighlightIds.length > 0}
              />
            )}
            {riverCard && (
              <CardComponent
                card={riverCard}
                faceDown={!riverRevealed}
                cardWidth={commCardW}
                cardHeight={commCardH}
                flipDuration={350}
                highlighted={allRevealed && board.boardHighlightIds.includes(riverCard.id)}
                dimmed={allRevealed && !board.boardHighlightIds.includes(riverCard.id) && board.boardHighlightIds.length > 0}
              />
            )}
          </View>

          {/* Player hole cards */}
          <View style={styles.handRow}>
            <Text style={[styles.handLabel, board.winner === 'player' && styles.winnerLabel]}>YOU</Text>
            {board.playerCards.map((c) => (
              <CardComponent
                key={c.id}
                card={c}
                faceDown={false}
                cardWidth={handCardW}
                cardHeight={handCardH}
                highlighted={allRevealed && board.playerHighlightIds.includes(c.id)}
                dimmed={allRevealed && !board.playerHighlightIds.includes(c.id) && board.playerHighlightIds.length > 0}
              />
            ))}
            {board.playerHandName && turnRevealed && (
              <Text style={styles.handName}>{board.playerHandName}</Text>
            )}
          </View>

          {/* Bot hole cards — shown face-up so user understands who won and why */}
          {board.allBotCards.map((botCards, botIdx) =>
            botCards.length > 0 ? (
              <View key={`bot-${botIdx}`} style={styles.handRow}>
                <Text style={[styles.handLabel, board.winner === 'bot' && styles.winnerLabel]}>
                  {multiBot ? `BOT ${botIdx + 1}` : 'BOT'}
                </Text>
                {botCards.map((c) => (
                  <CardComponent
                    key={c.id}
                    card={c}
                    faceDown={false}
                    cardWidth={handCardW}
                    cardHeight={handCardH}
                    highlighted={botIdx === 0 && allRevealed && board.botHighlightIds.includes(c.id)}
                    dimmed={botIdx === 0 && allRevealed && !board.botHighlightIds.includes(c.id) && board.botHighlightIds.length > 0}
                  />
                ))}
                {turnRevealed && (board.allBotHandNames[botIdx] || (botIdx === 0 && board.botHandName)) && (
                  <Text style={styles.handName}>
                    {board.allBotHandNames[botIdx] || board.botHandName}
                  </Text>
                )}
              </View>
            ) : null
          )}

          {/* Winner banner — slides in after reveal */}
          {showWinner && (
            <Animated.View
              entering={ZoomIn.duration(300)}
              style={[styles.winnerBanner, { borderColor: winnerColor }]}
            >
              <Text style={[styles.winnerText, { color: winnerColor }]}>{winnerLabel}</Text>
            </Animated.View>
          )}

          {/* Next Board button — appears after winner banner, auto-advances after 10s */}
          {showNextButton && (
            <Animated.View entering={FadeIn.duration(300)} style={styles.nextBtnRow}>
              <Pressable style={styles.nextBtn} onPress={handleNextBoard} hitSlop={8}>
                <Text style={styles.nextBtnText}>
                  {boardIdx + 1 < boards.length ? 'NEXT BOARD →' : 'DONE →'}
                </Text>
              </Pressable>
            </Animated.View>
          )}
        </Animated.View>

        {/* Skip button */}
        <Pressable style={styles.skipBtn} onPress={handleSkip} hitSlop={12}>
          <Text style={styles.skipText}>SKIP →</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.88)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    backgroundColor: COLORS.surfaceRaised,
    borderRadius: 20,
    padding: 28,
    width: '88%',
    maxWidth: 440,
    alignItems: 'center',
    gap: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  boardTitle: {
    color: COLORS.gold,
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: 3,
  },
  boardSub: {
    color: COLORS.textSecondary,
    fontSize: 13,
    fontWeight: '600',
    marginTop: -8,
  },
  communityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginVertical: 4,
  },
  sep: {
    width: 2,
    backgroundColor: COLORS.border,
    marginHorizontal: 4,
  },
  handRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  handLabel: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '700',
    marginRight: 4,
    width: 36,
    textAlign: 'center',
  },
  winnerLabel: {
    color: COLORS.neonGreen,
  },
  handName: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 6,
    flexShrink: 1,
  },
  winnerBanner: {
    marginTop: 6,
    borderWidth: 2,
    borderRadius: 14,
    paddingHorizontal: 28,
    paddingVertical: 12,
  },
  winnerText: {
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: 2,
  },
  nextBtnRow: {
    width: '100%',
    alignItems: 'center',
  },
  nextBtn: {
    paddingVertical: 10,
    paddingHorizontal: 28,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.gold,
    backgroundColor: 'rgba(200,168,75,0.12)',
  },
  nextBtnText: {
    color: COLORS.gold,
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  skipBtn: {
    marginTop: 28,
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  skipText: {
    color: COLORS.textDim,
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 1,
  },
});
