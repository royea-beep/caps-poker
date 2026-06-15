import { useEffect } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { t, getLanguage } from '../../utils/i18n';
import { SafeAreaView } from 'react-native-safe-area-context';
import { rf, rs, rv } from '../../utils/responsive';

export default function FriendsScreen() {
  const router = useRouter();
  useEffect(() => { import('../../utils/analytics').then(({ track }) => track('screen_view', {}, 'friends')).catch(() => {}); }, []);
  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title} accessibilityRole="header">FRIENDS</Text>
      <Text style={styles.sub} accessibilityRole="header">Challenge · Invite · Compete</Text>

      <Pressable accessibilityRole="button" accessibilityLanguage={getLanguage() === "he" ? "he" : undefined} accessibilityLabel={`${t().inviteFriends} · ${t().inviteFriendsSub(100)}`} style={[styles.card, { borderColor: '#4FD6A8' }]} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} onPress={() => router.push('/referral' as any)}>
        <Text style={styles.cardEmoji} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">🎁</Text>
        <View><Text style={styles.cardTitle} accessibilityLanguage={getLanguage() === "he" ? "he" : undefined}>{t().inviteFriends}</Text><Text style={styles.cardSub} accessibilityLanguage={getLanguage() === "he" ? "he" : undefined} accessibilityLabel={t().inviteFriendsSub(100).replace("💰 ", "")}>{t().inviteFriendsSub(100)}</Text></View>
      </Pressable>

      {/* PR-I: routed through t() */}
      <Pressable accessibilityRole="button" accessibilityLabel={`${t().friendsLeaderboardCard} · ${t().friendsLeaderboardCardSub}`} style={[styles.card, { borderColor: '#4ade80' }]} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} onPress={() => router.push('/leaderboard' as any)}>
        <Text style={styles.cardEmoji} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">📊</Text>
        <View><Text style={styles.cardTitle} accessibilityLanguage={getLanguage() === 'he' ? 'he' : undefined}>{t().friendsLeaderboardCard}</Text><Text style={styles.cardSub} accessibilityLanguage={getLanguage() === 'he' ? 'he' : undefined}>{t().friendsLeaderboardCardSub}</Text></View>
      </Pressable>

      <Pressable accessibilityRole="button" accessibilityLabel={`${t().hostOnlineGame} · ${t().hostOnlineGameSub}`} style={[styles.card, { borderColor: '#60a5fa' }]} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} onPress={() => router.push('/lobby/internet-host' as any)}>
        <Text style={styles.cardEmoji} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">🌐</Text>
        <View><Text style={styles.cardTitle} accessibilityLanguage={getLanguage() === 'he' ? 'he' : undefined}>{t().hostOnlineGame}</Text><Text style={styles.cardSub} accessibilityLanguage={getLanguage() === 'he' ? 'he' : undefined}>{t().hostOnlineGameSub}</Text></View>
      </Pressable>

      <Pressable accessibilityRole="button" accessibilityLabel={`${t().joinGame} · ${t().joinOnlineGameSub}`} style={[styles.card, { borderColor: '#a78bfa' }]} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} onPress={() => router.push('/lobby/internet-join' as any)}>
        <Text style={styles.cardEmoji} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">🎮</Text>
        <View><Text style={styles.cardTitle} accessibilityLanguage={getLanguage() === 'he' ? 'he' : undefined}>{t().joinGame}</Text><Text style={styles.cardSub} accessibilityLanguage={getLanguage() === 'he' ? 'he' : undefined}>{t().joinOnlineGameSub}</Text></View>
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  // VAMOS-THEME-SWEEP-3 — bg maroon → obsidian, title gold → mint
  container: { flex: 1, backgroundColor: '#161922', paddingHorizontal: rs(20), paddingTop: rs(16) },
  title: { color: '#4FD6A8', fontSize: rf(28), fontWeight: '900', letterSpacing: 4, textAlign: 'center', marginBottom: rs(4) },
  sub: { color: 'rgba(255,255,255,0.75)', fontSize: rf(12), textAlign: 'center', marginBottom: rs(24) },
  card: { backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderRadius: rv(14), padding: rs(16), marginBottom: rs(12), flexDirection: 'row', alignItems: 'center', gap: rs(14) },
  cardEmoji: { fontSize: rf(26) },
  cardTitle: { color: '#ffffff', fontSize: rf(15), fontWeight: '700' },
  cardSub: { color: 'rgba(255,255,255,0.75)', fontSize: rf(12), marginTop: rs(2) },
});
