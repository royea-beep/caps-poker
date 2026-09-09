/**
 * Battle Pass Screen — full season progress view.
 * RN Animated only — ZERO Reanimated.
 * Tier pulse uses Animated.loop(iterations:10) — never -1.
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';

import { useBattlePassStore } from '../stores/battlePassStore';
import { BATTLE_PASS_CONFIG, TIER_REWARDS } from '../constants/battlePassConfig';
import { getProgressToNextTier, getSeasonTimeRemaining, formatRewardLabel } from '../utils/battlePass';
import XPBar from '../components/XPBar';
import TierRewardCard from '../components/TierRewardCard';
import { rf, rs, rv } from '../utils/responsive';
import { BackControl } from '../components/BackControl';

/**
 * Alert.alert is a NO-OP ON WEB (this project's hard rule), which is why ten tier buttons were
 * reported inert when they were only mute. These two are the same one-line shape already applied to
 * Reset and to the delete-failure message — one implementation, used by every branch on this screen.
 */
function say(title: string, body: string) {
  if (Platform.OS === 'web') window.alert(`${title} — ${body}`);
  else Alert.alert(title, body);
}
function ask(title: string, body: string, confirmText: string, onConfirm: () => void) {
  if (Platform.OS === 'web') { if (window.confirm(`${title} — ${body}`)) onConfirm(); return; }
  Alert.alert(title, body, [
    { text: 'Cancel', style: 'cancel' },
    { text: confirmText, onPress: onConfirm },
  ]);
}


// ── Palette ──────────────────────────────────────────────────────────────────
const BG = '#0d0700';
const SURFACE = '#1a0e06';
const BORDER = '#3d2a1a';
const TEXT_PRIMARY = '#f5e6d3';
const TEXT_SECONDARY = '#78716C';
const GOLD = '#c96a1a';
const GREEN = '#4ade80';
const GRAY = '#3a3530';
const PREMIUM_BG = 'rgba(201,106,26,0.08)';

// ── Tier circle component ─────────────────────────────────────────────────────
interface TierCircleProps {
  tierNum: number;
  /** Which of the two tracks this circle belongs to — without it both rows announce a bare number. */
  trackLabel?: string;
  isCompleted: boolean;
  isCurrent: boolean;
  isLocked: boolean;
  onPress: () => void;
}

function TierCircle({ tierNum, isCompleted, isCurrent, isLocked, onPress, trackLabel }: TierCircleProps) {
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!isCurrent) return;

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.25, duration: 600, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      ]),
      { iterations: 10 },
    );
    loop.start();

    return () => {
      loop.stop();
      pulseAnim.setValue(1);
    };
  }, [isCurrent]);

  const circleStyle = isCompleted
    ? styles.circleCompleted
    : isCurrent
    ? styles.circleCurrent
    : isLocked
    ? styles.circleLocked
    : styles.circleDefault;

  const textStyle = isCompleted
    ? styles.circleTextCompleted
    : isCurrent
    ? styles.circleTextCurrent
    : styles.circleTextLocked;

  return (
    // HALF-BUILT-SCREENS 2026-08-21 — the free and premium tracks each render a circle per tier, so
    // with no label the screen announced "1 1 2 2 3 3 4 4 5 5": ten controls, five names, twice each.
    // The state was on screen in colour only, which is also the one channel greyscale removes.
    <Pressable
      onPress={onPress}
      hitSlop={4}
      accessibilityRole="button"
      accessibilityLabel={[
        trackLabel ? `${trackLabel} tier ${tierNum}` : `Tier ${tierNum}`,
        isCompleted ? 'claimed' : isCurrent ? 'current' : isLocked ? 'locked' : 'available',
      ].join(', ')}
      accessibilityState={{ disabled: false, selected: !!isCurrent }}
    >
      <Animated.View
        style={[
          styles.circle,
          circleStyle,
          isCurrent && { transform: [{ scale: pulseAnim }] },
        ]}
      >
        <Text style={textStyle}>
          {isCompleted ? '✓' : String(tierNum)}
        </Text>
      </Animated.View>
    </Pressable>
  );
}

