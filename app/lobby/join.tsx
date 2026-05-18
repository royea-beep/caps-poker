import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View, Text, TextInput, StyleSheet, ActivityIndicator, Pressable, Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { rv, rf, rs } from '../../utils/responsive';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../../components/Button';
import { useGameStore } from '../../store/gameStore';
import { COLORS } from '../../constants/gameConfig';
import { GameClient } from '../../utils/gameClient';
import { CapsHooks } from '../../utils/learning';
import { findLocalHost, MP_ERRORS } from '../../utils/localNetwork';
import {
  RoomJoinAckPayload,
  RoomStatePayload,
  CardsDealtPayload,
} from '../../constants/networkConfig';

type ConnectionStatus = 'idle' | 'scanning' | 'connecting' | 'connected' | 'error';

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
  const [scanProgress, setScanProgress] = useState(0);
  const [showManual, setShowManual] = useState(false);

  const clientRef = useRef<GameClient | null>(null);
  const codeInputRef = useRef<TextInput>(null);

  useEffect(() => {
    // Auto-focus room code input
    setTimeout(() => codeInputRef.current?.focus(), 300);
  }, []);

  const doConnect = useCallback(async (resolvedIP: string, code: string) => {
    setStatus('connecting');
    setErrorMsg(null);

    const playerName = useGameStore.getState().playerName || 'Guest';

    const client = new GameClient(
      {
        onConnected: (ack: RoomJoinAckPayload) => {
          setStatus('connected');
          setMultiplayerMode('guest');
          setRoomCode(ack.roomCode);
          setHostIP(resolvedIP);
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
          router.replace({
            pathname: '/multiplayer-game',
            params: {
              isHost: 'false',
              playerIndex: String(data.yourSeat ?? 1),
              playerCount: String(data.playerCount),
              yourCards: JSON.stringify(data.yourCards),
              boards: JSON.stringify(data.boards),
            },
          });
        },
        onAllReady: () => {},
        onBoardReveal: () => {},
        onHandComplete: () => {},
        onPlayerDisconnected: () => {},
        onReconnecting: (attempt: number) => {
          setStatus('connecting');
          setErrorMsg(`Reconnecting... (${attempt}/3)`);
        },
        onDisconnected: () => {
          setStatus('error');
          setErrorMsg(MP_ERRORS.HOST_LEFT);
        },
        onError: (err: Error) => {
          setStatus('error');
          const msg = err.message.toLowerCase();
          if (msg.includes('refused') || msg.includes('timeout')) {
            setErrorMsg(MP_ERRORS.CONNECTION_TIMEOUT);
          } else if (msg.includes('room code') || msg.includes('invalid')) {
            setErrorMsg(MP_ERRORS.WRONG_CODE);
          } else {
            setErrorMsg(err.message);
          }
        },
      },
      playerName
    );

    clientRef.current = client;
    setMpClient(client);

    try {
      await client.connect(resolvedIP, code);
    } catch (err) {
      setStatus('error');
      const msg = err instanceof Error ? err.message : 'Connection failed';
      setErrorMsg(msg.includes('refused') ? MP_ERRORS.CONNECTION_TIMEOUT : msg);
    }
  }, []);

  // Auto-discover host via subnet scan
  const handleFindAndJoin = useCallback(async () => {
    const code = roomCodeInput.trim();
    if (code.length < 4) {
      setErrorMsg('Enter the 4-digit room code first');
      return;
    }

    if (Platform.OS === 'web') {
      setErrorMsg('WiFi discovery only works on mobile. Enter the host IP manually.');
      setShowManual(true);
      return;
    }

    setStatus('scanning');
    setErrorMsg(null);
    setScanProgress(0);

    const foundIP = await findLocalHost(code, (checked, total) => {
      setScanProgress(Math.round((checked / total) * 100));
    });

    if (!foundIP) {
      setStatus('error');
      setErrorMsg(MP_ERRORS.CONNECTION_TIMEOUT);
      return;
    }

    setHostIPInput(foundIP);
    await doConnect(foundIP, code);
  }, [roomCodeInput, doConnect]);

  // Manual connect (fallback)
  const handleManualConnect = useCallback(async () => {
    const ip = hostIPInput.trim();
    const code = roomCodeInput.trim();
    if (!ip || !code) return;
    await doConnect(ip, code);
  }, [hostIPInput, roomCodeInput, doConnect]);

  const handleCancel = useCallback(() => {
    clientRef.current?.disconnect();
    resetMultiplayer();
    router.back();
  }, []);

  const isConnected = status === 'connected';
  const isScanning = status === 'scanning';
  const isBusy = status === 'scanning' || status === 'connecting';

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title} accessibilityRole="header">JOIN GAME</Text>

        {!isConnected && (
          <>
            {/* Room code input */}
            <View style={styles.inputSection}>
              <Text style={styles.inputLabel}>ROOM CODE</Text>
              <TextInput
                ref={codeInputRef}
                style={styles.codeInput}
                value={roomCodeInput}
                onChangeText={(v) => setRoomCodeInput(v.replace(/\D/g, '').slice(0, 4))}
                placeholder="1234"
                placeholderTextColor={COLORS.textPrimary}
                keyboardType="numeric"
                maxLength={4}
                editable={!isBusy}
                returnKeyType="go"
                onSubmitEditing={handleFindAndJoin}
                accessibilityLabel="Room code"
                accessibilityState={{ disabled: isBusy }}
              />
            </View>

            {/* Auto-discover button */}
            {Platform.OS !== 'web' && !showManual && (
              <Button
                title={
                  isScanning
                    ? `Scanning network... ${scanProgress}%`
                    : 'Find Host & Join'
                }
                variant="gold"
                onPress={handleFindAndJoin}
                disabled={isBusy || roomCodeInput.length < 4}
                loading={isScanning}
              />
            )}

            {/* Toggle manual IP entry */}
            {!showManual && (
              <Pressable onPress={() => setShowManual(true)} hitSlop={8} accessibilityRole="button" accessibilityLabel="Enter IP manually">
                <Text style={styles.manualToggle}>
                  {Platform.OS === 'web' ? 'Enter host IP' : 'Enter IP manually instead'}
                </Text>
              </Pressable>
            )}

            {/* Manual IP input (fallback) */}
            {showManual && (
              <>
                <View style={styles.inputSection}>
                  <Text style={styles.inputLabel}>HOST IP ADDRESS</Text>
                  <TextInput
                    style={styles.ipInput}
                    value={hostIPInput}
                    onChangeText={setHostIPInput}
                    placeholder="192.168.1.x"
                    placeholderTextColor={COLORS.textPrimary}
                    keyboardType="numeric"
                    autoCorrect={false}
                    editable={!isBusy}
                    accessibilityLabel="Host IP address"
                    accessibilityState={{ disabled: isBusy }}
                  />
                </View>
                <Button
                  title={status === 'connecting' ? 'Connecting...' : 'Connect'}
                  variant="gold"
                  onPress={handleManualConnect}
                  disabled={!hostIPInput.trim() || !roomCodeInput.trim() || isBusy}
                  loading={status === 'connecting'}
                />
              </>
            )}
          </>
        )}

        {errorMsg && (
          <View style={styles.errorBox} accessibilityLiveRegion="assertive">
            <Text style={styles.errorText}>{errorMsg}</Text>
            {(errorMsg.includes('not find') || errorMsg.includes('timeout')) && (
              <Text style={styles.errorHint}>{MP_ERRORS.NO_WIFI}</Text>
            )}
          </View>
        )}

        {/* Scanning progress */}
        {isScanning && (
          <View style={styles.scanStatus} accessibilityLiveRegion="polite">
            <ActivityIndicator size="small" color={COLORS.gold} />
            <Text style={styles.scanText}>Scanning network for host...</Text>
          </View>
        )}

        {/* Connected state */}
        {isConnected && roomState && (
          <View style={styles.connectedSection}>
            <View style={styles.connectedBadge} accessibilityLiveRegion="assertive">
              <Text style={styles.connectedText}>✓ CONNECTED</Text>
            </View>

            <Text style={styles.roomInfo}>
              Room: {roomState.roomCode} · Host: {roomState.hostName}
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
                    {player.seat === 0 && <Text style={styles.hostBadge}>HOST</Text>}
                  </View>
                ))}
            </View>

            <View style={styles.waitingRow} accessibilityLiveRegion="polite">
              <ActivityIndicator size="small" color={COLORS.gold} />
              <Text style={styles.waitingText}>
                {waitingForGame ? 'Game starting...' : 'Waiting for host to start...'}
              </Text>
            </View>
          </View>
        )}

        <Button title="ביטול" variant="secondary" onPress={handleCancel} />
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
    padding: rs(24),
    gap: rs(16),
  },
  title: {
    fontSize: rf(22),
    fontWeight: '900',
    color: COLORS.goldBright,
    letterSpacing: 6,
    textAlign: 'center',
  },
  inputSection: {
    gap: rs(6),
  },
  inputLabel: {
    color: COLORS.textSecondary,
    fontSize: rf(11),
    fontWeight: '700',
    letterSpacing: 2,
  },
  codeInput: {
    backgroundColor: COLORS.feltLight,
    color: COLORS.goldBright,
    fontSize: rf(40),
    fontWeight: '900',
    letterSpacing: 16,
    textAlign: 'center',
    padding: rs(16),
    borderRadius: rv(12),
    borderWidth: 1.5,
    borderColor: COLORS.gold,
  },
  ipInput: {
    backgroundColor: COLORS.feltLight,
    color: COLORS.textPrimary,
    fontSize: rf(18),
    fontWeight: '600',
    padding: rs(14),
    borderRadius: rv(10),
    borderWidth: 1,
    borderColor: COLORS.boardBorder,
  },
  manualToggle: {
    color: COLORS.textPrimary,
    fontSize: rf(12),
    textAlign: 'center',
    textDecorationLine: 'underline',
  },
  errorBox: {
    backgroundColor: 'rgba(231, 76, 60, 0.12)',
    padding: rs(12),
    borderRadius: rv(8),
    borderWidth: 1,
    borderColor: COLORS.danger,
    gap: rs(4),
  },
  errorText: {
    color: COLORS.danger,
    fontSize: rf(13),
    fontWeight: '700',
    textAlign: 'center',
  },
  errorHint: {
    color: COLORS.textPrimary,
    fontSize: rf(11),
    textAlign: 'center',
  },
  scanStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: rs(10),
    justifyContent: 'center',
  },
  scanText: {
    color: COLORS.textSecondary,
    fontSize: rf(13),
  },
  connectedSection: {
    flex: 1,
    gap: rs(14),
  },
  connectedBadge: {
    backgroundColor: COLORS.success,
    paddingVertical: rs(8),
    paddingHorizontal: rs(16),
    borderRadius: rv(8),
    alignSelf: 'center',
  },
  connectedText: {
    color: COLORS.white,
    fontSize: rf(14),
    fontWeight: '800',
    letterSpacing: 2,
  },
  roomInfo: {
    color: COLORS.textSecondary,
    fontSize: rf(13),
    textAlign: 'center',
  },
  playersSection: {
    gap: rs(8),
  },
  sectionLabel: {
    color: COLORS.textSecondary,
    fontSize: rf(11),
    fontWeight: '700',
    letterSpacing: 2,
  },
  playerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.feltLight,
    padding: rs(12),
    borderRadius: rv(8),
    borderWidth: 1,
    borderColor: COLORS.boardBorder,
    gap: rs(10),
  },
  playerSeat: {
    width: rv(28),
    height: rv(28),
    borderRadius: rv(14),
    backgroundColor: COLORS.gold,
    justifyContent: 'center',
    alignItems: 'center',
  },
  seatText: {
    color: COLORS.background,
    fontSize: rf(14),
    fontWeight: '800',
  },
  playerName: {
    color: COLORS.textPrimary,
    fontSize: rf(16),
    fontWeight: '600',
    flex: 1,
  },
  hostBadge: {
    color: COLORS.gold,
    fontSize: rf(11),
    fontWeight: '800',
    letterSpacing: 1,
  },
  waitingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: rs(10),
    justifyContent: 'center',
  },
  waitingText: {
    color: COLORS.textSecondary,
    fontSize: rf(14),
  },
});
