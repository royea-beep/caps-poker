/**
 * replay.tsx — card-by-card hand replay screen.
 * ZERO Reanimated — iron rule: results/replay screens = no Reanimated.
 */
import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS } from '../constants/gameConfig';
import { rf, rs, rv } from '../utils/responsive';
import { getHand, HandRecord, HandBoardRecord } from '../utils/handHistory';

const SUIT_SYMBOLS: Record<string, string> = {
  hearts: '\u2665',
  diamonds: '\u2666',
  clubs: '\u2663',
  spades: '\u2660',
};

function isRed(suit: string) {
  return suit === 'hearts' || suit === 'diamonds';
}

function CardChip({ card }: { card: { rank: string; suit: string } }) {
  const red = isRed(card.suit);
  return (
    <View style={[styles.cardChip, red && styles.cardChipRed]}>
      <Text style={[styles.cardChipText, red && styles.cardChipTextRed]}>
        {card.rank}{SUIT_SYMBOLS[card.suit] ?? '?'}
      </Text>
    </View>
  );
}

function CardRow({ label, cards, highlight }: { label: string; cards: { rank: string; suit: string }[]; highlight?: boolean }) {
  return (
    <View style={styles.cardRow}>
      <Text style={[styles.cardRowLabel, highlight && { color: COLORS.gold }]}>{label}</Text>
      <View style={styles.cardRowCards}>
        {cards.map((c, i) => <CardChip key={i} card={c} />)}
      </View>
    </View>
  );
}

