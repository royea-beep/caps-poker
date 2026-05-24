/**
 * WeeklyRecapModal — Infographic-style weekly stats card.
 * Shown on Sundays (once per week via AsyncStorage gate).
 * RN Animated only — ZERO Reanimated.
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Modal,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { COLORS } from '../constants/gameConfig';
import { rf, rs, rv } from '../utils/responsive';
import { getSupabase } from '../utils/supabase';
import { getDeviceId } from '../utils/leaderboard';

// ─── Theme ────────────────────────────────────────────────────────────────────
const BG      = '#1a0e06';
const ACCENT  = '#c96a1a';
const BORDER  = '#3d2a1a';
const TEXT    = '#f5e6d3';
const OVERLAY = 'rgba(0,0,0,0.82)';
const GREEN   = '#22c55e';
const RED     = '#ef4444';
const SURFACE = '#231208';
const MUTED   = '#78716c';

// ─── Types ────────────────────────────────────────────────────────────────────
interface RecapData {
  hands: number;
  wins: number;
  win_rate: number;
  chips_earned: number;
  chips_lost: number;
  chips_net: number;
  sessions: number;
  biggest_pot: number;
  level: number;
  xp: number;
}

export interface WeeklyRecapModalProps {
  visible: boolean;
  onDismiss: () => void;
}

// ─── ISO week helper ──────────────────────────────────────────────────────────
function getCurrentISOWeek(): string {
  const now = new Date();
  const year = now.getFullYear();
  const week = Math.ceil(
    ((now.getTime() - new Date(year, 0, 1).getTime()) / 86400000 + 1) / 7
  );
  return `${year}_W${week}`;
}

/** Monday of the week containing date */
function weekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay(); // 0=Sun ... 6=Sat
  const diff = (day === 0 ? -6 : 1) - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Format date as "Mon Apr 7" */
