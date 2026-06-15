import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, ActivityIndicator, Pressable, Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { t } from '../../utils/i18n';
import { rv, rf, rs } from '../../utils/responsive';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../../components/Button';
import { useGameStore } from '../../store/gameStore';
import { COLORS, getBoardCount } from '../../constants/gameConfig';
import { ECONOMY_FLAGS } from '../../constants/economyConfig';
import { getMatchCost, canAffordMatch } from '../../utils/economy';
import { GameServer, ConnectedClient } from '../../utils/gameServer';
import { CapsHooks } from '../../utils/learning';
import ProQuoteBanner from '../../components/ProQuoteBanner';
import { MP_ERRORS } from '../../utils/localNetwork';

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
  const [hostIP, setHostIPLocal] = useState<string>('');
  const [roomCode, setRoomCodeLocal] = useState<string>('...');
  const [players, setPlayers] = useState<ConnectedClient[]>([]);
  const [serverStarted, setServerStarted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const serverRef = useRef<GameServer | null>(null);

  const startServer = useCallback(async () => {
    setError(null);
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
            setPlayers((prev) => [...prev]);
          },
          onAllPlayersReady: () => {},
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
      setHostIPLocal(ip || server.getHostIP());
      setRoomCodeLocal(server.getRoomCode());
      setServerStarted(true);

      setMultiplayerMode('host');
      setRoomCode(server.getRoomCode());
      setHostIP(ip);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : MP_ERRORS.SERVER_START_FAIL
      );
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

    if (ECONOMY_FLAGS.matchCostEnabled) {
      const cost = getMatchCost(config.potPerBoard, getBoardCount(connectedCount as 2 | 3 | 4));
      if (!canAffordMatch(useGameStore.getState().chips, cost)) {
        setError(`Not enough chips. You need ${cost} chips to start.`);
        return;
      }
    }

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
        <Text style={styles.title} accessibilityRole="header">HOST GAME</Text>

        {error && (
          <View style={styles.errorBox} accessibilityLiveRegion="assertive">
            <Text style={styles.errorText}>{error}</Text>
            <Text style={styles.errorHint}>{MP_ERRORS.NO_WIFI}</Text>
          </View>
        )}

        {/* Room code — big and prominent */}
        <View style={styles.codeSection}>
          <Text style={styles.codeLabel}>ROOM CODE</Text>
          <Text style={styles.codeValue}>{roomCode}</Text>
          <Text style={styles.codeHint}>Share this code with your opponent</Text>
          {hostIP ? (
            <Text style={styles.ipLabel}>Your IP: {hostIP}</Text>
          ) : (
            <Text style={styles.ipLabel}>Finding your IP...</Text>
          )}
        </View>

        {/* Max players selector */}
        <View style={styles.playerCountSection}>
          <Text style={styles.sectionLabel} accessibilityRole="header">MAX PLAYERS</Text>
          <View style={styles.playerCountRow}>
            {([2, 3, 4] as const).map((n) => (
              <Button
                key={n}
                title={`${n}P`}
                variant={maxPlayers === n ? 'gold' : 'secondary'}
                onPress={() => setMaxPlayers(n)}
                disabled={serverStarted && connectedCount > n}
                style={styles.countBtn}
                accessibilityState={{ selected: maxPlayers === n }}
              />
            ))}
          </View>
        </View>

        {/* Players + waiting indicator */}
        <View style={styles.playersSection}>
          <View accessibilityLiveRegion="polite">
            <Text style={styles.sectionLabel} accessibilityRole="header">
              PLAYERS ({connectedCount}/{maxPlayers})
            </Text>
          </View>
          {players
            .filter((p) => p.connected)
            .map((player) => (
              <View
                key={player.id}
                style={styles.playerRow}
                accessible={true}
                accessibilityLabel={`Seat ${player.seat + 1}, ${player.name}${player.isHost ? ', host' : ''}${player.isReady ? ', ready' : ''}`}
              >
                <View style={styles.playerSeat}>
                  <Text style={styles.seatText}>{player.seat + 1}</Text>
                </View>
                <Text style={styles.playerName}>{player.name}</Text>
                {player.isHost && <Text style={styles.hostBadge} accessibilityLabel="Host">HOST</Text>}
                {player.isReady && <Text style={styles.readyBadge} accessibilityLabel="Ready">READY</Text>}
              </View>
            ))}
          {connectedCount < maxPlayers && serverStarted && (
            <View style={styles.waitingRow} accessibilityLiveRegion="polite">
              <ActivityIndicator size="small" color={COLORS.mint} />
              <Text style={styles.waitingText}>
                Waiting for {maxPlayers - connectedCount} more player
                {maxPlayers - connectedCount > 1 ? 's' : ''}...
              </Text>
            </View>
          )}
          {connectedCount < maxPlayers && (
            <ProQuoteBanner context="waiting" rotating rotateInterval={6000} />
          )}
        </View>

        <View style={styles.buttons}>
          <Button
            title={canStart ? 'START GAME →' : `Need ${2 - connectedCount} more player${2 - connectedCount !== 1 ? 's' : ''}`}
            variant="gold"
            disabled={!canStart}
            onPress={handleStartGame}
          />
          <Button title={t().cancel} variant="secondary" onPress={handleCancel} />
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
    padding: rs(24),
    gap: rs(16),
  },
  title: {
    fontSize: rf(22),
    fontWeight: '900',
    color: COLORS.mintBright,
    letterSpacing: 6,
    textAlign: 'center',
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
    color: COLORS.textSecondary,
    fontSize: rf(11),
    textAlign: 'center',
    opacity: 0.95,
  },
  codeSection: {
    alignItems: 'center',
    backgroundColor: 'rgba(79,214,168,0.07)',
    padding: rs(24),
    borderRadius: rv(16),
    borderWidth: 1.5,
    borderColor: COLORS.mint,
    gap: rs(4),
    ...Platform.select({
      ios: { shadowColor: COLORS.mint, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 12 },
      android: { elevation: 6 },
      default: { boxShadow: '0 4px 20px rgba(79,214,168,0.2)' } as any,
    }),
  },
  codeLabel: {
    color: COLORS.textSecondary,
    fontSize: rf(11),
    fontWeight: '700',
    letterSpacing: 3,
  },
  codeValue: {
    color: COLORS.mintBright,
    fontSize: rf(56),
    fontWeight: '900',
    letterSpacing: 20,
  },
  codeHint: {
    color: COLORS.textSecondary,
    fontSize: rf(13),
    textAlign: 'center',
    marginTop: rs(4),
  },
  ipLabel: {
    color: COLORS.textSecondary,
    fontSize: rf(12),
    fontFamily: 'monospace',
    opacity: 0.9,
    marginTop: rs(2),
  },
  playerCountSection: {
    gap: rs(8),
  },
  sectionLabel: {
    color: COLORS.textSecondary,
    fontSize: rf(11),
    fontWeight: '700',
    letterSpacing: 2,
  },
  playerCountRow: {
    flexDirection: 'row',
    gap: rs(8),
  },
  countBtn: {
    flex: 1,
    paddingVertical: rs(10),
    minHeight: 44,
  },
  playersSection: {
    flex: 1,
    gap: rs(8),
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
    backgroundColor: COLORS.mint,
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
    color: COLORS.mint,
    fontSize: rf(11),
    fontWeight: '800',
    letterSpacing: 1,
  },
  readyBadge: {
    color: COLORS.success,
    fontSize: rf(11),
    fontWeight: '800',
    letterSpacing: 1,
  },
  waitingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: rs(10),
    justifyContent: 'center',
    marginTop: rs(4),
  },
  waitingText: {
    color: COLORS.textSecondary,
    fontSize: rf(14),
  },
  buttons: {
    gap: rs(10),
  },
});
