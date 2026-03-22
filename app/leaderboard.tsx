import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl, ActivityIndicator } from 'react-native';
import { rf, rs, rv } from '../utils/responsive';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../components/Button';
import { COLORS } from '../constants/gameConfig';
import { getLeaderboard, getDeviceId, LeaderboardEntry, isLeaderboardAvailable } from '../utils/leaderboard';

export default function LeaderboardScreen() {
  const router = useRouter();
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [myDeviceId, setMyDeviceId] = useState<string>('');

  const fetchData = useCallback(async () => {
    const [data, deviceId] = await Promise.all([
      getLeaderboard(),
      getDeviceId(),
    ]);
    setEntries(data);
    setMyDeviceId(deviceId);
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchData();
  }, [fetchData]);

  const renderItem = ({ item, index }: { item: LeaderboardEntry; index: number }) => {
    const isMe = item.device_id === myDeviceId;
    const winRate = item.hands_played > 0
      ? Math.round((item.hands_won / item.hands_played) * 100)
      : 0;

    return (
      <View style={[styles.row, isMe && styles.rowHighlight]}>
        <Text style={[styles.rank, isMe && styles.textHighlight]}>
          {index + 1}
        </Text>
        <View style={styles.nameCol}>
          <Text style={[styles.name, isMe && styles.textHighlight]} numberOfLines={1}>
            {item.player_name}{isMe ? ' (you)' : ''}
          </Text>
          <Text style={styles.stats}>
            {item.hands_played} hands | {winRate}% win
          </Text>
        </View>
        <Text style={[styles.chips, isMe && styles.textHighlight]}>
          {item.total_chips.toLocaleString()}
        </Text>
      </View>
    );
  };

  if (!isLeaderboardAvailable()) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Button
            title={'\u2190 Back'}
            variant="ghost"
            onPress={() => router.back()}
            style={{ paddingVertical: 6, paddingHorizontal: 0 }}
          />
          <Text style={styles.title}>LEADERBOARD</Text>
          <View style={{ width: 60 }} />
        </View>
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>
            Leaderboard requires Supabase configuration.
          </Text>
          <Text style={styles.emptyHint}>
            Add SUPABASE_URL and SUPABASE_ANON_KEY to .env
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Button
          title={'\u2190 Back'}
          variant="ghost"
          onPress={() => router.back()}
          style={{ paddingVertical: 6, paddingHorizontal: 0 }}
        />
        <Text style={styles.title}>LEADERBOARD</Text>
        <View style={{ width: 60 }} />
      </View>

      {loading ? (
        <View style={styles.emptyContainer}>
          <ActivityIndicator size="large" color={COLORS.gold} />
        </View>
      ) : (
        <FlatList
          data={entries}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={COLORS.gold}
            />
          }
          ListHeaderComponent={
            <View style={styles.listHeader}>
              <Text style={styles.colHeader}>#</Text>
              <Text style={[styles.colHeader, { flex: 1 }]}>Player</Text>
              <Text style={styles.colHeader}>Chips</Text>
            </View>
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No players yet</Text>
              <Text style={styles.emptyHint}>Play a hand to get on the board!</Text>
            </View>
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
  listContent: {
    padding: rs(16),
    gap: rs(6),
  },
  listHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: rs(12),
    paddingVertical: rs(8),
    marginBottom: rs(4),
  },
  colHeader: {
    color: COLORS.textSecondary,
    fontSize: rf(11),
    fontWeight: '700',
    letterSpacing: 1,
    width: rv(30),
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
  rank: {
    color: COLORS.textSecondary,
    fontSize: rf(16),
    fontWeight: '800',
    width: rv(30),
    textAlign: 'center',
  },
  nameCol: {
    flex: 1,
  },
  name: {
    color: COLORS.textPrimary,
    fontSize: rf(14),
    fontWeight: '700',
  },
  stats: {
    color: COLORS.textSecondary,
    fontSize: rf(11),
    marginTop: rs(2),
  },
  chips: {
    color: COLORS.gold,
    fontSize: rf(16),
    fontWeight: '800',
    fontFamily: 'monospace',
  },
  textHighlight: {
    color: COLORS.goldBright,
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
