import { useEffect } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { rf, rs, rv } from '../../utils/responsive';
import { t, getLanguage } from '../../utils/i18n';

export default function PlayScreen() {
  const router = useRouter();
  useEffect(() => { import('../../utils/analytics').then(({ track }) => track('screen_view', {}, 'play')).catch(() => {}); }, []);
  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title} accessibilityRole="header">PLAY</Text>
      <Text style={styles.sub} accessibilityLanguage={getLanguage() === 'he' ? 'he' : undefined}>{t().playChooseMode}</Text>

      {/* VAMOS-CAPS-MP-LOBBY Phase 2 — the multiplayer lobby (open tables / invite by code) */}
      <Pressable accessible={true} accessibilityRole="button" accessibilityLabel="Multiplayer Lobby. Join an open table or invite friends by code" hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} style={[styles.card, { borderColor: '#4FD6A8' }]} onPress={() => router.push('/lobby' as any)}>
        <Text style={styles.cardEmoji} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">🌐</Text>
        <View>
          <Text style={styles.cardTitle}>Multiplayer Lobby</Text>
          <Text style={styles.cardSub}>Join an open table · invite friends by code</Text>
        </View>
      </Pressable>

      <Pressable accessible={true} accessibilityRole="button" accessibilityLabel="Quick Poker. 200 · Fast-paced Omaha" hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} style={[styles.card, { borderColor: '#c96a1a' }]} onPress={() => router.push('/quick-poker' as any)}>
        <Text style={styles.cardEmoji} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">⚡</Text>
        <Text style={styles.cardTitle}>Quick Poker</Text>
        <Text style={styles.cardSub} accessibilityLabel="200 · Fast-paced Omaha">200 💰 · Fast-paced Omaha</Text>
      </Pressable>

      <Pressable accessible={true} accessibilityRole="button" accessibilityLabel="Sit & Go. 100 · Tournament format" hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} style={[styles.card, { borderColor: '#3b82f6' }]} onPress={() => router.push('/sit-and-go' as any)}>
        <Text style={styles.cardEmoji} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">🎯</Text>
        <Text style={styles.cardTitle}>Sit &amp; Go</Text>
        <Text style={styles.cardSub} accessibilityLabel="100 · Tournament format">100 💰 · Tournament format</Text>
      </Pressable>

      <Pressable accessible={true} accessibilityRole="button" accessibilityLabel="Tournament. Multi-round competition" hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} style={[styles.card, { borderColor: '#8b5cf6' }]} onPress={() => router.push('/tournament' as any)}>
        <Text style={styles.cardEmoji} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">🏆</Text>
        <Text style={styles.cardTitle}>Tournament</Text>
        <Text style={styles.cardSub}>Multi-round competition</Text>
      </Pressable>

      {/* PR-I — was a single card titled "Online / Local WiFi" whose onPress
          routed to /settings (a lie surfaced by the 2026-05-28 audit). Split
          into two honest cards now that /lobby/host and /lobby/join exist. */}
      <Pressable accessible={true} accessibilityRole="button" accessibilityLabel={`${t().hostGame}. ${t().hostLocalGameSub}`} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} style={[styles.card, { borderColor: '#60a5fa' }]} onPress={() => router.push('/lobby/host' as any)}>
        <Text style={styles.cardEmoji} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">📡</Text>
        <View>
          <Text style={styles.cardTitle} accessibilityLanguage={getLanguage() === 'he' ? 'he' : undefined}>{t().hostGame}</Text>
          <Text style={styles.cardSub} accessibilityLanguage={getLanguage() === 'he' ? 'he' : undefined}>{t().hostLocalGameSub}</Text>
        </View>
      </Pressable>

      <Pressable accessible={true} accessibilityRole="button" accessibilityLabel={`${t().joinGame}. ${t().joinLocalGameSub}`} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} style={[styles.card, { borderColor: '#a78bfa' }]} onPress={() => router.push('/lobby/join' as any)}>
        <Text style={styles.cardEmoji} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">🔗</Text>
        <View>
          <Text style={styles.cardTitle} accessibilityLanguage={getLanguage() === 'he' ? 'he' : undefined}>{t().joinGame}</Text>
          <Text style={styles.cardSub} accessibilityLanguage={getLanguage() === 'he' ? 'he' : undefined}>{t().joinLocalGameSub}</Text>
        </View>
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  // VAMOS-THEME-SWEEP-2 — bg maroon-red → obsidian; title gold → mint
  container: { flex: 1, backgroundColor: '#161922', paddingHorizontal: rs(20), paddingTop: rs(16) },
  title: { color: '#4FD6A8', fontSize: rf(28), fontWeight: '900', letterSpacing: 4, textAlign: 'center', marginBottom: rs(4) },
  sub: { color: 'rgba(255,255,255,0.85)', fontSize: rf(12), textAlign: 'center', marginBottom: rs(24) },
  card: { backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderRadius: rv(14), padding: rs(18), marginBottom: rs(12), flexDirection: 'row', alignItems: 'center', gap: rs(14) },
  cardEmoji: { fontSize: rf(28) },
  cardTitle: { color: '#ffffff', fontSize: rf(16), fontWeight: '700' },
  cardSub: { color: 'rgba(255,255,255,0.85)', fontSize: rf(12), marginTop: rs(2) },
});
