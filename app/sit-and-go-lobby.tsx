/**
 * SitAndGoLobby — VAMOS 25
 * Shows waiting sit-and-go tables, player counts, and join/create buttons.
 * Hebrew RTL. 44px touch targets. ZERO Reanimated — RN Animated only.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Pressable,
  RefreshControl,
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
import { useGameStore } from '../store/gameStore';
import { listWaitingRooms, joinRoom, createRoom, SessionRow } from '../utils/matchmaking';
import { ScreenHeader } from '../components/ScreenHeader';

void COLORS;

// ─── Palette ────────────────────────────────────────────────
const BG      = '#1a0e06';
const SURFACE = '#221408';
const BORDER  = '#3d2a1a';
const ACCENT  = '#c96a1a';
const TEXT    = '#f5e6d3';
const TEXT2   = '#a08060';
const GREEN   = '#27ae60';

// ─── Toast ──────────────────────────────────────────────────
function Toast({ message, visible }: { message: string; visible: boolean }) {
  const opacity = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(opacity, { toValue: visible ? 1 : 0, duration: 250, useNativeDriver: true }).start();
  }, [visible, opacity]);
  return (
    <Animated.View style={[s.toast, { opacity }]} pointerEvents="none">
      <Text style={s.toastText}>{message}</Text>
    </Animated.View>
  );
}

// ─── Main ────────────────────────────────────────────────────
export default function SitAndGoLobby() {
  const router      = useRouter();
  const playerName  = useGameStore(st => st.playerName) || 'Player';
  const chips       = useGameStore(st => st.chips);
  const startChips  = useGameStore(st => (st.config as any)?.startingChips ?? 1000);
  const setRoomCode = useGameStore(st => st.setRoomCode);

  const [rooms, setRooms]           = useState<SessionRow[]>([]);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [joiningId, setJoiningId]   = useState<string | null>(null);
  const [creating, setCreating]     = useState(false);
  const [activeCode, setActiveCode] = useState<string | null>(null);
  const [toast, setToast]           = useState('');
  const [toastVis, setToastVis]     = useState(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((msg: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast(msg);
    setToastVis(true);
    toastTimer.current = setTimeout(() => setToastVis(false), 2200);
  }, []);

  // ── Check if device already has an active room ───────────
  const checkActiveSession = useCallback(async () => {
    const sb = getSupabase();
    if (!sb) return;
    try {
      const deviceId = await getDeviceId();
      const { data } = await sb
        .from('sit_and_go_players')
        .select('session_id, sit_and_go_sessions!inner(room_code, status)')
        .eq('device_id', deviceId)
        .in('sit_and_go_sessions.status', ['waiting', 'playing'])
        .limit(1)
        .maybeSingle();
      if (data) setActiveCode((data as any)?.sit_and_go_sessions?.room_code ?? null);
    } catch { /* non-critical */ }
  }, []);

  const fetchRooms = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      setRooms(await listWaitingRooms());
    } catch {
      showToast('Failed to load tables');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [showToast]);

  useEffect(() => {
    void fetchRooms();
    void checkActiveSession();
  }, [fetchRooms, checkActiveSession]);

  // ── Join existing room ───────────────────────────────────
  const handleJoin = useCallback(async (room: SessionRow) => {
    if (joiningId) return;
    if (chips < startChips) { showToast("Not enough chips"); return; }
    setJoiningId(room.id);
    try {
      const result = await joinRoom(room.room_code, playerName, startChips);
      setRoomCode(result.roomCode);
      router.push('/sit-and-go' as any);
    } catch (err: any) {
      showToast(err?.message ?? 'Failed to join');
    } finally {
      setJoiningId(null);
    }
  }, [joiningId, chips, startChips, playerName, setRoomCode, router, showToast]);

  // ── Create new room ──────────────────────────────────────
  const handleCreate = useCallback(async () => {
    if (creating) return;
    if (chips < startChips) { showToast("Not enough chips"); return; }
    setCreating(true);
    try {
      const result = await createRoom(playerName, { startingChips: startChips, numberOfPlayers: 6 } as any);
      setRoomCode(result.roomCode);
      router.push('/sit-and-go' as any);
    } catch (err: any) {
      showToast(err?.message ?? 'Failed to create table');
    } finally {
      setCreating(false);
    }
  }, [creating, chips, startChips, playerName, setRoomCode, router, showToast]);

  // ── Room row renderer ────────────────────────────────────
  const renderRoom = (room: SessionRow) => {
    const isFull    = room.current_players >= room.max_players;
    const isJoining = joiningId === room.id;
    const spots     = room.max_players - room.current_players;
    return (
      <View key={room.id} style={s.roomRow}>
        <View style={s.roomInfo}>
          <Text style={s.roomCodeText}>🎰 {room.room_code}</Text>
          <Text style={s.roomPlayers}>
            {'👥 '}{room.current_players}/{room.max_players}
            {'  '}
            <Text style={isFull ? s.full : s.spots}>
              {isFull ? 'Full' : spots + ' spots open'}
            </Text>
          </Text>
          <Text style={s.roomPrize}>
            {'💰 Prize: '}{((startChips ?? 0) * (room.current_players ?? 0)).toLocaleString()}{" chips"}
          </Text>
        </View>
        <Pressable
          onPress={() => handleJoin(room)}
          disabled={isFull || !!joiningId}
          style={({ pressed }) => [
            s.joinBtn,
            isFull && s.joinBtnDisabled,
            pressed && !isFull && s.joinBtnPressed,
          ]}
        >
          {isJoining
            ? <ActivityIndicator size="small" color={TEXT} />
            : <Text style={[s.joinBtnText, isFull && s.joinBtnTextDisabled]}>
                {isFull ? 'Full' : 'Join'}
              </Text>
          }
        </Pressable>
      </View>
    );
  };

  return (
    <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
      <View style={s.root}>

        {/* Header */}
        <ScreenHeader title="🎰 Sit & Go" />

        <ScrollView
          contentContainerStyle={s.scroll}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => fetchRooms(true)}
              tintColor={ACCENT}
            />
          }
        >
          {/* Active session banner */}
          {activeCode != null && (
            <View style={s.activeBanner}>
              <Text style={s.activeBannerText}>{'🟢 Active table: '}{activeCode}</Text>
              <Pressable
                onPress={() => { setRoomCode(activeCode); router.push('/sit-and-go' as any); }}
                style={s.resumeBtn}
              >
                <Text style={s.resumeBtnText}>Resume</Text>
              </Pressable>
            </View>
          )}

          {/* Available tables */}
          <View style={s.section}>
            <Text style={s.sectionTitle}>Open Tables</Text>
            {loading
              ? <ActivityIndicator size="large" color={ACCENT} style={{ marginTop: rv(24) }} />
              : rooms.length === 0
                ? (
                  <View style={s.emptyBox}>
                    <Text style={s.emptyIcon}>🃏</Text>
                    <Text style={s.emptyText}>No open tables right now</Text>
                    <Text style={s.emptyHint}>Create a new table and others will join</Text>
                  </View>
                )
                : rooms.map(renderRoom)
            }
          </View>

          {/* Create table */}
          <View style={s.section}>
            <Text style={s.sectionTitle}>Create a new table</Text>
            <Pressable
              onPress={handleCreate}
              disabled={creating}
              style={({ pressed }) => [s.createBtn, pressed && s.createBtnPressed]}
            >
              {creating
                ? <ActivityIndicator size="small" color={TEXT} />
                : <Text style={s.createBtnText}>{'+ Create table (6 players)'}</Text>
              }
            </Pressable>
          </View>

          {/* Balance */}
          <View style={s.balanceRow}>
            <Text style={s.balanceLabel}>Your balance</Text>
            <Text style={s.balanceValue}>{'💰 '}{(chips ?? 0).toLocaleString()}{" chips"}</Text>
          </View>

        </ScrollView>
      </View>
      <Toast message={toast} visible={toastVis} />
    </SafeAreaView>
  );
}

