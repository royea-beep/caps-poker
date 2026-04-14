import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { rf, rs, rv } from '../../utils/responsive';

export default function FriendsScreen() {
  const router = useRouter();
  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>FRIENDS</Text>
      <Text style={styles.sub}>Challenge · Invite · Compete</Text>

      <Pressable style={[styles.card, { borderColor: '#FFD700' }]} onPress={() => router.push('/referral' as any)}>
        <Text style={styles.cardEmoji}>🎁</Text>
        <View><Text style={styles.cardTitle}>Invite Friends</Text><Text style={styles.cardSub}>Share your referral code · +100 💰 each</Text></View>
      </Pressable>

      <Pressable style={[styles.card, { borderColor: '#4ade80' }]} onPress={() => router.push('/leaderboard' as any)}>
        <Text style={styles.cardEmoji}>📊</Text>
        <View><Text style={styles.cardTitle}>Leaderboard</Text><Text style={styles.cardSub}>See where you rank globally</Text></View>
      </Pressable>

      <Pressable style={[styles.card, { borderColor: '#60a5fa' }]} onPress={() => router.push('/lobby/internet-host' as any)}>
        <Text style={styles.cardEmoji}>🌐</Text>
        <View><Text style={styles.cardTitle}>Host Online Game</Text><Text style={styles.cardSub}>Create a room for friends to join</Text></View>
      </Pressable>

      <Pressable style={[styles.card, { borderColor: '#a78bfa' }]} onPress={() => router.push('/lobby/internet-join' as any)}>
        <Text style={styles.cardEmoji}>🎮</Text>
        <View><Text style={styles.cardTitle}>Join Game</Text><Text style={styles.cardSub}>Enter a room code</Text></View>
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1C0508', paddingHorizontal: rs(20), paddingTop: rs(16) },
  title: { color: '#FFD700', fontSize: rf(28), fontWeight: '900', letterSpacing: 4, textAlign: 'center', marginBottom: rs(4) },
  sub: { color: 'rgba(255,255,255,0.4)', fontSize: rf(12), textAlign: 'center', marginBottom: rs(24) },
  card: { backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderRadius: rv(14), padding: rs(16), marginBottom: rs(12), flexDirection: 'row', alignItems: 'center', gap: rs(14) },
  cardEmoji: { fontSize: rf(26) },
  cardTitle: { color: '#ffffff', fontSize: rf(15), fontWeight: '700' },
  cardSub: { color: 'rgba(255,255,255,0.45)', fontSize: rf(12), marginTop: rs(2) },
});
