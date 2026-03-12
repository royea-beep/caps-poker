import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, useWindowDimensions, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  withSpring,
  withSequence,
  FadeIn,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import CardComponent from '../components/Card';
import { Badge } from '../components/Badge';
import CompleteOverlay from '../components/CompleteOverlay';
import { useGameStore } from '../store/gameStore';
import { COLORS } from '../constants/gameConfig';
import { playSound } from '../utils/sounds';
import { RevealBoardData } from '../types/gameTypes';

const haptic = (style: Haptics.ImpactFeedbackStyle) => {
  Haptics.impactAsync(style).catch(() => {});
};

export default function RevealScreen() {
  const router = useRouter();
  const { width: SCREEN_W } = useWindowDimensions();
  const revealData = useGameStore((s) => s.revealData);
  const clearRevealData = useGameStore((s) => s.clearRevealData);

  const [currentBoard, setCurrentBoard] = useState(-1); // -1 = pre-reveal
  const [showComplete, setShowComplete] = useState(false);

  // Guard: no data, go home
  useEffect(() => {
    if (!revealData) {
      router.replace('/');
    }
  }, [revealData, router]);

  // Start reveal after brief delay
  useEffect(() => {
    if (!revealData) return;
    const timer = setTimeout(() => {
      setCurrentBoard(0);
      haptic(Haptics.ImpactFeedbackStyle.Heavy);
      playSound('cardFlip');
    }, 500);
    return () => clearTimeout(timer);
  }, [revealData]);

  // Auto-advance to next board
  useEffect(() => {
    if (!revealData || currentBoard < 0) return;
    if (currentBoard >= revealData.boardCount) return;

    const timer = setTimeout(() => {
      const nextBoard = currentBoard + 1;
      if (nextBoard < revealData.boardCount) {
        setCurrentBoard(nextBoard);
        haptic(Haptics.ImpactFeedbackStyle.Heavy);
        playSound('cardFlip');
      } else {
        // All boards revealed
        if (revealData.isComplete) {
          setShowComplete(true);
        } else {
          navigateToSummary();
        }
      }
    }, revealData.boardRevealDuration * 1000);
    return () => clearTimeout(timer);
  }, [currentBoard, revealData]);

  const navigateToSummary = useCallback(() => {
    if (!revealData) return;
    const summaryParams = {
      results: JSON.stringify(
        revealData.boards.map((b) => ({
          winner: b.winner,
          playerHand: b.playerHandName,
          botHand: b.botHandName,
          allBotHands: b.allBotHandNames,
        }))
      ),
      netChips: revealData.netChips.toString(),
      isComplete: revealData.isComplete.toString(),
      completeBonusAmount: revealData.completeBonusAmount.toString(),
      potPerBoard: revealData.potPerBoard.toString(),
      boardCount: revealData.boardCount.toString(),
      numberOfPlayers: revealData.numberOfPlayers.toString(),
    };
    clearRevealData();
    router.replace({ pathname: '/summary', params: summaryParams });
  }, [revealData, clearRevealData, router]);

  const handleCompleteDone = useCallback(() => {
    setShowComplete(false);
    navigateToSummary();
  }, [navigateToSummary]);

  if (!revealData || currentBoard < 0) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>REVEALING...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const board = revealData.boards[currentBoard];
  if (!board) return null;

  const totalBoards = revealData.boardCount;
  const allCommunityCards = [...board.openCards, ...board.closedCards];
  const multiBot = board.allBotCards.length > 1;

  // Card sizing — large for full-screen display
  const communityCardH = Math.min(100, Math.floor((SCREEN_W - 60) / 5 / 0.7));
  const communityCardW = Math.round(communityCardH * 0.7);
  const playerCardH = Math.min(90, Math.floor((SCREEN_W - 60) / 4 / 0.7));
  const playerCardW = Math.round(playerCardH * 0.7);

  const chipText = board.winner === 'player'
    ? `+${board.potAmount}`
    : board.winner === 'bot'
    ? `-${board.potAmount}`
    : '\u00b10';
  const chipColor = board.winner === 'player'
    ? COLORS.neonGreen
    : board.winner === 'bot'
    ? COLORS.neonRed
    : COLORS.textSecondary;

  return (
    <SafeAreaView style={styles.container}>
      <Animated.View style={styles.content} entering={FadeIn.duration(300)}>
        {/* Title */}
        <Text style={styles.title}>
          BOARD {currentBoard + 1} OF {totalBoards}
        </Text>

        {/* Winner badge + chips */}
        <View style={styles.resultRow}>
          <Badge
            label={board.winner === 'player' ? 'WIN' : board.winner === 'bot' ? 'LOSS' : 'TIE'}
            variant={board.winner === 'player' ? 'win' : board.winner === 'bot' ? 'lose' : 'tie'}
          />
          <AnimatedChipResult text={chipText} color={chipColor} />
        </View>

        {/* Community cards */}
        <Text style={styles.sectionLabel}>COMMUNITY</Text>
        <View style={styles.cardRow}>
          {board.openCards.map((c) => (
            <CardComponent
              key={c.id}
              card={c}
              faceDown={false}
              cardWidth={communityCardW}
              cardHeight={communityCardH}
              highlighted={board.boardHighlightIds.includes(c.id)}
              dimmed={!board.boardHighlightIds.includes(c.id) && board.boardHighlightIds.length > 0}
            />
          ))}
          <View style={styles.communitySeparator} />
          {board.closedCards.map((c) => (
            <CardComponent
              key={c.id}
              card={c}
              faceDown={false}
              cardWidth={communityCardW}
              cardHeight={communityCardH}
              highlighted={board.boardHighlightIds.includes(c.id)}
              dimmed={!board.boardHighlightIds.includes(c.id) && board.boardHighlightIds.length > 0}
              flipDuration={revealData.turnRevealDelay}
            />
          ))}
        </View>

        {/* Player cards */}
        <Text style={styles.sectionLabel}>YOUR CARDS</Text>
        <View style={styles.cardRow}>
          {board.playerCards.map((c) => (
            <CardComponent
              key={c.id}
              card={c}
              faceDown={false}
              cardWidth={playerCardW}
              cardHeight={playerCardH}
              highlighted={board.playerHighlightIds.includes(c.id)}
              dimmed={!board.playerHighlightIds.includes(c.id) && board.playerHighlightIds.length > 0}
            />
          ))}
          <Text style={[styles.handName, board.winner === 'player' && styles.handNameWinner]}>
            {board.playerHandName}
          </Text>
        </View>

        {/* Bot cards — one section per bot */}
        {board.allBotCards.map((botCards, botIdx) =>
          botCards.length > 0 ? (
            <View key={`bot-${botIdx}`}>
              <Text style={styles.sectionLabel}>
                {multiBot ? `BOT ${botIdx + 1}` : 'BOT'}
              </Text>
              <View style={styles.cardRow}>
                {botCards.map((c) => (
                  <CardComponent
                    key={c.id}
                    card={c}
                    faceDown={false}
                    cardWidth={playerCardW}
                    cardHeight={playerCardH}
                    highlighted={botIdx === 0 && board.botHighlightIds.includes(c.id)}
                    dimmed={botIdx === 0 && !board.botHighlightIds.includes(c.id) && board.botHighlightIds.length > 0}
                  />
                ))}
                <Text style={[styles.handName, board.winner === 'bot' && styles.handNameWinner]}>
                  {board.allBotHandNames[botIdx] || board.botHandName}
                </Text>
              </View>
            </View>
          ) : null
        )}

        {/* Spacer */}
        <View style={{ flex: 1 }} />

        {/* Progress bar */}
        <View style={styles.progressBar}>
          {Array.from({ length: totalBoards }).map((_, i) => (
            <View
              key={i}
              style={[
                styles.progressDot,
                i <= currentBoard && styles.progressDotActive,
                i === currentBoard && styles.progressDotCurrent,
              ]}
            >
              <Text style={[
                styles.progressText,
                i <= currentBoard && styles.progressTextActive,
              ]}>
                {i + 1}
              </Text>
            </View>
          ))}
        </View>
      </Animated.View>

      {/* Complete overlay */}
      {showComplete && revealData.completeWinner && (
        <CompleteOverlay
          winner={revealData.completeWinner}
          bonusAmount={revealData.completeBonusAmount}
          duration={revealData.completeBonusDisplay}
          onDone={handleCompleteDone}
        />
      )}
    </SafeAreaView>
  );
}

