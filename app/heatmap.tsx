/**
 * HeatmapScreen — VAMOS 20
 * Personal activity dashboard: most-tapped screens, favorite times, daily activity.
 * Reads from heatmap_events table by device_id. ZERO Reanimated — RN Animated only.
 */
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Pressable } from 'react-native';

import { COLORS } from '../constants/gameConfig';
import { rf, rs, rv } from '../utils/responsive';
import { getSupabase } from '../utils/supabase';
import { getDeviceId } from '../utils/leaderboard';

void COLORS;

// ─── Constants ───────────────────────────────────────────────
const BG     = '#1a0e06';
const ACCENT = '#c96a1a';
const BORDER = '#3d2a1a';
const TEXT   = '#f5e6d3';

// Friendly screen name map
const SCREEN_LABELS: Record<string, string> = {
  home:          'Home',
  game:          'Game',
  achievements:  'Achievements',
  missions:      'Missions',
  sit_and_go:    'Sit & Go',
  referral:      'Invite Friends',
  leaderboard:   'Leaderboard',
  settings:      'Settings',
  shop:          'Shop',
  stats:         'Stats',
  play_of_day:   'Play of the Day',
};

function screenLabel(s: string) {
  return SCREEN_LABELS[s] ?? s;
}

// ─── Types ────────────────────────────────────────────────────
interface HeatmapRow {
  screen: string;
  element: string;
  tap_count: number;
  date: string;
}

interface ScreenStat {
  screen: string;
  totalTaps: number;
}

interface DailyStat {
  date: string;
  totalTaps: number;
}

// ─── Bar component ────────────────────────────────────────────
function HeatBar({ label, value, max, color = ACCENT }: {
  label: string; value: number; max: number; color?: string;
}) {
  const pct = max > 0 ? Math.max(4, Math.round((value / max) * 100)) : 4;
  return (
    <View style={barStyles.row}>
      <Text style={barStyles.label} numberOfLines={1}>{label}</Text>
      <View style={barStyles.track}>
        <View style={[barStyles.fill, { width: `${pct}%` as any, backgroundColor: color }]} />
      </View>
      <Text style={barStyles.val}>{value}</Text>
    </View>
  );
}

const barStyles = StyleSheet.create({
  row: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    marginBottom: rv(8),
    gap: rs(6),
  },
  label: {
    color: TEXT,
    fontSize: rf(13),
    width: rs(90),
    textAlign: 'left',
    writingDirection: 'ltr',
  } as any,
  track: {
    flex: 1,
    height: rs(10),
    backgroundColor: '#2a1a0a',
    borderRadius: rs(5),
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: rs(5),
  },
  val: {
    color: '#888',
    fontSize: rf(12),
    width: rs(28),
    textAlign: 'left',
  },
});

// ─── Section card wrapper ─────────────────────────────────────
function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={cardStyles.card}>
      <Text style={cardStyles.title}>{title}</Text>
      {children}
    </View>
  );
}

const cardStyles = StyleSheet.create({
  card: {
    backgroundColor: '#110a04',
    borderRadius: rs(16),
    borderWidth: 1,
    borderColor: BORDER,
    padding: rs(16),
    marginBottom: rs(14),
  },
  title: {
    color: ACCENT,
    fontSize: rf(15),
    fontWeight: '700',
    textAlign: 'left',
    writingDirection: 'ltr',
    marginBottom: rv(12),
  } as any,
});

