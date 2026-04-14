import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { rf, rs, rv } from '../../utils/responsive';

export default function PlayScreen() {
  const router = useRouter();
  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>PLAY</Text>
      <Text style={styles.sub}>Choose your game mode</Text>

      <Pressable style={[styles.card, { borderColor: '#c96a1a' }]} onPress={() => router.push('/quick-poker' as any)}>
        <Text style={styles.cardEmoji}>⚡</Text>
        <Text style={styles.cardTitle}>Quick Poker</Text>
        <Text style={styles.cardSub}>200 💰 · Fast-paced Omaha</Text>
      </Pressable>

      <Pressable style={[styles.card, { borderColor: '#3b82f6' }]} onPress={() => router.push('/sit-and-go' as any)}>
        <Text style={styles.cardEmoji}>🎯</Text>
        <Text style={styles.cardTitle}>Sit &amp; Go</Text>
        <Text style={styles.cardSub}>100 💰 · Tournament format</Text>
      </Pressable>

      <Pressable style={[styles.card, { borderColor: '#8b5cf6' }]} onPress={() => router.push('/tournament' as any)}>
        <Text style={styles.cardEmoji}>🏆</Text>
        <Text style={styles.cardTitle}>Tournament</Text>
        <Text style={styles.cardSub}>Multi-round competition</Text>
      </Pressable>

      <Pressable style={[styles.card, { borderColor: '#6b7280' }]} onPress={() => router.push('/settings' as any)}>
        <Text style={styles.cardEmoji}>🌐</Text>
        <Text style={styles.cardTitle}>Online / Local WiFi</Text>
        <Text style={styles.cardSub}>Host or join a game</Text>
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1C0508', paddingHorizontal: rs(20), paddingTop: rs(16) },
  title: { color: '#FFD700', fontSize: rf(28), fontWeight: '900', letterSpacing: 4, textAlign: 'center', marginBottom: rs(4) },
  sub: { color: 'rgba(255,255,255,0.4)', fontSize: rf(12), textAlign: 'center', marginBottom: rs(24) },
  card: { backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderRadius: rv(14), padding: rs(18), marginBottom: rs(12), flexDirection: 'row', alignItems: 'center', gap: rs(14) },
  cardEmoji: { fontSize: rf(28) },
  cardTitle: { color: '#ffffff', fontSize: rf(16), fontWeight: '700' },
  cardSub: { color: 'rgba(255,255,255,0.45)', fontSize: rf(12), marginTop: rs(2) },
});
