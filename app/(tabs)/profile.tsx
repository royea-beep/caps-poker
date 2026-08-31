import { useEffect } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { rf, rs, rv } from '../../utils/responsive';
import { useGameStore } from '../../store/gameStore';
import { t, getLanguage, isRTL } from '../../utils/i18n';

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

  // A MISSING STAT RENDERS AS A BLANK, NOT A ZERO. handsPlayed and currentWinStreak go straight
  // into <Text>, so an undefined store value produced an empty card — a fresh profile showed a
  // blank, a 0%, and another blank, which reads as broken rather than as "you have not played".
  // winRate was already guarded (hence the 0% the survey saw); chips already used `?? 0`. These
  // are the two that were not.

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <Text style={styles.title} accessibilityRole="header">PROFILE</Text>
        <Text style={styles.playerName}>{playerName}</Text>

        <View style={styles.statsGrid}>
          <View style={styles.statCard} accessible={true} accessibilityLabel={`${handsPlayed ?? 0} hands`}><Text style={styles.statValue}>{handsPlayed ?? 0}</Text><Text style={styles.statLabel}>HANDS</Text></View>
          <View style={styles.statCard} accessible={true} accessibilityLabel={`${winRate ?? 0}% win rate`}><Text style={styles.statValue}>{winRate}%</Text><Text style={styles.statLabel}>WIN RATE</Text></View>
          <View style={styles.statCard} accessible={true} accessibilityLabel={`${currentWinStreak ?? 0} streak`}><Text style={styles.statValue}>{currentWinStreak ?? 0}</Text><Text style={styles.statLabel}>STREAK</Text></View>
          <View style={styles.statCard} accessible={true} accessibilityLabel={`${(chips ?? 0).toLocaleString()} chips`}><Text style={styles.statValue}>{(chips ?? 0).toLocaleString()}</Text><Text style={styles.statLabel} accessibilityLabel="CHIPS">CHIPS 💰</Text></View>
        </View>

        <Pressable style={styles.menuRow} onPress={() => router.push('/achievements' as any)} accessibilityRole="button" accessibilityLabel={t().profileMenuAchievements} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={styles.menuEmoji} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">🥇</Text><Text style={styles.menuLabel} accessibilityLanguage={getLanguage() === "he" ? "he" : undefined}>{t().profileMenuAchievements}</Text><Text style={styles.menuArrow} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">{isRTL() ? '‹' : '›'}</Text>
        </Pressable>
        {/* Daily Missions entry HIDDEN 2026-07-20: claim_mission_d marks a mission claimed and
            returns a reward but never credits it (no ledger/leaderboard write) — a broken
            promise. Re-enable only after the guarded crediting fix (idempotency + cap) ships. */}
        <Pressable style={styles.menuRow} onPress={() => router.push('/hand-history' as any)} accessibilityRole="button" accessibilityLabel={t().profileMenuHandHistory} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={styles.menuEmoji} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">📖</Text><Text style={styles.menuLabel} accessibilityLanguage={getLanguage() === "he" ? "he" : undefined}>{t().profileMenuHandHistory}</Text><Text style={styles.menuArrow} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">{isRTL() ? '‹' : '›'}</Text>
        </Pressable>
        <Pressable style={styles.menuRow} onPress={() => router.push('/stats' as any)} accessibilityRole="button" accessibilityLabel={t().profileMenuDetailedStats} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={styles.menuEmoji} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">📊</Text><Text style={styles.menuLabel} accessibilityLanguage={getLanguage() === "he" ? "he" : undefined}>{t().profileMenuDetailedStats}</Text><Text style={styles.menuArrow} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">{isRTL() ? '‹' : '›'}</Text>
        </Pressable>
        {/* VAMOS-NAV-3TABS 2026-08-31 — Cups moved off the bottom bar into Profile (its new canonical
            home). Same /cups route the tab used; the Cups screen is unchanged. */}
        <Pressable style={styles.menuRow} onPress={() => router.push('/cups' as any)} accessibilityRole="button" accessibilityLabel={t().tabCups} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={styles.menuEmoji} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">🏆</Text><Text style={styles.menuLabel} accessibilityLanguage={getLanguage() === "he" ? "he" : undefined}>{t().tabCups}</Text><Text style={styles.menuArrow} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">{isRTL() ? '‹' : '›'}</Text>
        </Pressable>
        {/* Dedupe: leaderboard lives canonically in the Friends tab (removed from Profile + Side Menu). */}
        <Pressable style={styles.menuRow} onPress={() => router.push('/settings' as any)} accessibilityRole="button" accessibilityLabel={t().profileMenuSettings} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={styles.menuEmoji} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">⚙️</Text><Text style={styles.menuLabel} accessibilityLanguage={getLanguage() === "he" ? "he" : undefined}>{t().profileMenuSettings}</Text><Text style={styles.menuArrow} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">{isRTL() ? '‹' : '›'}</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  // VAMOS-THEME-SWEEP-2 — bg maroon → obsidian; title + stat value gold → mint
  container: { flex: 1, backgroundColor: '#161922' },
  title: { color: '#4FD6A8', fontSize: rf(28), fontWeight: '900', letterSpacing: 4, textAlign: 'center', paddingTop: rs(16), marginBottom: rs(4) },
  playerName: { color: 'rgba(255,255,255,0.87)', fontSize: rf(13), textAlign: 'center', marginBottom: rs(20) },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: rs(8), paddingHorizontal: rs(16), marginBottom: rs(20) },
  statCard: { flex: 1, minWidth: '45%', backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(79,214,168,0.20)', borderRadius: rv(12), padding: rs(14), alignItems: 'center' },
  statValue: { color: '#4FD6A8', fontSize: rf(22), fontWeight: '900' },
  statLabel: { color: 'rgba(255,255,255,0.87)', fontSize: rf(10), fontWeight: '700', letterSpacing: 1, marginTop: rs(2) },
  menuRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: rs(16), paddingHorizontal: rs(20), borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' },
  menuEmoji: { fontSize: rf(20), marginRight: rs(14) },
  menuLabel: { flex: 1, color: '#ffffff', fontSize: rf(15), fontWeight: '500' },
  menuArrow: { color: 'rgba(255,255,255,0.7)', fontSize: rf(20) },
});