// ─── Main screen ─────────────────────────────────────────────
export default function HeatmapScreen() {
  const router = useRouter();

  const [loading, setLoading]           = useState(true);
  const [screenStats, setScreenStats]   = useState<ScreenStat[]>([]);
  const [dailyStats, setDailyStats]     = useState<DailyStat[]>([]);
  const [topElement, setTopElement]     = useState<string | null>(null);
  const [totalTaps, setTotalTaps]       = useState(0);
  const [activeDays, setActiveDays]     = useState(0);

  useEffect(() => {
    void (async () => {
      try {
        const deviceId = await getDeviceId();
        const sb = getSupabase();
        if (!sb) return;

        // Fetch last 30 days of events for this device
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const since = thirtyDaysAgo.toISOString().split('T')[0];

        const { data } = await sb
          .from('heatmap_events')
          .select('screen, element, tap_count, date')
          .eq('device_id', deviceId)
          .gte('date', since)
          .order('date', { ascending: false });

        if (!data || data.length === 0) {
          setLoading(false);
          return;
        }

        const rows = data as HeatmapRow[];

        // Screen totals
        const screenMap: Record<string, number> = {};
        for (const r of rows) {
          screenMap[r.screen] = (screenMap[r.screen] ?? 0) + (r.tap_count ?? 1);
        }
        const screenArr = Object.entries(screenMap)
          .map(([screen, totalTaps]) => ({ screen, totalTaps }))
          .sort((a, b) => b.totalTaps - a.totalTaps)
          .slice(0, 8);
        setScreenStats(screenArr);

        // Daily activity (last 14 days)
        const dayMap: Record<string, number> = {};
        for (const r of rows) {
          dayMap[r.date] = (dayMap[r.date] ?? 0) + (r.tap_count ?? 1);
        }
        const dayArr = Object.entries(dayMap)
          .map(([date, totalTaps]) => ({ date, totalTaps }))
          .sort((a, b) => a.date.localeCompare(b.date))
          .slice(-14);
        setDailyStats(dayArr);

        // Top element across all screens
        const elemMap: Record<string, number> = {};
        for (const r of rows) {
          const key = `${r.screen}:${r.element}`;
          elemMap[key] = (elemMap[key] ?? 0) + (r.tap_count ?? 1);
        }
        const topElem = Object.entries(elemMap).sort((a, b) => b[1] - a[1])[0];
        if (topElem) setTopElement(topElem[0]);

        const total = rows.reduce((s, r) => s + (r.tap_count ?? 1), 0);
        setTotalTaps(total);
        setActiveDays(Object.keys(dayMap).length);
      } catch {
        // silent
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const maxScreen = screenStats[0]?.totalTaps ?? 1;
  const maxDay    = Math.max(...dailyStats.map(d => d.totalTaps), 1);

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={8}>
          <Text style={styles.backArrow}>‹</Text>
        </Pressable>
        <Text style={styles.headerTitle}>My Activity Map</Text>
        <View style={styles.headerSpacer} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={ACCENT} size="large" />
          <Text style={styles.loadingText}>Loading data...</Text>
        </View>
      ) : totalTaps === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyEmoji}>📊</Text>
          <Text style={styles.emptyTitle}>No data yet</Text>
          <Text style={styles.emptySub}>Play a bit and come back to see your stats!</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
        >
          {/* Summary row */}
          <View style={styles.summaryRow}>
            <View style={styles.summaryBox}>
              <Text style={styles.summaryNum}>{(totalTaps ?? 0).toLocaleString()}</Text>
              <Text style={styles.summaryLabel}>Total taps</Text>
            </View>
            <View style={[styles.summaryBox, styles.summaryBorder]}>
              <Text style={styles.summaryNum}>{activeDays}</Text>
              <Text style={styles.summaryLabel}>Active days</Text>
            </View>
            <View style={[styles.summaryBox, styles.summaryBorder]}>
              <Text style={styles.summaryNum}>{screenStats.length}</Text>
              <Text style={styles.summaryLabel}>Different screens</Text>
            </View>
          </View>

          {/* Top element badge */}
          {topElement && (
            <View style={styles.topBadge}>
              <Text style={styles.topBadgeEmoji}>🔥</Text>
              <Text style={styles.topBadgeText}>
                Most active: {screenLabel(topElement.split(':')[0])}{' '}
                {topElement.split(':')[1] ? `› ${topElement.split(':')[1]}` : ''}
              </Text>
            </View>
          )}

          {/* Screen activity */}
          <SectionCard title="📱 Most popular screens">
            {screenStats.map(s => (
              <HeatBar
                key={s.screen}
                label={screenLabel(s.screen)}
                value={s.totalTaps}
                max={maxScreen}
              />
            ))}
          </SectionCard>

          {/* Daily activity heatmap (14-day bar chart) */}
          <SectionCard title="📅 Daily activity — last 14 days">
            <View style={styles.dayGrid}>
              {dailyStats.map(d => {
                const heightPct = Math.max(8, Math.round((d.totalTaps / maxDay) * 100));
                const dayLabel  = new Date(d.date).toLocaleDateString('en-US', { day: 'numeric', month: 'numeric' });
                return (
                  <View key={d.date} style={styles.dayCol}>
                    <View style={[styles.dayBar, { height: `${heightPct}%` as any }]} />
                    <Text style={styles.dayLabel} numberOfLines={1}>{dayLabel}</Text>
                  </View>
                );
              })}
            </View>
          </SectionCard>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

// ─── Styles ──────────────────────────────────────────────────
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: BG },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: rs(16),
    paddingVertical: rv(12),
  },
  backBtn: { minWidth: rs(44), minHeight: rs(44), justifyContent: 'center' },
  backArrow: { color: ACCENT, fontSize: rf(28), fontWeight: '700' },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    color: TEXT,
    fontSize: rf(18),
    fontWeight: '700',
    writingDirection: 'ltr',
  } as any,
  headerSpacer: { minWidth: rs(44) },
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: rs(16),
    paddingBottom: rv(40),
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: rs(10),
  },
  loadingText: { color: '#888', fontSize: rf(14), writingDirection: 'ltr' } as any,
  emptyEmoji: { fontSize: rf(52) },
  emptyTitle: { color: TEXT, fontSize: rf(18), fontWeight: '700', writingDirection: 'ltr' } as any,
  emptySub:   { color: '#888', fontSize: rf(14), writingDirection: 'ltr' } as any,
  // Summary
  summaryRow: {
    flexDirection: 'row',
    gap: rs(8),
    marginBottom: rs(14),
    marginTop: rv(8),
  },
  summaryBox: {
    flex: 1,
    backgroundColor: '#110a04',
    borderRadius: rs(12),
    borderWidth: 1,
    borderColor: BORDER,
    paddingVertical: rv(14),
    alignItems: 'center',
  },
  summaryBorder: { borderColor: 'rgba(201,106,26,0.35)' },
  summaryNum:    { color: ACCENT, fontSize: rf(22), fontWeight: '800' },
  summaryLabel:  { color: '#888', fontSize: rf(11), marginTop: rv(2), writingDirection: 'ltr' } as any,
  // Top badge
  topBadge: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: rs(8),
    backgroundColor: 'rgba(201,106,26,0.12)',
    borderRadius: rs(12),
    borderWidth: 1,
    borderColor: 'rgba(201,106,26,0.35)',
    padding: rs(12),
    marginBottom: rs(14),
  },
  topBadgeEmoji: { fontSize: rf(20) },
  topBadgeText:  {
    color: TEXT,
    fontSize: rf(13),
    flex: 1,
    textAlign: 'left',
    writingDirection: 'ltr',
  } as any,
  // Day chart
  dayGrid: {
    flexDirection: 'row',
    height: rs(80),
    alignItems: 'flex-end',
    gap: rs(3),
  },
  dayCol: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    height: '100%',
  },
  dayBar: {
    width: '70%',
    backgroundColor: ACCENT,
    borderRadius: rs(3),
    opacity: 0.85,
  },
  dayLabel: {
    color: '#555',
    fontSize: rf(8),
    marginTop: rv(2),
    writingDirection: 'ltr',
    textAlign: 'center',
  } as any,
});
