export type RewardType = 'chips' | 'card_back' | 'avatar' | 'table_theme' | 'emote_pack' | 'profile_frame';

export interface TierRewardItem {
  type: RewardType;
  amount?: number;   // for chips
  id?: string;       // for cosmetics
}

export interface TierReward {
  tier: number;
  free: TierRewardItem;
  premium: TierRewardItem;
}

export const BATTLE_PASS_CONFIG = {
  seasonName: 'Season 1 — First Deal',
  seasonDuration: 8 * 7 * 24 * 60 * 60 * 1000,
  maxTier: 30,
  premiumChipCost: 5000,

  xpPerGame: 50,
  xpPerBoardWin: 25,
  xpPerGameWin: 100,
  xpPerComplete: 200,
  xpPerDailyMission: 75,
  xpPerWeeklyMission: 200,
  xpPerOnlineWin: 150,

  tierXP: [
    0, 100, 250, 450, 700, 1000, 1400, 1850, 2350, 2900,
    3500, 4200, 5000, 5900, 6900, 8000, 9200, 10500, 12000, 13600,
    15300, 17200, 19200, 21400, 23800, 26400, 29200, 32200, 35500, 39000,
  ],
} as const;

export const TIER_REWARDS: TierReward[] = [
  { tier: 1,  free: { type: 'chips', amount: 500 },          premium: { type: 'card_back', id: 'royal_red' } },
  { tier: 2,  free: { type: 'chips', amount: 300 },          premium: { type: 'chips', amount: 1000 } },
  { tier: 3,  free: { type: 'avatar', id: 'fox' },           premium: { type: 'table_theme', id: 'ocean' } },
  { tier: 4,  free: { type: 'chips', amount: 400 },          premium: { type: 'emote_pack', id: 'reactions_1' } },
  { tier: 5,  free: { type: 'chips', amount: 1000 },         premium: { type: 'card_back', id: 'neon_green' } },
  { tier: 6,  free: { type: 'chips', amount: 500 },          premium: { type: 'chips', amount: 1500 } },
  { tier: 7,  free: { type: 'chips', amount: 300 },          premium: { type: 'avatar', id: 'wolf' } },
  { tier: 8,  free: { type: 'avatar', id: 'cat' },           premium: { type: 'profile_frame', id: 'bronze' } },
  { tier: 9,  free: { type: 'chips', amount: 600 },          premium: { type: 'table_theme', id: 'emerald' } },
  { tier: 10, free: { type: 'chips', amount: 2000 },         premium: { type: 'card_back', id: 'casino_gold' } },
  { tier: 11, free: { type: 'chips', amount: 500 },          premium: { type: 'chips', amount: 2000 } },
  { tier: 12, free: { type: 'chips', amount: 400 },          premium: { type: 'emote_pack', id: 'celebrations' } },
  { tier: 13, free: { type: 'chips', amount: 700 },          premium: { type: 'avatar', id: 'eagle' } },
  { tier: 14, free: { type: 'chips', amount: 500 },          premium: { type: 'table_theme', id: 'cherry_blossom' } },
  { tier: 15, free: { type: 'profile_frame', id: 'silver' }, premium: { type: 'card_back', id: 'holographic' } },
  { tier: 16, free: { type: 'chips', amount: 600 },          premium: { type: 'chips', amount: 2500 } },
  { tier: 17, free: { type: 'chips', amount: 500 },          premium: { type: 'avatar', id: 'phoenix' } },
  { tier: 18, free: { type: 'chips', amount: 800 },          premium: { type: 'table_theme', id: 'midnight' } },
  { tier: 19, free: { type: 'chips', amount: 500 },          premium: { type: 'emote_pack', id: 'taunts' } },
  { tier: 20, free: { type: 'chips', amount: 3000 },         premium: { type: 'card_back', id: 'diamond_blue' } },
  { tier: 21, free: { type: 'chips', amount: 700 },          premium: { type: 'chips', amount: 3000 } },
  { tier: 22, free: { type: 'chips', amount: 500 },          premium: { type: 'profile_frame', id: 'gold' } },
  { tier: 23, free: { type: 'chips', amount: 900 },          premium: { type: 'table_theme', id: 'sunset_gold' } },
  { tier: 24, free: { type: 'chips', amount: 600 },          premium: { type: 'avatar', id: 'dragon' } },
  { tier: 25, free: { type: 'avatar', id: 'crown' },         premium: { type: 'card_back', id: 'animated_fire' } },
  { tier: 26, free: { type: 'chips', amount: 800 },          premium: { type: 'chips', amount: 5000 } },
  { tier: 27, free: { type: 'chips', amount: 1000 },         premium: { type: 'emote_pack', id: 'legendary' } },
  { tier: 28, free: { type: 'chips', amount: 1000 },         premium: { type: 'table_theme', id: 'royal_velvet' } },
  { tier: 29, free: { type: 'chips', amount: 1500 },         premium: { type: 'profile_frame', id: 'diamond' } },
  { tier: 30, free: { type: 'chips', amount: 5000 },         premium: { type: 'card_back', id: 'legendary_diamond' } },
];
