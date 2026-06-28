/**
 * Club detail — VAMOS-CAPS-FRIENDS-CLUBS (TASK A).
 *
 * A single club: its shareable code, its private mini-league (club_leaderboard ranked
 * by net chips then wins), the club's open tables (list_club_tables — member-gated), and
 * "Start a club table" (create_club_table → host the table). Club tables are ordinary
 * private game_rooms rows linked by club_id, so they reuse the Table Room + realtime path;
 * record_club_result fires at game end (store.clubCode) to update the mini-league.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator, RefreshControl, Share, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useGameStore } from '../../store/gameStore';
import { getSupabase } from '../../utils/supabase';
import { getDeviceId } from '../../utils/leaderboard';
import { rf, rs, rv } from '../../utils/responsive';
import { track } from '../../utils/analytics';
import { joinTable, OpenTable, PlayerCount } from '../../utils/lobbyApi';
import { clubLeaderboard, listClubTables, createClubTable, ClubMember } from '../../utils/clubApi';

const TYPES: { n: PlayerCount; label: string; boards: number }[] = [
  { n: 2, label: 'Heads-Up', boards: 4 },
  { n: 3, label: '3-Player', boards: 3 },
  { n: 4, label: '4-Player', boards: 2 },
];

const POLL_MS = 5000;
const MEDAL = ['🥇', '🥈', '🥉'];

export default function ClubDetail() {
  const router = useRouter();
  const params = useLocalSearchParams<{ code: string; name?: string }>();
  const clubCode = (params.code || '').toUpperCase();
  const clubName = params.name || 'Club';
  const playerName = useGameStore((s) => s.playerName);

  const [league, setLeague] = useState<ClubMember[]>([]);
  const [tables, setTables] = useState<OpenTable[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);
  const userIdRef = useRef<string | null>(null);
  const deviceIdRef = useRef<string | null>(null);

  const load = useCallback(async () => {
    const [lg, tbls] = await Promise.all([
      clubLeaderboard(clubCode),
      listClubTables(clubCode, deviceIdRef.current, userIdRef.current),
    ]);
    setLeague(lg);
    setTables(tbls);
    setLoading(false);
    setRefreshing(false);
  }, [clubCode]);

  useEffect(() => {
    getSupabase()?.auth.getUser().then(({ data }) => { userIdRef.current = data?.user?.id ?? null; }).catch(() => {});
    getDeviceId().then((d) => { deviceIdRef.current = d; }).catch(() => {});
    void load();
    const id = setInterval(() => { void load(); }, POLL_MS);
    return () => { clearInterval(id); };
  }, [load]);

  const enterTableRoom = useCallback((roomCode: string, n: PlayerCount, asHost: boolean) => {
    router.push({
      pathname: '/lobby/table',
      params: { roomCode, playerCount: String(n), isHost: asHost ? 'true' : 'false', clubCode },
    } as any);
  }, [router, clubCode]);

  const handleShare = useCallback(async () => {
    try {
      await Share.share({ message: `Join my CAPS club "${clubName}"! Code: ${clubCode}`, title: 'CAPS Poker — Club Invite' });
    } catch { /* cancelled */ }
  }, [clubCode, clubName]);

  const handleStart = useCallback(async (n: PlayerCount) => {
    if (busy) return;
    setBusy(true);
    try {
      const res = await createClubTable(clubCode, n, deviceIdRef.current, userIdRef.current, playerName || 'Player');
      if (res?.ok && res.room_code) {
        track('club_table_started', { club_code: clubCode, player_count: n, room_code: res.room_code }, 'club');
        enterTableRoom(res.room_code, n, true);
      } else {
        Alert.alert('Could not start table', res?.error === 'not_a_member' ? 'You are not a member of this club.' : 'Please try again.');
      }
    } finally {
      setBusy(false);
    }
  }, [busy, clubCode, playerName, enterTableRoom]);

  const handleJoin = useCallback(async (tbl: OpenTable) => {
    if (busy) return;
    setBusy(true);
    try {
      const res = await joinTable(tbl.room_code, userIdRef.current, playerName || 'Player', deviceIdRef.current);
      if (res?.ok) {
        const count = (res.game_config?.numberOfPlayers ?? res.max_players ?? tbl.player_count ?? 2) as PlayerCount;
        track('table_joined', { table_kind: 'club', club_code: clubCode, player_count: count, room_code: res.room_code, is_host: res.is_host === true }, 'club');
        enterTableRoom(res.room_code ?? tbl.room_code, count, res.is_host === true);
      } else if (res?.error === 'not_a_member') {
        // Defensive: list_club_tables is member-gated, but a stale list could still
        // surface a table after a membership change. Server-side join_table enforces.
        track('table_join_rejected', { table_kind: 'club', reason: 'not_a_member', club_code: clubCode, room_code: tbl.room_code }, 'club');
        Alert.alert('Members only', 'You are no longer a member of this club.');
        await load();
      } else {
        Alert.alert('Table unavailable', 'That table just filled — try another.');
        await load();
      }
    } finally {
      setBusy(false);
    }
  }, [busy, clubCode, playerName, enterTableRoom, load]);

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={10} accessibilityRole="button" accessibilityLabel="Back">
          <Text style={styles.back}>‹ Back</Text>
        </Pressable>
        <Text style={styles.title} accessibilityRole="header" numberOfLines={1}>{clubName}</Text>
        <View style={{ width: rs(40) }} />
      </View>

      <Pressable style={styles.codeChip} onPress={handleShare} accessibilityRole="button" accessibilityLabel={`Share club code ${clubCode.split('').join(' ')}`}>
        <Text style={styles.codeChipLabel}>CLUB CODE</Text>
        <Text style={styles.codeChipValue}>{clubCode}</Text>
        <Text style={styles.codeChipShare}>📤 Share</Text>
      </Pressable>

      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color="#4FD6A8" /></View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: rs(16), paddingBottom: rs(40) }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(); }} tintColor="#4FD6A8" />}
          showsVerticalScrollIndicator={false}
        >
          {/* Club tables */}
          <Text style={styles.sectionTitle}>Club Tables</Text>
          {tables.length === 0 && <Text style={styles.empty}>No open tables — start one below</Text>}
          {tables.map((tbl) => {
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
                <Pressable style={[styles.joinBtn, (full || busy) && styles.joinBtnFull]} disabled={full || busy} onPress={() => handleJoin(tbl)} accessibilityRole="button" accessibilityLabel={full ? `Table ${tbl.room_code} full` : `Join club table ${tbl.room_code}`}>
                  <Text style={[styles.joinText, full && styles.joinTextFull]}>{full ? 'Full' : 'Join'}</Text>
                </Pressable>
              </View>
            );
          })}

          {/* Start a table */}
          <Text style={[styles.sectionTitle, { marginTop: rv(14) }]}>Start a Club Table</Text>
          {TYPES.map(({ n, label, boards }) => (
            <Pressable key={n} style={[styles.createBtn, busy && styles.btnDisabled]} disabled={busy} onPress={() => handleStart(n)} accessibilityRole="button" accessibilityLabel={`Start a ${n}-player club table`}>
              <View style={{ flex: 1 }}>
                <Text style={styles.createTitle}>{label}</Text>
                <Text style={styles.createSub}>{n} players · {boards} boards</Text>
              </View>
              <Text style={styles.createGo}>Start ›</Text>
            </Pressable>
          ))}

          {/* Mini-league */}
          <Text style={[styles.sectionTitle, { marginTop: rv(18) }]}>Mini-League</Text>
          {league.length === 0 && <Text style={styles.empty}>No games yet — play a club table to start the league</Text>}
          {league.map((m, i) => (
            <View key={`${m.display_name}-${i}`} style={styles.leagueRow}>
              <Text style={styles.leagueRank}>{MEDAL[i] || `${i + 1}.`}</Text>
              <Text style={styles.leagueName} numberOfLines={1}>{m.display_name}</Text>
              <View style={styles.leagueStats}>
                <Text style={[styles.leagueNet, m.net_chips >= 0 ? styles.net_pos : styles.net_neg]}>{m.net_chips >= 0 ? '+' : ''}{m.net_chips}</Text>
                <Text style={styles.leagueWl}>{m.games_won}W · {m.games_played}G</Text>
              </View>
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
  title: { flex: 1, color: '#4FD6A8', fontSize: rf(20), fontWeight: '900', letterSpacing: 1, textAlign: 'center' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  codeChip: { flexDirection: 'row', alignItems: 'center', gap: rs(10), alignSelf: 'center', marginTop: rv(8), marginBottom: rv(6), backgroundColor: 'rgba(79,214,168,0.1)', borderWidth: 1, borderColor: 'rgba(79,214,168,0.35)', borderRadius: rv(12), paddingVertical: rv(8), paddingHorizontal: rs(16) },
  codeChipLabel: { color: 'rgba(255,255,255,0.55)', fontSize: rf(10), letterSpacing: 1 },
  codeChipValue: { color: '#4FD6A8', fontSize: rf(20), fontWeight: '900', letterSpacing: 4 },
  codeChipShare: { color: '#4FD6A8', fontSize: rf(12), fontWeight: '700' },
  sectionTitle: { color: '#fff', fontSize: rf(13), fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase', marginBottom: rv(8) },
  empty: { color: 'rgba(255,255,255,0.4)', fontSize: rf(12), fontStyle: 'italic', paddingVertical: rv(6) },
  table: { flexDirection: 'row', alignItems: 'center', gap: rs(12), backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', borderRadius: rv(12), padding: rs(12), marginBottom: rv(8) },
  seats: { flexDirection: 'row', gap: rs(5) },
  seat: { width: rs(13), height: rs(13), borderRadius: rs(7), backgroundColor: '#2a2f3a' },
  seatOn: { backgroundColor: '#4FD6A8' },
  tableInfo: { flex: 1 },
  tableCount: { color: '#fff', fontSize: rf(14), fontWeight: '700' },
  tableSub: { color: 'rgba(255,255,255,0.5)', fontSize: rf(10) },
  joinBtn: { backgroundColor: '#4FD6A8', borderRadius: rv(10), paddingHorizontal: rs(16), paddingVertical: rv(8), minWidth: rs(64), alignItems: 'center' },
  joinBtnFull: { backgroundColor: 'rgba(255,255,255,0.08)' },
  joinText: { color: '#08130f', fontWeight: '800', fontSize: rf(13) },
  joinTextFull: { color: 'rgba(255,255,255,0.6)' },
  createBtn: { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderColor: 'rgba(79,214,168,0.4)', borderRadius: rv(12), paddingVertical: rv(11), paddingHorizontal: rs(16), marginBottom: rv(8), backgroundColor: 'rgba(255,255,255,0.03)' },
  createTitle: { color: '#fff', fontSize: rf(15), fontWeight: '700' },
  createSub: { color: 'rgba(255,255,255,0.5)', fontSize: rf(11), marginTop: rv(1) },
  createGo: { color: '#4FD6A8', fontWeight: '800', fontSize: rf(14) },
  btnDisabled: { opacity: 0.5 },
  leagueRow: { flexDirection: 'row', alignItems: 'center', gap: rs(10), backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: rv(10), paddingVertical: rv(10), paddingHorizontal: rs(12), marginBottom: rv(6) },
  leagueRank: { color: '#fff', fontSize: rf(15), fontWeight: '800', width: rs(28) },
  leagueName: { flex: 1, color: '#fff', fontSize: rf(14), fontWeight: '600' },
  leagueStats: { alignItems: 'flex-end' },
  leagueNet: { fontSize: rf(14), fontWeight: '800' },
  net_pos: { color: '#4FD6A8' },
  net_neg: { color: '#ff6b6b' },
  leagueWl: { color: 'rgba(255,255,255,0.45)', fontSize: rf(10) },
});
