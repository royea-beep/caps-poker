import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Modal, View, Text, Pressable, StyleSheet, Platform, ScrollView } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useDerivedValue,
  withTiming,
  withSpring,
} from 'react-native-reanimated';
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
const BETWEEN_FLIPS = 700;    // pause after turn flip before river countdown starts
const WINNER_DELAY = 600;     // after river flip before winner banner shows
const ADVANCE_DELAY = 10000;  // auto-advance after winner
const COUNTDOWN_STEP = 1000;  // 1 second per countdown number

// Card sizes — smaller on native to fit 5 community cards in one row
const commCardW = Platform.OS === 'web' ? 58 : 48;
const commCardH = Platform.OS === 'web' ? 82 : 68;
const handCardW = Platform.OS === 'web' ? 52 : 42;
const handCardH = Platform.OS === 'web' ? 74 : 60;

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
  const [countdown, setCountdown] = useState<number | null>(null);
  const [winProb, setWinProb] = useState<number | null>(null);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  // Animations
  const cardOpacity = useSharedValue(0);
  const winnerScale = useSharedValue(0);
  const winnerOpacity = useSharedValue(0);
  const nextBtnOpacity = useSharedValue(0);
  const countdownOpacity = useSharedValue(0);
  const countdownScale = useSharedValue(1);
  const probPct = useSharedValue(50); // 0–100 representing player's win %
  const probBotPct = useDerivedValue(() => 100 - probPct.value);

  const cardAnimStyle = useAnimatedStyle(() => ({ opacity: cardOpacity.value }));
  const winnerAnimStyle = useAnimatedStyle(() => ({
    opacity: winnerOpacity.value,
    transform: [{ scale: winnerScale.value }],
  }));
  const nextBtnAnimStyle = useAnimatedStyle(() => ({ opacity: nextBtnOpacity.value }));
  const countdownAnimStyle = useAnimatedStyle(() => ({
    opacity: countdownOpacity.value,
    transform: [{ scale: countdownScale.value }],
  }));
  const probPlayerStyle = useAnimatedStyle(() => ({ flex: probPct.value }));
  const probBotStyle = useAnimatedStyle(() => ({ flex: probBotPct.value }));

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
      setCountdown(null);
      setWinProb(null);
      probPct.value = 50;
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

  // Fade card container in on visibility / board change
  useEffect(() => {
    if (visible) {
      cardOpacity.value = 0;
      cardOpacity.value = withTiming(1, { duration: 250 });
    } else {
      cardOpacity.value = 0;
    }
  }, [visible, boardIdx]);

  // Animate winner banner
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

  // Fade next button
  useEffect(() => {
    nextBtnOpacity.value = showNextButton ? withTiming(1, { duration: 300 }) : 0;
  }, [showNextButton]);

  // Countdown pop-in animation on each number
  useEffect(() => {
    if (countdown !== null) {
      countdownOpacity.value = 0;
      countdownScale.value = 1.6;
      countdownOpacity.value = withTiming(1, { duration: 120 });
      countdownScale.value = withSpring(1, { damping: 10, stiffness: 350 });
    } else {
      countdownOpacity.value = withTiming(0, { duration: 150 });
    }
  }, [countdown]);

  // Animate probability bar when winProb changes
  useEffect(() => {
    if (winProb !== null) {
      probPct.value = withTiming(winProb, { duration: 700 });
    }
  }, [winProb]);

  // Main per-board reveal sequence
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

    // Safety: force complete after 22s (longer to accommodate countdown drama)
    const safetyTimer = setTimeout(() => { onDone(); }, 22000);

    if (!hasTurn) {
      // All community cards already visible — show final prob and winner quickly
      const finalProb = board.winner === 'player' ? 100 : board.winner === 'bot' ? 0 : 50;
      setWinProb(finalProb);
      addTimer(() => {
        setShowWinner(true);
        setShowNextButton(true);
        addTimer(() => advanceBoard(boardIdx + 1), ADVANCE_DELAY);
      }, 600);
      return () => { clearTimers(); clearTimeout(safetyTimer); };
    }

    // === Dramatic reveal: countdown → turn flip → countdown → river flip → winner ===

    // Start at 50/50
    setWinProb(50);
    probPct.value = 50;

    // Turn countdown: 3…2…1 starting at t=300
    addTimer(() => setCountdown(3), 300);
    addTimer(() => setCountdown(2), 300 + COUNTDOWN_STEP);
    addTimer(() => setCountdown(1), 300 + COUNTDOWN_STEP * 2);

    // Flip turn at t=3300
    const turnFlipT = 300 + COUNTDOWN_STEP * 3;
    addTimer(() => {
      setCountdown(null);
      setTurnRevealed(true);
      haptic();
      try { playSound('cardFlip'); } catch {}

      // Lean probability toward eventual winner
      const intermediate =
        board.winner === 'player'
          ? 55 + Math.floor(Math.random() * 20)   // 55–74%
          : board.winner === 'bot'
            ? 26 + Math.floor(Math.random() * 19)  // 26–44%
            : 50;
      setWinProb(intermediate);
    }, turnFlipT);

    if (!hasRiver) {
      // No river — show winner shortly after turn
      addTimer(() => {
        setShowWinner(true);
        setShowNextButton(true);
        addTimer(() => advanceBoard(boardIdx + 1), ADVANCE_DELAY);
      }, turnFlipT + WINNER_DELAY);
    } else {
      // River countdown starts after BETWEEN_FLIPS pause
      const riverCountdownStart = turnFlipT + BETWEEN_FLIPS;
      addTimer(() => setCountdown(3), riverCountdownStart);
      addTimer(() => setCountdown(2), riverCountdownStart + COUNTDOWN_STEP);
      addTimer(() => setCountdown(1), riverCountdownStart + COUNTDOWN_STEP * 2);

      // Flip river
      const riverFlipT = riverCountdownStart + COUNTDOWN_STEP * 3;
      addTimer(() => {
        setCountdown(null);
        setRiverRevealed(true);
        haptic();
        try { playSound('cardFlip'); } catch {}

        // Final probability
        const final = board.winner === 'player' ? 100 : board.winner === 'bot' ? 0 : 50;
        setWinProb(final);
      }, riverFlipT);

      addTimer(() => {
        setShowWinner(true);
        setShowNextButton(true);
        addTimer(() => advanceBoard(boardIdx + 1), ADVANCE_DELAY);
      }, riverFlipT + WINNER_DELAY);
    }

    return () => { clearTimers(); clearTimeout(safetyTimer); };
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
      setCountdown(null);
      setWinProb(null);
      probPct.value = 50;
    }
  }, [visible]);

  const handleSkip = useCallback(() => {
    clearTimers();
    onDone();
  }, [clearTimers, onDone]);

  if (!visible || boards.length === 0) return null;

  let board = boards[boardIdx];
  if (!board) return null;

  // Defensive: fix malformed board
  try {
    if (!Array.isArray(board.openCards) || !Array.isArray(board.closedCards) || !Array.isArray(board.playerCards)) {
      board = {
        ...board,
        openCards: board.openCards ?? [],
        closedCards: board.closedCards ?? [],
        playerCards: board.playerCards ?? [],
        allBotCards: board.allBotCards ?? [],
        boardHighlightIds: [],
        playerHighlightIds: [],
        botHighlightIds: [],
        allBotHandNames: [],
      };
    }
  } catch (e) {
    console.error('[RevealSequence] board guard threw:', e);
    return null;
  }

  const turnCard = (board.closedCards ?? [])[0];
  const riverCard = (board.closedCards ?? [])[1];
  const allRevealed = riverRevealed || (turnRevealed && !riverCard);

  const winnerColor =
    board.winner === 'player' ? COLORS.neonGreen : board.winner === 'bot' ? COLORS.neonRed : COLORS.textSecondary;
  const winnerLabel =
    board.winner === 'player' ? 'YOU WIN' : board.winner === 'bot' ? 'BOT WINS' : 'TIE';

  const allBotCards = board.allBotCards ?? [];
  const multiBot = allBotCards.length > 1;

  // Probability display (snaps to target; bar animates smoothly)
  const displayProb = winProb ?? 50;

  return (
    <Modal visible={visible} transparent={false} animationType="fade" statusBarTranslucent>
      <Pressable style={styles.overlay} onPress={showNextButton ? handleNextBoard : undefined}>
        <Animated.View style={[styles.screen, cardAnimStyle]}>

          {/* ── Top bar ── */}
          <View style={styles.topBar}>
            <Text style={styles.boardTitle}>
              BOARD {boardIdx + 1} <Text style={styles.boardSub}>of {boards.length}</Text>
            </Text>
            <Pressable style={styles.skipBtn} onPress={handleSkip} hitSlop={16}>
              <Text style={styles.skipText}>SKIP</Text>
            </Pressable>
          </View>

          {/* ── Cards (scrollable) ── */}
          <ScrollView
            style={styles.cardsScroll}
            contentContainerStyle={styles.cardsSection}
            showsVerticalScrollIndicator={false}
            bounces={false}
          >
            {/* Community cards */}
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
          </ScrollView>

          {/* ── Bottom: countdown | probability | winner + CTA ── */}
          <View style={styles.bottomSection}>

            {/* 3…2…1 countdown */}
            {countdown !== null && (
              <Animated.View style={[styles.countdownBox, countdownAnimStyle]}>
                <Text style={styles.countdownText}>{countdown}</Text>
              </Animated.View>
            )}

            {/* Win probability bar — visible between flips, hidden during countdown + after winner */}
            {winProb !== null && countdown === null && !showWinner && (
              <View style={styles.probContainer}>
                <Text style={styles.probLabel}>WIN PROBABILITY</Text>
                <View style={styles.probTrack}>
                  <Animated.View style={[styles.probFillPlayer, probPlayerStyle]} />
                  <Animated.View style={[styles.probFillBot, probBotStyle]} />
                </View>
                <View style={styles.probNumbers}>
                  <Text style={[styles.probNum, { color: COLORS.neonGreen }]}>YOU {displayProb}%</Text>
                  <Text style={[styles.probNum, { color: COLORS.neonRed }]}>BOT {100 - displayProb}%</Text>
                </View>
              </View>
            )}

            {/* Winner banner */}
            {showWinner && (
              <Animated.View style={[styles.winnerBanner, { borderColor: winnerColor }, winnerAnimStyle]}>
                <Text style={[styles.winnerText, { color: winnerColor }]}>{winnerLabel}</Text>
              </Animated.View>
            )}

            {/* CTA */}
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
  cardsScroll: {
    flex: 1,
  },
  cardsSection: {
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 8,
    flexGrow: 1,
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
    gap: 4,
    justifyContent: 'center',
  },
  sep: {
    width: 1,
    backgroundColor: COLORS.gold,
    opacity: 0.35,
    marginHorizontal: 3,
    alignSelf: 'center',
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
    gap: 4,
    justifyContent: 'center',
  },
  handName: {
    color: COLORS.textSecondary,
    fontSize: 11,
    fontWeight: '600',
    marginLeft: 6,
    flexShrink: 1,
    flexWrap: 'wrap',
    maxWidth: 100,
  },
  bottomSection: {
    alignItems: 'center',
    gap: 12,
    paddingTop: 12,
    minHeight: 110,
  },
  // Countdown
  countdownBox: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  countdownText: {
    color: COLORS.gold,
    fontSize: 72,
    fontWeight: '900',
    letterSpacing: 4,
    lineHeight: 80,
  },
  // Probability bar
  probContainer: {
    width: '100%',
    alignItems: 'center',
    gap: 6,
  },
  probLabel: {
    color: COLORS.textDim,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  probTrack: {
    width: '100%',
    height: 8,
    borderRadius: 4,
    flexDirection: 'row',
    overflow: 'hidden',
    backgroundColor: COLORS.surface,
  },
  probFillPlayer: {
    height: '100%',
    backgroundColor: COLORS.neonGreen,
  },
  probFillBot: {
    height: '100%',
    backgroundColor: COLORS.neonRed,
  },
  probNumbers: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    paddingHorizontal: 2,
  },
  probNum: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
  },
  // Winner
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
