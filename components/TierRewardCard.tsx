/**
 * TierRewardCard — small card for a single Battle Pass tier reward.
 * Shows tier number, reward icon/label, claim button, or lock icon.
 * Uses RN Animated only — ZERO Reanimated.
 */
import React from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { rf, rs, rv } from '../utils/responsive';
import { TierRewardItem, RewardType } from '../constants/battlePassConfig';
import { formatRewardLabel } from '../utils/battlePass';

const BG = '#0d0700';
const SURFACE = '#1a0e06';
const BORDER = '#3d2a1a';
const TEXT_PRIMARY = '#f5e6d3';
const TEXT_SECONDARY = '#78716C';
const GOLD = '#c96a1a';
const GREEN = '#4ade80';
const GRAY = '#44403C';

const REWARD_EMOJI: Record<RewardType, string> = {
  chips: '💰',
  card_back: '🃏',
  avatar: '👤',
  table_theme: '🎨',
  emote_pack: '😄',
  profile_frame: '🖼️',
};

export interface TierRewardCardProps {
  tier: number;
  rewardItem: TierRewardItem;
  isUnlocked: boolean;
  isClaimed: boolean;
  isPremiumTrack: boolean;
  onClaim?: (tier: number, isPremium: boolean) => void;
}

export default function TierRewardCard({
  tier,
  rewardItem,
  isUnlocked,
  isClaimed,
  isPremiumTrack,
  onClaim,
}: TierRewardCardProps) {
  const emoji = REWARD_EMOJI[rewardItem.type] ?? '🎁';
  const label = formatRewardLabel(rewardItem);

  function handleClaim() {
    Alert.alert(
      isPremiumTrack ? `Premium Tier ${tier}` : `Tier ${tier}`,
      label,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Claim',
          onPress: () => onClaim?.(tier, isPremiumTrack),
        },
      ],
    );
  }

  const locked = !isUnlocked;

  return (
    <View
      style={[
        styles.card,
        locked && styles.cardLocked,
        isClaimed && styles.cardClaimed,
        isPremiumTrack && !locked && styles.cardPremium,
      ]}
    >
      {/* Tier number */}
      <Text style={[styles.tierNum, locked && styles.tierNumLocked]}>
        {tier}
      </Text>

      {/* Reward icon */}
      <Text style={[styles.icon, locked && styles.iconLocked]}>
        {locked ? '🔒' : emoji}
      </Text>

      {/* Reward label */}
      <Text
        style={[styles.label, locked && styles.labelLocked]}
        numberOfLines={2}
      >
        {label}
      </Text>

      {/* Claim / claimed / locked state */}
      {!locked && !isClaimed && (
        <Pressable
          style={styles.claimBtn}
          onPress={handleClaim}
          android_ripple={{ color: 'rgba(201,106,26,0.3)' }}
        >
          <Text style={styles.claimBtnText}>CLAIM</Text>
        </Pressable>
      )}

      {isClaimed && (
        <View style={styles.claimedBadge}>
          <Text style={styles.claimedText}>✓ CLAIMED</Text>
        </View>
      )}

      {/* Premium track indicator dot */}
      {isPremiumTrack && (
        <View style={[styles.trackDot, locked && styles.trackDotLocked]} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: rs(88),
    minHeight: rs(120),
    backgroundColor: SURFACE,
    borderRadius: rv(8),
    borderWidth: 1,
    borderColor: BORDER,
    alignItems: 'center',
    padding: rs(8),
    gap: rs(4),
    position: 'relative',
  },
  cardLocked: {
    opacity: 0.45,
  },
  cardClaimed: {
    borderColor: GREEN,
    borderWidth: 1.5,
  },
  cardPremium: {
    borderColor: GOLD,
    borderWidth: 1.5,
  },
  tierNum: {
    color: GOLD,
    fontSize: rf(10),
    fontWeight: '700',
    letterSpacing: 1,
    alignSelf: 'flex-start',
  },
  tierNumLocked: {
    color: TEXT_SECONDARY,
  },
  icon: {
    fontSize: rf(24),
    lineHeight: rf(30),
  },
  iconLocked: {
    opacity: 0.6,
  },
  label: {
    color: TEXT_PRIMARY,
    fontSize: rf(10),
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: rf(14),
    flex: 1,
  },
  labelLocked: {
    color: TEXT_SECONDARY,
  },
  claimBtn: {
    marginTop: rs(4),
    backgroundColor: GOLD,
    borderRadius: rv(4),
    paddingVertical: rs(3),
    paddingHorizontal: rs(10),
    alignSelf: 'stretch',
    alignItems: 'center',
  },
  claimBtnText: {
    color: '#fff',
    fontSize: rf(9),
    fontWeight: '800',
    letterSpacing: 1,
  },
  claimedBadge: {
    marginTop: rs(4),
    backgroundColor: 'rgba(74,222,128,0.12)',
    borderRadius: rv(4),
    paddingVertical: rs(3),
    paddingHorizontal: rs(6),
    alignSelf: 'stretch',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: GREEN,
  },
  claimedText: {
    color: GREEN,
    fontSize: rf(8),
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  trackDot: {
    position: 'absolute',
    top: rs(4),
    right: rs(4),
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: GOLD,
  },
  trackDotLocked: {
    backgroundColor: GRAY,
  },
});
