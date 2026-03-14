import React, { useState, useRef, useCallback } from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../../components/Button';
import { useGameStore } from '../../store/gameStore';
import { COLORS } from '../../constants/gameConfig';
import { GameClient } from '../../utils/gameClient';
import { CapsHooks } from '../../utils/learning';
import {
  RoomJoinAckPayload,
  RoomStatePayload,
  CardsDealtPayload,
} from '../../constants/networkConfig';

type ConnectionStatus = 'idle' | 'connecting' | 'connected' | 'error';

export default function JoinLobbyScreen() {
  const router = useRouter();
  const setMultiplayerMode = useGameStore((s) => s.setMultiplayerMode);
  const setRoomCode = useGameStore((s) => s.setRoomCode);
  const setHostIP = useGameStore((s) => s.setHostIP);
  const setConnectedPlayers = useGameStore((s) => s.setConnectedPlayers);
  const setMpClient = useGameStore((s) => s.setMpClient);
  const resetMultiplayer = useGameStore((s) => s.resetMultiplayer);

  const [hostIPInput, setHostIPInput] = useState('');
  const [roomCodeInput, setRoomCodeInput] = useState('');
  const [status, setStatus] = useState<ConnectionStatus>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [roomState, setRoomState] = useState<RoomStatePayload | null>(null);
  const [waitingForGame, setWaitingForGame] = useState(false);

  const clientRef = useRef<GameClient | null>(null);

  const handleConnect = useCallback(async () => {
    if (!hostIPInput.trim() || !roomCodeInput.trim()) return;

    setStatus('connecting');
    setErrorMsg(null);

    const client = new GameClient(
      {
        onConnected: (ack: RoomJoinAckPayload) => {
          setStatus('connected');
          setMultiplayerMode('guest');
          setRoomCode(ack.roomCode);
          setHostIP(hostIPInput.trim());
          CapsHooks.multiplayerJoined(ack.roomCode, 'tcp');
        },
        onRoomState: (state: RoomStatePayload) => {
          setRoomState(state);
          setConnectedPlayers(
            state.players.map((p) => ({
              id: p.id,
              name: p.name,
              isHost: p.seat === 0,
              isReady: p.isReady,
              seat: p.seat,
              connected: p.connected,
            }))
          );
        },
        onGameStart: () => {
          setWaitingForGame(true);
        },
        onCardsDealt: (data: CardsDealtPayload) => {
          // Navigate to multiplayer game as guest
          router.replace({
            pathname: '/multiplayer-game',
            params: {
              isHost: 'false',
              playerIndex: String(
                roomState?.players.find(
                  (p) => p.id === client.getPlayerId()
                )?.seat ?? 1
              ),
              playerCount: String(data.playerCount),
              yourCards: JSON.stringify(data.yourCards),
              boards: JSON.stringify(data.boards),
            },
          });
        },
        onAllReady: () => {
          // Handled by multiplayer-game screen
        },
        onBoardReveal: () => {
          // Handled by multiplayer-game screen
        },
        onHandComplete: () => {
          // Handled by multiplayer-game screen
        },
        onPlayerDisconnected: () => {
          // Show in room state
        },
        onReconnecting: (attempt: number) => {
          setStatus('connecting');
          setErrorMsg(`Reconnecting... (attempt ${attempt}/${3})`);
        },
        onDisconnected: () => {
          setStatus('error');
          setErrorMsg('Disconnected from host');
        },
        onError: (err: Error) => {
          setStatus('error');
          setErrorMsg(err.message);
        },
      },
      'Guest'
    );

    clientRef.current = client;
    setMpClient(client);

    try {
      await client.connect(hostIPInput.trim(), roomCodeInput.trim());
    } catch (err) {
      setStatus('error');
      setErrorMsg(err instanceof Error ? err.message : 'Connection failed');
    }
  }, [hostIPInput, roomCodeInput]);

  const handleCancel = useCallback(() => {
    clientRef.current?.disconnect();
    resetMultiplayer();
    router.back();
  }, []);

  const isConnected = status === 'connected';

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>JOIN GAME</Text>

        {!isConnected && (
          <>
            <View style={styles.inputSection}>
              <Text style={styles.inputLabel}>HOST IP ADDRESS</Text>
              <TextInput
                style={styles.input}
                value={hostIPInput}
                onChangeText={setHostIPInput}
                placeholder="192.168.1.x"
                placeholderTextColor={COLORS.textSecondary}
                keyboardType="numeric"
                autoCorrect={false}
                editable={status !== 'connecting'}
              />
            </View>

            <View style={styles.inputSection}>
              <Text style={styles.inputLabel}>ROOM CODE</Text>
              <TextInput
                style={[styles.input, styles.codeInput]}
                value={roomCodeInput}
                onChangeText={setRoomCodeInput}
                placeholder="123456"
                placeholderTextColor={COLORS.textSecondary}
                keyboardType="numeric"
                maxLength={6}
                editable={status !== 'connecting'}
              />
            </View>

            <Button
              title={status === 'connecting' ? 'Connecting...' : 'Connect'}
              variant="gold"
              onPress={handleConnect}
              disabled={
                !hostIPInput.trim() ||
                !roomCodeInput.trim() ||
                status === 'connecting'
              }
              loading={status === 'connecting'}
            />
          </>
        )}

        {errorMsg && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{errorMsg}</Text>
          </View>
        )}

        {isConnected && roomState && (
          <View style={styles.connectedSection}>
            <View style={styles.connectedBadge}>
              <Text style={styles.connectedText}>CONNECTED</Text>
            </View>

            <Text style={styles.roomInfo}>
              Room: {roomState.roomCode} | Host: {roomState.hostName}
            </Text>

            <View style={styles.playersSection}>
              <Text style={styles.sectionLabel}>
                PLAYERS ({roomState.playerCount}/{roomState.maxPlayers})
              </Text>
              {roomState.players
                .filter((p) => p.connected)
                .map((player) => (
                  <View key={player.id} style={styles.playerRow}>
                    <View style={styles.playerSeat}>
                      <Text style={styles.seatText}>{player.seat + 1}</Text>
                    </View>
                    <Text style={styles.playerName}>{player.name}</Text>
                    {player.seat === 0 && (
                      <Text style={styles.hostBadge}>HOST</Text>
                    )}
                  </View>
                ))}
            </View>

            <Text style={styles.waitingText}>
              {waitingForGame
                ? 'Game starting...'
                : 'Waiting for host to start...'}
            </Text>
          </View>
        )}

        <Button title="Cancel" variant="secondary" onPress={handleCancel} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    flex: 1,
    padding: 24,
    gap: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: '900',
    color: COLORS.goldBright,
    letterSpacing: 6,
    textAlign: 'center',
  },
  inputSection: {
    gap: 6,
  },
  inputLabel: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 2,
  },
  input: {
    backgroundColor: COLORS.feltLight,
    color: COLORS.textPrimary,
    fontSize: 18,
    fontWeight: '600',
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.boardBorder,
  },
  codeInput: {
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: 12,
    textAlign: 'center',
  },
  errorBox: {
    backgroundColor: 'rgba(231, 76, 60, 0.15)',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.danger,
  },
  errorText: {
    color: COLORS.danger,
    fontSize: 13,
    textAlign: 'center',
  },
  connectedSection: {
    flex: 1,
    gap: 16,
  },
  connectedBadge: {
    backgroundColor: COLORS.success,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignSelf: 'center',
  },
  connectedText: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 2,
  },
  roomInfo: {
    color: COLORS.textSecondary,
    fontSize: 14,
    textAlign: 'center',
  },
  playersSection: {
    gap: 8,
  },
  sectionLabel: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 2,
  },
  playerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.feltLight,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.boardBorder,
    gap: 10,
  },
  playerSeat: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.gold,
    justifyContent: 'center',
    alignItems: 'center',
  },
  seatText: {
    color: COLORS.background,
    fontSize: 14,
    fontWeight: '800',
  },
  playerName: {
    color: COLORS.textPrimary,
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
  },
  hostBadge: {
    color: COLORS.gold,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
  },
  waitingText: {
    color: COLORS.textSecondary,
    fontSize: 16,
    textAlign: 'center',
    marginTop: 12,
  },
});
