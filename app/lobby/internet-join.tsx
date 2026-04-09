import React, { useState, useRef, useCallback } from 'react';
import { View, Text, TextInput, StyleSheet, Alert, Modal, TouchableOpacity, Platform } from 'react-native';
import { rf, rs, rv } from '../../utils/responsive';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../../components/Button';
import { useGameStore } from '../../store/gameStore';
import { COLORS } from '../../constants/gameConfig';
import { RealtimeClient, isOnlineMultiplayerAvailable, GameStateSnapshot } from '../../utils/realtimeMultiplayer';
import { CapsHooks } from '../../utils/learning';
import ProQuoteBanner from '../../components/ProQuoteBanner';

// Lazy-load expo-camera — not available on web, requires native build
let CameraView: any = null;
let useCameraPermissions: any = null;
if (Platform.OS !== 'web') {
  try {
    const cam = require('expo-camera');
    CameraView = cam.CameraView;
    useCameraPermissions = cam.useCameraPermissions;
  } catch {}
}

export default function InternetJoinScreen() {
  const router = useRouter();
  const { prefillCode } = useLocalSearchParams<{ prefillCode?: string }>();
  const playerName = useGameStore((s) => s.playerName) || 'Guest';
  const setMpClient = useGameStore((s) => s.setMpClient);
  const setMultiplayerMode = useGameStore((s) => s.setMultiplayerMode);
  const setRoomCode = useGameStore((s) => s.setRoomCode);
  const setConnectedPlayers = useGameStore((s) => s.setConnectedPlayers);

  const [code, setCode] = useState(prefillCode || '');
  const [status, setStatus] = useState<'idle' | 'connecting' | 'connected' | 'error'>('idle');
  const [players, setPlayers] = useState<{ id: string; name: string }[]>([]);
  const clientRef = useRef<RealtimeClient | null>(null);
  const [scanning, setScanning] = useState(false);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions ? useCameraPermissions() : [null, async () => {}];

  const handleJoin = useCallback(async () => {
    const trimmed = code.trim();

    // Validate room code format: 4-6 digits (matching generateOnlineRoomCode)
    if (trimmed.length !== 6 || !/^[0-9]{6}$/.test(trimmed)) {
      Alert.alert('Invalid Code', 'Enter the 6-digit room code from the host.');
      return;
    }

    if (!isOnlineMultiplayerAvailable()) {
      Alert.alert('Not Available', 'Online multiplayer requires Supabase configuration.');
      return;
    }

    setStatus('connecting');

    const client = new RealtimeClient();
    clientRef.current = client;

    client.onPresenceChange((p) => {
      setPlayers(p);
    });

    // Register callbacks BEFORE connect to eliminate race window (CAPS 08)
    client.updateCallbacks({
      onCardsDealt: (data: any) => {
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
      // Consume host-authoritative seat mapping (CAPS 09)
      onRoomState: (players: { id: string; name: string; seat: number; isHost: boolean }[]) => {
        setConnectedPlayers(
          players.map((p) => ({
            id: p.id,
            name: p.name,
            isHost: p.isHost,
            isReady: false,
            seat: p.seat,
            connected: true,
          }))
        );
      },
      // Mid-game rejoin via snapshot (CAPS 12)
      onGameStateSnapshot: (snapshot: GameStateSnapshot) => {
        if (snapshot.phase === 'arranging' || snapshot.phase === 'waiting') {
          router.replace({
            pathname: '/multiplayer-game',
            params: {
              isHost: 'false',
              playerIndex: String(snapshot.playerIndex),
              playerCount: String(snapshot.playerCount),
              yourCards: JSON.stringify(snapshot.yourCards),
              boards: JSON.stringify(snapshot.boards),
              // Pass snapshot phase so game screen knows to skip to waiting if already ready
              rejoinPhase: snapshot.alreadyReady ? 'waiting' : snapshot.phase,
            },
          });
        }
        // 'complete' phase: stay in lobby, wait for next CARDS_DEALT
        // 'lobby' phase: server doesn't send snapshot (no-op)
      },
      // Host-lost detection in lobby (CAPS 10)
      onHostLost: () => {
        client.disconnect();
        clientRef.current = null;
        setStatus('error');
        Alert.alert('Host Left', 'The host has closed the room.');
      },
      onDisconnected: () => {
        client.disconnect();
        clientRef.current = null;
        setStatus('error');
        Alert.alert('Connection Lost', 'Lost connection to the game room.');
      },
    });

    const ok = await client.connect(trimmed, playerName);

    if (ok) {
      setStatus('connected');
      setMpClient(client);
      setMultiplayerMode('guest');
      setRoomCode(trimmed);
      CapsHooks.multiplayerJoined(trimmed, 'realtime');
    } else {
      // Clean up failed client
      client.disconnect();
      clientRef.current = null;
      setStatus('error');
      Alert.alert('Room Not Found', 'Could not find that room. Check the code and make sure the host is online.');
    }
  }, [code, playerName, setMpClient, setMultiplayerMode, setRoomCode, setConnectedPlayers, router]);

  const openScanner = useCallback(async () => {
    if (!CameraView) return; // not available on web/native build needed
    if (!cameraPermission?.granted) {
      const result = await requestCameraPermission();
      if (!result.granted) return;
    }
    setScanning(true);
  }, [cameraPermission, requestCameraPermission]);

  const handleQRScanned = useCallback(({ data }: { data: string }) => {
    if (!scanning) return;
    const parsed = data.replace('caps://join/', '').replace(/[^0-9]/g, '').slice(0, 6);
    if (parsed.length === 6) {
      setCode(parsed);
      setScanning(false);
    }
  }, [scanning]);

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
          onChangeText={(t) => setCode(t.replace(/[^0-9]/g, '').slice(0, 6))}
          placeholder="123456"
          placeholderTextColor={COLORS.textMuted}
          keyboardType="number-pad"
          maxLength={6}
          autoFocus
        />

        {/* QR Scan button — native only (S108) */}
        {CameraView && status === 'idle' && (
          <TouchableOpacity style={styles.scanBtn} onPress={openScanner}>
            <Text style={styles.scanBtnText}>📷 Scan QR Code</Text>
          </TouchableOpacity>
        )}

        {status === 'idle' && (
          <View style={styles.actionRow}>
            <Button
              title="JOIN"
              variant="gold"
              onPress={handleJoin}
              disabled={code.trim().length < 6}
              style={{ flex: 1 }}
            />
            <Button
              title="WATCH"
              variant="secondary"
              onPress={() => {
                const trimmed = code.trim();
                if (trimmed.length < 6) return;
                router.push({ pathname: '/spectate', params: { roomCode: trimmed } } as any);
              }}
              disabled={code.trim().length < 6}
              style={{ flex: 1 }}
            />
          </View>
        )}

        {/* QR Scanner modal */}
        {scanning && CameraView && (
          <Modal visible transparent animationType="fade" onRequestClose={() => setScanning(false)}>
            <View style={styles.scanModal}>
              <CameraView
                style={StyleSheet.absoluteFillObject}
                facing="back"
                onBarcodeScanned={handleQRScanned}
                barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
              />
              <View style={styles.scanOverlay}>
                <View style={styles.scanFrame} />
                <Text style={styles.scanHint}>Point at the QR code from the host</Text>
                <TouchableOpacity style={styles.scanClose} onPress={() => setScanning(false)}>
                  <Text style={styles.scanCloseText}>✕ Cancel</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Modal>
        )}

        {status === 'connecting' && (
          <Text style={styles.statusText}>Connecting...</Text>
        )}

        {status === 'connected' && (
          <>
            {/* S116: Connected! banner */}
            <View style={styles.connectedBanner}>
              <Text style={styles.connectedIcon}>✓</Text>
              <View>
                <Text style={styles.connectedText}>Connected!</Text>
                <Text style={styles.connectedSub}>
                  {players.length > 0
                    ? `Waiting for ${players.find(p => p.id !== players[players.length - 1]?.id)?.name ?? 'host'} to start...`
                    : 'Waiting for host to start...'}
                </Text>
              </View>
            </View>
            <View style={styles.divider} />
            <Text style={styles.label}>PLAYERS ({players.length})</Text>
            {players.map((p) => (
              <View key={p.id} style={styles.playerRow}>
                <Text style={styles.playerName}>{p.name}</Text>
              </View>
            ))}
            <ProQuoteBanner context="waiting" rotating rotateInterval={6000} />
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
  codeInput: {
    backgroundColor: COLORS.feltLight,
    color: COLORS.goldBright,
    fontSize: rf(36, 24, 44),
    fontWeight: '900',
    letterSpacing: 10,
    textAlign: 'center',
    paddingHorizontal: rs(24),
    paddingVertical: rs(16),
    borderRadius: rv(12),
    borderWidth: 2,
    borderColor: COLORS.boardBorder,
    width: '100%',
    marginTop: rs(8),
  },
  actionRow: {
    flexDirection: 'row',
    gap: rs(10),
    width: '100%',
    marginTop: rs(16),
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
  scanBtn: {
    borderWidth: 1,
    borderColor: COLORS.gold,
    borderRadius: rv(10),
    paddingVertical: rs(10),
    paddingHorizontal: rs(20),
    marginTop: rs(8),
  },
  scanBtnText: {
    color: COLORS.gold,
    fontSize: rf(14),
    fontWeight: '700',
    textAlign: 'center',
  },
  scanModal: {
    flex: 1,
    backgroundColor: '#000',
  },
  scanOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanFrame: {
    width: rs(220),
    height: rs(220),
    borderWidth: 3,
    borderColor: COLORS.gold,
    borderRadius: rs(16),
    backgroundColor: 'transparent',
  },
  scanHint: {
    color: '#fff',
    fontSize: rf(13),
    fontWeight: '600',
    textAlign: 'center',
    marginTop: rs(20),
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: rs(16),
    paddingVertical: rs(6),
    borderRadius: rs(8),
  },
  scanClose: {
    marginTop: rs(24),
    paddingVertical: rs(12),
    paddingHorizontal: rs(32),
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: rs(10),
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  scanCloseText: {
    color: '#fff',
    fontSize: rf(14),
    fontWeight: '700',
  },
  // S116: Connected! banner
  connectedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: rs(12),
    backgroundColor: 'rgba(76,175,80,0.12)',
    borderRadius: rs(12),
    padding: rs(14),
    borderWidth: 0.5,
    borderColor: '#4CAF50',
    marginTop: rs(16),
    width: '100%',
  },
  connectedIcon: {
    fontSize: rf(24),
    color: '#4CAF50',
  },
  connectedText: {
    fontSize: rf(16),
    fontWeight: '700',
    color: '#4CAF50',
  },
  connectedSub: {
    fontSize: rf(12),
    color: 'rgba(76,175,80,0.7)',
    marginTop: rs(2),
  },
});
