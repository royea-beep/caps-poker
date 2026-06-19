/**
 * Daily Missions screen — CAPS Poker
 * Shows 3 daily missions with progress bars and claim buttons.
 * RN Animated only — ZERO Reanimated.
 * Countdown to midnight UTC+2 (Israel time).
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { COLORS } from '../constants/gameConfig';
import { rf, rs, rv } from '../utils/responsive';
import { getSupabase } from '../utils/supabase';
import { getDeviceId } from '../utils/leaderboard';

// Suppress unused-import lint warning — COLORS used by pattern convention
void COLORS;

// ─── Palette ─────────────────────────────────────────────────────────────────
const BG       = '#1a0e06';
const SURFACE  = '#221408';
const BORDER   = '#3d2a1a';
const ACCENT   = '#c96a1a';
const TEXT_PRI = '#f5e6d3';
const TEXT_SEC = '#a08060';
const GOLD     = '#c9a84c';

const DIFF_COLORS: Record<string, string> = {
  easy:   '#27ae60',
  normal: '#3498db',
  hard:   '#9b59b6',
};

// ─── Types ───────────────────────────────────────────────────────────────────
interface Mission {
  id: string;
  title: string;
  description: string;
  difficulty: 'easy' | 'normal' | 'hard';
  progress: number;
  target: number;
  chips_reward: number;
  xp_reward: number;
  is_complete: boolean;
}

// VAMOS-HEBREW-SWEEP-FULL 2026-06-19 — server `get_daily_missions_d` RPC returns
// Hebrew title/description for legacy reasons. Override client-side by mission
// id so the rendered text is English even while the server data stays as-is.
// Keys match the mission ids in stores/battlePassStore.ts DAILY_MISSION_POOL +
// WEEKLY_MISSION_POOL.
const MISSION_EN: Record<string, { title: string; description: string }> = {
  play_3:           { title: 'Play 3 games',        description: 'Play 3 games today' },
  win_5_boards:     { title: 'Win 5 boards',        description: 'Win 5 boards today' },
  win_flush:        { title: 'Win with a Flush',    description: 'Win a board with a Flush hand' },
  play_online:     { title: 'Play an online game',  description: 'Play one online (multiplayer) game' },
  win_hard:         { title: 'Beat Hard bot',       description: 'Beat a bot on Hard difficulty' },
  complete_boards:  { title: 'Win all boards',      description: 'Win every board in a single game' },
  play_5:           { title: 'Play 5 games',        description: 'Play 5 games today' },
  win_3_row:        { title: 'Win 3 in a row',      description: 'Win 3 games consecutively' },
  win_15:           { title: 'Win 15 games',        description: 'Win 15 games this week' },
  play_25:          { title: 'Play 25 games',       description: 'Play 25 games this week' },
};

function localizeMission(m: Mission): Mission {
  const override = MISSION_EN[m.id];
  return override ? { ...m, title: override.title, description: override.description } : m;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Seconds until midnight UTC+2 (Israel Standard Time) */
function secondsUntilMidnightUTC2(): number {
  const now = new Date();
  const utc2Ms = now.getTime() + 2 * 3600 * 1000;
  const utc2 = new Date(utc2Ms);
  const h = utc2.getUTCHours();
  const m = utc2.getUTCMinutes();
  const s = utc2.getUTCSeconds();
  return 86400 - (h * 3600 + m * 60 + s);
}

function formatCountdown(totalSeconds: number): string {
  const secs = Math.max(0, totalSeconds);
  const hh = Math.floor(secs / 3600);
  const mm = Math.floor((secs % 3600) / 60);
  const ss = secs % 60;
  return (
    String(hh).padStart(2, '0') + ':' +
    String(mm).padStart(2, '0') + ':' +
    String(ss).padStart(2, '0')
  );
}

