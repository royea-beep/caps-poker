import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../../components/Button';
import { useGameStore } from '../../store/gameStore';
import { COLORS, getBoardCount } from '../../constants/gameConfig';
import { ECONOMY_FLAGS } from '../../constants/economyConfig';
import { getMatchCost, canAffordMatch } from '../../utils/economy';
import { GameServer, ConnectedClient } from '../../utils/gameServer';
import { CapsHooks } from '../../utils/learning';

export default function HostLobbyScreen() {
  const router = useRouter();
  const config = useGameStore((s) => s.config);
  const setMultiplayerMode = useGameStore((s) => s.setMultiplayerMode);
  const setRoomCode = useGameStore((s) => s.setRoomCode);
  const setHostIP = useGameStore((s) => s.setHostIP);
  const setConnectedPlayers = useGameStore((s) => s.setConnectedPlayers);
  const setMpServer = useGameStore((s) => s.setMpServer);
  const resetMultiplayer = useGameStore((s) => s.resetMultiplayer);

  const [maxPlayers, setMaxPlayers] = useState<2 | 3 | 4>(2);
  const [hostIP, setHostIPLocal] = useState<string>('...');
  const [roomCode, setRoomCodeLocal] = useState<string>('...');
  const [players, setPlayers] = useState<ConnectedClient[]>([]);
  const [serverStarted, setServerStarted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const serverRef = useRef<GameServer | null>(null);

  const startServer = useCallback(async () => {
    try {
      const server = new GameServer(
        {
          onPlayerJoined: (player) => {
            setPlayers((prev) => [...prev.filter((p) => p.id !== player.id), player]);
          },
          onPlayerLeft: (playerId) => {
            setPlayers((prev) =>
              prev.map((p) => (p.id === playerId ? { ...p, connected: false } : p))
            );
          },
          onPlayerReady: () => {
            setPlayers((prev) => [...prev]); // force re-render
          },
          onAllPlayersReady: () => {
            // Will be handled when host starts game
          },
          onError: (err) => {
            setError(err.message);
          },
          onRoomStateChanged: (clients) => {
            setPlayers([...clients]);
          },
        },
        'Host',
        maxPlayers
      );

      const ip = await server.start();
      serverRef.current = server;
      setMpServer(server);
      setHostIPLocal(ip);
      setRoomCodeLocal(server.getRoomCode());
      setServerStarted(true);

      // Update store
      setMultiplayerMode('host');
      setRoomCode(server.getRoomCode());
      setHostIP(ip);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start server');
    }
  }, [maxPlayers]);

  useEffect(() => {
    startServer();
    return () => {
      serverRef.current?.stop();
    };
  }, []);

  const connectedCount = players.filter((p) => p.connected).length;
  const canStart = connectedCount >= 2;

  const handleStartGame = useCallback(() => {
    if (!serverRef.current || !canStart) return;

    // Affordability gate (only when economy match cost is enabled)
    if (ECONOMY_FLAGS.matchCostEnabled) {
      const cost = getMatchCost(config.potPerBoard, getBoardCount(connectedCount as 2 | 3 | 4));
      if (!canAffordMatch(useGameStore.getState().chips, cost)) {
        Alert.alert('Not Enough Chips', `You need ${cost} chips to start a game.`);
        return;
      }
    }

    // Update store with player info
    setConnectedPlayers(
      players
        .filter((p) => p.connected)
        .map((p) => ({
          id: p.id,
          name: p.name,
          isHost: p.isHost,
          isReady: false,
          seat: p.seat,
          connected: true,
        }))
    );

    CapsHooks.multiplayerJoined(serverRef.current.getRoomCode(), 'tcp');
    serverRef.current.startGame(config);
    const { boards, playerHands } = serverRef.current.getDealtCards();

    // Navigate to multiplayer game as host
    router.replace({
      pathname: '/multiplayer-game',
      params: {
        isHost: 'true',
        playerIndex: '0',
        playerCount: connectedCount.toString(),
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
  }, [players, canStart, config, connectedCount]);

  const handleCancel = useCallback(() => {
    serverRef.current?.stop();
    resetMultiplayer();
    router.back();
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>HOST GAME</Text>

        {error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        <View style={styles.codeSection}>
          <Text style={styles.codeLabel}>ROOM CODE</Text>
          <Text style={styles.codeValue}>{roomCode}</Text>
          <Text style={styles.ipLabel}>Host IP: {hostIP}</Text>
        </View>

        <View style={styles.playerCountSection}>
          <Text style={styles.sectionLabel}>MAX PLAYERS</Text>
          <View style={styles.playerCountRow}>
            {([2, 3, 4] as const).map((n) => (
              <Button
                key={n}
                title={`${n}`}
                variant={maxPlayers === n ? 'gold' : 'secondary'}
                onPress={() => setMaxPlayers(n)}
                disabled={serverStarted && connectedCount > n}
                style={styles.countBtn}
              />
            ))}
          </View>
        </View>

        <View style={styles.playersSection}>
          <Text style={styles.sectionLabel}>
            PLAYERS ({connectedCount}/{maxPlayers})
          </Text>
          {players
            .filter((p) => p.connected)
            .map((player) => (
              <View key={player.id} style={styles.playerRow}>
                <View style={styles.playerSeat}>
                  <Text style={styles.seatText}>{player.seat + 1}</Text>
                </View>
                <Text style={styles.playerName}>{player.name}</Text>
                {player.isHost && <Text style={styles.hostBadge}>HOST</Text>}
                {player.isReady && <Text style={styles.readyBadge}>READY</Text>}
              </View>
            ))}
          {connectedCount < maxPlayers && (
            <Text style={styles.waitingText}>
              Waiting for {maxPlayers - connectedCount} more player
              {maxPlayers - connectedCount > 1 ? 's' : ''}...
            </Text>
          )}
        </View>

        <View style={styles.buttons}>
          <Button
            title={canStart ? 'START GAME' : `Need ${2 - connectedCount} more`}
            variant="gold"
            disabled={!canStart}
            onPress={handleStartGame}
          />
          <Button title="Cancel" variant="secondary" onPress={handleCancel} />
        </View>
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
  codeSection: {
    alignItems: 'center',
    backgroundColor: COLORS.feltLight,
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.boardBorder,
  },
  codeLabel: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 3,
  },
  codeValue: {
    color: COLORS.goldBright,
    fontSize: 48,
    fontWeight: '900',
    letterSpacing: 16,
    marginVertical: 8,
  },
  ipLabel: {
    color: COLORS.textSecondary,
    fontSize: 13,
    fontFamily: 'monospace',
  },
  playerCountSection: {
    gap: 8,
  },
  sectionLabel: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 2,
  },
  playerCountRow: {
    flexDirection: 'row',
    gap: 8,
  },
  countBtn: {
    flex: 1,
    paddingVertical: 10,
  },
  playersSection: {
    flex: 1,
    gap: 8,
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
  readyBadge: {
    color: COLORS.success,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
  },
  waitingText: {
    color: COLORS.textSecondary,
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
  },
  buttons: {
    gap: 10,
  },
});
