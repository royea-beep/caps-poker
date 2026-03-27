import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, Alert, Clipboard, Share, Platform, Pressable, Linking } from 'react-native';
import { rf, rs, rv } from '../../utils/responsive';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../../components/Button';
import { useGameStore } from '../../store/gameStore';
import { COLORS, getBoardCount } from '../../constants/gameConfig';
import { ECONOMY_FLAGS } from '../../constants/economyConfig';
import { getMatchCost, canAffordMatch } from '../../utils/economy';
import {
  RealtimeServer,
  generateOnlineRoomCode,
  isOnlineMultiplayerAvailable,
} from '../../utils/realtimeMultiplayer';
import { CapsHooks } from '../../utils/learning';
import { getSupabase } from '../../utils/supabase';

export default function InternetHostScreen() {
  const router = useRouter();
  const playerName = useGameStore((s) => s.playerName) || 'Host';
  const setMpServer = useGameStore((s) => s.setMpServer);
  const setMultiplayerMode = useGameStore((s) => s.setMultiplayerMode);
  const setRoomCode = useGameStore((s) => s.setRoomCode);
  const setConnectedPlayers = useGameStore((s) => s.setConnectedPlayers);

  const [roomCode, setLocalRoomCode] = useState('');
  const [players, setPlayers] = useState<{ id: string; name: string }[]>([]);
  const [status, setStatus] = useState<'creating' | 'waiting' | 'error'>('creating');
  const serverRef = useRef<RealtimeServer | null>(null);

  useEffect(() => {
    if (!isOnlineMultiplayerAvailable()) {
      setStatus('error');
      return;
    }

    let cancelled = false;
    const server = new RealtimeServer();
    serverRef.current = server;
    const code = generateOnlineRoomCode();
    setLocalRoomCode(code);

    server.onPresenceChange((p) => {
      if (cancelled) return;
      setPlayers(p);
      // Use server's authoritative seat assignments (CAPS 09)
      const clients = server.getClients();
      setConnectedPlayers(
        clients.map((c) => ({
          id: c.id,
          name: c.name,
          isHost: c.isHost,
          isReady: c.isReady,
          seat: c.seat,
          connected: c.connected,
        }))
      );
    });

    server.start(code, playerName).then((ok) => {
      if (cancelled) return;
      if (ok) {
        setStatus('waiting');
        setMpServer(server);
        setMultiplayerMode('host');
        setRoomCode(code);
      } else {
        server.stop();
        serverRef.current = null;
        setStatus('error');
      }
    }).catch(() => {
      if (cancelled) return;
      server.stop();
      serverRef.current = null;
      setStatus('error');
    });

    return () => {
      cancelled = true;
      // Don't stop server on unmount — it lives in Zustand
    };
  }, []);

  const handleStart = useCallback(() => {
    const server = serverRef.current;
    if (!server) return;

    if (players.length < 2) {
      Alert.alert('Need Players', 'Wait for at least one player to join.');
      return;
    }

    const config = useGameStore.getState().config;

    // Affordability gate (only when economy match cost is enabled)
    if (ECONOMY_FLAGS.matchCostEnabled) {
      const playerCount = Math.min(4, Math.max(2, players.length)) as 2 | 3 | 4;
      const cost = getMatchCost(config.potPerBoard, getBoardCount(playerCount));
      if (!canAffordMatch(useGameStore.getState().chips, cost)) {
        Alert.alert('Not Enough Chips', `You need ${cost} chips to start a game.`);
        return;
      }
    }

    // Use server-driven game start — deals cards, broadcasts to guests
    CapsHooks.multiplayerJoined(roomCode, 'realtime');
    server.startGame(config);

    // Mark session as playing in Supabase
    const sb = getSupabase();
    if (sb && roomCode) {
      void sb.from('sit_and_go_sessions')
        .update({ status: 'playing' })
        .eq('room_code', roomCode);
    }

    // Read host's dealt data from server state
    const { boards, playerHands } = server.getDealtCards();
    const playerCount = Math.min(4, Math.max(2, players.length)) as 2 | 3 | 4;

    // Navigate host to multiplayer game with params
    router.replace({
      pathname: '/multiplayer-game',
      params: {
        isHost: 'true',
        playerIndex: '0',
        playerCount: playerCount.toString(),
        yourCards: JSON.stringify(playerHands[0]),
        boards: JSON.stringify(
          boards.map((b, i) => ({
            boardIndex: i,
            openCards: b.openCards,
            closedCardCount: b.closedCards.length,
          }))
        ),
      },
    });
  }, [players, router]);

  const handleCopy = useCallback(() => {
    if (Platform.OS === 'web') {
      navigator.clipboard?.writeText(roomCode).catch(() => {});
    } else {
      Clipboard.setString(roomCode);
    }
    Alert.alert('Copied!', `Room code ${roomCode} copied to clipboard.`);
  }, [roomCode]);

  const handleShare = useCallback(async () => {
    try {
      await Share.share({
        message: `Join my CAPS game! Room: ${roomCode}\nDownload: https://caps.ftable.co.il\nTestFlight: https://testflight.apple.com/join/hD3KvZeC`,
        title: 'CAPS Poker — Room Invite',
      });
    } catch {}
  }, [roomCode]);

  const shareToWhatsApp = useCallback(() => {
    const message = `היי! בוא תנסה את CAPS Poker 🂣
קוד חדר: ${roomCode}
להורדה: https://caps.ftable.co.il`;
    Linking.openURL(`whatsapp://send?text=${encodeURIComponent(message)}`).catch(() => {
      Alert.alert('WhatsApp לא זמין', 'אנא וודא ש-WhatsApp מותקן');
    });
  }, [roomCode]);

  const handleCancel = useCallback(() => {
    if (serverRef.current) {
      serverRef.current.stop();
    }
    useGameStore.getState().resetMultiplayer();
    router.back();
  }, [router]);

  if (status === 'error') {
    const hasSupabase = isOnlineMultiplayerAvailable();
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.content}>
          <Text style={styles.errorText}>
            {hasSupabase
              ? 'Could not create room. Check your internet connection.'
              : 'Online multiplayer requires Supabase configuration.'}
          </Text>
          {!hasSupabase && (
            <Text style={styles.hintText}>
              Add SUPABASE_URL and SUPABASE_ANON_KEY to .env
            </Text>
          )}
          <Button title="Back" variant="ghost" onPress={() => router.back()} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Button
          title="Cancel"
          variant="ghost"
          onPress={handleCancel}
          style={{ paddingVertical: 6 }}
        />
        <Text style={styles.title}>HOST ONLINE</Text>
        <View style={{ width: 60 }} />
      </View>

      <View style={styles.content}>
        <Text style={styles.label}>ROOM CODE</Text>
        <Text style={styles.roomCode}>{roomCode}</Text>
        <Text style={styles.shareHint}>Share this code with friends anywhere</Text>

        <View style={styles.codeActions}>
          <Pressable onPress={handleCopy} style={styles.codeActionBtn}>
            <Text style={styles.codeActionText}>📋 COPY</Text>
          </Pressable>
          <Pressable onPress={handleShare} style={styles.codeActionBtn}>
            <Text style={styles.codeActionText}>📤 SHARE</Text>
          </Pressable>
          <Pressable onPress={shareToWhatsApp} style={[styles.codeActionBtn, styles.whatsappBtn]}>
            <Text style={styles.whatsappBtnText}>💬 שתף בווטסאפ</Text>
          </Pressable>
        </View>

        <View style={styles.divider} />

        <Text style={styles.label}>PLAYERS ({players.length})</Text>
        {players.map((p) => (
          <View key={p.id} style={styles.playerRow}>
            <Text style={styles.playerName}>{p.name}</Text>
          </View>
        ))}

        {status === 'creating' && (
          <Text style={styles.statusText}>Creating room...</Text>
        )}
        {status === 'waiting' && players.length < 2 && (
          <Text style={styles.statusText}>Waiting for players...</Text>
        )}
      </View>

      <View style={styles.footer}>
        <Button
          title="START GAME"
          variant="gold"
          onPress={handleStart}
          disabled={players.length < 2}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: rs(16),
    paddingVertical: rs(12),
    borderBottomWidth: 1,
    borderBottomColor: COLORS.boardBorder,
  },
  title: {
    color: COLORS.goldBright,
    fontSize: rf(18),
    fontWeight: '900',
    letterSpacing: 4,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    padding: rs(24),
    gap: rs(8),
  },
  label: {
    color: COLORS.textSecondary,
    fontSize: rf(12),
    fontWeight: '700',
    letterSpacing: 2,
    marginTop: rs(16),
  },
  roomCode: {
    color: COLORS.goldBright,
    fontSize: rf(48, 32, 56),
    fontWeight: '900',
    letterSpacing: 12,
    marginVertical: rs(8),
  },
  shareHint: {
    color: COLORS.textMuted,
    fontSize: rf(13),
    fontStyle: 'italic',
  },
  divider: {
    width: '80%',
    height: 1,
    backgroundColor: COLORS.boardBorder,
    marginVertical: rs(20),
  },
  playerRow: {
    backgroundColor: COLORS.feltLight,
    paddingHorizontal: rs(20),
    paddingVertical: rs(10),
    borderRadius: rv(8),
    borderWidth: 1,
    borderColor: COLORS.boardBorder,
    width: '100%',
    marginBottom: rs(6),
  },
  playerName: {
    color: COLORS.textPrimary,
    fontSize: rf(16),
    fontWeight: '600',
  },
  statusText: {
    color: COLORS.textSecondary,
    fontSize: rf(14),
    marginTop: rs(12),
  },
  footer: {
    padding: rs(16),
  },
  errorText: {
    color: COLORS.textSecondary,
    fontSize: rf(16),
    textAlign: 'center',
    marginBottom: rs(12),
  },
  hintText: {
    color: COLORS.textMuted,
    fontSize: rf(13),
    textAlign: 'center',
    marginBottom: rs(20),
  },
  codeActions: {
    flexDirection: 'row',
    gap: rs(12),
    marginTop: rs(4),
  },
  codeActionBtn: {
    backgroundColor: COLORS.feltLight,
    borderRadius: rv(8),
    borderWidth: 1,
    borderColor: COLORS.boardBorder,
    paddingVertical: rs(10),
    paddingHorizontal: rs(20),
  },
  codeActionText: {
    color: COLORS.goldBright,
    fontSize: rf(14),
    fontWeight: '700',
    letterSpacing: 1,
  },
  whatsappBtn: {
    backgroundColor: '#128C7E',
    borderColor: '#128C7E',
  },
  whatsappBtnText: {
    color: '#FFFFFF',
    fontSize: rf(14),
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});
