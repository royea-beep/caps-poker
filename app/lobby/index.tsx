/**
 * Multiplayer Lobby — VAMOS-CAPS-MP-LOBBY Phase 2 + TASK 3C (game-wiring).
 *
 * Open tables grouped by the 3 types (2P/3P/4P), 2+ per type. Join / Create /
 * invite-by-code. Creating or joining hands off to the Table Room (app/lobby/table),
 * which opens the realtime channel and auto-starts a REAL synced multiplayer game when
 * the table fills — host-authoritative over utils/realtimeMultiplayer + multiplayer-game.
 * This screen owns DISCOVERY only (list/create/join/code); the table room owns the
 * realtime session and the DB seat from that point on.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, TextInput, ActivityIndicator, RefreshControl, Alert, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useGameStore } from '../../store/gameStore';
import { getSupabase } from '../../utils/supabase';
import { rf, rs, rv } from '../../utils/responsive';
import { track } from '../../utils/analytics';
import { getDeviceId } from '../../utils/leaderboard';
import { listOpenTables, createTable, joinTable, groupTablesByType, OpenTable, PlayerCount } from '../../utils/lobbyApi';

const TYPES: { n: PlayerCount; label: string; boards: number }[] = [
  { n: 2, label: 'Heads-Up', boards: 4 },
  { n: 3, label: '3-Player', boards: 3 },
  { n: 4, label: '4-Player', boards: 2 },
];

const POLL_MS = 5000;

export default function MultiplayerLobby() {
  const router = useRouter();
  const playerName = useGameStore((s) => s.playerName);

  const [tables, setTables] = useState<OpenTable[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const userIdRef = useRef<string | null>(null);
  const deviceIdRef = useRef<string | null>(null);

  const load = useCallback(async () => {
    const rows = await listOpenTables();
    setTables(rows);
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    track('lobby_opened', {}, 'lobby');
    getSupabase()?.auth.getUser().then(({ data }) => { userIdRef.current = data?.user?.id ?? null; }).catch(() => {});
    getDeviceId().then((d) => { deviceIdRef.current = d; }).catch(() => {});
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

  const handleCreate = useCallback(async (n: PlayerCount) => {
    if (busy) return;
    setBusy(true);
    try {
      const res = await createTable(n, userIdRef.current, playerName || 'Player', deviceIdRef.current);
      if (res?.ok && res.room_code) {
        track('table_created', { player_count: n, room_code: res.room_code }, 'lobby');
        enterTableRoom(res.room_code, n, true);
      } else {
        Alert.alert('Could not create table', 'Please try again.');
      }
    } finally {
      setBusy(false);
    }
  }, [busy, playerName, enterTableRoom]);

  const handleJoin = useCallback(async (roomCode: string, n?: PlayerCount) => {
    if (busy || !roomCode.trim()) return;
    setBusy(true);
    try {
      const res = await joinTable(roomCode, userIdRef.current, playerName || 'Player', deviceIdRef.current);
      if (res?.ok) {
        const count = (res.game_config?.numberOfPlayers ?? res.max_players ?? n ?? 2) as PlayerCount;
        track('table_joined', { player_count: count, room_code: res.room_code }, 'lobby');
        if (res.autostarted) {
          track('table_autostarted', { player_count: count, room_code: res.room_code }, 'lobby');
        }
        // Whether the seat-claim auto-started the table or not, enter the table room as a
        // guest; the host's realtime presence fill triggers the actual deal.
        enterTableRoom(res.room_code ?? roomCode.trim().toUpperCase(), count, false);
      } else {
        Alert.alert('Table unavailable', 'That table is full or no longer open.');
        await load();
      }
    } finally {
      setBusy(false);
    }
  }, [busy, enterTableRoom, load]);

  const grouped = groupTablesByType(tables);

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={10} accessibilityRole="button" accessibilityLabel="Back">
          <Text style={styles.back}>‹ Back</Text>
        </Pressable>
        <Text style={styles.title} accessibilityRole="header">LOBBY</Text>
        <View style={{ width: rs(40) }} />
      </View>
      <Text style={styles.sub}>Open tables · auto-start when full</Text>

      {/* invite-by-code */}
      <View style={styles.codeRow}>
        <TextInput
          value={code}
          onChangeText={(t) => setCode(t.toUpperCase().slice(0, 4))}
          placeholder="Enter a friend's code"
          placeholderTextColor="rgba(255,255,255,0.4)"
          autoCapitalize="characters"
          style={styles.codeInput}
          accessibilityLabel="Enter a table code"
        />
        <Pressable style={[styles.codeBtn, (!code.trim() || busy) && styles.btnDisabled]} disabled={!code.trim() || busy} onPress={() => handleJoin(code)} accessibilityRole="button" accessibilityLabel="Join by code">
          <Text style={styles.codeBtnText}>Join</Text>
        </Pressable>
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
              {grouped[n].length === 0 && <Text style={styles.empty}>No open tables — create one</Text>}
              {grouped[n].map((tbl) => {
                const full = tbl.current_players >= tbl.max_players;
                return (
                  <View key={tbl.id} style={styles.table}>
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
                      onPress={() => handleJoin(tbl.room_code, n)}
                      accessibilityRole="button"
                      accessibilityLabel={full ? `Table ${tbl.room_code} full` : `Join table ${tbl.room_code}`}
                    >
                      <Text style={[styles.joinText, full && styles.joinTextFull]}>{full ? 'Full' : 'Join'}</Text>
                    </Pressable>
                  </View>
                );
              })}
              <Pressable style={[styles.createBtn, busy && styles.btnDisabled]} disabled={busy} onPress={() => handleCreate(n)} accessibilityRole="button" accessibilityLabel={`Create a ${n}-player table`}>
                <Text style={styles.createText}>+ Create {label} table</Text>
              </Pressable>
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
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  codeRow: { flexDirection: 'row', gap: rs(8), paddingHorizontal: rs(16), marginBottom: rv(6) },
  codeInput: { flex: 1, backgroundColor: '#0d0f15', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', borderRadius: rv(10), color: '#fff', paddingHorizontal: rs(12), paddingVertical: rv(10), fontSize: rf(15), letterSpacing: 2 },
  codeBtn: { backgroundColor: 'rgba(79,214,168,0.15)', borderWidth: 1, borderColor: 'rgba(79,214,168,0.35)', borderRadius: rv(10), paddingHorizontal: rs(18), justifyContent: 'center' },
  codeBtnText: { color: '#4FD6A8', fontWeight: '800', fontSize: rf(14) },
  section: { marginBottom: rv(18) },
  sectionHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: rv(6) },
  sectionTitle: { color: '#fff', fontSize: rf(13), fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase' },
  sectionMeta: { color: 'rgba(255,255,255,0.5)', fontSize: rf(10) },
  empty: { color: 'rgba(255,255,255,0.4)', fontSize: rf(12), fontStyle: 'italic', paddingVertical: rv(8) },
  table: { flexDirection: 'row', alignItems: 'center', gap: rs(12), backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', borderRadius: rv(12), padding: rs(12), marginBottom: rv(8) },
  seats: { flexDirection: 'row', gap: rs(5) },
  seat: { width: rs(13), height: rs(13), borderRadius: rs(7), backgroundColor: '#2a2f3a' },
  seatOn: { backgroundColor: '#4FD6A8' },
  tableInfo: { flex: 1 },
  tableCount: { color: '#fff', fontSize: rf(14), fontWeight: '700' },
  tableSub: { color: 'rgba(255,255,255,0.5)', fontSize: rf(10) },
  joinBtn: { backgroundColor: '#4FD6A8', borderRadius: rv(10), paddingHorizontal: rs(16), paddingVertical: rv(8) },
  joinBtnFull: { backgroundColor: 'rgba(255,255,255,0.08)' },
  joinText: { color: '#08130f', fontWeight: '800', fontSize: rf(13) },
  joinTextFull: { color: 'rgba(255,255,255,0.6)' },
  createBtn: { borderWidth: 1.5, borderColor: 'rgba(79,214,168,0.5)', borderRadius: rv(12), paddingVertical: rv(11), alignItems: 'center', marginTop: rv(2) },
  createText: { color: '#4FD6A8', fontWeight: '800', fontSize: rf(13) },
  btnDisabled: { opacity: 0.5 },
});
