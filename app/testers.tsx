import React from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS } from '../constants/gameConfig';
import { Button } from '../components/Button';

const VERSION = 'v1.3.0';

const FEATURES = [
  { icon: '\u2660', title: 'Hand Evaluation', desc: 'Arrange 16 cards across 4 Omaha boards and see how you score' },
  { icon: '\u23F1', title: 'Timer Pressure', desc: 'Beat the clock — arrangement time is configurable in Settings' },
  { icon: '\u{1F4CA}', title: 'Efficiency Analysis', desc: 'Post-hand breakdown shows how optimal your card placements were' },
  { icon: '\u{1F310}', title: 'Multiplayer', desc: 'Host or join games over WiFi, or play online via Supabase Realtime' },
];

const CHECKLIST = [
  'Cards drag and drop smoothly',
  'Hand rankings display correctly',
  'Timer counts down without freezing',
  'Chip balance updates after each hand',
  'Bot opponents make reasonable plays',
  'Sound effects play at the right moments',
  'Multiplayer lobby connects reliably',
  'UI looks correct on your device size',
];

const KNOWN_ISSUES = [
  'Web version may have minor layout differences vs native',
  'Bot speed can feel inconsistent at very low timer values',
  'Leaderboard may take a moment to sync on first load',
];

export default function TestersScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backText}>{'\u2190'} Back</Text>
        </Pressable>
        <Text style={styles.headerTitle}>TESTERS</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Hero Section */}
        <View style={styles.heroSection}>
          <Text style={styles.heroSuits}>{'\u2660'} {'\u2665'} {'\u2666'} {'\u2663'}</Text>
          <Text style={styles.heroTitle}>Caps Poker Beta</Text>
          <View style={styles.versionRow}>
            <Text style={styles.versionText}>{VERSION}</Text>
            <View style={styles.betaBadge}>
              <Text style={styles.betaBadgeText}>BETA</Text>
            </View>
          </View>
          <View style={styles.divider} />
        </View>

        {/* Welcome */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>WELCOME, TESTER</Text>
          <View style={styles.card}>
            <Text style={styles.bodyText}>
              Thanks for helping us test Caps Poker — an Omaha poker learning and practice app.
              Your goal is to arrange 16 hole cards across multiple boards to build the strongest
              possible hands, all under time pressure.
            </Text>
            <Text style={[styles.bodyText, { marginTop: 10 }]}>
              This is a beta build. Things might break. That is exactly why you are here.
            </Text>
          </View>
        </View>

        {/* What to Test */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>WHAT TO TEST</Text>
          {FEATURES.map((f, i) => (
            <View key={i} style={styles.featureRow}>
              <Text style={styles.featureIcon}>{f.icon}</Text>
              <View style={styles.featureContent}>
                <Text style={styles.featureTitle}>{f.title}</Text>
                <Text style={styles.featureDesc}>{f.desc}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* What to Look For */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>WHAT TO LOOK FOR</Text>
          <View style={styles.card}>
            {CHECKLIST.map((item, i) => (
              <View key={i} style={styles.checklistRow}>
                <Text style={styles.checkboxEmpty}>{'\u25A1'}</Text>
                <Text style={styles.checklistText}>{item}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Known Issues */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>KNOWN ISSUES</Text>
          <View style={styles.card}>
            {KNOWN_ISSUES.map((issue, i) => (
              <View key={i} style={styles.issueRow}>
                <Text style={styles.issueBullet}>{'\u26A0'}</Text>
                <Text style={styles.issueText}>{issue}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Bug Reporting */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>FOUND A BUG?</Text>
          <View style={styles.card}>
            <Text style={styles.bodyText}>
              Shake your phone (or tap the bug button) anywhere in the app to open the bug reporter.
              Describe what happened, what you expected, and we will get a screenshot + device info automatically.
            </Text>
          </View>
        </View>

        {/* CTA */}
        <View style={styles.ctaSection}>
          <Button
            title="LET'S PLAY"
            variant="gold"
            onPress={() => router.replace('/')}
          />
          <Text style={styles.ctaHint}>Jump to the home screen and start a hand</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.boardBorder,
  },
  backButton: {
    padding: 4,
  },
  backText: {
    color: COLORS.textSecondary,
    fontSize: 15,
  },
  headerTitle: {
    color: COLORS.goldBright,
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 4,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },

  // Hero
  heroSection: {
    alignItems: 'center',
    marginBottom: 24,
  },
  heroSuits: {
    color: '#c4a882',
    fontSize: 22,
    letterSpacing: 14,
    marginBottom: 8,
  },
  heroTitle: {
    fontSize: 32,
    fontWeight: '900',
    color: COLORS.gold,
    letterSpacing: 4,
    textShadowColor: COLORS.goldGlow,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 20,
  },
  versionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 8,
  },
  versionText: {
    color: COLORS.textMuted,
    fontSize: 14,
    fontWeight: '600',
  },
  betaBadge: {
    backgroundColor: COLORS.gold,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 4,
  },
  betaBadgeText: {
    color: COLORS.background,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 2,
  },
  divider: {
    width: '60%',
    height: 1,
    backgroundColor: COLORS.gold,
    marginTop: 20,
    opacity: 0.3,
  },

  // Sections
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    color: COLORS.gold,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 3,
    marginBottom: 10,
  },
  card: {
    backgroundColor: COLORS.feltLight,
    borderRadius: 8,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.boardBorder,
  },
  bodyText: {
    color: COLORS.textPrimary,
    fontSize: 14,
    lineHeight: 21,
    fontWeight: '400',
  },

  // Features
  featureRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: COLORS.feltLight,
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: COLORS.boardBorder,
  },
  featureIcon: {
    fontSize: 22,
    marginRight: 12,
    marginTop: 2,
  },
  featureContent: {
    flex: 1,
  },
  featureTitle: {
    color: COLORS.goldBright,
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 3,
  },
  featureDesc: {
    color: COLORS.textSecondary,
    fontSize: 13,
    lineHeight: 19,
  },

  // Checklist
  checklistRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  checkboxEmpty: {
    color: COLORS.gold,
    fontSize: 16,
    marginRight: 10,
    marginTop: 1,
  },
  checklistText: {
    color: COLORS.textPrimary,
    fontSize: 14,
    flex: 1,
    lineHeight: 20,
  },

  // Known Issues
  issueRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  issueBullet: {
    fontSize: 14,
    marginRight: 10,
    marginTop: 1,
  },
  issueText: {
    color: COLORS.textSecondary,
    fontSize: 13,
    flex: 1,
    lineHeight: 19,
  },

  // CTA
  ctaSection: {
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 20,
    gap: 10,
  },
  ctaHint: {
    color: COLORS.textMuted,
    fontSize: 12,
    fontWeight: '500',
  },
});
