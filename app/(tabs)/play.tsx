import { useEffect, useCallback } from 'react';
import { View, Text, Pressable, StyleSheet, Alert, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { rf, rs, rv } from '../../utils/responsive';
import { t, getLanguage } from '../../utils/i18n';
import { useGameStore } from '../../store/gameStore';
import { getBoardCount } from '../../constants/gameConfig';
import { ECONOMY_FLAGS } from '../../constants/economyConfig';
import { getMatchCost, canAffordMatch } from '../../utils/economy';
import { track } from '../../utils/analytics';

/**
 * PLAY surface — VAMOS GAME-MODES-OVERHAUL + FRIENDS-CLUBS (TASK B).
 *
 * Single Player vs bots, the public Multiplayer Lobby (6-table pool), the one-off Quick
 * Private Table (invite-code), plus the global Leaderboard and Invite Friends — the last
 * two moved here from Friends, which is now the CLUBS tab.
 */
export default function PlayScreen() {
  const router = useRouter();
  const config = useGameStore((s) => s.config);
  const chips = useGameStore((s) => s.chips);

  useEffect(() => { import('../../utils/analytics').then(({ track }) => track('screen_view', {}, 'play')).catch(() => {}); }, []);

  const playSinglePlayer = useCallback(() => {
    // Same affordability gate as Home's PLAY NOW so the two solo entries behave alike.
    if (ECONOMY_FLAGS.matchCostEnabled) {
      const cost = getMatchCost(config.potPerBoard, getBoardCount(config.numberOfPlayers));
      if (!canAffordMatch(chips, cost)) {
        Alert.alert('Not Enough Chips', `You need ${cost} chips to play.`);
        return;
      }
    }
    track('mode_start', { mode: 'single_player', player_count: config.numberOfPlayers }, 'play');
    track('game_started', { player_count: config.numberOfPlayers }, 'play');
    router.push('/game' as any);
  }, [config, chips, router]);

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title} accessibilityRole="header">PLAY</Text>
      <Text style={styles.sub} accessibilityLanguage={getLanguage() === 'he' ? 'he' : undefined}>{t().playChooseMode}</Text>

      <ScrollView contentContainerStyle={{ paddingBottom: rs(24) }} showsVerticalScrollIndicator={false}>
        {/* Single Player vs bots — the unified game screen (Home has the player-count picker) */}
        <Pressable accessible={true} accessibilityRole="button" accessibilityLabel="שחקן יחיד. אימון מול בוטים" hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} style={[styles.card, { borderColor: '#F5B546' }]} onPress={playSinglePlayer}>
          <Text style={styles.cardEmoji} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">🤖</Text>
          <View style={styles.cardBody}>
            <Text style={styles.cardTitle}>שחקן יחיד</Text>
            <Text style={styles.cardSub}>אימון מול בוטים · {getBoardCount(config.numberOfPlayers)} לוחות</Text>
          </View>
        </Pressable>

        {/* Multiplayer lobby (public 6-table pool) */}
        <Pressable accessible={true} accessibilityRole="button" accessibilityLabel="לובי מרובה משתתפים. הצטרפות לשולחן פומבי פתוח" hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} style={[styles.card, { borderColor: '#4FD6A8' }]} onPress={() => router.push('/lobby' as any)}>
          <Text style={styles.cardEmoji} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">🌐</Text>
          <View style={styles.cardBody}>
            <Text style={styles.cardTitle}>לובי מרובה משתתפים</Text>
            <Text style={styles.cardSub}>הצטרף לשולחן פומבי · מתחיל אוטומטית כשמתמלא</Text>
          </View>
        </Pressable>

        {/* Quick private table (one-off invite code) */}
        <Pressable accessible={true} accessibilityRole="button" accessibilityLabel="שולחן פרטי מהיר. יצירת שולחן חד-פעמי לשיתוף, או הצטרפות עם קוד" hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} style={[styles.card, { borderColor: '#60a5fa' }]} onPress={() => router.push('/lobby/private' as any)}>
          <Text style={styles.cardEmoji} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">🔒</Text>
          <View style={styles.cardBody}>
            <Text style={styles.cardTitle}>שולחן פרטי מהיר</Text>
            <Text style={styles.cardSub}>שולחן חד-פעמי · שתף קוד או הצטרף לאחד</Text>
          </View>
        </Pressable>

        {/* Global leaderboard (moved here from Friends) */}
        <Pressable accessible={true} accessibilityRole="button" accessibilityLabel="Leaderboard. See where you rank globally" hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} style={[styles.card, { borderColor: '#4ade80' }]} onPress={() => router.push('/leaderboard' as any)}>
          <Text style={styles.cardEmoji} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">📊</Text>
          <View style={styles.cardBody}>
            <Text style={styles.cardTitle} accessibilityLanguage={getLanguage() === 'he' ? 'he' : undefined}>{t().friendsLeaderboardCard}</Text>
            <Text style={styles.cardSub} accessibilityLanguage={getLanguage() === 'he' ? 'he' : undefined}>{t().friendsLeaderboardCardSub}</Text>
          </View>
        </Pressable>

        {/* Invite friends (moved here from Friends) */}
        <Pressable accessible={true} accessibilityRole="button" accessibilityLanguage={getLanguage() === 'he' ? 'he' : undefined} accessibilityLabel={`${t().inviteFriends} · ${t().inviteFriendsSub(100)}`} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} style={[styles.card, { borderColor: '#f0abfc' }]} onPress={() => router.push('/referral' as any)}>
          <Text style={styles.cardEmoji} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">🎁</Text>
          <View style={styles.cardBody}>
            <Text style={styles.cardTitle} accessibilityLanguage={getLanguage() === 'he' ? 'he' : undefined}>{t().inviteFriends}</Text>
            <Text style={styles.cardSub} accessibilityLanguage={getLanguage() === 'he' ? 'he' : undefined} accessibilityLabel={t().inviteFriendsSub(100).replace('💰 ', '')}>{t().inviteFriendsSub(100)}</Text>
          </View>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#161922', paddingHorizontal: rs(20), paddingTop: rs(16) },
  title: { color: '#4FD6A8', fontSize: rf(28), fontWeight: '900', letterSpacing: 4, textAlign: 'center', marginBottom: rs(4) },
  sub: { color: 'rgba(255,255,255,0.85)', fontSize: rf(12), textAlign: 'center', marginBottom: rs(20) },
  card: { backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderRadius: rv(14), padding: rs(18), marginBottom: rs(12), flexDirection: 'row', alignItems: 'center', gap: rs(14) },
  cardBody: { flex: 1 },
  cardEmoji: { fontSize: rf(28) },
  cardTitle: { color: '#ffffff', fontSize: rf(16), fontWeight: '700' },
  cardSub: { color: 'rgba(255,255,255,0.85)', fontSize: rf(12), marginTop: rs(2) },
});
