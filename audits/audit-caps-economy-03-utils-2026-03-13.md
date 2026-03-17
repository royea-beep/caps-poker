# Audit — VAMOS CAPS ECONOMY 03: Pure Economy Utility Functions
**Date:** 2026-03-13

## Scope
Create pure utility functions for daily reward, free refill, match cost, and economy status. No wiring, no UI, no behavior changes.

## Files Changed

| File | Action |
|------|--------|
| `utils/economy.ts` | **Created** — 11 exported functions/types, 0 side effects |

## Functions Added

| Function | Purpose |
|----------|---------|
| `canClaimDailyReward(lastClaim, now?)` | Calendar-day (UTC) eligibility check |
| `getNextStreak(lastClaim, currentStreak, now?)` | Streak calculation: +1 if consecutive, reset if gap >1 day |
| `calculateDailyReward(streak)` | Chip amount: base + (streak-1) × bonus |
| `canUseFreeRefill(lastFreeRefill, now?)` | Cooldown check (0 = always available) |
| `getFreeRefillAmount()` | Returns ECONOMY_VALUES.freeRefillAmount |
| `getMatchCost(potPerBoard, boardCount)` | potPerBoard × boardCount |
| `canAffordMatch(balance, matchCost)` | balance >= matchCost |
| `applyReward(balance, amount)` | balance + amount (clamped ≥0) |
| `applySpend(balance, amount)` | balance - amount (clamped ≥0) |
| `getEconomyStatus(...)` | Composite snapshot of all eligibility states |
| `EconomyStatus` (interface) | Type for the status snapshot |

## Key Logic Decisions

### Daily Claim
- Uses UTC calendar days: `startOfDayUTC(now) > startOfDayUTC(lastClaim)`
- Prevents same-day double claim, allows claim after midnight UTC
- Corrupt/null lastClaim → treated as first claim (safe default)

### Streak
- Yesterday (gap=1): increment, capped at dailyRewardStreakCap (7)
- Same day (gap=0): no change (double-claim guard)
- Gap >1: reset to 1
- Reward formula: base + (clampedStreak - 1) × bonus → streak 1 = 200, streak 7 = 500

### Refill
- Cooldown 0 → always available (current config)
- Otherwise: `now - lastRefill >= cooldownMs`
- Null/corrupt lastRefill → available

### Match Cost
- Passes through potPerBoard × boardCount — identical to existing CAPS settings.tsx calculation

## Zero-Risk Verification
- File is not imported anywhere yet — pure dead code
- All functions are pure (no store reads/writes, no async, no side effects)
- All take explicit parameters — no global state access
- TypeScript compiles cleanly (0 errors)
- Fully reversible: delete the file
