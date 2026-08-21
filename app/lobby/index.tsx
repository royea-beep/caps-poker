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
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator, RefreshControl, Alert, Platform, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { safeBack } from '../../components/BackControl';
import { useGameStore } from '../../store/gameStore';
import { getSupabase } from '../../utils/supabase';
import { getBoardCount } from '../../constants/gameConfig';
import { ECONOMY_FLAGS } from '../../constants/economyConfig';
import { getMatchCost, canAffordMatch } from '../../utils/economy';
import { rf as rfBase, rs as rsBase, rv as rvBase } from '../../utils/responsive';
import { WEB_MAX_WIDTH } from '../../components/WebContainer';
import { track } from '../../utils/analytics';
import { getDeviceId } from '../../utils/leaderboard';
import { listPublicTables, joinTable, groupTablesByType, OpenTable, PlayerCount } from '../../utils/lobbyApi';
import { beginPracticeLive, getPracticeLiveState, isPracticeLiveActive, endPracticeLive } from '../../utils/practiceLiveSession';
import { PRACTICE_LIVE_ENABLED } from '../../constants/featureFlags';
import { useLobbyPresence } from '../../hooks/useLobbyPresence';
import { t } from '../../utils/i18n';

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
  // MP-PARITY-DEEP 2026-07-09 — rs()/rf()/rv() default to a 393pt-wide fallback that's
  // frozen at module load on web (utils/responsive.ts IRON RULE), never the real device
  // width. This screen never overrode it, so every row/font here rendered as if on a
  // 393pt screen regardless of the visiting device — bloated/wrapping text on anything
  // narrower. Same root cause + same "local shadow" fix as game.tsx/GameView/
  // BoardArrangement/Board earlier this project (see game-screen-fit/native-layout-fix).
  // Font sizes get an explicit floor (value-3, min 9) so they don't shrink below legible
  // on the narrowest supported widths — same "font floor" strategy as native-layout-fix.
  // On web the app renders inside a WebContainer capped at WEB_MAX_WIDTH (430) on desktop
  // widths — useWindowDimensions() reports the raw (uncapped) browser width, which is wider
  // than the actual rendered column on desktop, so scaling against it directly makes text
  // wrap WORSE, not better. Clamp the same way results.tsx/PlayerHand.tsx already do.
  const { width: rawScreenW } = useWindowDimensions();
  const screenW = Platform.OS === 'web' ? Math.min(rawScreenW, WEB_MAX_WIDTH) : rawScreenW;
  const rs = useCallback((v: number) => rsBase(v, screenW), [screenW]);
  const rf = useCallback((v: number, floor?: number) => rfBase(v, floor ?? Math.max(9, v - 3), undefined, screenW), [screenW]);
  const rv = useCallback((v: number) => rvBase(v, screenW), [screenW]);
  const styles = useMemo(() => makeStyles(rs, rf, rv), [rs, rf, rv]);
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

  // MP-STABILITY 2026-07-06 (Problem 2 follow-up) — game.tsx's back button and results.tsx's
  // home button no longer auto-evict a held practice-live seat (routing here instead), so this
  // is now the ONLY explicit "leave table" affordance in the app. practiceLiveSession is a
  // module-level singleton with no "state changed" event (only countdown/cancelled/jump/ended),
  // so we poll it rather than subscribe — cheap and simple for a lobby-only banner.
  const [heldSeatRoom, setHeldSeatRoom] = useState<string | null>(null);
  const [leavingSeat, setLeavingSeat] = useState(false);
  useEffect(() => {
    const poll = () => setHeldSeatRoom(isPracticeLiveActive() ? getPracticeLiveState().roomCode : null);
    poll();
    const id = setInterval(poll, 2000);
    return () => clearInterval(id);
  }, []);
  const leaveHeldSeat = useCallback(async () => {
    if (leavingSeat) return;
    setLeavingSeat(true);
    try {
      await endPracticeLive('user_left_lobby');
      setHeldSeatRoom(null);
    } finally {
      setLeavingSeat(false);
    }
  }, [leavingSeat]);

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
        // T1: prefer server-mapped copy (no_session) over the generic wording.
        setJoinError(res?.message ?? 'Table unavailable — try another.');
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
  // DB-sourced only (LOBBY-BOT-WIRE): 3 bot_practice + 6 human rows from
  // list_public_tables. table_kind is AUTHORITATIVE (passthrough live 2026-07-04);
  // the interim host_name='CAPS Bot' string-match is gone.
  const isBotRow = (t: OpenTable) => t.table_kind === 'bot_practice';
  const botTables = tables.filter(isBotRow);
  const humanTables = tables.filter((t) => !isBotRow(t));
  const botSizes: PlayerCount[] = [...new Set(
    botTables
      .map((t) => (t.player_count ?? t.max_players))
      .filter((n): n is PlayerCount => n === 2 || n === 3 || n === 4)
  )].sort((a, b) => a - b);
  const playBot = useCallback(async (n: PlayerCount) => {
    track('bot_table_play', { player_count: n }, 'lobby');
    // PRACTICE-TO-LIVE — the 2P (Heads-Up) bot table holds a REAL realtime seat while you
    // practice, so a human can drop in and both jump into a live game. 3P/4P stay pure
    // local practice. If the seat-hold can't be established (realtime off, no room, join
    // fails), fall back cleanly to pure local practice — never block the practice tap.
    // GATED behind PRACTICE_LIVE_ENABLED: when off, we never call join_table (no seat is
    // held) and every bot row is pure local practice — today's safe behavior.
    if (PRACTICE_LIVE_ENABLED && n === 2) {
      const botTable = botTables.find((t) => (t.player_count ?? t.max_players) === 2);
      if (botTable?.room_code) {
        try {
          const res = await joinTable(botTable.room_code, userIdRef.current, playerName || 'Player', deviceIdRef.current);
          if (res?.room_code) {
            const held = await beginPracticeLive({ roomCode: res.room_code, isHost: !!res.is_host, playerName: playerName || 'Player' });
            if (held) {
              router.push(`/game?practice=true&players=2&fresh=1&live=1` as any);
              return;
            }
          }
        } catch { /* fall through to local practice */ }
      }
    }
    router.push(`/game?practice=true&players=${n}&fresh=1` as any); // fresh=1 resets the demo session counter
  }, [router, botTables, playerName]);

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
        {/* LOBBY-LABEL 2026-08-09 — the destination of the home "משחק אונליין" CTA was itself
            all-English. Same path, same problem, fixed together. */}
        {/* Measured 60x21 at 390px and 49x17 at 320px — the smallest control found anywhere in
            the app, and the only way back out of the lobby. hitSlop={10} was already here and
            does nothing on web (react-native-web ignores it), which is exactly how it stayed
            this small unnoticed. Real height now; hitSlop kept for native. This sits alone at
            the left of the header row, so growing it compresses no neighbour. */}
        <Pressable
          // SETTINGS-STRIP 2026-08-21 — was a bare router.back(). ScreenHeader carries a DEAD-END FIX from
          // 2026-08-13 for exactly this: a cold load (deep link, refresh, shared URL) leaves the history
          // stack empty and router.back() silently does nothing. 17 screens are guarded; this one and
          // lobby/private were the two that kept their own header and missed it.
          onPress={safeBack}
          hitSlop={10}
          style={{ minHeight: 44, minWidth: 44, justifyContent: 'center' }}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
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

      {/* Held practice-live seat — the only explicit way to give it up now that back/home
          route here instead of auto-evicting (MP-STABILITY 2026-07-06). */}
      {heldSeatRoom && (
        <View style={styles.heldSeatBanner} accessibilityLiveRegion="polite">
          <Text style={styles.heldSeatText}>You're holding your seat at table {heldSeatRoom}</Text>
          <Pressable
            style={[styles.heldSeatLeaveBtn, leavingSeat && styles.btnDisabled]}
            disabled={leavingSeat}
            onPress={leaveHeldSeat}
            accessibilityRole="button"
            accessibilityLabel="Leave table"
          >
            <Text style={styles.heldSeatLeaveText}>Leave table</Text>
          </Pressable>
        </View>
      )}

      {/* Inline join feedback — replaces the silent-on-web Alert.alert. */}
      {joinError && (
        <View style={styles.errorBanner} accessibilityLiveRegion="polite">
          <Text style={styles.errorBannerText}>{joinError}</Text>
        </View>
      )}

      {/* 🤖 Bot practice — DB-seeded rows, one clearly labeled instant table per size.
          Practice: XP only, no chips (economy-neutral). Hidden if the DB has none. */}
      {botSizes.length > 0 && <View style={styles.botSection}>
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
              <Text style={styles.botRowTitle}>Practice vs Bots</Text>
              <Text style={styles.botRowSub}>{t().botRowSub(n, getBoardCount(n))}</Text>
            </View>
            <View style={styles.botPlayBtn}><Text style={styles.botPlayText}>Play now</Text></View>
          </Pressable>
        ))}
      </View>}

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
                      // Measured 64x31 at 390px and 52x26 at 320px — both under the 44px
                      // minimum on the vertical axis, on the primary action of this screen,
                      // repeated once per table. hitSlop rather than bigger padding: it takes
                      // the touch area to 51px / 46px without changing the pill's appearance
                      // or reflowing the row (the width already clears 44).
                      hitSlop={{ top: 10, bottom: 10, left: 4, right: 4 }}
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

