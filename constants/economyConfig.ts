/**
 * Economy feature flags and tuning values.
 * All flags default to OFF — flip individually when ready to enable.
 * Values are tuning knobs for the economy loop (CAPS ECONOMY 01 design).
 */

export const ECONOMY_FLAGS = {
  /** Deduct buy-in chips before dealing cards */
  matchCostEnabled: false,
  /** Show daily reward claim button on home screen */
  dailyRewardEnabled: true,
  /** Show free refill button when bankrupt (replaces "Reset Chips") */
  freeRefillEnabled: true,
  /** Sync wallet balance to Supabase */
  walletSyncEnabled: false,
  /** Show ad-for-chips reward button */
  adRewardEnabled: false,
  /** Sit & Go mode — not yet available */
  sit_n_go_enabled: false,
  /** Battle Pass mode — not yet available */
  battle_pass_enabled: false,
} as const;

export const ECONOMY_VALUES = {
  /** Base daily reward in chips */
  dailyRewardBase: 200,
  /** Extra chips per consecutive login day */
  dailyRewardStreakBonus: 50,
  /** Max streak days for bonus calculation */
  dailyRewardStreakCap: 7,
  /** Chips granted on free refill */
  freeRefillAmount: 500,
  /** Cooldown between free refills in ms (0 = unlimited) */
  freeRefillCooldownMs: 0,
} as const;
