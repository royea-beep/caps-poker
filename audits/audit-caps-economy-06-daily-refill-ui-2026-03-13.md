# Audit — VAMOS CAPS ECONOMY 06: Daily Reward + Free Refill UI
**Date:** 2026-03-13

## Scope
Wire daily reward and free refill UI on home screen behind feature flags. Add economy state setters to store. No behavior change when flags are off.

## Files Changed

| File | Action |
|------|--------|
| `store/gameStore.ts` | Added `setLastDailyRewardClaim`, `setDailyRewardStreak`, `setLastFreeRefill` actions (interface + implementation) |
| `app/index.tsx` | Economy imports, store selectors for economy fields, `handleClaimDailyReward` + `handleFreeRefill` handlers, conditional UI rendering |

## What Each Change Does

### store/gameStore.ts
Three new actions to mutate economy state:
- `setLastDailyRewardClaim(iso)`: sets ISO date string
- `setDailyRewardStreak(streak)`: sets streak count
- `setLastFreeRefill(iso)`: sets ISO date string

### app/index.tsx

**New store selectors:** `lastDailyRewardClaim`, `dailyRewardStreak`, `lastFreeRefill`

**`handleClaimDailyReward`:**
1. Double-checks `canClaimDailyReward()` (guard against stale UI state)
2. Calculates `getNextStreak()` → `calculateDailyReward()`
3. Updates: `addChips(reward)`, `trackChipsEarned(reward)`, `setLastDailyRewardClaim(now)`, `setDailyRewardStreak(nextStreak)`
4. Shows Alert with reward amount and streak info

**`handleFreeRefill`:**
1. Checks `canUseFreeRefill()` (guard against cooldown)
2. Gets `getFreeRefillAmount()`
3. Updates: `addChips(amount)`, `trackChipsEarned(amount)`, `setLastFreeRefill(now)`
4. Shows Alert confirming refill

**UI changes (all flag-gated):**

| Flag | UI When ON | UI When OFF |
|------|-----------|-------------|
| `dailyRewardEnabled` | "CLAIM DAILY REWARD" / "REWARD CLAIMED" button above main buttons | Nothing rendered |
| `freeRefillEnabled` | "FREE REFILL" / "REFILL USED" button replaces "Reset Chips" | "Reset Chips" button unchanged |

## Behavior Matrix

| dailyRewardEnabled | freeRefillEnabled | Home Screen |
|-------------------|-------------------|-------------|
| `false` (current) | `false` (current) | Identical to before: no reward button, "Reset Chips" visible |
| `true` | `false` | Daily reward button appears, "Reset Chips" still present |
| `false` | `true` | No reward button, "Reset Chips" replaced by "FREE REFILL" |
| `true` | `true` | Both reward + refill buttons, "Reset Chips" gone |

## Zero-Risk Verification
- Both flags are `false` — daily reward section not rendered, "Reset Chips" path active
- `ECONOMY_FLAGS.dailyRewardEnabled && (...)` short-circuits to `false && (...)` = nothing rendered
- `ECONOMY_FLAGS.freeRefillEnabled ? (...) : (Reset Chips)` takes the else branch = "Reset Chips" unchanged
- New store actions are never called while flags are off
- TypeScript compiles cleanly (0 errors)
