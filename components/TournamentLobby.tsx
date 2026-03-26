import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Animated,
} from 'react-native';
import { listActiveTournaments, TournamentEntry } from '../utils/tournament';

// ─── Theme ────────────────────────────────────────────────────────────────────

const T = {
  bg: '#0d0700',
  card: '#1a0e06',
  border: '#3d2a1a',
  text: '#f5e6d3',
  gold: '#c96a1a',
  goldLight: 'rgba(201,106,26,0.15)',
  muted: '#a08060',
  dim: '#5a3e28',
  green: '#4CAF50',
  red: '#e74c3c',
};

// ─── Props ────────────────────────────────────────────────────────────────────

interface TournamentLobbyProps {
  playerName: string;
  onJoin: (tournamentId: string) => void;
}

// ─── Helper: format players count ────────────────────────────────────────────

function PlayersBar({ current, max }: { current: number; max: number }) {
  const pct = Math.min(current / max, 1);
  const widthAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(widthAnim, {
      toValue: pct,
      duration: 400,
      useNativeDriver: false,
    }).start();
  }, [pct, widthAnim]);

  return (
    <View style={barStyles.track}>
      <Animated.View
        style={[
          barStyles.fill,
          {
            width: widthAnim.interpolate({
              inputRange: [0, 1],
              outputRange: ['0%', '100%'],
            }),
            backgroundColor: pct >= 1 ? T.green : T.gold,
          },
        ]}
      />
    </View>
  );
}

const barStyles = StyleSheet.create({
  track: {
    height: 4,
    backgroundColor: T.border,
    borderRadius: 2,
    overflow: 'hidden',
    flex: 1,
  },
  fill: {
    height: '100%',
    borderRadius: 2,
  },
});

// ─── Helper: status badge ─────────────────────────────────────────────────────

function StatusBadge({ status }: { status: TournamentEntry['status'] }) {
  const color = status === 'waiting' ? T.gold : status === 'active' ? T.green : T.dim;
  const label = status === 'waiting' ? 'WAITING' : status === 'active' ? 'ACTIVE' : 'DONE';
  return (
    <View style={[badgeStyles.badge, { borderColor: color }]}>
      <Text style={[badgeStyles.text, { color }]}>{label}</Text>
    </View>
  );
}

const badgeStyles = StyleSheet.create({
  badge: {
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  text: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1,
  },
});

// ─── Tournament Card ──────────────────────────────────────────────────────────

interface TournamentCardProps {
  entry: TournamentEntry;
  onJoin: (id: string) => void;
  joining: boolean;
}

