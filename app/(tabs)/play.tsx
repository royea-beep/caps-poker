import { useEffect } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { rf, rs, rv } from '../../utils/responsive';

export default function PlayScreen() {
  const router = useRouter();
  useEffect(() => { import('../../utils/analytics').then(({ track }) => track('screen_view', {}, 'play')).catch(() => {}); }, []);
  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title} accessibilityRole="header">PLAY</Text>
      <Text style={styles.sub}>Choose your game mode</Text>

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

      <Pressable accessible={true} accessibilityRole="button" accessibilityLabel="Online / Local WiFi. Host or join a game" hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} style={[styles.card, { borderColor: '#6b7280' }]} onPress={() => router.push('/settings' as any)}>
        <Text style={styles.cardEmoji} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">🌐</Text>
        <Text style={styles.cardTitle}>Online / Local WiFi</Text>
        <Text style={styles.cardSub}>Host or join a game</Text>
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1C0508', paddingHorizontal: rs(20), paddingTop: rs(16) },
  title: { color: '#FFD700', fontSize: rf(28), fontWeight: '900', letterSpacing: 4, textAlign: 'center', marginBottom: rs(4) },
  sub: { color: 'rgba(255,255,255,0.85)', fontSize: rf(12), textAlign: 'center', marginBottom: rs(24) },
  card: { backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderRadius: rv(14), padding: rs(18), marginBottom: rs(12), flexDirection: 'row', alignItems: 'center', gap: rs(14) },
  cardEmoji: { fontSize: rf(28) },
  cardTitle: { color: '#ffffff', fontSize: rf(16), fontWeight: '700' },
  cardSub: { color: 'rgba(255,255,255,0.85)', fontSize: rf(12), marginTop: rs(2) },
});