// ── Mission row component ─────────────────────────────────────────────────────
interface MissionRowProps {
  desc: string;
  progress: number;
  target: number;
  xp: number;
  completed: boolean;
}

function MissionRow({ desc, progress, target, xp, completed }: MissionRowProps) {
  const fillFraction = target > 0 ? Math.min(1, progress / target) : 0;
  const animFill = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(animFill, {
      toValue: fillFraction,
      duration: 500,
      useNativeDriver: false,
    }).start();
  }, [fillFraction]);

  return (
    <View style={[styles.missionRow, completed && styles.missionRowCompleted]}>
      <View style={styles.missionLeft}>
        <Text style={[styles.missionDesc, completed && styles.missionDescCompleted]}>
          {desc}
        </Text>
        <View style={styles.missionBarTrack}>
          <Animated.View
            style={[
              styles.missionBarFill,
              completed && styles.missionBarCompleted,
              {
                width: animFill.interpolate({
                  inputRange: [0, 1],
                  outputRange: ['0%', '100%'],
                }),
              },
            ]}
          />
        </View>
        <Text style={styles.missionProgress}>
          {Math.min(progress, target)}/{target}
        </Text>
      </View>
      <View style={styles.missionXPBadge}>
        <Text style={styles.missionXPText}>+{xp} XP</Text>
        {completed && <Text style={styles.missionCheck}>✓</Text>}
      </View>
    </View>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────
export default function BattlePassScreen() {
  const router = useRouter();
  const store = useBattlePassStore();
  const {
    currentXP,
    currentTier,
    isPremium,
    claimedFreeTiers,
    claimedPremiumTiers,
    seasonStartDate,
    dailyMissions,
    weeklyMission,
    claimFreeReward,
    claimPremiumReward,
    upgradeToPremium,
    refreshDailyMissions,
    refreshWeeklyMission,
  } = store;

  // Refresh missions on mount
  useEffect(() => {
    refreshDailyMissions();
    refreshWeeklyMission();
  }, []);

  // XP progress
  const { progress, xpInTier, xpNeeded } = getProgressToNextTier(currentXP);

  // Season countdown
  const { daysLeft, hoursLeft, expired } = getSeasonTimeRemaining(seasonStartDate);

  // Handle tier press (show reward info + claim option)
  function handleTierPress(tierNum: number, isPremiumTrack: boolean) {
    const reward = TIER_REWARDS.find((r) => r.tier === tierNum);
    if (!reward) return;

    const item = isPremiumTrack ? reward.premium : reward.free;
    const label = formatRewardLabel(item);
    const isUnlocked = currentTier >= tierNum;
    const isClaimed = isPremiumTrack
      ? claimedPremiumTiers.includes(tierNum)
      : claimedFreeTiers.includes(tierNum);

    // HALF-BUILT-SCREENS 2026-08-21 — every branch below went through Alert.alert, a no-op on web.
    // That is why ten tier buttons were reported as inert: they were not inert, they were MUTE.
    // Third instance of this bug in three sprints (Reset, the delete-failure message, now here), so
    // it uses the same one-line shape rather than a fourth invention.
    if (!isUnlocked) {
      say(`Tier ${tierNum}`, `Reach tier ${tierNum} to unlock: ${label}`);
      return;
    }

    if (isClaimed) {
      say(`Tier ${tierNum}`, `Already claimed: ${label}`);
      return;
    }

    if (isPremiumTrack && !isPremium) {
      ask('Premium Required', 'Unlock Premium to claim this reward.', 'Unlock Premium', handleUnlockPremium);
      return;
    }

    ask(
      isPremiumTrack ? `Premium — Tier ${tierNum}` : `Tier ${tierNum}`,
      label,
      'Claim',
      () => {
        const ok = isPremiumTrack ? claimPremiumReward(tierNum) : claimFreeReward(tierNum);
        if (!ok) say('Oops', 'Could not claim reward.');
      },
    );
  }

  function handleUnlockPremium() {
    ask(
      'Unlock Premium',
      `Spend ${BATTLE_PASS_CONFIG.premiumChipCost.toLocaleString()} chips to unlock the Premium track?`,
      'Unlock',
      () => upgradeToPremium(),
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      {/* VAMOS-VISUAL-PASS-1 2026-06-19 — was headerShown: true with the
          native Stack header rendering a stray white bar behind the in-screen
          season header. The screen has its own custom <View style={styles.header}>
          (Season Name + countdown), so the native header is just visual noise. */}
      <Stack.Screen options={{ headerShown: false }} />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Header ─────────────────────────────────────────── */}
        <View style={styles.header}>
          {/* DEAD-END FIX 2026-08-13. This screen had NO back control of any kind — not a
              broken one, none at all. The native Stack header was disabled in 2026-06-19 (see
              the note above) because it painted a white bar behind this custom header, and
              nothing replaced the exit it took with it. Measured on the live deploy, both
              engines: zero back affordances on /battle-pass. On web the browser's back button
              hides it; on iOS the tester is stuck until they force-quit. */}
          <BackControl label="‹  Back" />
          <Text style={styles.seasonName}>{BATTLE_PASS_CONFIG.seasonName}</Text>
          <View style={styles.countdownRow}>
            {expired ? (
              <Text style={styles.countdownExpired}>Season Ended</Text>
            ) : (
              <Text style={styles.countdown}>
                {daysLeft}d {hoursLeft}h remaining
              </Text>
            )}
            {isPremium && (
              <View style={styles.premiumBadge}>
                <Text style={styles.premiumBadgeText}>⭐ PREMIUM</Text>
              </View>
            )}
          </View>
        </View>

        {/* ── XP Bar ─────────────────────────────────────────── */}
        <View style={styles.xpSection}>
          <XPBar
            currentXP={currentXP}
            currentTier={currentTier}
            progress={progress}
            xpInTier={xpInTier}
            xpNeeded={xpNeeded}
            compact={false}
          />
        </View>

        {/* ── Tier Track ─────────────────────────────────────── */}
        <View style={styles.tierSection}>
          <Text style={styles.sectionTitle}>TIER TRACK</Text>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.tierTrack}
          >
            {/* FREE row label */}
            <View style={styles.trackLabelCol}>
              <View style={styles.trackLabelFree}>
                <Text style={styles.trackLabelText}>FREE</Text>
              </View>
              <View style={styles.trackLabelPremium}>
                <Text style={[styles.trackLabelText, styles.trackLabelPremiumText]}>PREM</Text>
              </View>
            </View>

            {/* Tier columns */}
            {TIER_REWARDS.map(({ tier }) => {
              const freeCompleted = currentTier >= tier;
              const freeCurrent = currentTier + 1 === tier;
              const freeLocked = currentTier < tier;
              const premCompleted = isPremium && currentTier >= tier;
              const premCurrent = isPremium && currentTier + 1 === tier;
              const premLocked = !isPremium || currentTier < tier;

              return (
                <View key={tier} style={styles.tierCol}>
                  {/* FREE track circle */}
                  <TierCircle
                    tierNum={tier}
                    isCompleted={freeCompleted}
                    isCurrent={freeCurrent}
                    isLocked={freeLocked}
                    trackLabel="Free"
                    onPress={() => handleTierPress(tier, false)}
                  />
                  {/* PREMIUM track circle */}
                  <TierCircle
                    tierNum={tier}
                    isCompleted={premCompleted}
                    isCurrent={premCurrent}
                    isLocked={premLocked}
                    trackLabel="Premium"
                    onPress={() => handleTierPress(tier, true)}
                  />
                </View>
              );
            })}
          </ScrollView>
        </View>

        {/* ── Premium CTA ────────────────────────────────────── */}
        {!isPremium && (
          <Pressable
            style={styles.premiumBtn}
            onPress={handleUnlockPremium}
            // Same gap, on a control that SPENDS CHIPS. It rendered focusable with no role,
            // so a screen reader gave no indication the premium unlock was actionable.
            accessibilityRole="button"
            accessibilityLabel={`Unlock premium battle pass for ${BATTLE_PASS_CONFIG.premiumChipCost.toLocaleString()} chips`}
          >
            <Text style={styles.premiumBtnText}>
              ⭐ UNLOCK PREMIUM — {BATTLE_PASS_CONFIG.premiumChipCost.toLocaleString()} chips
            </Text>
          </Pressable>
        )}

        {/* ── Reward Preview (scrollable horizontal cards) ───── */}
        <View style={styles.rewardsSection}>
          <Text style={styles.sectionTitle}>UPCOMING REWARDS</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.rewardCards}
          >
            {TIER_REWARDS.slice(0, 10).map(({ tier, free, premium }) => (
              <View key={tier} style={styles.rewardPair}>
                <TierRewardCard
                  tier={tier}
                  rewardItem={free}
                  isUnlocked={currentTier >= tier}
                  isClaimed={claimedFreeTiers.includes(tier)}
                  isPremiumTrack={false}
                  onClaim={(t) => claimFreeReward(t)}
                />
                <TierRewardCard
                  tier={tier}
                  rewardItem={premium}
                  isUnlocked={isPremium && currentTier >= tier}
                  isClaimed={claimedPremiumTiers.includes(tier)}
                  isPremiumTrack
                  onClaim={(t) => claimPremiumReward(t)}
                />
              </View>
            ))}
          </ScrollView>
        </View>

        {/* ── Daily Missions ─────────────────────────────────── */}
        <View style={styles.missionsSection}>
          <Text style={styles.sectionTitle}>Daily Missions</Text>
          {dailyMissions.map((mission) => (
            <MissionRow
              key={mission.id}
              desc={mission.desc.en}
              progress={mission.progress}
              target={mission.target}
              xp={mission.xp}
              completed={mission.completed}
            />
          ))}
        </View>

        {/* ── Weekly Mission ─────────────────────────────────── */}
        {weeklyMission && (
          <View style={styles.missionsSection}>
            <Text style={styles.sectionTitle}>WEEKLY MISSION</Text>
            <MissionRow
              key={weeklyMission.id}
              desc={weeklyMission.desc.en}
              progress={weeklyMission.progress}
              target={weeklyMission.target}
              xp={weeklyMission.xp}
              completed={weeklyMission.completed}
            />
          </View>
        )}

        <View style={styles.bottomSpacer} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: BG,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: rs(16),
    paddingTop: rs(16),
    gap: rs(20),
  },

  // Header
  header: {
    gap: rs(6),
  },
  seasonName: {
    color: TEXT_PRIMARY,
    fontSize: rf(20),
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  countdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: rs(10),
  },
  countdown: {
    color: TEXT_SECONDARY,
    fontSize: rf(13),
    fontWeight: '500',
  },
  countdownExpired: {
    color: '#ff4444',
    fontSize: rf(13),
    fontWeight: '600',
  },
  premiumBadge: {
    backgroundColor: 'rgba(201,106,26,0.2)',
    borderRadius: rv(4),
    paddingVertical: rs(2),
    paddingHorizontal: rs(8),
    borderWidth: 1,
    borderColor: GOLD,
  },
  premiumBadgeText: {
    color: GOLD,
    fontSize: rf(10),
    fontWeight: '700',
    letterSpacing: 1,
  },

  // XP section
  xpSection: {
    backgroundColor: SURFACE,
    borderRadius: rv(10),
    borderWidth: 1,
    borderColor: BORDER,
    padding: rs(14),
  },

  // Tier track
  tierSection: {
    gap: rs(10),
  },
  sectionTitle: {
    color: TEXT_SECONDARY,
    fontSize: rf(11),
    fontWeight: '700',
    letterSpacing: 2,
  },
  tierTrack: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: rs(6),
    paddingVertical: rs(4),
    paddingRight: rs(16),
  },
  trackLabelCol: {
    gap: rs(12),
    paddingTop: rs(4),
    alignItems: 'flex-end',
    marginRight: rs(4),
  },
  trackLabelFree: {
    paddingVertical: rs(2),
  },
  trackLabelPremium: {
    paddingVertical: rs(2),
  },
  trackLabelText: {
    color: TEXT_SECONDARY,
    fontSize: rf(9),
    fontWeight: '700',
    letterSpacing: 1,
  },
  trackLabelPremiumText: {
    color: GOLD,
  },
  tierCol: {
    alignItems: 'center',
    gap: rs(12),
  },

  // Tier circles
  circle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
  circleDefault: {
    backgroundColor: SURFACE,
    borderColor: BORDER,
  },
  circleCompleted: {
    backgroundColor: 'rgba(74,222,128,0.15)',
    borderColor: GREEN,
  },
  circleCurrent: {
    backgroundColor: 'rgba(201,106,26,0.2)',
    borderColor: GOLD,
  },
  circleLocked: {
    backgroundColor: GRAY,
    borderColor: GRAY,
  },
  circleTextCompleted: {
    color: GREEN,
    fontSize: rf(12),
    fontWeight: '700',
  },
  circleTextCurrent: {
    color: GOLD,
    fontSize: rf(11),
    fontWeight: '800',
  },
  circleTextLocked: {
    color: TEXT_SECONDARY,
    fontSize: rf(10),
    fontWeight: '600',
  },

  // Premium CTA
  premiumBtn: {
    backgroundColor: GOLD,
    borderRadius: rv(10),
    paddingVertical: rs(14),
    alignItems: 'center',
  },
  premiumBtnText: {
    color: '#fff',
    fontSize: rf(14),
    fontWeight: '800',
    letterSpacing: 0.5,
  },

  // Reward cards
  rewardsSection: {
    gap: rs(10),
  },
  rewardCards: {
    gap: rs(10),
    paddingVertical: rs(4),
    paddingRight: rs(16),
  },
  rewardPair: {
    gap: rs(6),
  },

  // Missions
  missionsSection: {
    gap: rs(10),
  },
  missionRow: {
    backgroundColor: SURFACE,
    borderRadius: rv(8),
    borderWidth: 1,
    borderColor: BORDER,
    padding: rs(12),
    flexDirection: 'row',
    alignItems: 'center',
    gap: rs(12),
  },
  missionRowCompleted: {
    borderColor: GREEN,
    opacity: 0.75,
  },
  missionLeft: {
    flex: 1,
    gap: rs(6),
  },
  missionDesc: {
    color: TEXT_PRIMARY,
    fontSize: rf(13),
    fontWeight: '600',
  },
  missionDescCompleted: {
    color: TEXT_SECONDARY,
    textDecorationLine: 'line-through',
  },
  missionBarTrack: {
    height: 5,
    borderRadius: 3,
    backgroundColor: BORDER,
    overflow: 'hidden',
  },
  missionBarFill: {
    height: '100%',
    borderRadius: 3,
    backgroundColor: GOLD,
  },
  missionBarCompleted: {
    backgroundColor: GREEN,
  },
  missionProgress: {
    color: TEXT_SECONDARY,
    fontSize: rf(10),
    fontWeight: '500',
  },
  missionXPBadge: {
    alignItems: 'center',
    gap: rs(2),
    minWidth: 48,
  },
  missionXPText: {
    color: GOLD,
    fontSize: rf(12),
    fontWeight: '700',
  },
  missionCheck: {
    color: GREEN,
    fontSize: rf(14),
    fontWeight: '800',
  },

  bottomSpacer: {
    height: rs(32),
  },
});
