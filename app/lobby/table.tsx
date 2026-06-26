/**
 * Table Room — VAMOS-CAPS-MP-LOBBY TASK 3C (game-wiring).
 *
 * The waiting room a player lands in after creating or joining a lobby table.
 * It bridges the game_rooms DISCOVERY layer (RPC seat-claim, browse, codes) to the
 * realtime GAME session: the host runs a RealtimeServer on `caps-room-{roomCode}`,
 * joiners run a RealtimeClient on the same channel. When realtime presence fills to
 * the table size the HOST auto-deals (`server.startGame`) and everyone navigates into
 * the unified `/multiplayer-game` — host-authoritative, shared community boards +
 * private hole cards, reveal → /results.
 *
 * This screen is a thin orchestrator: it reuses the shipped, hardened internet-MP
 * engine (utils/realtimeMultiplayer.ts) and game screen (app/multiplayer-game.tsx)
 * verbatim — the realtime host/guest pattern, unified into the lobby and
 * auto-starting. The placement-timer soft-lock fix (TASK 3D, broadcast OUTSIDE the
 * setState updater) lives in multiplayer-game.tsx and is exercised by this flow.
 *
 * Seat lifecycle: the DB seat (game_rooms / room_players) is freed via leave_table on
 * bail-out. Once we navigate into the game (launchedRef) the realtime connection is
 * owned by the game screen, so unmount does NOT tear it down.
 */
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, Share } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useGameStore } from '../../store/gameStore';
import { COLORS, getBoardCount } from '../../constants/gameConfig';
import { ECONOMY_FLAGS } from '../../constants/economyConfig';
import { getMatchCost, canAffordMatch } from '../../utils/economy';
import {
  RealtimeServer,
  RealtimeClient,
  isOnlineMultiplayerAvailable,
  GameStateSnapshot,
} from '../../utils/realtimeMultiplayer';
import { CapsHooks } from '../../utils/learning';
import { track } from '../../utils/analytics';
import { leaveTable } from '../../utils/lobbyApi';
import { getDeviceId } from '../../utils/leaderboard';
import { getSupabase } from '../../utils/supabase';
import { rf, rs, rv } from '../../utils/responsive';

type PlayerCount = 2 | 3 | 4;

const TYPE_LABEL: Record<PlayerCount, string> = { 2: 'Heads-Up', 3: '3-Player', 4: '4-Player' };

