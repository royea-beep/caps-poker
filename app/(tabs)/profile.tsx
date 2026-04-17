import { useEffect } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { rf, rs, rv } from '../../utils/responsive';
import { useGameStore } from '../../store/gameStore';

export default function ProfileScreen() {
  const router = useRouter();
  useEffect(() => { import('../../utils/analytics').then(({ track }) => track('screen_view', {}, 'profile')).catch(() => {}); }, []);
  const handsPlayed = useGameStore(s => s.handsPlayed);
  const handsWon = useGameStore(s => s.handsWon);
  const chips = useGameStore(s => s.chips);
  const playerName = useGameStore(s => s.playerName) || 'Player';
  const currentWinStreak = useGameStore(s => s.currentWinStreak);
  const bestWinStreak = useGameStore(s => s.bestWinStreak);

  const winRate = handsPlayed > 0 ? Math.round((handsWon / handsPlayed) * 100) : 0;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>PROFILE</Text>
        <Text style={styles.playerName}>{playerName}</Text>

        <View style={styles.statsGrid}>
          <View style={styles.statCard}><Text style={styles.statValue}>{handsPlayed}</Text><Text style={styles.statLabel}>HANDS</Text></View>
          <View style={styles.statCard}><Text style={styles.statValue}>{winRate}%</Text><Text style={styles.statLabel}>WIN RATE</Text></View>
          <View style={styles.statCard}><Text style={styles.statValue}>{currentWinStreak}</Text><Text style={styles.statLabel}>STREAK</Text></View>
          <View style={styles.statCard}><Text style={styles.statValue}>{chips.toLocaleString()}</Text><Text style={styles.statLabel}>CHIPS 💰</Text></View>
        </View>

        <Pressable style={styles.menuRow} onPress={() => router.push('/achievements' as any)}>
          <Text style={styles.menuEmoji}>🥇</Text><Text style={styles.menuLabel}>הישגים</Text><Text style={styles.menuArrow}>›</Text>
        </Pressable>
        <Pressable style={styles.menuRow} onPress={() => router.push('/missions' as any)}>
          <Text style={styles.menuEmoji}>📋</Text><Text style={styles.menuLabel}>משימות יומיות</Text><Text style={styles.menuArrow}>›</Text>
        </Pressable>
        <Pressable style={styles.menuRow} onPress={() => router.push('/hand-history' as any)}>
          <Text style={styles.menuEmoji}>📖</Text><Text style={styles.menuLabel}>היסטוריית ידות</Text><Text style={styles.menuArrow}>›</Text>
        </Pressable>
        <Pressable style={styles.menuRow} onPress={() => router.push('/stats' as any)}>
          <Text style={styles.menuEmoji}>📊</Text><Text style={styles.menuLabel}>סטטיסטיקות מפורטות</Text><Text style={styles.menuArrow}>›</Text>
        </Pressable>
        <Pressable style={styles.menuRow} onPress={() => router.push('/leaderboard' as any)}>
          <Text style={styles.menuEmoji}>🏆</Text><Text style={styles.menuLabel}>לוח מנצחים</Text><Text style={styles.menuArrow}>›</Text>
        </Pressable>
        <Pressable style={styles.menuRow} onPress={() => router.push('/settings' as any)}>
          <Text style={styles.menuEmoji}>⚙️</Text><Text style={styles.menuLabel}>הגדרות</Text><Text style={styles.menuArrow}>›</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1C0508' },
  title: { color: '#FFD700', fontSize: rf(28), fontWeight: '900', letterSpacing: 4, textAlign: 'center', paddingTop: rs(16), marginBottom: rs(4) },
  playerName: { color: 'rgba(255,255,255,0.5)', fontSize: rf(13), textAlign: 'center', marginBottom: rs(20) },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: rs(8), paddingHorizontal: rs(16), marginBottom: rs(20) },
  statCard: { flex: 1, minWidth: '45%', backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', borderRadius: rv(12), padding: rs(14), alignItems: 'center' },
  statValue: { color: '#FFD700', fontSize: rf(22), fontWeight: '900' },
  statLabel: { color: 'rgba(255,255,255,0.35)', fontSize: rf(10), fontWeight: '700', letterSpacing: 1, marginTop: rs(2) },
  menuRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: rs(16), paddingHorizontal: rs(20), borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' },
  menuEmoji: { fontSize: rf(20), marginRight: rs(14) },
  menuLabel: { flex: 1, color: '#ffffff', fontSize: rf(15), fontWeight: '500' },
  menuArrow: { color: 'rgba(255,255,255,0.25)', fontSize: rf(20) },
});
