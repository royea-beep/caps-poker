/**
 * Stats Dashboard — S63
 * All data from AsyncStorage via handHistory.ts → statsEngine.ts
 * ZERO Reanimated — RN Animated only for entrance, pure Views for chart
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { getHandHistory } from '../utils/handHistory';
import { computeStats, HAND_RANK_ORDER, PlayerStats } from '../utils/statsEngine';
import { COLORS } from '../constants/gameConfig';
import { rf, rs, rv } from '../utils/responsive';

// ─── Chip Line Chart (pure RN Views — no SVG library) ──────────────────────

function ChipChart({ data, chartW }: { data: number[]; chartW: number }) {
  const CHART_H = 100;
  const PAD = 8;
  const innerW = chartW - PAD * 2;

  if (data.length < 2) {
    return (
      <View style={[styles.chartContainer, { width: chartW, height: CHART_H }]}>
        <Text style={styles.emptyChartText}>Play more hands to see your trend</Text>
      </View>
    );
  }

  const minVal = Math.min(...data);
  const maxVal = Math.max(...data);
  const range = maxVal === minVal ? 1 : maxVal - minVal;
  const stepX = innerW / (data.length - 1);

  const normalize = (v: number) =>
    PAD + ((maxVal - v) / range) * (CHART_H - PAD * 2);

  const points = data.map((v, i) => ({
    x: PAD + i * stepX,
    y: normalize(v),
  }));

  const trending = data[data.length - 1] - data[0];
  const lineColor = trending >= 0 ? '#4CAF50' : '#F44336';

  // Segments between consecutive points
  const segments = points.slice(1).map((p, i) => {
    const p0 = points[i];
    const dx = p.x - p0.x;
    const dy = p.y - p0.y;
    const length = Math.sqrt(dx * dx + dy * dy);
    const angle = Math.atan2(dy, dx) * (180 / Math.PI);
    return {
      cx: p0.x + dx / 2,
      cy: p0.y + dy / 2,
      length,
      angle,
    };
  });

  // Zero line
  const zeroY = normalize(0);
  const showZero = zeroY > PAD && zeroY < CHART_H - PAD;

  return (
    <View style={[styles.chartContainer, { width: chartW, height: CHART_H }]}>
      {showZero && (
        <View
          style={{
            position: 'absolute',
            left: 0,
            top: zeroY,
            width: chartW,
            height: 1,
            backgroundColor: 'rgba(255,255,255,0.1)',
          }}
        />
      )}
      {segments.map((seg, i) => (
        <View
          key={i}
          style={{
            position: 'absolute',
            left: seg.cx - seg.length / 2,
            top: seg.cy - 1,
            width: seg.length,
            height: 2,
            backgroundColor: lineColor,
            transform: [{ rotate: `${seg.angle}deg` }],
          }}
        />
      ))}
      {points.map((p, i) => (
        <View
          key={i}
          style={{
            position: 'absolute',
            left: p.x - 3,
            top: p.y - 3,
            width: 6,
            height: 6,
            borderRadius: 3,
            backgroundColor: lineColor,
            opacity: i === points.length - 1 ? 1 : 0.6,
          }}
        />
      ))}
    </View>
  );
}

// ─── Progress Bar ──────────────────────────────────────────────────────────

function ProgressBar({ pct, color }: { pct: number; color: string }) {
  return (
    <View style={styles.progressTrack}>
      <View style={[styles.progressFill, { width: `${Math.min(pct, 100)}%`, backgroundColor: color }]} />
    </View>
  );
}

// ─── Stat Card ─────────────────────────────────────────────────────────────

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
      {sub ? <Text style={styles.statSub}>{sub}</Text> : null}
    </View>
  );
}

// ─── Main Screen ────────────────────────────────────────────────────────────

export default function StatsScreen() {
  const router = useRouter();
  const { width: screenW } = useWindowDimensions();
  const [stats, setStats] = useState<PlayerStats | null>(null);
  const [loading, setLoading] = useState(true);

  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    getHandHistory().then((hands) => {
      setStats(computeStats(hands));
      setLoading(false);
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }).start();
    });
  }, []);

  const chartW = Math.min(screenW - rs(32), 360);

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading stats…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!stats || stats.handsPlayed === 0) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backBtn}>
            <Text style={styles.backText}>← BACK</Text>
          </Pressable>
          <Text style={styles.title}>STATS</Text>
          <View style={styles.backBtn} />
        </View>
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyIcon}>📊</Text>
          <Text style={styles.emptyTitle}>No hands yet</Text>
          <Text style={styles.emptySubtitle}>Play a few hands to see your statistics</Text>
        </View>
      </SafeAreaView>
    );
  }

  const netColor = stats.netChipsAllTime >= 0 ? COLORS.goldLight : '#F44336';
  const winRateColor =
    stats.winRate >= 60 ? '#4CAF50' : stats.winRate >= 40 ? COLORS.gold : '#F44336';

  const streakText =
    stats.currentWinStreak > 0
      ? `${stats.currentWinStreak} win${stats.currentWinStreak > 1 ? 's' : ''} 🔥`
      : stats.currentLoseStreak > 0
      ? `${stats.currentLoseStreak} loss${stats.currentLoseStreak > 1 ? 'es' : ''} ❄️`
      : 'None';

  // Hand frequency — sorted by HAND_RANK_ORDER descending, only seen hands
  const seenHands = HAND_RANK_ORDER.filter((h) => (stats.handFrequency[h] ?? 0) > 0).reverse();
  const totalBoardsSeen = Object.values(stats.handFrequency).reduce((s, n) => s + n, 0);

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backBtn}>
          <Text style={styles.backText}>← BACK</Text>
        </Pressable>
        <Text style={styles.title}>STATS</Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View style={{ opacity: fadeAnim }}>

          {/* ── Section 1: Overview cards ───────────────────────────── */}
          <View style={styles.overviewGrid}>
            <StatCard
              label="HANDS"
              value={String(stats.handsPlayed)}
              sub={`${stats.handsWon}W ${stats.handsLost}L`}
            />
            <StatCard
              label="WIN RATE"
              value={`${stats.winRate}%`}
              sub={stats.winRate >= 50 ? '🔥 hot' : '❄️ cold'}
            />
            <StatCard
              label="NET 🟡"
              value={`${stats.netChipsAllTime >= 0 ? '+' : ''}${stats.netChipsAllTime}`}
              sub={`Best: +${stats.biggestWin}`}
            />
            <StatCard
              label="COMPLETE"
              value={`${stats.completeCount}×`}
              sub={`${stats.completeRate}% rate`}
            />
          </View>

          {/* ── Section 2: Chip performance chart ───────────────────── */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>CHIP PERFORMANCE</Text>
            <Text style={styles.sectionSubtitle}>Last {stats.cumulativeBalance.length} hands</Text>
            <View style={styles.chartWrapper}>
              <ChipChart data={stats.cumulativeBalance} chartW={chartW} />
              <View style={styles.chartLabels}>
                <Text style={[styles.chartLabelVal, { color: netColor }]}>
                  {stats.netChipsAllTime >= 0 ? '+' : ''}{stats.netChipsAllTime}
                </Text>
                <Text style={styles.chartLabelSmall}>all-time net</Text>
              </View>
            </View>
          </View>

          {/* ── Section 3: Board win rate breakdown ─────────────────── */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>BOARD WIN RATES</Text>
            {stats.boardWinRateByIndex.map((rate, i) => {
              if (stats.boardWinRateByIndex.slice(0, i + 1).every((_, j) => {
                const total = stats.handsPlayed;
                return j > 0 && rate === 0 && total > 0;
              }) && rate === 0 && i > 0) return null; // skip empty boards
              return (
                <View key={i} style={styles.boardRow}>
                  <Text style={styles.boardLabel}>Board {i + 1}</Text>
                  <View style={styles.boardBarArea}>
                    <ProgressBar
                      pct={rate}
                      color={rate >= 50 ? '#4CAF50' : rate >= 33 ? COLORS.gold : '#F44336'}
                    />
                  </View>
                  <Text style={[styles.boardPct, { color: rate >= 50 ? '#4CAF50' : rate >= 33 ? COLORS.gold : '#F44336' }]}>
                    {rate}%
                  </Text>
                </View>
              );
            })}
            <Text style={styles.boardSummary}>
              Overall: {stats.boardsWon}/{stats.boardsPlayed} boards won ({stats.boardWinRate}%)
            </Text>
          </View>

          {/* ── Section 4: Hand frequency ───────────────────────────── */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>HANDS MADE</Text>
            <Text style={styles.sectionSubtitle}>Best ever: {stats.bestHandEver}</Text>
            {seenHands.map((name) => {
              const count = stats.handFrequency[name] ?? 0;
              const pct = totalBoardsSeen > 0 ? Math.round((count / totalBoardsSeen) * 100) : 0;
              return (
                <View key={name} style={styles.handRow}>
                  <Text style={styles.handName}>{name}</Text>
                  <View style={styles.handBarArea}>
                    <ProgressBar pct={pct} color={COLORS.gold} />
                  </View>
                  <Text style={styles.handPct}>{pct}%</Text>
                  <Text style={styles.handCount}>{count}×</Text>
                </View>
              );
            })}
          </View>

          {/* ── Section 5: Streaks + recent form ────────────────────── */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>STREAKS &amp; FORM</Text>
            <View style={styles.streakRow}>
              <View style={styles.streakItem}>
                <Text style={styles.streakValue}>{streakText}</Text>
                <Text style={styles.streakLabel}>CURRENT STREAK</Text>
              </View>
              <View style={styles.streakItem}>
                <Text style={styles.streakValue}>{stats.bestWinStreak} wins</Text>
                <Text style={styles.streakLabel}>BEST STREAK</Text>
              </View>
            </View>
            <View style={styles.recentForm}>
              <Text style={styles.recentTitle}>LAST 10 HANDS</Text>
              <View style={styles.recentStats}>
                <Text style={[styles.recentWinRate, { color: winRateColor }]}>
                  {stats.last10WinRate}% win rate
                </Text>
                <Text style={[styles.recentChips, { color: stats.last10NetChips >= 0 ? COLORS.goldLight : '#F44336' }]}>
                  {stats.last10NetChips >= 0 ? '+' : ''}{stats.last10NetChips} 🟡
                </Text>
              </View>
            </View>
          </View>

          {/* Bottom spacer */}
          <View style={{ height: rs(32) }} />

        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: rs(16),
    paddingTop: rs(8),
    paddingBottom: rs(8),
  },
  backBtn: {
    minWidth: 60,
  },
  backText: {
    color: COLORS.gold,
    fontSize: rf(13),
    fontWeight: '700',
    letterSpacing: 1,
  },
  title: {
    color: COLORS.goldLight,
    fontSize: rf(20),
    fontWeight: '900',
    letterSpacing: 3,
    textAlign: 'center',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: rs(16),
    paddingTop: rs(4),
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: rf(14),
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: rs(12),
  },
  emptyIcon: {
    fontSize: rf(48),
  },
  emptyTitle: {
    color: COLORS.textPrimary,
    fontSize: rf(20),
    fontWeight: '700',
  },
  emptySubtitle: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: rf(13),
    textAlign: 'center',
  },
  // Overview grid
  overviewGrid: {
    flexDirection: 'row',
    gap: rs(8),
    marginBottom: rs(20),
  },
  statCard: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: rv(10),
    paddingVertical: rs(12),
    paddingHorizontal: rs(6),
    alignItems: 'center',
    gap: rs(2),
  },
  statValue: {
    color: COLORS.goldLight,
    fontSize: rf(18),
    fontWeight: '900',
    textAlign: 'center',
  },
  statLabel: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: rf(9),
    fontWeight: '700',
    letterSpacing: 1,
    textAlign: 'center',
  },
  statSub: {
    color: 'rgba(255,255,255,0.3)',
    fontSize: rf(9),
    textAlign: 'center',
  },
  // Sections
  section: {
    backgroundColor: COLORS.surface,
    borderRadius: rv(12),
    padding: rs(16),
    marginBottom: rs(12),
    gap: rs(10),
  },
  sectionTitle: {
    color: COLORS.goldLight,
    fontSize: rf(12),
    fontWeight: '800',
    letterSpacing: 2,
  },
  sectionSubtitle: {
    color: 'rgba(255,255,255,0.35)',
    fontSize: rf(10),
    marginTop: rs(-6),
  },
  // Chart
  chartWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: rs(12),
  },
  chartContainer: {
    position: 'relative',
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: rv(8),
    overflow: 'hidden',
  },
  chartLabels: {
    alignItems: 'flex-end',
    gap: rs(2),
  },
  chartLabelVal: {
    fontSize: rf(16),
    fontWeight: '900',
  },
  chartLabelSmall: {
    color: 'rgba(255,255,255,0.35)',
    fontSize: rf(9),
  },
  emptyChartText: {
    color: 'rgba(255,255,255,0.3)',
    fontSize: rf(11),
    textAlign: 'center',
    flex: 1,
    textAlignVertical: 'center',
    paddingTop: 40,
  },
  // Board win rates
  boardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: rs(8),
  },
  boardLabel: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: rf(11),
    fontWeight: '600',
    width: rs(52),
  },
  boardBarArea: {
    flex: 1,
  },
  boardPct: {
    fontSize: rf(12),
    fontWeight: '700',
    width: rs(38),
    textAlign: 'right',
  },
  boardSummary: {
    color: 'rgba(255,255,255,0.3)',
    fontSize: rf(10),
    textAlign: 'center',
    marginTop: rs(4),
  },
  progressTrack: {
    height: rs(8),
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: rv(4),
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: rv(4),
  },
  // Hand frequency
  handRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: rs(6),
  },
  handName: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: rf(10),
    width: rs(90),
  },
  handBarArea: {
    flex: 1,
  },
  handPct: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: rf(10),
    width: rs(30),
    textAlign: 'right',
  },
  handCount: {
    color: 'rgba(255,255,255,0.3)',
    fontSize: rf(10),
    width: rs(24),
    textAlign: 'right',
  },
  // Streaks
  streakRow: {
    flexDirection: 'row',
    gap: rs(12),
  },
  streakItem: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: rv(8),
    padding: rs(12),
    gap: rs(4),
    alignItems: 'center',
  },
  streakValue: {
    color: COLORS.textPrimary,
    fontSize: rf(14),
    fontWeight: '700',
    textAlign: 'center',
  },
  streakLabel: {
    color: 'rgba(255,255,255,0.35)',
    fontSize: rf(9),
    fontWeight: '700',
    letterSpacing: 1,
  },
  recentForm: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: rv(8),
    padding: rs(12),
    gap: rs(8),
  },
  recentTitle: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: rf(10),
    fontWeight: '700',
    letterSpacing: 1,
  },
  recentStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  recentWinRate: {
    fontSize: rf(16),
    fontWeight: '800',
  },
  recentChips: {
    fontSize: rf(16),
    fontWeight: '800',
  },
});
