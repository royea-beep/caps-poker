/**
 * PlayOfTheDayScreen — VAMOS 20
 * Best hand of the day: player name, hand, pot size. Vote thumbs up/down. Share to WhatsApp.
 * ZERO Reanimated — RN Animated only.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Pressable,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { COLORS } from '../constants/gameConfig';
import { rf, rs, rv } from '../utils/responsive';
import { getSupabase } from '../utils/supabase';
import { getDeviceId } from '../utils/leaderboard';
import { ScreenHeader } from '../components/ScreenHeader';

void COLORS;

// ─── Constants ───────────────────────────────────────────────
const BG     = '#1a0e06';
const ACCENT = '#c96a1a';
const BORDER = '#3d2a1a';
const TEXT   = '#f5e6d3';
const GOLD   = '#d4a843';

// Suit symbols for the replay animation
const SUITS = ['♠', '♥', '♦', '♣'];

// ─── Types ────────────────────────────────────────────────────
interface PotdData {
  available: boolean;
  player?: string;
  data?: {
    cards?: string[];
    pot_won?: number;
    hand_name?: string;
  };
  views?: number;
}

// ─── Card animation (flip reveal) ────────────────────────────
function AnimatedCard({ suit, delay }: { suit: string; delay: number }) {
  const scale  = useRef(new Animated.Value(0)).current;
  const rotate = useRef(new Animated.Value(0)).current;
  const isRed  = suit === '♥' || suit === '♦';

  useEffect(() => {
    Animated.sequence([
      Animated.delay(delay),
      Animated.parallel([
        Animated.spring(scale, { toValue: 1, friction: 5, useNativeDriver: true }),
        Animated.timing(rotate, { toValue: 1, duration: 400, useNativeDriver: true }),
      ]),
    ]).start();
  }, []);

  const rotateInterp = rotate.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  return (
    <Animated.View
      style={[
        cardAnim.card,
        { transform: [{ scale }, { rotate: rotateInterp }] },
      ]}
    >
      <Text style={[cardAnim.suit, isRed ? cardAnim.red : cardAnim.black]}>{suit}</Text>
    </Animated.View>
  );
}

const cardAnim = StyleSheet.create({
  card: {
    width: rs(52),
    height: rs(68),
    backgroundColor: '#fff',
    borderRadius: rs(8),
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 6,
    elevation: 8,
  },
  suit:  { fontSize: rf(28), fontWeight: '700' },
  red:   { color: '#e03030' },
  black: { color: '#1a0e06' },
});

// ─── Vote button ─────────────────────────────────────────────
function VoteBtn({
  emoji, label, count, selected, onPress,
}: {
  emoji: string; label: string; count: number; selected: boolean; onPress: () => void;
}) {
  const scale = useRef(new Animated.Value(1)).current;

  const handlePress = () => {
    Animated.sequence([
      Animated.timing(scale, { toValue: 0.88, duration: 80, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, friction: 4, useNativeDriver: true }),
    ]).start();
    onPress();
  };

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable
        onPress={handlePress}
        style={[styles.voteBtn, selected && styles.voteBtnSelected]}
        hitSlop={6}
      >
        <Text style={styles.voteEmoji}>{emoji}</Text>
        <Text style={[styles.voteLabel, selected && styles.voteLabelSelected]}>{label}</Text>
        <Text style={styles.voteCount}>{count}</Text>
      </Pressable>
    </Animated.View>
  );
}

// ─── Main screen ─────────────────────────────────────────────
export default function PlayOfTheDayScreen() {
  const router = useRouter();

  const [potd, setPotd]           = useState<PotdData | null>(null);
  const [loading, setLoading]     = useState(true);
  const [myVote, setMyVote]       = useState<'up' | 'down' | null>(null);
  const [upVotes, setUpVotes]     = useState(0);
  const [downVotes, setDownVotes] = useState(0);
  const [deviceId, setDeviceId]   = useState<string>('');

  // Header fade in
  const headerOpacity = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(headerOpacity, { toValue: 1, duration: 600, useNativeDriver: true }).start();
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        const id = await getDeviceId();
        setDeviceId(id);
        const sb = getSupabase();
        if (!sb) return;

        // Fetch POTD
        const { data } = await sb.rpc('get_play_of_the_day');
        if (data?.available) setPotd(data as PotdData);

        // Fetch existing vote counts for today
        const today = new Date().toISOString().split('T')[0];
        const { data: votes } = await sb
          .from('play_of_day_votes')
          .select('vote, device_id')
          .eq('play_date', today);

        if (votes) {
          setUpVotes(votes.filter((v: any) => v.vote === 'up').length);
          setDownVotes(votes.filter((v: any) => v.vote === 'down').length);
          const mine = votes.find((v: any) => v.device_id === id);
          if (mine) setMyVote(mine.vote as 'up' | 'down');
        }
      } catch {
        // silent
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleVote = useCallback(async (vote: 'up' | 'down') => {
    if (myVote === vote) return; // already voted same way
    const sb = getSupabase();
    if (!sb || !deviceId) return;

    const prevVote = myVote;
    setMyVote(vote);

    // Optimistic update
    if (vote === 'up') {
      setUpVotes(v => v + 1);
      if (prevVote === 'down') setDownVotes(v => Math.max(0, v - 1));
    } else {
      setDownVotes(v => v + 1);
      if (prevVote === 'up') setUpVotes(v => Math.max(0, v - 1));
    }

    // Persist — fire and forget
    const today = new Date().toISOString().split('T')[0];
    Promise.resolve(
      sb.from('play_of_day_votes')
        .upsert({ device_id: deviceId, play_date: today, vote }, { onConflict: 'device_id,play_date' })
    ).then(() => {}).catch(() => {});
  }, [myVote, deviceId]);

  const handleShare = useCallback(async () => {
    if (!potd?.data) return;
    const handName  = potd.data.hand_name ?? 'Winning hand';
    const player    = potd.player ?? 'Anonymous player';
    const pot       = (potd.data.pot_won ?? 0).toLocaleString();
    const message   = `🏆 Play of the Day on CAPS Poker!\n👤 ${player}\n🃏 ${handName}\n💰 Pot: ${pot} chips\n\nCheck out CAPS Poker!`;
    try {
      await Share.share({ message });
    } catch {
      // cancelled
    }
  }, [potd]);

  // Suits shown in replay animation — use hand cards or fallback random suits
  const displaySuits = potd?.data?.cards?.slice(0, 4) ?? SUITS;

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <ScreenHeader title="Play of the Day" />

      {loading ? (
        <View style={styles.center}>
          <Text style={styles.loadingEmoji}>🃏</Text>
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      ) : !potd?.available || !potd.data ? (
        <View style={styles.center}>
          <Text style={styles.emptyEmoji}>🎴</Text>
          <Text style={styles.emptyTitle}>No play of the day yet</Text>
          <Text style={styles.emptySub}>Check back later!</Text>
        </View>
      ) : (
        <View style={styles.content}>
          {/* Trophy banner */}
          <Animated.View style={[styles.trophyBanner, { opacity: headerOpacity }]}>
            <Text style={styles.trophyEmoji}>🏆</Text>
            <Text style={styles.trophyText}>Best play of the day</Text>
          </Animated.View>

          {/* Card replay */}
          <View style={styles.replaySection}>
            <View style={styles.cardRow}>
              {displaySuits.map((suit, i) => (
                <AnimatedCard key={i} suit={suit} delay={i * 200} />
              ))}
            </View>
          </View>

          {/* Hand details */}
          <View style={styles.detailCard}>
            {potd.player && potd.player !== 'Anonymous' && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Player</Text>
                <Text style={styles.detailValue} numberOfLines={1}>{potd.player}</Text>
              </View>
            )}
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Hand</Text>
              <Text style={[styles.detailValue, { color: GOLD }]}>
                {potd.data.hand_name ?? 'Winning hand'}
              </Text>
            </View>
            {(potd.data.pot_won ?? 0) > 0 && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Pot</Text>
                <Text style={[styles.detailValue, { color: ACCENT }]}>
                  {(potd.data.pot_won ?? 0).toLocaleString()} 💰
                </Text>
              </View>
            )}
            {(potd.views ?? 0) > 0 && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Views</Text>
                <Text style={styles.detailValue}>{(potd.views ?? 0).toLocaleString()} 👁</Text>
              </View>
            )}
          </View>

          {/* Voting */}
          <View style={styles.voteSection}>
            <Text style={styles.voteTitle}>What do you think of this play?</Text>
            <View style={styles.voteRow}>
              <VoteBtn
                emoji="👎"
                label="Not impressed"
                count={downVotes}
                selected={myVote === 'down'}
                onPress={() => handleVote('down')}
              />
              <VoteBtn
                emoji="👍"
                label="Amazing!"
                count={upVotes}
                selected={myVote === 'up'}
                onPress={() => handleVote('up')}
              />
            </View>
          </View>

          {/* Share */}
          <Pressable
            style={({ pressed }) => [styles.shareBtn, pressed && { opacity: 0.8 }]}
            onPress={handleShare}
          >
            <Text style={styles.shareBtnText}>Share to WhatsApp 💬</Text>
          </Pressable>
        </View>
      )}
    </SafeAreaView>
  );
}

