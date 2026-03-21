import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Modal, View, Text, Pressable, StyleSheet, Platform, useWindowDimensions } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
} from 'react-native-reanimated';
import CardComponent from './Card';
import { COLORS, SUITS, RANKS, Card } from '../constants/gameConfig';
import { rv } from '../constants/deviceBreakpoints';
import { RevealBoardData } from '../types/gameTypes';
import { playSound } from '../utils/sounds';
import { computeOmahaEquity } from '../utils/handEvaluator';

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
const TURN_FLIP_T = 3300;               // 300ms + 3×1000ms countdown
const RIVER_FLIP_DELAY = 2500;          // after turn: 2.5s then river (no countdown)
const WINNER_DELAY_AFTER_RIVER = 3000;  // after river: show prob 3s then winner
const ADVANCE_DELAY = 4000;             // auto-advance after winner
const COUNTDOWN_STEP = 1000;


// Suit display symbols + colors
const SUIT_SYMBOL: Record<string, string> = {
  spades: '♠', hearts: '♥', diamonds: '♦', clubs: '♣',
};
const RANK_ORDER = [...RANKS].reverse(); // A, K, Q, J, 10, ..., 2

/**
 * Find the best card from the remaining deck that would improve a player's hand.
 * Priority: flush draw completing card → pair with hole cards → highest unused.
 */
function findOptimalCard(
  holeCards: Card[],
  communityCards: Card[],
  allKnown: Card[],
): { rank: string; suit: string } | null {
  const usedKeys = new Set(allKnown.map((c) => `${c.rank}-${c.suit}`));
  const allCards = [...holeCards, ...communityCards];

  // Flush draw: 4+ cards of same suit in hole + community → find completing card
  const suitCounts: Partial<Record<string, number>> = {};
  for (const c of allCards) {
    suitCounts[c.suit] = (suitCounts[c.suit] ?? 0) + 1;
  }
  const flushDrawSuit = Object.entries(suitCounts).find(([, n]) => (n ?? 0) >= 4)?.[0];
  if (flushDrawSuit) {
    for (const rank of RANK_ORDER) {
      if (!usedKeys.has(`${rank}-${flushDrawSuit}`)) {
        return { rank, suit: flushDrawSuit };
      }
    }
  }

  // Pair with hole cards: find highest hole card rank that has an unused partner
  const holeRanks = holeCards.map((c) => c.rank);
  for (const rank of RANK_ORDER) {
    if (holeRanks.includes(rank)) {
      for (const suit of SUITS) {
        if (!usedKeys.has(`${rank}-${suit}`)) {
          return { rank, suit };
        }
      }
    }
  }

  // Fallback: highest unused card
  for (const rank of RANK_ORDER) {
    for (const suit of SUITS) {
      if (!usedKeys.has(`${rank}-${suit}`)) {
        return { rank, suit };
      }
    }
  }
  return null;
}


// ─── Main component ────────────────────────────────────────────────────────────
interface RevealSequenceProps {
  boards: RevealBoardData[];
  visible: boolean;
  onDone: () => void;
}