/** Animated chip result with scale-pop entrance */
function AnimatedChipResult({ text, color }: { text: string; color: string }) {
  const scale = useSharedValue(0);

  useEffect(() => {
    scale.value = withDelay(200, withSpring(1, { damping: 8, stiffness: 120 }));
  }, [text]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.Text style={[styles.chipResult, { color }, animStyle]}>
      {text}
    </Animated.Text>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 8,
    alignItems: 'center',
    ...Platform.select({
      web: { maxWidth: 540, alignSelf: 'center' as const, width: '100%' },
      default: {},
    }),
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: COLORS.gold,
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: 6,
  },
  title: {
    fontSize: 28,
    fontWeight: '900',
    color: COLORS.gold,
    letterSpacing: 4,
    marginBottom: 12,
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 20,
  },
  chipResult: {
    fontSize: 32,
    fontWeight: '900',
  },
  sectionLabel: {
    color: COLORS.textDim,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 2,
    marginBottom: 4,
    alignSelf: 'flex-start',
    marginLeft: 4,
  },
  cardRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 3,
    marginBottom: 12,
  },
  communitySeparator: {
    width: 8,
  },
  handName: {
    color: COLORS.textMuted,
    fontSize: 11,
    fontWeight: '600',
    marginLeft: 8,
  },
  handNameWinner: {
    color: COLORS.goldLight,
    fontWeight: '800',
  },
  progressBar: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    paddingVertical: 16,
  },
  progressDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.surface,
    borderWidth: 1.5,
    borderColor: COLORS.boardBorder,
    justifyContent: 'center',
    alignItems: 'center',
  },
  progressDotActive: {
    backgroundColor: COLORS.surfaceRaised,
    borderColor: COLORS.gold,
  },
  progressDotCurrent: {
    borderColor: COLORS.neonBlue,
    borderWidth: 2,
    ...Platform.select({
      ios: {
        shadowColor: COLORS.neonBlue,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.6,
        shadowRadius: 8,
      },
      android: { elevation: 6 },
      default: {},
    }),
  },
  progressText: {
    color: COLORS.textDim,
    fontSize: 12,
    fontWeight: '700',
  },
  progressTextActive: {
    color: COLORS.gold,
  },
});