// ─── Styles ──────────────────────────────────────────────────
const styles = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: BG },
  content: {
    flex: 1,
    paddingHorizontal: rs(16),
    paddingBottom: rv(24),
    gap: rs(16),
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: rs(10),
  },
  loadingEmoji: { fontSize: rf(44) },
  loadingText:  { color: '#888', fontSize: rf(15), writingDirection: 'ltr' } as any,
  emptyEmoji:   { fontSize: rf(52) },
  emptyTitle:   { color: TEXT, fontSize: rf(18), fontWeight: '700', writingDirection: 'ltr' } as any,
  emptySub:     { color: '#888', fontSize: rf(14), writingDirection: 'ltr' } as any,
  // Trophy
  trophyBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: rs(8),
    marginTop: rv(4),
  },
  trophyEmoji: { fontSize: rf(32) },
  trophyText: {
    color: GOLD,
    fontSize: rf(20),
    fontWeight: '800',
    writingDirection: 'ltr',
  } as any,
  // Replay
  replaySection: {
    alignItems: 'center',
    paddingVertical: rv(8),
  },
  cardRow: {
    flexDirection: 'row',
    gap: rs(10),
    justifyContent: 'center',
  },
  // Detail card
  detailCard: {
    backgroundColor: '#110a04',
    borderRadius: rs(16),
    borderWidth: 1,
    borderColor: BORDER,
    padding: rs(16),
    gap: rs(10),
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  detailLabel: {
    color: '#888',
    fontSize: rf(13),
    writingDirection: 'ltr',
  } as any,
  detailValue: {
    color: TEXT,
    fontSize: rf(15),
    fontWeight: '600',
    writingDirection: 'ltr',
    maxWidth: '65%',
    textAlign: 'left',
  } as any,
  // Voting
  voteSection: {
    backgroundColor: '#110a04',
    borderRadius: rs(16),
    borderWidth: 1,
    borderColor: BORDER,
    padding: rs(16),
  },
  voteTitle: {
    color: TEXT,
    fontSize: rf(14),
    fontWeight: '600',
    textAlign: 'center',
    writingDirection: 'ltr',
    marginBottom: rv(12),
  } as any,
  voteRow: {
    flexDirection: 'row',
    gap: rs(10),
  },
  voteBtn: {
    flex: 1,
    backgroundColor: '#1a0e06',
    borderRadius: rs(12),
    borderWidth: 1,
    borderColor: BORDER,
    paddingVertical: rv(12),
    alignItems: 'center',
    gap: rs(4),
    minHeight: 44,
  },
  voteBtnSelected: {
    borderColor: ACCENT,
    backgroundColor: 'rgba(201,106,26,0.15)',
  },
  voteEmoji: { fontSize: rf(24) },
  voteLabel: {
    color: '#888',
    fontSize: rf(12),
    writingDirection: 'ltr',
  } as any,
  voteLabelSelected: { color: ACCENT },
  voteCount: {
    color: '#666',
    fontSize: rf(12),
    fontWeight: '600',
  },
  // Share
  shareBtn: {
    backgroundColor: '#25D366',
    borderRadius: rs(14),
    paddingVertical: rv(14),
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  shareBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: rf(15),
    writingDirection: 'ltr',
  } as any,
});
