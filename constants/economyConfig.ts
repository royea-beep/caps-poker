/**
 * Economy feature flags and tuning values.
 * All flags default to OFF — flip individually when ready to enable.
 * Values are tuning knobs for the economy loop (CAPS ECONOMY 01 design).
 */

export const ECONOMY_FLAGS = {
  /** Deduct buy-in chips before dealing cards */
  matchCostEnabled: true,
  /** Show daily reward claim button on home screen */
  dailyRewardEnabled: true,
  /** Show free refill button when bankrupt (replaces "Reset Chips") */
  freeRefillEnabled: true,
  /** Sync wallet balance to Supabase */
  walletSyncEnabled: false,
  /** Show ad-for-chips reward button */
  adRewardEnabled: false,
  /** Sit & Go mode — not yet available */
  sit_n_go_enabled: true,
  // VAMOS-NAV-DEAD-CODE 2026-08-31 — `battle_pass_enabled` removed: it was defined here but read by
  // NO client code (repo-wide grep = 0), so the flag read as a control while controlling nothing —
  // the Battle Pass screen renders regardless. The screen stays (Roye's ruling); only the dead flag
  // goes. (The equally-unread app_config.battle_pass_enabled DB row is left for a future DB sprint;
  // this sprint does not touch the database.)
} as const;

export const ECONOMY_VALUES = {
  /** Base daily reward in chips (Day 1) */
  dailyRewardBase: 50,
  /** Extra chips per consecutive login day (Days 2-6) */
  dailyRewardStreakBonus: 25,
  /** Max streak days tracked (Day 7 = weekly bonus, Day 30 = monthly bonus) */
  dailyRewardStreakCap: 30,
  /** Chips granted on free refill */
  freeRefillAmount: 500,
  /** Cooldown between free refills in ms (0 = unlimited) */
  freeRefillCooldownMs: 0,
} as const;
