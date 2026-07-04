/**
 * Public Multiplayer Lobby — VAMOS-CAPS-LOBBY-V2-CLIENT (TASK A + B).
 *
 * Browses the PERSISTENT public pool (list_public_tables): 2 hostless tables per
 * type (2P/3P/4P) = 6 slots, always rendered. Tapping JOIN claims a seat via
 * join_table — the FIRST joiner of a hostless table becomes the host (is_host:true)
 * and the others are guests; the table fills → auto-starts → the pool replenishes.
 * Host/guest is decided by join_table's response, NOT by who "created" the table.
 *
 * No invite-code field and no create button live here — that is the PRIVATE friends
 * lobby (app/lobby/private). This screen also offers the solo fallback ("Play vs Bots")
 * so a player with no one to play never hits a dead end.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator, RefreshControl, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useGameStore } from '../../store/gameStore';
import { getSupabase } from '../../utils/supabase';
import { getBoardCount } from '../../constants/gameConfig';
import { ECONOMY_FLAGS } from '../../constants/economyConfig';
import { getMatchCost, canAffordMatch } from '../../utils/economy';
import { rf, rs, rv } from '../../utils/responsive';
import { track } from '../../utils/analytics';
import { getDeviceId } from '../../utils/leaderboard';
import { listPublicTables, joinTable, groupTablesByType, OpenTable, PlayerCount } from '../../utils/lobbyApi';
import { useLobbyPresence } from '../../hooks/useLobbyPresence';

const TYPES: { n: PlayerCount; label: string; boards: number }[] = [
  { n: 2, label: 'Heads-Up', boards: 4 },
  { n: 3, label: '3-Player', boards: 3 },
  { n: 4, label: '4-Player', boards: 2 },
];

const TABLES_PER_TYPE = 2;
const POLL_MS = 5000;

/** A rendered slot: a real public table, or a placeholder while the pool replenishes. */
type Slot = { key: string; table: OpenTable | null };

