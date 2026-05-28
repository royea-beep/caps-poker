import React, { useEffect, useState } from 'react';
import { t, getLanguage } from '../../utils/i18n';
import { View, Text, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { rf, rs, rv } from '../../utils/responsive';
import { CapsSystem, CupItem } from '../../hooks/useCapsSystem';
import { getDeviceId } from '../../utils/leaderboard';

const TIER_LABELS: Record<string, string> = {
  bronze: 'ברונזה', silver: 'כסף', gold: 'זהב', platinum: 'פלטינה', diamond: 'יהלום',
};

export default function CupsScreen() {
  const [cups, setCups] = useState<CupItem[] | null>(null);
  const [earned, setEarned] = useState(0);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    import('../../utils/analytics').then(({ track }) => track('screen_view', {}, 'cups')).catch(() => {});
    getDeviceId().then(async (deviceId) => {
      const data = await CapsSystem.getCupCollection(deviceId);
      if (data) { setCups(data.cups); setEarned(data.earned); setTotal(data.total); }
    }).catch(() => {});
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      {/* PR-I: was bilingual "CUPS / כוסות" — single active-locale now */}
      <Text style={styles.title} accessibilityRole="header" accessibilityLanguage={getLanguage() === 'he' ? 'he' : undefined}>{t().cupsTitle.toUpperCase()}</Text>
      <Text style={styles.sub} accessibilityLiveRegion="polite" accessibilityLanguage={getLanguage() === 'he' ? 'he' : undefined}>{t().cupsSubtitle(earned, total)}</Text>

      {cups === null ? (
        <ActivityIndicator color="#FFD700" style={{ marginTop: rs(40) }} accessibilityLiveRegion="polite" />
      ) : (
        <ScrollView contentContainerStyle={{ paddingBottom: rs(40) }} showsVerticalScrollIndicator={false}>
          {cups.map(cup => (
            <View key={cup.id} style={[styles.cupRow, !cup.earned && styles.cupRowLocked]} accessibilityState={{ disabled: !cup.earned }} accessible={true} accessibilityLabel={`Trophy, ${cup.name_he || TIER_LABELS[cup.tier] || cup.tier}${!cup.earned ? ', locked' : ', earned'}, tier ${cup.tier}, progress ${cup.progress}%`}>
              <View style={[styles.cupIcon, { backgroundColor: cup.earned ? cup.color : 'rgba(255,255,255,0.08)' }]}>
                <Text style={{ fontSize: rf(26), opacity: cup.earned ? 1 : 0.3 }} accessibilityLabel="Trophy">🏆</Text>
              </View>
              <View style={styles.cupInfo}>
                <Text style={[styles.cupName, !cup.earned && { color: 'rgba(255,255,255,0.75)' }]} accessibilityLanguage="he">
                  {!cup.earned ? '🔒 ' : ''}{cup.name_he || TIER_LABELS[cup.tier] || cup.tier}
                </Text>
                <Text style={styles.cupTier}>{String(cup.tier ?? "").toUpperCase()}</Text>
                {!cup.earned && (
                  <View style={styles.progressBar}>
                    <View style={[styles.progressFill, { width: `${Math.min(100, cup.progress)}%` as any, backgroundColor: cup.color }]} />
                  </View>
                )}
              </View>
              {cup.earned && <Text style={styles.earned} accessibilityElementsHidden={true} importantForAccessibility="no-hide-descendants">✅</Text>}
            </View>
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1C0508', paddingHorizontal: rs(20), paddingTop: rs(16) },
  title: { color: '#FFD700', fontSize: rf(28), fontWeight: '900', letterSpacing: 4, textAlign: 'center', marginBottom: rs(4) },
  sub: { color: 'rgba(255,255,255,0.75)', fontSize: rf(11), textAlign: 'center', marginBottom: rs(24) },
  cupRow: { flexDirection: 'row', alignItems: 'center', gap: rs(14), backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', borderRadius: rv(14), padding: rs(16), marginBottom: rs(10) },
  cupRowLocked: { opacity: 0.7 },
  cupIcon: { width: rs(52), height: rs(52), borderRadius: rv(12), alignItems: 'center', justifyContent: 'center' },
  cupInfo: { flex: 1 },
  cupName: { color: '#ffffff', fontSize: rf(15), fontWeight: '700' },
  cupTier: { color: 'rgba(255,255,255,0.75)', fontSize: rf(10), fontWeight: '600', letterSpacing: 1, marginTop: rs(2) },
  progressBar: { height: rs(4), backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: rs(2), marginTop: rs(6), overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: rs(2) },
  earned: { fontSize: rf(20) },
});
