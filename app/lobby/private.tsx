/**
 * Private Friends Lobby — VAMOS-CAPS-LOBBY-V2-CLIENT (TASK C).
 *
 * The invite-by-code half of multiplayer, reached from the Friends tab. Create a
 * PRIVATE table (create_table — is_public stays false, so it never shows in the public
 * lobby) and share its code, or join a friend's table by code. The creator hosts; a
 * code-joiner is a guest. Both hand off to the shared Table Room (app/lobby/table),
 * which owns the realtime session and auto-starts when the table fills.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable, TextInput, Alert, Platform, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useGameStore } from '../../store/gameStore';
import { getSupabase } from '../../utils/supabase';
import { rf as rfBase, rs as rsBase, rv as rvBase } from '../../utils/responsive';
import { WEB_MAX_WIDTH } from '../../components/WebContainer';
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
  // MP-PARITY-DEEP 2026-07-09 — same frozen-393pt-on-web bug fixed in lobby/index.tsx;
  // this screen is now also the Challenge-a-Friend redirect target, so it needed the
  // same reactive-shadow fix. Clamp to WEB_MAX_WIDTH on web — see lobby/index.tsx for why.
  const { width: rawScreenW } = useWindowDimensions();
  const screenW = Platform.OS === 'web' ? Math.min(rawScreenW, WEB_MAX_WIDTH) : rawScreenW;
  const rs = useCallback((v: number) => rsBase(v, screenW), [screenW]);
  const rf = useCallback((v: number, floor?: number) => rfBase(v, floor ?? Math.max(9, v - 3), undefined, screenW), [screenW]);
  const rv = useCallback((v: number) => rvBase(v, screenW), [screenW]);
  const styles = useMemo(() => makeStyles(rs, rf, rv), [rs, rf, rv]);
  const playerName = useGameStore((s) => s.playerName);

  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  // VAMOS-UNIFY-FINAL — inline feedback (Alert.alert silent on web).
  const [joinError, setJoinError] = useState<string | null>(null);
  const [refsReady, setRefsReady] = useState(false);
  const userIdRef = useRef<string | null>(null);
  const deviceIdRef = useRef<string | null>(null);

  useEffect(() => {
    track('lobby_opened', { table_kind: 'private' }, 'lobby-private');
    let gotUser = false, gotDevice = false;
    const settle = () => { if (gotUser && gotDevice) setRefsReady(true); };
    getSupabase()?.auth.getUser().then(({ data }) => { userIdRef.current = data?.user?.id ?? null; gotUser = true; settle(); }).catch(() => { gotUser = true; settle(); });
    getDeviceId().then((d) => { deviceIdRef.current = d; gotDevice = true; settle(); }).catch(() => { gotDevice = true; settle(); });
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
    setJoinError(null);
    if (!refsReady || !deviceIdRef.current) {
      setJoinError('Loading… tap Join again in a moment.');
      return;
    }
    setBusy(true);
    try {
      const res = await joinTable(roomCode, userIdRef.current, playerName || 'Player', deviceIdRef.current);
      if (res?.ok) {
        const count = (res.game_config?.numberOfPlayers ?? res.max_players ?? 2) as PlayerCount;
        const asHost = res.is_host === true;
        track('table_joined', { table_kind: 'private', player_count: count, room_code: res.room_code, is_host: asHost }, 'lobby-private');
        if (res.autostarted) {
          track('table_autostarted', { table_kind: 'private', player_count: count, room_code: res.room_code }, 'lobby-private');
        }
        enterTableRoom(res.room_code ?? roomCode, count, asHost);
      } else if (res?.error === 'not_a_member') {
        track('table_join_rejected', { table_kind: 'private', reason: 'not_a_member', room_code: roomCode }, 'lobby-private');
        setJoinError('Members only — that table belongs to a club. Join the club to play there.');
      } else {
        setJoinError('That code is wrong, full, or no longer open.');
      }
    } finally {
      setBusy(false);
    }
  }, [busy, refsReady, code, playerName, enterTableRoom]);

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

      {joinError && (
        <View style={styles.errorBanner} accessibilityLiveRegion="polite">
          <Text style={styles.errorBannerText}>{joinError}</Text>
        </View>
      )}

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

function makeStyles(rs: (v: number) => number, rf: (v: number, floor?: number) => number, rv: (v: number) => number) {
  return StyleSheet.create({
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
  errorBanner: { marginHorizontal: rs(16), marginBottom: rv(8), paddingVertical: rv(8), paddingHorizontal: rs(12), backgroundColor: 'rgba(239,68,68,0.12)', borderWidth: 1, borderColor: 'rgba(239,68,68,0.45)', borderRadius: rv(10) },
  errorBannerText: { color: '#ef4444', fontSize: rf(12), fontWeight: '700', textAlign: 'center' },
  });
}