export default function TableRoomScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ roomCode: string; playerCount: string; isHost: string; clubCode?: string }>();
  const roomCode = (params.roomCode || '').toUpperCase();
  const maxPlayers = Math.min(4, Math.max(2, parseInt(params.playerCount || '2', 10))) as PlayerCount;
  const isHost = params.isHost === 'true';
  const clubCode = (params.clubCode || '').toUpperCase() || null;

  const playerName = useGameStore((s) => s.playerName) || (isHost ? 'Host' : 'Guest');
  const setMpServer = useGameStore((s) => s.setMpServer);
  const setMpClient = useGameStore((s) => s.setMpClient);
  const setMultiplayerMode = useGameStore((s) => s.setMultiplayerMode);
  const setRoomCode = useGameStore((s) => s.setRoomCode);
  const setClubCode = useGameStore((s) => s.setClubCode);
  const setConnectedPlayers = useGameStore((s) => s.setConnectedPlayers);
  const updateConfig = useGameStore((s) => s.updateConfig);

  const [players, setPlayers] = useState<{ id: string; name: string }[]>([]);
  const [status, setStatus] = useState<'connecting' | 'waiting' | 'starting' | 'error'>('connecting');
  const [errorMsg, setErrorMsg] = useState('');

  const serverRef = useRef<RealtimeServer | null>(null);
  const clientRef = useRef<RealtimeClient | null>(null);
  const startedRef = useRef(false); // host: deal already fired
  const dealScheduledRef = useRef(false); // host: a deal is queued (settle delay)
  const launchedRef = useRef(false); // navigated into the game — keep the connection alive
  const deviceIdRef = useRef<string | null>(null);
  const userIdRef = useRef<string | null>(null);
  const mountedRef = useRef(true);

  // Bail out of the table: navigate back. The unmount cleanup frees the DB seat and
  // tears down realtime (only when we did NOT launch into the game).
  const bailOut = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace('/lobby' as any);
  }, [router]);

  const handleShare = useCallback(async () => {
    try {
      await Share.share({
        message: `Join my CAPS table! Code: ${roomCode}\nhttps://caps.ftable.co.il`,
        title: 'CAPS Poker — Table Invite',
      });
    } catch {
      /* user cancelled / unavailable */
    }
  }, [roomCode]);

  useEffect(() => {
    mountedRef.current = true;
    if (!roomCode || !isOnlineMultiplayerAvailable()) {
      setStatus('error');
      setErrorMsg('Online multiplayer is unavailable right now.');
      return;
    }

    // Carry the club code (if this is a club table) so record_club_result fires at game end.
    setClubCode(clubCode);

    // Capture ids used to free the DB seat on bail-out.
    getDeviceId().then((d) => { deviceIdRef.current = d; }).catch(() => {});
    getSupabase()?.auth.getUser().then(({ data }) => { userIdRef.current = data?.user?.id ?? null; }).catch(() => {});

    let cancelled = false;

    // --- HOST: open the realtime room, auto-deal when presence fills ---
    const dealAndGo = (server: RealtimeServer) => {
      if (startedRef.current) return;
      // Belt-and-suspenders: the game screen needs mpServer in the store before we
      // navigate (start().then sets it earlier, but guarantee it here too).
      setMpServer(server);
      updateConfig({ numberOfPlayers: maxPlayers });
      const config = useGameStore.getState().config;

      if (ECONOMY_FLAGS.matchCostEnabled) {
        const cost = getMatchCost(config.potPerBoard, getBoardCount(maxPlayers));
        if (!canAffordMatch(useGameStore.getState().chips, cost)) {
          // Surface via the error screen (not Alert.alert — it silently no-ops on web,
          // which would leave the host stuck in 'waiting'). Its "Back to Lobby" button
          // bails out, freeing the DB seat + tearing down realtime on unmount.
          if (mountedRef.current) { setStatus('error'); setErrorMsg(`Not enough chips — you need ${cost} to start this table.`); }
          return;
        }
      }

      startedRef.current = true;
      if (mountedRef.current) setStatus('starting');
      CapsHooks.multiplayerJoined(roomCode, 'realtime');
      track('mp_game_started', { player_count: maxPlayers, room_code: roomCode, role: 'host' }, 'table-room');
      server.startGame(config);

      const { boards, playerHands } = server.getDealtCards();
      launchedRef.current = true;
      router.replace({
        pathname: '/multiplayer-game',
        params: {
          isHost: 'true',
          playerIndex: '0',
          playerCount: String(maxPlayers),
          yourCards: JSON.stringify(playerHands[0]),
          boards: JSON.stringify(
            boards.map((b, i) => ({ boardIndex: i, openCards: b.openCards, closedCardCount: b.closedCards.length }))
          ),
        },
      });
    };

    if (isHost) {
      const server = new RealtimeServer();
      serverRef.current = server;

      server.onPresenceChange((p) => {
        if (cancelled || !mountedRef.current) return;
        setPlayers(p);
        // Mirror the host's authoritative seat map into the store for the game screen.
        const clients = server.getClients();
        setConnectedPlayers(
          clients.map((c) => ({ id: c.id, name: c.name, isHost: c.isHost, isReady: c.isReady, seat: c.seat, connected: c.connected }))
        );
        // Auto-start when everyone is actually connected on the channel. Give the
        // connection a brief moment to settle (ROOM_STATE delivery, guest finishing its
        // subscribe handshake) before dealing, so no one misses the opening broadcasts.
        if (p.length >= maxPlayers && !startedRef.current && !dealScheduledRef.current) {
          dealScheduledRef.current = true;
          setTimeout(() => {
            if (!cancelled && mountedRef.current && !startedRef.current) dealAndGo(server);
          }, 700);
        }
      });

      const onStartFail = () => {
        // Tear down the subscribed channel so it doesn't leak (resetMultiplayer can't —
        // the server was never put in the store on this path).
        try { server.stop(); } catch {}
        serverRef.current = null;
        if (mountedRef.current) { setStatus('error'); setErrorMsg('Could not open the table.'); }
      };
      server.start(roomCode, playerName).then((ok) => {
        if (cancelled) return;
        if (ok) {
          setMpServer(server);
          setMultiplayerMode('host');
          setRoomCode(roomCode);
          // If the host's channel drops while waiting, surface it instead of hanging.
          server.updateCallbacks({
            onDisconnected: () => { if (mountedRef.current && !launchedRef.current) { setStatus('error'); setErrorMsg('Connection to the table was lost.'); } },
          });
          if (mountedRef.current && !startedRef.current) setStatus('waiting');
        } else {
          onStartFail();
        }
      }).catch(() => {
        if (!cancelled) onStartFail();
      });
    } else {
      // --- GUEST: join the realtime room, navigate when the host deals ---
      const client = new RealtimeClient();
      clientRef.current = client;

      // CRITICAL: put the client in the store BEFORE connect(). The host deals the instant
      // our presence appears — onCardsDealt can fire mid-connect and navigate to
      // /multiplayer-game, whose guest effects bail if mpClient is still null (they'd wire
      // NO callbacks → the guest hangs forever waiting for a reveal). Setting it up front
      // means the game screen always finds the live client.
      setMpClient(client);
      setMultiplayerMode('guest');
      setRoomCode(roomCode);

      client.onPresenceChange((p) => {
        if (!cancelled && mountedRef.current) setPlayers(p);
      });

      // Register callbacks BEFORE connect to eliminate the deal race (CAPS 08).
      client.updateCallbacks({
        onCardsDealt: (data: any) => {
          launchedRef.current = true;
          track('mp_game_started', { player_count: maxPlayers, room_code: roomCode, role: 'guest' }, 'table-room');
          router.replace({
            pathname: '/multiplayer-game',
            params: {
              isHost: 'false',
              playerIndex: String(data.playerIndex ?? 1),
              playerCount: String(data.playerCount),
              yourCards: JSON.stringify(data.yourCards),
              boards: JSON.stringify(data.boards),
            },
          });
        },
        onRoomState: (pl: { id: string; name: string; seat: number; isHost: boolean }[]) => {
          setConnectedPlayers(pl.map((p) => ({ id: p.id, name: p.name, isHost: p.isHost, isReady: false, seat: p.seat, connected: true })));
        },
        // Mid-game rejoin via snapshot (CAPS 12).
        onGameStateSnapshot: (snapshot: GameStateSnapshot) => {
          if (snapshot.phase === 'arranging' || snapshot.phase === 'waiting') {
            launchedRef.current = true;
            router.replace({
              pathname: '/multiplayer-game',
              params: {
                isHost: 'false',
                playerIndex: String(snapshot.playerIndex),
                playerCount: String(snapshot.playerCount),
                yourCards: JSON.stringify(snapshot.yourCards),
                boards: JSON.stringify(snapshot.boards),
                rejoinPhase: snapshot.alreadyReady ? 'waiting' : snapshot.phase,
              },
            });
          }
        },
        onHostLost: () => {
          if (!mountedRef.current) return;
          setStatus('error');
          setErrorMsg('The host left the table.');
        },
        onDisconnected: () => {
          if (!mountedRef.current) return;
          setStatus('error');
          setErrorMsg('Lost connection to the table.');
        },
      });

      const onConnectFail = () => {
        // Roll back the optimistic store client (unless we already launched into the game).
        if (!launchedRef.current) { useGameStore.getState().resetMultiplayer(); clientRef.current = null; }
        if (mountedRef.current) { setStatus('error'); setErrorMsg('Table not found or the host is offline.'); }
      };
      client.connect(roomCode, playerName).then((ok) => {
        if (ok) {
          CapsHooks.multiplayerJoined(roomCode, 'realtime');
          if (mountedRef.current && !launchedRef.current) setStatus('waiting');
        } else {
          onConnectFail();
        }
      }).catch(onConnectFail);
    }

    return () => {
      cancelled = true;
      mountedRef.current = false;
      // If we launched into the game, the game screen owns the realtime connection.
      // Otherwise free the DB seat and tear down realtime so no ghost table lingers.
      if (!launchedRef.current) {
        void leaveTable(roomCode, userIdRef.current, deviceIdRef.current);
        useGameStore.getState().resetMultiplayer();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (status === 'error') {
    return (
      <SafeAreaView style={styles.root}>
        <View style={styles.center}>
          <Text style={styles.errorText}>{errorMsg || 'Something went wrong.'}</Text>
          <Pressable style={styles.leaveBtn} onPress={bailOut} accessibilityRole="button" accessibilityLabel="Back to lobby">
            <Text style={styles.leaveText}>Back to Lobby</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const seatsFilled = players.length;

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.header}>
        <Pressable onPress={bailOut} hitSlop={10} accessibilityRole="button" accessibilityLabel="Leave table">
          <Text style={styles.back}>‹ Leave</Text>
        </Pressable>
        <Text style={styles.title} accessibilityRole="header">{TYPE_LABEL[maxPlayers]}</Text>
        <View style={{ width: rs(50) }} />
      </View>

      <View style={styles.center}>
        <Text style={styles.codeLabel}>TABLE CODE — share to invite</Text>
        <Text style={styles.code} accessibilityLabel={`Table code ${roomCode.split('').join(' ')}`}>{roomCode}</Text>
        <Pressable style={styles.shareBtn} onPress={handleShare} accessibilityRole="button" accessibilityLabel="Share table code">
          <Text style={styles.shareText}>📤 Share code</Text>
        </Pressable>

        {/* Seat dots */}
        <View style={styles.seats}>
          {Array.from({ length: maxPlayers }).map((_, i) => (
            <View key={i} style={[styles.seat, i < seatsFilled && styles.seatOn]} />
          ))}
        </View>
        <Text style={styles.count}>{seatsFilled} / {maxPlayers} seated</Text>

        {/* Player names */}
        <View style={styles.playerList}>
          {players.map((p) => (
            <View key={p.id} style={styles.playerRow}>
              <Text style={styles.playerName}>{p.name}</Text>
            </View>
          ))}
        </View>

        <Text style={styles.statusText}>
          {status === 'connecting'
            ? 'Connecting…'
            : status === 'starting'
            ? 'Starting game…'
            : isHost
            ? `Waiting for ${maxPlayers - seatsFilled} more player${maxPlayers - seatsFilled === 1 ? '' : 's'}…`
            : 'Waiting for the table to fill…'}
        </Text>
        <Text style={styles.hint}>The game starts automatically when the table is full.</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: rs(16),
    paddingVertical: rv(10),
  },
  back: { color: COLORS.mintBright, fontSize: rf(16), fontWeight: '700' },
  title: { color: COLORS.mintBright, fontSize: rf(18), fontWeight: '900', letterSpacing: 2 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: rs(24), gap: rv(10) },
  codeLabel: { color: COLORS.textMuted, fontSize: rf(11), letterSpacing: 1, textTransform: 'uppercase' },
  code: { color: COLORS.mintBright, fontSize: rf(46, 30, 54), fontWeight: '900', letterSpacing: 10 },
  shareBtn: {
    backgroundColor: COLORS.feltLight,
    borderWidth: 1,
    borderColor: COLORS.boardBorder,
    borderRadius: rv(10),
    paddingVertical: rv(8),
    paddingHorizontal: rs(18),
  },
  shareText: { color: COLORS.mintBright, fontSize: rf(14), fontWeight: '700' },
  seats: { flexDirection: 'row', gap: rs(10), marginTop: rv(16) },
  seat: { width: rs(20), height: rs(20), borderRadius: rs(10), backgroundColor: '#2a2f3a' },
  seatOn: { backgroundColor: COLORS.mintBright },
  count: { color: COLORS.textPrimary, fontSize: rf(15), fontWeight: '700' },
  playerList: { width: '100%', gap: rv(6), marginTop: rv(8) },
  playerRow: {
    backgroundColor: COLORS.feltLight,
    borderWidth: 1,
    borderColor: COLORS.boardBorder,
    borderRadius: rv(8),
    paddingVertical: rv(10),
    paddingHorizontal: rs(16),
    width: '100%',
  },
  playerName: { color: COLORS.textPrimary, fontSize: rf(15), fontWeight: '600' },
  statusText: { color: COLORS.textSecondary, fontSize: rf(14), marginTop: rv(12), textAlign: 'center' },
  hint: { color: COLORS.textMuted, fontSize: rf(12), fontStyle: 'italic', textAlign: 'center' },
  errorText: { color: COLORS.textSecondary, fontSize: rf(16), textAlign: 'center', marginBottom: rv(16) },
  leaveBtn: {
    borderWidth: 1.5,
    borderColor: COLORS.mintBright,
    borderRadius: rv(12),
    paddingVertical: rv(11),
    paddingHorizontal: rs(24),
  },
  leaveText: { color: COLORS.mintBright, fontSize: rf(15), fontWeight: '800' },
});