// ─── Styles ─────────────────────────────────────────────────
const s = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: BG },
  root:    { flex: 1, backgroundColor: BG },
  scroll:  { paddingBottom: rv(40) },

  activeBanner:     { margin: rs(16), borderRadius: rs(12), backgroundColor: 'rgba(39,174,96,0.12)', borderWidth: 1, borderColor: 'rgba(39,174,96,0.4)', padding: rs(14), flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  activeBannerText: { color: GREEN, fontSize: rf(13), fontWeight: '700', flex: 1, textAlign: 'left' },
  resumeBtn:        { backgroundColor: GREEN, borderRadius: rs(8), paddingHorizontal: rs(14), paddingVertical: rs(8), marginRight: rs(8), minHeight: rs(36), alignItems: 'center', justifyContent: 'center' },
  resumeBtnText:    { color: '#fff', fontSize: rf(13), fontWeight: '800' },

  section:      { paddingHorizontal: rs(16), marginTop: rv(20) },
  sectionTitle: { color: ACCENT, fontSize: rf(14), fontWeight: '800', marginBottom: rs(10), textAlign: 'left' },

  roomRow:      { backgroundColor: SURFACE, borderRadius: rs(12), borderWidth: 1, borderColor: BORDER, padding: rs(14), marginBottom: rs(10), flexDirection: 'row', alignItems: 'center' },
  roomInfo:     { flex: 1, alignItems: 'flex-end' },
  roomCodeText: { color: TEXT, fontSize: rf(15), fontWeight: '800', marginBottom: rs(3) },
  roomPlayers:  { color: TEXT2, fontSize: rf(12), marginBottom: rs(2) },
  roomPrize:    { color: '#c9a84c', fontSize: rf(12), fontWeight: '600' },
  full:         { color: '#e74c3c' },
  spots:        { color: GREEN },

  joinBtn:             { backgroundColor: ACCENT, borderRadius: rs(8), paddingHorizontal: rs(16), paddingVertical: rs(10), minHeight: rs(44), alignItems: 'center', justifyContent: 'center', marginRight: rs(10) },
  joinBtnPressed:      { opacity: 0.75 },
  joinBtnDisabled:     { backgroundColor: '#3d2a1a' },
  joinBtnText:         { color: '#fff', fontSize: rf(14), fontWeight: '800' },
  joinBtnTextDisabled: { color: TEXT2 },

  emptyBox:  { alignItems: 'center', paddingVertical: rv(32) },
  emptyIcon: { fontSize: rf(40), marginBottom: rv(8) },
  emptyText: { color: TEXT, fontSize: rf(15), fontWeight: '700', marginBottom: rv(4), textAlign: 'center' },
  emptyHint: { color: TEXT2, fontSize: rf(12), textAlign: 'center' },

  createBtn:        { backgroundColor: ACCENT, borderRadius: rs(12), padding: rs(16), minHeight: rs(52), alignItems: 'center', justifyContent: 'center' },
  createBtnPressed: { opacity: 0.8 },
  createBtnText:    { color: '#fff', fontSize: rf(15), fontWeight: '800' },

  balanceRow:   { marginHorizontal: rs(16), marginTop: rv(20), flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: SURFACE, borderRadius: rs(10), borderWidth: 1, borderColor: BORDER, paddingHorizontal: rs(16), paddingVertical: rs(12) },
  balanceLabel: { color: TEXT2, fontSize: rf(13) },
  balanceValue: { color: '#c9a84c', fontSize: rf(14), fontWeight: '800' },

  toast:     { position: 'absolute', bottom: rv(24), alignSelf: 'center', backgroundColor: 'rgba(30,15,5,0.92)', borderRadius: rs(20), paddingHorizontal: rs(20), paddingVertical: rs(10), borderWidth: 1, borderColor: BORDER },
  toastText: { color: TEXT, fontSize: rf(13), textAlign: 'center' },
});
