import {
  BATTLE_PASS_CONFIG,
  TierRewardItem,
} from '../constants/battlePassConfig';

type BattlePassConfig = typeof BATTLE_PASS_CONFIG;

/**
 * Returns the current tier (1–30) for a given cumulative XP.
 * Returns 0 if XP is below tier 1 threshold.
 * tierXP[i] is the cumulative XP needed to have reached tier (i+1).
 */
export function getTierForXP(
  xp: number,
  config: BattlePassConfig = BATTLE_PASS_CONFIG,
): number {
  const { tierXP, maxTier } = config;
  // Iterate from the highest tier down to find the current tier
  for (let i = maxTier - 1; i >= 0; i--) {
    if (xp >= tierXP[i]) {
      return i + 1; // tiers are 1-indexed
    }
  }
  return 0;
}

/**
 * Awards XP and returns the new state plus any tiers that were unlocked.
 */
export function awardXP(
  currentXP: number,
  amount: number,
  config: BattlePassConfig = BATTLE_PASS_CONFIG,
): { newXP: number; oldTier: number; newTier: number; unlockedTiers: number[] } {
  const oldTier = getTierForXP(currentXP, config);
  const newXP = currentXP + amount;
  const newTier = getTierForXP(newXP, config);

  const unlockedTiers: number[] = [];
  for (let t = oldTier + 1; t <= newTier; t++) {
    unlockedTiers.push(t);
  }

  return { newXP, oldTier, newTier, unlockedTiers };
}

/**
 * Returns progress toward the next tier as a 0–1 fraction, plus raw XP values.
 * At max tier, progress is 1 and xpNeeded is 0.
 */
export function getProgressToNextTier(
  xp: number,
  config: BattlePassConfig = BATTLE_PASS_CONFIG,
): { progress: number; xpNeeded: number; xpInTier: number } {
  const { tierXP, maxTier } = config;
  const currentTier = getTierForXP(xp, config);

  if (currentTier >= maxTier) {
    return { progress: 1, xpNeeded: 0, xpInTier: 0 };
  }

  // tierXP is 0-indexed: index i = XP threshold to reach tier (i+1)
  const tierStartXP = tierXP[currentTier - 1] ?? 0; // XP at start of current tier (or 0 if tier 0)
  const tierEndXP = tierXP[currentTier];             // XP needed to reach next tier

  const xpInTier = xp - (currentTier === 0 ? 0 : tierStartXP);
  const tierWidth = tierEndXP - (currentTier === 0 ? 0 : tierStartXP);
  const xpNeeded = tierEndXP - xp;

  const progress = tierWidth > 0 ? Math.min(1, xpInTier / tierWidth) : 1;

  return { progress, xpNeeded, xpInTier };
}

/**
 * Returns how much time is left in the season.
 */
export function getSeasonTimeRemaining(
  seasonStartDate: string,
  config: BattlePassConfig = BATTLE_PASS_CONFIG,
): { daysLeft: number; hoursLeft: number; expired: boolean } {
  const start = new Date(seasonStartDate).getTime();
  const end = start + config.seasonDuration;
  const now = Date.now();
  const remaining = end - now;

  if (remaining <= 0) {
    return { daysLeft: 0, hoursLeft: 0, expired: true };
  }

  const totalHours = Math.floor(remaining / (1000 * 60 * 60));
  const daysLeft = Math.floor(totalHours / 24);
  const hoursLeft = totalHours % 24;

  return { daysLeft, hoursLeft, expired: false };
}

/**
 * Returns a human-readable label for a reward item.
 * e.g. "500 Chips", "Card Back: Royal Red", "Avatar: Fox"
 */
export function formatRewardLabel(reward: TierRewardItem): string {
  if (reward.type === 'chips') {
    return `${reward.amount ?? 0} Chips`;
  }

  const idLabel = reward.id
    ? reward.id
        .split('_')
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ')
    : '';

  switch (reward.type) {
    case 'card_back':
      return `Card Back: ${idLabel}`;
    case 'avatar':
      return `Avatar: ${idLabel}`;
    case 'table_theme':
      return `Table Theme: ${idLabel}`;
    case 'emote_pack':
      return `Emote Pack: ${idLabel}`;
    case 'profile_frame':
      return `Profile Frame: ${idLabel}`;
    default: {
      // exhaustive check — TypeScript will error if a new RewardType is added
      const _exhaustive: never = reward.type;
      return String(_exhaustive);
    }
  }
}
