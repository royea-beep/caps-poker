import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Modal, View, Text, Pressable, StyleSheet, Platform } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, withSpring } from 'react-native-reanimated';
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
const commCardW = Platform.OS === 'web' ? 58 : 52;
const commCardH = Platform.OS === 'web' ? 82 : 74;
const handCardW = Platform.OS === 'web' ? 52 : 46;
const handCardH = Platform.OS === 'web' ? 74 : 66;

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

  // iOS-safe animations — avoid `entering` prop inside Modal (known Reanimated + Old Arch freeze)
  const cardOpacity = useSharedValue(0);
  const winnerScale = useSharedValue(0);
  const winnerOpacity = useSharedValue(0);
  const nextBtnOpacity = useSharedValue(0);

  const cardAnimStyle = useAnimatedStyle(() => ({ opacity: cardOpacity.value }));
  const winnerAnimStyle = useAnimatedStyle(() => ({
    opacity: winnerOpacity.value,
    transform: [{ scale: winnerScale.value }],
  }));
  const nextBtnAnimStyle = useAnimatedStyle(() => ({ opacity: nextBtnOpacity.value }));

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

  // Fade card container in when modal becomes visible or board changes
  useEffect(() => {
    if (visible) {
      cardOpacity.value = 0;
      cardOpacity.value = withTiming(1, { duration: 250 });
    } else {
      cardOpacity.value = 0;
    }
  }, [visible, boardIdx]);

  // Animate winner banner in when showWinner flips true
  useEffect(() => {
    if (showWinner) {
      winnerScale.value = 0;
      winnerOpacity.value = 0;
      winnerScale.value = withSpring(1, { damping: 12, stiffness: 200 });
      winnerOpacity.value = withTiming(1, { duration: 200 });
    } else {
      winnerScale.value = 0;
      winnerOpacity.value = 0;
    }
  }, [showWinner]);

  // Fade next button in
  useEffect(() => {
    nextBtnOpacity.value = showNextButton ? withTiming(1, { duration: 300 }) : 0;
  }, [showNextButton]);

  // Run per-board reveal sequence whenever boardIdx changes
  useEffect(() => {
    if (!visible) return;
    clearTimers();

    const board = boards[boardIdx];
    if (!board) {
      onDone();
      return;
    }

    const closedCards = board.closedCards ?? [];
    const hasTurn = closedCards.length >= 1;
    const hasRiver = closedCards.length >= 2;

    // Safety: if sequence gets stuck for 15s, force complete
    const safetyTimer = setTimeout(() => {
      onDone();
    }, 15000);

    if (!hasTurn) {
      // No closed cards — skip straight to winner
      addTimer(() => {
        setShowWinner(true);
        setShowNextButton(true);
        addTimer(() => advanceBoard(boardIdx + 1), ADVANCE_DELAY);
      }, 400);
      return () => {
        clearTimers();
        clearTimeout(safetyTimer);
      };
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

    return () => {
      clearTimers();
      clearTimeout(safetyTimer);
    };
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

  let board = boards[boardIdx];
  if (!board) return null;

  // Defensive: skip malformed board (missing required arrays) — advance to next
  try {
    if (!Array.isArray(board.openCards) || !Array.isArray(board.closedCards) || !Array.isArray(board.playerCards)) {
      console.warn('[RevealSequence] malformed board at index', boardIdx, '— skipping');
      board = { ...board, openCards: board.openCards ?? [], closedCards: board.closedCards ?? [], playerCards: board.playerCards ?? [], allBotCards: board.allBotCards ?? [], boardHighlightIds: [], playerHighlightIds: [], botHighlightIds: [], allBotHandNames: [] };
    }
  } catch (e) {
    console.error('[RevealSequence] board guard threw:', e);
    return null;
  }

  const turnCard = (board.closedCards ?? [])[0];
  const riverCard = (board.closedCards ?? [])[1];

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

  const allBotCards = board.allBotCards ?? [];
  const multiBot = allBotCards.length > 1;

  return (
    <Modal visible={visible} transparent={false} animationType="fade" statusBarTranslucent>
      {/* Full-screen tappable area — tap anywhere to advance when ready */}
      <Pressable style={styles.overlay} onPress={showNextButton ? handleNextBoard : undefined}>
        <Animated.View style={[styles.screen, cardAnimStyle]}>

          {/* ── Top bar: board progress + skip ── */}
          <View style={styles.topBar}>
            <Text style={styles.boardTitle}>BOARD {boardIdx + 1} <Text style={styles.boardSub}>of {boards.length}</Text></Text>
            <Pressable style={styles.skipBtn} onPress={handleSkip} hitSlop={16}>
              <Text style={styles.skipText}>SKIP</Text>
            </Pressable>
          </View>

          {/* ── Middle: all cards ── */}
          <View style={styles.cardsSection}>
            {/* Community cards: flop (face up) | separator | turn/river (flip) */}
            <View style={styles.sectionBlock}>
              <Text style={styles.sectionLabel}>COMMUNITY</Text>
              <View style={styles.communityRow}>
                {(board.openCards ?? []).map((c) => (
                  <CardComponent
                    key={c.id}
                    card={c}
                    faceDown={false}
                    cardWidth={commCardW}
                    cardHeight={commCardH}
                    highlighted={allRevealed && (board.boardHighlightIds ?? []).includes(c.id)}
                    dimmed={allRevealed && !(board.boardHighlightIds ?? []).includes(c.id) && (board.boardHighlightIds ?? []).length > 0}
                  />
                ))}
                {(board.openCards ?? []).length > 0 && (board.closedCards ?? []).length > 0 && (
                  <View style={[styles.sep, { height: commCardH * 0.8 }]} />
                )}
                {turnCard && (
                  <CardComponent
                    card={turnCard}
                    faceDown={!turnRevealed}
                    cardWidth={commCardW}
                    cardHeight={commCardH}
                    flipDuration={350}
                    highlighted={allRevealed && (board.boardHighlightIds ?? []).includes(turnCard.id)}
                    dimmed={allRevealed && !(board.boardHighlightIds ?? []).includes(turnCard.id) && (board.boardHighlightIds ?? []).length > 0}
                  />
                )}
                {riverCard && (
                  <CardComponent
                    card={riverCard}
                    faceDown={!riverRevealed}
                    cardWidth={commCardW}
                    cardHeight={commCardH}
                    flipDuration={350}
                    highlighted={allRevealed && (board.boardHighlightIds ?? []).includes(riverCard.id)}
                    dimmed={allRevealed && !(board.boardHighlightIds ?? []).includes(riverCard.id) && (board.boardHighlightIds ?? []).length > 0}
                  />
                )}
              </View>
            </View>

            {/* Divider */}
            <View style={styles.divider} />

            {/* Player hole cards */}
            <View style={styles.sectionBlock}>
              <Text style={[styles.sectionLabel, board.winner === 'player' && styles.winnerSectionLabel]}>YOU</Text>
              <View style={styles.handRow}>
                {(board.playerCards ?? []).map((c) => (
                  <CardComponent
                    key={c.id}
                    card={c}
                    faceDown={false}
                    cardWidth={handCardW}
                    cardHeight={handCardH}
                    highlighted={allRevealed && (board.playerHighlightIds ?? []).includes(c.id)}
                    dimmed={allRevealed && !(board.playerHighlightIds ?? []).includes(c.id) && (board.playerHighlightIds ?? []).length > 0}
                  />
                ))}
                {board.playerHandName && turnRevealed && (
                  <Text style={styles.handName}>{board.playerHandName}</Text>
                )}
              </View>
            </View>

            {/* Bot hole cards */}
            {allBotCards.map((botCards, botIdx) =>
              botCards && botCards.length > 0 ? (
                <View key={`bot-${botIdx}`} style={styles.sectionBlock}>
                  <Text style={[styles.sectionLabel, board.winner === 'bot' && styles.loserSectionLabel]}>
                    {multiBot ? `BOT ${botIdx + 1}` : 'BOT'}
                  </Text>
                  <View style={styles.handRow}>
                    {botCards.map((c) => (
                      <CardComponent
                        key={c.id}
                        card={c}
                        faceDown={false}
                        cardWidth={handCardW}
                        cardHeight={handCardH}
                        highlighted={botIdx === 0 && allRevealed && (board.botHighlightIds ?? []).includes(c.id)}
                        dimmed={botIdx === 0 && allRevealed && !(board.botHighlightIds ?? []).includes(c.id) && (board.botHighlightIds ?? []).length > 0}
                      />
                    ))}
                    {turnRevealed && ((board.allBotHandNames ?? [])[botIdx] || (botIdx === 0 && board.botHandName)) && (
                      <Text style={styles.handName}>
                        {(board.allBotHandNames ?? [])[botIdx] || board.botHandName}
                      </Text>
                    )}
                  </View>
                </View>
              ) : null
            )}
          </View>

          {/* ── Bottom: winner + CTA ── */}
          <View style={styles.bottomSection}>
            {showWinner && (
              <Animated.View style={[styles.winnerBanner, { borderColor: winnerColor }, winnerAnimStyle]}>
                <Text style={[styles.winnerText, { color: winnerColor }]}>{winnerLabel}</Text>
              </Animated.View>
            )}
            <Animated.View style={[styles.ctaRow, nextBtnAnimStyle]}>
              <Text style={styles.ctaText}>
                {boardIdx + 1 < boards.length ? 'TAP TO CONTINUE →' : 'TAP TO SEE RESULTS →'}
              </Text>
            </Animated.View>
          </View>

        </Animated.View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  screen: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 52,
    paddingBottom: 32,
    justifyContent: 'space-between',
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  boardTitle: {
    color: COLORS.gold,
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: 2,
  },
  boardSub: {
    color: COLORS.textSecondary,
    fontSize: 14,
    fontWeight: '500',
    letterSpacing: 0,
  },
  skipBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  skipText: {
    color: COLORS.textDim,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
  },
  cardsSection: {
    flex: 1,
    justifyContent: 'center',
    gap: 12,
  },
  sectionBlock: {
    alignItems: 'center',
    gap: 6,
  },
  sectionLabel: {
    color: COLORS.textSecondary,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  winnerSectionLabel: {
    color: COLORS.neonGreen,
  },
  loserSectionLabel: {
    color: COLORS.neonRed,
  },
  communityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  sep: {
    width: 2,
    backgroundColor: COLORS.border,
    marginHorizontal: 4,
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.border,
    opacity: 0.4,
    marginHorizontal: 20,
  },
  handRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  handName: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 6,
    flexShrink: 1,
  },
  bottomSection: {
    alignItems: 'center',
    gap: 16,
    paddingTop: 16,
  },
  winnerBanner: {
    borderWidth: 2,
    borderRadius: 14,
    paddingHorizontal: 36,
    paddingVertical: 14,
  },
  winnerText: {
    fontSize: 26,
    fontWeight: '900',
    letterSpacing: 3,
  },
  ctaRow: {
    alignItems: 'center',
  },
  ctaText: {
    color: COLORS.gold,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 2,
    opacity: 0.8,
  },
});
