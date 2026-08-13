/**
 * coaching.tsx — Post-hand coaching screen.
 * Shows optimal vs actual allocation, hand names, and 2-3 insights.
 * ZERO Reanimated — RN Animated only for fade-in sections.
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Animated,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS } from '../constants/gameConfig';
import { rf, rs, rv } from '../utils/responsive';
import { getHand, getHandHistory, HandRecord } from '../utils/handHistory';
import { EmptyState } from '../components/EmptyState';
import { CoachingTipPreview } from '../components/EmptyStatePreviews';
import { ScreenHeader } from '../components/ScreenHeader';
import { computeOptimalAllocation, CoachingResult, BoardAllocation } from '../utils/coachingEngine';

const SUIT_SYMBOLS: Record<string, string> = {
  hearts: '\u2665',
  diamonds: '\u2666',
  clubs: '\u2663',
  spades: '\u2660',
};

function isRed(suit: string) {
  return suit === 'hearts' || suit === 'diamonds';
}

function MiniCard({ card }: { card: { rank: string; suit: string } }) {
  const red = isRed(card.suit);
  return (
    <View style={[miniCardStyles.card, red ? miniCardStyles.red : miniCardStyles.black]}>
      <Text style={[miniCardStyles.text, red ? miniCardStyles.redText : miniCardStyles.blackText]}>
        {card.rank}{SUIT_SYMBOLS[card.suit] ?? '?'}
      </Text>
    </View>
  );
}

const miniCardStyles = StyleSheet.create({
  card: {
    width: rs(28),
    height: rs(36),
    borderRadius: rv(3),
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: rs(1),
    borderWidth: 1,
  },
  red: { backgroundColor: '#fff', borderColor: '#E8192C' },
  black: { backgroundColor: '#fff', borderColor: '#222' },
  text: { fontSize: rf(10), fontWeight: '800' },
  redText: { color: '#E8192C' },
  blackText: { color: '#111' },
});

interface AllocationRowProps {
  label: string;
  allocation: BoardAllocation;
  isYours: boolean;
  isBetter: boolean;
}

function AllocationRow({ label, allocation, isYours, isBetter }: AllocationRowProps) {
  const rowColor = isYours ? COLORS.gold : isBetter ? '#28A745' : COLORS.textDim;
  return (
    <View style={allocStyles.row}>
      <Text style={[allocStyles.label, { color: rowColor }]}>{label}</Text>
      <View style={allocStyles.cards}>
        {allocation.playerCards.map((c, i) => (
          <MiniCard key={i} card={c} />
        ))}
      </View>
      <Text style={[allocStyles.handName, { color: rowColor }]}>{allocation.handName}</Text>
      {allocation.won && <Text style={allocStyles.winBadge}>WIN</Text>}
    </View>
  );
}

const allocStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: rs(4),
    gap: rs(6),
  },
  label: {
    fontSize: rf(10),
    fontWeight: '700',
    width: rs(44),
    letterSpacing: 0.5,
  },
  cards: {
    flexDirection: 'row',
    flex: 1,
  },
  handName: {
    fontSize: rf(10),
    fontWeight: '600',
    width: rs(70),
    textAlign: 'left',
  },
  winBadge: {
    fontSize: rf(9),
    fontWeight: '900',
    color: '#28A745',
    marginLeft: rs(4),
    letterSpacing: 1,
  },
});

function BoardCompare({ boardIndex, actual, optimal, label }: {
  boardIndex: number;
  actual: BoardAllocation;
  optimal: BoardAllocation;
  label: string;
}) {
  const isBetter = optimal.handRank > actual.handRank;
  const borderColor = isBetter ? '#28A745' : COLORS.border;
  return (
    <View style={[boardCmpStyles.container, { borderColor }]}>
      <Text style={boardCmpStyles.boardLabel}>{label}</Text>
      <AllocationRow label="YOURS" allocation={actual} isYours isBetter={false} />
      <View style={boardCmpStyles.divider} />
      <AllocationRow label="BEST" allocation={optimal} isYours={false} isBetter={isBetter} />
    </View>
  );
}

const boardCmpStyles = StyleSheet.create({
  container: {
    borderWidth: 1,
    borderRadius: rv(8),
    padding: rs(10),
    marginBottom: rs(8),
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  boardLabel: {
    fontSize: rf(11),
    fontWeight: '800',
    color: COLORS.textDim,
    letterSpacing: 1.5,
    marginBottom: rs(4),
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: rs(4),
  },
});

export default function CoachingScreen() {
  const { handId } = useLocalSearchParams<{ handId: string }>();
  const router = useRouter();

  const [hand, setHand] = useState<HandRecord | null>(null);
  const [handList, setHandList] = useState<HandRecord[]>([]);
  const [handIndex, setHandIndex] = useState(0);
  const [result, setResult] = useState<CoachingResult | null>(null);
  const [loading, setLoading] = useState(true);

  // Fade-in animations (RN Animated — ZERO Reanimated)
  const headerOpacity = useRef(new Animated.Value(0)).current;
  const scoreOpacity = useRef(new Animated.Value(0)).current;
  const boardsOpacity = useRef(new Animated.Value(0)).current;
  const insightsOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    async function load() {
      const history = await getHandHistory();
      setHandList(history);
      let target: HandRecord | null = null;
      let idx = 0;
      if (handId) {
        idx = history.findIndex((h) => h.id === handId);
        if (idx === -1) idx = 0;
        target = history[idx] ?? null;
      } else {
        target = history[0] ?? null;
      }
      setHandIndex(idx);
      setHand(target);
      if (target) {
        const coaching = computeOptimalAllocation(target);
        setResult(coaching);
      }
      setLoading(false);
    }
    load();
  }, [handId]);

  // Staggered fade-in after load
  useEffect(() => {
    if (loading || !result) return;
    const timers: ReturnType<typeof setTimeout>[] = [];
    timers.push(setTimeout(() => Animated.timing(headerOpacity, { toValue: 1, duration: 300, useNativeDriver: true }).start(), 0));
    timers.push(setTimeout(() => Animated.timing(scoreOpacity, { toValue: 1, duration: 300, useNativeDriver: true }).start(), 150));
    timers.push(setTimeout(() => Animated.timing(boardsOpacity, { toValue: 1, duration: 300, useNativeDriver: true }).start(), 300));
    timers.push(setTimeout(() => Animated.timing(insightsOpacity, { toValue: 1, duration: 300, useNativeDriver: true }).start(), 450));
    return () => timers.forEach(clearTimeout);
  }, [loading, result]);

  const goToHand = (newIdx: number) => {
    if (newIdx < 0 || newIdx >= handList.length) return;
    const newHand = handList[newIdx];
    setHandIndex(newIdx);
    setHand(newHand);
    setResult(computeOptimalAllocation(newHand));
    // Reset fade-ins
    headerOpacity.setValue(0);
    scoreOpacity.setValue(0);
    boardsOpacity.setValue(0);
    insightsOpacity.setValue(0);
    setTimeout(() => {
      Animated.timing(headerOpacity, { toValue: 1, duration: 200, useNativeDriver: true }).start();
      Animated.timing(scoreOpacity, { toValue: 1, duration: 200, useNativeDriver: true }).start();
      Animated.timing(boardsOpacity, { toValue: 1, duration: 200, useNativeDriver: true }).start();
      Animated.timing(insightsOpacity, { toValue: 1, duration: 200, useNativeDriver: true }).start();
    }, 50);
  };

  // DEAD-END FIX 2026-08-13. The loaded branch below already renders a ScreenHeader, but these
  // two early returns did not — and the empty branch is exactly what a tester sees when they
  // open /coaching cold, which is the only way most of them will ever reach it. The screen's
  // sole exit was the "Play Now" CTA, i.e. forward. On iOS that left no way back at all.
  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ScreenHeader title="Coaching" />
        <ActivityIndicator color={COLORS.gold} size="large" style={{ flex: 1 }} />
      </SafeAreaView>
    );
  }

  if (!hand || !result) {
    return (
      <SafeAreaView style={styles.container}>
        <ScreenHeader title="Coaching" />
        <EmptyState
          icon="💡"
          title="No coaching yet"
          subtitle="Play hands to get personalized tips"
          ctaLabel="Play Now"
          onCta={() => router.push('/game' as any)}
          preview={<CoachingTipPreview />}
        />
      </SafeAreaView>
    );
  }

  const handNumber = handList.length - handIndex;
  const actualChips = result.actualScore;
  const optimalChips = result.optimalScore;
  const improvement = result.improvement;

  const scoreSign = (n: number) => (n >= 0 ? '+' : '');
  const scoreColor = (n: number) => (n >= 0 ? COLORS.neonGreen : COLORS.neonRed);

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <Animated.View style={{ opacity: headerOpacity }}>
        <ScreenHeader title={`Hand #${handNumber}`} />
      </Animated.View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Score comparison */}
        <Animated.View style={[styles.scoreCard, { opacity: scoreOpacity }]}>
          <View style={styles.scoreRow}>
            <Text style={styles.scoreLabel}>Your score</Text>
            <Text style={[styles.scoreValue, { color: scoreColor(actualChips) }]}>
              {scoreSign(actualChips)}{actualChips}
            </Text>
          </View>
          <View style={styles.scoreRow}>
            <Text style={styles.scoreLabel}>Optimal score</Text>
            <Text style={[styles.scoreValue, { color: COLORS.neonGreen }]}>
              {scoreSign(optimalChips)}{optimalChips}
            </Text>
          </View>
          {!result.wasOptimal && (
            <View style={styles.scoreRow}>
              <Text style={styles.scoreLabel}>Missed</Text>
              <Text style={[styles.scoreValue, { color: COLORS.neonRed }]}>
                {scoreSign(improvement - Math.abs(improvement) * 2)}{improvement > 0 ? `+${improvement}` : String(improvement)}
              </Text>
            </View>
          )}
          {result.wasOptimal && (
            <View style={styles.optimalBadgeRow}>
              <Text style={styles.optimalBadge}>OPTIMAL PLAY</Text>
            </View>
          )}
        </Animated.View>

        {/* Board-by-board comparison */}
        <Animated.View style={{ opacity: boardsOpacity }}>
          <Text style={styles.sectionTitle}>BOARD BREAKDOWN</Text>
          {hand.boards.map((_, i) => (
            <BoardCompare
              key={i}
              boardIndex={i}
              actual={result.actualAllocations[i]}
              optimal={result.optimalAllocations[i]}
              label={`BOARD ${i + 1}`}
            />
          ))}
        </Animated.View>

        {/* Insights */}
        <Animated.View style={[styles.insightsCard, { opacity: insightsOpacity }]}>
          <Text style={styles.insightsTitle}>INSIGHTS</Text>
          {result.insights.map((tip, i) => (
            <View key={i} style={styles.insightRow}>
              <Text style={styles.insightBullet}>💡</Text>
              <Text style={styles.insightText}>{tip}</Text>
            </View>
          ))}
        </Animated.View>
      </ScrollView>

      {/* Navigation */}
      <View style={styles.nav}>
        <Pressable
          style={({ pressed }) => [styles.navBtn, handIndex >= handList.length - 1 && styles.navBtnDisabled, pressed && { opacity: 0.7, transform: [{ scale: 0.96 }] }]}
          onPress={() => goToHand(handIndex + 1)}
          disabled={handIndex >= handList.length - 1}
        >
          <Text style={[styles.navBtnText, handIndex >= handList.length - 1 && styles.navBtnTextDisabled]}>← PREV</Text>
        </Pressable>

        <Text style={styles.navPageText}>{handIndex + 1} / {handList.length}</Text>

        <Pressable
          style={({ pressed }) => [styles.navBtn, handIndex === 0 && styles.navBtnDisabled, pressed && { opacity: 0.7, transform: [{ scale: 0.96 }] }]}
          onPress={() => goToHand(handIndex - 1)}
          disabled={handIndex === 0}
        >
          <Text style={[styles.navBtnText, handIndex === 0 && styles.navBtnTextDisabled]}>NEXT →</Text>
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
  content: {
    padding: rs(16),
    paddingBottom: rs(24),
  },
  scoreCard: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: rv(12),
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: rs(14),
    marginBottom: rs(16),
  },
  scoreRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: rs(4),
  },
  scoreLabel: {
    color: COLORS.textDim,
    fontSize: rf(13),
    fontWeight: '600',
  },
  scoreValue: {
    fontSize: rf(20),
    fontWeight: '900',
    letterSpacing: 1,
  },
  optimalBadgeRow: {
    alignItems: 'center',
    marginTop: rs(6),
  },
  optimalBadge: {
    color: '#28A745',
    fontSize: rf(12),
    fontWeight: '900',
    letterSpacing: 2,
    borderWidth: 1,
    borderColor: '#28A745',
    paddingHorizontal: rs(12),
    paddingVertical: rs(4),
    borderRadius: rv(12),
  },
  sectionTitle: {
    color: COLORS.textDim,
    fontSize: rf(11),
    fontWeight: '800',
    letterSpacing: 2,
    marginBottom: rs(8),
  },
  insightsCard: {
    backgroundColor: 'rgba(255,215,0,0.07)',
    borderRadius: rv(12),
    borderWidth: 1,
    borderColor: 'rgba(255,215,0,0.3)',
    padding: rs(14),
    marginTop: rs(8),
  },
  insightsTitle: {
    color: COLORS.gold,
    fontSize: rf(11),
    fontWeight: '800',
    letterSpacing: 2,
    marginBottom: rs(8),
  },
  insightRow: {
    flexDirection: 'row',
    marginBottom: rs(8),
    gap: rs(6),
  },
  insightBullet: {
    fontSize: rf(13),
  },
  insightText: {
    flex: 1,
    color: COLORS.textPrimary,
    fontSize: rf(13),
    lineHeight: rf(19),
  },
  nav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: rs(16),
    paddingVertical: rs(12),
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  navBtn: {
    paddingHorizontal: rs(16),
    paddingVertical: rs(8),
    borderWidth: 1,
    borderColor: COLORS.gold,
    borderRadius: rv(8),
  },
  navBtnDisabled: {
    borderColor: COLORS.border,
    opacity: 0.4,
  },
  navBtnText: {
    color: COLORS.gold,
    fontSize: rf(13),
    fontWeight: '700',
  },
  navBtnTextDisabled: {
    color: COLORS.textDim,
  },
  navPageText: {
    color: COLORS.textDim,
    fontSize: rf(12),
    fontWeight: '600',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: rs(16),
  },
  errorText: {
    color: COLORS.textDim,
    fontSize: rf(16),
  },
  backBtn: {
    paddingHorizontal: rs(20),
    paddingVertical: rs(10),
    borderWidth: 1,
    borderColor: COLORS.gold,
    borderRadius: rv(8),
  },
  backBtnText: {
    color: COLORS.gold,
    fontSize: rf(14),
    fontWeight: '700',
  },
});
