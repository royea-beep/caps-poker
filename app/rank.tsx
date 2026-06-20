/**
 * Rank screen — S117
 * Shows ELO from leaderboard table, 5 tiers, tier progress bar, placement games.
 * RN Animated only — ZERO Reanimated.
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  Animated,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { EmptyState } from '../components/EmptyState';
import { RankLadderPreview } from '../components/EmptyStatePreviews';
import { ScreenHeader } from '../components/ScreenHeader';
import { COLORS } from '../constants/gameConfig';
import { rf, rs, rv } from '../utils/responsive';
import { getDeviceId } from '../utils/leaderboard';
import { getSupabase } from '../utils/supabase';

// ─── Tiers ────────────────────────────────────────────────────────────────────

const TIERS = [
  { name: 'Rookie',   min: 0,    max: 800,  icon: '🥉', color: '#CD7F32' },
  { name: 'Amateur',  min: 800,  max: 1200, icon: '⚪', color: '#9E9E9E' },
  { name: 'Pro',      min: 1200, max: 1600, icon: '🥈', color: '#C0C0C0' },
  { name: 'Elite',    min: 1600, max: 2000, icon: '🥇', color: '#FFD700' },
  { name: 'Champion', min: 2000, max: 9999, icon: '👑', color: '#c9a84c' },
];

function getCurrentTier(elo: number) {
  return TIERS.find(t => elo >= t.min && elo < t.max) ?? TIERS[0];
}

interface RankData {
  elo: number;
  gamesPlayed: number;
  wins: number;
  rankPosition: number;
  totalPlayers: number;
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function RankScreen() {
  const router = useRouter();
  const [data, setData] = useState<RankData | null>(null);
  const [loading, setLoading] = useState(true);
  const fadeAnim = React.useRef(new Animated.Value(0)).current;
  const barAnim = React.useRef(new Animated.Value(0)).current;

  const load = useCallback(async () => {
    try {
      const deviceId = await getDeviceId();
      const sb = getSupabase();
      if (!sb) { setLoading(false); return; }

      const { data: row } = await sb
        .from('leaderboard')
        .select('elo, games_played, wins, total_chips')
        .eq('device_id', deviceId)
        .maybeSingle();

      const { count } = await sb
        .from('leaderboard')
        .select('*', { count: 'exact', head: true })
        .gte('elo', row?.elo ?? 1000);

      const { count: total } = await sb
        .from('leaderboard')
        .select('*', { count: 'exact', head: true });

      if (row) {
        setData({
          elo: row.elo ?? 1000,
          gamesPlayed: row.games_played ?? 0,
          wins: row.wins ?? 0,
          rankPosition: count ?? 1,
          totalPlayers: total ?? 1,
        });
      }
    } catch {
      // silent fail
    } finally {
      setLoading(false);
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.timing(barAnim, { toValue: 1, duration: 700, useNativeDriver: false }),
      ]).start();
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const elo = data?.elo ?? 1000;
  const gamesPlayed = data?.gamesPlayed ?? 0;
  const tier = getCurrentTier(elo);
  const tierIdx = TIERS.indexOf(tier);
  const nextTier = tierIdx < TIERS.length - 1 ? TIERS[tierIdx + 1] : null;
  const tierProgress = nextTier
    ? (elo - tier.min) / (nextTier.min - tier.min)
    : 1;
  const placementNeeded = Math.max(0, 10 - gamesPlayed);
  const winRate = gamesPlayed > 0 ? Math.round((data?.wins ?? 0) / gamesPlayed * 100) : 0;

  const barWidth = barAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', `${Math.round(tierProgress * 100)}%`] as any,
  });

  const placementBarWidth = barAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', `${Math.min(100, gamesPlayed * 10)}%`] as any,
  });

  return (
    <SafeAreaView style={styles.container}>
      <ScreenHeader title="YOUR RANK" />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {loading ? (
          <View style={styles.loadingBox}>
            <Text style={styles.mutedText}>Loading...</Text>
          </View>
        ) : !data ? (
          <EmptyState
            icon="🏆"
            title="No rank yet"
            subtitle="Play a game to claim your spot on the ladder"
            ctaLabel="Play Now"
            onCta={() => router.push('/game' as any)}
            preview={<RankLadderPreview />}
          />
        ) : (
          <Animated.View style={{ opacity: fadeAnim, gap: rs(16) }}>
            {/* Main rank card */}
            <View style={[styles.rankCard, { borderColor: tier.color + '66' }]}>
              <Text style={styles.tierIcon}>{tier.icon}</Text>
              <Text style={[styles.tierName, { color: tier.color }]}>{tier.name}</Text>
              <Text style={styles.eloValue}>ELO: {elo}</Text>
              <Text style={styles.rankPosition}>
                Rank #{data.rankPosition} of {data.totalPlayers}
              </Text>

              {/* Tier progress bar */}
              {nextTier && (
                <View style={styles.progressSection}>
                  <View style={styles.progressLabels}>
                    <Text style={[styles.progressLabelTier, { color: tier.color }]}>{tier.name}</Text>
                    <Text style={[styles.progressLabelTier, { color: nextTier.color }]}>{nextTier.name}</Text>
                  </View>
                  <View style={styles.progressTrack}>
                    <Animated.View
                      style={[styles.progressFill, { width: barWidth, backgroundColor: tier.color }]}
                    />
                  </View>
                  <Text style={styles.progressHint}>
                    {nextTier.min - elo} ELO to {nextTier.name}
                  </Text>
                </View>
              )}
              {!nextTier && (
                <View style={styles.champBanner}>
                  <Text style={styles.champText}>👑 Maximum Rank Achieved!</Text>
                </View>
              )}
            </View>

            {/* Placement games notice */}
            {placementNeeded > 0 && (
              <View style={styles.placementCard}>
                <Text style={styles.placementTitle}>🎯 Placement Games</Text>
                <Text style={styles.placementDesc}>
                  Complete {placementNeeded} more game{placementNeeded !== 1 ? 's' : ''} to set your official rank!
                </Text>
                <View style={styles.progressTrack}>
                  <Animated.View
                    style={[styles.progressFill, { width: placementBarWidth, backgroundColor: COLORS.gold }]}
                  />
                </View>
                <Text style={styles.placementCount}>{gamesPlayed}/10 games</Text>
              </View>
            )}

            {/* Stats row */}
            <View style={styles.statsRow}>
              <View style={styles.statBox}>
                <Text style={styles.statValue}>{gamesPlayed}</Text>
                <Text style={styles.statLabel}>Games</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statBox}>
                <Text style={styles.statValue}>{data.wins}</Text>
                <Text style={styles.statLabel}>Wins</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statBox}>
                <Text style={[styles.statValue, { color: winRate >= 50 ? '#4CAF50' : COLORS.textSecondary }]}>
                  {winRate}%
                </Text>
                <Text style={styles.statLabel}>Win rate</Text>
              </View>
            </View>

            {/* All tiers ladder */}
            <View style={styles.tiersSection}>
              <Text style={styles.tiersTitle}>TIERS</Text>
              {TIERS.map((t) => {
                const isCurrentTier = t.name === tier.name;
                return (
                  <View
                    key={t.name}
                    style={[styles.tierRow, isCurrentTier && { backgroundColor: t.color + '18', borderColor: t.color }]}
                  >
                    <Text style={styles.tierRowIcon}>{t.icon}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.tierRowName, isCurrentTier && { color: t.color }]}>{t.name}</Text>
                      <Text style={styles.tierRowRange}>{t.min}–{t.max === 9999 ? '∞' : t.max} ELO</Text>
                    </View>
                    {isCurrentTier && (
                      <View style={[styles.currentBadge, { backgroundColor: t.color }]}>
                        <Text style={styles.currentBadgeText}>CURRENT</Text>
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          </Animated.View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    padding: rs(16),
    paddingBottom: rs(40),
    gap: rs(16),
  },
  loadingBox: {
    paddingTop: rs(80),
    alignItems: 'center',
  },
  mutedText: {
    color: COLORS.textMuted,
    fontSize: rf(15),
    textAlign: 'center',
  },
  rankCard: {
    backgroundColor: COLORS.feltLight,
    borderRadius: rv(16),
    borderWidth: 1,
    padding: rs(24),
    alignItems: 'center',
    gap: rs(6),
  },
  tierIcon: {
    fontSize: rf(48),
    lineHeight: rf(56),
  },
  tierName: {
    fontSize: rf(26),
    fontWeight: '900',
    letterSpacing: 3,
  },
  eloValue: {
    color: COLORS.goldBright,
    fontSize: rf(20),
    fontWeight: '800',
    letterSpacing: 1,
    marginTop: rs(4),
  },
  rankPosition: {
    color: COLORS.textSecondary,
    fontSize: rf(13),
    fontWeight: '600',
  },
  progressSection: {
    width: '100%',
    marginTop: rs(16),
    gap: rs(6),
  },
  progressLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  progressLabelTier: {
    fontSize: rf(11),
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  progressTrack: {
    height: rs(8),
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: rv(4),
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: rv(4),
  },
  progressHint: {
    color: COLORS.textMuted,
    fontSize: rf(11),
    textAlign: 'center',
  },
  champBanner: {
    marginTop: rs(12),
    backgroundColor: 'rgba(201,168,76,0.15)',
    borderRadius: rv(10),
    paddingHorizontal: rs(20),
    paddingVertical: rs(8),
  },
  champText: {
    color: COLORS.gold,
    fontSize: rf(14),
    fontWeight: '700',
  },
  placementCard: {
    backgroundColor: COLORS.feltLight,
    borderRadius: rv(12),
    borderWidth: 1,
    borderColor: COLORS.boardBorder,
    padding: rs(16),
    gap: rs(8),
  },
  placementTitle: {
    color: COLORS.gold,
    fontSize: rf(15),
    fontWeight: '800',
  },
  placementDesc: {
    color: COLORS.textSecondary,
    fontSize: rf(13),
    lineHeight: rf(18),
  },
  placementCount: {
    color: COLORS.textMuted,
    fontSize: rf(12),
    textAlign: 'left',
    fontWeight: '600',
  },
  statsRow: {
    flexDirection: 'row',
    backgroundColor: COLORS.feltLight,
    borderRadius: rv(12),
    borderWidth: 1,
    borderColor: COLORS.boardBorder,
    overflow: 'hidden',
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: rs(16),
    gap: rs(4),
  },
  statDivider: {
    width: 1,
    backgroundColor: COLORS.boardBorder,
    marginVertical: rs(12),
  },
  statValue: {
    color: COLORS.textPrimary,
    fontSize: rf(22),
    fontWeight: '900',
  },
  statLabel: {
    color: COLORS.textMuted,
    fontSize: rf(11),
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  tiersSection: {
    gap: rs(6),
  },
  tiersTitle: {
    color: COLORS.textSecondary,
    fontSize: rf(11),
    fontWeight: '700',
    letterSpacing: 2,
    marginBottom: rs(4),
  },
  tierRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: rs(12),
    backgroundColor: COLORS.feltLight,
    borderRadius: rv(10),
    borderWidth: 1,
    borderColor: COLORS.boardBorder,
    paddingHorizontal: rs(14),
    paddingVertical: rs(10),
  },
  tierRowIcon: {
    fontSize: rf(22),
    width: rs(28),
    textAlign: 'center',
  },
  tierRowName: {
    color: COLORS.textPrimary,
    fontSize: rf(14),
    fontWeight: '700',
  },
  tierRowRange: {
    color: COLORS.textMuted,
    fontSize: rf(11),
    marginTop: rs(2),
  },
  currentBadge: {
    borderRadius: rv(6),
    paddingHorizontal: rs(8),
    paddingVertical: rs(3),
  },
  currentBadgeText: {
    color: '#1a1a2e',
    fontSize: rf(9),
    fontWeight: '900',
    letterSpacing: 0.5,
  },
});
