import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl, ActivityIndicator, TouchableOpacity } from 'react-native';
import { rf, rs, rv } from '../utils/responsive';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS } from '../constants/gameConfig';
import { getLeaderboard, LeaderboardEntry, isLeaderboardAvailable } from '../utils/leaderboard';
import { ScreenHeader } from '../components/ScreenHeader';

type SortMode = 'chips' | 'winRate';

function getMedal(pos: number): string {
  if (pos === 1) return '🥇';
  if (pos === 2) return '🥈';
  if (pos === 3) return '🥉';
  return '';
}

function getDisplayName(entry: LeaderboardEntry): string {
  // DROP-THE-KEY 2026-08-15 — the fallback used entry.device_id.slice(-4) ("CAPS-XXXX"), which
  // leaked four chars of every player's device id. The server now resolves the fallback
  // ("Player #<rank>") in get_leaderboard, so no device id ever reaches the client.
  return entry.display_name?.trim() || entry.player_name?.trim() || 'Player';
}

export default function LeaderboardScreen() {
  const router = useRouter();
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sortBy, setSortBy] = useState<SortMode>('chips');

  const fetchData = useCallback(async () => {
    // DROP-THE-KEY — getLeaderboard now returns per-row `is_me` from the server, so the client no
    // longer fetches its own device id to compare. Identity never leaves the server.
    const data = await getLeaderboard();
    setEntries(data);
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);
  const onRefresh = useCallback(() => { setRefreshing(true); fetchData(); }, [fetchData]);

  const sorted = [...entries].sort((a, b) => {
    if (sortBy === 'winRate') {
      const wrA = a.hands_played > 0 ? (a.hands_won / a.hands_played) : 0;
      const wrB = b.hands_played > 0 ? (b.hands_won / b.hands_played) : 0;
      return wrB - wrA;
    }
    return b.total_chips - a.total_chips;
  });

  const myIndex = sorted.findIndex(e => e.is_me);
  const myInTopTen = myIndex >= 0 && myIndex < 10;

  const renderItem = ({ item, index }: { item: LeaderboardEntry; index: number }) => {
    const isMe = item.is_me;
    const pos = index + 1;
    const medal = getMedal(pos);
    const winRate = item.hands_played > 0
      ? Math.round((item.hands_won / item.hands_played) * 100)
      : 0;
    const rc = (item as any).rank_change ?? 0;
    const nameFontSize = pos <= 3 ? rf(16 - (pos - 1)) : rf(13);

    return (
      <View
        style={[styles.row, isMe && styles.rowHighlight]}
        accessible={true}
        accessibilityLabel={`${medal === '🥇' ? 'Rank first place' : medal === '🥈' ? 'Rank second place' : medal === '🥉' ? 'Rank third place' : `Rank position ${pos}`}, ${getDisplayName(item)}${isMe ? ', you' : ''}, ${item.hands_played} hands, ${rc > 0 ? `rank up ${rc}` : rc < 0 ? `rank down ${Math.abs(rc)}` : 'no rank change'}, ${sortBy === 'winRate' ? `${winRate} percent win rate` : `${(item.total_chips ?? 0).toLocaleString()} chips`}`}
      >
        {/* Position */}
        <Text
          style={[styles.rank, pos <= 3 && styles.rankMedal, isMe && styles.textHighlight]}
          accessibilityLabel={
            medal === '🥇' ? 'First place'
            : medal === '🥈' ? 'Second place'
            : medal === '🥉' ? 'Third place'
            : undefined
          }
        >
          {medal || `#${pos}`}
        </Text>

        {/* Name + YOU badge */}
        <View style={styles.nameCol}>
          <View style={styles.nameRow}>
            <Text style={[styles.name, { fontSize: nameFontSize }, isMe && styles.textHighlight]} numberOfLines={1}>
              {getDisplayName(item)}
            </Text>
            {isMe && (
              <View style={styles.youBadge}>
                <Text style={styles.youBadgeText}>YOU</Text>
              </View>
            )}
          </View>
          <View style={styles.statsRow}>
            <Text style={styles.stats}>{item.hands_played}h</Text>
            {rc !== 0 && (
              <Text
                style={[styles.rankChange, { color: rc > 0 ? '#4CAF50' : '#ef5350' }]}
                accessibilityLabel={rc > 0 ? 'Rank up' : rc < 0 ? 'Rank down' : undefined}
              >
                {rc > 0 ? `▲${rc}` : `▼${Math.abs(rc)}`}
              </Text>
            )}
          </View>
        </View>

        {/* Chips + win rate */}
        <View style={styles.rightCol}>
          <Text
            style={[styles.chips, isMe && styles.textHighlight]}
            accessibilityLabel={
              sortBy === 'winRate'
                ? `${winRate} percent win rate`
                : `${(item.total_chips ?? 0).toLocaleString()} chips`
            }
          >
            {sortBy === 'winRate'
              ? `${winRate}%`
              : (item.total_chips ?? 0).toLocaleString() + '🪙'}
          </Text>
          {sortBy === 'chips' && winRate > 0 && (
            <Text style={styles.winRateSub}>{winRate}% win</Text>
          )}
        </View>
      </View>
    );
  };

  if (!isLeaderboardAvailable()) {
    return (
      <SafeAreaView style={styles.container}>
        <ScreenHeader title="LEADERBOARD" />
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>Leaderboard requires Supabase configuration.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const myEntry = myIndex >= 0 ? sorted[myIndex] : null;

  return (
    <SafeAreaView style={styles.container}>
      <ScreenHeader title="LEADERBOARD" />

      {/* Sort toggle */}
      <View style={styles.sortRow} accessibilityRole="tablist" accessibilityLabel="Sort leaderboard by">
        <TouchableOpacity accessibilityRole="tab" accessibilityLabel="Sort by chips" accessibilityState={{ selected: sortBy === 'chips' }} onPress={() => setSortBy('chips')} style={[styles.sortBtn, sortBy === 'chips' && styles.sortBtnActive, { minHeight: 44 }]} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={[styles.sortBtnText, sortBy === 'chips' && styles.sortBtnTextActive]}>🪙 Chips</Text>
        </TouchableOpacity>
        <TouchableOpacity accessibilityRole="tab" accessibilityLabel="Sort by win rate" accessibilityState={{ selected: sortBy === 'winRate' }} onPress={() => setSortBy('winRate')} style={[styles.sortBtn, sortBy === 'winRate' && styles.sortBtnActive, { minHeight: 44 }]} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={[styles.sortBtnText, sortBy === 'winRate' && styles.sortBtnTextActive]}>% Win Rate</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.emptyContainer} accessibilityLiveRegion="polite">
          <ActivityIndicator size="large" color={COLORS.gold} />
        </View>
      ) : (
        <FlatList
          data={sorted}
          keyExtractor={(item) => String(item.rank)}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.gold} />}
          ListHeaderComponent={
            <View style={styles.listHeader}>
              <Text accessibilityRole="header" style={styles.colHeader}>#</Text>
              <Text accessibilityRole="header" style={[styles.colHeader, { flex: 1 }]}>Player</Text>
              <Text accessibilityRole="header" style={styles.colHeader}>{sortBy === 'winRate' ? 'Win%' : 'Chips'}</Text>
            </View>
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No players yet</Text>
              <Text style={styles.emptyHint}>Play a hand to get on the board!</Text>
            </View>
          }
          ListFooterComponent={
            !myInTopTen && myEntry ? (
              <View style={[styles.row, styles.rowHighlight, styles.stickyMe]}>
                <Text style={[styles.rank, styles.textHighlight]}>#{myIndex + 1}</Text>
                <View style={styles.nameCol}>
                  <View style={styles.nameRow}>
                    <Text style={[styles.name, styles.textHighlight]} numberOfLines={1}>{getDisplayName(myEntry)}</Text>
                    <View style={styles.youBadge}><Text style={styles.youBadgeText}>YOU</Text></View>
                  </View>
                </View>
                <Text
                  style={[styles.chips, styles.textHighlight]}
                  accessibilityLabel={
                    sortBy === 'winRate'
                      ? `${myEntry.hands_played > 0 ? Math.round(myEntry.hands_won / myEntry.hands_played * 100) : 0} percent win rate`
                      : `${(myEntry.total_chips ?? 0).toLocaleString()} chips`
                  }
                >
                  {sortBy === 'winRate'
                    ? `${myEntry.hands_played > 0 ? Math.round(myEntry.hands_won / myEntry.hands_played * 100) : 0}%`
                    : (myEntry.total_chips ?? 0).toLocaleString() + '🪙'}
                </Text>
              </View>
            ) : null
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  sortRow: {
    flexDirection: 'row',
    paddingHorizontal: rs(12),
    paddingVertical: rs(8),
    gap: rs(8),
    borderBottomWidth: 1,
    borderBottomColor: COLORS.boardBorder,
  },
  sortBtn: {
    flex: 1,
    paddingVertical: rs(7),
    borderRadius: rv(8),
    borderWidth: 1,
    borderColor: COLORS.boardBorder,
    alignItems: 'center',
  },
  sortBtnActive: {
    backgroundColor: COLORS.mint + '22',
    borderColor: COLORS.mint,
  },
  sortBtnText: {
    color: COLORS.textMuted,
    fontSize: rf(12),
    fontWeight: '700',
  },
  sortBtnTextActive: {
    color: COLORS.mintBright,
  },
  listContent: {
    padding: rs(12),
    gap: rs(6),
    paddingBottom: rs(24),
  },
  listHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: rs(8),
    paddingVertical: rs(6),
    marginBottom: rs(2),
  },
  colHeader: {
    color: COLORS.textSecondary,
    fontSize: rf(11),
    fontWeight: '700',
    letterSpacing: 1,
    width: rv(36),
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.feltLight,
    padding: rs(12),
    borderRadius: rv(8),
    borderWidth: 1,
    borderColor: COLORS.boardBorder,
    gap: rs(8),
  },
  rowHighlight: {
    borderColor: COLORS.gold,
    backgroundColor: COLORS.gold + '15',
  },
  stickyMe: {
    marginTop: rs(12),
    borderStyle: 'dashed',
  },
  rank: {
    color: COLORS.textSecondary,
    fontSize: rf(13),
    fontWeight: '800',
    width: rv(36),
    textAlign: 'center',
  },
  rankMedal: {
    fontSize: rf(20),
    width: rv(36),
  },
  nameCol: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: rs(6),
    flexWrap: 'wrap',
  },
  name: {
    color: COLORS.textPrimary,
    fontSize: rf(13),
    fontWeight: '700',
  },
  youBadge: {
    backgroundColor: COLORS.gold,
    borderRadius: rv(4),
    paddingHorizontal: rs(5),
    paddingVertical: rs(1),
  },
  youBadgeText: {
    color: COLORS.background,
    fontSize: rf(9),
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: rs(6),
    marginTop: rs(2),
  },
  stats: {
    color: COLORS.textSecondary,
    fontSize: rf(11),
  },
  rankChange: {
    fontSize: rf(10),
    fontWeight: '700',
  },
  rightCol: {
    alignItems: 'flex-end',
  },
  chips: {
    color: COLORS.gold,
    fontSize: rf(14),
    fontWeight: '800',
    fontFamily: 'monospace',
  },
  winRateSub: {
    color: COLORS.textMuted,
    fontSize: rf(10),
    marginTop: rs(2),
  },
  textHighlight: {
    color: COLORS.mintBright,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: rs(40),
  },
  emptyText: {
    color: COLORS.textSecondary,
    fontSize: rf(16),
    fontWeight: '600',
    textAlign: 'center',
  },
  emptyHint: {
    color: COLORS.textMuted,
    fontSize: rf(13),
    marginTop: rs(8),
    textAlign: 'center',
  },
});
