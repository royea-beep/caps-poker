import {
  getTierForXP,
  awardXP,
  getProgressToNextTier,
  formatRewardLabel,
} from '../battlePass';
import {
  BATTLE_PASS_CONFIG,
  TIER_REWARDS,
  TierRewardItem,
} from '../../constants/battlePassConfig';

const { tierXP, maxTier } = BATTLE_PASS_CONFIG;

describe('getTierForXP', () => {
  it('returns tier 1 for xp=0 (tierXP[0]=0 so xp>=0 qualifies)', () => {
    expect(getTierForXP(0)).toBe(1);
  });

  it('returns tier 1 for xp just below the tier-2 threshold (xp=99)', () => {
    expect(getTierForXP(99)).toBe(1);
  });

  it('returns correct tier at T6 threshold (xp=1000)', () => {
    // tierXP[5] = 1000 → tier 6 (index 5 → return i+1 = 6)
    expect(getTierForXP(1000)).toBe(6);
  });

  it('returns correct tier at T10 threshold (xp=2900)', () => {
    // tierXP[9] = 2900 → tier 10
    expect(getTierForXP(2900)).toBe(10);
  });

  it('returns correct tier at T20 threshold (xp=13600)', () => {
    // tierXP[19] = 13600 → tier 20
    expect(getTierForXP(13600)).toBe(20);
  });

  it('returns correct tier at T30 threshold (xp=39000)', () => {
    // tierXP[29] = 39000 → tier 30 (max)
    expect(getTierForXP(39000)).toBe(30);
  });

  it('returns max tier (30) for xp well above the last threshold', () => {
    expect(getTierForXP(999999)).toBe(30);
  });
});

describe('awardXP', () => {
  it('returns correct newXP and unlockedTiers when crossing one tier', () => {
    // Start at 50 XP (tier 1), add 60 → total 110, crosses tierXP[1]=100 → tier 2
    const result = awardXP(50, 60);
    expect(result.newXP).toBe(110);
    expect(result.unlockedTiers).toEqual([2]);
    expect(result.newTier).toBe(2);
    expect(result.oldTier).toBe(1);
  });

  it('returns multiple unlockedTiers on a big jump (0→5000)', () => {
    // At 0: tier 1. At 5000: tierXP[12]=5000 → tier 13
    // Should unlock tiers 2..13
    const result = awardXP(0, 5000);
    expect(result.newXP).toBe(5000);
    expect(result.newTier).toBe(13);
    expect(result.unlockedTiers.length).toBeGreaterThan(1);
    expect(result.unlockedTiers).toContain(2);
    expect(result.unlockedTiers).toContain(13);
  });

  it('returns empty unlockedTiers when staying within the same tier', () => {
    // 0 → 50, both tier 1
    const result = awardXP(0, 50);
    expect(result.unlockedTiers).toHaveLength(0);
    expect(result.newXP).toBe(50);
  });

  it('handles awarding 0 XP with no side effects', () => {
    const result = awardXP(500, 0);
    expect(result.newXP).toBe(500);
    expect(result.unlockedTiers).toHaveLength(0);
    expect(result.oldTier).toBe(result.newTier);
  });
});

describe('getProgressToNextTier', () => {
  it('returns progress between 0 and 1 for mid-tier xp', () => {
    // tier 1 spans xp 0..100; at xp=50 progress=0.5
    const { progress } = getProgressToNextTier(50);
    expect(progress).toBeGreaterThan(0);
    expect(progress).toBeLessThan(1);
  });

  it('returns {progress:1, xpNeeded:0} at max tier', () => {
    const result = getProgressToNextTier(39000);
    expect(result.progress).toBe(1);
    expect(result.xpNeeded).toBe(0);
  });

  it('returns progress=0 at exact start of tier', () => {
    // tierXP[1]=100 is the start of tier 2; xp=100 is exactly tier-2 start
    const { progress } = getProgressToNextTier(100);
    expect(progress).toBe(0);
  });
});

describe('tierXP thresholds', () => {
  it('all 30 thresholds are strictly ascending', () => {
    for (let i = 1; i < maxTier; i++) {
      expect(tierXP[i]).toBeGreaterThan(tierXP[i - 1]);
    }
  });

  it('array length matches maxTier (30)', () => {
    expect(tierXP.length).toBe(30);
  });
});

describe('TIER_REWARDS', () => {
  it('has exactly 30 entries (one per tier)', () => {
    expect(TIER_REWARDS).toHaveLength(30);
  });

  it('each reward has both free and premium fields', () => {
    for (const reward of TIER_REWARDS) {
      expect(reward.free).toBeDefined();
      expect(reward.premium).toBeDefined();
    }
  });

  it('tier numbers are sequential 1..30', () => {
    const tiers = TIER_REWARDS.map((r) => r.tier);
    for (let i = 0; i < 30; i++) {
      expect(tiers[i]).toBe(i + 1);
    }
  });
});

describe('formatRewardLabel', () => {
  const rewardTypes: TierRewardItem[] = [
    { type: 'chips', amount: 500 },
    { type: 'card_back', id: 'royal_red' },
    { type: 'avatar', id: 'fox' },
    { type: 'table_theme', id: 'ocean' },
    { type: 'emote_pack', id: 'reactions_1' },
    { type: 'profile_frame', id: 'bronze' },
  ];

  it('returns a non-empty string for each reward type', () => {
    for (const reward of rewardTypes) {
      const label = formatRewardLabel(reward);
      expect(typeof label).toBe('string');
      expect(label.length).toBeGreaterThan(0);
    }
  });

  it('formats chips correctly', () => {
    expect(formatRewardLabel({ type: 'chips', amount: 500 })).toBe('500 Chips');
  });

  it('formats card_back with title-cased id', () => {
    expect(formatRewardLabel({ type: 'card_back', id: 'royal_red' })).toBe('Card Back: Royal Red');
  });

  it('formats avatar with title-cased id', () => {
    expect(formatRewardLabel({ type: 'avatar', id: 'fox' })).toBe('Avatar: Fox');
  });
});