function TournamentCard({ entry, onJoin, joining }: TournamentCardProps) {
  const isFull = entry.current_players >= entry.max_players;
  const canJoin = entry.status === 'waiting' && !isFull;

  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [fadeAnim]);

  return (
    <Animated.View style={[styles.card, { opacity: fadeAnim }]}>
      {/* Header row */}
      <View style={styles.cardHeader}>
        <View style={styles.cardHeaderLeft}>
          <Text style={styles.roomCode}>{entry.room_code}</Text>
          <StatusBadge status={entry.status} />
        </View>
        <Text style={styles.prizeText}>
          {entry.prize_pool ?? `${(entry.buy_in ?? 200) * entry.max_players} chips`}
        </Text>
      </View>

      {/* Players row */}
      <View style={styles.playersRow}>
        <Text style={styles.playersLabel}>
          {entry.current_players}/{entry.max_players} players
        </Text>
        <PlayersBar current={entry.current_players} max={entry.max_players} />
      </View>

      {/* Buy-in row */}
      <View style={styles.infoRow}>
        <Text style={styles.infoLabel}>Buy-in</Text>
        <Text style={styles.infoValue}>{entry.buy_in ?? 200} chips</Text>
        <Text style={styles.infoLabel}>Format</Text>
        <Text style={styles.infoValue}>
          {entry.max_players === 4 ? '4-player' : '8-player'} bracket
        </Text>
      </View>

      {/* Status line */}
      <Text style={styles.statusLine}>
        {isFull
          ? 'Starting soon...'
          : entry.status === 'active'
          ? 'Match in progress'
          : `Starts when full (${entry.max_players - entry.current_players} spots left)`}
      </Text>

      {/* Join button */}
      <TouchableOpacity
        style={[styles.joinBtn, (!canJoin || joining) && styles.joinBtnDisabled]}
        disabled={!canJoin || joining}
        onPress={() => onJoin(entry.id)}
        activeOpacity={0.75}
      >
        {joining ? (
          <ActivityIndicator size="small" color={T.text} />
        ) : (
          <Text style={styles.joinBtnText}>
            {isFull ? 'FULL' : entry.status !== 'waiting' ? 'IN PROGRESS' : 'JOIN'}
          </Text>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function TournamentLobby({ playerName, onJoin }: TournamentLobbyProps) {
  const [tournaments, setTournaments] = useState<TournamentEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [joiningId, setJoiningId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await listActiveTournaments();
      setTournaments(list);
    } catch {
      setError('Failed to load tournaments.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleJoin = useCallback(
    async (id: string) => {
      setJoiningId(id);
      onJoin(id);
      setJoiningId(null);
    },
    [onJoin],
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>ONLINE TOURNAMENTS</Text>
        <TouchableOpacity style={styles.refreshBtn} onPress={load} activeOpacity={0.7}>
          <Text style={styles.refreshText}>REFRESH</Text>
        </TouchableOpacity>
      </View>

      {/* Player name row */}
      <View style={styles.playerRow}>
        <Text style={styles.playerLabel}>Playing as</Text>
        <Text style={styles.playerName}>{playerName}</Text>
      </View>

      {/* Content */}
      {loading ? (
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color={T.gold} />
          <Text style={styles.loadingText}>Loading tournaments...</Text>
        </View>
      ) : error ? (
        <View style={styles.centerContent}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={load} activeOpacity={0.7}>
            <Text style={styles.retryText}>TRY AGAIN</Text>
          </TouchableOpacity>
        </View>
      ) : tournaments.length === 0 ? (
        <View style={styles.centerContent}>
          <Text style={styles.emptyEmoji}>{'🎰'}</Text>
          <Text style={styles.emptyTitle}>No Active Tournaments</Text>
          <Text style={styles.emptySubtitle}>Check back later or create one below!</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.list}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        >
          {tournaments.map((t) => (
            <TournamentCard
              key={t.id}
              entry={t}
              onJoin={handleJoin}
              joining={joiningId === t.id}
            />
          ))}
        </ScrollView>
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: T.bg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderColor: T.border,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: T.gold,
    letterSpacing: 3,
  },
  refreshBtn: {
    backgroundColor: T.goldLight,
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: T.border,
  },
  refreshText: {
    fontSize: 10,
    fontWeight: '800',
    color: T.gold,
    letterSpacing: 1,
  },
  playerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: T.goldLight,
    borderBottomWidth: 1,
    borderColor: T.border,
  },
  playerLabel: {
    fontSize: 12,
    color: T.muted,
    fontWeight: '500',
  },
  playerName: {
    fontSize: 13,
    color: T.text,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  centerContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: 32,
  },
  loadingText: {
    fontSize: 13,
    color: T.muted,
    fontWeight: '500',
  },
  errorText: {
    fontSize: 14,
    color: T.red,
    fontWeight: '600',
    textAlign: 'center',
  },
  retryBtn: {
    backgroundColor: T.goldLight,
    borderRadius: 8,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: T.gold,
  },
  retryText: {
    fontSize: 12,
    fontWeight: '800',
    color: T.gold,
    letterSpacing: 1,
  },
  emptyEmoji: {
    fontSize: 48,
    textAlign: 'center',
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: T.text,
    letterSpacing: 1,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 13,
    color: T.muted,
    textAlign: 'center',
    lineHeight: 20,
  },
  list: {
    flex: 1,
  },
  listContent: {
    padding: 16,
    gap: 12,
  },

  // Card
  card: {
    backgroundColor: T.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: T.border,
    padding: 16,
    gap: 10,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  roomCode: {
    fontSize: 20,
    fontWeight: '900',
    color: T.text,
    letterSpacing: 4,
    fontVariant: ['tabular-nums'],
  },
  prizeText: {
    fontSize: 14,
    fontWeight: '800',
    color: T.gold,
    letterSpacing: 0.5,
  },
  playersRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  playersLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: T.muted,
    minWidth: 70,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  infoLabel: {
    fontSize: 11,
    color: T.muted,
    fontWeight: '500',
  },
  infoValue: {
    fontSize: 11,
    color: T.text,
    fontWeight: '600',
    marginRight: 8,
  },
  statusLine: {
    fontSize: 11,
    color: T.dim,
    fontWeight: '500',
    fontStyle: 'italic',
  },
  joinBtn: {
    backgroundColor: T.gold,
    borderRadius: 8,
    paddingVertical: 11,
    alignItems: 'center',
    marginTop: 2,
  },
  joinBtnDisabled: {
    backgroundColor: T.dim,
    opacity: 0.6,
  },
  joinBtnText: {
    fontSize: 14,
    fontWeight: '900',
    color: '#fff',
    letterSpacing: 2,
  },
});
