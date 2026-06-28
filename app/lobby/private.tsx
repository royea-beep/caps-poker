/**
 * Private Friends Lobby — VAMOS-CAPS-LOBBY-V2-CLIENT (TASK C).
 *
 * The invite-by-code half of multiplayer, reached from the Friends tab. Create a
 * PRIVATE table (create_table — is_public stays false, so it never shows in the public
 * lobby) and share its code, or join a friend's table by code. The creator hosts; a
 * code-joiner is a guest. Both hand off to the shared Table Room (app/lobby/table),
 * which owns the realtime session and auto-starts when the table fills.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable, TextInput, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useGameStore } from '../../store/gameStore';
import { getSupabase } from '../../utils/supabase';
import { rf, rs, rv } from '../../utils/responsive';
import { track } from '../../utils/analytics';
import { getDeviceId } from '../../utils/leaderboard';
import { createTable, joinTable, PlayerCount } from '../../utils/lobbyApi';

const TYPES: { n: PlayerCount; label: string; boards: number }[] = [
  { n: 2, label: 'Heads-Up', boards: 4 },
  { n: 3, label: '3-Player', boards: 3 },
  { n: 4, label: '4-Player', boards: 2 },
];

export default function PrivateLobby() {
  const router = useRouter();
  const playerName = useGameStore((s) => s.playerName);

  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const userIdRef = useRef<string | null>(null);
  const deviceIdRef = useRef<string | null>(null);

  useEffect(() => {
    track('lobby_opened', { table_kind: 'private' }, 'lobby-private');
    getSupabase()?.auth.getUser().then(({ data }) => { userIdRef.current = data?.user?.id ?? null; }).catch(() => {});
    getDeviceId().then((d) => { deviceIdRef.current = d; }).catch(() => {});
  }, []);

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
        track('table_created', { table_kind: 'private', player_count: n, room_code: res.room_code }, 'lobby-private');
        // The creator is seated as host (create_table seat 0, is_host=true).
        enterTableRoom(res.room_code, n, true);
      } else {
        Alert.alert('Could not create table', 'Please try again.');
      }
    } finally {
      setBusy(false);
    }
  }, [busy, playerName, enterTableRoom]);

  const handleJoinByCode = useCallback(async () => {
    const roomCode = code.trim().toUpperCase();
    if (busy || !roomCode) return;
    setBusy(true);
    try {
      const res = await joinTable(roomCode, userIdRef.current, playerName || 'Player', deviceIdRef.current);
      if (res?.ok) {
        const count = (res.game_config?.numberOfPlayers ?? res.max_players ?? 2) as PlayerCount;
        const asHost = res.is_host === true; // private tables already have a host → false
        track('table_joined', { table_kind: 'private', player_count: count, room_code: res.room_code, is_host: asHost }, 'lobby-private');
        if (res.autostarted) {
          track('table_autostarted', { table_kind: 'private', player_count: count, room_code: res.room_code }, 'lobby-private');
        }
        enterTableRoom(res.room_code ?? roomCode, count, asHost);
      } else if (res?.error === 'not_a_member') {
        // The code belongs to a CLUB table; only club members can join it.
        track('table_join_rejected', { table_kind: 'private', reason: 'not_a_member', room_code: roomCode }, 'lobby-private');
        Alert.alert('Members only', 'That table belongs to a club. Join the club to play there.');
      } else {
        Alert.alert('Table unavailable', 'That code is wrong, full, or no longer open.');
      }
    } finally {
      setBusy(false);
    }
  }, [busy, code, playerName, enterTableRoom]);

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={10} accessibilityRole="button" accessibilityLabel="Back">
          <Text style={styles.back}>‹ Back</Text>
        </Pressable>
        <Text style={styles.title} accessibilityRole="header">PRIVATE TABLE</Text>
        <View style={{ width: rs(40) }} />
      </View>
      <Text style={styles.sub}>Play your friends with a shared code</Text>

      {/* Join by code */}
      <View style={styles.block}>
        <Text style={styles.blockTitle}>Join a friend's table</Text>
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
          <Pressable style={[styles.codeBtn, (!code.trim() || busy) && styles.btnDisabled]} disabled={!code.trim() || busy} onPress={handleJoinByCode} accessibilityRole="button" accessibilityLabel="Join by code">
            <Text style={styles.codeBtnText}>Join</Text>
          </Pressable>
        </View>
      </View>

      {/* Create a private table */}
      <View style={styles.block}>
        <Text style={styles.blockTitle}>Create a table to share</Text>
        {TYPES.map(({ n, label, boards }) => (
          <Pressable key={n} style={[styles.createBtn, busy && styles.btnDisabled]} disabled={busy} onPress={() => handleCreate(n)} accessibilityRole="button" accessibilityLabel={`Create a ${n}-player private table`}>
            <View style={{ flex: 1 }}>
              <Text style={styles.createTitle}>{label}</Text>
              <Text style={styles.createSub}>{n} players · {boards} boards</Text>
            </View>
            <Text style={styles.createGo}>Create ›</Text>
          </Pressable>
        ))}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#161922' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: rs(16), paddingTop: rv(8) },
  back: { color: '#4FD6A8', fontSize: rf(16), fontWeight: '600', width: rs(60) },
  title: { color: '#4FD6A8', fontSize: rf(22), fontWeight: '900', letterSpacing: 2 },
  sub: { color: 'rgba(255,255,255,0.6)', fontSize: rf(11), textAlign: 'center', marginTop: rv(2), marginBottom: rv(16) },
  block: { paddingHorizontal: rs(16), marginBottom: rv(22) },
  blockTitle: { color: '#fff', fontSize: rf(13), fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase', marginBottom: rv(8) },
  codeRow: { flexDirection: 'row', gap: rs(8) },
  codeInput: { flex: 1, backgroundColor: '#0d0f15', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', borderRadius: rv(10), color: '#fff', paddingHorizontal: rs(12), paddingVertical: rv(10), fontSize: rf(15), letterSpacing: 2 },
  codeBtn: { backgroundColor: 'rgba(79,214,168,0.15)', borderWidth: 1, borderColor: 'rgba(79,214,168,0.35)', borderRadius: rv(10), paddingHorizontal: rs(18), justifyContent: 'center' },
  codeBtnText: { color: '#4FD6A8', fontWeight: '800', fontSize: rf(14) },
  createBtn: { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderColor: 'rgba(79,214,168,0.4)', borderRadius: rv(12), paddingVertical: rv(12), paddingHorizontal: rs(16), marginBottom: rv(8), backgroundColor: 'rgba(255,255,255,0.03)' },
  createTitle: { color: '#fff', fontSize: rf(15), fontWeight: '700' },
  createSub: { color: 'rgba(255,255,255,0.5)', fontSize: rf(11), marginTop: rv(1) },
  createGo: { color: '#4FD6A8', fontWeight: '800', fontSize: rf(14) },
  btnDisabled: { opacity: 0.5 },
});