export default function RevealSequence({ boards, visible, onDone }: RevealSequenceProps) {
  const { width: screenW } = useWindowDimensions();
  // Centered layout: community as horizontal row, hands below centered
  // Content fits in max 680px container
  const contentW = Math.min(screenW, 680) - 40;
  const commCardW = Math.min(76, Math.floor((contentW - 4 * 6) / 5));
  const commCardH = Math.round(commCardW / 0.7);
  const handCardW = Math.min(60, Math.floor((contentW - 3 * 4) / 4.5));
  const handCardH = Math.round(handCardW / 0.7);

  const [boardIdx, setBoardIdx] = useState(0);
  const [turnRevealed, setTurnRevealed] = useState(false);
  const [riverRevealed, setRiverRevealed] = useState(false);
  const [showWinner, setShowWinner] = useState(false);
  const [showNextButton, setShowNextButton] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [winProb, setWinProb] = useState<number>(50);
  const [probDelta, setProbDelta] = useState<number | null>(null);
  const [displayedProb, setDisplayedProb] = useState(50);
  const [playerOptimalHint, setPlayerOptimalHint] = useState<{ rank: string; suit: string } | null>(null);
  const [botOptimalHint, setBotOptimalHint] = useState<{ rank: string; suit: string } | null>(null);

  const prevProbRef = useRef<number>(50);
  const displayedProbRef = useRef<number>(50);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  // Animations
  const cardOpacity = useSharedValue(0);
  const winnerScale = useSharedValue(0);
  const winnerOpacity = useSharedValue(0);
  const nextBtnOpacity = useSharedValue(0);
  const countdownOpacity = useSharedValue(0);
  const countdownScale = useSharedValue(1);

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
      setWinProb(50);
      setProbDelta(null);
      setPlayerOptimalHint(null);
      setBotOptimalHint(null);
      setDisplayedProb(50);
      prevProbRef.current = 50;
      displayedProbRef.current = 50;
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
      timersRef.current.forEach(clearTimeout);
      timersRef.current = [];
    };
  }, []);

  // Fade in on visibility / board change
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

  // Countdown pop-in animation
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

  // Smooth count-up animation for probability text
  useEffect(() => {
    const target = Math.round(winProb);
    const start = displayedProbRef.current;
    const diff = target - start;
    if (diff === 0) return;
    const steps = Math.abs(diff);
    const intervalMs = Math.max(10, Math.floor(700 / steps));
    const dir = diff > 0 ? 1 : -1;
    const timer = setInterval(() => {
      displayedProbRef.current += dir;
      setDisplayedProb(Math.round(displayedProbRef.current));
      if (displayedProbRef.current === target) clearInterval(timer);
    }, intervalMs);
    return () => clearInterval(timer);
  }, [winProb]);

  // Helper: compute hints for both players given currently revealed community cards
  const computeHints = useCallback((
    board: RevealBoardData,
    revealedCommunity: Card[],
  ) => {
    const allBotFlat = (board.allBotCards ?? []).flat();
    const allKnown = [...(board.playerCards ?? []), ...allBotFlat, ...revealedCommunity];
    const pHint = findOptimalCard(board.playerCards ?? [], revealedCommunity, allKnown);
    const firstBot = (board.allBotCards ?? [])[0] ?? [];
    const bHint = firstBot.length > 0
      ? findOptimalCard(firstBot, revealedCommunity, allKnown)
      : null;
    setPlayerOptimalHint(pHint);
    setBotOptimalHint(bHint);
  }, []);

  // Main per-board reveal sequence
  useEffect(() => {
    if (!visible) return;
    clearTimers();

    // Play tension sound at the start of each board reveal
    if (boardIdx === 0) {
      try { playSound('revealStart'); } catch {}
    }

    const board = boards[boardIdx];
    if (!board) {
      onDone();
      return;
    }

    const closedCards = board.closedCards ?? [];
    const hasTurn = closedCards.length >= 1;
    const hasRiver = closedCards.length >= 2;
    const turnCard = closedCards[0];

    // Safety: force complete after 15s
    const safetyTimer = setTimeout(() => { onDone(); }, 15000);

    // Show initial probability based on actual equity at flop + compute hints
    const flopEquity = computeOmahaEquity(
      board.playerCards ?? [],
      board.allBotCards ?? [],
      board.openCards ?? [],
    );
    setWinProb(flopEquity);
    prevProbRef.current = flopEquity;
    displayedProbRef.current = flopEquity;
    setDisplayedProb(flopEquity);
    computeHints(board, board.openCards ?? []);

    if (!hasTurn) {
      const finalProb = board.winner === 'player' ? 100 : board.winner === 'bot' ? 0 : 50;
      setWinProb(finalProb);
      addTimer(() => {
        setShowWinner(true);
        setShowNextButton(true);
        addTimer(() => advanceBoard(boardIdx + 1), ADVANCE_DELAY);
      }, 600);
      return () => { clearTimers(); clearTimeout(safetyTimer); };
    }

    // === TURN: dramatic 3-2-1 countdown → flip ===
    addTimer(() => setCountdown(3), 300);
    addTimer(() => setCountdown(2), 300 + COUNTDOWN_STEP);
    addTimer(() => setCountdown(1), 300 + COUNTDOWN_STEP * 2);

    addTimer(() => {
      setCountdown(null);
      setTurnRevealed(true);
      haptic();
      try { playSound('cardFlip'); } catch {}

      const turnCommunity = [...(board.openCards ?? []), ...(turnCard ? [turnCard] : [])];
      const intermediate = computeOmahaEquity(
        board.playerCards ?? [],
        board.allBotCards ?? [],
        turnCommunity,
      );

      const delta = intermediate - prevProbRef.current;
      setProbDelta(delta);
      prevProbRef.current = intermediate;
      setWinProb(intermediate);

      // Update hints with turn card now visible
      if (turnCard) {
        computeHints(board, [...(board.openCards ?? []), turnCard]);
      }
    }, TURN_FLIP_T);

    if (!hasRiver) {
      addTimer(() => {
        setShowWinner(true);
        setShowNextButton(true);
        addTimer(() => advanceBoard(boardIdx + 1), ADVANCE_DELAY);
      }, TURN_FLIP_T + 1500);
    } else {
      // === RIVER: smooth auto-flip 2.5s after turn (no countdown) ===
      const riverCard = closedCards[1];
      const riverFlipT = TURN_FLIP_T + RIVER_FLIP_DELAY;

      addTimer(() => {
        setRiverRevealed(true);
        haptic();
        try { playSound('cardFlip'); } catch {}

        const final = board.winner === 'player' ? 100 : board.winner === 'bot' ? 0 : 50;
        const delta = final - prevProbRef.current;
        setProbDelta(delta);
        prevProbRef.current = final;
        setWinProb(final);

        // Update hints with all community cards
        const allComm = [...(board.openCards ?? [])];
        if (turnCard) allComm.push(turnCard);
        if (riverCard) allComm.push(riverCard);
        computeHints(board, allComm);
      }, riverFlipT);

      // === WINNER: 3s after river ===
      addTimer(() => {
        setShowWinner(true);
        setShowNextButton(true);
        addTimer(() => advanceBoard(boardIdx + 1), ADVANCE_DELAY);
      }, riverFlipT + WINNER_DELAY_AFTER_RIVER);
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
      setWinProb(50);
      setProbDelta(null);
      setPlayerOptimalHint(null);
      setBotOptimalHint(null);
      setDisplayedProb(50);
      prevProbRef.current = 50;
      displayedProbRef.current = 50;
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

  const deltaColor = probDelta !== null
    ? probDelta >= 0 ? COLORS.neonGreen : COLORS.neonRed
    : undefined;
  const deltaStr = probDelta !== null
    ? probDelta >= 0
      ? `↑+${Math.round(Math.abs(probDelta))}%`
      : `↓-${Math.round(Math.abs(probDelta))}%`
    : null;

  const communityLabel = !turnRevealed ? 'FLOP' : !riverRevealed ? 'TURN' : 'RIVER';
  const showBadges = !showWinner;

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

          {/* ── Poker table: bot top, community middle, player bottom ── */}
          <View style={styles.mainContent}>
            <View style={styles.contentContainer}>

              {/* BOT section — top (opponent across the table) */}
              <View style={styles.botSection}>
                <View style={styles.sectionHeader}>
                  <Text style={[
                    styles.sectionLabel,
                    board.winner === 'bot' ? styles.loserSectionLabel : null,
                  ]}>
                    {multiBot ? 'BOTS' : 'BOT'}
                  </Text>
                  <Text style={[styles.probInline, { color: COLORS.neonRed }]}>
                    {100 - displayedProb}%
                  </Text>
                </View>
                {allBotCards.map((botCards, botIdx) =>
                  botCards && botCards.length > 0 ? (
                    <View key={`bot-${botIdx}`} style={styles.handRow}>
                      {botCards.map((c) => (
                        <CardComponent
                          key={c.id}
                          card={c}
                          faceDown={false}
                          cardWidth={handCardW}
                          cardHeight={handCardH}
                          highlighted={
                            (botIdx === 0 && allRevealed && (board.botHighlightIds ?? []).includes(c.id)) ||
                            (botIdx === 0 && !allRevealed && showBadges && !!botOptimalHint && c.rank === botOptimalHint.rank && c.suit === botOptimalHint.suit)
                          }
                          dimmed={botIdx === 0 && allRevealed && !(board.botHighlightIds ?? []).includes(c.id) && (board.botHighlightIds ?? []).length > 0}
                        />
                      ))}
                      {allRevealed && ((board.allBotHandNames ?? [])[botIdx] || (botIdx === 0 && board.botHandName)) && (
                        <Text style={styles.handName}>
                          {(board.allBotHandNames ?? [])[botIdx] || board.botHandName}
                        </Text>
                      )}
                    </View>
                  ) : null
                )}
              </View>

              <View style={styles.handsDivider} />

              {/* Community cards — horizontal row, centered */}
              <View style={styles.communitySection}>
                <Text style={styles.communityLabel}>{communityLabel}</Text>
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

              <View style={styles.handsDivider} />

              {/* YOU section — bottom (your side of the table) */}
              <View style={styles.playerSection}>
                <View style={styles.sectionHeader}>
                  <Text style={[
                    styles.sectionLabel,
                    board.winner === 'player' ? styles.winnerSectionLabel : null,
                  ]}>
                    YOU
                  </Text>
                  <View style={styles.probRow}>
                    <Text style={[styles.probInline, { color: COLORS.neonGreen }]}>
                      {displayedProb}%
                    </Text>
                    {deltaStr && (
                      <Text style={[styles.deltaText, { color: deltaColor }]}>
                        {' '}{deltaStr}
                      </Text>
                    )}
                  </View>
                </View>
                <View style={styles.handRow}>
                  {(board.playerCards ?? []).map((c) => (
                    <CardComponent
                      key={c.id}
                      card={c}
                      faceDown={false}
                      cardWidth={handCardW}
                      cardHeight={handCardH}
                      highlighted={
                        (allRevealed && (board.playerHighlightIds ?? []).includes(c.id)) ||
                        (!allRevealed && showBadges && !!playerOptimalHint && c.rank === playerOptimalHint.rank && c.suit === playerOptimalHint.suit)
                      }
                      dimmed={allRevealed && !(board.playerHighlightIds ?? []).includes(c.id) && (board.playerHighlightIds ?? []).length > 0}
                    />
                  ))}
                  {board.playerHandName && turnRevealed && (
                    <Text style={styles.handName}>{board.playerHandName}</Text>
                  )}
                </View>
                {allRevealed && playerOptimalHint && (
                  <Text style={styles.optimalHint}>
                    Best: {playerOptimalHint.rank}{SUIT_SYMBOL[playerOptimalHint.suit]}
                  </Text>
                )}
              </View>

            </View>
          </View>

          {/* ── Footer: countdown | winner banner | CTA ── */}
          <View style={styles.footer}>
            {countdown !== null && (
              <Animated.View style={[styles.countdownBox, countdownAnimStyle]}>
                <Text style={styles.countdownText}>{countdown}</Text>
              </Animated.View>
            )}
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
    paddingBottom: 24,
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

  // ─── Centered: community row top, bot + you below ─────────────────────────
  mainContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contentContainer: {
    width: '100%',
    maxWidth: 680,
  },
  communitySection: {
    alignItems: 'center',
    paddingVertical: 12,
    gap: 8,
  },
  communityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  handsDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: COLORS.border,
    marginVertical: 6,
    width: '100%',
  },
  botSection: {
    alignItems: 'center',
    paddingVertical: 10,
    gap: 8,
  },
  playerSection: {
    alignItems: 'center',
    paddingVertical: 10,
    gap: 8,
  },

  // ─── Section headers ──────────────────────────────────────────────────────
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  sectionLabel: {
    color: COLORS.textSecondary,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  winnerSectionLabel: { color: COLORS.neonGreen },
  loserSectionLabel: { color: COLORS.neonRed },
  probRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  probInline: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 1,
  },
  deltaText: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.5,
  },

  // ─── Community section label ───────────────────────────────────────────────
  communityLabel: {
    color: COLORS.textDim,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },

  // ─── Hand rows ────────────────────────────────────────────────────────────
  handRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    justifyContent: 'center',
    flexWrap: 'wrap',
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
  optimalHint: {
    color: COLORS.gold,
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.5,
    opacity: 0.75,
    marginTop: 2,
  },

  // ─── Footer ───────────────────────────────────────────────────────────────
  footer: {
    alignItems: 'center',
    gap: 10,
    paddingTop: 8,
    minHeight: 90,
  },
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