export default function PublicLobby() {
  const router = useRouter();
  const playerName = useGameStore((s) => s.playerName);
  const config = useGameStore((s) => s.config);
  const chips = useGameStore((s) => s.chips);

  const [tables, setTables] = useState<OpenTable[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);
  // VAMOS-UNIFY-FINAL 2026-06-28 — visible join error. Alert.alert is a silent
  // no-op on web, so a failed join used to leave the user with zero feedback
  // (the bug we saw in 2-client verify: first click silently failed because
  // deviceIdRef hadn't populated yet; second click worked).
  const [joinError, setJoinError] = useState<string | null>(null);
  const userIdRef = useRef<string | null>(null);
  const deviceIdRef = useRef<string | null>(null);
  const [refsReady, setRefsReady] = useState(false);
  // Item 3 — real-time liveness so the lobby never looks like a graveyard. Counts live
  // humans currently on the lobby via Supabase presence (always ≥1 once synced — you count).
  const onlineCount = useLobbyPresence();

  const load = useCallback(async () => {
    const rows = await listPublicTables();
    setTables(rows);
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    track('lobby_opened', { table_kind: 'public' }, 'lobby');
    // Track readiness of both async refs so Join can't fire before they settle.
    let gotUser = false, gotDevice = false;
    const settle = () => { if (gotUser && gotDevice) setRefsReady(true); };
    getSupabase()?.auth.getUser().then(({ data }) => { userIdRef.current = data?.user?.id ?? null; gotUser = true; settle(); }).catch(() => { gotUser = true; settle(); });
    getDeviceId().then((d) => { deviceIdRef.current = d; gotDevice = true; settle(); }).catch(() => { gotDevice = true; settle(); });
    void load();
    const id = setInterval(() => { void load(); }, POLL_MS);
    return () => { clearInterval(id); };
  }, [load]);

  // Hand off to the Table Room — it owns the realtime session and the DB seat from here.
  const enterTableRoom = useCallback((roomCode: string, n: PlayerCount, asHost: boolean) => {
    router.push({
      pathname: '/lobby/table',
      params: { roomCode, playerCount: String(n), isHost: asHost ? 'true' : 'false' },
    } as any);
  }, [router]);

  const playSolo = useCallback(() => {
    if (busy) return;
    if (ECONOMY_FLAGS.matchCostEnabled) {
      const cost = getMatchCost(config.potPerBoard, getBoardCount(config.numberOfPlayers));
      if (!canAffordMatch(chips, cost)) {
        Alert.alert('Not Enough Chips', `You need ${cost} chips to play.`);
        return;
      }
    }
    track('solo_fallback_tapped', { player_count: config.numberOfPlayers }, 'lobby');
    track('mode_start', { mode: 'single_player', player_count: config.numberOfPlayers }, 'lobby');
    router.push('/game' as any);
  }, [busy, config, chips, router]);

  const handleJoin = useCallback(async (tbl: OpenTable) => {
    if (busy) return;
    setJoinError(null);
    // Hold the Join until anon-auth + device_id refs settle. Before this
    // guard, an early click hit the RPC with null device_id; Alert.alert is
    // silent on web → user saw nothing. Now we ask them to wait briefly.
    if (!refsReady || !deviceIdRef.current) {
      setJoinError('Loading… tap Join again in a moment.');
      return;
    }
    setBusy(true);
    try {
      const res = await joinTable(tbl.room_code, userIdRef.current, playerName || 'Player', deviceIdRef.current);
      if (res?.ok) {
        const count = (res.game_config?.numberOfPlayers ?? res.max_players ?? tbl.player_count ?? 2) as PlayerCount;
        const asHost = res.is_host === true;
        track('table_joined', { table_kind: 'public', player_count: count, room_code: res.room_code, is_host: asHost }, 'lobby');
        if (res.autostarted) {
          track('table_autostarted', { table_kind: 'public', player_count: count, room_code: res.room_code }, 'lobby');
        }
        enterTableRoom(res.room_code ?? tbl.room_code, count, asHost);
      } else if (res?.error === 'not_a_member') {
        track('table_join_rejected', { table_kind: 'public', reason: 'not_a_member', room_code: tbl.room_code }, 'lobby');
        setJoinError('That table belongs to a club — members only.');
        await load();
      } else {
        // res is null (RPC error) or {ok:false}. Inline surface, not Alert.alert
        // (silent on web). This is the visible feedback the silent-fail lacked.
        setJoinError('Table unavailable — try another.');
        await load();
      }
    } finally {
      setBusy(false);
    }
  }, [busy, refsReady, playerName, enterTableRoom, load]);

  // LOBBY-BOT-PRACTICE — two clearly separated kinds. 🤖 bot rows = instant LOCAL practice
  // (XP only, zero chips, no join_table); 👤 human tables = the real realtime multiplayer.
  // A bot row must never read as "the multiplayer" — telemetry showed a friend opening an
  // empty lobby 4x and bailing without understanding a human could join.
  const botTables = tables.filter((t) => t.table_kind === 'bot_practice');
  const humanTables = tables.filter((t) => t.table_kind !== 'bot_practice');
  // Until the server migration seeds bot_practice rows, fall back to static entries —
  // the practice route is fully client-side either way.
  const botSizes: PlayerCount[] = botTables.length
    ? (botTables
        .map((t) => (t.player_count ?? t.max_players))
        .filter((n): n is PlayerCount => n === 2 || n === 3 || n === 4))
    : [2, 3, 4];
  const playBot = useCallback((n: PlayerCount) => {
    track('bot_table_play', { player_count: n }, 'lobby');
    router.push(`/game?practice=1&players=${n}` as any);
  }, [router]);

  const grouped = groupTablesByType(humanTables);
  // Always render TABLES_PER_TYPE slots per type; pad with placeholders if the pool is
  // mid-replenish so the lobby never collapses to an empty/jumpy layout.
  const slotsFor = (n: PlayerCount): Slot[] => {
    const real = grouped[n].slice(0, TABLES_PER_TYPE);
    const slots: Slot[] = real.map((t) => ({ key: t.id, table: t }));
    while (slots.length < TABLES_PER_TYPE) slots.push({ key: `ph-${n}-${slots.length}`, table: null });
    return slots;
  };

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={10} accessibilityRole="button" accessibilityLabel="Back">
          <Text style={styles.back}>‹ Back</Text>
        </Pressable>
        <Text style={styles.title} accessibilityRole="header">LOBBY</Text>
        <View style={{ width: rs(40) }} />
      </View>
      <Text style={styles.sub}>Public tables · auto-start when full</Text>
      {onlineCount > 0 && (
        <View style={styles.liveRow} accessibilityRole="text" accessibilityLabel={`${onlineCount} players online now`}>
          <View style={styles.liveDot} />
          <Text style={styles.liveText}>{onlineCount} {onlineCount === 1 ? 'player' : 'players'} online now</Text>
        </View>
      )}

      {/* Inline join feedback — replaces the silent-on-web Alert.alert. */}
      {joinError && (
        <View style={styles.errorBanner} accessibilityLiveRegion="polite">
          <Text style={styles.errorBannerText}>{joinError}</Text>
        </View>
      )}

      {/* 🤖 Bot practice — replaces the old single "Play Solo" fallback with one clearly
          labeled instant table per size. Practice: XP only, no chips (economy-neutral). */}
      <View style={styles.botSection}>
        <View style={styles.botHead}>
          <Text style={styles.botTitle}>🤖 PLAY A BOT — INSTANT</Text>
          <Text style={styles.botMeta}>practice · XP only · no chips</Text>
        </View>
        {botSizes.map((n) => (
          <Pressable
            key={`bot-${n}`}
            style={[styles.botRow, busy && styles.btnDisabled]}
            disabled={busy}
            onPress={() => playBot(n)}
            accessibilityRole="button"
            accessibilityLabel={`Practice game versus ${n === 2 ? 'a bot' : 'bots'}, ${n} players, starts instantly, no chips at stake`}
            testID={`bot-table-${n}`}
          >
            <View style={styles.botBadge}><Text style={styles.botBadgeText}>🤖 BOT</Text></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.botRowTitle}>{n === 2 ? 'Heads-Up vs Bot' : `${n}-Player vs Bots`}</Text>
              <Text style={styles.botRowSub}>{getBoardCount(n)} boards · starts instantly</Text>
            </View>
            <View style={styles.botPlayBtn}><Text style={styles.botPlayText}>Play now</Text></View>
          </Pressable>
        ))}
      </View>

      {/* 👤 The real multiplayer — make human-ness unmissable */}
      <View style={styles.humanHead}>
        <Text style={styles.humanTitle}>👤 REAL PLAYERS — TABLES FOR FRIENDS</Text>
        <Text style={styles.humanSub}>A real person joins here · invite a friend or wait at a table</Text>
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color="#4FD6A8" /></View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: rs(16), paddingBottom: rs(40) }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(); }} tintColor="#4FD6A8" />}
          showsVerticalScrollIndicator={false}
        >
          {TYPES.map(({ n, label, boards }) => (
            <View key={n} style={styles.section}>
              <View style={styles.sectionHead}>
                <Text style={styles.sectionTitle}>{label}</Text>
                <Text style={styles.sectionMeta}>{n} players · {boards} boards</Text>
              </View>
              {slotsFor(n).map((slot) => {
                if (!slot.table) {
                  return (
                    <View key={slot.key} style={[styles.table, styles.tablePlaceholder]}>
                      <View style={styles.seats}>
                        {Array.from({ length: n }).map((_, i) => (<View key={i} style={styles.seat} />))}
                      </View>
                      <View style={styles.tableInfo}>
                        <Text style={styles.tableCountMuted}>Opening a table…</Text>
                      </View>
                      <View style={[styles.joinBtn, styles.joinBtnFull]}>
                        <Text style={styles.joinTextFull}>…</Text>
                      </View>
                    </View>
                  );
                }
                const tbl = slot.table;
                const full = tbl.current_players >= tbl.max_players;
                return (
                  <View key={slot.key} style={styles.table}>
                    <View style={styles.seats}>
                      {Array.from({ length: tbl.max_players }).map((_, i) => (
                        <View key={i} style={[styles.seat, i < tbl.current_players && styles.seatOn]} />
                      ))}
                    </View>
                    <View style={styles.tableInfo}>
                      <Text style={styles.tableCount}>{tbl.current_players} / {tbl.max_players}</Text>
                      <Text style={styles.tableSub}>#{tbl.room_code} · waiting</Text>
                    </View>
                    <Pressable
                      style={[styles.joinBtn, (full || busy) && styles.joinBtnFull]}
                      disabled={full || busy}
                      onPress={() => handleJoin(tbl)}
                      accessibilityRole="button"
                      accessibilityLabel={full ? `Table ${tbl.room_code} full` : `Join table ${tbl.room_code}`}
                    >
                      <Text style={[styles.joinText, full && styles.joinTextFull]}>{full ? 'Full' : 'Join'}</Text>
                    </Pressable>
                  </View>
                );
              })}
            </View>
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#161922' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: rs(16), paddingTop: rv(8) },
  back: { color: '#4FD6A8', fontSize: rf(16), fontWeight: '600', width: rs(60) },
  title: { color: '#4FD6A8', fontSize: rf(24), fontWeight: '900', letterSpacing: 3 },
  sub: { color: 'rgba(255,255,255,0.6)', fontSize: rf(11), textAlign: 'center', marginTop: rv(2), marginBottom: rv(10) },
  liveRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: rs(6), marginTop: rv(-4), marginBottom: rv(10) },
  liveDot: { width: rs(8), height: rs(8), borderRadius: rs(4), backgroundColor: '#3DDC84' },
  liveText: { color: '#3DDC84', fontSize: rf(11), fontWeight: '700', letterSpacing: 0.3 },
  // LOBBY-BOT-PRACTICE — amber bot palette, visually distinct from the mint human tables
  botSection: { marginHorizontal: rs(16), marginBottom: rv(8) },
  botHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: rv(6) },
  botTitle: { color: '#F5B546', fontSize: rf(13), fontWeight: '900', letterSpacing: 1 },
  botMeta: { color: 'rgba(255,255,255,0.5)', fontSize: rf(10) },
  botRow: { flexDirection: 'row', alignItems: 'center', gap: rs(10), backgroundColor: 'rgba(245,181,70,0.08)', borderWidth: 1, borderColor: 'rgba(245,181,70,0.4)', borderRadius: rv(12), paddingVertical: rv(8), paddingHorizontal: rs(12), marginBottom: rv(6) },
  botBadge: { backgroundColor: 'rgba(245,181,70,0.18)', borderWidth: 1, borderColor: 'rgba(245,181,70,0.55)', borderRadius: rv(7), paddingHorizontal: rs(8), paddingVertical: rv(3) },
  botBadgeText: { color: '#F5B546', fontSize: rf(10), fontWeight: '900', letterSpacing: 0.5 },
  botRowTitle: { color: '#fff', fontSize: rf(14), fontWeight: '700' },
  botRowSub: { color: 'rgba(255,255,255,0.55)', fontSize: rf(10), marginTop: rv(1) },
  botPlayBtn: { backgroundColor: '#F5B546', borderRadius: rv(9), paddingHorizontal: rs(14), paddingVertical: rv(7) },
  botPlayText: { color: '#161922', fontSize: rf(13), fontWeight: '900' },
  humanHead: { marginHorizontal: rs(16), marginTop: rv(4), marginBottom: rv(2) },
  humanTitle: { color: '#4FD6A8', fontSize: rf(13), fontWeight: '900', letterSpacing: 1 },
  humanSub: { color: 'rgba(255,255,255,0.6)', fontSize: rf(10), marginTop: rv(2) },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  soloBtn: { flexDirection: 'row', alignItems: 'center', gap: rs(12), marginHorizontal: rs(16), marginBottom: rv(8), backgroundColor: 'rgba(245,181,70,0.12)', borderWidth: 1.5, borderColor: 'rgba(245,181,70,0.55)', borderRadius: rv(14), paddingVertical: rv(12), paddingHorizontal: rs(16) },
  soloEmoji: { fontSize: rf(24) },
  soloTitle: { color: '#F5B546', fontSize: rf(15), fontWeight: '800' },
  soloSub: { color: 'rgba(255,255,255,0.7)', fontSize: rf(11), marginTop: rv(1) },
  soloGo: { color: '#F5B546', fontSize: rf(26), fontWeight: '900' },
  section: { marginBottom: rv(18) },
  sectionHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: rv(6) },
  sectionTitle: { color: '#fff', fontSize: rf(13), fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase' },
  sectionMeta: { color: 'rgba(255,255,255,0.5)', fontSize: rf(10) },
  table: { flexDirection: 'row', alignItems: 'center', gap: rs(12), backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', borderRadius: rv(12), padding: rs(12), marginBottom: rv(8) },
  tablePlaceholder: { opacity: 0.5 },
  seats: { flexDirection: 'row', gap: rs(5) },
  seat: { width: rs(13), height: rs(13), borderRadius: rs(7), backgroundColor: '#2a2f3a' },
  seatOn: { backgroundColor: '#4FD6A8' },
  tableInfo: { flex: 1 },
  tableCount: { color: '#fff', fontSize: rf(14), fontWeight: '700' },
  tableCountMuted: { color: 'rgba(255,255,255,0.5)', fontSize: rf(13), fontStyle: 'italic' },
  tableSub: { color: 'rgba(255,255,255,0.5)', fontSize: rf(10) },
  joinBtn: { backgroundColor: '#4FD6A8', borderRadius: rv(10), paddingHorizontal: rs(16), paddingVertical: rv(8), minWidth: rs(64), alignItems: 'center' },
  joinBtnFull: { backgroundColor: 'rgba(255,255,255,0.08)' },
  joinText: { color: '#08130f', fontWeight: '800', fontSize: rf(13) },
  joinTextFull: { color: 'rgba(255,255,255,0.6)' },
  btnDisabled: { opacity: 0.5 },
  errorBanner: {
    marginHorizontal: rs(16),
    marginBottom: rv(8),
    paddingVertical: rv(8),
    paddingHorizontal: rs(12),
    backgroundColor: 'rgba(239,68,68,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.45)',
    borderRadius: rv(10),
  },
  errorBannerText: { color: '#ef4444', fontSize: rf(12), fontWeight: '700', textAlign: 'center' },
});