// ─── Toast ───────────────────────────────────────────────────────────────────
function Toast({ message, visible }: { message: string; visible: boolean }) {
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.delay(1600),
        Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }),
      ]).start();
    } else {
      opacity.setValue(0);
    }
  }, [visible, message]);

  return (
    <Animated.View style={[styles.toast, { opacity }]} pointerEvents="none">
      <Text style={styles.toastText}>{message}</Text>
    </Animated.View>
  );
}

// ─── Progress Bar ────────────────────────────────────────────────────────────
function ProgressBar({
  progress,
  target,
  color,
}: {
  progress: number;
  target: number;
  color: string;
}) {
  const pct = target > 0 ? Math.min(1, progress / target) : 0;
  // Cast to satisfy RN DimensionValue which accepts `${number}%` strings
  const widthPct = (Math.round(pct * 100) + '%') as `${number}%`;
  return (
    <View style={styles.progressTrack}>
      <View style={[styles.progressFill, { width: widthPct, backgroundColor: color }]} />
    </View>
  );
}

// ─── Mission Card ────────────────────────────────────────────────────────────
interface MissionCardProps {
  mission: Mission;
  onClaim: (id: string) => void;
  claiming: boolean;
}

function MissionCard({ mission, onClaim, claiming }: MissionCardProps) {
  const diffColor = DIFF_COLORS[mission.difficulty] ?? ACCENT;
  const canClaim  = mission.progress >= mission.target && !mission.is_complete;

  return (
    <View style={[styles.card, mission.is_complete && styles.cardComplete]}>

      {/* Difficulty pill — top-right */}
      <View style={[styles.diffPill, { backgroundColor: diffColor + '33', borderColor: diffColor }]}>
        <Text style={[styles.diffPillText, { color: diffColor }]}>
          {({ easy: 'EASY', normal: 'NORMAL', hard: 'HARD' }[mission.difficulty] ?? mission.difficulty.toUpperCase())}
        </Text>
      </View>

      {/* Title + description */}
      <Text style={styles.missionTitle}>{mission.title}</Text>
      <Text style={styles.missionDesc}>{mission.description}</Text>

      {/* Progress bar + counter */}
      <View style={styles.progressRow}>
        <ProgressBar progress={mission.progress} target={mission.target} color={diffColor} />
        <Text style={styles.progressLabel}>
          {mission.progress}/{mission.target}
        </Text>
      </View>

      {/* Rewards row + action */}
      <View style={styles.rewardsRow}>
        <View style={styles.rewardBadge}>
          <Text style={styles.rewardIcon}>💰</Text>
          <Text style={styles.rewardValue}>{(mission.chips_reward ?? 0).toLocaleString()}</Text>
          <Text style={styles.rewardUnit}> chips</Text>
        </View>
        <View style={styles.rewardBadge}>
          <Text style={styles.rewardIcon}>⚡</Text>
          <Text style={styles.rewardValue}>{mission.xp_reward}</Text>
          <Text style={styles.rewardUnit}> XP</Text>
        </View>

        {canClaim && (
          <Pressable
            onPress={() => onClaim(mission.id)}
            disabled={claiming}
            style={({ pressed }) => [
              styles.claimBtn,
              (pressed || claiming) && styles.claimBtnPressed,
            ]}
          >
            <Text style={styles.claimBtnText}>
              {claiming ? 'Loading...' : 'Claim'}
            </Text>
          </Pressable>
        )}

        {mission.is_complete && (
          <View style={styles.completedBadge}>
            <Text style={styles.completedBadgeText}>✓ Claimed</Text>
          </View>
        )}
      </View>
    </View>
  );
}

