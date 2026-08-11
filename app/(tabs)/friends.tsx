/**
 * FRIENDS tab = CLUBS — VAMOS-CAPS-FRIENDS-CLUBS (TASK A).
 *
 * A club is a closed circle of friends who play only among themselves with their own
 * private mini-league. This tab lists the clubs you're in (my_clubs), and lets you
 * create a club (create_club) or join one by code (join_club). Tapping a club opens its
 * detail (members, mini-league, club tables). The global Leaderboard, Invite Friends, and
 * the one-off private table moved to the PLAY tab.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet, TextInput, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { rf, rs, rv } from '../../utils/responsive';
import { useGameStore } from '../../store/gameStore';
import { getSupabase } from '../../utils/supabase';
import { getDeviceId } from '../../utils/leaderboard';
import { track } from '../../utils/analytics';
import { myClubs, createClub, joinClub, Club } from '../../utils/clubApi';

export default function FriendsScreen() {
  const router = useRouter();
  const playerName = useGameStore((s) => s.playerName);

  const [clubs, setClubs] = useState<Club[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [newName, setNewName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const userIdRef = useRef<string | null>(null);
  const deviceIdRef = useRef<string | null>(null);

  const load = useCallback(async () => {
    // Resolve the ids INLINE before querying — never depend on the refs being pre-populated.
    // This was the bug: the mount effect kicked off the async getDeviceId()/getUser() but
    // called load() synchronously before their .then() set the refs, so the FIRST load ran
    // myClubs(null, null) → [] → an existing member saw "You're not in a club yet". It only
    // self-healed on a later focus once the refs had settled. (Same mount-hydration race as
    // the home-selector B fix.) Resolving here guarantees the first load has the real ids.
    const deviceId = deviceIdRef.current ?? (await getDeviceId().catch(() => null));
    deviceIdRef.current = deviceId;
    let userId = userIdRef.current;
    if (userId == null) {
      try { userId = (await getSupabase()?.auth.getUser())?.data?.user?.id ?? null; } catch { userId = null; }
      userIdRef.current = userId;
    }
    const rows = await myClubs(deviceId, userId);
    setClubs(rows);
    setLoading(false);
  }, []);

  useEffect(() => {
    import('../../utils/analytics').then(({ track }) => track('screen_view', {}, 'friends')).catch(() => {});
    void load();
  }, [load]);

  // Refresh the club list (member counts, new clubs) whenever the tab regains focus.
  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const openClub = useCallback((c: Club) => {
    router.push({ pathname: '/club/[code]', params: { code: c.club_code, name: c.name } } as any);
  }, [router]);

  const handleCreate = useCallback(async () => {
    const name = newName.trim();
    if (busy || !name) return;
    setBusy(true);
    try {
      const res = await createClub(name, deviceIdRef.current, userIdRef.current, playerName || 'Player');
      if (res?.ok && res.club_code) {
        track('club_created', { club_code: res.club_code }, 'friends');
        setNewName('');
        await load();
        openClub({ id: res.id || '', club_code: res.club_code, name: res.name || name, member_count: 1, is_owner: true });
      } else {
        Alert.alert('Could not create club', 'Please try again.');
      }
    } finally {
      setBusy(false);
    }
  }, [busy, newName, playerName, load, openClub]);

  const handleJoin = useCallback(async () => {
    const code = joinCode.trim().toUpperCase();
    if (busy || !code) return;
    setBusy(true);
    try {
      const res = await joinClub(code, deviceIdRef.current, userIdRef.current, playerName || 'Player');
      if (res?.ok && res.club_code) {
        track('club_joined', { club_code: res.club_code, already_member: res.already_member === true }, 'friends');
        setJoinCode('');
        await load();
        openClub({ id: res.id || '', club_code: res.club_code, name: res.name || 'Club', member_count: 0, is_owner: false });
      } else {
        Alert.alert('Club not found', 'Check the code and try again.');
      }
    } finally {
      setBusy(false);
    }
  }, [busy, joinCode, playerName, load, openClub]);

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title} accessibilityRole="header">CLUBS</Text>
      <Text style={styles.sub}>Your circle · play only your friends</Text>

      {/* EMPTY-STATE CENTRING. Measured at 390px: content ended at y=307 with 455px of nothing
          below it before the tab bar — the largest empty band in the app, and what Roye
          reported as "unnecessary spacing". Diagnosed, not assumed: the scroller's
          scrollHeight equals its clientHeight, so nothing is clipped or scrollable and no
          content is being pushed off — the screen genuinely has little content and pins it to
          the top.
          So the fix is CENTRING, never filler: flexGrow makes the content container fill the
          scroll frame, and justifyContent centres what little there is inside it. Applied ONLY
          while the club list is empty — once a member has clubs the list must read top-down
          like any list, so this must not become unconditional.
          The "CLUBS" title and subtitle (:104-105) sit OUTSIDE this ScrollView and stay put. */}
      <ScrollView
        contentContainerStyle={[
          { paddingBottom: rs(30) },
          !loading && clubs.length === 0 && { flexGrow: 1, justifyContent: 'center' },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* My clubs */}
        {loading ? (
          <View style={styles.center}><ActivityIndicator color="#4FD6A8" /></View>
        ) : clubs.length === 0 ? (
          <Text style={styles.empty}>You're not in a club yet — create one or join with a code.</Text>
        ) : (
          clubs.map((c) => (
            <Pressable key={c.id} style={styles.clubCard} onPress={() => openClub(c)} accessibilityRole="button" accessibilityLabel={`Open club ${c.name}, ${c.member_count} members`}>
              <Text style={styles.clubEmoji}>{c.is_owner ? '👑' : '🛡️'}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.clubName} numberOfLines={1}>{c.name}</Text>
                <Text style={styles.clubMeta}>#{c.club_code} · {c.member_count} member{c.member_count === 1 ? '' : 's'}{c.is_owner ? ' · owner' : ''}</Text>
              </View>
              <Text style={styles.clubGo}>›</Text>
            </Pressable>
          ))
        )}

        {/* Create a club */}
        <Text style={styles.blockTitle}>Create a Club</Text>
        <View style={styles.row}>
          <TextInput
            value={newName}
            onChangeText={(t) => setNewName(t.slice(0, 24))}
            placeholder="Club name"
            placeholderTextColor="rgba(255,255,255,0.4)"
            style={styles.input}
            accessibilityLabel="New club name"
          />
          <Pressable style={[styles.actBtn, (!newName.trim() || busy) && styles.btnDisabled]} disabled={!newName.trim() || busy} onPress={handleCreate} accessibilityRole="button" accessibilityLabel="Create club">
            <Text style={styles.actBtnText}>Create</Text>
          </Pressable>
        </View>

        {/* Join a club */}
        <Text style={styles.blockTitle}>Join a Club</Text>
        <View style={styles.row}>
          <TextInput
            value={joinCode}
            onChangeText={(t) => setJoinCode(t.toUpperCase().slice(0, 4))}
            placeholder="Enter club code"
            placeholderTextColor="rgba(255,255,255,0.4)"
            autoCapitalize="characters"
            style={[styles.input, { letterSpacing: 2 }]}
            accessibilityLabel="Club code to join"
          />
          <Pressable style={[styles.actBtn, (!joinCode.trim() || busy) && styles.btnDisabled]} disabled={!joinCode.trim() || busy} onPress={handleJoin} accessibilityRole="button" accessibilityLabel="Join club">
            <Text style={styles.actBtnText}>Join</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#161922', paddingHorizontal: rs(20), paddingTop: rs(16) },
  title: { color: '#4FD6A8', fontSize: rf(28), fontWeight: '900', letterSpacing: 4, textAlign: 'center', marginBottom: rs(4) },
  sub: { color: 'rgba(255,255,255,0.75)', fontSize: rf(12), textAlign: 'center', marginBottom: rs(18) },
  center: { paddingVertical: rv(30), alignItems: 'center' },
  empty: { color: 'rgba(255,255,255,0.5)', fontSize: rf(13), textAlign: 'center', paddingVertical: rv(20), fontStyle: 'italic' },
  clubCard: { flexDirection: 'row', alignItems: 'center', gap: rs(12), backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: 'rgba(79,214,168,0.3)', borderRadius: rv(14), padding: rs(14), marginBottom: rs(10) },
  clubEmoji: { fontSize: rf(24) },
  clubName: { color: '#fff', fontSize: rf(16), fontWeight: '700' },
  clubMeta: { color: 'rgba(255,255,255,0.55)', fontSize: rf(11), marginTop: rv(2) },
  clubGo: { color: '#4FD6A8', fontSize: rf(24), fontWeight: '900' },
  blockTitle: { color: '#fff', fontSize: rf(13), fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase', marginTop: rv(16), marginBottom: rv(8) },
  row: { flexDirection: 'row', gap: rs(8) },
  input: { flex: 1, backgroundColor: '#0d0f15', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', borderRadius: rv(10), color: '#fff', paddingHorizontal: rs(12), paddingVertical: rv(10), fontSize: rf(15) },
  // Create 82x39 / Join 67x39 — both 5px under the minimum.
  actBtn: { minHeight: 44, backgroundColor: 'rgba(79,214,168,0.15)', borderWidth: 1, borderColor: 'rgba(79,214,168,0.35)', borderRadius: rv(10), paddingHorizontal: rs(18), justifyContent: 'center' },
  actBtnText: { color: '#4FD6A8', fontWeight: '800', fontSize: rf(14) },
  btnDisabled: { opacity: 0.5 },
});
