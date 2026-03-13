import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../../components/Button';
import { useGameStore } from '../../store/gameStore';
import { COLORS, getBoardCount } from '../../constants/gameConfig';
import { dealCardsMultiplayer } from '../../utils/deck';
import {
  RealtimeServer,
  generateOnlineRoomCode,
  isOnlineMultiplayerAvailable,
} from '../../utils/realtimeMultiplayer';

export default function InternetHostScreen() {
  const router = useRouter();
  const playerName = useGameStore((s) => s.playerName) || 'Host';
  const setMpServer = useGameStore((s) => s.setMpServer);
  const setMultiplayerMode = useGameStore((s) => s.setMultiplayerMode);
  const setRoomCode = useGameStore((s) => s.setRoomCode);

  const [roomCode, setLocalRoomCode] = useState('');
  const [players, setPlayers] = useState<{ id: string; name: string }[]>([]);
  const [status, setStatus] = useState<'creating' | 'waiting' | 'error'>('creating');
  const serverRef = useRef<RealtimeServer | null>(null);

  useEffect(() => {
    if (!isOnlineMultiplayerAvailable()) {
      setStatus('error');
      return;
    }

    const server = new RealtimeServer();
    serverRef.current = server;
    const code = generateOnlineRoomCode();
    setLocalRoomCode(code);

    server.onPresenceChange((p) => setPlayers(p));

    server.start(code, playerName).then((ok) => {
      if (ok) {
        setStatus('waiting');
        setMpServer(server);
        setMultiplayerMode('host');
        setRoomCode(code);
      } else {
        setStatus('error');
      }
    });

    return () => {
      // Don't stop server on unmount — it lives in Zustand
    };
  }, []);

  const handleStart = useCallback(() => {
    if (players.length < 2) {
      Alert.alert('Need Players', 'Wait for at least one player to join.');
      return;
    }

    const playerCount = Math.min(4, Math.max(2, players.length)) as 2 | 3 | 4;
    const deal = dealCardsMultiplayer(playerCount);

    // Broadcast cards to each player
    players.forEach((p, idx) => {
      if (idx === 0) return; // Host is index 0, skip broadcast to self
      serverRef.current?.sendToPlayer(p.id, 'cards_dealt', {
        playerCount,
        yourCards: deal.playerHands[idx],
        boards: deal.boards.map((b, i) => ({
          boardIndex: i,
          openCards: b.openCards,
          closedCardCount: b.closedCards.length,
        })),
        playerIndex: idx,
      });
    });

    // Navigate host to multiplayer game with params
    router.replace({
      pathname: '/multiplayer-game',
      params: {
        isHost: 'true',
        playerIndex: '0',
        playerCount: playerCount.toString(),
        yourCards: JSON.stringify(deal.playerHands[0]),
        boards: JSON.stringify(
          deal.boards.map((b, i) => ({
            boardIndex: i,
            openCards: b.openCards,
            closedCardCount: b.closedCards.length,
          }))
        ),
      },
    });
  }, [players, router]);

  const handleCancel = useCallback(() => {
    if (serverRef.current) {
      serverRef.current.stop();
    }
    useGameStore.getState().resetMultiplayer();
    router.back();
  }, [router]);

  if (status === 'error') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.content}>
          <Text style={styles.errorText}>
            Online multiplayer requires Supabase configuration.
          </Text>
          <Text style={styles.hintText}>
            Add SUPABASE_URL and SUPABASE_ANON_KEY to .env
          </Text>
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
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.boardBorder,
  },
  title: {
    color: COLORS.goldBright,
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 4,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    padding: 24,
    gap: 8,
  },
  label: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 2,
    marginTop: 16,
  },
  roomCode: {
    color: COLORS.goldBright,
    fontSize: 48,
    fontWeight: '900',
    letterSpacing: 12,
    marginVertical: 8,
  },
  shareHint: {
    color: COLORS.textMuted,
    fontSize: 13,
    fontStyle: 'italic',
  },
  divider: {
    width: '80%',
    height: 1,
    backgroundColor: COLORS.boardBorder,
    marginVertical: 20,
  },
  playerRow: {
    backgroundColor: COLORS.feltLight,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.boardBorder,
    width: '100%',
    marginBottom: 6,
  },
  playerName: {
    color: COLORS.textPrimary,
    fontSize: 16,
    fontWeight: '600',
  },
  statusText: {
    color: COLORS.textSecondary,
    fontSize: 14,
    marginTop: 12,
  },
  footer: {
    padding: 16,
  },
  errorText: {
    color: COLORS.textSecondary,
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 12,
  },
  hintText: {
    color: COLORS.textMuted,
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 20,
  },
});
