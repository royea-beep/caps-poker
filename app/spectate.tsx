/**
 * Spectate Screen — S64
 * Read-only view of a live internet game via spectate:{roomCode} Supabase channel.
 * ZERO Reanimated — RN Animated only.
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { getSupabase } from '../utils/supabase';
import { SpectatorSnapshot } from '../utils/realtimeMultiplayer';
import { COLORS } from '../constants/gameConfig';
import { rf, rs, rv } from '../utils/responsive';

const SPECTATE_CHANNEL_PREFIX = 'spectate:';

function generateSpectatorId(): string {
  return `spectator-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// ─── Community Cards Row ───────────────────────────────────────────────────

function CommunityRow({ cards }: { cards: { rank: string; suit: string }[] }) {
  const suitSymbol: Record<string, string> = {
    hearts: '♥',
    diamonds: '♦',
    clubs: '♣',
    spades: '♠',
  };
  const suitColor: Record<string, string> = {
    hearts: '#E74C3C',
    diamonds: '#E74C3C',
    clubs: COLORS.textPrimary,
    spades: COLORS.textPrimary,
  };

  if (cards.length === 0) {
    return (
      <View style={styles.commRow}>
        {Array.from({ length: 5 }).map((_, i) => (
          <View key={i} style={styles.cardSlot}>
            <Text style={styles.cardSlotDot}>♦</Text>
          </View>
        ))}
      </View>
    );
  }

  return (
    <View style={styles.commRow}>
      {cards.map((c, i) => (
        <View key={i} style={styles.cardMini}>
          <Text style={[styles.cardRankMini, { color: suitColor[c.suit] ?? COLORS.textPrimary }]}>
            {c.rank}
          </Text>
          <Text style={[styles.cardSuitMini, { color: suitColor[c.suit] ?? COLORS.textPrimary }]}>
            {suitSymbol[c.suit] ?? c.suit}
          </Text>
        </View>
      ))}
    </View>
  );
}

// ─── Main Screen ────────────────────────────────────────────────────────────

export default function SpectateScreen() {
  const router = useRouter();
  const { roomCode } = useLocalSearchParams<{ roomCode: string }>();
  const [snapshot, setSnapshot] = useState<SpectatorSnapshot | null>(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const channelRef = useRef<any>(null);
  const spectatorId = useRef(generateSpectatorId()).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!roomCode) {
      setError('No room code provided');
      return;
    }

    const supabase = getSupabase();
    if (!supabase) {
      setError('Online play not configured');
      return;
    }

    const channel = supabase.channel(`${SPECTATE_CHANNEL_PREFIX}${roomCode}`, {
      config: { presence: { key: spectatorId } },
    });
    channelRef.current = channel;

    channel
      .on('broadcast', { event: 'game_state' }, ({ payload }: { payload: SpectatorSnapshot }) => {
        setSnapshot(payload);
        // Fade in content on first snapshot
        if (!connected) {
          Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 400,
            useNativeDriver: true,
          }).start();
        }
      })
      .subscribe(async (status: string) => {
        if (status === 'SUBSCRIBED') {
          setConnected(true);
          // Register presence as spectator
          await channel.track({ spectatorId, joinedAt: Date.now() });
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          setError('Could not connect to game. Make sure the room code is correct.');
        }
      });

    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [roomCode]);

  const handleLeave = () => {
    if (channelRef.current) {
      getSupabase()?.removeChannel(channelRef.current);
      channelRef.current = null;
    }
    router.replace('/');
  };

  if (error) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Text style={styles.backText}>← BACK</Text>
          </Pressable>
          <Text style={styles.title}>SPECTATE</Text>
          <View style={{ width: 60 }} />
        </View>
        <View style={styles.centerContent}>
          <Text style={styles.errorIcon}>⚠️</Text>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!connected || !snapshot) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Text style={styles.backText}>← BACK</Text>
          </Pressable>
          <Text style={styles.title}>SPECTATE</Text>
          <View style={{ width: 60 }} />
        </View>
        <View style={styles.centerContent}>
          <Text style={styles.connectingText}>
            {connected ? 'Waiting for game state...' : 'Connecting...'}
          </Text>
          <Text style={styles.connectingSubtitle}>Room {roomCode}</Text>
        </View>
      </SafeAreaView>
    );
  }

  const phaseLabel =
    snapshot.phase === 'arranging'
      ? 'ARRANGING'
      : snapshot.phase === 'revealing'
      ? 'REVEALING'
      : 'RESULTS';

  const phaseColor =
    snapshot.phase === 'arranging'
      ? COLORS.gold
      : snapshot.phase === 'revealing'
      ? '#4CAF50'
      : '#9C27B0';

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Header */}
      <View style={styles.header}>
        <View style={{ width: 60 }} />
        <View style={styles.headerCenter}>
          <Text style={styles.title}>SPECTATING</Text>
          <Text style={styles.roomLabel}>Room {roomCode}</Text>
        </View>
        <View style={styles.headerRight}>
          {snapshot.spectatorCount > 0 && (
            <Text style={styles.spectatorCount}>👁 {snapshot.spectatorCount}</Text>
          )}
        </View>
      </View>

      <Animated.View style={[styles.content, { opacity: fadeAnim }]}>
        <ScrollView showsVerticalScrollIndicator={false}>

          {/* Phase badge */}
          <View style={[styles.phaseBadge, { borderColor: phaseColor }]}>
            <Text style={[styles.phaseText, { color: phaseColor }]}>● {phaseLabel}</Text>
          </View>

          {/* Players */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>PLAYERS</Text>
            {snapshot.players.map((p) => (
              <View key={p.id} style={styles.playerRow}>
                <Text style={styles.playerName}>{p.name}</Text>
                <View style={[styles.readyBadge, p.isReady ? styles.readyBadgeGreen : styles.readyBadgeDim]}>
                  <Text style={[styles.readyText, p.isReady ? styles.readyTextGreen : {}]}>
                    {p.isReady ? '✓ READY' : 'PLACING…'}
                  </Text>
                </View>
              </View>
            ))}
          </View>

          {/* Community cards per board */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>BOARDS</Text>
            {snapshot.communityCards.map((cards, i) => (
              <View key={i} style={styles.boardCard}>
                <Text style={styles.boardLabel}>BOARD {i + 1}</Text>
                <CommunityRow cards={cards} />
              </View>
            ))}
          </View>

          {/* Revealed board results (reveal / results phase) */}
          {snapshot.revealedBoards && snapshot.revealedBoards.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>RESULTS</Text>
              {snapshot.revealedBoards.map((rb) => (
                <View key={rb.boardIndex} style={styles.resultCard}>
                  <View style={styles.resultHeader}>
                    <Text style={styles.resultBoardLabel}>BOARD {rb.boardIndex + 1}</Text>
                    <Text style={styles.resultWinner}>🏆 {rb.winnerName}</Text>
                  </View>
                  {rb.playerHands.map((ph, pi) => (
                    <View key={pi} style={styles.resultHandRow}>
                      <Text style={styles.resultPlayerName}>{ph.playerName}</Text>
                      <Text style={styles.resultHandRank}>{ph.handRank}</Text>
                    </View>
                  ))}
                </View>
              ))}
            </View>
          )}

          {/* Note: player hole cards hidden until results */}
          {snapshot.phase === 'arranging' && (
            <Text style={styles.privacyNote}>
              Player hole cards are hidden during arrangement
            </Text>
          )}

          <View style={{ height: rs(24) }} />
        </ScrollView>
      </Animated.View>

      {/* Leave button */}
      <View style={styles.leaveRow}>
        <Pressable style={styles.leaveBtn} onPress={handleLeave}>
          <Text style={styles.leaveBtnText}>LEAVE</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: rs(16),
    paddingVertical: rs(10),
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  headerCenter: {
    alignItems: 'center',
  },
  headerRight: {
    width: 60,
    alignItems: 'flex-end',
  },
  backText: {
    color: COLORS.gold,
    fontSize: rf(13),
    fontWeight: '700',
    letterSpacing: 1,
  },
  title: {
    color: COLORS.goldLight,
    fontSize: rf(16),
    fontWeight: '900',
    letterSpacing: 3,
  },
  roomLabel: {
    color: 'rgba(255,255,255,0.35)',
    fontSize: rf(10),
    letterSpacing: 1,
    marginTop: rs(2),
  },
  spectatorCount: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: rf(12),
    fontWeight: '600',
  },
  content: {
    flex: 1,
    paddingHorizontal: rs(16),
  },
  centerContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: rs(12),
  },
  connectingText: {
    color: COLORS.textPrimary,
    fontSize: rf(16),
    fontWeight: '600',
  },
  connectingSubtitle: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: rf(13),
  },
  errorIcon: {
    fontSize: rf(36),
  },
  errorText: {
    color: '#F44336',
    fontSize: rf(14),
    textAlign: 'center',
    paddingHorizontal: rs(24),
  },
  phaseBadge: {
    alignSelf: 'center',
    marginTop: rs(16),
    marginBottom: rs(8),
    paddingHorizontal: rs(16),
    paddingVertical: rs(6),
    borderRadius: rv(20),
    borderWidth: 1,
  },
  phaseText: {
    fontSize: rf(12),
    fontWeight: '800',
    letterSpacing: 2,
  },
  section: {
    backgroundColor: COLORS.surface,
    borderRadius: rv(12),
    padding: rs(14),
    marginBottom: rs(12),
    gap: rs(8),
  },
  sectionTitle: {
    color: 'rgba(255,255,255,0.35)',
    fontSize: rf(10),
    fontWeight: '800',
    letterSpacing: 2,
    marginBottom: rs(2),
  },
  playerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: rs(6),
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  playerName: {
    color: COLORS.textPrimary,
    fontSize: rf(14),
    fontWeight: '600',
  },
  readyBadge: {
    paddingHorizontal: rs(10),
    paddingVertical: rs(3),
    borderRadius: rv(6),
    borderWidth: 1,
  },
  readyBadgeGreen: {
    borderColor: '#4CAF50',
    backgroundColor: 'rgba(76,175,80,0.1)',
  },
  readyBadgeDim: {
    borderColor: 'rgba(255,255,255,0.15)',
    backgroundColor: 'transparent',
  },
  readyText: {
    fontSize: rf(10),
    fontWeight: '700',
    letterSpacing: 1,
    color: 'rgba(255,255,255,0.4)',
  },
  readyTextGreen: {
    color: '#4CAF50',
  },
  boardCard: {
    gap: rs(6),
    paddingBottom: rs(8),
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  boardLabel: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: rf(10),
    fontWeight: '700',
    letterSpacing: 2,
  },
  commRow: {
    flexDirection: 'row',
    gap: rs(4),
  },
  cardMini: {
    width: rs(28),
    height: rs(40),
    backgroundColor: '#fff',
    borderRadius: rv(4),
    alignItems: 'center',
    justifyContent: 'center',
    gap: rs(1),
  },
  cardRankMini: {
    fontSize: rf(11),
    fontWeight: '800',
    lineHeight: 14,
  },
  cardSuitMini: {
    fontSize: rf(11),
    lineHeight: 14,
  },
  cardSlot: {
    width: rs(28),
    height: rs(40),
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: rv(4),
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardSlotDot: {
    color: 'rgba(255,255,255,0.15)',
    fontSize: rf(12),
  },
  resultCard: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: rv(8),
    padding: rs(10),
    gap: rs(6),
  },
  resultHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  resultBoardLabel: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: rf(10),
    fontWeight: '800',
    letterSpacing: 2,
  },
  resultWinner: {
    color: COLORS.goldLight,
    fontSize: rf(12),
    fontWeight: '700',
  },
  resultHandRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingLeft: rs(8),
  },
  resultPlayerName: {
    color: COLORS.textPrimary,
    fontSize: rf(12),
  },
  resultHandRank: {
    color: COLORS.gold,
    fontSize: rf(12),
    fontWeight: '600',
  },
  privacyNote: {
    color: 'rgba(255,255,255,0.2)',
    fontSize: rf(10),
    textAlign: 'center',
    marginBottom: rs(8),
    fontStyle: 'italic',
  },
  leaveRow: {
    paddingHorizontal: rs(24),
    paddingBottom: rs(16),
    paddingTop: rs(8),
  },
  leaveBtn: {
    backgroundColor: 'rgba(244,67,54,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(244,67,54,0.3)',
    paddingVertical: rs(12),
    borderRadius: rv(10),
    alignItems: 'center',
  },
  leaveBtnText: {
    color: '#F44336',
    fontSize: rf(13),
    fontWeight: '800',
    letterSpacing: 2,
  },
});
