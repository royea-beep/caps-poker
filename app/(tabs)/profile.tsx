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
        <Text style={styles.title} accessibilityRole="header">PROFILE</Text>
        <Text style={styles.playerName}>{playerName}</Text>

        <View style={styles.statsGrid}>
          <View style={styles.statCard} accessible={true} accessibilityLabel={`${handsPlayed} hands`}><Text style={styles.statValue}>{handsPlayed}</Text><Text style={styles.statLabel}>HANDS</Text></View>
          <View style={styles.statCard} accessible={true} accessibilityLabel={`${winRate}% win rate`}><Text style={styles.statValue}>{winRate}%</Text><Text style={styles.statLabel}>WIN RATE</Text></View>
          <View style={styles.statCard} accessible={true} accessibilityLabel={`${currentWinStreak} streak`}><Text style={styles.statValue}>{currentWinStreak}</Text><Text style={styles.statLabel}>STREAK</Text></View>
          <View style={styles.statCard} accessible={true} accessibilityLabel={`${(chips ?? 0).toLocaleString()} chips`}><Text style={styles.statValue}>{(chips ?? 0).toLocaleString()}</Text><Text style={styles.statLabel} accessibilityLabel="CHIPS">CHIPS 💰</Text></View>
        </View>

        <Pressable style={styles.menuRow} onPress={() => router.push('/achievements' as any)} accessibilityRole="button" accessibilityLabel="הישגים" hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={styles.menuEmoji} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">🥇</Text><Text style={styles.menuLabel} accessibilityLanguage="he">הישגים</Text><Text style={styles.menuArrow} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">›</Text>
        </Pressable>
        <Pressable style={styles.menuRow} onPress={() => router.push('/missions' as any)} accessibilityRole="button" accessibilityLabel="משימות יומיות" hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={styles.menuEmoji} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">📋</Text><Text style={styles.menuLabel} accessibilityLanguage="he">משימות יומיות</Text><Text style={styles.menuArrow} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">›</Text>
        </Pressable>
        <Pressable style={styles.menuRow} onPress={() => router.push('/hand-history' as any)} accessibilityRole="button" accessibilityLabel="היסטוריית ידות" hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={styles.menuEmoji} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">📖</Text><Text style={styles.menuLabel} accessibilityLanguage="he">היסטוריית ידות</Text><Text style={styles.menuArrow} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">›</Text>
        </Pressable>
        <Pressable style={styles.menuRow} onPress={() => router.push('/stats' as any)} accessibilityRole="button" accessibilityLabel="סטטיסטיקות מפורטות" hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={styles.menuEmoji} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">📊</Text><Text style={styles.menuLabel} accessibilityLanguage="he">סטטיסטיקות מפורטות</Text><Text style={styles.menuArrow} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">›</Text>
        </Pressable>
        <Pressable style={styles.menuRow} onPress={() => router.push('/leaderboard' as any)} accessibilityRole="button" accessibilityLabel="לוח מנצחים" hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={styles.menuEmoji} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">🏆</Text><Text style={styles.menuLabel} accessibilityLanguage="he">לוח מנצחים</Text><Text style={styles.menuArrow} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">›</Text>
        </Pressable>
        <Pressable style={styles.menuRow} onPress={() => router.push('/settings' as any)} accessibilityRole="button" accessibilityLabel="הגדרות" hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={styles.menuEmoji} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">⚙️</Text><Text style={styles.menuLabel} accessibilityLanguage="he">הגדרות</Text><Text style={styles.menuArrow} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">›</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1C0508' },
  title: { color: '#FFD700', fontSize: rf(28), fontWeight: '900', letterSpacing: 4, textAlign: 'center', paddingTop: rs(16), marginBottom: rs(4) },
  playerName: { color: 'rgba(255,255,255,0.87)', fontSize: rf(13), textAlign: 'center', marginBottom: rs(20) },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: rs(8), paddingHorizontal: rs(16), marginBottom: rs(20) },
  statCard: { flex: 1, minWidth: '45%', backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', borderRadius: rv(12), padding: rs(14), alignItems: 'center' },
  statValue: { color: '#FFD700', fontSize: rf(22), fontWeight: '900' },
  statLabel: { color: 'rgba(255,255,255,0.87)', fontSize: rf(10), fontWeight: '700', letterSpacing: 1, marginTop: rs(2) },
  menuRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: rs(16), paddingHorizontal: rs(20), borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' },
  menuEmoji: { fontSize: rf(20), marginRight: rs(14) },
  menuLabel: { flex: 1, color: '#ffffff', fontSize: rf(15), fontWeight: '500' },
  menuArrow: { color: 'rgba(255,255,255,0.7)', fontSize: rf(20) },
});