function BoardView({ board, boardNumber, totalBoards }: { board: HandBoardRecord; boardNumber: number; totalBoards: number }) {
  const winColor = board.winner === 'player' ? COLORS.neonGreen : board.winner === 'bot' ? COLORS.neonRed : COLORS.textDim;
  const winLabel = board.winner === 'player' ? 'WIN' : board.winner === 'bot' ? 'LOSS' : 'TIE';

  return (
    <View style={styles.boardContainer}>
      {/* Board header */}
      <View style={styles.boardHeader}>
        <Text style={styles.boardLabel}>BOARD {boardNumber} / {totalBoards}</Text>
        <View style={[styles.resultBadge, { borderColor: winColor }]}>
          <Text style={[styles.resultBadgeText, { color: winColor }]}>{winLabel}</Text>
        </View>
      </View>

      {/* Community cards */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>COMMUNITY</Text>
        <View style={styles.communityCards}>
          {board.communityCards.map((c, i) => <CardChip key={i} card={c} />)}
        </View>
      </View>

      {/* Bot hand */}
      {board.botCards.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>BOT</Text>
          <CardRow
            label={board.botHandName || '—'}
            cards={board.botCards}
            highlight={board.winner === 'bot'}
          />
        </View>
      )}

      {/* Player hand */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>YOU</Text>
        <CardRow
          label={board.playerHandName || '—'}
          cards={board.playerCards}
          highlight={board.winner === 'player'}
        />
      </View>
    </View>
  );
}

function SummaryView({ hand, onCoach }: { hand: HandRecord; onCoach: () => void }) {
  const isWin = hand.netChips >= 0;
  const playerWins = hand.boards.filter((b) => b.winner === 'player').length;
  const botWins = hand.boards.filter((b) => b.winner === 'bot').length;

  return (
    <View style={styles.summaryContainer}>
      <Text style={styles.summaryTitle}>HAND COMPLETE</Text>

      <View style={styles.scoreRow}>
        <Text style={[styles.scoreBig, { color: COLORS.neonGreen }]}>{playerWins}</Text>
        <Text style={styles.scoreDash}> — </Text>
        <Text style={[styles.scoreBig, { color: COLORS.neonRed }]}>{botWins}</Text>
      </View>

      <Text style={[styles.netChips, { color: isWin ? COLORS.neonGreen : COLORS.neonRed }]}>
        {isWin ? '+' : ''}{hand.netChips} chips
      </Text>

      {hand.isComplete && hand.completeBonusAmount > 0 && (
        <Text style={styles.bonusText}>🏆 WIN ALL +{hand.completeBonusAmount} bonus</Text>
      )}

      <Pressable style={styles.coachingBtn} onPress={onCoach}>
        <Text style={styles.coachingBtnText}>💡 COACHING</Text>
      </Pressable>
    </View>
  );
}

export default function ReplayScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [hand, setHand] = useState<HandRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [boardIndex, setBoardIndex] = useState(0);

  useEffect(() => {
    if (!id) { setLoading(false); return; }
    getHand(id).then((h) => {
      setHand(h);
      setLoading(false);
    });
  }, [id]);

  const totalBoards = hand?.boards.length ?? 0;
  const isOnSummary = boardIndex >= totalBoards;

  const goPrev = useCallback(() => {
    setBoardIndex((prev) => Math.max(0, prev - 1));
  }, []);

  const goNext = useCallback(() => {
    setBoardIndex((prev) => Math.min(totalBoards, prev + 1)); // totalBoards = summary
  }, [totalBoards]);

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator color={COLORS.gold} size="large" style={{ flex: 1 }} />
      </SafeAreaView>
    );
  }

  if (!hand) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Hand not found</Text>
          <Pressable style={styles.backBtn} onPress={() => router.back()}>
            <Text style={styles.backBtnText}>← BACK</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={8} style={styles.headerBack}>
          <Text style={styles.headerBackText}>← HISTORY</Text>
        </Pressable>
        <Text style={styles.headerTitle}>REPLAY</Text>
        <View style={styles.headerRight} />
      </View>

      {/* Progress dots */}
      <View style={styles.dots}>
        {hand.boards.map((_, i) => (
          <View
            key={i}
            style={[
              styles.dot,
              i === boardIndex && styles.dotActive,
              i < boardIndex && styles.dotDone,
            ]}
          />
        ))}
        {/* Summary dot */}
        <View style={[styles.dot, styles.dotSummary, isOnSummary && styles.dotActive]} />
      </View>

      {/* Content */}
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {isOnSummary ? (
          <SummaryView hand={hand} onCoach={() => router.push(`/coaching?handId=${hand.id}`)} />
        ) : (
          <BoardView
            board={hand.boards[boardIndex]}
            boardNumber={boardIndex + 1}
            totalBoards={totalBoards}
          />
        )}
      </ScrollView>

      {/* Navigation */}
      <View style={styles.nav}>
        <Pressable
          style={[styles.navBtn, boardIndex === 0 && styles.navBtnDisabled]}
          onPress={goPrev}
          disabled={boardIndex === 0}
        >
          <Text style={[styles.navBtnText, boardIndex === 0 && styles.navBtnTextDisabled]}>← PREV</Text>
        </Pressable>

        <Text style={styles.navPageText}>
          {isOnSummary ? 'SUMMARY' : `${boardIndex + 1} / ${totalBoards}`}
        </Text>

        <Pressable
          style={[styles.navBtn, isOnSummary && styles.navBtnDisabled]}
          onPress={goNext}
          disabled={isOnSummary}
        >
          <Text style={[styles.navBtnText, isOnSummary && styles.navBtnTextDisabled]}>
            {boardIndex === totalBoards - 1 ? 'SUMMARY →' : 'NEXT →'}
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: rs(16),
    paddingVertical: rs(10),
    borderBottomWidth: 1,
    borderBottomColor: COLORS.boardBorder,
  },
  headerBack: {
    flex: 1,
  },
  headerBackText: {
    fontSize: rf(13),
    fontWeight: '700',
    color: COLORS.gold,
    letterSpacing: 0.5,
  },
  headerTitle: {
    fontSize: rf(16),
    fontWeight: '900',
    color: COLORS.textPrimary,
    letterSpacing: 4,
  },
  headerRight: {
    flex: 1,
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: rs(6),
    paddingVertical: rs(10),
  },
  dot: {
    width: rs(8),
    height: rs(8),
    borderRadius: rv(4),
    backgroundColor: COLORS.textDim,
    opacity: 0.35,
  },
  dotActive: {
    backgroundColor: COLORS.gold,
    opacity: 1,
    transform: [{ scale: 1.3 }],
  },
  dotDone: {
    backgroundColor: COLORS.neonGreen,
    opacity: 0.7,
  },
  dotSummary: {
    borderRadius: rv(3),
    width: rs(10),
  },
  content: {
    padding: rs(16),
    paddingBottom: rs(24),
  },
  boardContainer: {
    gap: rs(16),
  },
  boardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  boardLabel: {
    fontSize: rf(12),
    fontWeight: '800',
    color: COLORS.textMuted,
    letterSpacing: 2,
  },
  resultBadge: {
    borderWidth: 1.5,
    borderRadius: rv(6),
    paddingHorizontal: rs(10),
    paddingVertical: rs(3),
  },
  resultBadgeText: {
    fontSize: rf(12),
    fontWeight: '900',
    letterSpacing: 1,
  },
  section: {
    gap: rs(8),
    backgroundColor: COLORS.surface,
    borderRadius: rv(10),
    padding: rs(12),
    borderWidth: 1,
    borderColor: COLORS.boardBorder,
  },
  sectionTitle: {
    fontSize: rf(10),
    fontWeight: '800',
    color: COLORS.textMuted,
    letterSpacing: 2,
  },
  communityCards: {
    flexDirection: 'row',
    gap: rs(6),
    flexWrap: 'wrap',
  },
  cardRow: {
    gap: rs(6),
  },
  cardRowLabel: {
    fontSize: rf(11),
    fontWeight: '600',
    color: COLORS.textDim,
  },
  cardRowCards: {
    flexDirection: 'row',
    gap: rs(6),
    flexWrap: 'wrap',
  },
  cardChip: {
    backgroundColor: '#f0dfc0',
    borderRadius: rv(6),
    paddingHorizontal: rs(8),
    paddingVertical: rs(4),
    minWidth: rs(36),
    alignItems: 'center',
  },
  cardChipRed: {
    backgroundColor: '#f5e0e0',
  },
  cardChipText: {
    fontSize: rf(14),
    fontWeight: '800',
    color: '#1a1a1a',
  },
  cardChipTextRed: {
    color: '#c0392b',
  },
  // Summary
  summaryContainer: {
    alignItems: 'center',
    paddingTop: rs(24),
    gap: rs(12),
  },
  summaryTitle: {
    fontSize: rf(20),
    fontWeight: '900',
    color: COLORS.gold,
    letterSpacing: 4,
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  scoreBig: {
    fontSize: rf(48),
    fontWeight: '900',
  },
  scoreDash: {
    fontSize: rf(24),
    color: COLORS.textDim,
    fontWeight: '600',
  },
  netChips: {
    fontSize: rf(22),
    fontWeight: '900',
  },
  bonusText: {
    fontSize: rf(15),
    fontWeight: '700',
    color: COLORS.gold,
    letterSpacing: 1,
  },
  coachingBtn: {
    marginTop: rs(16),
    paddingVertical: rs(10),
    paddingHorizontal: rs(28),
    borderWidth: 1,
    borderColor: COLORS.gold,
    borderRadius: rv(16),
    backgroundColor: 'rgba(255,215,0,0.08)',
    alignSelf: 'center',
  },
  coachingBtnText: {
    color: COLORS.gold,
    fontSize: rf(14),
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  // Nav
  nav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: rs(16),
    paddingVertical: rs(14),
    borderTopWidth: 1,
    borderTopColor: COLORS.boardBorder,
  },
  navBtn: {
    paddingHorizontal: rs(14),
    paddingVertical: rs(10),
    backgroundColor: 'rgba(201,168,76,0.1)',
    borderRadius: rv(8),
    borderWidth: 1,
    borderColor: 'rgba(201,168,76,0.35)',
  },
  navBtnDisabled: {
    opacity: 0.3,
  },
  navBtnText: {
    fontSize: rf(13),
    fontWeight: '800',
    color: COLORS.gold,
    letterSpacing: 0.5,
  },
  navBtnTextDisabled: {
    color: COLORS.textDim,
  },
  navPageText: {
    fontSize: rf(12),
    fontWeight: '700',
    color: COLORS.textMuted,
    letterSpacing: 1,
  },
  // Error
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: rs(16),
  },
  errorText: {
    fontSize: rf(16),
    color: COLORS.textMuted,
    fontWeight: '600',
  },
  backBtn: {
    paddingHorizontal: rs(20),
    paddingVertical: rs(10),
    backgroundColor: 'rgba(201,168,76,0.1)',
    borderRadius: rv(8),
    borderWidth: 1,
    borderColor: 'rgba(201,168,76,0.35)',
  },
  backBtnText: {
    fontSize: rf(13),
    fontWeight: '800',
    color: COLORS.gold,
  },
});
