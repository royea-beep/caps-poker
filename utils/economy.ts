/**
 * Pure economy utility functions.
 * No store mutations, no side effects, no UI — just calculations.
 * Wire into game flow in later VAMOS steps behind ECONOMY_FLAGS.
 */

import { ECONOMY_VALUES } from '../constants/economyConfig';

// ---------------------------------------------------------------------------
// Date helpers (internal)
// ---------------------------------------------------------------------------

/** Get start-of-day (midnight UTC) for a Date */
function startOfDayUTC(d: Date): number {
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

/** Number of full calendar days (UTC) between two dates */
function daysBetween(a: Date, b: Date): number {
  const msPerDay = 86_400_000;
  return Math.floor(
    Math.abs(startOfDayUTC(a) - startOfDayUTC(b)) / msPerDay,
  );
}

// ---------------------------------------------------------------------------
// 1. Daily reward
// ---------------------------------------------------------------------------

/**
 * Whether the player can claim a daily reward right now.
 * Logic: eligible if lastClaim is null (never claimed) or lastClaim's
 * calendar day (UTC) is before today's calendar day (UTC).
 */
export function canClaimDailyReward(
  lastClaim: string | null,
  now: Date = new Date(),
): boolean {
  if (!lastClaim) return true;
  const lastDate = new Date(lastClaim);
  if (isNaN(lastDate.getTime())) return true; // corrupt value → allow claim
  return startOfDayUTC(now) > startOfDayUTC(lastDate);
}

/**
 * Calculate the new streak value after claiming today.
 * - If lastClaim was yesterday (UTC): streak increments (capped).
 * - If lastClaim was today: streak unchanged (shouldn't claim, but safe).
 * - If lastClaim is null or >1 day ago: streak resets to 1.
 */
export function getNextStreak(
  lastClaim: string | null,
  currentStreak: number,
  now: Date = new Date(),
): number {
  if (!lastClaim) return 1;
  const lastDate = new Date(lastClaim);
  if (isNaN(lastDate.getTime())) return 1;

  const gap = daysBetween(now, lastDate);
  if (gap === 1) {
    // Consecutive day — increment, cap at streakCap
    return Math.min(currentStreak + 1, ECONOMY_VALUES.dailyRewardStreakCap);
  }
  if (gap === 0) {
    // Same day — no change (double-claim guard)
    return currentStreak;
  }
  // Missed a day — reset
  return 1;
}

/**
 * Calculate the chip reward for a given streak value.
 * Formula: base + (min(streak, cap) - 1) × bonus
 * Streak 1 = base only. Streak 7 = base + 6×bonus.
 */
export function calculateDailyReward(streak: number): number {
  const clampedStreak = Math.max(1, Math.min(streak, ECONOMY_VALUES.dailyRewardStreakCap));
  return (
    ECONOMY_VALUES.dailyRewardBase +
    (clampedStreak - 1) * ECONOMY_VALUES.dailyRewardStreakBonus
  );
}

// ---------------------------------------------------------------------------
// 2. Free refill
// ---------------------------------------------------------------------------

/**
 * Whether the player can use a free refill right now.
 * If cooldown is 0, refill is always available.
 * Otherwise, checks that enough time has elapsed since lastFreeRefill.
 */
export function canUseFreeRefill(
  lastFreeRefill: string | null,
  now: Date = new Date(),
): boolean {
  if (ECONOMY_VALUES.freeRefillCooldownMs === 0) return true;
  if (!lastFreeRefill) return true;
  const lastDate = new Date(lastFreeRefill);
  if (isNaN(lastDate.getTime())) return true;
  return now.getTime() - lastDate.getTime() >= ECONOMY_VALUES.freeRefillCooldownMs;
}

/** The chip amount granted by a free refill. */
export function getFreeRefillAmount(): number {
  return ECONOMY_VALUES.freeRefillAmount;
}

// ---------------------------------------------------------------------------
// 3. Match cost
// ---------------------------------------------------------------------------

/**
 * Calculate the entry cost for a match.
 * Defaults mirror existing CAPS config: potPerBoard × boardCount.
 */
export function getMatchCost(potPerBoard: number, boardCount: number): number {
  return potPerBoard * boardCount;
}

/** Whether the player's balance covers the match entry cost. */
export function canAffordMatch(balance: number, matchCost: number): boolean {
  return balance >= matchCost;
}

// ---------------------------------------------------------------------------
// 4. Economy transaction helpers (pure math)
// ---------------------------------------------------------------------------

/** Apply a reward (add chips). Returns new balance. */
export function applyReward(balance: number, amount: number): number {
  return balance + Math.max(0, amount);
}

/** Apply a spend (deduct chips). Returns new balance (never below 0). */
export function applySpend(balance: number, amount: number): number {
  return Math.max(0, balance - Math.max(0, amount));
}

// ---------------------------------------------------------------------------
// 5. Economy status summary
// ---------------------------------------------------------------------------

export interface EconomyStatus {
  canClaimReward: boolean;
  nextRewardAmount: number;
  nextStreak: number;
  canRefill: boolean;
  refillAmount: number;
  canAfford: boolean;
  matchCost: number;
}

/**
 * Snapshot of a player's economy eligibility.
 * Useful for UI to decide what buttons/states to show.
 */
export function getEconomyStatus(
  balance: number,
  potPerBoard: number,
  boardCount: number,
  lastDailyRewardClaim: string | null,
  dailyRewardStreak: number,
  lastFreeRefill: string | null,
  now: Date = new Date(),
): EconomyStatus {
  const canClaim = canClaimDailyReward(lastDailyRewardClaim, now);
  const nextStreak = canClaim
    ? getNextStreak(lastDailyRewardClaim, dailyRewardStreak, now)
    : dailyRewardStreak;
  const cost = getMatchCost(potPerBoard, boardCount);

  return {
    canClaimReward: canClaim,
    nextRewardAmount: calculateDailyReward(canClaim ? nextStreak : dailyRewardStreak),
    nextStreak,
    canRefill: canUseFreeRefill(lastFreeRefill, now),
    refillAmount: getFreeRefillAmount(),
    canAfford: canAffordMatch(balance, cost),
    matchCost: cost,
  };
}