// ─── Main Screen ─────────────────────────────────────────────────────────────
export default function MissionsScreen() {
  const router = useRouter();

  const [missions,   setMissions]   = useState<Mission[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [claimingId, setClaimingId] = useState<string | null>(null);
  const [toastMsg,   setToastMsg]   = useState('');
  const [toastVis,   setToastVis]   = useState(false);
  const [countdown,  setCountdown]  = useState(secondsUntilMidnightUTC2());

  // Live countdown ticker
  useEffect(() => {
    const id = setInterval(() => {
      setCountdown(secondsUntilMidnightUTC2());
    }, 1000);
    return () => clearInterval(id);
  }, []);

  // Load missions on mount
  const loadMissions = useCallback(async () => {
    setLoading(true);
    try {
      const userId = await getDeviceId();
      const sb = getSupabase();
      if (!sb) { setLoading(false); return; }

      // assign_daily_missions_d is idempotent — safe to call every mount (uses text device_id)
      await sb.rpc('assign_daily_missions_d', { p_device_id: userId });

      const { data, error } = await sb.rpc('get_daily_missions_d', { p_device_id: userId });
      if (!error && Array.isArray(data)) {
        setMissions((data as Mission[]).map(localizeMission));
      }
    } catch {
      // silently fail — empty state shown
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMissions();
  }, [loadMissions]);

  // Claim a completed mission
  const handleClaim = useCallback(async (missionId: string) => {
    if (claimingId) return;
    setClaimingId(missionId);
    try {
      const userId = await getDeviceId();
      const sb = getSupabase();
      if (!sb) return;

      const { data, error } = await sb.rpc('claim_mission_d', {
        p_device_id: userId,
        p_mission_id: missionId,
      });

      if (!error && (data as { ok?: boolean } | null)?.ok) {
        const typed = data as { ok: boolean; chips?: number; xp?: number };
        const chips: number = typed.chips ?? 0;
        // Optimistically mark claimed
        setMissions((prev) =>
          prev.map((m) => (m.id === missionId ? { ...m, is_complete: true } : m)),
        );
        setToastMsg('+' + (chips ?? 0).toLocaleString() + ' chips!');
        setToastVis(true);
        setTimeout(() => setToastVis(false), 2200);
      }
    } catch {
      // silently fail
    } finally {
      setClaimingId(null);
    }
  }, [claimingId]);

  const allComplete = missions.length > 0 && missions.every((m) => m.is_complete);

  return (
    <SafeAreaView style={styles.safeArea}>

      {/* Header */}
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [styles.backButton, pressed && styles.backButtonPressed]}
          hitSlop={8}
        >
          <Text style={styles.backArrow}>{'→'}</Text>
          <Text style={styles.backLabel}>Back</Text>
        </Pressable>

        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Daily Missions</Text>
          <Text style={styles.headerCountdown}>Resets in {formatCountdown(countdown)}</Text>
        </View>

        {/* Spacer mirrors back-button so title stays centred */}
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {loading && (
          <View style={styles.centeredRow}>
            <Text style={styles.mutedText}>Loading missions...</Text>
          </View>
        )}

        {!loading && missions.length === 0 && (
          <View style={styles.centeredRow}>
            <Text style={styles.mutedText}>No missions available right now.</Text>
          </View>
        )}

        {!loading &&
          missions.map((mission) => (
            <MissionCard
              key={mission.id}
              mission={mission}
              onClaim={handleClaim}
              claiming={claimingId === mission.id}
            />
          ))}

        {/* All-complete banner */}
        {allComplete && (
          <View style={styles.allCompleteBanner}>
            <Text style={styles.allCompleteIcon}>★</Text>
            <Text style={styles.allCompleteText}>All missions completed!</Text>
            <Text style={styles.allCompleteSubtext}>
              Come back tomorrow for new missions.
            </Text>
          </View>
        )}

        <View style={styles.bottomPad} />
      </ScrollView>

      <Toast message={toastMsg} visible={toastVis} />
    </SafeAreaView>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: BG,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: rs(16),
    paddingVertical: rv(12),
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: rs(4),
    minWidth: rs(70),
  },
  backButtonPressed: { opacity: 0.5 },
  backArrow: {
    color: TEXT_PRI,
    fontSize: rf(20),
  },
  backLabel: {
    color: TEXT_PRI,
    fontSize: rf(14),
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    color: TEXT_PRI,
    fontSize: rf(18),
    fontWeight: '700',
  },
  headerCountdown: {
    color: TEXT_SEC,
    fontSize: rf(12),
    marginTop: rv(2),
  },
  headerSpacer: { minWidth: rs(70) },
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: rs(16),
    paddingTop: rv(16),
  },
  bottomPad: { height: rv(32) },
  centeredRow: {
    paddingVertical: rv(48),
    alignItems: 'center',
  },
  mutedText: {
    color: TEXT_SEC,
    fontSize: rf(14),
  },
  card: {
    backgroundColor: SURFACE,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: rs(12),
    padding: rs(16),
    marginBottom: rv(12),
  },
  cardComplete: { opacity: 0.75 },
  diffPill: {
    position: 'absolute',
    top: rs(12),
    right: rs(12),
    paddingHorizontal: rs(8),
    paddingVertical: rv(3),
    borderRadius: rs(20),
    borderWidth: 1,
  },
  diffPillText: {
    fontSize: rf(10),
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  missionTitle: {
    color: TEXT_PRI,
    fontSize: rf(15),
    fontWeight: '700',
    marginBottom: rv(4),
    paddingRight: rs(72),
  },
  missionDesc: {
    color: TEXT_SEC,
    fontSize: rf(13),
    lineHeight: rf(18),
    marginBottom: rv(10),
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: rs(8),
    marginBottom: rv(10),
  },
  progressTrack: {
    flex: 1,
    height: rv(6),
    backgroundColor: BORDER,
    borderRadius: rv(3),
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: rv(3),
  },
  progressLabel: {
    color: TEXT_SEC,
    fontSize: rf(11),
    minWidth: rs(40),
    textAlign: 'right',
  },
  rewardsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: rs(8),
    flexWrap: 'wrap',
  },
  rewardBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#3d2a1a80',
    paddingHorizontal: rs(8),
    paddingVertical: rv(4),
    borderRadius: rs(6),
  },
  rewardIcon: { fontSize: rf(12) },
  rewardValue: {
    color: TEXT_PRI,
    fontSize: rf(12),
    fontWeight: '700',
    marginLeft: rs(2),
  },
  rewardUnit: {
    color: TEXT_SEC,
    fontSize: rf(11),
  },
  claimBtn: {
    marginLeft: 'auto',
    backgroundColor: ACCENT,
    paddingHorizontal: rs(16),
    paddingVertical: rv(7),
    borderRadius: rs(8),
  },
  claimBtnPressed: { opacity: 0.7 },
  claimBtnText: {
    color: '#fff',
    fontSize: rf(13),
    fontWeight: '700',
  },
  completedBadge: {
    marginLeft: 'auto',
    backgroundColor: '#27ae6033',
    borderWidth: 1,
    borderColor: '#27ae60',
    paddingHorizontal: rs(10),
    paddingVertical: rv(5),
    borderRadius: rs(8),
  },
  completedBadgeText: {
    color: '#27ae60',
    fontSize: rf(12),
    fontWeight: '600',
  },
  allCompleteBanner: {
    backgroundColor: '#c9a84c1a',
    borderWidth: 1,
    borderColor: GOLD,
    borderRadius: rs(12),
    padding: rs(20),
    alignItems: 'center',
    marginTop: rv(8),
  },
  allCompleteIcon: {
    fontSize: rf(36),
    marginBottom: rv(6),
    color: GOLD,
  },
  allCompleteText: {
    color: GOLD,
    fontSize: rf(16),
    fontWeight: '700',
  },
  allCompleteSubtext: {
    color: TEXT_SEC,
    fontSize: rf(13),
    marginTop: rv(4),
  },
  toast: {
    position: 'absolute',
    bottom: rv(80),
    alignSelf: 'center',
    backgroundColor: ACCENT,
    paddingHorizontal: rs(20),
    paddingVertical: rv(10),
    borderRadius: rs(24),
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
  },
  toastText: {
    color: '#fff',
    fontSize: rf(14),
    fontWeight: '700',
  },
});
