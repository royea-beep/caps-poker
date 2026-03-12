import React, { useState, useRef, useCallback } from 'react';
import { View, Text, TextInput, StyleSheet, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../../components/Button';
import { useGameStore } from '../../store/gameStore';
import { COLORS } from '../../constants/gameConfig';
import { RealtimeClient, isOnlineMultiplayerAvailable } from '../../utils/realtimeMultiplayer';

export default function InternetJoinScreen() {
  const router = useRouter();
  const playerName = useGameStore((s) => s.playerName) || 'Guest';
  const setMpClient = useGameStore((s) => s.setMpClient);
  const setMultiplayerMode = useGameStore((s) => s.setMultiplayerMode);
  const setRoomCode = useGameStore((s) => s.setRoomCode);

  const [code, setCode] = useState('');
  const [status, setStatus] = useState<'idle' | 'connecting' | 'connected' | 'error'>('idle');
  const [players, setPlayers] = useState<{ id: string; name: string }[]>([]);
  const clientRef = useRef<RealtimeClient | null>(null);

  const handleJoin = useCallback(async () => {
    const trimmed = code.trim().toUpperCase();
    if (trimmed.length < 4) {
      Alert.alert('Invalid Code', 'Enter the room code from the host.');
      return;
    }

    if (!isOnlineMultiplayerAvailable()) {
      Alert.alert('Not Available', 'Online multiplayer requires Supabase configuration.');
      return;
    }

    setStatus('connecting');

    const client = new RealtimeClient();
    clientRef.current = client;

    client.onPresenceChange((p) => setPlayers(p));

    const ok = await client.connect(trimmed, playerName);
    if (ok) {
      setStatus('connected');
      setMpClient(client);
      setMultiplayerMode('guest');
      setRoomCode(trimmed);
    } else {
      setStatus('error');
      Alert.alert('Connection Failed', 'Could not join room. Check the code and try again.');
    }
  }, [code, playerName, setMpClient, setMultiplayerMode, setRoomCode]);

  const handleCancel = useCallback(() => {
    if (clientRef.current) {
      clientRef.current.disconnect();
    }
    useGameStore.getState().resetMultiplayer();
    router.back();
  }, [router]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Button
          title="Cancel"
          variant="ghost"
          onPress={handleCancel}
          style={{ paddingVertical: 6 }}
        />
        <Text style={styles.title}>JOIN ONLINE</Text>
        <View style={{ width: 60 }} />
      </View>

      <View style={styles.content}>
        <Text style={styles.label}>ENTER ROOM CODE</Text>
        <TextInput
          style={styles.codeInput}
          value={code}
          onChangeText={(t) => setCode(t.toUpperCase().slice(0, 6))}
          placeholder="ABCDEF"
          placeholderTextColor={COLORS.textMuted}
          autoCapitalize="characters"
          maxLength={6}
          autoFocus
        />

        {status === 'idle' && (
          <Button
            title="JOIN"
            variant="gold"
            onPress={handleJoin}
            disabled={code.trim().length < 4}
            style={{ width: '100%', marginTop: 16 }}
          />
        )}

        {status === 'connecting' && (
          <Text style={styles.statusText}>Connecting...</Text>
        )}

        {status === 'connected' && (
          <>
            <View style={styles.divider} />
            <Text style={styles.label}>PLAYERS ({players.length})</Text>
            {players.map((p) => (
              <View key={p.id} style={styles.playerRow}>
                <Text style={styles.playerName}>{p.name}</Text>
              </View>
            ))}
            <Text style={styles.statusText}>Waiting for host to start...</Text>
          </>
        )}

        {status === 'error' && (
          <Button
            title="TRY AGAIN"
            variant="secondary"
            onPress={() => setStatus('idle')}
            style={{ marginTop: 16 }}
          />
        )}
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
  codeInput: {
    backgroundColor: COLORS.feltLight,
    color: COLORS.goldBright,
    fontSize: 36,
    fontWeight: '900',
    letterSpacing: 10,
    textAlign: 'center',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: COLORS.boardBorder,
    width: '100%',
    marginTop: 8,
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
});