// MP-PARITY-DEEP 2026-07-09 — factored into a function so it can be called per-render
// with the real reactive rs/rf/rv shadows (see PublicLobby's useMemo above). Every
// rs(/rf(/rv( call below is unchanged from the old static StyleSheet.create — only the
// wrapping declaration changed, so it now closes over whichever rs/rf/rv is passed in.
function makeStyles(rs: (v: number) => number, rf: (v: number, floor?: number) => number, rv: (v: number) => number) {
  return StyleSheet.create({
  root: { flex: 1, backgroundColor: '#161922' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: rs(16), paddingTop: rv(8) },
  back: { color: '#4FD6A8', fontSize: rf(16), fontWeight: '600', width: rs(60) },
  title: { color: '#4FD6A8', fontSize: rf(24), fontWeight: '900', letterSpacing: 3 },
  // rf(11) clamps to [8.25, 13.75] and rendered 9px at 320px. The earlier sweep floored the
  // rf(10) styles but missed these two, because rf(11) looks safe until you do the arithmetic.
  sub: { color: 'rgba(255,255,255,0.6)', fontSize: rf(11, 10), textAlign: 'center', marginTop: rv(2), marginBottom: rv(10) },
  liveRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: rs(6), marginTop: rv(-4), marginBottom: rv(10) },
  liveDot: { width: rs(8), height: rs(8), borderRadius: rs(4), backgroundColor: '#3DDC84' },
  liveText: { color: '#3DDC84', fontSize: rf(11, 10), fontWeight: '700', letterSpacing: 0.3 },
  // LOBBY-BOT-PRACTICE — amber bot palette, visually distinct from the mint human tables
  botSection: { marginHorizontal: rs(16), marginBottom: rv(8) },
  botHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: rv(6) },
  // POLISH-1 (3b) — bot practice is the SAME action as the Home "Practice vs Bots" button,
  // so it wears the same green identity (#22C55E) instead of the old amber, which read as a
  // different feature.
  botTitle: { color: '#4ADE80', fontSize: rf(13), fontWeight: '900', letterSpacing: 1 },
  // rf(v) clamps to [v*0.75, v*1.25], so every rf(10) here rendered at 9px on a 320px phone —
  // measured, 8 separate strings, i.e. essentially the whole lobby. That is the screen a friend
  // opens to join a game. The second argument is an explicit floor: 10px minimum regardless of
  // width. Copy only; decorative glyphs are left alone.
  botMeta: { color: 'rgba(255,255,255,0.5)', fontSize: rf(10, 10) },
  // 294x41 at 320px — 3px short, and only at 320 (rv(8) padding scales down with width, so it
  // passed at 390 and failed on a small phone). These rows are the primary way into a solo game
  // from the lobby. minHeight rather than more padding, so the fix cannot scale away again.
  botRow: { flexDirection: 'row', alignItems: 'center', gap: rs(10), backgroundColor: 'rgba(34,197,94,0.10)', borderWidth: 1, borderColor: 'rgba(34,197,94,0.45)', borderRadius: rv(12), paddingVertical: rv(8), paddingHorizontal: rs(12), marginBottom: rv(6), minHeight: 44 },
  botBadge: { backgroundColor: 'rgba(34,197,94,0.20)', borderWidth: 1, borderColor: 'rgba(34,197,94,0.55)', borderRadius: rv(7), paddingHorizontal: rs(8), paddingVertical: rv(3) },
  botBadgeText: { color: '#4ADE80', fontSize: rf(10, 10), fontWeight: '900', letterSpacing: 0.5 },
  botRowTitle: { color: '#fff', fontSize: rf(14), fontWeight: '700' },
  // OTA-COSMETIC-FIXES 2026-07-09 — explicit 11pt floor (was rf(10), which floors to 9
  // via the default v-3 floor) so the shortened subtitle never drops below 11pt at 320.
  botRowSub: { color: 'rgba(255,255,255,0.55)', fontSize: rf(11, 11), marginTop: rv(1) },
  botPlayBtn: { backgroundColor: '#22C55E', borderRadius: rv(9), paddingHorizontal: rs(14), paddingVertical: rv(7) },
  botPlayText: { color: '#ffffff', fontSize: rf(13), fontWeight: '900' },
  humanHead: { marginHorizontal: rs(16), marginTop: rv(4), marginBottom: rv(2) },
  humanTitle: { color: '#4FD6A8', fontSize: rf(13), fontWeight: '900', letterSpacing: 1 },
  humanSub: { color: 'rgba(255,255,255,0.6)', fontSize: rf(10, 10), marginTop: rv(2) },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  soloBtn: { flexDirection: 'row', alignItems: 'center', gap: rs(12), marginHorizontal: rs(16), marginBottom: rv(8), backgroundColor: 'rgba(245,181,70,0.12)', borderWidth: 1.5, borderColor: 'rgba(245,181,70,0.55)', borderRadius: rv(14), paddingVertical: rv(12), paddingHorizontal: rs(16) },
  soloEmoji: { fontSize: rf(24) },
  soloTitle: { color: '#F5B546', fontSize: rf(15), fontWeight: '800' },
  soloSub: { color: 'rgba(255,255,255,0.7)', fontSize: rf(11), marginTop: rv(1) },
  soloGo: { color: '#F5B546', fontSize: rf(26), fontWeight: '900' },
  section: { marginBottom: rv(18) },
  sectionHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: rv(6) },
  sectionTitle: { color: '#fff', fontSize: rf(13), fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase' },
  sectionMeta: { color: 'rgba(255,255,255,0.5)', fontSize: rf(10, 10) },
  table: { flexDirection: 'row', alignItems: 'center', gap: rs(12), backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', borderRadius: rv(12), padding: rs(12), marginBottom: rv(8) },
  tablePlaceholder: { opacity: 0.5 },
  seats: { flexDirection: 'row', gap: rs(5) },
  seat: { width: rs(13), height: rs(13), borderRadius: rs(7), backgroundColor: '#2a2f3a' },
  seatOn: { backgroundColor: '#4FD6A8' },
  tableInfo: { flex: 1 },
  tableCount: { color: '#fff', fontSize: rf(14), fontWeight: '700' },
  tableCountMuted: { color: 'rgba(255,255,255,0.5)', fontSize: rf(13), fontStyle: 'italic' },
  tableSub: { color: 'rgba(255,255,255,0.5)', fontSize: rf(10, 10) },
  // Measured 64x31 at 390px and 52x26 at 320px — under the 44px minimum on the primary action
  // of this screen, once per table. hitSlop was tried first and is retained for native, but
  // react-native-web does not implement it, so on the channel testers actually use the box was
  // still 31px. Real height now. minHeight/minWidth rather than padding: rs()/rv() scale with
  // width, so padding alone passes at 390 and fails again at 320.
  joinBtn: { backgroundColor: '#4FD6A8', borderRadius: rv(10), paddingHorizontal: rs(16), paddingVertical: rv(8), minWidth: 64, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
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
  heldSeatBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: rs(16),
    marginBottom: rv(8),
    paddingVertical: rv(8),
    paddingHorizontal: rs(12),
    backgroundColor: 'rgba(79,214,168,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(79,214,168,0.45)',
    borderRadius: rv(10),
  },
  heldSeatText: { flex: 1, color: '#4FD6A8', fontSize: rf(12), fontWeight: '700' },
  heldSeatLeaveBtn: {
    marginLeft: rs(10),
    paddingVertical: rv(6),
    paddingHorizontal: rs(12),
    backgroundColor: 'rgba(239,68,68,0.85)',
    borderRadius: rv(8),
  },
  heldSeatLeaveText: { color: '#FFFEF8', fontSize: rf(12), fontWeight: '700' },
  });
}