function fmtDate(d: Date): string {
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

// ─── Stat cell ────────────────────────────────────────────────────────────────
function StatCell({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statCell}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

// ─── XP progress bar ─────────────────────────────────────────────────────────
function XPProgressBar({ xp }: { xp: number }) {
  const XP_PER_LEVEL = 1000;
  const pct = Math.min((xp % XP_PER_LEVEL) / XP_PER_LEVEL, 1);
  const widthAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(widthAnim, {
      toValue: pct,
      duration: 900,
      delay: 300,
      useNativeDriver: false,
    }).start();
  }, [pct]);

  return (
    <View style={styles.xpBarContainer}>
      <View style={styles.xpBarTrack}>
        <Animated.View
          style={[
            styles.xpBarFill,
            {
              width: widthAnim.interpolate({
                inputRange: [0, 1],
                outputRange: ['0%', '100%'],
              }),
            },
          ]}
        />
      </View>
      <Text style={styles.xpLabel}>
        {xp % XP_PER_LEVEL} / {XP_PER_LEVEL} XP
      </Text>
    </View>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
function WeeklyRecapModalImpl({ visible, onDismiss }: WeeklyRecapModalProps) {
  const scale   = useRef(new Animated.Value(0.85)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  const [recap,   setRecap]   = useState<RecapData | null>(null);
  const [loading, setLoading] = useState(true);

  // -- Animate in and fetch on open --
  useEffect(() => {
    if (!visible) return;

    // Reset
    scale.setValue(0.85);
    opacity.setValue(0);
    setLoading(true);
    setRecap(null);

    // Animate in
    Animated.parallel([
      Animated.spring(scale, {
        toValue: 1,
        tension: 70,
        friction: 8,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 220,
        useNativeDriver: true,
      }),
    ]).start();

    // Fetch recap data
    void (async () => {
      try {
        const sb = getSupabase();
        if (!sb) { setLoading(false); return; }
        const deviceId = await getDeviceId();
        const { data, error } = await sb.rpc('generate_weekly_recap', { user_id: deviceId });
        if (!error && data) setRecap(data as RecapData);
      } catch {
        // leave recap null -- will show empty state
      } finally {
        setLoading(false);
      }
    })();
  }, [visible]);

  // -- Dismiss: store week key then notify parent --
  const handleDismiss = () => {
    AsyncStorage.setItem('recap_week', getCurrentISOWeek()).catch(() => {});
    onDismiss();
  };

  // -- Share --
  const handleShare = () => {
    if (!recap) return;
    const sign = recap.chips_net >= 0 ? '+' : '';
    Share.share({
      message: `This week at the poker table: ${recap.hands} hands, ${recap.wins} wins, ${sign}${(recap.chips_net ?? 0).toLocaleString()} chips 🃏`,
    }).catch(() => {});
  };

  // -- Week label --
  const mon = weekStart(new Date());
  const sun = new Date(mon);
  sun.setDate(sun.getDate() + 6);
  const weekLabel = `${fmtDate(mon)} – ${fmtDate(sun)}`;

  // -- Net chips colour --
  const netColor = recap && recap.chips_net >= 0 ? GREEN : RED;
  const netSign  = recap && recap.chips_net >= 0 ? '+' : '';

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={handleDismiss}
    >
      <SafeAreaView style={styles.safeArea}>
        <Pressable style={styles.backdrop} onPress={handleDismiss} />

        <Animated.View style={[styles.card, { opacity, transform: [{ scale }] }]}>
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            bounces={false}
          >
            {/* Header */}
            <Text style={styles.headerTitle}>📅 Weekly Recap</Text>
            <Text style={styles.headerDates}>{weekLabel}</Text>

            {loading ? (
              <View style={styles.loadingBox}>
                <Text style={styles.loadingText}>Loading your stats…</Text>
              </View>
            ) : recap ? (
              <>
                {/* Big net number */}
                <View style={styles.netBox}>
                  <Text style={[styles.netNumber, { color: netColor }]}>
                    {netSign}{(recap.chips_net ?? 0).toLocaleString()}
                  </Text>
                  <Text style={styles.netLabel}>chips this week</Text>
                </View>

                {/* Divider */}
                <View style={styles.divider} />

                {/* Stats grid 2x3 */}
                <View style={styles.statsGrid}>
                  <StatCell label="Hands Played"  value={(recap.hands ?? 0).toLocaleString()} />
                  <StatCell label="Wins"           value={(recap.wins ?? 0).toLocaleString()} />
                  <StatCell label="Win Rate"       value={`${(recap.win_rate ?? 0).toFixed(1)}%`} />
                  <StatCell label="Sessions"       value={(recap.sessions ?? 0).toLocaleString()} />
                  <StatCell label="Biggest Pot"    value={(recap.biggest_pot ?? 0).toLocaleString()} />
                  <StatCell label="Level"          value={`${recap.level}`} />
                </View>

                {/* Divider */}
                <View style={styles.divider} />

                {/* XP progress */}
                <Text style={styles.xpTitle}>XP Progress</Text>
                <XPProgressBar xp={recap.xp} />

                {/* Share button */}
                <Pressable style={styles.shareBtn} onPress={handleShare}>
                  <Text style={styles.shareBtnText}>🃏 Share My Week</Text>
                </Pressable>
              </>
            ) : (
              <View style={styles.loadingBox}>
                <Text style={styles.loadingText}>No data yet — play some hands first!</Text>
              </View>
            )}

            {/* Dismiss link */}
            <Pressable onPress={handleDismiss} hitSlop={12} style={styles.dismissLink}>
              <Text style={styles.dismissText}>See you next week 👋</Text>
            </Pressable>
          </ScrollView>
        </Animated.View>
      </SafeAreaView>
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: OVERLAY,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject as any,
  },
  card: {
    backgroundColor: BG,
    borderWidth: 1.5,
    borderColor: BORDER,
    borderRadius: rv(18),
    width: '88%' as any,
    maxHeight: '85%' as any,
    shadowColor: ACCENT,
    shadowOpacity: 0.3,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 0 },
    elevation: 14,
    overflow: 'hidden',
  },
  scrollContent: {
    padding: rs(24),
    alignItems: 'center',
    gap: rs(16),
  },
  headerTitle: {
    color: ACCENT,
    fontSize: rf(20),
    fontWeight: '900',
    letterSpacing: 1.2,
    textAlign: 'center',
  },
  headerDates: {
    color: MUTED,
    fontSize: rf(12),
    fontWeight: '500',
    textAlign: 'center',
    marginTop: rs(-8),
  },
  loadingBox: {
    paddingVertical: rs(32),
    alignItems: 'center',
  },
  loadingText: {
    color: MUTED,
    fontSize: rf(14),
    fontWeight: '500',
    textAlign: 'center',
  },
  netBox: {
    alignItems: 'center',
    gap: rs(4),
  },
  netNumber: {
    fontSize: rf(44),
    fontWeight: '900',
    letterSpacing: -1,
    includeFontPadding: false,
  },
  netLabel: {
    color: MUTED,
    fontSize: rf(13),
    fontWeight: '500',
    letterSpacing: 0.3,
  },
  divider: {
    height: 1,
    width: '100%' as any,
    backgroundColor: BORDER,
  },
  statsGrid: {
    width: '100%' as any,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: rs(1),
    backgroundColor: BORDER,
    borderRadius: rv(10),
    overflow: 'hidden',
  },
  statCell: {
    width: '33.333%' as any,
    backgroundColor: SURFACE,
    alignItems: 'center',
    paddingVertical: rs(14),
    paddingHorizontal: rs(4),
  },
  statValue: {
    color: TEXT,
    fontSize: rf(18),
    fontWeight: '800',
    includeFontPadding: false,
  },
  statLabel: {
    color: MUTED,
    fontSize: rf(10),
    fontWeight: '500',
    textAlign: 'center',
    marginTop: rs(2),
    letterSpacing: 0.2,
  },
  xpTitle: {
    color: TEXT,
    fontSize: rf(13),
    fontWeight: '700',
    alignSelf: 'flex-start' as any,
    letterSpacing: 0.4,
  },
  xpBarContainer: {
    width: '100%' as any,
    gap: rs(6),
    marginTop: rs(-8),
  },
  xpBarTrack: {
    height: rs(8),
    backgroundColor: BORDER,
    borderRadius: rv(4),
    overflow: 'hidden',
  },
  xpBarFill: {
    height: '100%' as any,
    backgroundColor: ACCENT,
    borderRadius: rv(4),
  },
  xpLabel: {
    color: MUTED,
    fontSize: rf(11),
    fontWeight: '500',
    textAlign: 'right' as any,
  },
  shareBtn: {
    backgroundColor: ACCENT,
    borderRadius: rv(12),
    paddingVertical: rs(14),
    width: '100%' as any,
    alignItems: 'center',
    shadowColor: ACCENT,
    shadowOpacity: 0.4,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  shareBtnText: {
    color: BG,
    fontSize: rf(15),
    fontWeight: '900',
    letterSpacing: 0.6,
  },
  dismissLink: {
    paddingVertical: rs(6),
    paddingHorizontal: rs(16),
  },
  dismissText: {
    color: MUTED,
    fontSize: rf(13),
    fontWeight: '500',
    textDecorationLine: 'underline',
    textAlign: 'center',
  },
});

// PR (sim CI guards): when EXPO_PUBLIC_CAPS_CI === '1' we render a tiny shim
// that fires onDismiss immediately and renders nothing. Keeps Rules-of-Hooks
// clean - the real Impl is never mounted in CI mode.
function WeeklyRecapModalCISkip({ visible, onDismiss }: WeeklyRecapModalProps) {
  useEffect(() => { if (visible) onDismiss(); }, [visible]);
  return null;
}
const CAPS_CI_MODE = process.env.EXPO_PUBLIC_CAPS_CI === '1';
export function WeeklyRecapModal(props: WeeklyRecapModalProps) {
  if (CAPS_CI_MODE) return <WeeklyRecapModalCISkip {...props} />;
  return <WeeklyRecapModalImpl {...props} />;
}
